import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, Eye, MousePointerClick, Send, ShieldAlert, XCircle, Clock3 } from 'lucide-react';
import { DashboardStats, Message } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface Props {
  stats: DashboardStats | null;
  recentMessages: Message[];
  onSelectMessage: (message: Message) => void;
}

const cards = [
  ['Emails Sent', 'totalSent', Send, 'text-white', 'bg-white/5'],
  ['Delivered', 'delivered', CheckCircle2, 'text-emerald-400', 'bg-emerald-500/10'],
  ['Bounced', 'bounced', AlertTriangle, 'text-amber-300', 'bg-amber-500/10'],
  ['Failed', 'failed', XCircle, 'text-rose-400', 'bg-rose-500/10'],
  ['Complaints', 'complaints', ShieldAlert, 'text-purple-300', 'bg-purple-500/10'],
  ['Opens', 'opens', Eye, 'text-sky-300', 'bg-sky-500/10'],
  ['Clicks', 'clicks', MousePointerClick, 'text-teal-300', 'bg-teal-500/10'],
  ['Deferred', 'deliveryDelayed', Clock3, 'text-orange-300', 'bg-orange-500/10'],
  ['Rejected', 'rejected', XCircle, 'text-red-300', 'bg-red-500/10'],
  ['Render Failed', 'renderingFailed', AlertTriangle, 'text-fuchsia-300', 'bg-fuchsia-500/10'],
] as const;

export const DeliveryOverview: React.FC<Props> = ({ stats, recentMessages, onSelectMessage }) => {
  if (!stats) return null;

  return (
    <section className="p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Delivery & Engagement</h2>
          </div>
          <p className="text-xs text-zinc-500 mt-1">Existing EmailinOPS delivery, bounce, open and click telemetry — preserved alongside KumoMTA operations.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(([label, key, Icon, text, bg]) => {
          const value = Number(stats[key as keyof DashboardStats] || 0);
          return (
            <div key={label} className="p-4 bg-[#0F0F0F] border border-white/10 hover:border-white/20 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
                <span className={`p-1.5 rounded ${bg}`}><Icon className={`w-3.5 h-3.5 ${text}`} /></span>
              </div>
              <div className={`text-2xl font-bold mt-3 ${text}`}>{value.toLocaleString()}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Delivery rate', `${stats.deliveryRate}%`, 'text-emerald-400'],
          ['Bounce rate', `${stats.bounceRate}%`, 'text-amber-300'],
          ['Open rate', `${stats.openRate}%`, 'text-sky-300'],
          ['Click rate', `${stats.clickRate}%`, 'text-teal-300'],
        ].map(([label, value, text]) => (
          <div key={label} className="p-4 bg-[#0F0F0F] border border-white/10">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
            <div className={`text-xl font-semibold mt-2 ${text}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="p-6 bg-[#0F0F0F] border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Recent Sending Activity</h3>
            <p className="text-xs text-zinc-500 mt-1">Message lifecycle data received from the EmailinOPS pipeline.</p>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">{recentMessages.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="pb-3">Time</th><th className="pb-3">Message ID</th><th className="pb-3">From</th><th className="pb-3">To</th><th className="pb-3">Subject</th><th className="pb-3">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {recentMessages.map((m) => (
                <tr key={m.id} onClick={() => onSelectMessage(m)} className="hover:bg-white/5 cursor-pointer">
                  <td className="py-3 text-zinc-500 font-mono whitespace-nowrap">{new Date(m.createdAt).toLocaleTimeString()}</td>
                  <td className="py-3 font-mono text-zinc-300 max-w-[190px] truncate">{m.messageId}</td>
                  <td className="py-3 text-zinc-400 max-w-[150px] truncate">{m.fromEmail}</td>
                  <td className="py-3 text-zinc-300 max-w-[170px] truncate">{m.toEmail}</td>
                  <td className="py-3 text-zinc-400 max-w-[220px] truncate">{m.subject}</td>
                  <td className="py-3"><StatusBadge status={m.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!recentMessages.length && <div className="py-8 text-center text-zinc-600">No messages yet.</div>}
        </div>
      </div>
    </section>
  );
};
