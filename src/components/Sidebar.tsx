import React, { useState } from 'react';
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
  // Legacy aliases to prevent any breaks
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
  user,
  onLogout,
  isOpenMobile = false,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const groups = [
    {
      title: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'SENDING',
      items: [
        { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
        { id: 'send', label: 'Compose', icon: Send },
        { id: 'templates', label: 'Templates', icon: FileCode2 },
      ],
    },
    {
      title: 'DELIVERY',
      items: [
        { id: 'queue', label: 'Queue', icon: Inbox, badge: queueCount > 0 ? queueCount : undefined },
        { id: 'delivery-sent', label: 'Sent', icon: Mail },
        { id: 'delivery-delivered', label: 'Delivered', icon: CheckCircle2 },
        { id: 'delivery-deferred', label: 'Deferred', icon: Clock },
        { id: 'delivery-bounced', label: 'Bounced', icon: AlertTriangle },
        { id: 'delivery-failed', label: 'Failed', icon: XCircle },
      ],
    },
    {
      title: 'CONTACTS',
      items: [
        { id: 'contacts', label: 'Lists', icon: Users },
        { id: 'contacts-import', label: 'Import', icon: UploadCloud },
      ],
    },
    {
      title: 'ANALYTICS',
      items: [
        { id: 'analytics-performance', label: 'Performance', icon: BarChart3 },
        { id: 'analytics-engagement', label: 'Engagement', icon: HeartHandshake },
        { id: 'analytics-reputation', label: 'Reputation', icon: ShieldCheck },
      ],
    },
    {
      title: 'INFRASTRUCTURE',
      items: [
        { id: 'infra-kumo', label: 'KumoMTA', icon: Server },
        { id: 'infra-smtp', label: 'SMTP', icon: Network },
        { id: 'system-health', label: 'System Health', icon: Activity },
      ],
    },
    {
      title: 'SETTINGS',
      items: [
        { id: 'settings-general', label: 'General', icon: Sliders },
        { id: 'email-config', label: 'Email Configuration', icon: Mail },
        { id: 'optimization', label: 'AI / Optimization', icon: ShieldCheck },
        { id: 'settings-account', label: 'Account', icon: UserCheck },
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
    if (id === 'optimization' && currentTab === 'policies') return true;
    if (id === 'system-health' && currentTab === 'deliverability') return true;
    if (id === 'settings-general' && (currentTab === 'settings' || currentTab === 'logs')) return true;
    return false;
  };

  const isHealthy = kumoStatus.toLowerCase() === 'healthy';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0D131F] text-slate-300 font-sans select-none">
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80 shrink-0 bg-[#0A0F1A]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
            <Server className="w-4 h-4" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <span className="font-extrabold text-base tracking-tight text-white block truncate">
                Emailin<span className="text-indigo-400">OPS</span>
              </span>
              <span className="text-[9px] uppercase font-mono tracking-wider text-slate-400 block -mt-0.5 truncate">
                Command Center
              </span>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Desktop collapse toggle */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto overflow-x-hidden">
        {groups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!isCollapsed && (
              <div className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
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
                    className={`w-full flex items-center gap-3 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all group ${
                      active
                        ? 'bg-indigo-600/15 text-white border border-indigo-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        active ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-300'
                      }`}
                    />
                    {!isCollapsed && (
                      <span className="truncate flex-1 text-left">{item.label}</span>
                    )}
                    {!isCollapsed && 'badge' in item && item.badge !== undefined && (
                      <span className="ml-auto px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
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

      {/* Bottom Infrastructure Status Card */}
      <div className="p-3 border-t border-slate-800/80 bg-[#0A0F1A] space-y-2.5 shrink-0">
        {!isCollapsed ? (
          <div className="p-2.5 rounded-lg bg-[#111827] border border-slate-800 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-semibold text-[11px] tracking-tight">KumoMTA</span>
              <span
                className={`inline-flex items-center gap-1 font-mono text-[10px] font-semibold ${
                  isHealthy ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isHealthy ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]' : 'bg-amber-400'
                  }`}
                />
                {isHealthy ? 'HEALTHY' : 'DEGRADED'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
              <span>Spool Queue</span>
              <span className="text-slate-300 font-semibold">{queueCount} in flight</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title={`KumoMTA: ${isHealthy ? 'HEALTHY' : 'DEGRADED'}`}>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isHealthy ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]' : 'bg-amber-400'
              }`}
            />
          </div>
        )}

        {/* User Account Strip */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
              {(user?.name || user?.email || 'U')[0].toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200 truncate">
                  {user?.name || user?.email?.split('@')[0] || 'Operator'}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {user?.email || 'admin@emailinops.io'}
                </div>
              </div>
            )}
          </div>
          {onLogout && !isCollapsed && (
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
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
        className={`hidden md:flex flex-col shrink-0 h-screen sticky top-0 border-r border-slate-800/80 z-30 transition-all duration-200 ${
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
