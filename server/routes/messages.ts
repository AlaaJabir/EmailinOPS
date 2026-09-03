import { Router, Request, Response } from 'express';
import { db } from '../store.js';
import { kumoMtaService } from '../services/KumoMtaService.js';
import { suppressionService } from '../services/SuppressionService.js';
import { complianceService } from '../services/ComplianceService.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { supabaseService } from '../services/SupabaseService.js';
import { personalizationService } from '../services/PersonalizationService.js';

export const messagesRouter = Router();

// GET /api/messages - Filterable and searchable message list (scoped to user)
messagesRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  const { search, status, senderId, campaignId, provider, limit = '50', offset = '0' } = req.query;

  let list: any[] = [];
  if (req.user && supabaseService.isConfigured) {
    list = await supabaseService.getMessages(req.user.id, 200);
  } else {
    list = [...db.messages];
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter(
      (m) =>
        m.messageId.toLowerCase().includes(q) ||
        m.toEmail.toLowerCase().includes(q) ||
        m.fromEmail.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q)
    );
  }

  if (status && typeof status === 'string' && status !== 'ALL') {
    list = list.filter((m) => m.status === status);
  }

  if (senderId && typeof senderId === 'string') {
    list = list.filter((m) => m.senderId === senderId);
  }

  if (campaignId && typeof campaignId === 'string') {
    list = list.filter((m) => m.campaignId === campaignId);
  }

  if (provider && typeof provider === 'string') {
    list = list.filter((m) => m.provider.toLowerCase().includes(provider.toLowerCase()));
  }

  const total = list.length;
  const numLimit = parseInt(limit as string, 10) || 50;
  const numOffset = parseInt(offset as string, 10) || 0;
  const paginated = list.slice(numOffset, numOffset + numLimit);

  res.json({
    messages: paginated,
    total,
    limit: numLimit,
    offset: numOffset,
  });
});

// GET /api/messages/:id - Detailed message inspection
messagesRouter.get('/:id', optionalAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const message = db.messages.find(
    (m) => m.id === id || m.messageId === id || m.messageId === `<${id}>`
  );

  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  // Get associated events
  const events = db.messageEvents.filter((e) => e.messageId === message.messageId);

  res.json({
    message: {
      ...message,
      events: events.length > 0 ? events : message.events || [],
    },
  });
});

// POST /api/messages/send - Submit single or batch email via KumoMTA
messagesRouter.post('/send', requireAuth, async (req: Request, res: Response) => {
  const {
    fromName,
    fromEmail,
    replyTo,
    to,
    cc,
    bcc,
    subject,
    htmlBody,
    plainText,
    customHeaders,
    campaignId,
    attachments,
    isMarketing,
  } = req.body;

  // 1. Compliance pre-flight
  const validation = complianceService.validateSendPayload({
    fromEmail,
    to,
    isMarketing,
    htmlBody,
  });

  if (!validation.valid) {
    return res.status(400).json({
      error: 'Compliance validation failed',
      details: validation.errors,
      warnings: validation.warnings,
    });
  }

  // 2. Suppression check
  const recipient = Array.isArray(to) ? to[0] : to;
  const suppressionCheck = suppressionService.isSuppressed(recipient);
  if (suppressionCheck.suppressed) {
    return res.status(422).json({
      error: `Recipient "${recipient}" is present on the Suppression List. Dispatch blocked.`,
      suppression: suppressionCheck.record,
    });
  }

  try {
    // 3. Correlation & URL resolution
    const internalId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const baseUrl = personalizationService.getBaseUrl(req.get('host'));

    // 4. Contact lookup for personalization
    let contact = req.body.contact || db.findContactByEmail(recipient);
    if (!contact && req.user && supabaseService.isConfigured) {
      const userContacts = await supabaseService.getContacts(req.user.id);
      contact = userContacts.find((c) => c.email.toLowerCase() === recipient.toLowerCase());
    }

    // 5. Generate secure unsubscribe token without exposing email in URL
    const { token: unsubToken, unsubscribeUrl } = await personalizationService.generateUnsubscribeToken({
      email: recipient,
      contactId: contact?.id,
      messageId: internalId,
      campaignId,
      userId: req.user?.id,
      baseUrl,
    });

    // 6. Personalize HTML body, subject, and plain text
    let personalizedHtml = personalizationService.personalizeContent(htmlBody || '', {
      contact,
      email: recipient,
      unsubscribeUrl,
      privacyUrl: req.body.privacyUrl,
      termsUrl: req.body.termsUrl,
      customVariables: req.body.variables,
    });

    let personalizedSubject = personalizationService.personalizeContent(subject || '', {
      contact,
      email: recipient,
      unsubscribeUrl,
      privacyUrl: req.body.privacyUrl,
      termsUrl: req.body.termsUrl,
      customVariables: req.body.variables,
    });

    let personalizedPlainText = plainText
      ? personalizationService.personalizeContent(plainText, {
          contact,
          email: recipient,
          unsubscribeUrl,
          privacyUrl: req.body.privacyUrl,
          termsUrl: req.body.termsUrl,
          customVariables: req.body.variables,
        })
      : undefined;

    // 7. Click tracking URL rewriting (if enabled)
    const clickTrackingEnabled =
      req.body.enableClickTracking ?? db.settings?.tracking?.enableClickTracking ?? true;
    if (clickTrackingEnabled && personalizedHtml) {
      personalizedHtml = personalizationService.rewriteLinksForClickTracking(
        personalizedHtml,
        internalId,
        baseUrl
      );
    }

    // 8. Open tracking 1x1 pixel injection (if enabled)
    const openTrackingEnabled =
      req.body.enableOpenTracking ?? db.settings?.tracking?.enableOpenTracking ?? true;
    if (openTrackingEnabled && personalizedHtml) {
      personalizedHtml = personalizationService.injectOpenTrackingPixel(
        personalizedHtml,
        internalId,
        baseUrl
      );
    }

    // 9. RFC 8058 List-Unsubscribe and List-Unsubscribe-Post headers
    const senderDomain = fromEmail.includes('@') ? fromEmail.split('@')[1] : 'transact.acme-corp.io';
    const unsubHeaders = personalizationService.generateUnsubscribeHeaders(
      unsubscribeUrl,
      senderDomain
    );

    const mergedHeaders: Record<string, string> = {
      ...unsubHeaders,
      ...(customHeaders || {}),
    };

    const result = await kumoMtaService.submitEmail({
      internalId,
      contactId: contact?.id,
      fromName,
      fromEmail,
      replyTo,
      to,
      cc,
      bcc,
      subject: personalizedSubject,
      htmlBody: personalizedHtml,
      plainText: personalizedPlainText,
      customHeaders: mergedHeaders,
      campaignId,
      attachments,
      userId: req.user?.id,
    });

    res.json({
      success: true,
      result,
      messageId: internalId,
      unsubscribeUrl,
      warnings: validation.warnings,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to submit email via KumoMTA' });
  }
});

// POST /api/messages/test - Send test verification email
messagesRouter.post('/test', requireAuth, async (req: Request, res: Response) => {
  const { testEmail, fromEmail, subject, htmlBody } = req.body;

  if (!testEmail || !fromEmail) {
    return res.status(400).json({ error: 'testEmail and fromEmail are required' });
  }

  try {
    const result = await kumoMtaService.submitEmail({
      fromEmail,
      to: testEmail,
      subject: `[TEST EMAIL] ${subject || 'KumoMTA Test Verification'}`,
      htmlBody: htmlBody || '<p>This is a test message from EmailOps Dashboard via KumoMTA.</p>',
      isTest: true,
      userId: req.user?.id,
    });

    res.json({
      success: true,
      result,
      message: `Test email dispatched to ${testEmail} through KumoMTA spool.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to send test email via KumoMTA' });
  }
});
