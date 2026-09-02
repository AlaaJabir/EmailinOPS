import React from 'react';
import { MessageStatus, EventType, VerificationStatus } from '../types';

export const StatusBadge: React.FC<{ status: MessageStatus | EventType | VerificationStatus | string }> = ({ status }) => {
  const s = (status || '').toUpperCase();

  let colorClasses = 'bg-white/5 text-[#888888] border-white-10';
  let dotColor = 'bg-[#888888]';

  if (s === 'DELIVERED' || s === 'VERIFIED' || s === 'COMPLETED' || s === 'ACTIVE' || s === 'HEALTHY' || s === 'SUCCESS') {
    colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    dotColor = 'bg-emerald-400';
  } else if (s === 'QUEUED' || s === 'PENDING' || s === 'SCHEDULED' || s === 'WARMING' || s === 'DELIVERY_DELAYED' || s === 'DELIVERY_DELAY') {
    colorClasses = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
    dotColor = 'bg-amber-400';
  } else if (s === 'SENDING' || s === 'SENT' || s === 'INFO') {
    colorClasses = 'bg-sky-500/10 text-sky-300 border-sky-500/20';
    dotColor = 'bg-sky-400';
  } else if (s === 'BOUNCED' || s === 'HARD_BOUNCE' || s === 'COMPLAINED' || s === 'FAILED' || s === 'ERROR' || s === 'REJECTED' || s === 'RENDERING_FAILED') {
    colorClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    dotColor = 'bg-rose-400';
  } else if (s === 'UNSUBSCRIBED' || s === 'MANUAL' || s === 'PAUSED' || s === 'DRAFT' || s === 'WARN' || s === 'SUBSCRIPTION') {
    colorClasses = 'bg-purple-500/10 text-purple-300 border-purple-500/20';
    dotColor = 'bg-purple-400';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-mono border ${colorClasses} whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
      {status}
    </span>
  );
};
