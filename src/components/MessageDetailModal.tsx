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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 font-sans">
      <div className="bg-white border border-[#CCD2D8] rounded-none w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-150">
        {/* Header - PowerMTA Header style */}
        <div className="p-3 sm:p-4 border-b border-[#CCD2D8] flex items-center justify-between bg-gradient-to-r from-[#8B1A10] to-[#A81D14] text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded bg-black/30 border border-white/20 flex items-center justify-center text-[#FFD54F] shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">PowerMTA Message Inspector</span>
                <StatusBadge status={message.status} />
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-200 mt-0.5 font-mono">
                <span className="truncate">{message.messageId}</span>
                <button
                  onClick={copyMessageId}
                  className="hover:text-white text-gray-300 transition p-0.5"
                  title="Copy Message-ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-[#FFD54F]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-black/30 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Core Metadata Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 sm:p-4 bg-[#F8FAFC] border-b border-[#CCD2D8] text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">Recipient</div>
            <div className="text-gray-900 font-mono font-semibold truncate mt-0.5" title={message.toEmail}>
              {message.toEmail}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">Sender</div>
            <div className="text-gray-900 font-mono font-semibold truncate mt-0.5" title={message.fromEmail}>
              {message.fromEmail}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">Subject</div>
            <div className="text-gray-900 font-medium truncate mt-0.5" title={message.subject}>
              {message.subject || '(None)'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">Provider ID</div>
            <div className="text-[#8B1A10] font-mono font-bold text-[11px] truncate mt-0.5" title={message.providerMessageId}>
              {message.providerMessageId || message.sesMessageId || 'kumo_spool_1'}
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#CCD2D8] px-4 gap-2 text-xs font-bold bg-[#F1F4F7]">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'timeline'
                ? 'border-[#8B1A10] text-[#8B1A10]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Lifecycle Timeline
          </button>
          <button
            onClick={() => setActiveTab('technical')}
            className={`py-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'technical'
                ? 'border-[#8B1A10] text-[#8B1A10]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Diagnostics & Terminal
          </button>
          <button
            onClick={() => setActiveTab('headers')}
            className={`py-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'headers'
                ? 'border-[#8B1A10] text-[#8B1A10]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            MIME Headers
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={`py-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'content'
                ? 'border-[#8B1A10] text-[#8B1A10]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Body Preview
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs bg-[#F8FAFC]">
          {activeTab === 'timeline' && (
            <div className="space-y-4 bg-white p-4 border border-[#CCD2D8]">
              <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#CCD2D8]">
                {timelineEvents.map((evt, idx) => (
                  <div key={idx} className="relative group">
                    <div
                      className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs ${
                        evt.status === 'SUCCESS'
                          ? 'bg-emerald-600'
                          : evt.status === 'FAILED'
                          ? 'bg-rose-600'
                          : evt.status === 'DEFERRED'
                          ? 'bg-amber-500'
                          : 'bg-gray-400'
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-xs">{evt.stage}</span>
                        {evt.timestamp && (
                          <span className="text-[10px] font-mono text-gray-500">
                            {new Date(evt.timestamp).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 text-xs mt-0.5 font-mono">{evt.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {message.events && message.events.length > 0 && (
                <div className="pt-4 border-t border-[#CCD2D8]">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-600 block mb-2 font-mono">
                    Raw Telemetry Events ({message.events.length})
                  </span>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    {message.events.map((e, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-[#F8FAFC] border border-[#CCD2D8] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <StatusBadge status={e.eventType} />
                          <span className="text-gray-800">{e.timestamp}</span>
                        </div>
                        {e.ipAddress && <span className="text-gray-500">{e.ipAddress}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'technical' && (
            <div className="space-y-3.5">
              <div className="p-3 bg-black border border-gray-800 space-y-1 font-mono">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block">
                  SMTP Transport Response (PowerMTA Live Protocol Stream)
                </span>
                <div className="text-[#00FF66] text-xs break-all mt-1">
                  {message.smtpResponse || '250 2.0.0 OK: message queued for delivery (KumoMTA)'}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-white border border-[#CCD2D8] space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold font-mono">
                    Routing Engine
                  </span>
                  <div className="text-xs text-gray-800 space-y-0.5 font-mono pt-1">
                    <div>Engine: <span className="text-[#8B1A10] font-bold">KumoMTA Core v2026</span></div>
                    <div>Virtual MTA: <span className="text-gray-900 font-semibold">default-outbound</span></div>
                    <div>Port: <span className="text-gray-900">2525 / ESMTP</span></div>
                  </div>
                </div>

                <div className="p-3 bg-white border border-[#CCD2D8] space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold font-mono">
                    Amazon SES Upstream
                  </span>
                  <div className="text-xs text-gray-800 space-y-0.5 font-mono pt-1">
                    <div>SES ID: <span className="text-gray-900 font-semibold">{message.sesMessageId || 'N/A (Direct MX)'}</span></div>
                    <div>Transport: <span className="text-gray-900">{message.provider || 'Direct ESMTP'}</span></div>
                  </div>
                </div>
              </div>

              {message.bounceReason && (
                <div className="p-3 bg-rose-50 border border-rose-300 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-rose-800 font-bold flex items-center gap-1.5 font-mono">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Bounce Diagnostic
                  </span>
                  <div className="font-mono text-rose-900 text-xs break-all mt-1">
                    {message.bounceReason}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'headers' && (
            <div className="p-3.5 bg-black border border-gray-800 font-mono text-[11px] text-[#00FF66] space-y-1 max-h-80 overflow-y-auto">
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
              <div className="p-4 bg-white text-gray-900 border border-[#CCD2D8] min-h-[160px] max-h-96 overflow-y-auto">
                {message.htmlBody ? (
                  <div dangerouslySetInnerHTML={{ __html: message.htmlBody }} />
                ) : message.plainText ? (
                  <pre className="font-sans whitespace-pre-wrap">{message.plainText}</pre>
                ) : (
                  <p className="text-gray-500 italic">No email body captured.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 px-5 bg-white border-t border-[#CCD2D8] flex items-center justify-between text-xs text-gray-600">
          <span className="font-mono text-[11px]">Security: TLS 1.3 encrypted spool connection</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#37474F] hover:bg-[#263238] text-white font-bold transition shadow-xs"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
