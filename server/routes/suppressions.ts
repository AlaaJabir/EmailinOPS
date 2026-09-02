import { Router, Request, Response } from 'express';
import { db } from '../store.js';
import { suppressionService } from '../services/SuppressionService.js';

export const suppressionsRouter = Router();

// GET /api/suppressions - Search and filter suppression list
suppressionsRouter.get('/', (req: Request, res: Response) => {
  const { search, type } = req.query;
  let list = [...db.suppressions];

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter((s) => s.email.toLowerCase().includes(q) || s.reason.toLowerCase().includes(q));
  }

  if (type && typeof type === 'string' && type !== 'ALL') {
    list = list.filter((s) => s.type === type);
  }

  res.json({ suppressions: list, total: list.length });
});

// POST /api/suppressions - Add manual suppression
suppressionsRouter.post('/', (req: Request, res: Response) => {
  const { email, type = 'MANUAL', reason = 'Manual suppression' } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }

  const record = suppressionService.addSuppression(email, type, reason, 'manual');
  res.json({ success: true, suppression: record });
});

// DELETE /api/suppressions/:id - Explicit authorized removal
suppressionsRouter.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const removed = suppressionService.removeSuppression(id);

  if (!removed) {
    return res.status(404).json({ error: 'Suppression record not found' });
  }

  res.json({ success: true, message: 'Suppression record deleted successfully' });
});

// POST /api/suppressions/import - Bulk import suppressions
suppressionsRouter.post('/import', (req: Request, res: Response) => {
  const { entries } = req.body; // Array of { email, type, reason }

  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: 'Valid entries array required' });
  }

  let count = 0;
  for (const item of entries) {
    if (item.email && item.email.includes('@')) {
      suppressionService.addSuppression(item.email, item.type || 'MANUAL', item.reason || 'Bulk import', 'csv_import');
      count++;
    }
  }

  res.json({ success: true, imported: count });
});
