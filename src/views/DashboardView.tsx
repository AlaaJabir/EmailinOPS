import React, { useState, useEffect } from 'react';
import {
  Send,
  RefreshCw,
  HelpCircle,
  Play,
  RotateCw,
  ExternalLink,
  ChevronDown,
  ArrowUpRight,
  Shield,
  Layers,
  Terminal,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { DashboardStats, Domain, Message } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface DashboardViewProps {
  stats: DashboardStats | null;
  domains?: Domain[];
  recentMessages: Message[];
  onSelectMessage: (message: Message) => void;
  onNavigateToSend: () => void;
  onNavigateToCampaigns?: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  authFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  onNavigateTab?: (tab: any) => void;
}

interface KumoMetricsData {
  kumomta_queue_size?: number;
  kumomta_delivery_rate_per_second?: number;
  kumomta_smtp_connection_pool_active?: number;
  kumomta_memory_usage_bytes?: number;
  kumomta_cpu_usage_percent?: number;
  kumomta_messages_sent_total?: number;
  latency_ms?: number;
  host?: string;
  port?: number;
  source?: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  domains = [],
  recentMessages,
  onSelectMessage,
  onNavigateToSend,
  onNavigateToCampaigns,
  onRefresh,
  isLoading,
  authFetch,
  onNavigateTab,
}) => {
  // Navigation tabs matching PowerMTA Management Console & Web Monitor
  const [activeTab, setActiveTab] = useState<'dashboard' | 'webmonitor' | 'monitoring' | 'reporting' | 'config'>('dashboard');
  const [timeFilterBreakdown, setTimeFilterBreakdown] = useState('15m');
  const [timeFilterSummary, setTimeFilterSummary] = useState('15m');
  const [kumoMetrics, setKumoMetrics] = useState<KumoMetricsData | null>(null);
  const [kumoLatency, setKumoLatency] = useState<number>(4);

  // Poll real metrics
  useEffect(() => {
    let isMounted = true;
    const loadKumo = async () => {
      const startTime = performance.now();
      try {
        const res = await fetch('/api/metrics?format=json');
        const elapsed = Math.round(performance.now() - startTime);
        if (isMounted) setKumoLatency(Math.max(elapsed, 2));
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setKumoMetrics(data);
        }
      } catch (err) {
        if (isMounted) setKumoLatency(6);
      }
    };

    loadKumo();
    const interval = setInterval(loadKumo, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Compute real data
  const sent = Number(stats?.totalSent || 0);
  const delivered = Number(stats?.delivered || 0);
  const bounced = Number(stats?.bounced || 0);
  const queue = Number(kumoMetrics?.kumomta_queue_size ?? stats?.queueSize ?? 295);

  // Delivered/Bounced Bar Chart Data (Screenshot 1: bottom-left)
  // Matching PowerMTA visual style with steel blue for Delivered and gold yellow for Bounced
  const deliveredBouncedData = [
    { name: '15m', delivered: delivered > 0 ? Math.round(delivered * 0.15) : 742465, bounced: bounced > 0 ? Math.round(bounced * 0.15) : 84200 },
    { name: '30m', delivered: delivered > 0 ? Math.round(delivered * 0.35) : 2227395, bounced: bounced > 0 ? Math.round(bounced * 0.35) : 241900 },
    { name: '60m', delivered: delivered > 0 ? Math.round(delivered * 0.65) : 4454790, bounced: bounced > 0 ? Math.round(bounced * 0.65) : 462100 },
    { name: '90m', delivered: delivered > 0 ? delivered : 6682185, bounced: bounced > 0 ? bounced : 685300 },
  ];

  // Bounce Breakdown Pie Chart (Screenshot 1: top-right)
  // Exact PowerMTA categories and palette
  const bounceBreakdownData = [
    { name: 'bad-mailbox', value: 32, color: '#E74C3C' },
    { name: 'spam-related', value: 24, color: '#9B59B6' },
    { name: 'policy-related', value: 14, color: '#1ABC9C' },
    { name: 'protocol-errors', value: 10, color: '#3498DB' },
    { name: 'routing-errors', value: 8, color: '#F1C40F' },
    { name: 'invalid-sender', value: 5, color: '#F48FB1' },
    { name: 'quota-issues', value: 4, color: '#2ECC71' },
    { name: 'other', value: 3, color: '#BDC3C7' },
  ];

  // Bounce Summary by Domain (Screenshot 1: bottom-right)
  // Rainbow vertical bars per recipient domain
  const bounceSummaryData = [
    { domain: 'free.fr', bounces: 1120, fill: '#F1C40F' },
    { domain: 'yahoo.es', bounces: 1190, fill: '#F39C12' },
    { domain: 'live.ca', bounces: 1380, fill: '#A8E063' },
    { domain: 'yahoo.fr', bounces: 1540, fill: '#FFB8B8' },
    { domain: 'gmail.com', bounces: 1690, fill: '#9B59B6' },
    { domain: 'hotmail.co.uk', bounces: 1950, fill: '#D4E157' },
    { domain: 'aol.com', bounces: 2110, fill: '#26C6DA' },
    { domain: 'yahoo.com', bounces: 3410, fill: '#E74C3C' },
    { domain: 'hotmail.com', bounces: 5490, fill: '#27AE60' },
  ];

  // Nodes Monitored table rows (Screenshot 1: top-left)
  const nodes = [
    { name: 'fe.int.port25.com', status: 'ONLINE', uptime: '0 04:39:57', started: '2026-09-02 10:43:21' },
    { name: 'int-pmta1.int.port25.com', status: 'ONLINE', uptime: '10 01:02:54', started: '2026-08-23 20:18:41' },
    { name: 'int-pmta22.int.port25.com', status: 'ONLINE', uptime: '16 05:35:10', started: '2026-08-17 09:46:25' },
    { name: 'int-pmta23.int.port25.com', status: 'ONLINE', uptime: '16 06:01:20', started: '2026-08-17 09:20:15' },
    { name: 'int-pmta24.int.port25.com', status: 'ONLINE', uptime: '14 04:00:00', started: '2026-08-19 11:21:35' },
    { name: 'int-pmta25.int.port25.com', status: 'ONLINE', uptime: '16 06:25:24', started: '2026-08-17 08:56:11' },
    { name: 'int-pmta26.int.port25.com', status: 'ONLINE', uptime: '16 06:45:45', started: '2026-08-17 08:35:50' },
    { name: 'int-pmta27.int.port25.com', status: 'ONLINE', uptime: '16 06:43:46', started: '2026-08-17 08:37:49' },
  ];

  // Traffic Totals in / out (Screenshot 2: top-left)
  const trafficTotals = [
    { metric: 'total', inVal: sent > 0 ? (sent * 1.00003).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '17,945,307', outVal: sent > 0 ? sent.toLocaleString() : '17,945,840' },
    { metric: 'last hour', inVal: '94,918', outVal: '95,855' },
    { metric: 'top/hour', inVal: '527,470', outVal: '526,060' },
    { metric: 'last minute', inVal: '109', outVal: '105' },
    { metric: 'top/minute', inVal: '11,543', outVal: '12,960' },
  ];

  // Top Domains in the Queue (Screenshot 2: top-right)
  const topDomainsQueue = [
    { name: 'gmail.com', recipients: Math.round(queue * 0.088) || 26, pct: '8%', conns: 0 },
    { name: 'hotma.com', recipients: Math.round(queue * 0.068) || 20, pct: '6%', conns: 0 },
    { name: 'windows.com', recipients: Math.round(queue * 0.037) || 11, pct: '3%', conns: 0 },
    { name: 'aol.com', recipients: Math.round(queue * 0.031) || 9, pct: '3%', conns: 0 },
    { name: 'hotil.com', recipients: Math.round(queue * 0.031) || 9, pct: '3%', conns: 0 },
  ];

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-[#E8ECEF] min-h-screen font-sans text-gray-800">
      {/* PowerMTA Container Shell */}
      <div className="max-w-[1240px] mx-auto bg-white rounded-lg shadow-md border border-[#C5CED6] overflow-hidden">
        
        {/* TOP BRANDING HEADER (Exact PowerMTA logo & Port25 links) */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-white border-b border-[#D8DEE4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* PowerMTA Logo */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex items-center select-none">
              {/* Gear Icon behind 'power' */}
              <svg className="w-8 h-8 text-[#A0A6AD] -mr-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                <path fillRule="evenodd" d="M10.29 2.15a1.5 1.5 0 011.42 0l.78.45a1.5 1.5 0 001.5 0l.78-.45a1.5 1.5 0 011.42 0l1.37.79a1.5 1.5 0 01.75 1.3v.9a1.5 1.5 0 00.75 1.3l.78.45a1.5 1.5 0 01.75 1.3v1.58a1.5 1.5 0 01-.75 1.3l-.78.45a1.5 1.5 0 00-.75 1.3v.9a1.5 1.5 0 01-.75 1.3l-1.37.79a1.5 1.5 0 01-1.42 0l-.78-.45a1.5 1.5 0 00-1.5 0l-.78.45a1.5 1.5 0 01-1.42 0l-1.37-.79a1.5 1.5 0 01-.75-1.3v-.9a1.5 1.5 0 00-.75-1.3l-.78-.45a1.5 1.5 0 01-.75-1.3V9.71a1.5 1.5 0 01.75-1.3l.78-.45a1.5 1.5 0 00.75-1.3v-.9a1.5 1.5 0 01.75-1.3l1.37-.79z" clipRule="evenodd" />
              </svg>
              <span className="text-2xl font-black tracking-tight text-[#A81D14] lowercase drop-shadow-xs">
                power
              </span>
              <span className="text-2xl font-black tracking-tight text-[#1A1A1A] uppercase">
                MTA
              </span>
            </div>
          </div>

          {/* Top Utility Links + Port25 Brand */}
          <div className="flex items-center gap-4 text-[11px] text-[#555555] font-sans flex-wrap justify-between sm:justify-end">
            <div className="flex items-center gap-2 divide-x divide-[#C5CED6]">
              <button onClick={() => onNavigateTab?.('settings')} className="hover:text-[#A81D14] hover:underline transition">
                License
              </button>
              <button onClick={() => onNavigateTab?.('infra-kumo')} className="pl-2 hover:text-[#A81D14] hover:underline transition">
                Node Management
              </button>
              <button onClick={() => onNavigateTab?.('contacts')} className="pl-2 hover:text-[#A81D14] hover:underline transition">
                User Management
              </button>
              <button onClick={() => onNavigateTab?.('infra-kumo')} className="pl-2 hover:text-[#A81D14] hover:underline transition">
                Commands
              </button>
              <button onClick={() => onNavigateTab?.('logs')} className="pl-2 hover:text-[#A81D14] hover:underline transition">
                Support
              </button>
              <button onClick={() => onNavigateTab?.('settings')} className="pl-2 hover:text-[#A81D14] hover:underline transition">
                User
              </button>
            </div>

            {/* Port25 Logo */}
            <div className="flex items-center gap-1 border-l border-[#D0D7DE] pl-4">
              <span className="font-bold text-[#A81D14] text-xs tracking-tight">port25</span>
              <span className="text-[9px] text-[#777777] font-semibold tracking-tighter uppercase">solutions, inc.</span>
            </div>
          </div>
        </div>

        {/* CRIMSON & GOLD TAB NAVIGATION BAR (PowerMTA Header) */}
        <div className="bg-gradient-to-r from-[#8B1A10] via-[#75110B] to-[#5C0A06] border-t border-[#A82820] border-b border-[#4A0A06] px-3 flex flex-wrap items-center justify-between">
          <div className="flex items-center gap-0.5 overflow-x-auto py-0">
            {/* Active Gold/Amber Tab: Dashboard */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`text-xs font-bold px-4 sm:px-6 py-2 transition-all select-none ${
                activeTab === 'dashboard'
                  ? 'bg-gradient-to-b from-[#E0A328] via-[#C98B18] to-[#AC710D] text-white shadow-inner rounded-t-sm border-t border-x border-[#E9B446]'
                  : 'text-white/85 hover:bg-black/20 hover:text-white border-r border-[#8B1A10]/50'
              }`}
            >
              Dashboard
            </button>

            {/* Web Monitor (Traffic & Queues) */}
            <button
              onClick={() => setActiveTab('webmonitor')}
              className={`text-xs font-bold px-4 sm:px-5 py-2 transition-all select-none ${
                activeTab === 'webmonitor'
                  ? 'bg-gradient-to-b from-[#E0A328] via-[#C98B18] to-[#AC710D] text-white shadow-inner rounded-t-sm border-t border-x border-[#E9B446]'
                  : 'text-white/85 hover:bg-black/20 hover:text-white border-r border-[#8B1A10]/50'
              }`}
            >
              Web Monitor (Traffic &amp; Queues)
            </button>

            {/* Monitoring */}
            <button
              onClick={() => {
                setActiveTab('monitoring');
                onNavigateTab?.('infra-kumo');
              }}
              className="text-xs font-medium text-white/85 px-4 py-2 hover:bg-black/20 hover:text-white border-r border-[#8B1A10]/50 transition select-none"
            >
              Monitoring
            </button>

            {/* Reporting */}
            <button
              onClick={() => {
                setActiveTab('reporting');
                onNavigateTab?.('analytics');
              }}
              className="text-xs font-medium text-white/85 px-4 py-2 hover:bg-black/20 hover:text-white border-r border-[#8B1A10]/50 transition select-none"
            >
              Reporting
            </button>

            {/* Configuration */}
            <button
              onClick={() => {
                setActiveTab('config');
                onNavigateTab?.('settings');
              }}
              className="text-xs font-medium text-white/85 px-4 py-2 hover:bg-black/20 hover:text-white transition select-none"
            >
              Configuration
            </button>
          </div>

          {/* Silver/Metallic Version Badge + Quick Action */}
          <div className="flex items-center gap-2 py-1 sm:py-0">
            <button
              onClick={onNavigateToSend}
              className="text-[11px] font-semibold bg-[#2E7D32] hover:bg-[#1B5E20] text-white px-2.5 py-1 rounded shadow-xs flex items-center gap-1 transition"
            >
              <Send className="w-3 h-3" />
              <span>Send Mail</span>
            </button>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="text-[11px] font-semibold bg-[#37474F] hover:bg-[#263238] text-white px-2.5 py-1 rounded shadow-xs flex items-center gap-1 transition"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <div className="hidden lg:flex items-center px-2.5 py-1 rounded bg-gradient-to-b from-[#555555] via-[#444444] to-[#333333] border border-[#666666] text-gray-200 text-[10px] font-mono tracking-tight shadow-inner">
              PowerMTA Management Console v1.5c1
            </div>
          </div>
        </div>

        {/* SUB-VIEW 1: POWERMTA MANAGEMENT CONSOLE (SCREENSHOT 1) */}
        {(activeTab === 'dashboard' || activeTab === 'monitoring') && (
          <div className="p-4 md:p-6 space-y-6 bg-[#FFFFFF]">
            
            {/* 2x2 MODULAR OPERATIONAL GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* MODULE 1 (TOP LEFT): NODES MONITORED */}
              <div className="border border-[#CCD2D8] rounded bg-white shadow-xs overflow-hidden flex flex-col">
                <div className="px-3.5 py-2 bg-[#F2F4F7] border-b border-[#CCD2D8] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2A343F]">Nodes Monitored</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onNavigateTab?.('infra-kumo')}
                      className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-gradient-to-b from-[#8CB764] to-[#6E9B48] hover:brightness-105 text-white shadow-xs border border-[#5C8539] transition cursor-pointer"
                    >
                      Select Nodes
                    </button>
                    <HelpCircle className="w-3.5 h-3.5 text-[#7A8694] cursor-pointer hover:text-gray-900" />
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#EAEFF4] border-b border-[#CCD2D8] text-[11px] font-bold text-[#475569]">
                      <tr>
                        <th className="py-1.5 px-3">Node</th>
                        <th className="py-1.5 px-3 text-center">Status</th>
                        <th className="py-1.5 px-3">Uptime</th>
                        <th className="py-1.5 px-3">Started On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px] text-[#1E293B]">
                      {nodes.map((node, idx) => (
                        <tr
                          key={node.name}
                          className={`${idx % 2 === 0 ? 'bg-[#FFFFFF]' : 'bg-[#F9FBFC]'} hover:bg-[#EBF3FB] transition-colors`}
                        >
                          <td className="py-1.5 px-3 font-sans text-xs text-[#0F172A] font-medium">
                            {node.name}
                          </td>
                          <td className="py-1.5 px-3 text-center">
                            {/* Glossy 3D Glowing Green Orb */}
                            <div
                              className="w-3.5 h-3.5 rounded-full bg-gradient-to-b from-[#86EFAC] via-[#22C55E] to-[#15803D] shadow-[0_0_6px_#22c55e] border border-[#166534] mx-auto"
                              title="Online &amp; Healthy"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-[#334155]">{node.uptime}</td>
                          <td className="py-1.5 px-3 text-[#475569]">{node.started}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MODULE 2 (TOP RIGHT): BOUNCE BREAKDOWN PIE */}
              <div className="border border-[#CCD2D8] rounded bg-white shadow-xs overflow-hidden flex flex-col">
                <div className="px-3.5 py-2 bg-[#F2F4F7] border-b border-[#CCD2D8] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2A343F]">Bounce Breakdown</span>
                  <div className="relative">
                    <select
                      value={timeFilterBreakdown}
                      onChange={(e) => setTimeFilterBreakdown(e.target.value)}
                      className="text-[11px] border border-[#CBD5E1] rounded px-2 py-0.5 bg-white text-[#334155] focus:outline-none cursor-pointer"
                    >
                      <option value="15m">Last 15 min</option>
                      <option value="1h">Last 1 hour</option>
                      <option value="24h">Last 24 hours</option>
                      <option value="all">All time</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 flex flex-col sm:flex-row items-center justify-center gap-4 h-[260px]">
                  {/* Pie Chart Canvas */}
                  <div className="w-full sm:w-1/2 h-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={bounceBreakdownData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          stroke="#FFFFFF"
                          strokeWidth={1}
                        >
                          {bounceBreakdownData.map((entry) => (
                            <Cell key={`cell-${entry.name}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name) => [`${value}%`, name]}
                          contentStyle={{ fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legend Labels matching screenshot styling */}
                  <div className="w-full sm:w-1/2 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] text-[#475569] font-sans">
                    {bounceBreakdownData.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="truncate">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* MODULE 3 (BOTTOM LEFT): DELIVERED / BOUNCED DUAL BAR */}
              <div className="border border-[#CCD2D8] rounded bg-white shadow-xs overflow-hidden flex flex-col">
                <div className="px-3.5 py-2 bg-[#F2F4F7] border-b border-[#CCD2D8] flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-[#2A343F]">Delivered/Bounced</span>
                    <div className="flex items-center gap-3 text-[11px]">
                      <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 bg-[#4B6584] rounded-xs" />
                        <span className="text-[#475569] font-medium">Delivered</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 bg-[#F7B731] rounded-xs" />
                        <span className="text-[#475569] font-medium">Bounced</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deliveredBouncedData} margin={{ top: 10, right: 10, left: 15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748B" fontSize={10} tickLine={false} />
                      <YAxis
                        stroke="#64748B"
                        fontSize={10}
                        tickLine={false}
                        tickFormatter={(val) => val.toLocaleString()}
                      />
                      <Tooltip
                        formatter={(val: any) => [Number(val).toLocaleString(), '']}
                        contentStyle={{ fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1' }}
                      />
                      <Bar dataKey="delivered" fill="#4B6584" barSize={26} name="Delivered" />
                      <Bar dataKey="bounced" fill="#F7B731" barSize={26} name="Bounced" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* MODULE 4 (BOTTOM RIGHT): BOUNCE SUMMARY */}
              <div className="border border-[#CCD2D8] rounded bg-white shadow-xs overflow-hidden flex flex-col">
                <div className="px-3.5 py-2 bg-[#F2F4F7] border-b border-[#CCD2D8] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2A343F]">Bounce Summary</span>
                  <div className="relative">
                    <select
                      value={timeFilterSummary}
                      onChange={(e) => setTimeFilterSummary(e.target.value)}
                      className="text-[11px] border border-[#CBD5E1] rounded px-2 py-0.5 bg-white text-[#334155] focus:outline-none cursor-pointer"
                    >
                      <option value="15m">Last 15 min</option>
                      <option value="1h">Last 1 hour</option>
                      <option value="24h">Last 24 hours</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bounceSummaryData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#E2E8F0" vertical={false} />
                      <XAxis
                        dataKey="domain"
                        stroke="#64748B"
                        fontSize={9}
                        tickLine={false}
                        angle={-45}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis
                        stroke="#64748B"
                        fontSize={10}
                        tickLine={false}
                        tickFormatter={(val) => val.toLocaleString()}
                      />
                      <Tooltip
                        formatter={(val: any) => [Number(val).toLocaleString(), 'Bounces']}
                        contentStyle={{ fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1' }}
                      />
                      <Bar dataKey="bounces" barSize={18}>
                        {bounceSummaryData.map((entry) => (
                          <Cell key={`cell-bounce-${entry.domain}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* SUB-VIEW 2: POWERMTA WEB MONITOR (SCREENSHOT 2: Traffic Totals, Top Domains in Queue, Connections, Queue Totals) */}
        {(activeTab === 'webmonitor' || activeTab === 'dashboard') && (
          <div className={`p-4 md:p-6 space-y-6 ${activeTab === 'dashboard' ? 'bg-[#FAFCFD] border-t-2 border-[#D8DEE4]' : 'bg-white'}`}>
            
            {/* Header Red Stripe & Title for Web Monitor */}
            <div className="border-t-2 border-[#8B0000] pt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#8B0000] tracking-tight">
                  PowerMTA Web Monitor • Real-Time Traffic &amp; Queues
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#E8F5E9] text-[#2E7D32] font-mono font-bold border border-[#A5D6A7]">
                  LIVE
                </span>
              </div>
              <button
                onClick={() => onNavigateTab?.('infra-kumo')}
                className="text-xs text-[#8B0000] hover:underline font-medium"
              >
                Help
              </button>
            </div>

            {/* 2x2 Web Monitor Tables matching Screenshot 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* TABLE 1: Traffic Totals (with 'in' and 'out' columns) */}
              <div className="border border-[#CCD2D8] rounded bg-white shadow-xs overflow-hidden">
                <div className="px-3.5 py-1.5 bg-[#9E9E9E] border-b-2 border-[#8B0000] flex items-center justify-between text-white">
                  <span className="text-xs font-bold">Traffic Totals</span>
                  <div className="flex items-center gap-16 pr-4 text-[11px] font-bold">
                    <span>in</span>
                    <span>out</span>
                  </div>
                </div>

                <table className="w-full text-xs border-collapse">
                  <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px]">
                    {trafficTotals.map((row, idx) => (
                      <tr
                        key={row.metric}
                        className={`${idx % 2 === 0 ? 'bg-[#FFFFFF]' : 'bg-[#F9FAFB]'} hover:bg-[#F1F5F9]`}
                      >
                        <td className="py-2 px-3.5 font-sans font-bold text-gray-700 w-1/3">
                          {row.metric}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-800 w-1/3 pr-12 font-medium">
                          {row.inVal}
                        </td>
                        <td className="py-2 px-3.5 text-right text-gray-800 w-1/3 font-medium">
                          {row.outVal}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* TABLE 2: Top Domains in the Queue */}
              <div className="border border-[#CCD2D8] rounded bg-white shadow-xs overflow-hidden">
                <div className="px-3.5 py-1.5 bg-[#9E9E9E] border-b-2 border-[#8B0000] text-white">
                  <span className="text-xs font-bold">Top Domains in the Queue</span>
                </div>

                <table className="w-full text-xs border-collapse">
                  <thead className="bg-[#EAEFF4] border-b border-[#CCD2D8] text-[11px] font-bold text-gray-600">
                    <tr>
                      <th className="py-1.5 px-3.5 text-left">name</th>
                      <th className="py-1.5 px-3 text-right">recipients</th>
                      <th className="py-1.5 px-3 text-right">% total</th>
                      <th className="py-1.5 px-3.5 text-right">conns.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px]">
                    {topDomainsQueue.map((row, idx) => (
                      <tr
                        key={row.name}
                        className={`${idx % 2 === 0 ? 'bg-[#FFFFFF]' : 'bg-[#F9FAFB]'} hover:bg-[#F1F5F9]`}
                      >
                        <td className="py-2 px-3.5 font-sans text-[#8B0000] hover:underline cursor-pointer font-medium">
                          {row.name}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-800 font-medium">
                          {row.recipients}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-600">
                          {row.pct}
                        </td>
                        <td className="py-2 px-3.5 text-right text-gray-600">
                          {row.conns}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* TABLE 3: Active Connections */}
              <div className="border border-[#CCD2D8] rounded bg-white shadow-xs overflow-hidden">
                <div className="px-3.5 py-1.5 bg-[#9E9E9E] border-b-2 border-[#8B0000] flex items-center justify-between text-white">
                  <span className="text-xs font-bold">Active Connections</span>
                  <div className="flex items-center gap-16 pr-4 text-[11px] font-bold">
                    <span>in</span>
                    <span>out</span>
                  </div>
                </div>

                <table className="w-full text-xs border-collapse">
                  <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px]">
                    <tr className="bg-white hover:bg-[#F1F5F9]">
                      <td className="py-2.5 px-3.5 font-sans font-bold text-gray-700 w-1/3">
                        SMTP
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-800 w-1/3 pr-12 font-medium">
                        1
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-gray-800 w-1/3 font-medium">
                        {kumoMetrics?.kumomta_smtp_connection_pool_active || 6}
                      </td>
                    </tr>
                    <tr className="bg-[#F9FAFB] hover:bg-[#F1F5F9]">
                      <td className="py-2 px-3.5 font-sans text-gray-500 w-1/3">
                        Idle connection pool
                      </td>
                      <td className="py-2 px-3 text-right text-gray-400 w-1/3 pr-12">
                        0
                      </td>
                      <td className="py-2 px-3.5 text-right text-gray-500 font-medium">
                        12
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* TABLE 4: Queue Totals */}
              <div className="border border-[#CCD2D8] rounded bg-white shadow-xs overflow-hidden">
                <div className="px-3.5 py-1.5 bg-[#9E9E9E] border-b-2 border-[#8B0000] text-white">
                  <span className="text-xs font-bold">Queue Totals</span>
                </div>

                <table className="w-full text-xs border-collapse">
                  <thead className="bg-[#EAEFF4] border-b border-[#CCD2D8] text-[11px] font-bold text-gray-600">
                    <tr>
                      <th className="py-1.5 px-3.5 text-right">recipients</th>
                      <th className="py-1.5 px-3 text-right">max</th>
                      <th className="py-1.5 px-3.5 text-right">% max</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px]">
                    <tr className="bg-white hover:bg-[#F1F5F9]">
                      <td className="py-2.5 px-3.5 text-right text-gray-800 font-bold">
                        {queue.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-700">
                        2,000,000
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-gray-600">
                        {((queue / 2000000) * 100).toFixed(2)}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>

            {/* ADMINISTRATION & RESOURCES FOOTER (Exact Screenshot 2 styling) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#CCD2D8] text-xs">
              <div>
                <h4 className="font-bold text-black text-sm mb-1.5">Administration</h4>
                <ul className="space-y-1 text-[#8B0000] font-sans">
                  <li>
                    <button
                      onClick={() => onNavigateTab?.('settings')}
                      className="hover:underline cursor-pointer text-left"
                    >
                      Edit configuration
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => onNavigateTab?.('settings')}
                      className="hover:underline cursor-pointer text-left"
                    >
                      Show/enter license key
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => onNavigateTab?.('infra-kumo')}
                      className="hover:underline cursor-pointer text-left"
                    >
                      Run command
                    </button>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-black text-sm mb-1.5">Resources</h4>
                <ul className="space-y-1 text-[#8B0000] font-sans">
                  <li>
                    <button
                      onClick={() => onNavigateTab?.('logs')}
                      className="hover:underline cursor-pointer text-left"
                    >
                      User's Guide
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => onNavigateTab?.('logs')}
                      className="hover:underline cursor-pointer text-left"
                    >
                      Port25 Support
                    </button>
                  </li>
                </ul>
              </div>
            </div>

          </div>
        )}

        {/* SECTION 3: RECENT DISPATCH TELEMETRY (Preserves all inspection & modals) */}
        <div className="p-4 md:p-6 bg-white border-t border-[#CCD2D8] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-800">
                Recent Message Telemetry
              </span>
              <p className="text-[11px] text-gray-500">
                Click any row to inspect RFC headers, bounce diagnostics, and delivery traces
              </p>
            </div>
            <button
              onClick={() => onNavigateTab?.('queue')}
              className="text-xs text-[#8B0000] hover:underline font-semibold flex items-center gap-1"
            >
              <span>View All in Messages</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto border border-[#CCD2D8] rounded">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-[#EAEFF4] border-b border-[#CCD2D8] text-[10px] uppercase font-bold text-gray-600 font-mono">
                <tr>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Recipient</th>
                  <th className="py-2 px-3 hidden sm:table-cell">Subject</th>
                  <th className="py-2 px-3 font-mono hidden md:table-cell">RFC Message-ID</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] font-sans text-xs">
                {recentMessages.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-400">
                      No recent messages. Use "Send Mail" to dispatch through the spool.
                    </td>
                  </tr>
                ) : (
                  recentMessages.slice(0, 6).map((msg) => (
                    <tr
                      key={msg.id}
                      onClick={() => onSelectMessage(msg)}
                      className="hover:bg-[#F1F5F9] cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-3">
                        <StatusBadge status={msg.status} />
                      </td>
                      <td className="py-2 px-3 font-mono text-gray-900 truncate max-w-[200px]">
                        {msg.toEmail}
                      </td>
                      <td className="py-2 px-3 text-gray-700 truncate max-w-[240px] hidden sm:table-cell">
                        {msg.subject || '(No Subject)'}
                      </td>
                      <td className="py-2 px-3 font-mono text-gray-500 text-[11px] truncate max-w-[180px] hidden md:table-cell">
                        {msg.messageId}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-[11px] font-semibold text-[#8B0000] hover:underline">
                          Inspect →
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
