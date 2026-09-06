import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, BarChart3, CheckCircle2, Clock3, Eye, Gauge, Inbox, Mail,
  Megaphone, MousePointerClick, RefreshCw, Server, ShieldAlert, Terminal, Users, XCircle, Zap
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DashboardStats, Message, ServiceLog } from '../types';

interface Props {
  stats: DashboardStats | null;
  recentMessages: Message[];
  onSelectMessage: (message: Message) => void;
  onNavigateToSend: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  authFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  logs?: ServiceLog[];
}

type Live = Record<string, any>;
const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
const fmt = (v: unknown) => Math.round(num(v)).toLocaleString();
const pct = (a: number, b: number) => b > 0 ? `${((a / b) * 100).toFixed(2)}%` : '0.00%';
const time = (v?: string) => v ? new Date(v).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' }) : '—';
const statusClass = (s?: string) => s === 'DELIVERED' || s === 'SUCCESS' ? 'text-emerald-300 bg-emerald-950/40 border-emerald-900/60' : s === 'SENT' || s === 'INFO' ? 'text-sky-300 bg-sky-950/40 border-sky-900/60' : s === 'QUEUED' || s === 'SENDING' || s === 'DELIVERY_DELAYED' || s === 'WARN' ? 'text-amber-300 bg-amber-950/40 border-amber-900/60' : 'text-red-300 bg-red-950/40 border-red-900/60';

const Card: React.FC<{ label: string; value: React.ReactNode; meta?: string; icon: React.ElementType; onClick?: () => void }> = ({ label, value, meta, icon: Icon, onClick }) => (
  <button onClick={onClick} disabled={!onClick} className={`text-left w-full bg-[#101216] border border-[#242832] rounded-lg p-4 ${onClick ? 'hover:bg-[#15181e] hover:border-[#343a46] transition-colors cursor-pointer' : 'cursor-default'}`}>
    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500"><span>{label}</span><Icon className="w-4 h-4 text-zinc-600" /></div>
    <div className="text-xl font-bold mt-3 text-zinc-100">{value}</div>
    {meta && <div className="text-[10px] text-zinc-600 mt-1">{meta}</div>}
  </button>
);

export const PowerDashboardView: React.FC<Props> = ({ stats, recentMessages, onSelectMessage, onNavigateToSend, onRefresh, isLoading, authFetch, logs = [] }) => {
  const [live, setLive] = useState<Live>({});
  const [messages, setMessages] = useState<Message[]>(recentMessages);
  const [history, setHistory] = useState<Array<{ ts:number; label:string; queue:number; rate:number; inflight:number }>>([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loadingLive, setLoadingLive] = useState(false);
  const [mode, setMode] = useState<'overview' | 'operations' | 'marketing'>('overview');

  const request = useCallback((url: string) => authFetch ? authFetch(url) : fetch((import.meta.env.VITE_API_BASE_URL || '') + url), [authFetch]);
  const refreshLive = useCallback(async () => {
    setLoadingLive(true);
    try {
      const [metricRes, messageRes] = await Promise.all([request('/api/metrics?format=json'), request('/api/messages?limit=50')]);
      if (metricRes.ok) {
        const d = await metricRes.json();
        setLive(d);
        const now = Date.now();
        const point = { ts: now, label: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), queue: num(d.kumomta_queue_size), rate: num(d.kumomta_delivery_rate_per_second), inflight: num(d.kumomta_messages_in_flight) };
        setHistory(prev => { const last = prev[prev.length - 1]; const next = last && now - last.ts < 30000 ? [...prev.slice(0, -1), point] : [...prev, point]; return next.slice(-120); });
        setUpdatedAt(new Date().toISOString());
      }
      if (messageRes.ok) { const d = await messageRes.json(); setMessages(d.messages || []); }
    } catch (e) { console.error('[Dashboard] live refresh failed', e); }
    finally { setLoadingLive(false); }
  }, [request]);

  useEffect(() => { refreshLive(); const id = window.setInterval(refreshLive, 3000); return () => window.clearInterval(id); }, [refreshLive]);
  useEffect(() => { setMessages(recentMessages); }, [recentMessages]);

  const sent = num(stats?.totalSent), delivered = num(stats?.delivered), bounced = num(stats?.bounced), failed = num(stats?.failed);
  const complaints = num(stats?.complaints), rejected = num(stats?.rejected), delayed = num(stats?.deliveryDelayed), renderingFailed = num(stats?.renderingFailed);
  const opens = num(stats?.opens), clicks = num(stats?.clicks), queued = num(stats?.queued);
  const queue = num(live.kumomta_queue_size), ready = num(live.kumomta_ready_queue_size), scheduled = num(live.kumomta_scheduled_queue_size);
  const inflight = num(live.kumomta_messages_in_flight), rate = num(live.kumomta_delivery_rate_per_second);
  const inbound = num(live.kumomta_smtp_connections_in), outbound = num(live.kumomta_smtp_connections_out);
  const deferred = num(live.kumomta_messages_deferred), kumoSent = num(live.kumomta_messages_sent_total);
  const liveHealthy = live.kumomta_live !== false;
  const chart = useMemo(() => history.slice(-40), [history]);
  const uniqueOpenEstimate = Math.min(opens, new Set(messages.flatMap(m => (m.events || []).filter(e => e.eventType === 'OPENED').map(e => e.messageId))).size || opens);
  const uniqueClickEstimate = Math.min(clicks, new Set(messages.flatMap(m => (m.events || []).filter(e => e.eventType === 'CLICKED').map(e => e.messageId))).size || clicks);

  return <div className="min-h-full bg-[#07080b] text-zinc-100 p-4 md:p-6">
    <div className="max-w-[1750px] mx-auto space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><div className="flex items-center gap-3"><h1 className="text-2xl font-bold tracking-tight">Email Operations</h1><span className={`px-2 py-1 rounded border text-[10px] font-bold ${liveHealthy ? 'text-emerald-300 bg-emerald-950/50 border-emerald-900/60' : 'text-red-300 bg-red-950/50 border-red-900/60'}`}>{liveHealthy ? 'KUMOMTA LIVE' : 'KUMOMTA OFFLINE'}</span></div><p className="text-xs text-zinc-500 mt-1">Unified MTA operations, delivery, marketing and compliance console</p></div>
        <div className="flex items-center gap-2"><span className="text-[10px] text-zinc-600 hidden md:block">Updated {time(updatedAt)}</span><button onClick={() => { onRefresh(); refreshLive(); }} className="px-3 py-2 rounded-md border border-[#282d36] bg-[#12151a] text-xs hover:bg-[#191d24]"><RefreshCw className={`w-3.5 h-3.5 inline mr-1.5 ${isLoading || loadingLive ? 'animate-spin' : ''}`} />Refresh</button><button onClick={onNavigateToSend} className="px-3 py-2 rounded-md bg-white text-black text-xs font-bold hover:bg-zinc-200"><Mail className="w-3.5 h-3.5 inline mr-1.5" />Compose</button></div>
      </header>

      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0d0f13] border border-[#242832] rounded-lg w-fit"><button onClick={() => setMode('overview')} className={`px-4 py-2 rounded-md text-xs font-semibold ${mode === 'overview' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}>Overview</button><button onClick={() => setMode('operations')} className={`px-4 py-2 rounded-md text-xs font-semibold ${mode === 'operations' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}>Operations</button><button onClick={() => setMode('marketing')} className={`px-4 py-2 rounded-md text-xs font-semibold ${mode === 'marketing' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}>Marketing</button></div>

      {mode !== 'marketing' && <>
        <section><div className="flex items-center justify-between mb-3"><div><h2 className="text-sm font-semibold">Delivery Overview</h2><p className="text-[10px] text-zinc-600">Application-level message outcomes from the authenticated account</p></div></div><div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Card label="Sent" value={fmt(sent)} meta={`${fmt(kumoSent || sent)} KumoMTA total`} icon={Mail}/>
          <Card label="Delivered" value={fmt(delivered)} meta={`${pct(delivered, sent)} delivery rate`} icon={CheckCircle2}/>
          <Card label="Bounced" value={fmt(bounced)} meta={`${pct(bounced, sent)} bounce rate`} icon={XCircle}/>
          <Card label="Failed" value={fmt(failed)} meta={`${fmt(rejected)} rejected`} icon={AlertTriangle}/>
          <Card label="Deferred" value={fmt(delayed + deferred)} meta="delayed / deferred" icon={Clock3}/>
          <Card label="Complaints" value={fmt(complaints)} meta={`${pct(complaints, sent)} complaint rate`} icon={ShieldAlert}/>
        </div></section>

        <section><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card label="Opens" value={fmt(opens)} meta={`${fmt(uniqueOpenEstimate)} unique in loaded messages`} icon={Eye}/>
          <Card label="Clicks" value={fmt(clicks)} meta={`${fmt(uniqueClickEstimate)} unique in loaded messages`} icon={MousePointerClick}/>
          <Card label="Open Rate" value={`${num(stats?.openRate).toFixed(2)}%`} meta="tracked opens / delivered" icon={Eye}/>
          <Card label="Click Rate" value={`${num(stats?.clickRate).toFixed(2)}%`} meta="tracked clicks / delivered" icon={Zap}/>
        </div></section>
      </>}

      {mode !== 'marketing' && <section className="grid xl:grid-cols-3 gap-4"><div className="xl:col-span-2 bg-[#101216] border border-[#242832] rounded-lg p-4"><div className="flex justify-between items-center mb-4"><div><h2 className="text-sm font-semibold">Live Queue & Throughput</h2><p className="text-[10px] text-zinc-600">Direct KumoMTA telemetry sampled every 3 seconds</p></div><span className="text-[10px] text-emerald-400">LIVE</span></div><div className="h-72">{chart.length > 1 ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><CartesianGrid stroke="#20242c"/><XAxis dataKey="label" stroke="#555" minTickGap={30}/><YAxis stroke="#555"/><Tooltip contentStyle={{background:'#0d0f13',border:'1px solid #2a2e38',color:'#fff'}}/><Area type="monotone" dataKey="queue" name="Queue" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.08}/><Area type="monotone" dataKey="rate" name="msg/s" stroke="#ef4444" fill="#ef4444" fillOpacity={0.06}/><Area type="monotone" dataKey="inflight" name="In flight" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.04}/></AreaChart></ResponsiveContainer> : <div className="h-full flex items-center justify-center text-xs text-zinc-600">Collecting live samples…</div>}</div></div><div className="bg-[#101216] border border-[#242832] rounded-lg p-4"><h2 className="text-sm font-semibold">MTA Runtime</h2><p className="text-[10px] text-zinc-600 mt-1 mb-4">Queue, SMTP and host telemetry</p><div className="space-y-2 text-xs">{[['Queue',queue],['Ready',ready],['Scheduled',scheduled],['In Flight',inflight],['Throughput',`${rate.toFixed(3)} msg/s`],['Inbound SMTP',inbound],['Outbound SMTP',outbound],['CPU',`${num(live.kumomta_cpu_usage_percent).toFixed(1)}%`],['Memory',live.kumomta_memory_usage_bytes ? `${(num(live.kumomta_memory_usage_bytes)/1024/1024).toFixed(1)} MB` : '—'],['Disk Free',live.kumomta_disk_free_bytes ? `${(num(live.kumomta_disk_free_bytes)/1024/1024/1024).toFixed(1)} GB` : '—']].map(([k,v])=><div key={String(k)} className="flex justify-between border-b border-[#1d2027] pb-2"><span className="text-zinc-500">{k}</span><span className="font-mono text-zinc-200">{String(v)}</span></div>)}</div></div></section>}

      {mode === 'operations' && <>
        <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-3"><Card label="Queued" value={fmt(queued)} meta="application queue state" icon={Inbox}/><Card label="Rendering Failed" value={fmt(renderingFailed)} meta="template/rendering errors" icon={AlertTriangle}/><Card label="KumoMTA Sent" value={fmt(kumoSent)} meta="MTA cumulative counter" icon={Server}/><Card label="Connections" value={`${fmt(inbound)} / ${fmt(outbound)}`} meta="inbound / outbound SMTP" icon={Activity}/></section>
        <section className="grid xl:grid-cols-2 gap-4"><div className="bg-[#101216] border border-[#242832] rounded-lg p-4"><div className="flex items-center gap-2 mb-3"><Terminal className="w-4 h-4 text-zinc-500"/><h2 className="text-sm font-semibold">Technical Logs</h2></div>{logs.length === 0 ? <div className="py-8 text-center text-xs text-zinc-600">No technical logs returned for this account.</div> : <div className="space-y-1 max-h-80 overflow-auto">{logs.slice(0,15).map(log => <div key={log.id} className="flex gap-3 items-start border-b border-[#1d2027] py-2"><span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${statusClass(log.severity)}`}>{log.severity}</span><div className="min-w-0 flex-1"><div className="text-xs text-zinc-300 truncate">{log.event}</div><div className="text-[10px] text-zinc-600 truncate">{log.service} · {log.response}</div></div><span className="text-[9px] text-zinc-700 shrink-0">{time(log.timestamp)}</span></div>)}</div>}</div><div className="bg-[#101216] border border-[#242832] rounded-lg p-4"><h2 className="text-sm font-semibold mb-3">Delivery Health</h2><div className="grid grid-cols-2 gap-3"><div className="rounded-md border border-[#242832] p-3"><div className="text-[10px] text-zinc-500">Delivery</div><div className="text-lg font-bold mt-1">{pct(delivered,sent)}</div></div><div className="rounded-md border border-[#242832] p-3"><div className="text-[10px] text-zinc-500">Bounce</div><div className="text-lg font-bold mt-1">{pct(bounced,sent)}</div></div><div className="rounded-md border border-[#242832] p-3"><div className="text-[10px] text-zinc-500">Reject</div><div className="text-lg font-bold mt-1">{pct(rejected,sent)}</div></div><div className="rounded-md border border-[#242832] p-3"><div className="text-[10px] text-zinc-500">Complaint</div><div className="text-lg font-bold mt-1">{pct(complaints,sent)}</div></div></div></div></section>
      </>}

      {mode === 'marketing' && <>
        <section><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Card label="Campaigns" value={fmt(stats?.topCampaigns?.length)} meta="campaigns with recorded sends" icon={Megaphone}/><Card label="Audience" value="—" meta="open Contacts section for live audience" icon={Users}/><Card label="Unique Opens" value={fmt(uniqueOpenEstimate)} meta="unique message IDs in loaded data" icon={Eye}/><Card label="Unique Clicks" value={fmt(uniqueClickEstimate)} meta="unique message IDs in loaded data" icon={MousePointerClick}/></div></section>
        <section className="grid xl:grid-cols-2 gap-4"><div className="bg-[#101216] border border-[#242832] rounded-lg p-4"><div className="flex items-center gap-2 mb-4"><Megaphone className="w-4 h-4 text-zinc-500"/><h2 className="text-sm font-semibold">Campaign Performance</h2></div>{(stats?.topCampaigns || []).length === 0 ? <div className="py-8 text-center text-xs text-zinc-600">No campaign delivery data yet.</div> : <div className="overflow-auto"><table className="w-full text-xs"><thead className="text-[10px] uppercase text-zinc-600"><tr><th className="text-left pb-2">Campaign</th><th className="text-right pb-2">Sent</th><th className="text-right pb-2">Delivered</th><th className="text-right pb-2">Open</th><th className="text-right pb-2">Click</th></tr></thead><tbody>{stats!.topCampaigns.map(c=><tr key={c.id} className="border-t border-[#1d2027]"><td className="py-2 pr-2 truncate max-w-[220px]">{c.name}</td><td className="py-2 text-right">{fmt(c.sent)}</td><td className="py-2 text-right">{fmt(c.delivered)}</td><td className="py-2 text-right">{c.openRate.toFixed(2)}%</td><td className="py-2 text-right">{c.clickRate.toFixed(2)}%</td></tr>)}</tbody></table></div>}</div><div className="bg-[#101216] border border-[#242832] rounded-lg p-4"><div className="flex items-center gap-2 mb-4"><Server className="w-4 h-4 text-zinc-500"/><h2 className="text-sm font-semibold">Top Senders</h2></div>{(stats?.topSenders || []).length === 0 ? <div className="py-8 text-center text-xs text-zinc-600">No sender delivery data yet.</div> : <div className="space-y-2">{stats!.topSenders.map(s=><div key={s.id} className="flex items-center justify-between border-b border-[#1d2027] pb-2"><div className="min-w-0"><div className="text-xs truncate">{s.name}</div><div className="text-[10px] text-zinc-600 truncate">{s.email}</div></div><div className="text-right text-[10px]"><div>{fmt(s.volume)} sent</div><div className="text-zinc-500">{s.deliveryRate.toFixed(2)}% delivery · {s.bounceRate.toFixed(2)}% bounce</div></div></div>)}</div>}</div></section>
        <section className="grid xl:grid-cols-2 gap-4"><div className="bg-[#101216] border border-[#242832] rounded-lg p-4"><h2 className="text-sm font-semibold mb-1">7-Day Activity</h2><p className="text-[10px] text-zinc-600 mb-3">Actual application message volume</p><div className="h-64">{(stats?.timeseries || []).length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={stats!.timeseries}><CartesianGrid stroke="#20242c"/><XAxis dataKey="time" stroke="#555"/><YAxis stroke="#555"/><Tooltip contentStyle={{background:'#0d0f13',border:'1px solid #2a2e38',color:'#fff'}}/><Bar dataKey="sent" name="Sent" fill="#94a3b8"/><Bar dataKey="delivered" name="Delivered" fill="#4ade80"/><Bar dataKey="bounced" name="Bounced" fill="#f87171"/></BarChart></ResponsiveContainer> : <div className="h-full flex items-center justify-center text-xs text-zinc-600">No activity data yet.</div>}</div></div><div className="bg-[#101216] border border-[#242832] rounded-lg p-4"><h2 className="text-sm font-semibold mb-1">24-Hour Sending Activity</h2><p className="text-[10px] text-zinc-600 mb-3">Actual message volume by 2-hour bucket</p><div className="h-64">{(stats?.hourlyActivity || []).length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={stats!.hourlyActivity}><CartesianGrid stroke="#20242c"/><XAxis dataKey="hour" stroke="#555"/><YAxis stroke="#555"/><Tooltip contentStyle={{background:'#0d0f13',border:'1px solid #2a2e38',color:'#fff'}}/><Bar dataKey="volume" name="Volume" fill="#60a5fa"/></BarChart></ResponsiveContainer> : <div className="h-full flex items-center justify-center text-xs text-zinc-600">No recent sending activity.</div>}</div></div></section>
      </>}

      {mode === 'overview' && <section className="grid xl:grid-cols-2 gap-4"><div className="bg-[#101216] border border-[#242832] rounded-lg p-4"><h2 className="text-sm font-semibold mb-3">7-Day Delivery Trend</h2><div className="h-64">{(stats?.timeseries || []).length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={stats!.timeseries}><CartesianGrid stroke="#20242c"/><XAxis dataKey="time" stroke="#555"/><YAxis stroke="#555"/><Tooltip contentStyle={{background:'#0d0f13',border:'1px solid #2a2e38',color:'#fff'}}/><Area type="monotone" dataKey="sent" name="Sent" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.08}/><Area type="monotone" dataKey="delivered" name="Delivered" stroke="#4ade80" fill="#4ade80" fillOpacity={0.06}/><Area type="monotone" dataKey="bounced" name="Bounced" stroke="#f87171" fill="#f87171" fillOpacity={0.05}/></AreaChart></ResponsiveContainer> : <div className="h-full flex items-center justify-center text-xs text-zinc-600">No delivery history yet.</div>}</div></div><div className="bg-[#101216] border border-[#242832] rounded-lg p-4"><h2 className="text-sm font-semibold mb-3">Latest Messages</h2>{messages.length === 0 ? <div className="py-8 text-center text-xs text-zinc-600">No messages found in the current account.</div> : <div className="space-y-1">{messages.slice(0,10).map(m=><button key={m.id} onClick={() => onSelectMessage(m)} className="w-full text-left flex items-center gap-3 border-b border-[#1d2027] py-2 hover:bg-[#14171c] rounded"><span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${statusClass(m.status)}`}>{m.status}</span><div className="min-w-0 flex-1"><div className="text-xs truncate">{m.subject || '—'}</div><div className="text-[10px] text-zinc-600 truncate">{m.toEmail}</div></div><span className="text-[9px] text-zinc-700 shrink-0">{time(m.updatedAt || m.createdAt)}</span></button>)}</div>}</div></section>}

      {mode !== 'operations' && <section className="bg-[#101216] border border-[#242832] rounded-lg overflow-hidden"><div className="p-4 border-b border-[#242832] flex items-center justify-between"><div><h2 className="text-sm font-semibold">Recent Messages</h2><p className="text-[10px] text-zinc-600">Latest records from the authenticated Messages API</p></div><span className="text-[10px] text-zinc-600">{messages.length} loaded</span></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[#0c0e12] text-[10px] uppercase tracking-wider text-zinc-600"><tr><th className="px-4 py-3">Recipient</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Provider ID</th><th className="px-4 py-3">Updated</th></tr></thead><tbody>{messages.slice(0,12).map(m=><tr key={m.id} onClick={() => onSelectMessage(m)} className="border-t border-[#1d2027] hover:bg-[#14171c] cursor-pointer"><td className="px-4 py-3 text-zinc-200">{m.toEmail || '—'}</td><td className="px-4 py-3 max-w-[360px] truncate text-zinc-400">{m.subject || '—'}</td><td className="px-4 py-3"><span className={`px-2 py-1 rounded border text-[10px] font-semibold ${statusClass(m.status)}`}>{m.status}</span></td><td className="px-4 py-3 font-mono text-[10px] text-zinc-600">{m.providerMessageId || m.sesMessageId || m.messageId || '—'}</td><td className="px-4 py-3 text-zinc-600">{time(m.updatedAt || m.createdAt)}</td></tr>)}</tbody></table></div></section>}
    </div>
  </div>;
};
