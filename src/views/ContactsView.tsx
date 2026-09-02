import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Upload,
  Download,
  Search,
  ListFilter,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FolderPlus,
} from 'lucide-react';
import { Contact, ContactList } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface ContactsViewProps {
  contacts: Contact[];
  lists: ContactList[];
  onAddContact: (contact: any) => Promise<void>;
  onCreateList: (list: any) => Promise<void>;
  onImportCsv: (contacts: any[]) => Promise<void>;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  lists,
  onAddContact,
  onCreateList,
  onImportCsv,
}) => {
  const [activeTab, setActiveTab] = useState<'contacts' | 'lists'>('contacts');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);

  // New Contact Form
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [targetListId, setTargetListId] = useState(lists[0]?.id || '');

  // New List Form
  const [listName, setListName] = useState('');
  const [listDesc, setListDesc] = useState('');

  // CSV Drag and Drop / Input
  const [csvRawText, setCsvRawText] = useState('');

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddContact({
      email,
      firstName,
      lastName,
      company,
      listId: targetListId || undefined,
    });
    setShowAddModal(false);
    setEmail('');
    setFirstName('');
    setLastName('');
    setCompany('');
  };

  const submitList = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateList({
      name: listName,
      description: listDesc,
    });
    setShowListModal(false);
    setListName('');
    setListDesc('');
  };

  const handleProcessCsv = async () => {
    const lines = csvRawText.trim().split('\n');
    const parsedContacts = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // check if header line
      if (i === 0 && line.toLowerCase().includes('email')) continue;

      const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
      if (cols[0] && cols[0].includes('@')) {
        parsedContacts.push({
          email: cols[0],
          firstName: cols[1] || '',
          lastName: cols[2] || '',
          company: cols[3] || '',
        });
      }
    }

    if (parsedContacts.length > 0) {
      await onImportCsv(parsedContacts);
      setShowCsvModal(false);
      setCsvRawText('');
    }
  };

  const filteredContacts = contacts.filter(
    (c) =>
      !search ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.firstName && c.firstName.toLowerCase().includes(search.toLowerCase())) ||
      (c.lastName && c.lastName.toLowerCase().includes(search.toLowerCase())) ||
      (c.company && c.company.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif italic text-white tracking-tight flex items-center gap-2">
            Audience Contacts & Lists
          </h1>
          <p className="text-xs text-[#888888] mt-1">
            Manage subscriber directories with automated suppression synchronization and bulk CSV ingest
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCsvModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-sm bg-[#0F0F0F] hover:bg-white/10 text-white text-xs font-medium border border-white-10 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>

          {activeTab === 'contacts' ? (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-sm transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Contact</span>
            </button>
          ) : (
            <button
              onClick={() => setShowListModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-sm transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Create List</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-white-10 gap-6 text-xs font-medium">
        <button
          onClick={() => setActiveTab('contacts')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'contacts'
              ? 'border-white text-white font-semibold'
              : 'border-transparent text-[#888888] hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>All Contacts ({contacts.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('lists')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'lists'
              ? 'border-white text-white font-semibold'
              : 'border-transparent text-[#888888] hover:text-white'
          }`}
        >
          <ListFilter className="w-4 h-4" />
          <span>Contact Lists ({lists.length})</span>
        </button>
      </div>

      {/* TAB 1: Contacts List */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          <div className="p-4 rounded-sm bg-[#0F0F0F] border border-white-10 flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts by email, name, or company..."
                className="w-full bg-[#050505] border border-white-10 rounded-sm pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-[#888888] focus:border-white/30 focus:outline-none"
              />
            </div>
            <div className="text-xs text-[#888888] font-mono">
              {filteredContacts.length} contacts matching
            </div>
          </div>

          <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white-10 text-[10px] uppercase tracking-[0.15em] text-[#888888]">
                    <th className="pb-3 font-semibold">Email Address</th>
                    <th className="pb-3 font-semibold">Full Name</th>
                    <th className="pb-3 font-semibold">Company</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Added On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white-5 font-mono text-[11px]">
                  {filteredContacts.map((c) => (
                    <tr key={c.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 text-white font-medium">{c.email}</td>
                      <td className="py-3 font-sans text-zinc-300">
                        {c.firstName || c.lastName ? `${c.firstName || ''} ${c.lastName || ''}` : '-'}
                      </td>
                      <td className="py-3 font-sans text-[#888888]">{c.company || '-'}</td>
                      <td className="py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="py-3 text-[#888888]">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Lists */}
      {activeTab === 'lists' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {lists.map((l) => (
            <div
              key={l.id}
              className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 flex flex-col justify-between space-y-4 hover:border-white/20 transition-colors"
            >
              <div>
                <h3 className="text-sm font-semibold text-white">{l.name}</h3>
                <p className="text-xs text-[#888888] mt-1">{l.description || 'No description provided.'}</p>
              </div>

              <div className="p-3 rounded-sm bg-[#050505] border border-white-10 flex items-center justify-between font-mono text-xs">
                <span className="text-[#888888] uppercase tracking-wider text-[10px]">Members</span>
                <span className="text-emerald-400 font-bold">{l.memberCount} subscribers</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add Contact */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F0F0F] border border-white-10 rounded-sm max-w-md w-full p-6 space-y-4 shadow-2xl font-sans">
            <h2 className="text-sm font-serif italic text-white">Add Individual Contact</h2>
            <form onSubmit={submitContact} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="subscriber@domain.com"
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs font-mono text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#888888] mb-1">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#888888] mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">Company / Organization</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-sm bg-white/5 hover:bg-white/10 text-[#888888] hover:text-white border border-white-10 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create List */}
      {showListModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F0F0F] border border-white-10 rounded-sm max-w-md w-full p-6 space-y-4 shadow-2xl font-sans">
            <h2 className="text-sm font-serif italic text-white">Create Contact List</h2>
            <form onSubmit={submitList} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">List Name</label>
                <input
                  type="text"
                  required
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="e.g. Enterprise Tier Leads"
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">Description</label>
                <input
                  type="text"
                  value={listDesc}
                  onChange={(e) => setListDesc(e.target.value)}
                  placeholder="Brief audience scope..."
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowListModal(false)}
                  className="px-3 py-1.5 rounded-sm bg-white/5 hover:bg-white/10 text-[#888888] hover:text-white border border-white-10 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold"
                >
                  Create List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: CSV Import */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F0F0F] border border-white-10 rounded-sm max-w-lg w-full p-6 space-y-4 shadow-2xl font-sans">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-6 h-6 text-white" />
              <div>
                <h2 className="text-sm font-serif italic text-white">Import Contacts from CSV</h2>
                <p className="text-xs text-[#888888]">
                  Paste comma-separated rows or sample data (email, first_name, last_name, company).
                </p>
              </div>
            </div>

            <textarea
              rows={8}
              value={csvRawText}
              onChange={(e) => setCsvRawText(e.target.value)}
              placeholder="email,first_name,last_name,company&#10;user1@acme.com,John,Doe,Acme Corp&#10;user2@tech.io,Jane,Smith,Tech Labs"
              className="w-full bg-[#050505] border border-white-10 rounded-sm p-3 text-xs font-mono text-white focus:border-white/30 focus:outline-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="px-3 py-1.5 rounded-sm bg-white/5 hover:bg-white/10 text-[#888888] hover:text-white border border-white-10 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessCsv}
                className="px-4 py-1.5 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold"
              >
                Parse & Ingest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
