import { pool } from '../db';
import { ModulePermissions } from '@shared/schema';

export interface UnifiedPermissionResult {
  hasAccess: boolean;
  permissions: ModulePermissions;
  source: 'PLAN' | 'BUSINESS_OVERRIDE' | 'USER_OVERRIDE' | 'DENIED';
  debugInfo?: {
    planPermissions?: any;
    businessOverrides?: any;
    userPermissions?: any;
  };
}

/**
 * Unified Permission Service
 * This service replaces the 5 different permission checking systems
 * with a single, consistent source of truth based on the plan->business->user hierarchy
 */
export class UnifiedPermissionService {
  
  /**
   * Get module access and permissions for a business account and optional user
   * This is the SINGLE method that should be used for ALL permission checks
   */
  async getModuleAccess(
    businessAccountId: string,
    moduleType: string,
    userId?: string
  ): Promise<UnifiedPermissionResult> {
    try {
      console.log(`🔍 UnifiedPermissionService: Checking ${moduleType} for ${businessAccountId}`);
      
      // Check if business account has this module in their plan (simple approach)
      const planQuery = await pool.query(`
        SELECT pm.*, p.name as plan_name
        FROM business_accounts ba
        JOIN plans p ON ba.plan = p.name
        JOIN plan_modules pm ON p.id = pm.plan_id
        WHERE ba.id = $1 AND pm.module_type = $2 AND pm.is_included = true
      `, [businessAccountId, moduleType]);

      console.log(`📊 Plan query result: ${planQuery.rows.length} rows`);

      if (planQuery.rows.length === 0) {
        console.log(`❌ No plan access found for ${moduleType}`);
        return {
          hasAccess: false,
          permissions: this.createDeniedPermissions(),
          source: 'DENIED'
        };
      }

      const planModule = planQuery.rows[0];
      console.log(`✅ Plan module found:`, {
        planName: planModule.plan_name,
        moduleType: planModule.module_type,
        isIncluded: planModule.is_included,
        itemLimit: planModule.item_limit
      });

      // Check for business account override (restrictions)
      const overrideQuery = await pool.query(`
        SELECT is_disabled, item_limit
        FROM business_account_module_overrides
        WHERE business_account_id = $1 AND module_type = $2 AND is_disabled = true
      `, [businessAccountId, moduleType]);

      if (overrideQuery.rows.length > 0) {
        console.log(`🚫 Module disabled by business override`);
        return {
          hasAccess: false,
          permissions: this.createDeniedPermissions(),
          source: 'BUSINESS_OVERRIDE'
        };
      }

      // Get current usage for limit calculations
      const currentUsage = await this.getCurrentUsage(businessAccountId, moduleType);
      const itemLimit = planModule.item_limit;
      const isAtLimit = itemLimit !== null && currentUsage >= itemLimit;
      const isNearLimit = itemLimit !== null && currentUsage >= (itemLimit * 0.8);

      console.log(`📈 Usage: ${currentUsage}/${itemLimit || 'unlimited'}`);

      // For user-specific permissions, check user_permissions table
      if (userId) {
        const userPermQuery = await pool.query(`
          SELECT can_create, can_edit, can_delete, can_view
          FROM user_permissions
          WHERE user_id = $1 AND module_type = $2
        `, [userId, moduleType]);

        if (userPermQuery.rows.length > 0) {
          const userPerms = userPermQuery.rows[0];
          console.log(`👤 User-specific permissions found`);
          return {
            hasAccess: userPerms.can_view,
            permissions: {
              canCreate: userPerms.can_create && !isAtLimit,
              canEdit: userPerms.can_edit,
              canDelete: userPerms.can_delete,
              canView: userPerms.can_view,
              itemLimit,
              currentCount: currentUsage,
              isAtLimit,
              isNearLimit
            },
            source: 'USER_OVERRIDE'
          };
        }
      }

      // Default: Plan permissions (Business Admin can do everything)
      console.log(`✅ Granting plan access to ${moduleType}`);
      return {
        hasAccess: true,
        permissions: {
          canCreate: !isAtLimit, // Only blocked by limits
          canEdit: true,
          canDelete: true,
          canView: true,
          itemLimit,
          currentCount: currentUsage,
          isAtLimit,
          isNearLimit
        },
        source: 'PLAN'
      };
    } catch (error) {
      console.error('UnifiedPermissionService.getModuleAccess error:', error);
      return {
        hasAccess: false,
        permissions: this.createDeniedPermissions(),
        source: 'DENIED'
      };
    }
  }

  /**
   * Check if a business account has access to a specific module
   * Simplified version for middleware use
   */
  async hasModuleAccess(businessAccountId: string, moduleType: string): Promise<boolean> {
    const result = await this.getModuleAccess(businessAccountId, moduleType);
    return result.hasAccess && result.permissions.canView;
  }

  /**
   * Get all available modules for a business account
   * Replaces the various "get modules" endpoints
   */
  async getAvailableModules(businessAccountId: string, userId?: string): Promise<{
    moduleType: string;
    permissions: ModulePermissions;
    source: string;
  }[]> {
    const modules = ['USERS', 'CONTACTS', 'CRM']; // Standard modules
    const results = [];

    for (const moduleType of modules) {
      const access = await this.getModuleAccess(businessAccountId, moduleType, userId);
      if (access.hasAccess) {
        results.push({
          moduleType,
          permissions: access.permissions,
          source: access.source
        });
      }
    }

    return results;
  }

  /**
   * Business admin methods for managing user permissions
   */
  async setUserPermission(
    businessAccountId: string,
    userId: string,
    moduleType: string,
    permissions: {
      canCreate?: boolean;
      canEdit?: boolean;
      canDelete?: boolean;
      canView?: boolean;
    },
    assignedBy: string,
    notes?: string
  ): Promise<void> {
    // First verify that the business account has access to this module
    const businessAccess = await this.getModuleAccess(businessAccountId, moduleType);
    if (!businessAccess.hasAccess) {
      throw new Error(`Business account does not have access to module: ${moduleType}`);
    }

    // Verify user belongs to the business account
    const userCheck = await pool.query(
      'SELECT business_account_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0 || userCheck.rows[0].business_account_id !== businessAccountId) {
      throw new Error('User not found or does not belong to business account');
    }

    // Insert or update user permissions
    await pool.query(`
      INSERT INTO user_permissions (
        user_id, module_type, business_account_id,
        can_create, can_edit, can_delete, can_view,
        assigned_by, assigned_at, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
      ON CONFLICT (user_id, module_type) 
      DO UPDATE SET
        can_create = EXCLUDED.can_create,
        can_edit = EXCLUDED.can_edit,
        can_delete = EXCLUDED.can_delete,
        can_view = EXCLUDED.can_view,
        assigned_by = EXCLUDED.assigned_by,
        assigned_at = NOW(),
        notes = EXCLUDED.notes,
        updated_at = NOW()
    `, [
      userId,
      moduleType,
      businessAccountId,
      permissions.canCreate ?? true,
      permissions.canEdit ?? true,
      permissions.canDelete ?? true,
      permissions.canView ?? true,
      assignedBy,
      notes
    ]);
  }

  /**
   * Business admin method to restrict a module for their account
   */
  async setBusinessModuleOverride(
    businessAccountId: string,
    moduleType: string,
    overrides: {
      isDisabled?: boolean;
      itemLimit?: number;
    },
    disabledBy: string
  ): Promise<void> {
    await pool.query(`
      INSERT INTO business_account_module_overrides (
        business_account_id, module_type, is_disabled, item_limit, disabled_by, disabled_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (business_account_id, module_type)
      DO UPDATE SET
        is_disabled = EXCLUDED.is_disabled,
        item_limit = EXCLUDED.item_limit,
        disabled_by = EXCLUDED.disabled_by,
        disabled_at = NOW(),
        updated_at = NOW()
    `, [
      businessAccountId,
      moduleType,
      overrides.isDisabled ?? false,
      overrides.itemLimit,
      disabledBy
    ]);
  }

  /**
   * Get current usage count for a module
   */
  private async getCurrentUsage(businessAccountId: string, moduleType: string): Promise<number> {
    let query = '';
    
    switch (moduleType) {
      case 'USERS':
        query = 'SELECT COUNT(*) as count FROM users WHERE business_account_id = $1';
        break;
      case 'COMPANIES':
        query = 'SELECT COUNT(*) as count FROM companies WHERE business_account_id = $1';
        break;
      case 'CRM':
        // CRM typically doesn't have limits, return 0
        return 0;
      default:
        return 0;
    }

    try {
      const result = await pool.query(query, [businessAccountId]);
      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      console.error(`Error getting usage for ${moduleType}:`, error);
      return 0;
    }
  }

  /**
   * Create denied permissions object
   */
  private createDeniedPermissions(): ModulePermissions {
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

  /**
   * Debug method to see all permission sources for troubleshooting
   */
  async debugPermissions(businessAccountId: string, moduleType: string, userId?: string) {
    console.log(`🔍 Debugging permissions for ${businessAccountId}/${moduleType}/${userId}`);
    
    // Check unified view
    const unifiedView = await pool.query(
      'SELECT * FROM v_unified_permissions WHERE business_account_id = $1 AND module_type = $2',
      [businessAccountId, moduleType]
    );
    
    console.log('📊 Unified view:', unifiedView.rows[0]);
    
    // Check user permissions if provided
    if (userId) {
      const userPermissions = await pool.query(
        'SELECT * FROM user_permissions WHERE user_id = $1 AND module_type = $2',
        [userId, moduleType]
      );
      console.log('👤 User permissions:', userPermissions.rows[0]);
    }
    
    // Check business overrides
    const businessOverrides = await pool.query(
      'SELECT * FROM business_account_module_overrides WHERE business_account_id = $1 AND module_type = $2',
      [businessAccountId, moduleType]
    );
    console.log('🏢 Business overrides:', businessOverrides.rows[0]);
    
    // Get final result
    const finalResult = await this.getModuleAccess(businessAccountId, moduleType, userId);
    console.log('✅ Final result:', finalResult);
    
    return finalResult;
  }
}

// Export singleton instance
export const unifiedPermissionService = new UnifiedPermissionService();