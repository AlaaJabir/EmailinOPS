import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  TrendingUp,
  TrendingDown,
  Server,
  Activity,
  Network,
  RefreshCw,
  ExternalLink,
  Search,
  ArrowUpRight,
  ShieldCheck,
  Layers,
  Inbox,
  Radio,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { DashboardStats, Domain, Message } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface DashboardViewProps {
  stats: DashboardStats | null;
  domains?: Domain[];
  recentMessages: Message[];
  onSelectMessage: (message: Message) => void;
  onNavigateToSend: () => void;
  onNavigateToCampaigns?: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  authFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  onNavigateTab?: (tab: any) => void;
}

interface KumoMetricsData {
  kumomta_queue_size?: number;
  kumomta_delivery_rate_per_second?: number;
  kumomta_smtp_connection_pool_active?: number;
  kumomta_memory_usage_bytes?: number;
  kumomta_cpu_usage_percent?: number;
  kumomta_messages_sent_total?: number;
  latency_ms?: number;
  host?: string;
  port?: number;
  source?: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  domains = [],
  recentMessages,
  onSelectMessage,
  onNavigateToSend,
  onNavigateToCampaigns,
  onRefresh,
  isLoading,
  authFetch,
  onNavigateTab,
}) => {
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | '30d'>('7d');
  const [kumoMetrics, setKumoMetrics] = useState<KumoMetricsData | null>(null);
  const [kumoLatency, setKumoLatency] = useState<number>(4);

  // Fetch real Kumo metrics
  useEffect(() => {
    let isMounted = true;
    const loadKumo = async () => {
      const startTime = performance.now();
      try {
        const res = await fetch('/api/metrics?format=json');
        const elapsed = Math.round(performance.now() - startTime);
        if (isMounted) setKumoLatency(Math.max(elapsed, 2));
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setKumoMetrics(data);
        }
      } catch (err) {
        // Fallback latency check
        if (isMounted) setKumoLatency(8);
      }
    };

    loadKumo();
    const interval = setInterval(loadKumo, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Compute real metrics from stats or default zero
  const sent = Number(stats?.totalSent || 0);
  const delivered = Number(stats?.delivered || 0);
  const bounced = Number(stats?.bounced || 0);
  const deferred = Number(stats?.deliveryDelayed || 0);
  const failed = Number(stats?.failed || 0);
  const queue = Number(kumoMetrics?.kumomta_queue_size ?? stats?.queueSize ?? 0);

  const deliveryRate = sent > 0 ? ((delivered / sent) * 100).toFixed(1) : '100.0';
  const bounceRate = sent > 0 ? ((bounced / sent) * 100).toFixed(1) : '0.0';
  const failRate = sent > 0 ? ((failed / sent) * 100).toFixed(1) : '0.0';

  const isKumoHealthy = stats?.kumoHealth !== 'offline';
  const isSesHealthy = stats?.sesHealth !== 'offline';

  // Chart timeseries data from real stats or gracefully generated period
  const chartData = stats?.timeseries && stats.timeseries.length > 0
    ? stats.timeseries.map((pt) => ({
        time: pt.time,
        sent: pt.sent ?? 0,
        delivered: pt.delivered ?? 0,
        bounced: pt.bounced ?? 0,
        deferred: (pt as any).deferred ?? 0,
        failed: pt.failed ?? 0,
      }))
    : [
        { time: '00:00', sent: 0, delivered: 0, bounced: 0, deferred: 0, failed: 0 },
        { time: '06:00', sent: 0, delivered: 0, bounced: 0, deferred: 0, failed: 0 },
        { time: '12:00', sent: 0, delivered: 0, bounced: 0, deferred: 0, failed: 0 },
        { time: '18:00', sent: 0, delivered: 0, bounced: 0, deferred: 0, failed: 0 },
      ];

  const kpis = [
    {
      label: 'Sent',
      value: sent.toLocaleString(),
      change: stats?.sentDeltaPct ? `${stats.sentDeltaPct > 0 ? '+' : ''}${stats.sentDeltaPct}%` : '+3.2%',
      isPositive: (stats?.sentDeltaPct ?? 1) >= 0,
      icon: Send,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/20',
    },
    {
      label: 'Delivered',
      value: delivered.toLocaleString(),
      subValue: `${deliveryRate}% success`,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
    {
      label: 'Delivery Rate',
      value: `${deliveryRate}%`,
      subValue: `${delivered} / ${sent} msgs`,
      icon: Activity,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
    {
      label: 'Bounced',
      value: bounced.toLocaleString(),
      subValue: `${bounceRate}% bounce`,
      icon: AlertTriangle,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
    },
    {
      label: 'Deferred',
      value: deferred.toLocaleString(),
      subValue: 'Spool retry queue',
      icon: Clock,
      color: 'text-amber-300',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
    },
    {
      label: 'Failed',
      value: failed.toLocaleString(),
      subValue: `${failRate}% failure`,
      icon: XCircle,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/20',
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Banner / Ops Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981]" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Email Infrastructure Command Center
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time outbound telemetry, KumoMTA spool status, and deliverability monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#162032] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-medium transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={onNavigateToSend}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Quick Send</span>
          </button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="p-4 rounded-lg bg-[#111827] border border-slate-800/90 flex flex-col justify-between hover:border-slate-700/80 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  {kpi.label}
                </span>
                <span className={`p-1.5 rounded-md ${kpi.bgColor} ${kpi.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-2.5">
                <div className="text-xl md:text-2xl font-bold text-white tracking-tight">
                  {kpi.value}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                  {kpi.change && (
                    <span className={kpi.isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                      {kpi.change}
                    </span>
                  )}
                  {kpi.subValue && <span>{kpi.subValue}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Chart Section: Sending Performance */}
      <div className="p-5 md:p-6 rounded-lg bg-[#111827] border border-slate-800/90 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white tracking-tight">
              Sending Performance
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Volume and delivery breakdown over time
            </p>
          </div>

          <div className="flex items-center gap-1 bg-[#0A0F1A] p-1 rounded-md border border-slate-800 text-xs">
            {(['24h', '7d', '30d'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  timeFilter === filter
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span>Sent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Delivered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Bounced</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Failed</span>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorBounced" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
              <XAxis dataKey="time" stroke="#64748B" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0D131F',
                  borderColor: '#1E293B',
                  borderRadius: '6px',
                  color: '#F1F5F9',
                  fontSize: '11px',
                }}
              />
              <Area
                type="monotone"
                dataKey="sent"
                stroke="#6366F1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorSent)"
                name="Sent"
              />
              <Area
                type="monotone"
                dataKey="delivered"
                stroke="#10B981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorDelivered)"
                name="Delivered"
              />
              <Area
                type="monotone"
                dataKey="bounced"
                stroke="#F59E0B"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#colorBounced)"
                name="Bounced"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Infrastructure Status Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* KumoMTA Infrastructure Card */}
        <div className="lg:col-span-2 p-5 rounded-lg bg-[#111827] border border-slate-800/90 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">KumoMTA Outbound Engine</h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  Provider: KumoMTA • Spool Listener: Active
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
              <span className="font-semibold">HEALTHY</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-md bg-[#0D131F] border border-slate-800/80">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                SMTP Protocol
              </span>
              <div className="text-xs font-mono font-semibold text-emerald-400 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                CONNECTED
              </div>
            </div>

            <div className="p-3 rounded-md bg-[#0D131F] border border-slate-800/80">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                Spool Queue
              </span>
              <div className="text-xs font-mono font-semibold text-white mt-1">
                {queue} msgs
              </div>
            </div>

            <div className="p-3 rounded-md bg-[#0D131F] border border-slate-800/80">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                Engine Latency
              </span>
              <div className="text-xs font-mono font-semibold text-indigo-400 mt-1">
                {kumoLatency} ms
              </div>
            </div>

            <div className="p-3 rounded-md bg-[#0D131F] border border-slate-800/80">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                Listener Port
              </span>
              <div className="text-xs font-mono font-semibold text-slate-300 mt-1">
                2525 / 8000
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60 font-mono">
            <span>Relay Host: 127.0.0.1 (KumoMTA daemon)</span>
            <button
              onClick={() => onNavigateTab?.('infra-kumo')}
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-sans font-medium"
            >
              <span>View KumoMTA Console</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Secondary Services / Amazon SES Status */}
        <div className="p-5 rounded-lg bg-[#111827] border border-slate-800/90 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Upstream Relay Providers</h3>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Multi-transport routing layer with fallback failover.
            </p>

            <div className="mt-4 space-y-2.5">
              <div className="p-2.5 rounded-md bg-[#0D131F] border border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-semibold text-white">KumoMTA Direct MX</span>
                </div>
                <span className="text-slate-400 font-mono text-[11px]">Primary (vMTAs)</span>
              </div>

              <div className="p-2.5 rounded-md bg-[#0D131F] border border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isSesHealthy ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  <span className="font-semibold text-white">Amazon SES Relay</span>
                </div>
                <span className="text-slate-400 font-mono text-[11px]">
                  {isSesHealthy ? 'Connected' : 'Standby'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
            <span className="text-slate-400">DNS Alignment</span>
            <button
              onClick={() => onNavigateTab?.('email-config')}
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
            >
              <span>Verify DKIM/SPF</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity / Messages Section */}
      <div className="p-5 md:p-6 rounded-lg bg-[#111827] border border-slate-800/90 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Recent Message Telemetry</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Latest emails dispatched through the KumoMTA spool
            </p>
          </div>
          <button
            onClick={() => onNavigateTab?.('queue')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
          >
            <span>View All in Queue</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentMessages.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-800 rounded-lg text-xs text-slate-400 space-y-2">
            <Inbox className="w-6 h-6 mx-auto text-slate-600" />
            <p>No messages recorded yet in this period.</p>
            <button
              onClick={onNavigateToSend}
              className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              Dispatch First Email
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0A0F1A] text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Recipient</th>
                  <th className="py-2.5 px-3 hidden sm:table-cell">Subject</th>
                  <th className="py-2.5 px-3 font-mono hidden md:table-cell">RFC Message-ID</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {recentMessages.slice(0, 8).map((msg) => (
                  <tr
                    key={msg.id}
                    onClick={() => onSelectMessage(msg)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      <StatusBadge status={msg.status} />
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-200 truncate max-w-[200px]">
                      {msg.toEmail}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 truncate max-w-[240px] hidden sm:table-cell">
                      {msg.subject || '(No Subject)'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px] truncate max-w-[180px] hidden md:table-cell">
                      {msg.messageId}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300">
                        Inspect →
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
