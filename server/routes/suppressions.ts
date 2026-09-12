import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { convexService } from '../services/ConvexService.js';

export const suppressionsRouter = Router();

suppressionsRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const { search, type } = req.query;
  let list = await convexService.getSuppressions(userId);

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter((s) => s.email.toLowerCase().includes(q) || s.reason.toLowerCase().includes(q));
  }
  if (type && typeof type === 'string' && type !== 'ALL') {
    list = list.filter((s) => s.type === type);
  }
  return res.json({ suppressions: list, total: list.length });
});

suppressionsRouter.post('/', optionalAuth, async (req: Request, res: Response) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const email = String(req.body.email || '').trim().toLowerCase();
  const type = req.body.type || 'MANUAL';
  const reason = req.body.reason || 'Manual suppression';
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email address is required' });

  try {
    const saved = await convexService.upsertSuppression(userId, email, type, reason, 'manual');
    return res.status(201).json({ success: true, suppression: saved });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || 'Failed to save suppression' });
  }
});

suppressionsRouter.delete('/:id', optionalAuth, async (req: Request, res: Response) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  await convexService.deleteSuppression(req.params.id, userId);
  return res.json({ success: true, message: 'Suppression record deleted successfully' });
});

suppressionsRouter.post('/import', optionalAuth, async (req: Request, res: Response) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const entries = req.body.entries;
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'Valid entries array required' });

  let imported = 0;
  for (const x of entries) {
    const email = String(x?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) continue;
    try {
      await convexService.upsertSuppression(userId, email, x.type || 'MANUAL', x.reason || 'Bulk import', 'csv_import');
      imported++;
    } catch {
      // ignore individual failure
    }
  }

  return res.json({ success: true, imported, received: entries.length });
});
