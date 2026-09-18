import React, { useEffect, useRef, useState } from 'react';
import { Archive, CheckCircle2, ClipboardPaste, Loader2, Trash2, Upload, XCircle, ListChecks } from 'lucide-react';

interface AudienceList {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
}

interface ImportRecord {
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
      const looksLikeHtml = /<\\s*!doctype\\s+html|<\\s*html[\\s>]/i.test(text);
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
  const [lists, setLists] = useState<AudienceList[]>([]);
  const [showImportPicker, setShowImportPicker] = useState(false);
  const [selectedListId, setSelectedListId] = useState('');
  const [importMethod, setImportMethod] = useState<'file' | 'paste'>('file');
  const [pasteValue, setPasteValue] = useState('');
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);

  const loadLists = async () => {
    try {
      const r = await authFetch('/api/contacts/lists');
      const d = await readJson<{ lists?: AudienceList[] }>(r, 'Failed to load audience lists');
      setLists(d.lists || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load audience lists');
    }
  };

  const openImportPicker = async () => {
    setError('');
    setImportMethod('file');
    setPasteValue('');
    await loadLists();
    setShowImportPicker(true);
  };

  const chooseFile = () => {
    setImportMethod('file');
    setShowImportPicker(false);
    setTimeout(() => fileRef.current?.click(), 0);
  };

  const toggleListSelection = (id: string) => {
    setSelectedListIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const deleteSelectedLists = async () => {
    if (!selectedListIds.length) return;
    if (!window.confirm('Delete selected audience lists? Contacts themselves will not be deleted.')) return;
    try {
      await Promise.all(selectedListIds.map((id) => authFetch('/api/contacts/lists/' + id, { method: 'DELETE' }).then((r) => readJson(r, 'Failed to delete audience list'))));
      if (selectedListIds.includes(selectedListId)) setSelectedListId('');
      setSelectedListIds([]);
      await loadLists();
    } catch (e: any) {
      setError(e.message || 'Failed to delete audience list');
    }
  };

  const startPasteImport = async () => {
    if (!selectedListId || !pasteValue.trim()) return;
    const file = new File([pasteValue], 'pasted-contacts.csv', { type: 'text/csv' });
    setShowImportPicker(false);
    await importFile(file);
  };

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
          const cut = probe.lastIndexOf('\\n');
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
    <section className="space-y-5">
      <div className="sticky top-0 z-40 -mx-2 border-b border-slate-200 bg-white/95 px-2 py-3 shadow-sm backdrop-blur sm:-mx-4 sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-slate-900">
              <Archive className="h-5 w-5 shrink-0 text-indigo-600" />
              <h2 className="text-base font-semibold">Import Contacts</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">Choose an audience list, then upload a CSV/TXT file or paste contacts.</p>
          </div>
          <button
            disabled={uploading}
            onClick={openImportPicker}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Importing…' : 'Import Contacts'}
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
            }}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {lists.length > 0 && (
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Audience Lists</p>
                <p className="text-xs text-slate-500">{lists.length} list{lists.length === 1 ? '' : 's'} available</p>
              </div>
              {selectedListIds.length > 0 && (
                <button
                  onClick={deleteSelectedLists}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete selected ({selectedListIds.length})
                </button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {lists.map((list) => (
                <label
                  key={list.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 hover:border-indigo-200 hover:bg-indigo-50/40"
                >
                  <input
                    type="checkbox"
                    checked={selectedListIds.includes(list.id)}
                    onChange={() => toggleListSelection(list.id)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">{list.name}</div>
                    <div className="text-xs text-slate-500">{list.memberCount ?? 0} contacts</div>
                  </div>
                  <ListChecks className="h-4 w-4 text-slate-400" />
                </label>
              ))}
            </div>
          </div>
        )}

        {current && (
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-800">{current.original_filename || current.name}</span>
              <span className="font-mono text-xs text-slate-500">{current.status}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: progress + '%' }} />
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {current.source_size_bytes ? Math.round(progress) + '% uploaded · ' : ''}
              Processed: {current.processed_rows || 0} · Imported: {current.imported_rows || 0} · Duplicates: {current.duplicate_rows || 0} · Suppressed: {current.suppressed_rows || 0} · Invalid: {current.invalid_rows || 0}
            </div>
          </div>
        )}

        {error && (
          <div className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-600 flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>

      {showImportPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Import Contacts</h3>
                <p className="mt-1 text-xs text-slate-500">Select the audience list that should receive these contacts.</p>
              </div>
              <button type="button" onClick={() => setShowImportPicker(false)} className="text-xl leading-none text-slate-400 hover:text-slate-700">×</button>
            </div>
            <label className="mb-2 block text-xs font-semibold text-slate-600">Audience List</label>
            <select
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Select an audience list…</option>
              {lists.map((list) => <option key={list.id} value={list.id}>{list.name} ({list.memberCount ?? 0})</option>)}
            </select>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" disabled={!selectedListId} onClick={chooseFile} className="flex flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-5 text-sm text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 disabled:opacity-40">
                <Upload className="h-5 w-5 text-indigo-600" />
                <span className="font-semibold">Upload File</span>
                <span className="text-xs text-slate-400">CSV / TXT</span>
              </button>
              <button type="button" disabled={!selectedListId} onClick={() => setImportMethod('paste')} className="flex flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-5 text-sm text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 disabled:opacity-40">
                <ClipboardPaste className="h-5 w-5 text-indigo-600" />
                <span className="font-semibold">Paste Contacts</span>
                <span className="text-xs text-slate-400">CSV / email list</span>
              </button>
            </div>
            {importMethod === 'paste' && (
              <div className="mt-4">
                <textarea
                  value={pasteValue}
                  onChange={(e) => setPasteValue(e.target.value)}
                  placeholder={"email,name\ncontact@example.com,John\nother@example.com,Jane"}
                  className="min-h-36 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  autoFocus
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowImportPicker(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button type="button" disabled={!selectedListId || !pasteValue.trim() || uploading} onClick={startPasteImport} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">Import Pasted Contacts</button>
                </div>
              </div>
            )}
            {importMethod === 'file' && (
              <div className="mt-4 flex justify-end">
                <button type="button" onClick={() => setShowImportPicker(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
