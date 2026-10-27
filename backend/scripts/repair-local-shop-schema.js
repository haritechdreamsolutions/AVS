// These additive definitions already exist in reviewed migration 004.
// Repair a legacy local database without replaying unrelated production changes.
import { pool } from '../database/pg_pool.js';

if (process.env.NODE_ENV === 'production') throw new Error('Use reviewed migrations for production.');
const client = await pool.connect();
try {
  const { rows: [server] } = await client.query('SELECT inet_server_addr()::text AS host');
  if (!['::1/128', '127.0.0.1/32'].includes(server.host)) throw new Error('Local database required.');
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='5s'");
  await client.query('SELECT pg_advisory_xact_lock(817261)');
  await client.query('ALTER TABLE shops ADD COLUMN IF NOT EXISTS ledger_ready BOOLEAN NOT NULL DEFAULT FALSE');
  await client.query('ALTER TABLE shops ADD COLUMN IF NOT EXISTS opening_due_remaining NUMERIC(10,2) NOT NULL DEFAULT 0');
  await client.query('COMMIT');
  console.log('Local shop creation schema repaired. Existing shops and balances preserved.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
