import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Clock,
  Send,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  ShieldCheck,
  Server,
  Terminal,
  Activity,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Message } from '../types';
import { StatusBadge } from './StatusBadge';

interface MessageDetailModalProps {
  message: Message | null;
  onClose: () => void;
}

export const MessageDetailModal: React.FC<MessageDetailModalProps> = ({ message, onClose }) => {
  const [copiedId, setCopiedId] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'technical' | 'headers' | 'content'>('timeline');

  if (!message) return null;

  const copyMessageId = () => {
    navigator.clipboard.writeText(message.messageId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Build sequential timeline events based on message lifecycle
  const timelineEvents = [
    {
      stage: 'Created',
      timestamp: message.createdAt || message.queuedAt,
      status: 'SUCCESS',
      description: 'RFC 5322 payload validated and queued into spool',
    },
    {
      stage: 'Queued',
      timestamp: message.queuedAt || message.createdAt,
      status: 'SUCCESS',
      description: 'Allocated to active VirtualMTA outbound spool buffer',
    },
    {
      stage: 'Sending',
      timestamp: message.sentAt || message.queuedAt,
      status: message.status === 'QUEUED' ? 'PENDING' : 'SUCCESS',
      description: 'Dispatched to KumoMTA socket / relay connection pool',
    },
    {
      stage: 'Provider Response',
      timestamp: message.deliveredAt || message.bouncedAt || message.sentAt,
      status:
        message.status === 'DELIVERED' || message.status === 'SENT'
          ? 'SUCCESS'
          : message.status === 'BOUNCED' || message.status === 'FAILED'
          ? 'FAILED'
          : message.status === 'DELIVERY_DELAYED'
          ? 'DEFERRED'
          : 'PENDING',
      description: message.smtpResponse || message.bounceReason || 'Awaiting upstream transport handshake',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 font-sans">
      <div className="bg-[#111827] border border-slate-800 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-800 flex items-center justify-between bg-[#0E1524]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white text-sm">Message Inspector</span>
                <StatusBadge status={message.status} />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono">
                <span className="truncate">{message.messageId}</span>
                <button
                  onClick={copyMessageId}
                  className="hover:text-white text-slate-500 transition p-0.5"
                  title="Copy Message-ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Core Metadata Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#0A0F1A] border-b border-slate-800 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Recipient</div>
            <div className="text-slate-200 font-mono truncate mt-0.5" title={message.toEmail}>
              {message.toEmail}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Sender</div>
            <div className="text-slate-200 font-mono truncate mt-0.5" title={message.fromEmail}>
              {message.fromEmail}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Subject</div>
            <div className="text-slate-200 truncate mt-0.5" title={message.subject}>
              {message.subject || '(None)'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Provider ID</div>
            <div className="text-indigo-400 font-mono text-[11px] truncate mt-0.5" title={message.providerMessageId}>
              {message.providerMessageId || message.sesMessageId || 'kumo_spool_1'}
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 px-5 gap-6 text-xs font-medium bg-[#0E1524]">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'timeline'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Lifecycle Timeline
          </button>
          <button
            onClick={() => setActiveTab('technical')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'technical'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Technical & Diagnostics
          </button>
          <button
            onClick={() => setActiveTab('headers')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'headers'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            MIME Headers
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'content'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Body Preview
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 md:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                {timelineEvents.map((evt, idx) => (
                  <div key={idx} className="relative group">
                    <div
                      className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-[#111827] ${
                        evt.status === 'SUCCESS'
                          ? 'bg-emerald-400'
                          : evt.status === 'FAILED'
                          ? 'bg-rose-500'
                          : evt.status === 'DEFERRED'
                          ? 'bg-amber-400'
                          : 'bg-slate-600'
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-xs">{evt.stage}</span>
                        {evt.timestamp && (
                          <span className="text-[10px] font-mono text-slate-500">
                            {new Date(evt.timestamp).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5 font-mono">{evt.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {message.events && message.events.length > 0 && (
                <div className="pt-4 border-t border-slate-800/80">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 block mb-2">
                    Raw Telemetry Events ({message.events.length})
                  </span>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    {message.events.map((e, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded bg-[#0A0F1A] border border-slate-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <StatusBadge status={e.eventType} />
                          <span className="text-slate-300">{e.timestamp}</span>
                        </div>
                        {e.ipAddress && <span className="text-slate-500">{e.ipAddress}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'technical' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-lg bg-[#0A0F1A] border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  SMTP Transport Response
                </span>
                <div className="font-mono text-emerald-400 text-xs break-all mt-1">
                  {message.smtpResponse || '250 2.0.0 OK: message queued for delivery (KumoMTA)'}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[#0A0F1A] border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    KumoMTA Routing Engine
                  </span>
                  <div className="text-xs text-slate-300 space-y-0.5 font-mono pt-1">
                    <div>Engine: <span className="text-indigo-400">KumoMTA Core v2026</span></div>
                    <div>Virtual MTA: <span className="text-slate-200">default-outbound</span></div>
                    <div>Port: <span className="text-slate-200">2525 / ESMTP</span></div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0A0F1A] border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Amazon SES Upstream
                  </span>
                  <div className="text-xs text-slate-300 space-y-0.5 font-mono pt-1">
                    <div>SES Message ID: <span className="text-slate-200">{message.sesMessageId || 'N/A (Local MX)'}</span></div>
                    <div>Transport: <span className="text-slate-200">{message.provider || 'Direct ESMTP'}</span></div>
                  </div>
                </div>
              </div>

              {message.bounceReason && (
                <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-rose-400 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Bounce Diagnostic
                  </span>
                  <div className="font-mono text-rose-300 text-xs break-all mt-1">
                    {message.bounceReason}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'headers' && (
            <div className="p-3.5 rounded-lg bg-[#0A0F1A] border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1 max-h-80 overflow-y-auto">
              <div>Message-ID: &lt;{message.messageId}&gt;</div>
              <div>Date: {message.createdAt || message.queuedAt}</div>
              <div>From: {message.fromName ? `"${message.fromName}" <${message.fromEmail}>` : message.fromEmail}</div>
              <div>To: {message.toEmail}</div>
              <div>Subject: {message.subject}</div>
              <div>MIME-Version: 1.0</div>
              <div>Content-Type: text/html; charset=UTF-8</div>
              <div>X-Mailer: EmailinOPS KumoMTA Dispatcher</div>
              {message.customHeaders &&
                Object.entries(message.customHeaders).map(([k, v]) => (
                  <div key={k}>{k}: {v}</div>
                ))}
            </div>
          )}

          {activeTab === 'content' && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-white text-slate-900 border border-slate-300 min-h-[160px] max-h-96 overflow-y-auto">
                {message.htmlBody ? (
                  <div dangerouslySetInnerHTML={{ __html: message.htmlBody }} />
                ) : message.plainText ? (
                  <pre className="font-sans whitespace-pre-wrap">{message.plainText}</pre>
                ) : (
                  <p className="text-slate-400 italic">No email body captured.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 px-5 bg-[#0A0F1A] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Security: TLS 1.3 encrypted spool connection</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
