import type { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader, revokeToken } from '../utils/jwt.js';
import { storage } from '../storage.js';
import { pool } from '../db.js';
import rateLimit from 'express-rate-limit';

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

// Rate limiting for authentication attempts
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Maximum 10 authentication attempts per window per IP
  message: { message: 'Too many authentication attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * JWT Authentication middleware with enhanced security validation
 * Replaces session-based authentication and implements RLS context
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

    // ENHANCED: Comprehensive user validation
    const user = await storage.getUser(payload.userId);
    if (!user) {
      // User no longer exists (likely deleted)
      console.log(`🚨 Authentication failed: User ${payload.userId} not found (account likely deleted)`);
      revokeToken(token);
      return res.status(401).json({ message: 'Account no longer exists' });
    }
    
    if (user.isDeleted || user.deletedAt) {
      // User is soft-deleted
      console.log(`🚨 Authentication failed: User ${payload.userId} is marked as deleted`);
      revokeToken(token);
      return res.status(401).json({ message: 'User account suspended' });
    }

    // ENHANCED: Verify business account is still active (if user has one)
    if (user.businessAccountId) {
      const businessAccount = await storage.getBusinessAccount(user.businessAccountId);
      if (!businessAccount) {
        console.log(`🚨 Authentication failed: Business account ${user.businessAccountId} not found (likely deleted)`);
        revokeToken(token);
        return res.status(401).json({ message: 'Business account no longer exists' });
      }
      
      if (!businessAccount.isActive) {
        console.log(`🚨 Authentication failed: Business account ${user.businessAccountId} is inactive`);
        revokeToken(token);
        return res.status(401).json({ message: 'Business account is inactive' });
      }
      
      if (businessAccount.deletedAt) {
        console.log(`🚨 Authentication failed: Business account ${user.businessAccountId} is deleted`);
        revokeToken(token);
        return res.status(401).json({ message: 'Business account has been deleted' });
      }
    }

    // SECURITY: Set database session variables for Row Level Security
    if (user.businessAccountId) {
      await pool.query("SELECT set_config('app.current_business_account_id', $1, true)", [user.businessAccountId]);
    }
    await pool.query("SELECT set_config('app.user_role', $1, true)", [user.role]);
    await pool.query("SELECT set_config('app.user_id', $1, true)", [user.id]);

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      businessAccountId: user.businessAccountId || undefined
    };

    // For backward compatibility with existing code
    req.businessAccountId = user.businessAccountId || undefined;

    // SECURITY: Log authentication event for audit
    console.log(`Authentication successful: ${user.email} (${user.role}) from ${req.ip}`);

    next();
  } catch (error) {
    console.error('JWT Auth middleware error:', error);
    // SECURITY: Log failed authentication attempts
    console.error(`Authentication failed from ${req.ip}: ${error.message}`);
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