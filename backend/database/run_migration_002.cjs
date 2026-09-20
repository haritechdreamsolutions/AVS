const fs = require('fs');
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
