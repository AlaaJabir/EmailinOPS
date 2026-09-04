import { Router, Request, Response } from 'express';
import { Campaign, Contact } from '../../src/types.js';
import { optionalAuth } from '../middleware/auth.js';
import { db } from '../store.js';
import { supabaseService } from '../services/SupabaseService.js';
import { suppressionService } from '../services/SuppressionService.js';
import { personalizationService } from '../services/PersonalizationService.js';
import { kumoMtaService } from '../services/KumoMtaService.js';

export const campaignsRouter = Router();

campaignsRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  if (req.user && supabaseService.isConfigured) {
    const campaigns = await supabaseService.getCampaigns(req.user.id);
    return res.json({ campaigns });
  }
  res.json({ campaigns: db.campaigns });
});

campaignsRouter.get('/:id', (req: Request, res: Response) => {
  const campaign = db.campaigns.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const messages = db.messages.filter((m) => m.campaignId === campaign.id);
  return res.json({ campaign, messages });
});

campaignsRouter.post('/', (req: Request, res: Response) => {
  const {
    name,
    senderId,
    listId,
    templateId,
    subject,
    htmlBody,
    plainText,
    scheduledAt,
    status,
    trackOpens,
    trackClicks,
  } = req.body;

  if (!name || !senderId || !subject) {
    return res.status(400).json({ error: 'Name, sender, and subject are required' });
  }

  const sender = db.senders.find((s) => s.id === senderId) || db.senders[0];
  if (!sender) return res.status(400).json({ error: 'No sender identity is configured' });
  const list = db.contactLists.find((l) => l.id === listId);

  const newCampaign: Campaign = {
    id: `cmp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name,
    senderId: sender.id,
    senderName: sender.name,
    fromEmail: sender.fromEmail,
    listId: list?.id,
    listName: list?.name,
    templateId,
    subject,
    htmlBody: htmlBody || '<p>Default campaign content</p>',
    plainText: plainText || 'Default campaign content',
    status: (status as any) || 'DRAFT',
    scheduledAt,
    totalRecipients: list?.memberCount || 100,
    sentCount: 0,
    deliveredCount: 0,
    bouncedCount: 0,
    complaintCount: 0,
    openCount: 0,
    clickCount: 0,
    trackOpens: trackOpens !== false,
    trackClicks: trackClicks !== false,
    createdAt: new Date().toISOString(),
  };

  db.campaigns.unshift(newCampaign);
  db.logs.unshift({
    id: `log_cmp_${Date.now()}`,
    timestamp: new Date().toISOString(),
    service: 'Application',
    event: 'CAMPAIGN_CREATED',
    severity: 'INFO',
    response: `Created campaign "${name}" target audience: ${list?.name || 'Manual'}`,
    details: newCampaign,
  });

  return res.json({ success: true, campaign: newCampaign });
});

campaignsRouter.patch('/:id/status', (req: Request, res: Response) => {
  const campaign = db.campaigns.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const { status } = req.body;
  campaign.status = status;
  if (status === 'SENDING' && !campaign.startedAt) campaign.startedAt = new Date().toISOString();
  if (status === 'COMPLETED') campaign.completedAt = new Date().toISOString();

  return res.json({ success: true, campaign });
});

campaignsRouter.post('/:id/send', optionalAuth, async (req: Request, res: Response) => {
  const campaign = db.campaigns.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const sender = db.senders.find((s) => s.id === campaign.senderId) || db.senders[0];
  if (!sender) return res.status(400).json({ error: 'No sender identity is configured' });
  const senderDomain = sender.fromEmail.split('@')[1] || 'transact.acme-corp.io';
  const baseUrl = personalizationService.getBaseUrl(req.get('host'));

  let audienceContacts: Contact[] = [];
  if (campaign.listId) {
    const listMemberIds = db.listMemberships.filter((m) => m.listId === campaign.listId).map((m) => m.contactId);
    if (listMemberIds.length > 0) audienceContacts = db.contacts.filter((c) => listMemberIds.includes(c.id));
  }
  if (audienceContacts.length === 0) {
    audienceContacts = req.user && supabaseService.isConfigured
      ? await supabaseService.getContacts(req.user.id)
      : [...db.contacts];
  }

  const candidates = audienceContacts.filter(
    (c) => c.status !== 'UNSUBSCRIBED' && c.status !== 'BOUNCED' && c.status !== 'COMPLAINED'
  );

  campaign.status = 'SENDING';
  campaign.startedAt = new Date().toISOString();
  campaign.totalRecipients = candidates.length;

  const results: Array<{ email: string; status: 'SENT' | 'SUPPRESSED' | 'FAILED'; messageId?: string; reason?: string }> = [];
  let sentCount = 0;
  let suppressedCount = 0;
  let failedCount = 0;

  for (const contact of candidates) {
    const recipientEmail = contact.email.toLowerCase().trim();
    const suppressionCheck = suppressionService.isSuppressed(recipientEmail);
    if (suppressionCheck.suppressed) {
      suppressedCount++;
      results.push({ email: recipientEmail, status: 'SUPPRESSED', reason: `${suppressionCheck.record?.type}: ${suppressionCheck.record?.reason}` });
      continue;
    }

    try {
      const internalId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const { unsubscribeUrl } = await personalizationService.generateUnsubscribeToken({
        email: recipientEmail,
        contactId: contact.id,
        messageId: internalId,
        campaignId: campaign.id,
        userId: req.user?.id,
        baseUrl,
      });

      let personalizedHtml = personalizationService.personalizeContent(campaign.htmlBody || '', {
        contact,
        email: recipientEmail,
        unsubscribeUrl,
      });
      const personalizedSubject = personalizationService.personalizeContent(campaign.subject, {
        contact,
        email: recipientEmail,
        unsubscribeUrl,
      });
      const personalizedPlainText = campaign.plainText
        ? personalizationService.personalizeContent(campaign.plainText, { contact, email: recipientEmail, unsubscribeUrl })
        : undefined;

      if (campaign.trackClicks && personalizedHtml) {
        personalizedHtml = personalizationService.rewriteLinksForClickTracking(personalizedHtml, internalId, baseUrl);
      }
      if (campaign.trackOpens && personalizedHtml) {
        personalizedHtml = personalizationService.injectOpenTrackingPixel(personalizedHtml, internalId, baseUrl);
      }

      const unsubHeaders = personalizationService.generateUnsubscribeHeaders(unsubscribeUrl, senderDomain);
      await kumoMtaService.submitEmail({
        internalId,
        contactId: contact.id,
        fromName: sender.name,
        fromEmail: sender.fromEmail,
        replyTo: sender.replyTo,
        to: recipientEmail,
        subject: personalizedSubject,
        htmlBody: personalizedHtml,
        plainText: personalizedPlainText,
        customHeaders: unsubHeaders,
        campaignId: campaign.id,
        userId: req.user?.id,
      });

      sentCount++;
      results.push({ email: recipientEmail, status: 'SENT', messageId: internalId });
    } catch (err: any) {
      failedCount++;
      results.push({ email: recipientEmail, status: 'FAILED', reason: err.message });
    }
  }

  campaign.sentCount = sentCount;
  campaign.completedAt = new Date().toISOString();
  campaign.status = failedCount > 0 && sentCount === 0 ? 'FAILED' : 'COMPLETED';

  db.logs.unshift({
    id: `log_cmp_exec_${Date.now()}`,
    timestamp: new Date().toISOString(),
    service: 'Application',
    event: 'CAMPAIGN_DISPATCH_COMPLETED',
    severity: 'INFO',
    response: `Campaign ${campaign.name} dispatch complete: ${sentCount} sent, ${suppressedCount} suppressed, ${failedCount} failed`,
    details: { campaignId: campaign.id, sentCount, suppressedCount, failedCount },
  });

  return res.json({
    success: true,
    campaign,
    summary: { totalCandidates: candidates.length, sentCount, suppressedCount, failedCount },
    results,
  });
});
