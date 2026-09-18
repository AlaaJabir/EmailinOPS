import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Users,
  FolderPlus,
  Play,
  FileText,
  Building,
  Mail,
} from 'lucide-react';
import { ContactList } from '../types';

interface CsvImportWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  lists: ContactList[];
  onAudienceCreated?: (list: ContactList) => void;
  onImportComplete?: (result: { listId: string; listName: string; importedCount: number }) => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function detectDelimiter(firstLine: string): string {
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semicolons) return '\t';
  if (semicolons > commas) return ';';
  return ',';
}

function parseDelimitedLine(line: string, delim: string): string[] {
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
    } else if (ch === delim && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out.map((value) => value.replace(/^['"]|['"]$/g, '').trim());
}

export const CsvImportWizardModal: React.FC<CsvImportWizardModalProps> = ({
  isOpen,
  onClose,
  lists,
  onAudienceCreated,
  onImportComplete,
  authFetch,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Audience selection
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [isCreatingNewList, setIsCreatingNewList] = useState<boolean>(false);
  const [newListName, setNewListName] = useState<string>('');
  const [newListDescription, setNewListDescription] = useState<string>('');

  // Step 2: File selection & column detection
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sampleRows, setSampleRows] = useState<string[][]>([]);
  const [sampleHeaders, setSampleHeaders] = useState<string[]>([]);
  const [delimiter, setDelimiter] = useState<string>(',');
  const [emailColIdx, setEmailColIdx] = useState<number>(0);
  const [firstColIdx, setFirstColIdx] = useState<number>(-1);
  const [lastColIdx, setLastColIdx] = useState<number>(-1);
  const [companyColIdx, setCompanyColIdx] = useState<number>(-1);
  const [hasHeader, setHasHeader] = useState<boolean>(true);
  const [estimatedTotalRows, setEstimatedTotalRows] = useState<number>(0);

  // Step 3: Preview stats from sample
  const [sampleValidCount, setSampleValidCount] = useState<number>(0);
  const [sampleInvalidCount, setSampleInvalidCount] = useState<number>(0);

  // Step 4: Streaming progress
  const [importId, setImportId] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'importing' | 'completed' | 'failed' | 'cancelled'>('idle');
  const [progressBytes, setProgressBytes] = useState<number>(0);
  const [processedRows, setProcessedRows] = useState<number>(0);
  const [importedRows, setImportedRows] = useState<number>(0);
  const [duplicateRows, setDuplicateRows] = useState<number>(0);
  const [invalidRows, setInvalidRows] = useState<number>(0);
  const [suppressedRows, setSuppressedRows] = useState<number>(0);
  const [targetListName, setTargetListName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const cancelRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      if (lists.length > 0 && !selectedListId) {
        setSelectedListId(lists[0].id);
      }
      setIsCreatingNewList(false);
      setNewListName('');
      setSelectedFile(null);
      setStatus('idle');
      setErrorMessage('');
      cancelRef.current = false;
    }
  }, [isOpen, lists]);

  if (!isOpen) return null;

  // Handle file inspection (reads ONLY first 256KB to keep memory constant)
  const handleFileChange = async (file: File) => {
    setSelectedFile(file);
    setErrorMessage('');

    try {
      const sliceSize = Math.min(256 * 1024, file.size);
      const sampleText = await file.slice(0, sliceSize).text();
      const lines = sampleText.replace(/\r/g, '').split('\n').filter((l) => l.trim().length > 0);

      if (lines.length === 0) {
        setErrorMessage('The selected file is empty.');
        return;
      }

      const detectedDelim = detectDelimiter(lines[0]);
      setDelimiter(detectedDelim);

      const parsedLines = lines.map((l) => parseDelimitedLine(l, detectedDelim));
      const firstLine = parsedLines[0];

      // Estimate total rows based on file size and average line length
      const avgLineBytes = sampleText.length / lines.length;
      const estRows = Math.max(lines.length, Math.round(file.size / Math.max(avgLineBytes, 15)));
      setEstimatedTotalRows(estRows);

      // Check if line 0 looks like header
      const lowerCols = firstLine.map((c) => c.toLowerCase());
      let detectedEmailIdx = lowerCols.findIndex((c) => c.includes('email') || c === 'mail' || c === 'e-mail');
      const detectedFirstIdx = lowerCols.findIndex((c) => c.includes('first') || c === 'fname');
      const detectedLastIdx = lowerCols.findIndex((c) => c.includes('last') || c === 'lname');
      const detectedCompanyIdx = lowerCols.findIndex((c) => c.includes('company') || c === 'org');

      let isHeaderPresent = true;
      if (detectedEmailIdx >= 0) {
        setHasHeader(true);
        setSampleHeaders(firstLine);
        setSampleRows(parsedLines.slice(1, 15));
      } else {
        // No header named email found: look at line 0 vs line 1 to see if line 0 has an email
        const line0HasEmail = firstLine.some((c) => EMAIL_RE.test(c.trim().toLowerCase()));
        if (line0HasEmail) {
          isHeaderPresent = false;
          setHasHeader(false);
          setSampleHeaders(firstLine.map((_, i) => `Column ${i + 1}`));
          setSampleRows(parsedLines.slice(0, 15));
          detectedEmailIdx = firstLine.findIndex((c) => EMAIL_RE.test(c.trim().toLowerCase()));
        } else {
          // Check subsequent rows for email pattern
          for (let r = 1; r < Math.min(parsedLines.length, 5); r++) {
            const idx = parsedLines[r].findIndex((c) => EMAIL_RE.test(c.trim().toLowerCase()));
            if (idx >= 0) {
              detectedEmailIdx = idx;
              break;
            }
          }
          if (detectedEmailIdx === -1) detectedEmailIdx = 0;
          setHasHeader(true);
          setSampleHeaders(firstLine);
          setSampleRows(parsedLines.slice(1, 15));
        }
      }

      setEmailColIdx(detectedEmailIdx >= 0 ? detectedEmailIdx : 0);
      setFirstColIdx(detectedFirstIdx);
      setLastColIdx(detectedLastIdx);
      setCompanyColIdx(detectedCompanyIdx);

      // Calculate sample validation counts
      const dataRows = isHeaderPresent ? parsedLines.slice(1) : parsedLines;
      let valids = 0;
      let invalids = 0;
      dataRows.forEach((r) => {
        const email = String(r[detectedEmailIdx >= 0 ? detectedEmailIdx : 0] || '').trim().toLowerCase();
        if (EMAIL_RE.test(email)) valids++;
        else invalids++;
      });
      setSampleValidCount(valids);
      setSampleInvalidCount(invalids);
    } catch (err: any) {
      setErrorMessage(`Failed to parse CSV preview: ${err.message}`);
    }
  };

  const getEffectiveListName = (): string => {
    if (isCreatingNewList) {
      return newListName.trim() || 'New Audience';
    }
    const found = lists.find((l) => l.id === selectedListId);
    return found ? found.name : 'Selected Audience';
  };

  // Step 4: Durable Streaming Import Execution
  const runDurableImport = async () => {
    if (!selectedFile) return;

    setStep(4);
    setStatus('importing');
    setErrorMessage('');
    cancelRef.current = false;

    const listName = getEffectiveListName();
    setTargetListName(listName);

    // Tracked outside the try block (not `const` inside it) so the catch
    // handler below can still reach it to mark the job FAILED server-side.
    let currentImportId = '';

    try {
      // 1. Start durable import job in Convex
      const startRes = await authFetch('/api/imports/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Import · ${selectedFile.name}`,
          filename: selectedFile.name,
          sourceSizeBytes: selectedFile.size,
          listId: isCreatingNewList ? undefined : selectedListId,
          listName,
          listDescription: isCreatingNewList ? newListDescription : undefined,
        }),
      });

      const startData = await startRes.json();
      if (!startRes.ok || !startData.import) {
        throw new Error(startData?.error || 'Failed to initialize durable import job.');
      }

      currentImportId = startData.import.id;
      setImportId(currentImportId);

      // 2. Stream chunk loop. Chunk size is intentionally small (150KB) so a
      // plain email-only list (very short lines) can never balloon a single
      // chunk into tens of thousands of rows — that used to overload the
      // backend mutation on large files.
      const chunkSize = 150 * 1024; // 150KB chunk
      let offset = 0;
      let chunkIndex = 0;
      let tail = '';

      while (offset < selectedFile.size && !cancelRef.current) {
        let end = Math.min(offset + chunkSize, selectedFile.size);

        // Don't cut in the middle of a line unless at EOF
        if (end < selectedFile.size) {
          const probeSlice = await selectedFile.slice(offset, end).text();
          const lastLf = probeSlice.lastIndexOf('\n');
          if (lastLf > 0) {
            end = offset + lastLf + 1;
          }
        }

        const rawSliceText = await selectedFile.slice(offset, end).text();
        const fullSlice = tail + rawSliceText;
        const lines = fullSlice.replace(/\r/g, '').split('\n');

        // Retain last incomplete line as tail if not at EOF
        if (end < selectedFile.size) {
          tail = lines.pop() || '';
        } else {
          tail = '';
        }

        // Parse rows from chunk lines
        const chunkRows: Array<{ email: string; firstName?: string; lastName?: string; company?: string }> = [];
        let chunkInvalid = 0;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Skip header row on first chunk
          if (chunkIndex === 0 && i === 0 && hasHeader) {
            continue;
          }

          const cols = parseDelimitedLine(line, delimiter);
          const rawEmail = String(cols[emailColIdx] || '').trim().toLowerCase().replace(/^['"]|['"]$/g, '');

          if (rawEmail && EMAIL_RE.test(rawEmail)) {
            chunkRows.push({
              email: rawEmail,
              firstName: firstColIdx >= 0 && cols[firstColIdx] ? cols[firstColIdx] : undefined,
              lastName: lastColIdx >= 0 && cols[lastColIdx] ? cols[lastColIdx] : undefined,
              company: companyColIdx >= 0 && cols[companyColIdx] ? cols[companyColIdx] : undefined,
            });
          } else {
            chunkInvalid++;
          }
        }

        const chunkId = `chk_${chunkIndex}_${offset}`;
        const chunkPayload = JSON.stringify({
          chunkId,
          offset,
          nextOffset: end,
          parserTail: tail,
          invalidRows: chunkInvalid,
          rows: chunkRows,
        });

        // Retry a chunk a few times on transient/network/server errors before
        // giving up — a single flaky request should not fail a multi-hundred
        // chunk import. Permanent errors (bad request, offset desync, import
        // not found) are surfaced immediately instead of retried.
        let chunkData: any = null;
        let chunkErr: any = null;
        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const chunkRes = await authFetch(`/api/imports/${currentImportId}/chunk`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: chunkPayload,
            });
            const data = await chunkRes.json().catch(() => ({}));
            if (!chunkRes.ok) {
              const httpErr: any = new Error(data?.error || `Chunk ${chunkIndex} import failed (HTTP ${chunkRes.status})`);
              httpErr.status = chunkRes.status;
              throw httpErr;
            }
            chunkData = data;
            break;
          } catch (err: any) {
            chunkErr = err;
            const isRetryable = !err.status || err.status >= 500;
            if (!isRetryable || attempt >= maxAttempts) break;
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          }
        }
        if (!chunkData) {
          throw chunkErr || new Error(`Chunk ${chunkIndex} import failed`);
        }

        const imp = chunkData.import;
        setProcessedRows(imp.processed_rows || 0);
        setImportedRows(imp.imported_rows || 0);
        setDuplicateRows(imp.duplicate_rows || 0);
        setInvalidRows(imp.invalid_rows || 0);
        setSuppressedRows(imp.suppressed_rows || 0);
        setProgressBytes(end);

        offset = end;
        chunkIndex++;
      }

      if (cancelRef.current) {
        setStatus('cancelled');
        await authFetch(`/api/imports/${currentImportId}/cancel`, { method: 'POST' });
        return;
      }

      // 3. Mark complete in Convex
      const completeRes = await authFetch(`/api/imports/${currentImportId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalOffset: selectedFile.size,
          parserTail: '',
        }),
      });

      const completeData = await completeRes.json();
      if (completeRes.ok) {
        setStatus('completed');
        if (onImportComplete) {
          onImportComplete({
            listId: startData.import.list_id || selectedListId,
            listName,
            importedCount: completeData.import?.imported_rows || importedRows,
          });
        }
      } else {
        throw new Error(completeData?.error || 'Failed to complete import job');
      }
    } catch (err: any) {
      console.error('[CSV Import Error]', err);
      setStatus('failed');
      setErrorMessage(err.message || 'Import process encountered an error.');
      // Mark the job FAILED server-side so it doesn't sit stuck at
      // "PROCESSING" forever in the Audience Lists / Import History panel.
      if (currentImportId) {
        try {
          await authFetch(`/api/imports/${currentImportId}/fail`, { method: 'POST' });
        } catch (e) {
          // best-effort — the import can still be manually cancelled
        }
      }
    }
  };

  const handleCancelImport = async () => {
    cancelRef.current = true;
    if (importId) {
      try {
        await authFetch(`/api/imports/${importId}/cancel`, { method: 'POST' });
      } catch (e) {
        // ignore
      }
    }
    setStatus('cancelled');
  };

  const progressPercent = selectedFile && selectedFile.size > 0
    ? Math.min(100, Math.round((progressBytes / selectedFile.size) * 100))
    : status === 'completed' ? 100 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-[#CCD2D8] shadow-2xl w-full max-w-2xl overflow-hidden font-sans text-gray-900 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#CCD2D8] flex items-center justify-between bg-[#F8FAFC]">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#8B1A10]" />
              <span>Durable CSV Contact Import</span>
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">
              High-volume streaming import with deduplication and audience assignment.
            </p>
          </div>
          {status !== 'importing' && (
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Stepper Progress */}
        <div className="px-6 py-3 bg-[#F2F4F7] border-b border-[#CCD2D8] flex items-center justify-between text-xs font-semibold">
          <div className={`flex items-center gap-1.5 ${step === 1 ? 'text-[#8B1A10]' : 'text-gray-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${step === 1 ? 'bg-[#8B1A10] text-white' : 'bg-gray-300 text-gray-700'}`}>1</span>
            <span>Audience</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
          <div className={`flex items-center gap-1.5 ${step === 2 ? 'text-[#8B1A10]' : 'text-gray-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${step === 2 ? 'bg-[#8B1A10] text-white' : 'bg-gray-300 text-gray-700'}`}>2</span>
            <span>CSV File</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
          <div className={`flex items-center gap-1.5 ${step === 3 ? 'text-[#8B1A10]' : 'text-gray-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${step === 3 ? 'bg-[#8B1A10] text-white' : 'bg-gray-300 text-gray-700'}`}>3</span>
            <span>Preview</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
          <div className={`flex items-center gap-1.5 ${step === 4 ? 'text-[#8B1A10]' : 'text-gray-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${step === 4 ? 'bg-[#8B1A10] text-white' : 'bg-gray-300 text-gray-700'}`}>4</span>
            <span>Import</span>
          </div>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {errorMessage && (
            <div className="p-3 rounded bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: SELECT AUDIENCE */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Choose Audience List</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Select the existing Audience List where imported contacts will be stored, or create a new audience.
                </p>
              </div>

              {!isCreatingNewList ? (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-700">Select an existing audience</label>
                  <select
                    value={selectedListId}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsCreatingNewList(true);
                      } else {
                        setSelectedListId(e.target.value);
                      }
                    }}
                    className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs text-gray-900 font-medium focus:outline-none focus:border-[#8B1A10]"
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.memberCount || 0} contacts)
                      </option>
                    ))}
                    <option value="__NEW__">+ Create new audience</option>
                  </select>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewList(true)}
                      className="text-xs font-bold text-[#8B1A10] hover:underline flex items-center gap-1"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>+ Create new audience instead</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded border border-[#CCD2D8] bg-[#F8FAFC] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <FolderPlus className="w-4 h-4 text-[#8B1A10]" />
                      <span>Create New Audience</span>
                    </span>
                    {lists.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsCreatingNewList(false)}
                        className="text-xs text-gray-600 hover:text-gray-900 underline font-medium"
                      >
                        Use existing audience
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Audience Name *</label>
                    <input
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="e.g. VIP Customers 2026"
                      className="w-full bg-white border border-[#CCD2D8] rounded px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#8B1A10]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Description (Optional)</label>
                    <input
                      type="text"
                      value={newListDescription}
                      onChange={(e) => setNewListDescription(e.target.value)}
                      placeholder="e.g. Ingested from marketing campaign CSV"
                      className="w-full bg-white border border-[#CCD2D8] rounded px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#8B1A10]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: CSV FILE & MAPPING */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Select CSV File</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Upload comma, semicolon, or tab-delimited files. Emails will be automatically extracted, cleaned, and normalized.
                </p>
              </div>

              {!selectedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFileChange(f);
                  }}
                  className="border-2 border-dashed border-[#CCD2D8] hover:border-[#8B1A10] rounded-lg p-8 text-center cursor-pointer bg-[#F8FAFC] transition group"
                >
                  <FileSpreadsheet className="w-10 h-10 text-gray-400 group-hover:text-[#8B1A10] mx-auto mb-2 transition" />
                  <p className="text-xs font-bold text-gray-800">
                    Click to select CSV file, or drag and drop here
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Supports .csv and .txt (handles 40M+ contacts with chunked streaming)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileChange(f);
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 rounded bg-[#F8FAFC] border border-[#CCD2D8] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-6 h-6 text-[#8B1A10]" />
                      <div>
                        <div className="text-xs font-bold text-gray-900">{selectedFile.name}</div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Delimiter: &apos;{delimiter === '\t' ? 'TAB' : delimiter}&apos; · ~{estimatedTotalRows.toLocaleString()} rows
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setSampleRows([]);
                      }}
                      className="text-xs text-red-600 hover:underline font-bold"
                    >
                      Change File
                    </button>
                  </div>

                  {/* Column mappings */}
                  <div className="p-3.5 rounded border border-[#CCD2D8] bg-white space-y-3">
                    <div className="text-xs font-bold text-gray-900">Detected Column Mapping</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">
                          Email Address Column *
                        </label>
                        <select
                          value={emailColIdx}
                          onChange={(e) => setEmailColIdx(Number(e.target.value))}
                          className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-2.5 py-1.5 text-xs text-gray-900 font-medium focus:outline-none"
                        >
                          {sampleHeaders.map((h, i) => (
                            <option key={i} value={i}>
                              Column {i + 1}: {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                          First Name (Optional)
                        </label>
                        <select
                          value={firstColIdx}
                          onChange={(e) => setFirstColIdx(Number(e.target.value))}
                          className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none"
                        >
                          <option value={-1}>-- None --</option>
                          {sampleHeaders.map((h, i) => (
                            <option key={i} value={i}>
                              Column {i + 1}: {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                          Last Name (Optional)
                        </label>
                        <select
                          value={lastColIdx}
                          onChange={(e) => setLastColIdx(Number(e.target.value))}
                          className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none"
                        >
                          <option value={-1}>-- None --</option>
                          {sampleHeaders.map((h, i) => (
                            <option key={i} value={i}>
                              Column {i + 1}: {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                          Company (Optional)
                        </label>
                        <select
                          value={companyColIdx}
                          onChange={(e) => setCompanyColIdx(Number(e.target.value))}
                          className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none"
                        >
                          <option value={-1}>-- None --</option>
                          {sampleHeaders.map((h, i) => (
                            <option key={i} value={i}>
                              Column {i + 1}: {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: PREVIEW */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Import Preview</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Verify the parsed parameters before starting the durable import.
                </p>
              </div>

              {/* Summary Stats Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded bg-[#F8FAFC] border border-[#CCD2D8]">
                  <div className="text-[11px] font-bold text-gray-500 uppercase font-mono">File</div>
                  <div className="text-xs font-bold text-gray-900 truncate mt-0.5">{selectedFile?.name}</div>
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                    {selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(1) : 0} MB
                  </div>
                </div>

                <div className="p-3 rounded bg-[#F8FAFC] border border-[#CCD2D8]">
                  <div className="text-[11px] font-bold text-gray-500 uppercase font-mono">Audience</div>
                  <div className="text-xs font-bold text-[#8B1A10] truncate mt-0.5">{getEffectiveListName()}</div>
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">Durable Convex List</div>
                </div>

                <div className="p-3 rounded bg-[#F8FAFC] border border-[#CCD2D8]">
                  <div className="text-[11px] font-bold text-gray-500 uppercase font-mono">Email Column</div>
                  <div className="text-xs font-bold text-gray-900 truncate mt-0.5">
                    {sampleHeaders[emailColIdx] || `Col ${emailColIdx + 1}`}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">Auto-normalized</div>
                </div>

                <div className="p-3 rounded bg-[#F8FAFC] border border-[#CCD2D8]">
                  <div className="text-[11px] font-bold text-gray-500 uppercase font-mono">Est. Contacts</div>
                  <div className="text-xs font-bold text-green-700 mt-0.5">
                    ~{estimatedTotalRows.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">Streaming Chunks</div>
                </div>
              </div>

              {/* Sample Rows Table */}
              <div>
                <div className="text-xs font-bold text-gray-700 mb-2">Sample Extracted Rows (First 5)</div>
                <div className="border border-[#CCD2D8] rounded overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F2F4F7] text-gray-700 uppercase font-mono text-[10px] border-b border-[#CCD2D8]">
                      <tr>
                        <th className="py-2 px-3">Email</th>
                        <th className="py-2 px-3">First Name</th>
                        <th className="py-2 px-3">Last Name</th>
                        <th className="py-2 px-3">Company</th>
                        <th className="py-2 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] font-sans">
                      {sampleRows.slice(0, 5).map((row, idx) => {
                        const email = String(row[emailColIdx] || '').trim().toLowerCase();
                        const isValid = EMAIL_RE.test(email);
                        const first = firstColIdx >= 0 ? row[firstColIdx] : '-';
                        const last = lastColIdx >= 0 ? row[lastColIdx] : '-';
                        const comp = companyColIdx >= 0 ? row[companyColIdx] : '-';

                        return (
                          <tr key={idx} className="hover:bg-[#F8FAFC]">
                            <td className="py-2 px-3 font-mono text-gray-900 font-medium">{email || '(empty)'}</td>
                            <td className="py-2 px-3 text-gray-700">{first || '-'}</td>
                            <td className="py-2 px-3 text-gray-700">{last || '-'}</td>
                            <td className="py-2 px-3 text-gray-700">{comp || '-'}</td>
                            <td className="py-2 px-3 text-right">
                              <span
                                className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {isValid ? 'Valid' : 'Invalid'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: PROGRESS & COMPLETION */}
          {step === 4 && (
            <div className="space-y-5 py-2">
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-gray-900">
                  {status === 'completed'
                    ? 'Import Completed Successfully'
                    : status === 'importing'
                      ? 'Importing contacts...'
                      : status === 'cancelled'
                        ? 'Import Cancelled'
                        : 'Import Interrupted'}
                </h3>
                <p className="text-xs text-gray-600">
                  File: <span className="font-semibold text-gray-800">{selectedFile?.name}</span> · Audience:{' '}
                  <span className="font-semibold text-[#8B1A10]">{targetListName}</span>
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono font-semibold text-gray-700">
                  <span>Progress: {progressPercent}%</span>
                  <span>
                    {(progressBytes / 1024 / 1024).toFixed(1)} /{' '}
                    {selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(1) : 0} MB
                  </span>
                </div>
                <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      status === 'completed' ? 'bg-green-600' : 'bg-[#8B1A10]'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded bg-[#F8FAFC] border border-[#CCD2D8]">
                  <div className="text-[10px] font-bold text-gray-500 uppercase font-mono">Processed</div>
                  <div className="text-lg font-bold text-gray-900 mt-0.5">{processedRows.toLocaleString()}</div>
                </div>

                <div className="p-3 rounded bg-green-50 border border-green-200">
                  <div className="text-[10px] font-bold text-green-700 uppercase font-mono">Imported</div>
                  <div className="text-lg font-bold text-green-800 mt-0.5">{importedRows.toLocaleString()}</div>
                </div>

                <div className="p-3 rounded bg-amber-50 border border-amber-200">
                  <div className="text-[10px] font-bold text-amber-700 uppercase font-mono">Duplicates</div>
                  <div className="text-lg font-bold text-amber-800 mt-0.5">{duplicateRows.toLocaleString()}</div>
                </div>

                <div className="p-3 rounded bg-red-50 border border-red-200">
                  <div className="text-[10px] font-bold text-red-700 uppercase font-mono">Invalid</div>
                  <div className="text-lg font-bold text-red-800 mt-0.5">{invalidRows.toLocaleString()}</div>
                </div>
              </div>

              {status === 'importing' && (
                <div className="p-3 rounded bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    <span>Durable streaming active. Do not close tab until complete.</span>
                  </div>
                  <button
                    onClick={handleCancelImport}
                    className="px-2.5 py-1 bg-white border border-blue-300 text-blue-800 rounded text-xs font-bold hover:bg-blue-100 transition"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {status === 'completed' && (
                <div className="p-4 rounded bg-green-50 border border-green-200 text-xs text-green-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-sm text-green-900">
                    <CheckCircle2 className="w-4 h-4 text-green-700" />
                    <span>All contacts durably written to Convex.</span>
                  </div>
                  <p>
                    {importedRows.toLocaleString()} new contacts were attached to audience{' '}
                    <span className="font-bold">{targetListName}</span>.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[#CCD2D8] bg-[#F8FAFC] flex items-center justify-between">
          {step === 1 && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded text-xs font-bold text-gray-700 hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCreatingNewList ? !newListName.trim() : !selectedListId}
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#8B1A10] hover:bg-[#6D140C] text-white text-xs font-bold transition disabled:opacity-50"
              >
                <span>Next: Select CSV File</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold text-gray-700 hover:bg-gray-200 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                disabled={!selectedFile || emailColIdx < 0}
                onClick={() => setStep(3)}
                className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#8B1A10] hover:bg-[#6D140C] text-white text-xs font-bold transition disabled:opacity-50"
              >
                <span>Next: Preview</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold text-gray-700 hover:bg-gray-200 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded text-xs font-bold text-gray-700 hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={runDurableImport}
                  className="flex items-center gap-1.5 px-5 py-2 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs transition"
                >
                  <Upload className="w-4 h-4" />
                  <span>Start Import</span>
                </button>
              </div>
            </>
          )}

          {step === 4 && (
            <div className="w-full flex items-center justify-end gap-2">
              {status === 'completed' ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-5 py-2 rounded bg-[#8B1A10] hover:bg-[#6D140C] text-white text-xs font-bold shadow-xs transition"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>View Audience</span>
                </button>
              ) : status === 'failed' || status === 'cancelled' ? (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold transition"
                >
                  Back to Preview
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
