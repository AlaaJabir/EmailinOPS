import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { convexService } from '../services/ConvexService.js';

export const importsRouter = Router();
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
const CONVEX_ID_REGEX = /^[a-z0-9]{32}$/i;

export function isValidConvexId(id?: string | null): boolean {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  return CONVEX_ID_REGEX.test(trimmed);
}

type ImportRow = {
  rowNumber: number;
  email: string;
  normalizedEmail: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  valid: boolean;
};

function detectDelimiter(line: string): string {
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = -1;
  for (const delimiter of candidates) {
    let quoted = false;
    let count = 0;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') i += 1;
        else quoted = !quoted;
      } else if (ch === delimiter && !quoted) {
        count += 1;
      }
    }
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

function parseCsvLine(line: string, delimiter: string): string[] {
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
    } else if (ch === delimiter && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out.map((value) => value.replace(/^['"]|['"]$/g, '').trim());
}

function findEmailColumn(headers: string[]): number {
  const normalized = headers.map((value) => value.toLowerCase().replace(/[\s_-]+/g, ''));
  const preferred = ['email', 'emailaddress', 'mail', 'emailid', 'e-mail', 'recipient', 'contact'];
  return normalized.findIndex((value) => preferred.includes(value));
}

// NOTE: parseRows/detectDelimiter/parseCsvLine/findEmailColumn are kept for
// potential future server-side parsing needs, but the /:id/chunk route below
// no longer uses them — the client (CsvImportWizardModal) already parses CSV
// rows before sending them, and the route previously re-parsed a `chunk`
// field the client never sent, which made every chunk request fail.
function parseRows(text: string, startRow: number): ImportRow[] {
  const rows: ImportRow[] = [];
  const lines = text.replace(/\r/g, '').split('\n').filter((line) => line.trim().length > 0);
  if (!lines.length) return rows;

  const firstLine = lines[0];
  const delimiter = detectDelimiter(firstLine);
  const firstCols = parseCsvLine(firstLine, delimiter);
  const headerEmailColumn = findEmailColumn(firstCols);

  // A line is considered a header row ONLY if it has a header name AND has no valid email address
  const firstLineHasEmail = EMAIL_REGEX.test(firstLine);
  const hasHeader = headerEmailColumn >= 0 && !firstLineHasEmail;
  const dataLines = hasHeader ? lines.slice(1) : lines;

  let rowNumber = startRow;
  for (const line of dataLines) {
    rowNumber += 1;
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(EMAIL_REGEX);
    if (!match) {
      rows.push({
        rowNumber,
        email: '',
        normalizedEmail: '',
        firstName: null,
        lastName: null,
        company: null,
        valid: false,
      });
      continue;
    }

    const email = match[0].toLowerCase();
    let firstName: string | null = null;
    let lastName: string | null = null;
    let company: string | null = null;

    if (delimiter && trimmed.includes(delimiter)) {
      const cols = parseCsvLine(trimmed, delimiter);
      const emailIdx = cols.findIndex((c) => c.toLowerCase().includes(email));
      const otherCols = cols.filter((_, idx) => idx !== emailIdx);
      if (otherCols.length >= 1 && otherCols[0]) firstName = otherCols[0];
      if (otherCols.length >= 2 && otherCols[1]) lastName = otherCols[1];
      if (otherCols.length >= 3 && otherCols[2]) company = otherCols[2];
    } else if (trimmed.includes('<') && trimmed.includes('>')) {
      const namePart = trimmed.split('<')[0].replace(/['"]/g, '').trim();
      if (namePart) {
        const parts = namePart.split(/\s+/);
        firstName = parts[0] || null;
        if (parts.length > 1) lastName = parts.slice(1).join(' ') || null;
      }
    }

    rows.push({
      rowNumber,
      email,
      normalizedEmail: email,
      firstName,
      lastName,
      company,
      valid: true,
    });
  }
  return rows;
}

function formatImportJob(j: any) {
  if (!j) return null;
  const startedAt = j.startedAt || j.createdAt || j.created_at || new Date().toISOString();
  return {
    id: j._id || j.id,
    user_id: j.userId,
    name: j.name,
    original_filename: j.originalFilename || j.original_filename || j.name,
    list_id: j.listId || j.list_id,
    list_name: j.listName || j.list_name || j.name,
    status: j.status,
    source_size_bytes: j.sourceSizeBytes ?? j.source_size_bytes ?? 0,
    upload_offset_bytes: j.uploadOffsetBytes ?? j.upload_offset_bytes ?? 0,
    processed_rows: j.processedRows ?? j.processed_rows ?? 0,
    total_rows: j.totalRows ?? j.total_rows ?? j.processedRows ?? 0,
    valid_rows: j.validRows ?? j.valid_rows ?? 0,
    invalid_rows: j.invalidRows ?? j.invalid_rows ?? 0,
    duplicate_rows: j.duplicateRows ?? j.duplicate_rows ?? 0,
    suppressed_rows: j.suppressedRows ?? j.suppressed_rows ?? 0,
    imported_rows: j.importedRows ?? j.imported_rows ?? 0,
    created_at: startedAt,
    started_at: startedAt,
    completed_at: j.completedAt || j.completed_at || null,
    updated_at: j.updatedAt || j.updated_at || new Date().toISOString(),
    // Also include camelCase fields so both styles are completely satisfied
    userId: j.userId,
    originalFilename: j.originalFilename || j.original_filename || j.name,
    listId: j.listId || j.list_id,
    listName: j.listName || j.list_name || j.name,
    sourceSizeBytes: j.sourceSizeBytes ?? j.source_size_bytes ?? 0,
    uploadOffsetBytes: j.uploadOffsetBytes ?? j.upload_offset_bytes ?? 0,
    processedRows: j.processedRows ?? j.processed_rows ?? 0,
    totalRows: j.totalRows ?? j.total_rows ?? j.processedRows ?? 0,
    validRows: j.validRows ?? j.valid_rows ?? 0,
    invalidRows: j.invalidRows ?? j.invalid_rows ?? 0,
    duplicateRows: j.duplicateRows ?? j.duplicate_rows ?? 0,
    suppressedRows: j.suppressedRows ?? j.suppressed_rows ?? 0,
    importedRows: j.importedRows ?? j.imported_rows ?? 0,
    startedAt: startedAt,
    completedAt: j.completedAt || j.completed_at || null,
  };
}

function getClient() {
  const client = convexService.getClient();
  if (!client || !convexService.isConfigured) throw new Error('Convex persistence is not configured');
  return client;
}

importsRouter.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || await convexService.getDefaultUserId();
    const rawList = await getClient().query('imports:list' as any, { userId });
    const formatted = Array.isArray(rawList) ? rawList.map(formatImportJob) : [];
    return res.json({ imports: formatted });
  } catch (err: any) {
    return res.status(503).json({ error: err?.message || String(err) });
  }
});

importsRouter.get('/:id', optionalAuth, async (req, res) => {
  try {
    const importId = req.params.id?.trim();
    if (!isValidConvexId(importId)) {
      return res.status(404).json({ error: 'Import not found' });
    }
    const userId = req.user?.id || await convexService.getDefaultUserId();
    const record = await getClient().query('imports:get' as any, { userId, id: importId });
    if (!record) return res.status(404).json({ error: 'Import not found' });
    return res.json({ import: formatImportJob(record) });
  } catch (err: any) {
    return res.status(503).json({ error: err?.message || String(err) });
  }
});

importsRouter.post('/start', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || await convexService.getDefaultUserId();
    const client = getClient();
    const name = String(req.body?.name || req.body?.filename || 'Contact import').trim().slice(0, 200);
    const filename = String(req.body?.filename || name).trim().slice(0, 255);
    const rawListId = String(req.body?.listId || '').trim();
    const listName = String(req.body?.listName || name).trim().slice(0, 200);
    const sourceSizeBytes = Math.max(0, Number(req.body?.sourceSizeBytes || 0));

    // Defensively resolve listId: ensure only valid 32-char Convex IDs are passed to Convex db.get
    let resolvedListId: string | undefined = undefined;
    if (isValidConvexId(rawListId)) {
      resolvedListId = rawListId;
    } else if (rawListId) {
      try {
        const existingLists = await client.query('contacts:listLists' as any, { userId });
        if (Array.isArray(existingLists)) {
          const match = existingLists.find(
            (l: any) => l._id === rawListId || (listName && l.name?.toLowerCase() === listName.toLowerCase())
          );
          if (match?._id && isValidConvexId(match._id)) {
            resolvedListId = match._id;
          }
        }
      } catch (e) {
        console.warn('[importsRouter] listId lookup warning:', e);
      }
    }

    const result = await client.mutation('imports:start' as any, {
      userId,
      name,
      originalFilename: filename,
      listId: resolvedListId,
      listName,
      listDescription: `Imported audience · ${filename}`,
      sourceSizeBytes,
      now: new Date().toISOString(),
    });
    const record = await client.query('imports:get' as any, { userId, id: result.importId });
    return res.status(201).json({ success: true, import: formatImportJob(record) });
  } catch (err: any) {
    return res.status(503).json({ error: err?.message || String(err) });
  }
});

importsRouter.post('/:id/chunk', optionalAuth, async (req, res) => {
  try {
    const importId = req.params.id?.trim();
    if (!isValidConvexId(importId)) {
      return res.status(404).json({ error: 'Import not found' });
    }
    const userId = req.user?.id || await convexService.getDefaultUserId();
    const client = getClient();
    const job = await client.query('imports:get' as any, { userId, id: importId });
    if (!job) return res.status(404).json({ error: 'Import not found' });
    if (['COMPLETED', 'CANCELLED'].includes(job.status)) {
      return res.status(409).json({ error: `Import is ${job.status.toLowerCase()}` });
    }

    const chunkId = String(req.body?.chunkId || '');
    const offset = Math.max(0, Number(req.body?.offset || 0));
    const nextOffsetRaw = req.body?.nextOffset;
    const nextOffset = nextOffsetRaw !== undefined && nextOffsetRaw !== null
      ? Math.max(0, Number(nextOffsetRaw))
      : offset;
    const parserTail = String(req.body?.parserTail || '');
    const invalidRows = Math.max(0, Number(req.body?.invalidRows || 0));

    // The client (CsvImportWizardModal) parses CSV rows in the browser and
    // sends the already-structured `rows` array — it does NOT send a raw
    // `chunk` text field. This route must consume `rows` directly.
    if (!chunkId) return res.status(400).json({ error: 'chunkId is required' });
    if (!Array.isArray(req.body?.rows)) {
      return res.status(400).json({ error: 'rows array is required' });
    }
    if (offset !== Number(job.uploadOffsetBytes || 0)) {
      return res.status(409).json({ error: 'OFFSET_MISMATCH', expectedOffset: job.uploadOffsetBytes || 0 });
    }

    const normalizedRows = (req.body.rows as any[])
      .map((row) => ({
        email: String(row?.email || '').trim().toLowerCase(),
        firstName: row?.firstName ? String(row.firstName).slice(0, 200) : undefined,
        lastName: row?.lastName ? String(row.lastName).slice(0, 200) : undefined,
        company: row?.company ? String(row.company).slice(0, 200) : undefined,
      }))
      .filter((row) => EMAIL_REGEX.test(row.email));

    const emails = normalizedRows.map((row) => row.email);
    const suppressedEmails = emails.length > 0
      ? await client.query('suppressions:findMany' as any, { userId, emails })
      : [];

    const updated = await client.mutation('imports:processChunk' as any, {
      userId,
      importId,
      chunkId,
      offset,
      nextOffset,
      parserTail,
      rows: normalizedRows,
      invalidRows,
      suppressedEmails,
      now: new Date().toISOString(),
    });

    const formatted = formatImportJob(updated);
    return res.json({
      success: true,
      import: formatted,
      processedRows: formatted?.processed_rows,
      nextOffset: formatted?.upload_offset_bytes,
    });
  } catch (err: any) {
    const message = err?.message || String(err);
    const offsetMatch = message.match(/^OFFSET_MISMATCH:(\d+)$/);
    if (offsetMatch) return res.status(409).json({ error: 'OFFSET_MISMATCH', expectedOffset: Number(offsetMatch[1]) });
    return res.status(503).json({ error: message });
  }
});

importsRouter.post('/:id/complete', optionalAuth, async (req, res) => {
  try {
    const importId = req.params.id?.trim();
    if (!isValidConvexId(importId)) {
      return res.status(404).json({ error: 'Import not found' });
    }
    const userId = req.user?.id || await convexService.getDefaultUserId();
    const client = getClient();
    const job = await client.query('imports:get' as any, { userId, id: importId });
    if (!job) return res.status(404).json({ error: 'Import not found' });
    const record = await client.mutation('imports:complete' as any, {
      userId,
      importId,
      now: new Date().toISOString(),
      finalOffset: Number(job.uploadOffsetBytes || 0),
      parserTail: String(job.parserTail || ''),
    });
    return res.json({ success: true, import: formatImportJob(record) });
  } catch (err: any) {
    return res.status(409).json({ error: err?.message || String(err) });
  }
});

importsRouter.post('/:id/cancel', optionalAuth, async (req, res) => {
  try {
    const importId = req.params.id?.trim();
    if (!isValidConvexId(importId)) {
      return res.status(404).json({ error: 'Import not found' });
    }
    const userId = req.user?.id || await convexService.getDefaultUserId();
    const record = await getClient().mutation('imports:cancel' as any, {
      userId,
      importId,
      now: new Date().toISOString(),
    });
    return res.json({ success: true, import: formatImportJob(record) });
  } catch (err: any) {
    return res.status(409).json({ error: err?.message || String(err) });
  }
});

importsRouter.post('/:id/fail', optionalAuth, async (req, res) => {
  try {
    const importId = req.params.id?.trim();
    if (!isValidConvexId(importId)) {
      return res.status(404).json({ error: 'Import not found' });
    }
    const userId = req.user?.id || await convexService.getDefaultUserId();
    const record = await getClient().mutation('imports:fail' as any, {
      userId,
      importId,
      now: new Date().toISOString(),
    });
    return res.json({ success: true, import: formatImportJob(record) });
  } catch (err: any) {
    return res.status(409).json({ error: err?.message || String(err) });
  }
});
