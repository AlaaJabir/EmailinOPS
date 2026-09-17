import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Cpu,
  ExternalLink,
  Gauge,
  HardDrive,
  ListChecks,
  Mail,
  Network,
  RefreshCw,
  Server,
  Settings,
  TerminalSquare,
  Zap,
} from 'lucide-react';
import { DashboardStats, Message } from '../types';

interface Props {
  stats?: DashboardStats | null;
  recentMessages?: Message[];
  onSelectMessage?: (message: Message) => void;
  onNavigateToSend?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  authFetch?: (url: string, options?: RequestInit) => Promise<Response>;
}

interface Metrics {
  kumomta_queue_size?: number;
  kumomta_messages_in_flight?: number;
  kumomta_messages_sent_total?: number;
  kumomta_delivery_rate_per_second?: number;
  kumomta_smtp_connection_pool_active?: number;
  kumomta_smtp_connection_pool_idle?: number;
  kumomta_memory_usage_bytes?: number;
  kumomta_cpu_usage_percent?: number;
  ses_quota_max_24_hour?: number;
  ses_quota_sent_last_24_hour?: number;
  ses_quota_max_send_rate?: number;
  ses_reputation_bounce_rate?: number;
  ses_reputation_complaint_rate?: number;
}

type Tab = 'home' | 'status' | 'queues' | 'domains' | 'vmtas' | 'jobs' | 'logs' | 'actions';

const n = (v: unknown) => Number(v || 0).toLocaleString();
const pct = (v: unknown) => `${Number(v || 0).toFixed(2)}%`;
const mb = (v: unknown) => `${(Number(v || 0) / 1024 / 1024).toFixed(1)} MB`;

export const KumoOperationsDashboard: React.FC<Props> = ({
  stats = null,
  recentMessages = [],
  onSelectMessage = (_msg: Message) => {},
  onNavigateToSend = () => {},
  onRefresh = () => {},
  isLoading = false,
  authFetch,
}) => {
  const [tab, setTab] = useState<Tab>('home');
  const [metrics, setMetrics] = useState<Metrics>({});
  const [metricsLoading, setMetricsLoading] = useState(false);

  const loadMetrics = async () => {
    setMetricsLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';
      const res = await fetch(`${apiBase}/api/metrics?format=json`);
      if (res.ok) setMetrics(await res.json());
    } catch (error) {
      console.error('Failed to load Kumo metrics', error);
    } finally {
      setMetricsLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
    const id = window.setInterval(loadMetrics, 3000);
    return () => window.clearInterval(id);
  }, []);

  const queueSize = metrics.kumomta_queue_size ?? stats?.queueSize ?? 0;
  const activeConnections = metrics.kumomta_smtp_connection_pool_active ?? 0;
  const idleConnections = metrics.kumomta_smtp_connection_pool_idle ?? 0;
  const inFlight = metrics.kumomta_messages_in_flight ?? 0;
  const sendRate = metrics.kumomta_delivery_rate_per_second ?? stats?.sendingRatePerSec ?? 0;
  const totalOut = metrics.kumomta_messages_sent_total ?? stats?.totalSent ?? 0;
  const ses24h = metrics.ses_quota_sent_last_24_hour ?? stats?.totalSent ?? 0;
  const ses24hMax = metrics.ses_quota_max_24_hour ?? 0;
  const sesRate = metrics.ses_quota_max_send_rate ?? 0;

  const queuedMessages = useMemo(
    () => recentMessages.filter((m) => m.status === 'QUEUED' || m.status === 'SENDING'),
    [recentMessages]
  );

  const queuedDomains = useMemo(() => {
    const map = new Map<string, number>();
    queuedMessages.forEach((m) => {
      const domain = m.toEmail?.split('@')[1]?.toLowerCase() || 'unknown';
      map.set(domain, (map.get(domain) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [queuedMessages]);

  const trafficIn = stats?.totalSent ?? 0;
  const trafficOut = totalOut;
  const lastHourOut = stats?.timeseries?.slice(-1)[0]?.sent ?? 0;
  const lastHourIn = stats?.timeseries?.slice(-1)[0]?.delivered ?? 0;
  const topHourOut = stats?.hourlyActivity?.reduce((max, x) => Math.max(max, x.volume), 0) ?? 0;

  const tabs: Array<[Tab, string]> = [
    ['home', 'Overview & Traffic'],
    ['status', 'Daemon Status & Resources'],
    ['queues', 'Queue Spool'],
    ['domains', 'Recipient Domains'],
    ['vmtas', 'Virtual MTAs'],
    ['jobs', 'Dispatches'],
    ['logs', 'Spool Logs'],
    ['actions', 'Commands'],
  ];

  if (!stats) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[400px] text-gray-600 font-sans">
        <RefreshCw className="w-5 h-5 animate-spin mr-3 text-[#8B1A10]" /> Connecting to PowerMTA node telemetry...
      </div>
    );
  }

  const Panel: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({
    title,
    children,
    className = '',
  }) => (
    <section className={`bg-white border border-[#CCD2D8] rounded shadow-xs overflow-hidden ${className}`}>
      <div className="px-3.5 py-2 bg-[#9E9E9E] border-b-2 border-[#8B0000] text-white text-xs font-bold tracking-tight">
        {title}
      </div>
      {children}
    </section>
  );

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-[#E8ECEF] min-h-[calc(100vh-3.5rem)] font-sans text-gray-800">
      <div className="max-w-[1240px] mx-auto bg-white rounded-lg shadow-md border border-[#C5CED6] overflow-hidden">
        {/* PowerMTA Top Crimson Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-gradient-to-r from-[#8B1A10] via-[#A81D14] to-[#75110B] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#E0A328]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-black/25 flex items-center justify-center text-white border border-white/20 shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <span>PowerMTA / Kumo Engine Node Operations</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/30 border border-white/20 text-[#FFD54F]">
                  Daemon Telemetry
                </span>
              </h1>
              <p className="text-[11px] text-gray-200 mt-0.5 hidden sm:block">
                Real-time ESMTP daemon telemetry, memory footprint, active pool sockets, and spool latency.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Speed Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#F0FDF4] border border-[#BBF7D0] text-[11px] font-mono shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
              <span className="text-gray-600 font-bold text-[10px] uppercase">Speed:</span>
              <span className="font-extrabold text-[#15803D] text-xs">
                {Number(sendRate).toFixed(1)}
              </span>
              <span className="text-gray-500 text-[10px]">msg/s</span>
            </div>

            <button
              onClick={() => {
                onRefresh();
                loadMetrics();
              }}
              disabled={isLoading || metricsLoading}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#37474F] hover:bg-[#263238] text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading || metricsLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={onNavigateToSend}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs transition"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Send Mail</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Ribbon */}
        <div className="px-3 pt-2 bg-[#F1F4F7] border-b border-[#CCD2D8] flex items-center gap-1 overflow-x-auto scrollbar-none">
          {tabs.map(([key, label]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-all rounded-t-sm border-t border-x ${
                  active
                    ? 'bg-gradient-to-b from-[#E0A328] via-[#C98B18] to-[#AC710D] text-white shadow-xs border-[#E9B446]'
                    : 'bg-[#E2E7EC] text-gray-700 hover:bg-[#D8DEE4] border-transparent'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-4 md:p-6 space-y-6">
          {tab === 'home' && (
            <div className="space-y-6">
              {/* 4 Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  ['Engine Status', stats.kumoHealth === 'healthy' ? 'ONLINE (2525)' : stats.kumoHealth.toUpperCase(), Server, stats.kumoHealth === 'healthy'],
                  ['Active Sockets', n(activeConnections), Network, true],
                  ['Messages In Flight', n(inFlight), Zap, inFlight === 0],
                  ['Throughput Rate', `${Number(sendRate).toFixed(2)} msg/s`, Gauge, true],
                ].map(([label, value, Icon, good]) => {
                  const I = Icon as React.ElementType;
                  return (
                    <div key={String(label)} className="p-4 rounded bg-[#F8FAFC] border border-[#CCD2D8] shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase font-bold text-gray-600 font-sans">{label}</span>
                        <I className={`w-4 h-4 ${good ? 'text-[#2E7D32]' : 'text-amber-600'}`} />
                      </div>
                      <div className="text-xl font-bold font-mono text-gray-900 mt-2">{value}</div>
                    </div>
                  );
                })}
              </div>

              {/* 2x2 Tables Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Panel title="Traffic Totals">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-[#EAEFF4] border-b border-[#CCD2D8] text-[11px] font-bold text-gray-700">
                        <tr>
                          <th className="py-2 px-3 text-left">Period</th>
                          <th className="py-2 px-3 text-right">Inbound</th>
                          <th className="py-2 px-3 text-right">Outbound</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px]">
                        {[
                          ['All Time Total', trafficIn, trafficOut],
                          ['Last Hour', lastHourIn, lastHourOut],
                          ['Peak / Hour', stats.timeseries?.reduce((m, x) => Math.max(m, x.sent), 0) ?? topHourOut, topHourOut],
                          ['Last Minute', Math.round(sendRate * 60), Math.round(sendRate * 60)],
                        ].map(([label, input, output], idx) => (
                          <tr key={String(label)} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F9FBFC]'}>
                            <td className="py-2 px-3 font-sans font-bold text-gray-700">{label}</td>
                            <td className="py-2 px-3 text-right text-gray-800">{n(input)}</td>
                            <td className="py-2 px-3 text-right font-bold text-[#8B1A10]">{n(output)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>

                <Panel title="Top Domains in Spool Queue">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-[#EAEFF4] border-b border-[#CCD2D8] text-[11px] font-bold text-gray-700">
                        <tr>
                          <th className="py-2 px-3 text-left font-sans">Domain</th>
                          <th className="py-2 px-3 text-right">Recipients</th>
                          <th className="py-2 px-3 text-right">% Spool</th>
                          <th className="py-2 px-3 text-right">Conns</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px]">
                        {queuedDomains.length ? (
                          queuedDomains.map(([domain, count], idx) => (
                            <tr key={domain} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F9FBFC]'}>
                              <td className="py-2 px-3 text-[#8B1A10] font-medium font-sans">{domain}</td>
                              <td className="py-2 px-3 text-right text-gray-800 font-bold">{n(count)}</td>
                              <td className="py-2 px-3 text-right text-gray-600">
                                {pct(queueSize ? (count / queueSize) * 100 : 0)}
                              </td>
                              <td className="py-2 px-3 text-right text-gray-700">
                                {Math.min(count, activeConnections)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-gray-500 font-sans">
                              No queued recipient domains in spool
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {tab === 'status' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Panel title="System Services">
                <div className="p-4 space-y-3 text-xs">
                  {[
                    ['PowerMTA / KumoMTA Core Daemon', stats.kumoHealth, Server],
                    ['Amazon SES Relay Transport', stats.sesHealth, ExternalLink],
                    ['ESMTP Listener (0.0.0.0:2525)', activeConnections > 0 ? 'active' : 'idle', Activity],
                  ].map(([name, value, Icon]) => {
                    const I = Icon as React.ElementType;
                    return (
                      <div key={String(name)} className="flex justify-between items-center border-b border-[#E2E8F0] pb-3">
                        <span className="flex items-center gap-2 text-gray-800 font-medium">
                          <I className="w-4 h-4 text-[#8B1A10]" />
                          {name}
                        </span>
                        <span className="text-[#2E7D32] font-mono font-bold bg-[#E8F5E9] px-2 py-0.5 rounded border border-[#C8E6C9]">
                          {String(value).toUpperCase()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <Panel title="Server Resources & Memory">
                <div className="p-4 space-y-4 text-xs">
                  <div>
                    <div className="flex justify-between text-gray-700 font-semibold mb-1">
                      <span>Process CPU Load</span>
                      <span className="font-mono text-gray-900">{Number(metrics.kumomta_cpu_usage_percent || 0).toFixed(1)}%</span>
                    </div>
                    <div className="h-2.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                      <div
                        className="h-2.5 bg-[#8B1A10] rounded-full transition-all"
                        style={{ width: `${Math.min(100, Number(metrics.kumomta_cpu_usage_percent || 0))}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-gray-700 font-semibold mb-1">
                      <span>Resident Memory (RSS)</span>
                      <span className="font-mono text-gray-900">{mb(metrics.kumomta_memory_usage_bytes)}</span>
                    </div>
                    <div className="h-2.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                      <div
                        className="h-2.5 bg-[#2E7D32] rounded-full transition-all"
                        style={{ width: `${Math.min(100, Number(metrics.kumomta_memory_usage_bytes || 0) / 1024 / 1024 / 10)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded bg-[#F8FAFC] border border-[#CCD2D8]">
                      <span className="text-[10px] uppercase text-gray-600 font-bold">SES 24h Quota Used</span>
                      <div className="text-base font-bold font-mono text-gray-900 mt-1">{n(ses24h)}</div>
                    </div>
                    <div className="p-3 rounded bg-[#F8FAFC] border border-[#CCD2D8]">
                      <span className="text-[10px] uppercase text-gray-600 font-bold">Max Relay Rate</span>
                      <div className="text-base font-bold font-mono text-gray-900 mt-1">{n(sesRate)}/s</div>
                    </div>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {tab === 'queues' && (
            <Panel title="PowerMTA Live Spool Inspection">
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-[#CCD2D8]">
                <div className="p-4 rounded bg-[#F8FAFC] border border-[#CCD2D8]">
                  <div className="text-[10px] uppercase text-gray-600 font-bold">Spool Queue Depth</div>
                  <div className="text-2xl font-bold font-mono text-gray-900 mt-1">{n(queueSize)} msgs</div>
                </div>
                <div className="p-4 rounded bg-[#F8FAFC] border border-[#CCD2D8]">
                  <div className="text-[10px] uppercase text-gray-600 font-bold">In Flight Relay</div>
                  <div className="text-2xl font-bold font-mono text-gray-900 mt-1">{n(inFlight)} sockets</div>
                </div>
                <div className="p-4 rounded bg-[#F8FAFC] border border-[#CCD2D8]">
                  <div className="text-[10px] uppercase text-gray-600 font-bold">Throughput</div>
                  <div className="text-2xl font-bold font-mono text-[#2E7D32] mt-1">{Number(sendRate).toFixed(2)} msg/s</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#546E7A] text-white uppercase font-mono text-[10px] border-b border-[#37474F]">
                    <tr>
                      <th className="p-2.5 px-3">Recipient</th>
                      <th className="p-2.5 px-3">Target Domain</th>
                      <th className="p-2.5 px-3">Status</th>
                      <th className="p-2.5 px-3">Queued Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] font-mono text-xs">
                    {queuedMessages.slice(0, 50).map((m, idx) => (
                      <tr
                        key={m.id}
                        className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#F9FBFC]'} hover:bg-[#EBF3FB] cursor-pointer`}
                        onClick={() => onSelectMessage(m)}
                      >
                        <td className="p-2.5 px-3 font-semibold text-gray-900">{m.toEmail}</td>
                        <td className="p-2.5 px-3 text-[#8B1A10] font-sans">{m.toEmail?.split('@')[1]}</td>
                        <td className="p-2.5 px-3 text-gray-700">{m.status}</td>
                        <td className="p-2.5 px-3 text-gray-500">{m.queuedAt}</td>
                      </tr>
                    ))}
                    {queuedMessages.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500 font-sans">
                          Spool queue is currently clear
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {tab === 'domains' && (
            <Panel title="Recipient Domain Routing Telemetry">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#546E7A] text-white uppercase font-mono text-[10px] border-b border-[#37474F]">
                    <tr>
                      <th className="p-2.5 px-3">Recipient Domain</th>
                      <th className="p-2.5 px-3 text-right">Spool Count</th>
                      <th className="p-2.5 px-3 text-right">Percentage</th>
                      <th className="p-2.5 px-3 text-right">Routing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] font-mono text-xs">
                    {queuedDomains.map(([domain, count], idx) => (
                      <tr key={domain} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F9FBFC]'}>
                        <td className="p-2.5 px-3 text-[#8B1A10] font-semibold">{domain}</td>
                        <td className="p-2.5 px-3 text-right text-gray-900 font-bold">{n(count)}</td>
                        <td className="p-2.5 px-3 text-right text-gray-600">{pct(queueSize ? (count / queueSize) * 100 : 0)}</td>
                        <td className="p-2.5 px-3 text-right text-[#2E7D32] font-semibold">Direct MX / SES</td>
                      </tr>
                    ))}
                    {queuedDomains.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500 font-sans">
                          No active recipient domains in queue
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {tab === 'vmtas' && (
            <Panel title="Virtual MTA (VMTA) Pools">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 text-xs">
                <div className="p-4 rounded bg-[#F8FAFC] border border-[#CCD2D8] space-y-1">
                  <Server className="w-5 h-5 text-[#2E7D32] mb-2" />
                  <div className="font-bold text-gray-900">Default VMTA Pool</div>
                  <p className="text-gray-600 font-mono">SMTP Listener: {stats.kumoHealth}</p>
                </div>
                <div className="p-4 rounded bg-[#F8FAFC] border border-[#CCD2D8] space-y-1">
                  <Network className="w-5 h-5 text-[#8B1A10] mb-2" />
                  <div className="font-bold text-gray-900">Outbound Socket Pool</div>
                  <p className="text-gray-600 font-mono">{n(activeConnections)} active / {n(idleConnections)} idle</p>
                </div>
                <div className="p-4 rounded bg-[#F8FAFC] border border-[#CCD2D8] space-y-1">
                  <HardDrive className="w-5 h-5 text-[#C98B18] mb-2" />
                  <div className="font-bold text-gray-900">Disk Spool Buffer</div>
                  <p className="text-gray-600 font-mono">{n(queueSize)} active buffers</p>
                </div>
              </div>
            </Panel>
          )}

          {tab === 'jobs' && (
            <Panel title="Dispatches & Job Telemetry">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#546E7A] text-white uppercase font-mono text-[10px] border-b border-[#37474F]">
                    <tr>
                      <th className="p-2.5 px-3">RFC Message-ID</th>
                      <th className="p-2.5 px-3">Recipient</th>
                      <th className="p-2.5 px-3">Status</th>
                      <th className="p-2.5 px-3">Provider</th>
                      <th className="p-2.5 px-3">Dispatched</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] font-mono text-xs">
                    {recentMessages.slice(0, 50).map((m, idx) => (
                      <tr
                        key={m.id}
                        onClick={() => onSelectMessage(m)}
                        className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#F9FBFC]'} hover:bg-[#EBF3FB] cursor-pointer`}
                      >
                        <td className="p-2.5 px-3 text-[#8B1A10] truncate max-w-[200px]">{m.messageId}</td>
                        <td className="p-2.5 px-3 text-gray-900 font-semibold truncate max-w-[200px]">{m.toEmail}</td>
                        <td className="p-2.5 px-3 text-gray-700">{m.status}</td>
                        <td className="p-2.5 px-3 text-gray-500">{m.provider}</td>
                        <td className="p-2.5 px-3 text-gray-500">{m.queuedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {tab === 'logs' && (
            <Panel title="Transport Logs">
              <div className="p-4 space-y-2 font-mono text-xs max-h-[500px] overflow-auto bg-black text-[#00FF66]">
                {recentMessages.slice(0, 80).map((m) => (
                  <div key={m.id} className="border-b border-[#0f2e14] pb-2 text-[#00FF66]">
                    <span className="text-[#00FF66]/60">{m.queuedAt}</span>{' '}
                    <span className="text-[#00FF66] font-bold">[{m.status}]</span>{' '}
                    <span className="font-semibold text-[#00FF66]">{m.fromEmail} → {m.toEmail}</span>{' '}
                    {m.smtpResponse && <span className="text-[#00FF66]/70">[{m.smtpResponse}]</span>}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {tab === 'actions' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ['Compose Email', Mail, onNavigateToSend],
                ['Refresh Telemetry', RefreshCw, () => { onRefresh(); loadMetrics(); }],
                ['Inspect Queues', ListChecks, () => setTab('queues')],
                ['Node Settings', Settings, () => setTab('status')],
              ].map(([label, Icon, action]) => {
                const I = Icon as React.ElementType;
                return (
                  <button
                    key={String(label)}
                    onClick={action as () => void}
                    className="text-left p-5 rounded bg-white border border-[#CCD2D8] hover:border-[#8B1A10] hover:shadow-xs transition-all cursor-pointer"
                  >
                    <I className="w-5 h-5 text-[#8B1A10] mb-3" />
                    <div className="font-bold text-gray-900 text-xs">{label}</div>
                    <div className="text-[11px] text-gray-600 mt-1">Execute command on PowerMTA daemon</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
