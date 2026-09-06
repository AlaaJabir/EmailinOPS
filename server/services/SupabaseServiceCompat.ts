import { SupabaseService, supabaseService } from './SupabaseService.js';
import { SuppressionType } from '../../src/types.js';
import { UnsubscribeToken } from '../store.js';

declare module './SupabaseService.js' {
  interface SupabaseService {
    saveUnsubscribeToken(record: UnsubscribeToken): Promise<void>;
    getUnsubscribeToken(token: string): Promise<UnsubscribeToken | null>;
    markContactUnsubscribed(email: string, userId?: string): Promise<void>;
    addSuppression(input: { email: string; type: SuppressionType; reason: string; source?: string; userId?: string }): Promise<void>;
  }
}

SupabaseService.prototype.saveUnsubscribeToken = async function (record: UnsubscribeToken): Promise<void> {
  if (!this.isConfigured || !this.getClient()) return;
  const { error } = await this.getClient()!.from('unsubscribe_tokens').upsert({
    token: record.token,
    email: record.email.trim().toLowerCase(),
    contact_id: record.contactId || null,
    message_id: record.messageId || null,
    campaign_id: record.campaignId || null,
    user_id: record.userId || null,
    created_at: record.createdAt || new Date().toISOString(),
    unsubscribed_at: record.unsubscribedAt || null,
  }, { onConflict: 'token' });
  if (error) throw new Error(`Supabase unsubscribe token save failed: ${error.message}`);
};

SupabaseService.prototype.getUnsubscribeToken = async function (token: string): Promise<UnsubscribeToken | null> {
  if (!this.isConfigured || !this.getClient()) return null;
  const { data, error } = await this.getClient()!.from('unsubscribe_tokens').select('*').eq('token', token).maybeSingle();
  if (error || !data) return null;
  return {
    token: data.token,
    email: data.email,
    contactId: data.contact_id || undefined,
    messageId: data.message_id || undefined,
    campaignId: data.campaign_id || undefined,
    userId: data.user_id || undefined,
    createdAt: data.created_at,
    unsubscribedAt: data.unsubscribed_at || undefined,
  };
};

SupabaseService.prototype.markContactUnsubscribed = async function (email: string, userId?: string): Promise<void> {
  if (!this.isConfigured || !this.getClient() || !userId) return;
  const { error } = await this.getClient()!.from('contacts')
    .update({ status: 'UNSUBSCRIBED', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .ilike('email', email.trim().toLowerCase());
  if (error) throw new Error(`Contact unsubscribe update failed: ${error.message}`);
};

SupabaseService.prototype.addSuppression = async function (input: { email: string; type: SuppressionType; reason: string; source?: string; userId?: string }): Promise<void> {
  if (!input.userId) return;
  await this.upsertSuppression(input.userId, input.email, input.type, input.reason, input.source || 'unsubscribe');
};

export { supabaseService };
