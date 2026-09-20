-- Migration 003: Product UOM, Packaging Conversion & Buy Rate Foundation
ALTER TABLE products ADD COLUMN IF NOT EXISTS pack_size VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS buy_rate_uom VARCHAR(50) DEFAULT 'Tray';
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_rate_uom VARCHAR(50) DEFAULT 'Tray';

ALTER TABLE product_price_history ADD COLUMN IF NOT EXISTS buy_rate_uom VARCHAR(50);
ALTER TABLE product_price_history ADD COLUMN IF NOT EXISTS selling_rate_uom VARCHAR(50);

CREATE TABLE IF NOT EXISTS product_uoms (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  uom VARCHAR(50) NOT NULL,
  conversion_to_base NUMERIC(10,2) NOT NULL CHECK (conversion_to_base > 0),
  is_base_uom BOOLEAN NOT NULL DEFAULT FALSE,
  is_purchase_uom BOOLEAN NOT NULL DEFAULT FALSE,
  is_sales_uom BOOLEAN NOT NULL DEFAULT FALSE,
  buy_rate NUMERIC(10,2) DEFAULT 0.00 CHECK (buy_rate >= 0),
  selling_rate NUMERIC(10,2) DEFAULT 0.00 CHECK (selling_rate >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_prod_uom UNIQUE (product_id, uom)
);
