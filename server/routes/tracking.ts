import { Router, Request, Response } from 'express';
import { db } from '../store.js';
import { eventProcessor } from '../services/EventProcessor.js';

export const trackingRouter = Router();

// 1x1 transparent GIF buffer
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * Validate URL to prevent open redirect vulnerabilities & SSRF.
 * Only valid absolute HTTP and HTTPS protocols are permitted.
 */
function isValidRedirectUrl(target: string): boolean {
  if (!target || typeof target !== 'string') return false;
  try {
    const parsed = new URL(target);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    const hostname = parsed.hostname.toLowerCase();
    if (process.env.NODE_ENV === 'production') {
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        hostname === '169.254.169.254' ||
        hostname === '0.0.0.0'
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Tracking metrics are intentionally unique at message level.
 * Mailbox security scanners, link prefetchers and image proxies can request
 * the same tracking URL multiple times. We always redirect/serve the pixel,
 * but only record the first OPENED/CLICKED event for a message.
 */
function recordUniqueTrackingEvent(params: {
  messageId: string;
  eventType: 'OPENED' | 'CLICKED';
  eventData?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}): void {
  const message = db.findMessageForEvent({
    internalId: params.messageId,
    rfcMessageId: params.messageId,
    sesMessageId: params.messageId,
  });

  if (!message) {
    // Let EventProcessor keep its normal unmapped-event telemetry.
    eventProcessor.processEvent(params);
    return;
  }

  const alreadyRecorded = (message.events || []).some((event) => event.eventType === params.eventType);
  if (alreadyRecorded) return;

  eventProcessor.processEvent(params);
}

/**
 * GET /api/tracking/click/:messageId
 * Records one unique CLICKED event and redirects to the original destination.
 * URLSearchParams/query parsing already decodes the query value once,
 * so do not decodeURIComponent() a second time.
 */
trackingRouter.get('/click/:messageId', async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const destinationUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';

  if (!destinationUrl) return res.status(400).send('Missing target URL');
  if (!isValidRedirectUrl(destinationUrl)) {
    return res.status(400).send('Invalid or unauthorized redirect URL');
  }

  try {
    recordUniqueTrackingEvent({
      messageId,
      eventType: 'CLICKED',
      eventData: {
        destinationUrl,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  } catch (err) {
    console.error('[ClickTracking] Failed to record event:', err);
  }

  return res.redirect(302, destinationUrl);
});

/**
 * GET /api/tracking/open/:messageId
 * Serves 1x1 transparent GIF and records one unique OPENED event.
 */
trackingRouter.get('/open/:messageId', async (req: Request, res: Response) => {
  const { messageId } = req.params;

  try {
    recordUniqueTrackingEvent({
      messageId,
      eventType: 'OPENED',
      eventData: {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  } catch (err) {
    console.error('[OpenTracking] Failed to record event:', err);
  }

  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': TRANSPARENT_GIF.length.toString(),
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, private, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  });

  return res.status(200).end(TRANSPARENT_GIF);
});