-- Migration: Add dual pricing fields to products table
-- This adds monthly_price and annual_price columns to support dual pricing

-- Add new columns for dual pricing
ALTER TABLE products 
ADD COLUMN monthly_price DECIMAL(10,2),
ADD COLUMN annual_price DECIMAL(10,2);

-- Migrate existing price data to monthly_price
UPDATE products 
SET monthly_price = price;

-- For products with ANNUAL billing_frequency, move price to annual_price
UPDATE products 
SET annual_price = price, monthly_price = NULL 
WHERE billing_frequency = 'ANNUAL';

-- Comment for documentation
COMMENT ON COLUMN products.monthly_price IS 'Price for monthly billing';
COMMENT ON COLUMN products.annual_price IS 'Price for annual billing';
COMMENT ON COLUMN products.price IS 'Legacy price field, kept for compatibility';
COMMENT ON COLUMN products.billing_frequency IS 'Legacy billing frequency field, kept for compatibility';