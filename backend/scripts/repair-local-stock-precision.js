// Apply only the stock precision definitions already reviewed in migration 006.
import { readFile } from 'node:fs/promises';
import { pool } from '../database/pg_pool.js';

if (process.env.NODE_ENV === 'production') throw new Error('Use reviewed migrations for production.');
const client = await pool.connect();
try {
  const server = (await client.query('SELECT inet_server_addr()::text AS host')).rows[0];
  if (!['::1/128','127.0.0.1/32'].includes(server.host)) throw new Error('Local database required.');
  const migration = await readFile(new URL('../database/migrations/006_schema_compatibility.sql',import.meta.url),'utf8');
  const changes = [...migration.matchAll(/ALTER TABLE (\w+) ALTER COLUMN (\w+) TYPE NUMERIC\(20,8\);/g)];
  if (changes.length !== 5) throw new Error('Reviewed stock precision definitions not found.');
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='5s'");
  await client.query('SELECT pg_advisory_xact_lock(817261)');
  for (const [sql,table,column] of changes) {
    const existing = (await client.query('SELECT numeric_scale FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3',['public',table,column])).rows[0];
    if (existing && existing.numeric_scale < 8) await client.query(sql);
  }
  await client.query('COMMIT');
  console.log('Local stock precision repaired. Existing quantities preserved.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
