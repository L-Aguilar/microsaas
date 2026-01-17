-- Migration: COMPANIES → CONTACTS
-- Fix inconsistency between frontend and database

-- 1. Update plan_modules table
UPDATE plan_modules 
SET module_type = 'CONTACTS'
WHERE module_type = 'COMPANIES';

-- 2. Update user_permissions table  
UPDATE user_permissions 
SET module_type = 'CONTACTS'
WHERE module_type = 'COMPANIES';

-- 3. Update business_account_module_overrides table
UPDATE business_account_module_overrides 
SET module_type = 'CONTACTS'
WHERE module_type = 'COMPANIES';

-- 4. Update modules table (if any records exist)
UPDATE modules
SET type = 'CONTACTS'
WHERE type = 'COMPANIES';

-- 5. Update business_account_modules table (if using old structure)
UPDATE business_account_modules bam
SET module_id = (SELECT id FROM modules WHERE type = 'CONTACTS' LIMIT 1)
WHERE module_id IN (SELECT id FROM modules WHERE type = 'COMPANIES');

-- 6. Verify the migration
SELECT 'plan_modules' as table_name, module_type::text, COUNT(*) as count
FROM plan_modules 
GROUP BY module_type;