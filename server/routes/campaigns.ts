import { Router, Request, Response } from 'express';
import { db } from '../store.js';
import { Campaign, Contact } from '../../src/types.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { supabaseService } from '../services/SupabaseService.js';
import { suppressionService } from '../services/SuppressionService.js';
import { personalizationService } from '../services/PersonalizationService.js';
import { kumoMtaService } from '../services/KumoMtaService.js';

export const campaignsRouter = Router();

// GET /api/campaigns - List all campaigns (scoped to user)
campaignsRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  if (req.user && supabaseService.isConfigured) {
    const campaigns = await supabaseService.getCampaigns(req.user.id);
    return res.json({ campaigns });
  }
  res.json({ campaigns: db.campaigns });
});

// GET /api/campaigns/:id - Get specific campaign with recipient stats
campaignsRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const campaign = db.campaigns.find((c) => c.id === id);

  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  // Find sample messages for this campaign
  const messages = db.messages.filter((m) => m.campaignId === campaign.id);

  res.json({
    campaign,
    messages,
  });
});

// POST /api/campaigns - Create a new campaign
campaignsRouter.post('/', (req: Request, res: Response) => {
  const { name, senderId, listId, templateId, subject, htmlBody, plainText, scheduledAt, status } = req.body;

  if (!name || !senderId || !subject) {
    return res.status(400).json({ error: 'Name, sender, and subject are required' });
  }

  const sender = db.senders.find((s) => s.id === senderId) || db.senders[0];
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

  res.json({ success: true, campaign: newCampaign });
});

// PATCH /api/campaigns/:id/status - Start, Pause, Resume campaign
campaignsRouter.patch('/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const campaign = db.campaigns.find((c) => c.id === id);
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  campaign.status = status;
  if (status === 'SENDING' && !campaign.startedAt) {
    campaign.startedAt = new Date().toISOString();
  }
  if (status === 'COMPLETED') {
    campaign.completedAt = new Date().toISOString();
  }

  db.logs.unshift({
    id: `log_cmp_status_${Date.now()}`,
    timestamp: new Date().toISOString(),
    service: 'Application',
    event: 'CAMPAIGN_STATUS_CHANGED',
    severity: 'INFO',
    response: `Campaign ${campaign.name} status transitioned to ${status}`,
  });

  res.json({ success: true, campaign });
});

// POST /api/campaigns/:id/send - Execute real personalized broadcast to campaign audience
campaignsRouter.post('/:id/send', optionalAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const campaign = db.campaigns.find((c) => c.id === id);

  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  // 1. Resolve sender
  const sender = db.senders.find((s) => s.id === campaign.senderId) || db.senders[0];
  const senderDomain = sender.fromEmail.split('@')[1] || 'transact.acme-corp.io';
  const baseUrl = personalizationService.getBaseUrl(req.get('host'));

  // 2. Resolve audience contacts
  let audienceContacts: Contact[] = [];
  if (campaign.listId) {
    const listMemberIds = db.listMemberships
      .filter((m) => m.listId === campaign.listId)
      .map((m) => m.contactId);

    if (listMemberIds.length > 0) {
      audienceContacts = db.contacts.filter((c) => listMemberIds.includes(c.id));
    }
  }

  // Fallback to all active contacts if list has no explicit memberships
  if (audienceContacts.length === 0) {
    if (req.user && supabaseService.isConfigured) {
      audienceContacts = await supabaseService.getContacts(req.user.id);
    } else {
      audienceContacts = [...db.contacts];
    }
  }

  // Filter out any contacts already flagged as UNSUBSCRIBED/BOUNCED in contact table
  const candidates = audienceContacts.filter(
    (c) => c.status !== 'UNSUBSCRIBED' && c.status !== 'BOUNCED' && c.status !== 'COMPLAINED'
  );

  campaign.status = 'SENDING';
  campaign.startedAt = new Date().toISOString();
  campaign.totalRecipients = candidates.length;

  const results: Array<{
    email: string;
    status: 'SENT' | 'SUPPRESSED' | 'FAILED';
    messageId?: string;
    reason?: string;
  }> = [];

  let sentCount = 0;
  let suppressedCount = 0;
  let failedCount = 0;

  for (const contact of candidates) {
    const recipientEmail = contact.email.toLowerCase().trim();

    // 3. Suppression check immediately before send
    const suppressionCheck = suppressionService.isSuppressed(recipientEmail);
    if (suppressionCheck.suppressed) {
      suppressedCount++;
      results.push({
        email: recipientEmail,
        status: 'SUPPRESSED',
        reason: `${suppressionCheck.record?.type}: ${suppressionCheck.record?.reason}`,
      });
      continue;
    }

    try {
      // 4. Generate unique message ID & unsubscribe token for each individual recipient
      const internalId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const { unsubscribeUrl } = await personalizationService.generateUnsubscribeToken({
        email: recipientEmail,
        contactId: contact.id,
        messageId: internalId,
        campaignId: campaign.id,
        userId: req.user?.id,
        baseUrl,
      });

      // 5. Replace personalization variables (first_name, last_name, company, email, unsubscribe_url)
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
        ? personalizationService.personalizeContent(campaign.plainText, {
            contact,
            email: recipientEmail,
            unsubscribeUrl,
          })
        : undefined;

      // 6. Rewrite links for click tracking if enabled
      const clickTracking = db.settings?.tracking?.enableClickTracking ?? true;
      if (clickTracking && personalizedHtml) {
        personalizedHtml = personalizationService.rewriteLinksForClickTracking(
          personalizedHtml,
          internalId,
          baseUrl
        );
      }

      // 7. Inject 1x1 transparent open tracking pixel if enabled
      const openTracking = db.settings?.tracking?.enableOpenTracking ?? true;
      if (openTracking && personalizedHtml) {
        personalizedHtml = personalizationService.injectOpenTrackingPixel(
          personalizedHtml,
          internalId,
          baseUrl
        );
      }

      // 8. Generate RFC 8058 List-Unsubscribe and List-Unsubscribe-Post headers
      const unsubHeaders = personalizationService.generateUnsubscribeHeaders(
        unsubscribeUrl,
        senderDomain
      );

      // 9. Submit personalized email to KumoMTA
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
      results.push({
        email: recipientEmail,
        status: 'SENT',
        messageId: internalId,
      });
    } catch (err: any) {
      failedCount++;
      results.push({
        email: recipientEmail,
        status: 'FAILED',
        reason: err.message,
      });
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

  res.json({
    success: true,
    campaign,
    summary: {
      totalCandidates: candidates.length,
      sentCount,
      suppressedCount,
      failedCount,
    },
    results,
  });
});

