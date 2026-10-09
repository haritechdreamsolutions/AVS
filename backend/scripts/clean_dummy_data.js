import { pool } from '../database/pg_pool.js';

async function cleanDummyData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('1. Truncating transactional & operational tables...');
    await client.query(`
      TRUNCATE 
        sales, 
        sale_items, 
        expenses, 
        damages, 
        driver_returns, 
        driver_sessions, 
        employee_stock, 
        stock_transactions, 
        inventory_movements, 
        settlements, 
        audit_logs 
      RESTART IDENTITY CASCADE;
    `);

    console.log('2. Removing test dummy products...');
    await client.query(`
      DELETE FROM products 
      WHERE name ILIKE '%Test%' 
         OR sku ILIKE 'TEST%' 
         OR sku ILIKE 'PRD-1791566%' 
         OR sku ILIKE 'PRD-1791567%';
    `);

    console.log('3. Removing test dummy employees...');
    await client.query(`
      DELETE FROM employees 
      WHERE full_name ILIKE '%Test%' 
         OR employee_code ILIKE '%TEST%' 
         OR employee_code ILIKE 'DRV-%' 
         OR employee_code = 'EMP-P7';
    `);

    console.log('4. Resetting warehouse stock on remaining master products to 0...');
    await client.query('UPDATE products SET warehouse_stock_units = 0');

    await client.query('COMMIT');
    console.log('✅ Clean-up transaction committed successfully.\n');

    const remainingUsers = (await client.query(`
      SELECT u.id, u.name, u.phone, r.role_name, u.role_id 
      FROM user_accounts u 
      LEFT JOIN roles r ON r.id = u.role_id
    `)).rows;

    const remainingEmployees = (await client.query(`
      SELECT id, full_name, employee_code, vehicle_number, phone 
      FROM employees
    `)).rows;

    const remainingProducts = (await client.query(`
      SELECT id, name, sku, warehouse_stock_units, purchase_price, unit_selling_price 
      FROM products
    `)).rows;

    console.log('=== REMAINING ACTIVE USERS (Owner Login Preserved) ===');
    console.table(remainingUsers);

    console.log('\n=== REMAINING EMPLOYEES ===');
    console.table(remainingEmployees);

    console.log('\n=== REMAINING MASTER PRODUCTS (Stock Reset to 0 for Inward Receive) ===');
    console.table(remainingProducts);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Clean-up failed and was rolled back:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanDummyData();
