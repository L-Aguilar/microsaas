-- Migration: Rename COMPANIES module to CONTACTS
-- Date: 2026-01-15
-- Description: Updates module_type enum and existing data from COMPANIES to CONTACTS

-- Step 1: Add new CONTACTS value to enum
ALTER TYPE module_type ADD VALUE 'CONTACTS';

-- Step 2: Update existing data
UPDATE plan_modules SET module_type = 'CONTACTS' WHERE module_type = 'COMPANIES';

-- Step 3: Update business_account_modules if they exist
-- (This table uses module_id, so we need to check if there are COMPANIES references)
-- Note: We'll handle this separately if needed based on the actual data structure

-- Step 4: Cannot remove COMPANIES from enum in PostgreSQL, but it will be unused
-- The old value will remain in the enum but won't be used anywhere

COMMIT;