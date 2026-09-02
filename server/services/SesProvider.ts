import { db } from '../store.js';
import { eventProcessor, SesEventPayload } from './EventProcessor.js';

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
    const hasCredentials = Boolean(process.env.SES_SMTP_USERNAME && process.env.SES_SMTP_PASSWORD);
    const hasEvents = db.messageEvents.some(
      (e) => e.eventType === 'DELIVERED' || e.eventType === 'BOUNCED' || e.eventType === 'SENT'
    );
    return {
      status: hasEvents || hasCredentials ? 'healthy' : 'offline',
      region: this.region,
      quota: {
        max24HourSend: 0,
        sentLast24Hours: db.messages.length,
        maxSendRate: 0,
        bounceRatePercent: db.getDashboardStats().bounceRate,
        complaintRatePercent: 0,
        accountStatus: hasCredentials ? 'Configured' : hasEvents ? 'Active Webhook Telemetry' : 'Offline / Unconfigured',
      },
    };
  }

  // Ingest Amazon SNS Bounce Notification
  async processBounceWebhook(payload: {
    bounceType?: 'Permanent' | 'Transient' | string;
    bouncedRecipients?: Array<{ emailAddress: string; status?: string; diagnosticCode?: string }>;
    mail?: { messageId: string; source?: string; destination?: string[] };
    [key: string]: any;
  }): Promise<void> {
    eventProcessor.processSesNotification({
      eventType: 'Bounce',
      bounce: {
        bounceType: payload.bounceType,
        bouncedRecipients: payload.bouncedRecipients,
      },
      mail: payload.mail,
    });
  }

  // Ingest Amazon SNS Complaint Notification
  async processComplaintWebhook(payload: {
    complainedRecipients?: Array<{ emailAddress: string }>;
    complaintFeedbackType?: string;
    mail?: { messageId: string; source?: string };
    [key: string]: any;
  }): Promise<void> {
    eventProcessor.processSesNotification({
      eventType: 'Complaint',
      complaint: {
        complainedRecipients: payload.complainedRecipients,
        complaintFeedbackType: payload.complaintFeedbackType,
      },
      mail: payload.mail,
    });
  }

  // Process arbitrary SES event notification
  async processNotification(payload: SesEventPayload, meta?: { snsMessageId?: string; topicArn?: string }) {
    return eventProcessor.processSesNotification(payload, meta);
  }
}

export const sesProvider = new SesProvider();
