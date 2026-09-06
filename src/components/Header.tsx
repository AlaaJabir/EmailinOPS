import React from 'react';
import { Search, Sparkles } from 'lucide-react';

interface HeaderProps {
  onSimulateTraffic?: () => void;
  isSimulating?: boolean;
  onSearchGlobal?: (query: string) => void;
  onOpenQuickSend: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenQuickSend, onSearchGlobal }) => {
  const [query, setQuery] = React.useState('');
  return <header className="h-16 bg-[#050505] border-b border-white-10 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 font-sans">
    <div className="flex items-center gap-6 flex-1 max-w-2xl">
      <div className="relative w-full">
        <Search className="w-3.5 h-3.5 text-[#666] absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={query} onChange={e => { setQuery(e.target.value); onSearchGlobal?.(e.target.value); }} type="search" placeholder="Search messages, recipients, subjects or campaigns…" className="w-full bg-[#0F0F0F] border border-white-10 rounded-sm pl-9 pr-4 py-2 text-xs text-white placeholder:text-[#666] focus:outline-none focus:border-white/30 transition-colors" />
      </div>
    </div>
    <button id="btn-quick-send" onClick={onOpenQuickSend} className="flex items-center gap-2 px-3.5 py-2 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-sm transition-colors ml-4"><Sparkles className="w-3.5 h-3.5"/><span>Quick Dispatch</span></button>
  </header>;
};
