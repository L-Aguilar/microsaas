import { pool } from '../db';
import { 
  Plan, 
  Product, 
  PlanModule, 
  BusinessAccountPlan, 
  BusinessAccountProduct,
  PlanUsage,
  LimitCheckResult,
  ModulePermissions,
  AVAILABLE_MODULES 
} from '@shared/schema';

export class PlanService {
  
  /**
   * Obtiene el plan actual y productos adicionales de una business account
   */
  async getBusinessAccountSubscription(businessAccountId: string): Promise<{
    currentPlan: BusinessAccountPlan & { plan: Plan; modules: PlanModule[] } | null;
    additionalProducts: (BusinessAccountProduct & { product: Product })[];
  }> {
    // Get current plan
    const currentPlanQuery = `
      SELECT 
        bap.*,
        p.*,
        pm.module_type,
        pm.is_included,
        pm.item_limit,
        pm.features
      FROM business_account_plans bap
      INNER JOIN plans p ON bap.plan_id = p.id
      LEFT JOIN plan_modules pm ON p.id = pm.plan_id
      WHERE bap.business_account_id = $1
        AND bap.status IN ('TRIAL', 'ACTIVE')
      ORDER BY bap.created_at DESC
      LIMIT 1
    `;

    const currentPlanResult = await pool.query(currentPlanQuery, [businessAccountId]);
    
    let currentPlan = null;
    if (currentPlanResult.rows.length > 0) {
      const planRow = currentPlanResult.rows[0];
      currentPlan = {
        ...planRow,
        plan: {
          id: planRow.id,
          name: planRow.name,
          description: planRow.description,
          price: planRow.price,
          billingFrequency: planRow.billing_frequency,
          trialDays: planRow.trial_days,
          status: planRow.status,
          isDefault: planRow.is_default,
          displayOrder: planRow.display_order,
          features: planRow.features,
          createdAt: planRow.created_at,
          updatedAt: planRow.updated_at
        },
        modules: currentPlanResult.rows
          .filter((row: any) => row.module_type)
          .map((row: any) => ({
            id: `${planRow.id}-${row.module_type}`,
            planId: planRow.id,
            moduleType: row.module_type,
            isIncluded: row.is_included,
            itemLimit: row.item_limit,
            features: row.features
          }))
      };
    }

    // Get additional products
    const additionalProductsQuery = `
      SELECT 
        bap.*,
        p.*
      FROM business_account_products bap
      INNER JOIN products p ON bap.product_id = p.id
      WHERE bap.business_account_id = $1
        AND bap.status = 'ACTIVE'
    `;

    const additionalProductsResult = await pool.query(additionalProductsQuery, [businessAccountId]);
    const additionalProducts = additionalProductsResult.rows.map((row: any) => ({
      ...row,
      product: {
        id: row.id,
        name: row.name,
        description: row.description,
        type: row.type,
        price: row.price,
        billingFrequency: row.billing_frequency,
        moduleType: row.module_type,
        isActive: row.is_active,
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    }));

    return { currentPlan, additionalProducts };
  }

  /**
   * Verifica si se puede realizar una acción según los límites del plan
   */
  async checkLimit(
    businessAccountId: string,
    moduleType: string,
    action: 'create' | 'edit' | 'delete' | 'view' = 'create'
  ): Promise<LimitCheckResult> {
    // For non-create actions, use the simpler check without transactions
    if (action !== 'create') {
      return this.checkNonCreateLimit(businessAccountId, moduleType, action);
    }

    // For create actions, use transaction-based atomic checking
    const { pool } = await import('../db');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      
      // Get subscription info
      const subscription = await this.getBusinessAccountSubscription(businessAccountId);
      
      if (!subscription.currentPlan) {
        await client.query('ROLLBACK');
        return {
          canProceed: false,
          currentCount: 0,
          limit: 0,
          message: 'No tienes un plan activo. Por favor, contacta al administrador.'
        };
      }

      // Check if module is included in current plan
      const planModule = subscription.currentPlan.modules.find(
        m => m.moduleType === moduleType && m.isIncluded
      );

      // Check if module is available through additional products
      const additionalProduct = subscription.additionalProducts.find(
        p => p.product.moduleType === moduleType && p.product.type === 'MODULE'
      );

      if (!planModule && !additionalProduct) {
        await client.query('ROLLBACK');
        return {
          canProceed: false,
          currentCount: 0,
          limit: 0,
          message: `El módulo ${AVAILABLE_MODULES[moduleType as keyof typeof AVAILABLE_MODULES]?.name || moduleType} no está incluido en tu plan actual.`
        };
      }

      // Check create permissions
      const permissions = planModule || { canCreate: true, canEdit: true, canDelete: true };
      if (!permissions.canCreate) {
        await client.query('ROLLBACK');
        return {
          canProceed: false,
          currentCount: 0,
          limit: 0,
          message: `Tu plan no permite crear nuevos elementos en ${moduleType}.`
        };
      }

      // ATOMIC: Lock and check current usage with SELECT FOR UPDATE
      let currentUsage = 0;
      const limit = this.getEffectiveLimit(businessAccountId, moduleType, subscription);
      
      if (limit !== null) {
        // Lock the usage record to prevent race conditions
        const usageQuery = this.getLockingUsageQuery(moduleType);
        const usageResult = await client.query(usageQuery, [businessAccountId]);
        currentUsage = usageResult.rows.length;

        // Check if we're at the limit
        if (currentUsage >= limit) {
          await client.query('ROLLBACK');
          const moduleName = AVAILABLE_MODULES[moduleType as keyof typeof AVAILABLE_MODULES]?.name || moduleType;
          return {
            canProceed: false,
            currentCount: currentUsage,
            limit,
            message: `Has alcanzado el límite de ${limit} ${moduleName.toLowerCase()}. Actualiza tu plan para crear más.`
          };
        }
      }

      await client.query('COMMIT');
      return {
        canProceed: true,
        currentCount: currentUsage,
        limit,
        message: undefined
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in checkLimit transaction:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Helper method for non-create actions (no transaction needed)
   */
  private async checkNonCreateLimit(
    businessAccountId: string,
    moduleType: string,
    action: 'edit' | 'delete' | 'view'
  ): Promise<LimitCheckResult> {
    const subscription = await this.getBusinessAccountSubscription(businessAccountId);
    
    if (!subscription.currentPlan) {
      return {
        canProceed: false,
        currentCount: 0,
        limit: 0,
        message: 'No tienes un plan activo. Por favor, contacta al administrador.'
      };
    }

    // Check if module is included in current plan
    const planModule = subscription.currentPlan.modules.find(
      m => m.moduleType === moduleType && m.isIncluded
    );

    // Check if module is available through additional products
    const additionalProduct = subscription.additionalProducts.find(
      p => p.product.moduleType === moduleType && p.product.type === 'MODULE'
    );

    if (!planModule && !additionalProduct) {
      return {
        canProceed: false,
        currentCount: 0,
        limit: 0,
        message: `El módulo ${AVAILABLE_MODULES[moduleType as keyof typeof AVAILABLE_MODULES]?.name || moduleType} no está incluido en tu plan actual.`
      };
    }

    // Check permissions for the action
    const permissions = planModule || { canCreate: true, canEdit: true, canDelete: true };
    
    switch (action) {
      case 'edit':
        if (!permissions.canEdit) {
          return {
            canProceed: false,
            currentCount: 0,
            limit: 0,
            message: `Tu plan no permite editar elementos en ${moduleType}.`
          };
        }
        break;
      case 'delete':
        if (!permissions.canDelete) {
          return {
            canProceed: false,
            currentCount: 0,
            limit: 0,
            message: `Tu plan no permite eliminar elementos en ${moduleType}.`
          };
        }
        break;
    }

    const currentUsage = await this.getCurrentUsage(businessAccountId, moduleType);
    return {
      canProceed: true,
      currentCount: currentUsage,
      limit: null,
      message: undefined
    };
  }

  /**
   * Get locking query for specific module types to prevent race conditions
   */
  private getLockingUsageQuery(moduleType: string): string {
    switch (moduleType) {
      case 'USERS':
        return `
          SELECT id FROM users 
          WHERE business_account_id = $1
          FOR UPDATE
        `;
      case 'COMPANIES':
        return `
          SELECT id FROM companies 
          WHERE business_account_id = $1 AND (deleted_at IS NULL OR deleted_at > NOW())
          FOR UPDATE
        `;
      case 'CRM':
        return `
          SELECT id FROM opportunities 
          WHERE business_account_id = $1 AND (deleted_at IS NULL OR deleted_at > NOW())
          FOR UPDATE
        `;
      default:
        return `
          SELECT 1 
          WHERE 1 = 0
          FOR UPDATE
        `;
    }
  }

  /**
   * Obtiene el uso actual de un módulo para una business account
   */
  async getCurrentUsage(businessAccountId: string, moduleType: string): Promise<number> {
    let query = '';
    
    switch (moduleType) {
      case 'USERS':
        query = `
          SELECT COUNT(*) as count 
          FROM users 
          WHERE business_account_id = $1
        `;
        break;
      case 'COMPANIES':
        query = `
          SELECT COUNT(*) as count 
          FROM companies 
          WHERE business_account_id = $1
        `;
        break;
      case 'CRM':
        // For CRM, we don't count items, just check access
        return 0;
      default:
        return 0;
    }

    const result = await pool.query(query, [businessAccountId]);
    return parseInt(result.rows[0].count) || 0;
  }

  /**
   * Calcula el límite efectivo considerando plan + productos adicionales
   */
  getEffectiveLimit(
    businessAccountId: string, 
    moduleType: string, 
    subscription: {
      currentPlan: any;
      additionalProducts: any[];
    }
  ): number | null {
    // Get base limit from plan
    const planModule = subscription.currentPlan?.modules.find(
      (m: any) => m.moduleType === moduleType && m.isIncluded
    );
    
    let baseLimit = planModule?.itemLimit || null;

    // Add limits from additional products
    const additionalLimits = subscription.additionalProducts
      .filter(p => p.product.type === 'USER_ADDON' && p.product.moduleType === moduleType)
      .reduce((total, p) => total + (p.quantity || 0), 0);

    if (baseLimit === null) {
      return additionalLimits > 0 ? additionalLimits : null;
    }

    return baseLimit + additionalLimits;
  }

  /**
   * Obtiene los permisos de un módulo para una business account (considerando permisos de usuario)
   * UPDATED: Now uses the unified permission system
   */
  async getModulePermissions(businessAccountId: string, moduleType: string, userId?: string): Promise<ModulePermissions> {
    const { unifiedPermissionService } = await import('./unifiedPermissionService');
    
    try {
      const result = await unifiedPermissionService.getModuleAccess(businessAccountId, moduleType, userId);
      return result.permissions;
    } catch (error) {
      console.error('Error getting module permissions:', error);
      // Fallback to denied permissions
      return {
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canView: false,
        itemLimit: 0,
        currentCount: 0,
        isAtLimit: true,
        isNearLimit: false
      };
    }
  }

  /**
   * Actualiza el registro de uso para un módulo
   */
  async updateUsage(businessAccountId: string, moduleType: string): Promise<void> {
    const currentCount = await this.getCurrentUsage(businessAccountId, moduleType);
    
    const query = `
      INSERT INTO plan_usage (business_account_id, module_type, current_count, last_calculated)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (business_account_id, module_type) 
      DO UPDATE SET 
        current_count = $3,
        last_calculated = NOW()
    `;

    await pool.query(query, [businessAccountId, moduleType, currentCount]);
  }
}

export const planService = new PlanService();