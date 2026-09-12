import { Router, Request, Response } from 'express';
import { db } from '../store.js';
import { optionalAuth } from '../middleware/auth.js';
import { convexService } from '../services/ConvexService.js';

export const logsRouter = Router();

logsRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  const { service, severity, search, limit = '100' } = req.query;
  const numLimit = Math.min(Math.max(parseInt(limit as string, 10) || 100, 1), 500);
  const userId = req.user?.id || await convexService.getDefaultUserId();
  let list = await convexService.getLogs(userId, numLimit);

  if (service && typeof service === 'string' && service !== 'ALL') list = list.filter((l) => l.service === service);
  if (severity && typeof severity === 'string' && severity !== 'ALL') list = list.filter((l) => l.severity === severity);
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter((l) => l.event.toLowerCase().includes(q) || l.response.toLowerCase().includes(q) || Boolean(l.messageId?.toLowerCase().includes(q)));
  }
  res.json({ logs: list.slice(0, numLimit), total: list.length });
});
