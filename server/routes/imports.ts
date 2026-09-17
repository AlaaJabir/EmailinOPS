import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { convexService } from '../services/ConvexService.js';

export const importsRouter = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ROWS_PER_CHUNK = 100;

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

function looksLikeEmail(value: unknown): boolean {
  return EMAIL_RE.test(String(value || '').trim().toLowerCase());
}

function findEmailColumn(headers: string[]): number {
  const normalized = headers.map((value) => value.toLowerCase().replace(/[\s_-]+/g, ''));
  const preferred = ['email', 'emailaddress', 'mail', 'emailid', 'e-mail'];
  const preferredIndex = normalized.findIndex((value) => preferred.includes(value));
  return preferredIndex;
}

function parseRows(text: string, startRow: number): ImportRow[] {
  const rows: ImportRow[] = [];
  const lines = text.replace(/\r/g, '').split('\n').filter((line) => line.trim());
  if (!lines.length) return rows;

  const delimiter = detectDelimiter(lines[0]);
  const firstCols = parseCsvLine(lines[0], delimiter);
  const headerEmailColumn = findEmailColumn(firstCols);
  const hasHeader = headerEmailColumn >= 0;
  const emailColumn = hasHeader ? headerEmailColumn : -1;
  const dataLines = hasHeader ? lines.slice(1) : lines;

  let rowNumber = startRow;
  for (const line of dataLines) {
    const cols = parseCsvLine(line, delimiter);
    rowNumber += 1;

    let emailIndex = emailColumn;
    if (emailIndex < 0 || !looksLikeEmail(cols[emailIndex])) {
      emailIndex = cols.findIndex((value) => looksLikeEmail(value));
    }

    const email = emailIndex >= 0 ? String(cols[emailIndex] || '').trim().toLowerCase() : '';
    rows.push({
      rowNumber,
      email,
      normalizedEmail: email,
      firstName: null,
      lastName: null,
      company: null,
      valid: EMAIL_RE.test(email),
    });
  }
  return rows;
}

function getClient() {
  const client = convexService.getClient();
  if (!client || !convexService.isConfigured) throw new Error('Convex persistence is not configured');
  return client;
}

importsRouter.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || await convexService.getDefaultUserId();
    return res.json({ imports: await getClient().query('imports:list' as any, { userId }) });
  } catch (err: any) {
    return res.status(503).json({ error: err?.message || String(err) });
  }
});

importsRouter.get('/:id', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || await convexService.getDefaultUserId();
    const record = await getClient().query('imports:get' as any, { userId, id: req.params.id });
    if (!record) return res.status(404).json({ error: 'Import not found' });
    return res.json({ import: record });
  } catch (err: any) {
    return res.status(503).json({ error: err?.message || String(err) });
  }
});

importsRouter.post('/start', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || await convexService.getDefaultUserId();
    const client = getClient();
    const name = String(req.body?.name || req.body?.filename || 'Email import').trim().slice(0, 200);
    const filename = String(req.body?.filename || name).trim().slice(0, 255);
    const sourceSizeBytes = Math.max(0, Number(req.body?.sourceSizeBytes || 0));
    const result = await client.mutation('imports:start' as any, {
      userId, name, originalFilename: filename, listName: name,
      listDescription: `Imported audience · ${filename}`, sourceSizeBytes, now: new Date().toISOString(),
    });
    const record = await client.query('imports:get' as any, { userId, id: result.importId });
    return res.status(201).json({ success: true, import: record });
  } catch (err: any) {
    return res.status(503).json({ error: err?.message || String(err) });
  }
});

importsRouter.post('/:id/chunk', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || await convexService.getDefaultUserId();
    const client = getClient();
    const importId = req.params.id;
    const job = await client.query('imports:get' as any, { userId, id: importId });
    if (!job) return res.status(404).json({ error: 'Import not found' });
    if (['COMPLETED', 'CANCELLED'].includes(job.status)) return res.status(409).json({ error: `Import is ${job.status.toLowerCase()}` });

    const chunk = String(req.body?.chunk || '');
    const chunkId = String(req.body?.chunkId || '');
    const offset = Math.max(0, Number(req.body?.offset || 0));
    const sourceSizeBytes = Math.max(0, Number(req.body?.sourceSizeBytes || job.sourceSizeBytes || 0));
    if (!chunk) return res.status(400).json({ error: 'Chunk is required' });
    if (!chunkId) return res.status(400).json({ error: 'chunkId is required' });
    if (offset !== Number(job.uploadOffsetBytes || 0)) return res.status(409).json({ error: 'OFFSET_MISMATCH', expectedOffset: job.uploadOffsetBytes || 0 });

    const combined = String(job.parserTail || '') + chunk;
    const parts = combined.replace(/\r/g, '').split('\n');
    const tail = parts.pop() || '';
    const rows = parseRows(parts.join('\n'), Number(job.processedRows || 0));
    const invalidRows = rows.filter((row) => !row.valid).length;
    const validRows = rows.filter((row) => row.valid);
    if (validRows.length > MAX_ROWS_PER_CHUNK) return res.status(413).json({ error: `Chunk contains too many rows. Maximum is ${MAX_ROWS_PER_CHUNK}.` });

    const emails = validRows.map((row) => row.normalizedEmail);
    const suppressedEmails = await client.query('suppressions:findMany' as any, { userId, emails });
    const receivedBytes = Buffer.byteLength(chunk, 'utf8');
    const nextOffset = offset + receivedBytes;
    const updated = await client.mutation('imports:processChunk' as any, {
      userId, importId, chunkId, offset, nextOffset, parserTail: tail,
      rows: validRows.map((row) => ({ email: row.normalizedEmail })),
      invalidRows, suppressedEmails, now: new Date().toISOString(),
    });

    return res.json({ success: true, import: updated, processedRows: updated.processedRows, nextOffset: updated.uploadOffsetBytes, completeBytes: sourceSizeBytes > 0 && updated.uploadOffsetBytes >= sourceSizeBytes });
  } catch (err: any) {
    const message = err?.message || String(err);
    const offsetMatch = message.match(/^OFFSET_MISMATCH:(\d+)$/);
    if (offsetMatch) return res.status(409).json({ error: 'OFFSET_MISMATCH', expectedOffset: Number(offsetMatch[1]) });
    return res.status(503).json({ error: message });
  }
});

importsRouter.post('/:id/complete', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || await convexService.getDefaultUserId();
    const client = getClient();
    const job = await client.query('imports:get' as any, { userId, id: req.params.id });
    if (!job) return res.status(404).json({ error: 'Import not found' });
    const record = await client.mutation('imports:complete' as any, {
      userId, importId: req.params.id, now: new Date().toISOString(), finalOffset: Number(job.uploadOffsetBytes || 0), parserTail: String(job.parserTail || ''),
    });
    return res.json({ success: true, import: record });
  } catch (err: any) {
    return res.status(409).json({ error: err?.message || String(err) });
  }
});

importsRouter.post('/:id/cancel', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || await convexService.getDefaultUserId();
    const record = await getClient().mutation('imports:cancel' as any, { userId, importId: req.params.id, now: new Date().toISOString() });
    return res.json({ success: true, import: record });
  } catch (err: any) {
    return res.status(409).json({ error: err?.message || String(err) });
  }
});
