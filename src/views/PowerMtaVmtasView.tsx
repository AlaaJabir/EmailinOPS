import React, { useState, useEffect } from 'react';
import { Network, Plus, Server, CheckCircle2, Pause, Play, Trash2, RefreshCw, Shield, Layers } from 'lucide-react';
import { VirtualMta, IpPool } from '../types';

interface PowerMtaVmtasViewProps {
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  addToast: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export const PowerMtaVmtasView: React.FC<PowerMtaVmtasViewProps> = ({ authFetch, addToast }) => {
  const [vmtas, setVmtas] = useState<VirtualMta[]>([]);
  const [pools, setPools] = useState<IpPool[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);

  // New VMTA form
  const [name, setName] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [hostname, setHostname] = useState('');
  const [domain, setDomain] = useState('amiralucia.com');
  const [maxMessageRate, setMaxMessageRate] = useState('100');
  const [maxConnections, setMaxConnections] = useState('16');
  const [retryInterval, setRetryInterval] = useState('5m');
  const [poolName, setPoolName] = useState('marketing-pool');

  // New Pool form
  const [newPoolName, setNewPoolName] = useState('');
  const [poolDescription, setPoolDescription] = useState('');
  const [poolStrategy, setPoolStrategy] = useState<'round-robin' | 'weighted' | 'failover'>('round-robin');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [resVmtas, resPools] = await Promise.all([
        authFetch('/api/pmta/virtual-mtas'),
        authFetch('/api/pmta/pools'),
      ]);
      if (resVmtas.ok) {
        const d = await resVmtas.json();
        setVmtas(d.virtualMtas || []);
      }
      if (resPools.ok) {
        const d = await resPools.json();
        setPools(d.pools || []);
      }
    } catch (e: any) {
      addToast('error', 'Error loading VirtualMTAs', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateVmta = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/pmta/virtual-mtas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          ipAddress,
          hostname,
          domain,
          maxMessageRate: Number(maxMessageRate) || 100,
          maxConnections: Number(maxConnections) || 16,
          retryInterval,
          poolName,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to create VirtualMTA');
      addToast('success', 'VirtualMTA Created', d.message);
      setIsModalOpen(false);
      setName('');
      setIpAddress('');
      setHostname('');
      loadData();
    } catch (err: any) {
      addToast('error', 'VirtualMTA Error', err.message);
    }
  };

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/pmta/pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPoolName,
          description: poolDescription,
          strategy: poolStrategy,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to create pool');
      addToast('success', 'IP Pool Created', d.message);
      setIsPoolModalOpen(false);
      setNewPoolName('');
      setPoolDescription('');
      loadData();
    } catch (err: any) {
      addToast('error', 'Pool Error', err.message);
    }
  };

  const handleDeleteVmta = async (id: string, vmtaName: string) => {
    if (!confirm(`Are you sure you want to remove VirtualMTA ${vmtaName}?`)) return;
    try {
      const res = await authFetch(`/api/pmta/virtual-mtas/${id}`, { method: 'DELETE' });
      if (res.ok) {
        addToast('info', 'VirtualMTA Removed', `${vmtaName} removed from configuration.`);
        loadData();
      }
    } catch (err: any) {
      addToast('error', 'Delete Failed', err.message);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#8cc052]" />
            <h1 className="text-2xl font-bold text-gray-800">VirtualMTAs &amp; IP Pools</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Configure multi-IP rotation, source interface binding, and traffic segregation for high inbox delivery.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 border border-gray-300 rounded hover:bg-gray-100 text-gray-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsPoolModalOpen(true)}
            className="px-4 py-2 border border-[#8cc052] text-[#6fa035] hover:bg-[#f4faee] rounded text-sm font-semibold flex items-center gap-1.5 transition"
          >
            <Layers className="w-4 h-4" />
            <span>New IP Pool</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[#8cc052] hover:bg-[#7bb342] text-white rounded text-sm font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add VirtualMTA</span>
          </button>
        </div>
      </div>

      {/* IP Pools Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {pools.map((p) => {
          const matchingVmtas = vmtas.filter((v) => v.poolName === p.name);
          return (
            <div key={p.id} className="pmta-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[#f4faee] text-[#8cc052] flex items-center justify-center font-bold">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-gray-800">{p.name}</h3>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 font-semibold uppercase">
                  {p.strategy}
                </span>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">{p.description}</p>
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500">VirtualMTAs Assigned:</span>
                <span className="font-bold text-[#8cc052] bg-[#f4faee] px-2 py-0.5 rounded">
                  {matchingVmtas.length} active
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* VirtualMTAs Table */}
      <div className="pmta-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#8cc052]" />
            <h2 className="font-bold text-gray-800 text-base">Active VirtualMTAs Table</h2>
          </div>
          <span className="text-xs text-gray-500 font-medium">
            Total: {vmtas.length} interfaces registered
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-100 text-gray-700 text-xs uppercase font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">VirtualMTA Name</th>
                <th className="px-6 py-3">Source IP</th>
                <th className="px-6 py-3">Hostname &amp; Domain</th>
                <th className="px-6 py-3">Pool Assignment</th>
                <th className="px-6 py-3">Max Rate / s</th>
                <th className="px-6 py-3">Concurrency</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Sent Today</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vmtas.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-mono font-bold text-gray-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#8cc052]" />
                    {v.name}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-700 bg-gray-50/50">
                    {v.ipAddress}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-800">{v.hostname}</div>
                    <div className="text-xs text-gray-400">{v.domain}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded bg-[#f4faee] text-[#5b8c25] border border-[#c9e89b]">
                      {v.poolName || 'Default'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">
                    {v.maxMessageRate} / sec
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">
                    {v.maxConnections} max
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                        v.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : v.status === 'warming'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-800 font-semibold">
                    {v.sentToday.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDeleteVmta(v.id, v.name)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded transition"
                      title="Delete VirtualMTA"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {vmtas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-400">
                    No VirtualMTAs configured yet. Click "Add VirtualMTA" above to register an IP binding.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add VirtualMTA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-base">Add PowerMTA VirtualMTA</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg">
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateVmta} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">VirtualMTA Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. vmta-mkt-ip4"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#8cc052] focus:ring-1 focus:ring-[#8cc052]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Source IP Address</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 51.170.132.89"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#8cc052]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Outbound Hostname</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. mta4.amiralucia.com"
                    value={hostname}
                    onChange={(e) => setHostname(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#8cc052]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">IP Pool</label>
                  <select
                    value={poolName}
                    onChange={(e) => setPoolName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#8cc052]"
                  >
                    {pools.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Domain Binding</label>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#8cc052]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Max Msg/Sec</label>
                  <input
                    type="number"
                    value={maxMessageRate}
                    onChange={(e) => setMaxMessageRate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#8cc052]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Max Conn</label>
                  <input
                    type="number"
                    value={maxConnections}
                    onChange={(e) => setMaxConnections(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#8cc052]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Retry After</label>
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
                  Save VirtualMTA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Pool */}
      {isPoolModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-base">Create IP Pool</h3>
              <button onClick={() => setIsPoolModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg">
                &times;
              </button>
            </div>
            <form onSubmit={handleCreatePool} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Pool Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. transactional-pool"
                  value={newPoolName}
                  onChange={(e) => setNewPoolName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#8cc052]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe the traffic category for this pool..."
                  value={poolDescription}
                  onChange={(e) => setPoolDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#8cc052]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Rotation Strategy</label>
                <select
                  value={poolStrategy}
                  onChange={(e: any) => setPoolStrategy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#8cc052]"
                >
                  <option value="round-robin">Round-Robin (Equal distribution across IPs)</option>
                  <option value="weighted">Weighted (Prioritize warm IPs)</option>
                  <option value="failover">Failover (Backup IPs if primary bounces)</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsPoolModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8cc052] hover:bg-[#7bb342] text-white rounded text-sm font-bold shadow-sm"
                >
                  Create Pool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
