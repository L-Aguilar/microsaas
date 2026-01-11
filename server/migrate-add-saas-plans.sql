-- Migration: Add SaaS Plans System
-- Date: 2024-01-04
-- Description: Adds complete SaaS plans, products, and subscription management

-- Add new enums
CREATE TYPE billing_frequency AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE plan_status AS ENUM ('ACTIVE', 'INACTIVE', 'DEPRECATED');
CREATE TYPE product_type AS ENUM ('MODULE', 'USER_ADDON', 'FEATURE_ADDON', 'STORAGE_ADDON');
CREATE TYPE subscription_status AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED');

-- Update existing module_type enum to include new modules
ALTER TYPE module_type ADD VALUE IF NOT EXISTS 'REPORTS';
ALTER TYPE module_type ADD VALUE IF NOT EXISTS 'AUTOMATION';

-- Plans table
CREATE TABLE plans (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    billing_frequency billing_frequency NOT NULL DEFAULT 'MONTHLY',
    trial_days INTEGER NOT NULL DEFAULT 14,
    status plan_status NOT NULL DEFAULT 'ACTIVE',
    is_default BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    features TEXT[],
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Products table (independent add-ons)
CREATE TABLE products (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    type product_type NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    billing_frequency billing_frequency NOT NULL DEFAULT 'MONTHLY',
    module_type module_type, -- NULL for non-module products
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata TEXT, -- JSON for extra configuration
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Plan Modules - defines what modules are included in each plan and their limits
CREATE TABLE plan_modules (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id VARCHAR NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    module_type module_type NOT NULL,
    is_included BOOLEAN NOT NULL DEFAULT true,
    item_limit INTEGER, -- NULL = unlimited, number = limit
    can_create BOOLEAN NOT NULL DEFAULT true,
    can_edit BOOLEAN NOT NULL DEFAULT true,
    can_delete BOOLEAN NOT NULL DEFAULT true,
    features TEXT[] -- Specific features for this module in this plan
);

-- Business Account Plans - current plan subscription for each business account
CREATE TABLE business_account_plans (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    business_account_id VARCHAR NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
    plan_id VARCHAR NOT NULL REFERENCES plans(id),
    status subscription_status NOT NULL DEFAULT 'TRIAL',
    trial_start_date TIMESTAMP DEFAULT NOW(),
    trial_end_date TIMESTAMP,
    subscription_start_date TIMESTAMP,
    subscription_end_date TIMESTAMP,
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    billing_frequency billing_frequency NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Business Account Products - additional products/add-ons subscribed by business accounts
CREATE TABLE business_account_products (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    business_account_id VARCHAR NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
    product_id VARCHAR NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    status subscription_status NOT NULL DEFAULT 'ACTIVE',
    subscription_start_date TIMESTAMP DEFAULT NOW(),
    subscription_end_date TIMESTAMP,
    unit_price DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    billing_frequency billing_frequency NOT NULL,
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Plan Usage Tracking - tracks current usage for limit enforcement
CREATE TABLE plan_usage (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    business_account_id VARCHAR NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
    module_type module_type NOT NULL,
    current_count INTEGER NOT NULL DEFAULT 0,
    last_calculated TIMESTAMP DEFAULT NOW() NOT NULL,
    
    -- Ensure one record per business account + module type
    UNIQUE(business_account_id, module_type)
);

-- Sessions table for express-session (if not exists)
CREATE TABLE IF NOT EXISTS sessions (
    sid VARCHAR NOT NULL COLLATE "default",
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
) WITH (OIDS=FALSE);

-- Add indexes for performance
CREATE INDEX idx_plans_status ON plans(status);
CREATE INDEX idx_plans_is_default ON plans(is_default);
CREATE INDEX idx_products_type ON products(type);
CREATE INDEX idx_products_module_type ON products(module_type);
CREATE INDEX idx_plan_modules_plan_id ON plan_modules(plan_id);
CREATE INDEX idx_plan_modules_module_type ON plan_modules(module_type);
CREATE INDEX idx_business_account_plans_business_account_id ON business_account_plans(business_account_id);
CREATE INDEX idx_business_account_plans_status ON business_account_plans(status);
CREATE INDEX idx_business_account_products_business_account_id ON business_account_products(business_account_id);
CREATE INDEX idx_plan_usage_business_account_id ON plan_usage(business_account_id);
CREATE INDEX idx_plan_usage_module_type ON plan_usage(module_type);

-- Add sessions table index
CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products  
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_account_plans_updated_at BEFORE UPDATE ON business_account_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_account_products_updated_at BEFORE UPDATE ON business_account_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default plan (Basic)
INSERT INTO plans (name, description, price, billing_frequency, trial_days, status, is_default, display_order, features) 
VALUES (
    'Plan Básico',
    'Plan inicial para empezar con todas las funciones básicas',
    29.99,
    'MONTHLY',
    14,
    'ACTIVE',
    true,
    1,
    ARRAY['5 usuarios incluidos', '100 empresas', 'CRM básico', 'Soporte por email']
);

-- Get the default plan ID for module configuration
DO $$
DECLARE
    default_plan_id VARCHAR;
BEGIN
    SELECT id INTO default_plan_id FROM plans WHERE is_default = true LIMIT 1;
    
    -- Configure modules for default plan
    INSERT INTO plan_modules (plan_id, module_type, is_included, item_limit, can_create, can_edit, can_delete) VALUES
    (default_plan_id, 'USERS', true, 5, true, true, true),
    (default_plan_id, 'COMPANIES', true, 100, true, true, true),
    (default_plan_id, 'CRM', true, NULL, true, true, true);
END $$;

-- Insert some sample products
INSERT INTO products (name, description, type, price, billing_frequency, module_type, is_active) VALUES
('Usuario Adicional', 'Agrega un usuario extra a tu plan', 'USER_ADDON', 5.00, 'MONTHLY', 'USERS', true),
('Módulo de Facturación', 'Sistema completo de facturación y pagos', 'MODULE', 25.00, 'MONTHLY', 'BILLING', true),
('Módulo de Inventario', 'Gestión completa de inventario y productos', 'MODULE', 30.00, 'MONTHLY', 'INVENTORY', true),
('Analíticas Avanzadas', 'Reportes y analíticas detalladas', 'FEATURE_ADDON', 15.00, 'MONTHLY', 'ANALYTICS', true);

COMMIT;