import { pool } from '../database/pg_pool.js';

async function checkStatus() {
  const tables = [
    'sales',
    'sale_items',
    'driver_returns',
    'expenses',
    'damages',
    'driver_sessions',
    'employee_stock',
    'stock_transactions',
    'inventory_movements',
    'settlements',
    'audit_logs'
  ];

  const counts = {};
  for (const t of tables) {
    try {
      const res = await pool.query(`SELECT COUNT(*) as c FROM ${t}`);
      counts[t] = Number(res.rows[0].c);
    } catch (e) {
      counts[t] = 'Error: ' + e.message;
    }
  }

  console.log('=== CURRENT OPERATIONAL / TRANSACTIONAL DATA COUNTS ===');
  console.table(counts);

  const users = (await pool.query('SELECT u.id, u.name, u.login_id, r.role_name FROM user_accounts u LEFT JOIN roles r ON r.id = u.role_id')).rows;
  console.log('\n=== USERS (Master Accounts Untouched) ===');
  console.table(users);

  const products = (await pool.query('SELECT id, name, sku, warehouse_stock_units FROM products')).rows;
  console.log('\n=== PRODUCTS (Catalog Master Untouched, Stock Reset to 0) ===');
  console.table(products);

  const shopsCount = (await pool.query('SELECT COUNT(*) as c FROM shops')).rows[0].c;
  console.log('\n=== SHOPS (Master Preserved):', shopsCount, '===');

  await pool.end();
}

checkStatus();
