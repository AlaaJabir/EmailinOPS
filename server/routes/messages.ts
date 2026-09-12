import { Router, Request, Response } from 'express';
import { db } from '../store.js';
import { kumoMtaService } from '../services/KumoMtaService.js';
import { suppressionService } from '../services/SuppressionService.js';
import { complianceService } from '../services/ComplianceService.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { convexService } from '../services/ConvexService.js';
import { personalizationService } from '../services/PersonalizationService.js';
import { Message } from '../../src/types.js';

export const messagesRouter = Router();

async function isRecipientSuppressed(email: string, userId: string): Promise<any | null> {
  const record = await convexService.isSuppressed(email, userId);
  if (record) return record;
  return suppressionService.isSuppressed(email).record || null;
}

async function preRegisterMessage(params: {
  internalId: string;
  messageId: string;
  senderId: string;
  fromName?: string;
  fromEmail: string;
  toEmail: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlBody?: string;
  headHtml?: string;
  plainText?: string;
  customHeaders?: Record<string, string>;
  campaignId?: string;
  userId?: string;
  isTest?: boolean;
  isMarketing?: boolean;
  openTrackingEnabled?: boolean;
  clickTrackingEnabled?: boolean;
}): Promise<Message> {
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
    events: [],
  };

  const targetUserId = params.userId || await convexService.getDefaultUserId();
  await convexService.saveMessage(message, targetUserId);
  return message;
}

messagesRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  const { search, status, senderId, campaignId, provider, limit = '50', offset = '0' } = req.query;
  const userId = req.user?.id || await convexService.getDefaultUserId();
  let list: any[] = await convexService.getMessages(userId, 200);

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter(
      (m) =>
        String(m.messageId || '').toLowerCase().includes(q) ||
        String(m.toEmail || '').toLowerCase().includes(q) ||
        String(m.fromEmail || '').toLowerCase().includes(q) ||
        String(m.subject || '').toLowerCase().includes(q)
    );
  }
  if (status && typeof status === 'string' && status !== 'ALL') list = list.filter((m) => m.status === status);
  if (senderId && typeof senderId === 'string') list = list.filter((m) => m.senderId === senderId);
  if (campaignId && typeof campaignId === 'string') list = list.filter((m) => m.campaignId === campaignId);
  if (provider && typeof provider === 'string') list = list.filter((m) => String(m.provider || '').toLowerCase().includes(provider.toLowerCase()));

  const total = list.length;
  const numLimit = parseInt(limit as string, 10) || 50;
  const numOffset = parseInt(offset as string, 10) || 0;
  res.json({ messages: list.slice(numOffset, numOffset + numLimit), total, limit: numLimit, offset: numOffset });
});

messagesRouter.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const message = await convexService.getMessageById(id, userId);
  if (!message) return res.status(404).json({ error: 'Message not found' });

  const events = await convexService.getMessageEvents(message.messageId, userId);
  res.json({ message: { ...message, events: events.length > 0 ? events : message.events || [] } });
});

function asRecipients(value: unknown): string[] {
  return (Array.isArray(value) ? value.flatMap((v) => String(v || '').split(',')) : String(value || '').split(','))
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function buildHtml(headHtml: unknown, bodyHtml: unknown, preheader?: unknown): string {
  let body = String(bodyHtml || '');
  const head = String(headHtml || '');
  const pre = String(preheader || '').trim();
  const preheaderHtml = pre
    ? `<!--[if !mso]><!--><div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">${pre.replace(/</g, '&lt;').replace(/>/g, '&gt;')}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div><!--<![endif]-->\n`
    : '';

  if (preheaderHtml) {
    if (/<body[^>]*>/i.test(body)) {
      body = body.replace(/(<body[^>]*>)/i, `$1\n${preheaderHtml}`);
    } else {
      body = `${preheaderHtml}${body}`;
    }
  }

  if (!head.trim()) return body;
  if (/<html[\s>]/i.test(body)) return body.replace(/<head([^>]*)>/i, `<head$1>${head}`);
  return `<!doctype html><html><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;
}

messagesRouter.post('/send', optionalAuth, async (req: Request, res: Response) => {
  const {
    fromName,
    fromEmail,
    replyTo,
    to,
    cc,
    bcc,
    subject,
    preheader,
    htmlBody,
    headHtml,
    plainText,
    customHeaders,
    campaignId,
    attachments,
    isMarketing,
    enableOpenTracking,
    enableClickTracking,
  } = req.body;

  const recipients = [...new Set(asRecipients(to))];
  const ccRecipients = [...new Set(asRecipients(cc))];
  const bccRecipients = [...new Set(asRecipients(bcc))];

  const validation = complianceService.validateSendPayload({ fromEmail, to: recipients, isMarketing, htmlBody });
  if (!validation.valid) {
    return res.status(400).json({ error: 'Compliance validation failed', details: validation.errors, warnings: validation.warnings });
  }
  if (!recipients.length) return res.status(400).json({ error: 'At least one recipient is required' });

  const userId = req.user?.id || await convexService.getDefaultUserId();
  const suppressed: any[] = [];
  for (const email of [...new Set([...recipients, ...ccRecipients, ...bccRecipients])]) {
    const record = await isRecipientSuppressed(email, userId);
    if (record) suppressed.push({ email, suppression: record });
  }
  if (suppressed.length) {
    const suppressedEmails = suppressed.map((s) => s.email).join(', ');
    return res.status(422).json({
      error: `Dispatch blocked: The following recipient(s) are on your suppression list: ${suppressedEmails}. Remove them from your list or delete them from the Suppressions tab to send.`,
      suppressed,
    });
  }

  try {
    const baseUrl = personalizationService.getBaseUrl(req.get('host'));
    const senders = await convexService.getSenders(userId);
    const normalizedFrom = String(fromEmail || '').trim().toLowerCase();
    const fromDomain = normalizedFrom.includes('@') ? normalizedFrom.split('@')[1] : '';
    let sender = senders.find((s) => s.fromEmail.toLowerCase() === normalizedFrom);
    if (!sender && fromDomain) {
      sender = senders.find((s) => {
        const sDomain = s.fromEmail.includes('@') ? s.fromEmail.split('@')[1].toLowerCase() : '';
        return sDomain === fromDomain && (s.status === 'active' || !s.status) && (s.verification === 'VERIFIED' || !s.verification);
      });
    }
    if (!sender && senders.length > 0) {
      sender = senders[0];
    }
    if (!sender) {
      return res.status(422).json({ error: `Sender identity for "${fromEmail}" is not configured` });
    }

    const clickTrackingEnabled = enableClickTracking ?? true;
    const openTrackingEnabled = enableOpenTracking ?? true;
    const results: any[] = [];
    const failures: any[] = [];

    for (const recipient of recipients) {
      const internalId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const senderDomain = String(fromEmail || '').includes('@') ? String(fromEmail).split('@')[1] : 'kumo.internal';
      const rfcMessageId = kumoMtaService.generateRfcMessageId(senderDomain);

      let contact: any = req.body.contact;
      if (!contact) {
        const userContacts = await convexService.getContacts(userId);
        contact = userContacts.find((c) => c.email.toLowerCase() === recipient);
      }

      const { unsubscribeUrl } = await personalizationService.generateUnsubscribeToken({
        email: recipient,
        contactId: contact?.id,
        messageId: internalId,
        campaignId,
        userId,
        baseUrl,
      });

      let personalizedHtml = personalizationService.personalizeContent(buildHtml(headHtml, htmlBody, preheader), {
        contact,
        email: recipient,
        unsubscribeUrl,
        privacyUrl: req.body.privacyUrl,
        termsUrl: req.body.termsUrl,
        customVariables: req.body.variables,
      });
      const personalizedSubject = personalizationService.personalizeContent(subject || '', {
        contact,
        email: recipient,
        unsubscribeUrl,
        privacyUrl: req.body.privacyUrl,
        termsUrl: req.body.termsUrl,
        customVariables: req.body.variables,
      });
      const effectivePlainText =
        plainText && plainText.trim().length > 0
          ? plainText
          : personalizationService.htmlToPlainText(personalizedHtml);
      const personalizedPlainText = personalizationService.personalizeContent(effectivePlainText, {
        contact,
        email: recipient,
        unsubscribeUrl,
        privacyUrl: req.body.privacyUrl,
        termsUrl: req.body.termsUrl,
        customVariables: req.body.variables,
      });

      if (clickTrackingEnabled && personalizedHtml) {
        personalizedHtml = personalizationService.rewriteLinksForClickTracking(personalizedHtml, internalId, baseUrl);
      }
      if (openTrackingEnabled && personalizedHtml) {
        personalizedHtml = personalizationService.injectOpenTrackingPixel(personalizedHtml, internalId, baseUrl);
      }

      const unsubHeaders = personalizationService.generateUnsubscribeHeaders(unsubscribeUrl, senderDomain);
      const userHeaders: Record<string, string> =
        customHeaders && typeof customHeaders === 'object'
          ? Object.fromEntries(Object.entries(customHeaders as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
          : {};
      const reserved = new Set(Object.keys(unsubHeaders).map((k) => k.toLowerCase()));
      const safeCustomHeaders = Object.fromEntries(Object.entries(userHeaders).filter(([k]) => !reserved.has(k.toLowerCase())));
      const mergedHeaders: Record<string, string> = { ...safeCustomHeaders, ...unsubHeaders };

      await preRegisterMessage({
        internalId,
        messageId: rfcMessageId,
        senderId: sender.id,
        fromName,
        fromEmail,
        toEmail: recipient,
        replyTo,
        cc: ccRecipients,
        bcc: bccRecipients,
        subject: personalizedSubject,
        htmlBody: personalizedHtml,
        headHtml: String(headHtml || ''),
        plainText: personalizedPlainText,
        customHeaders: mergedHeaders,
        campaignId,
        userId,
        isMarketing: Boolean(isMarketing),
        openTrackingEnabled,
        clickTrackingEnabled,
      });

      try {
        const result = await kumoMtaService.submitEmail({
          rfcMessageId,
          internalId,
          contactId: contact?.id,
          fromName,
          fromEmail,
          replyTo,
          to: recipient,
          cc: ccRecipients,
          bcc: bccRecipients,
          subject: personalizedSubject,
          htmlBody: personalizedHtml,
          plainText: personalizedPlainText,
          customHeaders: mergedHeaders,
          campaignId,
          attachments,
          userId,
        });
        results.push({ recipient, messageId: internalId, result, unsubscribeUrl });
      } catch (error: any) {
        failures.push({ recipient, messageId: internalId, error: error?.message || 'KumoMTA submission failed' });
      }
    }

    if (!results.length) {
      return res.status(502).json({
        success: false,
        error: 'All recipients failed to submit to KumoMTA',
        failures,
        warnings: validation.warnings,
      });
    }

    return res.status(failures.length ? 207 : 200).json({
      success: failures.length === 0,
      result: results.length === 1 ? results[0].result : results.map((r) => r.result),
      results,
      failures,
      messageIds: results.map((r) => r.messageId),
      warnings: validation.warnings,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to submit email via KumoMTA' });
  }
});

messagesRouter.post('/test', optionalAuth, async (req: Request, res: Response) => {
  const { testEmail, fromName, fromEmail, subject, preheader, htmlBody, headHtml, plainText, enableOpenTracking, enableClickTracking } = req.body;
  if (!testEmail || !fromEmail) return res.status(400).json({ error: 'testEmail and fromEmail are required' });

  const userId = req.user?.id || await convexService.getDefaultUserId();
  try {
    const senders = await convexService.getSenders(userId);
    const normalizedFrom = String(fromEmail || '').trim().toLowerCase();
    const fromDomain = normalizedFrom.includes('@') ? normalizedFrom.split('@')[1] : '';
    let sender = senders.find((s) => s.fromEmail.toLowerCase() === normalizedFrom);
    if (!sender && fromDomain) {
      sender = senders.find((s) => {
        const sDomain = s.fromEmail.includes('@') ? s.fromEmail.split('@')[1].toLowerCase() : '';
        return sDomain === fromDomain && (s.status === 'active' || !s.status) && (s.verification === 'VERIFIED' || !s.verification);
      });
    }
    if (!sender && senders.length > 0) {
      sender = senders[0];
    }
    if (!sender) {
      return res.status(422).json({ error: `Sender identity for "${fromEmail}" is not configured` });
    }

    const internalId = `msg_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const senderDomain = fromEmail.includes('@') ? fromEmail.split('@')[1] : 'kumo.internal';
    const rfcMessageId = kumoMtaService.generateRfcMessageId(senderDomain);
    const baseUrl = personalizationService.getBaseUrl(req.get('host'));
    const { unsubscribeUrl } = await personalizationService.generateUnsubscribeToken({
      email: testEmail,
      messageId: internalId,
      userId,
      baseUrl,
    });

    let personalizedHtml = personalizationService.personalizeContent(
      buildHtml(headHtml, htmlBody || '<p>This is a test message from EmailOps Dashboard via KumoMTA.</p>', preheader),
      { email: testEmail, unsubscribeUrl }
    );
    if (enableClickTracking ?? true) {
      personalizedHtml = personalizationService.rewriteLinksForClickTracking(personalizedHtml, internalId, baseUrl);
    }
    if (enableOpenTracking ?? true) {
      personalizedHtml = personalizationService.injectOpenTrackingPixel(personalizedHtml, internalId, baseUrl);
    }

    const testPlainText = plainText && plainText.trim().length > 0 ? plainText : personalizationService.htmlToPlainText(personalizedHtml);
    const unsubHeaders = personalizationService.generateUnsubscribeHeaders(unsubscribeUrl, senderDomain);

    await preRegisterMessage({
      internalId,
      messageId: rfcMessageId,
      senderId: sender.id,
      fromName: fromName || sender.name,
      fromEmail,
      toEmail: testEmail,
      subject: `[TEST EMAIL] ${subject || 'KumoMTA Test Verification'}`,
      htmlBody: personalizedHtml,
      headHtml: String(headHtml || ''),
      plainText: testPlainText,
      customHeaders: unsubHeaders,
      userId,
      isTest: true,
      isMarketing: false,
      openTrackingEnabled: enableOpenTracking ?? true,
      clickTrackingEnabled: enableClickTracking ?? true,
    });

    const result = await kumoMtaService.submitEmail({
      rfcMessageId,
      fromName: fromName || sender.name,
      fromEmail,
      to: testEmail,
      subject: `[TEST EMAIL] ${subject || 'KumoMTA Test Verification'}`,
      htmlBody: personalizedHtml,
      plainText: testPlainText,
      customHeaders: unsubHeaders,
      internalId,
      isTest: true,
      userId,
    });

    return res.json({
      success: true,
      result,
      message: `Test email dispatched to ${testEmail} through KumoMTA.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to send test email via KumoMTA' });
  }
});
