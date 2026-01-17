-- Simplify plan_modules table by removing granular permission columns
-- These permissions should be managed by Business Admin, not by plan

-- Remove granular permission columns from plan_modules
ALTER TABLE plan_modules 
DROP COLUMN IF EXISTS can_create,
DROP COLUMN IF EXISTS can_edit, 
DROP COLUMN IF EXISTS can_delete;

-- Add comment to document the simplified architecture
COMMENT ON TABLE plan_modules IS 'Defines which modules are included in each plan with limits. Business Admin has full control over their company permissions.';