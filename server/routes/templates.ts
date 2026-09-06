import { Router, Request, Response } from 'express';
import { supabaseService } from '../services/SupabaseService.js';
import { requireAuth } from '../middleware/auth.js';

export const templatesRouter = Router();
templatesRouter.use(requireAuth);

const mapTemplate = (row: any) => ({
  id: row.id,
  name: row.name,
  subject: row.subject || '',
  preheader: row.preheader || '',
  headHtml: row.head_html || '',
  htmlBody: row.html_body || '',
  plainText: row.plain_text || '',
  variables: Array.isArray(row.variables) ? row.variables : [],
  fromName: row.from_name || undefined,
  fromEmail: row.from_email || undefined,
  replyTo: row.reply_to || undefined,
  customHeaders: row.custom_headers || {},
  trackOpens: row.track_opens ?? true,
  trackClicks: row.track_clicks ?? true,
  isMarketing: row.is_marketing ?? false,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

function clientOrUnavailable(res: Response) {
  const client = supabaseService.getClient();
  if (!client) {
    res.status(503).json({ error: 'Supabase persistence is not configured' });
    return null;
  }
  return client;
}

templatesRouter.get('/', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const client = clientOrUnavailable(res);
  if (!client) return;
  const { data, error } = await client.from('templates').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to load templates', details: error.message });
  res.json({ templates: (data || []).map(mapTemplate) });
});

templatesRouter.post('/', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { name, subject = '', preheader = '', headHtml = '', htmlBody = '', plainText = '', variables = [], fromName, fromEmail, replyTo, customHeaders = {}, trackOpens = true, trackClicks = true, isMarketing = false } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Template name is required' });
  if (!String(htmlBody || '').trim() && !String(plainText || '').trim()) return res.status(400).json({ error: 'Template must contain HTML or plain-text content' });
  const client = clientOrUnavailable(res);
  if (!client) return;
  const { data, error } = await client.from('templates').insert({
    user_id: userId,
    name: String(name).trim(),
    subject: String(subject),
    preheader: String(preheader),
    head_html: String(headHtml),
    html_body: String(htmlBody),
    plain_text: String(plainText),
    variables: Array.isArray(variables) ? variables.map(String) : [],
    from_name: fromName || null,
    from_email: fromEmail || null,
    reply_to: replyTo || null,
    custom_headers: customHeaders || {},
    track_opens: Boolean(trackOpens),
    track_clicks: Boolean(trackClicks),
    is_marketing: Boolean(isMarketing),
  }).select('*').single();
  if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'A template with this name already exists' : 'Failed to create template', details: error.message });
  res.status(201).json({ template: mapTemplate(data) });
});

templatesRouter.put('/:id', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const client = clientOrUnavailable(res);
  if (!client) return;
  const allowed = ['name','subject','preheader','head_html','html_body','plain_text','variables','from_name','from_email','reply_to','custom_headers','track_opens','track_clicks','is_marketing'];
  const source = req.body || {};
  const update: Record<string, any> = {};
  for (const key of allowed) if (Object.prototype.hasOwnProperty.call(source, key)) update[key] = source[key];
  const aliases: Record<string, string> = { headHtml:'head_html', htmlBody:'html_body', plainText:'plain_text', fromName:'from_name', fromEmail:'from_email', replyTo:'reply_to', customHeaders:'custom_headers', trackOpens:'track_opens', trackClicks:'track_clicks', isMarketing:'is_marketing' };
  for (const [from, to] of Object.entries(aliases)) if (Object.prototype.hasOwnProperty.call(source, from)) update[to] = source[from];
  if (update.name !== undefined) update.name = String(update.name).trim();
  update.updated_at = new Date().toISOString();
  const { data, error } = await client.from('templates').update(update).eq('id', req.params.id).eq('user_id', userId).select('*').maybeSingle();
  if (error) return res.status(500).json({ error: 'Failed to update template', details: error.message });
  if (!data) return res.status(404).json({ error: 'Template not found' });
  res.json({ template: mapTemplate(data) });
});

templatesRouter.delete('/:id', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const client = clientOrUnavailable(res);
  if (!client) return;
  const { data, error } = await client.from('templates').delete().eq('id', req.params.id).eq('user_id', userId).select('id').maybeSingle();
  if (error) return res.status(500).json({ error: 'Failed to delete template', details: error.message });
  if (!data) return res.status(404).json({ error: 'Template not found' });
  res.json({ success: true, templateId: data.id });
});
