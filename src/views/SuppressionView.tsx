import React, { useState } from 'react';
import {
  ShieldAlert,
  Plus,
  Trash2,
  Download,
  Search,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';
import { Suppression } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface SuppressionViewProps {
  suppressions: Suppression[];
  onAddSuppression: (data: { email: string; reason: string; type: string }) => Promise<void>;
  onRemoveSuppression: (id: string) => Promise<void>;
}

export const SuppressionView: React.FC<SuppressionViewProps> = ({
  suppressions,
  onAddSuppression,
  onRemoveSuppression,
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Suppression Form
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('User requested manual unsubscribe');
  const [suppressionType, setSuppressionType] = useState('MANUAL');

  const filtered = suppressions.filter((s) => {
    const matchesSearch =
      !search ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.reason && s.reason.toLowerCase().includes(search.toLowerCase()));

    const matchesType = typeFilter === 'ALL' || s.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddSuppression({ email, reason, type: suppressionType });
    setShowAddModal(false);
    setEmail('');
  };

  const handleExportCsv = () => {
    const rows = ['Email,Type,Reason,Date Added'];
    suppressions.forEach((s) => {
      rows.push(`"${s.email}","${s.type}","${s.reason || ''}","${s.createdAt}"`);
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suppression-list-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif italic text-white tracking-tight flex items-center gap-2">
            Suppression & Compliance
          </h1>
          <p className="text-xs text-[#888888] mt-1">
            Hard bounces, spam complaints, and manual unsubscribes blocked automatically before KumoMTA spooling
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-sm bg-[#0F0F0F] hover:bg-white/10 text-white text-xs font-medium border border-white-10 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Suppression</span>
          </button>
        </div>
      </div>

      {/* Compliance Notice Banner */}
      <div className="p-5 rounded-sm bg-[#0F0F0F] border border-white-10 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-sm bg-white/5 border border-white-10 text-white">
            <ShieldAlert className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-medium text-white">Pre-Dispatch Gatekeeper Active</div>
            <div className="text-[#888888] mt-0.5 text-xs">
              Every message dispatched via API or Campaign wizard checks this list in-memory (&lt;1ms). Any suppressed address is rejected to preserve sender reputation.
            </div>
          </div>
        </div>
        <div className="text-right font-mono font-medium text-white text-xs">
          {suppressions.length} Active Records
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-sm bg-[#0F0F0F] border border-white-10 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppression records by email or reason..."
            className="w-full bg-[#050505] border border-white-10 rounded-sm pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-[#888888] focus:border-white/30 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none"
          >
            <option value="ALL">All Suppression Types</option>
            <option value="HARD_BOUNCE">Hard Bounce (Permanent)</option>
            <option value="COMPLAINT">Spam Complaint (FBL)</option>
            <option value="UNSUBSCRIBED">Unsubscribed (One-Click)</option>
            <option value="MANUAL">Manual Suppression</option>
          </select>
        </div>
      </div>

      {/* Suppression Table */}
      <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white-10 text-[10px] uppercase tracking-[0.15em] text-[#888888]">
                <th className="pb-3 font-semibold">Suppressed Email Address</th>
                <th className="pb-3 font-semibold">Type</th>
                <th className="pb-3 font-semibold">Diagnostic Reason</th>
                <th className="pb-3 font-semibold">Added Date</th>
                <th className="pb-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white-5 font-mono text-[11px]">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 text-white font-medium">{s.email}</td>
                  <td className="py-3">
                    <StatusBadge status={s.type} />
                  </td>
                  <td className="py-3 font-sans text-zinc-300 max-w-sm truncate" title={s.reason}>
                    {s.reason || '-'}
                  </td>
                  <td className="py-3 text-[#888888]">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => onRemoveSuppression(s.id)}
                      className="p-1 text-[#888888] hover:text-white transition-colors"
                      title="Remove from suppression list"
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

      {/* Modal: Add Suppression */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div className="bg-[#0F0F0F] border border-white-10 rounded-sm max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h2 className="text-sm font-serif italic text-white">Add Manual Suppression</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="blocked.user@domain.com"
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">Suppression Category</label>
                <select
                  value={suppressionType}
                  onChange={(e) => setSuppressionType(e.target.value)}
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white"
                >
                  <option value="MANUAL">Manual Suppression</option>
                  <option value="HARD_BOUNCE">Hard Bounce</option>
                  <option value="COMPLAINT">Complaint</option>
                  <option value="UNSUBSCRIBED">Unsubscribed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">Reason</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Legal opt-out request"
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-sm bg-white/5 hover:bg-white/10 text-[#888888] hover:text-white border border-white-10 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold"
                >
                  Add Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
