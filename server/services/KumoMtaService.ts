import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { db } from '../store.js';
import { Message, MessageEvent, MessageStatus } from '../../src/types.js';
import { supabaseService } from './SupabaseService.js';
import { suppressionService } from './SuppressionService.js';

export interface SendEmailPayload {
  internalId?: string;
  rfcMessageId?: string;
  contactId?: string;
  fromName?: string;
  fromEmail: string;
  replyTo?: string;
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlBody?: string;
  plainText?: string;
  customHeaders?: Record<string, string>;
  campaignId?: string;
  attachments?: Array<{ filename: string; fileSize: number; mimeType: string; content?: string | Buffer }>;
  isTest?: boolean;
  userId?: string;
}

export interface KumoSubmissionResult {
  success: boolean;
  messageId: string;
  rfcMessageId: string;
  kumoResponse: string;
  provider: string;
  status: MessageStatus;
  smtpResponse?: string;
  accepted?: string[];
  rejected?: string[];
  latencyMs?: number;
  bounceReason?: string;
}

export interface KumoMtaConfig {
  host: string;
  port: number;
  secure: boolean;
  username?: string;
  password?: string;
  apiUrl?: string;
  fromEmail?: string;
  fromName?: string;
}

export class KumoMtaService {
  private config: KumoMtaConfig;
  private transporter: Transporter | null = null;
  private customTransporter: Transporter | null = null;

  constructor(customConfig?: Partial<KumoMtaConfig>) {
    this.config = {
      host: customConfig?.host ?? process.env.KUMO_SMTP_HOST ?? process.env.KUMOMTA_HOST ?? '127.0.0.1',
      port: customConfig?.port ?? (Number(process.env.KUMO_SMTP_PORT ?? process.env.KUMOMTA_PORT) || 2525),
      secure: customConfig?.secure ?? (process.env.KUMO_SMTP_SECURE === 'true' || Number(process.env.KUMO_SMTP_PORT ?? process.env.KUMOMTA_PORT) === 465),
      username: customConfig?.username ?? process.env.KUMO_SMTP_USER ?? process.env.KUMOMTA_USERNAME ?? undefined,
      password: customConfig?.password ?? process.env.KUMO_SMTP_PASSWORD ?? process.env.KUMOMTA_PASSWORD ?? undefined,
      apiUrl: customConfig?.apiUrl ?? process.env.KUMOMTA_API_URL ?? 'http://127.0.0.1:8000',
      fromEmail: customConfig?.fromEmail ?? process.env.KUMO_FROM_EMAIL,
      fromName: customConfig?.fromName ?? process.env.KUMO_FROM_NAME,
    };
  }

  public updateConfig(newConfig?: Partial<KumoMtaConfig>): void {
    this.config = {
      host: newConfig?.host ?? process.env.KUMO_SMTP_HOST ?? process.env.KUMOMTA_HOST ?? '127.0.0.1',
      port: newConfig?.port ?? (Number(process.env.KUMO_SMTP_PORT ?? process.env.KUMOMTA_PORT) || 2525),
      secure: newConfig?.secure ?? (process.env.KUMO_SMTP_SECURE === 'true' || Number(process.env.KUMO_SMTP_PORT ?? process.env.KUMOMTA_PORT) === 465),
      username: newConfig?.username ?? process.env.KUMO_SMTP_USER ?? process.env.KUMOMTA_USERNAME ?? undefined,
      password: newConfig?.password ?? process.env.KUMO_SMTP_PASSWORD ?? process.env.KUMOMTA_PASSWORD ?? undefined,
      apiUrl: newConfig?.apiUrl ?? process.env.KUMOMTA_API_URL ?? 'http://127.0.0.1:8000',
      fromEmail: newConfig?.fromEmail ?? process.env.KUMO_FROM_EMAIL,
      fromName: newConfig?.fromName ?? process.env.KUMO_FROM_NAME,
    };
    this.transporter = null;
  }

  public validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!this.config.host?.trim()) errors.push('KumoMTA host is required.');
    if (!Number.isInteger(this.config.port) || this.config.port < 1 || this.config.port > 65535) errors.push('KumoMTA port must be between 1 and 65535.');
    if (this.config.secure && this.config.port !== 465) errors.push('Secure SMTP must use port 465.');
    return { valid: errors.length === 0, errors };
  }

  public isConfigured(): boolean { return Boolean(this.config.host?.trim()); }

  public getConfigSanitized() {
    return {
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      hasAuth: Boolean(this.config.username && this.config.password),
      username: this.config.username,
      apiUrl: this.config.apiUrl,
      isConfigured: this.isConfigured(),
    };
  }

  public setTransporter(transporter: Transporter | null): void { this.customTransporter = transporter; }

  public getTransporter(): Transporter {
    if (this.customTransporter) return this.customTransporter;
    if (!this.transporter) {
      const validation = this.validateConfig();
      if (!validation.valid) throw new Error(`KumoMTA configuration error: ${validation.errors.join(' ')}`);
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.username && this.config.password ? { user: this.config.username, pass: this.config.password } : undefined,
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
        tls: { rejectUnauthorized: process.env.KUMO_TLS_REJECT_UNAUTHORIZED !== 'false' },
      });
    }
    return this.transporter;
  }

  private logEvent(event: string, severity: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS', response: string, details?: Record<string, any>, messageId?: string): void {
    const timestamp = new Date().toISOString();
    const cleanDetails = details ? { ...details } : {};
    delete cleanDetails.password;
    delete cleanDetails.pass;
    delete cleanDetails.auth;
    console.log(`[KumoMTA ${severity}] ${timestamp} ${event}: ${response}`, cleanDetails);
    db.logs.unshift({ id: `log_kumo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, timestamp, service: 'KumoMTA', messageId, event, severity, response, details: cleanDetails });
  }

  async checkHealth(): Promise<any> {
    const start = Date.now();
    const sanitized = this.getConfigSanitized();
    const verifiedAt = new Date().toISOString();
    if (!this.isConfigured()) return { status: 'offline', configured: false, latencyMs: 0, error: 'KumoMTA is not configured.', details: { ...sanitized, verifiedAt } };
    try {
      await this.getTransporter().verify();
      return { status: 'healthy', configured: true, latencyMs: Date.now() - start, details: { ...sanitized, verifiedAt } };
    } catch (err: any) {
      const error = err?.message || 'Failed to connect to KumoMTA SMTP service';
      this.logEvent('HEALTH_CHECK_FAILED', 'WARN', error, { host: sanitized.host, port: sanitized.port, error });
      return { status: 'offline', configured: true, latencyMs: Date.now() - start, error, details: { ...sanitized, verifiedAt } };
    }
  }

  public generateRfcMessageId(domain: string): string {
    const cleanDomain = domain?.replace(/^@/, '').trim() || 'kumo.internal';
    return `<kumo.${Date.now()}.${Math.random().toString(36).slice(2, 10)}@${cleanDomain}>`;
  }

  private async persistMessage(message: Message, event: MessageEvent, userId?: string): Promise<void> {
    const index = db.messages.findIndex((m) => m.id === message.id);
    if (index >= 0) db.messages[index] = message; else db.messages.unshift(message);
    db.messageEvents.push(event);
    if (userId && supabaseService.isConfigured) {
      await Promise.allSettled([
        supabaseService.saveMessage(message, userId),
        supabaseService.saveMessageEvent(event, userId),
      ]);
    }
  }

  async submitEmail(payload: SendEmailPayload): Promise<KumoSubmissionResult> {
    const start = Date.now();
    const primaryTo = (Array.isArray(payload.to) ? payload.to[0] : payload.to || '').trim();
    if (!primaryTo) throw new Error('Recipient is required.');

    const internalId = payload.internalId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const fromDomain = payload.fromEmail.includes('@') ? payload.fromEmail.split('@')[1] : 'kumo.internal';
    const rfcMessageId = payload.rfcMessageId || this.generateRfcMessageId(fromDomain);
    const toEmail = primaryTo.toLowerCase();
    const nowIso = new Date().toISOString();

    const sender = db.senders.find((s) => s.fromEmail.toLowerCase() === payload.fromEmail.toLowerCase());
    const senderId = sender?.id || 'snd_default';
    const senderDisplayName = payload.fromName || sender?.name;

    const suppression = suppressionService.isSuppressed(toEmail);
    if (suppression.suppressed && suppression.record) {
      const reason = `Suppressed recipient (${suppression.record.reason}): ${toEmail}`;
      const event: MessageEvent = { id: `evt_supp_${Date.now()}`, messageId: rfcMessageId, eventType: 'REJECTED', eventData: { reason }, timestamp: nowIso };
      const message: Message = {
        id: internalId, messageId: rfcMessageId, senderId, campaignId: payload.campaignId,
        fromEmail: payload.fromEmail, fromName: senderDisplayName, toEmail: primaryTo,
        replyTo: payload.replyTo, subject: payload.subject, htmlBody: payload.htmlBody, plainText: payload.plainText,
        customHeaders: payload.customHeaders, status: 'REJECTED', provider: 'KumoMTA', bounceReason: reason,
        smtpResponse: `554 5.7.1 ${reason}`, queuedAt: nowIso, createdAt: nowIso, events: [event],
      };
      await this.persistMessage(message, event, payload.userId);
      this.logEvent('SUBMISSION_REJECTED', 'WARN', reason, { internalId, rfcMessageId, to: toEmail }, rfcMessageId);
      return { success: false, messageId: internalId, rfcMessageId, kumoResponse: reason, provider: 'KumoMTA', status: 'REJECTED', smtpResponse: message.smtpResponse, accepted: [], rejected: [primaryTo], latencyMs: Date.now() - start, bounceReason: reason };
    }

    const headers: Record<string, string> = {
      'X-KumoMTA-Message-ID': rfcMessageId,
      'X-KumoMTA-Queue': payload.campaignId ? `campaign_${payload.campaignId}` : 'transactional',
      'X-Mailer': 'EmailOps-KumoMTA/2.0',
      'X-Entity-Ref-ID': internalId,
      ...(payload.customHeaders || {}),
    };
    if (!headers['Feedback-ID']) headers['Feedback-ID'] = `${payload.campaignId || 'direct'}:${internalId}:${fromDomain}:KumoMTA`;
    if (!headers['List-Unsubscribe']) {
      const unsubscribeUrl = `https://${fromDomain}/unsubscribe?id=${internalId}`;
      headers['List-Unsubscribe'] = `<${unsubscribeUrl}>, <mailto:unsubscribe@${fromDomain}?subject=unsubscribe_${internalId}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    const plainText = payload.plainText?.trim() || (payload.htmlBody || '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    this.logEvent('SUBMISSION_INITIATED', 'INFO', `Submitting email to KumoMTA (${this.config.host}:${this.config.port})`, { internalId, rfcMessageId, from: payload.fromEmail, to: toEmail, subject: payload.subject, campaignId: payload.campaignId, isTest: payload.isTest }, rfcMessageId);

    try {
      // KumoMTA is the single delivery path. Amazon SES credentials/configuration are intentionally not read here.
      const info = await this.getTransporter().sendMail({
        from: senderDisplayName ? `"${senderDisplayName.replace(/"/g, '')}" <${payload.fromEmail}>` : payload.fromEmail,
        to: payload.to,
        cc: payload.cc,
        bcc: payload.bcc,
        replyTo: payload.replyTo || sender?.replyTo,
        subject: payload.subject,
        text: plainText,
        html: payload.htmlBody,
        messageId: rfcMessageId,
        headers,
        attachments: payload.attachments?.map((a) => ({ filename: a.filename, content: a.content || Buffer.from(''), contentType: a.mimeType })),
      });

      const latencyMs = Date.now() - start;
      const smtpResponse = info.response || '250 2.0.0 OK: Message accepted by KumoMTA';
      const event: MessageEvent = {
        id: `evt_kumo_${Date.now()}`,
        messageId: rfcMessageId,
        eventType: 'QUEUED',
        eventData: { kumoHost: this.config.host, kumoPort: this.config.port, smtpResponse, latencyMs, accepted: info.accepted, rejected: info.rejected },
        timestamp: nowIso,
      };
      const message: Message = {
        id: internalId, messageId: rfcMessageId, campaignId: payload.campaignId,
        campaignName: payload.campaignId ? db.campaigns.find((c) => c.id === payload.campaignId)?.name : undefined,
        senderId, fromName: senderDisplayName, fromEmail: payload.fromEmail, toEmail: primaryTo,
        replyTo: payload.replyTo || sender?.replyTo, cc: payload.cc, bcc: payload.bcc,
        subject: payload.subject, htmlBody: payload.htmlBody, plainText, customHeaders: headers,
        status: 'QUEUED', provider: 'KumoMTA', providerMessageId: info.messageId || rfcMessageId,
        smtpResponse, queuedAt: nowIso, sentAt: nowIso, createdAt: nowIso,
        attachments: payload.attachments?.map((a, i) => ({ id: `att_${Date.now()}_${i}`, filename: a.filename, fileSize: a.fileSize, mimeType: a.mimeType })),
        events: [event],
      };
      await this.persistMessage(message, event, payload.userId);
      if (sender) sender.sentCount += 1;
      this.logEvent('SUBMISSION_ACCEPTED', 'SUCCESS', `KumoMTA accepted message in ${latencyMs}ms: ${smtpResponse}`, { internalId, rfcMessageId, kumoHost: this.config.host, kumoPort: this.config.port, latencyMs, accepted: info.accepted, rejected: info.rejected }, rfcMessageId);
      return { success: true, messageId: internalId, rfcMessageId, kumoResponse: smtpResponse, provider: 'KumoMTA', status: 'QUEUED', smtpResponse, accepted: (info.accepted as string[]) || [primaryTo], rejected: (info.rejected as string[]) || [], latencyMs };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const errorMsg = err?.message || 'KumoMTA SMTP connection error';
      const smtpCode = err?.responseCode || err?.code || 'UNKNOWN';
      const event: MessageEvent = { id: `evt_kumo_fail_${Date.now()}`, messageId: rfcMessageId, eventType: 'FAILED', eventData: { error: errorMsg, code: smtpCode, latencyMs }, timestamp: nowIso };
      const failed: Message = {
        id: internalId, messageId: rfcMessageId, campaignId: payload.campaignId, senderId,
        fromName: senderDisplayName, fromEmail: payload.fromEmail, toEmail: primaryTo, replyTo: payload.replyTo,
        subject: payload.subject, htmlBody: payload.htmlBody, plainText, customHeaders: headers,
        status: 'FAILED', provider: 'KumoMTA', smtpResponse: errorMsg, bounceReason: errorMsg,
        queuedAt: nowIso, createdAt: nowIso, events: [event],
      };
      await this.persistMessage(failed, event, payload.userId);
      this.logEvent('SUBMISSION_FAILED', 'ERROR', `KumoMTA submission failed (${this.config.host}:${this.config.port}): ${errorMsg}`, { internalId, rfcMessageId, to: toEmail, smtpCode, latencyMs }, rfcMessageId);
      throw new Error(`KumoMTA submission failed: ${errorMsg}`);
    }
  }
}

export const kumoMtaService = new KumoMtaService();
