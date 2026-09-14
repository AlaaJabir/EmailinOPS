import React from 'react';
import { Search, Send, Activity, ShieldCheck, Zap } from 'lucide-react';

interface HeaderProps {
  onSimulateTraffic?: () => void;
  isSimulating?: boolean;
  onSearchGlobal?: (query: string) => void;
  onOpenQuickSend: () => void;
  queueCount?: number;
}

export const Header: React.FC<HeaderProps> = ({ onOpenQuickSend, onSearchGlobal, queueCount = 0 }) => {
  const [query, setQuery] = React.useState('');

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onSearchGlobal?.(e.target.value);
            }}
            type="search"
            placeholder="Search messages, recipient domains, virtual MTAs..."
            className="w-full bg-gray-50 border border-gray-300 rounded pl-9 pr-4 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#8cc052] focus:bg-white transition"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 ml-4">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded bg-[#f4faee] border border-[#c9e89b] text-xs font-semibold text-[#5b8c25]">
          <span className="w-2 h-2 rounded-full bg-[#8cc052] animate-pulse" />
          <span>PMTA Relay: 51.170.132.86:2525</span>
        </div>

        <button
          id="btn-quick-send"
          onClick={onOpenQuickSend}
          className="flex items-center gap-2 px-4 py-2 rounded bg-[#8cc052] hover:bg-[#7bb342] text-white text-xs font-bold shadow-sm transition"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Quick Dispatch</span>
        </button>
      </div>
    </header>
  );
};
