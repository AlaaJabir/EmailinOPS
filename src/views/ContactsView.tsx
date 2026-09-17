import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Upload,
  Search,
  ListFilter,
  FileSpreadsheet,
  FolderPlus,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  FileText,
  Building,
  Mail,
  Filter,
} from 'lucide-react';
import { Contact, ContactList } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface ContactsViewProps {
  contacts: Contact[];
  lists: ContactList[];
  onAddContact: (contact: any) => Promise<void>;
  onCreateList: (list: any) => Promise<void>;
  onImportCsv: (contacts: any[], listId?: string) => Promise<void>;
  initialTab?: 'contacts' | 'lists' | 'import';
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  lists,
  onAddContact,
  onCreateList,
  onImportCsv,
  initialTab = 'contacts',
}) => {
  const [activeTab, setActiveTab] = useState<'contacts' | 'lists' | 'import'>(initialTab);
  const [search, setSearch] = useState('');
  const [selectedListFilter, setSelectedListFilter] = useState('ALL');

  // Contact Creation
  const [showAddModal, setShowAddModal] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [targetListId, setTargetListId] = useState('');

  // List Creation
  const [showListModal, setShowListModal] = useState(false);
  const [listName, setListName] = useState('');
  const [listDesc, setListDesc] = useState('');

  // CSV Import State
  const [csvRawText, setCsvRawText] = useState('');
  const [importListId, setImportListId] = useState('');
  const [colEmailIdx, setColEmailIdx] = useState(0);
  const [colFirstIdx, setColFirstIdx] = useState(1);
  const [colLastIdx, setColLastIdx] = useState(2);
  const [colCompanyIdx, setColCompanyIdx] = useState(3);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [importResult, setImportResult] = useState<{ count: number; listName: string } | null>(null);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!targetListId && lists[0]?.id) setTargetListId(lists[0].id);
    if (!importListId && lists[0]?.id) setImportListId(lists[0].id);
  }, [lists, targetListId, importListId]);

  // CSV Parsing and validation
  const parsedRows = useMemo(() => {
    const lines = csvRawText.trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    return lines.map((line) => line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, '')));
  }, [csvRawText]);

  const previewContacts = useMemo(() => {
    if (parsedRows.length <= 1) return [];
    // skip header line
    const dataRows = parsedRows.slice(1);
    return dataRows.map((row) => ({
      email: row[colEmailIdx]?.toLowerCase() || '',
      firstName: row[colFirstIdx] || '',
      lastName: row[colLastIdx] || '',
      company: row[colCompanyIdx] || '',
      isValid: Boolean(row[colEmailIdx]?.includes('@')),
    }));
  }, [parsedRows, colEmailIdx, colFirstIdx, colLastIdx, colCompanyIdx]);

  const validCount = previewContacts.filter((c) => c.isValid).length;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = String(evt.target?.result || '');
      setCsvRawText(text);
      setImportStep(2);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    const validOnes = previewContacts.filter((c) => c.isValid).map(({ isValid, ...rest }) => rest);
    if (!validOnes.length) return;
    setBusy(true);
    try {
      await onImportCsv(validOnes, importListId || undefined);
      const chosenList = lists.find((l) => l.id === importListId);
      setImportResult({ count: validOnes.length, listName: chosenList?.name || 'All Contacts' });
      setImportStep(3);
      setCsvRawText('');
    } finally {
      setBusy(false);
    }
  };

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

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 font-sans text-gray-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#CCD2D8]">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#8B1A10]" />
            <span>Audience &amp; Contact Management</span>
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Segmented recipient lists, bounce-suppression verification, and CSV batch ingestion.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Tabs */}
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
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t text-xs font-bold transition ${
            activeTab === 'import'
              ? 'border-b-2 border-[#8B1A10] text-[#8B1A10] bg-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import CSV</span>
        </button>
      </div>

      {/* Tab 1: Contacts Table */}
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

            <div className="flex items-center gap-2">
              <select
                value={selectedListFilter}
                onChange={(e) => setSelectedListFilter(e.target.value)}
                className="bg-[#F8FAFC] border border-[#CCD2D8] rounded px-2.5 py-1.5 text-xs text-gray-800 font-medium focus:outline-none"
              >
                <option value="ALL">All Lists</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
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
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500 font-medium">
                      No contacts found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((c) => (
                    <tr key={c.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-2.5 px-4 font-mono text-gray-900 font-semibold">{c.email}</td>
                      <td className="py-2.5 px-4 font-medium text-gray-900">
                        {c.firstName || c.lastName ? `${c.firstName} ${c.lastName}` : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-gray-600 hidden md:table-cell">{c.company || '-'}</td>
                      <td className="py-2.5 px-4">
                        <StatusBadge status={c.status || 'ACTIVE'} />
                      </td>
                      <td className="py-2.5 px-4 text-gray-500 font-mono text-[11px] hidden sm:table-cell">
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Active'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Lists Cards */}
      {activeTab === 'lists' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((l) => (
            <div
              key={l.id}
              className="p-5 rounded bg-white border border-[#CCD2D8] flex flex-col justify-between space-y-4 hover:border-gray-400 transition-colors shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">{l.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#8B1A10]/10 text-[#8B1A10] border border-[#8B1A10]/20 font-bold">
                    {l.memberCount || 0} members
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                  {l.description || 'No description provided.'}
                </p>
              </div>

              <div className="pt-2 border-t border-[#CCD2D8] flex items-center justify-between text-xs text-gray-500">
                <span className="font-mono text-[11px]">
                  {l.createdAt ? new Date(l.createdAt).toLocaleDateString() : 'System Default'}
                </span>
                <button
                  onClick={() => {
                    setSelectedListFilter(l.id);
                    setActiveTab('contacts');
                  }}
                  className="text-[#8B1A10] hover:text-[#73140C] font-bold"
                >
                  View Members &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Structured CSV Import Flow */}
      {activeTab === 'import' && (
        <div className="max-w-3xl mx-auto p-6 rounded bg-white border border-[#CCD2D8] space-y-6 shadow-xs">
          {/* Step Progress indicator */}
          <div className="grid grid-cols-3 gap-2 border-b border-[#CCD2D8] pb-4 text-xs">
            <div className={`flex items-center gap-2 ${importStep >= 1 ? 'text-[#8B1A10] font-bold' : 'text-gray-400'}`}>
              <span className="w-5 h-5 rounded-full bg-[#8B1A10]/10 border border-[#8B1A10]/30 flex items-center justify-center text-[10px] font-bold">
                1
              </span>
              <span>1. Upload CSV</span>
            </div>
            <div className={`flex items-center gap-2 ${importStep >= 2 ? 'text-[#8B1A10] font-bold' : 'text-gray-400'}`}>
              <span className="w-5 h-5 rounded-full bg-[#8B1A10]/10 border border-[#8B1A10]/30 flex items-center justify-center text-[10px] font-bold">
                2
              </span>
              <span>2. Map &amp; Preview</span>
            </div>
            <div className={`flex items-center gap-2 ${importStep >= 3 ? 'text-[#8B1A10] font-bold' : 'text-gray-400'}`}>
              <span className="w-5 h-5 rounded-full bg-[#8B1A10]/10 border border-[#8B1A10]/30 flex items-center justify-center text-[10px] font-bold">
                3
              </span>
              <span>3. Results</span>
            </div>
          </div>

          {/* Step 1: Upload or paste */}
          {importStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  Upload CSV or Text File
                </label>
                <div className="border-2 border-dashed border-[#CCD2D8] hover:border-[#8B1A10] rounded p-8 text-center transition cursor-pointer bg-[#F8FAFC]">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-file-input"
                  />
                  <label htmlFor="csv-file-input" className="cursor-pointer space-y-2 block">
                    <FileSpreadsheet className="w-8 h-8 mx-auto text-[#8B1A10]" />
                    <div className="text-xs font-bold text-gray-900">
                      Click to choose CSV or drag &amp; drop here
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Standard comma-separated format: email, firstName, lastName, company
                    </p>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  Or Paste Raw CSV Data
                </label>
                <textarea
                  rows={5}
                  value={csvRawText}
                  onChange={(e) => setCsvRawText(e.target.value)}
                  placeholder="email,firstName,lastName,company&#10;user@example.com,John,Doe,Acme Corp"
                  className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded p-3 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  disabled={!csvRawText.trim()}
                  onClick={() => setImportStep(2)}
                  className="flex items-center gap-2 px-4 py-2 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold disabled:opacity-40 transition shadow-xs"
                >
                  <span>Continue to Mapping</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Map Columns and Preview */}
          {importStep === 2 && (
            <div className="space-y-4 text-xs">
              <div className="p-3 rounded bg-[#F8FAFC] border border-[#CCD2D8] flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900">Parsed Rows: {parsedRows.length}</span>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    {validCount} contacts with valid email formatting.
                  </p>
                </div>
                <div>
                  <label className="text-[11px] text-gray-600 block mb-1 font-medium">Assign to Audience List</label>
                  <select
                    value={importListId}
                    onChange={(e) => setImportListId(e.target.value)}
                    className="bg-white border border-[#CCD2D8] rounded px-2.5 py-1 text-xs text-gray-900 font-medium"
                  >
                    <option value="">Default (No list)</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Column Mapping Selectors */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded bg-[#F8FAFC] border border-[#CCD2D8]">
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#8B1A10] block mb-1">
                    Email Column *
                  </label>
                  <select
                    value={colEmailIdx}
                    onChange={(e) => setColEmailIdx(Number(e.target.value))}
                    className="w-full bg-white border border-[#CCD2D8] rounded px-2 py-1 text-xs text-gray-900 font-medium"
                  >
                    {parsedRows[0]?.map((header, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx + 1}: {header}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-600 block mb-1">
                    First Name
                  </label>
                  <select
                    value={colFirstIdx}
                    onChange={(e) => setColFirstIdx(Number(e.target.value))}
                    className="w-full bg-white border border-[#CCD2D8] rounded px-2 py-1 text-xs text-gray-900 font-medium"
                  >
                    {parsedRows[0]?.map((header, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx + 1}: {header}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-600 block mb-1">
                    Last Name
                  </label>
                  <select
                    value={colLastIdx}
                    onChange={(e) => setColLastIdx(Number(e.target.value))}
                    className="w-full bg-white border border-[#CCD2D8] rounded px-2 py-1 text-xs text-gray-900 font-medium"
                  >
                    {parsedRows[0]?.map((header, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx + 1}: {header}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-600 block mb-1">
                    Company
                  </label>
                  <select
                    value={colCompanyIdx}
                    onChange={(e) => setColCompanyIdx(Number(e.target.value))}
                    className="w-full bg-white border border-[#CCD2D8] rounded px-2 py-1 text-xs text-gray-900 font-medium"
                  >
                    {parsedRows[0]?.map((header, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx + 1}: {header}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sample Preview Table */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-600 block">
                  Validation Preview (First 5 Rows)
                </span>
                <div className="border border-[#CCD2D8] rounded overflow-hidden bg-white">
                  <table className="w-full text-left text-[11px] text-gray-800">
                    <thead className="bg-[#F2F4F7] text-gray-700 uppercase font-mono text-[9px] border-b border-[#CCD2D8]">
                      <tr>
                        <th className="p-2 font-bold">Email</th>
                        <th className="p-2 font-bold">Name</th>
                        <th className="p-2 font-bold">Company</th>
                        <th className="p-2 font-bold">Validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] font-mono">
                      {previewContacts.slice(0, 5).map((p, idx) => (
                        <tr key={idx}>
                          <td className="p-2 text-gray-900 font-semibold">{p.email || '(Missing)'}</td>
                          <td className="p-2 text-gray-700 font-sans">{p.firstName} {p.lastName}</td>
                          <td className="p-2 text-gray-600 font-sans">{p.company || '-'}</td>
                          <td className="p-2">
                            {p.isValid ? (
                              <span className="text-emerald-700 flex items-center gap-1 font-sans font-bold">
                                <CheckCircle2 className="w-3 h-3" /> Valid
                              </span>
                            ) : (
                              <span className="text-rose-700 flex items-center gap-1 font-sans font-bold">
                                <AlertCircle className="w-3 h-3" /> Invalid
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#CCD2D8]">
                <button
                  type="button"
                  onClick={() => setImportStep(1)}
                  className="px-3.5 py-1.5 rounded border border-[#CCD2D8] text-gray-600 hover:text-gray-900 font-semibold"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={validCount === 0 || busy}
                  onClick={handleExecuteImport}
                  className="flex items-center gap-2 px-4 py-1.5 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold disabled:opacity-40 transition shadow-xs"
                >
                  {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Execute Import ({validCount} Contacts)</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success Result */}
          {importStep === 3 && (
            <div className="p-8 text-center space-y-4 bg-white rounded border border-[#CCD2D8] shadow-xs">
              <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Contacts Successfully Imported!</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Added <span className="font-mono text-[#8B1A10] font-bold">{importResult?.count}</span> contacts to list{' '}
                  <span className="text-gray-900 font-bold">"{importResult?.listName}"</span>.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setImportStep(1);
                    setImportResult(null);
                  }}
                  className="px-3.5 py-1.5 rounded border border-[#CCD2D8] text-gray-700 hover:text-gray-900 text-xs font-semibold"
                >
                  Import Another File
                </button>
                <button
                  onClick={() => setActiveTab('contacts')}
                  className="px-4 py-1.5 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs"
                >
                  View All Contacts
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#CCD2D8] rounded-lg max-w-md w-full p-5 space-y-4 shadow-2xl font-sans text-gray-900">
            <h2 className="text-sm font-bold text-gray-900 pb-2 border-b border-[#CCD2D8]">Add New Contact</h2>
            <form onSubmit={submitContact} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                  className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-1.5 text-gray-900 focus:outline-none focus:border-[#8B1A10]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-1.5 text-gray-900 focus:outline-none focus:border-[#8B1A10]"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-1.5 text-gray-900 focus:outline-none focus:border-[#8B1A10]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-700 font-bold mb-1">Company</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-1.5 text-gray-900 focus:outline-none focus:border-[#8B1A10]"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-bold mb-1">Assign to List</label>
                <select
                  value={targetListId}
                  onChange={(e) => setTargetListId(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-1.5 text-gray-900 focus:outline-none focus:border-[#8B1A10]"
                >
                  <option value="">No list</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#CCD2D8]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded border border-[#CCD2D8] text-gray-600 hover:text-gray-900 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-1.5 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold shadow-xs"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New List Modal */}
      {showListModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#CCD2D8] rounded-lg max-w-md w-full p-5 space-y-4 shadow-2xl font-sans text-gray-900">
            <h2 className="text-sm font-bold text-gray-900 pb-2 border-b border-[#CCD2D8]">Create Audience List</h2>
            <form onSubmit={submitList} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">List Name *</label>
                <input
                  type="text"
                  required
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="e.g. VIP Newsletter Subscribers"
                  className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-1.5 text-gray-900 focus:outline-none focus:border-[#8B1A10]"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-bold mb-1">Description</label>
                <textarea
                  rows={3}
                  value={listDesc}
                  onChange={(e) => setListDesc(e.target.value)}
                  placeholder="Describe the members in this audience..."
                  className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded p-2.5 text-gray-900 focus:outline-none focus:border-[#8B1A10]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[#CCD2D8]">
                <button
                  type="button"
                  onClick={() => setShowListModal(false)}
                  className="px-3.5 py-1.5 rounded border border-[#CCD2D8] text-gray-600 hover:text-gray-900 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-1.5 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold shadow-xs"
                >
                  Create List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
