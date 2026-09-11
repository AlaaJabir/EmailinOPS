import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db, UnsubscribeToken } from '../store.js';
import { Message, MessageEvent, Sender, Campaign, Contact, SuppressionItem, TechnicalLog, Domain, ApiKey, SuppressionType } from '../../src/types.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  role?: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  plan?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidUUID(id?: string | null): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

export class SupabaseService {
  private client: SupabaseClient | null = null;
  private url: string;
  private serviceKey: string;
  public isConfigured: boolean;
  private cachedDefaultUserId: string | null = null;

  constructor() {
    this.url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    this.serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    this.isConfigured = Boolean(this.url && this.serviceKey && !this.url.includes('placeholder') && this.url.startsWith('https://'));
    if (this.isConfigured) {
      try {
        this.client = createClient(this.url, this.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      } catch (e) {
        console.warn('[SupabaseService] Client initialization warning:', e);
        this.client = null;
        this.isConfigured = false;
      }
    }
  }

  getClient() { return this.client; }

  async getDefaultUserId(): Promise<string | null> {
    if (this.cachedDefaultUserId && isValidUUID(this.cachedDefaultUserId)) {
      return this.cachedDefaultUserId;
    }
    if (!this.isConfigured || !this.client) return null;
    try {
      const { data, error } = await this.client.from('profiles').select('id').order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (!error && data?.id && isValidUUID(data.id)) {
        this.cachedDefaultUserId = data.id;
        return data.id;
      }
    } catch (err) {
      console.warn('[SupabaseService] getDefaultUserId query warning:', err);
    }
    // Fallback: system seed profile UUID
    const fallback = 'f7649aa6-4288-468b-beef-5a6db080283f';
    this.cachedDefaultUserId = fallback;
    return fallback;
  }

  async resolveUserId(userId?: string | null): Promise<string | null> {
    if (isValidUUID(userId)) return userId!;
    return await this.getDefaultUserId();
  }

  async health() {
    if (!this.isConfigured || !this.client) return { configured: false, healthy: false, error: 'Supabase is not configured' };
    const s = Date.now();
    try {
      const { error } = await this.client.from('profiles').select('id').limit(1);
      return error
        ? { configured: true, healthy: false, latencyMs: Date.now() - s, error: error.message }
        : { configured: true, healthy: true, latencyMs: Date.now() - s };
    } catch (e: any) {
      return { configured: true, healthy: false, latencyMs: Date.now() - s, error: e?.message || String(e) };
    }
  }

  async verifyToken(token: string): Promise<AuthenticatedUser | null> {
    if (!token || typeof token !== 'string') return null;
    const t = token.replace(/^Bearer\s+/i, '').trim();
    if (!t) return null;
    if (this.isConfigured && this.client) {
      try {
        const { data, error } = await this.client.auth.getUser(t);
        if (error || !data.user) return null;
        const u = data.user;
        const m = u.user_metadata || {};
        let role: any = m.role || 'ADMIN';
        let name = m.full_name || m.name || u.email?.split('@')[0] || 'Operator';
        let plan = m.plan || 'PRO';
        const { data: p } = await this.client.from('profiles').select('full_name,role,plan').eq('id', u.id).maybeSingle();
        if (p) {
          role = p.role || role;
          name = p.full_name || name;
          plan = p.plan || plan;
        } else {
          await this.client.from('profiles').insert({ id: u.id, email: u.email || '', full_name: name, role, plan });
        }
        return { id: u.id, email: u.email || '', name, role, plan };
      } catch (e) {
        console.error('[SupabaseService] Token verification error:', e);
        return null;
      }
    }
    if (t.startsWith('test-') || t === 'mock-jwt-token') {
      const id = t.includes('usr_') ? t.replace(/^test-token-/, '') : 'usr_admin_01';
      const u = db.users.find(x => x.id === id) || db.users[0];
      return { id: u?.id || 'usr_admin_01', email: u?.email || 'admin@emailops.io', name: u?.name || 'Test Operator', role: (u?.role as any) || 'ADMIN', plan: 'PRO' };
    }
    return null;
  }

  async isEventProcessed(id: string) {
    if (!id) return false;
    if (this.isConfigured && this.client) {
      try {
        const { data, error } = await this.client.from('processed_webhook_events').select('event_id').eq('event_id', id).maybeSingle();
        return !error && Boolean(data);
      } catch (e) {
        console.warn('[SupabaseService] isEventProcessed failed:', e);
        return false;
      }
    }
    return db.hasProcessedEvent(id);
  }

  async recordProcessedEvent(id: string, provider = 'SES_SNS') {
    if (!id) return;
    if (this.isConfigured && this.client) {
      const { error } = await this.client.from('processed_webhook_events').insert({ event_id: id, provider });
      if (error && !/duplicate|unique/i.test(error.message)) console.warn('[SupabaseService] recordProcessedEvent:', error.message);
      return;
    }
    db.recordProcessedEvent(id);
  }

  async saveMessage(message: Message, userId?: string) {
    const resolvedUser = await this.resolveUserId(userId);
    if (this.isConfigured && this.client && resolvedUser) {
      let senderId = isValidUUID(message.senderId) ? message.senderId : null;
      if (!senderId && message.fromEmail) {
        try {
          const { data: s } = await this.client.from('senders').select('id').eq('user_id', resolvedUser).eq('from_email', message.fromEmail).maybeSingle();
          if (s?.id) senderId = s.id;
        } catch {}
      }
      const campaignId = isValidUUID(message.campaignId) ? message.campaignId : null;

      const p: any = {
        user_id: resolvedUser,
        internal_id: message.id,
        message_id: message.messageId,
        ses_message_id: message.sesMessageId || null,
        campaign_id: campaignId,
        sender_id: senderId,
        from_name: message.fromName || null,
        from_email: message.fromEmail,
        to_email: message.toEmail,
        reply_to: message.replyTo || null,
        cc: message.cc || [],
        bcc: message.bcc || [],
        subject: message.subject,
        html_body: message.htmlBody || null,
        plain_text: message.plainText || null,
        custom_headers: message.customHeaders || null,
        status: message.status,
        provider: message.provider || 'KumoMTA',
        provider_message_id: message.providerMessageId || null,
        smtp_response: message.smtpResponse || null,
        bounce_type: message.bounceType || null,
        bounce_reason: message.bounceReason || null,
        queued_at: message.queuedAt || new Date().toISOString(),
        sent_at: message.sentAt || null,
        delivered_at: message.deliveredAt || null,
        bounced_at: message.bouncedAt || null,
        preheader: (message as any).preheader || null,
        head_html: (message as any).headHtml || null,
        is_marketing: (message as any).isMarketing === true,
        open_tracking_enabled: (message as any).openTrackingEnabled !== false,
        click_tracking_enabled: (message as any).clickTrackingEnabled !== false,
        updated_at: new Date().toISOString(),
      };

      const stripOptionalColumns = (payload: any) => {
        const clean = { ...payload };
        delete clean.preheader;
        delete clean.head_html;
        delete clean.is_marketing;
        delete clean.open_tracking_enabled;
        delete clean.click_tracking_enabled;
        return clean;
      };

      try {
        const { data: ex } = await this.client.from('messages').select('id').eq('user_id', resolvedUser).eq('internal_id', message.id).maybeSingle();
        if (ex?.id) {
          let { error } = await this.client.from('messages').update(p).eq('id', ex.id).eq('user_id', resolvedUser);
          if (error && (error.message?.includes('column') || error.message?.includes('schema cache'))) {
            const fallback = stripOptionalColumns(p);
            const retry = await this.client.from('messages').update(fallback).eq('id', ex.id).eq('user_id', resolvedUser);
            error = retry.error;
          }
          if (error) console.warn(`[SupabaseService] message update warning: ${error.message}`);
        } else {
          let { error } = await this.client.from('messages').insert(p);
          if (error && (error.message?.includes('column') || error.message?.includes('schema cache'))) {
            const fallback = stripOptionalColumns(p);
            const retry = await this.client.from('messages').insert(fallback);
            error = retry.error;
          }
          if (error) console.warn(`[SupabaseService] message save warning: ${error.message}`);
        }
      } catch (err: any) {
        console.warn(`[SupabaseService] saveMessage caught exception: ${err?.message || err}`);
      }
    }
    const i = db.messages.findIndex(m => m.id === message.id || m.messageId === message.messageId);
    if (i >= 0) db.messages[i] = message; else db.messages.unshift(message);
  }

  async updateMessageStatus(x: { messageId: string; status: Message['status']; sesMessageId?: string; deliveredAt?: string; bouncedAt?: string; bounceType?: 'Hard' | 'Soft' | 'Transient'; bounceReason?: string; smtpResponse?: string }) {
    const { messageId, status, sesMessageId, deliveredAt, bouncedAt, bounceType, bounceReason, smtpResponse } = x;
    if (this.isConfigured && this.client) {
      const p: any = { status, updated_at: new Date().toISOString() };
      if (sesMessageId) p.ses_message_id = sesMessageId;
      if (deliveredAt) p.delivered_at = deliveredAt;
      if (bouncedAt) p.bounced_at = bouncedAt;
      if (bounceType) p.bounce_type = bounceType;
      if (bounceReason) p.bounce_reason = bounceReason;
      if (smtpResponse) p.smtp_response = smtpResponse;
      try {
        const { error } = await this.client.from('messages').update(p).or(`message_id.eq.${messageId},internal_id.eq.${messageId},ses_message_id.eq.${messageId}`);
        if (error) console.warn(`[SupabaseService] message status update warning: ${error.message}`);
      } catch (err: any) {
        console.warn(`[SupabaseService] updateMessageStatus caught: ${err?.message || err}`);
      }
      return;
    }
    const m = db.messages.find(m => m.messageId === messageId || m.id === messageId || m.sesMessageId === messageId);
    if (m) Object.assign(m, { status, ...(sesMessageId ? { sesMessageId } : {}), ...(deliveredAt ? { deliveredAt } : {}), ...(bouncedAt ? { bouncedAt } : {}), ...(bounceType ? { bounceType } : {}), ...(bounceReason ? { bounceReason } : {}), ...(smtpResponse ? { smtpResponse } : {}) });
  }

  async saveMessageEvent(e: MessageEvent, userId?: string) {
    const resolvedUser = await this.resolveUserId(userId);
    if (this.isConfigured && this.client) {
      const { error } = await this.client.from('message_events').insert({
        message_id: e.messageId,
        user_id: resolvedUser,
        event_type: e.eventType,
        event_data: e.eventData || null,
        ip_address: e.ipAddress || null,
        user_agent: e.userAgent || null,
        geo: e.geo || null,
        timestamp: e.timestamp || new Date().toISOString(),
      });
      if (error) console.warn(`[SupabaseService] Event save warning: ${error.message}`);
      return;
    }
    db.messageEvents.push(e);
  }

  async saveTechnicalLog(l: TechnicalLog, userId?: string) {
    const resolvedUser = await this.resolveUserId(userId);
    if (this.isConfigured && this.client) {
      const { error } = await this.client.from('technical_logs').insert({
        user_id: resolvedUser,
        service: l.service,
        message_id: l.messageId || null,
        event: l.event,
        severity: l.severity,
        response: l.response,
        details: l.details || null,
        timestamp: l.timestamp || new Date().toISOString(),
      });
      if (error) console.warn('[SupabaseService] technical log save:', error.message);
      return;
    }
    db.logs.unshift(l);
  }

  async upsertSuppression(userId: string, email: string, type: string, reason: string, source = 'system') {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    const resolvedUser = await this.resolveUserId(userId);
    if (this.isConfigured && this.client && resolvedUser) {
      const { data: existing, error: findError } = await this.client.from('suppressions').select('id').eq('user_id', resolvedUser).ilike('email', normalized).limit(1).maybeSingle();
      if (findError) throw new Error(`Suppression lookup failed: ${findError.message}`);
      if (existing?.id) {
        const { error } = await this.client.from('suppressions').update({ type: type as SuppressionType, reason, source }).eq('id', existing.id).eq('user_id', resolvedUser);
        if (error) throw new Error(`Suppression update failed: ${error.message}`);
      } else {
        const { error } = await this.client.from('suppressions').insert({ user_id: resolvedUser, email: normalized, type: type as SuppressionType, reason, source });
        if (error) throw new Error(`Suppression save failed: ${error.message}`);
      }
      return;
    }
    if (!db.suppressions.some(s => s.email.toLowerCase() === normalized)) {
      db.suppressions.unshift({ id: `sup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, email: normalized, type: type as SuppressionType, reason, source, createdAt: new Date().toISOString() });
    }
  }

  async findMessageOwner(messageId: string) {
    if (!this.isConfigured || !this.client) return null;
    const { data, error } = await this.client.from('messages').select('id,user_id,message_id,internal_id,ses_message_id,to_email').or(`message_id.eq.${messageId},internal_id.eq.${messageId},ses_message_id.eq.${messageId}`).maybeSingle();
    if (error || !data) return null;
    return data;
  }

  async getMessages(userId?: string, limit = 100): Promise<Message[]> {
    if (!this.isConfigured || !this.client) return db.messages.slice(0, limit);
    try {
      const resolvedUser = await this.resolveUserId(userId);
      if (!resolvedUser) return db.messages.slice(0, limit);
      const { data, error } = await this.client.from('messages').select('*').eq('user_id', resolvedUser).order('created_at', { ascending: false }).limit(limit);
      if (error) {
        console.warn(`[SupabaseService] getMessages fallback:`, error.message);
        return db.messages.slice(0, limit);
      }
      const ids = (data || []).map((r: any) => r.message_id).filter(Boolean);
      let ev: any[] = [];
      if (ids.length) {
        const q = await this.client.from('message_events').select('*').in('message_id', ids).eq('user_id', resolvedUser).order('timestamp', { ascending: true });
        if (!q.error) ev = q.data || [];
      }
      const grouped = new Map<string, MessageEvent[]>();
      for (const r of ev) {
        const e: any = { id: r.id, messageId: r.message_id, eventType: r.event_type, eventData: r.event_data || undefined, timestamp: r.timestamp, ipAddress: r.ip_address || undefined, userAgent: r.user_agent || undefined, geo: r.geo || undefined };
        grouped.set(e.messageId, [...(grouped.get(e.messageId) || []), e]);
      }
      const remote = (data || []).map((r: any) => ({
        id: r.internal_id || r.id, messageId: r.message_id, sesMessageId: r.ses_message_id, campaignId: r.campaign_id, senderId: r.sender_id,
        fromName: r.from_name, fromEmail: r.from_email, toEmail: r.to_email, replyTo: r.reply_to, cc: r.cc || [], bcc: r.bcc || [],
        subject: r.subject, htmlBody: r.html_body, plainText: r.plain_text, customHeaders: r.custom_headers, status: r.status,
        provider: r.provider, providerMessageId: r.provider_message_id, smtpResponse: r.smtp_response, bounceType: r.bounce_type,
        bounceReason: r.bounce_reason, queuedAt: r.queued_at, sentAt: r.sent_at, deliveredAt: r.delivered_at, bouncedAt: r.bounced_at,
        createdAt: r.created_at, events: grouped.get(r.message_id) || [],
      }));
      return remote.length ? remote : db.messages.slice(0, limit);
    } catch (err: any) {
      console.warn(`[SupabaseService] getMessages exception fallback:`, err?.message);
      return db.messages.slice(0, limit);
    }
  }

  async getSenders(userId?: string): Promise<Sender[]> {
    if (!this.isConfigured || !this.client) return db.senders;
    try {
      const resolvedUser = await this.resolveUserId(userId);
      if (!resolvedUser) return db.senders;
      const { data, error } = await this.client.from('senders').select('*,domains(domain_name)').eq('user_id', resolvedUser).order('created_at', { ascending: false });
      if (error) {
        console.warn(`[SupabaseService] getSenders fallback:`, error.message);
        return db.senders;
      }
      const remote = (data || []).map((r: any) => ({
        id: r.id, name: r.name, fromEmail: r.from_email, replyTo: r.reply_to, domainId: r.domain_id, domainName: r.domains?.domain_name,
        status: r.status, verification: r.verification, dailyLimit: r.daily_limit, hourlyLimit: r.hourly_limit,
        sentCount: r.sent_count, deliveredCount: r.delivered_count, bouncedCount: r.bounced_count, complaintCount: r.complaint_count,
        createdAt: r.created_at, updatedAt: r.updated_at,
      }));
      return remote.length ? remote : db.senders;
    } catch (err: any) {
      console.warn(`[SupabaseService] getSenders exception fallback:`, err?.message);
      return db.senders;
    }
  }

  async getDomains(userId?: string): Promise<Domain[]> {
    if (!this.isConfigured || !this.client) return db.domains;
    try {
      const resolvedUser = await this.resolveUserId(userId);
      if (!resolvedUser) return db.domains;
      const { data, error } = await this.client.from('domains').select('*').eq('user_id', resolvedUser).order('created_at', { ascending: false });
      if (error) {
        console.warn(`[SupabaseService] getDomains fallback:`, error.message);
        return db.domains;
      }
      const remote = (data || []).map((r: any) => ({
        id: r.id, domainName: r.domain_name, spfStatus: r.spf_status, dkimStatus: r.dkim_status, dmarcStatus: r.dmarc_status,
        sesStatus: r.ses_status, dkimSelector: r.dkim_selector, dkimPublicKey: r.dkim_public_key, spfRecord: r.spf_record,
        dmarcRecord: r.dmarc_record, createdAt: r.created_at, updatedAt: r.updated_at,
      }));
      return remote.length ? remote : db.domains;
    } catch (err: any) {
      console.warn(`[SupabaseService] getDomains exception fallback:`, err?.message);
      return db.domains;
    }
  }

  async getCampaigns(userId?: string): Promise<Campaign[]> {
    if (!this.isConfigured || !this.client) return db.campaigns;
    try {
      const resolvedUser = await this.resolveUserId(userId);
      if (!resolvedUser) return db.campaigns;
      const { data, error } = await this.client.from('campaigns').select('*').eq('user_id', resolvedUser).order('created_at', { ascending: false });
      if (error) {
        console.warn(`[SupabaseService] getCampaigns fallback:`, error.message);
        return db.campaigns;
      }
      return (data || []).map((r: any) => ({
        id: r.id, name: r.name, senderId: r.sender_id, listId: r.list_id, templateId: r.template_id, subject: r.subject,
        preheader: r.preheader, headHtml: r.head_html, htmlBody: r.html_body, plainText: r.plain_text, status: r.status,
        scheduledAt: r.scheduled_at, startedAt: r.started_at, completedAt: r.completed_at, totalRecipients: r.total_recipients,
        sentCount: r.sent_count, deliveredCount: r.delivered_count, bouncedCount: r.bounced_count, complaintCount: r.complaint_count,
        openCount: r.open_count, clickCount: r.click_count, trackOpens: r.track_opens, trackClicks: r.track_clicks, createdAt: r.created_at,
      }));
    } catch (err: any) {
      console.warn(`[SupabaseService] getCampaigns exception fallback:`, err?.message);
      return db.campaigns;
    }
  }

  async getContacts(userId?: string): Promise<Contact[]> {
    if (!this.isConfigured || !this.client) return db.contacts;
    try {
      const resolvedUser = await this.resolveUserId(userId);
      if (!resolvedUser) return db.contacts;
      const { data, error } = await this.client.from('contacts').select('*').eq('user_id', resolvedUser).order('created_at', { ascending: false });
      if (error) {
        console.warn(`[SupabaseService] getContacts fallback:`, error.message);
        return db.contacts;
      }
      return (data || []).map((r: any) => ({
        id: r.id, email: r.email, firstName: r.first_name, lastName: r.last_name, company: r.company,
        tags: r.tags || [], status: r.status, bounceReason: r.bounce_reason, createdAt: r.created_at, updatedAt: r.updated_at,
      }));
    } catch (err: any) {
      console.warn(`[SupabaseService] getContacts exception fallback:`, err?.message);
      return db.contacts;
    }
  }

  async getSuppressions(userId?: string): Promise<SuppressionItem[]> {
    if (!this.isConfigured || !this.client) return db.suppressions;
    try {
      const resolvedUser = await this.resolveUserId(userId);
      if (!resolvedUser) return [];
      const { data, error } = await this.client.from('suppressions').select('*').eq('user_id', resolvedUser).order('created_at', { ascending: false });
      if (error) {
        console.warn(`[SupabaseService] getSuppressions fallback:`, error.message);
        return db.suppressions;
      }
      return (data || []).map((r: any) => ({
        id: r.id, email: r.email, type: r.type, reason: r.reason, source: r.source, createdAt: r.created_at,
      }));
    } catch (err: any) {
      console.warn(`[SupabaseService] getSuppressions exception fallback:`, err?.message);
      return db.suppressions;
    }
  }

  async getLogs(userId?: string, limit = 100) {
    if (!this.isConfigured || !this.client) return db.logs.slice(0, limit);
    try {
      const resolvedUser = await this.resolveUserId(userId);
      if (!resolvedUser) return db.logs.slice(0, limit);
      const { data, error } = await this.client.from('technical_logs').select('*').eq('user_id', resolvedUser).order('timestamp', { ascending: false }).limit(limit);
      if (error) {
        console.warn(`[SupabaseService] getLogs fallback:`, error.message);
        return db.logs.slice(0, limit);
      }
      return (data || []).map((r: any) => ({
        id: r.id, timestamp: r.timestamp, service: r.service, messageId: r.message_id, event: r.event,
        severity: r.severity, response: r.response, details: r.details || undefined,
      }));
    } catch (err: any) {
      console.warn(`[SupabaseService] getLogs exception fallback:`, err?.message);
      return db.logs.slice(0, limit);
    }
  }

  async getSettings(userId?: string) {
    if (!this.isConfigured || !this.client) return db.settings;
    try {
      const resolvedUser = await this.resolveUserId(userId);
      if (!resolvedUser) return db.settings;
      const { data, error } = await this.client.from('settings').select('category,values').eq('user_id', resolvedUser);
      if (error) {
        console.warn(`[SupabaseService] settings query fallback to db.settings:`, error.message);
        return db.settings;
      }
      const remote = Object.fromEntries((data || []).map((r: any) => [r.category, r.values]));
      return { ...db.settings, ...remote };
    } catch (e: any) {
      console.warn(`[SupabaseService] getSettings fallback:`, e?.message);
      return db.settings;
    }
  }

  async upsertSettings(userId: string, category: string, values: any) {
    // Always persist to local in-memory store so configuration is instantly active
    db.settings[category] = { ...(db.settings[category] || {}), ...values };

    const resolvedUser = await this.resolveUserId(userId);
    if (!this.isConfigured || !this.client || !resolvedUser) {
      return db.settings;
    }
    try {
      const { error } = await this.client.from('settings').upsert(
        { user_id: resolvedUser, category, values, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,category' }
      );
      if (error) {
        console.warn(`[SupabaseService] Table public.settings not available, using local store:`, error.message);
      }
    } catch (err: any) {
      console.warn(`[SupabaseService] Supabase settings save skipped (using local store):`, err?.message);
    }
    return db.settings;
  }

  async getApiKeys(userId?: string): Promise<ApiKey[]> {
    if (!this.isConfigured || !this.client) return db.apiKeys;
    try {
      const resolvedUser = await this.resolveUserId(userId);
      if (!resolvedUser) return db.apiKeys;
      const { data, error } = await this.client.from('api_keys').select('id,name,key_prefix,last_used_at,created_at').eq('user_id', resolvedUser).order('created_at', { ascending: false });
      if (error) {
        console.warn(`[SupabaseService] api_keys query fallback:`, error.message);
        return db.apiKeys;
      }
      return (data || []).map((r: any) => ({
        id: r.id, name: r.name, keyPrefix: r.key_prefix, lastUsedAt: r.last_used_at || undefined, createdAt: r.created_at,
      }));
    } catch (err: any) {
      console.warn(`[SupabaseService] getApiKeys fallback:`, err?.message);
      return db.apiKeys;
    }
  }

  async createApiKey(userId: string, name: string, keyPrefix: string, keyHash: string) {
    const fallback = { id: `key_${Date.now()}`, name, keyPrefix, createdAt: new Date().toISOString() };
    const resolvedUser = await this.resolveUserId(userId);
    if (!this.isConfigured || !this.client || !resolvedUser) {
      db.apiKeys.unshift(fallback);
      return fallback;
    }
    try {
      const { data, error } = await this.client.from('api_keys').insert({ user_id: resolvedUser, name, key_prefix: keyPrefix, key_hash: keyHash }).select('id,name,key_prefix,last_used_at,created_at').single();
      if (error) {
        console.warn(`[SupabaseService] createApiKey fallback to local:`, error.message);
        db.apiKeys.unshift(fallback);
        return fallback;
      }
      return { id: data.id, name: data.name, keyPrefix: data.key_prefix, lastUsedAt: data.last_used_at || undefined, createdAt: data.created_at };
    } catch (err: any) {
      db.apiKeys.unshift(fallback);
      return fallback;
    }
  }

  async revokeApiKey(userId: string, id: string) {
    const i = db.apiKeys.findIndex(k => k.id === id);
    if (i >= 0) db.apiKeys.splice(i, 1);

    const resolvedUser = await this.resolveUserId(userId);
    if (!this.isConfigured || !this.client || !resolvedUser) return;
    try {
      const { error } = await this.client.from('api_keys').delete().eq('id', id).eq('user_id', resolvedUser);
      if (error) console.warn(`[SupabaseService] revokeApiKey fallback:`, error.message);
    } catch (err: any) {
      console.warn(`[SupabaseService] revokeApiKey fallback:`, err?.message);
    }
  }

  async saveUnsubscribeToken(record: UnsubscribeToken) {
    if (!this.isConfigured || !this.client) return;
    try {
      const resolvedUser = record.userId ? await this.resolveUserId(record.userId) : null;
      const { error } = await this.client.from('unsubscribe_tokens').upsert({
        token: record.token, email: record.email, contact_id: record.contactId || null,
        message_id: record.messageId || null, campaign_id: record.campaignId || null,
        user_id: resolvedUser, created_at: record.createdAt || new Date().toISOString(),
        unsubscribed_at: record.unsubscribedAt || null,
      }, { onConflict: 'token' });
      if (error) {
        console.warn(`[SupabaseService] saveUnsubscribeToken warning: ${error.message}`);
      }
    } catch (err: any) {
      console.warn(`[SupabaseService] saveUnsubscribeToken caught: ${err?.message || err}`);
    }
  }

  async getUnsubscribeToken(token: string): Promise<UnsubscribeToken | null> {
    if (!this.isConfigured || !this.client) return null;
    try {
      const { data, error } = await this.client.from('unsubscribe_tokens').select('*').eq('token', token).maybeSingle();
      if (error || !data) return null;
      return { token: data.token, email: data.email, contactId: data.contact_id || undefined, messageId: data.message_id || undefined, campaignId: data.campaign_id || undefined, userId: data.user_id || undefined, createdAt: data.created_at, unsubscribedAt: data.unsubscribed_at || undefined };
    } catch {
      return null;
    }
  }

  async markContactUnsubscribed(email: string, userId?: string) {
    const resolvedUser = await this.resolveUserId(userId);
    if (!this.isConfigured || !this.client || !resolvedUser) return;
    const { error } = await this.client.from('contacts').update({ status: 'UNSUBSCRIBED', updated_at: new Date().toISOString() }).eq('user_id', resolvedUser).ilike('email', email.trim().toLowerCase());
    if (error) throw new Error(`Contact unsubscribe update failed: ${error.message}`);
  }

  async addSuppression(input: { email: string; type: SuppressionType; reason: string; source?: string; userId?: string }) {
    const resolvedUser = await this.resolveUserId(input.userId);
    if (!resolvedUser) return;
    await this.upsertSuppression(resolvedUser, input.email, input.type, input.reason, input.source || 'unsubscribe');
  }
}

export const supabaseService = new SupabaseService();
