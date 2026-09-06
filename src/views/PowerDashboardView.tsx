import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Eye, Gauge, Inbox, Mail, RefreshCw, Server, XCircle, Zap } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DashboardStats, Message } from '../types';

interface Props {
  stats: DashboardStats | null;
  recentMessages: Message[];
  onSelectMessage: (message: Message) => void;
  onNavigateToSend: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  authFetch?: (url: string, options?: RequestInit) => Promise<Response>;
}

type Live = Record<string, any>;
const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
const fmt = (v: unknown) => Math.round(num(v)).toLocaleString();
const pct = (a: number, b: number) => b > 0 ? `${((a / b) * 100).toFixed(2)}%` : '0.00%';
const time = (v?: string) => v ? new Date(v).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' }) : '—';
const badge = (s?: string) => s === 'DELIVERED' ? 'text-emerald-300 bg-emerald-950/50 border-emerald-900/60' : s === 'SENT' ? 'text-sky-300 bg-sky-950/50 border-sky-900/60' : s === 'QUEUED' || s === 'SENDING' || s === 'DELIVERY_DELAYED' ? 'text-amber-300 bg-amber-950/50 border-amber-900/60' : s === 'BOUNCED' || s === 'FAILED' || s === 'REJECTED' ? 'text-red-300 bg-red-950/50 border-red-900/60' : 'text-zinc-300 bg-zinc-900 border-zinc-800';

export const PowerDashboardView: React.FC<Props> = ({ stats, recentMessages, onSelectMessage, onNavigateToSend, onRefresh, isLoading, authFetch }) => {
  const [live, setLive] = useState<Live>({});
  const [messages, setMessages] = useState<Message[]>(recentMessages);
  const [history, setHistory] = useState<Array<{ ts:number; label:string; queue:number; rate:number; inflight:number }>>([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loadingLive, setLoadingLive] = useState(false);
  const request = useCallback((url: string) => {
    if (authFetch) return authFetch(url);
    const base = import.meta.env.VITE_API_BASE_URL || '';
    return fetch(base + url);
  }, [authFetch]);

  const refreshLive = useCallback(async () => {
    setLoadingLive(true);
    try {
      const [metricRes, messageRes] = await Promise.all([request('/api/metrics?format=json'), request('/api/messages?limit=50')]);
      if (metricRes.ok) {
        const d = await metricRes.json();
        setLive(d);
        const now = Date.now();
        const point = { ts: now, label: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), queue: num(d.kumomta_queue_size), rate: num(d.kumomta_delivery_rate_per_second), inflight: num(d.kumomta_messages_in_flight) };
        setHistory(prev => {
          const last = prev[prev.length - 1];
          const next = last && now - last.ts < 30000 ? [...prev.slice(0, -1), point] : [...prev, point];
          return next.slice(-120);
        });
        setUpdatedAt(new Date().toISOString());
      }
      if (messageRes.ok) { const d = await messageRes.json(); setMessages(d.messages || []); }
    } catch (e) { console.error('[Dashboard] live refresh failed', e); }
    finally { setLoadingLive(false); }
  }, [request]);

  useEffect(() => { refreshLive(); const id = window.setInterval(refreshLive, 3000); return () => window.clearInterval(id); }, [refreshLive]);
  useEffect(() => { setMessages(recentMessages); }, [recentMessages]);

  const sent = num(stats?.totalSent);
  const delivered = num(stats?.delivered);
  const bounced = num(stats?.bounced);
  const failed = num(stats?.failed);
  const opens = num(stats?.opens);
  const clicks = num(stats?.clicks);
  const queue = num(live.kumomta_queue_size);
  const ready = num(live.kumomta_ready_queue_size);
  const scheduled = num(live.kumomta_scheduled_queue_size);
  const inflight = num(live.kumomta_messages_in_flight);
  const rate = num(live.kumomta_delivery_rate_per_second);
  const inbound = num(live.kumomta_smtp_connections_in);
  const outbound = num(live.kumomta_smtp_connections_out);
  const liveHealthy = live.kumomta_live !== false;
  const chart = useMemo(() => history.slice(-40), [history]);

  const cards = [
    ['Sent', fmt(sent), 'application total', Mail],
    ['Delivered', fmt(delivered), `${pct(delivered, sent)} delivery`, CheckCircle2],
    ['Bounced', fmt(bounced), `${pct(bounced, sent)} bounce`, XCircle],
    ['Failed', fmt(failed), 'failed / rejected', AlertTriangle],
    ['Opens', fmt(opens), 'tracked events', Eye],
    ['Clicks', fmt(clicks), 'tracked events', Zap],
    ['Queue', fmt(queue), `${fmt(ready)} ready · ${fmt(scheduled)} scheduled`, Inbox],
    ['Throughput', `${rate.toFixed(2)} /s`, 'KumoMTA live', Gauge],
    ['In Flight', fmt(inflight), 'outbound messages', Activity],
    ['Connections', `${fmt(inbound)} / ${fmt(outbound)}`, 'inbound / outbound', Server],
  ];

  return <div className="min-h-full bg-[#07080b] text-zinc-100 p-4 md:p-6">
    <div className="max-w-[1750px] mx-auto space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3"><h1 className="text-2xl font-bold tracking-tight">Email Operations</h1><span className={`px-2 py-1 rounded border text-[10px] font-bold ${liveHealthy ? 'text-emerald-300 bg-emerald-950/50 border-emerald-900/60' : 'text-red-300 bg-red-950/50 border-red-900/60'}`}>{liveHealthy ? 'KUMOMTA LIVE' : 'KUMOMTA OFFLINE'}</span></div>
          <p className="text-xs text-zinc-500 mt-1">Production delivery console · authenticated telemetry · no synthetic dashboard values</p>
        </div>
        <div className="flex items-center gap-2"><span className="text-[10px] text-zinc-600 hidden md:block">Updated {time(updatedAt)}</span><button onClick={() => { onRefresh(); refreshLive(); }} className="px-3 py-2 rounded-md border border-[#282d36] bg-[#12151a] text-xs hover:bg-[#191d24]"><RefreshCw className={`w-3.5 h-3.5 inline mr-1.5 ${isLoading || loadingLive ? 'animate-spin' : ''}`} />Refresh</button><button onClick={onNavigateToSend} className="px-3 py-2 rounded-md bg-white text-black text-xs font-bold hover:bg-zinc-200"><Mail className="w-3.5 h-3.5 inline mr-1.5" />Compose</button></div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">{cards.map(([label,value,meta,Icon]) => <div key={String(label)} className="bg-[#101216] border border-[#242832] rounded-lg p-4"><div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-zinc-500"><span>{label}</span><Icon className="w-4 h-4 text-zinc-600" /></div><div className="text-xl font-bold mt-3">{String(value)}</div><div className="text-[10px] text-zinc-600 mt-1">{String(meta)}</div></div>)}</div>

      {!liveHealthy && <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-xs text-red-200">KumoMTA telemetry is unavailable. Values above that come from application statistics are shown as stored; no fake KumoMTA queue values are substituted.</div>}

      <div className="grid xl:grid-cols-3 gap-4">
        <section className="xl:col-span-2 bg-[#101216] border border-[#242832] rounded-lg p-4">
          <div className="flex justify-between items-center mb-4"><div><h2 className="text-sm font-semibold">Live Delivery Telemetry</h2><p className="text-[10px] text-zinc-600">Queue and delivery throughput sampled from KumoMTA</p></div><span className="text-[10px] text-emerald-400">3s polling</span></div>
          <div className="h-72">{chart.length > 1 ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><CartesianGrid stroke="#20242c" /><XAxis dataKey="label" stroke="#555" minTickGap={30} /><YAxis stroke="#555" /><Tooltip contentStyle={{ background: '#0d0f13', border: '1px solid #2a2e38', color: '#fff' }} /><Area type="monotone" dataKey="queue" name="Queue" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.08} /><Area type="monotone" dataKey="rate" name="msg/s" stroke="#ef4444" fill="#ef4444" fillOpacity={0.06} /></AreaChart></ResponsiveContainer> : <div className="h-full flex items-center justify-center text-xs text-zinc-600">Collecting live samples…</div>}</div>
        </section>

        <section className="bg-[#101216] border border-[#242832] rounded-lg p-4 space-y-4"><div><h2 className="text-sm font-semibold">MTA Runtime</h2><p className="text-[10px] text-zinc-600">Direct KumoMTA metrics endpoint</p></div><div className="space-y-2 text-xs">{[['Ready queue',ready],['Scheduled queue',scheduled],['In flight',inflight],['Delivery rate',`${rate.toFixed(3)} msg/s`],['Inbound SMTP',inbound],['Outbound SMTP',outbound],['CPU',`${num(live.kumomta_cpu_usage_percent).toFixed(1)}%`],['Memory',live.kumomta_memory_usage_bytes ? `${(num(live.kumomta_memory_usage_bytes)/1024/1024).toFixed(1)} MB` : '—'],['Disk free',live.kumomta_disk_free_bytes ? `${(num(live.kumomta_disk_free_bytes)/1024/1024/1024).toFixed(1)} GB` : '—']].map(([k,v])=><div key={String(k)} className="flex justify-between border-b border-[#1d2027] pb-2"><span className="text-zinc-500">{k}</span><span className="font-mono text-zinc-200">{String(v)}</span></div>)}</div></section>
      </div>

      <section className="bg-[#101216] border border-[#242832] rounded-lg overflow-hidden">
        <div className="p-4 border-b border-[#242832] flex items-center justify-between"><div><h2 className="text-sm font-semibold">Recent Messages</h2><p className="text-[10px] text-zinc-600">Latest records returned by the authenticated Messages API</p></div><span className="text-[10px] text-zinc-600">{messages.length} loaded</span></div>
        {messages.length === 0 ? <div className="p-10 text-center text-xs text-zinc-600">No messages found in the current account.</div> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[#0c0e12] text-[10px] uppercase tracking-wider text-zinc-600"><tr><th className="px-4 py-3">Recipient</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Provider ID</th><th className="px-4 py-3">Updated</th></tr></thead><tbody>{messages.slice(0,12).map(m => <tr key={m.id} onClick={() => onSelectMessage(m)} className="border-t border-[#1d2027] hover:bg-[#14171c] cursor-pointer"><td className="px-4 py-3 text-zinc-200">{m.toEmail || '—'}</td><td className="px-4 py-3 max-w-[360px] truncate text-zinc-400">{m.subject || '—'}</td><td className="px-4 py-3"><span className={`px-2 py-1 rounded border text-[10px] font-semibold ${badge(m.status)}`}>{m.status}</span></td><td className="px-4 py-3 font-mono text-[10px] text-zinc-600">{m.providerMessageId || m.sesMessageId || m.messageId || '—'}</td><td className="px-4 py-3 text-zinc-600">{time(m.updatedAt || m.createdAt)}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  </div>;
};
