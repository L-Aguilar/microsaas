import { pool } from '../db';
import { secureLog } from '../utils/secureLogger';
import { stripeService } from './stripeService';

export interface UpsellOpportunity {
  type: 'USER_LIMIT_REACHED' | 'MODULE_UPGRADE' | 'STORAGE_LIMIT' | 'FEATURE_REQUEST';
  productId: string;
  productName: string;
  description: string;
  currentUsage: number;
  limitReached: number;
  suggestedQuantity: number;
  unitPrice: number;
  totalPrice: number;
  savings?: number;
  isAutoUpgradeEligible: boolean;
  urgencyLevel: 'low' | 'medium' | 'high';
}

export interface UpsellResult {
  success: boolean;
  purchaseId?: string;
  stripeInvoiceId?: string;
  message: string;
  newLimit?: number;
  proratedAmount?: number;
  isAutoUpgrade: boolean;
}

export interface AutoUpgradeSettings {
  enabled: boolean;
  userLimitEnabled: boolean;
  maxAutoUsers: number;
  storageEnabled: boolean;
  maxAutoStorage: number;
  maxMonthlyAutoCharge: number;
}

export class UpsellService {
  /**
   * Detecta oportunidades de upselling para una business account
   */
  async detectUpsellOpportunities(businessAccountId: string): Promise<UpsellOpportunity[]> {
    try {
      const opportunities: UpsellOpportunity[] = [];

      // Verificar límite de usuarios
      const userOpportunity = await this.checkUserLimitOpportunity(businessAccountId);
      if (userOpportunity) opportunities.push(userOpportunity);

      // Verificar módulos adicionales disponibles
      const moduleOpportunities = await this.checkModuleOpportunities(businessAccountId);
      opportunities.push(...moduleOpportunities);

      secureLog('upsell_opportunities_detected', {
        businessAccountId,
        opportunitiesCount: opportunities.length,
        types: opportunities.map(o => o.type)
      });

      return opportunities;

    } catch (error) {
      secureLog('upsell_detection_failed', {
        businessAccountId,
        error: error.message
      });
      throw error;
    }
  }

  private async checkUserLimitOpportunity(businessAccountId: string): Promise<UpsellOpportunity | null> {
    try {
      // Obtener límite actual y uso
      const currentUsage = await pool.query(
        'SELECT count_active_users($1) as active_users',
        [businessAccountId]
      );
      
      const limitInfo = await pool.query(
        'SELECT get_user_limit($1) as user_limit',
        [businessAccountId]
      );

      const activeUsers = currentUsage.rows[0]?.active_users || 0;
      const userLimit = limitInfo.rows[0]?.user_limit || 0;

      // Si no ha alcanzado el límite, no hay oportunidad
      if (activeUsers < userLimit) {
        return null;
      }

      // Buscar producto de usuarios adicionales
      const userAddonQuery = await pool.query(`
        SELECT id, name, description, price
        FROM additional_products
        WHERE type = 'USER_ADDON' AND is_active = true
        ORDER BY price ASC
        LIMIT 1
      `);

      if (userAddonQuery.rows.length === 0) {
        return null;
      }

      const addon = userAddonQuery.rows[0];
      const suggestedQuantity = Math.max(1, Math.ceil((activeUsers - userLimit) / addon.unit_increment || 1));
      const totalPrice = suggestedQuantity * parseFloat(addon.price);

      return {
        type: 'USER_LIMIT_REACHED',
        productId: addon.id,
        productName: addon.name,
        description: addon.description,
        currentUsage: activeUsers,
        limitReached: userLimit,
        suggestedQuantity,
        unitPrice: parseFloat(addon.price),
        totalPrice,
        isAutoUpgradeEligible: true,
        urgencyLevel: activeUsers > userLimit ? 'high' : 'medium'
      };

    } catch (error) {
      secureLog('user_limit_check_failed', {
        businessAccountId,
        error: error.message
      });
      return null;
    }
  }

  private async checkModuleOpportunities(businessAccountId: string): Promise<UpsellOpportunity[]> {
    try {
      const opportunities: UpsellOpportunity[] = [];

      // Obtener plan actual y módulos incluidos
      const planQuery = await pool.query(`
        SELECT p.name as plan_name, p.type as plan_type
        FROM business_accounts ba
        JOIN plans p ON ba.plan = p.name
        WHERE ba.id = $1
      `, [businessAccountId]);

      if (planQuery.rows.length === 0) {
        return opportunities;
      }

      const currentPlan = planQuery.rows[0];

      // Buscar módulos adicionales no incluidos en el plan
      const availableModules = await pool.query(`
        SELECT ap.id, ap.name, ap.description, ap.price, ap.module_type
        FROM additional_products ap
        WHERE ap.type = 'MODULE' 
        AND ap.is_active = true
        AND ap.module_type NOT IN (
          SELECT pm.module_type
          FROM plans p
          JOIN plan_modules pm ON p.id = pm.plan_id
          WHERE p.name = $1 AND pm.is_included = true
        )
        AND ap.id NOT IN (
          SELECT baap.additional_product_id
          FROM business_account_additional_purchases baap
          WHERE baap.business_account_id = $2 AND baap.status = 'ACTIVE'
        )
      `, [currentPlan.plan_name, businessAccountId]);

      for (const module of availableModules.rows) {
        opportunities.push({
          type: 'MODULE_UPGRADE',
          productId: module.id,
          productName: module.name,
          description: module.description,
          currentUsage: 0,
          limitReached: 0,
          suggestedQuantity: 1,
          unitPrice: parseFloat(module.price),
          totalPrice: parseFloat(module.price),
          isAutoUpgradeEligible: false,
          urgencyLevel: 'low'
        });
      }

      return opportunities;

    } catch (error) {
      secureLog('module_opportunities_check_failed', {
        businessAccountId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Ejecuta un upsell automático (solo para usuarios adicionales)
   */
  async executeAutoUpsell(
    businessAccountId: string,
    triggeredByUserId?: string
  ): Promise<UpsellResult> {
    try {
      // Verificar si auto-upgrade está habilitado
      const autoSettings = await this.getAutoUpgradeSettings(businessAccountId);
      if (!autoSettings.enabled || !autoSettings.userLimitEnabled) {
        return {
          success: false,
          message: 'Auto-upgrade no está habilitado para esta cuenta',
          isAutoUpgrade: true
        };
      }

      // Detectar oportunidad de usuarios
      const userOpportunity = await this.checkUserLimitOpportunity(businessAccountId);
      if (!userOpportunity || userOpportunity.type !== 'USER_LIMIT_REACHED') {
        return {
          success: false,
          message: 'No hay oportunidades de auto-upgrade de usuarios detectadas',
          isAutoUpgrade: true
        };
      }

      // Verificar límites de auto-upgrade
      const currentActiveUsers = userOpportunity.currentUsage;
      if (currentActiveUsers > autoSettings.maxAutoUsers) {
        return {
          success: false,
          message: `Límite de auto-upgrade alcanzado (máximo: ${autoSettings.maxAutoUsers} usuarios)`,
          isAutoUpgrade: true
        };
      }

      // Verificar límite de gasto mensual
      if (userOpportunity.totalPrice > autoSettings.maxMonthlyAutoCharge) {
        return {
          success: false,
          message: `Costo excede el límite mensual de auto-upgrade ($${autoSettings.maxMonthlyAutoCharge})`,
          isAutoUpgrade: true
        };
      }

      // Ejecutar la compra
      return await this.executePurchase(
        businessAccountId,
        userOpportunity.productId,
        userOpportunity.suggestedQuantity,
        triggeredByUserId,
        true // isAutoUpgrade
      );

    } catch (error) {
      secureLog('auto_upsell_failed', {
        businessAccountId,
        triggeredByUserId,
        error: error.message
      });

      return {
        success: false,
        message: `Error en auto-upgrade: ${error.message}`,
        isAutoUpgrade: true
      };
    }
  }

  /**
   * Ejecuta una compra manual de upsell
   */
  async executeManualUpsell(
    businessAccountId: string,
    productId: string,
    quantity: number,
    triggeredByUserId?: string
  ): Promise<UpsellResult> {
    return await this.executePurchase(businessAccountId, productId, quantity, triggeredByUserId, false);
  }

  private async executePurchase(
    businessAccountId: string,
    productId: string,
    quantity: number,
    triggeredByUserId?: string,
    isAutoUpgrade: boolean = false
  ): Promise<UpsellResult> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verificar que el producto existe y está activo
      const productQuery = await client.query(`
        SELECT id, name, type, price, module_type, stripe_price_id
        FROM additional_products
        WHERE id = $1 AND is_active = true
      `, [productId]);

      if (productQuery.rows.length === 0) {
        throw new Error('Producto no encontrado o no disponible');
      }

      const product = productQuery.rows[0];
      const unitPrice = parseFloat(product.price);
      const totalPrice = unitPrice * quantity;

      // Obtener información de Stripe
      const billingInfo = await stripeService.getBillingInfo(businessAccountId);
      if (!billingInfo.subscriptionId) {
        throw new Error('No se encontró suscripción activa de Stripe');
      }

      // Agregar item a la suscripción de Stripe (con prorrateo)
      const stripeResult = await stripeService.addSubscriptionItem(
        billingInfo.subscriptionId,
        product.stripe_price_id,
        quantity,
        true // prorate
      );

      // Guardar la compra en la base de datos
      const purchaseQuery = await client.query(`
        INSERT INTO business_account_additional_purchases (
          business_account_id, additional_product_id, quantity, 
          unit_price, total_price, stripe_subscription_item_id,
          stripe_invoice_id, purchased_by_user_id, auto_purchased,
          prorated_amount, is_first_billing, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ACTIVE')
        RETURNING id
      `, [
        businessAccountId, productId, quantity, unitPrice, totalPrice,
        stripeResult.subscriptionItemId, stripeResult.invoiceId,
        triggeredByUserId, isAutoUpgrade, stripeResult.proratedAmount,
        stripeResult.isFirstBilling
      ]);

      const purchaseId = purchaseQuery.rows[0].id;

      // Crear log de auditoría
      await client.query(`
        INSERT INTO upselling_audit_log (
          business_account_id, trigger_action, product_purchased_id,
          total_cost, triggered_by_user_id, stripe_invoice_id,
          stripe_subscription_item_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        businessAccountId,
        isAutoUpgrade ? 'AUTO_PURCHASE_EXECUTED' : 'MANUAL_PURCHASE_EXECUTED',
        productId, totalPrice, triggeredByUserId, stripeResult.invoiceId,
        stripeResult.subscriptionItemId,
        JSON.stringify({
          quantity,
          unit_price: unitPrice,
          prorated_amount: stripeResult.proratedAmount,
          is_first_billing: stripeResult.isFirstBilling
        })
      ]);

      await client.query('COMMIT');

      // Calcular nuevo límite si es upgrade de usuarios
      let newLimit = undefined;
      if (product.type === 'USER_ADDON') {
        const limitQuery = await pool.query(
          'SELECT get_user_limit($1) as new_limit',
          [businessAccountId]
        );
        newLimit = limitQuery.rows[0]?.new_limit;
      }

      secureLog('upsell_purchase_completed', {
        businessAccountId,
        productId,
        quantity,
        totalPrice,
        proratedAmount: stripeResult.proratedAmount,
        isAutoUpgrade,
        purchaseId,
        newLimit
      });

      return {
        success: true,
        purchaseId,
        stripeInvoiceId: stripeResult.invoiceId,
        message: `${product.name} agregado exitosamente${newLimit ? ` - Nuevo límite: ${newLimit} usuarios` : ''}`,
        newLimit,
        proratedAmount: stripeResult.proratedAmount,
        isAutoUpgrade
      };

    } catch (error) {
      await client.query('ROLLBACK');
      
      secureLog('upsell_purchase_failed', {
        businessAccountId,
        productId,
        quantity,
        isAutoUpgrade,
        error: error.message
      });

      return {
        success: false,
        message: `Error al procesar la compra: ${error.message}`,
        isAutoUpgrade
      };
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene la configuración de auto-upgrade para una business account
   */
  async getAutoUpgradeSettings(businessAccountId: string): Promise<AutoUpgradeSettings> {
    try {
      // Por ahora, configuración por defecto. En el futuro podría venir de la base de datos
      return {
        enabled: true,
        userLimitEnabled: true,
        maxAutoUsers: 50, // Máximo de usuarios permitidos por auto-upgrade
        storageEnabled: false,
        maxAutoStorage: 100, // GB
        maxMonthlyAutoCharge: 100 // USD
      };
    } catch (error) {
      // Configuración conservadora por defecto en caso de error
      return {
        enabled: false,
        userLimitEnabled: false,
        maxAutoUsers: 0,
        storageEnabled: false,
        maxAutoStorage: 0,
        maxMonthlyAutoCharge: 0
      };
    }
  }

  /**
   * Actualiza la configuración de auto-upgrade
   */
  async updateAutoUpgradeSettings(
    businessAccountId: string,
    settings: Partial<AutoUpgradeSettings>,
    triggeredByUserId?: string
  ): Promise<void> {
    try {
      // En una implementación completa, esto se guardaría en la base de datos
      secureLog('auto_upgrade_settings_updated', {
        businessAccountId,
        settings,
        triggeredByUserId
      });

      // TODO: Implementar almacenamiento en base de datos cuando se requiera
      // persistencia de configuraciones por business account

    } catch (error) {
      secureLog('auto_upgrade_settings_update_failed', {
        businessAccountId,
        settings,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtiene el historial de compras adicionales
   */
  async getPurchaseHistory(businessAccountId: string): Promise<{
    purchases: Array<{
      id: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      purchasedAt: Date;
      isAutoUpgrade: boolean;
      status: string;
      proratedAmount?: number;
    }>;
    totalSpent: number;
    activeAddons: number;
  }> {
    try {
      const historyQuery = await pool.query(`
        SELECT baap.id, ap.name as product_name, baap.quantity,
               baap.unit_price, baap.total_price, baap.purchased_at,
               baap.auto_purchased, baap.status, baap.prorated_amount
        FROM business_account_additional_purchases baap
        JOIN additional_products ap ON baap.additional_product_id = ap.id
        WHERE baap.business_account_id = $1
        ORDER BY baap.purchased_at DESC
      `, [businessAccountId]);

      const purchases = historyQuery.rows.map(row => ({
        id: row.id,
        productName: row.product_name,
        quantity: row.quantity,
        unitPrice: parseFloat(row.unit_price),
        totalPrice: parseFloat(row.total_price),
        purchasedAt: row.purchased_at,
        isAutoUpgrade: row.auto_purchased,
        status: row.status,
        proratedAmount: row.prorated_amount ? parseFloat(row.prorated_amount) : undefined
      }));

      const totalSpent = purchases
        .filter(p => p.status === 'ACTIVE')
        .reduce((sum, p) => sum + p.totalPrice, 0);

      const activeAddons = purchases
        .filter(p => p.status === 'ACTIVE')
        .length;

      return {
        purchases,
        totalSpent,
        activeAddons
      };

    } catch (error) {
      secureLog('purchase_history_retrieval_failed', {
        businessAccountId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Valida si se puede crear un nuevo usuario (verificación de límites)
   */
  async validateUserCreation(businessAccountId: string): Promise<{
    allowed: boolean;
    currentCount: number;
    limit: number;
    message?: string;
    autoUpgradeAvailable?: boolean;
  }> {
    try {
      const currentUsage = await pool.query(
        'SELECT count_active_users($1) as active_users',
        [businessAccountId]
      );
      
      const limitInfo = await pool.query(
        'SELECT get_user_limit($1) as user_limit',
        [businessAccountId]
      );

      const activeUsers = currentUsage.rows[0]?.active_users || 0;
      const userLimit = limitInfo.rows[0]?.user_limit || 0;

      if (activeUsers < userLimit) {
        return {
          allowed: true,
          currentCount: activeUsers,
          limit: userLimit
        };
      }

      // Límite alcanzado - verificar auto-upgrade
      const autoSettings = await this.getAutoUpgradeSettings(businessAccountId);
      const autoUpgradeAvailable = autoSettings.enabled && 
                                  autoSettings.userLimitEnabled &&
                                  activeUsers < autoSettings.maxAutoUsers;

      return {
        allowed: false,
        currentCount: activeUsers,
        limit: userLimit,
        message: `Límite de usuarios alcanzado (${activeUsers}/${userLimit})`,
        autoUpgradeAvailable
      };

    } catch (error) {
      secureLog('user_validation_failed', {
        businessAccountId,
        error: error.message
      });
      
      return {
        allowed: false,
        currentCount: 0,
        limit: 0,
        message: 'Error al validar límites de usuarios'
      };
    }
  }
}

export const upsellService = new UpsellService();