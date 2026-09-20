-- ============================================================
-- AVS AGENCIES - PostgreSQL Foundation Migration 001
-- PostgreSQL 18+
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  subtitle VARCHAR(255),
  address TEXT,
  phone VARCHAR(30),
  email VARCHAR(150),
  gstin VARCHAR(20),
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255)
);

INSERT INTO roles (role_name, description) VALUES
  ('OWNER', 'Full access - company owner'),
  ('STORE_KEEPER', 'Warehouse and inventory management'),
  ('EMPLOYEE', 'Driver/field sales employee')
ON CONFLICT (role_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  employee_code VARCHAR(50),
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(150),
  designation VARCHAR(100),
  vehicle_number VARCHAR(30),
  joining_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_emp_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT uq_emp_code UNIQUE (company_id, employee_code)
);

CREATE TABLE IF NOT EXISTS user_accounts (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  employee_id INTEGER,
  login_id VARCHAR(100) NOT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20),
  pin_hash VARCHAR(255) NOT NULL,
  account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE','INACTIVE','SUSPENDED')),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_ua_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_ua_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_ua_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  CONSTRAINT uq_ua_login UNIQUE (company_id, login_id)
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_cat_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT uq_cat_code UNIQUE (company_id, code),
  CONSTRAINT uq_cat_name UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  category_id INTEGER,
  sku VARCHAR(50),
  barcode VARCHAR(50),
  name VARCHAR(150) NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  base_unit VARCHAR(20) NOT NULL DEFAULT 'Piece',
  selling_unit VARCHAR(20) NOT NULL DEFAULT 'Tray',
  pieces_per_unit INTEGER NOT NULL DEFAULT 1 CHECK (pieces_per_unit > 0),
  purchase_price NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (purchase_price >= 0),
  unit_selling_price NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (unit_selling_price >= 0),
  piece_selling_price NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (piece_selling_price >= 0),
  warehouse_stock_units NUMERIC(12,4) NOT NULL DEFAULT 0,
  min_stock_level INTEGER NOT NULL DEFAULT 0,
  icon VARCHAR(10) DEFAULT '📦',
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_prod_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_prod_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT uq_prod_sku UNIQUE (company_id, sku)
);

CREATE TABLE IF NOT EXISTS product_price_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  company_id INTEGER NOT NULL,
  purchase_price NUMERIC(10,2) NOT NULL,
  unit_selling_price NUMERIC(10,2) NOT NULL,
  piece_selling_price NUMERIC(10,2) NOT NULL,
  changed_by_user_id INTEGER,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_pph_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_pph_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_pph_user FOREIGN KEY (changed_by_user_id) REFERENCES user_accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS routes (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(150) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_route_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT uq_route_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS route_assignments (
  id SERIAL PRIMARY KEY,
  route_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  vehicle_number VARCHAR(30),
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'ASSIGNED' CHECK (status IN ('ASSIGNED','ON_ROUTE','COMPLETED','NOT_STARTED')),
  dispatch_time VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_ra_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  CONSTRAINT fk_ra_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shops (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  route_id INTEGER,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(150) NOT NULL,
  owner_name VARCHAR(100),
  phone VARCHAR(20),
  address TEXT,
  distance VARCHAR(20),
  current_due NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  has_freezer BOOLEAN NOT NULL DEFAULT FALSE,
  freezer_model VARCHAR(150),
  freezer_serial VARCHAR(100),
  freezer_date VARCHAR(30),
  freezer_status VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_shop_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_shop_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL,
  CONSTRAINT uq_shop_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS employee_stock (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  company_id INTEGER NOT NULL,
  qty_units NUMERIC(12,4) NOT NULL DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'Tray',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_es_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_es_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_es_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT uq_es UNIQUE (employee_id, product_id)
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  bill_no VARCHAR(50) NOT NULL,
  employee_id INTEGER,
  employee_name VARCHAR(150),
  shop_id INTEGER,
  shop_name VARCHAR(150),
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sale_time VARCHAR(30),
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  cash_paid NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  gpay_paid NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  credit_paid NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  payment_mode VARCHAR(20) NOT NULL DEFAULT 'CASH',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_sale_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_sale_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_sale_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL,
  CONSTRAINT uq_sale_bill UNIQUE (company_id, bill_no)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name VARCHAR(150) NOT NULL,
  qty NUMERIC(10,2) NOT NULL,
  unit_type VARCHAR(20) DEFAULT 'Tray',
  rate NUMERIC(10,2) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  CONSTRAINT fk_si_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_si_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS damages (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  employee_id INTEGER,
  employee_name VARCHAR(150),
  product_id INTEGER,
  product_name VARCHAR(150),
  qty_units NUMERIC(12,4) NOT NULL DEFAULT 0,
  reason VARCHAR(255),
  damage_cost NUMERIC(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_dmg_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_dmg_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_dmg_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  employee_id INTEGER,
  title VARCHAR(150) NOT NULL,
  category VARCHAR(50) DEFAULT 'General',
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_exp_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_exp_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS settlements (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  employee_id INTEGER,
  employee_name VARCHAR(150),
  settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_amount NUMERIC(10,2) NOT NULL,
  collected_amount NUMERIC(10,2) NOT NULL,
  difference NUMERIC(10,2) NOT NULL,
  reason VARCHAR(255),
  remarks TEXT,
  status VARCHAR(30) DEFAULT 'BALANCED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_set_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_set_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  movement_no VARCHAR(50) NOT NULL,
  movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('INWARD','OUTWARD','RETURN','DAMAGE','ADJUSTMENT')),
  product_id INTEGER,
  product_name VARCHAR(150),
  employee_id INTEGER,
  employee_name VARCHAR(150),
  qty_units NUMERIC(12,4) NOT NULL DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'Tray',
  notes TEXT,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  movement_time VARCHAR(30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_im_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_im_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_im_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER,
  actor_user_id INTEGER,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  metadata JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_al_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
  CONSTRAINT fk_al_user FOREIGN KEY (actor_user_id) REFERENCES user_accounts(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ua_company ON user_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_ua_login ON user_accounts(company_id, login_id);
CREATE INDEX IF NOT EXISTS idx_prod_company ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_cat_company ON categories(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(company_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_shops_company ON shops(company_id);
CREATE INDEX IF NOT EXISTS idx_emp_company ON employees(company_id);
