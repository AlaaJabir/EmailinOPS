import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import 'dotenv/config';

import { authRouter } from './server/routes/auth.js';
import { messagesRouter } from './server/routes/messages.js';
import { campaignsRouter } from './server/routes/campaigns.js';
import { sendersRouter } from './server/routes/senders.js';
import { contactsRouter } from './server/routes/contacts.js';
import { suppressionsRouter } from './server/routes/suppressions.js';
import { analyticsRouter } from './server/routes/analytics.js';
import { logsRouter } from './server/routes/logs.js';
import { settingsRouter } from './server/routes/settings.js';
import { metricsRouter } from './server/routes/metrics.js';
import { webhooksRouter } from './server/routes/webhooks.js';
import { seedRouter } from './server/routes/seed.js';
import { db } from './server/store.js';
import { kumoMtaService } from './server/services/KumoMtaService.js';
import { sesProvider } from './server/services/SesProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middlewares
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Request logger
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') && req.path !== '/api/metrics') {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // Health Check Endpoint (All services)
  app.get('/api/health', async (req, res) => {
    const kumoHealth = await kumoMtaService.checkHealth();
    const sesHealth = await sesProvider.checkHealth();

    const isHealthy = kumoHealth.status === 'healthy';

    res.status(isHealthy ? 200 : 200).json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        api: 'healthy',
        database: 'healthy',
        kumomta: kumoHealth,
        amazon_ses: sesHealth,
      },
    });
  });

  // Dedicated KumoMTA Health Check Endpoint
  app.get('/api/health/kumomta', async (req, res) => {
    const kumoHealth = await kumoMtaService.checkHealth();
    res.status(kumoHealth.status === 'healthy' ? 200 : 503).json(kumoHealth);
  });

  // Dashboard Stats API
  app.get('/api/dashboard/stats', (req, res) => {
    const stats = db.getDashboardStats();
    res.json(stats);
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/campaigns', campaignsRouter);
  app.use('/api/senders', sendersRouter);
  app.use('/api/contacts', contactsRouter);
  app.use('/api/suppressions', suppressionsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/logs', logsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/metrics', metricsRouter);
  app.use('/api/webhooks', webhooksRouter);
  app.use('/api/seed', seedRouter);

  // Serve Frontend / Vite Middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

    app.listen(PORT, '0.0.0.0', () => {
    console.log(`[EmailOps] Server started on http://0.0.0.0:${PORT}`);
  });
}

startServer();
