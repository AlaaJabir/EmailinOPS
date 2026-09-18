import React, { useEffect, useState } from 'react';
import { Users, UserPlus, Search, ListFilter, FolderPlus, Upload } from 'lucide-react';
import { Contact, ContactList } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface ContactsViewProps {
  contacts: Contact[];
  lists: ContactList[];
  onAddContact: (contact: any) => Promise<void>;
  onCreateList: (list: any) => Promise<void>;
  initialTab?: 'contacts' | 'lists';
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  lists,
  onAddContact,
  onCreateList,
  initialTab = 'contacts',
}) => {
  const [activeTab, setActiveTab] = useState<'contacts' | 'lists'>(initialTab);
  const [search, setSearch] = useState('');
  const [selectedListFilter, setSelectedListFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [targetListId, setTargetListId] = useState('');
  const [showListModal, setShowListModal] = useState(false);
  const [listName, setListName] = useState('');
  const [listDesc, setListDesc] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!targetListId && lists[0]?.id) setTargetListId(lists[0].id);
  }, [lists, targetListId]);

  const filteredContacts = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      c.email.toLowerCase().includes(q) ||
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q);
    const matchList = selectedListFilter === 'ALL' || c.listId === selectedListFilter;
    return matchSearch && matchList;
  });

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onAddContact({ email, firstName, lastName, company, listId: targetListId || undefined });
      setShowAddModal(false);
      setEmail('');
      setFirstName('');
      setLastName('');
      setCompany('');
    } finally {
      setBusy(false);
    }
  };

  const submitList = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onCreateList({ name: listName.trim(), description: listDesc.trim() });
      setShowListModal(false);
      setListName('');
      setListDesc('');
    } finally {
      setBusy(false);
    }
  };

  const openImportCsv = () => {
    window.dispatchEvent(new Event('emailops:open-import'));
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 font-sans text-gray-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#CCD2D8]">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#8B1A10]" />
            <span>Audience &amp; Contact Management</span>
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Segmented recipient lists, reusable audiences, and durable .TXT / .CSV ingestion.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openImportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#8B1A10] hover:bg-[#73140C] text-white text-xs font-bold transition shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import .TXT / .CSV</span>
          </button>
          <button
            onClick={() => setShowListModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-gray-100 text-gray-800 border border-[#CCD2D8] text-xs font-bold transition shadow-xs"
          >
            <FolderPlus className="w-3.5 h-3.5 text-gray-600" />
            <span>New List</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-[#CCD2D8] pb-1">
        <button
          onClick={() => setActiveTab('contacts')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t text-xs font-bold transition ${
            activeTab === 'contacts'
              ? 'border-b-2 border-[#8B1A10] text-[#8B1A10] bg-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>All Contacts ({contacts.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('lists')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t text-xs font-bold transition ${
            activeTab === 'lists'
              ? 'border-b-2 border-[#8B1A10] text-[#8B1A10] bg-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <ListFilter className="w-3.5 h-3.5" />
          <span>Audience Lists ({lists.length})</span>
        </button>
        <button
          type="button"
          onClick={openImportCsv}
          className="ml-auto flex items-center gap-2 px-3.5 py-2 rounded-t text-xs font-bold bg-white border border-[#CCD2D8] border-b-0 text-gray-800 hover:text-[#8B1A10] hover:border-[#8B1A10] transition"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import .TXT / .CSV</span>
        </button>
      </div>

      {activeTab === 'contacts' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded bg-white border border-[#CCD2D8] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email, name, or company..."
                className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded pl-9 pr-4 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-[#8B1A10] focus:outline-none"
              />
            </div>
            <select
              value={selectedListFilter}
              onChange={(e) => setSelectedListFilter(e.target.value)}
              className="bg-[#F8FAFC] border border-[#CCD2D8] rounded px-2.5 py-1.5 text-xs text-gray-800 font-medium focus:outline-none"
            >
              <option value="ALL">All Lists</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div className="rounded bg-white border border-[#CCD2D8] overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs text-gray-800">
              <thead className="bg-[#F2F4F7] text-gray-700 uppercase font-mono text-[10px] tracking-wider border-b border-[#CCD2D8]">
                <tr>
                  <th className="py-2.5 px-4 font-bold">Contact Email</th>
                  <th className="py-2.5 px-4 font-bold">Full Name</th>
                  <th className="py-2.5 px-4 hidden md:table-cell font-bold">Company</th>
                  <th className="py-2.5 px-4 font-bold">Status</th>
                  <th className="py-2.5 px-4 hidden sm:table-cell font-bold">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] font-sans">
                {filteredContacts.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-gray-500 font-medium">No contacts found matching your criteria.</td></tr>
                ) : filteredContacts.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-2.5 px-4 font-mono text-gray-900 font-semibold">{c.email}</td>
                    <td className="py-2.5 px-4 font-medium text-gray-900">{c.firstName || c.lastName ? `${c.firstName} ${c.lastName}` : '-'}</td>
                    <td className="py-2.5 px-4 text-gray-600 hidden md:table-cell">{c.company || '-'}</td>
                    <td className="py-2.5 px-4"><StatusBadge status={c.status || 'ACTIVE'} /></td>
                    <td className="py-2.5 px-4 text-gray-500 font-mono text-[11px] hidden sm:table-cell">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Active'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'lists' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((l) => (
            <div key={l.id} className="p-5 rounded bg-white border border-[#CCD2D8] flex flex-col justify-between space-y-4 hover:border-gray-400 transition-colors shadow-xs">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">{l.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#8B1A10]/10 text-[#8B1A10] border border-[#8B1A10]/20 font-bold">{l.memberCount || 0} members</span>
                </div>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{l.description || 'No description provided.'}</p>
              </div>
              <div className="pt-2 border-t border-[#CCD2D8] flex items-center justify-between text-xs text-gray-500">
                <span className="font-mono text-[11px]">{l.createdAt ? new Date(l.createdAt).toLocaleDateString() : 'System Default'}</span>
                <button onClick={() => { setSelectedListFilter(l.id); setActiveTab('contacts'); }} className="text-[#8B1A10] hover:text-[#73140C] font-bold">View Members &rarr;</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#CCD2D8] rounded-lg max-w-md w-full p-5 space-y-4 shadow-2xl font-sans text-gray-900">
            <h2 className="text-sm font-bold text-gray-900 pb-2 border-b border-[#CCD2D8]">Add New Contact</h2>
            <form onSubmit={submitContact} className="space-y-3 text-xs">
              <div><label className="block text-gray-700 font-bold mb-1">Email Address *</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@company.com" className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-1.5 text-gray-900 focus:outline-none focus:border-[#8B1A10]" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-gray-700 font-bold mb-1">First Name</label><input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-1.5 text-gray-900 focus:outline-none focus:border-[#8B1A10]" /></div>
                <div><label className="block text-gray-700 font-bold mb-1">Last Name</label><input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-1.5 text-gray-900 focus:outline-none focus:border-[#8B1A10]" /></div>
              </div>
              <div><label className="block text-gray-700 font-bold mb-1">Company</label><input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp" className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-1.5 text-gray-900 focus:outline-none focus:border-[#8B1A10]" /></div>
              <div><label className="block text-gray-700 font-bold mb-1">Assign to List</label><select value={targetListId} onChange={(e) => setTargetListId(e.target.value)} className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-1.5 text-gray-900 focus:outline-none focus:border-[#8B1A10]"><option value="">No list</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[#CCD2D8]"><button type="button" onClick={() => setShowAddModal(false)} className="px-3.5 py-1.5 rounded border border-[#CCD2D8] text-gray-600 hover:text-gray-900 font-semibold">Cancel</button><button type="submit" disabled={busy} className="px-4 py-1.5 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold shadow-xs">Save Contact</button></div>
            </form>
          </div>
        </div>
      )}

      {showListModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#CCD2D8] rounded-lg max-w-md w-full p-5 space-y-4 shadow-2xl font-sans text-gray-900">
            <h2 className="text-sm font-bold text-gray-900 pb-2 border-b border-[#CCD2D8]">Create Audience List</h2>
            <form onSubmit={submitList} className="space-y-3 text-xs">
              <div><label className="block text-gray-700 font-bold mb-1">List Name *</label><input type="text" required value={listName} onChange={(e) => setListName(e.target.value)} placeholder="e.g. VIP Newsletter Subscribers" className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-1.5 text-gray-900 focus:outline-none focus:border-[#8B1A10]" /></div>
              <div><label className="block text-gray-700 font-bold mb-1">Description</label><textarea rows={3} value={listDesc} onChange={(e) => setListDesc(e.target.value)} placeholder="Describe the members in this audience..." className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded p-2.5 text-gray-900 focus:outline-none focus:border-[#8B1A10]" /></div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[#CCD2D8]"><button type="button" onClick={() => setShowListModal(false)} className="px-3.5 py-1.5 rounded border border-[#CCD2D8] text-gray-600 hover:text-gray-900 font-semibold">Cancel</button><button type="submit" disabled={busy} className="px-4 py-1.5 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold shadow-xs">Create List</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
