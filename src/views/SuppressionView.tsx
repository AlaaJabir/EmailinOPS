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
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans text-gray-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#CCD2D8]">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#8B1A10]" />
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#8B1A10]" />
              <span>Suppression &amp; Compliance Filter</span>
            </h1>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Global suppression lists (hard bounces, spam complaints, and manual opt-outs) to protect IP reputation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-gray-100 text-gray-700 border border-[#CCD2D8] text-xs font-semibold transition shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Suppression</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 rounded bg-white border border-[#CCD2D8] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppressed emails or reasons..."
            className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded pl-9 pr-4 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-[#8B1A10] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-white border border-[#CCD2D8] rounded px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-[#8B1A10]"
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
      <div className="rounded bg-white border border-[#CCD2D8] overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="bg-[#546E7A] text-white uppercase font-mono text-[10px] tracking-wider border-b border-[#37474F]">
            <tr>
              <th className="py-2.5 px-4 font-semibold">Suppressed Email</th>
              <th className="py-2.5 px-4 font-semibold">Category</th>
              <th className="py-2.5 px-4 font-semibold">Reason</th>
              <th className="py-2.5 px-4 font-semibold">Logged Date</th>
              <th className="py-2.5 px-4 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] font-sans">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-500">
                  No suppressed recipients found.
                </td>
              </tr>
            ) : (
              filtered.map((s, idx) => (
                <tr
                  key={s.id}
                  className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'} hover:bg-[#FFF9E6] transition-colors`}
                >
                  <td className="py-2.5 px-4 font-mono font-medium text-gray-900">{s.email}</td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        s.type === 'HARD_BOUNCE'
                          ? 'bg-rose-50 text-[#C62828] border-rose-200'
                          : s.type === 'COMPLAINT'
                          ? 'bg-amber-50 text-[#D97706] border-amber-200'
                          : 'bg-blue-50 text-[#1E40AF] border-blue-200'
                      }`}
                    >
                      {s.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-gray-600 max-w-xs truncate">{s.reason || '-'}</td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-gray-600">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => onRemoveSuppression(s.id)}
                      className="p-1.5 rounded hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#CCD2D8] rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl font-sans text-gray-800">
            <h2 className="text-sm font-bold text-gray-900 border-b border-[#CCD2D8] pb-2">
              Add Recipient to Suppression List
            </h2>
            <form onSubmit={handleAdd} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="bounce@destination.com"
                  className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-1.5 text-gray-900 font-mono focus:outline-none focus:border-[#8B1A10]"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Suppression Category</label>
                <select
                  value={suppressionType}
                  onChange={(e) => setSuppressionType(e.target.value)}
                  className="w-full bg-white border border-[#CCD2D8] rounded px-3 py-1.5 text-gray-900 focus:outline-none focus:border-[#8B1A10]"
                >
                  <option value="MANUAL">Manual Suppression</option>
                  <option value="UNSUBSCRIBE">Unsubscribe Request</option>
                  <option value="HARD_BOUNCE">Permanent Hard Bounce (5.x.x)</option>
                  <option value="COMPLAINT">Spam Complaint / FBL</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Reason / Notes</label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded p-2.5 text-gray-900 focus:outline-none focus:border-[#8B1A10]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#CCD2D8]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded bg-gray-100 border border-[#CCD2D8] text-gray-700 hover:bg-gray-200 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs"
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
