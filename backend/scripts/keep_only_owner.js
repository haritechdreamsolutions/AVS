import bcrypt from 'bcrypt';
import { pool } from '../database/pg_pool.js';

async function setupOnlyOwner() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Delete all user accounts
    await client.query('DELETE FROM user_accounts');

    // 2. Truncate employees table
    await client.query('TRUNCATE employees RESTART IDENTITY CASCADE');

    // 3. Ensure all transaction tables remain 0
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

    // 4. Create Single Owner Account
    const company = await client.query('SELECT id FROM companies LIMIT 1');
    const companyId = company.rows[0].id;
    const ownerRole = await client.query("SELECT id FROM roles WHERE role_name = 'OWNER'");
    const ownerRoleId = ownerRole.rows[0].id;
    const pinHash = await bcrypt.hash('1234', 12);

    await client.query(`
      INSERT INTO user_accounts (company_id, role_id, login_id, name, pin_hash, account_status)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [companyId, ownerRoleId, 'owner', 'Owner Admin', pinHash, 'ACTIVE']);

    await client.query('COMMIT');
    console.log('✅ Setup Complete: ONLY Owner Account exists in the database.');

    const users = (await client.query(`
      SELECT u.id, u.name, u.login_id, r.role_name, u.role_id, u.account_status 
      FROM user_accounts u 
      LEFT JOIN roles r ON r.id = u.role_id
    `)).rows;

    const emps = (await client.query('SELECT * FROM employees')).rows;

    console.log('\n=== CURRENT ACTIVE USERS (ONLY OWNER) ===');
    console.table(users);

    console.log('\n=== CURRENT EMPLOYEES (TOTAL: ' + emps.length + ') ===');
    console.table(emps);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

setupOnlyOwner();
