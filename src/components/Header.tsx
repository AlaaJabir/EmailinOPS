import React from 'react';
import { Search, Sparkles, Activity } from 'lucide-react';

interface HeaderProps {
  onSimulateTraffic?: () => void;
  isSimulating?: boolean;
  onSearchGlobal?: (query: string) => void;
  onOpenQuickSend: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenQuickSend, onSearchGlobal }) => {
  const [query, setQuery] = React.useState('');
  return <header className="h-14 bg-[#0a0d0c] border-b border-[#1e2825] px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 font-mono">
    <div className="flex items-center gap-5 flex-1 min-w-0">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#4a5a53] whitespace-nowrap hidden lg:block">// OPERATIONS</div>
      <div className="relative w-full max-w-xl">
        <Search className="w-3.5 h-3.5 text-[#4a5a53] absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={query} onChange={e => { setQuery(e.target.value); onSearchGlobal?.(e.target.value); }} type="search" placeholder="Search messages, recipients, subjects or campaigns…" className="w-full bg-[#0b0f0d] border border-[#1e2825] rounded-[4px] pl-9 pr-4 py-1.5 text-[10px] text-[#d8e6df] placeholder:text-[#4a5a53] focus:outline-none focus:border-[#39ff9c]/50 transition-colors" />
      </div>
    </div>
    <div className="flex items-center gap-3 ml-4">
      <span className="hidden md:flex items-center gap-1.5 text-[9px] text-[#39ff9c] uppercase tracking-wider"><Activity className="w-3 h-3"/>Live</span>
      <button id="btn-quick-send" onClick={onOpenQuickSend} className="flex items-center gap-2 px-3 py-1.5 rounded-[4px] bg-[#39ff9c] hover:shadow-[0_0_16px_rgba(57,255,156,.22)] text-[#03140b] text-[10px] font-bold transition-all"><Sparkles className="w-3 h-3"/><span>Quick Dispatch</span></button>
    </div>
  </header>;
};
