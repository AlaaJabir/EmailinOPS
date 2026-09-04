import React, { useState, useMemo } from 'react';
import { Send, Eye, Smartphone, Monitor, Plus, Trash2, ShieldCheck, Zap, MousePointerClick, Sparkles, UserCheck, Copy, Check } from 'lucide-react';
import { Sender, Domain, Contact } from '../types';

interface SendEmailViewProps {
  senders: Sender[];
  domains: Domain[];
  contacts?: Contact[];
  onSendEmail: (payload: any) => Promise<any>;
  onSendTest: (payload: any) => Promise<any>;
}

export const SendEmailView: React.FC<SendEmailViewProps> = ({ senders, domains, contacts = [], onSendEmail, onSendTest }) => {
  const [selectedSenderId, setSelectedSenderId] = useState(senders[0]?.id || '');
  const [fromName, setFromName] = useState(senders[0]?.name || 'Acme Platform');
  const [fromEmail, setFromEmail] = useState(senders[0]?.fromEmail || 'security@transact.acme-corp.io');
  const [replyTo, setReplyTo] = useState(senders[0]?.replyTo || 'support@acme-corp.io');
  const [to, setTo] = useState('developer@acme-corp.io');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('Critical Infrastructure Notice for {{company}}: Spool Maintenance');
  const [activeEditorTab, setActiveEditorTab] = useState<'html' | 'plaintext'>('html');
  const [htmlBody, setHtmlBody] = useState(`<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"></head>\n<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; padding: 40px 20px; color: #f4f4f5;">\n  <div style="max-width: 580px; margin: 0 auto; background: #18181b; border-radius: 12px; padding: 36px; border: 1px solid #27272a;">\n    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">\n      <span style="font-size: 18px; font-weight: 700; color: #10b981; letter-spacing: -0.5px;">ACME INFRASTRUCTURE</span>\n      <span style="font-size: 11px; background: #27272a; color: #a1a1aa; padding: 4px 8px; border-radius: 4px; font-family: monospace;">KumoMTA-v3</span>\n    </div>\n    <h2 style="font-size: 20px; color: #ffffff; margin-bottom: 12px;">Scheduled Cluster Maintenance</h2>\n    <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; margin-bottom: 20px;">Hello {{first_name}},<br/><br/>We are performing a rolling upgrade on the high-throughput KumoMTA spool nodes serving <strong>{{company}}</strong>. Zero downtime is expected as connections will seamlessly failover to secondary Amazon SES upstream endpoints.</p>\n    <div style="background: #09090b; border: 1px solid #3f3f46; border-radius: 8px; padding: 16px; margin-bottom: 24px;"><div style="font-size: 12px; color: #71717a; text-transform: uppercase; font-weight: 600;">Recipient Account</div><div style="font-size: 14px; font-weight: 600; color: #38bdf8; font-family: monospace; margin-top: 4px;">{{email}}</div></div>\n    <a href="https://acme-corp.io/status" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 13px;">View Live Telemetry Status &rarr;</a>\n    <hr style="border: none; border-top: 1px solid #27272a; margin: 28px 0;" />\n    <div style="font-size: 11px; color: #71717a; line-height: 1.5;">You received this message because you are registered with {{company}}.<br/><a href="{{unsubscribe_url}}" style="color: #38bdf8; text-decoration: underline;">Unsubscribe from these notifications</a></div>\n  </div>\n</body>\n</html>`);
  const [plainText, setPlainText] = useState(`Hello {{first_name}},\n\nScheduled maintenance notice for {{company}}.\n\nTo opt out: {{unsubscribe_url}}`);
  const [enableOpenTracking, setEnableOpenTracking] = useState(true);
  const [enableClickTracking, setEnableClickTracking] = useState(true);
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([{ key: 'X-KumoMTA-Queue', value: 'tier1-high-throughput' }]);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewMode, setPreviewMode] = useState<'personalized' | 'raw'>('personalized');
  const [selectedPreviewContactId, setSelectedPreviewContactId] = useState<string>(contacts[0]?.id || '');
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testRecipient, setTestRecipient] = useState('qa-engineer@acme-corp.io');
  const [testContactId, setTestContactId] = useState<string>(contacts[0]?.id || '');

  const handleSenderChange = (id: string) => { setSelectedSenderId(id); const found = senders.find((s) => s.id === id); if (found) { setFromName(found.name); setFromEmail(found.fromEmail); if (found.replyTo) setReplyTo(found.replyTo); } };
  const handleAddHeader = () => setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  const handleRemoveHeader = (idx: number) => setCustomHeaders(customHeaders.filter((_, i) => i !== idx));
  const handleHeaderChange = (idx: number, field: 'key' | 'value', val: string) => { const updated = [...customHeaders]; updated[idx][field] = val; setCustomHeaders(updated); };
  const handleInsertVariable = (variableName: string) => { const token = `{{${variableName}}}`; setHtmlBody((prev) => `${prev} ${token}`); navigator.clipboard?.writeText(token); setCopiedVariable(variableName); setTimeout(() => setCopiedVariable(null), 2000); };
  const previewContact = useMemo(() => !selectedPreviewContactId ? contacts[0] || null : contacts.find((c) => c.id === selectedPreviewContactId) || null, [contacts, selectedPreviewContactId]);
  const resolvePreviewContent = (content: string) => { if (previewMode === 'raw' || !content) return content; const firstName = previewContact?.firstName?.trim() || 'there'; const lastName = previewContact?.lastName?.trim() || ''; const company = previewContact?.company?.trim() || 'your organization'; const email = previewContact?.email?.trim() || to || 'recipient@domain.com'; const unsubUrl = `${window.location.origin}/unsubscribe/sample_preview_token`; return content.replace(/\{\{\s*first_name\s*\}\}/gi, firstName).replace(/\{\{\s*last_name\s*\}\}/gi, lastName).replace(/\{\{\s*company\s*\}\}/gi, company).replace(/\{\{\s*email\s*\}\}/gi, email).replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, unsubUrl); };
  const renderedPreviewHtml = useMemo(() => resolvePreviewContent(htmlBody), [htmlBody, previewContact, previewMode, to]);
  const renderedPreviewSubject = useMemo(() => resolvePreviewContent(subject), [subject, previewContact, previewMode, to]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    const headersObj: Record<string, string> = {}; customHeaders.forEach((h) => { if (h.key.trim()) headersObj[h.key.trim()] = h.value.trim(); });
    try { await onSendEmail({ fromName, fromEmail, replyTo, to, cc: cc ? cc.split(',').map((s) => s.trim()) : undefined, bcc: bcc ? bcc.split(',').map((s) => s.trim()) : undefined, subject, htmlBody, plainText, customHeaders: headersObj, enableOpenTracking, enableClickTracking, isMarketing: true }); }
    finally { setIsSubmitting(false); }
  };

  const handleDispatchTest = async () => {
    const contactForTest = contacts.find((c) => c.id === testContactId);
    const firstName = contactForTest?.firstName?.trim() || 'Tester'; const lastName = contactForTest?.lastName?.trim() || 'User'; const company = contactForTest?.company?.trim() || 'Acme Engineering'; const email = testRecipient; const unsubUrl = `${window.location.origin}/unsubscribe/test_verification_token`;
    const testSubject = subject.replace(/\{\{\s*first_name\s*\}\}/gi, firstName).replace(/\{\{\s*last_name\s*\}\}/gi, lastName).replace(/\{\{\s*company\s*\}\}/gi, company).replace(/\{\{\s*email\s*\}\}/gi, email).replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, unsubUrl);
    const testHtml = htmlBody.replace(/\{\{\s*first_name\s*\}\}/gi, firstName).replace(/\{\{\s*last_name\s*\}\}/gi, lastName).replace(/\{\{\s*company\s*\}\}/gi, company).replace(/\{\{\s*email\s*\}\}/gi, email).replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, unsubUrl);
    await onSendTest({ testEmail: testRecipient, fromEmail, subject: testSubject, htmlBody: testHtml, enableOpenTracking, enableClickTracking });
    setShowTestModal(false);
  };

  const templateVariables = [
    { label: 'first_name', desc: 'Recipient First Name (Fallback: "there")' },
    { label: 'last_name', desc: 'Recipient Last Name' },
    { label: 'company', desc: 'Company or Organization (Fallback: "your team")' },
    { label: 'email', desc: 'Recipient Email Address' },
    { label: 'unsubscribe_url', desc: 'Secure RFC 8058 Opt-Out Token URL' },
  ];

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">Send Email <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-xs bg-white/10 text-zinc-300 border border-white-10">KumoMTA Direct Spool</span></h1><p className="text-xs text-[#888888] mt-1">Personalized HTML templates with secure unsubscribe tokens and upstream Amazon SES routing</p></div><div className="flex items-center gap-3"><button type="button" onClick={() => setShowTestModal(true)} className="flex items-center gap-2 px-3.5 py-1.5 rounded-sm bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white-10 transition-colors"><Zap className="w-3.5 h-3.5 text-amber-300" /><span>Send Test Email</span></button></div></div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-5">
          <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-4"><div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-[0.2em] text-[#888888]">Sender Identity & Routing</span><span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono text-[11px]"><ShieldCheck className="w-3.5 h-3.5" /> DKIM/SPF Aligned</span></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="block text-xs font-medium text-[#888888] mb-1.5">Select Verified Sender</label><select value={selectedSenderId} onChange={(e) => handleSenderChange(e.target.value)} className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white">{senders.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.fromEmail})</option>)}</select></div><div><label className="block text-xs font-medium text-[#888888] mb-1.5">From Email</label><input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white" /></div></div></div>
          <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-4"><div><label className="block text-xs font-medium text-[#888888] mb-1.5">Recipients</label><input value={to} onChange={(e) => setTo(e.target.value)} className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white" /></div><div><label className="block text-xs font-medium text-[#888888] mb-1.5">Subject</label><input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white" /></div></div>
          <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-4"><div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-[0.2em] text-[#888888]">Message Content</span><div className="flex gap-1"><button type="button" onClick={() => setActiveEditorTab('html')} className="px-2 py-1 text-[10px]">HTML</button><button type="button" onClick={() => setActiveEditorTab('plaintext')} className="px-2 py-1 text-[10px]">Plain Text</button></div></div>{activeEditorTab === 'html' ? <textarea rows={16} value={htmlBody} onChange={(e) => setHtmlBody(e.target.value)} className="w-full bg-[#050505] border border-white-10 rounded-sm p-3 text-xs font-mono text-white" /> : <textarea rows={16} value={plainText} onChange={(e) => setPlainText(e.target.value)} className="w-full bg-[#050505] border border-white-10 rounded-sm p-3 text-xs font-mono text-white" />}</div>
          <div className="p-5 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-4"><div className="flex items-center gap-2 text-xs font-semibold text-white"><MousePointerClick className="w-4 h-4" /> Tracking</div><label className="flex items-center justify-between text-xs text-[#bdbdbd]"><span>Track Opens</span><input type="checkbox" checked={enableOpenTracking} onChange={(e) => setEnableOpenTracking(e.target.checked)} className="h-4 w-4" /></label><label className="flex items-center justify-between text-xs text-[#bdbdbd]"><span>Track Clicks</span><input type="checkbox" checked={enableClickTracking} onChange={(e) => setEnableClickTracking(e.target.checked)} className="h-4 w-4" /></label></div>
          <div className="flex justify-end"><button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-5 py-2 bg-white text-black text-xs font-semibold rounded-sm disabled:opacity-50"><Send className="w-3.5 h-3.5" />{isSubmitting ? 'Dispatching…' : 'Send Email'}</button></div>
        </form>
        <div className="lg:col-span-5 p-6 rounded-sm bg-[#0F0F0F] border border-white-10"><div className="text-[10px] uppercase tracking-[0.2em] text-[#888888] mb-3">Live Preview</div><div className="bg-black rounded-sm p-3 overflow-auto"><div className="text-xs text-white mb-3">{renderedPreviewSubject}</div><div dangerouslySetInnerHTML={{ __html: renderedPreviewHtml }} /></div></div>
      </div>
      {showTestModal && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-[#0F0F0F] border border-white-10 rounded-sm max-w-md w-full p-6 space-y-4"><h2 className="text-sm font-semibold text-white">Send Test Email</h2><input value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)} className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-2 text-xs text-white" placeholder="test@example.com" /><div className="text-[10px] text-[#888888]">Tracking: Opens {enableOpenTracking ? 'ON' : 'OFF'} · Clicks {enableClickTracking ? 'ON' : 'OFF'}</div><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowTestModal(false)} className="px-3 py-1.5 text-xs text-[#888888]">Cancel</button><button type="button" onClick={handleDispatchTest} className="px-4 py-1.5 bg-white text-black text-xs font-semibold rounded-sm">Send Test</button></div></div></div>}
    </div>
  );
};
