import React from 'react';
import {
  Activity,
  Server,
  ShieldCheck,
  Gauge,
  Send,
  Megaphone,
  MailCheck,
  Users,
  ShieldAlert,
  Terminal,
  Settings,
  FileCode2,
  LogOut,
  BookOpen,
  DollarSign,
  Layers,
  Globe,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'vmtas'
  | 'deliverability'
  | 'policies'
  | 'send'
  | 'campaigns'
  | 'templates'
  | 'messages'
  | 'contacts'
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  queueCount = 0,
  user,
  onLogout,
}) => {
  const groups = [
    {
      label: 'PowerMTA Engine',
      items: [
        ['dashboard', 'Spool Monitor', Activity],
        ['vmtas', 'VirtualMTAs & Pools', Layers],
        ['deliverability', 'DNS & Deliverability', ShieldCheck],
        ['policies', 'Speed Throttling', Gauge],
      ],
    },
    {
      label: 'Email Marketer',
      items: [
        ['send', 'Quick Compose', Send],
        ['campaigns', 'Campaigns', Megaphone],
        ['templates', 'Templates', FileCode2],
        ['messages', 'Message Spool', MailCheck],
      ],
    },
    {
      label: 'Audience & Hygiene',
      items: [
        ['contacts', 'Contacts & Lists', Users],
        ['suppression', 'Bounce & Suppression', ShieldAlert],
      ],
    },
    {
      label: 'Management & Setup',
      items: [
        ['serverConfig', 'Server & CLI Console', Terminal],
        ['installation', 'Installation Guide', BookOpen],
        ['pricing', 'Pricing & Plans', DollarSign],
        ['senders', 'Senders & Domains', Globe],
        ['settings', 'Settings & API', Settings],
      ],
    },
  ] as const;

  return (
    <aside className="w-64 bg-[#1e2631] text-gray-200 border-r border-gray-800 flex flex-col shrink-0 h-screen sticky top-0 overflow-y-auto font-sans select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-gray-800 bg-[#171e27]">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full bg-[#8cc052] shadow-[0_0_10px_#8cc052]" />
          <span className="font-extrabold text-lg tracking-wider text-white">
            PowerMTA<span className="text-[#8cc052]">.PW</span>
          </span>
        </div>
        <div className="text-[10px] uppercase font-bold tracking-[0.16em] text-gray-400 mt-1 pl-[22px]">
          Enterprise Delivery &amp; Marketer
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-4">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 px-3 pb-1.5 font-bold">
              {g.label}
            </div>
            <div className="space-y-0.5">
              {g.items.map(([id, label, Icon]) => {
                const active = currentTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => onSelectTab(id as NavTab)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold transition-all ${
                      active
                        ? 'bg-[#8cc052] text-white shadow-sm'
                        : 'text-gray-300 hover:bg-[#253140] hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-400'}`} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Daemon Status Footer */}
      <div className="p-4 border-t border-gray-800 bg-[#171e27] space-y-3">
        <div className="p-2.5 rounded bg-[#1e2631] border border-gray-700/60 space-y-1.5 text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">PowerMTA Daemon</span>
            <span className="text-[#8cc052] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8cc052]" />
              ONLINE
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-gray-400">
            <span>Port 2525 / 25</span>
            <span className="text-gray-300 font-mono">LISTENING</span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-gray-400 pt-1 border-t border-gray-800">
            <span>Queue In-Flight</span>
            <span className="text-white font-mono font-bold">{Number(queueCount) || 0} msgs</span>
          </div>
        </div>

        {/* User Card */}
        <div className="flex items-center justify-between pt-1">
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">
              {user?.name || user?.email || 'MTA Admin'}
            </div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">
              {user?.role || 'ADMIN'} · {user?.plan || 'ENTERPRISE'}
            </div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-1.5 text-gray-400 hover:text-red-400 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
