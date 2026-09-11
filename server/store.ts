import {
  User, Domain, Sender, Contact, ContactList, SuppressionItem, Template, Campaign, Message,
  MessageEvent, TechnicalLog, PrometheusMetrics, DashboardStats,
} from '../src/types.js';

export interface UnsubscribeToken {
  token: string; email: string; contactId?: string; messageId?: string; campaignId?: string; userId?: string; createdAt: string; unsubscribedAt?: string;
}

class DatabaseStore {
  users: User[] = [];
  domains: Domain[] = [];
  senders: Sender[] = [];
  contacts: Contact[] = [];
  contactLists: ContactList[] = [];
  listMemberships: { listId: string; contactId: string; joinedAt: string }[] = [];
  suppressions: SuppressionItem[] = [];
  templates: Template[] = [];
  campaigns: Campaign[] = [];
  messages: Message[] = [];
  messageEvents: MessageEvent[] = [];
  unsubscribeTokens: UnsubscribeToken[] = [];
  logs: TechnicalLog[] = [];
  settings: Record<string, any> = {};
  apiKeys: Array<{ id: string; name: string; keyPrefix: string; createdAt: string; lastUsedAt?: string }> = [];
  processedEventIds: Set<string> = new Set<string>();

  constructor() {
    this.seedDefaultSenders();
    if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEMO_DATA === 'true') this.seedInitialData();
  }

  seedDefaultSenders() {
    const now = new Date().toISOString();
    if (!this.domains.length) {
      this.domains = [{ id: 'dom_00', domainName: 'amiralucia.com', spfStatus: 'VERIFIED', dkimStatus: 'VERIFIED', dmarcStatus: 'VERIFIED', sesStatus: 'VERIFIED', dkimSelector: 'kumo2026', dkimPublicKey: 'verified', spfRecord: 'v=spf1 include:amazonses.com ~all', dmarcRecord: 'v=DMARC1; p=none;', createdAt: now, updatedAt: now }];
    }
    if (!this.senders.length) {
      this.senders = [
        { id: 'snd_00', name: 'Amira Lucia', fromEmail: 'service@amiralucia.com', replyTo: 'service@amiralucia.com', domainId: 'dom_00', domainName: 'amiralucia.com', status: 'active', verification: 'VERIFIED', dailyLimit: 50000, hourlyLimit: 5000, sentCount: 0, deliveredCount: 0, bouncedCount: 0, complaintCount: 0, createdAt: now },
        { id: 'snd_01', name: 'Newsletter', fromEmail: 'newsletter@amiralucia.com', replyTo: 'newsletter@amiralucia.com', domainId: 'dom_00', domainName: 'amiralucia.com', status: 'active', verification: 'VERIFIED', dailyLimit: 50000, hourlyLimit: 5000, sentCount: 0, deliveredCount: 0, bouncedCount: 0, complaintCount: 0, createdAt: now }
      ];
    }
  }

  seedInitialData() {
    const now = new Date();
    const iso = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60000).toISOString();
    this.users = [
      { id: 'usr_admin_01', email: 'admin@emailops.io', name: 'Alex Vance (Lead Email Architect)', role: 'ADMIN', createdAt: iso(10080) },
      { id: 'usr_ops_02', email: 'ops@emailops.io', name: 'Sarah Chen (Deliverability Engineer)', role: 'OPERATOR', createdAt: iso(7200) },
    ];
    this.domains = [{ id: 'dom_00', domainName: 'amiralucia.com', spfStatus: 'VERIFIED', dkimStatus: 'VERIFIED', dmarcStatus: 'VERIFIED', sesStatus: 'VERIFIED', dkimSelector: 'kumo2026', dkimPublicKey: 'demo-only', spfRecord: 'demo-only', dmarcRecord: 'demo-only', createdAt: iso(10000), updatedAt: iso(100) }];
    this.senders = [
      { id: 'snd_00', name: 'Amira Lucia', fromEmail: 'service@amiralucia.com', replyTo: 'service@amiralucia.com', domainId: 'dom_00', domainName: 'amiralucia.com', status: 'active', verification: 'VERIFIED', dailyLimit: 50000, hourlyLimit: 5000, sentCount: 0, deliveredCount: 0, bouncedCount: 0, complaintCount: 0, createdAt: iso(100) },
      { id: 'snd_01', name: 'Newsletter', fromEmail: 'newsletter@amiralucia.com', replyTo: 'newsletter@amiralucia.com', domainId: 'dom_00', domainName: 'amiralucia.com', status: 'active', verification: 'VERIFIED', dailyLimit: 50000, hourlyLimit: 5000, sentCount: 0, deliveredCount: 0, bouncedCount: 0, complaintCount: 0, createdAt: iso(100) }
    ];
    this.contacts = [];
    this.contactLists = [];
    this.listMemberships = [];
    this.suppressions = [];
    this.templates = [];
    this.campaigns = [];
    this.messages = [];
    this.messageEvents = [];
    this.logs = [];
  }

  hasProcessedEvent(id: string) { return this.processedEventIds.has(id); }
  recordProcessedEvent(id: string) { this.processedEventIds.add(id); }

  findContactByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    return this.contacts.find((c) => c.email.trim().toLowerCase() === normalized);
  }

  unsubscribeContact(email: string, options?: { reason?: string; source?: string; contactId?: string }) {
    const normalized = email.trim().toLowerCase();
    const contact = options?.contactId
      ? this.contacts.find((c) => c.id === options.contactId && c.email.trim().toLowerCase() === normalized)
      : this.contacts.find((c) => c.email.trim().toLowerCase() === normalized);
    if (!contact) return { wasAlreadyUnsubscribed: false };
    const wasAlreadyUnsubscribed = contact.status === 'UNSUBSCRIBED';
    contact.status = 'UNSUBSCRIBED';
    contact.updatedAt = new Date().toISOString();
    return { wasAlreadyUnsubscribed };
  }

  findMessageForEvent(input: string | { internalId?: string; rfcMessageId?: string; sesMessageId?: string; recipient?: string }) {
    const ids = typeof input === 'string' ? [input] : [input.internalId, input.rfcMessageId, input.sesMessageId].filter(Boolean) as string[];
    const recipient = typeof input === 'string' ? undefined : input.recipient;
    return this.messages.find((m) => {
      if (ids.includes(m.messageId) || ids.includes(m.id) || (m.sesMessageId && ids.includes(m.sesMessageId))) return true;
      return Boolean(recipient && m.toEmail.toLowerCase() === recipient.toLowerCase());
    });
  }

  getPrometheusMetrics(): PrometheusMetrics {
    return {
      kumomta_queue_size: this.messages.filter((m) => m.status === 'QUEUED' || m.status === 'SENDING').length,
      kumomta_messages_in_flight: this.messages.filter((m) => m.status === 'SENDING').length,
      kumomta_messages_sent_total: this.messages.filter((m) => ['SENT', 'DELIVERED'].includes(m.status)).length,
      kumomta_delivery_rate_per_second: 0,
      kumomta_smtp_connection_pool_active: 0,
      kumomta_smtp_connection_pool_idle: 0,
      kumomta_memory_usage_bytes: 0,
      kumomta_cpu_usage_percent: 0,
      ses_quota_max_24_hour: 0,
      ses_quota_sent_last_24_hour: 0,
      ses_quota_max_send_rate: 0,
      ses_reputation_bounce_rate: 0,
      ses_reputation_complaint_rate: 0,
    };
  }

  getDashboardStats(): DashboardStats {
    const sent = this.messages.filter((m) => ['SENT', 'DELIVERED'].includes(m.status)).length;
    const delivered = this.messages.filter((m) => m.status === 'DELIVERED').length;
    const bounced = this.messages.filter((m) => m.status === 'BOUNCED').length;
    const failed = this.messages.filter((m) => m.status === 'FAILED').length;
    const queued = this.messages.filter((m) => ['QUEUED', 'SENDING'].includes(m.status)).length;
    const opens = this.messageEvents.filter((e) => e.eventType === 'OPENED').length;
    const clicks = this.messageEvents.filter((e) => e.eventType === 'CLICKED').length;
    return { totalSent: sent, delivered, bounced, failed, complaints: this.messages.filter((m) => m.status === 'COMPLAINED').length, rejected: this.messages.filter((m) => m.status === 'REJECTED').length, deliveryDelayed: this.messages.filter((m) => m.status === 'DELIVERY_DELAYED').length, renderingFailed: this.messages.filter((m) => m.status === 'RENDERING_FAILED').length, queued, opens, clicks, deliveryRate: sent ? (delivered / sent) * 100 : 0, bounceRate: sent ? (bounced / sent) * 100 : 0, openRate: sent ? (opens / sent) * 100 : 0, clickRate: sent ? (clicks / sent) * 100 : 0, queueSize: queued, sendingRatePerSec: 0, kumoHealth: 'offline', sesHealth: 'offline', timeseries: [], hourlyActivity: [], topSenders: [], topCampaigns: [] };
  }
}

export const db = new DatabaseStore();
