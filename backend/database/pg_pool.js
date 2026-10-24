import pg from 'pg';
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { checkServerIdentity } from 'node:tls';

// Force PostgreSQL DATE columns (OID 1082) to be returned as exact 'YYYY-MM-DD' strings
// to avoid unwanted UTC midnight date shifting in JavaScript
pg.types.setTypeParser(1082, str => str);

const { Pool } = pg;

const connectionUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const host = connectionUrl ? connectionUrl.hostname.replace(/^\[|\]$/g, '') : process.env.PG_HOST || 'localhost';
const loopback = ['localhost', '127.0.0.1', '::1'].includes(host);
if (process.env.PG_LOCAL_PRIVATE === '1' && !loopback) throw new Error('PG_LOCAL_PRIVATE is restricted to same-host loopback connections');
const tlsRequired = !loopback || process.env.PG_LOCAL_PRIVATE === '0' || Boolean(process.env.PG_SSL_CA);
if (connectionUrl) {
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'uselibpqcompat']) connectionUrl.searchParams.delete(key);
}
const poolConfig = {
  ...(connectionUrl ? { connectionString: connectionUrl.toString() } : {
    host, port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_USER || 'postgres', password: process.env.PG_PASSWORD || '',
    database: process.env.PG_DATABASE || 'avs_agencies_db'
  }),
  ssl: tlsRequired ? {
    rejectUnauthorized: true,
    ...(process.env.PG_SSL_CA ? { ca: readFileSync(process.env.PG_SSL_CA, 'utf8') } : {}),
    checkServerIdentity: (_servername, certificate) => checkServerIdentity(host, certificate)
  } : false,
  max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000,
  options: '-c timezone=Asia/Kolkata'
};

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[pg_pool] Pool error:', err.message);
});
