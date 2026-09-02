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
    <div className="p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif italic text-white tracking-tight flex items-center gap-2">
            Senders & Sending Domains
          </h1>
          <p className="text-xs text-[#888888] mt-1">
            Manage authenticated RFC sender identities and DNS cryptographic alignment (DKIM / SPF / DMARC)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'senders' ? (
            <button
              onClick={() => setShowAddSenderModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Sender Identity</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAddDomainModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Sending Domain</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white-10 gap-6 text-xs font-medium">
        <button
          onClick={() => setActiveTab('senders')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'senders'
              ? 'border-white text-white font-semibold'
              : 'border-transparent text-[#888888] hover:text-white'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Sender Identities ({senders.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('domains')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'domains'
              ? 'border-white text-white font-semibold'
              : 'border-transparent text-[#888888] hover:text-white'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Sending Domains ({domains.length})</span>
        </button>
      </div>

      {/* TAB 1: Senders List */}
      {activeTab === 'senders' && (
        <div className="space-y-4">
          <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white-10 text-[10px] uppercase tracking-[0.15em] text-[#888888]">
                    <th className="pb-3 font-semibold">Sender Identity</th>
                    <th className="pb-3 font-semibold">From Email</th>
                    <th className="pb-3 font-semibold">Domain</th>
                    <th className="pb-3 font-semibold">Verification</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Sent Volume</th>
                    <th className="pb-3 font-semibold">Bounce Rate</th>
                    <th className="pb-3 font-semibold">Rate Limits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white-5 font-mono text-[11px]">
                  {senders.map((s) => {
                    const bncRate = s.sentCount > 0 ? ((s.bouncedCount / s.sentCount) * 100).toFixed(2) : '0.00';
                    return (
                      <tr key={s.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 font-sans font-medium text-white">{s.name}</td>
                        <td className="py-3 text-zinc-300">{s.fromEmail}</td>
                        <td className="py-3 text-[#888888]">{s.domainName || 'N/A'}</td>
                        <td className="py-3">
                          <StatusBadge status={s.verification} />
                        </td>
                        <td className="py-3">
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-xs bg-white/5 border border-white-10 text-zinc-300">
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3 text-white">{s.sentCount.toLocaleString()}</td>
                        <td className="py-3 text-amber-300">{bncRate}%</td>
                        <td className="py-3 text-[#888888] text-[10px]">
                          {s.hourlyLimit.toLocaleString()} / hr &bull; {s.dailyLimit.toLocaleString()} / day
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

      {/* TAB 2: Domains List & DNS Records */}
      {activeTab === 'domains' && (
        <div className="space-y-6">
          {domains.map((dom) => (
            <div key={dom.id} className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white-10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-sm bg-white/5 border border-white-10 flex items-center justify-center text-white">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white font-mono">{dom.domainName}</h2>
                    <div className="text-[11px] text-[#888888] mt-0.5">Created on {new Date(dom.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-sm bg-[#050505] border border-white-10">
                    <span className="text-[#888888]">SPF:</span>
                    <span className="text-emerald-400 font-mono font-semibold">{dom.spfStatus}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-sm bg-[#050505] border border-white-10">
                    <span className="text-[#888888]">DKIM:</span>
                    <span className="text-emerald-400 font-mono font-semibold">{dom.dkimStatus}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-sm bg-[#050505] border border-white-10">
                    <span className="text-[#888888]">DMARC:</span>
                    <span className="text-emerald-400 font-mono font-semibold">{dom.dmarcStatus}</span>
                  </div>
                </div>
              </div>

              {/* DNS Records Table */}
              <div className="space-y-2.5">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#888888]">Required DNS Configuration Records</div>
                
                {/* SPF Record */}
                <div className="p-3.5 rounded-sm bg-[#050505] border border-white-10 flex items-center justify-between text-xs font-mono">
                  <div className="space-y-1">
                    <span className="text-[#888888] text-[10px] uppercase tracking-wider">TXT (SPF) &bull; Host: @</span>
                    <div className="text-zinc-200">{dom.spfRecord}</div>
                  </div>
                  <button
                    onClick={() => handleCopy(dom.spfRecord, `spf_${dom.id}`)}
                    className="p-1.5 text-[#888888] hover:text-white"
                    title="Copy Record"
                  >
                    {copiedKey === `spf_${dom.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* DKIM Record */}
                <div className="p-3.5 rounded-sm bg-[#050505] border border-white-10 flex items-center justify-between text-xs font-mono">
                  <div className="space-y-1">
                    <span className="text-[#888888] text-[10px] uppercase tracking-wider">TXT (DKIM) &bull; Host: {dom.dkimSelector}._domainkey.{dom.domainName}</span>
                    <div className="text-zinc-200 truncate max-w-xl">{dom.dkimPublicKey}</div>
                  </div>
                  <button
                    onClick={() => handleCopy(dom.dkimPublicKey, `dkim_${dom.id}`)}
                    className="p-1.5 text-[#888888] hover:text-white"
                    title="Copy Record"
                  >
                    {copiedKey === `dkim_${dom.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* DMARC Record */}
                <div className="p-3.5 rounded-sm bg-[#050505] border border-white-10 flex items-center justify-between text-xs font-mono">
                  <div className="space-y-1">
                    <span className="text-[#888888] text-[10px] uppercase tracking-wider">TXT (DMARC) &bull; Host: _dmarc.{dom.domainName}</span>
                    <div className="text-zinc-200">{dom.dmarcRecord}</div>
                  </div>
                  <button
                    onClick={() => handleCopy(dom.dmarcRecord, `dmarc_${dom.id}`)}
                    className="p-1.5 text-[#888888] hover:text-white"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F0F0F] border border-white-10 rounded-sm max-w-md w-full p-6 space-y-4 shadow-2xl font-sans">
            <h2 className="text-sm font-serif italic text-white">Add Sender Identity</h2>
            <form onSubmit={submitNewSender} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. Acme Billing"
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">From Email Address</label>
                <input
                  type="email"
                  required
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="billing@transact.acme-corp.io"
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">Attached Domain</label>
                <select
                  value={domainId}
                  onChange={(e) => setDomainId(e.target.value)}
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white"
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
                  <label className="block text-xs font-medium text-[#888888] mb-1">Daily Limit</label>
                  <input
                    type="number"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#888888] mb-1">Hourly Limit</label>
                  <input
                    type="number"
                    value={hourlyLimit}
                    onChange={(e) => setHourlyLimit(e.target.value)}
                    className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddSenderModal(false)}
                  className="px-3 py-1.5 rounded-sm bg-white/5 hover:bg-white/10 text-[#888888] hover:text-white border border-white-10 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F0F0F] border border-white-10 rounded-sm max-w-md w-full p-6 space-y-4 shadow-2xl font-sans">
            <h2 className="text-sm font-serif italic text-white">Add Sending Domain</h2>
            <form onSubmit={submitNewDomain} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">Domain FQDN</label>
                <input
                  type="text"
                  required
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  placeholder="e.g. alerts.acme-corp.com"
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">DKIM Key Selector</label>
                <input
                  type="text"
                  required
                  value={dkimSelector}
                  onChange={(e) => setDkimSelector(e.target.value)}
                  placeholder="kumo2026"
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs font-mono text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddDomainModal(false)}
                  className="px-3 py-1.5 rounded-sm bg-white/5 hover:bg-white/10 text-[#888888] hover:text-white border border-white-10 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold"
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
