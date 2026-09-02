import React from 'react';
import {
  LayoutDashboard,
  Send,
  Megaphone,
  MailCheck,
  Users,
  ShieldAlert,
  Server,
  BarChart3,
  Terminal,
  Settings,
  Radio,
  Cpu,
  Layers,
  LogOut,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'send'
  | 'campaigns'
  | 'messages'
  | 'contacts'
  | 'suppression'
  | 'senders'
  | 'analytics'
  | 'logs'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  kumoStatus?: 'healthy' | 'degraded' | 'offline';
  sesStatus?: 'healthy' | 'degraded' | 'offline';
  queueCount?: number;
  user?: { name?: string; email?: string; role?: string; plan?: string } | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  kumoStatus = 'healthy',
  sesStatus = 'healthy',
  queueCount = 14,
}) => {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'send' as NavTab, label: 'Send Email', icon: Send },
    { id: 'campaigns' as NavTab, label: 'Campaigns', icon: Megaphone },
    { id: 'messages' as NavTab, label: 'Messages', icon: MailCheck },
    { id: 'contacts' as NavTab, label: 'Contacts', icon: Users },
    { id: 'suppression' as NavTab, label: 'Suppression', icon: ShieldAlert },
    { id: 'senders' as NavTab, label: 'Senders & Domains', icon: Server },
    { id: 'analytics' as NavTab, label: 'Analytics', icon: BarChart3 },
    { id: 'logs' as NavTab, label: 'Technical Logs', icon: Terminal },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-60 bg-[#080808] border-r border-white-10 flex flex-col shrink-0 h-screen sticky top-0 overflow-y-auto font-sans">
      {/* Brand Header */}
      <div className="p-6 border-b border-white-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-white rounded-sm flex items-center justify-center text-black font-bold text-xs shadow-sm">
            EO
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-white tracking-tight">
              EmailOps
            </span>
            <span className="text-[9px] font-mono tracking-widest text-[#888888] uppercase">
              PROD
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#888888] mb-3 px-3">
          Operations
        </div>
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const active = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-sm text-xs font-medium transition-colors ${
                active
                  ? 'text-white bg-white/10 border border-white/10'
                  : 'text-[#888888] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-white' : 'bg-transparent'}`} />
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-[#888888]'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="pt-6 text-[10px] uppercase tracking-[0.2em] text-[#888888] mb-3 px-3">
          Audience & Compliance
        </div>
        {navItems.slice(4, 7).map((item) => {
          const Icon = item.icon;
          const active = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-sm text-xs font-medium transition-colors ${
                active
                  ? 'text-white bg-white/10 border border-white/10'
                  : 'text-[#888888] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-white' : 'bg-transparent'}`} />
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-[#888888]'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="pt-6 text-[10px] uppercase tracking-[0.2em] text-[#888888] mb-3 px-3">
          Infrastructure
        </div>
        {navItems.slice(7).map((item) => {
          const Icon = item.icon;
          const active = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-sm text-xs font-medium transition-colors ${
                active
                  ? 'text-white bg-white/10 border border-white/10'
                  : 'text-[#888888] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-white' : 'bg-transparent'}`} />
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-[#888888]'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Infrastructure Telemetry Footer */}
      <div className="p-4 border-t border-white-10 bg-[#050505]">
        <div className="p-3 rounded-sm border border-white-10 bg-[#0F0F0F] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#888888] flex items-center gap-1.5 text-[11px]">
              <Cpu className="w-3 h-3 text-[#888888]" /> KumoMTA Spool
            </span>
            <span className="flex items-center gap-1 text-emerald-400 font-mono text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              ONLINE
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-[#888888] flex items-center gap-1.5 text-[11px]">
              <Radio className="w-3 h-3 text-[#888888]" /> SES Relay
            </span>
            <span className="text-emerald-400 font-mono text-[10px]">250 OK</span>
          </div>

          <div className="pt-2 border-t border-white-5 flex items-center justify-between text-[10px] text-[#888888]">
            <span className="uppercase tracking-wider">Queue:</span>
            <span className="font-mono text-white font-semibold">{queueCount} msgs</span>
          </div>
        </div>

        {/* User Card & Logout */}
        <div className="mt-3 pt-3 border-t border-white-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-sm bg-white/10 border border-white/20 flex items-center justify-center text-[10px] font-mono text-white shrink-0">
              {user?.name
                ? user.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
                : user?.email ? user.email.substring(0, 2).toUpperCase() : 'OP'}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-white truncate">
                {user?.name || user?.email || 'Email Operator'}
              </div>
              <div className="text-[9px] text-[#888888] uppercase tracking-wider flex items-center gap-1.5">
                <span>{user?.role || 'ADMIN'}</span>
                <span className="text-white/20">•</span>
                <span className="text-emerald-400 font-mono text-[9px]">{user?.plan || 'PRO'}</span>
              </div>
            </div>
          </div>

          {onLogout && (
            <button
              id="btn-sidebar-logout"
              onClick={onLogout}
              className="p-1.5 rounded text-[#888888] hover:text-red-400 hover:bg-white/5 transition-colors shrink-0"
              title="Sign Out of EmailOps"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
