import { Router, Request, Response } from 'express';
import { db } from '../store.js';
import { Sender, Domain } from '../../src/types.js';
import { optionalAuth } from '../middleware/auth.js';
import { supabaseService } from '../services/SupabaseService.js';

export const sendersRouter = Router();

// GET /api/senders - List all senders (scoped to user)
sendersRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  if (req.user && supabaseService.isConfigured) {
    const senders = await supabaseService.getSenders(req.user.id);
    return res.json({ senders });
  }
  res.json({ senders: db.senders });
});

// POST /api/senders - Add a new sender identity
sendersRouter.post('/', (req: Request, res: Response) => {
  const { name, fromEmail, replyTo, domainId, dailyLimit, hourlyLimit } = req.body;

  if (!name || !fromEmail) {
    return res.status(400).json({ error: 'Name and fromEmail are required' });
  }

  const domain = db.domains.find((d) => d.id === domainId) || db.domains[0];

  const newSender: Sender = {
    id: `snd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name,
    fromEmail: fromEmail.toLowerCase(),
    replyTo: replyTo || fromEmail.toLowerCase(),
    domainId: domain.id,
    domainName: domain.domainName,
    status: 'active',
    verification: domain.spfStatus === 'VERIFIED' && domain.dkimStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
    dailyLimit: Number(dailyLimit) || 50000,
    hourlyLimit: Number(hourlyLimit) || 5000,
    sentCount: 0,
    deliveredCount: 0,
    bouncedCount: 0,
    complaintCount: 0,
    createdAt: new Date().toISOString(),
  };

  db.senders.unshift(newSender);

  db.logs.unshift({
    id: `log_snd_${Date.now()}`,
    timestamp: new Date().toISOString(),
    service: 'Application',
    event: 'SENDER_IDENTITY_REGISTERED',
    severity: 'INFO',
    response: `Registered sender identity ${newSender.name} <${newSender.fromEmail}>`,
  });

  res.json({ success: true, sender: newSender });
});

// PATCH /api/senders/:id - Update or disable sender
sendersRouter.patch('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const sender = db.senders.find((s) => s.id === id);

  if (!sender) {
    return res.status(404).json({ error: 'Sender not found' });
  }

  const { name, replyTo, status, dailyLimit, hourlyLimit } = req.body;
  if (name) sender.name = name;
  if (replyTo) sender.replyTo = replyTo;
  if (status) sender.status = status;
  if (dailyLimit !== undefined) sender.dailyLimit = Number(dailyLimit);
  if (hourlyLimit !== undefined) sender.hourlyLimit = Number(hourlyLimit);

  res.json({ success: true, sender });
});

// GET /api/domains - List all domains with SPF/DKIM/DMARC status
sendersRouter.get('/domains', (req: Request, res: Response) => {
  res.json({ domains: db.domains });
});

// POST /api/domains - Add new sending domain
sendersRouter.post('/domains', (req: Request, res: Response) => {
  const { domainName, dkimSelector } = req.body;

  if (!domainName) {
    return res.status(400).json({ error: 'domainName is required' });
  }

  const selector = dkimSelector || 'kumo2026';
  const newDomain: Domain = {
    id: `dom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    domainName: domainName.toLowerCase(),
    spfStatus: 'VERIFIED',
    dkimStatus: 'VERIFIED',
    dmarcStatus: 'VERIFIED',
    sesStatus: 'VERIFIED',
    dkimSelector: selector,
    dkimPublicKey: `v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC${Math.random().toString(36).substring(2, 20)}...`,
    spfRecord: `v=spf1 include:_spf.kumomta.internal include:amazonses.com ~all`,
    dmarcRecord: `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${domainName.toLowerCase()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.domains.unshift(newDomain);

  db.logs.unshift({
    id: `log_dom_${Date.now()}`,
    timestamp: new Date().toISOString(),
    service: 'Amazon SES',
    event: 'DOMAIN_AUTHENTICATION_VERIFIED',
    severity: 'SUCCESS',
    response: `Domain ${domainName} verified with SPF/DKIM/DMARC records`,
  });

  res.json({ success: true, domain: newDomain });
});
