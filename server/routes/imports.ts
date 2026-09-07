import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { supabaseService } from '../services/SupabaseService.js';

export const importsRouter = Router();
const BATCH_SIZE = 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ImportRow = { rowNumber: number; email: string; normalizedEmail: string; firstName: string | null; lastName: string | null; company: string | null; valid: boolean };
type ImportStats = { processed_rows: number; total_rows: number; valid_rows: number; invalid_rows: number; duplicate_rows: number; suppressed_rows: number; imported_rows: number };

function clientOr503(req: Request, res: Response) {
  const client = supabaseService.getClient();
  if (!req.user || !supabaseService.isConfigured || !client) { res.status(503).json({ error: 'Authenticated Supabase persistence is required' }); return null; }
  return client;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ''; let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i += 1; } else quoted = !quoted; }
    else if (ch === ',' && !quoted) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out.map((value) => value.replace(/^['"]|['"]$/g, '').trim());
}

function parseRows(text: string, startRow: number): ImportRow[] {
  const rows: ImportRow[] = []; let rowNumber = startRow;
  for (const line of text.replace(/\r/g, '').split('\n')) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line); const email = String(cols[0] || '').trim().toLowerCase(); rowNumber += 1;
    rows.push({ rowNumber, email, normalizedEmail: email, firstName: cols[1] || null, lastName: cols[2] || null, company: cols[3] || null, valid: EMAIL_RE.test(email) });
  }
  return rows;
}

function addStats(base: ImportStats, delta: { processed: number; valid: number; invalid: number; duplicate: number; suppressed: number; imported: number }): ImportStats {
  return { processed_rows: base.processed_rows + delta.processed, total_rows: base.total_rows + delta.processed, valid_rows: base.valid_rows + delta.valid, invalid_rows: base.invalid_rows + delta.invalid, duplicate_rows: base.duplicate_rows + delta.duplicate, suppressed_rows: base.suppressed_rows + delta.suppressed, imported_rows: base.imported_rows + delta.imported };
}

async function processRows(client: any, req: Request, importId: string, rows: ImportRow[], baseStats: ImportStats, listId: string) {
  if (!rows.length) return { stats: baseStats, imported: 0, invalid: 0, duplicate: 0, suppressed: 0, valid: 0 };
  const userId = req.user!.id;

  const existingStage = await client.from('email_import_rows').select('row_number, normalized_email, contact_id, status').eq('import_id', importId).in('row_number', rows.map((row) => row.rowNumber));
  if (existingStage.error) throw new Error(existingStage.error.message);
  const alreadyProcessed = new Map<number, any>((existingStage.data || []).map((row: any) => [Number(row.row_number), row]));
  const freshRows = rows.filter((row) => !alreadyProcessed.has(row.rowNumber));

  let invalid = 0, duplicate = 0, suppressed = 0, imported = 0;
  const firstByEmail = new Map<string, ImportRow>();
  const duplicateRowNumbers = new Set<number>();
  for (const row of freshRows) {
    if (!row.valid) { invalid += 1; continue; }
    if (firstByEmail.has(row.normalizedEmail)) { duplicate += 1; duplicateRowNumbers.add(row.rowNumber); continue; }
    firstByEmail.set(row.normalizedEmail, row);
  }

  const candidates = [...firstByEmail.values()];
  const candidateEmails = candidates.map((row) => row.normalizedEmail);
  const priorSameImport = candidateEmails.length ? await client.from('email_import_rows').select('normalized_email, contact_id, status').eq('import_id', importId).in('normalized_email', candidateEmails) : { data: [], error: null };
  if (priorSameImport.error) throw new Error(priorSameImport.error.message);
  const priorMap = new Map<string, any>();
  for (const row of priorSameImport.data || []) priorMap.set(String(row.normalized_email).toLowerCase(), row);

  const suppressionRows = candidateEmails.length ? await client.from('suppressions').select('email').eq('user_id', userId).in('email', candidateEmails) : { data: [], error: null };
  if (suppressionRows.error) throw new Error(suppressionRows.error.message);
  const suppressedSet = new Set((suppressionRows.data || []).map((row: any) => String(row.email).toLowerCase()));

  const accepted: ImportRow[] = [];
  const statusByRow = new Map<number, string>();
  const contactIdByRow = new Map<number, string | null>();

  for (const row of freshRows) {
    if (!row.valid) { statusByRow.set(row.rowNumber, 'INVALID'); continue; }
    if (duplicateRowNumbers.has(row.rowNumber)) { statusByRow.set(row.rowNumber, 'DUPLICATE'); continue; }
    if (priorMap.has(row.normalizedEmail)) { duplicate += 1; statusByRow.set(row.rowNumber, 'DUPLICATE'); contactIdByRow.set(row.rowNumber, priorMap.get(row.normalizedEmail)?.contact_id || null); continue; }
    if (suppressedSet.has(row.normalizedEmail)) { suppressed += 1; statusByRow.set(row.rowNumber, 'SUPPRESSED'); continue; }
    accepted.push(row); statusByRow.set(row.rowNumber, 'IMPORTED');
  }

  const valid = accepted.length;
  for (let i = 0; i < accepted.length; i += BATCH_SIZE) {
    const batch = accepted.slice(i, i + BATCH_SIZE);
    const emails = batch.map((row) => row.normalizedEmail);
    const contactsExisting = await client.from('contacts').select('id,email').eq('user_id', userId).in('email', emails);
    if (contactsExisting.error) throw new Error(contactsExisting.error.message);
    const contactMap = new Map<string, string>((contactsExisting.data || []).map((row: any) => [String(row.email).toLowerCase(), String(row.id)]));
    const missing = batch.filter((row) => !contactMap.has(row.normalizedEmail));
    if (missing.length) {
      const inserted = await client.from('contacts').insert(missing.map((row) => ({ user_id: userId, email: row.normalizedEmail, first_name: row.firstName, last_name: row.lastName, company: row.company, tags: ['import'], status: 'ACTIVE' }))).select('id,email');
      if (inserted.error) {
        const retry = await client.from('contacts').select('id,email').eq('user_id', userId).in('email', missing.map((row) => row.normalizedEmail));
        if (retry.error) throw new Error(inserted.error.message);
        for (const contact of retry.data || []) contactMap.set(String(contact.email).toLowerCase(), String(contact.id));
      } else for (const contact of inserted.data || []) contactMap.set(String(contact.email).toLowerCase(), String(contact.id));
    }
    for (const row of batch) contactIdByRow.set(row.rowNumber, contactMap.get(row.normalizedEmail) || null);
    const listMembers = batch.map((row) => ({ list_id: listId, contact_id: contactMap.get(row.normalizedEmail) })).filter((member: any) => member.contact_id);
    if (listMembers.length) {
      const memberInsert = await client.from('contact_list_members').upsert(listMembers, { onConflict: 'list_id,contact_id', ignoreDuplicates: true });
      if (memberInsert.error) throw new Error(memberInsert.error.message);
    }
    imported += batch.length;
  }

  const stageRows = freshRows.map((row) => ({ import_id: importId, user_id: userId, email: row.email, normalized_email: row.normalizedEmail, first_name: row.firstName, last_name: row.lastName, company: row.company, row_number: row.rowNumber, status: statusByRow.get(row.rowNumber) || 'FAILED', contact_id: contactIdByRow.get(row.rowNumber) || null }));
  if (stageRows.length) {
    const stagedInsert = await client.from('email_import_rows').upsert(stageRows, { onConflict: 'import_id,row_number', ignoreDuplicates: true });
    if (stagedInsert.error) throw new Error(stagedInsert.error.message);
  }

  const stats = addStats(baseStats, { processed: freshRows.length, valid, invalid, duplicate, suppressed, imported });
  return { stats, imported, invalid, duplicate, suppressed, valid };
}

importsRouter.get('/', optionalAuth, async (req, res) => {
  const client = clientOr503(req, res); if (!client) return;
  const { data, error } = await client.from('email_imports').select('*').eq('user_id', req.user!.id).order('created_at', { ascending: false }).limit(100);
  if (error) return res.status(400).json({ error: error.message });
  return res.json({ imports: data || [] });
});

importsRouter.post('/start', optionalAuth, async (req, res) => {
  const client = clientOr503(req, res); if (!client) return;
  const name = String(req.body?.name || req.body?.filename || 'Email import').trim().slice(0, 200);
  const filename = String(req.body?.filename || name).trim().slice(0, 255);
  const sourceSizeBytes = Math.max(0, Number(req.body?.sourceSizeBytes || 0));
  const list = await client.from('contact_lists').insert({ user_id: req.user!.id, name, description: `Imported audience · ${filename}` }).select('id').single();
  if (list.error) return res.status(400).json({ error: list.error.message });
  const created = await client.from('email_imports').insert({ user_id: req.user!.id, name, original_filename: filename, status: 'PROCESSING', list_id: list.data.id, source_size_bytes: sourceSizeBytes, upload_offset_bytes: 0, processed_rows: 0, total_rows: 0, valid_rows: 0, invalid_rows: 0, duplicate_rows: 0, suppressed_rows: 0, imported_rows: 0, started_at: new Date().toISOString() }).select('*').single();
  if (created.error) return res.status(400).json({ error: created.error.message });
  return res.status(201).json({ success: true, import: created.data });
});

importsRouter.post('/:id/chunk', optionalAuth, async (req, res) => {
  const client = clientOr503(req, res); if (!client) return;
  const importId = req.params.id;
  const found = await client.from('email_imports').select('*').eq('id', importId).eq('user_id', req.user!.id).maybeSingle();
  if (found.error) return res.status(400).json({ error: found.error.message });
  if (!found.data) return res.status(404).json({ error: 'Import not found' });
  if (['COMPLETED', 'CANCELLED'].includes(found.data.status)) return res.status(409).json({ error: `Import is ${found.data.status.toLowerCase()}` });

  const chunk = String(req.body?.chunk || '');
  const chunkId = String(req.body?.chunkId || '');
  const offset = Math.max(0, Number(req.body?.offset || 0));
  const sourceSizeBytes = Math.max(0, Number(req.body?.sourceSizeBytes || found.data.source_size_bytes || 0));
  if (!chunk) return res.status(400).json({ error: 'Chunk is required' });
  if (!chunkId) return res.status(400).json({ error: 'chunkId is required' });
  if (found.data.last_chunk_id === chunkId) return res.json({ success: true, duplicateChunk: true, import: found.data, processedRows: Number(found.data.processed_rows || 0), nextOffset: Number(found.data.upload_offset_bytes || 0) });

  const expectedOffset = Number(found.data.upload_offset_bytes || 0);
  if (offset !== expectedOffset) return res.status(409).json({ error: 'Upload offset mismatch', expectedOffset, receivedOffset: offset });

  const combined = String(found.data.parser_tail || '') + chunk;
  const parts = combined.replace(/\r/g, '').split('\n');
  const tail = parts.pop() || '';
  const rows = parseRows(parts.join('\n'), Number(found.data.processed_rows || 0));
  const baseStats: ImportStats = { processed_rows: Number(found.data.processed_rows || 0), total_rows: Number(found.data.total_rows || 0), valid_rows: Number(found.data.valid_rows || 0), invalid_rows: Number(found.data.invalid_rows || 0), duplicate_rows: Number(found.data.duplicate_rows || 0), suppressed_rows: Number(found.data.suppressed_rows || 0), imported_rows: Number(found.data.imported_rows || 0) };

  try {
    const result = await processRows(client, req, importId, rows, baseStats, String(found.data.list_id));
    const receivedBytes = Buffer.byteLength(chunk, 'utf8');
    const nextOffset = offset + receivedBytes;
    const updated = await client.from('email_imports').update({ parser_tail: tail, last_chunk_id: chunkId, source_size_bytes: sourceSizeBytes, upload_offset_bytes: nextOffset, processed_rows: result.stats.processed_rows, total_rows: result.stats.total_rows, valid_rows: result.stats.valid_rows, invalid_rows: result.stats.invalid_rows, duplicate_rows: result.stats.duplicate_rows, suppressed_rows: result.stats.suppressed_rows, imported_rows: result.stats.imported_rows, updated_at: new Date().toISOString() }).eq('id', importId).eq('user_id', req.user!.id).select('*').single();
    if (updated.error) throw new Error(updated.error.message);
    return res.json({ success: true, ...result, import: updated.data, processedRows: result.stats.processed_rows, nextOffset, completeBytes: sourceSizeBytes > 0 && nextOffset >= sourceSizeBytes });
  } catch (err: any) {
    await client.from('email_imports').update({ status: 'FAILED', error_message: err?.message || String(err), updated_at: new Date().toISOString() }).eq('id', importId).eq('user_id', req.user!.id);
    return res.status(500).json({ error: err?.message || 'Import processing failed' });
  }
});

importsRouter.post('/:id/complete', optionalAuth, async (req, res) => {
  const client = clientOr503(req, res); if (!client) return;
  const found = await client.from('email_imports').select('*').eq('id', req.params.id).eq('user_id', req.user!.id).maybeSingle();
  if (found.error) return res.status(400).json({ error: found.error.message });
  if (!found.data) return res.status(404).json({ error: 'Import not found' });
  try {
    let stats: ImportStats = { processed_rows: Number(found.data.processed_rows || 0), total_rows: Number(found.data.total_rows || 0), valid_rows: Number(found.data.valid_rows || 0), invalid_rows: Number(found.data.invalid_rows || 0), duplicate_rows: Number(found.data.duplicate_rows || 0), suppressed_rows: Number(found.data.suppressed_rows || 0), imported_rows: Number(found.data.imported_rows || 0) };
    if (found.data.parser_tail) stats = (await processRows(client, req, req.params.id, parseRows(found.data.parser_tail, stats.processed_rows), stats, String(found.data.list_id))).stats;
    const done = await client.from('email_imports').update({ status: 'COMPLETED', parser_tail: null, processed_rows: stats.processed_rows, total_rows: stats.total_rows, valid_rows: stats.valid_rows, invalid_rows: stats.invalid_rows, duplicate_rows: stats.duplicate_rows, suppressed_rows: stats.suppressed_rows, imported_rows: stats.imported_rows, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('user_id', req.user!.id).select('*').single();
    if (done.error) return res.status(400).json({ error: done.error.message });
    return res.json({ success: true, import: done.data });
  } catch (err: any) {
    await client.from('email_imports').update({ status: 'FAILED', error_message: err?.message || String(err), updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('user_id', req.user!.id);
    return res.status(500).json({ error: err?.message || 'Import completion failed' });
  }
});

importsRouter.post('/:id/cancel', optionalAuth, async (req, res) => {
  const client = clientOr503(req, res); if (!client) return;
  const { data, error } = await client.from('email_imports').update({ status: 'CANCELLED', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('user_id', req.user!.id).in('status', ['PENDING', 'PROCESSING', 'FAILED']).select('*').maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Import not found or already finalized' });
  return res.json({ success: true, import: data });
});
