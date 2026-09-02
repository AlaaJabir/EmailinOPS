import { Router, Request, Response } from 'express';
import { sesProvider } from '../services/SesProvider.js';
import { eventProcessor } from '../services/EventProcessor.js';

export const webhooksRouter = Router();

// POST /api/webhooks/ses - Ingest SES SNS Notifications (Bounces, Complaints, Deliveries)
webhooksRouter.post('/ses', async (req: Request, res: Response) => {
  const body = req.body || {};

  // Handle SNS subscription confirmation
  if (body.Type === 'SubscriptionConfirmation') {
    return res.json({ status: 'ok', message: 'Subscription confirmation received' });
  }

  // Handle SNS Notification
  let messagePayload = body;
  if (typeof body.Message === 'string') {
    try {
      messagePayload = JSON.parse(body.Message);
    } catch {
      messagePayload = body;
    }
  }

  const eventType = messagePayload.eventType || messagePayload.notificationType;

  if (eventType === 'Bounce') {
    await sesProvider.processBounceWebhook({
      bounceType: messagePayload.bounce?.bounceType || 'Permanent',
      bouncedRecipients: messagePayload.bounce?.bouncedRecipients || [],
      mail: messagePayload.mail || { messageId: 'unknown', source: '', destination: [] },
    });
  } else if (eventType === 'Complaint') {
    await sesProvider.processComplaintWebhook({
      complainedRecipients: messagePayload.complaint?.complainedRecipients || [],
      complaintFeedbackType: messagePayload.complaint?.complaintFeedbackType,
      mail: messagePayload.mail || { messageId: 'unknown', source: '' },
    });
  } else if (eventType === 'Delivery') {
    const rfcId = messagePayload.mail?.commonHeaders?.messageId;
    if (rfcId) {
      eventProcessor.processEvent({
        messageId: rfcId,
        eventType: 'DELIVERED',
        eventData: { smtpResponse: messagePayload.delivery?.smtpResponse, processingTimeMillis: messagePayload.delivery?.processingTimeMillis },
      });
    }
  }

  res.json({ status: 'success', received: true });
});

// POST /api/webhooks/kumomta - Ingest KumoMTA webhook log events
webhooksRouter.post('/kumomta', (req: Request, res: Response) => {
  const { eventType, messageId, meta } = req.body;

  if (messageId && eventType) {
    eventProcessor.processEvent({
      messageId,
      eventType: eventType.toUpperCase(),
      eventData: meta,
    });
  }

  res.json({ status: 'success', acknowledged: true });
});
