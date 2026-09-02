import React, { useState } from 'react';
import {
  Send,
  Eye,
  Code,
  Smartphone,
  Monitor,
  Paperclip,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Sender, Domain } from '../types';

interface SendEmailViewProps {
  senders: Sender[];
  domains: Domain[];
  onSendEmail: (payload: any) => Promise<any>;
  onSendTest: (payload: any) => Promise<any>;
}

export const SendEmailView: React.FC<SendEmailViewProps> = ({
  senders,
  domains,
  onSendEmail,
  onSendTest,
}) => {
  // Form state
  const [selectedSenderId, setSelectedSenderId] = useState(senders[0]?.id || '');
  const [fromName, setFromName] = useState(senders[0]?.name || 'Acme Platform');
  const [fromEmail, setFromEmail] = useState(senders[0]?.fromEmail || 'security@transact.acme-corp.io');
  const [replyTo, setReplyTo] = useState(senders[0]?.replyTo || 'support@acme-corp.io');
  const [to, setTo] = useState('enterprise-developer@example.com');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('Critical Infrastructure Notice: Spool Queue Maintenance Window');
  const [activeEditorTab, setActiveEditorTab] = useState<'html' | 'plaintext'>('html');
  const [htmlBody, setHtmlBody] = useState(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; padding: 40px 20px; color: #f4f4f5;">
  <div style="max-width: 580px; margin: 0 auto; background: #18181b; border-radius: 12px; padding: 36px; border: 1px solid #27272a;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
      <span style="font-size: 18px; font-weight: 700; color: #10b981; letter-spacing: -0.5px;">ACME INFRASTRUCTURE</span>
      <span style="font-size: 11px; background: #27272a; color: #a1a1aa; padding: 4px 8px; border-radius: 4px; font-family: monospace;">KumoMTA-v3</span>
    </div>
    <h2 style="font-size: 20px; color: #ffffff; margin-bottom: 12px;">Scheduled Cluster Maintenance</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; margin-bottom: 20px;">
      Hello engineering team,<br/><br/>
      We are performing a rolling upgrade on the high-throughput KumoMTA spool nodes. Zero downtime is expected as connections will seamlessly failover to secondary Amazon SES upstream endpoints.
    </p>
    <div style="background: #09090b; border: 1px solid #3f3f46; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <div style="font-size: 12px; color: #71717a; text-transform: uppercase; font-weight: 600;">Window Target</div>
      <div style="font-size: 14px; font-weight: 600; color: #38bdf8; font-family: monospace; margin-top: 4px;">Sunday, 02:00 UTC - 04:00 UTC</div>
    </div>
    <a href="https://acme-corp.io/status" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 13px;">View Live Telemetry Status &rarr;</a>
    <hr style="border: none; border-top: 1px solid #27272a; margin: 28px 0;" />
    <div style="font-size: 11px; color: #71717a; line-height: 1.5;">
      You received this because your account has Ops Admin permissions.<br/>
      <a href="https://transact.acme-corp.io/unsubscribe" style="color: #38bdf8; text-decoration: underline;">Manage notification preferences</a>
    </div>
  </div>
</body>
</html>`);
  const [plainText, setPlainText] = useState('Critical Infrastructure Notice: Scheduled maintenance on KumoMTA spool nodes.');

  // Custom Headers
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([
    { key: 'X-KumoMTA-Queue', value: 'tier1-high-throughput' },
    { key: 'X-Campaign-Tag', value: 'system-maintenance-2026' },
  ]);

  // Preview options
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testRecipient, setTestRecipient] = useState('qa-engineer@acme-corp.io');

  // Handle sender change
  const handleSenderChange = (id: string) => {
    setSelectedSenderId(id);
    const found = senders.find((s) => s.id === id);
    if (found) {
      setFromName(found.name);
      setFromEmail(found.fromEmail);
      if (found.replyTo) setReplyTo(found.replyTo);
    }
  };

  const handleAddHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  };

  const handleRemoveHeader = (idx: number) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== idx));
  };

  const handleHeaderChange = (idx: number, field: 'key' | 'value', val: string) => {
    const updated = [...customHeaders];
    updated[idx][field] = val;
    setCustomHeaders(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const headersObj: Record<string, string> = {};
    customHeaders.forEach((h) => {
      if (h.key.trim()) headersObj[h.key.trim()] = h.value.trim();
    });

    await onSendEmail({
      fromName,
      fromEmail,
      replyTo,
      to,
      cc: cc ? cc.split(',').map((s) => s.trim()) : undefined,
      bcc: bcc ? bcc.split(',').map((s) => s.trim()) : undefined,
      subject,
      htmlBody,
      plainText,
      customHeaders: headersObj,
      isMarketing: true,
    });

    setIsSubmitting(false);
  };

  const handleDispatchTest = async () => {
    await onSendTest({
      testEmail: testRecipient,
      fromEmail,
      subject,
      htmlBody,
    });
    setShowTestModal(false);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            Send Email
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-xs bg-white/10 text-zinc-300 border border-white-10">
              KumoMTA Direct Spool
            </span>
          </h1>
          <p className="text-xs text-[#888888] mt-1">
            Compose and dispatch RFC 5322 compliant messages with automatic upstream SES routing
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowTestModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-sm bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white-10 transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>Send Test Email</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Form, Right Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form (7 cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-5">
          {/* Sender Identity Card */}
          <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#888888]">
                Sender Identity & Routing
              </span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5" /> DKIM/SPF Aligned
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1.5">
                  Select Verified Sender
                </label>
                <select
                  value={selectedSenderId}
                  onChange={(e) => handleSenderChange(e.target.value)}
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs text-white focus:border-white/30 focus:outline-none"
                >
                  {senders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.fromEmail})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1.5">
                  From Display Name
                </label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs text-white focus:border-white/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1.5">
                  From Email (RFC Return-Path)
                </label>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white focus:border-white/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1.5">
                  Reply-To Address
                </label>
                <input
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white focus:border-white/30 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Recipient & Subject Card */}
          <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#888888]">
                Recipients & Content
              </span>
              <button
                type="button"
                onClick={() => setShowCcBcc(!showCcBcc)}
                className="text-xs text-white hover:underline transition-colors"
              >
                {showCcBcc ? 'Hide CC / BCC' : '+ Add CC / BCC'}
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#888888] mb-1.5">
                To (Recipient Email Address)
              </label>
              <input
                type="text"
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@domain.com"
                className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white focus:border-white/30 focus:outline-none"
              />
              <div className="text-[11px] text-[#888888] mt-1">
                Tip: Enter test emails like <span className="text-amber-300 font-mono">user@deadbox.invalid</span> to test real-time bounce capture!
              </div>
            </div>

            {showCcBcc && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-[#888888] mb-1.5">CC</label>
                  <input
                    type="text"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="cc@company.com"
                    className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white focus:border-white/30 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#888888] mb-1.5">BCC</label>
                  <input
                    type="text"
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                    placeholder="audit@company.com"
                    className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white focus:border-white/30 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#888888] mb-1.5">
                Subject Line
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Message Subject..."
                className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs text-white focus:border-white/30 focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* Email Body Editor */}
          <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveEditorTab('html')}
                  className={`px-3 py-1 rounded-sm text-xs font-medium transition-colors ${
                    activeEditorTab === 'html'
                      ? 'bg-white text-black font-semibold'
                      : 'text-[#888888] hover:text-white'
                  }`}
                >
                  HTML Template
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEditorTab('plaintext')}
                  className={`px-3 py-1 rounded-sm text-xs font-medium transition-colors ${
                    activeEditorTab === 'plaintext'
                      ? 'bg-white text-black font-semibold'
                      : 'text-[#888888] hover:text-white'
                  }`}
                >
                  Plain Text Fallback
                </button>
              </div>

              <span className="text-[11px] text-[#888888] font-mono">
                {activeEditorTab === 'html' ? `${htmlBody.length} chars` : `${plainText.length} chars`}
              </span>
            </div>

            {activeEditorTab === 'html' ? (
              <textarea
                rows={12}
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                className="w-full bg-[#050505] border border-white-10 rounded-sm p-3 text-xs font-mono text-zinc-200 focus:border-white/30 focus:outline-none leading-relaxed"
                placeholder="<html><body>...</body></html>"
              />
            ) : (
              <textarea
                rows={8}
                value={plainText}
                onChange={(e) => setPlainText(e.target.value)}
                className="w-full bg-[#050505] border border-white-10 rounded-sm p-3 text-xs font-mono text-zinc-200 focus:border-white/30 focus:outline-none"
                placeholder="Plain text fallback message..."
              />
            )}
          </div>

          {/* Custom Headers & Attachments */}
          <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#888888]">
                Custom RFC Headers
              </span>
              <button
                type="button"
                onClick={handleAddHeader}
                className="flex items-center gap-1 text-xs text-white hover:text-emerald-400"
              >
                <Plus className="w-3.5 h-3.5" /> Add Header
              </button>
            </div>

            <div className="space-y-2">
              {customHeaders.map((header, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Header Key (e.g. X-Priority)"
                    value={header.key}
                    onChange={(e) => handleHeaderChange(idx, 'key', e.target.value)}
                    className="flex-1 bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs font-mono text-white"
                  />
                  <input
                    type="text"
                    placeholder="Header Value"
                    value={header.value}
                    onChange={(e) => handleHeaderChange(idx, 'value', e.target.value)}
                    className="flex-1 bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs font-mono text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveHeader(idx)}
                    className="p-1.5 text-[#888888] hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-4 rounded-sm bg-[#0F0F0F] border border-white-10 flex items-center justify-between">
            <div className="text-xs text-[#888888] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Auto-applies List-Unsubscribe RFC 8058</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowTestModal(true)}
                className="px-4 py-2 rounded-sm bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white-10 transition-colors"
              >
                Test Dispatch
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-md transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Spooling to KumoMTA...' : 'Submit to Spool'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Right Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-20">
          <div className="p-4 rounded-sm bg-[#0F0F0F] border border-white-10 flex items-center justify-between">
            <div className="text-xs font-semibold text-white">Live Client Preview</div>
            <div className="flex items-center gap-1 bg-[#050505] p-1 rounded-sm border border-white-10">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={`p-1.5 rounded-xs ${previewDevice === 'desktop' ? 'bg-white text-black' : 'text-[#888888] hover:text-white'}`}
                title="Desktop View"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={`p-1.5 rounded-xs ${previewDevice === 'mobile' ? 'bg-white text-black' : 'text-[#888888] hover:text-white'}`}
                title="Mobile View"
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Email Preview Frame */}
          <div
            className={`mx-auto transition-all duration-200 ${
              previewDevice === 'mobile' ? 'max-w-[340px]' : 'w-full'
            }`}
          >
            <div className="bg-[#050505] border border-white-10 rounded-sm overflow-hidden shadow-2xl">
              {/* Fake Email Client Chrome */}
              <div className="p-3 bg-[#0F0F0F] border-b border-white-10 text-xs space-y-1">
                <div className="flex items-center justify-between text-[#888888]">
                  <span className="font-semibold text-white truncate">{fromName}</span>
                  <span className="font-mono text-[10px]">Just now</span>
                </div>
                <div className="text-[11px] font-mono text-[#888888] truncate">
                  To: <span className="text-zinc-200">{to}</span>
                </div>
                <div className="text-xs font-medium text-white truncate pt-1">{subject}</div>
              </div>

              {/* Rendered HTML Canvas */}
              <div className="p-2 bg-[#050505] min-h-[420px] max-h-[600px] overflow-y-auto">
                <div
                  className="rounded-sm overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: htmlBody }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Test Email Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F0F0F] border border-white-10 rounded-sm max-w-md w-full p-6 space-y-4 shadow-2xl font-sans">
            <div>
              <h2 className="text-sm font-semibold text-white">Send Test Verification</h2>
              <p className="text-xs text-[#888888] mt-1">
                Dispatches a single copy of this email to verify DKIM signatures and rendered styling.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#888888] mb-1.5">
                Test Recipient Address
              </label>
              <input
                type="email"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs font-mono text-white focus:border-white/30 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="px-3 py-1.5 rounded-sm bg-white/5 hover:bg-white/10 text-[#888888] hover:text-white border border-white-10 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDispatchTest}
                className="px-4 py-1.5 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold"
              >
                Dispatch Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
