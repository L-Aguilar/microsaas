import { Request, Response, NextFunction } from 'express';
import { planService } from '../services/planService';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    businessAccountId: string;
    role: string;
    [key: string]: any;
  };
}

/**
 * Middleware para verificar límites de plan antes de realizar acciones
 */
export function checkPlanLimits(moduleType: string, action: 'create' | 'edit' | 'delete' | 'view' = 'create') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Skip limit checks for SUPER_ADMIN
      if (req.user?.role === 'SUPER_ADMIN') {
        return next();
      }

      if (!req.user?.businessAccountId) {
        return res.status(403).json({
          error: 'MISSING_BUSINESS_ACCOUNT',
          message: 'No se pudo determinar la cuenta de negocio del usuario'
        });
      }

      // Check plan limits
      const limitCheck = await planService.checkLimit(
        req.user.businessAccountId,
        moduleType,
        action
      );

      if (!limitCheck.canProceed) {
        return res.status(403).json({
          error: 'PLAN_LIMIT_EXCEEDED',
          message: limitCheck.message,
          details: {
            moduleType,
            action,
            currentCount: limitCheck.currentCount,
            limit: limitCheck.limit
          }
        });
      }

      // Add limit info to request for use in route handlers
      req.planLimits = limitCheck;
      next();

    } catch (error) {
      console.error('Error checking plan limits:', error);
      return res.status(500).json({
        error: 'PLAN_CHECK_ERROR',
        message: 'Error al verificar límites del plan'
      });
    }
  };
}

/**
 * Middleware para obtener permisos de módulo y adjuntarlos al request
 */
export function attachModulePermissions(moduleType: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Skip for SUPER_ADMIN - they have all permissions
      if (req.user?.role === 'SUPER_ADMIN') {
        req.modulePermissions = {
          canCreate: true,
          canEdit: true,
          canDelete: true,
          canView: true,
          itemLimit: null,
          currentCount: 0
        };
        return next();
      }

      if (!req.user?.businessAccountId) {
        return res.status(403).json({
          error: 'MISSING_BUSINESS_ACCOUNT',
          message: 'No se pudo determinar la cuenta de negocio del usuario'
        });
      }

      const permissions = await planService.getModulePermissions(
        req.user.businessAccountId,
        moduleType
      );

      if (!permissions.canView) {
        return res.status(403).json({
          error: 'MODULE_NOT_AVAILABLE',
          message: `No tienes acceso al módulo ${moduleType}`
        });
      }

      req.modulePermissions = permissions;
      next();

    } catch (error) {
      console.error('Error getting module permissions:', error);
      return res.status(500).json({
        error: 'PERMISSIONS_CHECK_ERROR',
        message: 'Error al verificar permisos del módulo'
      });
    }
  };
}

/**
 * Middleware para actualizar el uso después de crear/eliminar elementos
 */
export function updateUsageAfterAction(moduleType: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Skip for SUPER_ADMIN
      if (req.user?.role === 'SUPER_ADMIN') {
        return next();
      }

      if (req.user?.businessAccountId) {
        // Update usage count asynchronously
        planService.updateUsage(req.user.businessAccountId, moduleType)
          .catch(error => {
            console.error('Error updating usage:', error);
          });
      }

      next();

    } catch (error) {
      console.error('Error in updateUsageAfterAction:', error);
      next(); // Don't fail the request for usage update errors
    }
  };
}

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      planLimits?: {
        canProceed: boolean;
        currentCount: number;
        limit: number | null;
        message?: string;
      };
      modulePermissions?: {
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canView: boolean;
        itemLimit: number | null;
        currentCount: number;
      };
    }
  }
}