/**
 * JWT-Based CSRF Protection for Serverless Environments
 * 
 * This implementation embeds CSRF nonces directly in JWT tokens,
 * making it compatible with Vercel's serverless architecture.
 * 
 * Security Model:
 * 1. CSRF nonce embedded in JWT payload
 * 2. Client extracts nonce and sends in X-CSRF-Token header
 * 3. Server validates nonce matches JWT payload
 * 4. No session dependency - fully stateless
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { verifyToken } from '../utils/jwt';
import { secureLog } from '../utils/secureLogger';

interface CSRFRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    businessAccountId?: string;
    csrfNonce?: string; // Added for CSRF protection
  };
  csrfNonce?: string;
}

/**
 * Generate cryptographically secure CSRF nonce
 */
export function generateCSRFNonce(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Enhanced JWT verification that includes CSRF nonce extraction
 */
export async function requireAuthWithCSRF(
  req: CSRFRequest, 
  res: Response, 
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      secureLog({
        level: 'warn',
        action: 'JWT_CSRF_MISSING_TOKEN',
        details: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path
        }
      });
      
      return res.status(401).json({ 
        message: "Authentication required",
        code: 'MISSING_TOKEN' 
      });
    }

    // Verify JWT and extract payload including CSRF nonce
    const decoded = await verifyToken(token);
    
    if (!decoded) {
      secureLog({
        level: 'warn',
        action: 'JWT_CSRF_INVALID_TOKEN',
        details: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path
        }
      });
      
      return res.status(401).json({ 
        message: "Invalid or expired token",
        code: 'INVALID_TOKEN' 
      });
    }

    // Extract user data and CSRF nonce from JWT
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      businessAccountId: decoded.businessAccountId,
      csrfNonce: decoded.csrfNonce // CSRF nonce from JWT
    };

    // Make CSRF nonce available for validation
    req.csrfNonce = decoded.csrfNonce;

    secureLog({
      level: 'debug',
      action: 'JWT_CSRF_AUTH_SUCCESS',
      details: {
        userId: req.user.id,
        role: req.user.role,
        ipAddress: req.ip,
        hasCSRFNonce: !!req.csrfNonce
      }
    });

    next();
  } catch (error: any) {
    secureLog({
      level: 'error',
      action: 'JWT_CSRF_AUTH_ERROR',
      details: {
        error: error.message,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      }
    });

    res.status(401).json({ 
      message: "Authentication failed",
      code: 'AUTH_ERROR' 
    });
  }
}

/**
 * Validate CSRF token against JWT-embedded nonce
 * Only validates for state-changing operations (POST, PUT, DELETE)
 */
export function validateJWTCSRFToken(
  req: CSRFRequest, 
  res: Response, 
  next: NextFunction
) {
  try {
    // Skip CSRF validation for safe methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
      return next();
    }

    // Get CSRF token from header
    const providedToken = req.get('X-CSRF-Token');
    const expectedNonce = req.csrfNonce;

    // Validate token presence
    if (!providedToken) {
      secureLog({
        level: 'warn',
        action: 'JWT_CSRF_TOKEN_MISSING',
        details: {
          method: req.method,
          url: req.originalUrl,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          userId: req.user?.id
        }
      });
      
      return res.status(403).json({ 
        message: 'CSRF token required for this operation',
        code: 'CSRF_TOKEN_REQUIRED'
      });
    }

    if (!expectedNonce) {
      secureLog({
        level: 'error',
        action: 'JWT_CSRF_NONCE_MISSING',
        details: {
          method: req.method,
          url: req.originalUrl,
          ipAddress: req.ip,
          userId: req.user?.id
        }
      });
      
      return res.status(403).json({ 
        message: 'Invalid authentication state',
        code: 'INVALID_AUTH_STATE'
      });
    }

    // Validate token using timing-safe comparison with normalized buffer lengths
    // This prevents timing attacks and buffer length exceptions
    const providedBuffer = Buffer.from(providedToken.padEnd(64, '0'), 'utf8').subarray(0, 64);
    const expectedBuffer = Buffer.from(expectedNonce.padEnd(64, '0'), 'utf8').subarray(0, 64);
    
    if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
      secureLog({
        level: 'warn',
        action: 'JWT_CSRF_TOKEN_MISMATCH',
        details: {
          method: req.method,
          url: req.originalUrl,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          userId: req.user?.id,
          providedTokenLength: providedToken.length,
          expectedTokenLength: expectedNonce.length
        }
      });
      
      return res.status(403).json({ 
        message: 'CSRF token validation failed',
        code: 'CSRF_TOKEN_INVALID'
      });
    }

    // Token is valid
    secureLog({
      level: 'debug',
      action: 'JWT_CSRF_TOKEN_VALID',
      details: {
        method: req.method,
        url: req.originalUrl,
        userId: req.user?.id,
        ipAddress: req.ip
      }
    });

    next();
  } catch (error: any) {
    secureLog({
      level: 'error',
      action: 'JWT_CSRF_VALIDATION_ERROR',
      details: {
        error: error.message,
        method: req.method,
        url: req.originalUrl,
        ipAddress: req.ip,
        userId: req.user?.id
      }
    });

    res.status(500).json({ 
      message: 'Internal server error during CSRF validation',
      code: 'CSRF_VALIDATION_ERROR' 
    });
  }
}

/**
 * Middleware to provide CSRF nonce to client
 * Sends the current user's CSRF nonce in response header
 */
export function provideCSRFNonce(
  req: CSRFRequest, 
  res: Response, 
  next: NextFunction
) {
  try {
    if (req.csrfNonce) {
      res.setHeader('X-CSRF-Token', req.csrfNonce);
    }
    next();
  } catch (error: any) {
    secureLog({
      level: 'error',
      action: 'CSRF_NONCE_PROVISION_ERROR',
      details: {
        error: error.message,
        userId: req.user?.id,
        ipAddress: req.ip
      }
    });
    
    // Don't fail the request, just log the error
    next();
  }
}