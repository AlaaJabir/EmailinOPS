import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db } from '../store.js';
import { Message, MessageEvent, Sender, Campaign, Contact, SuppressionItem, TechnicalLog } from '../../src/types.js';

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
    this.serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      '';

    this.isConfigured = Boolean(
      this.url &&
      this.serviceKey &&
      !this.url.includes('placeholder') &&
      this.url.startsWith('https://')
    );

    if (this.isConfigured) {
      try {
        this.client = createClient(this.url, this.serviceKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
      } catch (err) {
        console.warn('[SupabaseService] Client initialization warning:', err);
        this.client = null;
        this.isConfigured = false;
      }
    }
  }

  public getClient(): SupabaseClient | null {
    return this.client;
  }

  /**
   * Verify JWT bearer token and retrieve authenticated user
   */
  async verifyToken(token: string): Promise<AuthenticatedUser | null> {
    if (!token || typeof token !== 'string') return null;

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    if (!cleanToken) return null;

    // If Supabase is configured, verify with Supabase Auth
    if (this.isConfigured && this.client) {
      try {
        const { data, error } = await this.client.auth.getUser(cleanToken);
        if (error || !data.user) {
          return null;
        }

        const su = data.user;
        const meta = su.user_metadata || {};
        
        // Fetch profile to get real role and plan
        let profileRole: 'ADMIN' | 'OPERATOR' | 'VIEWER' = (meta.role as any) || 'ADMIN';
        let profileName = meta.full_name || meta.name || su.email?.split('@')[0] || 'Operator';
        let profilePlan = meta.plan || 'PRO';

        try {
          const { data: profile } = await this.client
            .from('profiles')
            .select('*')
            .eq('id', su.id)
            .maybeSingle();

          if (profile) {
            profileRole = profile.role || profileRole;
            profileName = profile.full_name || profileName;
            profilePlan = profile.plan || profilePlan;
          } else {
            // Self-heal: insert profile if trigger didn't fire
            await this.client.from('profiles').insert({
              id: su.id,
              email: su.email || '',
              full_name: profileName,
              role: profileRole,
              plan: profilePlan,
            }).maybeSingle();
          }
        } catch {
          // Non-blocking fallback
        }

        return {
          id: su.id,
          email: su.email || '',
          name: profileName,
          role: profileRole,
          plan: profilePlan,
        };
      } catch (err) {
        console.error('[SupabaseService] Token verification error:', err);
        return null;
      }
    }

    // Fallback in local/test environment when Supabase env vars are empty
    // Allows mock token for automated unit tests: 'test-token-<userId>' or 'test-admin-token'
    if (cleanToken.startsWith('test-') || cleanToken === 'mock-jwt-token') {
      const userId = cleanToken.includes('usr_')
        ? cleanToken.replace(/^test-token-/, '')
        : 'usr_admin_01';
      const existingUser = db.users.find((u) => u.id === userId) || db.users[0];
      return {
        id: existingUser?.id || 'usr_admin_01',
        email: existingUser?.email || 'admin@emailops.io',
        name: existingUser?.name || 'Alex Vance (Lead Email Architect)',
        role: (existingUser?.role as any) || 'ADMIN',
        plan: 'PRO',
      };
    }

    return null;
  }

  /**
   * Check if an SNS or Webhook event was already processed (Idempotency)
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    if (!eventId) return false;

    // 1. Fast in-memory check
    if (db.hasProcessedEvent(eventId)) {
      return true;
    }

    // 2. Database check
    if (this.isConfigured && this.client) {
      try {
        const { data, error } = await this.client
          .from('processed_webhook_events')
          .select('event_id')
          .eq('event_id', eventId)
          .maybeSingle();

        if (!error && data) {
          db.recordProcessedEvent(eventId);
          return true;
        }
      } catch (err) {
        console.warn('[SupabaseService] isEventProcessed query failed:', err);
      }
    }

    return false;
  }

  /**
   * Record processed SNS/Webhook event for idempotency
   */
  async recordProcessedEvent(eventId: string, provider = 'SES_SNS'): Promise<void> {
    if (!eventId) return;

    db.recordProcessedEvent(eventId);

    if (this.isConfigured && this.client) {
      try {
        await this.client.from('processed_webhook_events').insert({
          event_id: eventId,
          provider,
        });
      } catch (err) {
        // Non-blocking if already exists
      }
    }
  }

  /**
   * Save a newly submitted message with user_id ownership
   */
  async saveMessage(message: Message, userId: string): Promise<void> {
    // 1. Always keep in-memory store in sync for fast local queries & fallbacks
    const existingIdx = db.messages.findIndex((m) => m.id === message.id || m.messageId === message.messageId);
    if (existingIdx >= 0) {
      db.messages[existingIdx] = message;
    } else {
      db.messages.unshift(message);
    }

    // 2. Persist to real Supabase database if configured
    if (this.isConfigured && this.client) {
      try {
        const { error } = await this.client.from('messages').insert({
          user_id: userId,
          internal_id: message.id,
          message_id: message.messageId,
          ses_message_id: message.sesMessageId || null,
          campaign_id: message.campaignId || null,
          sender_id: message.senderId || null,
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
        });

        if (error) {
          console.error('[SupabaseService] Error saving message to Supabase:', error.message);
        }
      } catch (err) {
        console.error('[SupabaseService] Exception saving message to Supabase:', err);
      }
    }
  }

  /**
   * Update message status and metadata (e.g. from SES webhook)
   */
  async updateMessageStatus(params: {
    messageId: string;
    status: Message['status'];
    sesMessageId?: string;
    deliveredAt?: string;
    bouncedAt?: string;
    bounceType?: string;
    bounceReason?: string;
    smtpResponse?: string;
  }): Promise<void> {
    const { messageId, status, sesMessageId, deliveredAt, bouncedAt, bounceType, bounceReason, smtpResponse } = params;

    // Update in-memory
    const msg = db.messages.find((m) => m.messageId === messageId || m.id === messageId || m.sesMessageId === messageId);
    if (msg) {
      msg.status = status;
      if (sesMessageId && !msg.sesMessageId) msg.sesMessageId = sesMessageId;
      if (deliveredAt) msg.deliveredAt = deliveredAt;
      if (bouncedAt) msg.bouncedAt = bouncedAt;
      if (bounceType) msg.bounceType = bounceType;
      if (bounceReason) msg.bounceReason = bounceReason;
      if (smtpResponse) msg.smtpResponse = smtpResponse;
    }

    // Update in Supabase
    if (this.isConfigured && this.client) {
      try {
        const updatePayload: Record<string, any> = {
          status,
          updated_at: new Date().toISOString(),
        };
        if (sesMessageId) updatePayload.ses_message_id = sesMessageId;
        if (deliveredAt) updatePayload.delivered_at = deliveredAt;
        if (bouncedAt) updatePayload.bounced_at = bouncedAt;
        if (bounceType) updatePayload.bounce_type = bounceType;
        if (bounceReason) updatePayload.bounce_reason = bounceReason;
        if (smtpResponse) updatePayload.smtp_response = smtpResponse;

        await this.client
          .from('messages')
          .update(updatePayload)
          .or(`message_id.eq.${messageId},internal_id.eq.${messageId},ses_message_id.eq.${messageId}`);
      } catch (err) {
        console.error('[SupabaseService] Exception updating message status in Supabase:', err);
      }
    }
  }

  /**
   * Save a lifecycle event (QUEUED, DELIVERED, BOUNCED, etc.)
   */
  async saveMessageEvent(event: MessageEvent, userId?: string): Promise<void> {
    db.messageEvents.push(event);

    if (this.isConfigured && this.client) {
      try {
        await this.client.from('message_events').insert({
          message_id: event.messageId,
          user_id: userId || null,
          event_type: event.eventType,
          event_data: event.eventData || null,
          ip_address: event.ipAddress || null,
          user_agent: event.userAgent || null,
          geo: event.geo || null,
          timestamp: event.timestamp || new Date().toISOString(),
        });
      } catch (err) {
        console.error('[SupabaseService] Exception saving event in Supabase:', err);
      }
    }
  }

  /**
   * Save technical log
   */
  async saveTechnicalLog(log: TechnicalLog, userId?: string): Promise<void> {
    db.logs.unshift(log);

    if (this.isConfigured && this.client) {
      try {
        await this.client.from('technical_logs').insert({
          user_id: userId || null,
          service: log.service,
          message_id: log.messageId || null,
          event: log.event,
          severity: log.severity,
          response: log.response,
          details: log.details || null,
          timestamp: log.timestamp || new Date().toISOString(),
        });
      } catch (err) {
        // Non-blocking log persistence
      }
    }
  }

  /**
   * Fetch messages for authenticated user
   */
  async getMessages(userId: string, limit = 100): Promise<Message[]> {
    if (this.isConfigured && this.client) {
      try {
        const { data, error } = await this.client
          .from('messages')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!error && data) {
          return data.map((row: any) => ({
            id: row.internal_id || row.id,
            messageId: row.message_id,
            sesMessageId: row.ses_message_id,
            campaignId: row.campaign_id,
            senderId: row.sender_id,
            fromName: row.from_name,
            fromEmail: row.from_email,
            toEmail: row.to_email,
            replyTo: row.reply_to,
            cc: row.cc || [],
            bcc: row.bcc || [],
            subject: row.subject,
            htmlBody: row.html_body,
            plainText: row.plain_text,
            customHeaders: row.custom_headers,
            status: row.status,
            provider: row.provider,
            providerMessageId: row.provider_message_id,
            smtpResponse: row.smtp_response,
            bounceType: row.bounce_type,
            bounceReason: row.bounce_reason,
            queuedAt: row.queued_at,
            sentAt: row.sent_at,
            deliveredAt: row.delivered_at,
            bouncedAt: row.bounced_at,
            createdAt: row.created_at,
          }));
        }
      } catch (err) {
        console.error('[SupabaseService] Error querying messages from Supabase:', err);
      }
    }

    // Fallback: return in-memory messages
    return db.messages.slice(0, limit);
  }

  /**
   * Fetch user senders
   */
  async getSenders(userId: string): Promise<Sender[]> {
    if (this.isConfigured && this.client) {
      try {
        const { data, error } = await this.client
          .from('senders')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((row: any) => ({
            id: row.id,
            name: row.name,
            fromEmail: row.from_email,
            replyTo: row.reply_to,
            domainId: row.domain_id,
            status: row.status,
            verification: row.verification,
            dailyLimit: row.daily_limit,
            hourlyLimit: row.hourly_limit,
            sentCount: row.sent_count,
            deliveredCount: row.delivered_count,
            bouncedCount: row.bounced_count,
            complaintCount: row.complaint_count,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
        }
      } catch (err) {
        console.error('[SupabaseService] Error querying senders:', err);
      }
    }

    return db.senders;
  }

  /**
   * Fetch user campaigns
   */
  async getCampaigns(userId: string): Promise<Campaign[]> {
    if (this.isConfigured && this.client) {
      try {
        const { data, error } = await this.client
          .from('campaigns')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((row: any) => ({
            id: row.id,
            name: row.name,
            senderId: row.sender_id,
            listId: row.list_id,
            subject: row.subject,
            htmlBody: row.html_body,
            plainText: row.plain_text,
            status: row.status,
            scheduledAt: row.scheduled_at,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            totalRecipients: row.total_recipients,
            sentCount: row.sent_count,
            deliveredCount: row.delivered_count,
            bouncedCount: row.bounced_count,
            complaintCount: row.complaint_count,
            openCount: row.open_count,
            clickCount: row.click_count,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
        }
      } catch (err) {
        console.error('[SupabaseService] Error querying campaigns:', err);
      }
    }

    return db.campaigns;
  }

  /**
   * Fetch user contacts
   */
  async getContacts(userId: string): Promise<Contact[]> {
    if (this.isConfigured && this.client) {
      try {
        const { data, error } = await this.client
          .from('contacts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((row: any) => ({
            id: row.id,
            email: row.email,
            firstName: row.first_name,
            lastName: row.last_name,
            company: row.company,
            tags: row.tags || [],
            status: row.status,
            bounceReason: row.bounce_reason,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
        }
      } catch (err) {
        console.error('[SupabaseService] Error querying contacts:', err);
      }
    }

    return db.contacts;
  }

  /**
   * Fetch suppressions
   */
  async getSuppressions(userId?: string): Promise<SuppressionItem[]> {
    if (this.isConfigured && this.client && userId) {
      try {
        const { data, error } = await this.client
          .from('suppressions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((row: any) => ({
            id: row.id,
            email: row.email,
            type: row.type,
            reason: row.reason,
            source: row.source,
            createdAt: row.created_at,
          }));
        }
      } catch (err) {
        console.error('[SupabaseService] Error querying suppressions:', err);
      }
    }

    return db.suppressions;
  }
}

export const supabaseService = new SupabaseService();
