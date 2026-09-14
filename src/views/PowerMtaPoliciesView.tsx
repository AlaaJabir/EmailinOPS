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
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#8cc052]" />
            <h1 className="text-2xl font-bold text-gray-800">Email Speed Throttling &amp; ISP Policies</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Fine-tuned delivery rate limits, concurrent SMTP connections, and TLS enforcement for major mailbox providers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadPolicies}
            className="p-2 border border-gray-300 rounded hover:bg-gray-100 text-gray-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[#8cc052] hover:bg-[#7bb342] text-white rounded text-sm font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Domain Policy</span>
          </button>
        </div>
      </div>

      {/* Preset ISP Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="pmta-card p-4 space-y-2 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-800 text-sm">Gmail / Google</h4>
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold">Strict</span>
          </div>
          <p className="text-xs text-gray-500">Requires TLS, Max 12 connections, 120 msgs/min to avoid rate-limiting deferrals.</p>
        </div>
        <div className="pmta-card p-4 space-y-2 border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-800 text-sm">Yahoo / AOL</h4>
            <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-semibold">Paced</span>
          </div>
          <p className="text-xs text-gray-500">Low concurrency (6 conn), Max 60 msgs/min. Sensitive to sudden volume spikes.</p>
        </div>
        <div className="pmta-card p-4 space-y-2 border-l-4 border-l-sky-500">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-800 text-sm">Outlook / Hotmail</h4>
            <span className="text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded font-semibold">Standard</span>
          </div>
          <p className="text-xs text-gray-500">Max 10 connections, 90 msgs/min, strict SPF/DKIM alignment checks.</p>
        </div>
        <div className="pmta-card p-4 space-y-2 border-l-4 border-l-[#8cc052]">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-800 text-sm">Default Wildcard (*)</h4>
            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded font-semibold">Active</span>
          </div>
          <p className="text-xs text-gray-500">Applies to all other domains. Max 200 msgs/min with automatic STARTTLS.</p>
        </div>
      </div>

      {/* Policies Table */}
      <div className="pmta-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-[#8cc052]" />
            <h2 className="font-bold text-gray-800 text-base">Configured Domain Rules</h2>
          </div>
          <span className="text-xs text-gray-500 font-medium">Active policies: {policies.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-100 text-gray-700 text-xs uppercase font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">Destination Domain</th>
                <th className="px-6 py-3">Max Rate</th>
                <th className="px-6 py-3">Max Concurrency</th>
                <th className="px-6 py-3">TLS Encryption</th>
                <th className="px-6 py-3">Retry After</th>
                <th className="px-6 py-3">Bounce Processor</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {policies.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-mono font-bold text-gray-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#8cc052]" />
                    {p.domainPattern}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-800 font-semibold">
                    {p.maxMsgRate}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">
                    {p.maxConnections} connections
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded font-semibold ${
                        p.useTls === 'required'
                          ? 'bg-green-100 text-green-800'
                          : p.useTls === 'ifavailable'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {p.useTls}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">
                    {p.retryInterval}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-800 font-medium">
                      {p.bounceProcessing ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDeletePolicy(p.id, p.domainPattern)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded transition"
                      title="Delete Policy"
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-base">Add Domain Policy Rule</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg">
                &times;
              </button>
            </div>
            <form onSubmit={handleSavePolicy} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Destination Domain</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. icloud.com or *.edu"
                  value={domainPattern}
                  onChange={(e) => setDomainPattern(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#8cc052]"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#8cc052]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Max Connections</label>
                  <input
                    type="number"
                    required
                    value={maxConnections}
                    onChange={(e) => setMaxConnections(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#8cc052]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">TLS Encryption</label>
                  <select
                    value={useTls}
                    onChange={(e: any) => setUseTls(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#8cc052]"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#8cc052]"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8cc052] hover:bg-[#7bb342] text-white rounded text-sm font-bold shadow-sm"
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
