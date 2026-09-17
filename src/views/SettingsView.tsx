import React, { useState, useEffect } from 'react';
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

const safeJson = async (res: Response) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      success: false,
      error: text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) || `Server returned HTTP ${res.status}`,
    };
  }
};

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
  const [activeTab, setActiveTab] = useState<'kumomta' | 'ses' | 'convex' | 'prometheus' | 'compliance' | 'apikeys'>('kumomta');

  // Convex form state
  const [convexUrl, setConvexUrl] = useState(settings?.convex?.url || 'https://clean-badger-123.convex.cloud');
  const [convexTesting, setConvexTesting] = useState(false);
  const [convexTestResult, setConvexTestResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);
  const [convexFiles, setConvexFiles] = useState<any[]>([]);
  const [convexLoadingFiles, setConvexLoadingFiles] = useState(false);
  const [convexUploading, setConvexUploading] = useState(false);
  const [copiedConvexUrl, setCopiedConvexUrl] = useState<string | null>(null);

  const fetchConvexFiles = async () => {
    setConvexLoadingFiles(true);
    try {
      const res = await fetch('/api/storage/files');
      if (res.ok) {
        const d = await safeJson(res);
        setConvexFiles(d.files || []);
      }
    } catch {
      // ignore
    } finally {
      setConvexLoadingFiles(false);
    }
  };

  const handleConvexUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setConvexUploading(true);
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
          fetchConvexFiles();
        }
      };
      reader.readAsDataURL(file);
    } catch {
      // ignore
    } finally {
      setConvexUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteConvexFile = async (key: string) => {
    try {
      await fetch(`/api/storage/files/${encodeURIComponent(key)}`, { method: 'DELETE' });
      fetchConvexFiles();
    } catch {
      // ignore
    }
  };

  const copyConvexFileUrl = (url: string) => {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedConvexUrl(url);
    setTimeout(() => setCopiedConvexUrl(null), 2000);
  };

  // KumoMTA form state
  const [kumoHost, setKumoHost] = useState(settings?.kumomta?.host || '51.170.132.86');
  const [kumoPort, setKumoPort] = useState(settings?.kumomta?.port || 2525);
  const [kumoUsername, setKumoUsername] = useState(settings?.kumomta?.username || '');
  const [kumoPassword, setKumoPassword] = useState(settings?.kumomta?.password || '');
  const [kumoSecure, setKumoSecure] = useState(settings?.kumomta?.secure || false);
  const [kumoApiUrl, setKumoApiUrl] = useState(settings?.kumomta?.managementApiUrl || 'http://127.0.0.1:8000');
  const [kumoSpool, setKumoSpool] = useState(settings?.kumomta?.spoolDir || '/var/spool/kumomta');
  const [kumoConcurrency, setKumoConcurrency] = useState(settings?.kumomta?.maxConcurrency || 64);
  const [kumoRateLimit, setKumoRateLimit] = useState(settings?.kumomta?.rateLimitPerSec || 250);
  const [kumoTesting, setKumoTesting] = useState(false);
  const [kumoTestResult, setKumoTestResult] = useState<{ success?: boolean; message?: string; error?: string; relayAllowed?: boolean } | null>(null);

  // Sync state if settings prop changes
  useEffect(() => {
    if (settings?.kumomta) {
      if (settings.kumomta.host !== undefined) setKumoHost(settings.kumomta.host);
      if (settings.kumomta.port !== undefined) setKumoPort(settings.kumomta.port);
      if (settings.kumomta.username !== undefined) setKumoUsername(settings.kumomta.username);
      if (settings.kumomta.password !== undefined) setKumoPassword(settings.kumomta.password);
      if (settings.kumomta.secure !== undefined) setKumoSecure(settings.kumomta.secure);
      if (settings.kumomta.managementApiUrl !== undefined) setKumoApiUrl(settings.kumomta.managementApiUrl);
      if (settings.kumomta.spoolDir !== undefined) setKumoSpool(settings.kumomta.spoolDir);
      if (settings.kumomta.maxConcurrency !== undefined) setKumoConcurrency(settings.kumomta.maxConcurrency);
      if (settings.kumomta.rateLimitPerSec !== undefined) setKumoRateLimit(settings.kumomta.rateLimitPerSec);
    }
  }, [settings]);

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
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans text-gray-800">
      {/* Header */}
      <div className="pb-4 border-b border-[#CCD2D8]">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#8B1A10]" />
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">
            Infrastructure Configuration
          </h1>
        </div>
        <p className="text-xs text-gray-600 mt-1">
          Engine connections, KumoMTA spool thresholds, Amazon SES endpoints, and security keys
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#CCD2D8] gap-1 overflow-x-auto pb-0 text-xs font-bold bg-[#F1F4F7] px-2 pt-2 rounded-t">
        <button
          onClick={() => setActiveTab('kumomta')}
          className={`px-3.5 py-2 rounded-t transition-all flex items-center gap-2 border-t border-x ${
            activeTab === 'kumomta'
              ? 'bg-gradient-to-b from-[#E0A328] via-[#C98B18] to-[#AC710D] text-white shadow-xs border-[#E9B446]'
              : 'bg-[#E2E7EC] text-gray-700 hover:bg-[#D8DEE4] border-transparent'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>KumoMTA Node</span>
        </button>
        <button
          onClick={() => setActiveTab('ses')}
          className={`px-3.5 py-2 rounded-t transition-all flex items-center gap-2 border-t border-x ${
            activeTab === 'ses'
              ? 'bg-gradient-to-b from-[#E0A328] via-[#C98B18] to-[#AC710D] text-white shadow-xs border-[#E9B446]'
              : 'bg-[#E2E7EC] text-gray-700 hover:bg-[#D8DEE4] border-transparent'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Amazon SES Relay</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('convex');
            fetchConvexFiles();
          }}
          className={`px-3.5 py-2 rounded-t transition-all flex items-center gap-2 border-t border-x ${
            activeTab === 'convex'
              ? 'bg-gradient-to-b from-[#E0A328] via-[#C98B18] to-[#AC710D] text-white shadow-xs border-[#E9B446]'
              : 'bg-[#E2E7EC] text-gray-700 hover:bg-[#D8DEE4] border-transparent'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Convex Storage</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/25 text-white font-mono">Real-time</span>
        </button>
        <button
          onClick={() => setActiveTab('prometheus')}
          className={`px-3.5 py-2 rounded-t transition-all flex items-center gap-2 border-t border-x ${
            activeTab === 'prometheus'
              ? 'bg-gradient-to-b from-[#E0A328] via-[#C98B18] to-[#AC710D] text-white shadow-xs border-[#E9B446]'
              : 'bg-[#E2E7EC] text-gray-700 hover:bg-[#D8DEE4] border-transparent'
          }`}
        >
          <BarChart className="w-4 h-4" />
          <span>Prometheus Exporter</span>
        </button>
        <button
          onClick={() => setActiveTab('compliance')}
          className={`px-3.5 py-2 rounded-t transition-all flex items-center gap-2 border-t border-x ${
            activeTab === 'compliance'
              ? 'bg-gradient-to-b from-[#E0A328] via-[#C98B18] to-[#AC710D] text-white shadow-xs border-[#E9B446]'
              : 'bg-[#E2E7EC] text-gray-700 hover:bg-[#D8DEE4] border-transparent'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Compliance &amp; Tracking</span>
        </button>
        <button
          onClick={() => setActiveTab('apikeys')}
          className={`px-3.5 py-2 rounded-t transition-all flex items-center gap-2 border-t border-x ${
            activeTab === 'apikeys'
              ? 'bg-gradient-to-b from-[#E0A328] via-[#C98B18] to-[#AC710D] text-white shadow-xs border-[#E9B446]'
              : 'bg-[#E2E7EC] text-gray-700 hover:bg-[#D8DEE4] border-transparent'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>API Access Keys</span>
        </button>
      </div>

      {/* TAB 1: KumoMTA */}
      {activeTab === 'kumomta' && (
        <div className="p-6 rounded bg-white border border-[#CCD2D8] space-y-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#CCD2D8] pb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">KumoMTA Spool Cluster Settings</h2>
              <p className="text-xs text-gray-600 mt-0.5">High-concurrency Rust-based MTA node configuration</p>
            </div>
            <span className="text-xs text-[#15803D] font-mono font-bold flex items-center gap-1.5 bg-[#DCFCE7] px-2.5 py-1 rounded border border-[#BBF7D0]">
              <span className="w-2 h-2 rounded-full bg-[#15803D] animate-pulse" /> Cluster Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Internal SMTP Ingest Host</label>
              <input
                type="text"
                value={kumoHost}
                onChange={(e) => setKumoHost(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                placeholder="e.g. 51.170.132.86 or 127.0.0.1"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Enter your VPS public IP / domain (e.g. 51.170.132.86).
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Ingest Port</label>
              <input
                type="number"
                value={kumoPort}
                onChange={(e) => setKumoPort(Number(e.target.value))}
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                placeholder="2525"
              />
              <p className="text-[10px] text-gray-500 mt-1">Default listener port (2525 or 587 or 25)</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">SMTP Auth Username (Optional)</label>
              <input
                type="text"
                value={kumoUsername}
                onChange={(e) => setKumoUsername(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                placeholder="Leave blank if IP-whitelisted"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">SMTP Auth Password (Optional)</label>
              <input
                type="password"
                value={kumoPassword}
                onChange={(e) => setKumoPassword(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                placeholder="Leave blank if IP-whitelisted"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">KumoMTA HTTP Management API</label>
              <input
                type="text"
                value={kumoApiUrl}
                onChange={(e) => setKumoApiUrl(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Spool Storage Directory Path</label>
              <input
                type="text"
                value={kumoSpool}
                onChange={(e) => setKumoSpool(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Max In-Flight Concurrency</label>
              <input
                type="number"
                value={kumoConcurrency}
                onChange={(e) => setKumoConcurrency(Number(e.target.value))}
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Max Spool Rate Limit (msgs/sec)</label>
              <input
                type="number"
                value={kumoRateLimit}
                onChange={(e) => setKumoRateLimit(Number(e.target.value))}
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
              />
            </div>
          </div>

          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded p-3 text-xs text-[#92400E] flex flex-col gap-1">
            <span className="font-bold flex items-center gap-1.5 text-[#B45309]">
              <AlertCircle className="w-3.5 h-3.5" /> Note on 550 Relaying Not Permitted
            </span>
            <p className="text-[11px] leading-relaxed">
              If tests return <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[#92400E]">550 5.7.1 relaying not permitted</code>, your KumoMTA server on the VPS requires authorization for remote injection. In your <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[#92400E]">init.lua</code>, add the client subnet or configure authentication in <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[#92400E]">kumo.on('smtp_server_auth_plain', ...)</code> or define <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[#92400E]">relay_hosts</code>.
            </p>
          </div>

          {kumoTestResult && (
            <div
              className={`p-3 rounded text-xs font-mono border ${
                kumoTestResult.success
                  ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                  : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
              }`}
            >
              {kumoTestResult.success ? `✓ ${kumoTestResult.message}` : `✕ ${kumoTestResult.error}`}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#CCD2D8]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={kumoTesting}
                onClick={async () => {
                  setKumoTesting(true);
                  setKumoTestResult(null);
                  try {
                    const res = await fetch('/api/settings/verify-kumo', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        host: kumoHost,
                        port: kumoPort,
                        username: kumoUsername || undefined,
                        password: kumoPassword || undefined,
                        checkRelay: false,
                      }),
                    });
                    const d = await safeJson(res);
                    setKumoTestResult(d);
                  } catch (e: any) {
                    setKumoTestResult({ success: false, error: e.message });
                  } finally {
                    setKumoTesting(false);
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 rounded bg-[#37474F] hover:bg-[#263238] text-white text-xs font-semibold transition-colors shadow-2xs"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{kumoTesting ? 'Testing Port...' : '1. Test Port Connectivity'}</span>
              </button>

              <button
                type="button"
                disabled={kumoTesting}
                onClick={async () => {
                  setKumoTesting(true);
                  setKumoTestResult(null);
                  try {
                    const res = await fetch('/api/settings/verify-kumo', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        host: kumoHost,
                        port: kumoPort,
                        username: kumoUsername || undefined,
                        password: kumoPassword || undefined,
                        checkRelay: true,
                        testRecipient: 'jafa.service@gmail.com',
                        senderEmail: 'service@amiralucia.com',
                      }),
                    });
                    const d = await safeJson(res);
                    setKumoTestResult(d);
                  } catch (e: any) {
                    setKumoTestResult({ success: false, error: e.message });
                  } finally {
                    setKumoTesting(false);
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 rounded bg-[#37474F] hover:bg-[#263238] text-white text-xs font-semibold transition-colors shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>{kumoTesting ? 'Checking Relay...' : '2. Test Mail Relay'}</span>
              </button>
            </div>

            <button
              onClick={() =>
                handleSaveCategory('kumomta', {
                  host: kumoHost,
                  port: kumoPort,
                  username: kumoUsername || undefined,
                  password: kumoPassword || undefined,
                  secure: kumoSecure,
                  managementApiUrl: kumoApiUrl,
                  spoolDir: kumoSpool,
                  maxConcurrency: kumoConcurrency,
                  rateLimitPerSec: kumoRateLimit,
                })
              }
              className="flex items-center gap-2 px-4 py-2 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveStatus === 'kumomta' ? 'Saved!' : 'Save KumoMTA Config'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: SES */}
      {activeTab === 'ses' && (
        <div className="p-6 rounded bg-white border border-[#CCD2D8] space-y-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#CCD2D8] pb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Amazon SES Upstream Relay Configuration</h2>
              <p className="text-xs text-gray-600 mt-0.5">AWS Simple Email Service relay parameters and SNS feedback loops</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">AWS SES Target Region</label>
              <input
                type="text"
                value={sesRegion}
                onChange={(e) => setSesRegion(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                placeholder="eu-west-1"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Upstream SMTP Gateway</label>
              <input
                type="text"
                value={sesSmtpHost}
                onChange={(e) => setSesSmtpHost(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                placeholder="email-smtp.eu-west-1.amazonaws.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">SES SMTP Username (Access Key)</label>
              <input
                type="text"
                value={sesSmtpUser}
                onChange={(e) => setSesSmtpUser(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                placeholder="AKIA..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">SES SMTP Password (Generated for SES)</label>
              <input
                type="password"
                value={sesSmtpPass}
                onChange={(e) => setSesSmtpPass(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                placeholder="Enter SES SMTP Password"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">SES Configuration Set</label>
              <input
                type="text"
                value={sesConfigSet}
                onChange={(e) => setSesConfigSet(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">SNS Webhook Event Endpoint</label>
              <input
                type="text"
                value={sesWebhookUrl}
                onChange={(e) => setSesWebhookUrl(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
              />
            </div>
          </div>

          {sesTestResult && (
            <div
              className={`p-3 rounded text-xs font-mono border ${
                sesTestResult.success
                  ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                  : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
              }`}
            >
              {sesTestResult.success ? `✓ ${sesTestResult.message}` : `✕ ${sesTestResult.error}`}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-[#CCD2D8]">
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
                  const d = await safeJson(res);
                  setSesTestResult(d);
                } catch (e: any) {
                  setSesTestResult({ success: false, error: e.message });
                } finally {
                  setSesTesting(false);
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded bg-[#37474F] hover:bg-[#263238] text-white text-xs font-semibold transition-colors shadow-2xs"
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
              className="flex items-center gap-2 px-4 py-2 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveStatus === 'ses' ? 'Saved!' : 'Save SES Config'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB: Convex Database & Storage */}
      {activeTab === 'convex' && (
        <div className="space-y-6">
          {/* Main Config Card */}
          <div className="p-6 rounded bg-white border border-[#CCD2D8] space-y-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#CCD2D8] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-gray-900">Convex Cloud Database &amp; Storage Engine</h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0] font-mono font-bold">
                    Real-Time Reactive
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">
                  Convex serves as the real-time database and file storage engine for EmailinOPS campaigns, contacts, senders, and assets
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-[#166534] font-bold">
                <span className="w-2 h-2 rounded-full bg-[#15803D] animate-pulse" />
                <span>Convex Connected</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Convex Deployment URL <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={convexUrl}
                onChange={(e) => setConvexUrl(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                placeholder="https://your-deployment.convex.cloud"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                All database records (campaigns, messages, senders, suppression lists, contacts) and media assets are synchronized with Convex.
              </p>
            </div>

            {/* Test result banner */}
            {convexTestResult && (
              <div
                className={`p-3 rounded text-xs font-mono border ${
                  convexTestResult.success
                    ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                    : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                }`}
              >
                {convexTestResult.success ? `✓ ${convexTestResult.message}` : `✕ ${convexTestResult.error || convexTestResult.message}`}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[#CCD2D8]">
              <button
                type="button"
                disabled={convexTesting}
                onClick={async () => {
                  setConvexTesting(true);
                  setConvexTestResult(null);
                  try {
                    const res = await fetch('/api/storage/test', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ url: convexUrl }),
                    });
                    const d = await safeJson(res);
                    setConvexTestResult(d);
                    if (d.success) fetchConvexFiles();
                  } catch (e: any) {
                    setConvexTestResult({ success: false, error: e.message });
                  } finally {
                    setConvexTesting(false);
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 rounded bg-[#37474F] hover:bg-[#263238] text-white text-xs font-semibold transition-colors shadow-2xs"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{convexTesting ? 'Testing Convex...' : 'Test Convex Connection'}</span>
              </button>

              <button
                onClick={async () => {
                  await handleSaveCategory('convex', { url: convexUrl });
                }}
                className="flex items-center gap-2 px-4 py-2 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saveStatus === 'convex' ? 'Saved!' : 'Save Convex Config'}</span>
              </button>
            </div>
          </div>

          {/* Convex Asset & File Explorer */}
          <div className="p-6 rounded bg-white border border-[#CCD2D8] space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#CCD2D8] pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span>Convex File &amp; Media Explorer</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono font-bold border border-gray-200">
                    {convexFiles.length} {convexFiles.length === 1 ? 'file' : 'files'}
                  </span>
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Upload campaign banners, newsletter graphics, or attachments directly to Convex Storage
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchConvexFiles}
                  disabled={convexLoadingFiles}
                  className="p-1.5 rounded bg-white border border-[#CCD2D8] hover:bg-gray-100 text-gray-700 transition-colors shadow-2xs"
                  title="Refresh Files"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${convexLoadingFiles ? 'animate-spin' : ''}`} />
                </button>
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold cursor-pointer transition-colors shadow-xs">
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{convexUploading ? 'Uploading...' : 'Upload Asset'}</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleConvexUpload}
                    disabled={convexUploading}
                  />
                </label>
              </div>
            </div>

            {/* Files List */}
            {convexFiles.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-[#CCD2D8] rounded">
                <UploadCloud className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-xs text-gray-700 font-bold">No files uploaded in Convex Storage yet</p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Upload images, logos, or attachments to serve them in email campaigns
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-[#CCD2D8] rounded">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#546E7A] text-white uppercase font-mono text-[10px] tracking-wider border-b border-[#37474F]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">File / Asset</th>
                      <th className="py-2.5 px-3 font-semibold">Type</th>
                      <th className="py-2.5 px-3 font-semibold">Size</th>
                      <th className="py-2.5 px-3 font-semibold">Storage</th>
                      <th className="py-2.5 px-3 font-semibold">Uploaded</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px]">
                    {convexFiles.map((file, idx) => (
                      <tr
                        key={file.key}
                        className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'} hover:bg-[#FFF9E6]`}
                      >
                        <td className="py-2.5 px-3 font-sans font-medium text-gray-900 flex items-center gap-2 max-w-xs truncate">
                          <FileText className="w-3.5 h-3.5 text-[#15803D] shrink-0" />
                          <span className="truncate">{file.filename || file.key}</span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600">{file.mimeType}</td>
                        <td className="py-2.5 px-3 text-gray-900 font-bold">
                          {file.size > 1024 * 1024
                            ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                            : `${(file.size / 1024).toFixed(1)} KB`}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0] font-bold">
                            {file.storageProvider || 'convex'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600">
                          {new Date(file.uploadedAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => copyConvexFileUrl(file.url)}
                              className="p-1 rounded bg-white border border-[#CCD2D8] hover:bg-gray-100 text-gray-700"
                              title="Copy Public URL for Email"
                            >
                              {copiedConvexUrl === file.url ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded bg-white border border-[#CCD2D8] hover:bg-gray-100 text-gray-700"
                              title="Open File"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteConvexFile(file.key)}
                              className="p-1 rounded bg-white border border-[#CCD2D8] hover:bg-rose-50 text-gray-500 hover:text-rose-600"
                              title="Delete from Convex"
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
        <div className="p-6 rounded bg-white border border-[#CCD2D8] space-y-5 shadow-2xs">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Prometheus Metrics Exporter</h2>
            <p className="text-xs text-gray-600 mt-0.5">
              Scrape endpoint formatted according to OpenMetrics / Prometheus specification (RFC standard)
            </p>
          </div>

          <div className="p-4 rounded bg-[#F8FAFC] border border-[#CCD2D8] space-y-2 font-mono text-xs">
            <div className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Standard Metrics Endpoint:</div>
            <div className="text-gray-900 font-bold flex items-center justify-between">
              <span className="text-[#8B1A10]">GET /api/metrics</span>
              <a
                href="/api/metrics"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-[#8B1A10] hover:underline font-sans font-bold"
              >
                <span>Raw OpenMetrics Output</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">Prometheus Scrape Interval</label>
            <input
              type="text"
              value={promScrapeInterval}
              onChange={(e) => setPromScrapeInterval(e.target.value)}
              className="w-full max-w-xs bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* TAB 4: Compliance */}
      {activeTab === 'compliance' && (
        <div className="p-6 rounded bg-white border border-[#CCD2D8] space-y-5 shadow-2xs">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Deliverability Compliance &amp; Tracking</h2>
            <p className="text-xs text-gray-600 mt-0.5">CAN-SPAM, GDPR, and RFC 8058 One-Click Unsubscribe settings</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Click Tracking CNAME Domain</label>
              <input
                type="text"
                value={trackDomain}
                onChange={(e) => setTrackDomain(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Physical Sender Postal Address</label>
              <input
                type="text"
                value={postalAddress}
                onChange={(e) => setPostalAddress(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs text-gray-900 focus:border-[#8B1A10] focus:outline-none"
              />
            </div>

            <div className="pt-2 flex flex-col gap-3 text-xs">
              <label className="flex items-center gap-2 text-gray-800 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={openPixel}
                  onChange={(e) => setOpenPixel(e.target.checked)}
                  className="rounded border-[#CCD2D8] text-[#8B1A10] focus:ring-[#8B1A10]"
                />
                <span>Enable transparent 1x1 tracking pixel injection for open-rate analytics</span>
              </label>

              <label className="flex items-center gap-2 text-gray-800 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={clickTracking}
                  onChange={(e) => setClickTracking(e.target.checked)}
                  className="rounded border-[#CCD2D8] text-[#8B1A10] focus:ring-[#8B1A10]"
                />
                <span>Enable automated URL wrapping for link-click telemetry</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-[#CCD2D8]">
            <button
              onClick={() =>
                handleSaveCategory('compliance', {
                  trackingDomain: trackDomain,
                  postalAddress,
                  openPixelTracking: openPixel,
                  clickTracking,
                })
              }
              className="flex items-center gap-2 px-4 py-2 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveStatus === 'compliance' ? 'Saved!' : 'Save Compliance Rules'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: API Keys */}
      {activeTab === 'apikeys' && (
        <div className="p-6 rounded bg-white border border-[#CCD2D8] space-y-5 shadow-2xs">
          <div>
            <h2 className="text-sm font-bold text-gray-900">API Access Keys</h2>
            <p className="text-xs text-gray-600 mt-0.5">
              Generate programmatic authorization tokens for REST &amp; KumoMTA injection endpoints
            </p>
          </div>

          {/* New Token Banner */}
          {newGeneratedToken && (
            <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] text-xs space-y-2">
              <div className="font-bold text-[#92400E] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#15803D]" /> API Secret Key Generated
              </div>
              <div className="text-[#92400E]">
                Please copy this secret key immediately. You will not be able to view it again.
              </div>
              <div className="p-2.5 rounded bg-white border border-[#CCD2D8] font-mono text-gray-900 flex items-center justify-between">
                <span>{newGeneratedToken}</span>
                <button onClick={copyToken} className="hover:text-gray-900 text-gray-500">
                  {copiedKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
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
              className="flex-1 max-w-sm bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-[#8B1A10] focus:outline-none"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Generate Key
            </button>
          </form>

          {/* API Keys Table */}
          <div className="pt-2">
            <div className="overflow-x-auto border border-[#CCD2D8] rounded">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#546E7A] text-white uppercase font-mono text-[10px] tracking-wider border-b border-[#37474F]">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Key Name</th>
                    <th className="py-2.5 px-3 font-semibold">Prefix</th>
                    <th className="py-2.5 px-3 font-semibold">Created Date</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px]">
                  {apiKeys.map((k, idx) => (
                    <tr
                      key={k.id}
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'} hover:bg-[#FFF9E6]`}
                    >
                      <td className="py-2.5 px-3 font-sans font-medium text-gray-900">{k.name}</td>
                      <td className="py-2.5 px-3 text-gray-600">{k.keyPrefix}</td>
                      <td className="py-2.5 px-3 text-gray-600">{new Date(k.createdAt).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => onRevokeApiKey(k.id)}
                          className="p-1 text-gray-400 hover:text-rose-600"
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
        </div>
      )}
    </div>
  );
};
