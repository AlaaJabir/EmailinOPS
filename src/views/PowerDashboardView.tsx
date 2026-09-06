import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, ChevronRight, Clock3, Eye, Gauge, Inbox, Mail, RefreshCw, Search, Server, Terminal, Timer, X, XCircle, Zap } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DashboardStats, Message, MessageEvent } from '../types';

interface Props {
  stats: DashboardStats | null;
  recentMessages: Message[];
  onSelectMessage: (message: Message) => void;
  onNavigateToSend: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}
type Live = Record<string, any>;
type Section = 'overview' | 'queues' | 'domains' | 'vmtas' | 'jobs' | 'reputation' | 'logs';
type Filter = 'ALL' | 'QUEUED' | 'SENDING' | 'DEFERRED' | 'SENT' | 'DELIVERED' | 'BOUNCED' | 'FAILED';
const card = 'bg-[#101216] border border-[#242832] rounded-lg shadow-[0_8px_30px_rgba(0,0,0,.18)]';
const n = (v: any) => Number(v || 0);
const fmt = (v: any) => Math.round(n(v)).toLocaleString();
const pct = (v: any) => `${n(v).toFixed(2)}%`;
const tm = (v?: string) => { if (!v) return '—'; const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
const dt = (v?: string) => { if (!v) return '—'; const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' }); };
const statusClass = (s?: string) => s === 'DELIVERED' ? 'text-emerald-300 bg-emerald-950/50 border-emerald-900/60' : s === 'SENT' ? 'text-sky-300 bg-sky-950/40 border-sky-900/60' : s === 'QUEUED' ? 'text-amber-300 bg-amber-950/40 border-amber-900/60' : s === 'SENDING' ? 'text-violet-300 bg-violet-950/40 border-violet-900/60' : s === 'DELIVERY_DELAYED' ? 'text-orange-300 bg-orange-950/40 border-orange-900/60' : s === 'BOUNCED' || s === 'FAILED' || s === 'REJECTED' ? 'text-red-300 bg-red-950/40 border-red-900/60' : 'text-zinc-300 bg-zinc-900/70 border-zinc-800';
const eventColor = (s?: string) => s === 'DELIVERED' ? 'text-emerald-300' : s === 'BOUNCED' || s === 'FAILED' ? 'text-red-300' : s === 'OPENED' || s === 'CLICKED' ? 'text-violet-300' : 'text-zinc-300';

export const PowerDashboardView: React.FC<Props> = ({ stats, recentMessages, onSelectMessage, onNavigateToSend, onRefresh, isLoading }) => {
  const [section, setSection] = useState<Section>('overview');
  const [live, setLive] = useState<Live>({});
  const [messages, setMessages] = useState<Message[]>(recentMessages);
  const [logs, setLogs] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [range, setRange] = useState<'1H' | '6H' | '24H'>('1H');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Message | null>(null);
  const [updated, setUpdated] = useState<string>('');

  const refresh = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE_URL || '';
      const [mr, lr, kr] = await Promise.all([
        fetch(`${base}/api/messages?limit=300`),
        fetch(`${base}/api/logs?limit=300`),
        fetch(`${base}/api/metrics?format=json`),
      ]);
      if (mr.ok) { const d = await mr.json(); setMessages(d.messages || []); }
      if (lr.ok) { const d = await lr.json(); setLogs(d.logs || []); }
      if (kr.ok) {
        const d = await kr.json();
        setLive(d);
        const now = Date.now();
        const point = { ts: now, t: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), queue: n(d.kumomta_queue_size), ready: n(d.kumomta_ready_queue_size), scheduled: n(d.kumomta_scheduled_queue_size), rate: n(d.kumomta_delivery_rate_per_second), inFlight: n(d.kumomta_messages_in_flight), connections: n(d.kumomta_smtp_connection_pool_active) };
        setHistory(old => {
          const previous = old[old.length - 1];
          // Keep one historical sample per minute. Polling remains 2s for live values.
          if (previous && now - previous.ts < 60000) return old.map((x, i) => i === old.length - 1 ? { ...x, ...point } : x);
          const next = [...old, point].filter(x => now - x.ts <= 24 * 60 * 60 * 1000);
          try { localStorage.setItem('emailops.kumo.history.v2', JSON.stringify(next)); } catch {}
          return next;
        });
      }
      setUpdated(new Date().toISOString());
    } catch (e) { console.error('[PowerDashboard] live refresh failed', e); }
  };

  useEffect(() => {
    try { const raw = localStorage.getItem('emailops.kumo.history.v2'); if (raw) setHistory(JSON.parse(raw)); } catch {}
    refresh();
    const id = window.setInterval(refresh, 2000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => { if (recentMessages.length) setMessages(recentMessages); }, [recentMessages]);

  const shown = messages.length ? messages : recentMessages;
  const eventTotal = (type: string) => shown.reduce((sum, m) => sum + (m.events?.filter(e => e.eventType === type).length || 0), 0);
  const sent = Math.max(n(stats?.totalSent), shown.filter(m => ['SENT','DELIVERED','BOUNCED'].includes(m.status)).length);
  const delivered = Math.max(n(stats?.delivered), shown.filter(m => m.status === 'DELIVERED').length, eventTotal('DELIVERED'));
  const bounced = Math.max(n(stats?.bounced), shown.filter(m => m.status === 'BOUNCED').length, eventTotal('BOUNCED'));
  const failed = Math.max(n(stats?.failed), shown.filter(m => ['FAILED','REJECTED'].includes(m.status)).length);
  const opens = Math.max(n(stats?.opens), eventTotal('OPENED'));
  const clicks = Math.max(n(stats?.clicks), eventTotal('CLICKED'));
  const queue = n(live.kumomta_queue_size);
  const ready = n(live.kumomta_ready_queue_size);
  const scheduled = n(live.kumomta_scheduled_queue_size);
  const inFlight = n(live.kumomta_messages_in_flight);
  const rate = n(live.kumomta_delivery_rate_per_second);
  const activeConnections = n(live.kumomta_smtp_connection_pool_active);
  const idleConnections = n(live.kumomta_smtp_connection_pool_idle);
  const trackedQueued = shown.filter(m => ['QUEUED','SENDING','DELIVERY_DELAYED'].includes(m.status)).length;
  const deferred = shown.filter(m => m.status === 'DELIVERY_DELAYED').length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shown.filter(m => filter === 'ALL' || (filter === 'DEFERRED' ? m.status === 'DELIVERY_DELAYED' : m.status === filter)).filter(m => !q || [m.id,m.messageId,m.toEmail,m.fromEmail,m.subject,m.providerMessageId,m.sesMessageId].some(v => String(v || '').toLowerCase().includes(q))).slice(0, 150);
  }, [shown, filter, search]);

  const domainRows = useMemo(() => {
    const map = new Map<string, any>();
    shown.forEach(m => {
      const domain = (m.toEmail?.split('@')[1] || 'unknown').toLowerCase();
      const x = map.get(domain) || { total: 0, sent: 0, delivered: 0, bounced: 0, deferred: 0, opens: 0, clicks: 0 };
      x.total++; if (m.status === 'SENT' || m.status === 'DELIVERED') x.sent++; if (m.status === 'DELIVERED') x.delivered++; if (m.status === 'BOUNCED') x.bounced++; if (m.status === 'DELIVERY_DELAYED') x.deferred++;
      x.opens += m.events?.filter(e => e.eventType === 'OPENED').length || 0; x.clicks += m.events?.filter(e => e.eventType === 'CLICKED').length || 0;
      map.set(domain, x);
    });
    return [...map.entries()].sort((a,b) => b[1].total-a[1].total).slice(0,30);
  }, [shown]);

  const latestEvent = (m: Message) => [...(m.events || [])].sort((a,b) => new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime())[0];
  const counts = (m: Message) => ({ sent: m.events?.filter(e=>e.eventType==='SENT').length||0, delivered:m.events?.filter(e=>e.eventType==='DELIVERED').length||0, opened:m.events?.filter(e=>e.eventType==='OPENED').length||0, clicked:m.events?.filter(e=>e.eventType==='CLICKED').length||0, bounced:m.events?.filter(e=>e.eventType==='BOUNCED').length||0 });
  const health = live.kumomta_live === false ? ['CRITICAL','text-red-300 bg-red-950/50 border-red-900/60'] : n(stats?.bounceRate) >= 5 || queue > 1000 ? ['DEGRADED','text-amber-300 bg-amber-950/50 border-amber-900/60'] : ['HEALTHY','text-emerald-300 bg-emerald-950/50 border-emerald-900/60'];
  const historyData = history.filter(x => Date.now()-x.ts <= (range==='1H'?3600000:range==='6H'?21600000:86400000));

  const kpis: any[] = [
    ['Sent', fmt(sent), 'messages', Mail], ['Delivered', `${fmt(delivered)} · ${pct(sent ? delivered/sent*100 : 0)}`, 'delivery rate', CheckCircle2], ['Bounced', `${fmt(bounced)} · ${pct(sent ? bounced/sent*100 : 0)}`, 'bounce rate', XCircle], ['Opens', fmt(opens), 'tracked opens', Eye], ['Clicks', fmt(clicks), 'tracked clicks', Zap],
    ['Queue', fmt(queue), `${fmt(ready)} ready · ${fmt(scheduled)} scheduled`, Inbox], ['In Flight', fmt(inFlight), 'live outbound', Server], ['Send Rate', `${rate.toFixed(2)} msg/s`, 'live throughput', Gauge], ['Connections', fmt(activeConnections), `${fmt(idleConnections)} idle pool`, Server], ['Failed', fmt(failed), 'failed / rejected', AlertTriangle],
  ];
  const nav: [Section,string][] = [['overview','Home'],['queues','Queues'],['domains','Domains'],['vmtas','Virtual MTAs'],['jobs','Jobs'],['reputation','Reputation'],['logs','Logs']];

  return <div className="min-h-full bg-[#07080b] text-zinc-100">
    <div className="sticky top-0 z-30 bg-[#0c0e12]/95 backdrop-blur border-b border-[#242832] px-4 py-2 flex items-center gap-1 overflow-x-auto">
      {nav.map(([k,l])=><button key={k} onClick={()=>setSection(k)} className={`px-4 py-2 rounded-md text-xs font-semibold whitespace-nowrap ${section===k?'bg-[#7f1d1d] text-white':'text-zinc-400 hover:bg-[#171a20] hover:text-white'}`}>{l}</button>)}
      <div className="ml-auto flex items-center gap-2 pl-3"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/><span className="text-[10px] text-emerald-400 font-bold">LIVE 2s</span></div>
    </div>

    <div className="p-4 md:p-6 max-w-[1750px] mx-auto space-y-5">
      <header className="flex flex-wrap justify-between items-center gap-3"><div><div className="flex items-center gap-3"><h1 className="text-xl font-bold">Power MTA Operations</h1><span className={`px-2 py-1 rounded border text-[10px] font-bold ${health[1]}`}>{health[0]}</span></div><p className="text-xs text-zinc-500 mt-1">KumoMTA + EmailOps · live delivery operations console</p></div><div className="flex items-center gap-2"><span className="hidden md:inline text-[10px] text-zinc-600 mr-2">Updated {tm(updated)}</span><button onClick={()=>{onRefresh();refresh();}} className="px-3 py-2 rounded-md bg-[#15181e] border border-[#2a2e38] text-xs"><RefreshCw className={`w-3.5 h-3.5 inline mr-1.5 ${isLoading?'animate-spin':''}`}/>Refresh</button><button onClick={onNavigateToSend} className="px-3 py-2 rounded-md bg-[#991b1b] hover:bg-[#b91c1c] text-xs font-bold"><Mail className="w-3.5 h-3.5 inline mr-1.5"/>Send Test</button></div></header>

      {section==='overview' && <>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">{kpis.map(([label,value,meta,Icon])=><div key={label} className={`${card} p-4`}><div className="flex justify-between text-[10px] uppercase tracking-wider text-zinc-500"><span>{label}</span><Icon className="w-4 h-4 text-zinc-600"/></div><div className="text-xl font-bold mt-3">{value}</div><div className="text-[10px] text-zinc-600 mt-1">{meta}</div></div>)}</div>

        <div className="grid xl:grid-cols-3 gap-4">
          <section className={`${card} xl:col-span-2 p-4`}><div className="flex flex-wrap justify-between items-center gap-2 mb-3"><div><h2 className="font-semibold text-sm">KumoMTA Telemetry History</h2><p className="text-[10px] text-zinc-600">Persistent browser history · live polling remains every 2 seconds</p></div><div className="flex gap-1">{(['1H','6H','24H'] as const).map(r=><button key={r} onClick={()=>setRange(r)} className={`px-2 py-1 rounded text-[10px] ${range===r?'bg-[#7f1d1d] text-white':'bg-[#0b0d10] text-zinc-500 border border-[#242832]'}`}>{r}</button>)}</div></div><div className="h-72">{historyData.length>1?<ResponsiveContainer width="100%" height="100%"><AreaChart data={historyData}><CartesianGrid stroke="#20242c"/><XAxis dataKey="t" stroke="#555" minTickGap={35}/><YAxis stroke="#555"/><Tooltip contentStyle={{background:'#0d0f13',border:'1px solid #2a2e38',color:'#fff'}}/><Area type="monotone" dataKey="queue" name="Queue" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.08}/><Area type="monotone" dataKey="rate" name="Delivery rate" stroke="#dc2626" fill="#7f1d1d" fillOpacity={0.12}/></AreaChart></ResponsiveContainer>:<div className="h-full flex items-center justify-center text-xs text-zinc-600">Collecting historical telemetry… the graph will remain after refresh.</div>}</div></section>
          <section className={`${card} p-4`}><div className="flex justify-between items-center mb-3"><h2 className="font-semibold text-sm">Queue & Delivery State</h2><span className="text-[10px] text-emerald-400">LIVE</span></div><div className="overflow-x-auto"><table className="w-full text-[11px]"><thead className="text-zinc-600 border-b border-[#242832]"><tr><th className="text-left py-2">Queue / State</th><th className="text-right py-2">Count</th><th className="text-right py-2">Source</th></tr></thead><tbody>{[['Total queue',queue,'KumoMTA'],['Ready',ready,'KumoMTA'],['Scheduled',scheduled,'KumoMTA'],['Tracked queued',trackedQueued,'Messages'],['Deferred',deferred,'Messages'],['In flight',inFlight,'KumoMTA'],['Delivered',delivered,'Events'],['Bounced',bounced,'Events']].map(([a,b,c])=><tr key={String(a)} className="border-b border-[#1c2027]"><td className="py-2 text-zinc-400">{a}</td><td className="py-2 text-right font-semibold">{fmt(b)}</td><td className="py-2 text-right text-zinc-600">{c}</td></tr>)}</tbody></table></div><div className="mt-4 pt-3 border-t border-[#242832] text-[10px] text-zinc-600">Kumo queue is authoritative for live spool depth. Application messages are shown separately so SENT/DELIVERED/BOUNCED are never hidden.</div></section>
        </div>

        <section className={card}><div className="p-4 border-b border-[#242832] flex justify-between"><div><h2 className="font-semibold text-sm">Recent Sending Activity</h2><p className="text-[10px] text-zinc-600 mt-1">Full message state and engagement trace · click a row to inspect</p></div><span className="text-[10px] text-zinc-600">{shown.length} messages</span></div><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-[#0c0e12] text-zinc-500"><tr>{['Time','Message ID','Recipient','Subject','Status','Last Event','O/C','Trace'].map(h=><th key={h} className="p-3 text-left whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{shown.slice(0,30).map(m=>{const c=counts(m);const e=latestEvent(m);return <tr key={m.id} onClick={()=>{setSelected(m);onSelectMessage(m)}} className="border-t border-[#20242c] hover:bg-[#15181e] cursor-pointer"><td className="p-3 text-zinc-400 whitespace-nowrap">{tm(m.createdAt)}</td><td className="p-3 font-mono max-w-[210px] truncate">{m.messageId}</td><td className="p-3">{m.toEmail}</td><td className="p-3 max-w-[300px] truncate">{m.subject}</td><td className="p-3"><span className={`px-2 py-1 rounded border text-[10px] font-bold ${statusClass(m.status)}`}>{m.status}</span></td><td className={`p-3 ${eventColor(e?.eventType)}`}>{e?.eventType||'QUEUED'} <span className="text-zinc-600">{tm(e?.timestamp)}</span></td><td className="p-3 text-zinc-400">{c.opened}/{c.clicked}</td><td className="p-3"><ChevronRight className="w-4 h-4 text-zinc-600"/></td></tr>})}</tbody></table>{!shown.length&&<div className="p-12 text-center text-zinc-600">No messages returned by the API.</div>}</div></section>
      </>}

      {section==='queues' && <section className={card}><div className="p-4 border-b border-[#242832]"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">Queue Operations</h2><p className="text-xs text-zinc-600 mt-1">Real KumoMTA spool telemetry + application message lifecycle</p></div><span className="text-[10px] text-emerald-400">LIVE · {tm(updated)}</span></div><div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">{[['TOTAL',queue],['READY',ready],['SCHEDULED',scheduled],['DEFERRED',deferred],['IN FLIGHT',inFlight]].map(([a,b])=><div key={String(a)} className="bg-[#0b0d10] border border-[#20242c] rounded p-3"><div className="text-[10px] text-zinc-600">{a}</div><div className="text-2xl font-bold mt-1">{fmt(b)}</div></div>)}</div></div><div className="p-4 flex flex-wrap gap-2">{(['ALL','QUEUED','SENDING','DEFERRED','SENT','DELIVERED','BOUNCED','FAILED'] as Filter[]).map(f=><button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1.5 rounded-md border text-[10px] font-semibold ${filter===f?'bg-[#7f1d1d] border-[#991b1b] text-white':'bg-[#0b0d10] border-[#242832] text-zinc-500'}`}>{f==='DEFERRED'?'DELIVERY DELAYED':f}</button>)}<div className="relative ml-auto"><Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-600"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Message / recipient / subject" className="bg-[#0b0d10] border border-[#242832] rounded-md pl-8 pr-3 py-1.5 text-[10px] w-64 outline-none"/></div></div><div className="overflow-x-auto border-t border-[#20242c]"><table className="w-full text-xs"><thead className="bg-[#0c0e12] text-zinc-500"><tr>{['Message','Recipient','Domain','State','Queued','Sent','Delivered','Last Event','SMTP / Provider','Trace'].map(h=><th key={h} className="p-3 text-left whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{filtered.map(m=>{const e=latestEvent(m);return <tr key={m.id} onClick={()=>{setSelected(m);onSelectMessage(m)}} className="border-t border-[#20242c] hover:bg-[#15181e] cursor-pointer"><td className="p-3 font-mono max-w-[190px] truncate">{m.messageId}</td><td className="p-3">{m.toEmail}</td><td className="p-3 text-zinc-500">{m.toEmail?.split('@')[1]||'—'}</td><td className="p-3"><span className={`px-2 py-1 rounded border text-[10px] font-bold ${statusClass(m.status)}`}>{m.status==='DELIVERY_DELAYED'?'DEFERRED':m.status}</span></td><td className="p-3 text-zinc-500">{dt(m.queuedAt)}</td><td className="p-3 text-zinc-500">{dt(m.sentAt)}</td><td className="p-3 text-zinc-500">{dt(m.deliveredAt)}</td><td className={`p-3 ${eventColor(e?.eventType)}`}>{e?.eventType||'—'}</td><td className="p-3 text-zinc-500 max-w-[220px] truncate">{m.smtpResponse||m.providerMessageId||'—'}</td><td className="p-3"><ChevronRight className="w-4 h-4 text-zinc-600"/></td></tr>})}</tbody></table>{!filtered.length&&<div className="p-12 text-center text-zinc-600">No messages match the selected state.</div>}</div></section>}

      {section==='domains' && <section className={card}><div className="p-4 border-b border-[#242832]"><h2 className="font-semibold">Destination Domains</h2><p className="text-xs text-zinc-600 mt-1">Data calculated from actual tracked messages</p></div><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-[#0c0e12] text-zinc-500"><tr>{['Domain','Recipients','Sent','Delivered','Delivery %','Bounced','Bounce %','Deferred','Opens','Clicks'].map(h=><th key={h} className="p-3 text-left whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{domainRows.map(([d,x])=><tr key={d} className="border-t border-[#20242c]"><td className="p-3 font-medium">{d}</td><td className="p-3">{x.total}</td><td className="p-3">{x.sent}</td><td className="p-3 text-emerald-300">{x.delivered}</td><td className="p-3">{pct(x.total?x.delivered/x.total*100:0)}</td><td className="p-3 text-red-300">{x.bounced}</td><td className="p-3">{pct(x.total?x.bounced/x.total*100:0)}</td><td className="p-3 text-amber-300">{x.deferred}</td><td className="p-3">{x.opens}</td><td className="p-3">{x.clicks}</td></tr>)}</tbody></table>{!domainRows.length&&<div className="p-12 text-center text-zinc-600">No destination-domain data yet.</div>}</div></section>}

      {section==='vmtas' && <div className="grid md:grid-cols-2 gap-4"><section className={`${card} p-5`}><h2 className="font-semibold">Virtual MTA / Connections</h2><div className="grid grid-cols-2 gap-3 mt-5">{[['Outbound active',activeConnections],['Inbound active',n(live.kumomta_smtp_connections_in)],['Idle pool',idleConnections],['Total connections',n(live.kumomta_total_connections)],['Denied',n(live.kumomta_total_connections_denied)],['In flight',inFlight]].map(([a,b])=><div key={String(a)} className="bg-[#0b0d10] border border-[#20242c] rounded p-3"><div className="text-[10px] text-zinc-600">{a}</div><div className="text-lg font-bold mt-1">{fmt(b)}</div></div>)}</div></section><section className={`${card} p-5`}><h2 className="font-semibold">Operational Signals</h2><div className="mt-4 space-y-3 text-xs">{[['Kumo telemetry',live.kumomta_live?'CONNECTED':'OFFLINE'],['Queue depth',fmt(queue)],['CPU',`${n(live.kumomta_cpu_usage_percent).toFixed(1)}%`],['Memory',fmt(live.kumomta_memory_usage_bytes)],['Metrics latency',`${fmt(live.kumomta_metrics_latency_ms)} ms`],['PTR / rDNS','Integration required'],['RBL monitoring','Integration required']].map(([a,b])=><div key={String(a)} className="flex justify-between border-b border-[#20242c] pb-2"><span className="text-zinc-500">{a}</span><span>{String(b)}</span></div>)}</div></section></div>}

      {section==='jobs' && <section className={card}><div className="p-4 border-b border-[#242832]"><h2 className="font-semibold">Jobs / Campaigns</h2></div>{(stats?.topCampaigns||[]).map((c:any)=><div key={c.id} className="p-4 border-b border-[#20242c] flex flex-wrap gap-5 justify-between text-xs"><b>{c.name}</b><span>Sent {fmt(c.sent)}</span><span>Delivered {fmt(c.delivered)}</span><span>Open {pct(c.openRate)}</span><span>Click {pct(c.clickRate)}</span></div>)}{!(stats?.topCampaigns||[]).length&&<div className="p-12 text-center text-zinc-600">No campaign data available.</div>}</section>}

      {section==='reputation' && <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">{[['Delivery rate',pct(sent?delivered/sent*100:0)],['Bounce rate',pct(sent?bounced/sent*100:0)],['Complaint rate',sent?pct(n(stats?.complaints)/sent*100):'0.00%'],['Kumo health',String(stats?.kumoHealth||'unknown').toUpperCase()]].map(([a,b])=><div key={String(a)} className={`${card} p-5`}><div className="text-xs text-zinc-500">{a}</div><div className="text-2xl font-bold mt-3">{b}</div></div>)}</div>}

      {section==='logs' && <section className={card}><div className="p-4 border-b border-[#242832] flex justify-between"><div><h2 className="font-semibold">Live Technical Logs</h2><p className="text-[10px] text-zinc-600 mt-1">Webhook, KumoMTA, tracking and application activity</p></div><span className="text-[10px] text-zinc-600">{logs.length} loaded</span></div><div className="divide-y divide-[#20242c]">{logs.slice(0,200).map((l:any)=><div key={l.id} className="p-3 grid grid-cols-1 md:grid-cols-6 gap-2 text-xs"><span className="text-zinc-500">{tm(l.timestamp)}</span><span>{l.service||'Application'}</span><span className="font-semibold">{l.event}</span><span className={l.severity==='ERROR'?'text-red-400':l.severity==='WARN'?'text-amber-400':'text-emerald-400'}>{l.severity}</span><span className="font-mono text-zinc-500 truncate">{l.messageId||'—'}</span><span className="text-zinc-400 truncate">{l.response||''}</span></div>)}{!logs.length&&<div className="p-12 text-center text-zinc-600">No technical logs returned by the API.</div>}</div></section>}

      <div className="text-[10px] text-zinc-600 flex justify-between"><span><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"/>Live API polling every 2 seconds · telemetry history retained for 24h in browser storage</span><span>Power MTA Operations</span></div>
    </div>

    {selected && <div className="fixed inset-0 z-50 bg-black/70 flex justify-end" onClick={()=>setSelected(null)}><aside className="w-full max-w-2xl h-full bg-[#0b0d10] border-l border-[#2a2e38] overflow-y-auto" onClick={e=>e.stopPropagation()}><div className="sticky top-0 z-10 bg-[#0c0e12]/95 backdrop-blur border-b border-[#242832] p-4 flex items-center justify-between"><div><div className="text-[10px] text-zinc-600 uppercase">Message Inspector</div><div className="font-mono text-sm mt-1 max-w-[430px] truncate">{selected.messageId}</div></div><button onClick={()=>setSelected(null)} className="p-2 hover:bg-[#171a20] rounded"><X className="w-4 h-4"/></button></div><div className="p-5 space-y-5"><div className="flex justify-between"><div><div className="text-[10px] text-zinc-600">CURRENT STATE</div><span className={`inline-block mt-2 px-3 py-1.5 rounded border text-xs font-bold ${statusClass(selected.status)}`}>{selected.status}</span></div><div className="text-right"><div className="text-[10px] text-zinc-600">PROVIDER</div><div className="text-xs mt-2">{selected.provider}</div></div></div><div className="grid grid-cols-2 gap-3">{[['From',selected.fromEmail],['To',selected.toEmail],['Subject',selected.subject],['Campaign',selected.campaignName||selected.campaignId||'—'],['Queued',dt(selected.queuedAt)],['Sent',dt(selected.sentAt)],['Delivered',dt(selected.deliveredAt)],['Bounced',dt(selected.bouncedAt)],['SES ID',selected.sesMessageId||'—'],['Provider ID',selected.providerMessageId||'—']].map(([a,b])=><div key={String(a)} className="bg-[#101216] border border-[#20242c] rounded p-3"><div className="text-[10px] text-zinc-600">{a}</div><div className="text-xs mt-1 break-words">{String(b)}</div></div>)}</div><section className={`${card} p-4`}><div className="flex justify-between"><h3 className="font-semibold text-sm">Complete Event Timeline</h3><span className="text-[10px] text-zinc-600">{selected.events?.length||0} events</span></div><div className="mt-4 space-y-3">{[...(selected.events||[])].sort((a,b)=>new Date(a.timestamp).getTime()-new Date(b.timestamp).getTime()).map((e:MessageEvent,i)=><div key={e.id||`${e.timestamp}-${i}`} className="border-l-2 border-[#2a2e38] pl-3"><div className={`text-xs font-semibold ${eventColor(e.eventType)}`}>{e.eventType}</div><div className="text-[10px] text-zinc-600 mt-1">{dt(e.timestamp)}</div>{e.eventData&&<pre className="mt-2 bg-[#07080b] border border-[#20242c] rounded p-2 text-[9px] text-zinc-500 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(e.eventData,null,2)}</pre>}</div>)}{!(selected.events||[]).length&&<div className="py-8 text-center text-zinc-600">No events recorded for this message.</div>}</div></section><section className={`${card} p-4`}><h3 className="font-semibold text-sm">Engagement</h3><div className="grid grid-cols-5 gap-2 mt-3">{Object.entries(counts(selected)).map(([a,b])=><div key={a} className="bg-[#0b0d10] border border-[#20242c] rounded p-3 text-center"><div className="text-[10px] text-zinc-600 uppercase">{a}</div><div className="font-bold mt-1">{b}</div></div>)}</div></section>{selected.smtpResponse&&<section className={`${card} p-4`}><h3 className="font-semibold text-sm flex items-center gap-2"><Terminal className="w-4 h-4"/>SMTP Response</h3><pre className="mt-3 text-[10px] text-zinc-400 bg-[#07080b] border border-[#20242c] rounded p-3 whitespace-pre-wrap break-all">{selected.smtpResponse}</pre></section>}{selected.bounceReason&&<section className={`${card} p-4 border-red-900/50`}><h3 className="text-sm font-semibold text-red-300">Bounce / Failure</h3><p className="text-xs text-zinc-400 mt-2">{selected.bounceReason}</p></section>}</div></aside></div>}
  </div>;
};
