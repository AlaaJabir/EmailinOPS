import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Loader2,
  Play,
  XCircle,
  Upload,
  FileText,
  AlertCircle,
  FolderPlus,
  RefreshCw,
  Clock,
} from 'lucide-react';

interface ImportRecord {
  id: string;
  name: string;
  original_filename?: string;
  status: string;
  total_rows?: number;
  valid_rows?: number;
  invalid_rows?: number;
  duplicate_rows?: number;
  suppressed_rows?: number;
  imported_rows?: number;
  processed_rows?: number;
  list_id?: string | null;
  list_name?: string | null;
  source_size_bytes?: number;
  upload_offset_bytes?: number;
  created_at?: string;
  started_at?: string;
  completed_at?: string | null;
  error_message?: string | null;
}

interface AudienceList {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
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
        throw new Error(
          `API returned HTML instead of JSON (HTTP ${response.status}). Check the API server, Nginx proxy, and VITE_API_BASE_URL.`
        );
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

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'Recent';
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return 'Recent';
  return parsed.toLocaleString();
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const ImportHistoryPanel: React.FC<{
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onUseAudience: (listId: string) => void;
}> = ({ authFetch, onUseAudience }) => {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [lists, setLists] = useState<AudienceList[]>([]);
  const [uploading, setUploading] = useState(false);
  const [current, setCurrent] = useState<ImportRecord | null>(null);
  const [error, setError] = useState('');
  const [showListPicker, setShowListPicker] = useState(false);
  const [selectedListId, setSelectedListId] = useState('');
  const [newAudienceName, setNewAudienceName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const r = await authFetch('/api/imports');
      const d = await readJson<{ imports?: ImportRecord[] }>(r, 'Failed to load import history');
      setImports(d.imports || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load import history');
    }
  };

  const loadLists = async () => {
    try {
      const r = await authFetch('/api/contacts/lists');
      const d = await readJson<{ lists?: AudienceList[] }>(r, 'Failed to load audience lists');
      const available = d.lists || [];
      setLists(available);
      if (!selectedListId && available[0]?.id) {
        setSelectedListId(available[0].id);
      }
      return available;
    } catch (e: any) {
      console.warn('Failed to load lists:', e);
      return [];
    }
  };

  useEffect(() => {
    load();
    loadLists();
  }, []);

  useEffect(() => {
    const openImportPicker = async () => {
      setError('');
      try {
        const available = await loadLists();
        if (!available.length) {
          setIsCreatingNew(true);
        }
        setShowListPicker(true);
      } catch (e: any) {
        setError(e.message || 'Failed to load audience lists');
      }
    };
    window.addEventListener('emailops:open-import', openImportPicker);
    return () => window.removeEventListener('emailops:open-import', openImportPicker);
  }, [selectedListId]);

  const chooseListAndOpenFile = () => {
    if (!isCreatingNew && !selectedListId) return;
    if (isCreatingNew && !newAudienceName.trim()) return;
    setShowListPicker(false);
    window.setTimeout(() => fileRef.current?.click(), 0);
  };

  const importFile = async (file: File) => {
    setUploading(true);
    setError('');

    try {
      const historyResponse = await authFetch('/api/imports');
      const historyData = await readJson<{ imports?: ImportRecord[] }>(
        historyResponse,
        'Failed to load import history'
      );
      const history: ImportRecord[] = historyData.imports || [];

      const savedId = localStorage.getItem(resumeKey(file));
      let imp = savedId ? history.find((item) => item.id === savedId) : undefined;
      if (!imp) {
        imp = history.find(
          (item) =>
            ['PROCESSING', 'FAILED'].includes(item.status) &&
            (item.original_filename === file.name || item.name === file.name) &&
            Number(item.source_size_bytes || 0) === file.size
        );
      }

      if (!imp) {
        let targetId: string | undefined = undefined;
        let targetName = file.name.replace(/\.[^/.]+$/, '');

        if (isCreatingNew && newAudienceName.trim()) {
          targetName = newAudienceName.trim();
        } else if (selectedListId) {
          const selectedList = lists.find((l) => l.id === selectedListId);
          if (selectedList) {
            targetId = selectedList.id;
            targetName = selectedList.name;
          }
        }

        const start = await authFetch('/api/imports/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${targetName} (${file.name})`,
            filename: file.name,
            sourceSizeBytes: file.size,
            listId: targetId,
            listName: targetName,
          }),
        });
        const sd = await readJson<{ import: ImportRecord }>(start, 'Could not start import');
        imp = sd.import;
      }

      localStorage.setItem(resumeKey(file), imp.id);
      setCurrent(imp);

      // Stream chunks (2MB chunks to maintain low latency and responsive progress)
      const chunkSize = 2 * 1024 * 1024;
      let offset = Math.max(0, Number(imp.upload_offset_bytes || 0));
      if (offset > file.size) {
        throw new Error('Stored import offset is larger than file size. Starting fresh.');
      }

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
        const d = await readJson<{ import: ImportRecord; nextOffset?: number }>(
          r,
          'Import chunk failed'
        );

        imp = d.import;
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
      setCurrent(dd.import);
      await load();
      await loadLists();
    } catch (e: any) {
      setError(e.message || 'Import failed');
      await load();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      if (lists.length === 0) {
        setIsCreatingNew(true);
        setNewAudienceName(f.name.replace(/\.[^/.]+$/, ''));
      }
      setShowListPicker(true);
    }
  };

  const progress = current?.source_size_bytes
    ? Math.min(100, Math.round(((current.upload_offset_bytes || 0) / current.source_size_bytes) * 100))
    : current?.status === 'COMPLETED'
    ? 100
    : 0;

  return (
    <section className="p-6 rounded bg-white border border-[#CCD2D8] shadow-xs space-y-6 font-sans text-gray-900">
      {/* Header with PowerMTA Crimson Accents */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#CCD2D8]">
        <div>
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-[#8B1A10]" />
            <h2 className="text-base font-bold text-gray-900">
              Import History &amp; Reusable Audiences
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#8B1A10]/10 text-[#8B1A10] border border-[#8B1A10]/20 font-bold">
              .CSV &amp; .TXT Supported
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Import recipient lists from .TXT (one email per line or delimited) or .CSV files. Files
            are processed in durable chunks and saved as reusable audiences.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-gray-100 text-gray-700 border border-[#CCD2D8] text-xs font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => setShowListPicker(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#8B1A10] hover:bg-[#73140C] text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import .TXT / .CSV</span>
          </button>
        </div>
      </div>

      {/* Hidden File Input */}
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

      {/* Drag & Drop Quick Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => setShowListPicker(true)}
        className={`p-5 rounded border-2 border-dashed transition cursor-pointer flex flex-col items-center justify-center text-center space-y-2 ${
          dragActive
            ? 'border-[#8B1A10] bg-[#8B1A10]/5'
            : 'border-[#CCD2D8] hover:border-gray-400 bg-[#F8FAFC]'
        }`}
      >
        <div className="flex items-center gap-2 text-gray-500">
          <Upload className="w-5 h-5 text-[#8B1A10]" />
          <FileText className="w-5 h-5 text-gray-400" />
        </div>
        <div className="text-xs font-bold text-gray-800">
          Click or drop your <span className="text-[#8B1A10]">.TXT</span> or{' '}
          <span className="text-[#8B1A10]">.CSV</span> email list file here
        </div>
        <div className="text-[11px] text-gray-500">
          Supports plain email lists (e.g. <code>user@example.com</code> per line) as well as
          comma/semicolon/tab delimited records.
        </div>
      </div>

      {/* Active Streaming Progress Bar */}
      {current && (
        <div className="p-4 rounded border border-[#CCD2D8] bg-[#F8FAFC] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">
                {current.original_filename || current.name}
              </span>
              <span className="text-gray-500 font-mono text-[11px]">
                ({formatBytes(current.source_size_bytes)})
              </span>
            </div>
            <div className="flex items-center gap-2">
              {current.status === 'PROCESSING' ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  <Loader2 className="w-3 h-3 animate-spin text-amber-700" />
                  Streaming {progress}%
                </span>
              ) : current.status === 'COMPLETED' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]">
                  <CheckCircle2 className="w-3 h-3" />
                  Completed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700">
                  {current.status}
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                current.status === 'COMPLETED' ? 'bg-[#2E7D32]' : 'bg-[#8B1A10]'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Live Metric Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center pt-1 font-mono text-xs">
            <div className="p-2 rounded bg-white border border-[#CCD2D8]">
              <div className="text-[10px] uppercase text-gray-500 font-sans">Processed</div>
              <div className="font-bold text-gray-900 mt-0.5">
                {(current.processed_rows || 0).toLocaleString()}
              </div>
            </div>
            <div className="p-2 rounded bg-white border border-[#CCD2D8]">
              <div className="text-[10px] uppercase text-[#2E7D32] font-sans">Imported</div>
              <div className="font-bold text-[#2E7D32] mt-0.5">
                {(current.imported_rows || 0).toLocaleString()}
              </div>
            </div>
            <div className="p-2 rounded bg-white border border-[#CCD2D8]">
              <div className="text-[10px] uppercase text-amber-700 font-sans">Duplicates</div>
              <div className="font-bold text-amber-700 mt-0.5">
                {(current.duplicate_rows || 0).toLocaleString()}
              </div>
            </div>
            <div className="p-2 rounded bg-white border border-[#CCD2D8]">
              <div className="text-[10px] uppercase text-rose-700 font-sans">Suppressed</div>
              <div className="font-bold text-rose-700 mt-0.5">
                {(current.suppressed_rows || 0).toLocaleString()}
              </div>
            </div>
            <div className="p-2 rounded bg-white border border-[#CCD2D8]">
              <div className="text-[10px] uppercase text-gray-500 font-sans">Invalid</div>
              <div className="font-bold text-gray-600 mt-0.5">
                {(current.invalid_rows || 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Import History Table */}
      <div className="rounded border border-[#CCD2D8] overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs text-gray-800">
          <thead className="bg-[#F2F4F7] text-gray-700 uppercase font-mono text-[10px] tracking-wider border-b border-[#CCD2D8]">
            <tr>
              <th className="py-2.5 px-4 font-bold">Audience &amp; File</th>
              <th className="py-2.5 px-4 font-bold">Status</th>
              <th className="py-2.5 px-4 font-bold">Total Rows</th>
              <th className="py-2.5 px-4 font-bold">Imported Contacts</th>
              <th className="py-2.5 px-4 font-bold hidden sm:table-cell">Created</th>
              <th className="py-2.5 px-4 text-right font-bold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {imports.map((item) => {
              const totalCount = item.total_rows || item.processed_rows || 0;
              const importedCount = item.imported_rows || 0;
              const isTxt = (item.original_filename || item.name).toLowerCase().endsWith('.txt');

              return (
                <tr key={item.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{item.name}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                          isTxt
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {isTxt ? 'TXT' : 'CSV'}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                      {item.original_filename || item.name} · {formatBytes(item.source_size_bytes)}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {item.status === 'COMPLETED' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed
                      </span>
                    ) : item.status === 'PROCESSING' ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <Loader2 className="w-3 h-3 animate-spin text-amber-700" />
                        Processing
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700">
                        {item.status}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-gray-700">
                    {totalCount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-[#2E7D32]">
                    {importedCount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-gray-600 font-mono text-[11px] hidden sm:table-cell">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      {formatDate(item.created_at || item.started_at)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {item.list_id && item.status === 'COMPLETED' ? (
                      <button
                        type="button"
                        onClick={() => onUseAudience(item.list_id!)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-900 border border-[#CCD2D8] hover:border-gray-400 rounded text-xs font-bold transition shadow-xs"
                      >
                        <Play className="w-3 h-3 text-[#8B1A10]" />
                        <span>Use Audience</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!imports.length && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-500 font-medium">
                  No imports recorded yet. Click &quot;Import .TXT / .CSV&quot; above to import your
                  recipient lists.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Audience Selection & Creation Modal */}
      {showListPicker && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg border border-[#CCD2D8] bg-white p-6 shadow-2xl font-sans text-gray-900 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#CCD2D8]">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#8B1A10]" />
                  <span>Select Target Audience</span>
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Choose where to import contacts from your .TXT or .CSV file.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowListPicker(false)}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold"
              >
                ×
              </button>
            </div>

            {/* Toggle Existing vs New Audience */}
            <div className="flex items-center gap-2 border-b border-[#CCD2D8] pb-2 text-xs">
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className={`px-3 py-1.5 rounded font-bold transition ${
                  !isCreatingNew
                    ? 'bg-[#8B1A10] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Existing List
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingNew(true)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded font-bold transition ${
                  isCreatingNew
                    ? 'bg-[#8B1A10] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Create New Audience</span>
              </button>
            </div>

            {isCreatingNew ? (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700">
                  New Audience Name *
                </label>
                <input
                  type="text"
                  required
                  value={newAudienceName}
                  onChange={(e) => setNewAudienceName(e.target.value)}
                  placeholder="e.g. Inactive TXT Leads Nov 2026"
                  className="w-full rounded border border-[#CCD2D8] bg-[#F8FAFC] px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#8B1A10]"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700">
                  Select Existing Audience *
                </label>
                <select
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="w-full rounded border border-[#CCD2D8] bg-[#F8FAFC] px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#8B1A10]"
                >
                  <option value="">Select an audience list…</option>
                  {lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                      {typeof list.memberCount === 'number' ? ` (${list.memberCount} contacts)` : ''}
                    </option>
                  ))}
                </select>
                {lists.length === 0 && (
                  <p className="text-[11px] text-amber-700 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    No existing lists found. Please switch to &quot;Create New Audience&quot;.
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[#CCD2D8]">
              <button
                type="button"
                onClick={() => setShowListPicker(false)}
                className="px-3 py-1.5 rounded border border-[#CCD2D8] text-xs font-semibold text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  (!isCreatingNew && !selectedListId) ||
                  (isCreatingNew && !newAudienceName.trim()) ||
                  uploading
                }
                onClick={chooseListAndOpenFile}
                className="px-4 py-1.5 rounded bg-[#8B1A10] hover:bg-[#73140C] text-white text-xs font-bold shadow-xs disabled:opacity-50 transition"
              >
                Choose .TXT / .CSV File &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
