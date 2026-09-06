import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { supabaseService } from '../services/SupabaseService.js';
import { db } from '../store.js';

export const sendersRouter = Router();

function allowLocalFallback() { return process.env.NODE_ENV !== 'production'; }

sendersRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  if (req.user && supabaseService.isConfigured) return res.json({ senders: await supabaseService.getSenders(req.user.id) });
  if (allowLocalFallback()) return res.json({ senders: db.senders });
  return res.status(401).json({ error: 'Authentication required' });
});

sendersRouter.get('/domains', optionalAuth, async (req: Request, res: Response) => {
  if (req.user && supabaseService.isConfigured) return res.json({ domains: await supabaseService.getDomains(req.user.id) });
  if (allowLocalFallback()) return res.json({ domains: db.domains });
  return res.status(401).json({ error: 'Authentication required' });
});

sendersRouter.post('/', optionalAuth, async (req: Request, res: Response) => {
  if (!req.user || !supabaseService.isConfigured) return res.status(503).json({ error: 'Authenticated Supabase persistence is required' });
  const { name, fromEmail, replyTo, domainId, dailyLimit, hourlyLimit } = req.body;
  if (!name || !fromEmail) return res.status(400).json({ error: 'Name and fromEmail are required' });
  const normalized = String(fromEmail).trim().toLowerCase();
  const domains = await supabaseService.getDomains(req.user.id);
  const domain = domains.find((d) => d.id === domainId) || domains.find((d) => normalized.endsWith(`@${d.domainName}`));
  if (!domain) return res.status(400).json({ error: 'A valid sending domain belonging to this account is required' });
  const sender = { user_id: req.user.id, domain_id: domain.id, name: String(name).trim(), from_email: normalized, reply_to: replyTo ? String(replyTo).trim().toLowerCase() : normalized, status: 'active', verification: domain.spfStatus === 'VERIFIED' && domain.dkimStatus === 'VERIFIED' && domain.dmarcStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING', daily_limit: Number(dailyLimit) || 50000, hourly_limit: Number(hourlyLimit) || 5000 };
  const client = supabaseService.getClient()!;
  const { data, error } = await client.from('senders').insert(sender).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  return res.status(201).json({ success: true, sender: { id: data.id, name: data.name, fromEmail: data.from_email, replyTo: data.reply_to, domainId: data.domain_id, domainName: domain.domainName, status: data.status, verification: data.verification, dailyLimit: data.daily_limit, hourlyLimit: data.hourly_limit, sentCount: data.sent_count, deliveredCount: data.delivered_count, bouncedCount: data.bounced_count, complaintCount: data.complaint_count, createdAt: data.created_at } });
});

sendersRouter.patch('/:id', optionalAuth, async (req: Request, res: Response) => {
  if (!req.user || !supabaseService.isConfigured) return res.status(503).json({ error: 'Authenticated Supabase persistence is required' });
  const { name, replyTo, status, dailyLimit, hourlyLimit } = req.body;
  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  if (name !== undefined) update.name = String(name).trim();
  if (replyTo !== undefined) update.reply_to = String(replyTo).trim().toLowerCase();
  if (status !== undefined) update.status = status;
  if (dailyLimit !== undefined) update.daily_limit = Number(dailyLimit);
  if (hourlyLimit !== undefined) update.hourly_limit = Number(hourlyLimit);
  const { data, error } = await supabaseService.getClient()!.from('senders').update(update).eq('id', req.params.id).eq('user_id', req.user.id).select('*').maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Sender not found' });
  return res.json({ success: true, sender: (await supabaseService.getSenders(req.user.id)).find((s) => s.id === data.id) });
});

sendersRouter.post('/domains', optionalAuth, async (req: Request, res: Response) => {
  if (!req.user || !supabaseService.isConfigured) return res.status(503).json({ error: 'Authenticated Supabase persistence is required' });
  const domainName = String(req.body.domainName || '').trim().toLowerCase();
  if (!domainName || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domainName)) return res.status(400).json({ error: 'Valid domainName is required' });
  const client = supabaseService.getClient()!;
  const { data, error } = await client.from('domains').insert({ user_id: req.user.id, domain_name: domainName, dkim_selector: String(req.body.dkimSelector || 'kumo2026'), spf_status: 'PENDING', dkim_status: 'PENDING', dmarc_status: 'PENDING', ses_status: 'PENDING', dkim_public_key: '', spf_record: '', dmarc_record: '' }).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  return res.status(201).json({ success: true, domain: (await supabaseService.getDomains(req.user.id)).find((d) => d.id === data.id) });
});
