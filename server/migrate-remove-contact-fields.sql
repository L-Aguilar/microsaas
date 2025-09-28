-- Migration to remove duplicate contactName field from business_accounts table
-- The contactName will be maintained in users table as 'name' field

-- Backup current data (in case needed)
-- CREATE TABLE business_accounts_backup AS SELECT * FROM business_accounts;

-- Remove the contactName column from business_accounts
ALTER TABLE business_accounts DROP COLUMN IF EXISTS contact_name;

-- Optional: Add a comment to document this change
COMMENT ON TABLE business_accounts IS 'Business accounts table - contact information now stored in associated users table';