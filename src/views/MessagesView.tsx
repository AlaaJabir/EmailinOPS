import React, { useState, useMemo, useEffect } from 'react';
import {
  Inbox,
  Search,
  RefreshCw,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Send,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
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
  initialStatus?: string;
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
  initialStatusFilter,
  initialStatus,
  title = 'Message Spool & Outbound Queue',
  subtitle = 'Real-time RFC 5322 outbound spool, transmission logs, delivery receipts, and queue telemetry.',
}) => {
  const defaultStatus = initialStatus || initialStatusFilter || 'ALL';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(defaultStatus);
  const [senderFilter, setSenderFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const pageSize = 20;

  useEffect(() => {
    const s = initialStatus || initialStatusFilter;
    if (s) {
      setStatusFilter(s);
      setPage(1);
    }
  }, [initialStatus, initialStatusFilter]);

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
    { id: 'ALL', label: 'All Spool', icon: Inbox },
    { id: 'QUEUED', label: 'Queued', icon: Clock },
    { id: 'SENT', label: 'Sent', icon: Send },
    { id: 'DELIVERED', label: 'Delivered', icon: CheckCircle2 },
    { id: 'DEFERRED', label: 'Deferred', icon: Clock },
    { id: 'BOUNCED', label: 'Bounced', icon: AlertTriangle },
    { id: 'FAILED', label: 'Failed', icon: XCircle },
  ];

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-[#E8ECEF] min-h-[calc(100vh-3.5rem)] font-sans text-gray-800">
      <div className="max-w-[1240px] mx-auto bg-white rounded-lg shadow-md border border-[#C5CED6] overflow-hidden">
        {/* PowerMTA Top Crimson Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-gradient-to-r from-[#8B1A10] via-[#A81D14] to-[#75110B] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#E0A328]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-black/25 flex items-center justify-center text-white border border-white/20 shrink-0">
              <Inbox className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <span>{title}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/30 border border-white/20 text-[#FFD54F]">
                  Spool Telemetry
                </span>
              </h1>
              <p className="text-[11px] text-gray-200 mt-0.5 hidden sm:block">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#37474F] hover:bg-[#263238] text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Spool</span>
            </button>
          </div>
        </div>

        {/* Status Filter Tabs (PowerMTA tab ribbon) */}
        <div className="px-3 pt-2 bg-[#F1F4F7] border-b border-[#CCD2D8] flex items-center gap-1 overflow-x-auto scrollbar-none">
          {statusTabs.map((tab) => {
            const active = statusFilter === tab.id;
            const count = messages.filter((m) => {
              if (tab.id === 'ALL') return true;
              if (tab.id === 'DEFERRED')
                return m.status === 'DELIVERY_DELAYED' || (m.status as any) === 'DEFERRED';
              return m.status === tab.id;
            }).length;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-all rounded-t-sm border-t border-x ${
                  active
                    ? 'bg-gradient-to-b from-[#E0A328] via-[#C98B18] to-[#AC710D] text-white shadow-xs border-[#E9B446]'
                    : 'bg-[#E2E7EC] text-gray-700 hover:bg-[#D8DEE4] border-transparent'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                    active ? 'bg-black/30 text-white' : 'bg-gray-300 text-gray-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 sm:p-4 bg-white border-b border-[#CCD2D8] flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by RFC Message-ID, recipient, subject, or provider ID..."
              className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded pl-9 pr-4 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-[#8B1A10] focus:outline-none transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sender Filter */}
            <select
              value={senderFilter}
              onChange={(e) => {
                setSenderFilter(e.target.value);
                setPage(1);
              }}
              className="bg-[#F8FAFC] border border-[#CCD2D8] rounded px-2.5 py-1.5 text-xs text-gray-700 focus:border-[#8B1A10] focus:outline-none"
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
              className="bg-[#F8FAFC] border border-[#CCD2D8] rounded px-2.5 py-1.5 text-xs text-gray-700 focus:border-[#8B1A10] focus:outline-none"
            >
              <option value="ALL">All Time</option>
              <option value="1h">Last 1 Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
            </select>
          </div>
        </div>

        {/* Operations Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#546E7A] text-white uppercase font-mono text-[10px] tracking-wider border-b border-[#37474F]">
              <tr>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Recipient</th>
                <th className="py-2.5 px-3 hidden md:table-cell">Sender</th>
                <th className="py-2.5 px-3">Subject</th>
                <th className="py-2.5 px-3 font-mono hidden lg:table-cell">Message ID</th>
                <th className="py-2.5 px-3 font-mono hidden xl:table-cell">Provider ID</th>
                <th className="py-2.5 px-3 hidden sm:table-cell">Queued / Sent</th>
                <th className="py-2.5 px-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-sans">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    <Inbox className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm font-semibold text-gray-700">No messages found in spool</p>
                    <p className="text-xs text-gray-500 mt-0.5">Try resetting search keywords or status filter.</p>
                  </td>
                </tr>
              ) : (
                paginated.map((msg, idx) => {
                  const createdStr =
                    msg.createdAt || msg.queuedAt
                      ? new Date(msg.createdAt || msg.queuedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-';
                  const isEven = idx % 2 === 0;
                  return (
                    <tr
                      key={msg.id}
                      onClick={() => onSelectMessage(msg)}
                      className={`${
                        isEven ? 'bg-white' : 'bg-[#F8FAFC]'
                      } hover:bg-[#FFF9E6] cursor-pointer transition-colors group`}
                    >
                      <td className="py-2 px-3 whitespace-nowrap">
                        <StatusBadge status={msg.status} />
                      </td>
                      <td className="py-2 px-3 font-mono font-medium text-gray-900 truncate max-w-[200px]">
                        {msg.toEmail}
                      </td>
                      <td className="py-2 px-3 font-mono text-gray-600 truncate max-w-[180px] hidden md:table-cell">
                        {msg.fromEmail}
                      </td>
                      <td className="py-2 px-3 text-gray-800 truncate max-w-[240px]">
                        {msg.subject || '(No Subject)'}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-gray-600 truncate max-w-[160px] hidden lg:table-cell">
                        <div className="flex items-center gap-1">
                          <span className="truncate">{msg.messageId}</span>
                          <button
                            onClick={(e) => handleCopy(msg.messageId, e)}
                            className="text-gray-400 hover:text-gray-700 p-0.5"
                            title="Copy ID"
                          >
                            {copiedId === msg.messageId ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-gray-500 truncate max-w-[140px] hidden xl:table-cell">
                        {msg.providerMessageId || msg.sesMessageId || 'kumo_spool'}
                      </td>
                      <td className="py-2 px-3 text-gray-600 font-mono text-[11px] whitespace-nowrap hidden sm:table-cell">
                        {createdStr}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMessage(msg);
                          }}
                          className="px-2 py-0.5 rounded bg-[#ECEFF1] hover:bg-[#37474F] hover:text-white text-gray-700 font-semibold text-[10px] transition-colors border border-[#CFD8DC]"
                        >
                          View
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
        <div className="px-4 py-2.5 bg-[#F1F4F7] border-t border-[#CCD2D8] flex items-center justify-between text-xs text-gray-600 font-sans">
          <div>
            Showing <span className="font-mono font-bold text-gray-800">{filtered.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{' '}
            <span className="font-mono font-bold text-gray-800">{Math.min(page * pageSize, filtered.length)}</span> of{' '}
            <span className="font-mono font-bold text-gray-800">{filtered.length}</span> messages
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 rounded bg-white border border-[#CCD2D8] text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-gray-700 font-bold">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1 rounded bg-white border border-[#CCD2D8] text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
