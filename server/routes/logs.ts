import { Router, Request, Response } from 'express';
import { db } from '../store.js';
import { optionalAuth } from '../middleware/auth.js';
import { supabaseService } from '../services/SupabaseService.js';

export const logsRouter = Router();

logsRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  const { service, severity, search, limit = '100' } = req.query;
  const numLimit = Math.min(Math.max(parseInt(limit as string, 10) || 100, 1), 500);
  let list = req.user && supabaseService.isConfigured
    ? await supabaseService.getLogs(req.user.id, numLimit)
    : [...db.logs];

  if (service && typeof service === 'string' && service !== 'ALL') list = list.filter((l) => l.service === service);
  if (severity && typeof severity === 'string' && severity !== 'ALL') list = list.filter((l) => l.severity === severity);
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter((l) => l.event.toLowerCase().includes(q) || l.response.toLowerCase().includes(q) || Boolean(l.messageId?.toLowerCase().includes(q)));
  }
  res.json({ logs: list.slice(0, numLimit), total: list.length });
});
