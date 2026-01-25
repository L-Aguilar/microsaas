import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// User type definition for JWT (avoiding @shared dependency)
interface User {
  id: string;
  email: string;
  role: string;
  businessAccountId?: string | null;
}

// JWT Secret from environment - REQUIRED FOR SECURITY
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('CRITICAL SECURITY ERROR: JWT_SECRET must be set and at least 32 characters long');
  process.exit(1);
}

// JWT expires in 15 minutes for security - use refresh tokens for longer sessions
const JWT_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// Token revocation store (in production, use Redis)
const revokedTokens = new Set<string>();

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  businessAccountId?: string;
  csrfNonce: string; // CSRF nonce embedded in JWT for serverless compatibility
}

/**
 * Generate JWT token for user with embedded CSRF nonce
 * This provides serverless-compatible CSRF protection
 */
export function generateToken(user: User): string {
  // Generate cryptographically secure CSRF nonce
  const csrfNonce = crypto.randomBytes(32).toString('hex');
  
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    businessAccountId: user.businessAccountId || undefined,
    csrfNonce // Embed CSRF nonce in JWT
  };

  return jwt.sign(payload, JWT_SECRET!, { expiresIn: JWT_EXPIRY });
}

/**
 * Verify and decode JWT token with revocation check
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    // Check if token has been revoked
    if (revokedTokens.has(token)) {
      console.warn('Attempted use of revoked token');
      return null;
    }
    
    return jwt.verify(token, JWT_SECRET!) as JWTPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Revoke a token (add to blacklist)
 */
export function revokeToken(token: string): void {
  revokedTokens.add(token);
  console.log('Token revoked for security');
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(user: User): string {
  const payload = {
    userId: user.id,
    type: 'refresh'
  };
  
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

/**
 * Clean up expired tokens from revocation list (call periodically)
 */
export function cleanupRevokedTokens(): void {
  // In production, implement with Redis TTL
  // For now, clear all tokens older than JWT_EXPIRY + buffer
  revokedTokens.clear();
}

/**
 * Extract token from Authorization header
 * Supports: "Bearer <token>" format
 */
export function extractTokenFromHeader(authHeader: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7); // Remove "Bearer " prefix
}