import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  Globe,
  Layers,
  Calendar,
  Send,
  CheckCircle2,
  AlertTriangle,
  Eye,
  MousePointerClick,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { DashboardStats, Sender, Campaign } from '../types';

interface AnalyticsViewProps {
  stats: DashboardStats | null;
  senders: Sender[];
  campaigns: Campaign[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ stats, senders, campaigns }) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');

  if (!stats) return null;

  // Domain breakdown data
  const domainData = [
    { name: 'Gmail (Google Workspace)', value: 58, color: '#38bdf8' },
    { name: 'Outlook / Office 365', value: 24, color: '#0284c7' },
    { name: 'Yahoo / AOL', value: 8, color: '#a855f7' },
    { name: 'Corporate Custom MX', value: 10, color: '#10b981' },
  ];

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif italic text-white tracking-tight flex items-center gap-2">
            Deliverability & ISP Analytics
          </h1>
          <p className="text-xs text-[#888888] mt-1">
            Deep dive metrics across sending domains, upstream ISP inboxes, and historical deliverability curves
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[#0F0F0F] p-1 rounded-sm border border-white-10 text-xs">
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-3 py-1 rounded-xs font-medium transition-colors ${
              timeRange === '7d' ? 'bg-white text-black font-semibold' : 'text-[#888888] hover:text-white'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-3 py-1 rounded-xs font-medium transition-colors ${
              timeRange === '30d' ? 'bg-white text-black font-semibold' : 'text-[#888888] hover:text-white'
            }`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setTimeRange('90d')}
            className={`px-3 py-1 rounded-xs font-medium transition-colors ${
              timeRange === '90d' ? 'bg-white text-black font-semibold' : 'text-[#888888] hover:text-white'
            }`}
          >
            Last Quarter
          </button>
        </div>
      </div>

      {/* High-level summary metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-[#888888]">
            <span>Overall Inbox Placement</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-serif italic text-white">98.9%</div>
          <div className="text-[10px] text-emerald-400 font-mono tracking-tight">+0.4% from warmup policy</div>
        </div>

        <div className="p-5 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-[#888888]">
            <span>Aggregated Bounce Rate</span>
            <AlertTriangle className="w-4 h-4 text-amber-300" />
          </div>
          <div className="text-3xl font-serif italic text-amber-300">{stats.bounceRate}%</div>
          <div className="text-[10px] text-[#888888] font-mono tracking-tight">0.68% Hard / 0.21% Soft</div>
        </div>

        <div className="p-5 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-[#888888]">
            <span>Avg Open Engagement</span>
            <Eye className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-3xl font-serif italic text-white">{stats.openRate}%</div>
          <div className="text-[10px] text-[#888888] font-mono tracking-tight">Based on 1x1 tracking pixel</div>
        </div>

        <div className="p-5 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-[#888888]">
            <span>Click-Through Rate (CTR)</span>
            <MousePointerClick className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-3xl font-serif italic text-white">{stats.clickRate}%</div>
          <div className="text-[10px] text-[#888888] font-mono tracking-tight">Rewritten custom domain links</div>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sending Trends Area */}
        <div className="lg:col-span-2 p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Dispatched vs Delivered Trajectory</h2>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#888888]">Daily Samples</span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.timeseries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="delivGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222222" vertical={false} />
                <XAxis dataKey="time" stroke="#555555" fontSize={10} tickLine={false} />
                <YAxis stroke="#555555" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F0F0F', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', color: '#fff', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="sent" stroke="#888888" strokeWidth={1.5} fillOpacity={0} name="Total Sent" />
                <Area type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#delivGrad)" name="Delivered" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Destination Domain Pie Chart */}
        <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Recipient ISP Breakdown</h2>
            <p className="text-xs text-[#888888]">Traffic distribution by destination MX servers</p>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={domainData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4}>
                  {domainData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0F0F0F', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', color: '#fff', fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-white-10 text-xs">
            {domainData.map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-zinc-300">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </span>
                <span className="font-mono text-[#888888]">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Senders Comparison Table */}
      <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-4">
        <h2 className="text-sm font-semibold text-white">Sender Identity Deliverability Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white-10 text-[10px] uppercase tracking-[0.15em] text-[#888888]">
                <th className="pb-3 font-semibold">Sender Name</th>
                <th className="pb-3 font-semibold">From Email</th>
                <th className="pb-3 font-semibold">Volume Sent</th>
                <th className="pb-3 font-semibold">Delivered</th>
                <th className="pb-3 font-semibold">Delivery Rate</th>
                <th className="pb-3 font-semibold">Bounced</th>
                <th className="pb-3 font-semibold">Bounce Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white-5 font-mono text-[11px]">
              {senders.map((s) => {
                const delRate = s.sentCount > 0 ? (((s.sentCount - s.bouncedCount) / s.sentCount) * 100).toFixed(2) : '100.00';
                const bncRate = s.sentCount > 0 ? ((s.bouncedCount / s.sentCount) * 100).toFixed(2) : '0.00';
                return (
                  <tr key={s.id} className="hover:bg-white/5">
                    <td className="py-3 font-sans font-medium text-white">{s.name}</td>
                    <td className="py-3 text-zinc-300">{s.fromEmail}</td>
                    <td className="py-3 text-white">{s.sentCount.toLocaleString()}</td>
                    <td className="py-3 text-emerald-400">{(s.sentCount - s.bouncedCount).toLocaleString()}</td>
                    <td className="py-3 text-emerald-400 font-bold">{delRate}%</td>
                    <td className="py-3 text-amber-300">{s.bouncedCount.toLocaleString()}</td>
                    <td className="py-3 text-amber-300">{bncRate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
