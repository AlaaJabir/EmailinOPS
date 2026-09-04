import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  CircleAlert,
  Cpu,
  ExternalLink,
  Gauge,
  HardDrive,
  ListChecks,
  Mail,
  Network,
  Pause,
  Play,
  RefreshCw,
  Server,
  Settings,
  TerminalSquare,
  XCircle,
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
    ['home', 'Home'],
    ['status', 'Status'],
    ['queues', 'Queues'],
    ['domains', 'Domains'],
    ['vmtas', 'Virtual MTAs'],
    ['jobs', 'Jobs'],
    ['logs', 'Logs'],
    ['actions', 'Actions'],
  ];

  if (!stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px] text-zinc-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-3" /> Connecting to KumoMTA telemetry...
      </div>
    );
  }

  const Panel: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
    <section className={`bg-[#111111] border border-white/10 ${className}`}>
      <div className="px-4 py-2 bg-zinc-500/20 border-b border-white/10 text-zinc-200 text-sm font-medium">{title}</div>
      {children}
    </section>
  );

  return (
    <div className="min-h-full bg-[#050505] text-zinc-100 font-sans">
      <div className="border-b-4 border-red-900 bg-[#b8b8b8] px-3 pt-2 flex items-end gap-1 overflow-x-auto">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-xs font-medium border-t border-x border-zinc-500 whitespace-nowrap transition-colors ${
              tab === key ? 'bg-[#7f1208] text-white border-[#7f1208]' : 'bg-[#9c9c9c] text-white hover:bg-[#777]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-5 max-w-[1500px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-white">KumoMTA Operations</div>
            <div className="text-xs text-zinc-500 mt-1">Live SMTP spool, queue, connection and delivery telemetry</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> {stats.kumoHealth.toUpperCase()}
            </span>
            <button onClick={() => { onRefresh(); loadMetrics(); }} disabled={isLoading || metricsLoading} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-xs hover:bg-white/10">
              <RefreshCw className={`w-3.5 h-3.5 inline mr-1.5 ${isLoading || metricsLoading ? 'animate-spin' : ''}`} />Refresh
            </button>
            <button onClick={onNavigateToSend} className="px-3 py-1.5 bg-white text-black rounded text-xs font-semibold">
              <Mail className="w-3.5 h-3.5 inline mr-1.5" />Send Email
            </button>
          </div>
        </div>

        {tab === 'home' && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <Panel title="Traffic Totals">
                <div className="grid grid-cols-3 text-right text-xs">
                  <div className="p-2 text-zinc-500" />
                  <div className="p-2 font-semibold text-zinc-200">in</div>
                  <div className="p-2 font-semibold text-zinc-200">out</div>
                  {[
                    ['total', trafficIn, trafficOut],
                    ['last hour', lastHourIn, lastHourOut],
                    ['top/hour', stats.timeseries?.reduce((m, x) => Math.max(m, x.sent), 0) ?? topHourOut, topHourOut],
                    ['last minute', Math.round(sendRate * 60), Math.round(sendRate * 60)],
                    ['top/minute', Math.round(sendRate * 60), Math.round(sendRate * 60)],
                  ].map(([label, input, output]) => (
                    <React.Fragment key={String(label)}>
                      <div className="px-3 py-1.5 bg-zinc-800/50 text-right font-medium text-zinc-400">{label}</div>
                      <div className="px-3 py-1.5 bg-zinc-700/30 border-l border-white/10">{n(input)}</div>
                      <div className="px-3 py-1.5 bg-zinc-700/30 border-l border-white/10">{n(output)}</div>
                    </React.Fragment>
                  ))}
                </div>
              </Panel>

              <Panel title="Top Domains in the Queue">
                <div className="grid grid-cols-[1.5fr_1fr_0.8fr_0.8fr] text-xs">
                  {['name', 'recipients', '% total', 'conns.'].map((h) => <div key={h} className="p-2 bg-zinc-700/50 font-semibold">{h}</div>)}
                  {queuedDomains.length ? queuedDomains.map(([domain, count]) => (
                    <React.Fragment key={domain}>
                      <div className="px-2 py-2 border-t border-white/10 text-sky-300 underline">{domain}</div>
                      <div className="px-2 py-2 border-t border-white/10">{n(count)}</div>
                      <div className="px-2 py-2 border-t border-white/10">{pct(queueSize ? (count / queueSize) * 100 : 0)}</div>
                      <div className="px-2 py-2 border-t border-white/10">{Math.min(count, activeConnections)}</div>
                    </React.Fragment>
                  )) : (
                    <div className="col-span-4 p-5 text-center text-zinc-500">No queued recipient domains</div>
                  )}
                </div>
              </Panel>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <Panel title="Active Connections">
                <div className="grid grid-cols-3 text-xs">
                  <div className="p-2 bg-zinc-700/50 font-semibold" />
                  <div className="p-2 bg-zinc-700/50 font-semibold text-center">in</div>
                  <div className="p-2 bg-zinc-700/50 font-semibold text-center">out</div>
                  <div className="p-3 bg-zinc-800/50 font-medium">SMTP</div>
                  <div className="p-3 text-center border-t border-white/10">{n(inFlight)}</div>
                  <div className="p-3 text-center border-t border-white/10">{n(activeConnections)}</div>
                </div>
                <div className="px-3 py-2 text-[11px] text-zinc-500 border-t border-white/10">Idle connection pool: {n(idleConnections)}</div>
              </Panel>

              <Panel title="Queue Totals">
                <div className="grid grid-cols-3 text-xs">
                  <div className="p-2 bg-zinc-700/50 font-semibold">recipients</div>
                  <div className="p-2 bg-zinc-700/50 font-semibold">max</div>
                  <div className="p-2 bg-zinc-700/50 font-semibold">% max</div>
                  <div className="p-3">{n(queueSize)}</div>
                  <div className="p-3">{n(ses24hMax || 0)}</div>
                  <div className="p-3">{pct(ses24hMax ? (queueSize / ses24hMax) * 100 : 0)}</div>
                </div>
              </Panel>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[
                ['KumoMTA', stats.kumoHealth === 'healthy' ? 'ONLINE' : stats.kumoHealth.toUpperCase(), Server, stats.kumoHealth === 'healthy'],
                ['SMTP Connections', n(activeConnections), Network, true],
                ['Messages In Flight', n(inFlight), Zap, inFlight === 0],
                ['Send Rate', `${Number(sendRate).toFixed(2)} / sec`, Gauge, true],
              ].map(([label, value, Icon, good]) => {
                const I = Icon as React.ElementType;
                return <div key={String(label)} className="p-4 bg-[#111111] border border-white/10"><div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span><I className={`w-4 h-4 ${good ? 'text-emerald-400' : 'text-amber-400'}`} /></div><div className="text-lg font-semibold mt-3">{value}</div></div>;
              })}
            </div>
          </>
        )}

        {tab === 'status' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Panel title="System Status">
              <div className="p-4 space-y-3 text-sm">
                {[
                  ['KumoMTA', stats.kumoHealth, Server],
                  ['Amazon SES', stats.sesHealth, ExternalLink],
                  ['SMTP engine', activeConnections > 0 ? 'active' : 'idle', Activity],
                ].map(([name, value, Icon]) => { const I = Icon as React.ElementType; return <div key={String(name)} className="flex justify-between items-center border-b border-white/10 pb-3"><span className="flex items-center gap-2"><I className="w-4 h-4 text-zinc-400" />{name}</span><span className="text-emerald-400 font-mono text-xs">{String(value).toUpperCase()}</span></div>; })}
              </div>
            </Panel>
            <Panel title="Resource Usage">
              <div className="p-4 space-y-4 text-xs">
                <div><div className="flex justify-between mb-1"><span>CPU</span><span>{Number(metrics.kumomta_cpu_usage_percent || 0).toFixed(1)}%</span></div><div className="h-2 bg-zinc-800 rounded"><div className="h-2 bg-white rounded" style={{ width: `${Math.min(100, Number(metrics.kumomta_cpu_usage_percent || 0))}%` }} /></div></div>
                <div><div className="flex justify-between mb-1"><span>Memory</span><span>{mb(metrics.kumomta_memory_usage_bytes)}</span></div><div className="h-2 bg-zinc-800 rounded"><div className="h-2 bg-white rounded" style={{ width: `${Math.min(100, Number(metrics.kumomta_memory_usage_bytes || 0) / 1024 / 1024 / 10)}%` }} /></div></div>
                <div className="grid grid-cols-2 gap-3"><div className="p-3 bg-zinc-900 border border-white/10">SES 24h<div className="text-lg font-semibold mt-1">{n(ses24h)}</div></div><div className="p-3 bg-zinc-900 border border-white/10">SES rate<div className="text-lg font-semibold mt-1">{n(sesRate)}/s</div></div></div>
              </div>
            </Panel>
          </div>
        )}

        {tab === 'queues' && (
          <Panel title="Queue Inspection">
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-zinc-900 border border-white/10"><div className="text-xs text-zinc-500">Queued recipients</div><div className="text-2xl mt-2">{n(queueSize)}</div></div>
              <div className="p-4 bg-zinc-900 border border-white/10"><div className="text-xs text-zinc-500">In flight</div><div className="text-2xl mt-2">{n(inFlight)}</div></div>
              <div className="p-4 bg-zinc-900 border border-white/10"><div className="text-xs text-zinc-500">Throughput</div><div className="text-2xl mt-2">{Number(sendRate).toFixed(2)}/s</div></div>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-zinc-800/70 text-left"><th className="p-3">Recipient</th><th className="p-3">Domain</th><th className="p-3">Status</th><th className="p-3">Queued</th></tr></thead><tbody>{queuedMessages.slice(0, 50).map(m => <tr key={m.id} className="border-t border-white/10 hover:bg-white/5 cursor-pointer" onClick={() => onSelectMessage(m)}><td className="p-3">{m.toEmail}</td><td className="p-3">{m.toEmail?.split('@')[1]}</td><td className="p-3">{m.status}</td><td className="p-3">{m.queuedAt}</td></tr>)}{queuedMessages.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-zinc-500">Queue is empty</td></tr>}</tbody></table></div>
          </Panel>
        )}

        {tab === 'domains' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Panel title="Queued Domains"><div className="divide-y divide-white/10">{queuedDomains.map(([domain, count]) => <div key={domain} className="flex justify-between p-3 text-sm"><span>{domain}</span><span className="font-mono">{n(count)}</span></div>)}{queuedDomains.length === 0 && <div className="p-6 text-zinc-500 text-sm">No active domains in queue.</div>}</div></Panel>
            <Panel title="Delivery Health"><div className="p-4 space-y-3">{stats.topSenders.map(s => <div key={s.id} className="flex justify-between items-center text-sm"><div><div>{s.name}</div><div className="text-xs text-zinc-500">{s.email}</div></div><div className="text-right"><div>{pct(s.deliveryRate)}</div><div className="text-xs text-zinc-500">{n(s.volume)} sent</div></div></div>)}</div></Panel>
          </div>
        )}

        {tab === 'vmtas' && (
          <Panel title="Virtual MTAs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
              <div className="p-4 bg-zinc-900 border border-white/10"><Server className="w-5 h-5 mb-3 text-emerald-400" /><div className="font-semibold">Primary KumoMTA</div><div className="text-xs text-zinc-500 mt-1">SMTP {stats.kumoHealth}</div></div>
              <div className="p-4 bg-zinc-900 border border-white/10"><Network className="w-5 h-5 mb-3" /><div className="font-semibold">Outbound Pool</div><div className="text-xs text-zinc-500 mt-1">{n(activeConnections)} active / {n(idleConnections)} idle</div></div>
              <div className="p-4 bg-zinc-900 border border-white/10"><HardDrive className="w-5 h-5 mb-3" /><div className="font-semibold">Spool</div><div className="text-xs text-zinc-500 mt-1">{n(queueSize)} recipients queued</div></div>
            </div>
          </Panel>
        )}

        {tab === 'jobs' && (
          <Panel title="Jobs / Recent Delivery Activity"><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-zinc-800/70 text-left"><th className="p-3">Message</th><th className="p-3">Recipient</th><th className="p-3">Status</th><th className="p-3">Provider</th><th className="p-3">Time</th></tr></thead><tbody>{recentMessages.slice(0, 100).map(m => <tr key={m.id} onClick={() => onSelectMessage(m)} className="border-t border-white/10 hover:bg-white/5 cursor-pointer"><td className="p-3 font-mono">{m.messageId}</td><td className="p-3">{m.toEmail}</td><td className="p-3">{m.status}</td><td className="p-3">{m.provider}</td><td className="p-3">{m.queuedAt}</td></tr>)}</tbody></table></div></Panel>
        )}

        {tab === 'logs' && (
          <Panel title="KumoMTA / SMTP Logs"><div className="p-4 space-y-2 font-mono text-[11px] max-h-[600px] overflow-auto">{recentMessages.slice(0, 100).map(m => <div key={m.id} className="border-b border-white/5 pb-2"><span className="text-zinc-500">{m.queuedAt}</span> <span className="text-sky-300">{m.status}</span> <span className="text-zinc-300">{m.fromEmail} → {m.toEmail}</span> {m.smtpResponse && <span className="text-zinc-500"> {m.smtpResponse}</span>}</div>)}</div></Panel>
        )}

        {tab === 'actions' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              ['Send Email', Mail, onNavigateToSend],
              ['Refresh Telemetry', RefreshCw, () => { onRefresh(); loadMetrics(); }],
              ['Queue Monitor', ListChecks, () => setTab('queues')],
              ['System Status', Settings, () => setTab('status')],
            ].map(([label, Icon, action]) => { const I = Icon as React.ElementType; return <button key={String(label)} onClick={action as () => void} className="text-left p-5 bg-[#111111] border border-white/10 hover:border-white/25 transition-colors"><I className="w-5 h-5 mb-4" /><div className="font-semibold">{label}</div><div className="text-xs text-zinc-500 mt-1">Open operational control</div></button>; })}
          </div>
        )}

        <Panel title="Administration">
          <div className="p-4 flex flex-wrap gap-3 text-xs">
            <button onClick={() => setTab('status')} className="inline-flex items-center gap-2 text-zinc-300 hover:text-white"><Settings className="w-4 h-4" /> System status</button>
            <button onClick={() => setTab('logs')} className="inline-flex items-center gap-2 text-zinc-300 hover:text-white"><TerminalSquare className="w-4 h-4" /> View logs</button>
            <button onClick={() => setTab('queues')} className="inline-flex items-center gap-2 text-zinc-300 hover:text-white"><ListChecks className="w-4 h-4" /> Inspect queues</button>
            <span className="ml-auto text-zinc-600">KumoMTA + EmailinOPS</span>
          </div>
        </Panel>
      </div>
    </div>
  );
};
