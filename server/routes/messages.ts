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

function preRegisterMessage(params: { internalId: string; messageId: string; senderId: string; fromName?: string; fromEmail: string; toEmail: string; replyTo?: string; cc?: string[]; bcc?: string[]; subject: string; htmlBody?: string; plainText?: string; customHeaders?: Record<string,string>; campaignId?: string; userId?: string; isTest?: boolean; }): Message {
  const now = new Date().toISOString();
  const message: Message = {
    id: params.internalId,
    messageId: params.messageId,
    campaignId: params.campaignId,
    senderId: params.senderId,
    fromName: params.fromName,
    fromEmail: params.fromEmail,
    toEmail: params.toEmail,
    replyTo: params.replyTo,
    cc: params.cc,
    bcc: params.bcc,
    subject: params.subject,
    htmlBody: params.htmlBody,
    plainText: params.plainText,
    customHeaders: params.customHeaders,
    status: 'QUEUED',
    provider: 'KumoMTA',
    queuedAt: now,
    createdAt: now,
    events: [{ id: `evt_preregister_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, messageId: params.messageId, eventType: 'QUEUED', eventData: { phase: 'pre_registered', isTest: Boolean(params.isTest) }, timestamp: now }],
  };
  const existing = db.messages.findIndex(m => m.id === message.id || m.messageId === message.messageId);
  if (existing >= 0) db.messages[existing] = message; else db.messages.unshift(message);
  return message;
}

messagesRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  const { search, status, senderId, campaignId, provider, limit = '50', offset = '0' } = req.query;
  let list: any[] = req.user && supabaseService.isConfigured ? await supabaseService.getMessages(req.user.id, 200) : [...db.messages];
  if (search && typeof search === 'string') { const q = search.toLowerCase(); list = list.filter((m) => m.messageId.toLowerCase().includes(q) || m.toEmail.toLowerCase().includes(q) || m.fromEmail.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q)); }
  if (status && typeof status === 'string' && status !== 'ALL') list = list.filter((m) => m.status === status);
  if (senderId && typeof senderId === 'string') list = list.filter((m) => m.senderId === senderId);
  if (campaignId && typeof campaignId === 'string') list = list.filter((m) => m.campaignId === campaignId);
  if (provider && typeof provider === 'string') list = list.filter((m) => m.provider.toLowerCase().includes(provider.toLowerCase()));
  const total = list.length; const numLimit = parseInt(limit as string, 10) || 50; const numOffset = parseInt(offset as string, 10) || 0;
  res.json({ messages: list.slice(numOffset, numOffset + numLimit), total, limit: numLimit, offset: numOffset });
});

messagesRouter.get('/:id', optionalAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const message = db.messages.find((m) => m.id === id || m.messageId === id || m.messageId === `<${id}>`);
  if (!message) return res.status(404).json({ error: 'Message not found' });
  const events = db.messageEvents.filter((e) => e.messageId === message.messageId);
  res.json({ message: { ...message, events: events.length > 0 ? events : message.events || [] } });
});

messagesRouter.post('/send', requireAuth, async (req: Request, res: Response) => {
  const { fromName, fromEmail, replyTo, to, cc, bcc, subject, htmlBody, plainText, customHeaders, campaignId, attachments, isMarketing, enableOpenTracking, enableClickTracking } = req.body;
  const validation = complianceService.validateSendPayload({ fromEmail, to, isMarketing, htmlBody });
  if (!validation.valid) return res.status(400).json({ error: 'Compliance validation failed', details: validation.errors, warnings: validation.warnings });
  const recipient = Array.isArray(to) ? to[0] : to;
  const suppressionCheck = suppressionService.isSuppressed(recipient);
  if (suppressionCheck.suppressed) return res.status(422).json({ error: `Recipient "${recipient}" is present on the Suppression List. Dispatch blocked.`, suppression: suppressionCheck.record });
  try {
    const internalId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const baseUrl = personalizationService.getBaseUrl(req.get('host'));
    let contact = req.body.contact || db.findContactByEmail(recipient);
    if (!contact && req.user && supabaseService.isConfigured) { const userContacts = await supabaseService.getContacts(req.user.id); contact = userContacts.find((c) => c.email.toLowerCase() === recipient.toLowerCase()); }
    const { unsubscribeUrl } = await personalizationService.generateUnsubscribeToken({ email: recipient, contactId: contact?.id, messageId: internalId, campaignId, userId: req.user?.id, baseUrl });
    let personalizedHtml = personalizationService.personalizeContent(htmlBody || '', { contact, email: recipient, unsubscribeUrl, privacyUrl: req.body.privacyUrl, termsUrl: req.body.termsUrl, customVariables: req.body.variables });
    const personalizedSubject = personalizationService.personalizeContent(subject || '', { contact, email: recipient, unsubscribeUrl, privacyUrl: req.body.privacyUrl, termsUrl: req.body.termsUrl, customVariables: req.body.variables });
    const personalizedPlainText = plainText ? personalizationService.personalizeContent(plainText, { contact, email: recipient, unsubscribeUrl, privacyUrl: req.body.privacyUrl, termsUrl: req.body.termsUrl, customVariables: req.body.variables }) : undefined;
    const clickTrackingEnabled = enableClickTracking ?? db.settings?.tracking?.enableClickTracking ?? true;
    const openTrackingEnabled = enableOpenTracking ?? db.settings?.tracking?.enableOpenTracking ?? true;
    if (clickTrackingEnabled && personalizedHtml) personalizedHtml = personalizationService.rewriteLinksForClickTracking(personalizedHtml, internalId, baseUrl);
    if (openTrackingEnabled && personalizedHtml) personalizedHtml = personalizationService.injectOpenTrackingPixel(personalizedHtml, internalId, baseUrl);
    const senderDomain = fromEmail.includes('@') ? fromEmail.split('@')[1] : 'transact.acme-corp.io';
    const unsubHeaders = personalizationService.generateUnsubscribeHeaders(unsubscribeUrl, senderDomain);
    const mergedHeaders: Record<string, string> = { ...unsubHeaders, ...(customHeaders || {}) };
    const sender = db.senders.find(s => s.fromEmail.toLowerCase() === String(fromEmail).toLowerCase());
    const senderId = sender?.id || db.senders[0]?.id || 'snd_01';
    const previewRfcId = `pre.${internalId}@emailops.local`;
    preRegisterMessage({ internalId, messageId: previewRfcId, senderId, fromName, fromEmail, toEmail: recipient, replyTo, cc, bcc, subject: personalizedSubject, htmlBody: personalizedHtml, plainText: personalizedPlainText, customHeaders: mergedHeaders, campaignId, userId: req.user?.id });
    const result = await kumoMtaService.submitEmail({ internalId, contactId: contact?.id, fromName, fromEmail, replyTo, to, cc, bcc, subject: personalizedSubject, htmlBody: personalizedHtml, plainText: personalizedPlainText, customHeaders: mergedHeaders, campaignId, attachments, userId: req.user?.id });
    res.json({ success: true, result, messageId: internalId, unsubscribeUrl, warnings: validation.warnings });
  } catch (err: any) { res.status(500).json({ error: err.message || 'Failed to submit email via KumoMTA' }); }
});

messagesRouter.post('/test', requireAuth, async (req: Request, res: Response) => {
  const { testEmail, fromEmail, subject, htmlBody, enableOpenTracking, enableClickTracking } = req.body;
  if (!testEmail || !fromEmail) return res.status(400).json({ error: 'testEmail and fromEmail are required' });
  try {
    const internalId = `msg_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const baseUrl = personalizationService.getBaseUrl(req.get('host'));
    const { unsubscribeUrl } = await personalizationService.generateUnsubscribeToken({ email: testEmail, messageId: internalId, userId: req.user?.id, baseUrl });
    let personalizedHtml = personalizationService.personalizeContent(htmlBody || '<p>This is a test message from EmailOps Dashboard via KumoMTA.</p>', { email: testEmail, unsubscribeUrl });
    const clickTrackingEnabled = enableClickTracking ?? true; const openTrackingEnabled = enableOpenTracking ?? true;
    if (clickTrackingEnabled && personalizedHtml) personalizedHtml = personalizationService.rewriteLinksForClickTracking(personalizedHtml, internalId, baseUrl);
    if (openTrackingEnabled && personalizedHtml) personalizedHtml = personalizationService.injectOpenTrackingPixel(personalizedHtml, internalId, baseUrl);
    const senderDomain = fromEmail.includes('@') ? fromEmail.split('@')[1] : 'transact.acme-corp.io';
    const unsubHeaders = personalizationService.generateUnsubscribeHeaders(unsubscribeUrl, senderDomain);
    const sender = db.senders.find(s => s.fromEmail.toLowerCase() === String(fromEmail).toLowerCase());
    const senderId = sender?.id || db.senders[0]?.id || 'snd_01';
    const previewRfcId = `pre.${internalId}@emailops.local`;
    preRegisterMessage({ internalId, messageId: previewRfcId, senderId, fromEmail, toEmail: testEmail, subject: `[TEST EMAIL] ${subject || 'KumoMTA Test Verification'}`, htmlBody: personalizedHtml, customHeaders: unsubHeaders, userId: req.user?.id, isTest: true });
    const result = await kumoMtaService.submitEmail({ fromEmail, to: testEmail, subject: `[TEST EMAIL] ${subject || 'KumoMTA Test Verification'}`, htmlBody: personalizedHtml, customHeaders: unsubHeaders, internalId, isTest: true, userId: req.user?.id });
    res.json({ success: true, result, message: `Test email dispatched to ${testEmail} through KumoMTA spool.` });
  } catch (err: any) { res.status(500).json({ error: err.message || 'Failed to send test email via KumoMTA' }); }
});
