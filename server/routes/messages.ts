import { Router, Request, Response } from 'express';
import { db } from '../store.js';
import { kumoMtaService } from '../services/KumoMtaService.js';
import { suppressionService } from '../services/SuppressionService.js';
import { complianceService } from '../services/ComplianceService.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { supabaseService } from '../services/SupabaseService.js';
import { personalizationService } from '../services/PersonalizationService.js';
import { Message } from '../../src/types.js';

export const messagesRouter = Router();

function preRegisterMessage(params: { internalId: string; messageId: string; senderId: string; fromName?: string; fromEmail: string; toEmail: string; replyTo?: string; cc?: string[]; bcc?: string[]; subject: string; htmlBody?: string; headHtml?: string; plainText?: string; customHeaders?: Record<string,string>; campaignId?: string; userId?: string; isTest?: boolean; openTrackingEnabled?: boolean; clickTrackingEnabled?: boolean; }): Message {
  const now = new Date().toISOString();
  const message: Message = { id: params.internalId, messageId: params.messageId, campaignId: params.campaignId, senderId: params.senderId, fromName: params.fromName, fromEmail: params.fromEmail, toEmail: params.toEmail, replyTo: params.replyTo, cc: params.cc, bcc: params.bcc, subject: params.subject, htmlBody: params.htmlBody, plainText: params.plainText, customHeaders: params.customHeaders, status: 'QUEUED', provider: 'KumoMTA', queuedAt: now, createdAt: now, events: [{ id: `evt_preregister_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, messageId: params.messageId, eventType: 'QUEUED', eventData: { phase: 'pre_registered', isTest: Boolean(params.isTest) }, timestamp: now }] };
  const existing = db.messages.findIndex(m => m.id === message.id || m.messageId === message.messageId);
  if (existing >= 0) db.messages[existing] = message; else db.messages.unshift(message);
  return message;
}

messagesRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  const { search, status, senderId, campaignId, provider, limit = '50', offset = '0' } = req.query;
  let list: any[] = req.user && supabaseService.isConfigured ? await supabaseService.getMessages(req.user.id, 200) : [...db.messages];
  if (search && typeof search === 'string') { const q = search.toLowerCase(); list = list.filter((m) => String(m.messageId || '').toLowerCase().includes(q) || String(m.toEmail || '').toLowerCase().includes(q) || String(m.fromEmail || '').toLowerCase().includes(q) || String(m.subject || '').toLowerCase().includes(q)); }
  if (status && typeof status === 'string' && status !== 'ALL') list = list.filter((m) => m.status === status);
  if (senderId && typeof senderId === 'string') list = list.filter((m) => m.senderId === senderId);
  if (campaignId && typeof campaignId === 'string') list = list.filter((m) => m.campaignId === campaignId);
  if (provider && typeof provider === 'string') list = list.filter((m) => String(m.provider || '').toLowerCase().includes(provider.toLowerCase()));
  const total = list.length; const numLimit = parseInt(limit as string, 10) || 50; const numOffset = parseInt(offset as string, 10) || 0;
  res.json({ messages: list.slice(numOffset, numOffset + numLimit), total, limit: numLimit, offset: numOffset });
});

messagesRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (supabaseService.isConfigured && req.user) {
    const client = supabaseService.getClient()!;
    const { data, error } = await client.from('messages').select('*').eq('user_id', req.user.id).or(`internal_id.eq.${id},message_id.eq.${id},ses_message_id.eq.${id}`).maybeSingle();
    if (error) return res.status(500).json({ error: 'Failed to load message', details: error.message });
    if (!data) return res.status(404).json({ error: 'Message not found' });
    const { data: events } = await client.from('message_events').select('*').eq('message_id', data.message_id).order('timestamp', { ascending: true });
    return res.json({ message: { id: data.internal_id || data.id, messageId: data.message_id, sesMessageId: data.ses_message_id, campaignId: data.campaign_id, senderId: data.sender_id, fromName: data.from_name, fromEmail: data.from_email, toEmail: data.to_email, replyTo: data.reply_to, cc: data.cc || [], bcc: data.bcc || [], subject: data.subject, htmlBody: data.html_body, plainText: data.plain_text, customHeaders: data.custom_headers, status: data.status, provider: data.provider, providerMessageId: data.provider_message_id, smtpResponse: data.smtp_response, bounceType: data.bounce_type, bounceReason: data.bounce_reason, queuedAt: data.queued_at, sentAt: data.sent_at, deliveredAt: data.delivered_at, bouncedAt: data.bounced_at, createdAt: data.created_at, events: (events || []).map((e: any) => ({ id: e.id, messageId: e.message_id, eventType: e.event_type, eventData: e.event_data || undefined, timestamp: e.timestamp, ipAddress: e.ip_address || undefined, userAgent: e.user_agent || undefined, geo: e.geo || undefined })) } });
  }
  const message = db.messages.find((m) => m.id === id || m.messageId === id || m.messageId === `<${id}>`);
  if (!message) return res.status(404).json({ error: 'Message not found' });
  const events = db.messageEvents.filter((e) => e.messageId === message.messageId);
  res.json({ message: { ...message, events: events.length > 0 ? events : message.events || [] } });
});

function asRecipients(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(v => String(v || '').split(',')).map(v => v.trim()).filter(Boolean);
  return String(value || '').split(',').map(v => v.trim()).filter(Boolean);
}

function buildHtml(headHtml: unknown, bodyHtml: unknown): string {
  const body = String(bodyHtml || '');
  const head = String(headHtml || '');
  if (!head.trim()) return body;
  if (/<html[\s>]/i.test(body)) return body.replace(/<head([^>]*)>/i, `<head$1>${head}`);
  return `<!doctype html><html><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;
}

messagesRouter.post('/send', requireAuth, async (req: Request, res: Response) => {
  const { fromName, fromEmail, replyTo, to, cc, bcc, subject, htmlBody, headHtml, plainText, customHeaders, campaignId, attachments, isMarketing, enableOpenTracking, enableClickTracking } = req.body;
  const recipients = asRecipients(to);
  const validation = complianceService.validateSendPayload({ fromEmail, to: recipients, isMarketing, htmlBody });
  if (!validation.valid) return res.status(400).json({ error: 'Compliance validation failed', details: validation.errors, warnings: validation.warnings });
  if (!recipients.length) return res.status(400).json({ error: 'At least one recipient is required' });
  const suppressed = recipients.map(email => ({ email, check: suppressionService.isSuppressed(email) })).filter(x => x.check.suppressed);
  if (suppressed.length) return res.status(422).json({ error: 'Dispatch blocked because one or more recipients are suppressed.', suppressed: suppressed.map(x => ({ email: x.email, suppression: x.check.record })) });
  try {
    const internalId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const baseUrl = personalizationService.getBaseUrl(req.get('host'));
    let contact = req.body.contact || db.findContactByEmail(recipients[0]);
    if (!contact && req.user && supabaseService.isConfigured) { const userContacts = await supabaseService.getContacts(req.user.id); contact = userContacts.find((c) => c.email.toLowerCase() === recipients[0].toLowerCase()); }
    const { unsubscribeUrl } = await personalizationService.generateUnsubscribeToken({ email: recipients[0], contactId: contact?.id, messageId: internalId, campaignId, userId: req.user?.id, baseUrl });
    let personalizedHtml = personalizationService.personalizeContent(buildHtml(headHtml, htmlBody), { contact, email: recipients[0], unsubscribeUrl, privacyUrl: req.body.privacyUrl, termsUrl: req.body.termsUrl, customVariables: req.body.variables });
    const personalizedSubject = personalizationService.personalizeContent(subject || '', { contact, email: recipients[0], unsubscribeUrl, privacyUrl: req.body.privacyUrl, termsUrl: req.body.termsUrl, customVariables: req.body.variables });
    const personalizedPlainText = plainText ? personalizationService.personalizeContent(plainText, { contact, email: recipients[0], unsubscribeUrl, privacyUrl: req.body.privacyUrl, termsUrl: req.body.termsUrl, customVariables: req.body.variables }) : undefined;
    const clickTrackingEnabled = enableClickTracking ?? true;
    const openTrackingEnabled = enableOpenTracking ?? true;
    if (clickTrackingEnabled && personalizedHtml) personalizedHtml = personalizationService.rewriteLinksForClickTracking(personalizedHtml, internalId, baseUrl);
    if (openTrackingEnabled && personalizedHtml) personalizedHtml = personalizationService.injectOpenTrackingPixel(personalizedHtml, internalId, baseUrl);
    const senderDomain = String(fromEmail || '').includes('@') ? String(fromEmail).split('@')[1] : '';
    const unsubHeaders = personalizationService.generateUnsubscribeHeaders(unsubscribeUrl, senderDomain);
    const userHeaders = customHeaders && typeof customHeaders === 'object' ? customHeaders : {};
    const reserved = new Set(Object.keys(unsubHeaders).map(k => k.toLowerCase()));
    const safeCustomHeaders = Object.fromEntries(Object.entries(userHeaders).filter(([k]) => !reserved.has(k.toLowerCase())));
    const mergedHeaders: Record<string, string> = { ...safeCustomHeaders, ...unsubHeaders };

    let sender: any = undefined;
    if (req.user && supabaseService.isConfigured) {
      const senders = await supabaseService.getSenders(req.user.id);
      sender = senders.find(s => s.fromEmail.toLowerCase() === String(fromEmail).toLowerCase());
    } else {
      sender = db.senders.find(s => s.fromEmail.toLowerCase() === String(fromEmail).toLowerCase());
    }
    if (!sender) return res.status(422).json({ error: 'Sender identity is not configured for the authenticated user' });

    preRegisterMessage({ internalId, messageId: `pre.${internalId}@emailops.local`, senderId: sender.id, fromName, fromEmail, toEmail: recipients[0], replyTo, cc, bcc, subject: personalizedSubject, htmlBody: personalizedHtml, headHtml: String(headHtml || ''), plainText: personalizedPlainText, customHeaders: mergedHeaders, campaignId, userId: req.user?.id, openTrackingEnabled, clickTrackingEnabled });
    const result = await kumoMtaService.submitEmail({ internalId, contactId: contact?.id, fromName, fromEmail, replyTo, to: recipients, cc, bcc, subject: personalizedSubject, htmlBody: personalizedHtml, plainText: personalizedPlainText, customHeaders: mergedHeaders, campaignId, attachments, userId: req.user?.id });
    res.json({ success: true, result, messageId: internalId, unsubscribeUrl, warnings: validation.warnings });
  } catch (err: any) { res.status(500).json({ error: err.message || 'Failed to submit email via KumoMTA' }); }
});

messagesRouter.post('/test', requireAuth, async (req: Request, res: Response) => {
  const { testEmail, fromEmail, subject, htmlBody, headHtml, enableOpenTracking, enableClickTracking } = req.body;
  if (!testEmail || !fromEmail) return res.status(400).json({ error: 'testEmail and fromEmail are required' });
  try {
    const internalId = `msg_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const baseUrl = personalizationService.getBaseUrl(req.get('host'));
    const { unsubscribeUrl } = await personalizationService.generateUnsubscribeToken({ email: testEmail, messageId: internalId, userId: req.user?.id, baseUrl });
    let personalizedHtml = personalizationService.personalizeContent(buildHtml(headHtml, htmlBody || '<p>This is a test message from EmailOps Dashboard via KumoMTA.</p>'), { email: testEmail, unsubscribeUrl });
    if (enableClickTracking ?? true) personalizedHtml = personalizationService.rewriteLinksForClickTracking(personalizedHtml, internalId, baseUrl);
    if (enableOpenTracking ?? true) personalizedHtml = personalizationService.injectOpenTrackingPixel(personalizedHtml, internalId, baseUrl);
    const senderDomain = fromEmail.includes('@') ? fromEmail.split('@')[1] : 'localhost';
    const unsubHeaders = personalizationService.generateUnsubscribeHeaders(unsubscribeUrl, senderDomain);
    const sender = db.senders.find(s => s.fromEmail.toLowerCase() === String(fromEmail).toLowerCase());
    const senderId = sender?.id || db.senders[0]?.id || 'snd_unknown';
    preRegisterMessage({ internalId, messageId: `pre.${internalId}@emailops.local`, senderId, fromEmail, toEmail: testEmail, subject: `[TEST EMAIL] ${subject || 'KumoMTA Test Verification'}`, htmlBody: personalizedHtml, headHtml: String(headHtml || ''), customHeaders: unsubHeaders, userId: req.user?.id, isTest: true });
    const result = await kumoMtaService.submitEmail({ fromEmail, to: testEmail, subject: `[TEST EMAIL] ${subject || 'KumoMTA Test Verification'}`, htmlBody: personalizedHtml, customHeaders: unsubHeaders, internalId, isTest: true, userId: req.user?.id });
    res.json({ success: true, result, message: `Test email dispatched to ${testEmail} through KumoMTA spool.` });
  } catch (err: any) { res.status(500).json({ error: err.message || 'Failed to send test email via KumoMTA' }); }
});
