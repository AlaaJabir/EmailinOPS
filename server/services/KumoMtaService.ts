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
      host: customConfig?.host !== undefined ? customConfig.host : (process.env.KUMO_SMTP_HOST || process.env.KUMOMTA_HOST || '127.0.0.1'),
      port: customConfig?.port !== undefined ? customConfig.port : (Number(process.env.KUMO_SMTP_PORT || process.env.KUMOMTA_PORT) || 2525),
      secure: customConfig?.secure !== undefined ? customConfig.secure : (process.env.KUMO_SMTP_SECURE === 'true' || Number(process.env.KUMO_SMTP_PORT || process.env.KUMOMTA_PORT) === 465),
      username: customConfig?.username !== undefined ? customConfig.username : (process.env.KUMO_SMTP_USER || process.env.KUMOMTA_USERNAME || undefined),
      password: customConfig?.password !== undefined ? customConfig.password : (process.env.KUMO_SMTP_PASSWORD || process.env.KUMOMTA_PASSWORD || undefined),
      apiUrl: customConfig?.apiUrl !== undefined ? customConfig.apiUrl : (process.env.KUMOMTA_API_URL || 'http://127.0.0.1:8000'),
      fromEmail: customConfig?.fromEmail !== undefined ? customConfig.fromEmail : (process.env.KUMO_FROM_EMAIL || undefined),
      fromName: customConfig?.fromName !== undefined ? customConfig.fromName : (process.env.KUMO_FROM_NAME || undefined),
    };
  }

  public updateConfig(newConfig?: Partial<KumoMtaConfig>): void {
    this.config = {
      host: newConfig?.host !== undefined ? newConfig.host : (process.env.KUMO_SMTP_HOST || process.env.KUMOMTA_HOST || '127.0.0.1'),
      port: newConfig?.port !== undefined ? newConfig.port : (Number(process.env.KUMO_SMTP_PORT || process.env.KUMOMTA_PORT) || 2525),
      secure: newConfig?.secure !== undefined ? newConfig.secure : (process.env.KUMO_SMTP_SECURE === 'true' || Number(process.env.KUMO_SMTP_PORT || process.env.KUMOMTA_PORT) === 465),
      username: customConfigValue(process.env.KUMO_SMTP_USER, process.env.KUMOMTA_USERNAME),
      password: customConfigValue(process.env.KUMO_SMTP_PASSWORD, process.env.KUMOMTA_PASSWORD),
      apiUrl: newConfig?.apiUrl !== undefined ? newConfig.apiUrl : (process.env.KUMOMTA_API_URL || 'http://127.0.0.1:8000'),
      fromEmail: newConfig?.fromEmail !== undefined ? newConfig.fromEmail : (process.env.KUMO_FROM_EMAIL || undefined),
      fromName: newConfig?.fromName !== undefined ? newConfig.fromName : (process.env.KUMO_FROM_NAME || undefined),
    };
    this.transporter = null;
  }

  public validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!this.config.host || this.config.host.trim() === '') errors.push('KumoMTA host is required (KUMOMTA_HOST or KUMO_SMTP_HOST).');
    if (!this.config.port || isNaN(this.config.port) || this.config.port <= 0 || this.config.port > 65535) errors.push('KumoMTA port must be a valid port number between 1 and 65535 (KUMOMTA_PORT or KUMO_SMTP_PORT).');
    return { valid: errors.length === 0, errors };
  }

  public isConfigured(): boolean { return Boolean(this.config.host && this.config.host.trim() !== ''); }

  public getConfigSanitized(): { host: string; port: number; secure: boolean; hasAuth: boolean; username?: string; apiUrl?: string; isConfigured: boolean } {
    return { host: this.config.host, port: this.config.port, secure: this.config.secure, hasAuth: Boolean(this.config.username && this.config.password), username: this.config.username, apiUrl: this.config.apiUrl, isConfigured: this.isConfigured() };
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
        auth: (this.config.username && this.config.password) ? { user: this.config.username, pass: this.config.password } : undefined,
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
        tls: { rejectUnauthorized: process.env.KUMO_TLS_REJECT_UNAUTHORIZED === 'false' ? false : true },
      });
    }
    return this.transporter;
  }

  private logEvent(event: string, severity: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS', response: string, details?: Record<string, any>, messageId?: string): void {
    const timestamp = new Date().toISOString();
    const logPrefix = `[KumoMTA ${severity}] ${timestamp}`;
    const cleanDetails = details ? { ...details } : {};
    delete cleanDetails.password;
    delete cleanDetails.pass;
    delete cleanDetails.auth;
    console.log(`${logPrefix} ${event}: ${response}`, cleanDetails);
    db.logs.unshift({ id: `log_kumo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, timestamp, service: 'KumoMTA', messageId, event, severity, response, details: cleanDetails });
  }

  async checkHealth(): Promise<any> {
    const start = Date.now();
    const sanitized = this.getConfigSanitized();
    const nowIso = new Date().toISOString();
    if (!this.isConfigured()) return { status: 'offline', configured: false, latencyMs: 0, error: 'KumoMTA is not configured. Set KUMOMTA_HOST / KUMO_SMTP_HOST in environment.', details: { host: sanitized.host || 'unconfigured', port: sanitized.port, secure: sanitized.secure, hasAuth: sanitized.hasAuth, verifiedAt: nowIso } };
    try {
      await this.getTransporter().verify();
      return { status: 'healthy', configured: true, latencyMs: Date.now() - start, details: { host: sanitized.host, port: sanitized.port, secure: sanitized.secure, hasAuth: sanitized.hasAuth, verifiedAt: nowIso } };
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to connect to KumoMTA SMTP service';
      this.logEvent('HEALTH_CHECK_FAILED', 'WARN', `Health verification to ${sanitized.host}:${sanitized.port} failed: ${errorMsg}`, { host: sanitized.host, port: sanitized.port, error: errorMsg });
      return { status: 'offline', configured: true, latencyMs: Date.now() - start, error: errorMsg, details: { host: sanitized.host, port: sanitized.port, secure: sanitized.secure, hasAuth: sanitized.hasAuth, verifiedAt: nowIso } };
    }
  }

  public generateRfcMessageId(domain: string): string {
    return `<kumo.${Date.now()}.${Math.random().toString(36).substring(2, 10)}@${domain ? domain.replace(/^@/, '') : 'kumo.internal'}>`;
  }

  async submitEmail(payload: SendEmailPayload): Promise<KumoSubmissionResult> {
    const start = Date.now();
    const domainPart = payload.fromEmail.includes('@') ? payload.fromEmail.split('@')[1] : 'transact.acme-corp.io';
    const rfcMessageId = payload.rfcMessageId || this.generateRfcMessageId(domainPart);
    const internalId = payload.internalId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const toEmail = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
    const primaryTo = Array.isArray(payload.to) ? payload.to[0] : payload.to;

    const suppressionCheck = suppressionService.isSuppressed(primaryTo);
    if (suppressionCheck.suppressed) {
      const errorText = `Cannot send email: recipient "${primaryTo}" is suppressed (${suppressionCheck.record?.type}: ${suppressionCheck.record?.reason})`;
      this.logEvent('SUBMISSION_BLOCKED_SUPPRESSED', 'WARN', errorText, { recipient: primaryTo, suppression: suppressionCheck.record });
      throw new Error(errorText);
    }
    const validation = this.validateConfig();
    if (!validation.valid) {
      const errorText = `Cannot send email: KumoMTA is not configured properly (${validation.errors.join(', ')})`;
      this.logEvent('SUBMISSION_CONFIG_ERROR', 'ERROR', errorText, { from: payload.fromEmail, to: toEmail });
      throw new Error(errorText);
    }

    let sender = db.senders.find((s) => s.fromEmail.toLowerCase() === payload.fromEmail.toLowerCase());
    if (payload.userId && supabaseService.isConfigured && supabaseService.getClient()) {
      const supabaseSenders = await supabaseService.getSenders(payload.userId);
      sender = supabaseSenders.find((s) => s.fromEmail.toLowerCase() === payload.fromEmail.toLowerCase());
    }
    const senderId = sender?.id || 'snd_01';
    const senderDisplayName = payload.fromName || sender?.name || this.config.fromName;
    const sesConfigurationSet = process.env.SES_CONFIGURATION_SET || db.settings?.ses?.configurationSet;
    const customHeaders: Record<string, string> = {
      'X-KumoMTA-Queue': 'tier1-high-throughput',
      'X-KumoMTA-Spool-ID': `spool-${Date.now().toString(36)}`,
      'X-Entity-ID': 'emailops-kumo-cluster',
      'X-Internal-Message-ID': internalId,
      'X-EmailOps-ID': internalId,
      ...(payload.campaignId ? { 'X-Campaign-ID': payload.campaignId } : {}),
      ...(sesConfigurationSet ? { 'X-SES-CONFIGURATION-SET': sesConfigurationSet } : {}),
      ...(payload.customHeaders || {}),
    };
    if (!customHeaders['List-Unsubscribe']) {
      customHeaders['List-Unsubscribe'] = `<mailto:unsub@${domainPart}?subject=unsub-${internalId}>, <https://${domainPart}/u/${internalId}>`;
      customHeaders['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    const nowIso = new Date().toISOString();
    this.logEvent('SUBMISSION_INITIATED', 'INFO', `Submitting email to KumoMTA (${this.config.host}:${this.config.port}) for recipient: ${toEmail}`, { messageId: rfcMessageId, internalId, from: payload.fromEmail, to: toEmail, subject: payload.subject, campaignId: payload.campaignId, isTest: payload.isTest }, rfcMessageId);

    try {
      const transporter = this.getTransporter();
      const formattedFrom = senderDisplayName ? `"${senderDisplayName.replace(/"/g, '')}" <${payload.fromEmail}>` : payload.fromEmail;
      const info = await transporter.sendMail({
        from: formattedFrom,
        to: payload.to,
        cc: payload.cc,
        bcc: payload.bcc,
        replyTo: payload.replyTo || sender?.replyTo,
        subject: payload.subject,
        text: payload.plainText,
        html: payload.htmlBody,
        messageId: rfcMessageId,
        headers: customHeaders,
        attachments: payload.attachments?.map((a) => ({ filename: a.filename, content: a.content || Buffer.from(''), contentType: a.mimeType })),
      });
      const latencyMs = Date.now() - start;
      const smtpResponse = info.response || '250 2.0.0 OK: Message accepted by KumoMTA spool';
      const messageStatus: MessageStatus = 'QUEUED';
      let parsedSesMessageId: string | undefined;
      const sesMatch = smtpResponse.match(/250.*?Ok\s+([0-9a-zA-Z\-_]{16,})/i);
      if (sesMatch?.[1]) parsedSesMessageId = sesMatch[1];
      const newMsg: Message = {
        id: internalId, messageId: rfcMessageId, sesMessageId: parsedSesMessageId, campaignId: payload.campaignId,
        campaignName: payload.campaignId ? db.campaigns.find((c) => c.id === payload.campaignId)?.name : undefined,
        senderId, fromName: senderDisplayName, fromEmail: payload.fromEmail, toEmail: primaryTo, replyTo: payload.replyTo || sender?.replyTo,
        cc: payload.cc, bcc: payload.bcc, subject: payload.subject, htmlBody: payload.htmlBody, plainText: payload.plainText, customHeaders,
        status: messageStatus, provider: 'KumoMTA', providerMessageId: info.messageId || rfcMessageId, smtpResponse, queuedAt: nowIso, sentAt: nowIso, createdAt: nowIso,
        attachments: payload.attachments?.map((a, i) => ({ id: `att_${Date.now()}_${i}`, filename: a.filename, fileSize: a.fileSize, mimeType: a.mimeType })),
      };
      const initialEvent: MessageEvent = { id: `evt_kumo_${Date.now()}`, messageId: rfcMessageId, eventType: 'QUEUED', eventData: { kumoHost: this.config.host, kumoPort: this.config.port, smtpResponse, latencyMs, accepted: info.accepted, rejected: info.rejected }, timestamp: nowIso };
      newMsg.events = [initialEvent];
      } catch (err: any) {
      // If local KumoMTA is offline or connection refused (and NOT a test customTransporter or permanent 5xx rejection), fallback seamlessly to Amazon SES Relay
      const is5xxRejection = err.responseCode >= 500 && err.responseCode < 600;
      const shouldFallback = !this.customTransporter && !is5xxRejection;

      const sesHost = process.env.SES_SMTP_HOST || 'g6emxdm74cqj.fips.wmjb.mail-manager-smtp.amazonaws.com';
      const sesUser = process.env.SES_SMTP_USERNAME || 'inp-nuchbsqgvk3qqaht5u7c5duz';
      const sesPass = process.env.SES_SMTP_PASSWORD || 'alaa.JABIR06';
      const sesPort = Number(process.env.SES_SMTP_PORT) || 587;

      if (shouldFallback && sesUser && sesPass && sesHost) {
      if (existingIndex >= 0) db.messages[existingIndex] = newMsg;
      else db.messages.unshift(newMsg);
      db.messageEvents.push(initialEvent);
      supabaseService.saveMessage(newMsg, payload.userId || 'usr_admin_01').catch(() => {});
      supabaseService.saveMessageEvent(initialEvent, payload.userId || 'usr_admin_01').catch(() => {});
      if (sender && 'sentCount' in sender) sender.sentCount += 1;
      this.logEvent('SUBMISSION_ACCEPTED', 'SUCCESS', `KumoMTA accepted email for spooling in ${latencyMs}ms: ${smtpResponse}`, { internalId, rfcMessageId, kumoHost: this.config.host, kumoPort: this.config.port, latencyMs, accepted: info.accepted, rejected: info.rejected, response: smtpResponse }, rfcMessageId);
      return { success: true, messageId: internalId, rfcMessageId, kumoResponse: smtpResponse, provider: 'KumoMTA', status: messageStatus, smtpResponse, accepted: (info.accepted as string[]) || [primaryTo], rejected: (info.rejected as string[]) || [], latencyMs };
    } catch (err: any) {
      // If local KumoMTA is offline or refused connection, fallback seamlessly to Amazon SES Relay
      const sesHost = process.env.SES_SMTP_HOST || 'g6emxdm74cqj.fips.wmjb.mail-manager-smtp.amazonaws.com';
      const sesUser = process.env.SES_SMTP_USERNAME || 'inp-nuchbsqgvk3qqaht5u7c5duz';
      const sesPass = process.env.SES_SMTP_PASSWORD || 'alaa.JABIR06';
      const sesPort = Number(process.env.SES_SMTP_PORT) || 587;

      if (sesUser && sesPass && sesHost) {
        try {
          this.logEvent('FALLBACK_INITIATED', 'INFO', `Local submission failed (${err.message}), attempting direct Amazon SES dispatch via ${sesHost}:${sesPort}`, { internalId, rfcMessageId, to: toEmail }, rfcMessageId);
          const directTransporter = nodemailer.createTransport({
            host: sesHost,
            port: sesPort,
            secure: sesPort === 465,
            auth: { user: sesUser, pass: sesPass },
            connectionTimeout: 10000,
            tls: { rejectUnauthorized: false }
          });

          const formattedFrom = senderDisplayName ? `"${senderDisplayName.replace(/"/g, '')}" <${payload.fromEmail}>` : payload.fromEmail;
          const sesInfo = await directTransporter.sendMail({
            from: formattedFrom,
            to: payload.to,
            cc: payload.cc,
            bcc: payload.bcc,
            replyTo: payload.replyTo || sender?.replyTo,
            subject: payload.subject,
            text: payload.plainText,
            html: payload.htmlBody,
            messageId: rfcMessageId,
            headers: customHeaders,
            attachments: payload.attachments?.map((a) => ({ filename: a.filename, content: a.content || Buffer.from(''), contentType: a.mimeType })),
          });

          const latencyMs = Date.now() - start;
          const smtpResponse = sesInfo.response || '250 OK: Message accepted by Amazon SES Relay';
          const messageStatus: MessageStatus = 'SENT';
          const newMsg: Message = {
            id: internalId, messageId: rfcMessageId, campaignId: payload.campaignId,
            campaignName: payload.campaignId ? db.campaigns.find((c) => c.id === payload.campaignId)?.name : undefined,
            senderId, fromName: senderDisplayName, fromEmail: payload.fromEmail, toEmail: primaryTo, replyTo: payload.replyTo || sender?.replyTo,
            cc: payload.cc, bcc: payload.bcc, subject: payload.subject, htmlBody: payload.htmlBody, plainText: payload.plainText, customHeaders,
            status: messageStatus, provider: 'Amazon SES', providerMessageId: sesInfo.messageId || rfcMessageId, smtpResponse, queuedAt: nowIso, sentAt: nowIso, createdAt: nowIso,
            attachments: payload.attachments?.map((a, i) => ({ id: `att_${Date.now()}_${i}`, filename: a.filename, fileSize: a.fileSize, mimeType: a.mimeType })),
          };
          const sesEvent: MessageEvent = { id: `evt_ses_${Date.now()}`, messageId: rfcMessageId, eventType: 'SENT', eventData: { sesHost, sesPort, smtpResponse, latencyMs, accepted: sesInfo.accepted, rejected: sesInfo.rejected }, timestamp: nowIso };
          newMsg.events = [sesEvent];
          const existingIndex = db.messages.findIndex((m) => m.id === internalId);
          if (existingIndex >= 0) db.messages[existingIndex] = newMsg;
          else db.messages.unshift(newMsg);
          db.messageEvents.push(sesEvent);
          supabaseService.saveMessage(newMsg, payload.userId || 'usr_admin_01').catch(() => {});
          supabaseService.saveMessageEvent(sesEvent, payload.userId || 'usr_admin_01').catch(() => {});
          if (sender && 'sentCount' in sender) {
            sender.sentCount += 1;
            sender.deliveredCount = (sender.deliveredCount || 0) + 1;
          }
          this.logEvent('SES_DELIVERY_SUCCESS', 'SUCCESS', `Dispatched directly via Amazon SES in ${latencyMs}ms: ${smtpResponse}`, { internalId, rfcMessageId, sesHost, sesPort, latencyMs, accepted: sesInfo.accepted }, rfcMessageId);
          return { success: true, messageId: internalId, rfcMessageId, kumoResponse: smtpResponse, provider: 'Amazon SES', status: messageStatus, smtpResponse, accepted: (sesInfo.accepted as string[]) || [primaryTo], rejected: (sesInfo.rejected as string[]) || [], latencyMs };
        } catch (sesErr: any) {
          this.logEvent('SES_DISPATCH_FAILED', 'ERROR', `Amazon SES direct dispatch failed: ${sesErr.message}`, { internalId, rfcMessageId, error: sesErr.message }, rfcMessageId);
        }
      }

      const latencyMs = Date.now() - start;
      const errorMsg = err.message || 'KumoMTA SMTP connection error';
      const smtpCode = err.responseCode || err.code || 'UNKNOWN';
      this.logEvent('SUBMISSION_FAILED', 'ERROR', `Failed to submit message to KumoMTA (${this.config.host}:${this.config.port}): ${errorMsg}`, { internalId, rfcMessageId, from: payload.fromEmail, to: toEmail, smtpCode, latencyMs, error: errorMsg }, rfcMessageId);
      const failedMsg: Message = {
        id: internalId, messageId: rfcMessageId, campaignId: payload.campaignId, senderId, fromName: senderDisplayName, fromEmail: payload.fromEmail,
        toEmail: primaryTo, replyTo: payload.replyTo, subject: payload.subject, htmlBody: payload.htmlBody, plainText: payload.plainText, customHeaders,
        status: 'FAILED', provider: 'KumoMTA', smtpResponse: errorMsg, bounceReason: errorMsg, queuedAt: nowIso, createdAt: nowIso,
        events: [{ id: `evt_kumo_fail_${Date.now()}`, messageId: rfcMessageId, eventType: 'FAILED', eventData: { error: errorMsg, code: smtpCode, latencyMs }, timestamp: nowIso }],
      };
      const existingIndex = db.messages.findIndex((m) => m.id === internalId);
      if (existingIndex >= 0) db.messages[existingIndex] = failedMsg;
      else db.messages.unshift(failedMsg);
      db.messageEvents.push(failedMsg.events[0]);
      throw new Error(`SMTP submission failed: ${errorMsg}`);
    }
  }
}

function customConfigValue(primary?: string, fallback?: string): string | undefined { return primary || fallback || undefined; }

export const kumoMtaService = new KumoMtaService();
