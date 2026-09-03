import { Router, Request, Response } from 'express';
import { db } from '../store.js';
import { Campaign } from '../../src/types.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { supabaseService } from '../services/SupabaseService.js';

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
