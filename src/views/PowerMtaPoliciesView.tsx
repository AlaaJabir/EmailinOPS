import React, { useState, useEffect } from 'react';
import { Gauge, Plus, Trash2, RefreshCw, Shield, Zap, Lock, Settings2 } from 'lucide-react';
import { DomainPolicy } from '../types';

interface PowerMtaPoliciesViewProps {
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  addToast: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export const PowerMtaPoliciesView: React.FC<PowerMtaPoliciesViewProps> = ({ authFetch, addToast }) => {
  const [policies, setPolicies] = useState<DomainPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [domainPattern, setDomainPattern] = useState('');
  const [maxMsgRate, setMaxMsgRate] = useState('100/m');
  const [maxConnections, setMaxConnections] = useState('10');
  const [useTls, setUseTls] = useState<'required' | 'ifavailable' | 'no'>('required');
  const [retryInterval, setRetryInterval] = useState('15m');
  const [bounceProcessing, setBounceProcessing] = useState(true);

  const loadPolicies = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/pmta/domain-policies');
      if (res.ok) {
        const d = await res.json();
        setPolicies(d.policies || []);
      }
    } catch (e: any) {
      addToast('error', 'Error loading policies', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/pmta/domain-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainPattern,
          maxMsgRate,
          maxConnections: Number(maxConnections) || 10,
          useTls,
          retryInterval,
          bounceProcessing,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to save policy');
      addToast('success', 'Policy Configured', d.message);
      setIsModalOpen(false);
      setDomainPattern('');
      loadPolicies();
    } catch (err: any) {
      addToast('error', 'Policy Error', err.message);
    }
  };

  const handleDeletePolicy = async (id: string, pattern: string) => {
    if (!confirm(`Delete rate limit policy for ${pattern}?`)) return;
    try {
      const res = await authFetch(`/api/pmta/domain-policies/${id}`, { method: 'DELETE' });
      if (res.ok) {
        addToast('info', 'Policy Removed', `Rule for ${pattern} removed.`);
        loadPolicies();
      }
    } catch (err: any) {
      addToast('error', 'Delete Failed', err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[#CCD2D8]">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#8B1A10]" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Email Speed Throttling &amp; ISP Policies</h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Fine-tuned delivery rate limits, concurrent SMTP connections, and TLS enforcement for major mailbox providers.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={loadPolicies}
            className="p-2 border border-[#CCD2D8] rounded bg-white hover:bg-gray-100 text-gray-700 transition shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#8B1A10]' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-1.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Domain Policy</span>
          </button>
        </div>
      </div>

      {/* Preset ISP Recommendations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#CCD2D8] p-3.5 space-y-1.5 border-t-4 border-t-[#2563EB] shadow-2xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-900 text-xs sm:text-sm">Gmail / Google</h4>
            <span className="text-[10px] bg-[#EFF6FF] text-[#1D4ED8] px-2 py-0.5 rounded font-mono font-bold border border-[#BFDBFE]">Strict</span>
          </div>
          <p className="text-[11px] text-gray-600">Requires TLS, Max 12 connections, 120 msgs/min to avoid rate-limiting deferrals.</p>
        </div>
        <div className="bg-white border border-[#CCD2D8] p-3.5 space-y-1.5 border-t-4 border-t-[#7C3AED] shadow-2xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-900 text-xs sm:text-sm">Yahoo / AOL</h4>
            <span className="text-[10px] bg-[#F5F3FF] text-[#6D28D9] px-2 py-0.5 rounded font-mono font-bold border border-[#DDD6FE]">Paced</span>
          </div>
          <p className="text-[11px] text-gray-600">Low concurrency (6 conn), Max 60 msgs/min. Sensitive to sudden volume spikes.</p>
        </div>
        <div className="bg-white border border-[#CCD2D8] p-3.5 space-y-1.5 border-t-4 border-t-[#0284C7] shadow-2xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-900 text-xs sm:text-sm">Outlook / Hotmail</h4>
            <span className="text-[10px] bg-[#F0F9FF] text-[#0369A1] px-2 py-0.5 rounded font-mono font-bold border border-[#BAE6FD]">Standard</span>
          </div>
          <p className="text-[11px] text-gray-600">Max 10 connections, 90 msgs/min, strict SPF/DKIM alignment checks.</p>
        </div>
        <div className="bg-white border border-[#CCD2D8] p-3.5 space-y-1.5 border-t-4 border-t-[#8B1A10] shadow-2xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-900 text-xs sm:text-sm">Default Wildcard (*)</h4>
            <span className="text-[10px] bg-[#FEF2F2] text-[#991B1B] px-2 py-0.5 rounded font-mono font-bold border border-[#FECACA]">Active</span>
          </div>
          <p className="text-[11px] text-gray-600">Applies to all other domains. Max 200 msgs/min with automatic STARTTLS.</p>
        </div>
      </div>

      {/* Policies Table */}
      <div className="bg-white border border-[#CCD2D8] shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-[#CCD2D8] bg-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-[#8B1A10]" />
            <h2 className="font-bold text-gray-900 text-sm sm:text-base">Configured Domain Rules</h2>
          </div>
          <span className="text-xs text-gray-600 font-mono font-bold">Active policies: {policies.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#546E7A] text-white uppercase font-mono text-[10px] tracking-wider border-b border-[#37474F]">
              <tr>
                <th className="py-2.5 px-4">Destination Domain</th>
                <th className="py-2.5 px-4 font-mono">Max Rate</th>
                <th className="py-2.5 px-4 font-mono">Max Concurrency</th>
                <th className="py-2.5 px-4">TLS Encryption</th>
                <th className="py-2.5 px-4 font-mono">Retry After</th>
                <th className="py-2.5 px-4">Bounce Processor</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-sans">
              {policies.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="py-3 px-4 font-mono font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#15803D]" />
                    {p.domainPattern}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-gray-900 font-bold">
                    {p.maxMsgRate}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-gray-800">
                    {p.maxConnections} connections
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                        p.useTls === 'required'
                          ? 'bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]'
                          : p.useTls === 'ifavailable'
                          ? 'bg-[#DBEAFE] text-[#1E40AF] border border-[#BFDBFE]'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {p.useTls}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-gray-800">
                    {p.retryInterval}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-800 font-mono font-bold uppercase border border-gray-200">
                      {p.bounceProcessing ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDeletePolicy(p.id, p.domainPattern)}
                      className="p-1 text-gray-400 hover:text-rose-600 rounded transition"
                      title="Delete Policy"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {policies.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No domain policies configured yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#CCD2D8] shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-4 py-3 border-b border-[#CCD2D8] bg-gradient-to-r from-[#8B1A10] to-[#A81D14] text-white flex items-center justify-between">
              <h3 className="font-bold text-white text-sm sm:text-base">Add Domain Policy Rule</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white text-lg">
                &times;
              </button>
            </div>
            <form onSubmit={handleSavePolicy} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Destination Domain</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. icloud.com or *.edu"
                  value={domainPattern}
                  onChange={(e) => setDomainPattern(e.target.value)}
                  className="w-full px-3 py-2 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Max Send Rate</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 100/m or 5000/h"
                    value={maxMsgRate}
                    onChange={(e) => setMaxMsgRate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Max Connections</label>
                  <input
                    type="number"
                    required
                    value={maxConnections}
                    onChange={(e) => setMaxConnections(e.target.value)}
                    className="w-full px-3 py-2 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">TLS Encryption</label>
                  <select
                    value={useTls}
                    onChange={(e: any) => setUseTls(e.target.value)}
                    className="w-full px-3 py-2 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                  >
                    <option value="required">Required (High Security)</option>
                    <option value="ifavailable">If Available (Opportunistic)</option>
                    <option value="no">Disabled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Retry Deferrals</label>
                  <input
                    type="text"
                    value={retryInterval}
                    onChange={(e) => setRetryInterval(e.target.value)}
                    className="w-full px-3 py-2 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#CCD2D8]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-1.5 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-700 hover:bg-gray-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded text-xs sm:text-sm font-bold shadow-xs"
                >
                  Save Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
