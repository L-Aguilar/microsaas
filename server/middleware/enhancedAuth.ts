import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { secureLog } from '../utils/secureLogger';
import { validateUserModification, UserRole } from '../utils/roleValidation';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    businessAccountId: string;
    [key: string]: any;
  };
  businessAccountId?: string;
}

/**
 * Enhanced middleware to check if user has access to a specific module
 * with proper security validation and audit logging
 */
export function requireModuleAccess(moduleType: string, action: 'view' | 'create' | 'edit' | 'delete' = 'view') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        secureLog({
          level: 'warn',
          action: 'MODULE_ACCESS_NO_USER',
          details: {
            moduleType,
            action,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path
          }
        });
        return res.status(401).json({ message: "Autenticación requerida" });
      }

      // SUPER_ADMIN has access to all modules
      if (req.user.role === 'SUPER_ADMIN') {
        secureLog({
          level: 'debug',
          action: 'MODULE_ACCESS_GRANTED_SUPER_ADMIN',
          details: {
            userId: req.user.id,
            moduleType,
            action,
            ipAddress: req.ip
          }
        });
        return next();
      }

      // Check business account and plan module access
      const moduleAccessQuery = await pool.query(`
        SELECT pm.is_included, pm.limit_value, ba.plan_id
        FROM business_accounts ba
        JOIN plans p ON ba.plan_id = p.id
        JOIN plan_modules pm ON p.id = pm.plan_id
        WHERE ba.id = $1 AND pm.module_type = $2 AND ba.is_active = true
      `, [req.user.businessAccountId, moduleType]);

      if (moduleAccessQuery.rows.length === 0) {
        secureLog({
          level: 'warn',
          action: 'MODULE_NOT_INCLUDED_IN_PLAN',
          details: {
            userId: req.user.id,
            moduleType,
            action,
            businessAccountId: req.user.businessAccountId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        });
        return res.status(403).json({ 
          message: `El módulo ${moduleType} no está incluido en su plan actual`,
          code: 'MODULE_NOT_INCLUDED'
        });
      }

      const moduleAccess = moduleAccessQuery.rows[0];
      if (!moduleAccess.is_included) {
        secureLog({
          level: 'warn',
          action: 'MODULE_ACCESS_DENIED_PLAN',
          details: {
            userId: req.user.id,
            moduleType,
            action,
            planId: moduleAccess.plan_id,
            businessAccountId: req.user.businessAccountId,
            ipAddress: req.ip
          }
        });
        return res.status(403).json({ 
          message: `Acceso denegado al módulo ${moduleType}`,
          code: 'MODULE_ACCESS_DENIED'
        });
      }

      // For non-SUPER_ADMIN users, check specific user permissions
      if (req.user.role !== 'SUPER_ADMIN') {
        const userPermissionQuery = await pool.query(`
          SELECT can_view, can_create, can_edit, can_delete
          FROM user_permissions
          WHERE user_id = $1 AND module_type = $2
        `, [req.user.id, moduleType]);

        // If no specific permissions exist, check role-based defaults
        let hasPermission = false;
        
        if (userPermissionQuery.rows.length > 0) {
          const perms = userPermissionQuery.rows[0];
          hasPermission = perms[`can_${action}`] === true;
        } else {
          // Default permissions for BUSINESS_ADMIN
          if (req.user.role === 'BUSINESS_ADMIN') {
            hasPermission = true; // BUSINESS_ADMIN has all permissions by default
          } else {
            // For USER role, default to view-only for most modules
            hasPermission = action === 'view';
          }
        }

        if (!hasPermission) {
          secureLog({
            level: 'warn',
            action: 'MODULE_ACTION_PERMISSION_DENIED',
            details: {
              userId: req.user.id,
              moduleType,
              action,
              userRole: req.user.role,
              businessAccountId: req.user.businessAccountId,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent')
            }
          });
          return res.status(403).json({ 
            message: `No tienes permisos para ${action} en el módulo ${moduleType}`,
            code: 'ACTION_PERMISSION_DENIED'
          });
        }
      }

      // Check usage limits for create actions
      if (action === 'create' && moduleAccess.limit_value) {
        const usageQuery = await pool.query(`
          SELECT COUNT(*) as current_count
          FROM ${getModuleTable(moduleType)}
          WHERE business_account_id = $1
        `, [req.user.businessAccountId]);

        const currentCount = parseInt(usageQuery.rows[0]?.current_count || '0');
        
        if (currentCount >= moduleAccess.limit_value) {
          secureLog({
            level: 'warn',
            action: 'MODULE_USAGE_LIMIT_EXCEEDED',
            details: {
              userId: req.user.id,
              moduleType,
              currentCount,
              limitValue: moduleAccess.limit_value,
              businessAccountId: req.user.businessAccountId,
              ipAddress: req.ip
            }
          });
          return res.status(403).json({ 
            message: `Has alcanzado el límite de ${moduleAccess.limit_value} elementos para ${moduleType}`,
            code: 'USAGE_LIMIT_EXCEEDED',
            currentCount,
            limit: moduleAccess.limit_value
          });
        }
      }

      secureLog({
        level: 'debug',
        action: 'MODULE_ACCESS_GRANTED',
        details: {
          userId: req.user.id,
          moduleType,
          action,
          businessAccountId: req.user.businessAccountId,
          ipAddress: req.ip
        }
      });

      next();
    } catch (error) {
      secureLog({
        level: 'error',
        action: 'MODULE_ACCESS_CHECK_ERROR',
        details: {
          error: error.message,
          moduleType,
          action,
          userId: req.user?.id,
          businessAccountId: req.user?.businessAccountId,
          ipAddress: req.ip
        }
      });
      res.status(500).json({ message: "Error interno del servidor" });
    }
  };
}

/**
 * Enhanced role validation middleware with audit logging
 */
export function requireRoleWithAudit(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        secureLog({
          level: 'warn',
          action: 'ROLE_CHECK_NO_USER',
          details: {
            allowedRoles,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path
          }
        });
        return res.status(401).json({ message: "Autenticación requerida" });
      }

      if (!allowedRoles.includes(req.user.role as UserRole)) {
        secureLog({
          level: 'warn',
          action: 'INSUFFICIENT_ROLE_ACCESS',
          details: {
            userId: req.user.id,
            userRole: req.user.role,
            allowedRoles,
            businessAccountId: req.user.businessAccountId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path
          }
        });
        return res.status(403).json({ 
          message: "No tienes los permisos necesarios para acceder a este recurso",
          code: 'INSUFFICIENT_ROLE'
        });
      }

      secureLog({
        level: 'debug',
        action: 'ROLE_ACCESS_GRANTED',
        details: {
          userId: req.user.id,
          userRole: req.user.role,
          allowedRoles,
          businessAccountId: req.user.businessAccountId,
          ipAddress: req.ip,
          path: req.path
        }
      });

      next();
    } catch (error) {
      secureLog({
        level: 'error',
        action: 'ROLE_CHECK_ERROR',
        details: {
          error: error.message,
          userId: req.user?.id,
          allowedRoles,
          ipAddress: req.ip
        }
      });
      res.status(500).json({ message: "Error interno del servidor" });
    }
  };
}

/**
 * Enhanced business account validation with cross-account protection
 */
export function requireBusinessAccountWithValidation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Autenticación requerida" });
    }

    // SUPER_ADMIN can access any business account
    if (req.user.role === 'SUPER_ADMIN') {
      // Allow SUPER_ADMIN to specify business account via query parameter
      req.businessAccountId = req.query.businessAccountId as string || req.user.businessAccountId;
    } else {
      // Other roles are restricted to their own business account
      req.businessAccountId = req.user.businessAccountId;
    }

    if (!req.businessAccountId) {
      secureLog({
        level: 'warn',
        action: 'MISSING_BUSINESS_ACCOUNT',
        details: {
          userId: req.user.id,
          userRole: req.user.role,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path
        }
      });
      return res.status(400).json({ 
        message: "Business account requerido",
        code: 'MISSING_BUSINESS_ACCOUNT'
      });
    }

    next();
  } catch (error) {
    secureLog({
      level: 'error',
      action: 'BUSINESS_ACCOUNT_CHECK_ERROR',
      details: {
        error: error.message,
        userId: req.user?.id,
        ipAddress: req.ip
      }
    });
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

/**
 * Get the database table name for a module type
 */
function getModuleTable(moduleType: string): string {
  const moduleTableMap: Record<string, string> = {
    'USERS': 'users',
    'CONTACTS': 'companies', // Assuming contacts are stored in companies table
    'CRM': 'opportunities'
  };
  
  return moduleTableMap[moduleType] || 'unknown_table';
}

/**
 * Rate limiting middleware for sensitive operations
 */
export function rateLimitSensitiveOperation(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
  const attempts = new Map<string, { count: number; resetTime: number }>();
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const key = `${req.ip}-${req.user?.id || 'anonymous'}`;
      const now = Date.now();
      
      let userAttempts = attempts.get(key);
      
      if (!userAttempts || now > userAttempts.resetTime) {
        userAttempts = { count: 0, resetTime: now + windowMs };
      }
      
      userAttempts.count++;
      attempts.set(key, userAttempts);
      
      if (userAttempts.count > maxAttempts) {
        secureLog({
          level: 'warn',
          action: 'RATE_LIMIT_EXCEEDED',
          details: {
            userId: req.user?.id,
            ipAddress: req.ip,
            attempts: userAttempts.count,
            maxAttempts,
            windowMs,
            userAgent: req.get('User-Agent'),
            path: req.path
          }
        });
        
        return res.status(429).json({
          message: "Demasiados intentos. Intenta de nuevo más tarde.",
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((userAttempts.resetTime - now) / 1000)
        });
      }
      
      // Clean up expired entries periodically
      if (Math.random() < 0.01) { // 1% chance to clean up
        for (const [k, v] of attempts.entries()) {
          if (now > v.resetTime) {
            attempts.delete(k);
          }
        }
      }
      
      next();
    } catch (error) {
      secureLog({
        level: 'error',
        action: 'RATE_LIMIT_CHECK_ERROR',
        details: {
          error: error.message,
          userId: req.user?.id,
          ipAddress: req.ip
        }
      });
      // Don't fail the request on rate limit check error
      next();
    }
  };
}