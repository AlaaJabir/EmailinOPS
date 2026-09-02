import React from 'react';
import {
  Bell,
  Sparkles,
  Search,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface HeaderProps {
  onSimulateTraffic: () => void;
  isSimulating: boolean;
  onSearchGlobal?: (query: string) => void;
  onOpenQuickSend: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSimulateTraffic,
  isSimulating,
  onOpenQuickSend,
}) => {
  return (
    <header className="h-16 bg-[#050505] border-b border-white-10 px-8 flex items-center justify-between sticky top-0 z-30 font-sans">
      <div className="flex items-center gap-6 flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search messages by RFC Message-ID, recipient, subject, or campaign..."
            className="w-full bg-[#0F0F0F] border border-white-10 rounded-sm pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-[#888888] focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-5">
        {/* Status Indicators from Design HTML */}
        <div className="hidden md:flex items-center gap-5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-[#888888] uppercase tracking-wider">KumoMTA Connected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-[#888888] uppercase tracking-wider">SES Relay Active</span>
          </div>
        </div>

        <div className="h-4 w-px bg-white-10 hidden md:block" />

        {/* Live Traffic Simulator Trigger */}
        <button
          id="btn-simulate-traffic"
          onClick={onSimulateTraffic}
          disabled={isSimulating}
          className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white-10 transition-all disabled:opacity-50"
          title="Injects a burst of test emails through KumoMTA spool to test real-time monitoring"
        >
          <Zap className={`w-3.5 h-3.5 ${isSimulating ? 'text-amber-400 animate-spin' : 'text-amber-400'}`} />
          <span>{isSimulating ? 'Simulating...' : 'Simulate Batch'}</span>
        </button>

        {/* Quick Send Button */}
        <button
          id="btn-quick-send"
          onClick={onOpenQuickSend}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-sm transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-black" />
          <span>Quick Dispatch</span>
        </button>
      </div>
    </header>
  );
};
