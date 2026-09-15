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
  UserX,
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
    a.download = `emailinops_suppression_list_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <span>Suppression &amp; Compliance Filter</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Global suppression lists (hard bounces, spam complaints, and manual opt-outs) to protect IP reputation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#162032] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-medium transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Suppression</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 rounded-lg bg-[#111827] border border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppressed emails or reasons..."
            className="w-full bg-[#0A0F1A] border border-slate-800 rounded-md pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500/60 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#0A0F1A] border border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="HARD_BOUNCE">Hard Bounces</option>
            <option value="COMPLAINT">Spam Complaints</option>
            <option value="UNSUBSCRIBE">Unsubscribes</option>
            <option value="MANUAL">Manual Suppressions</option>
          </select>
        </div>
      </div>

      {/* Suppression Table */}
      <div className="rounded-lg bg-[#111827] border border-slate-800/90 overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-[#0A0F1A] text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4 font-semibold">Suppressed Email</th>
              <th className="py-3 px-4 font-semibold">Category</th>
              <th className="py-3 px-4 font-semibold">Reason</th>
              <th className="py-3 px-4 font-semibold">Logged Date</th>
              <th className="py-3 px-4 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500">
                  No suppressed recipients found.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-white">{s.email}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                        s.type === 'HARD_BOUNCE'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : s.type === 'COMPLAINT'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                      }`}
                    >
                      {s.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{s.reason || '-'}</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onRemoveSuppression(s.id)}
                      className="p-1.5 rounded hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 transition"
                      title="Unsuppress Email"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Add Suppression */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl font-sans">
            <h2 className="text-sm font-semibold text-white">Add Recipient to Suppression List</h2>
            <form onSubmit={handleAdd} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="bounce@destination.com"
                  className="w-full bg-[#0A0F1A] border border-slate-800 rounded px-3 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500/60"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Suppression Category</label>
                <select
                  value={suppressionType}
                  onChange={(e) => setSuppressionType(e.target.value)}
                  className="w-full bg-[#0A0F1A] border border-slate-800 rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500/60"
                >
                  <option value="MANUAL">Manual Suppression</option>
                  <option value="UNSUBSCRIBE">Unsubscribe Request</option>
                  <option value="HARD_BOUNCE">Permanent Hard Bounce (5.x.x)</option>
                  <option value="COMPLAINT">Spam Complaint / FBL</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Reason / Notes</label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-[#0A0F1A] border border-slate-800 rounded p-2.5 text-white focus:outline-none focus:border-indigo-500/60"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Save Suppression
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
