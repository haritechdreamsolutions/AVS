import bcrypt from 'bcrypt';
import { pool } from './pg_pool.js';

const ROUNDS = 10;

async function safeQuery(client, sql, params = [], label = '') {
  try {
    return await client.query(sql, params);
  } catch (e) {
    console.warn(`[auto_migrate] Notice on ${label || 'statement'}:`, e.message);
    return null;
  }
}

export async function runAutoMigrations() {
  console.log('[auto_migrate] Checking and migrating database schema...');
  const client = await pool.connect();

  try {
    // 1. Companies Table
    await safeQuery(client, `
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
    `, [], 'create companies');

    // 2. Roles Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        role_name VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(255)
      );
    `, [], 'create roles');
    await safeQuery(client, 'ALTER TABLE roles ADD COLUMN IF NOT EXISTS description VARCHAR(255);', [], 'roles.description');
    
    await safeQuery(client, `
      INSERT INTO roles (role_name) VALUES
        ('OWNER'),
        ('STORE_KEEPER'),
        ('EMPLOYEE'),
        ('DRIVER')
      ON CONFLICT (role_name) DO NOTHING;
    `, [], 'seed roles');

    // Ensure product_id is nullable across all dependent transaction tables
    await safeQuery(client, 'ALTER TABLE sale_items ALTER COLUMN product_id DROP NOT NULL;', [], 'sale_items.product_id drop not null');
    await safeQuery(client, 'ALTER TABLE damages ALTER COLUMN product_id DROP NOT NULL;', [], 'damages.product_id drop not null');
    await safeQuery(client, 'ALTER TABLE inventory_movements ALTER COLUMN product_id DROP NOT NULL;', [], 'inventory_movements.product_id drop not null');
    await safeQuery(client, 'ALTER TABLE stock_transactions ALTER COLUMN product_id DROP NOT NULL;', [], 'stock_transactions.product_id drop not null');

    // 3. Employees Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        employee_code VARCHAR(50),
        full_name VARCHAR(150) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(150),
        designation VARCHAR(100),
        vehicle_number VARCHAR(30),
        route_id INTEGER,
        joining_date DATE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create employees');
    await safeQuery(client, 'ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;', [], 'employees.company_id');
    await safeQuery(client, 'ALTER TABLE employees ADD COLUMN IF NOT EXISTS route_id INTEGER;', [], 'employees.route_id');
    await safeQuery(client, 'ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;', [], 'employees.is_active');
    await safeQuery(client, 'ALTER TABLE employees ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(30);', [], 'employees.vehicle_number');

    // 4. User Accounts Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS user_accounts (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        role_id INTEGER NOT NULL,
        employee_id INTEGER,
        login_id VARCHAR(100) NOT NULL,
        name VARCHAR(150) NOT NULL,
        phone VARCHAR(20),
        pin_hash VARCHAR(255) NOT NULL,
        account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMPTZ,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create user_accounts');
    await safeQuery(client, 'ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;', [], 'user_accounts.company_id');
    await safeQuery(client, 'ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;', [], 'user_accounts.failed_attempts');
    await safeQuery(client, 'ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;', [], 'user_accounts.locked_until');
    await safeQuery(client, 'ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;', [], 'user_accounts.last_login_at');

    // 5. Routes Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS routes (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        code VARCHAR(20),
        name VARCHAR(150) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create routes');
    await safeQuery(client, 'ALTER TABLE routes ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;', [], 'routes.company_id');
    await safeQuery(client, 'ALTER TABLE routes ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;', [], 'routes.is_active');

    // 6. Villages Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS villages (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(50),
        taluk VARCHAR(100),
        district VARCHAR(100) DEFAULT 'Salem',
        state VARCHAR(100) DEFAULT 'Tamil Nadu',
        pincode VARCHAR(10),
        route_id INTEGER,
        status VARCHAR(30) DEFAULT 'ACTIVE',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create villages');
    await safeQuery(client, 'ALTER TABLE villages ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;', [], 'villages.company_id');
    await safeQuery(client, "ALTER TABLE villages ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'ACTIVE';", [], 'villages.status');
    await safeQuery(client, 'ALTER TABLE villages ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;', [], 'villages.is_active');
    await safeQuery(client, 'ALTER TABLE villages ADD COLUMN IF NOT EXISTS route_id INTEGER;', [], 'villages.route_id');
    await safeQuery(client, 'ALTER TABLE villages ADD COLUMN IF NOT EXISTS code VARCHAR(50);', [], 'villages.code');
    await safeQuery(client, 'ALTER TABLE villages ADD COLUMN IF NOT EXISTS taluk VARCHAR(100);', [], 'villages.taluk');
    await safeQuery(client, "ALTER TABLE villages ADD COLUMN IF NOT EXISTS district VARCHAR(100) DEFAULT 'Salem';", [], 'villages.district');
    await safeQuery(client, "ALTER TABLE villages ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT 'Tamil Nadu';", [], 'villages.state');
    await safeQuery(client, 'ALTER TABLE villages ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);', [], 'villages.pincode');

    // 7. Route Assignments Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS route_assignments (
        id SERIAL PRIMARY KEY,
        route_id INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,
        vehicle_number VARCHAR(30),
        assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'ASSIGNED',
        dispatch_time VARCHAR(20),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create route_assignments');
    await safeQuery(client, 'CREATE UNIQUE INDEX IF NOT EXISTS uq_route_assignments_date ON route_assignments (route_id, assigned_date);', [], 'uq_route_assignments_date');

    // 8. Categories Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        code VARCHAR(50),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        operational_unit VARCHAR(50) DEFAULT 'Piece',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create categories');
    await safeQuery(client, 'ALTER TABLE categories ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;', [], 'categories.company_id');
    await safeQuery(client, "ALTER TABLE categories ADD COLUMN IF NOT EXISTS operational_unit VARCHAR(50) DEFAULT 'Piece';", [], 'categories.operational_unit');
    await safeQuery(client, 'ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;', [], 'categories.is_active');

    // Clean up duplicate categories and safely remap products
    try {
      const allCats = await safeQuery(client, 'SELECT id, company_id, code, name FROM categories ORDER BY id ASC');
      if (allCats && allCats.rows && allCats.rows.length > 0) {
        const seenNames = new Map();
        const seenCodes = new Map();
        const idReplacements = new Map();

        for (const cat of allCats.rows) {
          const normName = (cat.name || '').trim().toLowerCase();
          const normCode = (cat.code || '').trim().toUpperCase();
          const nameKey = `${cat.company_id}_${normName}`;
          const codeKey = normCode ? `${cat.company_id}_${normCode}` : null;

          let canonicalId = null;
          if (normName && seenNames.has(nameKey)) {
            canonicalId = seenNames.get(nameKey);
          } else if (codeKey && seenCodes.has(codeKey)) {
            canonicalId = seenCodes.get(codeKey);
          }

          if (canonicalId && canonicalId !== cat.id) {
            idReplacements.set(cat.id, canonicalId);
          } else {
            if (normName && !seenNames.has(nameKey)) seenNames.set(nameKey, cat.id);
            if (codeKey && !seenCodes.has(codeKey)) seenCodes.set(codeKey, cat.id);
          }
        }

        for (const [dupeId, canonicalId] of idReplacements.entries()) {
          await safeQuery(client, 'UPDATE products SET category_id = $1 WHERE category_id = $2', [canonicalId, dupeId], `remap products from cat ${dupeId} to ${canonicalId}`);
          await safeQuery(client, 'DELETE FROM categories WHERE id = $1', [dupeId], `delete dupe category ${dupeId}`);
        }
      }
    } catch (e) {
      console.warn('[auto_migrate] Category deduplication note:', e.message);
    }

    // Unique indexes to prevent duplicate category names or codes per company
    await safeQuery(client, 'CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_company_name ON categories (company_id, LOWER(TRIM(name)));', [], 'uq_categories_company_name');
    await safeQuery(client, 'CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_company_code ON categories (company_id, UPPER(TRIM(code)));', [], 'uq_categories_company_code');

    // Ensure default categories without inserting duplicates
    const defaultCats = [
      { code: 'CAT-MILK', name: 'Milk', unit: 'Piece' },
      { code: 'CAT-CURD', name: 'Curd', unit: 'Piece' },
      { code: 'CAT-BOX', name: 'Box', unit: 'Box' },
      { code: 'CAT-CASE', name: 'Case', unit: 'Case' }
    ];
    for (const dCat of defaultCats) {
      const exists = await safeQuery(client, 
        'SELECT id FROM categories WHERE company_id = $1 AND (UPPER(TRIM(code)) = $2 OR LOWER(TRIM(name)) = LOWER($3))',
        [1, dCat.code, dCat.name]
      );
      if (!exists || exists.rows.length === 0) {
        await safeQuery(client,
          'INSERT INTO categories (company_id, code, name, operational_unit, is_active) VALUES ($1, $2, $3, $4, TRUE)',
          [1, dCat.code, dCat.name, dCat.unit],
          `seed category ${dCat.name}`
        );
      }
    }

    // 9. Products Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        category_id INTEGER,
        sku VARCHAR(50),
        barcode VARCHAR(50),
        name VARCHAR(150) NOT NULL,
        display_name VARCHAR(150) NOT NULL,
        base_unit VARCHAR(20) NOT NULL DEFAULT 'Piece',
        selling_unit VARCHAR(20) NOT NULL DEFAULT 'Tray',
        pieces_per_unit INTEGER NOT NULL DEFAULT 1,
        purchase_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        unit_selling_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        piece_selling_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        warehouse_stock_units NUMERIC(12,4) NOT NULL DEFAULT 0,
        min_stock_level INTEGER NOT NULL DEFAULT 0,
        icon VARCHAR(10) DEFAULT '🥛',
        image_url TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create products');
    await safeQuery(client, 'ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id INTEGER;', [], 'products.category_id');
    await safeQuery(client, 'ALTER TABLE products ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;', [], 'products.company_id');
    await safeQuery(client, "ALTER TABLE products ADD COLUMN IF NOT EXISTS base_unit VARCHAR(20) DEFAULT 'Piece';", [], 'products.base_unit');
    await safeQuery(client, "ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_unit VARCHAR(20) DEFAULT 'Tray';", [], 'products.selling_unit');
    await safeQuery(client, 'ALTER TABLE products ADD COLUMN IF NOT EXISTS pieces_per_unit INTEGER NOT NULL DEFAULT 1;', [], 'products.pieces_per_unit');
    await safeQuery(client, 'ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10,2) NOT NULL DEFAULT 0.00;', [], 'products.purchase_price');
    await safeQuery(client, 'ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_selling_price NUMERIC(10,2) NOT NULL DEFAULT 0.00;', [], 'products.unit_selling_price');
    await safeQuery(client, 'ALTER TABLE products ADD COLUMN IF NOT EXISTS piece_selling_price NUMERIC(10,2) NOT NULL DEFAULT 0.00;', [], 'products.piece_selling_price');
    await safeQuery(client, 'ALTER TABLE products ADD COLUMN IF NOT EXISTS warehouse_stock_units NUMERIC(12,4) NOT NULL DEFAULT 0;', [], 'products.warehouse_stock_units');
    await safeQuery(client, 'ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_level INTEGER NOT NULL DEFAULT 0;', [], 'products.min_stock_level');
    await safeQuery(client, "ALTER TABLE products ADD COLUMN IF NOT EXISTS icon VARCHAR(10) DEFAULT '🥛';", [], 'products.icon');
    await safeQuery(client, 'ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;', [], 'products.image_url');
    await safeQuery(client, 'ALTER TABLE products ADD COLUMN IF NOT EXISTS pack_size VARCHAR(50);', [], 'products.pack_size');
    await safeQuery(client, 'ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(50);', [], 'products.sku');
    await safeQuery(client, 'ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(50);', [], 'products.barcode');
    await safeQuery(client, 'ALTER TABLE products ADD COLUMN IF NOT EXISTS display_name VARCHAR(150);', [], 'products.display_name');
    await safeQuery(client, "ALTER TABLE products ADD COLUMN IF NOT EXISTS buy_rate_uom VARCHAR(50) DEFAULT 'Tray';", [], 'products.buy_rate_uom');
    await safeQuery(client, "ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_rate_uom VARCHAR(50) DEFAULT 'Tray';", [], 'products.selling_rate_uom');

    // 9.5 Product UOMs Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS product_uoms (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        product_id INTEGER NOT NULL,
        uom VARCHAR(50) NOT NULL,
        conversion_to_base NUMERIC(10,2) NOT NULL DEFAULT 1,
        is_base_uom BOOLEAN NOT NULL DEFAULT FALSE,
        is_purchase_uom BOOLEAN NOT NULL DEFAULT FALSE,
        is_sales_uom BOOLEAN NOT NULL DEFAULT FALSE,
        buy_rate NUMERIC(10,2) DEFAULT 0.00,
        selling_rate NUMERIC(10,2) DEFAULT 0.00,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create product_uoms');
    await safeQuery(client, 'CREATE UNIQUE INDEX IF NOT EXISTS uq_prod_uom ON product_uoms (product_id, uom);', [], 'uq_prod_uom');

    // 10. Shops Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS shops (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        route_id INTEGER,
        village_id INTEGER,
        village VARCHAR(150),
        code VARCHAR(20),
        name VARCHAR(150) NOT NULL,
        owner_name VARCHAR(100),
        phone VARCHAR(20),
        address TEXT,
        distance VARCHAR(20),
        distance_km NUMERIC(10,2) DEFAULT 0.00,
        current_due NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        credit_limit NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        opening_balance NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        has_freezer BOOLEAN NOT NULL DEFAULT FALSE,
        freezer_model VARCHAR(150),
        freezer_serial VARCHAR(100),
        freezer_date VARCHAR(30),
        freezer_status VARCHAR(30),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create shops');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;', [], 'shops.company_id');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS route_id INTEGER;', [], 'shops.route_id');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS village_id INTEGER;', [], 'shops.village_id');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS village VARCHAR(150);', [], 'shops.village');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS code VARCHAR(20);', [], 'shops.code');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS owner_name VARCHAR(100);', [], 'shops.owner_name');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS phone VARCHAR(20);', [], 'shops.phone');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS address TEXT;', [], 'shops.address');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS distance VARCHAR(20);', [], 'shops.distance');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS distance_km NUMERIC(10,2) DEFAULT 0.00;', [], 'shops.distance_km');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS current_due NUMERIC(10,2) NOT NULL DEFAULT 0.00;', [], 'shops.current_due');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(10,2) NOT NULL DEFAULT 0.00;', [], 'shops.credit_limit');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(10,2) NOT NULL DEFAULT 0.00;', [], 'shops.opening_balance');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS has_freezer BOOLEAN NOT NULL DEFAULT FALSE;', [], 'shops.has_freezer');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS freezer_model VARCHAR(150);', [], 'shops.freezer_model');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS freezer_serial VARCHAR(100);', [], 'shops.freezer_serial');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS freezer_date VARCHAR(30);', [], 'shops.freezer_date');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS freezer_status VARCHAR(30);', [], 'shops.freezer_status');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;', [], 'shops.is_active');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();', [], 'shops.created_at');
    await safeQuery(client, 'ALTER TABLE shops ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();', [], 'shops.updated_at');

    // 11. Employee Stock Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS employee_stock (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        company_id INTEGER NOT NULL DEFAULT 1,
        qty_units NUMERIC(12,4) NOT NULL DEFAULT 0,
        unit VARCHAR(20) DEFAULT 'Tray',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create employee_stock');
    await safeQuery(client, 'ALTER TABLE employee_stock ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;', [], 'employee_stock.company_id');
    await safeQuery(client, 'CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_stock_prod ON employee_stock (employee_id, product_id);', [], 'uq_employee_stock_prod');

    // 12. Driver Sessions Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS driver_sessions (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        employee_id INTEGER NOT NULL,
        route_id INTEGER,
        session_date DATE NOT NULL DEFAULT CURRENT_DATE,
        status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
        total_sales NUMERIC(10,2) DEFAULT 0.00,
        total_expenses NUMERIC(10,2) DEFAULT 0.00,
        cash_collected NUMERIC(10,2) DEFAULT 0.00,
        gpay_collected NUMERIC(10,2) DEFAULT 0.00,
        credit_sales NUMERIC(10,2) DEFAULT 0.00,
        net_amount NUMERIC(10,2) DEFAULT 0.00,
        damage_cost NUMERIC(10,2) DEFAULT 0.00,
        shortage_cost NUMERIC(10,2) DEFAULT 0.00,
        opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        submitted_at TIMESTAMPTZ,
        closed_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create driver_sessions');
    await safeQuery(client, 'ALTER TABLE driver_sessions ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;', [], 'driver_sessions.company_id');

    // 13. Sales & Sale Items Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        session_id INTEGER,
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
        status VARCHAR(20) DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create sales');
    await safeQuery(client, 'ALTER TABLE sales ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;', [], 'sales.company_id');
    await safeQuery(client, 'ALTER TABLE sales ADD COLUMN IF NOT EXISTS session_id INTEGER;', [], 'sales.session_id');
    await safeQuery(client, 'ALTER TABLE sales ADD COLUMN IF NOT EXISTS sale_date DATE NOT NULL DEFAULT CURRENT_DATE;', [], 'sales.sale_date');
    await safeQuery(client, 'ALTER TABLE sales ADD COLUMN IF NOT EXISTS sale_time VARCHAR(30);', [], 'sales.sale_time');
    await safeQuery(client, 'ALTER TABLE sales ADD COLUMN IF NOT EXISTS cash_paid NUMERIC(10,2) NOT NULL DEFAULT 0.00;', [], 'sales.cash_paid');
    await safeQuery(client, 'ALTER TABLE sales ADD COLUMN IF NOT EXISTS gpay_paid NUMERIC(10,2) NOT NULL DEFAULT 0.00;', [], 'sales.gpay_paid');
    await safeQuery(client, 'ALTER TABLE sales ADD COLUMN IF NOT EXISTS credit_paid NUMERIC(10,2) NOT NULL DEFAULT 0.00;', [], 'sales.credit_paid');
    await safeQuery(client, "ALTER TABLE sales ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';", [], 'sales.status');

    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY,
        sale_id INTEGER NOT NULL,
        product_id INTEGER,
        product_name VARCHAR(150) NOT NULL,
        qty NUMERIC(10,2) NOT NULL,
        unit_type VARCHAR(20) DEFAULT 'Piece',
        rate NUMERIC(10,2) NOT NULL,
        amount NUMERIC(10,2) NOT NULL
      );
    `, [], 'create sale_items');
    await safeQuery(client, 'ALTER TABLE sale_items ALTER COLUMN product_id DROP NOT NULL;', [], 'sale_items.product_id drop not null');

    // 14. Damages Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS damages (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        session_id INTEGER,
        employee_id INTEGER,
        employee_name VARCHAR(150),
        product_id INTEGER,
        product_name VARCHAR(150),
        qty_units NUMERIC(12,4) NOT NULL DEFAULT 0,
        unit VARCHAR(20) DEFAULT 'Piece',
        damage_unit VARCHAR(20) DEFAULT 'Piece',
        base_quantity NUMERIC(12,4) DEFAULT 0,
        reason VARCHAR(255),
        notes TEXT,
        damage_cost NUMERIC(10,2) DEFAULT 0.00,
        status VARCHAR(30) DEFAULT 'VERIFIED',
        verified_by INTEGER,
        verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create damages');
    await safeQuery(client, 'ALTER TABLE damages ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;', [], 'damages.company_id');
    await safeQuery(client, 'ALTER TABLE damages ADD COLUMN IF NOT EXISTS session_id INTEGER;', [], 'damages.session_id');
    await safeQuery(client, "ALTER TABLE damages ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'Piece';", [], 'damages.unit');
    await safeQuery(client, "ALTER TABLE damages ADD COLUMN IF NOT EXISTS damage_unit VARCHAR(20) DEFAULT 'Piece';", [], 'damages.damage_unit');
    await safeQuery(client, 'ALTER TABLE damages ADD COLUMN IF NOT EXISTS base_quantity NUMERIC(12,4) DEFAULT 0;', [], 'damages.base_quantity');
    await safeQuery(client, 'ALTER TABLE damages ADD COLUMN IF NOT EXISTS notes TEXT;', [], 'damages.notes');
    await safeQuery(client, 'ALTER TABLE damages ADD COLUMN IF NOT EXISTS damage_cost NUMERIC(10,2) DEFAULT 0.00;', [], 'damages.damage_cost');
    await safeQuery(client, 'ALTER TABLE damages ADD COLUMN IF NOT EXISTS verified_by INTEGER;', [], 'damages.verified_by');
    await safeQuery(client, 'ALTER TABLE damages ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;', [], 'damages.verified_at');
    await safeQuery(client, 'ALTER TABLE damages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();', [], 'damages.updated_at');
    await safeQuery(client, 'ALTER TABLE damages ALTER COLUMN product_id DROP NOT NULL;', [], 'damages.product_id drop not null');

    // 15. Expenses Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        session_id INTEGER,
        employee_id INTEGER,
        title VARCHAR(150) NOT NULL,
        category VARCHAR(50) DEFAULT 'General',
        amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        notes TEXT,
        expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create expenses');
    await safeQuery(client, 'ALTER TABLE expenses ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;', [], 'expenses.company_id');
    await safeQuery(client, 'ALTER TABLE expenses ADD COLUMN IF NOT EXISTS session_id INTEGER;', [], 'expenses.session_id');
    await safeQuery(client, 'ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date DATE NOT NULL DEFAULT CURRENT_DATE;', [], 'expenses.expense_date');
    await safeQuery(client, 'ALTER TABLE expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();', [], 'expenses.updated_at');

    // 16. Driver Returns Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS driver_returns (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        session_id INTEGER,
        employee_id INTEGER NOT NULL,
        route_id INTEGER,
        return_no VARCHAR(50) NOT NULL,
        return_date DATE NOT NULL DEFAULT CURRENT_DATE,
        total_returned_units NUMERIC(12,4) DEFAULT 0,
        total_shortage_units NUMERIC(12,4) DEFAULT 0,
        total_shortage_cost NUMERIC(10,2) DEFAULT 0.00,
        total_accepted_good NUMERIC(12,4) DEFAULT 0,
        total_damage_cost NUMERIC(10,2) DEFAULT 0,
        items JSONB DEFAULT '[]'::jsonb,
        variance_summary JSONB DEFAULT '{}'::jsonb,
        notes TEXT,
        checked_by INTEGER,
        checked_at TIMESTAMPTZ,
        status VARCHAR(30) DEFAULT 'VERIFIED',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create driver_returns');
    await safeQuery(client, 'ALTER TABLE driver_returns ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;', [], 'driver_returns.company_id');
    await safeQuery(client, 'ALTER TABLE driver_returns ADD COLUMN IF NOT EXISTS total_accepted_good NUMERIC(12,4) DEFAULT 0;', [], 'driver_returns.total_accepted_good');
    await safeQuery(client, 'ALTER TABLE driver_returns ADD COLUMN IF NOT EXISTS total_damage_cost NUMERIC(10,2) DEFAULT 0;', [], 'driver_returns.total_damage_cost');
    await safeQuery(client, "ALTER TABLE driver_returns ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;", [], 'driver_returns.items');
    await safeQuery(client, "ALTER TABLE driver_returns ADD COLUMN IF NOT EXISTS variance_summary JSONB DEFAULT '{}'::jsonb;", [], 'driver_returns.variance_summary');
    await safeQuery(client, 'ALTER TABLE driver_returns ADD COLUMN IF NOT EXISTS route_id INTEGER;', [], 'driver_returns.route_id');
    await safeQuery(client, 'ALTER TABLE driver_returns ADD COLUMN IF NOT EXISTS notes TEXT;', [], 'driver_returns.notes');
    await safeQuery(client, 'ALTER TABLE driver_returns ADD COLUMN IF NOT EXISTS checked_by INTEGER;', [], 'driver_returns.checked_by');
    await safeQuery(client, 'ALTER TABLE driver_returns ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;', [], 'driver_returns.checked_at');
    await safeQuery(client, 'ALTER TABLE driver_returns ADD COLUMN IF NOT EXISTS return_date DATE DEFAULT CURRENT_DATE;', [], 'driver_returns.return_date');

    // 17. Stock Transactions Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS stock_transactions (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        session_id INTEGER,
        employee_id INTEGER,
        product_id INTEGER NOT NULL,
        unit VARCHAR(20) DEFAULT 'Piece',
        transaction_type VARCHAR(30) NOT NULL,
        qty_units NUMERIC(12,4) NOT NULL DEFAULT 0,
        unit_cost NUMERIC(10,2) DEFAULT 0.00,
        total_cost NUMERIC(10,2) DEFAULT 0.00,
        reference_id VARCHAR(100),
        notes TEXT,
        created_by INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create stock_transactions');
    await safeQuery(client, 'ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;', [], 'stock_transactions.company_id');
    await safeQuery(client, 'ALTER TABLE stock_transactions ALTER COLUMN product_id DROP NOT NULL;', [], 'stock_transactions.product_id drop not null');

    // 18. Inventory Movements Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        movement_no VARCHAR(50) NOT NULL,
        movement_type VARCHAR(30) NOT NULL,
        product_id INTEGER,
        product_name VARCHAR(150),
        employee_id INTEGER,
        employee_name VARCHAR(150),
        qty_units NUMERIC(12,4) NOT NULL DEFAULT 0,
        unit VARCHAR(20) DEFAULT 'Piece',
        notes TEXT,
        movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
        movement_time VARCHAR(30),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create inventory_movements');
    await safeQuery(client, 'ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;', [], 'inventory_movements.company_id');
    await safeQuery(client, 'ALTER TABLE inventory_movements ALTER COLUMN product_id DROP NOT NULL;', [], 'inventory_movements.product_id drop not null');

    // 19. Settlements & Audit Logs
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS settlements (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        employee_id INTEGER,
        employee_name VARCHAR(150),
        settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
        expected_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        collected_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        difference NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        reason VARCHAR(255),
        remarks TEXT,
        status VARCHAR(30) DEFAULT 'BALANCED',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create settlements');
    await safeQuery(client, 'ALTER TABLE settlements ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;', [], 'settlements.company_id');

    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        company_id INTEGER,
        actor_user_id INTEGER,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id INTEGER,
        metadata JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create audit_logs');

    // 19.5 Notifications Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        recipient_user_id INTEGER,
        recipient_role VARCHAR(50) DEFAULT 'ALL',
        notification_type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        reference_type VARCHAR(50),
        reference_id VARCHAR(100),
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create notifications');

    // 19.6 Product Price History Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS product_price_history (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        product_id INTEGER NOT NULL,
        purchase_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        buy_rate_uom VARCHAR(50) DEFAULT 'Tray',
        unit_selling_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        piece_selling_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        selling_rate_uom VARCHAR(50) DEFAULT 'Tray',
        changed_by_user_id INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create product_price_history');

    // 20. Freezer Models Table & Default Seeds
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS freezer_models (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        brand VARCHAR(100) NOT NULL,
        capacity VARCHAR(50) NOT NULL,
        model_name VARCHAR(200) NOT NULL,
        freezer_type VARCHAR(100) DEFAULT 'Deep Freezer',
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, [], 'create freezer_models');

    await safeQuery(client, `
      INSERT INTO freezer_models (company_id, brand, capacity, model_name, freezer_type)
      SELECT 1, brand, capacity, model_name, freezer_type FROM (VALUES
        ('Blue Star', '100L', 'Blue Star 100L Deep Freezer', 'Deep Freezer'),
        ('Blue Star', '200L', 'Blue Star 200L Deep Freezer', 'Deep Freezer'),
        ('Blue Star', '300L', 'Blue Star 300L Deep Freezer', 'Deep Freezer'),
        ('Blue Star', '400L', 'Blue Star 400L Deep Freezer', 'Deep Freezer'),
        ('Blue Star', '500L', 'Blue Star 500L Deep Freezer', 'Deep Freezer'),
        ('Voltas', '100L', 'Voltas 100L Deep Freezer', 'Deep Freezer'),
        ('Voltas', '200L', 'Voltas 200L Deep Freezer', 'Deep Freezer'),
        ('Voltas', '300L', 'Voltas 300L Deep Freezer', 'Deep Freezer'),
        ('Voltas', '400L', 'Voltas 400L Double Door Cooler', 'Double Door Cooler'),
        ('Voltas', '500L', 'Voltas 500L Deep Freezer', 'Deep Freezer'),
        ('Western', '200L', 'Western 200L Visicooler', 'Visicooler'),
        ('Western', '300L', 'Western 300L Visicooler', 'Visicooler'),
        ('Western', '400L', 'Western 400L Deep Freezer', 'Deep Freezer'),
        ('Godrej', '100L', 'Godrej 100L Deep Freezer', 'Deep Freezer'),
        ('Godrej', '200L', 'Godrej 200L Deep Freezer', 'Deep Freezer'),
        ('Godrej', '300L', 'Godrej 300L Deep Freezer', 'Deep Freezer'),
        ('Godrej', '400L', 'Godrej 400L Deep Freezer', 'Deep Freezer'),
        ('Haier', '200L', 'Haier 200L Visicooler', 'Visicooler'),
        ('Haier', '300L', 'Haier 300L Chest Freezer', 'Chest Freezer'),
        ('Haier', '320L', 'Haier 320L Visicooler', 'Visicooler'),
        ('Haier', '400L', 'Haier 400L Visicooler', 'Visicooler')
      ) AS v(brand, capacity, model_name, freezer_type)
      WHERE NOT EXISTS (
        SELECT 1 FROM freezer_models WHERE LOWER(TRIM(freezer_models.model_name)) = LOWER(TRIM(v.model_name))
      );
    `, [], 'seed freezer_models');

    // 21. Ensure Company, Roles & Users
    let cR = await safeQuery(client, 'SELECT id FROM companies LIMIT 1');
    let cid = 1;
    if (!cR || cR.rows.length === 0) {
      const ins = await safeQuery(client, "INSERT INTO companies (name, subtitle, is_active) VALUES ('AVS AGENCIES', 'Distribution Management System', TRUE) RETURNING id");
      cid = ins?.rows[0]?.id || 1;
    } else {
      cid = cR.rows[0].id;
    }

    const ownerRoleRes = await safeQuery(client, "SELECT id FROM roles WHERE role_name='OWNER'");
    const skRoleRes = await safeQuery(client, "SELECT id FROM roles WHERE role_name='STORE_KEEPER'");

    const ownerRole = ownerRoleRes?.rows[0]?.id;
    const skRole = skRoleRes?.rows[0]?.id;

    // Check & ensure Owner user
    if (ownerRole) {
      const hash = await bcrypt.hash('1234', ROUNDS);
      const ownerUser = await safeQuery(client, 'SELECT id FROM user_accounts WHERE LOWER(TRIM(login_id)) = $1', ['owner']);
      if (!ownerUser || ownerUser.rows.length === 0) {
        await safeQuery(client, 
          'INSERT INTO user_accounts (company_id, role_id, login_id, name, pin_hash, account_status) VALUES ($1,$2,$3,$4,$5,$6)',
          [cid, ownerRole, 'owner', 'Owner Admin', hash, 'ACTIVE']
        );
      } else {
        await safeQuery(client, 'UPDATE user_accounts SET company_id=$1, role_id=$2, pin_hash=$3, failed_attempts=0, locked_until=NULL, account_status=\'ACTIVE\' WHERE LOWER(TRIM(login_id)) = $4', [cid, ownerRole, hash, 'owner']);
      }
    }

    // Check & ensure Storekeeper user
    if (skRole) {
      const hash = await bcrypt.hash('1234', ROUNDS);
      const skUser = await safeQuery(client, 'SELECT id FROM user_accounts WHERE LOWER(TRIM(login_id)) = $1', ['storekeeper']);
      if (!skUser || skUser.rows.length === 0) {
        await safeQuery(client, 
          'INSERT INTO user_accounts (company_id, role_id, login_id, name, pin_hash, account_status) VALUES ($1,$2,$3,$4,$5,$6)',
          [cid, skRole, 'storekeeper', 'Store Keeper Admin', hash, 'ACTIVE']
        );
      } else {
        await safeQuery(client, 'UPDATE user_accounts SET company_id=$1, role_id=$2, pin_hash=$3, failed_attempts=0, locked_until=NULL, account_status=\'ACTIVE\' WHERE LOWER(TRIM(login_id)) = $4', [cid, skRole, hash, 'storekeeper']);
      }
    }

    // Check & ensure Employee / Driver users PIN reset to 1234
    const empRoleRes = await safeQuery(client, "SELECT id FROM roles WHERE role_name='EMPLOYEE'");
    const empRole = empRoleRes?.rows[0]?.id;
    if (empRole) {
      const hash = await bcrypt.hash('1234', ROUNDS);
      await safeQuery(client, 'UPDATE user_accounts SET pin_hash=$1, failed_attempts=0, locked_until=NULL, account_status=\'ACTIVE\' WHERE role_id=$2', [hash, empRole]);
    }

    console.log('[auto_migrate] ✅ Database auto-migration completed successfully!');
  } catch (err) {
    console.error('[auto_migrate] ❌ Database migration error:', err);
  } finally {
    client.release();
  }
}
