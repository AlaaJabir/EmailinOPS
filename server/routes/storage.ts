import { Router, Request, Response } from 'express';
import { convexStorageService } from '../services/ConvexStorageService.js';
import { convexService } from '../services/ConvexService.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

export const storageRouter = Router();

// GET current storage configuration & status
storageRouter.get('/config', async (_req: Request, res: Response) => {
  return res.json({
    provider: 'Convex Storage',
    isConfigured: convexService.isConfigured,
    convexUrl: convexService.getUrl(),
    status: convexService.isConfigured ? 'healthy' : 'ready',
    engine: 'Convex Cloud Storage Engine',
  });
});

// POST test connection to Convex Storage
storageRouter.post('/test', async (req: Request, res: Response) => {
  const { url } = req.body || {};
  const result = await convexStorageService.testConnection(url);
  return res.json(result);
});

// POST upload file / asset
storageRouter.post('/upload', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { filename, mimeType, base64Data, prefix } = req.body;
    if (!filename || !base64Data) {
      return res.status(400).json({ error: 'Missing filename or base64Data' });
    }

    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${prefix ? prefix.replace(/\/$/, '') : 'assets'}/${Date.now()}_${safeName}`;

    const result = await convexStorageService.uploadFile({
      buffer,
      filename,
      mimeType: mimeType || 'application/octet-stream',
      key,
      size: buffer.length,
      userId: req.user?.id || 'usr_admin_01',
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
storageRouter.get('/files', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const files = await convexStorageService.listFiles();
    return res.json({ files });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to list files' });
  }
});

// DELETE a file
storageRouter.delete('/files/*', optionalAuth, async (req: Request, res: Response) => {
  try {
    const key = req.params[0];
    if (!key) return res.status(400).json({ error: 'Missing file key' });

    const deleted = await convexStorageService.deleteFile(key, req.user?.id);
    return res.json({ success: deleted });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to delete file' });
  }
});

// GET file content by key
storageRouter.get('/files/:key(*)', async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    if (!key) return res.status(400).send('Missing file key');

    const file = await convexStorageService.getFile(key);
    if (!file) {
      return res.status(404).send('File not found');
    }

    if (file.dataBase64) {
      const buffer = Buffer.from(file.dataBase64, 'base64');
      res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(buffer);
    }

    if (file.url && file.url.startsWith('http')) {
      return res.redirect(file.url);
    }

    return res.status(404).send('File data unavailable');
  } catch (err: any) {
    return res.status(500).send(err?.message || 'Failed to stream file');
  }
});

// Raw fallback
storageRouter.get('/raw/*', async (req: Request, res: Response) => {
  try {
    const key = req.params[0];
    if (!key) return res.status(400).send('Missing key');

    const file = await convexStorageService.getFile(key);
    if (!file) return res.status(404).send('File not found');

    if (file.dataBase64) {
      const buffer = Buffer.from(file.dataBase64, 'base64');
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(buffer);
    }
    return res.redirect(file.url);
  } catch (err: any) {
    return res.status(500).send(err?.message || 'Failed to stream file');
  }
});
