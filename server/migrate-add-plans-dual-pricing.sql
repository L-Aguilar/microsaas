-- Migration: Add dual pricing fields to plans table
-- This adds monthly_price and annual_price columns to support dual pricing for plans

-- Add new columns for dual pricing and improve existing fields
ALTER TABLE plans 
ADD COLUMN monthly_price DECIMAL(10,2),
ADD COLUMN annual_price DECIMAL(10,2),
ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;

-- Migrate existing price data to monthly_price
UPDATE plans 
SET monthly_price = price;

-- For plans with ANNUAL billing_frequency, move price to annual_price
UPDATE plans 
SET annual_price = price, monthly_price = NULL 
WHERE billing_frequency = 'ANNUAL';

-- Set default trial days if null
UPDATE plans 
SET trial_days = 0 
WHERE trial_days IS NULL;

-- Set default active status
UPDATE plans 
SET is_active = true 
WHERE is_active IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN plans.monthly_price IS 'Price for monthly billing';
COMMENT ON COLUMN plans.annual_price IS 'Price for annual billing';
COMMENT ON COLUMN plans.price IS 'Legacy price field, kept for compatibility';
COMMENT ON COLUMN plans.trial_days IS 'Number of trial days before billing starts';
COMMENT ON COLUMN plans.is_active IS 'Whether the plan is currently available for subscription';