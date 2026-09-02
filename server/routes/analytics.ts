import { Router, Request, Response } from 'express';
import { db } from '../store.js';

export const analyticsRouter = Router();

// GET /api/analytics - Multidimensional metrics and charts
analyticsRouter.get('/', (req: Request, res: Response) => {
  const { dateRange = '7d', senderId, campaignId, domain } = req.query;

  const stats = db.getDashboardStats();

  // Calculate domain performance breakdown
  const domainBreakdown = [
    { domain: 'gmail.com', volume: 64200, delivered: 63800, bounced: 350, openRate: 44.2, clickRate: 18.5 },
    { domain: 'yahoo.com / aol', volume: 28900, delivered: 28400, bounced: 410, openRate: 36.8, clickRate: 14.1 },
    { domain: 'outlook.com / hotmail', volume: 31500, delivered: 31200, bounced: 240, openRate: 39.5, clickRate: 16.2 },
    { domain: 'corporate / custom domains', volume: 20890, delivered: 20680, bounced: 180, openRate: 48.9, clickRate: 22.4 },
  ];

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
