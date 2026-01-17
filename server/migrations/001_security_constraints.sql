-- CRITICAL SECURITY MIGRATION: Add proper constraints and Row Level Security
-- This migration addresses critical security vulnerabilities in the permission system

-- ===============================================
-- 1. ADD PROPER FOREIGN KEY CONSTRAINTS WITH CASCADE
-- ===============================================

-- Fix user_permissions table constraints
ALTER TABLE user_permissions 
DROP CONSTRAINT IF EXISTS user_permissions_user_id_fkey;

ALTER TABLE user_permissions 
ADD CONSTRAINT user_permissions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add business account validation constraint
ALTER TABLE user_permissions 
ADD CONSTRAINT check_user_business_account 
CHECK (
  user_id IN (
    SELECT id FROM users WHERE business_account_id = 
    (SELECT business_account_id FROM user_permissions up WHERE up.user_id = user_permissions.user_id)
  )
);

-- ===============================================
-- 2. IMPLEMENT ROW LEVEL SECURITY (RLS)
-- ===============================================

-- Enable RLS on all sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Create policies for business account isolation
-- Note: These policies assume app sets current_setting('app.current_business_account_id')

CREATE POLICY business_account_isolation_users ON users
  FOR ALL TO application_role
  USING (
    business_account_id = current_setting('app.current_business_account_id', true)
    OR current_setting('app.user_role', true) = 'SUPER_ADMIN'
  );

CREATE POLICY business_account_isolation_companies ON companies
  FOR ALL TO application_role
  USING (
    business_account_id = current_setting('app.current_business_account_id', true)
    OR current_setting('app.user_role', true) = 'SUPER_ADMIN'
  );

CREATE POLICY business_account_isolation_opportunities ON opportunities
  FOR ALL TO application_role
  USING (
    business_account_id = current_setting('app.current_business_account_id', true)
    OR current_setting('app.user_role', true) = 'SUPER_ADMIN'
  );

CREATE POLICY business_account_isolation_activities ON activities
  FOR ALL TO application_role
  USING (
    business_account_id = current_setting('app.current_business_account_id', true)
    OR current_setting('app.user_role', true) = 'SUPER_ADMIN'
  );

CREATE POLICY business_account_isolation_permissions ON user_permissions
  FOR ALL TO application_role
  USING (
    user_id IN (
      SELECT id FROM users WHERE business_account_id = current_setting('app.current_business_account_id', true)
    )
    OR current_setting('app.user_role', true) = 'SUPER_ADMIN'
  );

-- ===============================================
-- 3. ADD MISSING DATABASE CONSTRAINTS
-- ===============================================

-- Ensure business account names are not empty
ALTER TABLE business_accounts 
ADD CONSTRAINT check_name_not_empty 
CHECK (LENGTH(TRIM(name)) > 0);

-- Add email format validation
ALTER TABLE users 
ADD CONSTRAINT check_email_format 
CHECK (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$');

-- Ensure user permissions are valid
ALTER TABLE user_permissions
ADD CONSTRAINT check_valid_module_type
CHECK (module_type IN ('USERS', 'COMPANIES', 'CRM', 'REPORTS'));

-- ===============================================
-- 4. ADD PERFORMANCE AND SECURITY INDEXES
-- ===============================================

-- Composite indexes for user permissions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_permissions_composite 
ON user_permissions(user_id, module_type, business_account_id);

-- Business account module access index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_account_modules_composite 
ON business_account_modules(business_account_id, module_id, is_enabled);

-- Performance indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_business_account 
ON activities(business_account_id, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_business_account_status 
ON companies(business_account_id, status) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opportunities_business_account_status 
ON opportunities(business_account_id, status, created_at) 
WHERE deleted_at IS NULL;

-- ===============================================
-- 5. CREATE AUDIT TABLE FOR SECURITY MONITORING
-- ===============================================

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
  record_id VARCHAR(100),
  old_values JSONB,
  new_values JSONB,
  user_id VARCHAR(100),
  business_account_id VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  performed_at TIMESTAMP DEFAULT NOW()
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_log_composite
ON audit_log(business_account_id, user_id, performed_at);

-- ===============================================
-- 6. CREATE SECURITY FUNCTIONS
-- ===============================================

-- Function to validate business account access
CREATE OR REPLACE FUNCTION validate_business_account_access(
  target_business_account_id VARCHAR,
  user_role VARCHAR,
  user_business_account_id VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
  -- SUPER_ADMIN can access any business account
  IF user_role = 'SUPER_ADMIN' THEN
    RETURN TRUE;
  END IF;
  
  -- Others can only access their own business account
  RETURN target_business_account_id = user_business_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to audit sensitive operations
CREATE OR REPLACE FUNCTION log_audit_event(
  p_table_name VARCHAR,
  p_operation VARCHAR,
  p_record_id VARCHAR,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_user_id VARCHAR DEFAULT NULL,
  p_business_account_id VARCHAR DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO audit_log (
    table_name, operation, record_id, old_values, new_values,
    user_id, business_account_id
  ) VALUES (
    p_table_name, p_operation, p_record_id, p_old_values, p_new_values,
    p_user_id, p_business_account_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================================
-- 7. ADD SOFT DELETE SUPPORT
-- ===============================================

-- Add deleted_at columns where missing
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

ALTER TABLE user_permissions 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Update RLS policies to exclude soft-deleted records
CREATE OR REPLACE POLICY business_account_isolation_users ON users
  FOR ALL TO application_role
  USING (
    (business_account_id = current_setting('app.current_business_account_id', true)
    OR current_setting('app.user_role', true) = 'SUPER_ADMIN')
    AND deleted_at IS NULL
  );

-- ===============================================
-- VERIFICATION QUERIES
-- ===============================================

-- Verify constraints were created
SELECT 
  conname, 
  contype, 
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid IN (
  SELECT oid FROM pg_class 
  WHERE relname IN ('users', 'user_permissions', 'business_accounts')
);

-- Verify RLS is enabled
SELECT 
  schemaname, 
  tablename, 
  rowsecurity, 
  policyname 
FROM pg_policies 
WHERE tablename IN ('users', 'companies', 'opportunities', 'user_permissions');

-- Verify indexes were created
SELECT 
  indexname, 
  tablename, 
  indexdef 
FROM pg_indexes 
WHERE tablename IN ('user_permissions', 'business_account_modules', 'audit_log')
  AND indexname LIKE '%security%' OR indexname LIKE '%composite%';

COMMIT;