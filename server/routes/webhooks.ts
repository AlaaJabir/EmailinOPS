import { Router, Request, Response } from 'express';
import { db } from '../store.js';
import { eventProcessor, SesEventPayload } from '../services/EventProcessor.js';

export const webhooksRouter = Router();

// Validate AWS SNS SubscribeURL hostname to prevent SSRF
function isValidSnsSubscribeUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    // AWS SNS endpoints match sns.<region>.amazonaws.com or sns.<region>.amazonaws.com.cn
    const host = parsed.hostname.toLowerCase();
    const snsRegex = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;
    return snsRegex.test(host);
  } catch {
    return false;
  }
}

/**
 * GET /api/webhooks/status
 * Returns current webhook status and recent received SNS/SES telemetry
 */
webhooksRouter.get('/status', (req: Request, res: Response) => {
  const sesEvents = db.messageEvents.filter((e) =>
    ['SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'REJECTED', 'RENDERING_FAILURE', 'DELIVERY_DELAY'].includes(e.eventType)
  );

  res.json({
    status: 'healthy',
    service: 'SES SNS Webhook Listener',
    endpoint: '/api/webhooks/ses',
    totalSesEventsRecorded: sesEvents.length,
    recentEvents: sesEvents.slice(-10).reverse(),
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

  // Handle cases where body is a raw string or Buffer from express.json with text/plain
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
    } catch (err: any) {
      return res.status(400).json({ error: 'Malformed buffer payload in request body' });
    }
  }

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Request body must be a valid JSON object' });
  }

  const messageType = body.Type || body.type;

  // 1. Handle AWS SNS Subscription Confirmation
  if (messageType === 'SubscriptionConfirmation') {
    const subscribeUrl = body.SubscribeURL;
    const topicArn = body.TopicArn;
    const token = body.Token;

    if (!subscribeUrl || typeof subscribeUrl !== 'string') {
      return res.status(400).json({ error: 'Missing SubscribeURL in SubscriptionConfirmation' });
    }

    let confirmationSuccess = false;
    let confirmationError: string | undefined = undefined;

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
      details: {
        topicArn,
        token: token ? '***' : undefined,
        subscribeUrl,
        confirmed: confirmationSuccess,
        error: confirmationError,
      },
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

  // 2. Handle AWS SNS Unsubscribe Confirmation
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

    return res.status(200).json({
      status: 'ok',
      type: 'UnsubscribeConfirmation',
      topicArn,
    });
  }

  // 3. Handle AWS SNS Notification
  if (messageType === 'Notification') {
    const snsMessageId = body.MessageId;
    const topicArn = body.TopicArn;

    // Idempotency: skip already processed SNS message IDs
    if (snsMessageId && db.hasProcessedEvent(snsMessageId)) {
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

    const processResult = eventProcessor.processSesNotification(messagePayload, {
      snsMessageId,
      topicArn,
    });

    if (snsMessageId) {
      db.recordProcessedEvent(snsMessageId);
    }

    return res.status(200).json({
      status: 'success',
      ...processResult,
    });
  }

  // 4. Handle direct SES event payload (without SNS envelope)
  if (body.eventType || body.notificationType) {
    const processResult = eventProcessor.processSesNotification(body);
    return res.status(200).json({
      status: 'success',
      ...processResult,
    });
  }

  // Unsupported payload structure
  return res.status(400).json({
    error: 'Unrecognized webhook payload structure. Expected SNS Notification or SES event object.',
    receivedKeys: Object.keys(body),
  });
});

// POST /api/webhooks/kumomta - Ingest KumoMTA webhook log events
webhooksRouter.post('/kumomta', (req: Request, res: Response) => {
  const { eventType, messageId, meta } = req.body || {};

  if (messageId && eventType) {
    const result = eventProcessor.processEvent({
      messageId,
      eventType: String(eventType).toUpperCase() as any,
      eventData: meta,
    });
    return res.json({ status: 'success', ...result });
  }

  return res.json({ status: 'success', acknowledged: true });
});
