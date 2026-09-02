import React, { useState } from 'react';
import {
  MailCheck,
  Search,
  Filter,
  ArrowUpRight,
  RefreshCw,
  Copy,
  Check,
  Calendar,
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
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  messages,
  senders,
  campaigns,
  onSelectMessage,
  onRefresh,
  isLoading,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [senderFilter, setSenderFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = messages.filter((m) => {
    const matchesSearch =
      !search ||
      m.messageId.toLowerCase().includes(search.toLowerCase()) ||
      m.toEmail.toLowerCase().includes(search.toLowerCase()) ||
      m.fromEmail.toLowerCase().includes(search.toLowerCase()) ||
      m.subject.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
    const matchesSender = senderFilter === 'ALL' || m.senderId === senderFilter;

    return matchesSearch && matchesStatus && matchesSender;
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif italic text-white tracking-tight flex items-center gap-2">
            Message Telemetry & Logs
          </h1>
          <p className="text-xs text-[#888888] mt-1">
            Searchable log of all RFC 5322 messages with complete lifecycle events and relay responses
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-sm bg-[#0F0F0F] hover:bg-white/10 text-white text-xs font-medium border border-white-10 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-sm bg-[#0F0F0F] border border-white-10 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by RFC Message-ID, recipient, subject..."
            className="w-full bg-[#050505] border border-white-10 rounded-sm pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-[#888888] focus:border-white/30 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="SENDING">Sending</option>
            <option value="SENT">Sent</option>
            <option value="DELIVERED">Delivered</option>
            <option value="BOUNCED">Bounced</option>
            <option value="FAILED">Failed</option>
            <option value="COMPLAINED">Complained</option>
          </select>

          {/* Sender Filter */}
          <select
            value={senderFilter}
            onChange={(e) => setSenderFilter(e.target.value)}
            className="bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none"
          >
            <option value="ALL">All Senders</option>
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages Table */}
      <div className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white-10 text-[10px] uppercase tracking-[0.15em] text-[#888888]">
                <th className="pb-3 font-semibold">Time</th>
                <th className="pb-3 font-semibold">RFC Message ID</th>
                <th className="pb-3 font-semibold">From</th>
                <th className="pb-3 font-semibold">To (Recipient)</th>
                <th className="pb-3 font-semibold">Subject</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Provider Relay</th>
                <th className="pb-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white-5 font-mono text-[11px]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#888888] font-sans">
                    No messages match the specified criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((msg) => (
                  <tr
                    key={msg.id}
                    onClick={() => onSelectMessage(msg)}
                    className="hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <td className="py-3 text-[#888888] whitespace-nowrap">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-3 text-zinc-300 max-w-[160px] truncate group flex items-center gap-1" title={msg.messageId}>
                      <span className="truncate">{msg.messageId}</span>
                      <button
                        onClick={(e) => handleCopy(msg.messageId, e)}
                        className="text-[#888888] hover:text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copy ID"
                      >
                        {copiedId === msg.messageId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </td>
                    <td className="py-3 text-[#888888] truncate max-w-[130px]" title={msg.fromEmail}>
                      {msg.fromEmail}
                    </td>
                    <td className="py-3 text-white font-medium truncate max-w-[150px]" title={msg.toEmail}>
                      {msg.toEmail}
                    </td>
                    <td className="py-3 font-sans text-zinc-300 max-w-[180px] truncate" title={msg.subject}>
                      {msg.subject}
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      <StatusBadge status={msg.status} />
                    </td>
                    <td className="py-3 text-[#888888] truncate max-w-[140px]" title={msg.smtpResponse}>
                      {msg.smtpResponse ? msg.smtpResponse.substring(0, 24) + '...' : msg.provider}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMessage(msg);
                        }}
                        className="inline-flex items-center gap-1 text-white hover:text-zinc-300 font-sans text-xs transition-colors p-1"
                      >
                        <span>Inspect</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
