-- Migration to add soft delete functionality to business_accounts table
-- Add deleted_at timestamp column for soft delete functionality

-- Add the deleted_at column to business_accounts
ALTER TABLE business_accounts ADD COLUMN deleted_at TIMESTAMP NULL;

-- Add index for performance on queries filtering non-deleted records
CREATE INDEX idx_business_accounts_deleted_at ON business_accounts (deleted_at) WHERE deleted_at IS NULL;

-- Add a comment to document the soft delete functionality
COMMENT ON COLUMN business_accounts.deleted_at IS 'Timestamp when business account was soft deleted. NULL means active.';