import { db } from '../store.js';

export interface EmailProvider {
  name: string;
  checkHealth(): Promise<{ status: 'healthy' | 'degraded' | 'offline'; region: string; quota: any }>;
  processBounceWebhook(payload: any): Promise<void>;
  processComplaintWebhook(payload: any): Promise<void>;
}

export class SesProvider implements EmailProvider {
  name = 'Amazon SES';
  private region: string;
  private smtpHost: string;
  private smtpPort: number;

  constructor() {
    this.region = process.env.SES_REGION || 'eu-west-1';
    this.smtpHost = process.env.SES_SMTP_HOST || 'email-smtp.eu-west-1.amazonaws.com';
    this.smtpPort = Number(process.env.SES_SMTP_PORT) || 587;
  }

  async checkHealth(): Promise<{ status: 'healthy' | 'degraded' | 'offline'; region: string; quota: any }> {
    return {
      status: 'healthy',
      region: this.region,
      quota: {
        max24HourSend: 500000,
        sentLast24Hours: 145490,
        maxSendRate: 200, // per second
        bounceRatePercent: 0.14,
        complaintRatePercent: 0.02,
        accountStatus: 'Healthy (Production Access Enabled)',
      },
    };
  }

  // Ingest Amazon SNS Bounce Notification
  async processBounceWebhook(payload: {
    bounceType: 'Permanent' | 'Transient';
    bouncedRecipients: Array<{ emailAddress: string; status: string; diagnosticCode?: string }>;
    mail: { messageId: string; source: string; destination: string[] };
  }): Promise<void> {
    const nowIso = new Date().toISOString();
    const { bounceType, bouncedRecipients, mail } = payload;

    for (const recipient of bouncedRecipients) {
      // Find message by RFC Message-ID or provider message ID
      const message = db.messages.find(
        (m) => m.providerMessageId === mail.messageId || m.toEmail.toLowerCase() === recipient.emailAddress.toLowerCase()
      );

      if (message) {
        message.status = 'BOUNCED';
        message.bouncedAt = nowIso;
        message.bounceType = bounceType === 'Permanent' ? 'Hard' : 'Soft';
        message.bounceReason = recipient.diagnosticCode || `SES ${bounceType} Bounce`;

        // Add event
        const evt = {
          id: `evt_ses_bnc_${Date.now()}`,
          messageId: message.messageId,
          eventType: 'BOUNCED' as const,
          eventData: { bounceType, diagnosticCode: recipient.diagnosticCode, source: 'ses_sns_webhook' },
          timestamp: nowIso,
        };
        message.events = message.events || [];
        message.events.push(evt);
        db.messageEvents.push(evt);
      }

      // Add to suppression list if permanent
      if (bounceType === 'Permanent') {
        const existing = db.suppressions.find((s) => s.email.toLowerCase() === recipient.emailAddress.toLowerCase());
        if (!existing) {
          db.suppressions.unshift({
            id: `sup_${Date.now()}`,
            email: recipient.emailAddress,
            type: 'HARD_BOUNCE',
            reason: recipient.diagnosticCode || 'Permanent Bounce reported by Amazon SES SNS webhook',
            source: 'ses_webhook',
            createdAt: nowIso,
          });
        }
      }
    }

    db.logs.unshift({
      id: `log_ses_${Date.now()}`,
      timestamp: nowIso,
      service: 'Amazon SES',
      event: 'SES_BOUNCE_WEBHOOK_PROCESSED',
      severity: 'WARN',
      response: `Processed ${bouncedRecipients.length} bounce records from SNS payload`,
      details: payload,
    });
  }

  // Ingest Amazon SNS Complaint Notification
  async processComplaintWebhook(payload: {
    complainedRecipients: Array<{ emailAddress: string }>;
    complaintFeedbackType?: string;
    mail: { messageId: string; source: string };
  }): Promise<void> {
    const nowIso = new Date().toISOString();
    const { complainedRecipients, complaintFeedbackType } = payload;

    for (const recipient of complainedRecipients) {
      const message = db.messages.find(
        (m) => m.toEmail.toLowerCase() === recipient.emailAddress.toLowerCase()
      );

      if (message) {
        message.status = 'COMPLAINED';
        const evt = {
          id: `evt_ses_cmp_${Date.now()}`,
          messageId: message.messageId,
          eventType: 'COMPLAINED' as const,
          eventData: { feedbackType: complaintFeedbackType || 'abuse', source: 'ses_feedback_loop' },
          timestamp: nowIso,
        };
        message.events = message.events || [];
        message.events.push(evt);
        db.messageEvents.push(evt);
      }

      const existing = db.suppressions.find((s) => s.email.toLowerCase() === recipient.emailAddress.toLowerCase());
      if (!existing) {
        db.suppressions.unshift({
          id: `sup_${Date.now()}`,
          email: recipient.emailAddress,
          type: 'COMPLAINT',
          reason: `Spam complaint received via Amazon SES Feedback Loop (${complaintFeedbackType || 'abuse'})`,
          source: 'ses_webhook',
          createdAt: nowIso,
        });
      }
    }

    db.logs.unshift({
      id: `log_ses_cmp_${Date.now()}`,
      timestamp: nowIso,
      service: 'Amazon SES',
      event: 'SES_COMPLAINT_WEBHOOK_PROCESSED',
      severity: 'ERROR',
      response: `Complaint logged for ${complainedRecipients.map((r) => r.emailAddress).join(', ')}`,
      details: payload,
    });
  }
}

export const sesProvider = new SesProvider();
