import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { convexService } from '../services/ConvexService.js';
import { personalizationService } from '../services/PersonalizationService.js';
import { kumoMtaService } from '../services/KumoMtaService.js';

export const campaignsRouter = Router();
const CONTACT_PAGE_SIZE = 250;
const SEND_LEASE_MS = 15 * 60 * 1000;

function buildHtml(head: unknown, body: unknown) {
  const h = String(head || '');
  const b = String(body || '');
  if (!h.trim()) return b;
  if (/<html[\s>]/i.test(b)) return b.replace(/<head([^>]*)>/i, `<head$1>${h}`);
  return `<!doctype html><html><head><meta charset="utf-8">${h}</head><body>${b}</body></html>`;
}

campaignsRouter.get('/', optionalAuth, async (req, res) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const campaigns = await convexService.getCampaigns(userId);
  return res.json({ campaigns });
});

campaignsRouter.get('/:id', optionalAuth, async (req, res) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const campaigns = await convexService.getCampaigns(userId);
  const campaign = campaigns.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const allMessages = await convexService.getMessages(userId, 500);
  const messages = allMessages.filter((m) => m.campaignId === campaign.id);
  return res.json({ campaign, messages });
});

campaignsRouter.post('/', optionalAuth, async (req, res) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const { name, senderId, listId, subject, headHtml, htmlBody, plainText, scheduledAt, status, trackOpens, trackClicks } = req.body;
  if (!name || !senderId || !subject) return res.status(400).json({ error: 'Name, sender, and subject are required' });

  const senders = await convexService.getSenders(userId);
  const sender = senders.find((s) => s.id === senderId) || senders[0];
  if (!sender) return res.status(400).json({ error: 'Sender not found' });

  const created = await convexService.saveCampaign({
    name: String(name).trim(), senderId: sender.id, listId: listId || undefined, subject: String(subject),
    headHtml: headHtml || '', htmlBody: htmlBody || '', plainText: plainText || undefined,
    status: status || 'DRAFT', totalRecipients: 0, sentCount: 0, deliveredCount: 0, bouncedCount: 0,
    complaintCount: 0, openCount: 0, clickCount: 0, trackOpens: trackOpens !== false, trackClicks: trackClicks !== false,
    startedAt: scheduledAt || undefined,
  }, userId);

  await convexService.saveTechnicalLog({ id: `cmp_${created.id}`, service: 'Application', event: 'CAMPAIGN_CREATED', severity: 'INFO', response: `Campaign ${created.name} created`, details: { campaignId: created.id } }, userId);
  return res.status(201).json({ success: true, campaign: created });
});

campaignsRouter.patch('/:id/status', optionalAuth, async (req, res) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required' });
  const updates: any = { status };
  if (status === 'SENDING') updates.startedAt = new Date().toISOString();
  if (status === 'COMPLETED' || status === 'FAILED') updates.completedAt = new Date().toISOString();
  await convexService.updateCampaign(req.params.id, updates, userId);
  const campaigns = await convexService.getCampaigns(userId);
  const campaign = campaigns.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  return res.json({ success: true, campaign });
});

campaignsRouter.post('/:id/send', optionalAuth, async (req, res) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const client = convexService.getClient();
  if (!client || !convexService.isConfigured) return res.status(503).json({ error: 'Convex persistence is required for resumable campaign sending' });

  const leaseId = `send_${req.params.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + SEND_LEASE_MS).toISOString();
  const acquired = await client.mutation('campaigns:acquireSend' as any, {
    id: req.params.id, userId, leaseId, leaseUntil, now: now.toISOString(),
  });
  if (!acquired?.acquired) {
    if (acquired?.reason === 'NOT_FOUND') return res.status(404).json({ error: 'Campaign not found' });
    return res.status(409).json({ error: 'Campaign is already being sent by another worker' });
  }

  const current = acquired.campaign;
  const senders = await convexService.getSenders(userId);
  const sender = senders.find((s) => s.id === current.senderId) || senders[0];
  if (!sender) {
    await client.mutation('campaigns:releaseSend' as any, { id: current._id || current.id, userId, leaseId, now: new Date().toISOString() });
    return res.status(400).json({ error: 'Campaign sender is not available' });
  }

  const baseUrl = personalizationService.getBaseUrl(req.get('host'));
  const senderDomain = String(sender.fromEmail).split('@')[1] || 'kumo.internal';
  let cursor: string | undefined = current.sendCursor || undefined;
  let processed = Number(current.sendProcessed || 0);
  let failed = Number(current.sendFailed || 0);
  let suppressedCount = Number(current.sendSuppressed || 0);
  let sentCount = Number(current.sentCount || 0);
  let totalRecipients = Number(current.totalRecipients || 0);
  const existingCampaignEmails = new Set<string>(await client.query('messages:getCampaignRecipientEmails' as any, { userId, campaignId: current._id || current.id }));
  if (existingCampaignEmails.size > sentCount) sentCount = existingCampaignEmails.size;
  let pages = 0;
  const freshCampaignRun =
    totalRecipients === 0 &&
    processed === 0 &&
    sentCount === 0 &&
    !cursor;
  let lastLeaseRenewAt = Date.now();
  let lastLeaseRenewProcessed = processed;

  try {
    while (true) {
      const page = await client.query('contacts:listPage' as any, {
        userId,
        listId: current.listId || undefined,
        cursor,
        numItems: CONTACT_PAGE_SIZE,
      });
      const contacts = Array.isArray(page?.page) ? page.page : [];
      if (!contacts.length) {
        await convexService.updateCampaign(current._id || current.id, {
          status: failed && !sentCount ? 'FAILED' : 'COMPLETED',
          sentCount, totalRecipients, sendCursor: undefined, sendProcessed: processed,
          sendFailed: failed, sendSuppressed: suppressedCount, completedAt: new Date().toISOString(),
          sendLeaseId: undefined, sendLeaseUntil: undefined,
        }, userId);
        break;
      }

      pages += 1;
      const emails = contacts.map((c: any) => String(c.email || '').trim().toLowerCase()).filter(Boolean);
      const suppressedEmails = new Set<string>(await client.query('suppressions:findMany' as any, { userId, emails }));
      const candidateContacts = contacts.filter((c: any) => c.status === 'ACTIVE');
      if (freshCampaignRun) {
        totalRecipients += candidateContacts.length;
      }
      suppressedCount += candidateContacts.filter((c: any) => suppressedEmails.has(String(c.email).trim().toLowerCase())).length;

      const deterministicIds = candidateContacts.map((contact: any) => `cmp_${current._id || current.id}_cnt_${String(contact._id || contact.id || contact.email)}`);
      const existingIds = new Set<string>(await client.query('messages:getManyByInternalIds' as any, { userId, ids: deterministicIds }));

      for (const contact of candidateContacts) {
        if (
          processed - lastLeaseRenewProcessed >= 25 ||
          Date.now() - lastLeaseRenewAt >= 30_000
        ) {
          const renewed = await client.mutation('campaigns:renewSend' as any, {
            id: current._id || current.id,
            userId,
            leaseId,
            leaseUntil: new Date(Date.now() + SEND_LEASE_MS).toISOString(),
            now: new Date().toISOString(),
          });
          if (!renewed) throw new Error('CAMPAIGN_SEND_LEASE_LOST');
          lastLeaseRenewAt = Date.now();
          lastLeaseRenewProcessed = processed;
        }

        const email = String(contact.email).trim().toLowerCase();
        if (suppressedEmails.has(email)) continue;
        const contactKey = String(contact._id || contact.id || contact.email);
        const internalId = `cmp_${current._id || current.id}_cnt_${contactKey}`;
        if (existingIds.has(internalId) || existingCampaignEmails.has(email)) {
          existingCampaignEmails.add(email);
          processed += 1;
          continue;
        }
        try {
          const { unsubscribeUrl } = await personalizationService.generateUnsubscribeToken({ email, contactId: contact.id, messageId: internalId, campaignId: current._id || current.id, userId, baseUrl });
          let html = personalizationService.personalizeContent(buildHtml(current.headHtml, current.htmlBody), { contact, email, unsubscribeUrl });
          const subj = personalizationService.personalizeContent(current.subject, { contact, email, unsubscribeUrl });
          if (current.trackClicks) html = personalizationService.rewriteLinksForClickTracking(html, internalId, baseUrl);
          if (current.trackOpens) html = personalizationService.injectOpenTrackingPixel(html, internalId, baseUrl);
          const headers = personalizationService.generateUnsubscribeHeaders(unsubscribeUrl, senderDomain);

          await kumoMtaService.submitEmail({
            internalId, contactId: contact.id, fromName: sender.name, fromEmail: sender.fromEmail, replyTo: sender.replyTo,
            to: email, subject: subj, htmlBody: html, plainText: current.plainText || undefined,
            customHeaders: headers, campaignId: current._id || current.id, userId,
          });
          sentCount += 1;
          existingCampaignEmails.add(email);
        } catch (_err) {
          failed += 1;
        }
        processed += 1;
      }

      cursor = page.continueCursor || undefined;
      const renewed = await client.mutation('campaigns:renewSend' as any, {
        id: current._id || current.id, userId, leaseId,
        leaseUntil: new Date(Date.now() + SEND_LEASE_MS).toISOString(), now: new Date().toISOString(),
      });
      if (!renewed) throw new Error('CAMPAIGN_SEND_LEASE_LOST');

      await convexService.updateCampaign(current._id || current.id, {
        status: 'SENDING', totalRecipients, sentCount, sendCursor: cursor,
        sendProcessed: processed, sendFailed: failed, sendSuppressed: suppressedCount,
      }, userId);

      if (!page.isDone && !cursor) throw new Error('Convex pagination returned no cursor for an unfinished campaign page');
      if (page.isDone) {
        await convexService.updateCampaign(current._id || current.id, {
          status: failed && !sentCount ? 'FAILED' : 'COMPLETED', totalRecipients, sentCount,
          sendCursor: undefined, sendProcessed: processed, sendFailed: failed, sendSuppressed: suppressedCount,
          completedAt: new Date().toISOString(), sendLeaseId: undefined, sendLeaseUntil: undefined,
        }, userId);
        break;
      }
    }
  } catch (err: any) {
    const renewedLease = await client.mutation('campaigns:renewSend' as any, {
      id: current._id || current.id, userId, leaseId,
      leaseUntil: new Date(Date.now() + SEND_LEASE_MS).toISOString(), now: new Date().toISOString(),
    });
    if (renewedLease) {
      await convexService.updateCampaign(current._id || current.id, {
        status: 'SENDING', totalRecipients, sentCount, sendCursor: cursor,
        sendProcessed: processed, sendFailed: failed, sendSuppressed: suppressedCount,
      }, userId);
    }
    return res.status(202).json({
      success: false, resumable: true, message: err?.message || String(err),
      campaign: { id: current._id || current.id, status: 'SENDING', sentCount, totalRecipients, processed, failed, suppressedCount, cursor }, pages,
    });
  }

  const final = await client.query('campaigns:get' as any, { id: current._id || current.id, userId });
  await convexService.saveTechnicalLog({
    id: `cmp_send_${current._id || current.id}_${Date.now()}`, service: 'Application', event: 'CAMPAIGN_DISPATCH_COMPLETED',
    severity: failed ? 'WARN' : 'INFO', response: `${sentCount} queued, ${failed} failed, ${suppressedCount} suppressed`,
    details: { campaignId: current._id || current.id, sentCount, failed, suppressedCount, totalRecipients, pages },
  }, userId);

  return res.json({ success: true, resumable: true, campaign: final, summary: { totalRecipients, sentCount, suppressedCount, failedCount: failed, processed, pages } });
});
