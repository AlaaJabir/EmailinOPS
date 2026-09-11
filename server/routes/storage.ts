import { Router, Request, Response } from 'express';
import { r2StorageService, R2Config } from '../services/R2StorageService.js';
import { db } from '../store.js';
import { requireAuth } from '../middleware/auth.js';

export const storageRouter = Router();

// GET current storage configuration
storageRouter.get('/config', async (_req: Request, res: Response) => {
  const config = r2StorageService.getConfig();
  const isConfigured = r2StorageService.isConfigured();

  return res.json({
    isConfigured,
    accountId: config.accountId,
    endpoint: config.endpoint,
    accessKeyId: config.accessKeyId ? `${config.accessKeyId.slice(0, 4)}...${config.accessKeyId.slice(-4)}` : '',
    hasSecretKey: Boolean(config.secretAccessKey),
    bucketName: config.bucketName,
    publicDomain: config.publicDomain || '',
  });
});

// POST update storage configuration
storageRouter.post('/config', requireAuth, async (req: Request, res: Response) => {
  const { accountId, endpoint, accessKeyId, secretAccessKey, bucketName, publicDomain } = req.body;

  const current = (db.settings as any)?.r2 || {};
  const updated: Partial<R2Config> = {
    accountId: accountId || current.accountId || 'b1aabfa2a055b8aa67596c2bd7a69cd0',
    endpoint: endpoint || current.endpoint || 'https://b1aabfa2a055b8aa67596c2bd7a69cd0.r2.cloudflarestorage.com',
    bucketName: bucketName || current.bucketName || 'emailops-assets',
    publicDomain: publicDomain !== undefined ? publicDomain : current.publicDomain,
  };

  if (accessKeyId) updated.accessKeyId = accessKeyId;
  if (secretAccessKey) updated.secretAccessKey = secretAccessKey;

  db.settings.r2 = { ...current, ...updated };

  return res.json({
    success: true,
    message: 'Cloudflare R2 configuration saved successfully',
    config: {
      accountId: updated.accountId,
      endpoint: updated.endpoint,
      bucketName: updated.bucketName,
      publicDomain: updated.publicDomain,
      isConfigured: r2StorageService.isConfigured(),
    },
  });
});

// POST test connection to Cloudflare R2
storageRouter.post('/test', async (req: Request, res: Response) => {
  const { accountId, endpoint, accessKeyId, secretAccessKey, bucketName } = req.body || {};
  const testConfig: Partial<R2Config> = {};

  if (accountId) testConfig.accountId = accountId;
  if (endpoint) testConfig.endpoint = endpoint;
  if (accessKeyId) testConfig.accessKeyId = accessKeyId;
  if (secretAccessKey) testConfig.secretAccessKey = secretAccessKey;
  if (bucketName) testConfig.bucketName = bucketName;

  const result = await r2StorageService.testConnection(testConfig);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.json(result);
});

// POST upload file / asset to R2
storageRouter.post('/upload', requireAuth, async (req: Request, res: Response) => {
  try {
    const { filename, mimeType, base64Data, prefix } = req.body;
    if (!filename || !base64Data) {
      return res.status(400).json({ error: 'Missing filename or base64Data' });
    }

    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const result = await r2StorageService.uploadFile({
      buffer,
      filename,
      mimeType: mimeType || 'application/octet-stream',
      prefix: prefix || 'assets',
    });

    return res.json({
      success: true,
      file: result,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Upload failed' });
  }
});

// GET list files
storageRouter.get('/files', requireAuth, async (_req: Request, res: Response) => {
  try {
    const files = await r2StorageService.listFiles();
    return res.json({ files });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to list files' });
  }
});

// DELETE a file
storageRouter.delete('/files/*', requireAuth, async (req: Request, res: Response) => {
  try {
    const key = req.params[0];
    if (!key) return res.status(400).json({ error: 'Missing file key' });

    const deleted = await r2StorageService.deleteFile(key);
    return res.json({ success: deleted });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to delete file' });
  }
});

// GET raw file content (proxy if no public domain configured)
storageRouter.get('/raw/*', async (req: Request, res: Response) => {
  try {
    const key = req.params[0];
    if (!key) return res.status(400).send('Missing key');

    const file = await r2StorageService.getFile(key);
    if (!file) {
      return res.status(404).send('File not found');
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(file.buffer);
  } catch (err: any) {
    return res.status(500).send(err?.message || 'Failed to stream file');
  }
});
