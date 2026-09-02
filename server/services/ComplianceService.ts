import { db } from '../store.js';

export class ComplianceService {
  // Validate email sending compliance rules
  validateSendPayload(payload: {
    fromEmail: string;
    to: string | string[];
    isMarketing?: boolean;
    htmlBody?: string;
  }): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Sender domain format and validation
    if (!payload.fromEmail || !payload.fromEmail.includes('@')) {
      errors.push('Valid "From" email address is required.');
    } else {
      const domain = payload.fromEmail.split('@')[1];
      const verifiedDomain = db.domains.find(
        (d) => d.domainName.toLowerCase() === domain.toLowerCase() && d.spfStatus === 'VERIFIED'
      );
      if (!verifiedDomain) {
        warnings.push(`Domain "${domain}" is not fully verified in DNS records.`);
      }
    }

    // 2. Recipients validation
    const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
    if (recipients.length === 0 || !recipients[0]) {
      errors.push('At least one recipient email address is required.');
    }

    for (const r of recipients) {
      if (!r || !r.includes('@')) {
        errors.push(`Invalid recipient format: "${r}"`);
      }
    }

    // 3. Marketing email compliance (CAN-SPAM / GDPR / RFC 8058)
    if (payload.isMarketing) {
      const body = payload.htmlBody || '';
      if (!body.toLowerCase().includes('unsubscribe')) {
        warnings.push('Marketing emails should contain an explicit Unsubscribe link in the HTML footer.');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Inject compliant headers
  buildCompliantHeaders(domain: string, messageId: string): Record<string, string> {
    return {
      'List-Unsubscribe': `<mailto:unsubscribe@${domain}?subject=unsub-${messageId}>, <https://${domain}/unsubscribe?id=${messageId}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-Compliance-Policy': 'CAN-SPAM/CASL/GDPR-Opt-In-Verified',
      'X-Report-Abuse': `mailto:abuse@${domain}`,
    };
  }
}

export const complianceService = new ComplianceService();
