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
  Download,
  AlertCircle,
} from 'lucide-react';
import { ServiceLog } from '../types';

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

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `emailinops_audit_${new Date().toISOString()}.json`);
    dlAnchor.click();
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
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <span>Technical Audit &amp; MTA Logs</span>
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefresh ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]' : 'bg-slate-500'
              }`}
            />
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time event stream from KumoMTA spool nodes, Amazon SES SMTP relay, and webhook ingestors.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              autoRefresh
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-[#162032] text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{autoRefresh ? 'Streaming Live' : 'Paused'}</span>
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#162032] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-medium transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 rounded-lg bg-[#111827] border border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs by event, keyword, or Message-ID..."
            className="w-full bg-[#0A0F1A] border border-slate-800 rounded-md pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500/60 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Service Filter */}
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="bg-[#0A0F1A] border border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
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
            className="bg-[#0A0F1A] border border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
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
      <div className="rounded-lg bg-[#0B0F19] border border-slate-800/90 font-mono text-xs overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-3.5 bg-[#0E1524] border-b border-slate-800 text-slate-400 font-sans">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-white text-xs">Syslog &amp; SMTP Protocol Stream</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">{filtered.length} entries</span>
        </div>

        <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto font-mono text-[11px]">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-sans">
              No matching log records found in buffer.
            </div>
          ) : (
            filtered.map((l) => {
              const sevColor =
                l.severity === 'ERROR'
                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                  : l.severity === 'WARN'
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  : l.severity === 'SUCCESS'
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';

              return (
                <div
                  key={l.id}
                  className="p-2.5 rounded bg-[#111827]/60 border border-slate-800/60 hover:border-slate-700 transition flex flex-col md:flex-row md:items-start justify-between gap-2"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-500 text-[10px]">
                        {new Date(l.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${sevColor}`}>
                        {l.severity}
                      </span>
                      <span className="text-slate-400 text-[10px] bg-slate-800/60 px-1.5 py-0.5 rounded">
                        {l.service}
                      </span>
                      <span className="text-white font-medium text-[11px]">{l.event}</span>
                    </div>

                    <div className="text-slate-300 break-all text-[11px] pl-2 border-l border-slate-800">
                      {l.response}
                    </div>

                    {l.messageId && (
                      <div className="text-slate-500 text-[10px]">
                        Message-ID: <span className="text-slate-400">{l.messageId}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleCopy(JSON.stringify(l, null, 2), l.id)}
                    className="self-end md:self-start p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition"
                    title="Copy Raw Log Event"
                  >
                    {copiedId === l.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
