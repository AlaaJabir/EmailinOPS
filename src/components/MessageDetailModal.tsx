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
} from 'lucide-react';
import { Message } from '../types';
import { StatusBadge } from './StatusBadge';

interface MessageDetailModalProps {
  message: Message | null;
  onClose: () => void;
}

export const MessageDetailModal: React.FC<MessageDetailModalProps> = ({ message, onClose }) => {
  const [copiedId, setCopiedId] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'headers' | 'content'>('timeline');

  if (!message) return null;

  const copyMessageId = () => {
    navigator.clipboard.writeText(message.messageId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="bg-[#0F0F0F] border border-white-10 rounded-sm w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="p-6 border-b border-white-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-white/5 border border-white-10 flex items-center justify-center text-white">
              <Server className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white text-base">Message Telemetry</span>
                <StatusBadge status={message.status} />
              </div>
              <div className="flex items-center gap-2 text-xs text-[#888888] mt-0.5">
                <span className="font-mono text-zinc-300">{message.messageId}</span>
                <button
                  onClick={copyMessageId}
                  className="hover:text-white text-[#888888] transition-colors p-0.5"
                  title="Copy RFC Message-ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-sm hover:bg-white/5 text-[#888888] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Meta Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[#050505] border-b border-white-10 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#888888]">From</div>
            <div className="text-zinc-200 font-mono truncate mt-0.5" title={message.fromEmail}>
              {message.fromName ? `${message.fromName} <${message.fromEmail}>` : message.fromEmail}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#888888]">To</div>
            <div className="text-zinc-200 font-mono truncate mt-0.5" title={message.toEmail}>
              {message.toEmail}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#888888]">Subject</div>
            <div className="text-zinc-200 truncate mt-0.5" title={message.subject}>
              {message.subject}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#888888]">Routing Provider</div>
            <div className="text-emerald-400 font-medium mt-0.5">
              {message.provider || 'KumoMTA + Amazon SES'}
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-white-10 px-6 gap-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'timeline'
                ? 'border-white text-white'
                : 'border-transparent text-[#888888] hover:text-white'
            }`}
          >
            Timeline & Events
          </button>
          <button
            onClick={() => setActiveTab('headers')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'headers'
                ? 'border-white text-white'
                : 'border-transparent text-[#888888] hover:text-white'
            }`}
          >
            Headers & Protocol
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'content'
                ? 'border-white text-white'
                : 'border-transparent text-[#888888] hover:text-white'
            }`}
          >
            Body Payload
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'timeline' && (
            <div className="space-y-6">
              {/* Event Timeline */}
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                {message.events && message.events.length > 0 ? (
                  message.events.map((evt, idx) => (
                    <div key={evt.id || idx} className="relative">
                      <div className="absolute -left-6 mt-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-[#0F0F0F]" />
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white uppercase tracking-wider">
                          {evt.eventType}
                        </span>
                        <span className="text-[10px] font-mono text-[#888888]">
                          {new Date(evt.timestamp).toLocaleTimeString()} &bull; {new Date(evt.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      {evt.eventData && (
                        <div className="mt-1.5 p-3 rounded-sm bg-[#050505] border border-white-10 text-xs font-mono text-[#888888]">
                          {JSON.stringify(evt.eventData, null, 2)}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[#888888] py-4">No granular events recorded yet.</div>
                )}
              </div>

              {/* Bounce Banner if Bounced */}
              {message.status === 'BOUNCED' && (
                <div className="p-4 rounded-sm bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
                  <div className="font-semibold text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Hard Bounce Diagnostic
                  </div>
                  <div className="text-zinc-300 font-mono">{message.bounceReason || 'Mailbox lookup failed'}</div>
                  <div className="text-[#888888] text-[11px]">
                    Recipient has been added to the active suppression table to prevent further delivery attempts.
                  </div>
                </div>
              )}

              {/* SMTP Response Details */}
              <div className="p-3.5 rounded-sm bg-[#050505] border border-white-10 text-xs space-y-1.5">
                <div className="font-medium text-zinc-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" /> Upstream Relay Response
                </div>
                <div className="font-mono text-xs text-[#888888] bg-[#0F0F0F] p-2.5 rounded-sm border border-white-10">
                  {message.smtpResponse || '250 2.0.0 OK: Injected into KumoMTA spool queue'}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'headers' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="p-4 rounded-sm bg-[#050505] border border-white-10 space-y-2">
                <div className="text-[#888888]">Message-ID: <span className="text-emerald-400">{message.messageId}</span></div>
                <div className="text-[#888888]">Date: <span className="text-zinc-200">{new Date(message.createdAt).toUTCString()}</span></div>
                <div className="text-[#888888]">From: <span className="text-zinc-200">{message.fromEmail}</span></div>
                <div className="text-[#888888]">To: <span className="text-zinc-200">{message.toEmail}</span></div>
                <div className="text-[#888888]">Subject: <span className="text-zinc-200">{message.subject}</span></div>
                <div className="text-[#888888]">X-KumoMTA-Queue: <span className="text-zinc-200">tier1-high-throughput</span></div>
                <div className="text-[#888888]">X-SES-ConfigurationSet: <span className="text-zinc-200">EmailOps-Production-ConfigSet</span></div>
                <div className="text-[#888888]">List-Unsubscribe: <span className="text-zinc-200">&lt;https://transact.acme-corp.io/u/{message.id}&gt;</span></div>
                <div className="text-[#888888]">List-Unsubscribe-Post: <span className="text-zinc-200">List-Unsubscribe=One-Click</span></div>
              </div>
            </div>
          )}

          {activeTab === 'content' && (
            <div className="space-y-4">
              <div className="border border-white-10 rounded-sm p-4 bg-white text-zinc-900 min-h-[160px]">
                {message.htmlBody ? (
                  <div dangerouslySetInnerHTML={{ __html: message.htmlBody }} />
                ) : (
                  <div className="font-mono text-xs whitespace-pre-wrap">{message.plainText || 'No body content.'}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white-10 bg-[#050505] flex items-center justify-between">
          <div className="text-xs text-[#888888]">
            Internal ID: <span className="font-mono text-zinc-300">{message.id}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-sm bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white-10 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
