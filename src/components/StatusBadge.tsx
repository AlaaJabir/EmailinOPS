import React from 'react';
import { MessageStatus, EventType, VerificationStatus } from '../types';

export const StatusBadge: React.FC<{ status: MessageStatus | EventType | VerificationStatus | string }> = ({ status }) => {
  const s = (status || '').toUpperCase();

  let colorClasses = 'bg-gray-100 text-gray-800 border-gray-300';
  let dotColor = 'bg-gray-600';

  if (s === 'DELIVERED' || s === 'VERIFIED' || s === 'COMPLETED' || s === 'ACTIVE' || s === 'HEALTHY' || s === 'SUCCESS') {
    colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
    dotColor = 'bg-emerald-600';
  } else if (s === 'QUEUED' || s === 'PENDING' || s === 'SCHEDULED' || s === 'WARMING' || s === 'DELIVERY_DELAYED' || s === 'DELIVERY_DELAY') {
    colorClasses = 'bg-amber-50 text-amber-900 border-amber-300 font-bold';
    dotColor = 'bg-amber-600';
  } else if (s === 'SENDING' || s === 'SENT' || s === 'INFO') {
    colorClasses = 'bg-blue-50 text-blue-900 border-blue-300 font-bold';
    dotColor = 'bg-blue-600';
  } else if (s === 'BOUNCED' || s === 'HARD_BOUNCE' || s === 'COMPLAINED' || s === 'FAILED' || s === 'ERROR' || s === 'REJECTED' || s === 'RENDERING_FAILED') {
    colorClasses = 'bg-rose-50 text-rose-900 border-rose-300 font-bold';
    dotColor = 'bg-rose-600';
  } else if (s === 'UNSUBSCRIBED' || s === 'MANUAL' || s === 'PAUSED' || s === 'DRAFT' || s === 'WARN' || s === 'SUBSCRIPTION') {
    colorClasses = 'bg-purple-50 text-purple-900 border-purple-300 font-bold';
    dotColor = 'bg-purple-600';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono border ${colorClasses} whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
      {status}
    </span>
  );
};
