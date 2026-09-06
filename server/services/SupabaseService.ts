import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db } from '../store.js';
import { Message, MessageEvent, Sender, Campaign, Contact, SuppressionItem, TechnicalLog, Domain, ApiKey } from '../../src/types.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  role?: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  plan?: string;
}

export class SupabaseService {
  private client: SupabaseClient | null = null;
  private url: string;
  private serviceKey: string;
  public isConfigured: boolean;

  constructor() {
    this.url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    this.serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    this.isConfigured = Boolean(this.url && this.serviceKey && !this.url.includes('placeholder') && this.url.startsWith('https://'));
    if (this.isConfigured) {
      try {
        this.client = createClient(this.url, this.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      } catch (err) {
        console.warn('[SupabaseService] Client initialization warning:', err);
        this.client = null;
        this.isConfigured = false;
      }
    }
  }

  public getClient(): SupabaseClient | null { return this.client; }

  async health(): Promise<{ configured: boolean; healthy: boolean; latencyMs?: number; error?: string }> {
    if (!this.isConfigured || !this.client) return { configured: false, healthy: false, error: 'Supabase is not configured' };
    const started = Date.now();
    try {
      const { error } = await this.client.from('profiles').select('id').limit(1);
      if (error) return { configured: true, healthy: false, latencyMs: Date.now() - started, error: error.message };
      return { configured: true, healthy: true, latencyMs: Date.now() - started };
    } catch (err: any) {
      return { configured: true, healthy: false, latencyMs: Date.now() - started, error: err?.message || String(err) };
    }
  }

  async verifyToken(token: string): Promise<AuthenticatedUser | null> {
    if (!token || typeof token !== 'string') return null;
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    if (!cleanToken) return null;
    if (this.isConfigured && this.client) {
      try {
        const { data, error } = await this.client.auth.getUser(cleanToken);
        if (error || !data.user) return null;
        const su = data.user;
        const meta = su.user_metadata || {};
        let role: 'ADMIN' | 'OPERATOR' | 'VIEWER' = (meta.role as any) || 'ADMIN';
        let name = meta.full_name || meta.name || su.email?.split('@')[0] || 'Operator';
        let plan = meta.plan || 'PRO';
        const { data: profile } = await this.client.from('profiles').select('full_name,role,plan').eq('id', su.id).maybeSingle();
        if (profile) {
          role = profile.role || role;
          name = profile.full_name || name;
          plan = profile.plan || plan;
        } else {
          await this.client.from('profiles').insert({ id: su.id, email: su.email || '', full_name: name, role, plan });
        }
        return { id: su.id, email: su.email || '', name, role, plan };
      } catch (err) {
        console.error('[SupabaseService] Token verification error:', err);
        return null;
      }
    }
    if (cleanToken.startsWith('test-') || cleanToken === 'mock-jwt-token') {
      const userId = cleanToken.includes('usr_') ? cleanToken.replace(/^test-token-/, '') : 'usr_admin_01';
      const existingUser = db.users.find((u) => u.id === userId) || db.users[0];
      return { id: existingUser?.id || 'usr_admin_01', email: existingUser?.email || 'admin@emailops.io', name: existingUser?.name || 'Test Operator', role: (existingUser?.role as any) || 'ADMIN', plan: 'PRO' };
    }
    return null;
  }

  async isEventProcessed(eventId: string): Promise<boolean> {
    if (!eventId) return false;
    if (this.isConfigured && this.client) {
      try {
        const { data, error } = await this.client.from('processed_webhook_events').select('event_id').eq('event_id', eventId).maybeSingle();
        return !error && Boolean(data);
      } catch (err) { console.warn('[SupabaseService] isEventProcessed failed:', err); return false; }
    }
    return db.hasProcessedEvent(eventId);
  }

  async recordProcessedEvent(eventId: string, provider = 'SES_SNS'): Promise<void> {
    if (!eventId) return;
    if (this.isConfigured && this.client) {
      const { error } = await this.client.from('processed_webhook_events').insert({ event_id: eventId, provider });
      if (error && !/duplicate|unique/i.test(error.message)) console.warn('[SupabaseService] recordProcessedEvent:', error.message);
      return;
    }
    db.recordProcessedEvent(eventId);
  }

  async saveMessage(message: Message, userId: string): Promise<void> {
    if (this.isConfigured && this.client) {
      const payload = {
        user_id: userId, internal_id: message.id, message_id: message.messageId, ses_message_id: message.sesMessageId || null,
        campaign_id: message.campaignId || null, sender_id: message.senderId || null, from_name: message.fromName || null,
        from_email: message.fromEmail, to_email: message.toEmail, reply_to: message.replyTo || null, cc: message.cc || [], bcc: message.bcc || [],
        subject: message.subject, html_body: message.htmlBody || null, plain_text: message.plainText || null, custom_headers: message.customHeaders || null,
        status: message.status, provider: message.provider || 'KumoMTA', provider_message_id: message.providerMessageId || null,
        smtp_response: message.smtpResponse || null, bounce_type: message.bounceType || null, bounce_reason: message.bounceReason || null,
        queued_at: message.queuedAt || new Date().toISOString(), sent_at: message.sentAt || null, delivered_at: message.deliveredAt || null, bounced_at: message.bouncedAt || null,
      };
      const { error } = await this.client.from('messages').upsert(payload, { onConflict: 'id' });
      if (error) throw new Error(`Supabase message save failed: ${error.message}`);
      return;
    }
    const existingIdx = db.messages.findIndex((m) => m.id === message.id || m.messageId === message.messageId);
    if (existingIdx >= 0) db.messages[existingIdx] = message; else db.messages.unshift(message);
  }

  async updateMessageStatus(params: { messageId: string; status: Message['status']; sesMessageId?: string; deliveredAt?: string; bouncedAt?: string; bounceType?: 'Hard' | 'Soft' | 'Transient'; bounceReason?: string; smtpResponse?: string; }): Promise<void> {
    const { messageId, status, sesMessageId, deliveredAt, bouncedAt, bounceType, bounceReason, smtpResponse } = params;
    if (this.isConfigured && this.client) {
      const updatePayload: Record<string, any> = { status, updated_at: new Date().toISOString() };
      if (sesMessageId) updatePayload.ses_message_id = sesMessageId;
      if (deliveredAt) updatePayload.delivered_at = deliveredAt;
      if (bouncedAt) updatePayload.bounced_at = bouncedAt;
      if (bounceType) updatePayload.bounce_type = bounceType;
      if (bounceReason) updatePayload.bounce_reason = bounceReason;
      if (smtpResponse) updatePayload.smtp_response = smtpResponse;
      const { error } = await this.client.from('messages').update(updatePayload).or(`message_id.eq.${messageId},internal_id.eq.${messageId},ses_message_id.eq.${messageId}`);
      if (error) throw new Error(`Supabase message update failed: ${error.message}`);
      return;
    }
    const msg = db.messages.find((m) => m.messageId === messageId || m.id === messageId || m.sesMessageId === messageId);
    if (msg) Object.assign(msg, { status, ...(sesMessageId ? { sesMessageId } : {}), ...(deliveredAt ? { deliveredAt } : {}), ...(bouncedAt ? { bouncedAt } : {}), ...(bounceType ? { bounceType } : {}), ...(bounceReason ? { bounceReason } : {}), ...(smtpResponse ? { smtpResponse } : {}) });
  }

  async saveMessageEvent(event: MessageEvent, userId?: string): Promise<void> {
    if (this.isConfigured && this.client) {
      const { error } = await this.client.from('message_events').insert({ message_id: event.messageId, user_id: userId || null, event_type: event.eventType, event_data: event.eventData || null, ip_address: event.ipAddress || null, user_agent: event.userAgent || null, geo: event.geo || null, timestamp: event.timestamp || new Date().toISOString() });
      if (error) throw new Error(`Supabase event save failed: ${error.message}`);
      return;
    }
    db.messageEvents.push(event);
  }

  async saveTechnicalLog(log: TechnicalLog, userId?: string): Promise<void> {
    if (this.isConfigured && this.client) {
      const { error } = await this.client.from('technical_logs').insert({ user_id: userId || null, service: log.service, message_id: log.messageId || null, event: log.event, severity: log.severity, response: log.response, details: log.details || null, timestamp: log.timestamp || new Date().toISOString() });
      if (error) console.error('[SupabaseService] technical log save:', error.message);
      return;
    }
    db.logs.unshift(log);
  }

  async getMessages(userId: string, limit = 100): Promise<Message[]> {
    if (!this.isConfigured || !this.client) return db.messages.slice(0, limit);
    const { data, error } = await this.client.from('messages').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    if (error) throw new Error(`Supabase messages query failed: ${error.message}`);
    const ids = data.map((r: any) => r.message_id).filter(Boolean);
    let events: any[] = [];
    if (ids.length) {
      const er = await this.client.from('message_events').select('*').in('message_id', ids).order('timestamp', { ascending: true });
      if (!er.error) events = er.data || [];
    }
    const grouped = new Map<string, MessageEvent[]>();
    for (const row of events) {
      const e: MessageEvent = { id: row.id, messageId: row.message_id, eventType: row.event_type, eventData: row.event_data || undefined, timestamp: row.timestamp, ipAddress: row.ip_address || undefined, userAgent: row.user_agent || undefined, geo: row.geo || undefined };
      grouped.set(e.messageId, [...(grouped.get(e.messageId) || []), e]);
    }
    return data.map((r: any) => ({ id: r.internal_id || r.id, messageId: r.message_id, sesMessageId: r.ses_message_id, campaignId: r.campaign_id, senderId: r.sender_id, fromName: r.from_name, fromEmail: r.from_email, toEmail: r.to_email, replyTo: r.reply_to, cc: r.cc || [], bcc: r.bcc || [], subject: r.subject, htmlBody: r.html_body, plainText: r.plain_text, customHeaders: r.custom_headers, status: r.status, provider: r.provider, providerMessageId: r.provider_message_id, smtpResponse: r.smtp_response, bounceType: r.bounce_type, bounceReason: r.bounce_reason, queuedAt: r.queued_at, sentAt: r.sent_at, deliveredAt: r.delivered_at, bouncedAt: r.bounced_at, createdAt: r.created_at, events: grouped.get(r.message_id) || [] }));
  }

  async getSenders(userId: string): Promise<Sender[]> {
    if (!this.isConfigured || !this.client) return db.senders;
    const { data, error } = await this.client.from('senders').select('*,domains(domain_name)').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(`Supabase senders query failed: ${error.message}`);
    return (data || []).map((r: any) => ({ id: r.id, name: r.name, fromEmail: r.from_email, replyTo: r.reply_to, domainId: r.domain_id, domainName: r.domains?.domain_name, status: r.status, verification: r.verification, dailyLimit: r.daily_limit, hourlyLimit: r.hourly_limit, sentCount: r.sent_count, deliveredCount: r.delivered_count, bouncedCount: r.bounced_count, complaintCount: r.complaint_count, createdAt: r.created_at, updatedAt: r.updated_at }));
  }

  async getDomains(userId: string): Promise<Domain[]> {
    if (!this.isConfigured || !this.client) return db.domains;
    const { data, error } = await this.client.from('domains').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(`Supabase domains query failed: ${error.message}`);
    return (data || []).map((r: any) => ({ id: r.id, domainName: r.domain_name, spfStatus: r.spf_status, dkimStatus: r.dkim_status, dmarcStatus: r.dmarc_status, sesStatus: r.ses_status, dkimSelector: r.dkim_selector, dkimPublicKey: r.dkim_public_key, spfRecord: r.spf_record, dmarcRecord: r.dmarc_record, createdAt: r.created_at, updatedAt: r.updated_at }));
  }

  async getCampaigns(userId: string): Promise<Campaign[]> {
    if (!this.isConfigured || !this.client) return db.campaigns;
    const { data, error } = await this.client.from('campaigns').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(`Supabase campaigns query failed: ${error.message}`);
    return (data || []).map((r: any) => ({ id: r.id, name: r.name, senderId: r.sender_id, listId: r.list_id, subject: r.subject, preheader: r.preheader, headHtml: r.head_html, htmlBody: r.html_body, plainText: r.plain_text, status: r.status, scheduledAt: r.scheduled_at, startedAt: r.started_at, completedAt: r.completed_at, totalRecipients: r.total_recipients, sentCount: r.sent_count, deliveredCount: r.delivered_count, bouncedCount: r.bounced_count, complaintCount: r.complaint_count, openCount: r.open_count, clickCount: r.click_count, trackOpens: r.track_opens, trackClicks: r.track_clicks, createdAt: r.created_at }));
  }

  async getContacts(userId: string): Promise<Contact[]> {
    if (!this.isConfigured || !this.client) return db.contacts;
    const { data, error } = await this.client.from('contacts').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(`Supabase contacts query failed: ${error.message}`);
    return (data || []).map((r: any) => ({ id: r.id, email: r.email, firstName: r.first_name, lastName: r.last_name, company: r.company, tags: r.tags || [], status: r.status, bounceReason: r.bounce_reason, createdAt: r.created_at, updatedAt: r.updated_at }));
  }

  async getSuppressions(userId?: string): Promise<SuppressionItem[]> {
    if (!this.isConfigured || !this.client) return db.suppressions;
    if (!userId) return [];
    const { data, error } = await this.client.from('suppressions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(`Supabase suppressions query failed: ${error.message}`);
    return (data || []).map((r: any) => ({ id: r.id, email: r.email, type: r.type, reason: r.reason, source: r.source, createdAt: r.created_at }));
  }

  async getLogs(userId: string, limit = 100): Promise<TechnicalLog[]> {
    if (!this.isConfigured || !this.client) return db.logs.slice(0, limit);
    const { data, error } = await this.client.from('technical_logs').select('*').eq('user_id', userId).order('timestamp', { ascending: false }).limit(limit);
    if (error) throw new Error(`Supabase logs query failed: ${error.message}`);
    return (data || []).map((r: any) => ({ id: r.id, timestamp: r.timestamp, service: r.service, messageId: r.message_id || undefined, event: r.event, severity: r.severity, response: r.response, details: r.details || undefined }));
  }

  async getSettings(userId: string): Promise<Record<string, any>> {
    if (!this.isConfigured || !this.client) return db.settings;
    const { data, error } = await this.client.from('settings').select('category,values').eq('user_id', userId).order('category');
    if (error) throw new Error(`Supabase settings query failed: ${error.message}`);
    return Object.fromEntries((data || []).map((r: any) => [r.category, r.values || {}]));
  }

  async upsertSettings(userId: string, category: string, values: Record<string, any>): Promise<Record<string, any>> {
    if (!this.isConfigured || !this.client) {
      db.settings[category] = { ...(db.settings[category] || {}), ...values };
      return db.settings;
    }
    const current = await this.client.from('settings').select('values').eq('user_id', userId).eq('category', category).maybeSingle();
    if (current.error) throw new Error(`Supabase settings read failed: ${current.error.message}`);
    const merged = { ...(current.data?.values || {}), ...values };
    const { error } = await this.client.from('settings').upsert({ user_id: userId, category, values: merged, updated_at: new Date().toISOString() }, { onConflict: 'user_id,category' });
    if (error) throw new Error(`Supabase settings save failed: ${error.message}`);
    return this.getSettings(userId);
  }

  async getApiKeys(userId: string): Promise<ApiKey[]> {
    if (!this.isConfigured || !this.client) return db.apiKeys as ApiKey[];
    const { data, error } = await this.client.from('api_keys').select('id,name,key_prefix,last_used_at,created_at').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(`Supabase API keys query failed: ${error.message}`);
    return (data || []).map((r: any) => ({ id: r.id, name: r.name, keyPrefix: r.key_prefix, lastUsedAt: r.last_used_at || undefined, createdAt: r.created_at }));
  }

  async createApiKey(userId: string, name: string, keyPrefix: string, keyHash: string): Promise<ApiKey> {
    if (!this.isConfigured || !this.client) throw new Error('Supabase persistence is required for API keys');
    const { data, error } = await this.client.from('api_keys').insert({ user_id: userId, name, key_prefix: keyPrefix, key_hash: keyHash }).select('id,name,key_prefix,last_used_at,created_at').single();
    if (error) throw new Error(`Supabase API key creation failed: ${error.message}`);
    return { id: data.id, name: data.name, keyPrefix: data.key_prefix, lastUsedAt: data.last_used_at || undefined, createdAt: data.created_at };
  }

  async revokeApiKey(userId: string, id: string): Promise<void> {
    if (!this.isConfigured || !this.client) return;
    const { error } = await this.client.from('api_keys').delete().eq('id', id).eq('user_id', userId);
    if (error) throw new Error(`Supabase API key revoke failed: ${error.message}`);
  }
}

export const supabaseService = new SupabaseService();
