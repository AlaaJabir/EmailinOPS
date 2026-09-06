import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, ChevronRight, Clock3, Eye, Gauge,
  Inbox, Mail, RefreshCw, Search, Server, Terminal, Timer, X, XCircle, Zap,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DashboardStats, Message, MessageEvent, ServiceLog } from '../types';

interface Props {
  stats: DashboardStats | null;
  recentMessages: Message[];
  onSelectMessage: (message: Message) => void;
  onNavigateToSend: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}
interface LiveMetrics { [key: string]: any }
type Section = 'overview' | 'queues' | 'domains' | 'vmtas' | 'jobs' | 'reputation' | 'logs';
type QueueFilter = 'ALL' | 'QUEUED' | 'SENDING' | 'DEFERRED' | 'SENT' | 'DELIVERED' | 'BOUNCED' | 'FAILED';

const n = (v: any) => Number(v || 0);
const fmt = (v: any) => Math.round(n(v)).toLocaleString();
const pct = (v: any) => `${n(v).toFixed(2)}%`;
const time = (v?: string) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
const dateTime = (v?: string) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' });
};
const card = 'bg-[#101216] border border-[#242832] rounded-lg shadow-[0_8px_30px_rgba(0,0,0,.18)]';

const statusClass = (status?: string) => {
  switch (status) {
    case 'DELIVERED': return 'text-emerald-300 bg-emerald-950/50 border-emerald-900/60';
    case 'SENT': return 'text-sky-300 bg-sky-950/40 border-sky-900/60';
    case 'QUEUED': return 'text-amber-300 bg-amber-950/40 border-amber-900/60';
    case 'SENDING': return 'text-violet-300 bg-violet-950/40 border-violet-900/60';
    case 'DELIVERY_DELAYED': return 'text-orange-300 bg-orange-950/40 border-orange-900/60';
    case 'BOUNCED': case 'FAILED': case 'REJECTED': return 'text-red-300 bg-red-950/40 border-red-900/60';
    default: return 'text-zinc-300 bg-zinc-900/70 border-zinc-800';
  }
};
const eventClass = (event?: string) => event === 'OPENED' || event === 'CLICKED' ? 'text-violet-300' : event === 'DELIVERED' ? 'text-emerald-300' : event === 'BOUNCED' || event === 'FAILED' ? 'text-red-300' : 'text-zinc-300';

export const PowerDashboardView: React.FC<Props> = ({ stats, recentMessages, onSelectMessage, onNavigateToSend, onRefresh, isLoading }) => {
  const [section, setSection] = useState<Section>('overview');
  const [live, setLive] = useState<LiveMetrics>({});
  const [messages, setMessages] = useState<Message[]>(recentMessages);
  const [logs, setLogs] = useState<ServiceLog[]>([]);
  const [samples, setSamples] = useState<any[]>([]);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('ALL');
  const [queueSearch, setQueueSearch] = useState('');
  const [selected, setSelected] = useState<Message | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('—');

  const refreshLive = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE_URL || '';
      const [mr, lr, rr] = await Promise.all([
        fetch(`${base}/api/messages?limit=200`),
        fetch(`${base}/api/logs?limit=200`),
        fetch(`${base}/api/metrics?format=json`),
      ]);
      if (mr.ok) { const d = await mr.json(); setMessages(d.messages || []); }
      if (lr.ok) { const d = await lr.json(); setLogs(d.logs || []); }
      if (rr.ok) {
        const d = await rr.json();
        setLive(d);
        setSamples(p => [...p, { t: time(new Date().toISOString()), queue: n(d.kumomta_queue_size), rate: n(d.kumomta_delivery_rate_per_second) }].slice(-48));
      }
      setLastUpdated(new Date().toISOString());
    } catch (e) {
      console.error('[PowerDashboard] live refresh failed', e);
    }
  };

  useEffect(() => {
    refreshLive();
    const id = window.setInterval(refreshLive, 2000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => { if (recentMessages.length) setMessages(recentMessages); }, [recentMessages]);

  const shown = messages.length ? messages : recentMessages;
  const sent = n(stats?.totalSent);
  const delivered = n(stats?.delivered);
  const bounced = n(stats?.bounced);
  const failed = n(stats?.failed);
  const queue = n(live.kumomta_queue_size ?? stats?.queueSize);
  const ready = n(live.kumomta_ready_queue_size);
  const scheduled = n(live.kumomta_scheduled_queue_size);
  const inFlight = n(live.kumomta_messages_in_flight);
  const rate = n(live.kumomta_delivery_rate_per_second ?? stats?.sendingRatePerSec);
  const active = n(live.kumomta_smtp_connection_pool_active);
  const idle = n(live.kumomta_smtp_connection_pool_idle);
  const deferredMessages = shown.filter(m => m.status === 'DELIVERY_DELAYED' || m.status === 'QUEUED').length;
  const opens = n(stats?.opens);
  const clicks = n(stats?.clicks);

  const health = useMemo(() => {
    if (stats?.kumoHealth === 'offline' || live.kumomta_live === false) return ['CRITICAL', 'text-red-300 bg-red-950/50 border-red-900/60'];
    if (n(stats?.bounceRate) >= 5 || queue > 1000) return ['DEGRADED', 'text-amber-300 bg-amber-950/50 border-amber-900/60'];
    return ['HEALTHY', 'text-emerald-300 bg-emerald-950/50 border-emerald-900/60'];
  }, [stats?.kumoHealth, stats?.bounceRate, queue, live.kumomta_live]);

  const domains = useMemo(() => {
    const map = new Map<string, { total: number; delivered: number; bounced: number; deferred: number; opens: number; clicks: number }>();
    shown.forEach(m => {
      const d = (m.toEmail?.split('@')[1] || 'unknown').toLowerCase();
      const x = map.get(d) || { total: 0, delivered: 0, bounced: 0, deferred: 0, opens: 0, clicks: 0 };
      x.total++;
      if (m.status === 'DELIVERED') x.delivered++;
      if (m.status === 'BOUNCED') x.bounced++;
      if (m.status === 'DELIVERY_DELAYED' || m.status === 'QUEUED') x.deferred++;
      x.opens += m.events?.filter(e => e.eventType === 'OPENED').length || 0;
      x.clicks += m.events?.filter(e => e.eventType === 'CLICKED').length || 0;
      map.set(d, x);
    });
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 20);
  }, [shown]);

  const queueRows = useMemo(() => {
    const q = queueSearch.trim().toLowerCase();
    return shown
      .filter(m => queueFilter === 'ALL' || m.status === queueFilter)
      .filter(m => !q || [m.messageId, m.toEmail, m.fromEmail, m.subject, m.providerMessageId].some(v => String(v || '').toLowerCase().includes(q)))
      .slice(0, 100);
  }, [shown, queueFilter, queueSearch]);

  const latestEvent = (m: Message): MessageEvent | undefined => {
    const events = [...(m.events || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return events[0];
  };
  const eventCounts = (m: Message) => ({
    sent: m.events?.filter(e => e.eventType === 'SENT').length || 0,
    delivered: m.events?.filter(e => e.eventType === 'DELIVERED').length || 0,
    opened: m.events?.filter(e => e.eventType === 'OPENED').length || 0,
    clicked: m.events?.filter(e => e.eventType === 'CLICKED').length || 0,
    bounced: m.events?.filter(e => e.eventType === 'BOUNCED').length || 0,
  });

  const nav: Array<[Section, string]> = [
    ['overview', 'Home'], ['queues', 'Queues'], ['domains', 'Domains'], ['vmtas', 'Virtual MTAs'],
    ['jobs', 'Jobs'], ['reputation', 'Reputation'], ['logs', 'Logs'],
  ];

  const kpis = [
    ['Sent', fmt(sent), 'messages', Mail],
    ['Delivered', `${fmt(delivered)} · ${pct(stats?.deliveryRate)}`, 'delivery rate', CheckCircle2],
    ['Bounced', `${fmt(bounced)} · ${pct(stats?.bounceRate)}`, 'bounce rate', XCircle],
    ['Opens', fmt(opens), 'tracked opens', Eye],
    ['Clicks', fmt(clicks), 'tracked clicks', Zap],
    ['Queue', fmt(queue), `${fmt(ready)} ready · ${fmt(scheduled)} scheduled`, Inbox],
    ['In Flight', fmt(inFlight), 'live outbound', Server],
    ['Send Rate', `${rate.toFixed(2)} msg/s`, 'live throughput', Gauge],
    ['Connections', fmt(active), `${fmt(idle)} idle pool`, Server],
    ['Failed', fmt(failed), 'failed / rejected', AlertTriangle],
  ] as const;

  return (
    <div className="min-h-full bg-[#07080b] text-zinc-100">
      <div className="sticky top-0 z-30 bg-[#0c0e12]/95 backdrop-blur border-b border-[#242832] px-4 py-2 flex items-center gap-1 overflow-x-auto">
        {nav.map(([key, label]) => (
          <button key={key} onClick={() => setSection(key)} className={`px-4 py-2 rounded-md text-xs font-semibold whitespace-nowrap ${section === key ? 'bg-[#7f1d1d] text-white' : 'text-zinc-400 hover:bg-[#171a20] hover:text-white'}`}>
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pl-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-bold">LIVE 2s</span>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-[1750px] mx-auto space-y-5">
        <header className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">Power MTA Operations</h1>
              <span className={`px-2 py-1 rounded border text-[10px] font-bold ${health[1]}`}>{health[0]}</span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">KumoMTA + EmailOps · live delivery operations console</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-[10px] text-zinc-600 mr-2">Updated {time(lastUpdated)}</span>
            <button onClick={() => { onRefresh(); refreshLive(); }} className="px-3 py-2 rounded-md bg-[#15181e] border border-[#2a2e38] text-xs hover:bg-[#1b1f27]"><RefreshCw className={`w-3.5 h-3.5 inline mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />Refresh</button>
            <button onClick={onNavigateToSend} className="px-3 py-2 rounded-md bg-[#991b1b] hover:bg-[#b91c1c] text-xs font-bold"><Mail className="w-3.5 h-3.5 inline mr-1.5" />Send Test</button>
          </div>
        </header>

        {section === 'overview' && <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {kpis.map(([label, value, meta, Icon]) => (
              <div key={label} className={`${card} p-4`}>
                <div className="flex justify-between text-[10px] uppercase tracking-wider text-zinc-500"><span>{label}</span><Icon className="w-4 h-4 text-zinc-600" /></div>
                <div className="text-xl font-bold mt-3">{value}</div>
                <div className="text-[10px] text-zinc-600 mt-1">{meta}</div>
              </div>
            ))}
          </div>

          <div className="grid xl:grid-cols-3 gap-4">
            <section className={`${card} xl:col-span-2 p-4`}>
              <div className="flex justify-between mb-3"><div><h2 className="font-semibold text-sm">Live KumoMTA Traffic</h2><p className="text-[10px] text-zinc-600">Queue depth + delivery throughput · 2 second telemetry</p></div><span className="text-xs font-mono text-emerald-400">{rate.toFixed(2)} msg/s</span></div>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={samples}><CartesianGrid stroke="#20242c" /><XAxis dataKey="t" hide /><YAxis stroke="#555" /><Tooltip contentStyle={{ background: '#0d0f13', border: '1px solid #2a2e38', color: '#fff' }} /><Area dataKey="rate" stroke="#dc2626" fill="#7f1d1d" fillOpacity={0.2} /><Area dataKey="queue" stroke="#f59e0b" fill="none" /></AreaChart></ResponsiveContainer></div>
            </section>
            <section className={`${card} p-4`}>
              <div className="flex items-center justify-between"><h2 className="font-semibold text-sm">Live Health</h2><span className="text-[10px] text-emerald-400">{live.kumomta_live ? 'TELEMETRY LIVE' : 'FALLBACK'}</span></div>
              <div className="space-y-3 mt-4">{[
                ['KumoMTA', stats?.kumoHealth || 'unknown'], ['Queue', fmt(queue)], ['Ready', fmt(ready)], ['Scheduled', fmt(scheduled)],
                ['Outbound', fmt(active)], ['In flight', fmt(inFlight)], ['CPU', `${n(live.kumomta_cpu_usage_percent).toFixed(1)}%`], ['Telemetry latency', `${fmt(live.kumomta_metrics_latency_ms)} ms`],
              ].map(([a, b]) => <div key={String(a)} className="flex justify-between border-b border-[#20242c] pb-2 text-xs"><span className="text-zinc-500">{a}</span><span>{String(b || '—')}</span></div>)}</div>
            </section>
          </div>

          <section className={card}>
            <div className="p-4 border-b border-[#242832] flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-semibold text-sm">Recent Sending Activity</h2><p className="text-[10px] text-zinc-600 mt-1">Click any message to inspect its complete delivery and engagement trace</p></div>
              <span className="text-[10px] text-zinc-600">{shown.length} tracked messages</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs"><thead className="bg-[#0c0e12] text-zinc-500"><tr>{['Time', 'Message ID', 'Recipient', 'Subject', 'Status', 'Last Event', 'Engagement', 'Trace'].map(h => <th key={h} className="text-left p-3 whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>{shown.slice(0, 25).map(m => { const c = eventCounts(m); const le = latestEvent(m); return <tr key={m.id} onClick={() => { setSelected(m); onSelectMessage(m); }} className="border-t border-[#20242c] hover:bg-[#15181e] cursor-pointer">
                  <td className="p-3 text-zinc-400 whitespace-nowrap">{time(m.createdAt)}</td><td className="p-3 font-mono max-w-[180px] truncate">{m.messageId}</td><td className="p-3">{m.toEmail}</td><td className="p-3 max-w-[250px] truncate">{m.subject}</td>
                  <td className="p-3"><span className={`px-2 py-1 rounded border text-[10px] font-bold ${statusClass(m.status)}`}>{m.status}</span></td>
                  <td className={`p-3 ${eventClass(le?.eventType)}`}>{le?.eventType || 'QUEUED'} <span className="text-zinc-600 ml-1">{time(le?.timestamp)}</span></td>
                  <td className="p-3 text-zinc-400">O {c.opened} · C {c.clicked}</td><td className="p-3"><ChevronRight className="w-4 h-4 text-zinc-600" /></td>
                </tr>; })}</tbody>
              </table>
              {!shown.length && <div className="p-12 text-center text-zinc-600">No tracked messages yet.</div>}
            </div>
          </section>
        </>}

        {section === 'queues' && <section className={card}>
          <div className="p-4 border-b border-[#242832] flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-semibold">Queue Operations</h2><p className="text-xs text-zinc-600 mt-1">Live KumoMTA queue telemetry plus application message state</p></div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> live · {time(lastUpdated)}</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4">
            {[
              ['TOTAL QUEUE', queue, Inbox], ['READY', ready, Timer], ['SCHEDULED', scheduled, Clock3], ['TRACKED DEFERRED', deferredMessages, AlertTriangle], ['IN FLIGHT', inFlight, Activity],
            ].map(([label, value, Icon]) => <div key={String(label)} className="bg-[#0b0d10] border border-[#20242c] rounded p-4"><div className="flex justify-between text-[10px] text-zinc-600"><span>{label}</span><Icon className="w-3.5 h-3.5" /></div><div className="text-2xl font-bold mt-2">{fmt(value)}</div></div>)}
          </div>
          <div className="px-4 pb-4 flex flex-wrap gap-2">
            {(['ALL', 'QUEUED', 'SENDING', 'DEFERRED', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED'] as QueueFilter[]).map(f => <button key={f} onClick={() => setQueueFilter(f)} className={`px-3 py-1.5 rounded-md border text-[10px] font-semibold ${queueFilter === f ? 'bg-[#7f1d1d] border-[#991b1b] text-white' : 'bg-[#0b0d10] border-[#242832] text-zinc-500 hover:text-white'}`}>{f === 'DEFERRED' ? 'DELIVERY DELAYED' : f}</button>)}
            <div className="ml-auto relative"><Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-600" /><input value={queueSearch} onChange={e => setQueueSearch(e.target.value)} placeholder="Search message / recipient / subject" className="bg-[#0b0d10] border border-[#242832] rounded-md pl-8 pr-3 py-1.5 text-[10px] w-64 outline-none focus:border-[#7f1d1d]" /></div>
          </div>
          <div className="overflow-x-auto border-t border-[#20242c]"><table className="w-full text-xs"><thead className="bg-[#0c0e12] text-zinc-500"><tr>{['Message', 'Recipient', 'Domain', 'State', 'Queued', 'Sent', 'Last Event', 'SMTP / Provider', 'Trace'].map(h => <th key={h} className="p-3 text-left whitespace-nowrap">{h}</th>)}</tr></thead><tbody>
            {queueRows.map(m => { const le = latestEvent(m); return <tr key={m.id} onClick={() => { setSelected(m); onSelectMessage(m); }} className="border-t border-[#20242c] hover:bg-[#15181e] cursor-pointer">
              <td className="p-3 font-mono max-w-[210px] truncate">{m.messageId}</td><td className="p-3">{m.toEmail}</td><td className="p-3 text-zinc-500">{m.toEmail?.split('@')[1] || '—'}</td><td className="p-3"><span className={`px-2 py-1 rounded border text-[10px] font-bold ${statusClass(m.status)}`}>{m.status === 'DELIVERY_DELAYED' ? 'DEFERRED' : m.status}</span></td>
              <td className="p-3 text-zinc-400">{dateTime(m.queuedAt)}</td><td className="p-3 text-zinc-400">{dateTime(m.sentAt)}</td><td className={`p-3 ${eventClass(le?.eventType)}`}>{le?.eventType || '—'}</td><td className="p-3 text-zinc-500 max-w-[220px] truncate">{m.smtpResponse || m.providerMessageId || '—'}</td><td className="p-3"><ChevronRight className="w-4 h-4 text-zinc-600" /></td>
            </tr>; })}
          </tbody></table>{!queueRows.length && <div className="p-12 text-center text-zinc-600">No messages match this queue filter.</div>}</div>
        </section>}

        {section === 'domains' && <section className={card}>
          <div className="p-4 border-b border-[#242832]"><h2 className="font-semibold">Destination Domains</h2><p className="text-xs text-zinc-600 mt-1">Per-domain delivery, bounce and engagement from tracked messages</p></div>
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-[#0c0e12] text-zinc-500"><tr>{['Domain', 'Recipients', 'Delivered', 'Bounce', 'Deferred', 'Opens', 'Clicks'].map(h => <th key={h} className="p-3 text-left">{h}</th>)}</tr></thead><tbody>{domains.map(([d, x]) => <tr key={d} className="border-t border-[#20242c]"><td className="p-3 font-medium">{d}</td><td className="p-3">{x.total}</td><td className="p-3 text-emerald-300">{pct(x.total ? x.delivered / x.total * 100 : 0)}</td><td className="p-3 text-red-300">{pct(x.total ? x.bounced / x.total * 100 : 0)}</td><td className="p-3 text-amber-300">{x.deferred}</td><td className="p-3">{x.opens}</td><td className="p-3">{x.clicks}</td></tr>)}</tbody></table></div>
        </section>}

        {section === 'vmtas' && <div className="grid md:grid-cols-2 gap-4">
          <section className={`${card} p-5`}><div className="flex justify-between"><h2 className="font-semibold">Virtual MTA</h2><span className="text-emerald-400 text-xs">{String(stats?.kumoHealth || 'unknown').toUpperCase()}</span></div><div className="mt-5 grid grid-cols-2 gap-3">{[['Outbound active', active], ['Inbound active', n(live.kumomta_smtp_connections_in)], ['Idle pool', idle], ['Total connections', n(live.kumomta_total_connections)]].map(([a,b]) => <div key={String(a)} className="bg-[#0b0d10] border border-[#20242c] rounded p-3"><div className="text-[10px] text-zinc-600">{a}</div><div className="text-lg font-bold mt-1">{fmt(b)}</div></div>)}</div></section>
          <section className={`${card} p-5`}><h2 className="font-semibold">IP Pool / Reputation</h2><div className="mt-4 space-y-3 text-xs">{[['KumoMTA', live.kumomta_live ? 'CONNECTED' : 'OFFLINE'], ['SMTP relay', 'ACTIVE'], ['PTR / rDNS', 'Integration required'], ['RBL monitoring', 'Integration required'], ['Warmup', 'Not configured']].map(([a,b]) => <div key={String(a)} className="flex justify-between border-b border-[#20242c] pb-2"><span className="text-zinc-500">{a}</span><span>{b}</span></div>)}</div></section>
        </div>}

        {section === 'jobs' && <section className={card}><div className="p-4 border-b border-[#242832]"><h2 className="font-semibold">Jobs / Campaigns</h2></div>{(stats?.topCampaigns || []).map(c => <div key={c.id} className="p-4 border-b border-[#20242c] flex flex-wrap gap-5 justify-between text-xs"><b>{c.name}</b><span>Sent {fmt(c.sent)}</span><span>Delivered {fmt(c.delivered)}</span><span>Open {pct(c.openRate)}</span><span>Click {pct(c.clickRate)}</span></div>)}{!(stats?.topCampaigns || []).length && <div className="p-10 text-center text-zinc-600">No campaigns available.</div>}</section>}

        {section === 'reputation' && <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">{[['Bounce rate', pct(stats?.bounceRate)], ['Complaint rate', sent ? pct(n(stats?.complaints) / sent * 100) : '0.00%'], ['SPF / DKIM / DMARC', 'Domain checks'], ['PTR / RBL', 'Integration required']].map(([a,b]) => <div key={String(a)} className={`${card} p-5`}><div className="text-xs text-zinc-500">{a}</div><div className="text-2xl font-bold mt-3">{b}</div></div>)}</div>}

        {section === 'logs' && <section className={card}><div className="p-4 border-b border-[#242832] flex justify-between"><div><h2 className="font-semibold">Live Technical Logs</h2><p className="text-[10px] text-zinc-600 mt-1">Application, KumoMTA and webhook processing activity</p></div><span className="text-[10px] text-zinc-600">{logs.length} loaded</span></div><div className="divide-y divide-[#20242c]">{logs.slice(0, 150).map(l => <div key={l.id} className="p-3 grid grid-cols-1 md:grid-cols-6 gap-2 text-xs"><span className="text-zinc-500">{time(l.timestamp)}</span><span>{l.service}</span><span className="font-semibold">{l.event}</span><span className={l.severity === 'ERROR' ? 'text-red-400' : l.severity === 'WARN' ? 'text-amber-400' : 'text-emerald-400'}>{l.severity}</span><span className="font-mono text-zinc-500 truncate">{l.messageId || '—'}</span><span className="text-zinc-400 truncate">{l.response}</span></div>)}{!logs.length && <div className="p-10 text-center text-zinc-600">No live logs yet.</div>}</div></section>}

        <div className="text-[10px] text-zinc-600 flex justify-between"><span><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />Messages + queue + logs + Kumo telemetry polling every 2 seconds</span><span>Power MTA Operations</span></div>
      </div>

      {selected && <div className="fixed inset-0 z-50 bg-black/60 flex justify-end" onClick={() => setSelected(null)}>
        <aside className="w-full max-w-2xl h-full bg-[#0b0d10] border-l border-[#2a2e38] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="sticky top-0 z-10 bg-[#0c0e12]/95 backdrop-blur border-b border-[#242832] p-4 flex items-center justify-between"><div><div className="text-[10px] text-zinc-600 uppercase tracking-wider">Message Inspector</div><div className="font-mono text-sm mt-1 max-w-[430px] truncate">{selected.messageId}</div></div><button onClick={() => setSelected(null)} className="p-2 rounded hover:bg-[#171a20]"><X className="w-4 h-4" /></button></div>
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between"><div><div className="text-[10px] text-zinc-600">CURRENT STATE</div><span className={`inline-block mt-2 px-3 py-1.5 rounded border text-xs font-bold ${statusClass(selected.status)}`}>{selected.status}</span></div><div className="text-right"><div className="text-[10px] text-zinc-600">PROVIDER</div><div className="text-xs mt-2">{selected.provider}</div></div></div>
            <div className="grid grid-cols-2 gap-3">{[['From', selected.fromEmail], ['To', selected.toEmail], ['Subject', selected.subject], ['Campaign', selected.campaignName || selected.campaignId || '—'], ['Queued', dateTime(selected.queuedAt)], ['Sent', dateTime(selected.sentAt)], ['Delivered', dateTime(selected.deliveredAt)], ['Bounced', dateTime(selected.bouncedAt)], ['SES ID', selected.sesMessageId || '—'], ['Provider ID', selected.providerMessageId || '—']].map(([a,b]) => <div key={String(a)} className="bg-[#101216] border border-[#20242c] rounded p-3 min-w-0"><div className="text-[10px] text-zinc-600">{a}</div><div className="text-xs mt-1 break-words">{String(b)}</div></div>)}</div>
            <section className={`${card} p-4`}><div className="flex justify-between items-center"><h3 className="text-sm font-semibold">Delivery Trace</h3><span className="text-[10px] text-zinc-600">{selected.events?.length || 0} events</span></div><div className="mt-4 space-y-0">{[...(selected.events || [])].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((e, i) => <div key={e.id || `${e.timestamp}-${i}`} className="flex gap-3 relative pb-4"><div className="flex flex-col items-center"><span className={`w-2.5 h-2.5 rounded-full border-2 ${e.eventType === 'DELIVERED' ? 'border-emerald-400 bg-emerald-400' : e.eventType === 'BOUNCED' || e.eventType === 'FAILED' ? 'border-red-400 bg-red-400' : 'border-zinc-500 bg-zinc-800'}`} />{i < (selected.events?.length || 1) - 1 && <span className="w-px flex-1 bg-[#2a2e38] mt-1" />}</div><div className="flex-1"><div className={`text-xs font-semibold ${eventClass(e.eventType)}`}>{e.eventType}</div><div className="text-[10px] text-zinc-600 mt-1">{dateTime(e.timestamp)}</div>{e.eventData && <pre className="mt-2 bg-[#07080b] border border-[#20242c] rounded p-2 text-[9px] text-zinc-500 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(e.eventData, null, 2)}</pre>}</div></div>)}</div>{!(selected.events || []).length && <div className="py-8 text-center text-zinc-600">No events recorded.</div>}</section>
            <section className={`${card} p-4`}><h3 className="text-sm font-semibold">Engagement</h3><div className="grid grid-cols-4 gap-2 mt-3">{[['Sent', eventCounts(selected).sent], ['Delivered', eventCounts(selected).delivered], ['Opens', eventCounts(selected).opened], ['Clicks', eventCounts(selected).clicked]].map(([a,b]) => <div key={String(a)} className="bg-[#0b0d10] border border-[#20242c] rounded p-3 text-center"><div className="text-[10px] text-zinc-600">{a}</div><div className="font-bold mt-1">{b}</div></div>)}</div></section>
            {selected.smtpResponse && <section className={`${card} p-4`}><h3 className="text-sm font-semibold flex items-center gap-2"><Terminal className="w-4 h-4" /> SMTP Response</h3><pre className="mt-3 text-[10px] text-zinc-400 bg-[#07080b] border border-[#20242c] rounded p-3 whitespace-pre-wrap break-all">{selected.smtpResponse}</pre></section>}
            {selected.bounceReason && <section className={`${card} p-4 border-red-900/40`}><h3 className="text-sm font-semibold text-red-300">Bounce / Failure</h3><p className="text-xs text-zinc-400 mt-2">{selected.bounceReason}</p></section>}
          </div>
        </aside>
      </div>}
    </div>
  );
};
