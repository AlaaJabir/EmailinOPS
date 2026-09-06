import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { supabaseService } from '../services/SupabaseService.js';

export const suppressionsRouter = Router();

suppressionsRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  if (!req.user || !supabaseService.isConfigured) return res.status(503).json({ error: 'Authenticated Supabase persistence is required' });
  const { search, type } = req.query;
  let list = await supabaseService.getSuppressions(req.user.id);
  if (search && typeof search === 'string') { const q = search.toLowerCase(); list = list.filter((s) => s.email.toLowerCase().includes(q) || s.reason.toLowerCase().includes(q)); }
  if (type && typeof type === 'string' && type !== 'ALL') list = list.filter((s) => s.type === type);
  return res.json({ suppressions: list, total: list.length });
});

suppressionsRouter.post('/', optionalAuth, async (req: Request, res: Response) => {
  if (!req.user || !supabaseService.isConfigured) return res.status(503).json({ error: 'Authenticated Supabase persistence is required' });
  const email = String(req.body.email || '').trim().toLowerCase();
  const type = req.body.type || 'MANUAL';
  const reason = req.body.reason || 'Manual suppression';
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email address is required' });
  try {
    await supabaseService.upsertSuppression(req.user.id, email, type, reason, 'manual');
    const { data, error } = await supabaseService.getClient()!.from('suppressions').select('*').eq('user_id', req.user.id).eq('email', email).maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ success: true, suppression: data ? { id: data.id, email: data.email, type: data.type, reason: data.reason, source: data.source, createdAt: data.created_at } : null });
  } catch (e: any) { return res.status(400).json({ error: e?.message || 'Failed to save suppression' }); }
});

suppressionsRouter.delete('/:id', optionalAuth, async (req: Request, res: Response) => {
  if (!req.user || !supabaseService.isConfigured) return res.status(503).json({ error: 'Authenticated Supabase persistence is required' });
  const { error, count } = await supabaseService.getClient()!.from('suppressions').delete({ count: 'exact' }).eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  if (!count) return res.status(404).json({ error: 'Suppression record not found' });
  return res.json({ success: true, message: 'Suppression record deleted successfully' });
});

suppressionsRouter.post('/import', optionalAuth, async (req: Request, res: Response) => {
  if (!req.user || !supabaseService.isConfigured) return res.status(503).json({ error: 'Authenticated Supabase persistence is required' });
  const entries = req.body.entries;
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'Valid entries array required' });
  const unique = new Map<string, any>();
  for (const x of entries) {
    const email = String(x?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) continue;
    unique.set(email, { user_id: req.user.id, email, type: x.type || 'MANUAL', reason: x.reason || 'Bulk import', source: 'csv_import' });
  }
  const rows = [...unique.values()];
  if (!rows.length) return res.json({ success: true, imported: 0 });
  let imported = 0;
  for (const row of rows) {
    try { await supabaseService.upsertSuppression(req.user.id, row.email, row.type, row.reason, row.source); imported += 1; } catch (e) { /* continue; report count below */ }
  }
  return res.json({ success: true, imported, received: rows.length });
});
