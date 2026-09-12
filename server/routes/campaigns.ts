import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { convexService } from '../services/ConvexService.js';
import { personalizationService } from '../services/PersonalizationService.js';
import { kumoMtaService } from '../services/KumoMtaService.js';
import { db } from '../store.js';

export const campaignsRouter = Router();

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
  const {
    name,
    senderId,
    listId,
    templateId,
    subject,
    preheader,
    headHtml,
    htmlBody,
    plainText,
    scheduledAt,
    status,
    trackOpens,
    trackClicks,
    fromName,
    fromEmail,
    replyTo,
    customHeaders,
    isMarketing,
  } = req.body;

  if (!name || !senderId || !subject) {
    return res.status(400).json({ error: 'Name, sender, and subject are required' });
  }

  const senders = await convexService.getSenders(userId);
  const sender = senders.find((s) => s.id === senderId) || senders[0];
  if (!sender) return res.status(400).json({ error: 'Sender not found' });

  const created = await convexService.saveCampaign(
    {
      name: String(name).trim(),
      senderId: sender.id,
      listId: listId || undefined,
      subject: String(subject),
      headHtml: headHtml || '',
      htmlBody: htmlBody || '',
      plainText: plainText || undefined,
      status: status || 'DRAFT',
      totalRecipients: 0,
      sentCount: 0,
      deliveredCount: 0,
      bouncedCount: 0,
      complaintCount: 0,
      openCount: 0,
      clickCount: 0,
      trackOpens: trackOpens !== false,
      trackClicks: trackClicks !== false,
      startedAt: scheduledAt || undefined,
    },
    userId
  );

  await convexService.saveTechnicalLog(
    {
      id: `cmp_${created.id}`,
      service: 'Application',
      event: 'CAMPAIGN_CREATED',
      severity: 'INFO',
      response: `Campaign ${created.name} created`,
      details: { campaignId: created.id },
    },
    userId
  );

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
  const campaigns = await convexService.getCampaigns(userId);
  const campaign = campaigns.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (campaign.status === 'SENDING') return res.status(409).json({ error: 'Campaign is already sending' });

  const senders = await convexService.getSenders(userId);
  const sender = senders.find((s) => s.id === campaign.senderId) || senders[0];
  if (!sender) return res.status(400).json({ error: 'Campaign sender is not available' });

  let contacts = await convexService.getContacts(userId, campaign.listId);
  const suppressions = await convexService.getSuppressions(userId);
  const suppressedSet = new Set(suppressions.map((s) => s.email.toLowerCase()));

  const candidateCount = contacts.length;
  contacts = contacts.filter((x) => x.status === 'ACTIVE' && !suppressedSet.has(x.email.toLowerCase()));
  const suppressedCount = candidateCount - contacts.length;

  await convexService.updateCampaign(
    campaign.id,
    {
      status: 'SENDING',
      startedAt: new Date().toISOString(),
      totalRecipients: contacts.length,
    },
    userId
  );

  const baseUrl = personalizationService.getBaseUrl(req.get('host'));
  const senderDomain = String(sender.fromEmail).split('@')[1] || 'kumo.internal';
  const results: any[] = [];
  let sentCount = 0;
  let failedCount = 0;

  for (const contact of contacts) {
    const email = String(contact.email).trim().toLowerCase();
    try {
      const internalId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const { unsubscribeUrl } = await personalizationService.generateUnsubscribeToken({
        email,
        contactId: contact.id,
        messageId: internalId,
        campaignId: campaign.id,
        userId,
        baseUrl,
      });

      let html = personalizationService.personalizeContent(
        buildHtml(campaign.headHtml, campaign.htmlBody),
        { contact, email, unsubscribeUrl }
      );
      const subj = personalizationService.personalizeContent(campaign.subject, {
        contact,
        email,
        unsubscribeUrl,
      });

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

      sentCount++;
      results.push({ email, status: 'QUEUED', messageId: internalId });
    } catch (err: any) {
      failedCount++;
      results.push({ email, status: 'FAILED', reason: err?.message || String(err) });
    }
  }

  const finalStatus = failedCount && !sentCount ? 'FAILED' : 'COMPLETED';
  await convexService.updateCampaign(
    campaign.id,
    {
      status: finalStatus,
      sentCount,
      completedAt: new Date().toISOString(),
    },
    userId
  );

  await convexService.saveTechnicalLog(
    {
      id: `cmp_send_${campaign.id}_${Date.now()}`,
      service: 'Application',
      event: 'CAMPAIGN_DISPATCH_COMPLETED',
      severity: failedCount ? 'WARN' : 'INFO',
      response: `${sentCount} queued, ${failedCount} failed, ${suppressedCount} suppressed`,
      details: { campaignId: campaign.id, sentCount, failedCount, suppressedCount, recipientCount: contacts.length },
    },
    userId
  );

  return res.json({
    success: true,
    campaign: { ...campaign, status: finalStatus, sentCount },
    summary: { totalCandidates: candidateCount, sentCount, suppressedCount, failedCount },
    results,
  });
});
