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
  const [activeTab, setActiveTab] = useState<'kumomta' | 'ses' | 'prometheus' | 'compliance' | 'apikeys'>('kumomta');

  // KumoMTA form state
  const [kumoHost, setKumoHost] = useState(settings?.kumomta?.host || '127.0.0.1');
  const [kumoPort, setKumoPort] = useState(settings?.kumomta?.port || 2525);
  const [kumoApiUrl, setKumoApiUrl] = useState(settings?.kumomta?.managementApiUrl || 'http://127.0.0.1:8000');
  const [kumoSpool, setKumoSpool] = useState(settings?.kumomta?.spoolDir || '/var/spool/kumomta');
  const [kumoConcurrency, setKumoConcurrency] = useState(settings?.kumomta?.maxConcurrency || 64);
  const [kumoRateLimit, setKumoRateLimit] = useState(settings?.kumomta?.rateLimitPerSec || 250);

  // SES form state
  const [sesRegion, setSesRegion] = useState(settings?.ses?.region || 'eu-west-1');
  const [sesSmtpHost, setSesSmtpHost] = useState(settings?.ses?.smtpHost || 'email-smtp.eu-west-1.amazonaws.com');
  const [sesConfigSet, setSesConfigSet] = useState(settings?.ses?.configurationSet || 'EmailOps-Production-ConfigSet');
  const [sesWebhookUrl, setSesWebhookUrl] = useState(settings?.ses?.webhookEndpoint || 'https://emailops.internal/api/webhooks/ses');

  // Prometheus state
  const [promScrapeInterval, setPromScrapeInterval] = useState(settings?.prometheus?.scrapeInterval || '15s');

  // Compliance state
  const [trackDomain, setTrackDomain] = useState(settings?.compliance?.trackingDomain || 'click.transact.acme-corp.io');
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
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888888] mb-1">Upstream SMTP Gateway</label>
              <input
                type="text"
                value={sesSmtpHost}
                onChange={(e) => setSesSmtpHost(e.target.value)}
                className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white"
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

          <div className="flex items-center justify-end pt-3 border-t border-white-10">
            <button
              onClick={() =>
                handleSaveCategory('ses', {
                  region: sesRegion,
                  smtpHost: sesSmtpHost,
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
