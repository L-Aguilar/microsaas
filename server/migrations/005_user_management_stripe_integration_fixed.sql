-- Migración: Sistema Completo de Gestión de Usuarios + Integración Stripe (FIXED)
-- Fecha: 2026-01-22
-- Autor: Claude (BizFlowCRM Enhancement)

-- =====================================================
-- FASE 1: Extensiones para Gestión de Usuarios
-- =====================================================

-- Agregar campos de activación/desactivación a tabla users
DO $$ 
BEGIN
    -- Solo agregar columnas si no existen
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
        ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'deactivated_at') THEN
        ALTER TABLE users ADD COLUMN deactivated_at TIMESTAMP NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'deactivated_by') THEN
        ALTER TABLE users ADD COLUMN deactivated_by VARCHAR REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'profile_image_url') THEN
        ALTER TABLE users ADD COLUMN profile_image_url VARCHAR;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_password_change') THEN
        ALTER TABLE users ADD COLUMN last_password_change TIMESTAMP DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_deleted') THEN
        ALTER TABLE users ADD COLUMN is_deleted BOOLEAN DEFAULT false NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'deleted_at') THEN
        ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'deleted_by') THEN
        ALTER TABLE users ADD COLUMN deleted_by VARCHAR REFERENCES users(id);
    END IF;
END $$;

-- =====================================================
-- FASE 2: Integración Stripe en Business Accounts
-- =====================================================

DO $$ 
BEGIN
    -- Agregar campos de Stripe y estado de facturación
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_accounts' AND column_name = 'stripe_customer_id') THEN
        ALTER TABLE business_accounts ADD COLUMN stripe_customer_id VARCHAR UNIQUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_accounts' AND column_name = 'stripe_subscription_id') THEN
        ALTER TABLE business_accounts ADD COLUMN stripe_subscription_id VARCHAR UNIQUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_accounts' AND column_name = 'billing_anchor_date') THEN
        ALTER TABLE business_accounts ADD COLUMN billing_anchor_date DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_accounts' AND column_name = 'next_billing_date') THEN
        ALTER TABLE business_accounts ADD COLUMN next_billing_date DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_accounts' AND column_name = 'stripe_payment_method_id') THEN
        ALTER TABLE business_accounts ADD COLUMN stripe_payment_method_id VARCHAR;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_accounts' AND column_name = 'payment_status') THEN
        ALTER TABLE business_accounts ADD COLUMN payment_status VARCHAR(20) DEFAULT 'active';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_accounts' AND column_name = 'last_payment_failure_date') THEN
        ALTER TABLE business_accounts ADD COLUMN last_payment_failure_date TIMESTAMP NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_accounts' AND column_name = 'outstanding_balance') THEN
        ALTER TABLE business_accounts ADD COLUMN outstanding_balance DECIMAL(10,2) DEFAULT 0.00;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_accounts' AND column_name = 'trial_end_date') THEN
        ALTER TABLE business_accounts ADD COLUMN trial_end_date TIMESTAMP NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_accounts' AND column_name = 'suspended_at') THEN
        ALTER TABLE business_accounts ADD COLUMN suspended_at TIMESTAMP NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_accounts' AND column_name = 'suspension_reason') THEN
        ALTER TABLE business_accounts ADD COLUMN suspension_reason TEXT;
    END IF;
END $$;

-- =====================================================
-- FASE 3: Crear tabla additional_products si no existe
-- =====================================================

-- Crear tabla additional_products si no existe
CREATE TABLE IF NOT EXISTS additional_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  billing_frequency VARCHAR(20) DEFAULT 'MONTHLY',
  module_type VARCHAR(50),
  unit_increment INTEGER DEFAULT 1,
  max_per_account INTEGER,
  is_active BOOLEAN DEFAULT true,
  stripe_product_id VARCHAR UNIQUE,
  stripe_price_id VARCHAR UNIQUE,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Agregar campos de Stripe a planes si no existen
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'stripe_product_id') THEN
        ALTER TABLE plans ADD COLUMN stripe_product_id VARCHAR UNIQUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'stripe_price_id') THEN
        ALTER TABLE plans ADD COLUMN stripe_price_id VARCHAR UNIQUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'trial_period_days') THEN
        ALTER TABLE plans ADD COLUMN trial_period_days INTEGER DEFAULT 0;
    END IF;
END $$;

-- =====================================================
-- FASE 4: Tabla de Compras Adicionales con Stripe
-- =====================================================

CREATE TABLE IF NOT EXISTS business_account_additional_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_account_id VARCHAR NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  additional_product_id UUID NOT NULL REFERENCES additional_products(id),
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  prorated_amount DECIMAL(10,2),
  total_price DECIMAL(10,2) NOT NULL,
  stripe_subscription_item_id VARCHAR UNIQUE,
  stripe_invoice_id VARCHAR,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  purchased_at TIMESTAMP DEFAULT NOW(),
  purchased_by_user_id VARCHAR REFERENCES users(id),
  auto_purchased BOOLEAN DEFAULT false,
  is_first_billing BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- FASE 5: Audit Trail para Compliance
-- =====================================================

CREATE TABLE IF NOT EXISTS upselling_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_account_id VARCHAR NOT NULL REFERENCES business_accounts(id),
  trigger_action VARCHAR(50) NOT NULL,
  product_purchased_id UUID REFERENCES additional_products(id),
  stripe_invoice_id VARCHAR,
  user_count_before INTEGER,
  user_count_after INTEGER,
  total_cost DECIMAL(10,2),
  triggered_by_user_id VARCHAR REFERENCES users(id),
  stripe_subscription_item_id VARCHAR,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- FASE 6: Índices para Performance
-- =====================================================

-- Crear índices solo si no existen
DO $$ 
BEGIN
    -- Índices para usuarios activos por business account
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_active_business') THEN
        CREATE INDEX idx_users_active_business ON users(business_account_id, is_active, is_deleted);
    END IF;

    -- Índices para integración Stripe
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_stripe_customers') THEN
        CREATE INDEX idx_stripe_customers ON business_accounts(stripe_customer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payment_status') THEN
        CREATE INDEX idx_payment_status ON business_accounts(payment_status);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_suspended_accounts') THEN
        CREATE INDEX idx_suspended_accounts ON business_accounts(suspended_at) WHERE suspended_at IS NOT NULL;
    END IF;

    -- Índices para compras adicionales
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_additional_purchases_business') THEN
        CREATE INDEX idx_additional_purchases_business ON business_account_additional_purchases(business_account_id, status);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_additional_purchases_stripe') THEN
        CREATE INDEX idx_additional_purchases_stripe ON business_account_additional_purchases(stripe_subscription_item_id);
    END IF;

    -- Índices para audit log
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_business_account_date') THEN
        CREATE INDEX idx_audit_business_account_date ON upselling_audit_log(business_account_id, created_at DESC);
    END IF;
END $$;

-- =====================================================
-- FASE 7: Constraints y Validaciones
-- =====================================================

DO $$ 
BEGIN
    -- Validación de estado de pago (solo agregar si no existe)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_payment_status') THEN
        ALTER TABLE business_accounts 
        ADD CONSTRAINT chk_payment_status 
        CHECK (payment_status IN ('active', 'past_due', 'canceled', 'suspended'));
    END IF;

    -- Validación de estado de compras (solo agregar si no existe)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_purchase_status') THEN
        ALTER TABLE business_account_additional_purchases 
        ADD CONSTRAINT chk_purchase_status 
        CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED'));
    END IF;

    -- Validación de acciones de audit (solo agregar si no existe)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trigger_action') THEN
        ALTER TABLE upselling_audit_log 
        ADD CONSTRAINT chk_trigger_action 
        CHECK (trigger_action IN (
          'USER_LIMIT_REACHED', 
          'AUTO_PURCHASE_EXECUTED', 
          'ACCOUNT_SUSPENDED', 
          'ACCOUNT_REACTIVATED',
          'PAYMENT_FAILED',
          'PAYMENT_SUCCEEDED',
          'USER_ACTIVATED',
          'USER_DEACTIVATED'
        ));
    END IF;
END $$;

-- =====================================================
-- FASE 8: Funciones Helper para Conteo de Usuarios
-- =====================================================

-- Función para contar usuarios activos de una business account
CREATE OR REPLACE FUNCTION count_active_users(business_account_uuid VARCHAR)
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
CREATE OR REPLACE FUNCTION get_user_limit(business_account_uuid VARCHAR)
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

-- Aplicar trigger a tabla users (solo si no existe)
DROP TRIGGER IF EXISTS trigger_log_user_status_changes ON users;
CREATE TRIGGER trigger_log_user_status_changes
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION log_user_status_changes();

-- =====================================================
-- FASE 10: Datos de Ejemplo para Testing
-- =====================================================

-- Insertar productos adicionales de ejemplo (solo si no existen)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM additional_products WHERE name = 'Usuario Adicional') THEN
    INSERT INTO additional_products (name, description, type, price, module_type, unit_increment, is_active)
    VALUES ('Usuario Adicional', 'Usuario adicional para el equipo', 'USER_ADDON', 10.00, 'USERS', 1, true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM additional_products WHERE name = 'Módulo CRM Avanzado') THEN
    INSERT INTO additional_products (name, description, type, price, module_type, unit_increment, is_active)
    VALUES ('Módulo CRM Avanzado', 'Funcionalidades avanzadas de CRM', 'MODULE', 25.00, 'CRM', 1, true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM additional_products WHERE name = 'Módulo Contactos Premium') THEN
    INSERT INTO additional_products (name, description, type, price, module_type, unit_increment, is_active)
    VALUES ('Módulo Contactos Premium', 'Gestión avanzada de contactos', 'MODULE', 15.00, 'CONTACTS', 1, true);
  END IF;
END $$;

-- =====================================================
-- VERIFICACIÓN DE MIGRACIÓN
-- =====================================================

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