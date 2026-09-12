import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../store.js';
import { optionalAuth } from '../middleware/auth.js';
import { convexService } from '../services/ConvexService.js';

export const settingsRouter = Router();
settingsRouter.use(optionalAuth);

settingsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || await convexService.getDefaultUserId();
    const settings = await convexService.getSettings(userId);
    return res.json({
      settings: { ...db.settings, ...settings },
      apiKeys: db.apiKeys,
      convexConfigured: convexService.isConfigured,
      convexUrl: convexService.getUrl(),
    });
  } catch (err: any) {
    return res.json({ settings: db.settings, apiKeys: db.apiKeys });
  }
});

settingsRouter.post('/', async (req: Request, res: Response) => {
  const { category, values } = req.body;
  if (!category || !values || typeof values !== 'object') {
    return res.status(400).json({ error: 'Category and values are required' });
  }
  try {
    db.settings[category] = { ...(db.settings[category] || {}), ...values };
    const userId = req.user?.id || await convexService.getDefaultUserId();
    await convexService.upsertSettings(userId, category, values);
    return res.json({ success: true, settings: db.settings });
  } catch (err: any) {
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

  const rawKey = `em_live_${crypto.randomBytes(24).toString('base64url')}`;
  const keyPrefix = `${rawKey.slice(0, 12)}...`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const newKey = {
    id: `key_${Date.now()}`,
    name,
    prefix: keyPrefix,
    createdAt: new Date().toISOString(),
  };
  db.apiKeys.push(newKey as any);

  return res.json({ success: true, apiKey: newKey, secretToken: rawKey });
});

settingsRouter.delete('/api-keys/:id', async (req: Request, res: Response) => {
  db.apiKeys = db.apiKeys.filter((k) => k.id !== req.params.id);
  return res.json({ success: true, message: 'API Key revoked' });
});
