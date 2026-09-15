import React, { useState } from 'react';
import {
  Server,
  Globe,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Edit2,
  Lock,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { Sender, Domain } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface SendersViewProps {
  senders: Sender[];
  domains: Domain[];
  onAddSender: (sender: any) => Promise<void>;
  onAddDomain: (domain: any) => Promise<void>;
}

export const SendersView: React.FC<SendersViewProps> = ({
  senders,
  domains,
  onAddSender,
  onAddDomain,
}) => {
  const [activeTab, setActiveTab] = useState<'senders' | 'domains'>('senders');
  const [showAddSenderModal, setShowAddSenderModal] = useState(false);
  const [showAddDomainModal, setShowAddDomainModal] = useState(false);

  // New Sender Form
  const [senderName, setSenderName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [domainId, setDomainId] = useState(domains[0]?.id || '');
  const [dailyLimit, setDailyLimit] = useState('50000');
  const [hourlyLimit, setHourlyLimit] = useState('5000');

  // New Domain Form
  const [newDomainName, setNewDomainName] = useState('');
  const [dkimSelector, setDkimSelector] = useState('kumo2026');

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const submitNewSender = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddSender({
      name: senderName,
      fromEmail,
      replyTo,
      domainId,
      dailyLimit,
      hourlyLimit,
    });
    setShowAddSenderModal(false);
    setSenderName('');
    setFromEmail('');
  };

  const submitNewDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddDomain({
      domainName: newDomainName,
      dkimSelector,
    });
    setShowAddDomainModal(false);
    setNewDomainName('');
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-400" />
            <span>Senders &amp; DNS Domains</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Authenticated sender identities and cryptographic alignment (SPF, DKIM, DMARC, MX).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'senders' ? (
            <button
              onClick={() => setShowAddSenderModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Sender</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAddDomainModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Domain</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
        <button
          onClick={() => setActiveTab('senders')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t-md text-xs font-medium transition ${
            activeTab === 'senders'
              ? 'border-b-2 border-indigo-500 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Sender Identities ({senders.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('domains')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t-md text-xs font-medium transition ${
            activeTab === 'domains'
              ? 'border-b-2 border-indigo-500 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Sending Domains ({domains.length})</span>
        </button>
      </div>

      {/* TAB 1: Senders List */}
      {activeTab === 'senders' && (
        <div className="rounded-lg bg-[#111827] border border-slate-800/90 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0A0F1A] text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Sender Identity</th>
                  <th className="py-3 px-4 font-semibold">From Email</th>
                  <th className="py-3 px-4 font-semibold">Domain</th>
                  <th className="py-3 px-4 font-semibold">Verification</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Sent Volume</th>
                  <th className="py-3 px-4 font-semibold">Bounce Rate</th>
                  <th className="py-3 px-4 font-semibold hidden lg:table-cell">Rate Limits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {senders.map((s) => {
                  const bncRate = s.sentCount > 0 ? ((s.bouncedCount / s.sentCount) * 100).toFixed(2) : '0.00';
                  return (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-white">{s.name}</td>
                      <td className="py-3 px-4 font-mono text-indigo-300">{s.fromEmail}</td>
                      <td className="py-3 px-4 text-slate-400">{s.domainName || 'N/A'}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={s.verification} />
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-white">{s.sentCount.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono text-amber-400">{bncRate}%</td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[10px] hidden lg:table-cell">
                        {s.hourlyLimit.toLocaleString()}/hr &bull; {s.dailyLimit.toLocaleString()}/day
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Domains List & DNS Records */}
      {activeTab === 'domains' && (
        <div className="space-y-6">
          {domains.map((dom) => (
            <div key={dom.id} className="p-6 rounded-lg bg-[#111827] border border-slate-800/90 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white font-mono">{dom.domainName}</h2>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Created on {new Date(dom.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded bg-[#0A0F1A] border border-slate-800">
                    <span className="text-slate-400">SPF:</span>
                    <span className="text-emerald-400 font-mono font-semibold">{dom.spfStatus}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded bg-[#0A0F1A] border border-slate-800">
                    <span className="text-slate-400">DKIM:</span>
                    <span className="text-emerald-400 font-mono font-semibold">{dom.dkimStatus}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded bg-[#0A0F1A] border border-slate-800">
                    <span className="text-slate-400">DMARC:</span>
                    <span className="text-emerald-400 font-mono font-semibold">{dom.dmarcStatus}</span>
                  </div>
                </div>
              </div>

              {/* DNS Records Table */}
              <div className="space-y-2.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Required DNS Cryptographic Alignment Records
                </div>

                {/* SPF Record */}
                <div className="p-3.5 rounded-md bg-[#0A0F1A] border border-slate-800 flex items-center justify-between text-xs font-mono">
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[10px] uppercase tracking-wider">
                      TXT (SPF) &bull; Host: @
                    </span>
                    <div className="text-slate-200">{dom.spfRecord}</div>
                  </div>
                  <button
                    onClick={() => handleCopy(dom.spfRecord, `spf_${dom.id}`)}
                    className="p-1.5 text-slate-400 hover:text-white"
                    title="Copy Record"
                  >
                    {copiedKey === `spf_${dom.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* DKIM Record */}
                <div className="p-3.5 rounded-md bg-[#0A0F1A] border border-slate-800 flex items-center justify-between text-xs font-mono">
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[10px] uppercase tracking-wider">
                      TXT (DKIM) &bull; Host: {dom.dkimSelector}._domainkey.{dom.domainName}
                    </span>
                    <div className="text-slate-200 truncate max-w-xl">{dom.dkimPublicKey}</div>
                  </div>
                  <button
                    onClick={() => handleCopy(dom.dkimPublicKey, `dkim_${dom.id}`)}
                    className="p-1.5 text-slate-400 hover:text-white"
                    title="Copy Record"
                  >
                    {copiedKey === `dkim_${dom.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* DMARC Record */}
                <div className="p-3.5 rounded-md bg-[#0A0F1A] border border-slate-800 flex items-center justify-between text-xs font-mono">
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[10px] uppercase tracking-wider">
                      TXT (DMARC) &bull; Host: _dmarc.{dom.domainName}
                    </span>
                    <div className="text-slate-200">{dom.dmarcRecord}</div>
                  </div>
                  <button
                    onClick={() => handleCopy(dom.dmarcRecord, `dmarc_${dom.id}`)}
                    className="p-1.5 text-slate-400 hover:text-white"
                    title="Copy Record"
                  >
                    {copiedKey === `dmarc_${dom.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add Sender */}
      {showAddSenderModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl font-sans">
            <h2 className="text-sm font-semibold text-white">Add Sender Identity</h2>
            <form onSubmit={submitNewSender} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. Acme Notifications"
                  className="w-full bg-[#0A0F1A] border border-slate-800 rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500/60"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">From Email Address</label>
                <input
                  type="email"
                  required
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="alerts@mail.acme-corp.com"
                  className="w-full bg-[#0A0F1A] border border-slate-800 rounded px-3 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500/60"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Attached Domain</label>
                <select
                  value={domainId}
                  onChange={(e) => setDomainId(e.target.value)}
                  className="w-full bg-[#0A0F1A] border border-slate-800 rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500/60"
                >
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.domainName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Daily Limit</label>
                  <input
                    type="number"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    className="w-full bg-[#0A0F1A] border border-slate-800 rounded px-3 py-1.5 text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Hourly Limit</label>
                  <input
                    type="number"
                    value={hourlyLimit}
                    onChange={(e) => setHourlyLimit(e.target.value)}
                    className="w-full bg-[#0A0F1A] border border-slate-800 rounded px-3 py-1.5 text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddSenderModal(false)}
                  className="px-3.5 py-1.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Create Sender
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Domain */}
      {showAddDomainModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl font-sans">
            <h2 className="text-sm font-semibold text-white">Add Sending Domain</h2>
            <form onSubmit={submitNewDomain} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Domain FQDN</label>
                <input
                  type="text"
                  required
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  placeholder="e.g. mail.acme-corp.com"
                  className="w-full bg-[#0A0F1A] border border-slate-800 rounded px-3 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500/60"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">DKIM Key Selector</label>
                <input
                  type="text"
                  required
                  value={dkimSelector}
                  onChange={(e) => setDkimSelector(e.target.value)}
                  placeholder="kumo2026"
                  className="w-full bg-[#0A0F1A] border border-slate-800 rounded px-3 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500/60"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddDomainModal(false)}
                  className="px-3.5 py-1.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Register Domain
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
