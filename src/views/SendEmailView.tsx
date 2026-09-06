import React, { useMemo, useState } from 'react';
import { Code2, Eye, FileCode2, Mail, Monitor, MousePointerClick, Plus, Send, Smartphone, Sparkles, Trash2, UserCheck, Zap } from 'lucide-react';
import { Contact, Domain, Sender } from '../types';

interface Props {
  senders: Sender[];
  domains: Domain[];
  contacts?: Contact[];
  onSendEmail: (payload: any) => Promise<any>;
  onSendTest: (payload: any) => Promise<any>;
}

const replaceVars = (value: string, contact?: Contact | null, email = '') => value
  .replace(/\{\{\s*first_name\s*\}\}/gi, contact?.firstName || 'there')
  .replace(/\{\{\s*last_name\s*\}\}/gi, contact?.lastName || '')
  .replace(/\{\{\s*company\s*\}\}/gi, contact?.company || 'your organization')
  .replace(/\{\{\s*email\s*\}\}/gi, email || contact?.email || 'recipient@example.com')
  .replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, `${window.location.origin}/unsubscribe/preview`);

export const SendEmailView: React.FC<Props> = ({ senders, domains, contacts = [], onSendEmail, onSendTest }) => {
  const sender = senders[0];
  const [senderId, setSenderId] = useState(sender?.id || '');
  const [fromName, setFromName] = useState(sender?.name || '');
  const [fromEmail, setFromEmail] = useState(sender?.fromEmail || '');
  const [replyTo, setReplyTo] = useState(sender?.replyTo || '');
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
  const [headers, setHeaders] = useState<Array<{key:string;value:string}>>([]);
  const [testEmail, setTestEmail] = useState('');
  const [showTest, setShowTest] = useState(false);
  const [sending, setSending] = useState(false);

  const selectedContact = contacts.find(c => c.id === contactId) || null;
  const previewBody = useMemo(() => replaceVars(htmlBody, selectedContact, selectedContact?.email || to.split(',')[0]?.trim()), [htmlBody, selectedContact, to]);
  const previewSubject = useMemo(() => replaceVars(subject, selectedContact, selectedContact?.email || to.split(',')[0]?.trim()), [subject, selectedContact, to]);

  const selectSender = (id: string) => { const s = senders.find(x => x.id === id); setSenderId(id); if (s) { setFromName(s.name || ''); setFromEmail(s.fromEmail || ''); setReplyTo(s.replyTo || ''); } };
  const addHeader = () => setHeaders(v => [...v, { key: '', value: '' }]);
  const updateHeader = (i: number, key: 'key'|'value', value: string) => setHeaders(v => v.map((h, n) => n === i ? { ...h, [key]: value } : h));
  const vars = ['first_name', 'last_name', 'company', 'email', 'unsubscribe_url'];
  const insert = (v: string) => setHtmlBody(x => `${x}${x ? '\n' : ''}{{${v}}}`);
  const headerObject = Object.fromEntries(headers.filter(h => h.key.trim()).map(h => [h.key.trim(), h.value.trim()]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSending(true);
    try { await onSendEmail({ senderId, fromName, fromEmail, replyTo, to: to.split(',').map(x=>x.trim()).filter(Boolean), cc: cc ? cc.split(',').map(x=>x.trim()).filter(Boolean) : undefined, bcc: bcc ? bcc.split(',').map(x=>x.trim()).filter(Boolean) : undefined, subject, preheader, headHtml, htmlBody, plainText, customHeaders: headerObject, enableOpenTracking: openTracking, enableClickTracking: clickTracking, isMarketing: marketing }); } finally { setSending(false); }
  };

  const dispatchTest = async () => { if (!testEmail.trim()) return; await onSendTest({ testEmail: testEmail.trim(), fromEmail, subject, preheader, headHtml, htmlBody, plainText, enableOpenTracking: openTracking, enableClickTracking: clickTracking }); setShowTest(false); };

  return <div className="p-4 md:p-6 max-w-[1750px] mx-auto space-y-5 text-zinc-100">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-3"><h1 className="text-2xl font-bold">Compose Email</h1><span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-[#28303a] bg-[#101318] text-zinc-500">KumoMTA</span></div><p className="text-xs text-zinc-500 mt-1">Production message composer · personalization · tracking · compliance headers</p></div><div className="flex gap-2"><button type="button" onClick={()=>setShowTest(true)} className="px-3 py-2 rounded-md border border-[#28303a] bg-[#111419] text-xs"><Zap className="w-3.5 h-3.5 inline mr-1.5"/>Send test</button><button form="email-composer" disabled={sending || !fromEmail || !to.trim() || !subject.trim()} className="px-4 py-2 rounded-md bg-white text-black text-xs font-bold disabled:opacity-40"><Send className="w-3.5 h-3.5 inline mr-1.5"/>{sending ? 'Sending…' : 'Send now'}</button></div></div>

    {senders.length === 0 && <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-4 text-xs text-amber-200">No verified sender is available. Add and verify a sender before dispatching a message.</div>}

    <form id="email-composer" onSubmit={submit} className="grid xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,.9fr)] gap-5">
      <div className="space-y-4">
        <section className="bg-[#101216] border border-[#242832] rounded-lg p-5 space-y-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold flex items-center gap-2"><UserCheck className="w-4 h-4"/> Sender & recipients</h2><span className="text-[10px] text-zinc-600">{domains.length} configured domains</span></div><div className="grid md:grid-cols-2 gap-3"><label className="text-[11px] text-zinc-500">Verified sender<select value={senderId} onChange={e=>selectSender(e.target.value)} className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs text-white"><option value="">Select sender</option>{senders.map(s=><option key={s.id} value={s.id}>{s.name || s.fromEmail} · {s.fromEmail}</option>)}</select></label><label className="text-[11px] text-zinc-500">From name<input value={fromName} onChange={e=>setFromName(e.target.value)} className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs text-white"/></label><label className="text-[11px] text-zinc-500">From email<input value={fromEmail} onChange={e=>setFromEmail(e.target.value)} className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs text-white"/></label><label className="text-[11px] text-zinc-500">Reply-To<input value={replyTo} onChange={e=>setReplyTo(e.target.value)} placeholder="optional" className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs text-white"/></label></div><label className="block text-[11px] text-zinc-500">Recipients <span className="text-zinc-700">comma separated</span><input required value={to} onChange={e=>setTo(e.target.value)} placeholder="recipient@example.com, another@example.com" className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs text-white"/></label><div className="grid md:grid-cols-2 gap-3"><label className="text-[11px] text-zinc-500">CC<input value={cc} onChange={e=>setCc(e.target.value)} className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs text-white"/></label><label className="text-[11px] text-zinc-500">BCC<input value={bcc} onChange={e=>setBcc(e.target.value)} className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs text-white"/></label></div></section>

        <section className="bg-[#101216] border border-[#242832] rounded-lg p-5 space-y-3"><h2 className="text-sm font-semibold flex items-center gap-2"><Mail className="w-4 h-4"/> Envelope & metadata</h2><label className="block text-[11px] text-zinc-500">Subject<input required value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Your email subject" className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs text-white"/></label><label className="block text-[11px] text-zinc-500">Preheader<input value={preheader} onChange={e=>setPreheader(e.target.value)} placeholder="Preview text shown by inbox clients" className="mt-1 w-full bg-[#080a0d] border border-[#292e37] rounded-md p-2.5 text-xs text-white"/></label><div><div className="flex items-center justify-between mb-2"><span className="text-[11px] text-zinc-500">Custom headers</span><button type="button" onClick={addHeader} className="text-[10px] text-zinc-300"><Plus className="w-3 h-3 inline mr-1"/>Add header</button></div>{headers.map((h,i)=><div key={i} className="flex gap-2 mb-2"><input value={h.key} onChange={e=>updateHeader(i,'key',e.target.value)} placeholder="Header-Name" className="flex-1 bg-[#080a0d] border border-[#292e37] rounded-md p-2 text-xs"/><input value={h.value} onChange={e=>updateHeader(i,'value',e.target.value)} placeholder="Value" className="flex-[1.5] bg-[#080a0d] border border-[#292e37] rounded-md p-2 text-xs"/><button type="button" onClick={()=>setHeaders(v=>v.filter((_,n)=>n!==i))} className="p-2 text-zinc-600 hover:text-red-300"><Trash2 className="w-3.5 h-3.5"/></button></div>)}</div></section>

        <section className="bg-[#101216] border border-[#242832] rounded-lg p-5"><div className="flex items-center justify-between mb-3"><h2 className="text-sm font-semibold flex items-center gap-2"><Code2 className="w-4 h-4"/> HTML source editor</h2><div className="flex gap-1">{([['head','HEAD'],['body','BODY'],['text','PLAIN TEXT']] as const).map(([key,label])=><button key={key} type="button" onClick={()=>setEditor(key)} className={`px-2.5 py-1.5 rounded text-[10px] ${editor===key?'bg-white text-black':'bg-[#171a20] text-zinc-500'}`}>{label}</button>)}</div></div>{editor==='head'&&<><p className="text-[10px] text-zinc-600 mb-2">Only document-level markup: meta tags, style blocks, font declarations and other HEAD content.</p><textarea value={headHtml} onChange={e=>setHeadHtml(e.target.value)} spellCheck={false} className="w-full min-h-[300px] bg-[#080a0d] border border-[#292e37] rounded-md p-4 font-mono text-xs leading-5 text-zinc-200 outline-none"/></>}{editor==='body'&&<><p className="text-[10px] text-zinc-600 mb-2">BODY content is wrapped into a complete HTML document server-side. Existing full HTML documents are preserved.</p><textarea value={htmlBody} onChange={e=>setHtmlBody(e.target.value)} spellCheck={false} className="w-full min-h-[430px] bg-[#080a0d] border border-[#292e37] rounded-md p-4 font-mono text-xs leading-5 text-zinc-200 outline-none" placeholder="<table>…</table>"/></>}{editor==='text'&&<textarea value={plainText} onChange={e=>setPlainText(e.target.value)} spellCheck={false} className="w-full min-h-[430px] bg-[#080a0d] border border-[#292e37] rounded-md p-4 font-mono text-xs leading-5 text-zinc-200 outline-none" placeholder="Plain-text fallback…"/>}<div className="flex flex-wrap gap-1.5 mt-3">{vars.map(v=><button type="button" key={v} onClick={()=>insert(v)} className="px-2 py-1 rounded bg-[#171a20] border border-[#292e37] text-[10px] text-zinc-400 hover:text-white">{'{{'+v+'}}'}</button>)}</div></section>

        <section className="bg-[#101216] border border-[#242832] rounded-lg p-5"><h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><MousePointerClick className="w-4 h-4"/> Delivery & tracking</h2><div className="grid md:grid-cols-3 gap-3">{[[marketing,'Marketing / bulk message',setMarketing],[openTracking,'Open tracking',setOpenTracking],[clickTracking,'Click tracking',setClickTracking]].map(([checked,label,setter]:any)=><label key={String(label)} className="flex items-center justify-between p-3 rounded-md bg-[#0a0c0f] border border-[#22262e] text-xs text-zinc-400"><span>{label}</span><input type="checkbox" checked={checked} onChange={e=>setter(e.target.checked)} className="w-4 h-4"/></label>)}</div><p className="text-[10px] text-zinc-600 mt-3">Marketing mode enables the server-side unsubscribe/List-Unsubscribe headers and compliance validation.</p></section>
      </div>

      <aside className="space-y-4"><section className="bg-[#101216] border border-[#242832] rounded-lg overflow-hidden sticky top-4"><div className="p-4 border-b border-[#242832] flex items-center justify-between"><div><h2 className="text-sm font-semibold flex items-center gap-2"><Eye className="w-4 h-4"/> Live preview</h2><p className="text-[10px] text-zinc-600 mt-1">Variable resolution preview only</p></div><div className="flex gap-1"><button type="button" onClick={()=>setPreview('desktop')} className={`p-2 rounded ${preview==='desktop'?'bg-white text-black':'bg-[#171a20] text-zinc-500'}`}><Monitor className="w-3.5 h-3.5"/></button><button type="button" onClick={()=>setPreview('mobile')} className={`p-2 rounded ${preview==='mobile'?'bg-white text-black':'bg-[#171a20] text-zinc-500'}`}><Smartphone className="w-3.5 h-3.5"/></button></div></div><div className="p-3 bg-[#090b0e]"><div className="mb-3"><select value={contactId} onChange={e=>setContactId(e.target.value)} className="w-full bg-[#101318] border border-[#292e37] rounded-md p-2 text-[10px] text-zinc-300"><option value="">Preview fallback values</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.email}{c.company ? ` · ${c.company}` : ''}</option>)}</select></div><div className={`${preview==='mobile'?'max-w-[390px]':'w-full'} mx-auto bg-white rounded-sm overflow-hidden`}><div className="px-4 py-3 border-b text-black"><div className="text-[10px] text-zinc-500">{fromName || fromEmail || 'From'} · Preview</div><div className="text-sm font-semibold mt-1">{previewSubject || 'Subject preview'}</div><div className="text-[10px] text-zinc-500 mt-1">{preheader || 'Preheader preview'}</div></div><iframe title="email-preview" sandbox="allow-same-origin" srcDoc={`<!doctype html><html><head>${headHtml}</head><body style="margin:0">${previewBody}</body></html>`} className="w-full h-[600px] border-0"/></div></div></section></aside>
    </form>

    {showTest && <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"><div className="w-full max-w-md bg-[#111318] border border-[#2a2f39] rounded-lg p-5 space-y-4"><h3 className="font-semibold">Send test email</h3><p className="text-xs text-zinc-500">The test uses the same HTML HEAD/BODY, subject and tracking configuration as the message.</p><input autoFocus value={testEmail} onChange={e=>setTestEmail(e.target.value)} placeholder="qa@example.com" className="w-full bg-[#080a0d] border border-[#292e37] rounded-md p-3 text-xs"/><div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowTest(false)} className="px-3 py-2 text-xs text-zinc-400">Cancel</button><button type="button" onClick={dispatchTest} disabled={!testEmail.trim()} className="px-3 py-2 rounded bg-white text-black text-xs font-bold disabled:opacity-40"><Send className="w-3.5 h-3.5 inline mr-1.5"/>Dispatch test</button></div></div></div>}
  </div>;
};
