import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { convexService } from '../services/ConvexService.js';
import { db } from '../store.js';

export const analyticsRouter = Router();

analyticsRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  const userId = req.user?.id || (await convexService.getDefaultUserId());
  const { dateRange = '7d', senderId, campaignId, domain } = req.query;
  const days = dateRange === '24h' ? 1 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 7;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  let messages = await convexService.getMessages(userId);
  if (!messages || !messages.length) {
    messages = [...db.messages];
  }

  let filtered = messages.filter((m: any) => String(m.createdAt || m.created_at || '') >= since);
  if (senderId && typeof senderId === 'string') {
    filtered = filtered.filter((m: any) => m.senderId === senderId || m.sender_id === senderId);
  }
  if (campaignId && typeof campaignId === 'string') {
    filtered = filtered.filter((m: any) => m.campaignId === campaignId || m.campaign_id === campaignId);
  }
  if (domain && typeof domain === 'string') {
    filtered = filtered.filter(
      (m: any) => String(m.toEmail || m.to_email || '').split('@')[1]?.toLowerCase() === domain.toLowerCase()
    );
  }

  const events = [...db.messageEvents];
  const count = (type: string) => events.filter((e) => e.eventType === type).length;
  const unique = (type: string) => new Set(events.filter((e) => e.eventType === type).map((e) => e.messageId)).size;

  const totalSent = filtered.length;
  const delivered = filtered.filter((m: any) => m.status === 'DELIVERED' || m.status === 'SENT' || m.deliveredAt).length;
  const bounced = filtered.filter((m: any) => m.status === 'BOUNCED' || m.bouncedAt).length;
  const failed = filtered.filter((m: any) => m.status === 'FAILED').length;
  const complaints = count('COMPLAINED');
  const opens = count('OPENED');
  const clicks = count('CLICKED');
  const uniqueOpens = unique('OPENED');
  const uniqueClicks = unique('CLICKED');
  const deliveryRate = totalSent ? (delivered / totalSent) * 100 : 0;
  const bounceRate = totalSent ? (bounced / totalSent) * 100 : 0;
  const openRate = delivered ? (uniqueOpens / delivered) * 100 : 0;
  const clickRate = delivered ? (uniqueClicks / delivered) * 100 : 0;

  const daily = new Map<string, any>();
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10);
    daily.set(d, { date: d, sent: 0, delivered: 0, bounced: 0, opens: 0, clicks: 0 });
  }
  for (const m of filtered) {
    const d = String(m.createdAt || (m as any).created_at || '').slice(0, 10);
    if (daily.has(d)) {
      daily.get(d).sent++;
      if (m.status === 'DELIVERED' || m.status === 'SENT' || (m as any).deliveredAt) daily.get(d).delivered++;
      if (m.status === 'BOUNCED' || (m as any).bouncedAt) daily.get(d).bounced++;
    }
  }
  for (const e of events) {
    const d = String(e.timestamp).slice(0, 10);
    if (daily.has(d)) {
      if (e.eventType === 'OPENED') daily.get(d).opens++;
      if (e.eventType === 'CLICKED') daily.get(d).clicks++;
    }
  }

  const domains = new Map<string, any>();
  for (const m of filtered) {
    const d = String(m.toEmail || (m as any).to_email || '').split('@')[1]?.toLowerCase() || 'unknown';
    const x = domains.get(d) || { domain: d, volume: 0, delivered: 0, bounced: 0, openRate: 0, clickRate: 0 };
    x.volume++;
    if (m.status === 'DELIVERED' || m.status === 'SENT' || (m as any).deliveredAt) x.delivered++;
    if (m.status === 'BOUNCED' || (m as any).bouncedAt) x.bounced++;
    domains.set(d, x);
  }

  const senders = await convexService.getSenders(userId);
  const senderComparison = senders.map((s: any) => {
    const ms = filtered.filter((m: any) => m.senderId === s.id || m.sender_id === s.id);
    const t = ms.length || 1;
    const del = ms.filter((m: any) => m.status === 'DELIVERED' || m.status === 'SENT' || m.deliveredAt).length;
    const bnc = ms.filter((m: any) => m.status === 'BOUNCED' || m.bouncedAt).length;
    return {
      id: s.id,
      name: s.name,
      email: s.fromEmail || s.from_email,
      sent: ms.length,
      delivered: del,
      bounced: bnc,
      complaints: 0,
      deliveryRate: Number(((del / t) * 100).toFixed(2)),
      bounceRate: Number(((bnc / t) * 100).toFixed(2)),
    };
  });

  const campaigns = await convexService.getCampaigns(userId);
  const campaignComparison = campaigns.map((c: any) => {
    const ms = filtered.filter((m: any) => m.campaignId === c.id || m.campaign_id === c.id);
    const del = ms.filter((m: any) => m.status === 'DELIVERED' || m.status === 'SENT' || m.deliveredAt).length;
    const bnc = ms.filter((m: any) => m.status === 'BOUNCED' || m.bouncedAt).length;
    return {
      id: c.id,
      name: c.name,
      sender: c.senderId,
      status: c.status,
      sent: ms.length,
      delivered: del,
      bounced: bnc,
      opens: c.openCount || 0,
      clicks: c.clickCount || 0,
      deliveryRate: Number(((del / (ms.length || 1)) * 100).toFixed(1)),
      openRate: Number((((c.openCount || 0) / (del || 1)) * 100).toFixed(1)),
      clickRate: Number((((c.clickCount || 0) / ((c.openCount || 1))) * 100).toFixed(1)),
    };
  });

  return res.json({
    kpis: {
      totalSent,
      delivered,
      bounced,
      failed,
      complaints,
      opens,
      clicks,
      uniqueOpens,
      uniqueClicks,
      deliveryRate: Number(deliveryRate.toFixed(2)),
      bounceRate: Number(bounceRate.toFixed(2)),
      openRate: Number(openRate.toFixed(2)),
      clickRate: Number(clickRate.toFixed(2)),
      ctr: Number(clickRate.toFixed(2)),
      ctor: Number((uniqueOpens ? (uniqueClicks / uniqueOpens) * 100 : 0).toFixed(2)),
    },
    timeseries: [...daily.values()],
    hourlyActivity: [],
    domainBreakdown: [...domains.values()],
    senderComparison,
    campaignComparison,
  });
});
