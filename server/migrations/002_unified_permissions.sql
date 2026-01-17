-- Phase 2A: Unified Permission System Database Schema
-- This migration creates the new unified permission architecture

-- 1. Create business account module overrides table
-- This allows business admins to restrict modules beyond what their plan allows
CREATE TABLE IF NOT EXISTS business_account_module_overrides (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_account_id VARCHAR(36) NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
    module_type VARCHAR(50) NOT NULL, -- COMPANIES, USERS, CRM, etc.
    is_disabled BOOLEAN NOT NULL DEFAULT false,
    item_limit INTEGER, -- Override plan limit if smaller (null = use plan limit)
    custom_permissions JSONB, -- Store custom permission overrides
    disabled_by VARCHAR(36) REFERENCES users(id),
    disabled_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(business_account_id, module_type)
);

-- 2. Create indexes for performance
CREATE INDEX idx_ba_module_overrides_business_account ON business_account_module_overrides(business_account_id);
CREATE INDEX idx_ba_module_overrides_module_type ON business_account_module_overrides(module_type);

-- 3. Add columns to user_permissions to support the cascade system
-- First check if columns exist to avoid errors on re-run
DO $$ 
BEGIN 
    -- Add source tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'assigned_by') THEN
        ALTER TABLE user_permissions ADD COLUMN assigned_by VARCHAR(36) REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'assigned_at') THEN
        ALTER TABLE user_permissions ADD COLUMN assigned_at TIMESTAMP DEFAULT NOW();
    END IF;
    
    -- Add business account reference for faster queries (if not exists)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'business_account_id') THEN
        ALTER TABLE user_permissions ADD COLUMN business_account_id VARCHAR(36) REFERENCES business_accounts(id);
    END IF;
    
    -- Add notes for business admin context
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'notes') THEN
        ALTER TABLE user_permissions ADD COLUMN notes TEXT;
    END IF;
END $$;

-- 4. Create indexes on user_permissions
CREATE INDEX IF NOT EXISTS idx_user_permissions_business_account ON user_permissions(business_account_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_module ON user_permissions(user_id, module_type);

-- 5. Create a view for unified permission resolution
CREATE OR REPLACE VIEW v_unified_permissions AS
SELECT DISTINCT
    ba.id as business_account_id,
    ba.name as business_account_name,
    pm.module_type::text as module_type,
    pm.is_included as plan_includes_module,
    pm.item_limit as plan_item_limit,
    bamo.is_disabled as business_override_disabled,
    bamo.item_limit as business_override_limit,
    CASE 
        WHEN bamo.is_disabled = true THEN false
        WHEN pm.is_included = false THEN false
        ELSE true
    END as module_available,
    CASE 
        WHEN bamo.is_disabled = true THEN 0
        WHEN bamo.item_limit IS NOT NULL AND bamo.item_limit < pm.item_limit THEN bamo.item_limit
        ELSE pm.item_limit
    END as effective_item_limit
FROM business_accounts ba
LEFT JOIN business_account_plans bap ON ba.id = bap.business_account_id AND bap.status IN ('TRIAL', 'ACTIVE')
LEFT JOIN plans p ON bap.plan_id = p.id
LEFT JOIN plan_modules pm ON p.id = pm.plan_id
LEFT JOIN business_account_module_overrides bamo ON ba.id = bamo.business_account_id AND pm.module_type::text = bamo.module_type
WHERE ba.is_active = true
    AND (bap.id IS NULL OR bap.status IN ('TRIAL', 'ACTIVE'))
    AND pm.module_type IS NOT NULL;

-- 6. Create function to get effective permissions
CREATE OR REPLACE FUNCTION get_effective_permissions(
    p_business_account_id VARCHAR(36),
    p_module_type VARCHAR(50),
    p_user_id VARCHAR(36) DEFAULT NULL
) RETURNS TABLE(
    has_access BOOLEAN,
    can_create BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN,
    can_view BOOLEAN,
    item_limit INTEGER,
    source VARCHAR(20)
) AS $$
DECLARE
    v_plan_permissions RECORD;
    v_business_override RECORD;
    v_user_permissions RECORD;
BEGIN
    -- Get plan permissions
    SELECT 
        vup.module_available,
        vup.plan_includes_module,
        vup.effective_item_limit
    INTO v_plan_permissions
    FROM v_unified_permissions vup
    WHERE vup.business_account_id = p_business_account_id
        AND vup.module_type = p_module_type;
    
    -- If no plan permissions found, deny access
    IF v_plan_permissions IS NULL OR v_plan_permissions.module_available = false THEN
        RETURN QUERY SELECT false, false, false, false, false, 0, 'PLAN'::VARCHAR(20);
        RETURN;
    END IF;
    
    -- Get user-specific permissions if user_id provided
    IF p_user_id IS NOT NULL THEN
        SELECT 
            up.can_create,
            up.can_edit,
            up.can_delete,
            up.can_view
        INTO v_user_permissions
        FROM user_permissions up
        WHERE up.user_id = p_user_id
            AND up.module_type = p_module_type
            AND up.business_account_id = p_business_account_id;
    END IF;
    
    -- Return effective permissions (user overrides take precedence if they exist)
    RETURN QUERY SELECT 
        true, -- has_access
        COALESCE(v_user_permissions.can_create, true),
        COALESCE(v_user_permissions.can_edit, true),
        COALESCE(v_user_permissions.can_delete, true),
        COALESCE(v_user_permissions.can_view, true),
        v_plan_permissions.effective_item_limit,
        CASE 
            WHEN v_user_permissions IS NOT NULL THEN 'USER'
            WHEN v_plan_permissions.module_available THEN 'PLAN'
            ELSE 'DENIED'
        END::VARCHAR(20);
END;
$$ LANGUAGE plpgsql;

-- 7. Populate business_account_id in existing user_permissions
UPDATE user_permissions 
SET business_account_id = (
    SELECT u.business_account_id 
    FROM users u 
    WHERE u.id = user_permissions.user_id
)
WHERE business_account_id IS NULL;

-- 8. Create trigger to auto-populate business_account_id in user_permissions
CREATE OR REPLACE FUNCTION auto_populate_user_permission_business_account()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.business_account_id IS NULL THEN
        SELECT business_account_id INTO NEW.business_account_id
        FROM users 
        WHERE id = NEW.user_id;
    END IF;
    
    NEW.assigned_at = COALESCE(NEW.assigned_at, NOW());
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_permissions_auto_populate
    BEFORE INSERT OR UPDATE ON user_permissions
    FOR EACH ROW
    EXECUTE FUNCTION auto_populate_user_permission_business_account();

COMMENT ON TABLE business_account_module_overrides IS 'Allows business admins to restrict modules beyond plan limitations';
COMMENT ON VIEW v_unified_permissions IS 'Unified view combining plan permissions with business account overrides';
COMMENT ON FUNCTION get_effective_permissions IS 'Function to resolve final permissions considering plan -> business -> user hierarchy';