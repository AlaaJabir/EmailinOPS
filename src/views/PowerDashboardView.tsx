import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, Mail, Megaphone, MousePointerClick, RefreshCw, ShieldAlert, Users, Zap, TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { DashboardStats, Domain, Message } from '../types';

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

type Live = Record<string, any>;
type Period = 'today' | '7d' | '30d';

const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const fmt = (value: unknown) => Math.round(num(value)).toLocaleString();
const percent = (value: unknown) => `${num(value).toFixed(2)}%`;
const ratio = (value: number, total: number) => total > 0 ? `${((value / total) * 100).toFixed(2)}%` : '0.00%';

const Panel = ({ title, tag, children, className = '' }: { title: string; tag?: string; children: React.ReactNode; className?: string }) => (
  <section className={`bg-[#0f1412] border border-[#1e2825] rounded-[6px] p-4 ${className}`}>
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-[11px] font-bold tracking-wide flex items-center gap-2"><span className="w-[3px] h-3 bg-[#39ff9c]" />{title}</h2>
      {tag && <span className="text-[9px] text-[#4a5a53] border border-[#1e2825] px-2 py-1 rounded">{tag}</span>}
    </div>
    {children}
  </section>
);

const KPI = ({ label, value, meta, tone = 'bg-[#39ff9c]', delta }: { label: string; value: string; meta: string; tone?: string; delta?: string }) => (
  <div className="relative overflow-hidden bg-[#0f1412] border border-[#1e2825] rounded-[6px] p-3.5">
    <span className={`absolute left-0 right-0 top-0 h-[2px] ${tone}`} />
    <div className="text-[9px] uppercase tracking-[0.14em] text-[#4a5a53]">{label}</div>
    <div className="font-mono text-[21px] font-bold mt-2 text-[#d8e6df]">{value}</div>
    <div className="text-[9px] text-[#4a5a53] mt-1">{delta || meta}</div>
  </div>
);

const statusClass = (status: string) => {
  if (status === 'DELIVERED' || status === 'COMPLETED') return 'text-[#39ff9c] bg-[#39ff9c]/10 border-[#1f8f5c]';
  if (status === 'SENDING' || status === 'SCHEDULED') return 'text-[#5cc8ff] bg-[#5cc8ff]/10 border-[#2a5870]';
  if (status === 'PAUSED' || status === 'QUEUED') return 'text-[#ffb454] bg-[#ffb454]/10 border-[#6d5228]';
  return 'text-[#ff5c5c] bg-[#ff5c5c]/10 border-[#6d3030]';
};

export const PowerDashboardView: React.FC<Props> = ({ stats, domains = [], recentMessages, onSelectMessage, onNavigateToSend, onNavigateToCampaigns, onRefresh, isLoading, authFetch }) => {
  const [live, setLive] = useState<Live>({});
  const [history, setHistory] = useState<Array<{ time: string; queue: number }>>([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [period, setPeriod] = useState<Period>('30d');
  const [periodStats, setPeriodStats] = useState<DashboardStats | null>(stats);
  const [liveLoading, setLiveLoading] = useState(false);

  const request = useCallback((url: string) => authFetch ? authFetch(url) : fetch(url), [authFetch]);

  const loadPeriod = useCallback(async () => {
    if (!authFetch) return;
    try {
      const response = await authFetch(`/api/dashboard/stats?period=${period}`);
      if (response.ok) setPeriodStats(await response.json());
    } catch (error) {
      console.error('[Dashboard] stats refresh failed', error);
    }
  }, [authFetch, period]);

  const refreshLive = useCallback(async () => {
    setLiveLoading(true);
    try {
      const response = await request('/api/metrics?format=json');
      if (!response.ok) return;
      const data = await response.json();
      setLive(data);
      const now = Date.now();
      setHistory((items) => [...items, { time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), queue: num(data.kumomta_queue_size) }].slice(-40));
      setUpdatedAt(new Date().toISOString());
    } catch (error) {
      console.error('[Dashboard] KumoMTA refresh failed', error);
    } finally {
      setLiveLoading(false);
    }
  }, [request]);

  useEffect(() => { loadPeriod(); }, [loadPeriod]);
  useEffect(() => {
    refreshLive();
    const timer = window.setInterval(refreshLive, 3000);
    return () => window.clearInterval(timer);
  }, [refreshLive]);
  useEffect(() => { if (stats) setPeriodStats(stats); }, [stats]);

  const data = periodStats || stats;
  const sent = num(data?.totalSent);
  const delivered = num(data?.delivered);
  const bounced = num(data?.bounced);
  const failed = num(data?.failed);
  const complaints = num(data?.complaints);
  const opens = num(data?.opens);
  const clicks = num(data?.clicks);
  const deliveryRate = num(data?.deliveryRate);
  const bounceRate = num(data?.bounceRate);
  const openRate = num(data?.openRate);
  const clickRate = num(data?.clickRate);
  const queue = num(live.kumomta_queue_size);
  const ready = num(live.kumomta_ready_queue_size);
  const scheduled = num(live.kumomta_scheduled_queue_size);
  const inFlight = num(live.kumomta_messages_in_flight);
  const mtaTotal = num(live.kumomta_messages_sent_total);
  const complaintAlert = sent > 0 && complaints / sent > 0.001;
  const chart = useMemo(() => data?.timeseries || [], [data]);
  const campaigns = data?.topCampaigns || [];

  return (
    <div className="min-h-full bg-[#0a0d0c] text-[#d8e6df] p-4 md:p-6 font-mono">
      <div className="max-w-[1500px] mx-auto space-y-4">
        <header className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <div className="flex items-center gap-3"><h1 className="text-[20px] font-bold tracking-wide">// DASHBOARD</h1><span className={`text-[9px] px-2 py-1 rounded border ${live.kumomta_live === false ? 'text-[#ff5c5c] border-[#6d3030]' : 'text-[#39ff9c] border-[#1f8f5c]'}`}>{live.kumomta_live === false ? 'KUMOMTA OFFLINE' : 'KUMOMTA LIVE'}</span></div>
            <p className="text-[10px] text-[#4a5a53] mt-1">Unified mail delivery, campaign and compliance operations</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[#4a5a53] hidden lg:block">{updatedAt ? `Synced ${new Date(updatedAt).toLocaleTimeString()}` : 'Syncing…'}</span>
            <button onClick={() => { onRefresh(); refreshLive(); }} className="px-3 py-2 rounded-[4px] border border-[#2a3733] bg-[#131917] text-[10px] hover:border-[#39ff9c]"><RefreshCw className={`w-3 h-3 inline mr-1.5 ${isLoading || liveLoading ? 'animate-spin' : ''}`} />Refresh</button>
            <button onClick={onNavigateToCampaigns} className="px-3 py-2 rounded-[4px] bg-[#39ff9c] text-[#03140b] text-[10px] font-bold hover:shadow-[0_0_16px_rgba(57,255,156,.25)]"><Megaphone className="w-3 h-3 inline mr-1.5" />New Campaign</button>
          </div>
        </header>

        <div className="flex items-center justify-between border-b border-[#1e2825]">
          <div className="flex gap-1"><span className="px-4 py-2 text-[10px] text-[#39ff9c] border-b-2 border-[#39ff9c]">Overview</span><button onClick={onNavigateToCampaigns} className="px-4 py-2 text-[10px] text-[#4a5a53] hover:text-[#d8e6df]">Campaigns</button><button onClick={onNavigateToSend} className="px-4 py-2 text-[10px] text-[#4a5a53] hover:text-[#d8e6df]">Compose</button></div>
          <div className="flex gap-1 pb-1">{(['today', '7d', '30d'] as Period[]).map((value) => <button key={value} onClick={() => setPeriod(value)} className={`px-2.5 py-1 text-[9px] rounded ${period === value ? 'bg-[#39ff9c]/10 text-[#39ff9c] border border-[#1f8f5c]' : 'text-[#4a5a53]'}`}>{value === 'today' ? 'Today' : value.toUpperCase()}</button>)}</div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KPI label={`Sent (${period === 'today' ? 'today' : period})`} value={fmt(sent)} meta="application account total" delta={data?.sentDeltaPct !== undefined ? `${data.sentDeltaPct >= 0 ? '▲' : '▼'} ${Math.abs(data.sentDeltaPct)}% vs previous` : undefined} />
          <KPI label="Delivery Rate" value={percent(deliveryRate)} meta="delivered / sent" />
          <KPI label="Bounce Rate" value={percent(bounceRate)} meta="hard + soft / sent" tone="bg-[#ffb454]" />
          <KPI label="Open Rate" value={percent(openRate)} meta={`${fmt(opens)} unique / delivered`} tone="bg-[#5cc8ff]" delta={data?.openRateDeltaPt !== undefined ? `${data.openRateDeltaPt >= 0 ? '▲' : '▼'} ${Math.abs(data.openRateDeltaPt)}pt` : undefined} />
          <KPI label="Click Rate (CTR)" value={percent(clickRate)} meta={`${fmt(clicks)} unique / delivered`} tone="bg-[#5cc8ff]" delta={data?.clickRateDeltaPt !== undefined ? `${data.clickRateDeltaPt >= 0 ? '▲' : '▼'} ${Math.abs(data.clickRateDeltaPt)}pt` : undefined} />
          <KPI label="Complaint Rate" value={ratio(complaints, sent)} meta={complaintAlert ? 'ALERT — above 0.1%' : 'within safe range'} tone="bg-[#ff5c5c]" />
        </div>

        <div className="grid xl:grid-cols-[1.65fr_1fr] gap-4">
          <Panel title="Sending Volume Telemetry" tag="SMOOTH STREAM · SENT / DELIVERED / BOUNCED">
            <div className="h-[250px]">
              {chart.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#39ff9c" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#39ff9c" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradDelivered" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#5cc8ff" stopOpacity={0.20} />
                        <stop offset="95%" stopColor="#5cc8ff" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradBounced" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff5c5c" stopOpacity={0.20} />
                        <stop offset="95%" stopColor="#ff5c5c" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1e2825" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" stroke="#4a5a53" tick={{ fontSize: 9 }} tickLine={false} />
                    <YAxis stroke="#4a5a53" tick={{ fontSize: 9 }} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: '#0b0e0d', border: '1px solid #2a3733', borderRadius: '4px', fontSize: 10 }}
                      formatter={(val: any, name: any) => [val, String(name).toUpperCase()]}
                    />
                    <Area
                      type="monotone"
                      dataKey="sent"
                      name="Sent"
                      stroke="#39ff9c"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#39ff9c', stroke: '#0a0d0c', strokeWidth: 2 }}
                      fill="url(#gradSent)"
                    />
                    <Area
                      type="monotone"
                      dataKey="delivered"
                      name="Delivered"
                      stroke="#5cc8ff"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#5cc8ff', stroke: '#0a0d0c', strokeWidth: 2 }}
                      fill="url(#gradDelivered)"
                    />
                    <Area
                      type="monotone"
                      dataKey="bounced"
                      name="Bounced"
                      stroke="#ff5c5c"
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3, fill: '#ff5c5c' }}
                      fill="url(#gradBounced)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[10px] text-[#4a5a53]">
                  No sending telemetry recorded for this timeline.
                </div>
              )}
            </div>
          </Panel>
          <Panel title="Status Breakdown">
            <div className="flex items-center gap-7 h-[230px]"><div className="relative w-[145px] h-[145px] shrink-0 rounded-full" style={{ background: `conic-gradient(#39ff9c ${Math.min(100, deliveryRate)}%, #1e2825 0)` }}><div className="absolute inset-[16px] rounded-full bg-[#0f1412] flex flex-col items-center justify-center"><span className="text-lg font-bold">{deliveryRate.toFixed(0)}%</span><span className="text-[8px] text-[#4a5a53]">DELIVERED</span></div></div><div className="space-y-3 text-[10px] w-full"><div className="flex justify-between"><span><i className="inline-block w-2 h-2 rounded-sm bg-[#39ff9c] mr-2" />Delivered</span><span>{fmt(delivered)}</span></div><div className="flex justify-between"><span><i className="inline-block w-2 h-2 rounded-sm bg-[#ffb454] mr-2" />Bounced</span><span>{fmt(bounced)}</span></div><div className="flex justify-between"><span><i className="inline-block w-2 h-2 rounded-sm bg-[#ff5c5c] mr-2" />Failed</span><span>{fmt(failed)}</span></div><div className="flex justify-between"><span><i className="inline-block w-2 h-2 rounded-sm bg-[#5cc8ff] mr-2" />Pending</span><span>{fmt(num(data?.queued))}</span></div></div></div>
          </Panel>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Panel title="Queue Status"><div className="space-y-3"><div className="flex justify-between"><span className="text-[10px] text-[#7c9188]">Processing</span><b className="text-[#5cc8ff]">{fmt(inFlight)}</b></div><div className="flex justify-between"><span className="text-[10px] text-[#7c9188]">Pending</span><b>{fmt(queue + ready + scheduled)}</b></div><div className="flex justify-between"><span className="text-[10px] text-[#7c9188]">Failed</span><b className="text-[#ff5c5c]">{fmt(failed)}</b></div><div className="h-1 bg-[#1e2825] rounded overflow-hidden"><div className="h-full bg-[#39ff9c]" style={{ width: `${Math.min(100, ((queue + ready + scheduled) / Math.max(1, sent)) * 100)}%` }} /></div><div className="text-[9px] text-[#4a5a53]">KumoMTA live queue · {num(live.kumomta_delivery_rate_per_second).toFixed(3)} msg/s</div></div></Panel>
          <Panel title="Domain Health"><div className="space-y-2">{domains.length ? domains.slice(0, 4).map((domain) => { const healthy = domain.spfStatus === 'VERIFIED' && domain.dkimStatus === 'VERIFIED' && domain.dmarcStatus === 'VERIFIED'; return <div key={domain.id} className="border-b border-[#1e2825] pb-2 text-[9px]"><div className="flex justify-between gap-2"><span className="truncate">{domain.domainName}</span><span className={healthy ? 'text-[#39ff9c]' : 'text-[#ff5c5c]'}>SPF {domain.spfStatus === 'VERIFIED' ? '✓' : '✗'} · DKIM {domain.dkimStatus === 'VERIFIED' ? '✓' : '✗'} · DMARC {domain.dmarcStatus === 'VERIFIED' ? '✓' : '✗'}</span></div></div>; }) : <div className="text-[10px] text-[#4a5a53] py-5">No sender domains configured.</div>}</div></Panel>
          <Panel title="MTA Runtime" tag="LIVE"><div className="grid grid-cols-2 gap-x-5 gap-y-3 text-[9px]"><div><span className="text-[#4a5a53] block">QUEUE</span>{fmt(queue)}</div><div><span className="text-[#4a5a53] block">MTA CUMULATIVE</span>{fmt(mtaTotal)}</div><div><span className="text-[#4a5a53] block">CPU</span>{num(live.kumomta_cpu_usage_percent).toFixed(1)}%</div><div><span className="text-[#4a5a53] block">MEMORY</span>{live.kumomta_memory_usage_bytes ? `${(num(live.kumomta_memory_usage_bytes) / 1024 / 1024).toFixed(0)} MB` : '—'}</div><div><span className="text-[#4a5a53] block">DISK FREE</span>{live.kumomta_disk_free_bytes ? `${(num(live.kumomta_disk_free_bytes) / 1024 / 1024 / 1024).toFixed(1)} GB` : '—'}</div><div><span className="text-[#4a5a53] block">IN / OUT</span>{fmt(live.kumomta_smtp_connections_in)} / {fmt(live.kumomta_smtp_connections_out)}</div></div></Panel>
        </div>

        <Panel title="Recent Campaigns" tag="LAST 5"><div className="overflow-x-auto"><table className="w-full text-[9px]"><thead><tr className="text-[#4a5a53] uppercase tracking-wider border-b border-[#1e2825]"><th className="text-left p-2">Name</th><th className="text-left p-2">Status</th><th className="text-right p-2">Recipients</th><th className="text-right p-2">Sent</th><th className="text-right p-2">Delivered</th><th className="text-right p-2">Open</th><th className="text-right p-2">Click</th></tr></thead><tbody>{campaigns.slice(0, 5).map((campaign) => <tr key={campaign.id} className="border-b border-[#1e2825] hover:bg-[#131917]"><td className="p-2">{campaign.name}</td><td className="p-2"><span className={`px-2 py-1 rounded-full border ${statusClass(campaign.status || 'DRAFT')}`}>{campaign.status || 'DRAFT'}</span></td><td className="p-2 text-right">{fmt(campaign.totalRecipients)}</td><td className="p-2 text-right">{fmt(campaign.sent)}</td><td className="p-2 text-right">{fmt(campaign.delivered)}</td><td className="p-2 text-right">{num(campaign.openRate).toFixed(1)}%</td><td className="p-2 text-right">{num(campaign.clickRate).toFixed(1)}%</td></tr>)}</tbody></table>{!campaigns.length && <div className="py-8 text-center text-[10px] text-[#4a5a53]">No campaigns yet. Create one to start tracking performance.</div>}</div></Panel>

        <div className="grid xl:grid-cols-[1.45fr_1fr] gap-4">
          <Panel title="Recent Messages" tag="LATEST"><div className="overflow-x-auto"><table className="w-full text-[9px]"><thead><tr className="text-[#4a5a53] border-b border-[#1e2825]"><th className="text-left py-2">MESSAGE</th><th className="text-left">RECIPIENT</th><th className="text-left">STATUS</th><th className="text-right">OPEN</th><th className="text-right">CLICK</th></tr></thead><tbody>{recentMessages.slice(0, 8).map((message) => { const opened = (message.events || []).some((event) => event.eventType === 'OPENED'); const clicked = (message.events || []).some((event) => event.eventType === 'CLICKED'); return <tr key={message.id} onClick={() => onSelectMessage(message)} className="border-b border-[#151d1a] hover:bg-[#131917] cursor-pointer"><td className="py-2 pr-3 max-w-[260px] truncate">{message.subject || '(no subject)'}</td><td className="max-w-[220px] truncate">{message.toEmail}</td><td><span className={`inline-flex px-1.5 py-0.5 rounded border ${statusClass(message.status)}`}>{message.status}</span></td><td className="text-right">{opened ? <Eye className="w-3 h-3 inline text-[#5cc8ff]" /> : '—'}</td><td className="text-right">{clicked ? <MousePointerClick className="w-3 h-3 inline text-[#5cc8ff]" /> : '—'}</td></tr>; })}</tbody></table>{!recentMessages.length && <div className="py-8 text-center text-[10px] text-[#4a5a53]">No messages yet.</div>}</div></Panel>
          <Panel title="Live Queue Throughput" tag="3s POLL"><div className="h-[150px]">{history.length > 1 ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={history}><CartesianGrid stroke="#1e2825" /><XAxis dataKey="time" hide /><YAxis stroke="#4a5a53" tick={{ fontSize: 8 }} width={28} /><Tooltip contentStyle={{ background: '#0b0e0d', border: '1px solid #2a3733', fontSize: 9 }} /><Area type="monotone" dataKey="queue" stroke="#39ff9c" fill="#39ff9c" fillOpacity={0.05} /></AreaChart></ResponsiveContainer> : <div className="h-full flex items-center justify-center text-[10px] text-[#4a5a53]">Waiting for live samples…</div>}</div><div className="grid grid-cols-3 gap-3 mt-2 text-[9px]"><div><span className="text-[#4a5a53] block">QUEUE</span>{fmt(queue)}</div><div><span className="text-[#4a5a53] block">RATE</span>{num(live.kumomta_delivery_rate_per_second).toFixed(3)}/s</div><div><span className="text-[#4a5a53] block">READY</span>{fmt(ready)}</div></div></Panel>
        </div>

        <Panel title="Compliance Snapshot"><div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[9px]"><div className="border border-[#1e2825] rounded p-3"><Mail className="w-3.5 h-3.5 text-[#4a5a53]" /><div className="text-lg font-bold mt-2">{fmt(sent)}</div><div className="text-[8px] text-[#4a5a53]">messages in period</div></div><div className="border border-[#1e2825] rounded p-3"><CheckCircle2 className="w-3.5 h-3.5 text-[#39ff9c]" /><div className="text-lg font-bold mt-2">{percent(deliveryRate)}</div><div className="text-[8px] text-[#4a5a53]">delivery rate</div></div><div className="border border-[#1e2825] rounded p-3"><Users className="w-3.5 h-3.5 text-[#5cc8ff]" /><div className="text-lg font-bold mt-2">{fmt(opens)}</div><div className="text-[8px] text-[#4a5a53]">unique opens</div></div><div className="border border-[#1e2825] rounded p-3"><ShieldAlert className={`w-3.5 h-3.5 ${complaintAlert ? 'text-[#ff5c5c]' : 'text-[#39ff9c]'}`} /><div className={`text-lg font-bold mt-2 ${complaintAlert ? 'text-[#ff5c5c]' : 'text-[#39ff9c]'}`}>{ratio(complaints, sent)}</div><div className="text-[8px] text-[#4a5a53]">complaint rate</div></div></div></Panel>

        <div className="hidden"><Zap /></div>
      </div>
    </div>
  );
};
