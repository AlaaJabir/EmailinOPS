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
  stats: DashboardStats | null;
  recentMessages: Message[];
  onSelectMessage: (message: Message) => void;
  onNavigateToSend: () => void;
  onRefresh: () => void;
  isLoading: boolean;
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
  stats,
  recentMessages,
  onSelectMessage,
  onNavigateToSend,
  onRefresh,
  isLoading,
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
    const id = window.setInterval(loadMetrics, 5000);
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
    ['home', 'Overview'],
    ['status', 'Status & Resources'],
    ['queues', 'Queue Spool'],
    ['domains', 'Recipient Domains'],
    ['vmtas', 'Virtual MTAs'],
    ['jobs', 'Dispatches'],
    ['logs', 'Spool Logs'],
    ['actions', 'Actions'],
  ];

  if (!stats) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[400px] text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-3 text-indigo-400" /> Connecting to KumoMTA telemetry...
      </div>
    );
  }

  const Panel: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({
    title,
    children,
    className = '',
  }) => (
    <section className={`bg-[#111827] border border-slate-800/90 rounded-lg overflow-hidden ${className}`}>
      <div className="px-4 py-3 bg-[#0E1524] border-b border-slate-800 text-white text-xs font-semibold tracking-tight">
        {title}
      </div>
      {children}
    </section>
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981]" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              KumoMTA Node Operations
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time ESMTP daemon telemetry, memory footprint, active pool sockets, and spool latency.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
            <span>KumoMTA: {stats.kumoHealth.toUpperCase()}</span>
          </div>
          <button
            onClick={() => {
              onRefresh();
              loadMetrics();
            }}
            disabled={isLoading || metricsLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#162032] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-medium transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading || metricsLoading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={onNavigateToSend}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Send Email</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-800">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3.5 py-2 text-xs font-medium rounded-t-md transition-colors whitespace-nowrap ${
              tab === key
                ? 'border-b-2 border-indigo-500 text-white font-semibold bg-indigo-600/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'home' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              ['Engine Status', stats.kumoHealth === 'healthy' ? 'ONLINE (2525)' : stats.kumoHealth.toUpperCase(), Server, stats.kumoHealth === 'healthy'],
              ['Active Sockets', n(activeConnections), Network, true],
              ['Messages In Flight', n(inFlight), Zap, inFlight === 0],
              ['Throughput Rate', `${Number(sendRate).toFixed(2)} / sec`, Gauge, true],
            ].map(([label, value, Icon, good]) => {
              const I = Icon as React.ElementType;
              return (
                <div key={String(label)} className="p-4 rounded-lg bg-[#111827] border border-slate-800/90">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">{label}</span>
                    <I className={`w-4 h-4 ${good ? 'text-emerald-400' : 'text-amber-400'}`} />
                  </div>
                  <div className="text-xl font-bold font-mono text-white mt-2">{value}</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Panel title="Traffic Totals">
              <div className="grid grid-cols-3 text-right text-xs">
                <div className="p-2.5 text-slate-400 bg-[#0A0F1A]" />
                <div className="p-2.5 font-semibold text-slate-300 bg-[#0A0F1A]">Inbound</div>
                <div className="p-2.5 font-semibold text-slate-300 bg-[#0A0F1A]">Outbound</div>
                {[
                  ['All Time Total', trafficIn, trafficOut],
                  ['Last Hour', lastHourIn, lastHourOut],
                  ['Peak / Hour', stats.timeseries?.reduce((m, x) => Math.max(m, x.sent), 0) ?? topHourOut, topHourOut],
                  ['Last Minute', Math.round(sendRate * 60), Math.round(sendRate * 60)],
                ].map(([label, input, output]) => (
                  <React.Fragment key={String(label)}>
                    <div className="px-3.5 py-2 bg-[#0E1524] text-right font-medium text-slate-400 border-t border-slate-800/60">
                      {label}
                    </div>
                    <div className="px-3.5 py-2 font-mono text-slate-200 border-t border-l border-slate-800/60">
                      {n(input)}
                    </div>
                    <div className="px-3.5 py-2 font-mono text-indigo-300 border-t border-l border-slate-800/60">
                      {n(output)}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </Panel>

            <Panel title="Top Domains in Spool Queue">
              <div className="grid grid-cols-[1.5fr_1fr_0.8fr_0.8fr] text-xs">
                {['Domain', 'Recipients', '% Spool', 'Conns'].map((h) => (
                  <div key={h} className="p-2.5 bg-[#0A0F1A] font-semibold text-slate-400 uppercase text-[10px] font-mono">
                    {h}
                  </div>
                ))}
                {queuedDomains.length ? (
                  queuedDomains.map(([domain, count]) => (
                    <React.Fragment key={domain}>
                      <div className="px-3 py-2 border-t border-slate-800/60 font-mono text-indigo-400 truncate">{domain}</div>
                      <div className="px-3 py-2 border-t border-slate-800/60 font-mono text-white">{n(count)}</div>
                      <div className="px-3 py-2 border-t border-slate-800/60 font-mono text-slate-400">
                        {pct(queueSize ? (count / queueSize) * 100 : 0)}
                      </div>
                      <div className="px-3 py-2 border-t border-slate-800/60 font-mono text-slate-300">
                        {Math.min(count, activeConnections)}
                      </div>
                    </React.Fragment>
                  ))
                ) : (
                  <div className="col-span-4 p-8 text-center text-slate-500 font-mono">No queued recipient domains</div>
                )}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {tab === 'status' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Panel title="System Services">
            <div className="p-4 space-y-3 text-xs">
              {[
                ['KumoMTA Core Daemon', stats.kumoHealth, Server],
                ['Amazon SES Relay Transport', stats.sesHealth, ExternalLink],
                ['ESMTP Listener (0.0.0.0:2525)', activeConnections > 0 ? 'active' : 'idle', Activity],
              ].map(([name, value, Icon]) => {
                const I = Icon as React.ElementType;
                return (
                  <div key={String(name)} className="flex justify-between items-center border-b border-slate-800/60 pb-3">
                    <span className="flex items-center gap-2 text-slate-300">
                      <I className="w-4 h-4 text-indigo-400" />
                      {name}
                    </span>
                    <span className="text-emerald-400 font-mono font-semibold">{String(value).toUpperCase()}</span>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Server Resources & Memory">
            <div className="p-4 space-y-4 text-xs">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Process CPU Load</span>
                  <span className="font-mono text-white">{Number(metrics.kumomta_cpu_usage_percent || 0).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Number(metrics.kumomta_cpu_usage_percent || 0))}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Resident Memory (RSS)</span>
                  <span className="font-mono text-white">{mb(metrics.kumomta_memory_usage_bytes)}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Number(metrics.kumomta_memory_usage_bytes || 0) / 1024 / 1024 / 10)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded bg-[#0A0F1A] border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 font-semibold">SES 24h Quota Used</span>
                  <div className="text-base font-bold font-mono text-white mt-1">{n(ses24h)}</div>
                </div>
                <div className="p-3 rounded bg-[#0A0F1A] border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 font-semibold">Max Relay Rate</span>
                  <div className="text-base font-bold font-mono text-white mt-1">{n(sesRate)}/s</div>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {tab === 'queues' && (
        <Panel title="KumoMTA Live Spool Inspection">
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded bg-[#0A0F1A] border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Spool Queue Depth</div>
              <div className="text-2xl font-bold font-mono text-white mt-1">{n(queueSize)} msgs</div>
            </div>
            <div className="p-4 rounded bg-[#0A0F1A] border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">In Flight Relay</div>
              <div className="text-2xl font-bold font-mono text-white mt-1">{n(inFlight)} sockets</div>
            </div>
            <div className="p-4 rounded bg-[#0A0F1A] border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Throughput</div>
              <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">{Number(sendRate).toFixed(2)}/s</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0A0F1A] text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Recipient</th>
                  <th className="p-3">Target Domain</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Queued Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {queuedMessages.slice(0, 50).map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-800/30 cursor-pointer"
                    onClick={() => onSelectMessage(m)}
                  >
                    <td className="p-3 text-white">{m.toEmail}</td>
                    <td className="p-3 text-indigo-400">{m.toEmail?.split('@')[1]}</td>
                    <td className="p-3 text-slate-300">{m.status}</td>
                    <td className="p-3 text-slate-400">{m.queuedAt}</td>
                  </tr>
                ))}
                {queuedMessages.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500 font-sans">
                      Spool queue is currently clear
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
            <div className="p-4 rounded bg-[#0A0F1A] border border-slate-800 space-y-1">
              <Server className="w-5 h-5 text-emerald-400 mb-2" />
              <div className="font-semibold text-white">Default VMTA Pool</div>
              <p className="text-slate-400 font-mono">SMTP Listener: {stats.kumoHealth}</p>
            </div>
            <div className="p-4 rounded bg-[#0A0F1A] border border-slate-800 space-y-1">
              <Network className="w-5 h-5 text-indigo-400 mb-2" />
              <div className="font-semibold text-white">Outbound Socket Pool</div>
              <p className="text-slate-400 font-mono">{n(activeConnections)} active / {n(idleConnections)} idle</p>
            </div>
            <div className="p-4 rounded bg-[#0A0F1A] border border-slate-800 space-y-1">
              <HardDrive className="w-5 h-5 text-purple-400 mb-2" />
              <div className="font-semibold text-white">Disk Spool Buffer</div>
              <p className="text-slate-400 font-mono">{n(queueSize)} active buffers</p>
            </div>
          </div>
        </Panel>
      )}

      {tab === 'jobs' && (
        <Panel title="Dispatches & Job Telemetry">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0A0F1A] text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">RFC Message-ID</th>
                  <th className="p-3">Recipient</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Dispatched</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {recentMessages.slice(0, 50).map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => onSelectMessage(m)}
                    className="hover:bg-slate-800/30 cursor-pointer"
                  >
                    <td className="p-3 text-indigo-400 truncate max-w-[200px]">{m.messageId}</td>
                    <td className="p-3 text-white truncate max-w-[200px]">{m.toEmail}</td>
                    <td className="p-3 text-slate-300">{m.status}</td>
                    <td className="p-3 text-slate-400">{m.provider}</td>
                    <td className="p-3 text-slate-500">{m.queuedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === 'logs' && (
        <Panel title="KumoMTA Transport Logs">
          <div className="p-4 space-y-2 font-mono text-[11px] max-h-[500px] overflow-auto">
            {recentMessages.slice(0, 80).map((m) => (
              <div key={m.id} className="border-b border-slate-800/60 pb-2">
                <span className="text-slate-500">{m.queuedAt}</span>{' '}
                <span className="text-indigo-400 font-semibold">{m.status}</span>{' '}
                <span className="text-slate-300">{m.fromEmail} → {m.toEmail}</span>{' '}
                {m.smtpResponse && <span className="text-slate-500">[{m.smtpResponse}]</span>}
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
                className="text-left p-5 rounded-lg bg-[#111827] border border-slate-800/90 hover:border-indigo-500/50 transition-colors"
              >
                <I className="w-5 h-5 text-indigo-400 mb-3" />
                <div className="font-semibold text-white text-xs">{label}</div>
                <div className="text-[11px] text-slate-400 mt-1">Execute command on KumoMTA</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
