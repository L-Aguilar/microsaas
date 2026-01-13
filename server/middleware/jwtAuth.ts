import type { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt.js';
import { storage } from '../storage.js';

// Extend Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        businessAccountId?: string;
      };
      businessAccountId?: string;
    }
  }
}

/**
 * JWT Authentication middleware
 * Replaces session-based authentication
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return res.status(401).json({ message: 'Invalid token format' });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Verify user still exists in database
    const user = await storage.getUser(payload.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      businessAccountId: user.businessAccountId || undefined
    };

    // For backward compatibility with existing code
    req.businessAccountId = user.businessAccountId || undefined;

    next();
  } catch (error) {
    console.error('JWT Auth middleware error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  }
}

/**
 * Require specific role
 */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
}

/**
 * Require SUPER_ADMIN role
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole('SUPER_ADMIN')(req, res, next);
}

/**
 * Require business account (except for SUPER_ADMIN)
 * Automatically includes JWT authentication
 */
export function requireBusinessAccount(req: Request, res: Response, next: NextFunction) {
  // First ensure user is authenticated
  return requireAuth(req, res, () => {
    // Then check business account requirements
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // SUPER_ADMIN can access without business account restriction
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!req.user.businessAccountId) {
      return res.status(403).json({ message: 'Business account required' });
    }

    next();
  });
}