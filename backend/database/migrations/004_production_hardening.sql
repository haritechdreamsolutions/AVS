ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS credential_kind TEXT NOT NULL DEFAULT 'pin';
ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS pack_size VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS buy_rate_uom VARCHAR(50) DEFAULT 'Tray';
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_rate_uom VARCHAR(50) DEFAULT 'Tray';
ALTER TABLE products ADD COLUMN IF NOT EXISTS direct_sale_rate NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE route_assignments ADD COLUMN IF NOT EXISTS company_id INTEGER;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS previous_due NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS old_credit_paid NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS request_key TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS request_hash TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS financial_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS conversion_to_base NUMERIC(12,4);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS stock_qty_units NUMERIC(12,4);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS ledger_ready BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS opening_due_remaining NUMERIC(10,2) NOT NULL DEFAULT 0;
CREATE SEQUENCE IF NOT EXISTS invoice_number_sequence;
CREATE UNIQUE INDEX IF NOT EXISTS production_bill_number ON sales(company_id,bill_no);
CREATE UNIQUE INDEX IF NOT EXISTS production_request_key ON sales(company_id,request_key) WHERE request_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS production_user_login ON user_accounts(LOWER(TRIM(login_id)));
CREATE UNIQUE INDEX IF NOT EXISTS production_employee_code ON employees(company_id,employee_code);
CREATE UNIQUE INDEX IF NOT EXISTS production_product_uom ON product_uoms(product_id,uom);
CREATE UNIQUE INDEX IF NOT EXISTS production_employee_stock ON employee_stock(employee_id,product_id);
CREATE UNIQUE INDEX IF NOT EXISTS production_route_day ON route_assignments(route_id,assigned_date);
CREATE UNIQUE INDEX IF NOT EXISTS production_supplier_rate ON supplier_product_rates(supplier_id,product_id);
CREATE UNIQUE INDEX IF NOT EXISTS production_settlement ON settlements(company_id,employee_id,settlement_date) WHERE employee_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS production_open_session ON driver_sessions(company_id,employee_id)
  WHERE status NOT IN ('CLOSED','COMPLETED','RECONCILED','RETURN_VERIFIED');
CREATE TABLE IF NOT EXISTS receipts (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  employee_id INTEGER,
  created_by INTEGER NOT NULL REFERENCES user_accounts(id),
  request_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK(amount>0),
  payment_mode TEXT NOT NULL CHECK(payment_mode IN ('CASH','GPAY')),
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id,request_key)
);
CREATE TABLE IF NOT EXISTS receipt_allocations (
  id BIGSERIAL PRIMARY KEY,
  receipt_id BIGINT NOT NULL REFERENCES receipts(id),
  sale_id INTEGER REFERENCES sales(id),
  amount NUMERIC(12,2) NOT NULL CHECK(amount>0)
);
CREATE TABLE IF NOT EXISTS payment_reversals (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  created_by INTEGER NOT NULL REFERENCES user_accounts(id),
  request_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK(amount>0),
  payment_mode TEXT NOT NULL CHECK(payment_mode IN ('CASH','GPAY')),
  reason TEXT NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id,request_key)
);
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS production_session_expire ON session(expire);
CREATE INDEX IF NOT EXISTS production_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS production_sales_date ON sales(company_id,sale_date,id);
CREATE INDEX IF NOT EXISTS production_sales_shop ON sales(company_id,shop_id,sale_date,id);
CREATE INDEX IF NOT EXISTS production_expense_date ON expenses(company_id,expense_date,employee_id);
CREATE INDEX IF NOT EXISTS production_stock_session ON stock_transactions(company_id,session_id,product_id);
CREATE INDEX IF NOT EXISTS production_movements_date ON inventory_movements(company_id,created_at);
CREATE INDEX IF NOT EXISTS production_receipts_shop ON receipts(company_id,shop_id,created_at);
CREATE INDEX IF NOT EXISTS production_allocations_sale ON receipt_allocations(sale_id);
CREATE INDEX IF NOT EXISTS production_reversals_sale ON payment_reversals(sale_id);
CREATE OR REPLACE FUNCTION invalidate_credentials() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.pin_hash IS DISTINCT FROM OLD.pin_hash OR NEW.role_id IS DISTINCT FROM OLD.role_id OR NEW.account_status IS DISTINCT FROM OLD.account_status OR NEW.employee_id IS DISTINCT FROM OLD.employee_id OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    NEW.auth_version := OLD.auth_version + 1;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER production_credentials BEFORE UPDATE ON user_accounts FOR EACH ROW EXECUTE FUNCTION invalidate_credentials();
ALTER TABLE sale_items ADD CONSTRAINT production_sale_item_parent FOREIGN KEY(sale_id) REFERENCES sales(id) NOT VALID;
ALTER TABLE employee_stock ADD CONSTRAINT production_stock_employee FOREIGN KEY(employee_id) REFERENCES employees(id) NOT VALID;
ALTER TABLE employee_stock ADD CONSTRAINT production_stock_product FOREIGN KEY(product_id) REFERENCES products(id) NOT VALID;
ALTER TABLE products ADD CONSTRAINT production_stock_nonnegative CHECK(warehouse_stock_units>=0 AND pieces_per_unit>0) NOT VALID;
ALTER TABLE employee_stock ADD CONSTRAINT production_employee_nonnegative CHECK(qty_units>=0) NOT VALID;
ALTER TABLE sales ADD CONSTRAINT production_payment_nonnegative CHECK(total_amount>=0 AND cash_paid>=0 AND gpay_paid>=0 AND credit_paid>=0) NOT VALID;
ALTER TABLE sale_items VALIDATE CONSTRAINT production_sale_item_parent;
ALTER TABLE employee_stock VALIDATE CONSTRAINT production_stock_employee;
ALTER TABLE employee_stock VALIDATE CONSTRAINT production_stock_product;
ALTER TABLE products VALIDATE CONSTRAINT production_stock_nonnegative;
ALTER TABLE employee_stock VALIDATE CONSTRAINT production_employee_nonnegative;
ALTER TABLE sales VALIDATE CONSTRAINT production_payment_nonnegative;
