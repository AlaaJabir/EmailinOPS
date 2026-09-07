import React, { useEffect, useState } from 'react';
import { Plus, Play, Pause, Send } from 'lucide-react';
import { Campaign, Sender, ContactList } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface CampaignsViewProps {
  campaigns: Campaign[];
  senders: Sender[];
  lists: ContactList[];
  onCreateCampaign: (campaign: any) => Promise<void>;
  onUpdateCampaignStatus: (id: string, status: string) => Promise<void>;
  onRunCampaign?: (id: string) => Promise<void>;
  initialListId?: string;
}

export const CampaignsView: React.FC<CampaignsViewProps> = ({ campaigns, senders, lists, onCreateCampaign, onUpdateCampaignStatus, onRunCampaign, initialListId }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [senderId, setSenderId] = useState(senders[0]?.id || '');
  const [listId, setListId] = useState(initialListId || lists[0]?.id || '');
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('<p>Welcome to our new platform update.</p>');
  const [plainText, setPlainText] = useState('Welcome to our new platform update.');
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);

  useEffect(() => { if (initialListId) { setListId(initialListId); setShowCreateModal(true); } }, [initialListId]);
  useEffect(() => { if (!senderId && senders[0]?.id) setSenderId(senders[0].id); }, [senders, senderId]);
  useEffect(() => { if (!listId && lists[0]?.id) setListId(lists[0].id); }, [lists, listId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateCampaign({ name, senderId, listId, subject, htmlBody, plainText, trackOpens, trackClicks, status: 'SCHEDULED', scheduledAt: new Date(Date.now() + 3600000).toISOString() });
    setShowCreateModal(false); setName(''); setSubject(''); setTrackOpens(true); setTrackClicks(true);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-white tracking-tight">Email Campaigns</h1><p className="text-xs text-[#888888] mt-1">Broadcast marketing and transactional newsletters with audience suppression checking</p></div><button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-1.5 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-sm transition-colors"><Plus className="w-3.5 h-3.5"/><span>Create Campaign</span></button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">{campaigns.map((c) => { const openPct=c.deliveredCount>0?((c.openCount/c.deliveredCount)*100).toFixed(1):'0'; const clickPct=c.openCount>0?((c.clickCount/c.openCount)*100).toFixed(1):'0'; return <div key={c.id} className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 flex flex-col justify-between hover:border-white/20 transition-colors space-y-4"><div className="space-y-2"><div className="flex items-start justify-between gap-2"><h2 className="text-sm font-semibold text-white line-clamp-1">{c.name}</h2><StatusBadge status={c.status}/></div><div className="text-xs text-[#888888] font-mono truncate">Sub: {c.subject}</div><div className="text-[11px] text-[#888888]">From: {c.fromEmail}</div><div className="text-[10px] text-[#777777] font-mono">OPEN {c.trackOpens?'ON':'OFF'} · CLICK {c.trackClicks?'ON':'OFF'}</div></div><div className="grid grid-cols-3 gap-2 p-3 rounded-sm bg-[#050505] border border-white-10 text-center font-mono"><div><div className="text-xs font-semibold text-white">{c.deliveredCount.toLocaleString()}</div><div className="text-[9px] uppercase tracking-wider text-[#888888] font-sans">Delivered</div></div><div><div className="text-xs font-semibold text-sky-400">{openPct}%</div><div className="text-[9px] uppercase tracking-wider text-[#888888] font-sans">Open Rate</div></div><div><div className="text-xs font-semibold text-teal-400">{clickPct}%</div><div className="text-[9px] uppercase tracking-wider text-[#888888] font-sans">Click Rate</div></div></div><div className="flex items-center justify-between pt-2 border-t border-white-10 text-xs"><span className="text-[11px] text-[#888888] font-mono">{c.totalRecipients.toLocaleString()} recipients</span><div className="flex items-center gap-2">{onRunCampaign&&c.status!=='SENDING'&&<button onClick={()=>onRunCampaign(c.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-xs bg-white/10 hover:bg-white text-white hover:text-black font-semibold text-[11px]"><Send className="w-3 h-3"/>Dispatch</button>}{c.status==='SENDING'&&<button onClick={()=>onUpdateCampaignStatus(c.id,'PAUSED')} className="p-1 text-amber-300"><Pause className="w-4 h-4"/></button>}{c.status==='PAUSED'&&<button onClick={()=>onUpdateCampaignStatus(c.id,'SENDING')} className="p-1 text-emerald-400"><Play className="w-4 h-4"/></button>}</div></div></div>; })}</div>
      {showCreateModal&&<div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"><div className="bg-[#0F0F0F] border border-white-10 rounded-sm max-w-lg w-full p-6 space-y-4 shadow-2xl font-sans"><h2 className="text-sm font-semibold text-white">Create New Campaign</h2><form onSubmit={handleCreate} className="space-y-3"><div><label className="block text-xs font-medium text-[#888888] mb-1">Campaign Name</label><input type="text" required value={name} onChange={e=>setName(e.target.value)} className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white"/></div><div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-[#888888] mb-1">Sender Identity</label><select value={senderId} onChange={e=>setSenderId(e.target.value)} className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white">{senders.map(s=><option key={s.id} value={s.id}>{s.name} ({s.fromEmail})</option>)}</select></div><div><label className="block text-xs font-medium text-[#888888] mb-1">Target Audience List</label><select value={listId} onChange={e=>setListId(e.target.value)} className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white">{lists.map(l=><option key={l.id} value={l.id}>{l.name} ({l.memberCount} contacts)</option>)}</select></div></div><div><label className="block text-xs font-medium text-[#888888] mb-1">Subject Line</label><input type="text" required value={subject} onChange={e=>setSubject(e.target.value)} className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white"/></div><div><label className="block text-xs font-medium text-[#888888] mb-1">HTML Content</label><textarea rows={4} value={htmlBody} onChange={e=>setHtmlBody(e.target.value)} className="w-full bg-[#050505] border border-white-10 rounded-sm p-2.5 text-xs font-mono text-white"/></div><div className="rounded-sm border border-white-10 bg-[#050505] p-3 space-y-3"><div className="text-xs font-semibold text-white">Tracking</div><label className="flex items-center justify-between text-xs text-[#bdbdbd]">Track Opens<input type="checkbox" checked={trackOpens} onChange={e=>setTrackOpens(e.target.checked)}/></label><label className="flex items-center justify-between text-xs text-[#bdbdbd]">Track Clicks<input type="checkbox" checked={trackClicks} onChange={e=>setTrackClicks(e.target.checked)}/></label></div><div className="flex items-center justify-end gap-2 pt-3"><button type="button" onClick={()=>setShowCreateModal(false)} className="px-3 py-1.5 rounded-sm bg-white/5 text-[#888888] border border-white-10 text-xs">Cancel</button><button type="submit" className="px-4 py-1.5 rounded-sm bg-white text-black text-xs font-semibold">Schedule Campaign</button></div></form></div></div>}
    </div>
  );
};
