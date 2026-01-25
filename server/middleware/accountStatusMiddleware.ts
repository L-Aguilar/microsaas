import { Request, Response, NextFunction } from 'express';
import { suspensionService } from '../services/suspensionService';
import { secureLog } from '../utils/secureLogger';

interface AuthenticatedRequest extends Request {
  user?: any;
  businessAccountId?: string;
}

export interface AccountStatusInfo {
  isSuspended: boolean;
  canUseApp: boolean;
  suspensionMessage?: {
    type: 'info' | 'warning' | 'error';
    title: string;
    message: string;
    actionLabel?: string;
    actionUrl?: string;
    showPaymentUpdate?: boolean;
  };
  restrictedActions?: string[];
}

/**
 * Middleware para verificar el estado de la cuenta (suspensión, pagos, etc.)
 * Agrega información del estado de la cuenta al request para uso posterior
 */
export async function checkAccountStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Si no hay usuario autenticado o business account, continuar
    if (!req.user || !req.businessAccountId) {
      return next();
    }

    const businessAccountId = req.businessAccountId;
    const userRole = req.user.role;

    // Obtener información de suspensión
    const suspensionInfo = await suspensionService.getSuspensionInfo(businessAccountId);
    const suspensionMessage = await suspensionService.getSuspensionMessage(businessAccountId, userRole);

    // Agregar información al request para uso posterior
    (req as any).accountStatus = {
      isSuspended: suspensionInfo.isSuspended,
      canUseApp: !suspensionMessage || suspensionMessage.canUseApp,
      suspensionMessage: suspensionMessage,
      paymentStatus: suspensionInfo.paymentStatus,
      isInGracePeriod: suspensionInfo.isInGracePeriod
    } as AccountStatusInfo;

    // Log de acceso con estado de cuenta
    secureLog('account_access_check', {
      businessAccountId,
      userId: req.user.id,
      userRole,
      paymentStatus: suspensionInfo.paymentStatus,
      isSuspended: suspensionInfo.isSuspended,
      canUseApp: !suspensionMessage || suspensionMessage.canUseApp
    });

    next();

  } catch (error) {
    secureLog('account_status_check_error', {
      businessAccountId: req.businessAccountId,
      userId: req.user?.id,
      error: error.message
    });

    // En caso de error, permitir acceso pero marcar como degradado
    (req as any).accountStatus = {
      isSuspended: false,
      canUseApp: true,
      suspensionMessage: {
        type: 'warning',
        title: 'Estado de Cuenta No Verificado',
        message: 'No se pudo verificar el estado de la cuenta. Algunas funciones pueden estar limitadas.',
        canUseApp: true
      }
    } as AccountStatusInfo;

    next();
  }
}

/**
 * Middleware para bloquear acceso si la cuenta está suspendida
 */
export async function requireActiveAccount(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const accountStatus = (req as any).accountStatus as AccountStatusInfo;

    // Si no se ejecutó checkAccountStatus previamente, ejecutarlo ahora
    if (!accountStatus && req.businessAccountId) {
      await checkAccountStatus(req, res, () => {});
    }

    const status = (req as any).accountStatus as AccountStatusInfo;

    // Si la cuenta está suspendida y no puede usar la app
    if (status && status.isSuspended && !status.canUseApp) {
      secureLog('suspended_account_access_blocked', {
        businessAccountId: req.businessAccountId,
        userId: req.user?.id,
        endpoint: req.path
      });

      return res.status(403).json({
        error: 'ACCOUNT_SUSPENDED',
        message: status.suspensionMessage?.message || 'La cuenta está suspendida',
        suspensionInfo: status.suspensionMessage
      });
    }

    next();

  } catch (error) {
    secureLog('active_account_check_error', {
      businessAccountId: req.businessAccountId,
      userId: req.user?.id,
      error: error.message
    });

    // En caso de error, denegar acceso por seguridad
    res.status(500).json({
      error: 'ACCOUNT_STATUS_ERROR',
      message: 'Error al verificar el estado de la cuenta'
    });
  }
}

/**
 * Middleware para verificar si se puede realizar una acción específica
 */
export function requireActionPermission(action: 'create_user' | 'modify_data' | 'view_reports' | 'export_data') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.businessAccountId) {
        return next(); // Sin business account, no aplicar restricciones
      }

      // Verificar si la acción está permitida
      const permissionCheck = await suspensionService.canPerformAction(req.businessAccountId, action);

      if (!permissionCheck.allowed) {
        secureLog('restricted_action_blocked', {
          businessAccountId: req.businessAccountId,
          userId: req.user?.id,
          action,
          reason: permissionCheck.reason
        });

        return res.status(403).json({
          error: 'ACTION_RESTRICTED',
          message: permissionCheck.reason || 'Esta acción no está permitida',
          restrictedAction: action
        });
      }

      next();

    } catch (error) {
      secureLog('action_permission_check_error', {
        businessAccountId: req.businessAccountId,
        userId: req.user?.id,
        action,
        error: error.message
      });

      res.status(500).json({
        error: 'PERMISSION_CHECK_ERROR',
        message: 'Error al verificar permisos de la acción'
      });
    }
  };
}

/**
 * Middleware para agregar información de estado de cuenta a las respuestas
 * Útil para endpoints que necesitan mostrar información de suspensión en el frontend
 */
export async function includeAccountStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Ejecutar check de estado si no se ha hecho
    const accountStatus = (req as any).accountStatus as AccountStatusInfo;
    if (!accountStatus && req.businessAccountId) {
      await checkAccountStatus(req, res, () => {});
    }

    // Sobrescribir res.json para incluir información de cuenta
    const originalJson = res.json.bind(res);
    
    res.json = function(data: any) {
      const status = (req as any).accountStatus as AccountStatusInfo;
      
      // Solo incluir información de suspensión si existe un mensaje
      const responseData = status?.suspensionMessage ? {
        ...data,
        accountStatus: {
          suspensionMessage: status.suspensionMessage,
          canUseApp: status.canUseApp,
          isSuspended: status.isSuspended
        }
      } : data;

      return originalJson(responseData);
    };

    next();

  } catch (error) {
    secureLog('include_account_status_error', {
      businessAccountId: req.businessAccountId,
      userId: req.user?.id,
      error: error.message
    });
    next(); // Continuar sin modificar la respuesta
  }
}

/**
 * Middleware específico para endpoints de creación de usuarios
 * Verifica límites y sugiere auto-upgrade si es necesario
 */
export async function checkUserLimits(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.businessAccountId) {
      return next();
    }

    // Importar upsellService aquí para evitar dependencias circulares
    const { upsellService } = await import('../services/upsellService');
    
    const validation = await upsellService.validateUserCreation(req.businessAccountId);

    if (!validation.allowed) {
      secureLog('user_limit_reached', {
        businessAccountId: req.businessAccountId,
        userId: req.user?.id,
        currentCount: validation.currentCount,
        limit: validation.limit,
        autoUpgradeAvailable: validation.autoUpgradeAvailable
      });

      return res.status(403).json({
        error: 'USER_LIMIT_REACHED',
        message: validation.message,
        currentCount: validation.currentCount,
        limit: validation.limit,
        autoUpgradeAvailable: validation.autoUpgradeAvailable,
        suggestedAction: validation.autoUpgradeAvailable ? 
          'Puedes activar usuarios adicionales automáticamente' : 
          'Upgrade tu plan para agregar más usuarios'
      });
    }

    // Agregar información de límites al request
    (req as any).userLimits = {
      currentCount: validation.currentCount,
      limit: validation.limit,
      remaining: validation.limit - validation.currentCount
    };

    next();

  } catch (error) {
    secureLog('user_limits_check_error', {
      businessAccountId: req.businessAccountId,
      userId: req.user?.id,
      error: error.message
    });

    // En caso de error, permitir la acción pero sin información de límites
    next();
  }
}