-- Restore omitted foundation integrity without replaying legacy migrations or changing data.
-- Existing 004 indexes cover employee codes, bills, stock and UOM uniqueness.
-- Its normalized global login rule and restrictive stock/sale parent FKs remain authoritative.
-- Nullable master codes, current defaults and stock precision are intentional runtime compatibility.
-- Invalid existing rows abort the migration transaction; reconcile them explicitly before retrying.
ALTER TABLE product_price_history ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'employees'::regclass AND conname = 'fk_emp_company') THEN
    ALTER TABLE employees ADD CONSTRAINT fk_emp_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'user_accounts'::regclass AND conname = 'fk_ua_company') THEN
    ALTER TABLE user_accounts ADD CONSTRAINT fk_ua_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'user_accounts'::regclass AND conname = 'fk_ua_role') THEN
    ALTER TABLE user_accounts ADD CONSTRAINT fk_ua_role FOREIGN KEY (role_id) REFERENCES roles(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'user_accounts'::regclass AND conname = 'fk_ua_employee') THEN
    ALTER TABLE user_accounts ADD CONSTRAINT fk_ua_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'categories'::regclass AND conname = 'fk_cat_company') THEN
    ALTER TABLE categories ADD CONSTRAINT fk_cat_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'categories'::regclass AND conname = 'uq_cat_code') THEN
    ALTER TABLE categories ADD CONSTRAINT uq_cat_code UNIQUE (company_id, code);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'categories'::regclass AND conname = 'uq_cat_name') THEN
    ALTER TABLE categories ADD CONSTRAINT uq_cat_name UNIQUE (company_id, name);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'products'::regclass AND conname = 'fk_prod_company') THEN
    ALTER TABLE products ADD CONSTRAINT fk_prod_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'products'::regclass AND conname = 'fk_prod_category') THEN
    ALTER TABLE products ADD CONSTRAINT fk_prod_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'products'::regclass AND conname = 'uq_prod_sku') THEN
    ALTER TABLE products ADD CONSTRAINT uq_prod_sku UNIQUE (company_id, sku);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'product_price_history'::regclass AND conname = 'fk_pph_product') THEN
    ALTER TABLE product_price_history ADD CONSTRAINT fk_pph_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'product_price_history'::regclass AND conname = 'fk_pph_company') THEN
    ALTER TABLE product_price_history ADD CONSTRAINT fk_pph_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'product_price_history'::regclass AND conname = 'fk_pph_user') THEN
    ALTER TABLE product_price_history ADD CONSTRAINT fk_pph_user FOREIGN KEY (changed_by_user_id) REFERENCES user_accounts(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'routes'::regclass AND conname = 'fk_route_company') THEN
    ALTER TABLE routes ADD CONSTRAINT fk_route_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'routes'::regclass AND conname = 'uq_route_code') THEN
    ALTER TABLE routes ADD CONSTRAINT uq_route_code UNIQUE (company_id, code);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'route_assignments'::regclass AND conname = 'fk_ra_route') THEN
    ALTER TABLE route_assignments ADD CONSTRAINT fk_ra_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'route_assignments'::regclass AND conname = 'fk_ra_employee') THEN
    ALTER TABLE route_assignments ADD CONSTRAINT fk_ra_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'shops'::regclass AND conname = 'fk_shop_company') THEN
    ALTER TABLE shops ADD CONSTRAINT fk_shop_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'shops'::regclass AND conname = 'fk_shop_route') THEN
    ALTER TABLE shops ADD CONSTRAINT fk_shop_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'shops'::regclass AND conname = 'uq_shop_code') THEN
    ALTER TABLE shops ADD CONSTRAINT uq_shop_code UNIQUE (company_id, code);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'employee_stock'::regclass AND conname = 'fk_es_company') THEN
    ALTER TABLE employee_stock ADD CONSTRAINT fk_es_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'sales'::regclass AND conname = 'fk_sale_company') THEN
    ALTER TABLE sales ADD CONSTRAINT fk_sale_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'sales'::regclass AND conname = 'fk_sale_employee') THEN
    ALTER TABLE sales ADD CONSTRAINT fk_sale_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'sales'::regclass AND conname = 'fk_sale_shop') THEN
    ALTER TABLE sales ADD CONSTRAINT fk_sale_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'sale_items'::regclass AND conname = 'fk_si_product') THEN
    ALTER TABLE sale_items ADD CONSTRAINT fk_si_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'damages'::regclass AND conname = 'fk_dmg_company') THEN
    ALTER TABLE damages ADD CONSTRAINT fk_dmg_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'damages'::regclass AND conname = 'fk_dmg_employee') THEN
    ALTER TABLE damages ADD CONSTRAINT fk_dmg_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'damages'::regclass AND conname = 'fk_dmg_product') THEN
    ALTER TABLE damages ADD CONSTRAINT fk_dmg_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'expenses'::regclass AND conname = 'fk_exp_company') THEN
    ALTER TABLE expenses ADD CONSTRAINT fk_exp_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'expenses'::regclass AND conname = 'fk_exp_employee') THEN
    ALTER TABLE expenses ADD CONSTRAINT fk_exp_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'settlements'::regclass AND conname = 'fk_set_company') THEN
    ALTER TABLE settlements ADD CONSTRAINT fk_set_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'settlements'::regclass AND conname = 'fk_set_employee') THEN
    ALTER TABLE settlements ADD CONSTRAINT fk_set_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'inventory_movements'::regclass AND conname = 'fk_im_company') THEN
    ALTER TABLE inventory_movements ADD CONSTRAINT fk_im_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'inventory_movements'::regclass AND conname = 'fk_im_product') THEN
    ALTER TABLE inventory_movements ADD CONSTRAINT fk_im_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'inventory_movements'::regclass AND conname = 'fk_im_employee') THEN
    ALTER TABLE inventory_movements ADD CONSTRAINT fk_im_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'audit_logs'::regclass AND conname = 'fk_al_company') THEN
    ALTER TABLE audit_logs ADD CONSTRAINT fk_al_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'audit_logs'::regclass AND conname = 'fk_al_user') THEN
    ALTER TABLE audit_logs ADD CONSTRAINT fk_al_user FOREIGN KEY (actor_user_id) REFERENCES user_accounts(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'product_uoms'::regclass AND conname = 'fk_uom_company') THEN
    ALTER TABLE product_uoms ADD CONSTRAINT fk_uom_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'product_uoms'::regclass AND conname = 'fk_uom_product') THEN
    ALTER TABLE product_uoms ADD CONSTRAINT fk_uom_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'user_accounts'::regclass AND conname = 'foundation_account_status') THEN
    ALTER TABLE user_accounts ADD CONSTRAINT foundation_account_status CHECK (account_status IN ('ACTIVE','INACTIVE','SUSPENDED'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'route_assignments'::regclass AND conname = 'foundation_assignment_status') THEN
    ALTER TABLE route_assignments ADD CONSTRAINT foundation_assignment_status CHECK (status IN ('ASSIGNED','ON_ROUTE','COMPLETED','NOT_STARTED'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'products'::regclass AND conname = 'foundation_product_prices') THEN
    ALTER TABLE products ADD CONSTRAINT foundation_product_prices CHECK (purchase_price >= 0 AND unit_selling_price >= 0 AND piece_selling_price >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'expenses'::regclass AND conname = 'foundation_expense_amount') THEN
    ALTER TABLE expenses ADD CONSTRAINT foundation_expense_amount CHECK (amount >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'inventory_movements'::regclass AND conname = 'foundation_movement_type') THEN
    ALTER TABLE inventory_movements ADD CONSTRAINT foundation_movement_type CHECK (movement_type IN ('INWARD','OUTWARD','RETURN','DAMAGE','ADJUSTMENT'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'product_uoms'::regclass AND conname = 'foundation_uom_values') THEN
    ALTER TABLE product_uoms ADD CONSTRAINT foundation_uom_values CHECK (conversion_to_base > 0 AND buy_rate >= 0 AND selling_rate >= 0);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ua_company ON user_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_ua_login ON user_accounts(company_id, login_id);
CREATE INDEX IF NOT EXISTS idx_prod_company ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_cat_company ON categories(company_id);
-- production_sales_date already covers the legacy (company_id, sale_date) prefix.
CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_shops_company ON shops(company_id);
CREATE INDEX IF NOT EXISTS idx_emp_company ON employees(company_id);
