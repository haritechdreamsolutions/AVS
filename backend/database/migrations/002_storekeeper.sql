-- Migration 002: Store Keeper & Inventory enhancements
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS reference VARCHAR(100);
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS received_by VARCHAR(150);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(10,2) DEFAULT 0.00;
