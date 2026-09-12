import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { convexService } from '../services/ConvexService.js';
import { db } from '../store.js';

export const sendersRouter = Router();

sendersRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const senders = await convexService.getSenders(userId);
  return res.json({ senders });
});

sendersRouter.get('/domains', optionalAuth, async (req: Request, res: Response) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const domains = await convexService.getDomains(userId);
  return res.json({ domains });
});

sendersRouter.post('/', optionalAuth, async (req: Request, res: Response) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const { name, fromEmail, replyTo, domainId, dailyLimit, hourlyLimit } = req.body;
  if (!name || !fromEmail) return res.status(400).json({ error: 'Name and fromEmail are required' });

  const normalized = String(fromEmail).trim().toLowerCase();
  const domains = await convexService.getDomains(userId);
  const domain = domains.find((d) => d.id === domainId) || domains.find((d) => normalized.endsWith(`@${d.domainName}`));
  if (!domain) return res.status(400).json({ error: 'A valid sending domain belonging to this account is required' });

  const created = await convexService.saveSender(
    {
      domainId: domain.id,
      name: String(name).trim(),
      fromEmail: normalized,
      replyTo: replyTo ? String(replyTo).trim().toLowerCase() : normalized,
      status: 'active',
      verification: 'VERIFIED',
      dailyLimit: Number(dailyLimit) || 50000,
      hourlyLimit: Number(hourlyLimit) || 5000,
    },
    userId
  );

  return res.status(201).json({ success: true, sender: created });
});

sendersRouter.patch('/:id', optionalAuth, async (req: Request, res: Response) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const { name, replyTo, status, dailyLimit, hourlyLimit } = req.body;
  const update: Record<string, any> = {};
  if (name !== undefined) update.name = String(name).trim();
  if (replyTo !== undefined) update.replyTo = String(replyTo).trim().toLowerCase();
  if (status !== undefined) update.status = status;
  if (dailyLimit !== undefined) update.dailyLimit = Number(dailyLimit);
  if (hourlyLimit !== undefined) update.hourlyLimit = Number(hourlyLimit);

  await convexService.updateSender(req.params.id, update, userId);
  const senders = await convexService.getSenders(userId);
  const sender = senders.find((s) => s.id === req.params.id);
  if (!sender) return res.status(404).json({ error: 'Sender not found' });
  return res.json({ success: true, sender });
});

sendersRouter.post('/domains', optionalAuth, async (req: Request, res: Response) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const domainName = String(req.body.domainName || '').trim().toLowerCase();
  if (!domainName || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domainName)) {
    return res.status(400).json({ error: 'Valid domainName is required' });
  }

  const created = await convexService.saveDomain(
    {
      domainName,
      dkimSelector: String(req.body.dkimSelector || 'kumo2026'),
      spfStatus: 'VERIFIED',
      dkimStatus: 'VERIFIED',
      dmarcStatus: 'VERIFIED',
      sesStatus: 'VERIFIED',
      dkimPublicKey: 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3...',
      spfRecord: 'v=spf1 include:_spf.emailops.io ~all',
      dmarcRecord: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@' + domainName,
    },
    userId
  );

  return res.status(201).json({ success: true, domain: created });
});
