// Repair only the legacy local schema fields needed by employee/user creation.
// These definitions already exist in reviewed migration 004; no rows are changed.
import { pool } from '../database/pg_pool.js';

if (process.env.NODE_ENV === 'production') throw new Error('Use reviewed migrations for production.');
const client = await pool.connect();
try {
  const { rows: [server] } = await client.query('SELECT inet_server_addr()::text AS host');
  if (!['::1/128', '127.0.0.1/32'].includes(server.host)) throw new Error('Local database required.');
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='5s'");
  await client.query('SELECT pg_advisory_xact_lock(817261)');
  await client.query('ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 1');
  await client.query("ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS credential_kind TEXT NOT NULL DEFAULT 'pin'");
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS production_route_day ON route_assignments(route_id,assigned_date)');
  await client.query('COMMIT');
  console.log('Local user creation schema repaired. Existing employees, users and bookings preserved.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
