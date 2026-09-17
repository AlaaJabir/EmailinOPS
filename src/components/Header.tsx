import React from 'react';
import {
  Menu,
  RefreshCw,
  Send,
  Zap,
  ChevronRight,
  Server,
  Activity,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { NavTab } from './Sidebar';

interface HeaderProps {
  currentTab: NavTab;
  onOpenQuickSend: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  onToggleMobileSidebar: () => void;
  kumoStatus?: 'healthy' | 'degraded' | 'offline';
  sesStatus?: 'healthy' | 'degraded' | 'offline';
  queueCount?: number;
  throughputPerSec?: number;
  lastUpdated?: Date;
  activeInConnections?: number;
  activeOutConnections?: number;
}

const tabTitles: Record<string, { group: string; title: string }> = {
  dashboard: { group: 'Core MTA', title: 'Management Console & Web Monitor' },
  campaigns: { group: 'Dispatch', title: 'Campaigns & Broadcasts' },
  send: { group: 'Dispatch', title: 'Compose & Send Mail' },
  templates: { group: 'Dispatch', title: 'Message Templates' },
  queue: { group: 'Message Spool', title: 'Outbound Queue' },
  'delivery-sent': { group: 'Message Spool', title: 'Sent Transmissions' },
  'delivery-delivered': { group: 'Message Spool', title: 'Delivered Messages' },
  'delivery-deferred': { group: 'Message Spool', title: 'Deferred / Retrying' },
  'delivery-bounced': { group: 'Message Spool', title: 'Bounced Messages' },
  'delivery-failed': { group: 'Message Spool', title: 'Failed Messages' },
  contacts: { group: 'Recipients', title: 'Lists & Audiences' },
  'contacts-import': { group: 'Recipients', title: 'Import Contacts' },
  suppression: { group: 'Recipients', title: 'Bounce Suppression' },
  'analytics-performance': { group: 'Telemetry', title: 'Throughput & Performance' },
  'analytics-engagement': { group: 'Telemetry', title: 'Engagement Metrics' },
  'analytics-reputation': { group: 'Telemetry', title: 'ISP Reputation & Feedback' },
  'infra-kumo': { group: 'Infrastructure', title: 'KumoMTA Spool & Telemetry' },
  'infra-smtp': { group: 'Infrastructure', title: 'SMTP Relay & Listeners' },
  'system-health': { group: 'Infrastructure', title: 'System Health' },
  'settings-general': { group: 'Configuration', title: 'General & Licensing' },
  'email-config': { group: 'Configuration', title: 'Senders & Domains' },
  optimization: { group: 'Configuration', title: 'Throttling & Pacing' },
  'settings-account': { group: 'Configuration', title: 'Account Settings' },
  // Legacy aliases
  vmtas: { group: 'Infrastructure', title: 'Virtual MTAs & IP Pools' },
  deliverability: { group: 'Infrastructure', title: 'DNS & Authentication' },
  policies: { group: 'Configuration', title: 'Throttling & Policies' },
  messages: { group: 'Message Spool', title: 'Message Spool & Logs' },
  serverConfig: { group: 'Configuration', title: 'Server Config & CLI' },
  installation: { group: 'Documentation', title: 'Architecture & Guide' },
  pricing: { group: 'Plan', title: 'Capacity & Pricing' },
  senders: { group: 'Configuration', title: 'Senders & Domains' },
  analytics: { group: 'Telemetry', title: 'Deliverability Analytics' },
  logs: { group: 'Telemetry', title: 'Service Telemetry & Logs' },
  settings: { group: 'Configuration', title: 'System Settings' },
  storage: { group: 'Configuration', title: 'Storage & Assets' },
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenQuickSend,
  onRefresh,
  isLoading = false,
  onToggleMobileSidebar,
  kumoStatus = 'healthy',
  queueCount = 0,
  throughputPerSec = 0,
  lastUpdated = new Date(),
  activeInConnections = 1,
  activeOutConnections = 6,
}) => {
  const breadcrumb = tabTitles[currentTab] || { group: 'PowerMTA', title: 'Management Console' };

  return (
    <header className="h-14 bg-white border-b border-[#CCD2D8] border-t-2 border-t-[#8B1A10] px-3 sm:px-5 flex items-center justify-between sticky top-0 z-20 shrink-0 shadow-xs font-sans">
      {/* Left side: Hamburger + Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-1.5 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs text-gray-600 min-w-0">
          <span className="hidden sm:inline font-bold text-[#8B1A10] uppercase tracking-wider text-[11px]">
            {breadcrumb.group}
          </span>
          <ChevronRight className="hidden sm:inline w-3 h-3 text-gray-400 shrink-0" />
          <h1 className="text-xs sm:text-sm font-bold text-gray-800 truncate">
            {breadcrumb.title}
          </h1>
          <span className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569] text-[10px] font-mono border border-[#CBD5E1]">
            fe.int.port25.com
          </span>
        </div>
      </div>

      {/* Right side: Real-time Speed, Connections, Queue, Refresh & Quick Send */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* REAL-TIME SPEED METER (Throughput emails/sec) */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#F0FDF4] border border-[#BBF7D0] text-xs font-mono shadow-2xs"
          title="Real-time Outbound Delivery Speed"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
          </span>
          <span className="text-gray-600 text-[10px] font-sans font-bold uppercase hidden xs:inline">
            Speed:
          </span>
          <span className="font-extrabold text-[#15803D] text-xs sm:text-sm">
            {throughputPerSec > 0 ? throughputPerSec.toFixed(1) : '0.0'}
          </span>
          <span className="text-gray-500 text-[10px]">msg/s</span>
        </div>

        {/* Active Connections Widget (In / Out) */}
        <div
          className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded bg-[#F8FAFC] border border-[#CBD5E1] text-[11px] font-mono text-gray-700"
          title="Active SMTP Connections"
        >
          <span className="text-[10px] uppercase font-bold text-gray-500 font-sans">SMTP:</span>
          <span>in: <b className="text-gray-900">{activeInConnections}</b></span>
          <span className="text-gray-300">|</span>
          <span>out: <b className="text-[#8B1A10]">{activeOutConnections}</b></span>
        </div>

        {/* Queue Count Widget */}
        <div
          className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-[#FFFBEB] border border-[#FDE68A] text-[11px] font-mono text-[#92400E]"
          title="Current Spool Queue size"
        >
          <span className="text-[10px] uppercase font-bold font-sans">Queue:</span>
          <span className="font-bold">{queueCount.toLocaleString()}</span>
        </div>

        {/* Real-time Refresh Indicator */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded bg-white hover:bg-gray-100 text-gray-700 border border-[#CCD2D8] transition shadow-2xs disabled:opacity-50 flex items-center gap-1"
            title="Refresh PowerMTA Console (Live 3s polling active)"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#8B1A10]' : 'text-gray-600'}`} />
            <span className="hidden xl:inline text-[10px] font-mono text-gray-500">Live</span>
          </button>
        )}

        {/* Quick Send CTA (PowerMTA green button) */}
        <button
          onClick={onOpenQuickSend}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-white text-xs font-bold bg-[#2E7D32] hover:bg-[#1B5E20] shadow-xs transition"
          title="Compose and dispatch email through spool"
        >
          <Send className="w-3 h-3" />
          <span className="hidden sm:inline">Send Mail</span>
        </button>
      </div>
    </header>
  );
};
