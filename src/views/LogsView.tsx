import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  RefreshCw,
  Search,
  Filter,
  Play,
  Pause,
  Copy,
  Check,
  Download,
  Trash2,
  Send,
  CornerDownLeft,
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
  const [copiedAll, setCopiedAll] = useState(false);
  const [cliInput, setCliInput] = useState('');
  const [cliHistory, setCliHistory] = useState<Array<{ cmd: string; output: string }>>([
    {
      cmd: 'cd /home/opc/emailin-ops',
      output: '',
    },
    {
      cmd: 'pmta show status',
      output: 'PowerMTA Engine 5.0r8 (build 20260901) - Status: ONLINE\nListening on 0.0.0.0:2525 (SMTP Inbound), 127.0.0.1:8080 (Management HTTP)\nOutbound Queues: Active | Threads: 16 | Concurrency: Unthrottled',
    },
    {
      cmd: 'git status --short',
      output: ' M /etc/pmta/config\n M /var/spool/pmta/queues.dat\n?? /var/log/pmta/acct.csv',
    },
  ]);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      onRefresh();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const raw = logs.map(l => `[${new Date(l.timestamp).toISOString()}] [${l.service}] [${l.severity}] ${l.event} - ${l.response}`).join('\n');
    navigator.clipboard.writeText(raw);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `powermta_audit_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchor.click();
  };

  const executeCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cliInput.trim();
    if (!cmd) return;

    let response = '';
    const lower = cmd.toLowerCase();

    if (lower === 'clear') {
      setCliHistory([]);
      setCliInput('');
      return;
    } else if (lower.includes('pmta show status') || lower === 'status') {
      response = 'PowerMTA 5.0r8 - Daemon Status: ONLINE\nUptime: 18d 04h 22m\nInbound Connections: 1 active\nOutbound Connections: 6 active\nSpool Messages: ' + logs.length + ' processed';
    } else if (lower.includes('pmta show queues') || lower === 'queues') {
      response = 'DOMAIN             IN QUEUE   L.RECIP    CONN   RATE(1m)   STATUS\ngmail.com                 0         0       4       42.5   Normal\nyahoo.com                 0         0       2       18.2   Normal\noutlook.com               0         0       2       15.1   Normal';
    } else if (lower.includes('pmta show vmtas') || lower === 'vmtas') {
      response = 'VMTA                IP ADDRESS       DOMAIN        STATUS\ndefault             192.0.2.10       *             UP\npool-bulk-1         192.0.2.11       gmail.com     UP\npool-trans-1        192.0.2.12       *             UP';
    } else if (lower.includes('git status')) {
      response = 'On branch main\nYour branch is up to date with \'origin/main\'.\n\nnothing to commit, working tree clean';
    } else if (lower.includes('tail') || lower.includes('cat')) {
      response = logs.slice(0, 5).map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.severity} ${l.service}: ${l.response}`).join('\n');
    } else {
      response = `Command executed: ${cmd}\n[OK] Exit code 0`;
    }

    setCliHistory(prev => [...prev, { cmd, output: response }]);
    setCliInput('');
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
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto font-sans">
      {/* PowerMTA Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#CCD2D8]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8B1A10]" />
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              PowerMTA Live Audit &amp; Terminal Console
            </h1>
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
              }`}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Real-time event stream from PowerMTA spool, KumoMTA engine nodes, and SMTP protocol sockets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition ${
              autoRefresh
                ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
                : 'bg-white text-gray-600 border-[#CCD2D8] hover:bg-gray-50'
            }`}
          >
            {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{autoRefresh ? 'Streaming (3s)' : 'Paused'}</span>
          </button>

          <button
            onClick={handleCopyAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-gray-50 text-gray-700 border border-[#CCD2D8] text-xs font-semibold transition"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAll ? 'Copied' : 'Copy All'}</span>
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-gray-50 text-gray-700 border border-[#CCD2D8] text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#8B1A10] hover:bg-[#A81D14] text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Bar (PowerMTA High Contrast Styling) */}
      <div className="p-3 bg-white rounded border border-[#CCD2D8] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs by keyword, event, or Message-ID..."
            className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded pl-9 pr-4 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-[#8B1A10] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-1.5 text-xs text-gray-800 focus:outline-none"
          >
            <option value="ALL">All Services</option>
            <option value="KumoMTA">PowerMTA / Kumo</option>
            <option value="Amazon SES">Amazon SES Relay</option>
            <option value="Webhook Ingestor">Webhook Ingestor</option>
            <option value="Tracking Service">Tracking Service</option>
            <option value="Application">Application Engine</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-1.5 text-xs text-gray-800 focus:outline-none"
          >
            <option value="ALL">All Severities</option>
            <option value="INFO">INFO</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>

          <button
            onClick={() => {
              setSearch('');
              setServiceFilter('ALL');
              setSeverityFilter('ALL');
            }}
            className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* EXACT LINUX CRT TERMINAL (HEADER & BODY) AS REQUESTED IN SCREENSHOT */}
      <div className="rounded-lg bg-black border border-[#1b3d1b] font-mono text-xs overflow-hidden shadow-2xl">
        {/* Terminal Header Bar (Black with green accent & Linux bash prompt title) */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#050505] border-b border-[#0f2e14] text-[#00FF66] font-mono select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block opacity-80" />
              <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block opacity-80" />
              <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block opacity-80" />
            </div>
            <span className="text-[11px] font-bold text-[#00FF66] tracking-tight truncate">
              [opc@pmta emailin-ops]$ /var/log/pmta/acct.csv --follow
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-[#00FF66]/70 hidden sm:inline">
              opc@pmta: ~/emailin-ops (bash)
            </span>
            <span className="text-[10px] bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/30 px-2 py-0.5 rounded font-mono">
              {filtered.length} entries
            </span>
          </div>
        </div>

        {/* Terminal Body: Pure Black Background with Vibrant Green Monospace Text */}
        <div className="p-4 bg-black text-[#00FF66] font-mono text-[11px] leading-relaxed space-y-1.5 max-h-[640px] overflow-y-auto selection:bg-[#00FF66] selection:text-black">
          {/* Static Boot & Context Banner matching user screenshot */}
          <div className="text-[#00FF66]/75 pb-2 border-b border-[#0f2e14] space-y-0.5">
            <div>===== POWERMTA / KUMOMTA TELEMETRY SERVICE =====</div>
            <div>[opc@pmta emailin-ops]$ cd /home/opc/emailin-ops</div>
            <div>[opc@pmta emailin-ops]$ pmta show status --short</div>
            <div className="text-[#00FF66]">PowerMTA 5.0r8 daemon: running (pid 14022) | listening: 0.0.0.0:2525</div>
          </div>

          {/* Interactive Shell Command History */}
          {cliHistory.map((item, idx) => (
            <div key={idx} className="space-y-0.5 pt-1">
              <div className="text-[#00FF66] flex items-center gap-1.5">
                <span className="text-[#00FF66] font-bold">[opc@pmta emailin-ops]$</span>
                <span>{item.cmd}</span>
              </div>
              {item.output && (
                <div className="text-[#00FF66]/90 whitespace-pre-wrap pl-2 border-l border-[#00FF66]/20 py-0.5">
                  {item.output}
                </div>
              )}
            </div>
          ))}

          {/* Streaming Log Records in Exact Terminal Monospace Style */}
          <div className="pt-2 space-y-1">
            <div className="text-[#00FF66] font-bold">[opc@pmta emailin-ops]$ tail -f /var/log/pmta/acct.csv</div>
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-[#00FF66]/50">
                [NO RECORDS MATCHING ACTIVE BUFFER FILTER]
              </div>
            ) : (
              filtered.map((l) => {
                const isErr = l.severity === 'ERROR';
                const isWarn = l.severity === 'WARN';
                const isSuccess = l.severity === 'SUCCESS';

                return (
                  <div
                    key={l.id}
                    className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 p-1.5 rounded hover:bg-[#00FF66]/5 transition-colors group"
                  >
                    <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                      <span className="text-[#00FF66]/60 text-[10px] shrink-0">
                        {new Date(l.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase shrink-0 ${
                          isErr
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : isWarn
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : isSuccess
                            ? 'bg-[#00FF66]/20 text-[#00FF66] border border-[#00FF66]/40'
                            : 'bg-[#00FF66]/10 text-[#00FF66]/80'
                        }`}
                      >
                        {l.severity}
                      </span>
                      <span className="text-[#00FF66]/70 text-[10px] shrink-0">[{l.service}]</span>
                      <span className="font-bold text-[#00FF66]">{l.event}</span>
                      <span className="text-[#00FF66]/90 break-all">{l.response}</span>
                      {l.messageId && (
                        <span className="text-[#00FF66]/50 text-[10px]">
                          id={l.messageId.slice(0, 16)}...
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleCopy(JSON.stringify(l, null, 2), l.id)}
                      className="opacity-0 group-hover:opacity-100 text-[#00FF66]/60 hover:text-[#00FF66] text-[10px] transition shrink-0 self-end sm:self-auto"
                      title="Copy raw log record"
                    >
                      {copiedId === l.id ? '[COPIED]' : '[COPY]'}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Interactive Shell Command Input Prompt at Terminal Bottom */}
          <form onSubmit={executeCommand} className="pt-3 flex items-center gap-2 border-t border-[#0f2e14]">
            <span className="text-[#00FF66] font-bold shrink-0">[opc@pmta emailin-ops]$</span>
            <input
              type="text"
              value={cliInput}
              onChange={(e) => setCliInput(e.target.value)}
              placeholder="pmta show status, pmta show queues, git status, clear..."
              className="flex-1 bg-transparent text-[#00FF66] font-mono text-xs focus:outline-none placeholder:text-[#00FF66]/30 caret-[#00FF66]"
            />
            <span className="inline-block w-2 h-4 bg-[#00FF66] animate-pulse"></span>
            <button
              type="submit"
              className="px-2 py-0.5 bg-[#00FF66]/20 hover:bg-[#00FF66]/30 text-[#00FF66] text-[10px] rounded border border-[#00FF66]/40 flex items-center gap-1"
            >
              <span>EXEC</span>
              <CornerDownLeft className="w-3 h-3" />
            </button>
          </form>
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
};

