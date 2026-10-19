import assert from 'node:assert/strict';
import pg from 'pg';

const uri=process.env.AVS_TEST_DATABASE_URL;
if(!uri || !/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(uri))throw new Error('Explicit isolated test database required');
process.env.DATABASE_URL=uri;
const {migrate}=await import('../database/migrate.js');
const {pool}=await import('../database/pg_pool.js');
const database='avs_hardening_migration_'+Date.now();
await pool.query('CREATE DATABASE '+database);
const isolated=new pg.Pool({connectionString:uri.replace(/\/avs_hardening_[a-z0-9_]+$/,'/'+database),max:2});
try {
  const fault={connect:async()=>{
    const client=await isolated.connect();
    return {query:async(sql,params)=>{
      if(sql.startsWith('INSERT INTO schema_migrations'))throw new Error('Synthetic interrupted migration');
      return client.query(sql,params);
    },release:()=>client.release()};
  }};
  await assert.rejects(migrate(fault),/Synthetic interrupted migration/);
  assert.equal((await isolated.query("SELECT to_regclass('schema_migrations') AS migration,to_regclass('companies') AS company")).rows[0].migration,null);
  assert.equal((await isolated.query("SELECT to_regclass('companies') AS company")).rows[0].company,null);
  await migrate(isolated);
  const before=(await isolated.query('SELECT name,checksum FROM schema_migrations ORDER BY name')).rows;
  await migrate(isolated);
  assert.deepEqual((await isolated.query('SELECT name,checksum FROM schema_migrations ORDER BY name')).rows,before);
  await isolated.query("UPDATE schema_migrations SET checksum='synthetic-invalid-checksum' WHERE name=$1",[before[0].name]);
  await assert.rejects(migrate(isolated),/checksum mismatch/);
  assert.equal((await isolated.query('SELECT COUNT(*)::int AS count FROM schema_migrations')).rows[0].count,before.length);
  await isolated.query('UPDATE schema_migrations SET checksum=$1 WHERE name=$2',[before[0].checksum,before[0].name]);
  console.log('PASS: interrupted DDL rolls back completely, reapplication is idempotent, altered migration checksums are rejected (new synthetic database only)');
} finally {await isolated.end();await pool.end();}
