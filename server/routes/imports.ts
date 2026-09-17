import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { convexService } from '../services/ConvexService.js';

export const importsRouter = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ROWS_PER_CHUNK = 500;

type ImportRow = {
  rowNumber: number;
  email: string;
  normalizedEmail: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  valid: boolean;
};

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

function getClient() {
  const client = convexService.getClient();
  if (!client || !convexService.isConfigured) {
    throw new Error('Convex persistence is not configured');
  }
  return client;
}

importsRouter.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || await convexService.getDefaultUserId();
    const client = getClient();
    const imports = await client.query('imports:list' as any, { userId });
    return res.json({ imports });
  } catch (err: any) {
    return res.status(503).json({ error: err?.message || String(err) });
  }
});

importsRouter.get('/:id', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || await convexService.getDefaultUserId();
    const client = getClient();
    const record = await client.query('imports:get' as any, { userId, id: req.params.id });
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
    const now = new Date().toISOString();

    const result = await client.mutation('imports:start' as any, {
      userId,
      name,
      originalFilename: filename,
      listName: name,
      listDescription: `Imported audience · ${filename}`,
      sourceSizeBytes,
      now,
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
    if (['COMPLETED', 'CANCELLED'].includes(job.status)) {
      return res.status(409).json({ error: `Import is ${job.status.toLowerCase()}` });
    }

    const chunk = String(req.body?.chunk || '');
    const chunkId = String(req.body?.chunkId || '');
    const offset = Math.max(0, Number(req.body?.offset || 0));
    const sourceSizeBytes = Math.max(0, Number(req.body?.sourceSizeBytes || job.sourceSizeBytes || 0));
    if (!chunk) return res.status(400).json({ error: 'Chunk is required' });
    if (!chunkId) return res.status(400).json({ error: 'chunkId is required' });
    if (offset !== Number(job.uploadOffsetBytes || 0)) {
      return res.status(409).json({ error: 'OFFSET_MISMATCH', expectedOffset: job.uploadOffsetBytes || 0 });
    }

    const combined = String(job.parserTail || '') + chunk;
    const parts = combined.replace(/\r/g, '').split('\n');
    const tail = parts.pop() || '';
    const rows = parseRows(parts.join('\n'), Number(job.processedRows || 0));
    const invalidRows = rows.filter((row) => !row.valid).length;
    const validRows = rows.filter((row) => row.valid).slice(0, MAX_ROWS_PER_CHUNK);
    if (rows.filter((row) => row.valid).length > MAX_ROWS_PER_CHUNK) {
      return res.status(413).json({ error: `Chunk contains too many rows. Maximum is ${MAX_ROWS_PER_CHUNK}.` });
    }

    const suppressions = await convexService.getSuppressions(userId);
    const suppressedEmails = suppressions.map((item) => item.email.trim().toLowerCase());
    const receivedBytes = Buffer.byteLength(chunk, 'utf8');
    const nextOffset = offset + receivedBytes;
    const now = new Date().toISOString();

    const updated = await client.mutation('imports:processChunk' as any, {
      userId,
      importId,
      chunkId,
      offset,
      nextOffset,
      parserTail: tail,
      rows: validRows.map((row) => ({
        email: row.normalizedEmail,
        firstName: row.firstName || undefined,
        lastName: row.lastName || undefined,
        company: row.company || undefined,
      })),
      invalidRows,
      suppressedEmails,
      now,
    });

    return res.json({
      success: true,
      import: updated,
      processedRows: updated.processedRows,
      nextOffset: updated.uploadOffsetBytes,
      completeBytes: sourceSizeBytes > 0 && updated.uploadOffsetBytes >= sourceSizeBytes,
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
    const userId = req.user?.id || await convexService.getDefaultUserId();
    const client = getClient();
    const job = await client.query('imports:get' as any, { userId, id: req.params.id });
    if (!job) return res.status(404).json({ error: 'Import not found' });
    const now = new Date().toISOString();
    const record = await client.mutation('imports:complete' as any, {
      userId,
      importId: req.params.id,
      now,
      finalOffset: Number(job.uploadOffsetBytes || 0),
      parserTail: String(job.parserTail || ''),
    });
    return res.json({ success: true, import: record });
  } catch (err: any) {
    return res.status(409).json({ error: err?.message || String(err) });
  }
});

importsRouter.post('/:id/cancel', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || await convexService.getDefaultUserId();
    const client = getClient();
    const record = await client.mutation('imports:cancel' as any, {
      userId,
      importId: req.params.id,
      now: new Date().toISOString(),
    });
    return res.json({ success: true, import: record });
  } catch (err: any) {
    return res.status(409).json({ error: err?.message || String(err) });
  }
});
