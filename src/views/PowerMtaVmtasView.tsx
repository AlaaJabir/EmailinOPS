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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[#CCD2D8]">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#8B1A10]" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">VirtualMTAs &amp; IP Pools</h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Configure multi-IP rotation, source interface binding, and traffic segregation for high inbox delivery.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={loadData}
            className="p-2 border border-[#CCD2D8] rounded bg-white hover:bg-gray-100 text-gray-700 transition shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#8B1A10]' : ''}`} />
          </button>
          <button
            onClick={() => setIsPoolModalOpen(true)}
            className="px-3.5 py-1.5 border border-[#8B1A10] text-[#8B1A10] hover:bg-[#8B1A10]/10 rounded text-xs sm:text-sm font-bold flex items-center gap-1.5 transition"
          >
            <Layers className="w-4 h-4" />
            <span>New IP Pool</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-1.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add VirtualMTA</span>
          </button>
        </div>
      </div>

      {/* IP Pools Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pools.map((p) => {
          const matchingVmtas = vmtas.filter((v) => v.poolName === p.name);
          return (
            <div key={p.id} className="bg-white border border-[#CCD2D8] p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-[#8B1A10]/10 text-[#8B1A10] flex items-center justify-center font-bold">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">{p.name}</h3>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-800 font-mono font-bold uppercase border border-gray-200">
                  {p.strategy}
                </span>
              </div>
              <p className="text-xs text-gray-600 line-clamp-2">{p.description}</p>
              <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                <span className="text-gray-600 font-medium">VirtualMTAs Assigned:</span>
                <span className="font-bold text-[#15803D] bg-[#F0FDF4] px-2 py-0.5 rounded border border-[#BBF7D0]">
                  {matchingVmtas.length} active
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* VirtualMTAs Table */}
      <div className="bg-white border border-[#CCD2D8] shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-[#CCD2D8] bg-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#8B1A10]" />
            <h2 className="font-bold text-gray-900 text-sm sm:text-base">Active VirtualMTAs Table</h2>
          </div>
          <span className="text-xs text-gray-600 font-mono font-bold">
            Total: {vmtas.length} interfaces
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#546E7A] text-white uppercase font-mono text-[10px] tracking-wider border-b border-[#37474F]">
              <tr>
                <th className="py-2.5 px-4">VirtualMTA Name</th>
                <th className="py-2.5 px-4 font-mono">Source IP</th>
                <th className="py-2.5 px-4">Hostname &amp; Domain</th>
                <th className="py-2.5 px-4">Pool</th>
                <th className="py-2.5 px-4">Max Rate / s</th>
                <th className="py-2.5 px-4">Concurrency</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Sent Today</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-sans">
              {vmtas.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50 transition">
                  <td className="py-3 px-4 font-mono font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#15803D]" />
                    {v.name}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-gray-800 bg-gray-50/50">
                    {v.ipAddress}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-gray-900">{v.hostname}</div>
                    <div className="text-[11px] text-gray-500 font-mono">{v.domain}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                      {v.poolName || 'Default'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-gray-800">
                    {v.maxMessageRate} / sec
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-gray-800">
                    {v.maxConnections} max
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        v.status === 'active'
                          ? 'bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]'
                          : v.status === 'warming'
                          ? 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-gray-900 font-bold">
                    {v.sentToday.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDeleteVmta(v.id, v.name)}
                      className="p-1 text-gray-400 hover:text-rose-600 rounded transition"
                      title="Delete VirtualMTA"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {vmtas.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#CCD2D8] shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[#CCD2D8] bg-gradient-to-r from-[#8B1A10] to-[#A81D14] text-white flex items-center justify-between">
              <h3 className="font-bold text-white text-sm sm:text-base">Add PowerMTA VirtualMTA</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white text-lg">
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateVmta} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">VirtualMTA Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. vmta-mkt-ip4"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-900 focus:border-[#8B1A10] focus:outline-none"
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
                    className="w-full px-3 py-2 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-900 focus:border-[#8B1A10] focus:outline-none"
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
                    className="w-full px-3 py-2 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">IP Pool</label>
                  <select
                    value={poolName}
                    onChange={(e) => setPoolName(e.target.value)}
                    className="w-full px-3 py-2 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-900 focus:border-[#8B1A10] focus:outline-none"
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
                    className="w-full px-3 py-2 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-900 focus:border-[#8B1A10] focus:outline-none"
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
                    className="w-full px-3 py-2 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Max Conn</label>
                  <input
                    type="number"
                    value={maxConnections}
                    onChange={(e) => setMaxConnections(e.target.value)}
                    className="w-full px-3 py-2 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Retry After</label>
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
                  Save VirtualMTA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Pool */}
      {isPoolModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#CCD2D8] shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-4 py-3 border-b border-[#CCD2D8] bg-gradient-to-r from-[#8B1A10] to-[#A81D14] text-white flex items-center justify-between">
              <h3 className="font-bold text-white text-sm sm:text-base">Create IP Pool</h3>
              <button onClick={() => setIsPoolModalOpen(false)} className="text-white/80 hover:text-white text-lg">
                &times;
              </button>
            </div>
            <form onSubmit={handleCreatePool} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Pool Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. transactional-pool"
                  value={newPoolName}
                  onChange={(e) => setNewPoolName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe the traffic category for this pool..."
                  value={poolDescription}
                  onChange={(e) => setPoolDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Rotation Strategy</label>
                <select
                  value={poolStrategy}
                  onChange={(e: any) => setPoolStrategy(e.target.value)}
                  className="w-full px-3 py-2 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                >
                  <option value="round-robin">Round-Robin (Equal distribution across IPs)</option>
                  <option value="weighted">Weighted (Prioritize warm IPs)</option>
                  <option value="failover">Failover (Backup IPs if primary bounces)</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#CCD2D8]">
                <button
                  type="button"
                  onClick={() => setIsPoolModalOpen(false)}
                  className="px-4 py-1.5 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-700 hover:bg-gray-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded text-xs sm:text-sm font-bold shadow-xs"
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
