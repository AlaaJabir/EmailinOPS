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
    } catch (err) {
      console.error('Failed to save Convex configuration:', err);
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
                  base64Data,
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
    <div className="p-8 space-y-8 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e2825] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[#39ff9c]">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">Convex Storage</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-semibold">
                  Active
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                  Cloud Backend
                </span>
              </div>
              <p className="text-xs text-[#7c9188] mt-1">
                Fast, real-time object storage for campaign media, attachments, and static assets
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="px-3 py-2 rounded bg-[#0f1412] border border-[#1e2825] text-right">
            <div className="text-[10px] uppercase text-[#4a5a53]">Files in Convex</div>
            <div className="text-[#39ff9c] font-bold">
              {files.length} assets ({formattedTotalSize})
            </div>
          </div>
        </div>
      </div>

      {/* Convex Configuration Card */}
      <div className="p-6 rounded bg-[#0f1412] border border-[#1e2825] space-y-6">
        <div className="flex items-center justify-between border-b border-[#1e2825] pb-4">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>Convex Backend &amp; Storage Settings</span>
              {convexUrl ? (
                <span className="flex items-center gap-1 text-[11px] text-[#39ff9c]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-[#ffb454]">
                  <AlertCircle className="w-3.5 h-3.5" /> URL Required
                </span>
              )}
            </h2>
            <p className="text-xs text-[#7c9188] mt-0.5">
              Enter your Convex deployment URL to enable persistent cloud object storage and database queries.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#7c9188] mb-1">
            Convex Deployment URL
          </label>
          <input
            type="text"
            value={convexUrl}
            onChange={(e) => setConvexUrl(e.target.value)}
            className="w-full bg-[#070a09] border border-[#1e2825] rounded px-3 py-2 text-xs font-mono text-[#d8e6df] focus:border-[#39ff9c] focus:outline-none"
            placeholder="https://your-deployment.convex.cloud"
          />
        </div>

        {testResult && (
          <div
            className={`p-3 rounded text-xs flex items-center gap-2 border ${
              testResult.success
                ? 'bg-emerald-950/20 border-emerald-800 text-emerald-300'
                : 'bg-red-950/20 border-red-800 text-red-300'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span>{testResult.message || testResult.error}</span>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#39ff9c] text-black font-semibold text-xs hover:bg-[#2fd983] transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Settings'}</span>
          </button>

          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#1e2825] text-[#d8e6df] text-xs hover:bg-[#283632] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'Testing Convex...' : 'Test Connection'}</span>
          </button>
        </div>
      </div>

      {/* Asset Explorer & File Manager */}
      <div className="p-6 rounded bg-[#0f1412] border border-[#1e2825] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2825] pb-4">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-[#39ff9c]" />
              <span>Convex Asset Explorer</span>
            </h2>
            <p className="text-xs text-[#7c9188] mt-0.5">
              Upload images, graphics, and email attachments to get public URLs for your campaigns
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#4a5a53]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assets..."
                className="bg-[#070a09] border border-[#1e2825] rounded pl-8 pr-3 py-1.5 text-xs text-[#d8e6df] focus:border-[#39ff9c] focus:outline-none w-48"
              />
            </div>
            <button
              onClick={fetchFiles}
              className="p-2 rounded bg-[#1e2825] text-[#7c9188] hover:text-white transition-colors"
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
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            dragOver
              ? 'border-[#39ff9c] bg-[#39ff9c]/5'
              : 'border-[#1e2825] hover:border-[#2a3834] bg-[#070a09]'
          }`}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.onchange = (e: any) => handleFileUpload(e.target.files);
            input.click();
          }}
        >
          <UploadCloud className="w-8 h-8 text-[#7c9188] mx-auto mb-2" />
          <p className="text-xs font-medium text-[#d8e6df]">
            {isUploading ? 'Uploading assets...' : 'Drag and drop images or files here, or click to browse'}
          </p>
          <p className="text-[11px] text-[#4a5a53] mt-1">
            PNG, JPG, GIF, SVG, PDF up to 25MB
          </p>
        </div>

        {/* Files Grid */}
        {isLoadingFiles ? (
          <div className="py-12 text-center text-xs text-[#7c9188]">Loading Convex assets...</div>
        ) : filteredFiles.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#7c9188]">
            No assets found. Upload an image to generate public links for your emails.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredFiles.map((file) => {
              const isImage = file.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|svg|webp)$/i.test(file.key);
              return (
                <div
                  key={file.key}
                  className="rounded bg-[#070a09] border border-[#1e2825] overflow-hidden flex flex-col group hover:border-[#2a3834] transition-colors"
                >
                  <div className="h-32 bg-[#0b0e0d] flex items-center justify-center overflow-hidden relative border-b border-[#1e2825]">
                    {isImage ? (
                      <img
                        src={file.url}
                        alt={file.filename || file.key}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <FileText className="w-8 h-8 text-[#4a5a53]" />
                    )}
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="text-xs font-medium text-[#d8e6df] truncate" title={file.filename || file.key}>
                        {file.filename || file.key.split('/').pop()}
                      </div>
                      <div className="text-[10px] text-[#4a5a53] font-mono mt-0.5">
                        {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Unknown size'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#1e2825]">
                      <button
                        onClick={() => copyToClipboard(file.url)}
                        className="flex items-center gap-1 text-[11px] text-[#7c9188] hover:text-[#39ff9c] transition-colors"
                        title="Copy direct URL"
                      >
                        {copiedUrl === file.url ? (
                          <>
                            <Check className="w-3 h-3 text-[#39ff9c]" />
                            <span className="text-[#39ff9c]">Copied!</span>
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
                          className="text-[#7c9188] hover:text-white transition-colors"
                          title="Open URL"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                          onClick={() => handleDeleteFile(file.key)}
                          className="text-[#7c9188] hover:text-red-400 transition-colors"
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
  );
};
