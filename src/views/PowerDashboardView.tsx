import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  Mail,
  Megaphone,
  MousePointerClick,
  Radio,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { DashboardStats, Domain, Message } from '../types';
import { DeliverabilityAuditCard } from '../components/DeliverabilityAuditCard';

interface Props {
  stats: DashboardStats | null;
  domains?: Domain[];
  recentMessages: Message[];
  onSelectMessage: (message: Message) => void;
  onNavigateToSend: () => void;
  onNavigateToCampaigns?: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  authFetch?: (url: string, options?: RequestInit) => Promise<Response>;
}

type Period = 'today' | '7d' | '30d';

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmt = (v: unknown) => Math.round(num(v)).toLocaleString();

export const PowerDashboardView: React.FC<Props> = ({
  stats,
  domains = [],
  recentMessages,
  onSelectMessage,
  onNavigateToSend,
  onNavigateToCampaigns,
  onRefresh,
  isLoading,
  authFetch,
}) => {
  const [period, setPeriod] = useState<Period>('today');
  const [periodStats, setPeriodStats] = useState<DashboardStats | null>(stats);
  const [liveMetrics, setLiveMetrics] = useState<Record<string, any>>({});
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch stats for the active period
  const fetchPeriodStats = useCallback(
    async (p: Period) => {
      if (!authFetch) return;
      try {
        const res = await authFetch(`/api/dashboard/stats?period=${p}`);
        if (res.ok) {
          const data = await res.json();
          setPeriodStats(data);
          setLastSynced(new Date());
        }
      } catch (err) {
        console.error('[Dashboard] Failed to fetch period stats:', err);
      }
    },
    [authFetch]
  );

  // Fetch live KumoMTA metrics
  const fetchLiveMetrics = useCallback(async () => {
    try {
      const url = authFetch ? '/api/metrics?format=json' : '/api/metrics?format=json';
      const res = authFetch ? await authFetch(url) : await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLiveMetrics(data);
      }
    } catch {
      // non-blocking
    }
  }, [authFetch]);

  // Initial load & period change
  useEffect(() => {
    fetchPeriodStats(period);
  }, [period, fetchPeriodStats]);

  // Live polling every 4 seconds
  useEffect(() => {
    fetchLiveMetrics();
    const interval = setInterval(() => {
      fetchPeriodStats(period);
      fetchLiveMetrics();
    }, 4000);
    return () => clearInterval(interval);
  }, [period, fetchPeriodStats, fetchLiveMetrics]);

  // Sync if parent passes updated stats
  useEffect(() => {
    if (stats) setPeriodStats(stats);
  }, [stats]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchPeriodStats(period), fetchLiveMetrics(), onRefresh()]);
    setIsRefreshing(false);
  };

  const data = periodStats || stats;
  const sent = num(data?.totalSent);
  const delivered = num(data?.delivered);
  const bounced = num(data?.bounced);
  const failed = num(data?.failed);
  const queued = num(data?.queued);
  const opens = num(data?.opens);
  const clicks = num(data?.clicks);

  // Fallback calculations for maximum truthfulness
  const deliveryRate = sent > 0 ? num(data?.deliveryRate) || Number(((delivered / sent) * 100).toFixed(2)) : 0;
  const bounceRate = sent > 0 ? num(data?.bounceRate) || Number(((bounced / sent) * 100).toFixed(2)) : 0;
  const openRate = num(data?.openRate) || (sent > 0 ? Number(((opens / (delivered || sent)) * 100).toFixed(2)) : 0);
  const clickRate = num(data?.clickRate) || (sent > 0 ? Number(((clicks / (delivered || sent)) * 100).toFixed(2)) : 0);

  const timeseries = useMemo(() => data?.timeseries || [], [data]);
  const campaigns = useMemo(() => data?.topCampaigns || [], [data]);

  const queueSize = num(liveMetrics.kumomta_queue_size) || queued;
  const inFlight = num(liveMetrics.kumomta_messages_in_flight);
  const cpuPercent = num(liveMetrics.kumomta_cpu_usage_percent);
  const isKumoLive = liveMetrics.kumomta_live !== false;

  return (
    <div className="min-h-full bg-[#0b0f17] text-zinc-100 p-4 lg:p-7 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span className="w-2.5 h-6 bg-emerald-400 rounded-sm inline-block" />
              Delivery Operations & Telemetry
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                isKumoLive
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              <Radio className="w-3 h-3 animate-pulse" />
              {isKumoLive ? 'MTA ONLINE (KumoMTA)' : 'MTA OFFLINE'}
            </span>
          </div>
          <p className="text-xs lg:text-sm text-zinc-400 mt-1">
            Real-time delivery rates, recipient engagement, and MTA cluster activity
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period selector */}
          <div className="inline-flex bg-zinc-900 border border-zinc-700/80 rounded-lg p-1">
            {(['today', '7d', '30d'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === p
                    ? 'bg-emerald-500 text-zinc-950 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                {p === 'today' ? 'Today (24h)' : p === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
              </button>
            ))}
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 text-xs font-medium transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            Refresh
          </button>

          <button
            onClick={onNavigateToSend}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/15"
          >
            <Send className="w-3.5 h-3.5" />
            Dispatch Email
          </button>
        </div>
      </div>

      {/* KPI Cards Grid - High Contrast & Crisp Typography */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Total Dispatched */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>TOTAL SENT</span>
            <Mail className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-white mt-2 tracking-tight">
            {fmt(sent)}
          </div>
          <div className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-400 font-medium">{period === 'today' ? 'Dispatched today' : `Last ${period}`}</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
        </div>

        {/* Delivery Rate */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>DELIVERY RATE</span>
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-cyan-400 mt-2 tracking-tight">
            {deliveryRate.toFixed(2)}%
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            <span className="text-zinc-200 font-medium">{fmt(delivered)}</span> / {fmt(sent)} delivered
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
        </div>

        {/* Open Rate */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>OPEN RATE</span>
            <Eye className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-purple-300 mt-2 tracking-tight">
            {openRate.toFixed(2)}%
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            <span className="text-purple-400 font-medium">{fmt(opens)}</span> unique opens
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400" />
        </div>

        {/* Click Rate */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>CLICK RATE (CTR)</span>
            <MousePointerClick className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-amber-300 mt-2 tracking-tight">
            {clickRate.toFixed(2)}%
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            <span className="text-amber-400 font-medium">{fmt(clicks)}</span> link clicks
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
        </div>

        {/* Bounce Rate */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>BOUNCE RATE</span>
            <AlertTriangle className={`w-4 h-4 ${bounced > 0 ? 'text-rose-400' : 'text-zinc-500'}`} />
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-white mt-2 tracking-tight">
            {bounceRate.toFixed(2)}%
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            <span className={bounced > 0 ? 'text-rose-400 font-medium' : 'text-zinc-400'}>
              {fmt(bounced)} bounces
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500" />
        </div>

        {/* Queue & Active Spool */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>QUEUE & SPOOL</span>
            <Server className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-blue-300 mt-2 tracking-tight">
            {fmt(queueSize)}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            <span className="text-zinc-300 font-medium">{fmt(inFlight)}</span> in-flight
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
        </div>
      </div>

      {/* Real-Time Inbox Placement & Spam Diagnosis Card */}
      <DeliverabilityAuditCard
        placement={data?.inboxPlacement}
        totalDelivered={delivered}
        totalSent={sent}
        openRate={openRate}
        clickRate={clickRate}
        recentSubject={campaigns[0]?.name}
      />

      {/* Main Graph & Status Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Sending Telemetry Spline Line Chart (2 Cols) */}
        <div className="xl:col-span-2 bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Delivery Volume Timeline ({period.toUpperCase()})
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Continuous volume curve showing Sent, Delivered, and Bounced messages
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Sent
              </span>
              <span className="flex items-center gap-1.5 text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Delivered
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Bounced
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full">
            {timeseries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeseries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="gradDelivered" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="gradBounced" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" stroke="#71717a" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} />
                  <YAxis stroke="#71717a" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      borderColor: '#3f3f46',
                      borderRadius: '8px',
                      color: '#f4f4f5',
                      fontSize: '12px',
                    }}
                    formatter={(value: any, name: any) => [value, String(name).toUpperCase()]}
                  />
                  <Area
                    type="monotone"
                    dataKey="sent"
                    name="Sent"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: '#10b981', stroke: '#0b0f17', strokeWidth: 2 }}
                    fill="url(#gradSent)"
                  />
                  <Area
                    type="monotone"
                    dataKey="delivered"
                    name="Delivered"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#06b6d4', stroke: '#0b0f17', strokeWidth: 2 }}
                    fill="url(#gradDelivered)"
                  />
                  <Area
                    type="monotone"
                    dataKey="bounced"
                    name="Bounced"
                    stroke="#f43f5e"
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3, fill: '#f43f5e' }}
                    fill="url(#gradBounced)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-zinc-500">
                No activity recorded in this timeframe.
              </div>
            )}
          </div>
        </div>

        {/* Overall Status Donut & Breakdown (1 Col) */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Delivery Efficiency Breakdown
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Net success ratio across destination MX servers
            </p>
          </div>

          <div className="my-5 flex items-center justify-center">
            <div
              className="relative w-40 h-40 rounded-full flex items-center justify-center shadow-inner"
              style={{
                background: `conic-gradient(#10b981 ${Math.min(100, deliveryRate)}%, #27272a 0)`,
              }}
            >
              <div className="absolute inset-4 rounded-full bg-[#121620] flex flex-col items-center justify-center border border-zinc-800">
                <span className="text-3xl font-bold text-white">{deliveryRate.toFixed(0)}%</span>
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mt-0.5">
                  Delivered
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/40 border border-zinc-800">
              <span className="flex items-center gap-2 text-zinc-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
                Delivered / Dispatched
              </span>
              <span className="font-semibold text-white">{fmt(delivered)}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/40 border border-zinc-800">
              <span className="flex items-center gap-2 text-zinc-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-400" />
                Unique Opens
              </span>
              <span className="font-semibold text-purple-300">{fmt(opens)} ({openRate.toFixed(1)}%)</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/40 border border-zinc-800">
              <span className="flex items-center gap-2 text-zinc-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                Unique Link Clicks
              </span>
              <span className="font-semibold text-amber-300">{fmt(clicks)} ({clickRate.toFixed(1)}%)</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/40 border border-zinc-800">
              <span className="flex items-center gap-2 text-zinc-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-400" />
                Bounced & Failed
              </span>
              <span className="font-semibold text-rose-300">{fmt(bounced + failed)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Campaigns & Broadcasts Table */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-emerald-400" />
              Recent Campaigns & Dispatches
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live performance metrics, opens, and click-through rates by broadcast
            </p>
          </div>
          {onNavigateToCampaigns && (
            <button
              onClick={onNavigateToCampaigns}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1"
            >
              Manage Campaigns <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[11px] tracking-wider">
                <th className="text-left py-3 px-3">Subject / Campaign</th>
                <th className="text-left py-3 px-3">Status</th>
                <th className="text-right py-3 px-3">Recipients</th>
                <th className="text-right py-3 px-3">Sent</th>
                <th className="text-right py-3 px-3">Delivered</th>
                <th className="text-right py-3 px-3 text-purple-300">Opens (Rate)</th>
                <th className="text-right py-3 px-3 text-amber-300">Clicks (CTR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {campaigns.length > 0 ? (
                campaigns.map((c: any) => (
                  <tr key={c.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-3 font-medium text-zinc-100 max-w-xs truncate">
                      {c.name}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {c.status || 'COMPLETED'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-zinc-300">
                      {fmt(c.totalRecipients || c.sent)}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-zinc-300">
                      {fmt(c.sent)}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-cyan-300">
                      {fmt(c.delivered || c.sent)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-purple-300">
                      {c.opens !== undefined ? `${fmt(c.opens)} (` : ''}
                      {num(c.openRate).toFixed(1)}%
                      {c.opens !== undefined ? ')' : ''}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-amber-300">
                      {c.clicks !== undefined ? `${fmt(c.clicks)} (` : ''}
                      {num(c.clickRate).toFixed(1)}%
                      {c.clicks !== undefined ? ')' : ''}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-zinc-500 text-xs">
                    No campaigns or direct broadcasts recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Column Section: Recent Individual Messages & MTA Cluster Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Message Feed */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                Live Message Feed
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Real-time dispatch log and tracking confirmations
              </p>
            </div>
            <span className="text-xs text-zinc-500">
              Last {recentMessages.slice(0, 6).length} items
            </span>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {recentMessages.length > 0 ? (
              recentMessages.slice(0, 6).map((m) => {
                const opened = (m.events || []).some((e) => e.eventType === 'OPENED');
                const clicked = (m.events || []).some((e) => e.eventType === 'CLICKED');
                return (
                  <div
                    key={m.id}
                    onClick={() => onSelectMessage(m)}
                    className="py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-800/30 px-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-zinc-200 truncate">
                        {m.toEmail}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {m.subject || '(no subject)'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {opened && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-purple-300 font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                          <Eye className="w-3 h-3" /> OPEN
                        </span>
                      )}
                      {clicked && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                          <MousePointerClick className="w-3 h-3" /> CLICK
                        </span>
                      )}
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {m.status}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-zinc-500 text-xs">
                No recent messages found.
              </div>
            )}
          </div>
        </div>

        {/* Sender Domain Health & Infrastructure Info */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              Verified Senders & Domain Reputation
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Cryptographic SPF, DKIM, and DMARC alignment status
            </p>
          </div>

          <div className="space-y-2.5">
            {domains.length > 0 ? (
              domains.slice(0, 4).map((d) => (
                <div
                  key={d.id}
                  className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800 flex items-center justify-between text-xs"
                >
                  <div className="font-semibold text-zinc-200">{d.domainName}</div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[11px] font-medium ${
                        d.spfStatus === 'VERIFIED' ? 'text-emerald-400' : 'text-zinc-500'
                      }`}
                    >
                      SPF {d.spfStatus === 'VERIFIED' ? '✓' : '—'}
                    </span>
                    <span
                      className={`text-[11px] font-medium ${
                        d.dkimStatus === 'VERIFIED' ? 'text-emerald-400' : 'text-zinc-500'
                      }`}
                    >
                      DKIM {d.dkimStatus === 'VERIFIED' ? '✓' : '—'}
                    </span>
                    <span
                      className={`text-[11px] font-medium ${
                        d.dmarcStatus === 'VERIFIED' ? 'text-emerald-400' : 'text-zinc-500'
                      }`}
                    >
                      DMARC {d.dmarcStatus === 'VERIFIED' ? '✓' : '—'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-800 text-center text-xs text-zinc-400">
                Default outbound identity active via verified domain.
              </div>
            )}
          </div>

          {/* MTA Cluster Health */}
          <div className="pt-2 border-t border-zinc-800">
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              MTA Architecture Health
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-zinc-800/30 border border-zinc-800">
                <span className="block text-zinc-400 text-[10px]">ENGINE</span>
                <span className="font-bold text-emerald-400">KumoMTA v2024</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-800/30 border border-zinc-800">
                <span className="block text-zinc-400 text-[10px]">SPOOL</span>
                <span className="font-bold text-cyan-300">RocksDB (Zero-Loss)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-800/30 border border-zinc-800">
                <span className="block text-zinc-400 text-[10px]">UPSTREAM</span>
                <span className="font-bold text-purple-300">Amazon SES + MX</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
