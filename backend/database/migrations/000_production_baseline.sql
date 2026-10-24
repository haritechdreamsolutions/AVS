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

CREATE TABLE IF NOT EXISTS routes (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        code VARCHAR(20),
        name VARCHAR(150) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

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

CREATE TABLE IF NOT EXISTS employee_stock (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        company_id INTEGER NOT NULL DEFAULT 1,
        qty_units NUMERIC(12,4) NOT NULL DEFAULT 0,
        unit VARCHAR(20) DEFAULT 'Tray',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

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

CREATE TABLE IF NOT EXISTS inventory_movements (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        movement_no VARCHAR(50) NOT NULL,
        movement_type VARCHAR(30) NOT NULL,
        product_id INTEGER,
        product_name VARCHAR(150),
        supplier_id INTEGER,
        supplier_name VARCHAR(150),
        employee_id INTEGER,
        employee_name VARCHAR(150),
        qty_units NUMERIC(12,4) NOT NULL DEFAULT 0,
        unit VARCHAR(20) DEFAULT 'Piece',
        rate NUMERIC(10,2) DEFAULT 0.00,
        total_amount NUMERIC(12,2) DEFAULT 0.00,
        notes TEXT,
        reference VARCHAR(255),
        received_by VARCHAR(255),
        movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
        movement_time VARCHAR(30),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(50),
        contact_person VARCHAR(100),
        phone VARCHAR(30),
        email VARCHAR(100),
        address TEXT,
        gstin VARCHAR(30),
        notes TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

CREATE TABLE IF NOT EXISTS supplier_product_rates (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        supplier_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        buy_rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

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

CREATE TABLE IF NOT EXISTS shop_freezers (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL DEFAULT 1,
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        model_name VARCHAR(150) NOT NULL,
        serial_no VARCHAR(100) NOT NULL,
        allocation_date VARCHAR(30) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'Active',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
INSERT INTO roles(role_name) VALUES ('OWNER'),('STORE_KEEPER'),('EMPLOYEE'),('DRIVER') ON CONFLICT DO NOTHING;
