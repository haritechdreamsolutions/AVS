// Existing reviewed migrations 004/006 define these invoice unit snapshots.
import { pool } from '../database/pg_pool.js';

if (process.env.NODE_ENV === 'production') throw new Error('Use reviewed migrations for production.');
const client = await pool.connect();
try {
  const server = (await client.query('SELECT inet_server_addr()::text AS host')).rows[0];
  if (!['::1/128','127.0.0.1/32'].includes(server.host)) throw new Error('Local database required.');
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='5s'");
  await client.query('SELECT pg_advisory_xact_lock(817261)');
  await client.query('ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS conversion_to_base NUMERIC(12,4)');
  await client.query('ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS stock_qty_units NUMERIC(20,8)');
  await client.query('COMMIT');
  console.log('Local invoice unit schema repaired. Existing bills and stock preserved.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
