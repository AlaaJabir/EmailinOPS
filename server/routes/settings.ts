import { Router, Request, Response } from 'express';
import { db } from '../store.js';

export const settingsRouter = Router();

// GET /api/settings - Get configuration settings
settingsRouter.get('/', (req: Request, res: Response) => {
  res.json({
    settings: db.settings,
    apiKeys: db.apiKeys,
  });
});

// POST /api/settings - Update settings
settingsRouter.post('/', (req: Request, res: Response) => {
  const { category, values } = req.body;
  if (!category || !values) {
    return res.status(400).json({ error: 'Category and values are required' });
  }

  db.settings[category] = { ...db.settings[category], ...values };

  db.logs.unshift({
    id: `log_set_${Date.now()}`,
    timestamp: new Date().toISOString(),
    service: 'Application',
    event: 'CONFIGURATION_UPDATED',
    severity: 'INFO',
    response: `Settings category "${category}" updated`,
    details: values,
  });

  res.json({ success: true, settings: db.settings });
});

// POST /api/settings/api-keys - Generate new API key
settingsRouter.post('/api-keys', (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const rawKey = `em_live_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
  const keyPrefix = rawKey.substring(0, 12) + '...';

  const keyObj = {
    id: `key_${Date.now()}`,
    name,
    keyPrefix,
    createdAt: new Date().toISOString(),
    lastUsedAt: undefined,
  };

  db.apiKeys.unshift(keyObj);

  res.json({
    success: true,
    apiKey: keyObj,
    secretToken: rawKey, // Only shown once upon creation
  });
});

// DELETE /api/settings/api-keys/:id - Revoke API key
settingsRouter.delete('/api-keys/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.apiKeys = db.apiKeys.filter((k) => k.id !== id);
  res.json({ success: true, message: 'API Key revoked' });
});
