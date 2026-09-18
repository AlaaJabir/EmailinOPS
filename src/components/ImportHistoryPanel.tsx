import React, { useEffect, useRef, useState } from 'react';
import { Archive, CheckCircle2, ClipboardPaste, Loader2, Play, Upload, XCircle } from 'lucide-react';

interface AudienceList {\n  id: string;\n  name: string;\n  description?: string;\n  memberCount?: number;\n}\n\ninterface ImportRecord {
  id: string;
  name: string;
  original_filename?: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  suppressed_rows: number;
  imported_rows: number;
  processed_rows: number;
  list_id?: string | null;
  source_size_bytes?: number;
  upload_offset_bytes?: number;
  created_at: string;
  completed_at?: string | null;
  error_message?: string | null;
}

const resumeKey = (file: File) => `emailops-import:${file.name}:${file.size}`;

const readJson = async <T = any>(response: Response, fallbackMessage: string): Promise<T> => {
  const text = await response.text();
  let data: any = null;

  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      const contentType = response.headers.get('content-type') || 'unknown';
      const looksLikeHtml = /<\s*!doctype\s+html|<\s*html[\s>]/i.test(text);
      if (looksLikeHtml) {
        throw new Error(`API returned HTML instead of JSON (HTTP ${response.status}). Check the API server, Nginx proxy, and VITE_API_BASE_URL.`);
      }
      throw new Error(`Invalid API response (HTTP ${response.status}, ${contentType}).`);
    }
  } else {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || fallbackMessage);
  }

  return data as T;
};

export const ImportHistoryPanel: React.FC<{
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onUseAudience: (listId: string) => void;
}> = ({ authFetch, onUseAudience }) => {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [current, setCurrent] = useState<ImportRecord | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const normalizeImportRecord = (raw: any): ImportRecord => ({
    id: String(raw?.id ?? raw?._id ?? ''),
    name: String(raw?.name ?? ''),
    original_filename: raw?.original_filename ?? raw?.originalFilename ?? '',
    status: String(raw?.status ?? 'PROCESSING'),
    total_rows: Number(raw?.total_rows ?? raw?.totalRows ?? 0),
    valid_rows: Number(raw?.valid_rows ?? raw?.validRows ?? 0),
    invalid_rows: Number(raw?.invalid_rows ?? raw?.invalidRows ?? 0),
    duplicate_rows: Number(raw?.duplicate_rows ?? raw?.duplicateRows ?? 0),
    suppressed_rows: Number(raw?.suppressed_rows ?? raw?.suppressedRows ?? 0),
    imported_rows: Number(raw?.imported_rows ?? raw?.importedRows ?? 0),
    processed_rows: Number(raw?.processed_rows ?? raw?.processedRows ?? 0),
    list_id: raw?.list_id ?? raw?.listId ?? null,
    source_size_bytes: Number(raw?.source_size_bytes ?? raw?.sourceSizeBytes ?? 0),
    upload_offset_bytes: Number(raw?.upload_offset_bytes ?? raw?.uploadOffsetBytes ?? 0),
    created_at:
      raw?.created_at ??
      raw?.createdAt ??
      (raw?._creationTime
        ? new Date(Number(raw._creationTime)).toISOString()
        : new Date().toISOString()),
    completed_at: raw?.completed_at ?? raw?.completedAt ?? null,
    error_message: raw?.error_message ?? raw?.errorMessage ?? null,
  });

  const load = async () => {
    try {
      const r = await authFetch('/api/imports');
      const d = await readJson<{ imports?: ImportRecord[] }>(r, 'Failed to load import history');
      setImports((d.imports || []).map(normalizeImportRecord));
    } catch (e: any) {
      setError(e.message || 'Failed to load import history');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const importFile = async (file: File) => {
    setUploading(true);
    setError('');

    try {
      const historyResponse = await authFetch('/api/imports');
      const historyData = await readJson<{ imports?: ImportRecord[] }>(historyResponse, 'Failed to load import history');
      const history: ImportRecord[] = (historyData.imports || []).map(normalizeImportRecord);

      const savedId = localStorage.getItem(resumeKey(file));
      let imp = savedId ? history.find((item) => item.id === savedId) : undefined;
      if (!imp) {
        imp = history.find(
          (item) =>
            ['PROCESSING', 'FAILED'].includes(item.status) &&
            item.original_filename === file.name &&
            Number(item.source_size_bytes || 0) === file.size,
        );
      }

      if (!imp) {
        const start = await authFetch('/api/imports/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, filename: file.name, sourceSizeBytes: file.size, listId: selectedListId, listName: lists.find((list) => list.id === selectedListId)?.name }),
        });
        const sd = await readJson<{ import: ImportRecord }>(start, 'Could not start import');
        imp = normalizeImportRecord(sd.import);
        if (!imp.id) throw new Error('Import API returned no import id.');
      }

      localStorage.setItem(resumeKey(file), imp.id);
      setCurrent(imp);

      const chunkSize = 512 * 1024;
      let offset = Math.max(0, Number(imp.upload_offset_bytes || 0));
      if (offset > file.size) throw new Error('Stored import offset is larger than the selected file. Start a fresh import.');

      while (offset < file.size) {
        let end = Math.min(offset + chunkSize, file.size);
        if (end < file.size) {
          const probe = await file.slice(offset, end).text();
          const cut = probe.lastIndexOf('\n');
          if (cut > 0) end = offset + cut + 1;
        }

        const chunk = await file.slice(offset, end).text();
        const chunkId = `${file.name}:${file.size}:${offset}:${end}`;
        const r = await authFetch(`/api/imports/${imp.id}/chunk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chunk, chunkId, offset, sourceSizeBytes: file.size }),
        });
        const d = await readJson<{ import: ImportRecord; nextOffset?: number }>(r, 'Import chunk failed');

        imp = normalizeImportRecord(d.import);
        if (!imp.id) throw new Error('Import chunk response returned no import id.');
        setCurrent(imp);
        offset = Number(d.nextOffset ?? imp.upload_offset_bytes ?? end);
      }

      const done = await authFetch(`/api/imports/${imp.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const dd = await readJson<{ import: ImportRecord }>(done, 'Import completion failed');

      localStorage.removeItem(resumeKey(file));
      setCurrent(normalizeImportRecord(dd.import));
      await load();
    } catch (e: any) {
      setError(e.message || 'Import failed');
      await load();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const progress = current?.source_size_bytes
    ? Math.min(100, ((current.upload_offset_bytes || 0) / current.source_size_bytes) * 100)
    : current?.status === 'COMPLETED'
      ? 100
      : 0;

  return (
    <section className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Archive className="w-4 h-4" />Import History & Reusable Audiences</h2>
          <p className="text-xs text-[#888888] mt-1">Import contacts into an existing audience. Upload a CSV/TXT file or paste contacts directly.</p>
        </div>
        <button disabled={uploading} onClick={openImportPicker} className="flex items-center gap-2 px-4 py-2 rounded-sm bg-white text-black text-xs font-semibold disabled:opacity-50">
          <Upload className="w-3.5 h-3.5" />{uploading ? 'Importing…' : 'Import Contacts'}
        </button>
        <input ref={fileRef} hidden type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); }} />
      </div>

      {current && (
        <div className="p-4 rounded-sm bg-[#050505] border border-white-10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white font-medium">{current.original_filename || current.name}</span>
            <span className="text-[#888888] font-mono">{current.status}</span>
          </div>
          <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-white transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-2 text-[10px] text-[#888888] font-mono">
            {current.source_size_bytes ? `${Math.round(progress)}% uploaded · ` : ''}
            Processed: {current.processed_rows || 0} · Imported: {current.imported_rows || 0} · Duplicates: {current.duplicate_rows || 0} · Suppressed: {current.suppressed_rows || 0} · Invalid: {current.invalid_rows || 0}
          </div>
        </div>
      )}

      {error && <div className="text-xs text-red-400 flex items-center gap-2"><XCircle className="w-3.5 h-3.5" />{error}</div>}

      {showImportPicker && (<div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#0F0F0F] p-5 shadow-2xl text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Import Contacts</h3>
                <p className="text-[11px] text-[#888] mt-1">Choose the audience that should receive these contacts.</p>
              </div>
              <button type="button" onClick={() => setShowImportPicker(false)} className="text-[#888] hover:text-white">×</button>
            </div>
            <label className="block text-[10px] uppercase tracking-[0.12em] text-[#777] mb-2">Audience List</label>
            <select value={selectedListId} onChange={(e) => setSelectedListId(e.target.value)} className="w-full rounded border border-white/10 bg-[#050505] px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30">
              <option value="">Select an audience list…</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>{list.name}{typeof list.memberCount === 'number' ? ' (' + list.memberCount + ')' : ''}</option>
              ))}
            </select>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={!selectedListId} onClick={chooseFile} className="flex flex-col items-center justify-center gap-2 rounded border border-white/10 bg-[#050505] px-3 py-4 text-xs text-white hover:border-white/30 disabled:opacity-40">
                <Upload className="w-4 h-4" /><span className="font-semibold">Upload File</span><span className="text-[10px] text-[#666]">CSV / TXT</span>
              </button>
              <button type="button" disabled={!selectedListId} onClick={() => setImportMethod('paste')} className="flex flex-col items-center justify-center gap-2 rounded border border-white/10 bg-[#050505] px-3 py-4 text-xs text-white hover:border-white/30 disabled:opacity-40">
                <ClipboardPaste className="w-4 h-4" /><span className="font-semibold">Paste Contacts</span><span className="text-[10px] text-[#666]">CSV / email list</span>
              </button>
            </div>
            {importMethod === 'paste' && (
              <div className="mt-4">
                <textarea value={pasteValue} onChange={(e) => setPasteValue(e.target.value)} placeholder={"email,name\ncontact@example.com,John\nother@example.com,Jane"} className="w-full min-h-36 resize-y rounded border border-white/10 bg-[#050505] px-3 py-2 text-xs text-white placeholder:text-[#555] focus:outline-none focus:border-white/30 font-mono" autoFocus />
                <div className="flex justify-end gap-2 mt-3">
                  <button type="button" onClick={() => setShowImportPicker(false)} className="px-3 py-2 rounded border border-white/10 text-xs text-[#aaa] hover:text-white">Cancel</button>
                  <button type="button" disabled={!selectedListId || !pasteValue.trim() || uploading} onClick={startPasteImport} className="px-3 py-2 rounded bg-white text-black text-xs font-semibold disabled:opacity-40">Import Pasted Contacts</button>
                </div>
              </div>
            )}
            {importMethod === 'file' && (
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowImportPicker(false)} className="px-3 py-2 rounded border border-white/10 text-xs text-[#aaa] hover:text-white">Cancel</button>
                <button type="button" disabled={!selectedListId} onClick={chooseFile} className="px-3 py-2 rounded bg-white text-black text-xs font-semibold disabled:opacity-40">Choose CSV / TXT</button>
              </div>
            )}
          </div>
        </div>)}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead><tr className="border-b border-white-10 text-[10px] uppercase tracking-[0.12em] text-[#888888]"><th className="py-2">Audience</th><th>Status</th><th>Rows</th><th>Imported</th><th>Created</th><th /></tr></thead>
          <tbody className="divide-y divide-white/5 font-mono text-[11px]">
            {imports.map((item) => (
              <tr key={item.id} className="hover:bg-white/5">
                <td className="py-3 text-white"><div>{item.name}</div><div className="text-[10px] text-[#666]">{item.original_filename}</div></td>
                <td className="py-3"><span className="inline-flex items-center gap-1">{item.status === 'COMPLETED' ? <CheckCircle2 className="w-3 h-3" /> : item.status === 'PROCESSING' ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="w-2 h-2 rounded-full bg-white/30" />}{item.status}</span></td>
                <td className="py-3 text-[#aaa]">{item.total_rows || item.processed_rows || 0}</td>
                <td className="py-3 text-[#aaa]">{item.imported_rows || 0}</td>
                <td className="py-3 text-[#777]">{new Date(item.created_at).toLocaleString()}</td>
                <td className="py-3 text-right">{item.list_id && item.status === 'COMPLETED' && <button onClick={() => onUseAudience(item.list_id!)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white text-black rounded-sm text-[10px] font-semibold"><Play className="w-3 h-3" />Use audience</button>}</td>
              </tr>
            ))}
            {!imports.length && <tr><td colSpan={6} className="py-8 text-center text-[#666]">No imports yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
};
