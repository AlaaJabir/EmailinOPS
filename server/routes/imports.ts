import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { supabaseService } from '../services/SupabaseService.js';

export const importsRouter = Router();
const BATCH_SIZE = 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientOr503(req: Request, res: Response) {
  if (!req.user || !supabaseService.isConfigured || !supabaseService.getClient()) {
    res.status(503).json({ error: 'Authenticated Supabase persistence is required' });
    return null;
  }
  return supabaseService.getClient()!;
}

function parseCsvLine(line: string) {
  const out: string[] = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out.map(v => v.replace(/^['"]|['"]$/g, '').trim());
}

function parseRows(text: string, startRow: number) {
  const rows: any[] = [];
  let rowNumber = startRow;
  const lines = text.replace(/\r/g, '').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const email = String(cols[0] || '').trim().toLowerCase();
    rowNumber++;
    if (!EMAIL_RE.test(email)) {
      rows.push({ rowNumber, email: email || '', normalizedEmail: email, firstName: cols[1] || null, lastName: cols[2] || null, company: cols[3] || null, valid: false, reason: 'INVALID_EMAIL' });
      continue;
    }
    rows.push({ rowNumber, email, normalizedEmail: email, firstName: cols[1] || null, lastName: cols[2] || null, company: cols[3] || null, valid: true });
  }
  return rows;
}

async function processRows(client: any, req: Request, importId: string, rows: any[]) {
  if (!rows.length) return { valid: 0, invalid: 0, duplicate: 0, suppressed: 0, imported: 0 };
  const userId = req.user!.id;
  let valid = 0, invalid = 0, duplicate = 0, suppressed = 0, imported = 0;
  const unique = new Map<string, any>();
  for (const r of rows) {
    if (!r.valid) { invalid++; continue; }
    if (!unique.has(r.normalizedEmail)) unique.set(r.normalizedEmail, r); else duplicate++;
  }
  const emails = [...unique.keys()];
  const existingRows = await client.from('email_import_rows').select('normalized_email').eq('import_id', importId).in('normalized_email', emails);
  if (existingRows.error) throw new Error(existingRows.error.message);
  for (const r of existingRows.data || []) { unique.delete(String(r.normalized_email)); duplicate++; }
  const suppressionRows = await client.from('suppressions').select('email').eq('user_id', userId).in('email', [...unique.keys()]);
  if (suppressionRows.error) throw new Error(suppressionRows.error.message);
  const suppressedSet = new Set((suppressionRows.data || []).map((r: any) => String(r.email).toLowerCase()));
  for (const email of suppressedSet) { unique.delete(email); suppressed++; }
  const staged = [...unique.values()];
  valid += staged.length;
  for (let i = 0; i < staged.length; i += BATCH_SIZE) {
    const batch = staged.slice(i, i + BATCH_SIZE);
    const contactsExisting = await client.from('contacts').select('id,email').eq('user_id', userId).in('email', batch.map(r => r.normalizedEmail));
    if (contactsExisting.error) throw new Error(contactsExisting.error.message);
    const contactMap = new Map((contactsExisting.data || []).map((r: any) => [String(r.email).toLowerCase(), r.id]));
    const missing = batch.filter(r => !contactMap.has(r.normalizedEmail));
    if (missing.length) {
      const ins = await client.from('contacts').insert(missing.map(r => ({ user_id: userId, email: r.normalizedEmail, first_name: r.firstName, last_name: r.lastName, company: r.company, tags: ['import'], status: 'ACTIVE' }))).select('id,email');
      if (ins.error) throw new Error(ins.error.message);
      for (const c of ins.data || []) contactMap.set(String(c.email).toLowerCase(), c.id);
    }
    const stageRows = batch.map(r => ({ import_id: importId, user_id: userId, email: r.email, normalized_email: r.normalizedEmail, first_name: r.firstName, last_name: r.lastName, company: r.company, row_number: r.rowNumber, status: 'IMPORTED', contact_id: contactMap.get(r.normalizedEmail) || null }));
    const stagedInsert = await client.from('email_import_rows').insert(stageRows);
    if (stagedInsert.error) throw new Error(stagedInsert.error.message);
    if (batch.length) {
      const listMembers = batch.map(r => ({ list_id: (req as any).__importListId, contact_id: contactMap.get(r.normalizedEmail) })).filter((r: any) => r.contact_id);
      if (listMembers.length) {
        const memberInsert = await client.from('contact_list_members').upsert(listMembers, { onConflict: 'list_id,contact_id', ignoreDuplicates: true });
        if (memberInsert.error) throw new Error(memberInsert.error.message);
      }
    }
    imported += batch.length;
    await client.from('email_imports').update({ processed_rows: imported, imported_rows: imported, valid_rows: valid, invalid_rows: invalid, duplicate_rows: duplicate, suppressed_rows: suppressed, updated_at: new Date().toISOString() }).eq('id', importId).eq('user_id', userId);
  }
  return { valid, invalid, duplicate, suppressed, imported };
}

importsRouter.get('/', optionalAuth, async (req, res) => {
  const c = clientOr503(req, res); if (!c) return;
  const { data, error } = await c.from('email_imports').select('*').eq('user_id', req.user!.id).order('created_at', { ascending: false }).limit(100);
  if (error) return res.status(400).json({ error: error.message });
  return res.json({ imports: data || [] });
});

importsRouter.post('/start', optionalAuth, async (req, res) => {
  const c = clientOr503(req, res); if (!c) return;
  const name = String(req.body?.name || req.body?.filename || 'Email import').trim().slice(0, 200);
  const filename = String(req.body?.filename || name).trim().slice(0, 255);
  const list = await c.from('contact_lists').insert({ user_id: req.user!.id, name, description: `Imported audience · ${filename}` }).select('id').single();
  if (list.error) return res.status(400).json({ error: list.error.message });
  const created = await c.from('email_imports').insert({ user_id: req.user!.id, name, original_filename: filename, status: 'PROCESSING', list_id: list.data.id, started_at: new Date().toISOString(), processed_rows: 0 }).select('*').single();
  if (created.error) return res.status(400).json({ error: created.error.message });
  (req as any).__importListId = list.data.id;
  return res.status(201).json({ success: true, import: created.data });
});

importsRouter.post('/:id/chunk', optionalAuth, async (req, res) => {
  const c = clientOr503(req, res); if (!c) return;
  const importId = req.params.id;
  const found = await c.from('email_imports').select('*').eq('id', importId).eq('user_id', req.user!.id).maybeSingle();
  if (found.error) return res.status(400).json({ error: found.error.message });
  if (!found.data) return res.status(404).json({ error: 'Import not found' });
  if (['COMPLETED','CANCELLED'].includes(found.data.status)) return res.status(409).json({ error: `Import is ${found.data.status.toLowerCase()}` });
  const chunk = String(req.body?.chunk || '');
  if (!chunk) return res.status(400).json({ error: 'Chunk is required' });
  const combined = String(found.data.parser_tail || '') + chunk;
  const parts = combined.replace(/\r/g, '').split('\n');
  const tail = parts.pop() || '';
  const rows = parseRows(parts.join('\n'), Number(found.data.processed_rows || 0));
  (req as any).__importListId = found.data.list_id;
  try {
    const result = await processRows(c, req, importId, rows);
    const totalRows = Number(found.data.total_rows || 0) + parts.filter(x => x.trim()).length;
    await c.from('email_imports').update({ parser_tail: tail, total_rows: totalRows, updated_at: new Date().toISOString() }).eq('id', importId).eq('user_id', req.user!.id);
    return res.json({ success: true, ...result, processedRows: Number(found.data.processed_rows || 0) + result.imported + result.invalid + result.duplicate });
  } catch (err: any) {
    await c.from('email_imports').update({ status: 'FAILED', error_message: err?.message || String(err), updated_at: new Date().toISOString() }).eq('id', importId).eq('user_id', req.user!.id);
    return res.status(500).json({ error: err?.message || 'Import processing failed' });
  }
});

importsRouter.post('/:id/complete', optionalAuth, async (req, res) => {
  const c = clientOr503(req, res); if (!c) return;
  const found = await c.from('email_imports').select('*').eq('id', req.params.id).eq('user_id', req.user!.id).maybeSingle();
  if (found.error) return res.status(400).json({ error: found.error.message });
  if (!found.data) return res.status(404).json({ error: 'Import not found' });
  (req as any).__importListId = found.data.list_id;
  try {
    if (found.data.parser_tail) await processRows(c, req, req.params.id, parseRows(found.data.parser_tail, Number(found.data.processed_rows || 0)));
    const done = await c.from('email_imports').update({ status: 'COMPLETED', parser_tail: null, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('user_id', req.user!.id).select('*').single();
    if (done.error) return res.status(400).json({ error: done.error.message });
    return res.json({ success: true, import: done.data });
  } catch (err: any) {
    await c.from('email_imports').update({ status: 'FAILED', error_message: err?.message || String(err), updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('user_id', req.user!.id);
    return res.status(500).json({ error: err?.message || 'Import completion failed' });
  }
});

importsRouter.post('/:id/cancel', optionalAuth, async (req, res) => {
  const c = clientOr503(req, res); if (!c) return;
  const { data, error } = await c.from('email_imports').update({ status: 'CANCELLED', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('user_id', req.user!.id).in('status', ['PENDING','PROCESSING','FAILED']).select('*').maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Import not found or already finalized' });
  return res.json({ success: true, import: data });
});
