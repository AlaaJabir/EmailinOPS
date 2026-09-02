import React, { useState, useEffect } from 'react';
import {
  Terminal,
  RefreshCw,
  Search,
  Filter,
  Play,
  Pause,
  Copy,
  Check,
  Cpu,
  Radio,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { ServiceLog } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface LogsViewProps {
  logs: ServiceLog[];
  onRefresh: () => void;
  isLoading: boolean;
}

export const LogsView: React.FC<LogsViewProps> = ({ logs, onRefresh, isLoading }) => {
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      onRefresh();
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = logs.filter((l) => {
    const matchesSearch =
      !search ||
      l.event.toLowerCase().includes(search.toLowerCase()) ||
      l.response.toLowerCase().includes(search.toLowerCase()) ||
      (l.messageId && l.messageId.toLowerCase().includes(search.toLowerCase()));

    const matchesService = serviceFilter === 'ALL' || l.service === serviceFilter;
    const matchesSeverity = severityFilter === 'ALL' || l.severity === severityFilter;

    return matchesSearch && matchesService && matchesSeverity;
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif italic text-white tracking-tight flex items-center gap-2">
            Technical Audit & Service Logs
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-white animate-pulse' : 'bg-[#888888]'}`} />
          </h1>
          <p className="text-xs text-[#888888] mt-1">
            Real-time event stream from KumoMTA spool nodes, Amazon SES SMTP relay, and webhook ingestors
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors ${
              autoRefresh
                ? 'bg-white text-black border-white'
                : 'bg-[#0F0F0F] text-[#888888] border-white-10 hover:text-white'
            }`}
          >
            {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{autoRefresh ? 'Live Streaming' : 'Paused'}</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[#0F0F0F] hover:bg-white/10 text-white text-xs font-medium border border-white-10 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-sm bg-[#0F0F0F] border border-white-10 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs by event, keyword, or RFC Message-ID..."
            className="w-full bg-[#050505] border border-white-10 rounded-sm pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-[#888888] focus:border-white/30 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Service Filter */}
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none"
          >
            <option value="ALL">All Services</option>
            <option value="KumoMTA">KumoMTA</option>
            <option value="Amazon SES">Amazon SES</option>
            <option value="Webhook Ingestor">Webhook Ingestor</option>
            <option value="Tracking Service">Tracking Service</option>
            <option value="Application">Application</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none"
          >
            <option value="ALL">All Severities</option>
            <option value="INFO">INFO</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>
        </div>
      </div>

      {/* Terminal Logs Stream */}
      <div className="p-6 rounded-sm bg-[#050505] border border-white-10 font-mono text-xs space-y-3 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-white-10 text-[#888888] font-sans">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-white" />
            <span className="font-semibold text-white text-xs">Syslog & SMTP Protocol Stream</span>
          </div>
          <span className="text-[11px] font-mono text-[#888888]">{filtered.length} entries</span>
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-[#888888]">No log events recorded matching the current filter.</div>
          ) : (
            filtered.map((log) => {
              let sevColor = 'text-[#888888] bg-white/5 border-white-10';
              if (log.severity === 'SUCCESS') sevColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
              if (log.severity === 'INFO') sevColor = 'text-sky-400 bg-sky-500/10 border-sky-500/20';
              if (log.severity === 'WARN') sevColor = 'text-amber-300 bg-amber-500/10 border-amber-500/20';
              if (log.severity === 'ERROR') sevColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';

              return (
                <div
                  key={log.id}
                  className="p-3.5 rounded-sm bg-[#0F0F0F] border border-white-10 hover:border-white/20 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-3"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="text-[#888888]">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-xs bg-white/5 text-zinc-300 border border-white-10 font-medium">
                        {log.service}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-xs border font-medium ${sevColor}`}>
                        {log.severity}
                      </span>
                      <span className="text-white font-medium">{log.event}</span>
                    </div>

                    <div className="text-zinc-300 text-xs pt-1 leading-relaxed break-all font-mono">
                      {log.response}
                    </div>

                    {log.messageId && (
                      <div className="text-[11px] text-[#888888] flex items-center gap-2 pt-0.5 font-mono">
                        <span>Message-ID:</span>
                        <span className="text-white">{log.messageId}</span>
                        <button
                          onClick={() => handleCopy(log.messageId!, `log_${log.id}`)}
                          className="hover:text-white"
                        >
                          {copiedId === `log_${log.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
