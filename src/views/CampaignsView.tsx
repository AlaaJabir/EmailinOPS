import React, { useEffect, useState } from 'react';
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  Send,
  Calendar,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
} from 'lucide-react';
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

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  campaigns,
  senders,
  lists,
  onCreateCampaign,
  onUpdateCampaignStatus,
  onRunCampaign,
  initialListId,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [senderId, setSenderId] = useState(senders[0]?.id || '');
  const [listId, setListId] = useState(initialListId || lists[0]?.id || '');
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('<p>Welcome to our new platform update.</p>');
  const [plainText, setPlainText] = useState('Welcome to our new platform update.');
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialListId) {
      setListId(initialListId);
      setShowCreateModal(true);
    }
  }, [initialListId]);

  useEffect(() => {
    if (!senderId && senders[0]?.id) setSenderId(senders[0].id);
  }, [senders, senderId]);

  useEffect(() => {
    if (!listId && lists[0]?.id) setListId(lists[0].id);
  }, [lists, listId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onCreateCampaign({
        name,
        senderId,
        listId,
        subject,
        htmlBody,
        plainText,
        trackOpens,
        trackClicks,
        status: 'SCHEDULED',
        scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      });
      setShowCreateModal(false);
      setName('');
      setSubject('');
      setTrackOpens(true);
      setTrackClicks(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCampaigns = campaigns.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-indigo-400" />
            <span>Outbound Campaigns</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Broadcast campaigns with automatic recipient hygiene and real-time delivery tracking.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Campaign</span>
        </button>
      </div>

      {/* Search / Filter bar */}
      <div className="p-3.5 rounded-lg bg-[#111827] border border-slate-800/90 flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns by name or subject..."
            className="w-full bg-[#0A0F1A] border border-slate-800 rounded-md pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500/60 focus:outline-none"
          />
        </div>

        <div className="text-xs text-slate-400 font-mono">
          {filteredCampaigns.length} campaigns total
        </div>
      </div>

      {/* Campaigns Grid / List */}
      {filteredCampaigns.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-800 rounded-lg text-xs text-slate-400 space-y-3 bg-[#111827]/40">
          <Megaphone className="w-8 h-8 mx-auto text-slate-600" />
          <p className="text-sm font-medium text-slate-300">No campaigns found</p>
          <p className="text-xs text-slate-500">Create a new broadcast campaign to send to your contact lists.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-block"
          >
            Create First Campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCampaigns.map((c) => {
            const delivered = Number(c.deliveredCount || 0);
            const sent = Number(c.sentCount || 0);
            const bounced = Number(c.bouncedCount || 0);
            const bounceRate = sent > 0 ? ((bounced / sent) * 100).toFixed(1) : '0.0';
            const openRate = delivered > 0 ? ((c.openCount / delivered) * 100).toFixed(1) : '0.0';

            return (
              <div
                key={c.id}
                className="p-5 rounded-lg bg-[#111827] border border-slate-800/90 flex flex-col justify-between hover:border-slate-700/80 transition-colors space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold text-white line-clamp-1">{c.name}</h2>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="text-xs text-slate-400 font-mono truncate">
                    Subject: {c.subject}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    From: {c.fromEmail || 'Default Identity'}
                  </div>
                </div>

                {/* Performance Mini-Stats */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-md bg-[#0A0F1A] border border-slate-800 text-center font-mono">
                  <div>
                    <div className="text-xs font-semibold text-white">{c.totalRecipients || 0}</div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 font-sans mt-0.5">
                      Recipients
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-emerald-400">{delivered}</div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 font-sans mt-0.5">
                      Delivered
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-amber-400">{bounceRate}%</div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 font-sans mt-0.5">
                      Bounce Rate
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                  <span className="text-[11px] text-slate-500 font-mono">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Active'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {onRunCampaign && c.status !== 'SENDING' && (
                      <button
                        onClick={() => onRunCampaign(c.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white font-medium text-[11px] border border-indigo-500/30 transition"
                      >
                        <Send className="w-3 h-3" />
                        <span>Dispatch</span>
                      </button>
                    )}
                    {c.status === 'SENDING' && (
                      <button
                        onClick={() => onUpdateCampaignStatus(c.id, 'PAUSED')}
                        className="p-1 rounded bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                        title="Pause Campaign"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {c.status === 'PAUSED' && (
                      <button
                        onClick={() => onUpdateCampaignStatus(c.id, 'SENDING')}
                        className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                        title="Resume Campaign"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-xl max-w-lg w-full p-5 md:p-6 space-y-4 shadow-2xl font-sans">
            <h2 className="text-sm font-semibold text-white">Create New Broadcast Campaign</h2>
            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-400 mb-1">Campaign Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Q3 Security Digest"
                  className="w-full bg-[#0A0F1A] border border-slate-800 rounded-md px-3 py-1.5 text-xs text-white focus:border-indigo-500/60 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-400 mb-1">Sender Identity</label>
                  <select
                    value={senderId}
                    onChange={(e) => setSenderId(e.target.value)}
                    className="w-full bg-[#0A0F1A] border border-slate-800 rounded-md px-3 py-1.5 text-xs text-white focus:border-indigo-500/60 focus:outline-none"
                  >
                    {senders.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.fromEmail})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-400 mb-1">Target Audience</label>
                  <select
                    value={listId}
                    onChange={(e) => setListId(e.target.value)}
                    className="w-full bg-[#0A0F1A] border border-slate-800 rounded-md px-3 py-1.5 text-xs text-white focus:border-indigo-500/60 focus:outline-none"
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
                <label className="block font-medium text-slate-400 mb-1">Subject Line</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Important update on infrastructure latency"
                  className="w-full bg-[#0A0F1A] border border-slate-800 rounded-md px-3 py-1.5 text-xs text-white focus:border-indigo-500/60 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-400 mb-1">HTML Message Body</label>
                <textarea
                  rows={4}
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  className="w-full bg-[#0A0F1A] border border-slate-800 rounded-md p-2.5 text-xs font-mono text-white focus:border-indigo-500/60 focus:outline-none"
                />
              </div>

              <div className="rounded-md border border-slate-800 bg-[#0A0F1A] p-3 space-y-2">
                <div className="font-semibold text-white">Engagement Telemetry</div>
                <label className="flex items-center justify-between text-slate-300">
                  <span>Track Email Opens</span>
                  <input
                    type="checkbox"
                    checked={trackOpens}
                    onChange={(e) => setTrackOpens(e.target.checked)}
                    className="accent-indigo-600 rounded"
                  />
                </label>
                <label className="flex items-center justify-between text-slate-300">
                  <span>Track Link Clicks</span>
                  <input
                    type="checkbox"
                    checked={trackClicks}
                    onChange={(e) => setTrackClicks(e.target.checked)}
                    className="accent-indigo-600 rounded"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 rounded-md bg-slate-800 text-slate-400 hover:text-white text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Scheduling...' : 'Schedule Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
