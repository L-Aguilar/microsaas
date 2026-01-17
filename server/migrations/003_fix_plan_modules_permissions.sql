-- Migration 003: Fix plan_modules table to support detailed permissions
-- This adds the missing permission columns to plan_modules table

-- 1. Add detailed permission columns to plan_modules
DO $$ 
BEGIN 
    -- Add permission columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plan_modules' AND column_name = 'can_create') THEN
        ALTER TABLE plan_modules ADD COLUMN can_create BOOLEAN NOT NULL DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plan_modules' AND column_name = 'can_edit') THEN
        ALTER TABLE plan_modules ADD COLUMN can_edit BOOLEAN NOT NULL DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plan_modules' AND column_name = 'can_delete') THEN
        ALTER TABLE plan_modules ADD COLUMN can_delete BOOLEAN NOT NULL DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plan_modules' AND column_name = 'can_view') THEN
        ALTER TABLE plan_modules ADD COLUMN can_view BOOLEAN NOT NULL DEFAULT true;
    END IF;
    
    -- Update existing records to have proper permissions
    -- If is_included = true, grant all permissions
    -- If is_included = false, deny all permissions
    UPDATE plan_modules 
    SET 
        can_create = is_included,
        can_edit = is_included,
        can_delete = is_included,
        can_view = is_included
    WHERE 
        can_create IS NULL OR can_edit IS NULL OR can_delete IS NULL OR can_view IS NULL;
    
END $$;

-- 2. Ensure COMPANIES module exists in all plans
-- Check which plans exist and add COMPANIES if missing
INSERT INTO plan_modules (id, plan_id, module_type, is_included, item_limit, can_create, can_edit, can_delete, can_view)
SELECT 
    gen_random_uuid()::text as id,
    p.id as plan_id,
    'COMPANIES' as module_type,
    true as is_included,
    CASE 
        WHEN p.name ILIKE '%starter%' THEN 50
        WHEN p.name ILIKE '%basic%' THEN 200  
        WHEN p.name ILIKE '%professional%' THEN 1000
        WHEN p.name ILIKE '%enterprise%' THEN NULL -- unlimited
        ELSE 100 -- default limit
    END as item_limit,
    true as can_create,
    true as can_edit,
    true as can_delete,
    true as can_view
FROM plans p
WHERE NOT EXISTS (
    SELECT 1 FROM plan_modules pm 
    WHERE pm.plan_id = p.id AND pm.module_type = 'COMPANIES'
)
ON CONFLICT DO NOTHING;

-- 3. Create the unified permissions view (recreate if exists)
DROP VIEW IF EXISTS v_unified_permissions;

CREATE VIEW v_unified_permissions AS
WITH plan_permissions AS (
    -- Get permissions from plan
    SELECT 
        ba.id as business_account_id,
        pm.module_type,
        pm.can_create,
        pm.can_edit,
        pm.can_delete,
        pm.can_view,
        pm.item_limit,
        true as has_access,
        'PLAN' as source
    FROM business_accounts ba
    JOIN plan_modules pm ON ba.plan_id = pm.plan_id
    WHERE pm.is_included = true
),
business_overrides AS (
    -- Get business account overrides (restrictions only)
    SELECT 
        bamo.business_account_id,
        bamo.module_type,
        false as can_create,
        false as can_edit,
        false as can_delete,
        false as can_view,
        bamo.item_limit,
        false as has_access,
        'BUSINESS_OVERRIDE' as source
    FROM business_account_module_overrides bamo
    WHERE bamo.is_disabled = true
)
-- Combine plan permissions with business overrides
-- Business overrides take precedence (can only restrict, not grant)
SELECT 
    COALESCE(bo.business_account_id, pp.business_account_id) as business_account_id,
    COALESCE(bo.module_type, pp.module_type) as module_type,
    COALESCE(bo.can_create, pp.can_create, false) as can_create,
    COALESCE(bo.can_edit, pp.can_edit, false) as can_edit,
    COALESCE(bo.can_delete, pp.can_delete, false) as can_delete,
    COALESCE(bo.can_view, pp.can_view, false) as can_view,
    COALESCE(bo.item_limit, pp.item_limit) as item_limit,
    COALESCE(bo.has_access, pp.has_access, false) as has_access,
    COALESCE(bo.source, pp.source, 'DENIED') as source
FROM plan_permissions pp
FULL OUTER JOIN business_overrides bo 
    ON pp.business_account_id = bo.business_account_id 
    AND pp.module_type = bo.module_type;

-- 4. Create/recreate the permission resolution function
DROP FUNCTION IF EXISTS get_effective_permissions(VARCHAR, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION get_effective_permissions(
    p_business_account_id VARCHAR(36),
    p_module_type VARCHAR(50),
    p_user_id VARCHAR(36) DEFAULT NULL
)
RETURNS TABLE (
    business_account_id VARCHAR(36),
    module_type VARCHAR(50),
    can_create BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN,
    can_view BOOLEAN,
    item_limit INTEGER,
    has_access BOOLEAN,
    source VARCHAR(20)
) AS $$
DECLARE
    plan_record RECORD;
    business_record RECORD;
    user_record RECORD;
BEGIN
    -- Start with plan permissions
    SELECT 
        pm.can_create, pm.can_edit, pm.can_delete, pm.can_view,
        pm.item_limit, pm.is_included
    INTO plan_record
    FROM business_accounts ba
    JOIN plan_modules pm ON ba.plan_id = pm.plan_id
    WHERE ba.id = p_business_account_id 
      AND pm.module_type = p_module_type
      AND pm.is_included = true;
    
    -- If no plan permission found, return denied
    IF plan_record IS NULL THEN
        RETURN QUERY SELECT 
            p_business_account_id,
            p_module_type,
            false::BOOLEAN,
            false::BOOLEAN, 
            false::BOOLEAN,
            false::BOOLEAN,
            0::INTEGER,
            false::BOOLEAN,
            'DENIED'::VARCHAR(20);
        RETURN;
    END IF;
    
    -- Check for business account override (restrictions only)
    SELECT is_disabled, item_limit INTO business_record
    FROM business_account_module_overrides
    WHERE business_account_id = p_business_account_id 
      AND module_type = p_module_type;
    
    -- If business override disables the module, return denied
    IF business_record.is_disabled = true THEN
        RETURN QUERY SELECT 
            p_business_account_id,
            p_module_type,
            false::BOOLEAN,
            false::BOOLEAN,
            false::BOOLEAN, 
            false::BOOLEAN,
            COALESCE(business_record.item_limit, plan_record.item_limit)::INTEGER,
            false::BOOLEAN,
            'BUSINESS_OVERRIDE'::VARCHAR(20);
        RETURN;
    END IF;
    
    -- Check for user-specific permissions if user_id provided
    IF p_user_id IS NOT NULL THEN
        SELECT can_create, can_edit, can_delete, can_view INTO user_record
        FROM user_permissions
        WHERE user_id = p_user_id AND module_type = p_module_type;
        
        IF user_record IS NOT NULL THEN
            RETURN QUERY SELECT 
                p_business_account_id,
                p_module_type,
                user_record.can_create::BOOLEAN,
                user_record.can_edit::BOOLEAN,
                user_record.can_delete::BOOLEAN,
                user_record.can_view::BOOLEAN,
                COALESCE(business_record.item_limit, plan_record.item_limit)::INTEGER,
                user_record.can_view::BOOLEAN,
                'USER_OVERRIDE'::VARCHAR(20);
            RETURN;
        END IF;
    END IF;
    
    -- Return plan permissions (possibly with business limit override)
    RETURN QUERY SELECT 
        p_business_account_id,
        p_module_type,
        plan_record.can_create::BOOLEAN,
        plan_record.can_edit::BOOLEAN,
        plan_record.can_delete::BOOLEAN,
        plan_record.can_view::BOOLEAN,
        COALESCE(business_record.item_limit, plan_record.item_limit)::INTEGER,
        true::BOOLEAN,
        'PLAN'::VARCHAR(20);
    
END;
$$ LANGUAGE plpgsql;

-- 5. Verify the migration worked
DO $$
DECLARE
    companies_count INTEGER;
    view_count INTEGER;
    function_count INTEGER;
BEGIN
    -- Check if COMPANIES module was added to plans
    SELECT COUNT(*) INTO companies_count
    FROM plan_modules 
    WHERE module_type = 'COMPANIES';
    
    RAISE NOTICE 'COMPANIES modules in plans: %', companies_count;
    
    -- Check if view exists
    SELECT COUNT(*) INTO view_count
    FROM information_schema.views 
    WHERE table_name = 'v_unified_permissions';
    
    RAISE NOTICE 'Unified permissions view exists: %', (view_count > 0);
    
    -- Check if function exists
    SELECT COUNT(*) INTO function_count
    FROM pg_proc 
    WHERE proname = 'get_effective_permissions';
    
    RAISE NOTICE 'Permission function exists: %', (function_count > 0);
    
    IF companies_count = 0 OR view_count = 0 OR function_count = 0 THEN
        RAISE WARNING 'Migration may not have completed successfully';
    ELSE
        RAISE NOTICE 'Migration completed successfully!';
    END IF;
END $$;