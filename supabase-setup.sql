-- Script para configurar Shimli Admin en Supabase
-- Ejecutar este script completo en el SQL Editor de Supabase

-- Crear tablas principales
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions(expire);

CREATE TABLE IF NOT EXISTS business_accounts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  email VARCHAR,
  status VARCHAR DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modules (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  type VARCHAR NOT NULL,
  description VARCHAR,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  password VARCHAR NOT NULL,
  role VARCHAR NOT NULL DEFAULT 'USER',
  business_account_id VARCHAR REFERENCES business_accounts(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_account_modules (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  business_account_id VARCHAR NOT NULL REFERENCES business_accounts(id),
  module_id VARCHAR NOT NULL REFERENCES modules(id),
  is_enabled BOOLEAN DEFAULT true,
  enabled_by VARCHAR REFERENCES users(id),
  enabled_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  email VARCHAR,
  phone VARCHAR,
  website VARCHAR,
  industry VARCHAR,
  status VARCHAR DEFAULT 'LEAD',
  business_account_id VARCHAR NOT NULL REFERENCES business_accounts(id),
  owner_id VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opportunities (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  type VARCHAR DEFAULT 'NEW_CLIENT',
  status VARCHAR DEFAULT 'NEW',
  amount NUMERIC,
  probability INTEGER DEFAULT 0,
  estimated_close_date DATE,
  company_id VARCHAR NOT NULL REFERENCES companies(id),
  seller_id VARCHAR REFERENCES users(id),
  business_account_id VARCHAR NOT NULL REFERENCES business_accounts(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id VARCHAR NOT NULL REFERENCES opportunities(id),
  author_id VARCHAR NOT NULL REFERENCES users(id),
  type VARCHAR DEFAULT 'NOTE',
  summary VARCHAR NOT NULL,
  details TEXT,
  activity_date TIMESTAMP DEFAULT NOW(),
  business_account_id VARCHAR NOT NULL REFERENCES business_accounts(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insertar datos iniciales
INSERT INTO modules (id, name, type, description) VALUES
('mod-users', 'Gestión de Usuarios', 'USERS', 'Permite gestionar usuarios del sistema'),
('mod-companies', 'Gestión de Empresas', 'COMPANIES', 'Permite gestionar empresas y clientes'),
('mod-crm', 'Sistema CRM', 'CRM', 'Sistema completo de gestión de relaciones con clientes')
ON CONFLICT (id) DO NOTHING;

-- Insertar Super Admin
INSERT INTO users (id, name, email, password, role) VALUES
('super-admin-001', 'Super Admin', 'superadmin@crm.com', '$2b$10$8K6p8m1Y4vN3QxQgO5j7quO5L9Yk1L.1U7x4Bt9Z0HZ5Q6r8KX/0O', 'SUPER_ADMIN')
ON CONFLICT (email) DO NOTHING;

-- Mensaje de confirmación
SELECT 'Shimli Admin configurado exitosamente en Supabase' as mensaje;