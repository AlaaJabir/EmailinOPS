import { Router, Request, Response } from 'express';
import { db } from '../store.js';
import { requireAuth } from '../middleware/auth.js';

export const templatesRouter = Router();
templatesRouter.use(requireAuth);

templatesRouter.get('/', (req: Request, res: Response) => {
  res.json({ templates: [...db.templates].sort((a,b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()) });
});

templatesRouter.post('/', (req: Request, res: Response) => {
  const { name, subject = '', preheader = '', headHtml = '', htmlBody = '', plainText = '', variables = [], fromName, fromEmail, replyTo, customHeaders = {}, trackOpens = true, trackClicks = true, isMarketing = false } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Template name is required' });
  if (!String(htmlBody || '').trim() && !String(plainText || '').trim()) return res.status(400).json({ error: 'Template must contain HTML or plain-text content' });
  const now = new Date().toISOString();
  const template = { id: `tmpl_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, name: String(name).trim(), subject: String(subject), preheader: String(preheader), headHtml: String(headHtml), htmlBody: String(htmlBody), plainText: String(plainText), variables: Array.isArray(variables) ? variables.map(String) : [], fromName, fromEmail, replyTo, customHeaders, trackOpens: Boolean(trackOpens), trackClicks: Boolean(trackClicks), isMarketing: Boolean(isMarketing), createdAt: now, updatedAt: now };
  db.templates.unshift(template);
  res.status(201).json({ template });
});

templatesRouter.put('/:id', (req: Request, res: Response) => {
  const index = db.templates.findIndex(t => t.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Template not found' });
  const current = db.templates[index];
  const next = { ...current, ...req.body, id: current.id, createdAt: current.createdAt, updatedAt: new Date().toISOString() };
  db.templates[index] = next;
  res.json({ template: next });
});

templatesRouter.delete('/:id', (req: Request, res: Response) => {
  const index = db.templates.findIndex(t => t.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Template not found' });
  const [template] = db.templates.splice(index, 1);
  res.json({ success: true, templateId: template.id });
});
