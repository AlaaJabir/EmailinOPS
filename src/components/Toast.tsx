import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {toasts.map((toast) => {
        let Icon = CheckCircle2;
        let borderClass = 'border-white-10 bg-[#0F0F0F] text-emerald-400';

        if (toast.type === 'error') {
          Icon = AlertCircle;
          borderClass = 'border-rose-500/30 bg-[#0F0F0F] text-rose-400';
        } else if (toast.type === 'info') {
          Icon = Info;
          borderClass = 'border-white-10 bg-[#0F0F0F] text-sky-400';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-sm border shadow-2xl flex items-start gap-3 backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200 ${borderClass}`}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white">{toast.title}</div>
              {toast.message && <div className="text-[11px] text-[#888888] mt-0.5 break-words">{toast.message}</div>}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-[#888888] hover:text-white transition-colors p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
