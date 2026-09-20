import pg from 'pg';
import 'dotenv/config';

// Force PostgreSQL DATE columns (OID 1082) to be returned as exact 'YYYY-MM-DD' strings
// to avoid unwanted UTC midnight date shifting in JavaScript
pg.types.setTypeParser(1082, str => str);

const { Pool } = pg;

const poolConfig = process.env.DATABASE_URL
  ? { 
      connectionString: process.env.DATABASE_URL, 
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false } 
    }
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
