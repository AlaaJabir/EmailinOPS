import crypto from 'crypto';
import { db, UnsubscribeToken } from '../store.js';
import { Contact } from '../../src/types.js';
import { supabaseService } from './SupabaseService.js';

export interface UnsubscribeTokenData {
  token: string;
  email: string;
  contactId?: string;
  messageId?: string;
  campaignId?: string;
  userId?: string;
  createdAt: string;
  unsubscribedAt?: string;
}

export interface PersonalizationContext {
  contact?: Partial<Contact> | null;
  email: string;
  unsubscribeUrl: string;
  privacyUrl?: string;
  termsUrl?: string;
  customVariables?: Record<string, string>;
}

export class PersonalizationService {
  private secretKey: string;

  constructor() {
    this.secretKey =
      process.env.UNSUBSCRIBE_SECRET ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      'emailops-rfc8058-unsubscribe-secret-salt-2026';
  }

  /**
   * Determine base URL for unsubscribe, tracking, and compliance links
   */
  getBaseUrl(reqOrHost?: string): string {
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL.replace(/\/+$/, '');
  }

  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }

  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/+$/, '');
  }

  if (reqOrHost) {
    const host = reqOrHost.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    return `${proto}://${host}`;
  }

  return 'http://localhost:3000';
}

  /**
   * Generate an opaque, cryptographically random unsubscribe token
   * and store mapping securely without exposing email in URL.
   */
  async generateUnsubscribeToken(data: {
    email: string;
    contactId?: string;
    messageId?: string;
    campaignId?: string;
    userId?: string;
    baseUrl?: string;
  }): Promise<{ token: string; unsubscribeUrl: string }> {
    const rawToken = `unsub_${crypto.randomBytes(24).toString('hex')}`;
    const baseUrl = (data.baseUrl || this.getBaseUrl()).replace(/\/+$/, '');

    const record: UnsubscribeToken = {
      token: rawToken,
      email: data.email.toLowerCase().trim(),
      contactId: data.contactId,
      messageId: data.messageId,
      campaignId: data.campaignId,
      userId: data.userId,
      createdAt: new Date().toISOString(),
    };

    // Store in-memory
    db.unsubscribeTokens = db.unsubscribeTokens || [];
    db.unsubscribeTokens.unshift(record);

    // Persist to Supabase if configured
    await supabaseService.saveUnsubscribeToken(record);

    const unsubscribeUrl = `${baseUrl}/unsubscribe/${rawToken}`;

    return {
      token: rawToken,
      unsubscribeUrl,
    };
  }

  /**
   * Look up and validate an unsubscribe token
   */
  async findToken(token: string): Promise<UnsubscribeToken | null> {
    if (!token || typeof token !== 'string') return null;
    const cleanToken = token.trim();

    // 1. Check in-memory store
    const local = (db.unsubscribeTokens || []).find((t) => t.token === cleanToken);
    if (local) {
      return local;
    }

    // 2. Check Supabase
    const remote = await supabaseService.getUnsubscribeToken(cleanToken);
    if (remote) {
      db.unsubscribeTokens = db.unsubscribeTokens || [];
      db.unsubscribeTokens.unshift(remote);
      return remote;
    }

    return null;
  }

  /**
   * Build RFC 8058 compliant unsubscribe headers
   */
  generateUnsubscribeHeaders(unsubscribeUrl: string, abuseDomain?: string): Record<string, string> {
    const domain = abuseDomain || process.env.KUMO_FROM_EMAIL?.split('@')[1] || 'amiralucia.com';
    return {
      'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:unsubscribe@${domain}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
  }

  /**
   * Personalize content (HTML, plain text, or subject line) with contact variables.
   * Safe fallbacks are used when values are missing.
   * Template variables:
   *   {{first_name}}
   *   {{last_name}}
   *   {{company}}
   *   {{email}}
   *   {{unsubscribe_url}}
   *   {{privacy_url}}
   *   {{terms_url}}
   */
  personalizeContent(content: string, context: PersonalizationContext): string {
    if (!content) return '';

    let result = content;
    const contact = context.contact;
    const email = context.email || contact?.email || '';
    const firstName = (contact?.firstName || '').trim();
    const lastName = (contact?.lastName || '').trim();
    const company = (contact?.company || '').trim();
    const unsubscribeUrl = context.unsubscribeUrl || '#';
    const privacyUrl = context.privacyUrl || db.settings?.compliance?.privacyUrl || '/privacy';
    const termsUrl = context.termsUrl || db.settings?.compliance?.termsUrl || '/terms';

    // 1. Handle {{first_name}} and variants ({{ firstName }}, {{first_name}})
    if (firstName) {
      result = result.replace(/\{\{\s*(first_name|firstName)\s*\}\}/gi, firstName);
    } else {
      // Safe fallback for greetings:
      // "Hello {{first_name}}," -> "Hello there,"
      // "Hi {{first_name}},"    -> "Hi there,"
      // "Hey {{first_name}},"   -> "Hey there,"
      // "Dear {{first_name}},"  -> "Dear Friend,"
      result = result.replace(/\b(hello|hi|hey)\s*\{\{\s*(first_name|firstName)\s*\}\}/gi, '$1 there');
      result = result.replace(/\b(dear)\s*\{\{\s*(first_name|firstName)\s*\}\}/gi, '$1 Friend');
      
      // Standalone {{first_name}} fallback without exposing raw braces or empty gaps
      result = result.replace(/\{\{\s*(first_name|firstName)\s*\}\}/gi, 'there');
    }

    // 2. Handle {{last_name}} and variants ({{ lastName }})
    if (lastName) {
      result = result.replace(/\{\{\s*(last_name|lastName)\s*\}\}/gi, lastName);
    } else {
      result = result.replace(/\{\{\s*(last_name|lastName)\s*\}\}/gi, '');
    }

    // 3. Handle {{company}}
    if (company) {
      result = result.replace(/\{\{\s*(company|companyName)\s*\}\}/gi, company);
    } else {
      result = result.replace(/\{\{\s*(company|companyName)\s*\}\}/gi, 'your company');
    }

    // 4. Handle {{email}}
    result = result.replace(/\{\{\s*email\s*\}\}/gi, email);

    // 5. Handle {{unsubscribe_url}} and {{unsubscribe_link}}
    result = result.replace(/\{\{\s*(unsubscribe_url|unsubscribe_link|unsubscribeUrl|unsubscribeLink)\s*\}\}/gi, unsubscribeUrl);

    // 6. Handle {{privacy_url}}
    result = result.replace(/\{\{\s*privacy_url\s*\}\}/gi, privacyUrl);

    // 7. Handle {{terms_url}}
    result = result.replace(/\{\{\s*terms_url\s*\}\}/gi, termsUrl);

    // 8. Custom variables if provided
    if (context.customVariables) {
      for (const [k, v] of Object.entries(context.customVariables)) {
        const regex = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'gi');
        result = result.replace(regex, v || '');
      }
    }

    // 9. Clean up any remaining unmatched template variables to prevent raw placeholders from exposing to recipients
    result = result.replace(/\{\{\s*[a-zA-Z0-9_.-]+\s*\}\}/g, '');

    return result;
  }

  /**
   * Rewrite HTML anchor links for backend click tracking.
   * EXCLUSIONS:
   * - Does NOT rewrite unsubscribe links (matches /unsubscribe or {{unsubscribe_url}})
   * - Does NOT rewrite mailto:, tel:, # anchor links, or invalid URLs
   */
  rewriteLinksForClickTracking(html: string, messageId: string, baseUrl: string): string {
    if (!html || !messageId) return html;

    const base = baseUrl.replace(/\/+$/, '');
    const clickEndpointBase = `${base}/api/tracking/click/${encodeURIComponent(messageId)}`;

    // Match <a ... href="..." ...> tags
    return html.replace(/<a\b([^>]*?)href=(["'])(.*?)\2([^>]*?)>/gi, (match, beforeHref, quote, rawHref, afterHref) => {
      const trimmedHref = rawHref.trim();

      // Check exclusions:
      if (
        !trimmedHref ||
        trimmedHref.startsWith('#') ||
        trimmedHref.startsWith('mailto:') ||
        trimmedHref.startsWith('tel:') ||
        trimmedHref.startsWith('javascript:') ||
        trimmedHref.includes('/unsubscribe') ||
        trimmedHref.includes('{{unsubscribe_url}}') ||
        match.includes('data-no-track')
      ) {
        return match;
      }

      // Ensure valid HTTP or HTTPS destination
      try {
        const parsed = new URL(trimmedHref);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return match;
        }
      } catch {
        // Not a standard URL, do not rewrite
        return match;
      }

      // Rewrite to tracking redirect
      const trackedUrl = `${clickEndpointBase}?url=${encodeURIComponent(trimmedHref)}`;
      return `<a${beforeHref}href=${quote}${trackedUrl}${quote}${afterHref}>`;
    });
  }

  /**
   * Append transparent 1x1 tracking pixel to HTML email
   */
  injectOpenTrackingPixel(html: string, messageId: string, baseUrl: string): string {
    if (!html || !messageId) return html;

    const base = baseUrl.replace(/\/+$/, '');
    const pixelUrl = `${base}/api/tracking/open/${encodeURIComponent(messageId)}`;
    const pixelTag = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0.01;" />`;

    if (html.includes('</body>')) {
      return html.replace('</body>', `${pixelTag}\n</body>`);
    }

    return `${html}\n${pixelTag}`;
  }

  /**
   * Automatically generate clean text/plain content from HTML to ensure multipart/alternative MIME structure.
   * This eliminates the severe SpamAssassin MIME_HTML_ONLY penalty and guarantees high deliverability.
   */
  htmlToPlainText(html: string): string {
    if (!html) return '';
    let text = html;

    // Remove head, style, and script tags with their inner contents
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');

    // Format headers and block elements with newlines
    text = text.replace(/<\/h[1-6]>/gi, '\n\n');
    text = text.replace(/<br\s*[\/]?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<\/tr>/gi, '\n');
    text = text.replace(/<\/li>/gi, '\n');

    // Replace hyperlinks with readable text: "Label (URL)" or plain Label if anchor is internal
    text = text.replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, url, label) => {
      const cleanLabel = label.replace(/<[^>]+>/g, '').trim();
      const cleanUrl = url.trim();
      if (!cleanLabel) return cleanUrl;
      if (cleanUrl.startsWith('#') || cleanUrl.startsWith('javascript:')) return cleanLabel;
      return `${cleanLabel} (${cleanUrl})`;
    });

    // Strip remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode standard HTML entities
    text = text.replace(/&nbsp;/gi, ' ');
    text = text.replace(/&amp;/gi, '&');
    text = text.replace(/&lt;/gi, '<');
    text = text.replace(/&gt;/gi, '>');
    text = text.replace(/&quot;/gi, '"');
    text = text.replace(/&#39;/gi, "'");

    // Collapse multiple blank lines into max 2 newlines
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');

    return text.trim();
  }
}

export const personalizationService = new PersonalizationService();
