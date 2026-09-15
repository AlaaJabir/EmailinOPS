import React, { useState } from 'react';
import {
  Menu,
  RefreshCw,
  Bell,
  Send,
  Server,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Zap,
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
}

const tabTitles: Record<string, { group: string; title: string }> = {
  dashboard: { group: 'Overview', title: 'Dashboard' },
  campaigns: { group: 'Sending', title: 'Campaigns' },
  send: { group: 'Sending', title: 'Compose Email' },
  templates: { group: 'Sending', title: 'Templates' },
  queue: { group: 'Delivery', title: 'Outbound Queue' },
  'delivery-sent': { group: 'Delivery', title: 'Sent Messages' },
  'delivery-delivered': { group: 'Delivery', title: 'Delivered' },
  'delivery-deferred': { group: 'Delivery', title: 'Deferred / Retrying' },
  'delivery-bounced': { group: 'Delivery', title: 'Bounced Messages' },
  'delivery-failed': { group: 'Delivery', title: 'Failed Transmissions' },
  contacts: { group: 'Contacts', title: 'Lists & Audiences' },
  'contacts-import': { group: 'Contacts', title: 'Import Contacts' },
  'analytics-performance': { group: 'Analytics', title: 'Sending Performance' },
  'analytics-engagement': { group: 'Analytics', title: 'Engagement' },
  'analytics-reputation': { group: 'Analytics', title: 'ISP Reputation' },
  'infra-kumo': { group: 'Infrastructure', title: 'KumoMTA Node Operations' },
  'infra-smtp': { group: 'Infrastructure', title: 'SMTP Relay & Listeners' },
  'system-health': { group: 'Infrastructure', title: 'System Health' },
  'settings-general': { group: 'Settings', title: 'General & API Keys' },
  'email-config': { group: 'Settings', title: 'Email Configuration & Domains' },
  optimization: { group: 'Settings', title: 'Throttling & Optimization' },
  'settings-account': { group: 'Settings', title: 'Account Settings' },
  // Legacy aliases
  vmtas: { group: 'Infrastructure', title: 'VirtualMTAs & Pools' },
  deliverability: { group: 'Analytics', title: 'Reputation & DNS' },
  policies: { group: 'Settings', title: 'Throttling & Policies' },
  messages: { group: 'Delivery', title: 'Message Spool & Logs' },
  suppression: { group: 'Contacts', title: 'Bounce Suppression' },
  serverConfig: { group: 'Infrastructure', title: 'KumoMTA Server & CLI' },
  installation: { group: 'Documentation', title: 'Architecture & Guide' },
  pricing: { group: 'Plan', title: 'Capacity & Pricing' },
  senders: { group: 'Settings', title: 'Senders & Domains' },
  analytics: { group: 'Analytics', title: 'Deliverability Analytics' },
  logs: { group: 'System', title: 'Service Telemetry' },
  settings: { group: 'Settings', title: 'System Settings' },
  storage: { group: 'Settings', title: 'Storage & Assets' },
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenQuickSend,
  onRefresh,
  isLoading = false,
  onToggleMobileSidebar,
  kumoStatus = 'healthy',
  queueCount = 0,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const breadcrumb = tabTitles[currentTab] || { group: 'Operations', title: 'Console' };

  return (
    <header className="h-16 bg-[#0E1524] border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 shrink-0">
      {/* Left side: Hamburger + Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-400 min-w-0">
          <span className="hidden sm:inline font-medium text-slate-400">{breadcrumb.group}</span>
          <ChevronRight className="hidden sm:inline w-3.5 h-3.5 text-slate-600 shrink-0" />
          <h1 className="text-sm font-semibold text-white truncate">{breadcrumb.title}</h1>
        </div>
      </div>

      {/* Right side: Status indicator, refresh, compose button */}
      <div className="flex items-center gap-3 shrink-0">
        {/* KumoMTA status indicator */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981]" />
          <span>KumoMTA</span>
          <span className="text-emerald-500/70 font-sans">•</span>
          <span className="font-semibold text-emerald-300">HEALTHY</span>
        </div>

        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-md bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition disabled:opacity-50"
            title="Refresh dashboard data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        )}

        {/* Quick Send CTA */}
        <button
          onClick={onOpenQuickSend}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Compose</span>
        </button>
      </div>
    </header>
  );
};
