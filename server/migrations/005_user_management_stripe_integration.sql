-- Migración: Sistema Completo de Gestión de Usuarios + Integración Stripe
-- Fecha: 2026-01-22
-- Autor: Claude (BizFlowCRM Enhancement)

-- =====================================================
-- FASE 1: Extensiones para Gestión de Usuarios
-- =====================================================

-- Agregar campos de activación/desactivación a tabla users
ALTER TABLE users 
ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL,
ADD COLUMN deactivated_at TIMESTAMP NULL,
ADD COLUMN deactivated_by VARCHAR REFERENCES users(id),
ADD COLUMN profile_image_url VARCHAR,
ADD COLUMN last_password_change TIMESTAMP DEFAULT NOW();

-- =====================================================
-- FASE 2: Integración Stripe en Business Accounts
-- =====================================================

-- Agregar campos de Stripe y estado de facturación
ALTER TABLE business_accounts 
ADD COLUMN stripe_customer_id VARCHAR UNIQUE,
ADD COLUMN stripe_subscription_id VARCHAR UNIQUE,
ADD COLUMN billing_anchor_date DATE,
ADD COLUMN next_billing_date DATE,
ADD COLUMN stripe_payment_method_id VARCHAR,
ADD COLUMN payment_status VARCHAR(20) DEFAULT 'active',
ADD COLUMN last_payment_failure_date TIMESTAMP NULL,
ADD COLUMN outstanding_balance DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN trial_end_date TIMESTAMP NULL,
ADD COLUMN suspended_at TIMESTAMP NULL,
ADD COLUMN suspension_reason TEXT;

-- =====================================================
-- FASE 3: Mapeo de Productos y Planes a Stripe
-- =====================================================

-- Conectar productos adicionales existentes con Stripe
ALTER TABLE additional_products
ADD COLUMN stripe_product_id VARCHAR UNIQUE,
ADD COLUMN stripe_price_id VARCHAR UNIQUE;

-- Conectar planes existentes con Stripe  
ALTER TABLE plans
ADD COLUMN stripe_product_id VARCHAR UNIQUE,
ADD COLUMN stripe_price_id VARCHAR UNIQUE,
ADD COLUMN trial_period_days INTEGER DEFAULT 0;

-- =====================================================
-- FASE 4: Tabla de Compras Adicionales con Stripe
-- =====================================================

CREATE TABLE business_account_additional_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_account_id UUID NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  additional_product_id UUID NOT NULL REFERENCES additional_products(id),
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  prorated_amount DECIMAL(10,2), -- Solo para primera compra
  total_price DECIMAL(10,2) NOT NULL,
  stripe_subscription_item_id VARCHAR UNIQUE,
  stripe_invoice_id VARCHAR,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  purchased_at TIMESTAMP DEFAULT NOW(),
  purchased_by_user_id UUID REFERENCES users(id),
  auto_purchased BOOLEAN DEFAULT false,
  is_first_billing BOOLEAN DEFAULT true, -- Para controlar prorrateo
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- FASE 5: Audit Trail para Compliance
-- =====================================================

CREATE TABLE upselling_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_account_id UUID NOT NULL REFERENCES business_accounts(id),
  trigger_action VARCHAR(50) NOT NULL,
  product_purchased_id UUID REFERENCES additional_products(id),
  stripe_invoice_id VARCHAR,
  user_count_before INTEGER,
  user_count_after INTEGER,
  total_cost DECIMAL(10,2),
  triggered_by_user_id UUID REFERENCES users(id),
  stripe_subscription_item_id VARCHAR,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- FASE 6: Índices para Performance
-- =====================================================

-- Índices para usuarios activos por business account
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active_business 
  ON users(business_account_id, is_active, is_deleted);

-- Índices para integración Stripe
CREATE INDEX IF NOT EXISTS idx_stripe_customers 
  ON business_accounts(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_payment_status 
  ON business_accounts(payment_status);

CREATE INDEX IF NOT EXISTS idx_suspended_accounts 
  ON business_accounts(suspended_at) WHERE suspended_at IS NOT NULL;

-- Índices para compras adicionales
CREATE INDEX IF NOT EXISTS idx_additional_purchases_business 
  ON business_account_additional_purchases(business_account_id, status);

CREATE INDEX IF NOT EXISTS idx_additional_purchases_stripe 
  ON business_account_additional_purchases(stripe_subscription_item_id);

-- Índices para audit log
CREATE INDEX IF NOT EXISTS idx_audit_business_account_date 
  ON upselling_audit_log(business_account_id, created_at DESC);

-- =====================================================
-- FASE 7: Constraints y Validaciones
-- =====================================================

-- Validación de estado de pago
ALTER TABLE business_accounts 
ADD CONSTRAINT chk_payment_status 
CHECK (payment_status IN ('active', 'past_due', 'canceled', 'suspended'));

-- Validación de estado de compras
ALTER TABLE business_account_additional_purchases 
ADD CONSTRAINT chk_purchase_status 
CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED'));

-- Validación de acciones de audit
ALTER TABLE upselling_audit_log 
ADD CONSTRAINT chk_trigger_action 
CHECK (trigger_action IN (
  'USER_LIMIT_REACHED', 
  'AUTO_PURCHASE_EXECUTED', 
  'ACCOUNT_SUSPENDED', 
  'ACCOUNT_REACTIVATED',
  'PAYMENT_FAILED',
  'PAYMENT_SUCCEEDED'
));

-- =====================================================
-- FASE 8: Funciones Helper para Conteo de Usuarios
-- =====================================================

-- Función para contar usuarios activos de una business account
CREATE OR REPLACE FUNCTION count_active_users(business_account_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER 
    FROM users 
    WHERE business_account_id = business_account_uuid 
      AND is_active = true 
      AND is_deleted = false
  );
END;
$$ LANGUAGE plpgsql;

-- Función para obtener límite total de usuarios (base + adicionales)
CREATE OR REPLACE FUNCTION get_user_limit(business_account_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  base_limit INTEGER := 0;
  additional_users INTEGER := 0;
BEGIN
  -- Obtener límite base del plan
  SELECT COALESCE(pm.item_limit, 0) INTO base_limit
  FROM business_accounts ba
  JOIN plans p ON ba.plan = p.name
  JOIN plan_modules pm ON p.id = pm.plan_id
  WHERE ba.id = business_account_uuid 
    AND pm.module_type = 'USERS';
  
  -- Obtener usuarios adicionales comprados
  SELECT COALESCE(SUM(baap.quantity), 0)::INTEGER INTO additional_users
  FROM business_account_additional_purchases baap
  JOIN additional_products ap ON baap.additional_product_id = ap.id
  WHERE baap.business_account_id = business_account_uuid
    AND baap.status = 'ACTIVE'
    AND ap.type = 'USER_ADDON';
  
  RETURN base_limit + additional_users;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FASE 9: Triggers para Auditoría Automática
-- =====================================================

-- Trigger para log automático de cambios de estado de usuarios
CREATE OR REPLACE FUNCTION log_user_status_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo log si cambia el estado de activación
  IF (OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
    INSERT INTO upselling_audit_log (
      business_account_id,
      trigger_action,
      user_count_before,
      user_count_after,
      triggered_by_user_id,
      metadata
    ) VALUES (
      NEW.business_account_id,
      CASE WHEN NEW.is_active THEN 'USER_ACTIVATED' ELSE 'USER_DEACTIVATED' END,
      count_active_users(NEW.business_account_id) - CASE WHEN NEW.is_active THEN 1 ELSE -1 END,
      count_active_users(NEW.business_account_id),
      NEW.deactivated_by,
      jsonb_build_object('user_id', NEW.id, 'user_name', NEW.name)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a tabla users
DROP TRIGGER IF EXISTS trigger_log_user_status_changes ON users;
CREATE TRIGGER trigger_log_user_status_changes
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION log_user_status_changes();

-- =====================================================
-- FASE 10: Datos de Ejemplo para Testing
-- =====================================================

-- Insertar productos adicionales de ejemplo
INSERT INTO additional_products (name, description, type, price, module_type, unit_increment, is_active)
VALUES 
  ('Usuario Adicional', 'Usuario adicional para el equipo', 'USER_ADDON', 10.00, 'USERS', 1, true),
  ('Módulo CRM Avanzado', 'Funcionalidades avanzadas de CRM', 'MODULE', 25.00, 'CRM', 1, true),
  ('Módulo Contactos Premium', 'Gestión avanzada de contactos', 'MODULE', 15.00, 'CONTACTS', 1, true)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- VERIFICACIÓN DE MIGRACIÓN
-- =====================================================

-- Verificar que todas las tablas y columnas existen
DO $$
BEGIN
  -- Verificar columnas en users
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
    RAISE EXCEPTION 'Migration failed: users.is_active column not created';
  END IF;
  
  -- Verificar columnas en business_accounts
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_accounts' AND column_name = 'stripe_customer_id') THEN
    RAISE EXCEPTION 'Migration failed: business_accounts.stripe_customer_id column not created';
  END IF;
  
  -- Verificar tabla de compras adicionales
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business_account_additional_purchases') THEN
    RAISE EXCEPTION 'Migration failed: business_account_additional_purchases table not created';
  END IF;
  
  -- Verificar tabla de audit log
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upselling_audit_log') THEN
    RAISE EXCEPTION 'Migration failed: upselling_audit_log table not created';
  END IF;
  
  RAISE NOTICE 'Migration completed successfully!';
END $$;