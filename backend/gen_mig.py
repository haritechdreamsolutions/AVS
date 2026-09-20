import os

sql = '''-- Migration 002: Store Keeper & Inventory enhancements
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS reference VARCHAR(100);
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS received_by VARCHAR(150);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(10,2) DEFAULT 0.00;
'''

with open('d:/Startup/AVS/backend/database/migrations/002_storekeeper.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

runner = '''const fs = require('fs');
const pg = require('pg');
const { Pool } = pg;

async function run() {
  const sql = fs.readFileSync('database/migrations/002_storekeeper.sql', 'utf8');
  for (const db of ['avs_agencies_db', 'avs_agencies_test']) {
    const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: 'root', database: db });
    await pool.query(sql);
    await pool.end();
    console.log('[migrate] 002 applied to ' + db);
  }
}

run().catch(err => {
  console.error('[migrate] error:', err.message);
  process.exit(1);
});
'''

with open('d:/Startup/AVS/backend/database/run_migration_002.cjs', 'w', encoding='utf-8') as f:
    f.write(runner)

print('Migration files generated')
