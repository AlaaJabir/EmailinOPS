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
