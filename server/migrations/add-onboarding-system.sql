-- Migration: Add onboarding system for business accounts
-- Compatible with Supabase, Railway, and Vercel

-- Add onboarding fields to business_accounts table
ALTER TABLE business_accounts 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS plan_selected BOOLEAN DEFAULT FALSE;

-- Create company_profiles table for detailed company information
CREATE TABLE IF NOT EXISTS company_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_account_id UUID NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
    industry VARCHAR(100),
    employee_count VARCHAR(50),
    website VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one profile per business account
    UNIQUE(business_account_id)
);

-- Create business_account_plans table to track selected plans
CREATE TABLE IF NOT EXISTS business_account_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_account_id UUID NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
    plan_name VARCHAR(100) NOT NULL,
    billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'annual')) DEFAULT 'monthly',
    price_per_month DECIMAL(10,2),
    features JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one active plan per business account
    UNIQUE(business_account_id, is_active) WHERE is_active = TRUE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_accounts_onboarding ON business_accounts(onboarding_completed);
CREATE INDEX IF NOT EXISTS idx_company_profiles_business_id ON company_profiles(business_account_id);
CREATE INDEX IF NOT EXISTS idx_business_plans_active ON business_account_plans(business_account_id, is_active);

-- Industry options as enum for consistency
CREATE TYPE IF NOT EXISTS industry_type AS ENUM (
    'Tecnología',
    'Salud',
    'Educación', 
    'Finanzas',
    'Retail',
    'Manufactura',
    'Servicios',
    'Construcción',
    'Agricultura',
    'Turismo',
    'Medios',
    'Logística',
    'Inmobiliaria',
    'Consultoría',
    'Otro'
);

-- Employee count options
CREATE TYPE IF NOT EXISTS employee_count_type AS ENUM (
    '1-10',
    '11-50', 
    '51-200',
    '201-500',
    '501-1000',
    '1000+'
);

-- Update company_profiles to use enums
ALTER TABLE company_profiles 
ALTER COLUMN industry TYPE industry_type USING industry::industry_type,
ALTER COLUMN employee_count TYPE employee_count_type USING employee_count::employee_count_type;

-- Default plans data
INSERT INTO plans (id, name, description, price_monthly, price_annual, features, is_active, created_at, updated_at) 
VALUES 
    ('basic-plan', 'Plan Básico', 'Perfecto para empresas pequeñas', 29.99, 299.99, 
     '["Hasta 5 usuarios", "CRM básico", "Gestión de contactos", "Soporte por email"]'::jsonb, 
     true, NOW(), NOW()),
    ('professional-plan', 'Plan Profesional', 'Ideal para empresas en crecimiento', 79.99, 799.99,
     '["Hasta 25 usuarios", "CRM avanzado", "Pipeline de ventas", "Reportes", "Soporte prioritario"]'::jsonb,
     true, NOW(), NOW()),
    ('enterprise-plan', 'Plan Enterprise', 'Para empresas grandes', 199.99, 1999.99,
     '["Usuarios ilimitados", "CRM completo", "Automatización", "API", "Soporte 24/7"]'::jsonb,
     true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;