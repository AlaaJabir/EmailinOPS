import React, { useState } from 'react';
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  Users,
  Send,
  Eye,
  MousePointerClick,
  AlertTriangle,
  FileText,
  Calendar,
} from 'lucide-react';
import { Campaign, Sender, ContactList, Template } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface CampaignsViewProps {
  campaigns: Campaign[];
  senders: Sender[];
  lists: ContactList[];
  onCreateCampaign: (campaign: any) => Promise<void>;
  onUpdateCampaignStatus: (id: string, status: string) => Promise<void>;
}

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  campaigns,
  senders,
  lists,
  onCreateCampaign,
  onUpdateCampaignStatus,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Wizard state
  const [name, setName] = useState('');
  const [senderId, setSenderId] = useState(senders[0]?.id || '');
  const [listId, setListId] = useState(lists[0]?.id || '');
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('<p>Welcome to our new platform update.</p>');
  const [plainText, setPlainText] = useState('Welcome to our new platform update.');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateCampaign({
      name,
      senderId,
      listId,
      subject,
      htmlBody,
      plainText,
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    });
    setShowCreateModal(false);
    setName('');
    setSubject('');
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif italic text-white tracking-tight flex items-center gap-2">
            Email Campaigns
          </h1>
          <p className="text-xs text-[#888888] mt-1">
            Broadcast marketing and transactional newsletters with audience suppression checking
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-1.5 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Campaign</span>
        </button>
      </div>

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {campaigns.map((c) => {
          const deliveryPct = c.totalRecipients > 0 ? ((c.deliveredCount / c.totalRecipients) * 100).toFixed(1) : '0';
          const openPct = c.deliveredCount > 0 ? ((c.openCount / c.deliveredCount) * 100).toFixed(1) : '0';
          const clickPct = c.openCount > 0 ? ((c.clickCount / c.openCount) * 100).toFixed(1) : '0';

          return (
            <div
              key={c.id}
              className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 flex flex-col justify-between hover:border-white/20 transition-colors space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-white line-clamp-1">{c.name}</h2>
                  <StatusBadge status={c.status} />
                </div>
                <div className="text-xs text-[#888888] font-mono truncate" title={c.subject}>
                  Sub: {c.subject}
                </div>
                <div className="text-[11px] text-[#888888] flex items-center gap-2">
                  <span>From: {c.fromEmail}</span>
                </div>
              </div>

              {/* Stats Strip */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-sm bg-[#050505] border border-white-10 text-center font-mono">
                <div>
                  <div className="text-xs font-semibold text-white">{c.deliveredCount.toLocaleString()}</div>
                  <div className="text-[9px] uppercase tracking-wider text-[#888888] font-sans">Delivered</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-sky-400">{openPct}%</div>
                  <div className="text-[9px] uppercase tracking-wider text-[#888888] font-sans">Open Rate</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-teal-400">{clickPct}%</div>
                  <div className="text-[9px] uppercase tracking-wider text-[#888888] font-sans">Click Rate</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-white-10 text-xs">
                <span className="text-[11px] text-[#888888] font-mono">
                  {c.totalRecipients.toLocaleString()} recipients
                </span>

                <div className="flex items-center gap-2">
                  {c.status === 'SENDING' && (
                    <button
                      onClick={() => onUpdateCampaignStatus(c.id, 'PAUSED')}
                      className="p-1 text-amber-300 hover:text-white"
                      title="Pause Campaign"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  )}
                  {c.status === 'PAUSED' && (
                    <button
                      onClick={() => onUpdateCampaignStatus(c.id, 'SENDING')}
                      className="p-1 text-emerald-400 hover:text-white"
                      title="Resume Campaign"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create Campaign Wizard */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F0F0F] border border-white-10 rounded-sm max-w-lg w-full p-6 space-y-4 shadow-2xl font-sans">
            <h2 className="text-sm font-serif italic text-white">Create New Campaign</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">Campaign Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Q3 Security Compliance Briefing"
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#888888] mb-1">Sender Identity</label>
                  <select
                    value={senderId}
                    onChange={(e) => setSenderId(e.target.value)}
                    className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white"
                  >
                    {senders.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.fromEmail})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#888888] mb-1">Target Audience List</label>
                  <select
                    value={listId}
                    onChange={(e) => setListId(e.target.value)}
                    className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white"
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.memberCount} contacts)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">Subject Line</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject of broadcast email..."
                  className="w-full bg-[#050505] border border-white-10 rounded-sm px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888888] mb-1">HTML Content</label>
                <textarea
                  rows={4}
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  className="w-full bg-[#050505] border border-white-10 rounded-sm p-2.5 text-xs font-mono text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-sm bg-white/5 hover:bg-white/10 text-[#888888] hover:text-white border border-white-10 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-sm bg-white hover:bg-zinc-200 text-black text-xs font-semibold"
                >
                  Schedule Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
