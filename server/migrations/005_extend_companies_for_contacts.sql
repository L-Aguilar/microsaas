-- Migration: Extend companies table with contact-specific fields
-- Date: 2026-01-26
-- Description: Adds new fields for complete contact management without renaming the table

-- Step 1: Create source enum for contact origin tracking
DO $$ BEGIN
    CREATE TYPE contact_source AS ENUM ('MANUAL', 'IMPORTED', 'API');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add new columns to companies table
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS mobile TEXT,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS position TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS avatar TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS source contact_source DEFAULT 'MANUAL',
ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id),
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Step 3: Create unique indexes for email and phone per business_account (only for non-deleted records)
-- Drop existing indexes if they exist (to avoid conflicts)
DROP INDEX IF EXISTS idx_companies_email_per_business;
DROP INDEX IF EXISTS idx_companies_phone_per_business;

-- Create unique partial indexes (only where is_deleted = false and field is not null/empty)
CREATE UNIQUE INDEX idx_companies_email_per_business
ON companies(LOWER(email), business_account_id)
WHERE is_deleted = false AND email IS NOT NULL AND email != '';

CREATE UNIQUE INDEX idx_companies_phone_per_business
ON companies(phone, business_account_id)
WHERE is_deleted = false AND phone IS NOT NULL AND phone != '';

-- Step 4: Create search index for better performance
DROP INDEX IF EXISTS idx_companies_search;
CREATE INDEX idx_companies_search
ON companies(name, email, phone, company_name);

-- Step 5: Create GIN index for tags array search
DROP INDEX IF EXISTS idx_companies_tags;
CREATE INDEX idx_companies_tags
ON companies USING GIN(tags);

-- Step 6: Create index for soft delete queries
DROP INDEX IF EXISTS idx_companies_is_deleted;
CREATE INDEX idx_companies_is_deleted
ON companies(business_account_id, is_deleted);

-- Step 7: Verify migration
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'companies'
ORDER BY ordinal_position;
