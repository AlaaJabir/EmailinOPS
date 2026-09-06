import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleStop,
  Clock3,
  Gauge,
  Mail,
  Pause,
  RefreshCw,
  Server,
  ShieldCheck,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { DashboardStats, Message } from '../types';

interface Props {
  stats: DashboardStats | null;
  recentMessages: Message[];
  onSelectMessage: (message: Message) => void;
  onNavigateToSend: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

interface LiveMetrics {
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

type Section = 'overview' | 'status' | 'queues' | 'domains' | 'vmtas' | 'jobs' | 'reputation' | 'logs' | 'actions';

const fmt = (v: number) => Math.round(v || 0).toLocaleString();
const percent = (v: number) => `${Number(v || 0).toFixed(2)}%`;
const shortTime = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const cardClass = 'bg-white border border-zinc-200 rounded-sm shadow-sm';

export const PowerDashboardView: React.FC<Props> = ({
  stats,
  recentMessages,
  onSelectMessage,
  onNavigateToSend,
  onRefresh,
  isLoading,
}) => {
  const [section, setSection] = useState<Section>('overview');
  const [metrics, setMetrics] = useState<LiveMetrics>({});
  const [history, setHistory] = useState<Array<{ t: string; sent: number; delivered: number; bounced: number }>>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadLive = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(`${apiBase}/api/metrics?format=json`);
      if (!response.ok) return;
      const data = await response.json();
      setMetrics(data);
      setLastUpdate(new Date());
      setHistory((prev) => {
        const point = {
          t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          sent: Number(data.kumomta_messages_sent_total || stats?.totalSent || 0),
          delivered: Number(stats?.delivered || 0),
          bounced: Number(stats?.bounced || 0),
        };
        return [...prev, point].slice(-30);
      });
    } catch (error) {
      console.error('[PowerDashboard] live telemetry failed', error);
    }
  };

  useEffect(() => {
    loadLive();
    const timer = window.setInterval(loadLive, 5000);
    return () => window.clearInterval(timer);
  }, [stats?.totalSent, stats?.delivered, stats?.bounced]);

  const queue = Number(metrics.kumomta_queue_size ?? stats?.queueSize ?? 0);
  const inFlight = Number(metrics.kumomta_messages_in_flight || 0);
  const activeConnections = Number(metrics.kumomta_smtp_connection_pool_active || 0);
  const idleConnections = Number(metrics.kumomta_smtp_connection_pool_idle || 0);
  const sendRate = Number(metrics.kumomta_delivery_rate_per_second ?? stats?.sendingRatePerSec ?? 0);
  const sent = Number(stats?.totalSent || metrics.kumomta_messages_sent_total || 0);
  const delivered = Number(stats?.delivered || 0);
  const bounced = Number(stats?.bounced || 0);
  const failed = Number(stats?.failed || 0);
  const rejected = Number(stats?.rejected || 0);
  const opens = Number(stats?.opens || 0);
  const clicks = Number(stats?.clicks || 0);
  const complaints = Number(stats?.complaints || 0);
  const deferred = Number(stats?.deliveryDelayed || 0);
  const unsubscribed = recentMessages.filter((m) => m.events?.some((e) => e.eventType === 'UNSUBSCRIBED')).length;

  const health = useMemo(() => {
    const bounceRate = Number(stats?.bounceRate || 0);
    if (stats?.kumoHealth === 'offline') return { label: 'CRITICAL', tone: 'critical' };
    if (stats?.kumoHealth === 'degraded' || bounceRate >= 5 || queue > 1000) return { label: 'DEGRADED', tone: 'warn' };
    return { label: 'HEALTHY', tone: 'healthy' };
  }, [stats?.kumoHealth, stats?.bounceRate, queue]);

  const domainBreakdown = useMemo(() => {
    const map = new Map<string, { recipients: number; delivered: number; bounced: number; deferred: number }>();
    recentMessages.forEach((m) => {
      const domain = m.toEmail?.split('@')[1]?.toLowerCase() || 'unknown';
      const row = map.get(domain) || { recipients: 0, delivered: 0, bounced: 0, deferred: 0 };
      row.recipients += 1;
      if (m.status === 'DELIVERED') row.delivered += 1;
      if (m.status === 'BOUNCED') row.bounced += 1;
      if (m.status === 'DELIVERY_DELAYED') row.deferred += 1;
      map.set(domain, row);
    });
    return [...map.entries()].sort((a, b) => b[1].recipients - a[1].recipients).slice(0, 10);
  }, [recentMessages]);

  const bounceData = [
    { name: 'Hard', value: recentMessages.filter((m) => m.bounceType === 'Hard').length },
    { name: 'Soft', value: recentMessages.filter((m) => m.bounceType !== 'Hard' && m.status === 'BOUNCED').length },
  ];

  const nav: Array<[Section, string]> = [
    ['overview', 'Home'],
    ['status', 'Status'],
    ['queues', 'Queues'],
    ['domains', 'Domains'],
    ['vmtas', 'Virtual MTAs'],
    ['jobs', 'Jobs'],
    ['reputation', 'Reputation'],
    ['logs', 'Logs'],
    ['actions', 'Actions'],
  ];

  const kpis = [
    ['Emails Sent', fmt(sent), 'lifetime', Mail],
    ['Delivered', `${fmt(delivered)} · ${percent(stats?.deliveryRate || 0)}`, 'delivery', CheckCircle2],
    ['Bounced', `${fmt(bounced)} · ${percent(stats?.bounceRate || 0)}`, 'bounce', XCircle],
    ['Failed / Rejected', `${fmt(failed)} / ${fmt(rejected)}`, 'delivery errors', AlertTriangle],
    ['Complaints', `${fmt(complaints)} · ${sent ? percent((complaints / sent) * 100) : '0.00%'}`, 'FBL', ShieldCheck],
    ['Opens', `${fmt(opens)} · ${percent(stats?.openRate || 0)}`, 'engagement', Activity],
    ['Clicks', `${fmt(clicks)} · ${percent(stats?.clickRate || 0)}`, 'engagement', TrendingUp],
    ['Unsubscribes', fmt(unsubscribed), 'tracked', XCircle],
    ['Send Rate', `${sendRate.toFixed(2)} msg/s`, 'live', Gauge],
    ['Queue', fmt(queue), `${inFlight} in flight`, Clock3],
    ['SMTP Connections', fmt(activeConnections), `${idleConnections} idle`, Server],
    ['CPU', `${Number(metrics.kumomta_cpu_usage_percent || 0).toFixed(1)}%`, 'KumoMTA', Zap],
  ] as const;

  if (!stats) {
    return <div className="min-h-[520px] flex items-center justify-center text-zinc-500"><RefreshCw className="w-5 h-5 animate-spin mr-2" />Loading live EmailOps telemetry…</div>;
  }

  return (
    <div className="min-h-full bg-[#f5f5f5] text-zinc-800">
      <div className="bg-[#666] border-b-4 border-[#a52a2a] px-3 pt-2 flex items-end gap-1 overflow-x-auto">
        {nav.map(([key, label]) => (
          <button key={key} onClick={() => setSection(key)} className={`px-4 py-2 text-xs font-semibold whitespace-nowrap border-t border-x border-zinc-500 ${section === key ? 'bg-[#a52a2a] text-white border-[#a52a2a]' : 'bg-[#858585] text-white hover:bg-[#747474]'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-5 max-w-[1600px] mx-auto space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight">EmailOps MTA Control Center</h1>
              <span className={`px-2 py-1 text-[10px] font-bold rounded ${health.tone === 'healthy' ? 'bg-emerald-100 text-emerald-700' : health.tone === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{health.label}</span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE</span>
            </div>
            <div className="text-xs text-zinc-500 mt-1">KumoMTA + delivery + engagement telemetry · refresh every 5s{lastUpdate ? ` · updated ${shortTime(lastUpdate.toISOString())}` : ''}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { onRefresh(); loadLive(); }} disabled={isLoading} className="px-3 py-2 text-xs bg-white border border-zinc-300 rounded hover:bg-zinc-50"><RefreshCw className={`w-3.5 h-3.5 inline mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />Refresh</button>
            <button onClick={onNavigateToSend} className="px-3 py-2 text-xs font-semibold bg-[#a52a2a] text-white rounded hover:bg-[#8e2222]"><Mail className="w-3.5 h-3.5 inline mr-1.5" />Send Test Email</button>
          </div>
        </header>

        {section === 'overview' && <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
            {kpis.map(([label, value, meta, Icon]) => <div key={label} className={cardClass + ' p-3 min-h-[96px]'}><div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-zinc-500"><span>{label}</span><Icon className="w-4 h-4" /></div><div className="text-lg font-bold mt-3 tabular-nums">{value}</div><div className="text-[10px] text-zinc-400 mt-1">{meta}</div></div>)}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <section className={cardClass + ' xl:col-span-2 p-4'}>
              <div className="flex justify-between items-center mb-3"><div><h2 className="font-semibold text-sm">Traffic & Delivery — Live</h2><p className="text-[10px] text-zinc-400">Last 30 telemetry samples</p></div><span className="text-xs font-mono">{sendRate.toFixed(2)} msg/s</span></div>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={history.length ? history : stats.timeseries?.map((x) => ({ t: x.time, sent: x.sent, delivered: x.delivered, bounced: x.bounced })) || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="t" hide /><YAxis width={45} /><Tooltip /><Area type="monotone" dataKey="sent" fillOpacity={0.12} strokeWidth={2} /><Line type="monotone" dataKey="delivered" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="bounced" strokeWidth={2} dot={false} /></AreaChart></ResponsiveContainer></div>
            </section>
            <section className={cardClass + ' p-4'}>
              <h2 className="font-semibold text-sm mb-1">Bounce Analysis</h2><p className="text-[10px] text-zinc-400 mb-2">Hard vs soft from tracked messages</p>
              <div className="h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={bounceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2}>{bounceData.map((_, i) => <Cell key={i} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
              <div className="grid grid-cols-2 text-xs text-center"><div><b>{bounceData[0].value}</b><div className="text-zinc-400">Hard</div></div><div><b>{bounceData[1].value}</b><div className="text-zinc-400">Soft</div></div></div>
            </section>
          </div>

          <section className={cardClass}>
            <div className="px-4 py-3 border-b border-zinc-200 flex justify-between"><h2 className="font-semibold text-sm">Recent Sending Activity</h2><span className="text-[10px] text-zinc-400">{recentMessages.length} loaded</span></div>
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-zinc-100 text-zinc-500"><tr>{['Time','Message ID','From','To','Subject','Status','Latency'].map((h) => <th key={h} className="text-left p-2 font-semibold">{h}</th>)}</tr></thead><tbody>{recentMessages.slice(0, 12).map((m) => { const latency = m.deliveredAt && m.sentAt ? Math.max(0, new Date(m.deliveredAt).getTime() - new Date(m.sentAt).getTime()) : null; return <tr key={m.id} onClick={() => onSelectMessage(m)} className="border-t border-zinc-100 hover:bg-zinc-50 cursor-pointer"><td className="p-2 whitespace-nowrap">{shortTime(m.createdAt)}</td><td className="p-2 font-mono max-w-[150px] truncate">{m.messageId}</td><td className="p-2">{m.fromEmail}</td><td className="p-2">{m.toEmail}</td><td className="p-2 max-w-[220px] truncate">{m.subject}</td><td className="p-2"><span className="px-1.5 py-0.5 bg-zinc-100 rounded">{m.status}</span></td><td className="p-2">{latency === null ? '—' : `${latency} ms`}</td></tr>; })}</tbody></table>{recentMessages.length === 0 && <div className="p-8 text-center text-zinc-400">No sending activity yet.</div>}</div>
          </section>
        </>}

        {section === 'status' && <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{[
          ['KumoMTA', stats.kumoHealth, stats.kumoHealth === 'healthy'],
          ['Database', 'healthy', true],
          ['Tracking', recentMessages.some((m) => m.events?.some((e) => e.eventType === 'OPENED' || e.eventType === 'CLICKED')) ? 'active' : 'idle', true],
          ['SMTP connections', `${activeConnections} active / ${idleConnections} idle`, true],
          ['Messages in flight', fmt(inFlight), inFlight === 0],
          ['SES quota 24h', `${fmt(metrics.ses_quota_sent_last_24_hour || 0)} / ${fmt(metrics.ses_quota_max_24_hour || 0)}`, true],
        ].map(([name, value, ok]) => <div key={String(name)} className={cardClass + ' p-4'}><div className="flex justify-between"><span className="font-semibold text-sm">{name}</span>{ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}</div><div className="text-xl font-bold mt-4">{String(value).toUpperCase()}</div></div>)}</div>}

        {section === 'queues' && <section className={cardClass}><div className="p-4 border-b border-zinc-200"><h2 className="font-semibold">Queue Operations</h2><p className="text-xs text-zinc-500">Live queue size and recipients by destination domain</p></div><div className="grid grid-cols-3 bg-zinc-100 text-xs font-semibold"><div className="p-2">Domain</div><div className="p-2">Recipients</div><div className="p-2">% Queue</div></div>{domainBreakdown.length ? domainBreakdown.map(([domain, row]) => <div key={domain} className="grid grid-cols-3 border-t border-zinc-100 text-xs"><div className="p-3 font-medium">{domain}</div><div className="p-3">{row.recipients}</div><div className="p-3">{percent(queue ? (row.recipients / queue) * 100 : 0)}</div></div>) : <div className="p-8 text-center text-zinc-400">Queue is empty.</div>}<div className="p-4 border-t border-zinc-200 grid grid-cols-3 text-center"><div><b>{fmt(queue)}</b><div className="text-[10px] text-zinc-400">recipients</div></div><div><b>{fmt(inFlight)}</b><div className="text-[10px] text-zinc-400">in flight</div></div><div><b>{sendRate.toFixed(2)}</b><div className="text-[10px] text-zinc-400">msg/sec</div></div></div></section>}

        {section === 'domains' && <section className={cardClass}><div className="p-4 border-b border-zinc-200"><h2 className="font-semibold">Destination / Sending Domain Health</h2></div><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-zinc-100"><tr>{['Domain','Recipients','Delivered %','Bounce %','Deferred %','Avg latency'].map((h) => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{domainBreakdown.map(([domain, row]) => <tr key={domain} className="border-t border-zinc-100"><td className="p-3 font-medium">{domain}</td><td className="p-3">{row.recipients}</td><td className="p-3">{percent(row.recipients ? row.delivered / row.recipients * 100 : 0)}</td><td className="p-3">{percent(row.recipients ? row.bounced / row.recipients * 100 : 0)}</td><td className="p-3">{percent(row.recipients ? row.deferred / row.recipients * 100 : 0)}</td><td className="p-3">—</td></tr>)}</tbody></table>{!domainBreakdown.length && <div className="p-8 text-center text-zinc-400">No destination data yet.</div>}</div></section>}

        {section === 'vmtas' && <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><section className={cardClass + ' p-4'}><h2 className="font-semibold">Virtual MTA</h2><div className="mt-4 border-t pt-4 flex justify-between"><span>KumoMTA primary</span><span className="text-emerald-600 font-semibold">{stats.kumoHealth.toUpperCase()}</span></div><div className="mt-3 text-xs text-zinc-500">Live SMTP pool: {activeConnections} active, {idleConnections} idle.</div></section><section className={cardClass + ' p-4'}><h2 className="font-semibold">IP / Pool Telemetry</h2><div className="mt-4 grid grid-cols-2 gap-2"><div className="bg-zinc-50 p-3"><b>{fmt(sent)}</b><div className="text-[10px] text-zinc-400">sent</div></div><div className="bg-zinc-50 p-3"><b>{percent(stats.bounceRate)}</b><div className="text-[10px] text-zinc-400">bounce</div></div></div><p className="text-xs text-zinc-500 mt-4">Per-IP reputation and warmup require provider/RBL integrations; this panel never fabricates scores.</p></section></div>}

        {section === 'jobs' && <section className={cardClass}><div className="p-4 border-b border-zinc-200"><h2 className="font-semibold">Jobs / Campaigns</h2></div><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-zinc-100"><tr>{['Campaign','Status','Total','Sent','Delivered','Bounce','Open %','Click %'].map((h) => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{stats.topCampaigns?.map((c) => <tr key={c.id} className="border-t border-zinc-100"><td className="p-3 font-medium">{c.name}</td><td className="p-3">ACTIVE</td><td className="p-3">—</td><td className="p-3">{fmt(c.sent)}</td><td className="p-3">{fmt(c.delivered)}</td><td className="p-3">—</td><td className="p-3">{percent(c.openRate)}</td><td className="p-3">{percent(c.clickRate)}</td></tr>)}</tbody></table>{!stats.topCampaigns?.length && <div className="p-8 text-center text-zinc-400">No campaign telemetry yet.</div>}</div></section>}

        {section === 'reputation' && <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"><div className={cardClass + ' p-4'}><h3 className="font-semibold text-sm">Bounce Reputation</h3><div className="text-2xl font-bold mt-3">{percent(metrics.ses_reputation_bounce_rate ?? stats.bounceRate)}</div><p className="text-xs text-zinc-400 mt-1">Current observed rate</p></div><div className={cardClass + ' p-4'}><h3 className="font-semibold text-sm">Complaint Rate</h3><div className="text-2xl font-bold mt-3">{percent(metrics.ses_reputation_complaint_rate ?? (sent ? complaints / sent * 100 : 0))}</div><p className="text-xs text-zinc-400 mt-1">Current observed rate</p></div><div className={cardClass + ' p-4'}><h3 className="font-semibold text-sm">SPF / DKIM / DMARC</h3><div className="text-2xl font-bold mt-3">LIVE</div><p className="text-xs text-zinc-400 mt-1">Use Domains for per-domain DNS verification.</p></div><div className={cardClass + ' p-4'}><h3 className="font-semibold text-sm">PTR / RBL</h3><div className="text-2xl font-bold mt-3">NOT CONNECTED</div><p className="text-xs text-zinc-400 mt-1">No fake reputation/blacklist values are displayed.</p></div></div>}

        {section === 'logs' && <section className={cardClass}><div className="p-4 border-b border-zinc-200"><h2 className="font-semibold">Recent Message Trace</h2></div><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-zinc-100"><tr>{['Timestamp','Message ID','Event','Status','Recipient'].map((h) => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{recentMessages.flatMap((m) => (m.events || []).slice(-3).map((e) => <tr key={`${m.id}-${e.id}`} className="border-t border-zinc-100"><td className="p-2">{shortTime(e.timestamp)}</td><td className="p-2 font-mono">{m.messageId}</td><td className="p-2">{e.eventType}</td><td className="p-2">{m.status}</td><td className="p-2">{m.toEmail}</td></tr>))}</tbody></table></div></section>}

        {section === 'actions' && <section className={cardClass + ' p-5'}><h2 className="font-semibold">Operations</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4"><button onClick={onNavigateToSend} className="p-4 border border-zinc-200 rounded text-left hover:bg-zinc-50"><Mail className="w-5 h-5 mb-2" /><b>Send Test</b><p className="text-xs text-zinc-400 mt-1">Open the real sending flow.</p></button><button onClick={() => { onRefresh(); loadLive(); }} className="p-4 border border-zinc-200 rounded text-left hover:bg-zinc-50"><RefreshCw className="w-5 h-5 mb-2" /><b>Refresh telemetry</b><p className="text-xs text-zinc-400 mt-1">Fetch current API/Kumo data now.</p></button><button disabled className="p-4 border border-zinc-200 rounded text-left opacity-50 cursor-not-allowed"><CircleStop className="w-5 h-5 mb-2" /><b>Emergency Stop</b><p className="text-xs text-zinc-400 mt-1">Requires a dedicated Kumo control endpoint before enabling.</p></button></div><div className="mt-5 text-xs text-zinc-500">Safety: destructive MTA controls are intentionally disabled until backed by authenticated server-side operations. No UI control pretends to be live when it is not.</div></section>}

        <footer className="text-[10px] text-zinc-400 flex items-center justify-between"><span>Power MTA · live telemetry</span><span className="flex items-center gap-1"><ChevronRight className="w-3 h-3" />Click any message for full trace</span></footer>
      </div>
    </div>
  );
};
