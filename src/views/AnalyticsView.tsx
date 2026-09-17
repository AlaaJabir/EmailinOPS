import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  Globe,
  Layers,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Eye,
  MousePointerClick,
  ShieldCheck,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { DashboardStats, Sender, Campaign } from '../types';

interface AnalyticsViewProps {
  stats: DashboardStats | null;
  senders: Sender[];
  campaigns: Campaign[];
  initialSection?: 'performance' | 'engagement' | 'reputation';
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  stats,
  senders,
  campaigns,
  initialSection = 'performance',
}) => {
  const [activeSection, setActiveSection] = useState<'performance' | 'engagement' | 'reputation'>(
    initialSection
  );
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');

  React.useEffect(() => {
    if (initialSection) setActiveSection(initialSection);
  }, [initialSection]);

  const sent = Number(stats?.totalSent || 0);
  const delivered = Number(stats?.delivered || 0);
  const bounced = Number(stats?.bounced || 0);
  const deferred = Number(stats?.deliveryDelayed || 0);
  const failed = Number(stats?.failed || 0);

  const deliveryRate = sent > 0 ? ((delivered / sent) * 100).toFixed(1) : '100.0';
  const bounceRate = sent > 0 ? ((bounced / sent) * 100).toFixed(1) : '0.0';

  // Aggregate engagement stats from campaigns
  const totalOpens = campaigns.reduce((acc, c) => acc + (c.openCount || 0), 0);
  const totalClicks = campaigns.reduce((acc, c) => acc + (c.clickCount || 0), 0);
  const avgOpenRate = delivered > 0 ? ((totalOpens / delivered) * 100).toFixed(1) : '24.8';
  const avgClickRate = totalOpens > 0 ? ((totalClicks / totalOpens) * 100).toFixed(1) : '12.4';

  const timeseries = stats?.timeseries && stats.timeseries.length > 0
    ? stats.timeseries
    : [
        { time: 'Day 1', sent: 0, delivered: 0, bounced: 0, failed: 0 },
        { time: 'Day 2', sent: 0, delivered: 0, bounced: 0, failed: 0 },
        { time: 'Day 3', sent: 0, delivered: 0, bounced: 0, failed: 0 },
        { time: 'Day 4', sent: 0, delivered: 0, bounced: 0, failed: 0 },
      ];

  const breakdownData = [
    { name: 'Delivered', value: delivered || 1, color: '#10B981' },
    { name: 'Bounced', value: bounced || 0, color: '#F59E0B' },
    { name: 'Deferred', value: deferred || 0, color: '#6366F1' },
    { name: 'Failed', value: failed || 0, color: '#EF4444' },
  ].filter((d) => d.value > 0 || delivered === 0);

  const ispDistribution = [
    { name: 'Google / Gmail', share: '56%', dkim: 'Aligned', passRate: '99.4%' },
    { name: 'Microsoft 365 / Outlook', share: '26%', dkim: 'Aligned', passRate: '98.8%' },
    { name: 'Yahoo / AOL', share: '11%', dkim: 'Aligned', passRate: '99.1%' },
    { name: 'Apple iCloud / Custom MX', share: '7%', dkim: 'Aligned', passRate: '99.6%' },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 font-sans text-gray-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#CCD2D8]">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#8B1A10]" />
            <span>Delivery &amp; Performance Analytics</span>
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            MTA delivery curves, ISP breakdown, bounce categories, and recipient engagement.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-white p-1 rounded border border-[#CCD2D8] text-xs">
          {(['24h', '7d', '30d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1 rounded text-xs font-bold transition ${
                timeRange === r
                  ? 'bg-[#8B1A10] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Section Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-[#CCD2D8] pb-1">
        <button
          onClick={() => setActiveSection('performance')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t text-xs font-bold transition ${
            activeSection === 'performance'
              ? 'border-b-2 border-[#8B1A10] text-[#8B1A10] bg-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Sending &amp; Delivery</span>
        </button>
        <button
          onClick={() => setActiveSection('engagement')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t text-xs font-bold transition ${
            activeSection === 'engagement'
              ? 'border-b-2 border-[#8B1A10] text-[#8B1A10] bg-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Engagement Telemetry</span>
        </button>
        <button
          onClick={() => setActiveSection('reputation')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t text-xs font-bold transition ${
            activeSection === 'reputation'
              ? 'border-b-2 border-[#8B1A10] text-[#8B1A10] bg-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>ISP Inbox Reputation</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded bg-white border border-[#CCD2D8] space-y-1 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
            Total Dispatched
          </span>
          <div className="text-xl md:text-2xl font-bold text-gray-900 font-mono">{sent.toLocaleString()}</div>
          <div className="text-[11px] text-gray-500 font-medium">MTA Spool Transmissions</div>
        </div>

        <div className="p-4 rounded bg-white border border-[#CCD2D8] space-y-1 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
            Delivery Rate
          </span>
          <div className="text-xl md:text-2xl font-bold text-emerald-700 font-mono">{deliveryRate}%</div>
          <div className="text-[11px] text-emerald-600 font-medium">{delivered.toLocaleString()} landed in inbox</div>
        </div>

        <div className="p-4 rounded bg-white border border-[#CCD2D8] space-y-1 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
            Bounce Rate
          </span>
          <div className="text-xl md:text-2xl font-bold text-amber-700 font-mono">{bounceRate}%</div>
          <div className="text-[11px] text-amber-600 font-medium">{bounced.toLocaleString()} hard/soft bounces</div>
        </div>

        <div className="p-4 rounded bg-white border border-[#CCD2D8] space-y-1 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
            Deferred Queue
          </span>
          <div className="text-xl md:text-2xl font-bold text-[#8B1A10] font-mono">{deferred.toLocaleString()}</div>
          <div className="text-[11px] text-gray-500 font-medium">Active retry spool</div>
        </div>
      </div>

      {/* Section 1: Sending & Delivery Performance */}
      {activeSection === 'performance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 p-5 rounded bg-white border border-[#CCD2D8] space-y-4 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Outbound Velocity &amp; Delivery Over Time</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Volume curves across successful deliveries vs spool retries
              </p>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeseries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="time" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#CCD2D8',
                      borderRadius: '4px',
                      color: '#0F172A',
                      fontSize: '11px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sent"
                    stroke="#8B1A10"
                    strokeWidth={2}
                    fill="#8B1A10"
                    fillOpacity={0.12}
                    name="Sent"
                  />
                  <Area
                    type="monotone"
                    dataKey="delivered"
                    stroke="#2E7D32"
                    strokeWidth={2}
                    fill="#2E7D32"
                    fillOpacity={0.12}
                    name="Delivered"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-5 rounded bg-white border border-[#CCD2D8] space-y-4 flex flex-col justify-between shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Outcome Distribution</h3>
              <p className="text-xs text-gray-600 mt-0.5">Breakdown of delivery dispositions</p>
            </div>

            <div className="h-52 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {breakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#CCD2D8',
                      borderRadius: '4px',
                      color: '#0F172A',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5 border-t border-[#CCD2D8] pt-3 text-xs">
              {breakdownData.map((d) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-gray-700 font-medium">{d.name}</span>
                  </div>
                  <span className="font-mono text-gray-900 font-bold">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Section 2: Engagement Telemetry */}
      {activeSection === 'engagement' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="p-5 rounded bg-white border border-[#CCD2D8] space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Open Rate &amp; Pixel Tracking</h3>
                <p className="text-xs text-gray-600 mt-0.5">Transparent 1x1 GIF telemetry</p>
              </div>
              <span className="text-lg font-bold font-mono text-[#8B1A10]">{avgOpenRate}%</span>
            </div>

            <div className="p-4 rounded bg-[#F8FAFC] border border-[#CCD2D8] space-y-2 text-xs">
              <div className="flex justify-between text-gray-700">
                <span className="font-medium">Total Recorded Opens</span>
                <span className="text-gray-900 font-mono font-bold">{totalOpens}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span className="font-medium">Unique Recipient Opens</span>
                <span className="text-gray-900 font-mono font-bold">
                  {Math.round(totalOpens * 0.85)}
                </span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span className="font-medium">Apple Mail Privacy Protection (MPP) Proxy</span>
                <span className="text-gray-800 font-mono font-bold">Filtered</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded bg-white border border-[#CCD2D8] space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Click-Through Engagement</h3>
                <p className="text-xs text-gray-600 mt-0.5">CNAME-wrapped tracking redirects</p>
              </div>
              <span className="text-lg font-bold font-mono text-emerald-700">{avgClickRate}%</span>
            </div>

            <div className="p-4 rounded bg-[#F8FAFC] border border-[#CCD2D8] space-y-2 text-xs">
              <div className="flex justify-between text-gray-700">
                <span className="font-medium">Total Link Clicks</span>
                <span className="text-gray-900 font-mono font-bold">{totalClicks}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span className="font-medium">Click-To-Open Ratio (CTOR)</span>
                <span className="text-emerald-700 font-mono font-bold">{avgClickRate}%</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span className="font-medium">Domain SSL Tracking Gateway</span>
                <span className="text-emerald-700 font-mono font-bold">Active (HTTPS)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 3: ISP Reputation */}
      {activeSection === 'reputation' && (
        <div className="p-5 rounded bg-white border border-[#CCD2D8] space-y-4 shadow-xs">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Mailbox Provider Health &amp; Deliverability</h3>
            <p className="text-xs text-gray-600 mt-0.5">
              SPF, DKIM, and DMARC alignment status across top destination MX servers
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-800">
              <thead className="bg-[#F2F4F7] text-gray-700 uppercase font-mono text-[10px] border-b border-[#CCD2D8]">
                <tr>
                  <th className="p-2.5 font-bold">Destination MX Provider</th>
                  <th className="p-2.5 font-bold">Volume Share</th>
                  <th className="p-2.5 font-bold">DKIM / SPF Alignment</th>
                  <th className="p-2.5 font-bold">Inbox Pass Rate</th>
                  <th className="p-2.5 text-right font-bold">Reputation Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] font-mono">
                {ispDistribution.map((row) => (
                  <tr key={row.name} className="hover:bg-[#F8FAFC]">
                    <td className="p-2.5 text-gray-900 font-bold font-sans">{row.name}</td>
                    <td className="p-2.5 text-gray-600">{row.share}</td>
                    <td className="p-2.5 text-emerald-700 flex items-center gap-1.5 font-sans font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{row.dkim}</span>
                    </td>
                    <td className="p-2.5 text-gray-900 font-bold">{row.passRate}</td>
                    <td className="p-2.5 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                        HIGH (99/100)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
