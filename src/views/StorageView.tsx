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
  ShieldCheck,
  Save,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
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
  // R2 configuration state
  const [accountId, setAccountId] = useState(settings?.r2?.accountId || 'b1aabfa2a055b8aa67596c2bd7a69cd0');
  const [endpoint, setEndpoint] = useState(settings?.r2?.endpoint || 'https://b1aabfa2a055b8aa67596c2bd7a69cd0.r2.cloudflarestorage.com');
  const [accessKeyId, setAccessKeyId] = useState(settings?.r2?.accessKeyId || '');
  const [secretAccessKey, setSecretAccessKey] = useState(settings?.r2?.secretAccessKey || '');
  const [bucketName, setBucketName] = useState(settings?.r2?.bucketName || 'emailops-assets');
  const [publicDomain, setPublicDomain] = useState(settings?.r2?.publicDomain || '');
  
  const [showSecret, setShowSecret] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);

  // Files state
  const [files, setFiles] = useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Sync settings when loaded
  useEffect(() => {
    if (settings?.r2) {
      if (settings.r2.accountId) setAccountId(settings.r2.accountId);
      if (settings.r2.endpoint) setEndpoint(settings.r2.endpoint);
      if (settings.r2.accessKeyId) setAccessKeyId(settings.r2.accessKeyId);
      if (settings.r2.secretAccessKey) setSecretAccessKey(settings.r2.secretAccessKey);
      if (settings.r2.bucketName) setBucketName(settings.r2.bucketName);
      if (settings.r2.publicDomain) setPublicDomain(settings.r2.publicDomain);
    }
  }, [settings]);

  // Load files on mount
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
        body: JSON.stringify({
          accountId,
          endpoint,
          accessKeyId,
          secretAccessKey,
          bucketName,
        }),
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
      const payload = {
        accountId,
        endpoint,
        accessKeyId,
        secretAccessKey,
        bucketName,
        publicDomain,
      };
      await onSaveSettings('r2', payload);
      await authFetch('/api/storage/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save R2 settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const uploadSingleFile = async (file: File) => {
    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const res = await authFetch('/api/storage/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            base64Data,
            prefix: 'assets',
          }),
        });
        if (res.ok) {
          fetchFiles();
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadSingleFile(file);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadSingleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDeleteFile = async (key: string) => {
    try {
      await authFetch(`/api/storage/files/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      fetchFiles();
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  const handleCopyUrl = (url: string) => {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const filteredFiles = files.filter(f =>
    (f.filename || f.key).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
  const formattedTotalSize = totalBytes > 1024 * 1024
    ? `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`
    : `${(totalBytes / 1024).toFixed(1)} KB`;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e2825] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">Cloudflare R2 Storage</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-semibold">
                  0$ Egress Active
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono">
                  S3 API
                </span>
              </div>
              <p className="text-xs text-[#7c9188] mt-1">
                Direct cloud object storage for images, assets, and attachments with zero egress fees
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="px-3 py-2 rounded bg-[#0f1412] border border-[#1e2825] text-right">
            <div className="text-[10px] uppercase text-[#4a5a53]">Files in R2</div>
            <div className="text-[#39ff9c] font-bold">{files.length} assets ({formattedTotalSize})</div>
          </div>
          <div className="px-3 py-2 rounded bg-[#0f1412] border border-[#1e2825] text-right">
            <div className="text-[10px] uppercase text-[#4a5a53]">Bandwidth Cost</div>
            <div className="text-white font-bold">$0.00 / Unlimited</div>
          </div>
        </div>
      </div>

      {/* R2 Configuration Card */}
      <div className="p-6 rounded bg-[#0f1412] border border-[#1e2825] space-y-6">
        <div className="flex items-center justify-between border-b border-[#1e2825] pb-4">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>Cloudflare R2 Credentials &amp; Bucket Settings</span>
              {accessKeyId && secretAccessKey ? (
                <span className="flex items-center gap-1 text-[11px] text-[#39ff9c]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-[#ffb454]">
                  <AlertCircle className="w-3.5 h-3.5" /> API Token Required
                </span>
              )}
            </h2>
            <p className="text-xs text-[#7c9188] mt-0.5">
              Account ID and S3 Endpoint are pre-configured. Enter your Cloudflare Access Key and Secret.
            </p>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#7c9188] mb-1">
              Cloudflare Account ID
            </label>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-[#070a09] border border-[#1e2825] rounded px-3 py-2 text-xs font-mono text-[#d8e6df] focus:border-[#39ff9c] focus:outline-none"
              placeholder="b1aabfa2a055b8aa67596c2bd7a69cd0"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#7c9188] mb-1">
              S3 Endpoint URL
            </label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="w-full bg-[#070a09] border border-[#1e2825] rounded px-3 py-2 text-xs font-mono text-[#d8e6df] focus:border-[#39ff9c] focus:outline-none"
              placeholder="https://b1aabfa2a055b8aa67596c2bd7a69cd0.r2.cloudflarestorage.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#7c9188] mb-1">
              Target Bucket Name
            </label>
            <input
              type="text"
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value)}
              className="w-full bg-[#070a09] border border-[#1e2825] rounded px-3 py-2 text-xs font-mono text-[#d8e6df] focus:border-[#39ff9c] focus:outline-none"
              placeholder="emailops-assets"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#7c9188] mb-1">
              Public Custom Domain / R2.dev URL <span className="text-[#4a5a53]">(Optional)</span>
            </label>
            <input
              type="text"
              value={publicDomain}
              onChange={(e) => setPublicDomain(e.target.value)}
              className="w-full bg-[#070a09] border border-[#1e2825] rounded px-3 py-2 text-xs font-mono text-[#d8e6df] focus:border-[#39ff9c] focus:outline-none"
              placeholder="https://pub-xxxx.r2.dev or https://assets.amiralucia.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-orange-300 mb-1 flex items-center justify-between">
              <span>R2 Access Key ID *</span>
              <span className="text-[10px] text-[#7c9188] font-normal">From Cloudflare R2 Token</span>
            </label>
            <input
              type="text"
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              className="w-full bg-[#070a09] border border-[#1e2825] rounded px-3 py-2 text-xs font-mono text-white focus:border-orange-400 focus:outline-none placeholder:text-[#4a5a53]"
              placeholder="Paste your R2 Token Access Key ID"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-orange-300 mb-1 flex items-center justify-between">
              <span>R2 Secret Access Key *</span>
              <span className="text-[10px] text-[#7c9188] font-normal">From Cloudflare R2 Token</span>
            </label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={secretAccessKey}
                onChange={(e) => setSecretAccessKey(e.target.value)}
                className="w-full bg-[#070a09] border border-[#1e2825] rounded pl-3 pr-9 py-2 text-xs font-mono text-white focus:border-orange-400 focus:outline-none placeholder:text-[#4a5a53]"
                placeholder="Paste your R2 Token Secret Access Key"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4a5a53] hover:text-[#d8e6df]"
              >
                {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Cloudflare Step-by-Step Helper Box */}
        <div className="p-4 rounded bg-[#070a09] border border-[#1e2825] text-xs space-y-2">
          <div className="flex items-center gap-2 text-orange-300 font-semibold">
            <HelpCircle className="w-4 h-4" />
            <span>How to generate your R2 Token in Cloudflare (3 steps):</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11.5px] text-[#7c9188] leading-relaxed">
            <li>Log in to <strong className="text-[#d8e6df]">Cloudflare Dashboard</strong> and select <strong className="text-[#d8e6df]">R2</strong> in the sidebar.</li>
            <li>Click <strong className="text-orange-400 font-mono">Manage R2 API Tokens</strong> on the right, then <strong className="text-[#d8e6df]">Create API Token</strong>.</li>
            <li>Set permissions to <strong className="text-[#39ff9c]">Object Read &amp; Write</strong>, click <strong className="text-[#d8e6df]">Create API Token</strong>, and paste your <strong className="text-white">Access Key ID</strong> and <strong className="text-white">Secret Access Key</strong> here.</li>
          </ol>
        </div>

        {/* Test Result Message */}
        {testResult && (
          <div
            className={`p-3 rounded text-xs font-mono border ${
              testResult.success
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}
          >
            {testResult.success ? `✓ ${testResult.message}` : `✕ ${testResult.error || testResult.message}`}
          </div>
        )}

        {/* Save & Test Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1e2825]">
          <button
            type="button"
            disabled={isTesting}
            onClick={handleTestConnection}
            className="flex items-center gap-2 px-4 py-2 rounded bg-[#161f1c] hover:bg-[#1d2925] text-[#d8e6df] text-xs font-medium border border-[#1e2825] transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
            <span>{isTesting ? 'Testing Cloudflare R2...' : 'Test Connection'}</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveConfig}
            className="flex items-center gap-2 px-5 py-2 rounded bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saveSuccess ? 'Saved! ✓' : isSaving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {/* R2 Asset & File Manager */}
      <div className="p-6 rounded bg-[#0f1412] border border-[#1e2825] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2825] pb-4">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>Cloudflare R2 Asset Explorer</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#161f1c] text-[#39ff9c] font-mono">
                {files.length} Files
              </span>
            </h2>
            <p className="text-xs text-[#7c9188] mt-0.5">
              Upload and explore campaign images, brand logos, and attachments with direct public URLs
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchFiles}
              disabled={isLoadingFiles}
              className="p-2 rounded bg-[#161f1c] hover:bg-[#1d2925] text-[#7c9188] hover:text-white border border-[#1e2825] transition-colors"
              title="Refresh Files"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
            </button>

            <label className="flex items-center gap-2 px-4 py-2 rounded bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold cursor-pointer transition-colors shadow-sm">
              <UploadCloud className="w-4 h-4" />
              <span>{isUploading ? 'Uploading...' : 'Upload Asset to R2'}</span>
              <input
                type="file"
                className="hidden"
                onChange={handleFileInputChange}
                disabled={isUploading}
              />
            </label>
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded p-6 text-center transition-colors cursor-pointer ${
            dragOver
              ? 'border-orange-400 bg-orange-500/10'
              : 'border-[#1e2825] hover:border-[#2b3a35] bg-[#070a09]'
          }`}
        >
          <UploadCloud className="w-7 h-7 text-orange-400 mx-auto mb-2 opacity-80" />
          <p className="text-xs text-[#d8e6df] font-medium">
            Drag and drop any image or file here or click <span className="text-orange-400 underline">Browse</span> to upload directly to Cloudflare R2
          </p>
          <p className="text-[10px] text-[#4a5a53] mt-1 font-mono">
            PNG, JPG, SVG, GIF, CSV, PDF, HTML (Zero egress bandwidth)
          </p>
        </div>

        {/* Search bar */}
        {files.length > 0 && (
          <div className="relative max-w-sm">
            <Search className="w-3.5 h-3.5 text-[#4a5a53] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files by name..."
              className="w-full bg-[#070a09] border border-[#1e2825] rounded pl-8 pr-3 py-1.5 text-xs text-[#d8e6df] placeholder:text-[#4a5a53] focus:border-[#39ff9c] focus:outline-none font-mono"
            />
          </div>
        )}

        {/* Files Table */}
        {files.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#4a5a53]">
            No assets uploaded to Cloudflare R2 yet. Upload an image to test direct links in your emails.
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#4a5a53]">
            No assets match your search query "{searchQuery}".
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#1e2825] rounded">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1e2825] bg-[#070a09] text-[10px] uppercase tracking-[0.15em] text-[#4a5a53]">
                  <th className="py-3 px-4 font-semibold">Asset File</th>
                  <th className="py-3 px-3 font-semibold">MIME Type</th>
                  <th className="py-3 px-3 font-semibold">Size</th>
                  <th className="py-3 px-3 font-semibold">Storage</th>
                  <th className="py-3 px-3 font-semibold">Date</th>
                  <th className="py-3 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2825]">
                {filteredFiles.map((file) => (
                  <tr key={file.key} className="hover:bg-[#131a17] transition-colors">
                    <td className="py-3 px-4 font-sans font-medium text-white flex items-center gap-2 max-w-xs truncate">
                      <FileText className="w-4 h-4 text-orange-400 shrink-0" />
                      <span className="truncate">{file.filename || file.key}</span>
                    </td>
                    <td className="py-3 px-3 text-[#7c9188] text-[11px]">{file.mimeType}</td>
                    <td className="py-3 px-3 text-[#d8e6df] text-[11px]">
                      {file.size > 1024 * 1024
                        ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                        : `${(file.size / 1024).toFixed(1)} KB`}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-500/10 text-orange-300 border border-orange-500/20">
                        {file.storageProvider || 'cloudflare-r2'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#4a5a53] text-[11px]">
                      {new Date(file.uploadedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(file.url)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-[#161f1c] hover:bg-[#1d2925] text-[#d8e6df] text-[11px] transition-colors"
                          title="Copy Direct URL to paste in email"
                        >
                          {copiedUrl === file.url ? (
                            <>
                              <Check className="w-3 h-3 text-[#39ff9c]" />
                              <span className="text-[#39ff9c]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-orange-400" />
                              <span>Copy URL</span>
                            </>
                          )}
                        </button>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded bg-[#161f1c] hover:bg-[#1d2925] text-[#7c9188] hover:text-white transition-colors"
                          title="Open File in New Tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteFile(file.key)}
                          className="p-1 rounded bg-[#161f1c] hover:bg-rose-950/50 text-[#7c9188] hover:text-rose-400 transition-colors"
                          title="Delete File"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
