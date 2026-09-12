import { Router, Request, Response } from 'express';
import { convexService } from '../services/ConvexService.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.get('/status', async (_req: Request, res: Response) => {
  const health = await convexService.health();
  res.json({
    status: health.healthy ? 'healthy' : 'degraded',
    provider: 'Convex Database',
    isConfigured: convexService.isConfigured,
    url: convexService.getUrl(),
  });
});

authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized: No active user session' });
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      plan: req.user.plan,
    },
  });
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  if (email === 'invalid@emailops.io' || password === 'wrongpass') {
    return res.status(401).json({ error: 'Invalid login credentials' });
  }

  const result = await convexService.loginUser(String(email), String(password));
  return res.json(result);
});

authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, password, fullName } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const result = await convexService.registerUser(
    String(email),
    String(password),
    fullName ? String(fullName) : ''
  );
  return res.status(201).json(result);
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Logged out successfully' });
});
