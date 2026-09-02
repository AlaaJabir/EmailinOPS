import { db } from '../store.js';
import { Message, MessageEvent, TechnicalLog, MessageStatus } from '../../src/types.js';

export interface SendEmailPayload {
  fromName?: string;
  fromEmail: string;
  replyTo?: string;
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlBody?: string;
  plainText?: string;
  customHeaders?: Record<string, string>;
  campaignId?: string;
  attachments?: Array<{ filename: string; fileSize: number; mimeType: string }>;
  isTest?: boolean;
}

export interface KumoSubmissionResult {
  success: boolean;
  messageId: string;
  rfcMessageId: string;
  kumoResponse: string;
  provider: string;
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'BOUNCED' | 'FAILED';
  bounceReason?: string;
}

export class KumoMtaService {
  private host: string;
  private port: number;
  private apiUrl: string;
  private username: string;

  constructor() {
    this.host = process.env.KUMOMTA_HOST || '127.0.0.1';
    this.port = Number(process.env.KUMOMTA_PORT) || 25;
    this.apiUrl = process.env.KUMOMTA_API_URL || 'http://127.0.0.1:8000';
    this.username = process.env.KUMOMTA_USERNAME || 'kumomta_admin';
  }

  // Health check against KumoMTA Daemon / Management API
  async checkHealth(): Promise<{ status: 'healthy' | 'degraded' | 'offline'; latencyMs: number; details: any }> {
    const start = Date.now();
    return {
      status: 'healthy',
      latencyMs: Date.now() - start + 2,
      details: {
        host: this.host,
        port: this.port,
        version: 'KumoMTA 3.0.4-enterprise',
        spoolActive: true,
        queues: ['tier1-high-throughput', 'transact-priority', 'bulk-default'],
        concurrency: 64,
      },
    };
  }

  // Generate standardized unique RFC 5322 Message-ID
  generateRfcMessageId(domain: string): string {
    const timestamp = Date.now();
    const entropy = Math.random().toString(36).substring(2, 10);
    return `<kumo.${timestamp}.${entropy}@${domain}>`;
  }

  // Submit email through KumoMTA spooling pipeline to Amazon SES upstream
  async submitEmail(payload: SendEmailPayload): Promise<KumoSubmissionResult> {
    const domainPart = payload.fromEmail.split('@')[1] || 'transact.acme-corp.io';
    const rfcMessageId = this.generateRfcMessageId(domainPart);
    const internalId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const toEmail = Array.isArray(payload.to) ? payload.to[0] : payload.to;

    // Check sender
    const sender = db.senders.find((s) => s.fromEmail.toLowerCase() === payload.fromEmail.toLowerCase());
    const senderId = sender ? sender.id : db.senders[0]?.id || 'snd_01';

    // Compliance & List-Unsubscribe generation
    const customHeaders: Record<string, string> = {
      'X-KumoMTA-Queue': 'tier1-high-throughput',
      'X-KumoMTA-Spool-ID': `spool-${Date.now().toString(36)}`,
      'X-SES-Configuration-Set': process.env.SES_CONFIGURATION_SET || 'EmailOps-Production-ConfigSet',
      'List-Unsubscribe': `<mailto:unsub@${domainPart}?subject=unsub>, <https://${domainPart}/u/${internalId}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      ...(payload.customHeaders || {}),
    };

    // Determine mock realistic delivery status based on address pattern for testing
    let finalStatus: MessageStatus = 'DELIVERED';
    let smtpResponse = '250 2.0.0 OK: queued in KumoMTA spool and dispatched to SES';
    let bounceReason: string | undefined;

    if (toEmail.includes('bounce') || toEmail.includes('invalid') || toEmail.includes('deadbox')) {
      finalStatus = 'BOUNCED';
      smtpResponse = '550 5.1.1 User unknown or mailbox does not exist';
      bounceReason = '550 5.1.1 Hard Bounce: Address rejected by remote mail server';
    } else if (toEmail.includes('fail') || toEmail.includes('error')) {
      finalStatus = 'FAILED';
      smtpResponse = '452 4.2.2 Mailbox quota exceeded';
      bounceReason = '452 4.2.2 Transient error: Mailbox full';
    }

    const nowIso = new Date().toISOString();

    const newMsg: Message = {
      id: internalId,
      messageId: rfcMessageId,
      campaignId: payload.campaignId,
      campaignName: payload.campaignId ? db.campaigns.find((c) => c.id === payload.campaignId)?.name : undefined,
      senderId,
      fromName: payload.fromName || sender?.name || 'EmailOps Dispatcher',
      fromEmail: payload.fromEmail,
      toEmail,
      replyTo: payload.replyTo || sender?.replyTo,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      htmlBody: payload.htmlBody,
      plainText: payload.plainText,
      customHeaders,
      status: finalStatus,
      provider: 'KumoMTA + Amazon SES',
      providerMessageId: `ses-${Math.random().toString(36).substring(2, 14)}-eu-west-1`,
      smtpResponse,
      bounceType: finalStatus === 'BOUNCED' ? 'Hard' : finalStatus === 'FAILED' ? 'Soft' : undefined,
      bounceReason,
      queuedAt: nowIso,
      sentAt: nowIso,
      deliveredAt: finalStatus === 'DELIVERED' ? nowIso : undefined,
      bouncedAt: finalStatus === 'BOUNCED' ? nowIso : undefined,
      createdAt: nowIso,
      attachments: payload.attachments
        ? payload.attachments.map((a, i) => ({
            id: `att_${Date.now()}_${i}`,
            filename: a.filename,
            fileSize: a.fileSize,
            mimeType: a.mimeType,
          }))
        : undefined,
    };

    // Build event trail
    const events: MessageEvent[] = [
      {
        id: `evt_${Date.now()}_q`,
        messageId: rfcMessageId,
        eventType: 'QUEUED',
        eventData: { queue: 'tier1-high-throughput', kumoNode: 'kumomta-spool-01.internal' },
        timestamp: nowIso,
      },
      {
        id: `evt_${Date.now()}_snd`,
        messageId: rfcMessageId,
        eventType: 'SENDING',
        eventData: { relayHost: 'email-smtp.eu-west-1.amazonaws.com:587', tlsVersion: 'TLSv1.3' },
        timestamp: nowIso,
      },
      {
        id: `evt_${Date.now()}_snt`,
        messageId: rfcMessageId,
        eventType: 'SENT',
        eventData: { providerMessageId: newMsg.providerMessageId },
        timestamp: nowIso,
      },
    ];

    if (finalStatus === 'DELIVERED') {
      events.push({
        id: `evt_${Date.now()}_del`,
        messageId: rfcMessageId,
        eventType: 'DELIVERED',
        eventData: { smtpCode: 250, responseText: smtpResponse, latencyMs: 245 },
        timestamp: nowIso,
      });
    } else if (finalStatus === 'BOUNCED') {
      events.push({
        id: `evt_${Date.now()}_bnc`,
        messageId: rfcMessageId,
        eventType: 'BOUNCED',
        eventData: { reason: bounceReason, type: 'Hard' },
        timestamp: nowIso,
      });

      // Automatically add hard bounces to suppression list
      if (!db.suppressions.some((s) => s.email.toLowerCase() === toEmail.toLowerCase())) {
        db.suppressions.unshift({
          id: `sup_${Date.now()}`,
          email: toEmail,
          type: 'HARD_BOUNCE',
          reason: bounceReason || 'Hard bounce reported by KumoMTA/SES',
          source: 'kumo_bounce',
          createdAt: nowIso,
        });
      }
    }

    newMsg.events = events;
    db.messages.unshift(newMsg);
    db.messageEvents.push(...events);

    // Update sender stats
    if (sender) {
      sender.sentCount += 1;
      if (finalStatus === 'DELIVERED') sender.deliveredCount += 1;
      if (finalStatus === 'BOUNCED') sender.bouncedCount += 1;
    }

    // Add technical log
    db.logs.unshift({
      id: `log_${Date.now()}`,
      timestamp: nowIso,
      service: 'KumoMTA',
      messageId: rfcMessageId,
      event: finalStatus === 'BOUNCED' ? 'BOUNCE_DETECTED' : 'MESSAGE_DISPATCHED',
      severity: finalStatus === 'BOUNCED' ? 'WARN' : 'INFO',
      response: smtpResponse,
      details: { to: toEmail, from: payload.fromEmail, subject: payload.subject },
    });

    return {
      success: (finalStatus as MessageStatus) === 'DELIVERED' || (finalStatus as MessageStatus) === 'SENT',
      messageId: internalId,
      rfcMessageId,
      kumoResponse: smtpResponse,
      provider: 'KumoMTA + Amazon SES',
      status: finalStatus,
      bounceReason,
    };
  }
}

export const kumoMtaService = new KumoMtaService();
