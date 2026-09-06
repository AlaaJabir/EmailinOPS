import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../store.js';
import { requireAuth } from '../middleware/auth.js';
import { supabaseService } from '../services/SupabaseService.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (supabaseService.isConfigured) {
      const [settings, apiKeys] = await Promise.all([
        supabaseService.getSettings(req.user!.id),
        supabaseService.getApiKeys(req.user!.id),
      ]);
      return res.json({ settings, apiKeys });
    }
    return res.json({ settings: db.settings, apiKeys: db.apiKeys });
  } catch (err: any) {
    return res.status(503).json({ error: err?.message || 'Unable to load settings' });
  }
});

settingsRouter.post('/', async (req: Request, res: Response) => {
  const { category, values } = req.body;
  if (!category || !values || typeof values !== 'object') return res.status(400).json({ error: 'Category and values are required' });
  try {
    if (supabaseService.isConfigured) {
      const settings = await supabaseService.upsertSettings(req.user!.id, category, values);
      return res.json({ success: true, settings });
    }
    db.settings[category] = { ...(db.settings[category] || {}), ...values };
    return res.json({ success: true, settings: db.settings });
  } catch (err: any) {
    return res.status(503).json({ error: err?.message || 'Unable to save settings' });
  }
});

settingsRouter.post('/api-keys', async (req: Request, res: Response) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!supabaseService.isConfigured) return res.status(503).json({ error: 'Supabase persistence is required for API keys' });

  const rawKey = `em_live_${crypto.randomBytes(24).toString('base64url')}`;
  const keyPrefix = `${rawKey.slice(0, 12)}...`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  try {
    const apiKey = await supabaseService.createApiKey(req.user!.id, name, keyPrefix, keyHash);
    return res.json({ success: true, apiKey, secretToken: rawKey });
  } catch (err: any) {
    return res.status(503).json({ error: err?.message || 'Unable to create API key' });
  }
});

settingsRouter.delete('/api-keys/:id', async (req: Request, res: Response) => {
  if (!supabaseService.isConfigured) return res.status(503).json({ error: 'Supabase persistence is required for API keys' });
  try {
    await supabaseService.revokeApiKey(req.user!.id, req.params.id);
    return res.json({ success: true, message: 'API Key revoked' });
  } catch (err: any) {
    return res.status(503).json({ error: err?.message || 'Unable to revoke API key' });
  }
});
