import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pool } from './pg_pool.js';
import { preflight } from './preflight.js';

const migrations = ['000_production_baseline.sql', '004_production_hardening.sql', '005_payment_reversals.sql', '006_schema_compatibility.sql', '007_operation_requests.sql', '008_foundation_integrity.sql', '009_product_deletion.sql', '010_protected_administrator.sql'];
export async function verifySchema() {
  const applied = await pool.query('SELECT name,checksum FROM schema_migrations');
  const known = new Map(applied.rows.map(row=>[row.name,row.checksum]));
  for (const name of migrations) {
    const sql = await readFile(new URL('./migrations/'+name,import.meta.url),'utf8');
    if (known.get(name) !== createHash('sha256').update(sql).digest('hex')) throw new Error('Reviewed database migration required: '+name);
  }
  if (process.env.NODE_ENV === 'production') {
    const privileges = (await pool.query("SELECT rolsuper,rolcreatedb,rolcreaterole,has_schema_privilege(current_user,'public','CREATE') AS schema_create FROM pg_roles WHERE rolname=current_user")).rows[0];
    if (privileges.rolsuper || privileges.rolcreatedb || privileges.rolcreaterole || privileges.schema_create) throw new Error('Application database account has excessive privileges');
  }
}
export async function migrate(target = pool) {
  const checks = await preflight(target);
  if (checks.some(check => check.status === 'REVIEW_REQUIRED')) throw new Error('Migration preflight requires reconciliation: ' + checks.filter(check => check.status === 'REVIEW_REQUIRED').map(check=>check.name).join(', '));
  const client = await target.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(817261)");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    for (const name of migrations) {
      const sql = await readFile(new URL('./migrations/' + name, import.meta.url), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = await client.query('SELECT checksum FROM schema_migrations WHERE name=$1', [name]);
      if (previous.rows.length) {
        if (previous.rows[0].checksum !== checksum) throw new Error('Migration checksum mismatch: ' + name);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [name, checksum]);
    }
    if (process.env.AVS_APPLY_RUNTIME_GRANTS === '1') await client.query(await readFile(new URL('./runtime-grants.sql',import.meta.url),'utf8'));
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes('--apply-reviewed')) throw new Error('Review preflight and approve migration before using --apply-reviewed');
  try { await migrate(); } finally { await pool.end(); }
}
