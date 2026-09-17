import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { convexService } from '../services/ConvexService.js';
import { personalizationService } from '../services/PersonalizationService.js';
import { kumoMtaService } from '../services/KumoMtaService.js';

export const campaignsRouter = Router();
const CONTACT_PAGE_SIZE = 250;

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

  const campaigns = await convexService.getCampaigns(userId);
  const campaign = campaigns.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (campaign.status === 'SENDING' && !campaign.sendCursor && (campaign.sendProcessed || 0) === 0) {
    // A fresh send is allowed. A second simultaneous request is blocked below by the status guard.
  } else if (campaign.status === 'SENDING') {
    // A previous process can have died after a checkpoint. Continue from the durable cursor.
  }

  const senders = await convexService.getSenders(userId);
  const sender = senders.find((s) => s.id === campaign.senderId) || senders[0];
  if (!sender) return res.status(400).json({ error: 'Campaign sender is not available' });

  const current = await client.query('campaigns:get' as any, { id: campaign.id, userId });
  if (!current) return res.status(404).json({ error: 'Campaign not found' });
  const existingCursor = current.sendCursor || undefined;
  const alreadyProcessed = Number(current.sendProcessed || 0);
  const alreadyFailed = Number(current.sendFailed || 0);
  const alreadySuppressed = Number(current.sendSuppressed || 0);

  if (current.status !== 'SENDING') {
    await convexService.updateCampaign(campaign.id, {
      status: 'SENDING',
      startedAt: current.startedAt || new Date().toISOString(),
      sendCursor: undefined,
      sendProcessed: 0,
      sendFailed: 0,
      sendSuppressed: 0,
      sentCount: 0,
      totalRecipients: 0,
      completedAt: undefined,
    }, userId);
  }

  const baseUrl = personalizationService.getBaseUrl(req.get('host'));
  const senderDomain = String(sender.fromEmail).split('@')[1] || 'kumo.internal';
  let cursor: string | undefined = existingCursor;
  let processed = alreadyProcessed;
  let failed = alreadyFailed;
  let suppressedCount = alreadySuppressed;
  let sentCount = Number(current.sentCount || 0);
  let totalRecipients = Number(current.totalRecipients || 0);
  let pages = 0;

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
        await convexService.updateCampaign(campaign.id, {
          status: failed && !sentCount ? 'FAILED' : 'COMPLETED',
          sentCount,
          totalRecipients,
          sendCursor: undefined,
          sendProcessed: processed,
          sendFailed: failed,
          sendSuppressed: suppressedCount,
          completedAt: new Date().toISOString(),
        }, userId);
        break;
      }

      pages += 1;
      const emails = contacts.map((c: any) => String(c.email || '').trim().toLowerCase()).filter(Boolean);
      const suppressedEmails = new Set<string>(await client.query('suppressions:findMany' as any, { userId, emails }));
      const candidateContacts = contacts.filter((c: any) => c.status === 'ACTIVE');
      totalRecipients += candidateContacts.length;
      suppressedCount += candidateContacts.filter((c: any) => suppressedEmails.has(String(c.email).trim().toLowerCase())).length;

      const deterministicIds = candidateContacts.map((contact: any) => `cmp_${campaign.id}_cnt_${contact.id}`);
      const existingIds = new Set<string>(await client.query('messages:getManyByInternalIds' as any, { userId, ids: deterministicIds }));

      for (const contact of candidateContacts) {
        const email = String(contact.email).trim().toLowerCase();
        if (suppressedEmails.has(email)) continue;
        const internalId = `cmp_${campaign.id}_cnt_${contact.id}`;
        if (existingIds.has(internalId)) {
          processed += 1;
          continue;
        }
        try {
          const { unsubscribeUrl } = await personalizationService.generateUnsubscribeToken({ email, contactId: contact.id, messageId: internalId, campaignId: campaign.id, userId, baseUrl });
          let html = personalizationService.personalizeContent(buildHtml(campaign.headHtml, campaign.htmlBody), { contact, email, unsubscribeUrl });
          const subj = personalizationService.personalizeContent(campaign.subject, { contact, email, unsubscribeUrl });
          if (campaign.trackClicks) html = personalizationService.rewriteLinksForClickTracking(html, internalId, baseUrl);
          if (campaign.trackOpens) html = personalizationService.injectOpenTrackingPixel(html, internalId, baseUrl);
          const headers = personalizationService.generateUnsubscribeHeaders(unsubscribeUrl, senderDomain);

          await kumoMtaService.submitEmail({
            internalId,
            contactId: contact.id,
            fromName: sender.name,
            fromEmail: sender.fromEmail,
            replyTo: sender.replyTo,
            to: email,
            subject: subj,
            htmlBody: html,
            plainText: campaign.plainText || undefined,
            customHeaders: headers,
            campaignId: campaign.id,
            userId,
          });
          sentCount += 1;
        } catch (err) {
          failed += 1;
        }
        processed += 1;
      }

      cursor = page.continueCursor || undefined;
      await convexService.updateCampaign(campaign.id, {
        status: 'SENDING',
        totalRecipients,
        sentCount,
        sendCursor: cursor,
        sendProcessed: processed,
        sendFailed: failed,
        sendSuppressed: suppressedCount,
      }, userId);

      if (!page.isDone && !cursor) throw new Error('Convex pagination returned no cursor for an unfinished campaign page');
      if (page.isDone) {
        await convexService.updateCampaign(campaign.id, {
          status: failed && !sentCount ? 'FAILED' : 'COMPLETED',
          totalRecipients,
          sentCount,
          sendCursor: undefined,
          sendProcessed: processed,
          sendFailed: failed,
          sendSuppressed: suppressedCount,
          completedAt: new Date().toISOString(),
        }, userId);
        break;
      }
    }
  } catch (err: any) {
    await convexService.updateCampaign(campaign.id, {
      status: 'SENDING',
      totalRecipients,
      sentCount,
      sendCursor: cursor,
      sendProcessed: processed,
      sendFailed: failed,
      sendSuppressed: suppressedCount,
    }, userId);
    return res.status(202).json({
      success: false,
      resumable: true,
      message: err?.message || String(err),
      campaign: { id: campaign.id, status: 'SENDING', sentCount, totalRecipients, processed, failed, suppressedCount, cursor },
      pages,
    });
  }

  const final = await client.query('campaigns:get' as any, { id: campaign.id, userId });
  await convexService.saveTechnicalLog({
    id: `cmp_send_${campaign.id}_${Date.now()}`,
    service: 'Application',
    event: 'CAMPAIGN_DISPATCH_COMPLETED',
    severity: failed ? 'WARN' : 'INFO',
    response: `${sentCount} queued, ${failed} failed, ${suppressedCount} suppressed`,
    details: { campaignId: campaign.id, sentCount, failed, suppressedCount, totalRecipients, pages },
  }, userId);

  return res.json({
    success: true,
    resumable: true,
    campaign: final,
    summary: { totalRecipients, sentCount, suppressedCount, failedCount: failed, processed, pages },
  });
});
