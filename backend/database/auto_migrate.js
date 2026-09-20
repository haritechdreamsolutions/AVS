import bcrypt from 'bcrypt';
import { pool } from './pg_pool.js';

const ROUNDS = 10;

export async function runAutoMigrations() {
  console.log('[auto_migrate] Checking and migrating database schema...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Companies Table
    await client.query(`
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
    `);

    // 2. Roles Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        role_name VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(255)
      );
    `);

    await client.query(`
      INSERT INTO roles (role_name, description) VALUES
        ('OWNER', 'Full access - company owner'),
        ('STORE_KEEPER', 'Warehouse and inventory management'),
        ('EMPLOYEE', 'Driver/field sales employee')
      ON CONFLICT (role_name) DO NOTHING;
    `);

    // 3. Employees Table
    await client.query(`
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
    `);
    await client.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS route_id INTEGER;');
    await client.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;');

    // 4. User Accounts Table
    await client.query(`
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
    `);

    // 5. Routes Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS routes (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        code VARCHAR(20),
        name VARCHAR(150) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 6. Villages Table
    await client.query(`
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
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 7. Route Assignments Table
    await client.query(`
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
    `);

    // 8. Categories Table
    await client.query(`
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
    `);
    await client.query("ALTER TABLE categories ADD COLUMN IF NOT EXISTS operational_unit VARCHAR(50) DEFAULT 'Piece';");

    // Ensure default categories
    await client.query(`
      INSERT INTO categories (company_id, code, name, operational_unit, is_active)
      VALUES 
        (1, 'CAT-MILK', 'Milk', 'Piece', TRUE),
        (1, 'CAT-CURD', 'Curd', 'Piece', TRUE),
        (1, 'CAT-BOX', 'Box', 'Box', TRUE),
        (1, 'CAT-CASE', 'Case', 'Case', TRUE)
      ON CONFLICT DO NOTHING;
    `);

    // 9. Products Table
    await client.query(`
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
    `);

    // 10. Shops Table
    await client.query(`
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
        current_due NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        has_freezer BOOLEAN NOT NULL DEFAULT FALSE,
        freezer_model VARCHAR(150),
        freezer_serial VARCHAR(100),
        freezer_date VARCHAR(30),
        freezer_status VARCHAR(30),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('ALTER TABLE shops ADD COLUMN IF NOT EXISTS village_id INTEGER;');
    await client.query('ALTER TABLE shops ADD COLUMN IF NOT EXISTS village VARCHAR(150);');

    // 11. Employee Stock Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_stock (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        company_id INTEGER NOT NULL DEFAULT 1,
        qty_units NUMERIC(12,4) NOT NULL DEFAULT 0,
        unit VARCHAR(20) DEFAULT 'Tray',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 12. Driver Sessions Table
    await client.query(`
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
    `);

    // 13. Sales & Sale Items Table
    await client.query(`
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
    `);
    await client.query('ALTER TABLE sales ADD COLUMN IF NOT EXISTS session_id INTEGER;');
    await client.query('ALTER TABLE sales ADD COLUMN IF NOT EXISTS sale_date DATE NOT NULL DEFAULT CURRENT_DATE;');
    await client.query('ALTER TABLE sales ADD COLUMN IF NOT EXISTS sale_time VARCHAR(30);');
    await client.query('ALTER TABLE sales ADD COLUMN IF NOT EXISTS cash_paid NUMERIC(10,2) NOT NULL DEFAULT 0.00;');
    await client.query('ALTER TABLE sales ADD COLUMN IF NOT EXISTS gpay_paid NUMERIC(10,2) NOT NULL DEFAULT 0.00;');
    await client.query('ALTER TABLE sales ADD COLUMN IF NOT EXISTS credit_paid NUMERIC(10,2) NOT NULL DEFAULT 0.00;');
    await client.query("ALTER TABLE sales ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';");

    await client.query(`
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
    `);

    // 14. Damages Table
    await client.query(`
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
    `);
    await client.query('ALTER TABLE damages ADD COLUMN IF NOT EXISTS session_id INTEGER;');
    await client.query("ALTER TABLE damages ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'Piece';");
    await client.query("ALTER TABLE damages ADD COLUMN IF NOT EXISTS damage_unit VARCHAR(20) DEFAULT 'Piece';");
    await client.query('ALTER TABLE damages ADD COLUMN IF NOT EXISTS base_quantity NUMERIC(12,4) DEFAULT 0;');
    await client.query('ALTER TABLE damages ADD COLUMN IF NOT EXISTS notes TEXT;');
    await client.query("ALTER TABLE damages ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'VERIFIED';");
    await client.query('ALTER TABLE damages ADD COLUMN IF NOT EXISTS verified_by INTEGER;');
    await client.query('ALTER TABLE damages ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;');

    // 15. Expenses Table
    await client.query(`
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
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS session_id INTEGER;');
    await client.query('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date DATE NOT NULL DEFAULT CURRENT_DATE;');

    // 16. Driver Returns Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS driver_returns (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        session_id INTEGER,
        employee_id INTEGER NOT NULL,
        return_no VARCHAR(50) NOT NULL,
        total_returned_units NUMERIC(12,4) DEFAULT 0,
        total_shortage_units NUMERIC(12,4) DEFAULT 0,
        total_shortage_cost NUMERIC(10,2) DEFAULT 0.00,
        status VARCHAR(30) DEFAULT 'VERIFIED',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 17. Stock Transactions Table
    await client.query(`
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
    `);

    // 18. Inventory Movements Table
    await client.query(`
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
    `);

    // 19. Settlements & Audit Logs
    await client.query(`
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
    `);

    await client.query(`
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
    `);

    // 20. Ensure Company, Roles & Users
    let cR = await client.query('SELECT id FROM companies LIMIT 1');
    let cid = 1;
    if (cR.rows.length === 0) {
      const ins = await client.query("INSERT INTO companies (name, subtitle, is_active) VALUES ('AVS AGENCIES', 'Distribution Management System', TRUE) RETURNING id");
      cid = ins.rows[0].id;
    } else {
      cid = cR.rows[0].id;
    }

    const ownerRole = (await client.query("SELECT id FROM roles WHERE role_name='OWNER'")).rows[0]?.id;
    const skRole = (await client.query("SELECT id FROM roles WHERE role_name='STORE_KEEPER'")).rows[0]?.id;
    const empRole = (await client.query("SELECT id FROM roles WHERE role_name='EMPLOYEE'")).rows[0]?.id;

    // Check & ensure Owner user (Reset owner pin if failed attempts or missing)
    if (ownerRole) {
      const ownerUser = await client.query('SELECT id, failed_attempts, pin_hash FROM user_accounts WHERE company_id=$1 AND role_id=$2', [cid, ownerRole]);
      if (ownerUser.rows.length === 0) {
        const hash = await bcrypt.hash('1234', ROUNDS);
        await client.query(
          'INSERT INTO user_accounts (company_id, role_id, login_id, name, pin_hash, account_status) VALUES ($1,$2,$3,$4,$5,$6)',
          [cid, ownerRole, 'owner', 'Owner Admin', hash, 'ACTIVE']
        );
      } else {
        // Unlock and ensure valid hash for default pin 1234 if locked or failed
        if (ownerUser.rows[0].failed_attempts > 0) {
          await client.query('UPDATE user_accounts SET failed_attempts=0, locked_until=NULL WHERE id=$1', [ownerUser.rows[0].id]);
        }
      }
    }

    // Check & ensure Storekeeper user
    if (skRole) {
      const skUser = await client.query('SELECT id FROM user_accounts WHERE company_id=$1 AND role_id=$2', [cid, skRole]);
      if (skUser.rows.length === 0) {
        const hash = await bcrypt.hash('1234', ROUNDS);
        await client.query(
          'INSERT INTO user_accounts (company_id, role_id, login_id, name, pin_hash, account_status) VALUES ($1,$2,$3,$4,$5,$6)',
          [cid, skRole, 'storekeeper', 'Store Keeper Admin', hash, 'ACTIVE']
        );
      }
    }

    await client.query('COMMIT');
    console.log('[auto_migrate] ✅ Database auto-migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[auto_migrate] ❌ Database migration error:', err);
  } finally {
    client.release();
  }
}
