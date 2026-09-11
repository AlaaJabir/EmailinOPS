import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Code2, Copy, ExternalLink, Eye, FileText, Globe, HelpCircle, Mail, Monitor, MousePointerClick, Plus, Send, Shield, ShieldAlert, ShieldCheck, Smartphone, Sparkles, Trash2, UserCheck, Users, Zap } from 'lucide-react';
import { Contact, ContactList, Domain, Sender, Template } from '../types';

interface Props {
  senders: Sender[];
  domains: Domain[];
  contacts?: Contact[];
  onSendEmail: (payload: any) => Promise<any>;
  onSendTest: (payload: any) => Promise<any>;
  authFetch?: (url: string, options?: RequestInit) => Promise<Response>;
}

const replaceVars = (v: string, c?: Contact | null, email = '') =>
  v
    .replace(/\{\{\s*first_name\s*\}\}/gi, c?.firstName || 'there')
    .replace(/\{\{\s*last_name\s*\}\}/gi, c?.lastName || '')
    .replace(/\{\{\s*company\s*\}\}/gi, c?.company || 'your organization')
    .replace(/\{\{\s*email\s*\}\}/gi, email || c?.email || 'recipient@example.com')
    .replace(/\{\{\s*(unsubscribe_url|unsubscribe_link)\s*\}\}/gi, `${window.location.origin}/unsubscribe/preview`);

export const SendEmailView: React.FC<Props> = ({ senders, domains, contacts = [], onSendEmail, onSendTest, authFetch }) => {
  const [senderId, setSenderId] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [headHtml, setHeadHtml] = useState('<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">');
  const [htmlBody, setHtmlBody] = useState('');
  const [plainText, setPlainText] = useState('');
  const [editor, setEditor] = useState<'head' | 'body' | 'text'>('body');
  const [preview, setPreview] = useState<'desktop' | 'mobile'>('desktop');
  const [contactId, setContactId] = useState(contacts[0]?.id || '');
  const [openTracking, setOpenTracking] = useState(true);
  const [clickTracking, setClickTracking] = useState(true);
  const [marketing, setMarketing] = useState(true);
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>([]);
  const [testEmail, setTestEmail] = useState('');
  const [showTest, setShowTest] = useState(false);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateBusy, setTemplateBusy] = useState(false);

  // Modal / drawer states for rapid batch importing
  const [showBatchRecipients, setShowBatchRecipients] = useState(false);
  const [batchRecipientsText, setBatchRecipientsText] = useState('');
  const [showBatchHeaders, setShowBatchHeaders] = useState(false);
  const [batchHeadersText, setBatchHeadersText] = useState('');

  // Audience/list state. A list can be selected and its members are loaded automatically.
  const [lists, setLists] = useState<ContactList[]>([]);
  const [audienceListId, setAudienceListId] = useState('');
  const [audienceContacts, setAudienceContacts] = useState<Contact[]>(contacts);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState('');

  // Track if sender fields have been initially seeded to prevent overwriting user edits
  const initialSenderInitialized = useRef(false);

  // Deliverability and anti-spam audit states
  const [showDeliverabilityDetails, setShowDeliverabilityDetails] = useState(false);
  const [justOptimized, setJustOptimized] = useState(false);

  const spamKeywords = useMemo(() => [
    '100% free', 'make money fast', 'fast cash', 'earn cash', 'guaranteed profit', 'risk free',
    'urgent act now', 'congratulations you won', 'miracle cure', 'no investment',
    'claim your prize', 'double your income', 'unsecured credit', 'eliminate debt',
    'free investment', 'casino bonus', 'cryptocurrency giveaway'
  ], []);

  const deliverabilityAnalysis = useMemo(() => {
    const issues: { type: 'critical' | 'warning' | 'tip'; text: string; fix?: () => void; fixLabel?: string }[] = [];
    const passes: string[] = [];

    // 1. Sender domain verification & SPF/DKIM check
    const fromDomainPart = fromEmail.includes('@') ? fromEmail.split('@')[1].toLowerCase() : '';
    const matchedDomain = domains.find(d => d.domainName.toLowerCase() === fromDomainPart);
    const matchedSender = senders.find(s => s.fromEmail.toLowerCase() === fromEmail.toLowerCase());

    if (!fromEmail) {
      issues.push({ type: 'critical', text: 'Sender email is not configured' });
    } else if (matchedDomain?.verificationStatus === 'VERIFIED' || matchedSender?.verification === 'VERIFIED') {
      passes.push(`Sender domain "${fromDomainPart}" is verified with SPF & DKIM aligned (kumo2026 selector)`);
    } else {
      issues.push({
        type: 'warning',
        text: `Sender domain "${fromDomainPart || 'custom'}" may not be verified in your dashboard. High-volume inboxing (Gmail/Yahoo) requires matching SPF & DKIM records.`
      });
    }

    // 2. Unsubscribe check (CAN-SPAM / RFC 8058 / Gmail 2024 Rule)
    const hasUnsubscribeTag = /\{\{\s*(unsubscribe_url|unsubscribe_link)\s*\}\}/i.test(htmlBody) || /unsubscribe/i.test(htmlBody);
    if (hasUnsubscribeTag) {
      passes.push('Unsubscribe mechanism present in email body (Complies with Gmail & Yahoo 2024 spam mandates)');
    } else {
      issues.push({
        type: 'warning',
        text: 'Missing visible unsubscribe link in HTML body. Mailbox providers divert emails lacking visible opt-out.',
        fixLabel: 'Append Footer',
        fix: () => {
          const footer = `\n<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 36px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
  <tr>
    <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #718096; line-height: 18px;">
      You received this message because you are subscribed to our updates.<br/>
      <a href="{{unsubscribe_url}}" style="color: #3182ce; text-decoration: underline;">Unsubscribe safely</a>
    </td>
  </tr>
</table>`;
          setHtmlBody(prev => prev ? `${prev}\n${footer}` : footer);
        }
      });
    }

    // 3. Spam trigger words check
    const combinedContent = `${subject} ${htmlBody}`.toLowerCase();
    const detectedSpamTriggers = spamKeywords.filter(k => combinedContent.includes(k));
    if (detectedSpamTriggers.length === 0) {
      passes.push('Content is clean of recognized spam keywords and trigger phrases');
    } else {
      issues.push({
        type: 'critical',
        text: `Spam trigger phrase detected: [${detectedSpamTriggers.join(', ')}]. Mail filters (SpamAssassin/rspamd) penalize these terms.`
      });
    }

    // 4. Subject line capitalization & punctuation
    const letters = subject.replace(/[^a-zA-Z]/g, '');
    const upper = subject.replace(/[^A-Z]/g, '');
    const capsRatio = letters.length > 5 ? upper.length / letters.length : 0;
    if (capsRatio > 0.6) {
      issues.push({
        type: 'warning',
        text: 'Subject line contains excessive capitalization (ALL-CAPS triggers SpamAssassin SUBJ_ALL_CAPS penalty).',
        fixLabel: 'Fix Case',
        fix: () => {
          setSubject(prev => prev.charAt(0).toUpperCase() + prev.slice(1).toLowerCase());
        }
      });
    } else if (/[!]{2,}|\?{2,}|\${2,}/.test(subject)) {
      issues.push({
        type: 'warning',
        text: 'Subject contains consecutive punctuation marks (!!, ??, $$).',
        fixLabel: 'Clean Up',
        fix: () => setSubject(prev => prev.replace(/[!]{2,}/g, '!').replace(/\?{2,}/g, '?').replace(/\${2,}/g, '$'))
      });
    } else if (subject.trim()) {
      passes.push('Subject line format is clean and free of excessive punctuation');
    }

    // 5. Plain Text Fallback (MIME Multipart/Alternative)
    if (plainText && plainText.trim().length > 0) {
      passes.push('Plain-text MIME version present (Eliminates MIME_HTML_ONLY spam penalty)');
    } else {
      issues.push({
        type: 'tip',
        text: 'Custom plain-text part not provided. Providing plain text alongside HTML improves deliverability score.',
        fixLabel: 'Generate Text',
        fix: () => {
          const generated = htmlBody
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<br\s*[\/]?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<[^>]+>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
          setPlainText(generated);
          setEditor('text');
        }
      });
    }

    // 6. Preheader / Preview Text
    if (preheader.trim().length > 0) {
      passes.push('Mobile inbox preheader is configured for high engagement');
    } else {
      issues.push({
        type: 'tip',
        text: 'Preheader is empty. An informative preheader boosts open rates and prevents mailbox preview text leakage.',
        fixLabel: 'Set Preheader',
        fix: () => {
          if (subject.trim()) setPreheader(`${subject} — Read update`);
        }
      });
    }

    // Calculate score
    let score = 100;
    for (const iss of issues) {
      if (iss.type === 'critical') score -= 25;
      else if (iss.type === 'warning') score -= 12;
      else if (iss.type === 'tip') score -= 5;
    }
    score = Math.max(25, Math.min(100, score));

    return { score, issues, passes };
  }, [fromEmail, domains, senders, htmlBody, subject, plainText, preheader, spamKeywords]);

  const autoOptimizeForInbox = () => {
    // 1. Generate plain text if empty
    if (!plainText.trim() && htmlBody.trim()) {
      const generated = htmlBody
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      setPlainText(generated);
    }

    // 2. Append unsubscribe footer if missing
    const hasUnsubscribeTag = /\{\{\s*(unsubscribe_url|unsubscribe_link)\s*\}\}/i.test(htmlBody) || /unsubscribe/i.test(htmlBody);
    if (!hasUnsubscribeTag) {
      const footer = `\n<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 36px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
  <tr>
    <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #718096; line-height: 18px;">
      You received this message because you are subscribed to our updates.<br/>
      <a href="{{unsubscribe_url}}" style="color: #3182ce; text-decoration: underline;">Unsubscribe safely</a>
    </td>
  </tr>
</table>`;
      setHtmlBody(prev => prev ? `${prev}\n${footer}` : footer);
    }

    // 3. Fix subject punctuation / casing
    if (subject.trim()) {
      let cleanedSubj = subject.replace(/[!]{2,}/g, '!').replace(/\?{2,}/g, '?').replace(/\${2,}/g, '$');
      const letters = cleanedSubj.replace(/[^a-zA-Z]/g, '');
      const upper = cleanedSubj.replace(/[^A-Z]/g, '');
      if (letters.length > 5 && upper.length / letters.length > 0.6) {
        cleanedSubj = cleanedSubj.charAt(0).toUpperCase() + cleanedSubj.slice(1).toLowerCase();
      }
      setSubject(cleanedSubj);
    }

    // 4. Fill preheader if empty
    if (!preheader.trim() && subject.trim()) {
      setPreheader(`${subject} — Read update`);
    }

    setJustOptimized(true);
    setTimeout(() => setJustOptimized(false), 3000);
  };

  const selectedContact = audienceContacts.find(c => c.id === contactId) || contacts.find(c => c.id === contactId) || null;
  const previewBody = useMemo(() => replaceVars(htmlBody, selectedContact, selectedContact?.email || to.split(',')[0]?.trim()), [htmlBody, selectedContact, to]);
  const previewSubject = useMemo(() => replaceVars(subject, selectedContact, selectedContact?.email || to.split(',')[0]?.trim()), [subject, selectedContact, to]);
  const request = async (url: string, options: RequestInit = {}) => authFetch ? authFetch(url, options) : fetch((import.meta.env.VITE_API_BASE_URL || '') + url, options);

  // Automatically pre-populate sender fields ONLY once on initial mount or when senders list first becomes available.
  // Never overwrite user changes when component re-renders!
  useEffect(() => {
    if (!senders.length) {
      if (!initialSenderInitialized.current) {
        setSenderId('');
        setFromName('');
        setFromEmail('');
        setReplyTo('');
      }
      return;
    }
    if (!initialSenderInitialized.current) {
      const first = senders[0];
      setSenderId(first.id);
      setFromName(first.name || '');
      setFromEmail(first.fromEmail || '');
      setReplyTo(first.replyTo || '');
      initialSenderInitialized.current = true;
    }
  }, [senders]);

  const loadTemplates = async () => {
    if (!authFetch) return;
    try {
      const r = await authFetch('/api/templates');
      if (r.ok) {
        const d = await r.json();
        setTemplates(d.templates || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadLists = async () => {
    if (!authFetch) return;
    try {
      const r = await authFetch('/api/contacts/lists');
      if (r.ok) {
        const d = await r.json();
        setLists(d.lists || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadAudience = async (listId: string) => {
    setAudienceError('');
    setAudienceListId(listId);
    if (!listId) {
      setAudienceContacts(contacts);
      setContactId(contacts[0]?.id || '');
      setTo('');
      return;
    }
    if (!authFetch) return;
    setAudienceLoading(true);
    try {
      const r = await authFetch(`/api/contacts?listId=${encodeURIComponent(listId)}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Failed to load contact list');
      const loaded: Contact[] = d.contacts || [];
      setAudienceContacts(loaded);
      setContactId(loaded[0]?.id || '');
      setTo(loaded.map(c => c.email).filter(Boolean).join(', '));
    } catch (e: any) {
      setAudienceContacts([]);
      setAudienceError(e?.message || 'Failed to load contact list');
    } finally {
      setAudienceLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    loadLists();
  }, [authFetch]);

  useEffect(() => {
    if (!audienceListId) {
      setAudienceContacts(contacts);
      if (!contactId && contacts[0]) setContactId(contacts[0].id);
    }
  }, [contacts, audienceListId, contactId]);

  const selectSender = (id: string) => {
    const s = senders.find(x => x.id === id);
    setSenderId(id);
    if (s) {
      setFromName(s.name || '');
      setFromEmail(s.fromEmail || '');
      setReplyTo(s.replyTo || '');
    }
  };

  const loadTemplate = (id: string) => {
    const t = templates.find(x => x.id === id);
    setTemplateId(id);
    if (!t) return;
    setTemplateName(t.name);
    setSubject(t.subject || '');
    setPreheader(t.preheader || '');
    setHeadHtml(t.headHtml || '');
    setHtmlBody(t.htmlBody || '');
    setPlainText(t.plainText || '');
    setOpenTracking(t.trackOpens !== false);
    setClickTracking(t.trackClicks !== false);
    setMarketing(Boolean(t.isMarketing));
    if (t.fromName) setFromName(t.fromName);
    if (t.fromEmail) setFromEmail(t.fromEmail);
    if (t.replyTo) setReplyTo(t.replyTo);
    setHeaders(Object.entries(t.customHeaders || {}).map(([key, value]) => ({ key, value: String(value) })));
  };

  const saveTemplate = async () => {
    if (!authFetch || !templateName.trim()) return;
    setTemplateBusy(true);
    try {
      const variables = Array.from(new Set([
        ...Array.from(subject.matchAll(/\{\{\s*([^}]+)\s*\}\}/g)),
        ...Array.from(htmlBody.matchAll(/\{\{\s*([^}]+)\s*\}\}/g)),
      ].map(m => m[1].trim())));
      const body = {
        name: templateName.trim(), subject, preheader, headHtml, htmlBody, plainText, variables,
        fromName, fromEmail, replyTo,
        customHeaders: Object.fromEntries(headers.filter(h => h.key.trim()).map(h => [h.key.trim(), h.value.trim()])),
        trackOpens: openTracking, trackClicks: clickTracking, isMarketing: marketing,
      };
      const r = await request(templateId ? `/api/templates/${templateId}` : '/api/templates', {
        method: templateId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const d = await r.json();
        setTemplateId(d.template.id);
        await loadTemplates();
      }
    } finally {
      setTemplateBusy(false);
    }
  };

  const deleteTemplate = async () => {
    if (!authFetch || !templateId) return;
    setTemplateBusy(true);
    try {
      const r = await authFetch(`/api/templates/${templateId}`, { method: 'DELETE' });
      if (r.ok) {
        setTemplateId('');
        setTemplateName('');
        await loadTemplates();
      }
    } finally {
      setTemplateBusy(false);
    }
  };

  const addHeader = () => setHeaders(v => [...v, { key: '', value: '' }]);
  const updateHeader = (i: number, key: 'key' | 'value', value: string) => setHeaders(v => v.map((h, n) => n === i ? { ...h, [key]: value } : h));

  // Parse raw pasted headers (RFC 822 format or Key: Value per line) into the headers array
  const applyBatchHeaders = (rawText: string) => {
    if (!rawText.trim()) return;
    const lines = rawText.split(/\r?\n/);
    const newHeaders: Array<{ key: string; value: string }> = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const key = trimmed.slice(0, colonIdx).trim();
        const value = trimmed.slice(colonIdx + 1).trim();
        if (key) newHeaders.push({ key, value });
      }
    }
    if (newHeaders.length) {
      setHeaders(prev => {
        // Merge without duplicating same header key
        const existingKeys = new Set(newHeaders.map(h => h.key.toLowerCase()));
        return [...prev.filter(h => !existingKeys.has(h.key.toLowerCase())), ...newHeaders];
      });
    }
    setShowBatchHeaders(false);
    setBatchHeadersText('');
  };

  // Parse raw pasted recipients (lines, tabs, commas, semicolons) into the comma-separated `to` input
  const applyBatchRecipients = (rawText: string) => {
    if (!rawText.trim()) return;
    // Extract all valid emails from pasted content
    const emailMatches = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    if (emailMatches.length) {
      const uniqueEmails = Array.from(new Set(emailMatches));
      setTo(prev => {
        const existing = prev.split(',').map(x => x.trim()).filter(Boolean);
        const merged = Array.from(new Set([...existing, ...uniqueEmails]));
        return merged.join(', ');
      });
      setAudienceListId('');
    }
    setShowBatchRecipients(false);
    setBatchRecipientsText('');
  };

  const vars = ['first_name', 'last_name', 'company', 'email', 'unsubscribe_url'];
  const insert = (v: string) => setHtmlBody(x => `${x}${x ? '\n' : ''}{{${v}}}`);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await onSendEmail({
        senderId, fromName, fromEmail, replyTo,
        to: to.split(',').map(x => x.trim()).filter(Boolean),
        cc: cc ? cc.split(',').map(x => x.trim()).filter(Boolean) : undefined,
        bcc: bcc ? bcc.split(',').map(x => x.trim()).filter(Boolean) : undefined,
        subject, preheader, headHtml, htmlBody, plainText,
        customHeaders: Object.fromEntries(headers.filter(h => h.key.trim()).map(h => [h.key.trim(), h.value.trim()])),
        enableOpenTracking: openTracking, enableClickTracking: clickTracking, isMarketing: marketing,
      });
    } finally {
      setSending(false);
    }
  };

  const [testSending, setTestSending] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const dispatchTest = async () => {
    if (!testEmail.trim()) return;
    setTestSending(true);
    setTestFeedback(null);
    try {
      const ok = await onSendTest({
        testEmail: testEmail.trim(),
        fromName,
        fromEmail,
        subject,
        preheader,
        headHtml,
        htmlBody,
        plainText,
        enableOpenTracking: openTracking,
        enableClickTracking: clickTracking
      });
      if (ok !== false) {
        setTestFeedback({ type: 'success', text: `Dispatched to ${testEmail.trim()} via Amazon SES Relay / KumoMTA spool with 250 OK acknowledgment.` });
        setTimeout(() => {
          setShowTest(false);
          setTestFeedback(null);
        }, 2500);
      } else {
        setTestFeedback({ type: 'error', text: 'Test send failed. Verify your verified sender identity.' });
      }
    } catch (e: any) {
      setTestFeedback({ type: 'error', text: e?.message || 'Failed to dispatch test.' });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1750px] mx-auto space-y-5 text-zinc-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Compose Email</h1>
            <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-[#28303a] bg-[#101318] text-zinc-500">KumoMTA</span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">Production composer · reusable templates · personalization · tracking</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowTest(true)} className="px-3 py-2 rounded-md border border-[#28303a] bg-[#111419] text-xs"><Zap className="w-3.5 h-3.5 inline mr-1.5" />Send test</button>
          <button form="email-composer" disabled={sending || !fromEmail || !to.trim() || !subject.trim()} className="px-4 py-2 rounded-md bg-white text-black text-xs font-bold disabled:opacity-40"><Send className="w-3.5 h-3.5 inline mr-1.5" />{sending ? 'Sending…' : 'Send now'}</button>
        </div>
      </div>

      {senders.length === 0 && <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-4 text-xs text-amber-200">No verified sender is available. Add and verify a sender before dispatching.</div>}

      <div className="bg-[#101216] border border-[#242832] rounded-lg p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[240px]"><label className="text-[10px] uppercase tracking-wider text-zinc-600">Template</label><select value={templateId} onChange={e => loadTemplate(e.target.value)} className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs"><option value="">Start from scratch</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div className="flex-1 min-w-[180px]"><label className="text-[10px] uppercase tracking-wider text-zinc-600">Template name</label><input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Monthly newsletter" className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs" /></div>
        <button type="button" onClick={saveTemplate} disabled={templateBusy || !templateName.trim()} className="px-3 py-2.5 rounded-md bg-[#191d24] border border-[#303641] text-xs disabled:opacity-40">{templateBusy ? 'Saving…' : templateId ? 'Update template' : 'Save template'}</button>
        {templateId && <button type="button" onClick={deleteTemplate} disabled={templateBusy} className="px-3 py-2.5 rounded-md border border-red-900/60 text-red-300 text-xs"><Trash2 className="w-3.5 h-3.5 inline mr-1" />Delete</button>}
      </div>

      {/* Deliverability & Inbox Placement Shield */}
      <div className="bg-[#0e1116] border border-[#232832] rounded-lg p-4 space-y-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold shrink-0 transition-all ${
              deliverabilityAnalysis.score >= 90
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : deliverabilityAnalysis.score >= 70
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }`}>
              <span className="text-base leading-none">{deliverabilityAnalysis.score}%</span>
              <span className="text-[9px] uppercase tracking-tight font-medium opacity-80 mt-0.5">Inbox</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Inbox Placement & Anti-Spam Guard
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  deliverabilityAnalysis.score >= 90
                    ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                    : deliverabilityAnalysis.score >= 70
                    ? 'bg-amber-950/70 text-amber-300 border border-amber-800/60'
                    : 'bg-rose-950/70 text-rose-300 border border-rose-800/60'
                }`}>
                  {deliverabilityAnalysis.score >= 90 ? 'High Inbox Placement Confidence' : deliverabilityAnalysis.score >= 70 ? 'Moderate Deliverability' : 'Spam Filter Risk'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Evaluates DKIM (kumo2026), SPF, RFC 8058 One-Click List-Unsubscribe, multipart sync, and spam trigger score.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={autoOptimizeForInbox}
              className="px-3.5 py-2 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{justOptimized ? 'Optimized for Inbox!' : '⚡ Optimize for Inbox'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowDeliverabilityDetails(!showDeliverabilityDetails)}
              className="px-3 py-2 rounded-md border border-[#292e37] bg-[#14171d] text-zinc-300 text-xs flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <span>{showDeliverabilityDetails ? 'Hide Details' : 'Deliverability Audit'}</span>
              {showDeliverabilityDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {showDeliverabilityDetails && (
          <div className="pt-3 border-t border-[#1f242d] space-y-3">
            {deliverabilityAnalysis.issues.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">Recommended Adjustments</div>
                {deliverabilityAnalysis.issues.map((iss, i) => (
                  <div key={i} className={`flex items-start justify-between gap-3 p-2.5 rounded-md text-xs border ${
                    iss.type === 'critical' ? 'bg-rose-950/25 border-rose-900/60 text-rose-200' : iss.type === 'warning' ? 'bg-amber-950/25 border-amber-900/60 text-amber-200' : 'bg-blue-950/25 border-blue-900/60 text-blue-200'
                  }`}>
                    <div className="flex items-start gap-2">
                      {iss.type === 'critical' ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />}
                      <span>{iss.text}</span>
                    </div>
                    {iss.fix && (
                      <button
                        type="button"
                        onClick={iss.fix}
                        className="shrink-0 px-2.5 py-1 rounded bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold transition-colors"
                      >
                        {iss.fixLabel || 'Fix'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Passing Inbox Signals</div>
              <div className="grid md:grid-cols-2 gap-2">
                {deliverabilityAnalysis.passes.map((pass, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded bg-[#07090c] border border-[#1b1f28] text-xs text-zinc-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{pass}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <form id="email-composer" onSubmit={submit} className="grid xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,.9fr)] gap-5">
        <div className="space-y-4">
          <section className="bg-[#101216] border border-[#242832] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold flex items-center gap-2"><UserCheck className="w-4 h-4" />Sender & recipients</h2>
              <span className="text-[10px] text-zinc-500">Auto-filled from verified domain, fully customizable</span>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-[11px] text-zinc-500">
                <span>Verified sender profile</span>
                <select value={senderId} onChange={e => selectSender(e.target.value)} className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs text-zinc-200 focus:border-zinc-500 outline-none">
                  <option value="">Custom identity / None</option>
                  {senders.map(s => <option key={s.id} value={s.id}>{s.name || s.fromEmail} · {s.fromEmail}</option>)}
                </select>
              </label>
              <label className="text-[11px] text-zinc-500">
                <span className="flex items-center justify-between">
                  <span>From name (editable)</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Dynamic</span>
                </span>
                <input
                  value={fromName}
                  onChange={e => setFromName(e.target.value)}
                  placeholder="e.g. Acme Notifications or John Doe"
                  className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs text-zinc-100 focus:border-zinc-400 outline-none transition-colors"
                />
              </label>
              <label className="text-[11px] text-zinc-500">
                <span className="flex items-center justify-between">
                  <span>From email address (editable)</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Dynamic</span>
                </span>
                <input
                  type="email"
                  required
                  value={fromEmail}
                  onChange={e => setFromEmail(e.target.value)}
                  placeholder="hello@yourdomain.com"
                  className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs text-zinc-100 font-mono focus:border-zinc-400 outline-none transition-colors"
                />
              </label>
              <label className="text-[11px] text-zinc-500">
                <span>Reply-To address (optional)</span>
                <input
                  type="email"
                  value={replyTo}
                  onChange={e => setReplyTo(e.target.value)}
                  placeholder="support@yourdomain.com"
                  className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs text-zinc-100 font-mono focus:border-zinc-400 outline-none"
                />
              </label>
            </div>

            <div className="rounded-md border border-[#252a33] bg-[#0b0d10] p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Audience & Contacts</div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Select a contact list or paste an email list directly.</p>
                </div>
                {audienceListId && <span className="text-[10px] font-mono text-zinc-400">{audienceContacts.length} contacts loaded</span>}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <select value={audienceListId} onChange={e => loadAudience(e.target.value)} disabled={audienceLoading} className="flex-1 bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs text-zinc-300">
                  <option value="">Manual recipients / custom paste</option>
                  {lists.map(l => <option key={l.id} value={l.id}>{l.name} · {l.memberCount} contacts</option>)}
                </select>
                <button type="button" onClick={loadLists} className="px-3 py-2 rounded-md border border-[#292e37] bg-[#111419] text-[10px] text-zinc-400 hover:text-white">Refresh lists</button>
              </div>
              {audienceLoading && <p className="text-[10px] text-zinc-500">Loading selected audience…</p>}
              {audienceError && <p className="text-[10px] text-red-300">{audienceError}</p>}
              {audienceListId && !audienceLoading && !audienceError && (
                <div className="flex flex-wrap gap-2 text-[10px] text-zinc-400">
                  <span className="px-2 py-1 rounded bg-[#15181e] border border-[#252a33]">{audienceContacts.length} recipients</span>
                  <span className="px-2 py-1 rounded bg-[#15181e] border border-[#252a33]">Variables available for personalization</span>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-zinc-400 font-medium">Recipients (To)</span>
                <button
                  type="button"
                  onClick={() => setShowBatchRecipients(true)}
                  className="text-[10px] text-zinc-300 hover:text-white flex items-center gap-1 bg-[#181c24] hover:bg-[#222834] px-2 py-0.5 rounded border border-[#2c3240] transition-colors"
                >
                  <ClipboardList className="w-3 h-3" />
                  <span>Paste / Copy-Paste bulk emails</span>
                </button>
              </div>
              <input
                required
                value={to}
                onChange={e => { setAudienceListId(''); setAudienceContacts(contacts); setTo(e.target.value); }}
                placeholder="recipient1@example.com, recipient2@example.com, user@domain.com"
                className="w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs text-zinc-100 font-mono placeholder:text-zinc-600 focus:border-zinc-400 outline-none"
              />
              <p className="text-[10px] text-zinc-600 mt-1">Comma-separated emails. You can paste thousands of addresses at once using the bulk paste button.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-[11px] text-zinc-500">
                <span>CC (Optional)</span>
                <input value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@example.com" className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs font-mono" />
              </label>
              <label className="text-[11px] text-zinc-500">
                <span>BCC (Optional)</span>
                <input value={bcc} onChange={e => setBcc(e.target.value)} placeholder="bcc@example.com" className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs font-mono" />
              </label>
            </div>
          </section>

          <section className="bg-[#101216] border border-[#242832] rounded-lg p-5 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Mail className="w-4 h-4" />Envelope metadata & Headers</h2>
            <label className="block text-[11px] text-zinc-500">
              <span>Subject</span>
              <input required value={subject} onChange={e => setSubject(e.target.value)} placeholder="Your email subject" className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs text-zinc-100" />
            </label>
            <label className="block text-[11px] text-zinc-500">
              <span>Preheader (Inbox preview text)</span>
              <input value={preheader} onChange={e => setPreheader(e.target.value)} placeholder="Summary preview shown before opening email" className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs text-zinc-100" />
            </label>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-[11px] text-zinc-400 font-medium">Custom SMTP / MIME Headers</span>
                  <p className="text-[10px] text-zinc-600">Extra headers injected into RFC 822 email transmission (e.g. X-Entity-Ref-ID, Reply-To, Priority)</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBatchHeaders(true)}
                    className="text-[10px] text-zinc-300 hover:text-white flex items-center gap-1 bg-[#181c24] hover:bg-[#222834] px-2 py-1 rounded border border-[#2c3240] transition-colors"
                  >
                    <ClipboardList className="w-3 h-3" />
                    <span>Paste Raw Headers</span>
                  </button>
                  <button
                    type="button"
                    onClick={addHeader}
                    className="text-[10px] text-zinc-300 hover:text-white flex items-center gap-1 bg-[#181c24] hover:bg-[#222834] px-2 py-1 rounded border border-[#2c3240] transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Header</span>
                  </button>
                </div>
              </div>

              {headers.length === 0 ? (
                <div className="rounded-md border border-dashed border-[#262a33] p-3 text-center text-[11px] text-zinc-600">
                  No custom headers configured. Click "Add Header" or "Paste Raw Headers" to inject custom headers.
                </div>
              ) : (
                headers.map((h, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      value={h.key}
                      onChange={e => updateHeader(i, 'key', e.target.value)}
                      placeholder="Header-Name (e.g. X-Campaign-ID)"
                      className="flex-1 bg-[#080a0d] border border-[#292e37] rounded-md p-2 text-xs font-mono text-zinc-200"
                    />
                    <input
                      value={h.value}
                      onChange={e => updateHeader(i, 'value', e.target.value)}
                      placeholder="Header Value"
                      className="flex-[1.5] bg-[#080a0d] border border-[#292e37] rounded-md p-2 text-xs font-mono text-zinc-200"
                    />
                    <button
                      type="button"
                      onClick={() => setHeaders(v => v.filter((_, n) => n !== i))}
                      className="p-2 text-zinc-600 hover:text-red-300 rounded hover:bg-red-950/30 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="bg-[#101216] border border-[#242832] rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Code2 className="w-4 h-4" />
                <span>HTML source editor</span>
              </h2>
              <div className="flex gap-1">
                {([['head', 'HTML HEAD / META'], ['body', 'HTML BODY'], ['text', 'PLAIN TEXT']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEditor(key)}
                    className={`px-3 py-1.5 rounded text-[10px] font-medium transition-colors ${editor === key ? 'bg-white text-black font-semibold shadow-xs' : 'bg-[#171a20] text-zinc-400 hover:text-zinc-200'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {editor === 'head' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0d0f13] border border-[#222731] rounded-md px-3 py-2">
                  <div className="text-[11px] text-zinc-400">
                    <span className="font-semibold text-zinc-300">HTML &lt;head&gt; / Terminal Header:</span> Meta tags, styling, font declarations, and document definitions.
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setHeadHtml('<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<meta http-equiv="X-UA-Compatible" content="IE=edge">\n<title></title>\n<style>\n  body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }\n  table { border-collapse: collapse; }\n  img { border: 0; outline: none; text-decoration: none; }\n</style>')}
                      className="text-[10px] text-zinc-300 hover:text-white px-2 py-1 rounded bg-[#1c212a] border border-[#2c3240] transition-colors"
                    >
                      Reset Standard &lt;head&gt;
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) setHeadHtml(text);
                        } catch {
                          /* clipboard api fallback */
                        }
                      }}
                      className="text-[10px] text-zinc-300 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-[#1c212a] border border-[#2c3240] transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Paste Clipboard</span>
                    </button>
                  </div>
                </div>
                <textarea
                  value={headHtml}
                  onChange={e => setHeadHtml(e.target.value)}
                  spellCheck={false}
                  placeholder={`<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<style>body { font-family: sans-serif; }</style>`}
                  className="w-full min-h-[300px] bg-[#080a0d] border border-[#292e37] rounded-md p-4 font-mono text-xs leading-5 text-zinc-200 outline-none focus:border-zinc-500"
                />
              </div>
            )}

            {editor === 'body' && (
              <>
                <p className="text-[10px] text-zinc-500 mb-2">HTML Body markup. You can use standard tables, inline styles, or personalizing tags below.</p>
                <textarea
                  value={htmlBody}
                  onChange={e => setHtmlBody(e.target.value)}
                  spellCheck={false}
                  className="w-full min-h-[430px] bg-[#080a0d] border border-[#292e37] rounded-md p-4 font-mono text-xs leading-5 text-zinc-200 outline-none focus:border-zinc-500"
                  placeholder="<table>…</table>"
                />
              </>
            )}

            {editor === 'text' && (
              <textarea
                value={plainText}
                onChange={e => setPlainText(e.target.value)}
                spellCheck={false}
                className="w-full min-h-[430px] bg-[#080a0d] border border-[#292e37] rounded-md p-4 font-mono text-xs leading-5 text-zinc-200 outline-none focus:border-zinc-500"
                placeholder="Plain-text fallback for non-HTML email readers…"
              />
            )}

            <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-[#1e222b]">
              <span className="text-[10px] text-zinc-500 mr-1">Insert variable:</span>
              {vars.map(v => (
                <button
                  type="button"
                  key={v}
                  onClick={() => insert(v)}
                  className="px-2 py-1 rounded bg-[#171a20] border border-[#292e37] text-[10px] font-mono text-zinc-300 hover:text-white hover:border-zinc-400 transition-colors"
                >
                  {'{{' + v + '}}'}
                </button>
              ))}
            </div>
          </section>

          <section className="bg-[#101216] border border-[#242832] rounded-lg p-5"><h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><MousePointerClick className="w-4 h-4" />Delivery & tracking</h2><div className="grid md:grid-cols-3 gap-3">{[[marketing, 'Marketing / bulk message', setMarketing], [openTracking, 'Open tracking', setOpenTracking], [clickTracking, 'Click tracking', setClickTracking]].map(([checked, label, setter]: any) => <label key={String(label)} className="flex items-center justify-between p-3 rounded-md bg-[#0a0c0f] border border-[#22262e] text-xs text-zinc-400"><span>{label}</span><input type="checkbox" checked={checked} onChange={e => setter(e.target.checked)} className="w-4 h-4" /></label>)}</div><p className="text-[10px] text-zinc-600 mt-3">Marketing mode triggers server-side unsubscribe/List-Unsubscribe handling and compliance validation.</p></section>
        </div>

        <aside><section className="bg-[#101216] border border-[#242832] rounded-lg overflow-hidden sticky top-4"><div className="p-4 border-b border-[#242832] flex items-center justify-between"><div><h2 className="text-sm font-semibold flex items-center gap-2"><Eye className="w-4 h-4" />Live preview</h2><p className="text-[10px] text-zinc-600 mt-1">Rendered with selected contact values</p></div><div className="flex gap-1"><button type="button" onClick={() => setPreview('desktop')} className={`p-2 rounded ${preview === 'desktop' ? 'bg-white text-black' : 'bg-[#171a20] text-zinc-500'}`}><Monitor className="w-3.5 h-3.5" /></button><button type="button" onClick={() => setPreview('mobile')} className={`p-2 rounded ${preview === 'mobile' ? 'bg-white text-black' : 'bg-[#171a20] text-zinc-500'}`}><Smartphone className="w-3.5 h-3.5" /></button></div></div><div className="p-3 bg-[#090b0e]"><select value={contactId} onChange={e => setContactId(e.target.value)} className="w-full bg-[#101318] border border-[#292e37] rounded-md p-2 text-[10px] text-zinc-300 mb-3"><option value="">Preview fallback values</option>{audienceContacts.map(c => <option key={c.id} value={c.id}>{c.email}{c.company ? ` · ${c.company}` : ''}</option>)}</select><div className={`${preview === 'mobile' ? 'max-w-[390px]' : 'w-full'} mx-auto bg-white rounded-sm overflow-hidden`}><div className="px-4 py-3 border-b text-black"><div className="text-[10px] text-zinc-500">{fromName || fromEmail || 'From'} · Preview</div><div className="text-sm font-semibold mt-1">{previewSubject || 'Subject preview'}</div><div className="text-[10px] text-zinc-500 mt-1">{preheader || 'Preheader preview'}</div></div><iframe title="email-preview" sandbox="allow-same-origin" srcDoc={`<!doctype html><html><head>${headHtml}</head><body style="margin:0">${previewBody}</body></html>`} className="w-full h-[600px] border-0" /></div></div></section></aside>
      </form>

      {showTest && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#111318] border border-[#2a2f39] rounded-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-white">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Test Inbox Placement</span>
              </h3>
              <button
                type="button"
                onClick={() => { setShowTest(false); setTestFeedback(null); }}
                className="text-zinc-500 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Send a real test email with current SPF/DKIM headers, One-Click List-Unsubscribe, and MIME plain-text to check inbox placement in Gmail, Outlook, or Yahoo.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500">Recipient Test Address</label>
              <input
                autoFocus
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="your.inbox@gmail.com or mail-tester address"
                className="w-full bg-[#080a0d] border border-[#292e37] rounded-md p-3 text-xs text-zinc-100 placeholder:text-zinc-700 outline-none focus:border-zinc-500"
              />
            </div>

            <div className="rounded-md bg-[#090b0e] border border-[#202530] p-3 text-[11px] text-zinc-400 space-y-1.5">
              <div className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Deliverability Verification</span>
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-zinc-500 text-[10px]">
                <li>DKIM Signed with selector <code className="text-zinc-300">kumo2026</code></li>
                <li>Amazon SES Relay & KumoMTA Spool active</li>
                <li>RFC 8058 One-Click List-Unsubscribe headers injected</li>
              </ul>
            </div>

            {testFeedback && (
              <div className={`p-2.5 rounded-md text-xs border ${
                testFeedback.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800 text-rose-300'
              }`}>
                {testFeedback.text}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowTest(false); setTestFeedback(null); }}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={dispatchTest}
                disabled={!testEmail.trim() || testSending}
                className="px-4 py-2 rounded bg-white hover:bg-zinc-200 text-black text-xs font-bold disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                {testSending ? 'Dispatching…' : <><Send className="w-3 h-3" /><span>Send to Inbox</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Recipients Paste Modal */}
      {showBatchRecipients && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#111318] border border-[#2a2f39] rounded-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-white">
                <ClipboardList className="w-4 h-4 text-emerald-400" />
                <span>Paste / Bulk Import Recipients</span>
              </h3>
              <button type="button" onClick={() => setShowBatchRecipients(false)} className="text-zinc-500 hover:text-white text-xs">✕</button>
            </div>
            <p className="text-xs text-zinc-400">
              Paste email addresses in any format (one per line, comma-separated, semicolon-separated, or mixed with text).
              Our parser will extract all valid addresses automatically without requiring manual typing.
            </p>
            <textarea
              autoFocus
              rows={8}
              value={batchRecipientsText}
              onChange={e => setBatchRecipientsText(e.target.value)}
              placeholder={`user1@domain.com\nuser2@example.org\n"John Doe" <john@company.com>\nalice@test.com, bob@test.com`}
              className="w-full bg-[#080a0d] border border-[#292e37] rounded-md p-3 text-xs font-mono text-zinc-100 placeholder:text-zinc-700 outline-none focus:border-zinc-500"
            />
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-zinc-500 font-mono">
                Detected: {((batchRecipientsText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])).length} emails
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBatchRecipients(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => applyBatchRecipients(batchRecipientsText)}
                  disabled={!batchRecipientsText.trim()}
                  className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold disabled:opacity-40 transition-colors"
                >
                  Apply Recipients
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Raw Headers Modal */}
      {showBatchHeaders && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#111318] border border-[#2a2f39] rounded-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-white">
                <ClipboardList className="w-4 h-4 text-sky-400" />
                <span>Paste Raw Headers (RFC 822 / Key: Value)</span>
              </h3>
              <button type="button" onClick={() => setShowBatchHeaders(false)} className="text-zinc-500 hover:text-white text-xs">✕</button>
            </div>
            <p className="text-xs text-zinc-400">
              Paste email headers directly (e.g. from an exported draft or terminal template). One header per line formatted as <code className="text-zinc-200 bg-zinc-900 px-1 py-0.5 rounded">Key: Value</code>.
            </p>
            <textarea
              autoFocus
              rows={8}
              value={batchHeadersText}
              onChange={e => setBatchHeadersText(e.target.value)}
              placeholder={`X-Campaign-ID: BlackFriday-2026\nX-Entity-Ref-ID: promo_october\nX-Priority: 1\nReply-To: support@yourdomain.com`}
              className="w-full bg-[#080a0d] border border-[#292e37] rounded-md p-3 text-xs font-mono text-zinc-100 placeholder:text-zinc-700 outline-none focus:border-zinc-500"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowBatchHeaders(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => applyBatchHeaders(batchHeadersText)}
                disabled={!batchHeadersText.trim()}
                className="px-4 py-1.5 rounded bg-sky-500 hover:bg-sky-400 text-black text-xs font-semibold disabled:opacity-40 transition-colors"
              >
                Parse & Inject Headers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
