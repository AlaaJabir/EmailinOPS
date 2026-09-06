import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { db } from '../store.js';
import { supabaseService } from '../services/SupabaseService.js';

export const contactsRouter = Router();

function requirePersistence(req: Request, res: Response) {
  if (!req.user || !supabaseService.isConfigured || !supabaseService.getClient()) {
    res.status(503).json({ error: 'Authenticated Supabase persistence is required' });
    return false;
  }
  return true;
}

contactsRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  if (!req.user || !supabaseService.isConfigured) return res.status(401).json({ error: 'Authentication required' });
  try {
    let contacts = await supabaseService.getContacts(req.user.id);
    const { search, status, listId } = req.query;
    if (listId && typeof listId === 'string') {
      const { data: members, error } = await supabaseService.getClient()!.from('contact_list_members').select('contact_id').eq('list_id', listId);
      if (error) return res.status(400).json({ error: error.message });
      const ids = new Set((members || []).map((m: any) => m.contact_id));
      contacts = contacts.filter((c) => ids.has(c.id));
    }
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      contacts = contacts.filter((c) => c.email.toLowerCase().includes(q) || c.firstName?.toLowerCase().includes(q) || c.lastName?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q));
    }
    if (status && typeof status === 'string' && status !== 'ALL') contacts = contacts.filter((c) => c.status === status);
    return res.json({ contacts });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

contactsRouter.post('/', optionalAuth, async (req: Request, res: Response) => {
  if (!requirePersistence(req, res)) return;
  const { email, firstName, lastName, company, tags, listId } = req.body;
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return res.status(400).json({ error: 'Valid email is required' });
  const client = supabaseService.getClient()!;
  const { data: existing } = await client.from('contacts').select('id').eq('user_id', req.user!.id).eq('email', normalized).maybeSingle();
  if (existing) return res.status(409).json({ error: 'Contact already exists' });
  const { data, error } = await client.from('contacts').insert({ user_id: req.user!.id, email: normalized, first_name: firstName || null, last_name: lastName || null, company: company || null, tags: Array.isArray(tags) ? tags : tags ? [tags] : [], status: 'ACTIVE' }).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  if (listId) {
    const { error: memberError } = await client.from('contact_list_members').insert({ list_id: listId, contact_id: data.id });
    if (memberError) return res.status(400).json({ error: memberError.message });
  }
  return res.status(201).json({ success: true, contact: { id: data.id, email: data.email, firstName: data.first_name, lastName: data.last_name, company: data.company, tags: data.tags || [], status: data.status, createdAt: data.created_at, updatedAt: data.updated_at } });
});

contactsRouter.post('/import', optionalAuth, async (req: Request, res: Response) => {
  if (!requirePersistence(req, res)) return;
  const { contacts, listId } = req.body;
  if (!Array.isArray(contacts) || !contacts.length) return res.status(400).json({ error: 'Valid array of contacts required' });
  const client = supabaseService.getClient()!;
  const { data: existingRows } = await client.from('contacts').select('email').eq('user_id', req.user!.id);
  const existing = new Set((existingRows || []).map((r: any) => String(r.email).toLowerCase()));
  const { data: suppressionRows } = await client.from('suppressions').select('email').eq('user_id', req.user!.id);
  const suppressed = new Set((suppressionRows || []).map((r: any) => String(r.email).toLowerCase()));
  const rows: any[] = [];
  let skippedSuppressed = 0, skippedDuplicates = 0;
  for (const item of contacts) {
    const email = String(item?.email || '').trim().toLowerCase();
    if (!email.includes('@')) continue;
    if (suppressed.has(email)) { skippedSuppressed++; continue; }
    if (existing.has(email) || rows.some((r) => r.email === email)) { skippedDuplicates++; continue; }
    rows.push({ user_id: req.user!.id, email, first_name: item.firstName || item.name?.split(' ')[0] || null, last_name: item.lastName || item.name?.split(' ').slice(1).join(' ') || null, company: item.company || null, tags: item.tags ? (Array.isArray(item.tags) ? item.tags : [item.tags]) : ['csv-import'], status: 'ACTIVE' });
  }
  let imported = 0;
  if (rows.length) {
    const { data, error } = await client.from('contacts').insert(rows).select('id,email');
    if (error) return res.status(400).json({ error: error.message });
    imported = data?.length || 0;
    if (listId && data?.length) {
      const { error: memberError } = await client.from('contact_list_members').insert(data.map((r: any) => ({ list_id: listId, contact_id: r.id })));
      if (memberError) return res.status(400).json({ error: memberError.message });
    }
  }
  return res.json({ success: true, imported, skippedSuppressed, skippedDuplicates, totalReceived: contacts.length });
});

contactsRouter.get('/lists', optionalAuth, async (req: Request, res: Response) => {
  if (!req.user || !supabaseService.isConfigured) return res.status(401).json({ error: 'Authentication required' });
  const { data, error } = await supabaseService.getClient()!.from('contact_lists').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  return res.json({ lists: data || [] });
});

contactsRouter.post('/lists', optionalAuth, async (req: Request, res: Response) => {
  if (!requirePersistence(req, res)) return;
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const { data, error } = await supabaseService.getClient()!.from('contact_lists').insert({ user_id: req.user!.id, name: String(name).trim(), description: description || null }).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  return res.status(201).json({ success: true, list: data });
});
