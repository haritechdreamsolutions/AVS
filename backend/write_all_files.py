import os

base = 'd:/Startup/AVS/backend'

# ==================== pg_pool.js ====================
pg_pool = """import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: false }
  : {
      host:     process.env.PG_HOST     || 'localhost',
      port:     parseInt(process.env.PG_PORT || '5432', 10),
      user:     process.env.PG_USER     || 'postgres',
      password: process.env.PG_PASSWORD || '',
      database: process.env.PG_DATABASE || 'avs_agencies_db',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[pg_pool] Pool error:', err.message);
});

pool.connect()
  .then(client => {
    const dbName = poolConfig.database || 'via DATABASE_URL';
    console.log('[pg_pool] Connected to PostgreSQL: ' + dbName);
    client.release();
  })
  .catch(err => {
    console.error('[pg_pool] Connection FAILED:', err.message);
  });
"""

# ==================== bootstrap.js ====================
bootstrap = """import bcrypt from 'bcrypt';
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
"""

files = {
    os.path.join(base, 'database', 'pg_pool.js'): pg_pool,
    os.path.join(base, 'database', 'bootstrap.js'): bootstrap,
}

for path, content in files.items():
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Written: ' + path)

print('All files written successfully.')
