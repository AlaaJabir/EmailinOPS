import { Router, Request, Response } from 'express';
import { db } from '../store.js';

export const analyticsRouter = Router();

// GET /api/analytics - Multidimensional metrics and charts
analyticsRouter.get('/', (req: Request, res: Response) => {
  const { dateRange = '7d', senderId, campaignId, domain } = req.query;

  const stats = db.getDashboardStats();

  // Calculate real domain performance breakdown from actual messages
  const domainCounts = new Map<string, { volume: number; delivered: number; bounced: number; failed: number }>();
  for (const msg of db.messages) {
    const domainName = msg.toEmail.split('@')[1]?.toLowerCase() || 'other';
    const current = domainCounts.get(domainName) || { volume: 0, delivered: 0, bounced: 0, failed: 0 };
    current.volume += 1;
    if (msg.status === 'DELIVERED') current.delivered += 1;
    else if (msg.status === 'BOUNCED') current.bounced += 1;
    else if (msg.status === 'FAILED') current.failed += 1;
    domainCounts.set(domainName, current);
  }

  const domainBreakdown = Array.from(domainCounts.entries()).map(([domain, data]) => ({
    domain,
    volume: data.volume,
    delivered: data.delivered,
    bounced: data.bounced,
    openRate: 0,
    clickRate: 0,
  }));

  // Sender Comparison Breakdown
  const senderComparison = db.senders.map((s) => {
    const total = s.sentCount || 1;
    return {
      id: s.id,
      name: s.name,
      email: s.fromEmail,
      domain: s.domainName,
      sent: s.sentCount,
      delivered: s.deliveredCount,
      bounced: s.bouncedCount,
      complaints: s.complaintCount,
      deliveryRate: Number(((s.deliveredCount / total) * 100).toFixed(2)),
      bounceRate: Number(((s.bouncedCount / total) * 100).toFixed(2)),
      complaintRate: Number(((s.complaintCount / total) * 100).toFixed(3)),
    };
  });

  // Campaign Comparison Breakdown
  const campaignComparison = db.campaigns.map((c) => {
    const total = c.sentCount || 1;
    const delivered = c.deliveredCount || 1;
    return {
      id: c.id,
      name: c.name,
      sender: c.senderName,
      status: c.status,
      sent: c.sentCount,
      delivered: c.deliveredCount,
      bounced: c.bouncedCount,
      opens: c.openCount,
      clicks: c.clickCount,
      deliveryRate: Number(((c.deliveredCount / total) * 100).toFixed(1)),
      openRate: Number(((c.openCount / delivered) * 100).toFixed(1)),
      clickRate: Number(((c.clickCount / (c.openCount || 1)) * 100).toFixed(1)),
    };
  });

  res.json({
    kpis: {
      totalSent: stats.totalSent,
      delivered: stats.delivered,
      bounced: stats.bounced,
      failed: stats.failed,
      complaints: stats.complaints,
      opens: stats.opens,
      clicks: stats.clicks,
      deliveryRate: stats.deliveryRate,
      bounceRate: stats.bounceRate,
      openRate: stats.openRate,
      clickRate: stats.clickRate,
    },
    timeseries: stats.timeseries,
    hourlyActivity: stats.hourlyActivity,
    domainBreakdown,
    senderComparison,
    campaignComparison,
  });
});
