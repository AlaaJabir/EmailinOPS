import React, { useState, useEffect } from 'react';
import { Terminal, Download, Copy, Play, Pause, RotateCcw, Check, Server, FileText, Activity } from 'lucide-react';

interface PowerMtaServerViewProps {
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  addToast: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export const PowerMtaServerView: React.FC<PowerMtaServerViewProps> = ({ authFetch, addToast }) => {
  const [serverStatus, setServerStatus] = useState<any>(null);
  const [configText, setConfigText] = useState('');
  const [cliCommand, setCliCommand] = useState('pmta show status');
  const [cliOutput, setCliOutput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await authFetch('/api/pmta/status');
      if (res.ok) {
        const d = await res.json();
        setServerStatus(d);
      }
    } catch {}
  };

  const loadConfig = async () => {
    try {
      const res = await authFetch('/api/pmta/config-export');
      if (res.ok) {
        const text = await res.text();
        setConfigText(text);
      }
    } catch {}
  };

  useEffect(() => {
    loadStatus();
    loadConfig();
    runCliCommand('pmta show status');
  }, []);

  const handleSpoolCommand = async (command: string) => {
    try {
      const res = await authFetch('/api/pmta/spool/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Command failed');
      addToast('info', 'Spool Action', d.message);
      loadStatus();
      runCliCommand(`pmta show status`);
    } catch (e: any) {
      addToast('error', 'Spool Action Failed', e.message);
    }
  };

  const runCliCommand = async (customCmd?: string) => {
    const cmd = (customCmd || cliCommand).trim();
    if (!cmd) return;
    setIsExecuting(true);
    try {
      const res = await authFetch('/api/pmta/cli-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
      const d = await res.json();
      setCliOutput(d.output || 'Command executed with no output.');
    } catch (e: any) {
      setCliOutput(`Error executing command: ${e.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(configText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    addToast('success', 'Copied pmta.conf', 'PowerMTA configuration copied to clipboard.');
  };

  const handleDownloadConfig = () => {
    const blob = new Blob([configText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pmta.conf';
    a.click();
    URL.revokeObjectURL(url);
    addToast('info', 'Downloaded pmta.conf', 'Configuration ready to deploy to /etc/pmta/config.');
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-[#E8ECEF] min-h-[calc(100vh-3.5rem)] font-sans text-gray-800">
      <div className="max-w-[1240px] mx-auto bg-white rounded-lg shadow-md border border-[#C5CED6] overflow-hidden">
        
        {/* PowerMTA Top Crimson Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-gradient-to-r from-[#8B1A10] via-[#A81D14] to-[#75110B] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#E0A328]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-black/25 flex items-center justify-center text-white border border-white/20 shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <span>PowerMTA Server &amp; Spool Management</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/30 border border-white/20 text-[#FFD54F]">
                  Daemon CLI
                </span>
              </h1>
              <p className="text-[11px] text-gray-200 mt-0.5 hidden sm:block">
                Daemon runtime status, live queue control, pmta.conf config generator, and management CLI console.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleSpoolCommand(serverStatus?.status === 'PAUSED' ? 'resume' : 'pause')}
              className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition shadow-xs ${
                serverStatus?.status === 'PAUSED'
                  ? 'bg-[#2E7D32] hover:bg-[#1B5E20] text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              {serverStatus?.status === 'PAUSED' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{serverStatus?.status === 'PAUSED' ? 'Resume Outbound Spool' : 'Pause Outbound Spool'}</span>
            </button>
            <button
              onClick={() => handleSpoolCommand('flush')}
              className="px-3 py-1.5 bg-[#37474F] hover:bg-[#263238] rounded text-xs font-semibold text-white flex items-center gap-1.5 transition shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Flush Spool</span>
            </button>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {/* Daemon Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#F8FAFC] border border-[#CCD2D8] rounded p-4 space-y-1 shadow-2xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">PowerMTA Engine</span>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-gray-900 font-mono">
                  {serverStatus?.version?.split(' ')[1] || '5.0r8'}
                </span>
                <span className="px-2 py-0.5 rounded bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold uppercase border border-[#C8E6C9]">
                  {serverStatus?.status || 'ONLINE'}
                </span>
              </div>
              <div className="text-[11px] text-gray-600 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-[#2E7D32]" />
                <span>Uptime: {serverStatus?.uptime || '18d 4h'}</span>
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#CCD2D8] rounded p-4 space-y-1 shadow-2xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Inbound SMTP Port</span>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-gray-900 font-mono">
                  Port {serverStatus?.smtpPort || 2525}
                </span>
                <span className="px-2 py-0.5 rounded bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold border border-[#C8E6C9]">
                  LISTENING
                </span>
              </div>
              <div className="text-[11px] text-gray-600">Relay binding: 0.0.0.0:2525</div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#CCD2D8] rounded p-4 space-y-1 shadow-2xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Spool Queue Depth</span>
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-gray-900 font-mono">
                  {serverStatus?.spoolCount || 0}
                </span>
                <span className="text-xs text-gray-600 font-medium">msgs queued</span>
              </div>
              <div className="text-[11px] text-gray-600">
                Speed: {serverStatus?.deliveryRatePerSec || 0} msgs/sec
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#CCD2D8] rounded p-4 space-y-1 shadow-2xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">License Status</span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">Enterprise Cluster</span>
                <span className="px-2 py-0.5 rounded bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold border border-[#C8E6C9]">
                  VERIFIED
                </span>
              </div>
              <div className="text-[11px] text-gray-600">Expires: Dec 31, 2028</div>
            </div>
          </div>

          {/* Interactive PowerMTA CLI (Exact Linux CRT Terminal) */}
          <div className="rounded-lg bg-black border border-[#1b3d1b] font-mono text-xs overflow-hidden shadow-2xl">
            {/* Terminal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-2.5 bg-[#050505] border-b border-[#0f2e14] text-[#00FF66] font-mono select-none gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block opacity-80" />
                  <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block opacity-80" />
                  <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block opacity-80" />
                </div>
                <span className="text-[11px] font-bold text-[#00FF66] tracking-tight truncate">
                  [opc@pmta emailin-ops]$ pmta command-line interface
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => {
                    setCliCommand('pmta show status');
                    runCliCommand('pmta show status');
                  }}
                  className="text-[10px] px-2 py-0.5 rounded bg-[#00FF66]/10 hover:bg-[#00FF66]/20 text-[#00FF66] border border-[#00FF66]/30 font-mono transition"
                >
                  pmta show status
                </button>
                <button
                  onClick={() => {
                    setCliCommand('pmta show queues');
                    runCliCommand('pmta show queues');
                  }}
                  className="text-[10px] px-2 py-0.5 rounded bg-[#00FF66]/10 hover:bg-[#00FF66]/20 text-[#00FF66] border border-[#00FF66]/30 font-mono transition"
                >
                  pmta show queues
                </button>
                <button
                  onClick={() => {
                    setCliCommand('pmta show vmtas');
                    runCliCommand('pmta show vmtas');
                  }}
                  className="text-[10px] px-2 py-0.5 rounded bg-[#00FF66]/10 hover:bg-[#00FF66]/20 text-[#00FF66] border border-[#00FF66]/30 font-mono transition"
                >
                  pmta show vmtas
                </button>
              </div>
            </div>

            {/* Terminal Body */}
            <div className="p-4 bg-black text-[#00FF66] font-mono text-xs space-y-3">
              <div className="flex items-center gap-2 bg-[#050505] px-3 py-2 rounded border border-[#0f2e14]">
                <span className="text-[#00FF66] font-bold select-none">[opc@pmta emailin-ops]$</span>
                <input
                  type="text"
                  value={cliCommand}
                  onChange={(e) => setCliCommand(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runCliCommand()}
                  placeholder="Enter PowerMTA command (e.g. pmta show queues)..."
                  className="w-full bg-transparent text-[#00FF66] font-mono focus:outline-none placeholder:text-[#00FF66]/30 caret-[#00FF66]"
                />
                <span className="inline-block w-2 h-4 bg-[#00FF66] animate-pulse"></span>
                <button
                  onClick={() => runCliCommand()}
                  disabled={isExecuting}
                  className="px-3 py-1 bg-[#00FF66]/20 hover:bg-[#00FF66]/30 text-[#00FF66] border border-[#00FF66]/40 font-bold rounded text-xs transition disabled:opacity-50"
                >
                  {isExecuting ? 'Running...' : 'EXEC'}
                </button>
              </div>

              <pre className="p-4 rounded bg-black border border-[#0f2e14] text-[#00FF66] font-mono text-[11px] overflow-x-auto min-h-[160px] leading-relaxed select-text selection:bg-[#00FF66] selection:text-black">
                {cliOutput}
              </pre>
            </div>
          </div>

          {/* pmta.conf Generator & Exporter */}
          <div className="border border-[#CCD2D8] rounded bg-white shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-[#9E9E9E] border-b-2 border-[#8B0000] text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#FFD54F]" />
                <h3 className="font-bold text-white text-sm">Configuration Generator (/etc/pmta/config)</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyConfig}
                  className="px-3 py-1 rounded text-xs font-semibold bg-white text-gray-800 hover:bg-gray-100 flex items-center gap-1.5 transition shadow-xs"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Copied' : 'Copy Config'}</span>
                </button>
                <button
                  onClick={handleDownloadConfig}
                  className="px-3 py-1 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download pmta.conf</span>
                </button>
              </div>
            </div>

            <div className="p-4 bg-[#F8FAFC]">
              <pre className="p-4 rounded bg-white border border-[#CCD2D8] text-gray-800 text-xs font-mono overflow-x-auto max-h-[350px] leading-relaxed">
                {configText}
              </pre>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
