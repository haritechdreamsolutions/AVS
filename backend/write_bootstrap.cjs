const fs = require('fs');
const q = String.fromCharCode(36);
const code = `import bcrypt from 'bcrypt';
import { pool } from './pg_pool.js';
const ROUNDS = 12;
async function bootstrap() {
  const res = await pool.query('SELECT id FROM companies LIMIT 1');
  if (res.rows.length > 0) { console.log('[bootstrap] Exists, skipping.'); await pool.end(); return; }
  const cName   = process.env.BOOTSTRAP_COMPANY_NAME || 'AVS AGENCIES';
  const loginId = process.env.BOOTSTRAP_OWNER_LOGIN  || 'owner';
  const uName   = process.env.BOOTSTRAP_OWNER_NAME   || 'Owner Admin';
  const pin     = process.env.BOOTSTRAP_OWNER_PIN    || '1234';
  const phone   = process.env.BOOTSTRAP_OWNER_PHONE  || null;
  const cR = await pool.query('INSERT INTO companies (name,subtitle,is_active) VALUES (${q}1,${q}2,TRUE) RETURNING id',[cName,'Distribution Management System']);
  const companyId = cR.rows[0].id;
  const rR = await pool.query("SELECT id FROM roles WHERE role_name='OWNER'");
  const roleId = rR.rows[0].id;
  const hash = await bcrypt.hash(String(pin), ROUNDS);
  await pool.query('INSERT INTO user_accounts (company_id,role_id,login_id,name,phone,pin_hash,account_status) VALUES (${q}1,${q}2,${q}3,${q}4,${q}5,${q}6,${q}7)',[companyId,roleId,loginId,uName,phone,hash,'ACTIVE']);
  console.log('[bootstrap] SUCCESS company='+cName+' login='+loginId+' pin='+pin);
  await pool.end();
}
bootstrap().catch(e => { console.error('[bootstrap] FAILED:', e.message); process.exit(1); });
`;
fs.writeFileSync('d:/Startup/AVS/backend/database/bootstrap.js', code);
console.log('bootstrap.js written, len='+code.length);
