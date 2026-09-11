import React, { useState } from 'react';
import {
  Settings,
  Cpu,
  Radio,
  BarChart,
  ShieldCheck,
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Save,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  UploadCloud,
  FileText,
  Globe,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { ApiKey } from '../types';

interface SettingsViewProps {
  settings: any;
  apiKeys: ApiKey[];
  onSaveSettings: (category: string, values: any) => Promise<void>;
  onCreateApiKey: (name: string) => Promise<{ secretToken: string }>;
  onRevokeApiKey: (id: string) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  apiKeys,
  onSaveSettings,
  onCreateApiKey,
  onRevokeApiKey,
}) => {
  const [activeTab, setActiveTab] = useState<'kumomta' | 'ses' | 'r2' | 'prometheus' | 'compliance' | 'apikeys'>('kumomta');

  // Cloudflare R2 form state
  const [r2AccountId, setR2AccountId] = useState(settings?.r2?.accountId || 'b1aabfa2a055b8aa67596c2bd7a69cd0');
  const [r2Endpoint, setR2Endpoint] = useState(settings?.r2?.endpoint || 'https://b1aabfa2a055b8aa67596c2bd7a69cd0.r2.cloudflarestorage.com');
  const [r2AccessKeyId, setR2AccessKeyId] = useState(settings?.r2?.accessKeyId || '');
  const [r2SecretAccessKey, setR2SecretAccessKey] = useState(settings?.r2?.secretAccessKey || '');
  const [r2BucketName, setR2BucketName] = useState(settings?.r2?.bucketName || 'emailops-assets');
  const [r2PublicDomain, setR2PublicDomain] = useState(settings?.r2?.publicDomain || '');
  const [showR2Secret, setShowR2Secret] = useState(false);
  const [r2Testing, setR2Testing] = useState(false);
  const [r2TestResult, setR2TestResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);
  const [r2Files, setR2Files] = useState<any[]>([]);
  const [r2LoadingFiles, setR2LoadingFiles] = useState(false);
  const [r2Uploading, setR2Uploading] = useState(false);
  const [copiedR2Url, setCopiedR2Url] = useState<string | null>(null);

  const fetchR2Files = async () => {
    setR2LoadingFiles(true);
    try {
      const res = await fetch('/api/storage/files');
      if (res.ok) {
        const d = await res.json();
        setR2Files(d.files || []);
      }
    } catch {
      // ignore
    } finally {
      setR2LoadingFiles(false);
    }
  };

  const handleR2Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setR2Uploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const res = await fetch('/api/storage/upload', {
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
          fetchR2Files();
        }
      };
      reader.readAsDataURL(file);
    } catch {
      // ignore
    } finally {
      setR2Uploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteR2File = async (key: string) => {
    try {
      await fetch(`/api/storage/files/${encodeURIComponent(key)}`, { method: 'DELETE' });
      fetchR2Files();
    } catch {
      // ignore
    }
  };

  const copyR2FileUrl = (url: string) => {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedR2Url(url);
    setTimeout(() => setCopiedR2Url(null), 2000);
  };

  // KumoMTA form state
  const [kumoHost, setKumoHost] = useState(settings?.kumomta?.host || '127.0.0.1');
  const [kumoPort, setKumoPort] = useState(settings?.kumomta?.port || 2525);
  const [kumoApiUrl, setKumoApiUrl] = useState(settings?.kumomta?.managementApiUrl || 'http://127.0.0.1:8000');
  const [kumoSpool, setKumoSpool] = useState(settings?.kumomta?.spoolDir || '/var/spool/kumomta');
  const [kumoConcurrency, setKumoConcurrency] = useState(settings?.kumomta?.maxConcurrency || 64);
  const [kumoRateLimit, setKumoRateLimit] = useState(settings?.kumomta?.rateLimitPerSec || 250);

  // SES form state
  const [sesRegion, setSesRegion] = useState(settings?.ses?.region || 'eu-west-1');
  const [sesSmtpHost, setSesSmtpHost] = useState(settings?.ses?.smtpHost || '6wxef9y9cm3r.fips.wmjb.mail-manager-smtp.amazonaws.com');
  const [sesSmtpUser, setSesSmtpUser] = useState(settings?.ses?.smtpUser || 'inp-trqycfx2ios4ywikwlcwnqod');
  const [sesSmtpPass, setSesSmtpPass] = useState(settings?.ses?.smtpPass || 'alaa.JABIR06');
  const [sesConfigSet, setSesConfigSet] = useState(settings?.ses?.configurationSet || 'EmailOps-Production-ConfigSet');
  const [sesWebhookUrl, setSesWebhookUrl] = useState(settings?.ses?.webhookEndpoint || 'https://emailops.internal/api/webhooks/ses');
  const [sesTesting, setSesTesting] = useState(false);
  const [sesTestResult, setSesTestResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);

  // Prometheus state
  const [promScrapeInterval, setPromScrapeInterval] = useState(settings?.prometheus?.scrapeInterval || '15s');

  // Compliance state
  const [trackDomain, setTrackDomain] = useState(settings?.compliance?.trackingDomain || 'amiralucia.com');
  const [openPixel, setOpenPixel] = useState(settings?.compliance?.openPixelTracking ?? true);
  const [clickTracking, setClickTracking] = useState(settings?.compliance?.clickTracking ?? true);
  const [postalAddress, setPostalAddress] = useState(
    settings?.compliance?.postalAddress || '100 Silicon Way, Suite 400, San Francisco, CA 94107'
  );

  // API Key creation
  const [newKeyName, setNewKeyName] = useState('');
  const [newGeneratedToken, setNewGeneratedToken] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleSaveCategory = async (category: string, values: any) => {
    await onSaveSettings(category, values);
    setSaveStatus(category);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName) return;
    const res = await onCreateApiKey(newKeyName);
    setNewGeneratedToken(res.secretToken);
    setNewKeyName('');
  };

  const copyToken = () => {
    if (newGeneratedToken) {
      navigator.clipboard.writeText(newGeneratedToken);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          Infrastructure Configuration
        </h1>
        <p className="text-xs text-[#888888] mt-1">
          Engine connections, KumoMTA spool thresholds, Amazon SES endpoints, and security keys
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white-10 gap-6 text-xs font-medium">
        <button
          onClick={() => setActiveTab('kumomta')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'kumomta' ? 'border-white text-white font-semibold' : 'border-transparent text-[#888888] hover:text-white'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>KumoMTA Engine</span>
        </button>
        <button
          onClick={() => setActiveTab('ses')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'ses' ? 'border-white text-white font-semibold' : 'border-transparent text-[#888888] hover:text-white'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Amazon SES Relay</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('r2');
            fetchR2Files();
          }}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'r2' ? 'border-white text-white font-semibold' : 'border-transparent text-[#888888] hover:text-white'
          }`}
        >
          <HardDrive className="w-4 h-4 text-orange-400" />
          <span>Cloudflare R2 Storage</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-mono">0$ Egress</span>
        </button>
        <button
          onClick={() => setActiveTab('prometheus')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'prometheus' ? 'border-white text-white font-semibold' : 'border-transparent text-[#888888] hover:text-white'
          }`}
        >
          <BarChart className="w-4 h-4" />
          <span>Prometheus Exporter</span>
        </button>
        <button
          onClick={() => setActiveTab('compliance')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'compliance' ? 'border-white text-white font-semibold' : 'border-transparent text-[#888888] hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Compliance & Tracking</span>
        </button>
        <button
          onClick={() => setActiveTab('apikeys')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'apikeys' ? 'border-white text-white font-semibold' : 'border-transparent text-[#888888] hover:text-white'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>API Access Keys</span>
        </button>
      </div>

      {/* TAB 1: KumoMTA */}
      {activeTab === 'kumomta' && (
        <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-5">
          <div className="flex items-center justify-between border-b border-white-10 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">KumoMTA Spool Cluster Settings</h2>
              <p className="text-xs text-[#888888] mt-0.5">High-concurrency Rust-based MTA node configuration</p>
            </div>
            <span className="text-xs text-white font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Cluster Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#888888] mb-1">Internal SMTP Ingest Host</label>
              <input
                type="text"
                value={kumoHost}
                onChange={(e) => setKumoHost(e.target.value)}
                className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888888] mb-1">Ingest Port</label>
              <input
                type="number"
                value={kumoPort}
                onChange={(e) => setKumoPort(Number(e.target.value))}
                className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888888] mb-1">KumoMTA HTTP Management API</label>
              <input
                type="text"
                value={kumoApiUrl}
                onChange={(e) => setKumoApiUrl(e.target.value)}
                className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888888] mb-1">Spool Storage Directory Path</label>
              <input
                type="text"
                value={kumoSpool}
                onChange={(e) => setKumoSpool(e.target.value)}
                className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888888] mb-1">Max In-Flight Concurrency</label>
              <input
                type="number"
                value={kumoConcurrency}
                onChange={(e) => setKumoConcurrency(Number(e.target.value))}
                className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888888] mb-1">Max Spool Rate Limit (msgs/sec)</label>
              <input
                type="number"
                value={kumoRateLimit}
                onChange={(e) => setKumoRateLimit(Number(e.target.value))}
                className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-white-10">
            <button
              onClick={() =>
                handleSaveCategory('kumomta', {
                  host: kumoHost,
                  port: kumoPort,
                  managementApiUrl: kumoApiUrl,
                  spoolDir: kumoSpool,
                  maxConcurrency: kumoConcurrency,
                  rateLimitPerSec: kumoRateLimit,
                })
              }
              className="flex items-center gap-2 px-4 py-2 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveStatus === 'kumomta' ? 'Saved!' : 'Save KumoMTA Config'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: SES */}
      {activeTab === 'ses' && (
        <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-5">
          <div className="flex items-center justify-between border-b border-white-10 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Amazon SES Upstream Relay Configuration</h2>
              <p className="text-xs text-[#888888] mt-0.5">AWS Simple Email Service relay parameters and SNS feedback loops</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#888888] mb-1">AWS SES Target Region</label>
              <input
                type="text"
                value={sesRegion}
                onChange={(e) => setSesRegion(e.target.value)}
                className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
                placeholder="eu-west-1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888888] mb-1">Upstream SMTP Gateway</label>
              <input
                type="text"
                value={sesSmtpHost}
                onChange={(e) => setSesSmtpHost(e.target.value)}
                className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
                placeholder="email-smtp.eu-west-1.amazonaws.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888888] mb-1">SES SMTP Username (Access Key)</label>
              <input
                type="text"
                value={sesSmtpUser}
                onChange={(e) => setSesSmtpUser(e.target.value)}
                className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
                placeholder="AKIA..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888888] mb-1">SES SMTP Password (Generated for SES)</label>
              <input
                type="password"
                value={sesSmtpPass}
                onChange={(e) => setSesSmtpPass(e.target.value)}
                className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
                placeholder="Enter SES SMTP Password"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888888] mb-1">SES Configuration Set</label>
              <input
                type="text"
                value={sesConfigSet}
                onChange={(e) => setSesConfigSet(e.target.value)}
                className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888888] mb-1">SNS Webhook Event Endpoint</label>
              <input
                type="text"
                value={sesWebhookUrl}
                onChange={(e) => setSesWebhookUrl(e.target.value)}
                className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
              />
            </div>
          </div>

          {sesTestResult && (
            <div
              className={`p-3 rounded-sm text-xs font-mono border ${
                sesTestResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              {sesTestResult.success ? `✓ ${sesTestResult.message}` : `✕ ${sesTestResult.error}`}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-white-10">
            <button
              type="button"
              disabled={sesTesting}
              onClick={async () => {
                setSesTesting(true);
                setSesTestResult(null);
                try {
                  const res = await fetch('/api/settings/verify-ses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      smtpUser: sesSmtpUser,
                      smtpPass: sesSmtpPass,
                      region: sesRegion,
                      smtpHost: sesSmtpHost,
                    }),
                  });
                  const d = await res.json();
                  setSesTestResult(d);
                } catch (e: any) {
                  setSesTestResult({ success: false, error: e.message });
                } finally {
                  setSesTesting(false);
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>{sesTesting ? 'Testing Connection...' : 'Test SES Credentials'}</span>
            </button>

            <button
              onClick={() =>
                handleSaveCategory('ses', {
                  region: sesRegion,
                  smtpHost: sesSmtpHost,
                  smtpUser: sesSmtpUser,
                  smtpPass: sesSmtpPass,
                  configurationSet: sesConfigSet,
                  webhookEndpoint: sesWebhookUrl,
                })
              }
              className="flex items-center gap-2 px-4 py-2 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveStatus === 'ses' ? 'Saved!' : 'Save SES Config'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB: Cloudflare R2 Storage */}
      {activeTab === 'r2' && (
        <div className="space-y-6">
          {/* Main Config Card */}
          <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-5">
            <div className="flex items-center justify-between border-b border-white-10 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white">Cloudflare R2 Object Storage (S3 API)</h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    Zero Egress Cost ($0)
                  </span>
                </div>
                <p className="text-xs text-[#888888] mt-0.5">
                  Connect your Cloudflare R2 bucket to store campaign media, images, attachments, and exports with unlimited free bandwidth
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span>R2 S3-Compatible</span>
              </div>
            </div>

            {/* Quick Helper Note */}
            <div className="p-3.5 rounded-sm bg-orange-950/20 border border-orange-500/20 text-xs text-orange-200/90 flex items-start gap-2.5">
              <HardDrive className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-orange-300">Connected Cloudflare Account: {r2AccountId}</p>
                <p className="text-[11px] text-orange-200/70">
                  By routing assets through Cloudflare R2, uploads and downloads will no longer consume Supabase quota. You only need to provide your R2 API Token credentials below.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">Cloudflare Account ID</label>
                <input
                  type="text"
                  value={r2AccountId}
                  onChange={(e) => setR2AccountId(e.target.value)}
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
                  placeholder="b1aabfa2a055b8aa67596c2bd7a69cd0"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">R2 S3 Endpoint</label>
                <input
                  type="text"
                  value={r2Endpoint}
                  onChange={(e) => setR2Endpoint(e.target.value)}
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
                  placeholder="https://...r2.cloudflarestorage.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">R2 Target Bucket Name</label>
                <input
                  type="text"
                  value={r2BucketName}
                  onChange={(e) => setR2BucketName(e.target.value)}
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
                  placeholder="emailops-assets"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">
                  Public Bucket URL / Custom Domain <span className="text-zinc-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={r2PublicDomain}
                  onChange={(e) => setR2PublicDomain(e.target.value)}
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
                  placeholder="https://pub-xxxx.r2.dev or https://assets.amiralucia.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">
                  R2 Access Key ID <span className="text-orange-400">*</span>
                </label>
                <input
                  type="text"
                  value={r2AccessKeyId}
                  onChange={(e) => setR2AccessKeyId(e.target.value)}
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
                  placeholder="Paste your R2 Token Access Key ID"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">
                  R2 Secret Access Key <span className="text-orange-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showR2Secret ? 'text' : 'password'}
                    value={r2SecretAccessKey}
                    onChange={(e) => setR2SecretAccessKey(e.target.value)}
                    className="w-full bg-[#050505] border border-white-10 rounded-sm pl-3 pr-9 py-2 text-xs font-mono text-white"
                    placeholder="Paste your R2 Token Secret Access Key"
                  />
                  <button
                    type="button"
                    onClick={() => setShowR2Secret(!showR2Secret)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                  >
                    {showR2Secret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Step by step instructions accordion */}
            <div className="p-3.5 rounded-sm bg-[#080808] border border-white-5 text-xs text-zinc-400 space-y-1.5">
              <span className="font-semibold text-zinc-300 block">How to get your R2 API Token in Cloudflare:</span>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-zinc-400">
                <li>Log in to <strong className="text-zinc-200">Cloudflare Dashboard</strong> &gt; Click <strong className="text-zinc-200">R2</strong> in the sidebar.</li>
                <li>Create a bucket named <strong className="text-orange-300">{r2BucketName || 'emailops-assets'}</strong> (or use an existing one).</li>
                <li>On the right side of the R2 page, click <strong className="text-zinc-200">Manage R2 API Tokens</strong> &gt; <strong className="text-zinc-200">Create API Token</strong>.</li>
                <li>Set Permissions to <strong className="text-emerald-300">Object Read &amp; Write</strong>, select your bucket, then click <strong className="text-zinc-200">Create API Token</strong>.</li>
                <li>Copy the <strong className="text-zinc-200">Access Key ID</strong> and <strong className="text-zinc-200">Secret Access Key</strong> and paste them above.</li>
              </ol>
            </div>

            {/* Test result banner */}
            {r2TestResult && (
              <div
                className={`p-3 rounded-sm text-xs font-mono border ${
                  r2TestResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                {r2TestResult.success ? `✓ ${r2TestResult.message}` : `✕ ${r2TestResult.error || r2TestResult.message}`}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-white-10">
              <button
                type="button"
                disabled={r2Testing}
                onClick={async () => {
                  setR2Testing(true);
                  setR2TestResult(null);
                  try {
                    const res = await fetch('/api/storage/test', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        accountId: r2AccountId,
                        endpoint: r2Endpoint,
                        bucketName: r2BucketName,
                        accessKeyId: r2AccessKeyId,
                        secretAccessKey: r2SecretAccessKey,
                      }),
                    });
                    const d = await res.json();
                    setR2TestResult(d);
                    if (d.success) fetchR2Files();
                  } catch (e: any) {
                    setR2TestResult({ success: false, error: e.message });
                  } finally {
                    setR2Testing(false);
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
                <span>{r2Testing ? 'Testing R2 S3...' : 'Test Cloudflare R2 Connection'}</span>
              </button>

              <button
                onClick={async () => {
                  await handleSaveCategory('r2', {
                    accountId: r2AccountId,
                    endpoint: r2Endpoint,
                    bucketName: r2BucketName,
                    accessKeyId: r2AccessKeyId,
                    secretAccessKey: r2SecretAccessKey,
                    publicDomain: r2PublicDomain,
                  });
                  // Also update storage config directly
                  try {
                    await fetch('/api/storage/config', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        accountId: r2AccountId,
                        endpoint: r2Endpoint,
                        bucketName: r2BucketName,
                        accessKeyId: r2AccessKeyId,
                        secretAccessKey: r2SecretAccessKey,
                        publicDomain: r2PublicDomain,
                      }),
                    });
                  } catch {
                    // ignore
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saveStatus === 'r2' ? 'Saved!' : 'Save R2 Config'}</span>
              </button>
            </div>
          </div>

          {/* R2 Asset & File Explorer */}
          <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-4">
            <div className="flex items-center justify-between border-b border-white-10 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>Cloudflare R2 Bucket File Manager</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                    {r2Files.length} {r2Files.length === 1 ? 'file' : 'files'}
                  </span>
                </h3>
                <p className="text-xs text-[#888888] mt-0.5">
                  Upload campaign banners, newsletter graphics, or CSVs directly to R2
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchR2Files}
                  disabled={r2LoadingFiles}
                  className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                  title="Refresh Files"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${r2LoadingFiles ? 'animate-spin' : ''}`} />
                </button>
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold cursor-pointer transition-colors">
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{r2Uploading ? 'Uploading...' : 'Upload to R2'}</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleR2Upload}
                    disabled={r2Uploading}
                  />
                </label>
              </div>
            </div>

            {/* Files List */}
            {r2Files.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-white-10 rounded-sm">
                <UploadCloud className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-400 font-medium">No files uploaded in Cloudflare R2 yet</p>
                <p className="text-[11px] text-zinc-600 mt-1">
                  Upload images, logos, or attachments to serve them in email campaigns with 0$ egress costs
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white-10 text-[10px] uppercase tracking-[0.15em] text-[#888888]">
                      <th className="pb-3 font-semibold">File / Asset</th>
                      <th className="pb-3 font-semibold">Type</th>
                      <th className="pb-3 font-semibold">Size</th>
                      <th className="pb-3 font-semibold">Storage</th>
                      <th className="pb-3 font-semibold">Uploaded</th>
                      <th className="pb-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white-5 font-mono text-[11px]">
                    {r2Files.map((file) => (
                      <tr key={file.key} className="hover:bg-white/5">
                        <td className="py-3 font-sans font-medium text-white flex items-center gap-2 max-w-xs truncate">
                          <FileText className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                          <span className="truncate">{file.filename || file.key}</span>
                        </td>
                        <td className="py-3 text-[#888888]">{file.mimeType}</td>
                        <td className="py-3 text-zinc-300">
                          {file.size > 1024 * 1024
                            ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                            : `${(file.size / 1024).toFixed(1)} KB`}
                        </td>
                        <td className="py-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-500/10 text-orange-300 border border-orange-500/20">
                            {file.storageProvider || 'cloudflare-r2'}
                          </span>
                        </td>
                        <td className="py-3 text-[#888888]">
                          {new Date(file.uploadedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => copyR2FileUrl(file.url)}
                              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                              title="Copy Public URL for Email"
                            >
                              {copiedR2Url === file.url ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                              title="Open File"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteR2File(file.key)}
                              className="p-1 rounded bg-zinc-800 hover:bg-rose-900/60 text-zinc-400 hover:text-rose-300"
                              title="Delete from R2"
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
      )}

      {/* TAB 3: Prometheus */}
      {activeTab === 'prometheus' && (
        <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-white">Prometheus Metrics Exporter</h2>
            <p className="text-xs text-[#888888] mt-0.5">
              Scrape endpoint formatted according to OpenMetrics / Prometheus specification (RFC standard)
            </p>
          </div>

          <div className="p-4 rounded-sm bg-[#050505] border border-white-10 space-y-2 font-mono text-xs">
            <div className="text-[#888888] text-[10px] uppercase tracking-wider">Standard Metrics Endpoint:</div>
            <div className="text-white font-bold flex items-center justify-between">
              <span>GET /api/metrics</span>
              <a
                href="/api/metrics"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-[#888888] hover:text-white underline font-sans"
              >
                <span>Raw OpenMetrics Output</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#888888]">Prometheus Scrape Interval</label>
            <input
              type="text"
              value={promScrapeInterval}
              onChange={(e) => setPromScrapeInterval(e.target.value)}
              className="w-full max-w-xs bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
            />
          </div>
        </div>
      )}

      {/* TAB 4: Compliance */}
      {activeTab === 'compliance' && (
        <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-white">Deliverability Compliance & Tracking</h2>
            <p className="text-xs text-[#888888] mt-0.5">CAN-SPAM, GDPR, and RFC 8058 One-Click Unsubscribe settings</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#888888] mb-1">Click Tracking CNAME Domain</label>
              <input
                type="text"
                value={trackDomain}
                onChange={(e) => setTrackDomain(e.target.value)}
                className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#888888] mb-1">Physical Sender Postal Address</label>
              <input
                type="text"
                value={postalAddress}
                onChange={(e) => setPostalAddress(e.target.value)}
                className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="pt-2 flex flex-col gap-3 text-xs">
              <label className="flex items-center gap-2 text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={openPixel}
                  onChange={(e) => setOpenPixel(e.target.checked)}
                  className="rounded bg-[#050505] border-white-10 text-white"
                />
                <span>Enable transparent 1x1 tracking pixel injection for open-rate analytics</span>
              </label>

              <label className="flex items-center gap-2 text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={clickTracking}
                  onChange={(e) => setClickTracking(e.target.checked)}
                  className="rounded bg-[#050505] border-white-10 text-white"
                />
                <span>Enable automated URL wrapping for link-click telemetry</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-white-10">
            <button
              onClick={() =>
                handleSaveCategory('compliance', {
                  trackingDomain: trackDomain,
                  postalAddress,
                  openPixelTracking: openPixel,
                  clickTracking,
                })
              }
              className="flex items-center gap-2 px-4 py-2 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveStatus === 'compliance' ? 'Saved!' : 'Save Compliance Rules'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: API Keys */}
      {activeTab === 'apikeys' && (
        <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-white">API Access Keys</h2>
            <p className="text-xs text-[#888888] mt-0.5">
              Generate programmatic authorization tokens for REST & KumoMTA injection endpoints
            </p>
          </div>

          {/* New Token Banner */}
          {newGeneratedToken && (
            <div className="p-4 rounded-sm bg-white/5 border border-white-10 text-xs space-y-2">
              <div className="font-medium text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> API Secret Key Generated
              </div>
              <div className="text-[#888888]">
                Please copy this secret key immediately. You will not be able to view it again.
              </div>
              <div className="p-2.5 rounded-sm bg-[#050505] border border-white-10 font-mono text-white flex items-center justify-between">
                <span>{newGeneratedToken}</span>
                <button onClick={copyToken} className="hover:text-white text-[#888888]">
                  {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Create API Key Form */}
          <form onSubmit={handleCreateKey} className="flex items-center gap-3">
            <input
              type="text"
              required
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g. CI/CD Transactional Ingest"
              className="flex-1 max-w-sm bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs text-white placeholder:text-[#888888]"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Generate Key
            </button>
          </form>

          {/* API Keys Table */}
          <div className="pt-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white-10 text-[10px] uppercase tracking-[0.15em] text-[#888888]">
                  <th className="pb-3 font-semibold">Key Name</th>
                  <th className="pb-3 font-semibold">Prefix</th>
                  <th className="pb-3 font-semibold">Created Date</th>
                  <th className="pb-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white-5 font-mono text-[11px]">
                {apiKeys.map((k) => (
                  <tr key={k.id} className="hover:bg-white/5">
                    <td className="py-3 font-sans font-medium text-white">{k.name}</td>
                    <td className="py-3 text-[#888888]">{k.keyPrefix}</td>
                    <td className="py-3 text-[#888888]">{new Date(k.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => onRevokeApiKey(k.id)}
                        className="p-1 text-[#888888] hover:text-white"
                        title="Revoke Key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
