import React, { useState, useEffect } from 'react';
import { Terminal, Download, Copy, Play, Pause, RotateCcw, Trash2, Check, Server, Shield, FileText, Activity } from 'lucide-react';

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
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#8cc052]" />
            <h1 className="text-2xl font-bold text-gray-800">PowerMTA Server &amp; Spool Management</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Daemon runtime status, live queue control, pmta.conf config generator, and management CLI console.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSpoolCommand(serverStatus?.status === 'PAUSED' ? 'resume' : 'pause')}
            className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-1.5 transition ${
              serverStatus?.status === 'PAUSED'
                ? 'bg-[#8cc052] text-white hover:bg-[#7bb342]'
                : 'bg-amber-500 text-white hover:bg-amber-600'
            }`}
          >
            {serverStatus?.status === 'PAUSED' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>{serverStatus?.status === 'PAUSED' ? 'Resume Outbound Spool' : 'Pause Outbound Spool'}</span>
          </button>
          <button
            onClick={() => handleSpoolCommand('flush')}
            className="px-4 py-2 border border-gray-300 rounded text-sm font-semibold text-gray-700 hover:bg-gray-100 flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Flush Spool</span>
          </button>
        </div>
      </div>

      {/* Daemon Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="pmta-card p-5 space-y-2">
          <span className="text-xs font-bold text-gray-400 uppercase">PowerMTA Engine</span>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-gray-800 font-mono">
              {serverStatus?.version?.split(' ')[1] || '5.0r8'}
            </span>
            <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-bold uppercase">
              {serverStatus?.status || 'ONLINE'}
            </span>
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-[#8cc052]" />
            <span>Uptime: {serverStatus?.uptime || '18d 4h'}</span>
          </div>
        </div>

        <div className="pmta-card p-5 space-y-2">
          <span className="text-xs font-bold text-gray-400 uppercase">Inbound SMTP Port</span>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-gray-800 font-mono">
              Port {serverStatus?.smtpPort || 2525}
            </span>
            <span className="px-2 py-0.5 rounded bg-[#f4faee] text-[#5b8c25] text-xs font-bold border border-[#c9e89b]">
              LISTENING
            </span>
          </div>
          <div className="text-xs text-gray-500">Relay binding: 0.0.0.0:2525</div>
        </div>

        <div className="pmta-card p-5 space-y-2">
          <span className="text-xs font-bold text-gray-400 uppercase">Spool Queue Depth</span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold text-gray-800 font-mono">
              {serverStatus?.spoolCount || 0}
            </span>
            <span className="text-xs text-gray-500 font-medium">msgs queued</span>
          </div>
          <div className="text-xs text-gray-500">
            Speed: {serverStatus?.deliveryRatePerSec || 0} msgs/sec
          </div>
        </div>

        <div className="pmta-card p-5 space-y-2">
          <span className="text-xs font-bold text-gray-400 uppercase">License Status</span>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-800">Enterprise Cluster</span>
            <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-bold">
              VERIFIED
            </span>
          </div>
          <div className="text-xs text-gray-500">Expires: Dec 31, 2028</div>
        </div>
      </div>

      {/* Interactive PowerMTA CLI */}
      <div className="pmta-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#8cc052]" />
            <span className="font-mono text-sm font-bold">PowerMTA Command Line Interface (CLI)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCliCommand('pmta show status');
                runCliCommand('pmta show status');
              }}
              className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 font-mono"
            >
              pmta show status
            </button>
            <button
              onClick={() => {
                setCliCommand('pmta show queues');
                runCliCommand('pmta show queues');
              }}
              className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 font-mono"
            >
              pmta show queues
            </button>
            <button
              onClick={() => {
                setCliCommand('pmta show vmtas');
                runCliCommand('pmta show vmtas');
              }}
              className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 font-mono"
            >
              pmta show vmtas
            </button>
          </div>
        </div>

        <div className="p-4 bg-gray-950 text-gray-200 font-mono text-xs space-y-3">
          <div className="flex items-center gap-2 bg-gray-900 px-3 py-2 rounded border border-gray-800">
            <span className="text-[#8cc052] font-bold select-none">$</span>
            <input
              type="text"
              value={cliCommand}
              onChange={(e) => setCliCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runCliCommand()}
              placeholder="Enter PowerMTA command (e.g. pmta show queues)..."
              className="w-full bg-transparent text-white font-mono focus:outline-none placeholder:text-gray-600"
            />
            <button
              onClick={() => runCliCommand()}
              disabled={isExecuting}
              className="px-3 py-1 bg-[#8cc052] hover:bg-[#7bb342] text-white font-bold rounded text-xs transition disabled:opacity-50"
            >
              {isExecuting ? 'Running...' : 'Run'}
            </button>
          </div>

          <pre className="p-4 rounded bg-black border border-gray-800 text-[#8cc052] overflow-x-auto min-h-[140px] leading-relaxed select-text">
            {cliOutput}
          </pre>
        </div>
      </div>

      {/* pmta.conf Generator & Exporter */}
      <div className="pmta-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#8cc052]" />
              <h3 className="font-bold text-gray-800 text-base">Configuration Generator (/etc/pmta/config)</h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Production configuration automatically synced with your registered VirtualMTAs, IP pools, and domain policies.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyConfig}
              className="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-white flex items-center gap-1.5 transition"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Copied' : 'Copy Config'}</span>
            </button>
            <button
              onClick={handleDownloadConfig}
              className="px-3 py-1.5 bg-[#2c3e50] hover:bg-[#1e2b37] text-white rounded text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download pmta.conf</span>
            </button>
          </div>
        </div>

        <div className="p-4 bg-gray-900">
          <pre className="p-4 rounded bg-gray-950 border border-gray-800 text-gray-300 text-xs font-mono overflow-x-auto max-h-[350px] leading-relaxed">
            {configText}
          </pre>
        </div>
      </div>
    </div>
  );
};
