import React from 'react';
import {
  LayoutDashboard,
  Megaphone,
  Send,
  FileCode2,
  Inbox,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Users,
  UploadCloud,
  BarChart3,
  HeartHandshake,
  ShieldCheck,
  Server,
  Network,
  Activity,
  Sliders,
  Mail,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
  Zap,
  Globe,
  Radio,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'campaigns'
  | 'send'
  | 'templates'
  | 'queue'
  | 'delivery-sent'
  | 'delivery-delivered'
  | 'delivery-deferred'
  | 'delivery-bounced'
  | 'delivery-failed'
  | 'contacts'
  | 'contacts-import'
  | 'analytics-performance'
  | 'analytics-engagement'
  | 'analytics-reputation'
  | 'infra-kumo'
  | 'infra-smtp'
  | 'system-health'
  | 'settings-general'
  | 'email-config'
  | 'optimization'
  | 'settings-account'
  // Legacy aliases
  | 'vmtas'
  | 'deliverability'
  | 'policies'
  | 'messages'
  | 'suppression'
  | 'serverConfig'
  | 'installation'
  | 'pricing'
  | 'senders'
  | 'analytics'
  | 'logs'
  | 'settings'
  | 'storage';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  kumoStatus?: string;
  sesStatus?: string;
  queueCount?: number;
  throughputPerSec?: number;
  user?: { name?: string; email?: string; role?: string; plan?: string } | null;
  onLogout?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  kumoStatus = 'healthy',
  queueCount = 0,
  throughputPerSec = 0,
  user,
  onLogout,
  isOpenMobile = false,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  // PowerMTA Enterprise Categories & Navigation Items
  const groups = [
    {
      title: 'CORE MTA CONSOLE',
      items: [
        { id: 'dashboard', label: 'Management Console', icon: LayoutDashboard },
        { id: 'infra-kumo', label: 'Spool & Nodes (Kumo)', icon: Server },
        { id: 'vmtas', label: 'Virtual MTAs & Pools', icon: Globe },
      ],
    },
    {
      title: 'DISPATCH & CAMPAIGNS',
      items: [
        { id: 'send', label: 'Compose Mail', icon: Send },
        { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
        { id: 'templates', label: 'Templates', icon: FileCode2 },
      ],
    },
    {
      title: 'MESSAGE SPOOL & QUEUES',
      items: [
        {
          id: 'queue',
          label: 'Outbound Queue',
          icon: Inbox,
          badge: queueCount > 0 ? queueCount : undefined,
          badgeColor: 'bg-[#C98B18]',
        },
        { id: 'delivery-sent', label: 'Sent Messages', icon: Mail },
        { id: 'delivery-delivered', label: 'Delivered', icon: CheckCircle2 },
        { id: 'delivery-deferred', label: 'Deferred / Retrying', icon: Clock },
        { id: 'delivery-bounced', label: 'Bounced Messages', icon: AlertTriangle },
        { id: 'delivery-failed', label: 'Failed Transmissions', icon: XCircle },
      ],
    },
    {
      title: 'RECIPIENTS & HYGIENE',
      items: [
        { id: 'contacts', label: 'Lists & Audiences', icon: Users },
        { id: 'contacts-import', label: 'Import Contacts', icon: UploadCloud },
        { id: 'suppression', label: 'Suppression List', icon: ShieldCheck },
      ],
    },
    {
      title: 'TELEMETRY & REPORTING',
      items: [
        { id: 'analytics-performance', label: 'Sending Performance', icon: BarChart3 },
        { id: 'analytics-engagement', label: 'Engagement Analytics', icon: HeartHandshake },
        { id: 'analytics-reputation', label: 'ISP Reputation', icon: Activity },
      ],
    },
    {
      title: 'INFRASTRUCTURE & RELAYS',
      items: [
        { id: 'infra-smtp', label: 'SMTP Listeners & Relay', icon: Network },
        { id: 'deliverability', label: 'DNS & Authentication', icon: ShieldCheck },
        { id: 'system-health', label: 'System Health', icon: Radio },
      ],
    },
    {
      title: 'MTA CONFIGURATION',
      items: [
        { id: 'settings-general', label: 'General & Licensing', icon: Sliders },
        { id: 'email-config', label: 'Senders & Domains', icon: Mail },
        { id: 'policies', label: 'Throttling & Pacing', icon: ShieldCheck },
        { id: 'logs', label: 'Service Logs', icon: FileCode2 },
      ],
    },
  ] as const;

  const isItemActive = (id: string) => {
    if (currentTab === id) return true;
    if (id === 'queue' && (currentTab === 'messages' || currentTab === 'queue')) return true;
    if (id === 'send' && currentTab === 'send') return true;
    if (id === 'contacts' && currentTab === 'contacts') return true;
    if (id === 'email-config' && currentTab === 'senders') return true;
    if (id === 'infra-kumo' && (currentTab === 'vmtas' || currentTab === 'serverConfig')) return true;
    if (id === 'policies' && currentTab === 'optimization') return true;
    if (id === 'system-health' && currentTab === 'deliverability') return true;
    if (id === 'settings-general' && currentTab === 'settings') return true;
    return false;
  };

  const isHealthy = kumoStatus.toLowerCase() === 'healthy';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#1A2330] text-[#CBD5E1] font-sans select-none border-r border-[#2C384A]">
      {/* POWERMTA BRAND HEADER */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-[#2C384A] shrink-0 bg-[#141C27]">
        <div className="flex items-center gap-2 min-w-0">
          {/* Mechanical Cog Icon */}
          <div className="relative flex items-center select-none shrink-0">
            <svg className="w-7 h-7 text-[#7E8896] -mr-2.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
              <path
                fillRule="evenodd"
                d="M10.29 2.15a1.5 1.5 0 011.42 0l.78.45a1.5 1.5 0 001.5 0l.78-.45a1.5 1.5 0 011.42 0l1.37.79a1.5 1.5 0 01.75 1.3v.9a1.5 1.5 0 00.75 1.3l.78.45a1.5 1.5 0 01.75 1.3v1.58a1.5 1.5 0 01-.75 1.3l-.78.45a1.5 1.5 0 00-.75 1.3v.9a1.5 1.5 0 01-.75 1.3l-1.37.79a1.5 1.5 0 01-1.42 0l-.78-.45a1.5 1.5 0 00-1.5 0l-.78.45a1.5 1.5 0 01-1.42 0l-1.37-.79a1.5 1.5 0 01-.75-1.3v-.9a1.5 1.5 0 00-.75-1.3l-.78-.45a1.5 1.5 0 01-.75-1.3V9.71a1.5 1.5 0 01.75-1.3l.78-.45a1.5 1.5 0 00.75-1.3v-.9a1.5 1.5 0 01.75-1.3l1.37-.79z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xl font-black tracking-tight text-[#D32F2F] lowercase drop-shadow-xs">
              power
            </span>
            <span className="text-xl font-black tracking-tight text-white uppercase">
              MTA
            </span>
          </div>

          {!isCollapsed && (
            <div className="min-w-0 pl-1">
              <span className="text-[9px] uppercase font-mono font-bold tracking-widest text-[#E0A328] block truncate">
                PORT25 OPS
              </span>
              <span className="text-[10px] text-gray-400 block truncate -mt-0.5">
                v1.5c1 Enterprise
              </span>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#2C384A] transition"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Desktop collapse toggle */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex p-1 rounded hover:bg-[#2C384A] text-gray-400 hover:text-white transition"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* REAL-TIME SPEED TICKER IN SIDEBAR */}
      {!isCollapsed && (
        <div className="px-3 py-2 bg-gradient-to-r from-[#212B3B] to-[#1B2433] border-b border-[#2C384A] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-gray-300 font-semibold text-[10px] uppercase tracking-wider">
              Speed:
            </span>
            <span className="text-emerald-400 font-bold">
              {throughputPerSec > 0 ? throughputPerSec.toFixed(1) : '0.0'}
            </span>
            <span className="text-gray-400 text-[9px]">msg/s</span>
          </div>
          <span className="text-[10px] font-mono text-[#E0A328] bg-[#C98B18]/20 px-1.5 py-0.5 rounded border border-[#C98B18]/30">
            LIVE
          </span>
        </div>
      )}

      {/* Navigation Rubriques */}
      <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto overflow-x-hidden">
        {groups.map((group) => (
          <div key={group.title} className="space-y-0.5">
            {!isCollapsed && (
              <div className="px-2 pb-1 text-[9px] font-bold tracking-wider text-[#7E8B9B] uppercase font-mono border-b border-[#243040] mb-1">
                {group.title}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isItemActive(item.id);
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id as NavTab);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all group ${
                      active
                        ? 'bg-gradient-to-r from-[#8B1A10] via-[#A81D14] to-[#B7241A] text-white shadow-xs border-l-3 border-[#E0A328]'
                        : 'text-[#94A3B8] hover:text-white hover:bg-[#243040] border-l-3 border-transparent'
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                        active ? 'text-[#FFD54F]' : 'text-[#7E8B9B] group-hover:text-gray-200'
                      }`}
                    />
                    {!isCollapsed && (
                      <span className="truncate flex-1 text-left">{item.label}</span>
                    )}
                    {!isCollapsed && 'badge' in item && item.badge !== undefined && (
                      <span
                        className={`ml-auto px-1.5 py-0.2 rounded text-[10px] font-mono font-bold text-white shadow-xs ${
                          (item as any).badgeColor || 'bg-[#8B1A10]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* BOTTOM NODE STATUS & USER FOOTER */}
      <div className="p-2.5 border-t border-[#2C384A] bg-[#141C27] space-y-2 shrink-0">
        {!isCollapsed ? (
          <div className="p-2 rounded bg-[#1B2533] border border-[#2A374A] space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-300 font-bold text-[11px] tracking-tight">fe.int.port25.com</span>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-b from-[#86EFAC] via-[#22C55E] to-[#15803D] shadow-[0_0_6px_#22c55e]" />
                <span className="text-[10px] font-mono font-bold text-emerald-400">ONLINE</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-[#243142] font-mono">
              <span>Spool Queue:</span>
              <span className="text-[#E0A328] font-bold">{queueCount.toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title={`PowerMTA Node: ${isHealthy ? 'ONLINE' : 'DEGRADED'}`}>
            <span className="w-3 h-3 rounded-full bg-gradient-to-b from-[#86EFAC] via-[#22C55E] to-[#15803D] shadow-[0_0_6px_#22c55e]" />
          </div>
        )}

        {/* User Account Strip */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded bg-[#2C384A] border border-[#3E4D63] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              {(user?.name || user?.email || 'A')[0].toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="text-xs font-semibold text-gray-200 truncate">
                  {user?.name || user?.email?.split('@')[0] || 'Administrator'}
                </div>
                <div className="text-[9px] text-gray-400 font-mono truncate">
                  Port25 Operator
                </div>
              </div>
            )}
          </div>
          {onLogout && !isCollapsed && (
            <button
              onClick={onLogout}
              className="p-1 text-gray-400 hover:text-rose-400 hover:bg-[#2C384A] rounded transition"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 h-screen sticky top-0 border-r border-[#2C384A] z-30 transition-all duration-200 ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
