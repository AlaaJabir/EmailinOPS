import React from 'react';
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Eye,
  MousePointerClick,
  TrendingUp,
  Activity,
  Cpu,
  Radio,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from 'recharts';
import { DashboardStats, Message } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface DashboardViewProps {
  stats: DashboardStats | null;
  recentMessages: Message[];
  onSelectMessage: (message: Message) => void;
  onNavigateToSend: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  recentMessages,
  onSelectMessage,
  onNavigateToSend,
  onRefresh,
  isLoading,
}) => {
  if (!stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-[#888888] text-sm font-sans">
          <RefreshCw className="w-5 h-5 animate-spin text-white" />
          <span>Connecting to KumoMTA & Prometheus telemetry metrics...</span>
        </div>
      </div>
    );
  }

  const kpis = [
    {
      title: 'Emails Sent',
      value: stats.totalSent.toLocaleString(),
      sub: `${stats.sendingRatePerSec} msgs/sec throughput`,
      icon: Send,
      color: 'text-white',
      bg: 'bg-white/5',
      badge: stats.totalSent > 0 ? 'Live Spool' : 'Ready',
    },
    {
      title: 'Delivered',
      value: stats.delivered.toLocaleString(),
      sub: `${stats.deliveryRate}% delivery rate`,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      badge: stats.delivered > 0 ? 'Verified' : 'Pending',
    },
    {
      title: 'Bounced',
      value: stats.bounced.toLocaleString(),
      sub: `${stats.bounceRate}% bounce rate`,
      icon: AlertTriangle,
      color: 'text-amber-300',
      bg: 'bg-amber-500/10',
      badge: '0 Hard / 0 Soft',
    },
    {
      title: 'Failed',
      value: stats.failed.toLocaleString(),
      sub: 'Transmission errors',
      icon: XCircle,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      badge: stats.failed > 0 ? 'Review logs' : 'None',
    },
    {
      title: 'Complaints',
      value: stats.complaints.toLocaleString(),
      sub: `${stats.totalSent > 0 ? ((stats.complaints / stats.totalSent) * 100).toFixed(2) : '0.00'}% complaint rate`,
      icon: ShieldAlert,
      color: 'text-purple-300',
      bg: 'bg-purple-500/10',
      badge: 'FBL Monitored',
    },
    {
      title: 'Opens',
      value: stats.opens.toLocaleString(),
      sub: `${stats.openRate}% open rate`,
      icon: Eye,
      color: 'text-sky-300',
      bg: 'bg-sky-500/10',
      badge: 'Tracking',
    },
    {
      title: 'Clicks',
      value: stats.clicks.toLocaleString(),
      sub: `${stats.clickRate}% CTR rate`,
      icon: MousePointerClick,
      color: 'text-teal-300',
      bg: 'bg-teal-500/10',
      badge: 'Tracking',
    },
  ];

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            Operations Dashboard
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </h1>
          <p className="text-xs text-[#888888] mt-1">
            Real-time delivery telemetry from KumoMTA spool and Amazon SES upstream
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white-10 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={onNavigateToSend}
            className="flex items-center gap-2 px-4 py-1.5 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-sm transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Compose Email</span>
          </button>
        </div>
      </div>

      {/* Queue & Health Telemetry Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-sm bg-[#0F0F0F] border border-white-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#888888]">KumoMTA Spool Engine</div>
              <div className="text-xs font-semibold text-white flex items-center gap-2 mt-0.5">
                {stats.queueSize > 0 ? `${stats.queueSize} Queued in Spool` : 'Spool Ready'}
                <span className="text-[9px] px-1.5 py-0.2 rounded-xs bg-emerald-500/20 text-emerald-400 font-mono">
                  {stats.kumoHealth === 'healthy' ? 'ONLINE' : stats.kumoHealth.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right font-mono text-xs text-[#888888]">
            <span className="text-white font-bold">{stats.queueSize}</span> queued
          </div>
        </div>

        <div className="p-4 rounded-sm bg-[#0F0F0F] border border-white-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#888888]">Amazon SES Relay</div>
              <div className="text-xs font-semibold text-white flex items-center gap-2 mt-0.5">
                Upstream Relay
                <span className={`text-[9px] px-1.5 py-0.2 rounded-xs font-mono ${
                  stats.sesHealth === 'healthy'
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {stats.sesHealth === 'healthy' ? 'HEALTHY' : 'UNCONFIGURED'}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right font-mono text-xs text-[#888888]">
            <span className="text-white font-bold">{stats.totalSent}</span> sent
          </div>
        </div>

        <div className="p-4 rounded-sm bg-[#0F0F0F] border border-white-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#888888]">Current Throughput</div>
              <div className="text-xs font-semibold text-white mt-0.5">
                {stats.sendingRatePerSec} <span className="text-[10px] text-[#888888]">emails / sec</span>
              </div>
            </div>
          </div>
          <div className="text-right text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> {stats.sendingRatePerSec > 0 ? 'Active Stream' : 'Idle'}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="p-3.5 rounded-sm bg-[#0F0F0F] border border-white-10 flex flex-col justify-between hover:border-white/20 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-[#888888]">{kpi.title}</span>
                <div className={`p-1.5 rounded-sm ${kpi.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                </div>
              </div>
              <div className="mt-3">
                <div className={`text-2xl font-bold tracking-tight ${kpi.color}`}>{kpi.value}</div>
                <div className="text-[10px] text-[#888888] mt-0.5 truncate">{kpi.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sending Volume Over Time */}
        <div className="lg:col-span-2 p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Sending Volume & Delivery Trends</h2>
              <p className="text-xs text-[#888888]">Daily dispatched emails vs delivered vs bounced</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Delivered
              </span>
              <span className="flex items-center gap-1.5 text-amber-400 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Bounced
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.timeseries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="delGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bncGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke="#888888" fontSize={10} tickLine={false} />
                <YAxis stroke="#888888" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#050505', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', color: '#fff', fontSize: '11px' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#delGradient)" name="Delivered" />
                <Area type="monotone" dataKey="bounced" stroke="#f59e0b" strokeWidth={1.5} fillOpacity={1} fill="url(#bncGradient)" name="Bounced" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Sending Distribution */}
        <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Hourly Distribution</h2>
            <p className="text-xs text-[#888888]">Peak traffic hours across European timezones</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.hourlyActivity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="hour" stroke="#888888" fontSize={10} tickLine={false} />
                <YAxis stroke="#888888" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#050505', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', color: '#fff', fontSize: '11px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="volume" fill="#ffffff" radius={[2, 2, 0, 0]} name="Volume" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Senders & Campaigns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Senders */}
        <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Top Sender Identities</h2>
            <span className="text-[10px] uppercase tracking-wider text-[#888888]">Volume & SLA</span>
          </div>

          <div className="space-y-2">
            {stats.topSenders.map((s) => (
              <div key={s.id} className="p-3 rounded-sm bg-[#050505] border border-white-10 flex items-center justify-between hover:border-white/20 transition-colors">
                <div>
                  <div className="text-xs font-medium text-white">{s.name}</div>
                  <div className="text-[10px] font-mono text-[#888888]">{s.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-medium text-white">{s.volume.toLocaleString()} sent</div>
                  <div className="text-[10px] text-emerald-400 font-mono">{s.deliveryRate}% delivered</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Campaigns */}
        <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Top Campaigns</h2>
            <span className="text-[10px] uppercase tracking-wider text-[#888888]">Engagement</span>
          </div>

          <div className="space-y-2">
            {stats.topCampaigns.map((c) => (
              <div key={c.id} className="p-3 rounded-sm bg-[#050505] border border-white-10 flex items-center justify-between hover:border-white/20 transition-colors">
                <div>
                  <div className="text-xs font-medium text-white truncate max-w-[200px]">{c.name}</div>
                  <div className="text-[10px] font-mono text-[#888888]">{c.sent.toLocaleString()} recipients</div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-xs font-mono font-medium text-sky-400">{c.openRate}%</div>
                    <div className="text-[9px] uppercase tracking-wider text-[#888888]">Open Rate</div>
                  </div>
                  <div>
                    <div className="text-xs font-mono font-medium text-teal-400">{c.clickRate}%</div>
                    <div className="text-[9px] uppercase tracking-wider text-[#888888]">Click Rate</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Sending Activity Table */}
      <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Recent Sending Activity</h2>
            <p className="text-xs text-[#888888]">Live stream of messages processed through KumoMTA spool</p>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-[#888888] font-mono">Last {recentMessages.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white-10 text-[10px] uppercase tracking-[0.15em] text-[#888888]">
                <th className="pb-3 font-semibold">Time</th>
                <th className="pb-3 font-semibold">RFC Message ID</th>
                <th className="pb-3 font-semibold">From</th>
                <th className="pb-3 font-semibold">To (Recipient)</th>
                <th className="pb-3 font-semibold">Subject</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white-5 font-mono text-[11px]">
              {recentMessages.map((msg) => (
                <tr key={msg.id} className="hover:bg-white/5 transition-colors group">
                  <td className="py-3 text-[#888888] whitespace-nowrap">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="py-3 text-white max-w-[180px] truncate" title={msg.messageId}>
                    {msg.messageId}
                  </td>
                  <td className="py-3 text-[#888888] truncate max-w-[140px]" title={msg.fromEmail}>
                    {msg.fromEmail}
                  </td>
                  <td className="py-3 text-zinc-200 truncate max-w-[160px]" title={msg.toEmail}>
                    {msg.toEmail}
                  </td>
                  <td className="py-3 font-sans text-[#888888] max-w-[200px] truncate" title={msg.subject}>
                    {msg.subject}
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    <StatusBadge status={msg.status} />
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => onSelectMessage(msg)}
                      className="inline-flex items-center gap-1 text-white hover:text-emerald-400 font-sans text-xs transition-colors p-1"
                    >
                      <span>Inspect</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
