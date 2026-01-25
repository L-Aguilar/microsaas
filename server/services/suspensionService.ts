import { pool } from '../db';
import { secureLog } from '../utils/secureLogger';
import { stripeService } from './stripeService';

export interface SuspensionInfo {
  isSuspended: boolean;
  suspendedAt?: Date;
  suspensionReason?: string;
  paymentStatus: 'active' | 'past_due' | 'canceled' | 'suspended';
  daysOverdue?: number;
  outstandingBalance?: number;
  isInGracePeriod: boolean;
  gracePeriodEndsAt?: Date;
}

export interface SuspensionMessage {
  type: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  canUseApp: boolean;
  showPaymentUpdate?: boolean;
}

export class SuspensionService {
  private readonly GRACE_PERIOD_DAYS = 3; // Período de gracia tras fallo de pago
  private readonly SUSPENSION_DELAY_DAYS = 7; // Días hasta suspensión total

  /**
   * Obtiene el estado de suspensión de una business account
   */
  async getSuspensionInfo(businessAccountId: string): Promise<SuspensionInfo> {
    try {
      const result = await pool.query(`
        SELECT payment_status, suspended_at, suspension_reason,
               last_payment_failure_date, outstanding_balance,
               next_billing_date
        FROM business_accounts
        WHERE id = $1
      `, [businessAccountId]);

      const account = result.rows[0];
      if (!account) {
        throw new Error(`Business account not found: ${businessAccountId}`);
      }

      const now = new Date();
      const paymentStatus = account.payment_status || 'active';
      const isSuspended = paymentStatus === 'suspended' || account.suspended_at !== null;
      
      let daysOverdue = 0;
      let isInGracePeriod = false;
      let gracePeriodEndsAt = undefined;

      // Calcular días de retraso si hay fallo de pago
      if (account.last_payment_failure_date) {
        const failureDate = new Date(account.last_payment_failure_date);
        daysOverdue = Math.floor((now.getTime() - failureDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Determinar si está en período de gracia
        if (daysOverdue <= this.GRACE_PERIOD_DAYS && !isSuspended) {
          isInGracePeriod = true;
          gracePeriodEndsAt = new Date(failureDate.getTime() + (this.GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000));
        }
      }

      return {
        isSuspended,
        suspendedAt: account.suspended_at,
        suspensionReason: account.suspension_reason,
        paymentStatus,
        daysOverdue: daysOverdue > 0 ? daysOverdue : undefined,
        outstandingBalance: parseFloat(account.outstanding_balance || '0'),
        isInGracePeriod,
        gracePeriodEndsAt
      };

    } catch (error) {
      secureLog('suspension_info_error', {
        businessAccountId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Genera mensaje de suspensión personalizado según el rol del usuario
   */
  async getSuspensionMessage(
    businessAccountId: string, 
    userRole: 'USER' | 'BUSINESS_ADMIN' | 'SUPER_ADMIN'
  ): Promise<SuspensionMessage | null> {
    try {
      const suspensionInfo = await this.getSuspensionInfo(businessAccountId);

      // Si no hay problemas de pago, no mostrar mensaje
      if (suspensionInfo.paymentStatus === 'active' && !suspensionInfo.isSuspended) {
        return null;
      }

      // Mensajes para BUSINESS_ADMIN (acceso completo a gestión)
      if (userRole === 'BUSINESS_ADMIN') {
        return this.getBusinessAdminMessage(suspensionInfo);
      }

      // Mensajes para usuarios regulares (información limitada)
      return this.getRegularUserMessage(suspensionInfo);

    } catch (error) {
      secureLog('suspension_message_error', {
        businessAccountId,
        userRole,
        error: error.message
      });
      throw error;
    }
  }

  private getBusinessAdminMessage(info: SuspensionInfo): SuspensionMessage {
    // Cuenta completamente suspendida
    if (info.isSuspended) {
      return {
        type: 'error',
        title: 'Cuenta Suspendida',
        message: `Tu cuenta ha sido suspendida ${info.suspensionReason ? `por: ${info.suspensionReason}` : 'debido a problemas de pago'}. Para reactivarla, actualiza tu método de pago y contacta a soporte.`,
        actionLabel: 'Actualizar Método de Pago',
        actionUrl: '/billing/payment-methods',
        canUseApp: false,
        showPaymentUpdate: true
      };
    }

    // Período de gracia
    if (info.isInGracePeriod && info.gracePeriodEndsAt) {
      const daysLeft = Math.ceil((info.gracePeriodEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return {
        type: 'warning',
        title: 'Problema con el Pago',
        message: `Tu último pago falló. Tienes ${daysLeft} día${daysLeft !== 1 ? 's' : ''} para actualizar tu método de pago antes de que la cuenta sea suspendida.`,
        actionLabel: 'Resolver Ahora',
        actionUrl: '/billing/payment-methods',
        canUseApp: true,
        showPaymentUpdate: true
      };
    }

    // Past due sin suspensión aún
    if (info.paymentStatus === 'past_due') {
      return {
        type: 'error',
        title: 'Pago Atrasado',
        message: `Tu cuenta tiene pagos pendientes${info.outstandingBalance ? ` por $${info.outstandingBalance.toFixed(2)}` : ''}. La cuenta será suspendida pronto si no se resuelve.`,
        actionLabel: 'Pagar Ahora',
        actionUrl: '/billing/payment-methods',
        canUseApp: true,
        showPaymentUpdate: true
      };
    }

    // Cancelada
    if (info.paymentStatus === 'canceled') {
      return {
        type: 'error',
        title: 'Suscripción Cancelada',
        message: 'Tu suscripción ha sido cancelada. Para continuar usando BizFlowCRM, reactiva tu plan.',
        actionLabel: 'Reactivar Plan',
        actionUrl: '/billing/reactivate',
        canUseApp: false,
        showPaymentUpdate: true
      };
    }

    return {
      type: 'warning',
      title: 'Problema de Facturación',
      message: 'Hay un problema con tu cuenta. Por favor verifica tu información de pago.',
      actionLabel: 'Revisar Facturación',
      actionUrl: '/billing',
      canUseApp: true,
      showPaymentUpdate: true
    };
  }

  private getRegularUserMessage(info: SuspensionInfo): SuspensionMessage {
    // Cuenta completamente suspendida
    if (info.isSuspended) {
      return {
        type: 'error',
        title: 'Cuenta No Disponible',
        message: 'Tu cuenta está temporalmente no disponible. Por favor contacta al administrador de tu empresa para más información.',
        canUseApp: false
      };
    }

    // Período de gracia o past due
    if (info.isInGracePeriod || info.paymentStatus === 'past_due') {
      return {
        type: 'warning',
        title: 'Acceso Limitado',
        message: 'Tu cuenta tiene acceso limitado debido a problemas administrativos. Contacta al administrador de tu empresa.',
        canUseApp: true
      };
    }

    // Cancelada
    if (info.paymentStatus === 'canceled') {
      return {
        type: 'info',
        title: 'Servicio No Disponible',
        message: 'El servicio no está disponible en este momento. Contacta al administrador de tu empresa.',
        canUseApp: false
      };
    }

    return {
      type: 'info',
      title: 'Problema Temporal',
      message: 'Hay un problema temporal con la cuenta. Contacta al administrador de tu empresa.',
      canUseApp: true
    };
  }

  /**
   * Suspende una cuenta por falta de pago
   */
  async suspendAccount(
    businessAccountId: string,
    reason: string = 'Falta de pago',
    triggeredByUserId?: string
  ): Promise<void> {
    try {
      await pool.query(`
        UPDATE business_accounts 
        SET suspended_at = NOW(),
            suspension_reason = $1,
            payment_status = 'suspended'
        WHERE id = $2
      `, [reason, businessAccountId]);

      // Crear log de auditoría
      await pool.query(`
        INSERT INTO upselling_audit_log (
          business_account_id, trigger_action, metadata, triggered_by_user_id
        ) VALUES ($1, 'ACCOUNT_SUSPENDED', $2, $3)
      `, [
        businessAccountId,
        JSON.stringify({ suspension_reason: reason }),
        triggeredByUserId
      ]);

      secureLog('account_suspended', {
        businessAccountId,
        reason,
        triggeredByUserId
      });

    } catch (error) {
      secureLog('account_suspension_failed', {
        businessAccountId,
        reason,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Reactiva una cuenta suspendida
   */
  async reactivateAccount(
    businessAccountId: string,
    triggeredByUserId?: string
  ): Promise<void> {
    try {
      await pool.query(`
        UPDATE business_accounts 
        SET suspended_at = NULL,
            suspension_reason = NULL,
            payment_status = 'active',
            last_payment_failure_date = NULL
        WHERE id = $1
      `, [businessAccountId]);

      // Crear log de auditoría
      await pool.query(`
        INSERT INTO upselling_audit_log (
          business_account_id, trigger_action, metadata, triggered_by_user_id
        ) VALUES ($1, 'ACCOUNT_REACTIVATED', $2, $3)
      `, [
        businessAccountId,
        JSON.stringify({ reactivated_at: new Date().toISOString() }),
        triggeredByUserId
      ]);

      secureLog('account_reactivated', {
        businessAccountId,
        triggeredByUserId
      });

    } catch (error) {
      secureLog('account_reactivation_failed', {
        businessAccountId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Proceso automático de suspensión para cuentas con pagos vencidos
   */
  async processOverdueAccounts(): Promise<{
    suspended: number;
    warnings: number;
    errors: string[];
  }> {
    try {
      const result = {
        suspended: 0,
        warnings: 0,
        errors: []
      };

      // Buscar cuentas con pagos vencidos
      const overdueAccounts = await pool.query(`
        SELECT id, last_payment_failure_date, payment_status, name
        FROM business_accounts
        WHERE last_payment_failure_date IS NOT NULL
        AND payment_status != 'suspended'
        AND suspended_at IS NULL
      `);

      const now = new Date();

      for (const account of overdueAccounts.rows) {
        try {
          const failureDate = new Date(account.last_payment_failure_date);
          const daysOverdue = Math.floor((now.getTime() - failureDate.getTime()) / (1000 * 60 * 60 * 24));

          // Suspender si supera el período permitido
          if (daysOverdue >= this.SUSPENSION_DELAY_DAYS) {
            await this.suspendAccount(
              account.id,
              `Suspensión automática: ${daysOverdue} días sin pago`
            );
            result.suspended++;
            
            secureLog('auto_suspension_executed', {
              businessAccountId: account.id,
              accountName: account.name,
              daysOverdue
            });
          } else if (daysOverdue >= this.GRACE_PERIOD_DAYS) {
            // Enviar advertencia si está fuera del período de gracia pero antes de suspensión
            result.warnings++;
            
            secureLog('overdue_warning', {
              businessAccountId: account.id,
              accountName: account.name,
              daysOverdue
            });
          }

        } catch (error) {
          result.errors.push(`Error processing account ${account.id}: ${error.message}`);
        }
      }

      secureLog('overdue_accounts_processed', {
        totalProcessed: overdueAccounts.rows.length,
        suspended: result.suspended,
        warnings: result.warnings,
        errors: result.errors.length
      });

      return result;

    } catch (error) {
      secureLog('overdue_processing_failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Verifica si una business account puede realizar una acción específica
   */
  async canPerformAction(
    businessAccountId: string,
    action: 'create_user' | 'modify_data' | 'view_reports' | 'export_data'
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const suspensionInfo = await this.getSuspensionInfo(businessAccountId);

      // Cuenta suspendida - no permitir nada crítico
      if (suspensionInfo.isSuspended) {
        return {
          allowed: false,
          reason: 'La cuenta está suspendida debido a problemas de pago'
        };
      }

      // Cuenta cancelada - solo lectura
      if (suspensionInfo.paymentStatus === 'canceled') {
        const readOnlyActions = ['view_reports'];
        return {
          allowed: readOnlyActions.includes(action),
          reason: readOnlyActions.includes(action) ? undefined : 'La suscripción está cancelada'
        };
      }

      // Past due - restricciones según el tipo de acción
      if (suspensionInfo.paymentStatus === 'past_due') {
        const restrictedActions = ['create_user', 'export_data'];
        if (restrictedActions.includes(action)) {
          return {
            allowed: false,
            reason: 'Pagos pendientes - funcionalidad restringida'
          };
        }
      }

      // Por defecto, permitir la acción
      return { allowed: true };

    } catch (error) {
      secureLog('action_permission_check_failed', {
        businessAccountId,
        action,
        error: error.message
      });
      
      // En caso de error, denegar por seguridad
      return {
        allowed: false,
        reason: 'Error al verificar permisos de la cuenta'
      };
    }
  }
}

export const suspensionService = new SuspensionService();