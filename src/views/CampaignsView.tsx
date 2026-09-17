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
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 font-sans text-gray-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#CCD2D8]">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#8B1A10]" />
            <span>Outbound Campaigns</span>
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Broadcast campaigns with automatic recipient hygiene and real-time delivery tracking.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Campaign</span>
        </button>
      </div>

      {/* Search / Filter bar */}
      <div className="p-3 rounded bg-white border border-[#CCD2D8] flex items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns by name or subject..."
            className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded pl-9 pr-4 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-[#8B1A10] focus:outline-none"
          />
        </div>

        <div className="text-xs text-gray-700 font-mono font-bold">
          {filteredCampaigns.length} campaigns total
        </div>
      </div>

      {/* Campaigns Grid / List */}
      {filteredCampaigns.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-[#CCD2D8] rounded text-xs text-gray-600 space-y-3 bg-white">
          <Megaphone className="w-8 h-8 mx-auto text-gray-400" />
          <p className="text-sm font-bold text-gray-800">No campaigns found</p>
          <p className="text-xs text-gray-500">Create a new broadcast campaign to send to your contact lists.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold inline-block"
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

            return (
              <div
                key={c.id}
                className="p-5 rounded bg-white border border-[#CCD2D8] flex flex-col justify-between hover:border-gray-400 transition-colors space-y-4 shadow-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-bold text-gray-900 line-clamp-1">{c.name}</h2>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="text-xs text-gray-700 font-mono truncate font-medium">
                    Subject: {c.subject}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">
                    From: {c.fromEmail || 'Default Identity'}
                  </div>
                </div>

                {/* Performance Mini-Stats */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded bg-[#F8FAFC] border border-[#CCD2D8] text-center font-mono">
                  <div>
                    <div className="text-xs font-bold text-gray-900">{c.totalRecipients || 0}</div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 font-sans mt-0.5">
                      Recipients
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-700">{delivered}</div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 font-sans mt-0.5">
                      Delivered
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-amber-700">{bounceRate}%</div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 font-sans mt-0.5">
                      Bounce Rate
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-[#CCD2D8] text-xs">
                  <span className="text-[11px] text-gray-500 font-mono font-medium">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Active'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {onRunCampaign && c.status !== 'SENDING' && (
                      <button
                        onClick={() => onRunCampaign(c.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#8B1A10] hover:bg-[#73140C] text-white font-bold text-[11px] transition shadow-xs"
                      >
                        <Send className="w-3 h-3" />
                        <span>Dispatch</span>
                      </button>
                    )}
                    {c.status === 'SENDING' && (
                      <button
                        onClick={() => onUpdateCampaignStatus(c.id, 'PAUSED')}
                        className="p-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300"
                        title="Pause Campaign"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {c.status === 'PAUSED' && (
                      <button
                        onClick={() => onUpdateCampaignStatus(c.id, 'SENDING')}
                        className="p-1 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#CCD2D8] rounded-lg max-w-lg w-full p-5 md:p-6 space-y-4 shadow-2xl font-sans text-gray-900">
            <h2 className="text-sm font-bold text-gray-900 pb-2 border-b border-[#CCD2D8]">Create New Broadcast Campaign</h2>
            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Campaign Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Q3 Security Digest"
                  className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Sender Identity</label>
                  <select
                    value={senderId}
                    onChange={(e) => setSenderId(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                  >
                    {senders.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.fromEmail})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Target Audience</label>
                  <select
                    value={listId}
                    onChange={(e) => setListId(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs text-gray-900 focus:border-[#8B1A10] focus:outline-none"
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
                <label className="block font-bold text-gray-700 mb-1">Subject Line</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Important update on infrastructure latency"
                  className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded px-3 py-2 text-xs text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">HTML Message Body</label>
                <textarea
                  rows={4}
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#CCD2D8] rounded p-2.5 text-xs font-mono text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                />
              </div>

              <div className="rounded border border-[#CCD2D8] bg-[#F8FAFC] p-3 space-y-2">
                <div className="font-bold text-gray-900">Engagement Telemetry</div>
                <label className="flex items-center justify-between text-gray-700 font-medium">
                  <span>Track Email Opens</span>
                  <input
                    type="checkbox"
                    checked={trackOpens}
                    onChange={(e) => setTrackOpens(e.target.checked)}
                    className="accent-[#8B1A10] rounded"
                  />
                </label>
                <label className="flex items-center justify-between text-gray-700 font-medium">
                  <span>Track Link Clicks</span>
                  <input
                    type="checkbox"
                    checked={trackClicks}
                    onChange={(e) => setTrackClicks(e.target.checked)}
                    className="accent-[#8B1A10] rounded"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 rounded border border-[#CCD2D8] text-gray-600 hover:text-gray-900 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
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
