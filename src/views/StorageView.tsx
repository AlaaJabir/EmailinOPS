import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  UploadCloud,
  FileText,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  RefreshCw,
  Save,
  Search,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface StorageViewProps {
  settings: any;
  onSaveSettings: (category: string, values: any) => Promise<void>;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export const StorageView: React.FC<StorageViewProps> = ({
  settings,
  onSaveSettings,
  authFetch,
}) => {
  const [convexUrl, setConvexUrl] = useState(
    settings?.convex?.url || 'https://clean-badger-123.convex.cloud'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  // Files state
  const [files, setFiles] = useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (settings?.convex?.url) {
      setConvexUrl(settings.convex.url);
    }
  }, [settings]);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const res = await authFetch('/api/storage/files');
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.warn('Failed to load files from storage API:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await authFetch('/api/storage/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: convexUrl }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        fetchFiles();
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message || 'Connection test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSaveSettings('convex', { url: convexUrl });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsUploading(true);

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const reader = new FileReader();

        await new Promise((resolve, reject) => {
          reader.onload = async () => {
            try {
              const base64Data = reader.result as string;
              const res = await authFetch('/api/storage/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  filename: file.name,
                  mimeType: file.type || 'application/octet-stream',
                  data: base64Data,
                }),
              });

              if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Upload failed');
              }
              resolve(null);
            } catch (e) {
              reject(e);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      await fetchFiles();
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (key: string) => {
    if (!confirm(`Are you sure you want to delete "${key}"?`)) return;
    try {
      const res = await authFetch(`/api/storage/files/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.key !== key));
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const filteredFiles = files.filter((f) =>
    (f.filename || f.key).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
  const formattedTotalSize =
    totalBytes > 1024 * 1024
      ? `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`
      : `${(totalBytes / 1024).toFixed(1)} KB`;

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-[#E8ECEF] min-h-[calc(100vh-3.5rem)] font-sans text-gray-800">
      <div className="max-w-[1240px] mx-auto bg-white rounded-lg shadow-md border border-[#C5CED6] overflow-hidden">
        {/* PowerMTA Top Crimson Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-gradient-to-r from-[#8B1A10] via-[#A81D14] to-[#75110B] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#E0A328]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-black/25 flex items-center justify-center text-white border border-white/20 shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <span>Storage &amp; Asset Repository</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/30 border border-white/20 text-[#FFD54F]">
                  Object Store
                </span>
              </h1>
              <p className="text-[11px] text-gray-200 mt-0.5 hidden sm:block">
                Persistent storage for campaign media, RFC-compliant email attachments, and static assets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="px-3 py-1.5 rounded bg-black/25 border border-white/20 text-right">
              <div className="text-[10px] uppercase text-gray-300 font-bold">Total Assets</div>
              <div className="text-[#FFD54F] font-bold">
                {files.length} items ({formattedTotalSize})
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {/* Convex Configuration Card */}
          <div className="p-5 rounded bg-white border border-[#CCD2D8] space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span>Storage Backend Configuration</span>
                  {convexUrl ? (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded border border-[#C8E6C9] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      <AlertCircle className="w-3.5 h-3.5" /> URL Required
                    </span>
                  )}
                </h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  Specify your backend storage endpoint URL to enable persistent cloud object storage.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Storage Deployment URL
              </label>
              <input
                type="text"
                value={convexUrl}
                onChange={(e) => setConvexUrl(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                placeholder="https://your-deployment.convex.cloud"
              />
            </div>

            {testResult && (
              <div
                className={`p-3 rounded text-xs flex items-center gap-2 border font-mono ${
                  testResult.success
                    ? 'bg-[#E8F5E9] border-[#C8E6C9] text-[#2E7D32] font-semibold'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2E7D32]" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{testResult.message || testResult.error}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#2E7D32] text-white font-bold text-xs hover:bg-[#1B5E20] transition shadow-xs disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Settings'}</span>
              </button>

              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#37474F] text-white text-xs hover:bg-[#263238] font-semibold transition shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Testing Connection...' : 'Test Connection'}</span>
              </button>
            </div>
          </div>

          {/* Asset Explorer & File Manager */}
          <div className="p-5 rounded bg-white border border-[#CCD2D8] space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-[#8B1A10]" />
                  <span>Asset Explorer</span>
                </h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  Upload images, graphics, and email attachments to generate direct links for your templates.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search assets..."
                    className="bg-[#F8FAFC] border border-[#CCD2D8] rounded pl-8 pr-3 py-1.5 text-xs text-gray-900 focus:border-[#8B1A10] focus:outline-none w-48"
                  />
                </div>
                <button
                  onClick={fetchFiles}
                  className="p-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                  title="Refresh files"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFileUpload(e.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition cursor-pointer ${
                dragOver
                  ? 'border-[#8B1A10] bg-rose-50/30'
                  : 'border-[#CCD2D8] hover:border-[#8B1A10] bg-[#F8FAFC]'
              }`}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.onchange = (e: any) => handleFileUpload(e.target.files);
                input.click();
              }}
            >
              <UploadCloud className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-800">
                {isUploading ? 'Uploading assets...' : 'Drag and drop images or files here, or click to browse'}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                PNG, JPG, GIF, SVG, PDF up to 25MB
              </p>
            </div>

            {/* Files Grid */}
            {isLoadingFiles ? (
              <div className="py-12 text-center text-xs text-gray-500">Loading assets...</div>
            ) : filteredFiles.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500">
                No assets found. Upload an image to generate public links for your emails.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredFiles.map((file) => {
                  const isImage = file.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|svg|webp)$/i.test(file.key);
                  return (
                    <div
                      key={file.key}
                      className="rounded bg-white border border-[#CCD2D8] overflow-hidden flex flex-col group hover:border-[#8B1A10] hover:shadow-xs transition"
                    >
                      <div className="h-32 bg-[#F8FAFC] flex items-center justify-center overflow-hidden relative border-b border-[#CCD2D8]">
                        {isImage ? (
                          <img
                            src={file.url}
                            alt={file.filename || file.key}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <FileText className="w-8 h-8 text-gray-400" />
                        )}
                      </div>

                      <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="text-xs font-bold text-gray-900 truncate" title={file.filename || file.key}>
                            {file.filename || file.key.split('/').pop()}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                            {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Unknown size'}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-[#E2E8F0]">
                          <button
                            onClick={() => copyToClipboard(file.url)}
                            className="flex items-center gap-1 text-[11px] text-[#8B1A10] hover:underline font-semibold"
                            title="Copy direct URL"
                          >
                            {copiedUrl === file.url ? (
                              <>
                                <Check className="w-3 h-3 text-[#2E7D32]" />
                                <span className="text-[#2E7D32]">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy link</span>
                              </>
                            )}
                          </button>

                          <div className="flex items-center gap-2">
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-gray-500 hover:text-gray-900 transition"
                              title="Open URL"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <button
                              onClick={() => handleDeleteFile(file.key)}
                              className="text-gray-400 hover:text-rose-600 transition"
                              title="Delete file"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
