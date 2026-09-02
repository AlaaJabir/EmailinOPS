import { db } from '../store.js';
import { EventType, MessageEvent, MessageStatus } from '../../src/types.js';

export interface RawEventInput {
  messageId: string; // RFC 5322 or internal ID
  eventType: EventType;
  timestamp?: string;
  eventData?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  geo?: string;
}

export interface SesMailHeader {
  name: string;
  value: string;
}

export interface SesMailCommonHeaders {
  messageId?: string;
  from?: string[];
  to?: string[];
  subject?: string;
  date?: string;
}

export interface SesMailObject {
  timestamp?: string;
  messageId?: string;
  source?: string;
  sourceArn?: string;
  sendingAccountId?: string;
  destination?: string[];
  headersTruncated?: boolean;
  headers?: SesMailHeader[];
  commonHeaders?: SesMailCommonHeaders;
  tags?: Record<string, string[]>;
}

export interface SesEventPayload {
  eventType?: string;
  notificationType?: string;
  mail?: SesMailObject;
  send?: Record<string, any>;
  delivery?: {
    timestamp?: string;
    processingTimeMillis?: number;
    recipients?: string[];
    smtpResponse?: string;
    reportingMTA?: string;
  };
  bounce?: {
    bounceType?: 'Permanent' | 'Transient' | 'Undetermined' | string;
    bounceSubType?: string;
    bouncedRecipients?: Array<{
      emailAddress: string;
      action?: string;
      status?: string;
      diagnosticCode?: string;
    }>;
    timestamp?: string;
    feedbackId?: string;
    reportingMTA?: string;
  };
  complaint?: {
    complainedRecipients?: Array<{
      emailAddress: string;
    }>;
    timestamp?: string;
    feedbackId?: string;
    complaintSubType?: string;
    userAgent?: string;
    complaintFeedbackType?: string;
    arrivalDate?: string;
  };
  reject?: {
    reason?: string;
  };
  failure?: {
    errorMessage?: string;
    templateName?: string;
  };
  deliveryDelay?: {
    delayType?: string;
    expirationTime?: string;
    delayedRecipients?: Array<{
      emailAddress: string;
      status?: string;
      diagnosticCode?: string;
    }>;
    timestamp?: string;
  };
  subscription?: {
    contactList?: string;
    timestamp?: string;
    source?: string;
    newTopicPreferences?: any;
    oldTopicPreferences?: any;
  };
}

export interface ProcessSesResult {
  success: boolean;
  correlated: boolean;
  duplicate?: boolean;
  status?: MessageStatus;
  messageId?: string;
  rfcMessageId?: string;
  sesMessageId?: string;
  event?: MessageEvent;
  error?: string;
}

function extractHeader(headers: SesMailHeader[] | undefined, name: string): string | undefined {
  if (!headers || !Array.isArray(headers)) return undefined;
  const target = name.toLowerCase();
  const found = headers.find((h) => h.name && h.name.toLowerCase() === target);
  return found ? found.value : undefined;
}

export class EventProcessor {
  /**
   * Process a parsed AWS SES event from SNS notification or direct webhook
   */
  processSesNotification(
    payload: SesEventPayload,
    meta?: { snsMessageId?: string; topicArn?: string }
  ): ProcessSesResult {
    const rawType = (payload.eventType || payload.notificationType || '').trim();
    if (!rawType) {
      return { success: false, correlated: false, error: 'Missing eventType or notificationType in SES payload' };
    }

    const lowerType = rawType.toLowerCase();
    let internalEventType: EventType;

    switch (lowerType) {
      case 'send':
        internalEventType = 'SENT';
        break;
      case 'delivery':
        internalEventType = 'DELIVERED';
        break;
      case 'bounce':
        internalEventType = 'BOUNCED';
        break;
      case 'complaint':
        internalEventType = 'COMPLAINED';
        break;
      case 'reject':
        internalEventType = 'REJECTED';
        break;
      case 'rendering failure':
      case 'renderingfailure':
        internalEventType = 'RENDERING_FAILURE';
        break;
      case 'deliverydelay':
      case 'delivery delay':
        internalEventType = 'DELIVERY_DELAY';
        break;
      case 'subscription':
        internalEventType = 'SUBSCRIPTION';
        break;
      case 'open':
        internalEventType = 'OPENED';
        break;
      case 'click':
        internalEventType = 'CLICKED';
        break;
      default:
        // Record log for unrecognized SES event type
        db.logs.unshift({
          id: `log_ses_unknown_${Date.now()}`,
          timestamp: new Date().toISOString(),
          service: 'Amazon SES',
          event: 'UNKNOWN_SES_EVENT_TYPE',
          severity: 'WARN',
          response: `Received unhandled SES event type: ${rawType}`,
          details: { rawType, payload },
        });
        return { success: false, correlated: false, error: `Unsupported SES event type: ${rawType}` };
    }

    // Extract identifiers for correlation
    const sesMessageId = payload.mail?.messageId;
    const internalId =
      extractHeader(payload.mail?.headers, 'x-internal-message-id') ||
      extractHeader(payload.mail?.headers, 'x-emailops-id');
    const rfcMessageId =
      payload.mail?.commonHeaders?.messageId ||
      extractHeader(payload.mail?.headers, 'message-id');
    const recipient =
      payload.mail?.destination?.[0] ||
      payload.delivery?.recipients?.[0] ||
      payload.bounce?.bouncedRecipients?.[0]?.emailAddress ||
      payload.complaint?.complainedRecipients?.[0]?.emailAddress;

    const timestamp =
      payload.delivery?.timestamp ||
      payload.bounce?.timestamp ||
      payload.complaint?.timestamp ||
      payload.deliveryDelay?.timestamp ||
      payload.mail?.timestamp ||
      new Date().toISOString();

    const feedbackId = payload.bounce?.feedbackId || payload.complaint?.feedbackId;

    // Perform multi-key correlation
    const message = db.findMessageForEvent({
      internalId,
      rfcMessageId,
      sesMessageId,
      recipient,
    });

    if (message) {
      // Check message-level idempotency: prevent duplicate event ingestion
      const isDuplicate = (message.events || []).some((e) => {
        if (e.eventType !== internalEventType) return false;
        if (feedbackId && e.eventData?.feedbackId === feedbackId) return true;
        if (e.timestamp === timestamp) return true;
        if (meta?.snsMessageId && e.eventData?.snsMessageId === meta.snsMessageId) return true;
        return false;
      });

      if (isDuplicate) {
        return {
          success: true,
          correlated: true,
          duplicate: true,
          status: message.status,
          messageId: message.id,
          rfcMessageId: message.messageId,
          sesMessageId: message.sesMessageId,
        };
      }

      // Persist SES message ID onto message if not previously saved
      if (sesMessageId && !message.sesMessageId) {
        message.sesMessageId = sesMessageId;
        if (!message.providerMessageId || message.providerMessageId.startsWith('spool-')) {
          message.providerMessageId = sesMessageId;
        }
      }

      // Update message status based strictly on real SES event
      switch (internalEventType) {
        case 'SENT':
          if (message.status === 'QUEUED') {
            message.status = 'SENT';
            message.sentAt = timestamp;
          }
          break;

        case 'DELIVERED':
          message.status = 'DELIVERED';
          message.deliveredAt = timestamp;
          if (payload.delivery?.smtpResponse) {
            message.smtpResponse = payload.delivery.smtpResponse;
          }
          // Update sender and campaign delivery stats
          {
            const sender = db.senders.find(
              (s) => s.id === message.senderId || s.fromEmail.toLowerCase() === message.fromEmail.toLowerCase()
            );
            if (sender) sender.deliveredCount += 1;

            if (message.campaignId) {
              const cmp = db.campaigns.find((c) => c.id === message.campaignId);
              if (cmp) cmp.deliveredCount += 1;
            }
          }
          break;

        case 'BOUNCED':
          message.status = 'BOUNCED';
          message.bouncedAt = timestamp;
          {
            const isPermanent = payload.bounce?.bounceType === 'Permanent';
            const isTransient = payload.bounce?.bounceType === 'Transient';
            message.bounceType = isPermanent ? 'Hard' : isTransient ? 'Soft' : 'Transient';
            const diagnostic =
              payload.bounce?.bouncedRecipients?.[0]?.diagnosticCode ||
              payload.bounce?.bounceSubType ||
              `SES ${payload.bounce?.bounceType || ''} Bounce`;
            message.bounceReason = diagnostic;

            const sender = db.senders.find((s) => s.id === message.senderId);
            if (sender) sender.bouncedCount += 1;

            if (message.campaignId) {
              const cmp = db.campaigns.find((c) => c.id === message.campaignId);
              if (cmp) cmp.bouncedCount += 1;
            }

            // Auto-suppress hard bounces
            if (isPermanent) {
              const bouncedRecipients = payload.bounce?.bouncedRecipients || [{ emailAddress: message.toEmail }];
              for (const br of bouncedRecipients) {
                const targetEmail = br.emailAddress || message.toEmail;
                if (!db.suppressions.some((s) => s.email.toLowerCase() === targetEmail.toLowerCase())) {
                  db.suppressions.unshift({
                    id: `sup_bnc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                    email: targetEmail,
                    type: 'HARD_BOUNCE',
                    reason: br.diagnosticCode || diagnostic,
                    source: 'Amazon SES SNS Webhook',
                    createdAt: timestamp,
                  });
                }
              }
            }
          }
          break;

        case 'COMPLAINED':
          message.status = 'COMPLAINED';
          {
            const sender = db.senders.find((s) => s.id === message.senderId);
            if (sender) sender.complaintCount += 1;

            if (message.campaignId) {
              const cmp = db.campaigns.find((c) => c.id === message.campaignId);
              if (cmp) cmp.complaintCount += 1;
            }

            // Auto-suppress complaints
            const complainedRecipients = payload.complaint?.complainedRecipients || [{ emailAddress: message.toEmail }];
            for (const cr of complainedRecipients) {
              const targetEmail = cr.emailAddress || message.toEmail;
              if (!db.suppressions.some((s) => s.email.toLowerCase() === targetEmail.toLowerCase())) {
                db.suppressions.unshift({
                  id: `sup_cmp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  email: targetEmail,
                  type: 'COMPLAINT',
                  reason: `Spam complaint registered via SES Feedback Loop (${payload.complaint?.complaintFeedbackType || 'abuse'})`,
                  source: 'Amazon SES SNS Webhook',
                  createdAt: timestamp,
                });
              }
            }
          }
          break;

        case 'REJECTED':
          message.status = 'REJECTED';
          message.bounceReason = payload.reject?.reason || 'SES Rejected message';
          break;

        case 'RENDERING_FAILURE':
          message.status = 'RENDERING_FAILED';
          message.bounceReason = payload.failure?.errorMessage || 'SES Template Rendering Failure';
          break;

        case 'DELIVERY_DELAY':
          message.status = 'DELIVERY_DELAYED';
          message.bounceReason =
            payload.deliveryDelay?.delayedRecipients?.[0]?.diagnosticCode ||
            payload.deliveryDelay?.delayType ||
            'Delivery delayed by destination mail exchange';
          break;

        case 'SUBSCRIPTION':
          // Retain subscription change details
          break;
      }

      // Record event in message events and global events
      const eventRecord: MessageEvent = {
        id: `evt_ses_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        messageId: message.messageId,
        eventType: internalEventType,
        eventData: {
          sesMessageId,
          rawType,
          feedbackId,
          ...(payload.delivery || {}),
          ...(payload.bounce || {}),
          ...(payload.complaint || {}),
          ...(payload.reject || {}),
          ...(payload.failure || {}),
          ...(payload.deliveryDelay || {}),
          ...(payload.subscription || {}),
          snsMessageId: meta?.snsMessageId,
        },
        timestamp,
      };

      message.events = message.events || [];
      message.events.push(eventRecord);
      db.messageEvents.push(eventRecord);

      // Add technical log
      db.logs.unshift({
        id: `log_ses_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp,
        service: 'Amazon SES',
        messageId: message.messageId,
        event: `SES_${internalEventType}`,
        severity:
          internalEventType === 'BOUNCED' || internalEventType === 'REJECTED' || internalEventType === 'RENDERING_FAILURE'
            ? 'ERROR'
            : internalEventType === 'DELIVERY_DELAY'
            ? 'WARN'
            : 'INFO',
        response: `SES Event ${rawType} processed for message ${message.messageId} (${message.toEmail})`,
        details: {
          sesMessageId,
          internalId: message.id,
          rfcMessageId: message.messageId,
          status: message.status,
          eventType: rawType,
        },
      });

      return {
        success: true,
        correlated: true,
        status: message.status,
        messageId: message.id,
        rfcMessageId: message.messageId,
        sesMessageId: message.sesMessageId,
        event: eventRecord,
      };
    } else {
      // Unmapped event: log for telemetry inspection
      db.logs.unshift({
        id: `log_ses_orphan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp,
        service: 'Amazon SES',
        event: 'UNMAPPED_SES_EVENT',
        severity: 'WARN',
        response: `Received SES event ${rawType} for unmapped message (SES ID: ${sesMessageId || 'none'}, RFC ID: ${rfcMessageId || 'none'}, Recipient: ${recipient || 'none'})`,
        details: {
          sesMessageId,
          rfcMessageId,
          internalId,
          recipient,
          rawType,
        },
      });

      return {
        success: false,
        correlated: false,
        error: 'Message not found in database for correlation',
        sesMessageId,
        rfcMessageId,
      };
    }
  }

  /**
   * Process generic / KumoMTA / Tracking event
   */
  processEvent(eventInput: RawEventInput): { success: boolean; event?: MessageEvent; error?: string } {
    const timestamp = eventInput.timestamp || new Date().toISOString();

    // Find target message by RFC Message-ID, internal ID, or SES Message-ID
    const message = db.findMessageForEvent({
      internalId: eventInput.messageId,
      rfcMessageId: eventInput.messageId,
      sesMessageId: eventInput.messageId,
    });

    if (!message) {
      // Log unmapped event
      db.logs.unshift({
        id: `log_evt_orphan_${Date.now()}`,
        timestamp,
        service: 'Tracking',
        event: 'UNMAPPED_MESSAGE_EVENT',
        severity: 'WARN',
        response: `Received event ${eventInput.eventType} for unknown messageId ${eventInput.messageId}`,
        details: eventInput,
      });
      return { success: false, error: 'Message ID not found in database' };
    }

    const eventRecord: MessageEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      messageId: message.messageId,
      eventType: eventInput.eventType,
      eventData: eventInput.eventData,
      timestamp,
      ipAddress: eventInput.ipAddress,
      userAgent: eventInput.userAgent,
      geo: eventInput.geo,
    };

    // Update message state
    message.events = message.events || [];
    message.events.push(eventRecord);
    db.messageEvents.push(eventRecord);

    switch (eventInput.eventType) {
      case 'DELIVERED':
        message.status = 'DELIVERED';
        message.deliveredAt = timestamp;
        break;
      case 'BOUNCED':
        message.status = 'BOUNCED';
        message.bouncedAt = timestamp;
        message.bounceReason = eventInput.eventData?.reason || 'Bounced';
        break;
      case 'COMPLAINED':
        message.status = 'COMPLAINED';
        break;
      case 'FAILED':
        message.status = 'FAILED';
        break;
      case 'REJECTED':
        message.status = 'REJECTED';
        break;
      case 'RENDERING_FAILURE':
        message.status = 'RENDERING_FAILED';
        break;
      case 'DELIVERY_DELAY':
        message.status = 'DELIVERY_DELAYED';
        break;
      case 'OPENED':
        if (message.campaignId) {
          const cmp = db.campaigns.find((c) => c.id === message.campaignId);
          if (cmp) cmp.openCount += 1;
        }
        break;
      case 'CLICKED':
        if (message.campaignId) {
          const cmp = db.campaigns.find((c) => c.id === message.campaignId);
          if (cmp) cmp.clickCount += 1;
        }
        break;
      case 'UNSUBSCRIBED':
        if (!db.suppressions.some((s) => s.email.toLowerCase() === message.toEmail.toLowerCase())) {
          db.suppressions.unshift({
            id: `sup_${Date.now()}`,
            email: message.toEmail,
            type: 'UNSUBSCRIBED',
            reason: 'User triggered unsubscribe link/header',
            source: 'system',
            createdAt: timestamp,
          });
        }
        break;
    }

    return { success: true, event: eventRecord };
  }
}

export const eventProcessor = new EventProcessor();
