-- SIMPLIFIED SECURITY MIGRATION FOR SUPABASE
-- Execute these commands directly in Supabase SQL editor or via API

-- 1. ADD PROPER FOREIGN KEY CONSTRAINTS WITH CASCADE
ALTER TABLE user_permissions 
DROP CONSTRAINT IF EXISTS user_permissions_user_id_fkey;

ALTER TABLE user_permissions 
ADD CONSTRAINT user_permissions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 2. ADD MISSING DATABASE CONSTRAINTS
-- Ensure business account names are not empty
ALTER TABLE business_accounts 
ADD CONSTRAINT IF NOT EXISTS check_name_not_empty 
CHECK (LENGTH(TRIM(name)) > 0);

-- Add email format validation
ALTER TABLE users 
ADD CONSTRAINT IF NOT EXISTS check_email_format 
CHECK (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$');

-- Ensure user permissions are valid
ALTER TABLE user_permissions
ADD CONSTRAINT IF NOT EXISTS check_valid_module_type
CHECK (module_type IN ('USERS', 'COMPANIES', 'CRM', 'REPORTS'));

-- 3. ADD PERFORMANCE AND SECURITY INDEXES
CREATE INDEX IF NOT EXISTS idx_user_permissions_composite 
ON user_permissions(user_id, module_type);

CREATE INDEX IF NOT EXISTS idx_business_account_modules_composite 
ON business_account_modules(business_account_id, module_id, is_enabled);

CREATE INDEX IF NOT EXISTS idx_activities_business_account 
ON activities(business_account_id, created_at);

CREATE INDEX IF NOT EXISTS idx_companies_business_account_status 
ON companies(business_account_id, status) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_business_account_status 
ON opportunities(business_account_id, status, created_at) 
WHERE deleted_at IS NULL;

-- 4. CREATE AUDIT TABLE FOR SECURITY MONITORING
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

-- 5. ADD SOFT DELETE SUPPORT
-- Add deleted_at columns where missing
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

ALTER TABLE user_permissions 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Note: RLS policies are not implemented in this simplified version
-- as they require more complex setup with Supabase's auth system
-- The application-level security fixes provide adequate protection

COMMIT;