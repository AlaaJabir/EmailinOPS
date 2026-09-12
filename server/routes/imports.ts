import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { convexService } from '../services/ConvexService.js';
import { db } from '../store.js';

export const importsRouter = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ImportRow = { rowNumber: number; email: string; normalizedEmail: string; firstName: string | null; lastName: string | null; company: string | null; valid: boolean };
type ImportStats = { processed_rows: number; total_rows: number; valid_rows: number; invalid_rows: number; duplicate_rows: number; suppressed_rows: number; imported_rows: number };

// In-memory imports store for tracking upload progress
const memoryImports = new Map<string, any>();

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out.map((value) => value.replace(/^['"]|['"]$/g, '').trim());
}

function parseRows(text: string, startRow: number): ImportRow[] {
  const rows: ImportRow[] = [];
  let rowNumber = startRow;
  for (const line of text.replace(/\r/g, '').split('\n')) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const email = String(cols[0] || '').trim().toLowerCase();
    rowNumber += 1;
    rows.push({
      rowNumber,
      email,
      normalizedEmail: email,
      firstName: cols[1] || null,
      lastName: cols[2] || null,
      company: cols[3] || null,
      valid: EMAIL_RE.test(email),
    });
  }
  return rows;
}

importsRouter.get('/', optionalAuth, async (_req, res) => {
  return res.json({ imports: Array.from(memoryImports.values()) });
});

importsRouter.post('/start', optionalAuth, async (req, res) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const name = String(req.body?.name || req.body?.filename || 'Email import').trim().slice(0, 200);
  const filename = String(req.body?.filename || name).trim().slice(0, 255);
  const sourceSizeBytes = Math.max(0, Number(req.body?.sourceSizeBytes || 0));

  const listId = `lst_${Date.now()}`;
  db.contactLists.push({
    id: listId,
    name,
    description: `Imported audience · ${filename}`,
    memberCount: 0,
    createdAt: new Date().toISOString(),
  });

  const importId = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const record = {
    id: importId,
    user_id: userId,
    name,
    original_filename: filename,
    status: 'PROCESSING',
    list_id: listId,
    source_size_bytes: sourceSizeBytes,
    upload_offset_bytes: 0,
    processed_rows: 0,
    total_rows: 0,
    valid_rows: 0,
    invalid_rows: 0,
    duplicate_rows: 0,
    suppressed_rows: 0,
    imported_rows: 0,
    started_at: new Date().toISOString(),
    parser_tail: '',
  };
  memoryImports.set(importId, record);

  return res.status(201).json({ success: true, import: record });
});

importsRouter.post('/:id/chunk', optionalAuth, async (req, res) => {
  const userId = req.user?.id || await convexService.getDefaultUserId();
  const importId = req.params.id;
  const found = memoryImports.get(importId);
  if (!found) return res.status(404).json({ error: 'Import not found' });
  if (['COMPLETED', 'CANCELLED'].includes(found.status)) {
    return res.status(409).json({ error: `Import is ${found.status.toLowerCase()}` });
  }

  const chunk = String(req.body?.chunk || '');
  const chunkId = String(req.body?.chunkId || '');
  const offset = Math.max(0, Number(req.body?.offset || 0));
  const sourceSizeBytes = Math.max(0, Number(req.body?.sourceSizeBytes || found.source_size_bytes || 0));

  if (!chunk) return res.status(400).json({ error: 'Chunk is required' });
  if (!chunkId) return res.status(400).json({ error: 'chunkId is required' });

  const combined = String(found.parser_tail || '') + chunk;
  const parts = combined.replace(/\r/g, '').split('\n');
  const tail = parts.pop() || '';
  const rows = parseRows(parts.join('\n'), Number(found.processed_rows || 0));

  const suppressions = await convexService.getSuppressions(userId);
  const suppressedSet = new Set(suppressions.map((s) => s.email.toLowerCase()));

  let imported = 0;
  let invalid = 0;
  let duplicate = 0;
  let suppressed = 0;

  for (const row of rows) {
    if (!row.valid) {
      invalid++;
      continue;
    }
    if (suppressedSet.has(row.normalizedEmail)) {
      suppressed++;
      continue;
    }
    await convexService.saveContact(
      {
        email: row.normalizedEmail,
        firstName: row.firstName || undefined,
        lastName: row.lastName || undefined,
        company: row.company || undefined,
        tags: ['import'],
        status: 'ACTIVE',
      },
      userId
    );
    imported++;
  }

  const receivedBytes = Buffer.byteLength(chunk, 'utf8');
  const nextOffset = offset + receivedBytes;
  found.parser_tail = tail;
  found.upload_offset_bytes = nextOffset;
  found.processed_rows += rows.length;
  found.total_rows += rows.length;
  found.valid_rows += rows.filter((r) => r.valid).length;
  found.invalid_rows += invalid;
  found.suppressed_rows += suppressed;
  found.imported_rows += imported;
  found.duplicate_rows += duplicate;

  return res.json({
    success: true,
    import: found,
    processedRows: found.processed_rows,
    nextOffset,
    completeBytes: sourceSizeBytes > 0 && nextOffset >= sourceSizeBytes,
  });
});

importsRouter.post('/:id/complete', optionalAuth, async (req, res) => {
  const importId = req.params.id;
  const found = memoryImports.get(importId);
  if (!found) return res.status(404).json({ error: 'Import not found' });

  found.status = 'COMPLETED';
  found.completed_at = new Date().toISOString();
  return res.json({ success: true, import: found });
});

importsRouter.post('/:id/cancel', optionalAuth, async (req, res) => {
  const importId = req.params.id;
  const found = memoryImports.get(importId);
  if (!found) return res.status(404).json({ error: 'Import not found' });

  found.status = 'CANCELLED';
  found.completed_at = new Date().toISOString();
  return res.json({ success: true, import: found });
});
