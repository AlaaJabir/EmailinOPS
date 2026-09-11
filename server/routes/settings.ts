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
        supabaseService.getSettings(req.user!.id).catch(() => db.settings),
        supabaseService.getApiKeys(req.user!.id).catch(() => db.apiKeys),
      ]);
      return res.json({ settings: { ...db.settings, ...settings }, apiKeys });
    }
    return res.json({ settings: db.settings, apiKeys: db.apiKeys });
  } catch (err: any) {
    return res.json({ settings: db.settings, apiKeys: db.apiKeys });
  }
});

settingsRouter.post('/', async (req: Request, res: Response) => {
  const { category, values } = req.body;
  if (!category || !values || typeof values !== 'object') return res.status(400).json({ error: 'Category and values are required' });
  try {
    // Always persist to local in-memory store so configuration is active immediately
    db.settings[category] = { ...(db.settings[category] || {}), ...values };

    if (supabaseService.isConfigured) {
      await supabaseService.upsertSettings(req.user!.id, category, values);
    }
    return res.json({ success: true, settings: db.settings });
  } catch (err: any) {
    // Even if any storage provider fails, the local memory was updated
    return res.json({ success: true, settings: db.settings });
  }
});

settingsRouter.post('/verify-ses', async (req: Request, res: Response) => {
  const { smtpUser, smtpPass, region, smtpHost, smtpPort } = req.body;
  const user = smtpUser || process.env.SES_SMTP_USERNAME;
  const pass = smtpPass || process.env.SES_SMTP_PASSWORD;
  const host = smtpHost || (region ? `email-smtp.${region}.amazonaws.com` : 'email-smtp.eu-west-1.amazonaws.com');
  const port = Number(smtpPort) || 587;

  if (!user || !pass) {
    return res.status(400).json({ success: false, error: 'SMTP Username and Password are required.' });
  }

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host,
      port,
      secure: false,
      auth: { user, pass },
      connectionTimeout: 8000,
    });

    await transporter.verify();
    return res.json({ success: true, message: `Successfully authenticated with Amazon SES at ${host}:${port}!` });
  } catch (err: any) {
    return res.status(422).json({ success: false, error: err.message || 'SES Authentication failed' });
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
