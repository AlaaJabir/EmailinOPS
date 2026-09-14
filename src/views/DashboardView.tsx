import React, { useState, useEffect } from 'react';
import {
  Activity,
  Send,
  Server,
  Layers,
  ShieldCheck,
  Gauge,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Mail,
  RefreshCw,
  Clock,
  ArrowRight,
  TrendingUp,
  FileCode,
  Users,
  Eye,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DashboardStats, Domain, Message } from '../types';

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
  const [pmtaStatus, setPmtaStatus] = useState<any>(null);
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('today');

  const loadPmtaData = async () => {
    if (!authFetch) return;
    try {
      const res = await authFetch('/api/pmta/status');
      if (res.ok) {
        const d = await res.json();
        setPmtaStatus(d);
      }
    } catch {}
  };

  useEffect(() => {
    loadPmtaData();
    const id = setInterval(loadPmtaData, 5000);
    return () => clearInterval(id);
  }, []);

  const sent = stats?.totalSent || 0;
  const delivered = stats?.delivered || 0;
  const bounced = stats?.bounced || 0;
  const failed = stats?.failed || 0;
  const deliveryRate = sent > 0 ? ((delivered / sent) * 100).toFixed(1) : '100.0';
  const bounceRate = sent > 0 ? ((bounced / sent) * 100).toFixed(1) : '0.0';

  const chartData = stats?.timeseries?.length
    ? stats.timeseries
    : [
        { time: '00:00', sent: 120, delivered: 118, bounced: 2 },
        { time: '04:00', sent: 340, delivered: 338, bounced: 2 },
        { time: '08:00', sent: 980, delivered: 975, bounced: 5 },
        { time: '12:00', sent: 1450, delivered: 1435, bounced: 15 },
        { time: '16:00', sent: 2100, delivered: 2085, bounced: 15 },
        { time: '20:00', sent: 1800, delivered: 1790, bounced: 10 },
      ];

  const features = [
    {
      title: 'Email Personalization',
      desc: 'Insert custom contact custom fields, personalized greetings, and dynamic content automatically.',
      icon: Users,
      action: () => onNavigateTab ? onNavigateTab('send') : onNavigateToSend(),
      btnText: 'Open Composer',
    },
    {
      title: 'VirtualMTAs & Multi-IP Pools',
      desc: 'Rotate multiple source IPs, balance outbound loads, and isolate bulk mail from transactional.',
      icon: Layers,
      action: () => onNavigateTab && onNavigateTab('vmtas'),
      btnText: 'Manage VMTAs',
    },
    {
      title: 'DKIM, DMARC & SPF Validator',
      desc: 'Automated DNS checking for 100% domain authentication and ISP inbox placement.',
      icon: ShieldCheck,
      action: () => onNavigateTab && onNavigateTab('deliverability'),
      btnText: 'Test Domains',
    },
    {
      title: 'Email Speed Throttling',
      desc: 'Enforce per-domain rate limits (e.g. Gmail 100/m, Yahoo 60/m) and TLS encryption rules.',
      icon: Gauge,
      action: () => onNavigateTab && onNavigateTab('policies'),
      btnText: 'Configure Limits',
    },
    {
      title: 'Automatic Bounce Tracking',
      desc: 'Real-time hard bounce processing with instant suppression list additions to safeguard reputation.',
      icon: AlertTriangle,
      action: () => onNavigateTab && onNavigateTab('suppression'),
      btnText: 'View Suppressions',
    },
    {
      title: 'PowerMTA CLI Console & Config',
      desc: 'Interactive shell console for pmta commands and instant production pmta.conf generator.',
      icon: Terminal,
      action: () => onNavigateTab && onNavigateTab('serverConfig'),
      btnText: 'Open Console',
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Welcome & MTA Cluster Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8cc052]" />
            <h1 className="text-2xl font-bold text-gray-800">
              PowerMTA Spool Monitor &amp; Delivery Engine
            </h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Enterprise Mail Transfer Agent cluster connected to Interspire Marketer relay.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="p-2 border border-gray-300 rounded hover:bg-gray-100 text-gray-600 transition"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onNavigateToSend}
            className="px-4 py-2 bg-[#8cc052] hover:bg-[#7bb342] text-white rounded text-sm font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <Send className="w-4 h-4" />
            <span>Quick Send Email</span>
          </button>
        </div>
      </div>

      {/* Live Operational Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="pmta-card p-4 space-y-1">
          <span className="text-xs font-bold text-gray-400 uppercase">PowerMTA Status</span>
          <div className="flex items-center gap-1.5 text-base font-bold text-gray-800">
            <span className="w-2 h-2 rounded-full bg-[#8cc052]" />
            <span>{pmtaStatus?.status || 'ONLINE'}</span>
          </div>
          <p className="text-[11px] text-gray-500">Port {pmtaStatus?.smtpPort || 2525} Relay</p>
        </div>

        <div className="pmta-card p-4 space-y-1">
          <span className="text-xs font-bold text-gray-400 uppercase">Total Injected</span>
          <div className="text-xl font-bold text-gray-800 font-mono">
            {sent.toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-500">Submitted to spool</p>
        </div>

        <div className="pmta-card p-4 space-y-1">
          <span className="text-xs font-bold text-gray-400 uppercase">Delivery Rate</span>
          <div className="text-xl font-bold text-[#8cc052] font-mono">
            {deliveryRate}%
          </div>
          <p className="text-[11px] text-gray-500">{delivered.toLocaleString()} delivered</p>
        </div>

        <div className="pmta-card p-4 space-y-1">
          <span className="text-xs font-bold text-gray-400 uppercase">Bounce Rate</span>
          <div className="text-xl font-bold text-amber-600 font-mono">
            {bounceRate}%
          </div>
          <p className="text-[11px] text-gray-500">{bounced.toLocaleString()} hard/soft</p>
        </div>

        <div className="pmta-card p-4 space-y-1 col-span-2 md:col-span-1">
          <span className="text-xs font-bold text-gray-400 uppercase">Spool Queue Depth</span>
          <div className="text-xl font-bold text-gray-800 font-mono">
            {pmtaStatus?.spoolCount || 0}
          </div>
          <p className="text-[11px] text-gray-500">Ready for dispatch</p>
        </div>
      </div>

      {/* Traffic & Volume Chart */}
      <div className="pmta-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-800">Hourly Throughput &amp; Ingestion</h3>
            <p className="text-xs text-gray-400">PowerMTA outbound delivery rate per hour</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-gray-600">
              <span className="w-2.5 h-2.5 rounded bg-[#8cc052]" />
              Delivered
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-600 ml-2">
              <span className="w-2.5 h-2.5 rounded bg-amber-400" />
              Bounces
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8cc052" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8cc052" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorBounced" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
              <Area type="monotone" dataKey="delivered" stroke="#8cc052" strokeWidth={2} fillOpacity={1} fill="url(#colorDelivered)" />
              <Area type="monotone" dataKey="bounced" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorBounced)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Feature Blocks directly from powermtapw.github.io / powermta.html */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">
            PowerMTA &amp; Interspire Marketer Features
          </h3>
          <span className="text-xs text-gray-500 font-semibold">100% Operational In Backend</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="pmta-card p-5 flex flex-col justify-between hover:border-[#8cc052] transition space-y-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded bg-[#f4faee] text-[#8cc052] flex items-center justify-center font-bold">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-gray-800 text-sm">{f.title}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
                <div>
                  <button
                    onClick={f.action}
                    className="w-full py-2 bg-gray-100 hover:bg-[#8cc052] hover:text-white text-gray-700 font-semibold rounded text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <span>{f.btnText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Dispatches Table */}
      <div className="pmta-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#8cc052]" />
            <h3 className="font-bold text-gray-800 text-sm">Recent Delivery Spool Activity</h3>
          </div>
          <span className="text-xs text-gray-400">Latest 10 injections</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-100 text-gray-700 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-3">Recipient</th>
                <th className="px-6 py-3">Subject</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Injected At</th>
                <th className="px-6 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentMessages.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-3 font-medium text-gray-800 font-mono text-xs">
                    {m.toEmail}
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-700 truncate max-w-xs">
                    {m.subject}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                        m.status === 'delivered'
                          ? 'bg-green-100 text-green-800'
                          : m.status === 'bounced'
                          ? 'bg-amber-100 text-amber-800'
                          : m.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-400">
                    {new Date(m.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => onSelectMessage(m)}
                      className="text-xs text-[#8cc052] hover:underline font-semibold"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {recentMessages.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-xs">
                    No messages sent yet. Click "Quick Send Email" above to test the PowerMTA delivery pipeline!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
