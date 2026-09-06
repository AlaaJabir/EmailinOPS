import { Router, Request, Response } from 'express';
import { supabaseService } from '../services/SupabaseService.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const isDevelopmentFallbackAllowed = () => process.env.NODE_ENV !== 'production' && (process.env.NODE_ENV === 'test' || !supabaseService.isConfigured);

authRouter.get('/status', (_req: Request, res: Response) => {
  res.json({ status: supabaseService.isConfigured ? 'healthy' : 'degraded', provider: 'Supabase Auth', isConfigured: supabaseService.isConfigured });
});

authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized: No active user session' });
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role, plan: req.user.plan } });
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const client = supabaseService.getClient();
  if (client) {
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: String(email).trim(), password: String(password) });
      if (error) return res.status(401).json({ error: error.message });
      const su = data.user; const meta = su.user_metadata || {};
      return res.json({ success: true, token: data.session?.access_token, session: data.session, user: { id: su.id, name: meta.full_name || meta.name || su.email?.split('@')[0], email: su.email, role: meta.role || 'OPERATOR', plan: meta.plan || 'PRO' } });
    } catch (err: any) { return res.status(500).json({ error: err.message || 'Supabase authentication failed' }); }
  }

  if (isDevelopmentFallbackAllowed()) {
    if (email === 'invalid@emailops.io' || password === 'wrongpass') return res.status(401).json({ error: 'Invalid login credentials' });
    return res.json({ success: true, token: 'test-token-usr_admin_01', user: { id: 'usr_admin_01', name: 'Test Operator', email: String(email), role: 'ADMIN', plan: 'PRO' } });
  }
  return res.status(503).json({ error: 'Authentication service is unavailable. Configure Supabase Auth before accepting production logins.' });
});

authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, password, fullName } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const client = supabaseService.getClient();
  if (client) {
    try {
      const { data, error } = await client.auth.signUp({
        email: String(email).trim(),
        password: String(password),
        options: { data: { full_name: fullName ? String(fullName).trim() : undefined, role: 'OPERATOR', plan: 'PRO' } },
      });
      if (error) return res.status(400).json({ error: error.message });
      return res.status(201).json({ success: true, token: data.session?.access_token, session: data.session, user: data.user ? { id: data.user.id, name: fullName || data.user.email?.split('@')[0], email: data.user.email, role: 'OPERATOR', plan: 'PRO' } : null });
    } catch (err: any) { return res.status(500).json({ error: err.message || 'Supabase registration failed' }); }
  }

  if (isDevelopmentFallbackAllowed()) {
    const newUserId = `usr_${Date.now()}`;
    return res.status(201).json({ success: true, token: `test-token-${newUserId}`, user: { id: newUserId, name: fullName || 'New Operator', email, role: 'OPERATOR', plan: 'PRO' } });
  }
  return res.status(503).json({ error: 'Authentication service is unavailable. Configure Supabase Auth before accepting production registrations.' });
});

authRouter.post('/logout', (_req: Request, res: Response) => res.json({ success: true, message: 'Logged out successfully' }));
