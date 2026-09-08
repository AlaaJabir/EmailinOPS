import React, { useEffect, useState } from 'react';
import { Users, UserPlus, Upload, Search, ListFilter, FileSpreadsheet, FolderPlus } from 'lucide-react';
import { Contact, ContactList } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface Props {
  contacts: Contact[];
  lists: ContactList[];
  onAddContact: (contact: any) => Promise<void>;
  onCreateList: (list: any) => Promise<void>;
  onImportCsv: (contacts: any[], listId?: string) => Promise<void>;
}

export const ContactsView: React.FC<Props> = ({ contacts, lists, onAddContact, onCreateList, onImportCsv }) => {
  const [activeTab, setActiveTab] = useState<'contacts' | 'lists'>('contacts');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [targetListId, setTargetListId] = useState('');
  const [importListId, setImportListId] = useState('');
  const [listName, setListName] = useState('');
  const [listDesc, setListDesc] = useState('');
  const [csvRawText, setCsvRawText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!targetListId && lists[0]?.id) setTargetListId(lists[0].id);
  }, [lists, targetListId]);

  useEffect(() => {
    if (!importListId && lists[0]?.id) setImportListId(lists[0].id);
  }, [lists, importListId]);

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onAddContact({ email, firstName, lastName, company, listId: targetListId || undefined });
      setShowAddModal(false);
      setEmail(''); setFirstName(''); setLastName(''); setCompany('');
    } finally { setBusy(false); }
  };

  const submitList = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onCreateList({ name: listName.trim(), description: listDesc.trim() });
      setShowListModal(false);
      setListName(''); setListDesc('');
    } finally { setBusy(false); }
  };

  const handleProcessCsv = async () => {
    const lines = csvRawText.trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return;
    const parsedContacts: any[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (i === 0 && /(^|,)\s*email\s*(,|$)/i.test(line)) continue;
      const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
      const candidate = cols[0]?.toLowerCase();
      if (candidate?.includes('@')) parsedContacts.push({ email: candidate, firstName: cols[1] || '', lastName: cols[2] || '', company: cols[3] || '' });
    }
    if (!parsedContacts.length) return;
    setBusy(true);
    try {
      await onImportCsv(parsedContacts, importListId || undefined);
      setShowCsvModal(false);
      setCsvRawText('');
    } finally { setBusy(false); }
  };

  const filteredContacts = contacts.filter((c) => {
    const q = search.toLowerCase().trim();
    return !q || c.email.toLowerCase().includes(q) || c.firstName?.toLowerCase().includes(q) || c.lastName?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-full bg-[#0a0d0c] text-[#d8e6df] p-4 md:p-6 font-mono">
      <div className="max-w-[1500px] mx-auto space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3"><h1 className="text-[20px] font-bold tracking-wide">// CONTACTS & AUDIENCES</h1><span className="text-[9px] px-2 py-1 rounded border border-[#1f8f5c] text-[#39ff9c]">LIVE DATA</span></div>
            <p className="text-[10px] text-[#4a5a53] mt-1">Persistent contacts, reusable lists and deterministic audience assignment</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCsvModal(true)} className="px-3 py-2 rounded-[4px] border border-[#2a3733] bg-[#131917] text-[10px] text-[#d8e6df]"><Upload className="w-3 h-3 inline mr-1.5"/>Import CSV</button>
            <button onClick={() => activeTab === 'lists' ? setShowListModal(true) : setShowAddModal(true)} className="px-3 py-2 rounded-[4px] bg-[#39ff9c] text-[#03140b] text-[10px] font-bold">{activeTab === 'lists' ? <><FolderPlus className="w-3 h-3 inline mr-1.5"/>Create List</> : <><UserPlus className="w-3 h-3 inline mr-1.5"/>Add Contact</>}</button>
          </div>
        </header>

        <div className="flex items-center justify-between border-b border-[#1e2825]">
          <div className="flex gap-1">
            <button onClick={() => setActiveTab('contacts')} className={`px-4 py-2 text-[10px] ${activeTab === 'contacts' ? 'text-[#39ff9c] border-b-2 border-[#39ff9c]' : 'text-[#4a5a53]'}`}><Users className="w-3 h-3 inline mr-1.5"/>Contacts ({contacts.length})</button>
            <button onClick={() => setActiveTab('lists')} className={`px-4 py-2 text-[10px] ${activeTab === 'lists' ? 'text-[#39ff9c] border-b-2 border-[#39ff9c]' : 'text-[#4a5a53]'}`}><ListFilter className="w-3 h-3 inline mr-1.5"/>Lists ({lists.length})</button>
          </div>
          {activeTab === 'contacts' && <div className="text-[9px] text-[#4a5a53]">{filteredContacts.length} matching</div>}
        </div>

        {activeTab === 'contacts' && <section className="bg-[#0f1412] border border-[#1e2825] rounded-[6px] overflow-hidden">
          <div className="p-4 border-b border-[#1e2825] flex items-center justify-between gap-3"><div className="relative flex-1 max-w-lg"><Search className="w-3.5 h-3.5 text-[#4a5a53] absolute left-3 top-1/2 -translate-y-1/2"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search email, name or company" className="w-full bg-[#080b0a] border border-[#25302c] rounded-[4px] pl-9 pr-3 py-2 text-[10px] text-[#d8e6df] outline-none"/></div><span className="text-[9px] text-[#4a5a53]">{filteredContacts.length} contacts</span></div>
          <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-[#1e2825] text-[9px] uppercase tracking-[0.14em] text-[#4a5a53]"><th className="px-4 py-3">Email</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Added</th></tr></thead><tbody className="divide-y divide-[#18201d] text-[10px]">{filteredContacts.map(c => <tr key={c.id} className="hover:bg-white/[0.02]"><td className="px-4 py-3 text-[#d8e6df]">{c.email}</td><td className="px-4 py-3 text-[#7c9188]">{c.firstName || c.lastName ? `${c.firstName || ''} ${c.lastName || ''}`.trim() : '-'}</td><td className="px-4 py-3 text-[#7c9188]">{c.company || '-'}</td><td className="px-4 py-3"><StatusBadge status={c.status}/></td><td className="px-4 py-3 text-[#4a5a53]">{new Date(c.createdAt).toLocaleDateString()}</td></tr>)}{!filteredContacts.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-[10px] text-[#4a5a53]">No contacts imported yet.</td></tr>}</tbody></table></div>
        </section>}

        {activeTab === 'lists' && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{lists.map(l => <section key={l.id} className="bg-[#0f1412] border border-[#1e2825] rounded-[6px] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-[12px] font-bold text-[#d8e6df]">{l.name}</h3><p className="text-[9px] text-[#4a5a53] mt-1">{l.description || 'No description'}</p></div><ListFilter className="w-4 h-4 text-[#39ff9c]"/></div><div className="mt-5 flex items-end justify-between"><span className="text-[9px] uppercase tracking-wider text-[#4a5a53]">Members</span><b className="text-[18px] text-[#39ff9c]">{l.memberCount}</b></div></section>)}{!lists.length && <section className="md:col-span-3 bg-[#0f1412] border border-[#1e2825] rounded-[6px] p-10 text-center text-[10px] text-[#4a5a53]">No lists yet. Create one and assign contacts during import.</section>}</div>}

        {showAddModal && <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"><div className="w-full max-w-md bg-[#0f1412] border border-[#2a3733] rounded-[6px] p-5 space-y-4"><h2 className="text-sm font-bold">Add Contact</h2><form onSubmit={submitContact} className="space-y-3"><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="subscriber@example.com" className="w-full bg-[#080b0a] border border-[#25302c] rounded p-2.5 text-[10px]"/><div className="grid grid-cols-2 gap-2"><input value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="First name" className="bg-[#080b0a] border border-[#25302c] rounded p-2.5 text-[10px]"/><input value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Last name" className="bg-[#080b0a] border border-[#25302c] rounded p-2.5 text-[10px]"/></div><input value={company} onChange={e=>setCompany(e.target.value)} placeholder="Company" className="w-full bg-[#080b0a] border border-[#25302c] rounded p-2.5 text-[10px]"/><label className="block text-[10px] text-[#7c9188]">Add to list<select value={targetListId} onChange={e=>setTargetListId(e.target.value)} className="mt-1 w-full bg-[#080b0a] border border-[#25302c] rounded p-2.5 text-[10px]"><option value="">No list</option>{lists.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowAddModal(false)} className="px-3 py-2 text-[10px] text-[#7c9188]">Cancel</button><button disabled={busy} className="px-3 py-2 rounded bg-[#39ff9c] text-[#03140b] text-[10px] font-bold">{busy?'Saving…':'Save Contact'}</button></div></form></div></div>}

        {showListModal && <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"><div className="w-full max-w-md bg-[#0f1412] border border-[#2a3733] rounded-[6px] p-5 space-y-4"><h2 className="text-sm font-bold">Create Contact List</h2><form onSubmit={submitList} className="space-y-3"><input required value={listName} onChange={e=>setListName(e.target.value)} placeholder="List name" className="w-full bg-[#080b0a] border border-[#25302c] rounded p-2.5 text-[10px]"/><input value={listDesc} onChange={e=>setListDesc(e.target.value)} placeholder="Description" className="w-full bg-[#080b0a] border border-[#25302c] rounded p-2.5 text-[10px]"/><div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowListModal(false)} className="px-3 py-2 text-[10px] text-[#7c9188]">Cancel</button><button disabled={busy} className="px-3 py-2 rounded bg-[#39ff9c] text-[#03140b] text-[10px] font-bold">{busy?'Creating…':'Create List'}</button></div></form></div></div>}

        {showCsvModal && <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"><div className="w-full max-w-xl bg-[#0f1412] border border-[#2a3733] rounded-[6px] p-5 space-y-4"><div className="flex items-center gap-3"><FileSpreadsheet className="w-5 h-5 text-[#39ff9c]"/><div><h2 className="text-sm font-bold">Import Contacts</h2><p className="text-[9px] text-[#4a5a53]">CSV: email, first_name, last_name, company</p></div></div><label className="block text-[10px] text-[#7c9188]">Target list<select value={importListId} onChange={e=>setImportListId(e.target.value)} className="mt-1 w-full bg-[#080b0a] border border-[#25302c] rounded p-2.5 text-[10px]"><option value="">Import to all contacts (no list)</option>{lists.map(l=><option key={l.id} value={l.id}>{l.name} · {l.memberCount} members</option>)}</select></label><textarea rows={10} value={csvRawText} onChange={e=>setCsvRawText(e.target.value)} placeholder={'email,first_name,last_name,company\nuser1@acme.com,John,Doe,Acme Corp\nuser2@tech.io,Jane,Smith,Tech Labs'} className="w-full bg-[#080b0a] border border-[#25302c] rounded p-3 text-[10px] font-mono outline-none"/><div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowCsvModal(false)} className="px-3 py-2 text-[10px] text-[#7c9188]">Cancel</button><button type="button" disabled={busy || !csvRawText.trim()} onClick={handleProcessCsv} className="px-3 py-2 rounded bg-[#39ff9c] text-[#03140b] text-[10px] font-bold">{busy?'Importing…':'Import & Assign'}</button></div></div></div>}
      </div>
    </div>
  );
};
