import bcrypt from 'bcrypt';
import { pool } from './pg_pool.js';

const ROUNDS = 12;

async function bootstrap() {
  const res = await pool.query('SELECT id FROM companies LIMIT 1');
  if (res.rows.length > 0) {
    console.log('[bootstrap] Company already exists, skipping.');
    await pool.end();
    return;
  }
  const cName   = process.env.BOOTSTRAP_COMPANY_NAME || 'AVS AGENCIES';
  const loginId = process.env.BOOTSTRAP_OWNER_LOGIN  || 'owner';
  const uName   = process.env.BOOTSTRAP_OWNER_NAME   || 'Owner Admin';
  const pin     = process.env.BOOTSTRAP_OWNER_PIN    || '1234';
  const phone   = process.env.BOOTSTRAP_OWNER_PHONE  || null;

  const cR = await pool.query(
    'INSERT INTO companies (name, subtitle, is_active) VALUES ($1, $2, TRUE) RETURNING id',
    [cName, 'Distribution Management System']
  );
  const companyId = cR.rows[0].id;

  const rR = await pool.query("SELECT id FROM roles WHERE role_name='OWNER'");
  const roleId = rR.rows[0].id;

  const hash = await bcrypt.hash(String(pin), ROUNDS);
  await pool.query(
    'INSERT INTO user_accounts (company_id,role_id,login_id,name,phone,pin_hash,account_status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [companyId, roleId, loginId, uName, phone, hash, 'ACTIVE']
  );

  console.log('=================================================');
  console.log('[bootstrap] SUCCESS!');
  console.log('  Company  : ' + cName);
  console.log('  Login ID : ' + loginId);
  console.log('  PIN      : ' + pin);
  console.log('  Change PIN after first login!');
  console.log('=================================================');
  await pool.end();
}

bootstrap().catch(e => {
  console.error('[bootstrap] FAILED:', e.message);
  process.exit(1);
});
