import Stripe from 'stripe';
import { pool } from '../db';
import { secureLog } from '../utils/secureLogger';

// Initialize Stripe with API key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia'
});

export interface StripeCustomer {
  id: string;
  businessAccountId: string;
  email: string;
  name: string;
}

export interface StripeSubscription {
  id: string;
  customerId: string;
  priceId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
}

export interface ProrationPreview {
  immediateCharge: number;
  nextBillingAmount: number;
  proratedDays: number;
  itemsPreview: {
    productName: string;
    quantity: number;
    unitPrice: number;
    proratedAmount: number;
  }[];
}

export class StripeService {
  /**
   * Crea o recupera un customer de Stripe para una business account
   */
  async createOrGetCustomer(businessAccountId: string): Promise<StripeCustomer> {
    try {
      // Verificar si ya existe un customer
      const existingQuery = await pool.query(
        'SELECT stripe_customer_id FROM business_accounts WHERE id = $1',
        [businessAccountId]
      );
      
      if (existingQuery.rows[0]?.stripe_customer_id) {
        const customer = await stripe.customers.retrieve(existingQuery.rows[0].stripe_customer_id);
        if (!customer.deleted) {
          return {
            id: customer.id,
            businessAccountId,
            email: customer.email || '',
            name: customer.name || ''
          };
        }
      }

      // Obtener información de la business account
      const accountQuery = await pool.query(`
        SELECT ba.name, ba.created_at,
               u.email, u.name as responsible_name
        FROM business_accounts ba
        LEFT JOIN users u ON u.business_account_id = ba.id 
          AND u.role = 'BUSINESS_ADMIN'
        WHERE ba.id = $1
        LIMIT 1
      `, [businessAccountId]);

      const account = accountQuery.rows[0];
      if (!account) {
        throw new Error(`Business account not found: ${businessAccountId}`);
      }

      // Crear customer en Stripe
      const customer = await stripe.customers.create({
        email: account.email,
        name: account.responsible_name || account.name,
        metadata: {
          business_account_id: businessAccountId,
          created_in_app: 'true'
        }
      });

      // Guardar customer ID en la base de datos
      await pool.query(
        'UPDATE business_accounts SET stripe_customer_id = $1 WHERE id = $2',
        [customer.id, businessAccountId]
      );

      secureLog('stripe_customer_created', {
        businessAccountId,
        customerId: customer.id,
        email: account.email
      });

      return {
        id: customer.id,
        businessAccountId,
        email: customer.email || '',
        name: customer.name || ''
      };

    } catch (error) {
      secureLog('stripe_customer_creation_failed', {
        businessAccountId,
        error: error.message
      });
      throw new Error(`Failed to create Stripe customer: ${error.message}`);
    }
  }

  /**
   * Crea una suscripción base para un plan específico
   */
  async createSubscription(
    customerId: string, 
    priceId: string, 
    options: {
      trialPeriodDays?: number;
      quantity?: number;
      metadata?: Record<string, string>;
    } = {}
  ): Promise<StripeSubscription> {
    try {
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{
          price: priceId,
          quantity: options.quantity || 1
        }],
        metadata: options.metadata || {},
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent']
      };

      if (options.trialPeriodDays && options.trialPeriodDays > 0) {
        subscriptionData.trial_period_days = options.trialPeriodDays;
      }

      const subscription = await stripe.subscriptions.create(subscriptionData);

      secureLog('stripe_subscription_created', {
        subscriptionId: subscription.id,
        customerId,
        priceId,
        trialDays: options.trialPeriodDays || 0
      });

      return {
        id: subscription.id,
        customerId,
        priceId,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined
      };

    } catch (error) {
      secureLog('stripe_subscription_creation_failed', {
        customerId,
        priceId,
        error: error.message
      });
      throw new Error(`Failed to create subscription: ${error.message}`);
    }
  }

  /**
   * Agrega un producto adicional a una suscripción existente con prorrateo
   */
  async addSubscriptionItem(
    subscriptionId: string,
    priceId: string,
    quantity: number = 1,
    prorate: boolean = true
  ): Promise<{
    subscriptionItemId: string;
    invoiceId?: string;
    proratedAmount: number;
    isFirstBilling: boolean;
  }> {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      // Determinar si es primera facturación (aún en trial o período inicial)
      const isFirstBilling = subscription.status === 'trialing' || 
                           Date.now() < (subscription.current_period_start * 1000) + (24 * 60 * 60 * 1000);

      // Si es primera facturación, no prorratear
      const shouldProrate = prorate && !isFirstBilling;

      const subscriptionItem = await stripe.subscriptionItems.create({
        subscription: subscriptionId,
        price: priceId,
        quantity,
        proration_behavior: shouldProrate ? 'create_prorations' : 'none'
      });

      let proratedAmount = 0;
      let invoiceId = undefined;

      if (shouldProrate) {
        // Obtener la factura más reciente para calcular el monto prorrateado
        const invoices = await stripe.invoices.list({
          subscription: subscriptionId,
          limit: 1
        });

        if (invoices.data.length > 0) {
          const invoice = invoices.data[0];
          invoiceId = invoice.id;
          
          // Sumar los line items de prorrateo
          proratedAmount = invoice.lines.data
            .filter(line => line.proration && line.price?.id === priceId)
            .reduce((sum, line) => sum + (line.amount || 0), 0) / 100; // Convertir de centavos
        }
      }

      secureLog('stripe_subscription_item_added', {
        subscriptionId,
        subscriptionItemId: subscriptionItem.id,
        priceId,
        quantity,
        proratedAmount,
        isFirstBilling,
        invoiceId
      });

      return {
        subscriptionItemId: subscriptionItem.id,
        invoiceId,
        proratedAmount,
        isFirstBilling
      };

    } catch (error) {
      secureLog('stripe_subscription_item_addition_failed', {
        subscriptionId,
        priceId,
        error: error.message
      });
      throw new Error(`Failed to add subscription item: ${error.message}`);
    }
  }

  /**
   * Previsualiza el costo de agregar productos antes de confirmar
   */
  async previewSubscriptionChange(
    subscriptionId: string,
    itemsToAdd: { priceId: string; quantity: number }[]
  ): Promise<ProrationPreview> {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      const isFirstBilling = subscription.status === 'trialing' || 
                           Date.now() < (subscription.current_period_start * 1000) + (24 * 60 * 60 * 1000);

      const existingItems = subscription.items.data.map(item => ({
        id: item.id,
        price: item.price.id,
        quantity: item.quantity
      }));

      // Agregar nuevos items a la vista previa
      const previewItems = [
        ...existingItems,
        ...itemsToAdd.map(item => ({
          price: item.priceId,
          quantity: item.quantity
        }))
      ];

      // Crear invoice preview
      const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: subscription.customer as string,
        subscription: subscriptionId,
        subscription_items: previewItems,
        subscription_proration_behavior: isFirstBilling ? 'none' : 'create_prorations'
      });

      const immediateCharge = upcomingInvoice.amount_due / 100;
      const nextBillingAmount = upcomingInvoice.total / 100;
      
      // Calcular días hasta el próximo billing
      const daysUntilNextBilling = Math.ceil(
        (subscription.current_period_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24)
      );

      const itemsPreview = await Promise.all(
        itemsToAdd.map(async (item) => {
          const price = await stripe.prices.retrieve(item.priceId);
          const product = await stripe.products.retrieve(price.product as string);
          
          const unitPrice = (price.unit_amount || 0) / 100;
          const proratedAmount = isFirstBilling ? 0 : 
            (unitPrice * item.quantity * daysUntilNextBilling) / 30; // Aproximación mensual
          
          return {
            productName: product.name,
            quantity: item.quantity,
            unitPrice,
            proratedAmount
          };
        })
      );

      return {
        immediateCharge,
        nextBillingAmount,
        proratedDays: daysUntilNextBilling,
        itemsPreview
      };

    } catch (error) {
      secureLog('stripe_preview_failed', {
        subscriptionId,
        error: error.message
      });
      throw new Error(`Failed to preview subscription change: ${error.message}`);
    }
  }

  /**
   * Actualiza el estado de pago de una business account
   */
  async updatePaymentStatus(
    businessAccountId: string,
    status: 'active' | 'past_due' | 'canceled' | 'suspended',
    lastFailureDate?: Date
  ): Promise<void> {
    try {
      const query = lastFailureDate ? 
        'UPDATE business_accounts SET payment_status = $1, last_payment_failure_date = $2 WHERE id = $3' :
        'UPDATE business_accounts SET payment_status = $1 WHERE id = $2';
      
      const params = lastFailureDate ? 
        [status, lastFailureDate, businessAccountId] :
        [status, businessAccountId];

      await pool.query(query, params);

      secureLog('payment_status_updated', {
        businessAccountId,
        status,
        lastFailureDate
      });

    } catch (error) {
      secureLog('payment_status_update_failed', {
        businessAccountId,
        status,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Maneja webhooks de Stripe
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'customer.subscription.updated':
        case 'customer.subscription.created':
          await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.payment_succeeded':
          await this.handlePaymentSuccess(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handlePaymentFailure(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionCancellation(event.data.object as Stripe.Subscription);
          break;

        default:
          secureLog('stripe_webhook_ignored', {
            eventType: event.type,
            eventId: event.id
          });
      }
    } catch (error) {
      secureLog('stripe_webhook_error', {
        eventType: event.type,
        eventId: event.id,
        error: error.message
      });
      throw error;
    }
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    
    // Encontrar business account por customer ID
    const result = await pool.query(
      'SELECT id FROM business_accounts WHERE stripe_customer_id = $1',
      [customerId]
    );

    if (result.rows.length > 0) {
      const businessAccountId = result.rows[0].id;
      
      await pool.query(`
        UPDATE business_accounts 
        SET stripe_subscription_id = $1,
            payment_status = $2,
            next_billing_date = $3
        WHERE id = $4
      `, [
        subscription.id,
        subscription.status === 'active' ? 'active' : subscription.status,
        new Date(subscription.current_period_end * 1000),
        businessAccountId
      ]);

      secureLog('subscription_updated', {
        businessAccountId,
        subscriptionId: subscription.id,
        status: subscription.status
      });
    }
  }

  private async handlePaymentSuccess(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    
    const result = await pool.query(
      'SELECT id FROM business_accounts WHERE stripe_customer_id = $1',
      [customerId]
    );

    if (result.rows.length > 0) {
      const businessAccountId = result.rows[0].id;
      
      await this.updatePaymentStatus(businessAccountId, 'active');
      
      secureLog('payment_succeeded', {
        businessAccountId,
        invoiceId: invoice.id,
        amount: invoice.amount_paid / 100
      });
    }
  }

  private async handlePaymentFailure(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    
    const result = await pool.query(
      'SELECT id FROM business_accounts WHERE stripe_customer_id = $1',
      [customerId]
    );

    if (result.rows.length > 0) {
      const businessAccountId = result.rows[0].id;
      
      await this.updatePaymentStatus(businessAccountId, 'past_due', new Date());
      
      secureLog('payment_failed', {
        businessAccountId,
        invoiceId: invoice.id,
        attemptCount: invoice.attempt_count,
        nextPaymentAttempt: invoice.next_payment_attempt
      });
    }
  }

  private async handleSubscriptionCancellation(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    
    const result = await pool.query(
      'SELECT id FROM business_accounts WHERE stripe_customer_id = $1',
      [customerId]
    );

    if (result.rows.length > 0) {
      const businessAccountId = result.rows[0].id;
      
      await this.updatePaymentStatus(businessAccountId, 'canceled');
      
      secureLog('subscription_canceled', {
        businessAccountId,
        subscriptionId: subscription.id
      });
    }
  }

  /**
   * Obtiene información de facturación de una business account
   */
  async getBillingInfo(businessAccountId: string): Promise<{
    customerId?: string;
    subscriptionId?: string;
    paymentStatus: string;
    nextBillingDate?: Date;
    trialEndDate?: Date;
    outstandingBalance: number;
  }> {
    try {
      const result = await pool.query(`
        SELECT stripe_customer_id, stripe_subscription_id, payment_status,
               next_billing_date, trial_end_date, outstanding_balance
        FROM business_accounts
        WHERE id = $1
      `, [businessAccountId]);

      const account = result.rows[0];
      if (!account) {
        throw new Error(`Business account not found: ${businessAccountId}`);
      }

      return {
        customerId: account.stripe_customer_id,
        subscriptionId: account.stripe_subscription_id,
        paymentStatus: account.payment_status || 'active',
        nextBillingDate: account.next_billing_date,
        trialEndDate: account.trial_end_date,
        outstandingBalance: parseFloat(account.outstanding_balance || '0')
      };

    } catch (error) {
      secureLog('billing_info_retrieval_failed', {
        businessAccountId,
        error: error.message
      });
      throw error;
    }
  }
}

export const stripeService = new StripeService();