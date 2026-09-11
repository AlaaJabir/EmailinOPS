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
    this.smtpHost = process.env.SES_SMTP_HOST || '6wxef9y9cm3r.fips.wmjb.mail-manager-smtp.amazonaws.com';
    this.smtpPort = Number(process.env.SES_SMTP_PORT) || 587;
  }

  async checkHealth(): Promise<{ status: 'healthy' | 'degraded' | 'offline'; region: string; quota: any }> {
    const user = process.env.SES_SMTP_USERNAME || 'inp-trqycfx2ios4ywikwlcwnqod';
    const pass = process.env.SES_SMTP_PASSWORD || 'alaa.JABIR06';
    const hasCredentials = Boolean(user && pass);
    return {
      status: hasCredentials ? 'healthy' : 'offline',
      region: this.region,
      quota: {
        max24HourSend: null,
        sentLast24Hours: null,
        maxSendRate: null,
        bounceRatePercent: null,
        complaintRatePercent: null,
        accountStatus: hasCredentials ? 'Configured' : 'Offline / Unconfigured',
      },
    };
  }

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

  processNotification(payload: SesEventPayload, meta?: { snsMessageId?: string; topicArn?: string }) {
    return eventProcessor.processSesNotification(payload, meta);
  }
}

export const sesProvider = new SesProvider();
