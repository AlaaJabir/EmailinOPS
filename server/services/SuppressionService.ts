import { db } from '../store.js';
import { SuppressionItem, SuppressionType } from '../../src/types.js';

export class SuppressionService {
  // Check if an email address is actively suppressed
  isSuppressed(email: string): { suppressed: boolean; record?: SuppressionItem } {
    if (!email) return { suppressed: false };
    const normalized = email.trim().toLowerCase();
    const record = db.suppressions.find((s) => s.email.toLowerCase() === normalized);
    return {
      suppressed: !!record,
      record,
    };
  }

  // Filter a list of email addresses, returning clean and suppressed
  filterAudience(emails: string[]): { clean: string[]; suppressed: Array<{ email: string; reason: string; type: SuppressionType }> } {
    const clean: string[] = [];
    const suppressed: Array<{ email: string; reason: string; type: SuppressionType }> = [];

    for (const email of emails) {
      const check = this.isSuppressed(email);
      if (check.suppressed && check.record) {
        suppressed.push({
          email,
          reason: check.record.reason,
          type: check.record.type,
        });
      } else {
        clean.push(email);
      }
    }

    return { clean, suppressed };
  }

  // Add suppression entry
  addSuppression(email: string, type: SuppressionType, reason: string, source = 'manual'): SuppressionItem {
    const normalized = email.trim().toLowerCase();
    const existingIdx = db.suppressions.findIndex((s) => s.email.toLowerCase() === normalized);
    
    const newItem: SuppressionItem = {
      id: `sup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      email: normalized,
      type,
      reason: reason || 'Manual suppression requested by administrator',
      source,
      createdAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      db.suppressions[existingIdx] = newItem;
    } else {
      db.suppressions.unshift(newItem);
    }

    db.logs.unshift({
      id: `log_sup_${Date.now()}`,
      timestamp: new Date().toISOString(),
      service: 'Application',
      event: 'SUPPRESSION_RECORD_ADDED',
      severity: 'INFO',
      response: `Suppression added for ${normalized} (${type})`,
      details: { reason, source },
    });

    return newItem;
  }

  // Remove suppression entry (explicit authorized action)
  removeSuppression(idOrEmail: string): boolean {
    const initialLen = db.suppressions.length;
    db.suppressions = db.suppressions.filter(
      (s) => s.id !== idOrEmail && s.email.toLowerCase() !== idOrEmail.toLowerCase()
    );

    const removed = db.suppressions.length < initialLen;
    if (removed) {
      db.logs.unshift({
        id: `log_sup_del_${Date.now()}`,
        timestamp: new Date().toISOString(),
        service: 'Application',
        event: 'SUPPRESSION_RECORD_REMOVED',
        severity: 'WARN',
        response: `Authorized removal of suppression for identifier: ${idOrEmail}`,
      });
    }

    return removed;
  }
}

export const suppressionService = new SuppressionService();
