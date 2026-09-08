import { Request, Response, NextFunction } from 'express';
import { supabaseService, AuthenticatedUser } from '../services/SupabaseService.js';

// Extend Express Request interface to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * requireAuth Middleware
 * Validates Supabase JWT from Authorization: Bearer <token>
 * Rejects with 401 if missing or invalid.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  // Check test bypass header for test suites
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-user-id']) {
    req.user = {
      id: String(req.headers['x-test-user-id']),
      email: String(req.headers['x-test-user-email'] || 'test@emailops.io'),
      name: 'Test Operator',
      role: 'ADMIN',
      plan: 'PRO',
    };
    return next();
  }

  if (!authHeader) {
    res.status(401).json({
      error: 'Unauthorized: Authentication token is required. Pass Authorization: Bearer <token>',
    });
    return;
  }

  const user = await supabaseService.verifyToken(authHeader);
  if (!user) {
    res.status(401).json({
      error: 'Unauthorized: Invalid or expired Supabase authentication token',
    });
    return;
  }

  req.user = user;
  next();
}

/**
 * optionalAuth Middleware
 * Extracts user if token is provided, otherwise proceeds without failing.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const user = await supabaseService.verifyToken(authHeader);
    if (user) {
      req.user = user;
      return next();
    }
  } else if (process.env.NODE_ENV === 'test' && req.headers['x-test-user-id']) {
    req.user = {
      id: String(req.headers['x-test-user-id']),
      email: String(req.headers['x-test-user-email'] || 'test@emailops.io'),
      name: 'Test Operator',
      role: 'ADMIN',
      plan: 'PRO',
    };
    return next();
  }

  // If unauthenticated or token not provided, attach default system user so public dashboard displays real live data
  if (supabaseService.isConfigured) {
    const defaultUserId = await supabaseService.getDefaultUserId();
    if (defaultUserId) {
      req.user = {
        id: defaultUserId,
        email: 'service@amiralucia.com',
        name: 'Amira Lucia (Admin)',
        role: 'ADMIN',
        plan: 'ENTERPRISE',
      };
    }
  }
  next();
}
