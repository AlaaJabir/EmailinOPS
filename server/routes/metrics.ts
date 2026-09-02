import { Router, Request, Response } from 'express';
import { db } from '../store.js';

export const metricsRouter = Router();

// GET /api/metrics - Prometheus exporter format OR json
metricsRouter.get('/', (req: Request, res: Response) => {
  const format = req.query.format || (req.headers.accept?.includes('application/json') ? 'json' : 'text');

  if (format === 'json') {
    res.json(db.getPrometheusMetrics());
  } else {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(db.getPrometheusRawOutput());
  }
});
