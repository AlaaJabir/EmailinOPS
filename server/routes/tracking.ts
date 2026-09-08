import { Router, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { db } from '../store.js';
import { eventProcessor } from '../services/EventProcessor.js';
import { supabaseService } from '../services/SupabaseService.js';

export const trackingRouter = Router();

const TRANSPARENT_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

function isValidRedirectUrl(target: string): boolean {
  if (!target || typeof target !== 'string') return false;
  try {
    const parsed = new URL(target);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    if (process.env.NODE_ENV === 'production' && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname === '169.254.169.254' || hostname === '0.0.0.0')) return false;
    return true;
  } catch { return false; }
}

function trackingEventId(messageId: string, eventType: 'OPENED' | 'CLICKED'): string {
  const hex = createHash('sha256').update(`${messageId}:${eventType}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function recordTrackingEvent(params: { messageId: string; eventType: 'OPENED' | 'CLICKED'; eventData?: Record<string, any>; ipAddress?: string; userAgent?: string; }): Promise<void> {
  if (supabaseService.isConfigured && supabaseService.getClient()) {
    const client = supabaseService.getClient()!;
    const { data: message, error } = await client.from('messages').select('id,user_id,message_id,internal_id').or(`internal_id.eq.${params.messageId},message_id.eq.${params.messageId},ses_message_id.eq.${params.messageId}`).maybeSingle();
    if (error) throw new Error(`Tracking message lookup failed: ${error.message}`);
    if (!message) return;

    // One deterministic UUID per message/event pair prevents duplicate opens/clicks
    // when mail clients, security scanners, or browsers hit the endpoint concurrently.
    const eventId = trackingEventId(message.message_id, params.eventType);
    const { data: existing } = await client.from('message_events').select('id').eq('id', eventId).maybeSingle();
    if (existing) return;

    const { error: insertError } = await client.from('message_events').insert({
      id: eventId,
      message_id: message.message_id,
      user_id: message.user_id,
      event_type: params.eventType,
      event_data: params.eventData || null,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
      timestamp: new Date().toISOString(),
    });
    if (insertError) {
      // A concurrent request may have won the same deterministic-id insert.
      if (/duplicate|unique/i.test(insertError.message)) return;
      throw new Error(`Tracking event save failed: ${insertError.message}`);
    }
    return;
  }

  const message = db.findMessageForEvent({ internalId: params.messageId, rfcMessageId: params.messageId, sesMessageId: params.messageId });
  if (!message) return;
  const alreadyRecorded = (message.events || []).some((event) => event.eventType === params.eventType) || db.messageEvents.some((event) => event.messageId === message.messageId && event.eventType === params.eventType);
  if (!alreadyRecorded) eventProcessor.processEvent(params);
}

trackingRouter.get('/click/:messageId', async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const destinationUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!destinationUrl) return res.status(400).send('Missing target URL');
  if (!isValidRedirectUrl(destinationUrl)) return res.status(400).send('Invalid or unauthorized redirect URL');
  try {
    await recordTrackingEvent({ messageId, eventType: 'CLICKED', eventData: { destinationUrl, ip: req.ip, userAgent: req.get('user-agent') }, ipAddress: req.ip, userAgent: req.get('user-agent') });
  } catch (err) { console.error('[ClickTracking] Failed to record event:', err); }
  return res.redirect(302, destinationUrl);
});

trackingRouter.get('/open/:messageId', async (req: Request, res: Response) => {
  const { messageId } = req.params;
  try {
    await recordTrackingEvent({ messageId, eventType: 'OPENED', eventData: { ip: req.ip, userAgent: req.get('user-agent') }, ipAddress: req.ip, userAgent: req.get('user-agent') });
  } catch (err) { console.error('[OpenTracking] Failed to record event:', err); }
  res.set({ 'Content-Type': 'image/gif', 'Content-Length': TRANSPARENT_GIF.length.toString(), 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, private, max-age=0', 'Pragma': 'no-cache', 'Expires': '0' });
  return res.status(200).end(TRANSPARENT_GIF);
});
