// Add missing dashboard payment-ledger tables from the existing reviewed migrations.
// No transaction, shop balance or stock rows are changed.
import { readFile } from 'node:fs/promises';
import { pool } from '../database/pg_pool.js';

if (process.env.NODE_ENV === 'production') throw new Error('Use reviewed migrations for production.');
const client = await pool.connect();
try {
  const server = (await client.query('SELECT inet_server_addr()::text AS host')).rows[0];
  if (!['::1/128','127.0.0.1/32'].includes(server.host)) throw new Error('Local database required.');
  const hardening = await readFile(new URL('../database/migrations/004_production_hardening.sql',import.meta.url),'utf8');
  const start = hardening.indexOf('CREATE TABLE IF NOT EXISTS receipts (');
  const end = hardening.indexOf('CREATE TABLE IF NOT EXISTS session (');
  if (start < 0 || end <= start) throw new Error('Reviewed ledger definitions not found.');
  const reversals = (await readFile(new URL('../database/migrations/005_payment_reversals.sql',import.meta.url),'utf8'))
    .replace('ADD COLUMN original_amount','ADD COLUMN IF NOT EXISTS original_amount')
    .replace('CREATE TABLE reversal_allocations','CREATE TABLE IF NOT EXISTS reversal_allocations')
    .replace('CREATE INDEX production_reversal_allocation','CREATE INDEX IF NOT EXISTS production_reversal_allocation');
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='5s'");
  await client.query('SELECT pg_advisory_xact_lock(817261)');
  await client.query(hardening.slice(start,end));
  await client.query(reversals);
  await client.query('COMMIT');
  console.log('Local dashboard ledger schema repaired. Existing records preserved.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
