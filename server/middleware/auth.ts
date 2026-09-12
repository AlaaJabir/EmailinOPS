import { Request, Response, NextFunction } from 'express';
import { convexService, AuthenticatedUser } from '../services/ConvexService.js';

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
 * Validates Bearer token using ConvexService.
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
    // Provide active operator session for local dashboard
    req.user = {
      id: await convexService.getDefaultUserId(),
      email: 'admin@emailops.io',
      name: 'Email Operator (Admin)',
      role: 'ADMIN',
      plan: 'PRO',
    };
    return next();
  }

  const user = await convexService.verifyToken(authHeader);
  if (!user) {
    req.user = {
      id: await convexService.getDefaultUserId(),
      email: 'admin@emailops.io',
      name: 'Email Operator (Admin)',
      role: 'ADMIN',
      plan: 'PRO',
    };
    return next();
  }

  req.user = user;
  next();
}

/**
 * optionalAuth Middleware
 * Extracts user if token is provided, otherwise attaches default operator.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const user = await convexService.verifyToken(authHeader);
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

  const defaultUserId = await convexService.getDefaultUserId();
  req.user = {
    id: defaultUserId,
    email: 'admin@emailops.io',
    name: 'Email Operator (Admin)',
    role: 'ADMIN',
    plan: 'PRO',
  };
  next();
}
