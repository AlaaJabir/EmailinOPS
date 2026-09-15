import React, { useState, useMemo } from 'react';
import {
  Inbox,
  Search,
  Filter,
  RefreshCw,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Calendar,
  Layers,
  ArrowUpDown,
  Mail,
  Clock,
} from 'lucide-react';
import { Message, Sender, Campaign } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface MessagesViewProps {
  messages: Message[];
  senders: Sender[];
  campaigns: Campaign[];
  onSelectMessage: (msg: Message) => void;
  onRefresh: () => void;
  isLoading: boolean;
  initialStatusFilter?: string;
  title?: string;
  subtitle?: string;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  messages,
  senders,
  campaigns,
  onSelectMessage,
  onRefresh,
  isLoading,
  initialStatusFilter = 'ALL',
  title = 'Outbound Queue & Telemetry',
  subtitle = 'Searchable real-time log of RFC 5322 messages, spool lifecycle events, and MTA relay responses.',
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [senderFilter, setSenderFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const pageSize = 20;

  // Sync initialStatusFilter if changed from parent (e.g. navigating from Sidebar "Sent" vs "Delivered")
  React.useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
      setPage(1);
    }
  }, [initialStatusFilter]);

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = useMemo(() => {
    return messages.filter((m) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        (m.messageId && m.messageId.toLowerCase().includes(q)) ||
        (m.toEmail && m.toEmail.toLowerCase().includes(q)) ||
        (m.fromEmail && m.fromEmail.toLowerCase().includes(q)) ||
        (m.subject && m.subject.toLowerCase().includes(q)) ||
        (m.providerMessageId && m.providerMessageId.toLowerCase().includes(q));

      let matchesStatus = true;
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'DEFERRED') {
          matchesStatus = m.status === 'DELIVERY_DELAYED' || (m.status as any) === 'DEFERRED';
        } else {
          matchesStatus = m.status === statusFilter;
        }
      }

      const matchesSender = senderFilter === 'ALL' || m.senderId === senderFilter;

      let matchesDate = true;
      if (dateFilter !== 'ALL') {
        const msgDate = new Date(m.createdAt || m.queuedAt).getTime();
        const now = Date.now();
        if (dateFilter === '1h') matchesDate = now - msgDate <= 3600000;
        else if (dateFilter === '24h') matchesDate = now - msgDate <= 86400000;
        else if (dateFilter === '7d') matchesDate = now - msgDate <= 7 * 86400000;
      }

      return matchesSearch && matchesStatus && matchesSender && matchesDate;
    });
  }, [messages, search, statusFilter, senderFilter, dateFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const statusTabs = [
    { id: 'ALL', label: 'All Messages' },
    { id: 'QUEUED', label: 'Queued' },
    { id: 'SENDING', label: 'Sending' },
    { id: 'SENT', label: 'Sent' },
    { id: 'DELIVERED', label: 'Delivered' },
    { id: 'DEFERRED', label: 'Deferred' },
    { id: 'BOUNCED', label: 'Bounced' },
    { id: 'FAILED', label: 'Failed' },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-5 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Inbox className="w-5 h-5 text-indigo-400" />
            <span>{title}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#162032] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-medium transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Sync Spool</span>
          </button>
        </div>
      </div>

      {/* Quick Status Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-slate-800/80">
        {statusTabs.map((tab) => {
          const active = statusFilter === tab.id;
          const count = messages.filter((m) => {
            if (tab.id === 'ALL') return true;
            if (tab.id === 'DEFERRED') return m.status === 'DELIVERY_DELAYED' || (m.status as any) === 'DEFERRED';
            return m.status === tab.id;
          }).length;

          return (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                active
                  ? 'border-indigo-500 text-white font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  active
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-lg bg-[#111827] border border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by RFC Message-ID, recipient, subject, or provider ID..."
            className="w-full bg-[#0A0F1A] border border-slate-800 rounded-md pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500/60 focus:outline-none transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sender Filter */}
          <select
            value={senderFilter}
            onChange={(e) => {
              setSenderFilter(e.target.value);
              setPage(1);
            }}
            className="bg-[#0A0F1A] border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-300 focus:border-indigo-500/60 focus:outline-none"
          >
            <option value="ALL">All Senders</option>
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.fromEmail})
              </option>
            ))}
          </select>

          {/* Time Filter */}
          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
            className="bg-[#0A0F1A] border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-300 focus:border-indigo-500/60 focus:outline-none"
          >
            <option value="ALL">All Time</option>
            <option value="1h">Last 1 Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
        </div>
      </div>

      {/* Operations Table */}
      <div className="rounded-lg bg-[#111827] border border-slate-800/90 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0A0F1A] text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4 hidden md:table-cell">Sender</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4 font-mono hidden lg:table-cell">Message ID</th>
                <th className="py-3 px-4 font-mono hidden xl:table-cell">Provider ID</th>
                <th className="py-3 px-4 hidden sm:table-cell">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Inbox className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="text-sm font-medium text-slate-400">No messages match your criteria</p>
                    <p className="text-xs text-slate-500 mt-1">Try resetting your filters or search keywords.</p>
                  </td>
                </tr>
              ) : (
                paginated.map((msg) => {
                  const createdStr = msg.createdAt || msg.queuedAt
                    ? new Date(msg.createdAt || msg.queuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '-';
                  return (
                    <tr
                      key={msg.id}
                      onClick={() => onSelectMessage(msg)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={msg.status} />
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-200 truncate max-w-[200px]">
                        {msg.toEmail}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 truncate max-w-[180px] hidden md:table-cell">
                        {msg.fromEmail}
                      </td>
                      <td className="py-3 px-4 text-slate-300 truncate max-w-[240px]">
                        {msg.subject || '(No Subject)'}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 truncate max-w-[160px] hidden lg:table-cell">
                        <div className="flex items-center gap-1">
                          <span className="truncate">{msg.messageId}</span>
                          <button
                            onClick={(e) => handleCopy(msg.messageId, e)}
                            className="text-slate-500 hover:text-slate-300 p-0.5"
                            title="Copy ID"
                          >
                            {copiedId === msg.messageId ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 truncate max-w-[140px] hidden xl:table-cell">
                        {msg.providerMessageId || msg.sesMessageId || 'kumo_injected'}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap hidden sm:table-cell">
                        {createdStr}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMessage(msg);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-indigo-600 text-slate-300 hover:text-white font-medium text-[11px] transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-[#0A0F1A] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <span className="font-mono text-slate-200">{filtered.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{' '}
            <span className="font-mono text-slate-200">{Math.min(page * pageSize, filtered.length)}</span> of{' '}
            <span className="font-mono text-slate-200">{filtered.length}</span> messages
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 rounded bg-slate-800/80 text-slate-300 hover:text-white disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-slate-300">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1 rounded bg-slate-800/80 text-slate-300 hover:text-white disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
