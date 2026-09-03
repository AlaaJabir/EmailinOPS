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
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    // Disallow local loopback / link-local addresses in production
    const hostname = parsed.hostname.toLowerCase();
    if (process.env.NODE_ENV === 'production') {
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        hostname === '169.254.169.254'
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
 * GET /api/tracking/click/:messageId
 * Handles click tracking without JavaScript and performs secure 302 redirect.
 */
trackingRouter.get('/click/:messageId', async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const rawUrl = req.query.url as string;

  if (!rawUrl) {
    return res.status(400).send('Missing target URL');
  }

  let destinationUrl = '';
  try {
    destinationUrl = decodeURIComponent(rawUrl);
  } catch {
    return res.status(400).send('Malformed URL encoding');
  }

  // Prevent open redirect attacks
  if (!isValidRedirectUrl(destinationUrl)) {
    return res.status(400).send('Invalid or unauthorized redirect URL');
  }

  // Record CLICKED event
  try {
    eventProcessor.processEvent({
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

  // Redirect to destination cleanly
  res.redirect(302, destinationUrl);
});

/**
 * GET /api/tracking/open/:messageId
 * Serves 1x1 transparent GIF tracking pixel and records OPENED event.
 */
trackingRouter.get('/open/:messageId', async (req: Request, res: Response) => {
  const { messageId } = req.params;

  // Record OPENED event (idempotent, safe against failures)
  try {
    eventProcessor.processEvent({
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

  // Serve 1x1 transparent GIF with aggressive no-cache headers
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': TRANSPARENT_GIF.length.toString(),
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, private, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  });

  res.status(200).end(TRANSPARENT_GIF);
});
