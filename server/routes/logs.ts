import { Router, Request, Response } from 'express';
import { db } from '../store.js';

export const logsRouter = Router();

// GET /api/logs - Technical service logs
logsRouter.get('/', (req: Request, res: Response) => {
  const { service, severity, search, limit = '100' } = req.query;
  let list = [...db.logs];

  if (service && typeof service === 'string' && service !== 'ALL') {
    list = list.filter((l) => l.service === service);
  }

  if (severity && typeof severity === 'string' && severity !== 'ALL') {
    list = list.filter((l) => l.severity === severity);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter(
      (l) =>
        l.event.toLowerCase().includes(q) ||
        l.response.toLowerCase().includes(q) ||
        (l.messageId && l.messageId.toLowerCase().includes(q))
    );
  }

  const numLimit = parseInt(limit as string, 10) || 100;
  res.json({ logs: list.slice(0, numLimit), total: list.length });
});
