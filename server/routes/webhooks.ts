import { Router, Request, Response } from 'express';
import { db } from '../store.js';
import { eventProcessor, SesEventPayload } from '../services/EventProcessor.js';
import { supabaseService } from '../services/SupabaseService.js';

export const webhooksRouter = Router();

// Validate AWS SNS SubscribeURL hostname to prevent SSRF
function isValidSnsSubscribeUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    const snsRegex = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;
    return snsRegex.test(host);
  } catch {
    return false;
  }
}

function cleanIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const valueTrimmed = value.trim();
  return valueTrimmed || undefined;
}

function normalizeKumoEventType(value: unknown): string | undefined {
  const raw = cleanIdentifier(value);
  if (!raw) return undefined;
  const normalized = raw.toUpperCase().replace(/[\s-]+/g, '_');
  const aliases: Record<string, string> = {
    SENT: 'SENT',
    SEND: 'SENT',
    DELIVERED: 'DELIVERED',
    DELIVERY: 'DELIVERED',
    BOUNCED: 'BOUNCED',
    BOUNCE: 'BOUNCED',
    FAILED: 'FAILED',
    FAILURE: 'FAILED',
    REJECTED: 'REJECTED',
    REJECT: 'REJECTED',
    DELIVERY_DELAY: 'DELIVERY_DELAY',
    DELAYED: 'DELIVERY_DELAY',
    OPENED: 'OPENED',
    OPEN: 'OPENED',
    CLICKED: 'CLICKED',
    CLICK: 'CLICKED',
    COMPLAINED: 'COMPLAINED',
    COMPLAINT: 'COMPLAINED',
    UNSUBSCRIBED: 'UNSUBSCRIBED',
    UNSUBSCRIBE: 'UNSUBSCRIBED',
    RENDERING_FAILURE: 'RENDERING_FAILURE',
  };
  return aliases[normalized];
}

function extractKumoPayload(body: any): {
  eventType?: string;
  messageId?: string;
  timestamp?: string;
  meta: Record<string, any>;
} {
  const rawMeta = body?.meta;
  const meta: Record<string, any> =
    rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)
      ? { ...rawMeta }
      : {};

  // Accept both the current {eventType,messageId,meta} shape and common
  // KumoMTA-style top-level identifier fields so correlation is resilient.
  const eventType = normalizeKumoEventType(body?.eventType ?? body?.event_type ?? meta.eventType ?? meta.event_type);
  const messageId =
    cleanIdentifier(body?.messageId) ||
    cleanIdentifier(body?.message_id) ||
    cleanIdentifier(meta.messageId) ||
    cleanIdentifier(meta.message_id) ||
    cleanIdentifier(meta.rfcMessageId) ||
    cleanIdentifier(meta.rfc_message_id) ||
    cleanIdentifier(meta.internalId) ||
    cleanIdentifier(meta.internal_id) ||
    cleanIdentifier(meta.sesMessageId) ||
    cleanIdentifier(meta.ses_message_id);
  const timestamp =
    cleanIdentifier(body?.timestamp) ||
    cleanIdentifier(body?.eventTimestamp) ||
    cleanIdentifier(meta.timestamp) ||
    cleanIdentifier(meta.eventTimestamp);

  return { eventType, messageId, timestamp, meta };
}

/**
 * GET /api/webhooks/status
 * Returns webhook listener health and recent telemetry from both SES and KumoMTA.
 */
webhooksRouter.get('/status', (_req: Request, res: Response) => {
  const trackedTypes = [
    'SENT',
    'DELIVERED',
    'BOUNCED',
    'COMPLAINED',
    'REJECTED',
    'RENDERING_FAILURE',
    'DELIVERY_DELAY',
  ];
  const telemetryEvents = db.messageEvents.filter((e) => trackedTypes.includes(e.eventType));
  const kumoEvents = db.messageEvents.filter((e) => e.eventData?.source === 'KumoMTA');
  const sesEvents = db.messageEvents.filter((e) => e.eventData?.source === 'Amazon SES');

  res.json({
    status: 'healthy',
    service: 'EmailinOPS Webhook Listener',
    endpoints: {
      ses: '/api/webhooks/ses',
      kumomta: '/api/webhooks/kumomta',
    },
    totalEventsRecorded: telemetryEvents.length,
    kumoEventsRecorded: kumoEvents.length,
    sesEventsRecorded: sesEvents.length,
    recentEvents: telemetryEvents.slice(-10).reverse(),
    idempotencyCacheSize: db.processedEventIds.size,
    lastScraped: new Date().toISOString(),
  });
});

/**
 * POST /api/webhooks/ses
 * Ingest Amazon SNS Notifications & Subscription Handshake for Amazon SES Events
 */
webhooksRouter.post('/ses', async (req: Request, res: Response) => {
  let body = req.body;

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (err: any) {
      db.logs.unshift({
        id: `log_ses_err_${Date.now()}`,
        timestamp: new Date().toISOString(),
        service: 'Amazon SES',
        event: 'WEBHOOK_PARSE_ERROR',
        severity: 'ERROR',
        response: `Invalid JSON body: ${err.message}`,
        details: { body: String(body).substring(0, 300) },
      });
      return res.status(400).json({ error: 'Malformed JSON payload in request body' });
    }
  } else if (Buffer.isBuffer(body)) {
    try {
      body = JSON.parse(body.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Malformed buffer payload in request body' });
    }
  }

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Request body must be a valid JSON object' });
  }

  const messageType = body.Type || body.type;

  if (messageType === 'SubscriptionConfirmation') {
    const subscribeUrl = body.SubscribeURL;
    const topicArn = body.TopicArn;
    const token = body.Token;

    if (!subscribeUrl || typeof subscribeUrl !== 'string') {
      return res.status(400).json({ error: 'Missing SubscribeURL in SubscriptionConfirmation' });
    }

    let confirmationSuccess = false;
    let confirmationError: string | undefined;

    if (isValidSnsSubscribeUrl(subscribeUrl)) {
      try {
        const fetchRes = await fetch(subscribeUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(6000),
        });
        confirmationSuccess = fetchRes.ok;
      } catch (fetchErr: any) {
        confirmationError = fetchErr.message;
      }
    } else {
      confirmationError = 'SubscribeURL hostname does not match verified AWS SNS patterns';
    }

    db.logs.unshift({
      id: `log_sns_sub_${Date.now()}`,
      timestamp: new Date().toISOString(),
      service: 'Amazon SES',
      event: 'SNS_SUBSCRIPTION_CONFIRMATION',
      severity: confirmationSuccess ? 'INFO' : 'WARN',
      response: confirmationSuccess
        ? `Successfully confirmed SNS subscription for topic ${topicArn}`
        : `Received SNS subscription confirmation for topic ${topicArn} (fetch: ${confirmationError || 'pending manual confirmation'})`,
      details: { topicArn, token: token ? '***' : undefined, subscribeUrl, confirmed: confirmationSuccess, error: confirmationError },
    });

    return res.status(200).json({
      status: 'ok',
      type: 'SubscriptionConfirmation',
      topicArn,
      confirmed: confirmationSuccess,
      subscribeUrl,
      error: confirmationError,
    });
  }

  if (messageType === 'UnsubscribeConfirmation') {
    const topicArn = body.TopicArn;
    db.logs.unshift({
      id: `log_sns_unsub_${Date.now()}`,
      timestamp: new Date().toISOString(),
      service: 'Amazon SES',
      event: 'SNS_UNSUBSCRIBE_CONFIRMATION',
      severity: 'WARN',
      response: `SNS UnsubscribeConfirmation received for topic ${topicArn}`,
      details: body,
    });
    return res.status(200).json({ status: 'ok', type: 'UnsubscribeConfirmation', topicArn });
  }

  if (messageType === 'Notification') {
    const snsMessageId = body.MessageId;
    const topicArn = body.TopicArn;

    if (snsMessageId && (db.hasProcessedEvent(snsMessageId) || (await supabaseService.isEventProcessed(snsMessageId)))) {
      return res.status(200).json({
        status: 'success',
        duplicate: true,
        message: 'Notification with this SNS MessageId was already processed',
        snsMessageId,
      });
    }

    let messagePayload: SesEventPayload;
    if (typeof body.Message === 'string') {
      try {
        messagePayload = JSON.parse(body.Message);
      } catch (parseErr: any) {
        db.logs.unshift({
          id: `log_ses_bad_msg_${Date.now()}`,
          timestamp: new Date().toISOString(),
          service: 'Amazon SES',
          event: 'SNS_MESSAGE_PARSE_ERROR',
          severity: 'ERROR',
          response: `Failed to parse Message field as JSON: ${parseErr.message}`,
          details: { messageSnippet: body.Message.substring(0, 300) },
        });
        return res.status(400).json({ error: 'Failed to parse SNS Message field as JSON' });
      }
    } else if (typeof body.Message === 'object' && body.Message !== null) {
      messagePayload = body.Message;
    } else {
      return res.status(400).json({ error: 'Missing or invalid Message field in Notification' });
    }

    const processResult = eventProcessor.processSesNotification(messagePayload, { snsMessageId, topicArn });

    if (snsMessageId) {
      db.recordProcessedEvent(snsMessageId);
      await supabaseService.recordProcessedEvent(snsMessageId, 'SES_SNS');
    }

    return res.status(200).json({ status: 'success', ...processResult });
  }

  if (body.eventType || body.notificationType) {
    const processResult = eventProcessor.processSesNotification(body);
    return res.status(200).json({ status: 'success', ...processResult });
  }

  return res.status(400).json({
    error: 'Unrecognized webhook payload structure. Expected SNS Notification or SES event object.',
    receivedKeys: Object.keys(body),
  });
});

/**
 * POST /api/webhooks/kumomta
 * Ingest KumoMTA transport telemetry.
 *
 * KumoMTA transport events are deliberately kept separate from final SES
 * delivery events: SENT means accepted by the next transport hop, while
 * DELIVERED/BOUNCED/COMPLAINED should come from the authoritative provider
 * event stream when SES is the upstream relay.
 */
webhooksRouter.post('/kumomta', (req: Request, res: Response) => {
  const { eventType, messageId, timestamp, meta } = extractKumoPayload(req.body || {});

  if (!eventType || !messageId) {
    db.logs.unshift({
      id: `log_kumo_webhook_invalid_${Date.now()}`,
      timestamp: new Date().toISOString(),
      service: 'KumoMTA',
      event: 'WEBHOOK_INVALID_PAYLOAD',
      severity: 'WARN',
      response: 'KumoMTA webhook acknowledged without processing because eventType or messageId was missing',
      details: { receivedKeys: Object.keys(req.body || {}) },
    });
    return res.status(400).json({
      status: 'error',
      error: 'KumoMTA webhook requires eventType and messageId',
    });
  }

  const eventKey = cleanIdentifier(meta.eventId) || cleanIdentifier(meta.event_id) || `${messageId}:${eventType}:${timestamp || 'none'}`;
  if (db.hasProcessedEvent(`kumo:${eventKey}`)) {
    return res.status(200).json({ status: 'success', duplicate: true, eventKey });
  }

  const eventData = {
    ...meta,
    source: 'KumoMTA',
    webhookReceivedAt: new Date().toISOString(),
    eventKey,
  };

  const processResult = eventProcessor.processEvent({
    messageId,
    eventType: eventType as any,
    timestamp,
    eventData,
  });

  if (!processResult.success) {
    db.logs.unshift({
      id: `log_kumo_webhook_orphan_${Date.now()}`,
      timestamp: new Date().toISOString(),
      service: 'KumoMTA',
      event: 'WEBHOOK_ORPHAN_EVENT',
      severity: 'WARN',
      response: `KumoMTA event ${eventType} could not be correlated to message ${messageId}`,
      details: eventData,
    });
    return res.status(202).json({ status: 'accepted', correlated: false, ...processResult });
  }

  db.recordProcessedEvent(`kumo:${eventKey}`);

  const message = db.messages.find((m) => m.messageId === processResult.event?.messageId);
  if (message) {
    // Generic Kumo events need their aggregate counters updated here because
    // the SES-specific processor owns SES aggregate accounting.
    switch (eventType) {
      case 'SENT':
        if (message.status === 'QUEUED') {
          message.status = 'SENT';
          message.sentAt = timestamp || new Date().toISOString();
        }
        break;
      case 'DELIVERED': {
        const sender = db.senders.find((s) => s.id === message.senderId || s.fromEmail.toLowerCase() === message.fromEmail.toLowerCase());
        if (sender && message.deliveredAt === timestamp) sender.deliveredCount += 1;
        if (message.campaignId && message.deliveredAt === timestamp) {
          const campaign = db.campaigns.find((c) => c.id === message.campaignId);
          if (campaign) campaign.deliveredCount += 1;
        }
        break;
      }
      case 'BOUNCED': {
        const sender = db.senders.find((s) => s.id === message.senderId || s.fromEmail.toLowerCase() === message.fromEmail.toLowerCase());
        if (sender && message.bouncedAt === timestamp) sender.bouncedCount += 1;
        if (message.campaignId && message.bouncedAt === timestamp) {
          const campaign = db.campaigns.find((c) => c.id === message.campaignId);
          if (campaign) campaign.bouncedCount += 1;
        }
        break;
      }
    }

    supabaseService.updateMessageStatus({
      messageId: message.messageId,
      status: message.status,
      deliveredAt: message.deliveredAt,
      bouncedAt: message.bouncedAt,
      bounceReason: message.bounceReason,
      smtpResponse: message.smtpResponse,
    }).catch(() => {});
  }

  return res.status(200).json({
    status: 'success',
    correlated: true,
    eventKey,
    ...processResult,
  });
});
