// One-time explicit provisioning; the application never embeds a default password.
import bcrypt from 'bcrypt';
import { pool } from '../database/pg_pool.js';
import { credential } from '../financial.js';

const companyId = Number(process.env.AVS_ADMIN_COMPANY_ID);
const secret = credential(process.env.AVS_ADMIN_PASSWORD, 'OWNER');
if (!Number.isSafeInteger(companyId) || companyId <= 0) throw new Error('AVS_ADMIN_COMPANY_ID required.');
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(817262)");
  const existing = (await client.query('SELECT company_id,pin_hash FROM user_accounts WHERE is_system_administrator')).rows[0];
  if (existing) {
    if (existing.company_id !== companyId || !await bcrypt.compare(secret, existing.pin_hash)) {
      throw new Error('Administrator already exists with different credentials; no account changed.');
    }
    console.log('Administrator already provisioned. No changes needed.');
  } else {
    if (!(await client.query('SELECT id FROM companies WHERE id=$1', [companyId])).rows.length) throw new Error('Company not found.');
    if ((await client.query("SELECT id FROM user_accounts WHERE LOWER(TRIM(login_id))='administrator'")).rows.length) {
      throw new Error('Administrator login is already in use; no existing account changed.');
    }
    const owner = (await client.query("SELECT id FROM roles WHERE role_name='OWNER'")).rows[0];
    if (!owner) throw new Error('Management role not found.');
    const hash = await bcrypt.hash(secret, 12);
    // Keep existing OWNER permission checks unchanged; identity is a protected administrator.
    await client.query(
      `INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash,credential_kind,is_system_administrator)
       VALUES($1,$2,'administrator','Administrator',$3,'password',TRUE)`, [companyId,owner.id,hash]
    );
    console.log('Protected Administrator provisioned.');
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
