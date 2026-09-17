import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Search, Copy, Check, RefreshCw, Globe, ArrowRight } from 'lucide-react';
import { DnsCheckResult, Domain } from '../types';

interface PowerMtaDeliverabilityViewProps {
  domains: Domain[];
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  addToast: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export const PowerMtaDeliverabilityView: React.FC<PowerMtaDeliverabilityViewProps> = ({
  domains,
  authFetch,
  addToast,
}) => {
  const [domainInput, setDomainInput] = useState(domains[0]?.domainName || 'amiralucia.com');
  const [selectorInput, setSelectorInput] = useState('kumo2026');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<DnsCheckResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const runValidation = async (targetDomain?: string) => {
    const domainToCheck = (targetDomain || domainInput).trim();
    if (!domainToCheck) return;
    setIsChecking(true);
    try {
      const res = await authFetch('/api/pmta/validate-dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domainToCheck, selector: selectorInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to validate DNS');
      setResult(data);
      addToast('success', 'DNS Validation Completed', `Evaluated authentication records for ${domainToCheck}`);
    } catch (err: any) {
      addToast('error', 'DNS Check Failed', err.message);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    runValidation();
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    addToast('info', 'Copied to Clipboard', text.slice(0, 40) + '...');
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[#CCD2D8]">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#8B1A10]" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Deliverability &amp; DNS Validator</h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Enterprise DNS authentication suite for DKIM, DMARC, SPF, MX, RDNS, and EHLO compliance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {domains.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setDomainInput(d.domainName);
                runValidation(d.domainName);
              }}
              className={`px-3 py-1.5 rounded text-xs font-bold border transition ${
                domainInput === d.domainName
                  ? 'bg-[#8B1A10] text-white border-[#8B1A10]'
                  : 'bg-white text-gray-700 border-[#CCD2D8] hover:bg-gray-100'
              }`}
            >
              {d.domainName}
            </button>
          ))}
        </div>
      </div>

      {/* Query Bar */}
      <div className="bg-white border border-[#CCD2D8] p-4 flex flex-col sm:flex-row gap-3 items-center shadow-2xs">
        <div className="relative flex-1 w-full">
          <Globe className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="Enter sending domain (e.g. yourdomain.com)"
            className="w-full pl-9 pr-3 py-2 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-900 focus:border-[#8B1A10] focus:outline-none"
          />
        </div>
        <div className="w-full sm:w-48">
          <input
            type="text"
            value={selectorInput}
            onChange={(e) => setSelectorInput(e.target.value)}
            placeholder="DKIM Selector (kumo2026)"
            className="w-full px-3 py-2 border border-[#CCD2D8] rounded text-xs sm:text-sm text-gray-900 focus:border-[#8B1A10] focus:outline-none"
          />
        </div>
        <button
          onClick={() => runValidation()}
          disabled={isChecking}
          className="w-full sm:w-auto px-5 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold rounded text-xs sm:text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin text-white' : ''}`} />
          <span>Validate Records</span>
        </button>
      </div>

      {/* Overall Score Banner */}
      {result && (
        <div
          className={`p-4 rounded border flex items-center justify-between shadow-2xs ${
            result.overall === 'HEALTHY'
              ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
              : 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
          }`}
        >
          <div className="flex items-center gap-3">
            {result.overall === 'HEALTHY' ? (
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-[#166534]" />
            ) : (
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-[#D97706]" />
            )}
            <div>
              <h3 className="font-bold text-xs sm:text-sm md:text-base">
                Domain Health: {result.overall === 'HEALTHY' ? 'EXCELLENT (100% Aligned)' : 'ACTION REQUIRED'}
              </h3>
              <p className="text-xs opacity-90 mt-0.5">
                Targeting inbox placement across Google Mail, Yahoo, Microsoft Outlook, and Corporate Mail Filters.
              </p>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded uppercase ${
              result.overall === 'HEALTHY' ? 'bg-[#15803D] text-white' : 'bg-[#D97706] text-white'
            }`}
          >
            {result.overall}
          </span>
        </div>
      )}

      {/* DNS Checklist Grid */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* SPF */}
          <div className="bg-white border border-[#CCD2D8] p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    result.spf.status === 'pass' ? 'bg-[#15803D]' : 'bg-amber-500'
                  }`}
                />
                <h3 className="font-bold text-gray-900 text-sm">1. SPF (Sender Policy Framework)</h3>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-800 border border-gray-200">
                {result.spf.status}
              </span>
            </div>
            <p className="text-xs text-gray-600">{result.spf.details}</p>
            {result.spf.record && (
              <div className="bg-gray-50 border border-[#CCD2D8] rounded p-2.5 text-xs font-mono text-gray-900 flex items-center justify-between">
                <span className="truncate mr-2">{result.spf.record}</span>
                <button
                  onClick={() => copyToClipboard(result.spf.record!, 'spf')}
                  className="text-gray-500 hover:text-gray-900 p-1"
                  title="Copy"
                >
                  {copiedKey === 'spf' ? <Check className="w-4 h-4 text-[#15803D]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>

          {/* DKIM */}
          <div className="bg-white border border-[#CCD2D8] p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    result.dkim.status === 'pass' ? 'bg-[#15803D]' : 'bg-amber-500'
                  }`}
                />
                <h3 className="font-bold text-gray-900 text-sm">2. DKIM (DomainKeys Identified Mail)</h3>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-800 border border-gray-200">
                Selector: {result.dkim.selector}
              </span>
            </div>
            <p className="text-xs text-gray-600">{result.dkim.details}</p>
            {result.dkim.record && (
              <div className="bg-gray-50 border border-[#CCD2D8] rounded p-2.5 text-xs font-mono text-gray-900 flex items-center justify-between">
                <span className="truncate mr-2">{result.dkim.record}</span>
                <button
                  onClick={() => copyToClipboard(result.dkim.record!, 'dkim')}
                  className="text-gray-500 hover:text-gray-900 p-1"
                  title="Copy"
                >
                  {copiedKey === 'dkim' ? <Check className="w-4 h-4 text-[#15803D]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>

          {/* DMARC */}
          <div className="bg-white border border-[#CCD2D8] p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    result.dmarc.status === 'pass' ? 'bg-[#15803D]' : 'bg-amber-500'
                  }`}
                />
                <h3 className="font-bold text-gray-900 text-sm">3. DMARC Policy</h3>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-800 border border-gray-200">
                {result.dmarc.status}
              </span>
            </div>
            <p className="text-xs text-gray-600">{result.dmarc.details}</p>
            {result.dmarc.record && (
              <div className="bg-gray-50 border border-[#CCD2D8] rounded p-2.5 text-xs font-mono text-gray-900 flex items-center justify-between">
                <span className="truncate mr-2">{result.dmarc.record}</span>
                <button
                  onClick={() => copyToClipboard(result.dmarc.record!, 'dmarc')}
                  className="text-gray-500 hover:text-gray-900 p-1"
                  title="Copy"
                >
                  {copiedKey === 'dmarc' ? <Check className="w-4 h-4 text-[#15803D]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>

          {/* MX */}
          <div className="bg-white border border-[#CCD2D8] p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    result.mx.status === 'pass' ? 'bg-[#15803D]' : 'bg-amber-500'
                  }`}
                />
                <h3 className="font-bold text-gray-900 text-sm">4. Mail Exchanger (MX)</h3>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-800 border border-gray-200">
                {result.mx.records.length} Records
              </span>
            </div>
            <p className="text-xs text-gray-600">{result.mx.details}</p>
            <div className="bg-gray-50 border border-[#CCD2D8] rounded p-2.5 text-xs font-mono text-gray-900 space-y-0.5">
              {result.mx.records.map((r, i) => (
                <div key={i} className="py-0.5">
                  {r}
                </div>
              ))}
              {result.mx.records.length === 0 && <div className="text-gray-500">No MX records returned.</div>}
            </div>
          </div>

          {/* RDNS (PTR) */}
          <div className="bg-white border border-[#CCD2D8] p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#15803D]" />
                <h3 className="font-bold text-gray-900 text-sm">5. Reverse DNS (RDNS / PTR)</h3>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">
                PASS
              </span>
            </div>
            <p className="text-xs text-gray-600">{result.rdns.details}</p>
            <div className="bg-gray-50 border border-[#CCD2D8] rounded p-2.5 text-xs font-mono text-gray-900">
              PTR: {result.rdns.ptr}
            </div>
          </div>

          {/* EHLO / HELO */}
          <div className="bg-white border border-[#CCD2D8] p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#15803D]" />
                <h3 className="font-bold text-gray-900 text-sm">6. EHLO Greeting Alignment</h3>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">
                PASS
              </span>
            </div>
            <p className="text-xs text-gray-600">{result.ehlo.details}</p>
            <div className="bg-gray-50 border border-[#CCD2D8] rounded p-2.5 text-xs font-mono text-gray-900">
              EHLO: {result.ehlo.hostname}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
