import { db } from '../store.js';
import { EventType, MessageEvent } from '../../src/types.js';

export interface RawEventInput {
  messageId: string; // RFC 5322 or internal ID
  eventType: EventType;
  timestamp?: string;
  eventData?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  geo?: string;
}

export class EventProcessor {
  processEvent(eventInput: RawEventInput): { success: boolean; event?: MessageEvent; error?: string } {
    const timestamp = eventInput.timestamp || new Date().toISOString();

    // Find target message
    const message = db.messages.find(
      (m) => m.messageId === eventInput.messageId || m.id === eventInput.messageId
    );

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
        // Auto add to suppression
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
