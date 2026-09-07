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

async function verifyListOwnership(listId: string, userId: string): Promise<boolean> {
  const client = supabaseService.getClient();
  if (!client) return false;
  const { data, error } = await client.from('contact_lists').select('id').eq('id', listId).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Contact list lookup failed: ${error.message}`);
  return Boolean(data);
}

contactsRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  if (!req.user || !supabaseService.isConfigured) return res.status(401).json({ error: 'Authentication required' });
  try {
    let contacts = await supabaseService.getContacts(req.user.id);
    const { search, status, listId } = req.query;
    if (listId && typeof listId === 'string') {
      const owned = await verifyListOwnership(listId, req.user.id);
      if (!owned) return res.status(404).json({ error: 'Contact list not found' });
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
  if (listId) {
    const owned = await verifyListOwnership(String(listId), req.user!.id);
    if (!owned) return res.status(404).json({ error: 'Contact list not found' });
  }
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
  if (listId) {
    const owned = await verifyListOwnership(String(listId), req.user!.id);
    if (!owned) return res.status(404).json({ error: 'Contact list not found' });
  }
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
  try {
    const client = supabaseService.getClient()!;
    const { data, error } = await client.from('contact_lists').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    const lists = data || [];
    if (!lists.length) return res.json({ lists: [] });

    const listIds = lists.map((list: any) => list.id);
    const { data: members, error: memberError } = await client.from('contact_list_members').select('list_id').in('list_id', listIds);
    if (memberError) return res.status(400).json({ error: memberError.message });

    const counts = new Map<string, number>();
    for (const member of members || []) counts.set(member.list_id, (counts.get(member.list_id) || 0) + 1);
    return res.json({
      lists: lists.map((list: any) => ({
        id: list.id,
        name: list.name,
        description: list.description,
        memberCount: counts.get(list.id) || 0,
        createdAt: list.created_at,
        updatedAt: list.updated_at,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to load contact lists' });
  }
});

contactsRouter.post('/lists', optionalAuth, async (req: Request, res: Response) => {
  if (!requirePersistence(req, res)) return;
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const { data, error } = await supabaseService.getClient()!.from('contact_lists').insert({ user_id: req.user!.id, name: String(name).trim(), description: description || null }).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  return res.status(201).json({ success: true, list: { id: data.id, name: data.name, description: data.description, memberCount: 0, createdAt: data.created_at, updatedAt: data.updated_at } });
});
