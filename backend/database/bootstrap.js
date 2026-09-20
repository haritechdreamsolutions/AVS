import bcrypt from 'bcrypt';
import { pool } from './pg_pool.js';

const ROUNDS = 12;

async function bootstrap() {
  let cR = await pool.query('SELECT id, name FROM companies LIMIT 1');
  let companyId;
  let cName = process.env.BOOTSTRAP_COMPANY_NAME || 'AVS AGENCIES';

  if (cR.rows.length === 0) {
    const ins = await pool.query(
      'INSERT INTO companies (name, subtitle, is_active) VALUES ($1, $2, TRUE) RETURNING id',
      [cName, 'Distribution Management System']
    );
    companyId = ins.rows[0].id;
    console.log('[bootstrap] Created company:', cName);
  } else {
    companyId = cR.rows[0].id;
    cName = cR.rows[0].name;
    console.log('[bootstrap] Using existing company:', cName);
  }

  // 1. Ensure Owner exists
  const ownerRole = await pool.query("SELECT id FROM roles WHERE role_name='OWNER'");
  const ownerRoleId = ownerRole.rows[0].id;
  const ownerCheck = await pool.query("SELECT id FROM user_accounts WHERE company_id=$1 AND role_id=$2", [companyId, ownerRoleId]);
  if (ownerCheck.rows.length === 0) {
    const hash = await bcrypt.hash('1234', ROUNDS);
    await pool.query(
      'INSERT INTO user_accounts (company_id, role_id, login_id, name, pin_hash, account_status) VALUES ($1,$2,$3,$4,$5,$6)',
      [companyId, ownerRoleId, 'owner', 'Owner Admin', hash, 'ACTIVE']
    );
    console.log('[bootstrap] Created Owner account (login: owner, PIN: 1234)');
  }

  // 2. Ensure Store Keeper exists
  const skRole = await pool.query("SELECT id FROM roles WHERE role_name='STORE_KEEPER'");
  const skRoleId = skRole.rows[0].id;
  const skCheck = await pool.query("SELECT id FROM user_accounts WHERE company_id=$1 AND role_id=$2", [companyId, skRoleId]);
  if (skCheck.rows.length === 0) {
    const hash = await bcrypt.hash('1234', ROUNDS);
    await pool.query(
      'INSERT INTO user_accounts (company_id, role_id, login_id, name, pin_hash, account_status) VALUES ($1,$2,$3,$4,$5,$6)',
      [companyId, skRoleId, 'storekeeper', 'Store Keeper Admin', hash, 'ACTIVE']
    );
    console.log('[bootstrap] Created Store Keeper account (login: storekeeper, PIN: 1234)');
  }

  // 3. Ensure Employee exists
  const empRole = await pool.query("SELECT id FROM roles WHERE role_name='EMPLOYEE'");
  const empRoleId = empRole.rows[0].id;
  let empCheck = await pool.query("SELECT id FROM employees WHERE company_id=$1 LIMIT 1", [companyId]);
  let empId;
  if (empCheck.rows.length === 0) {
    const empIns = await pool.query(
      'INSERT INTO employees (company_id, employee_code, full_name, phone, vehicle_number) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [companyId, 'EMP001', 'Ravi Driver', '9876543210', 'TN 32 AB 1234']
    );
    empId = empIns.rows[0].id;
    console.log('[bootstrap] Created Employee record (Ravi Driver)');
  } else {
    empId = empCheck.rows[0].id;
  }

  const empUserCheck = await pool.query("SELECT id FROM user_accounts WHERE company_id=$1 AND role_id=$2", [companyId, empRoleId]);
  if (empUserCheck.rows.length === 0) {
    const hash = await bcrypt.hash('1111', ROUNDS);
    await pool.query(
      'INSERT INTO user_accounts (company_id, role_id, employee_id, login_id, name, pin_hash, account_status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [companyId, empRoleId, empId, 'emp1', 'Ravi Driver', hash, 'ACTIVE']
    );
    console.log('[bootstrap] Created Employee account (login: emp1, PIN: 1111)');
  }

  console.log('=================================================');
  console.log('[bootstrap] SUCCESS!');
  console.log('  Company        : ' + cName);
  console.log('  Owner Login    : owner / PIN: 1234');
  console.log('  Keeper Login   : storekeeper / PIN: 1234');
  console.log('  Employee Login : emp1 / PIN: 1111');
  console.log('=================================================');
  await pool.end();
}

bootstrap().catch(e => {
  console.error('[bootstrap] FAILED:', e.message);
  process.exit(1);
});
