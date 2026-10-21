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
  assert.deepEqual(before.map(row=>row.name), ['000_production_baseline.sql','004_production_hardening.sql','005_payment_reversals.sql','006_schema_compatibility.sql','007_operation_requests.sql','008_foundation_integrity.sql']);
  const constraints=(await isolated.query("SELECT conname,convalidated FROM pg_constraint WHERE connamespace='public'::regnamespace")).rows;
  for (const name of ['fk_ua_role','fk_emp_company','fk_pph_product','fk_uom_company','fk_uom_product','uq_cat_code','uq_cat_name','uq_prod_sku','uq_route_code','uq_shop_code','foundation_uom_values','foundation_product_prices']) {
    assert.ok(constraints.some(row=>row.conname===name && row.convalidated), 'Missing validated constraint: '+name);
  }
  assert.equal((await isolated.query("SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='product_price_history' AND column_name='effective_from'")).rows[0].column_default,'now()');
  // Exercise 008 directly twice, beyond the runner's checksum skip path.
  const {readFile}=await import('node:fs/promises');
  const integrity=await readFile(new URL('../database/migrations/008_foundation_integrity.sql',import.meta.url),'utf8');
  await isolated.query(integrity);
  await isolated.query(integrity);
  await assert.rejects(isolated.query("INSERT INTO employees(company_id,full_name) VALUES(-1,'Synthetic orphan')"), error=>error.code==='23503');
  const company=(await isolated.query("INSERT INTO companies(name) VALUES('Synthetic integrity fixture') RETURNING id")).rows[0].id;
  await isolated.query("INSERT INTO categories(company_id,code,name) VALUES($1,'TEST','Test')",[company]);
  await assert.rejects(isolated.query("INSERT INTO categories(company_id,code,name) VALUES($1,'TEST','Other')",[company]), error=>error.code==='23505');
  await assert.rejects(isolated.query("INSERT INTO products(company_id,name,display_name,purchase_price) VALUES($1,'Test','Test',-1)",[company]), error=>error.code==='23514');
  await migrate(isolated);
  assert.deepEqual((await isolated.query('SELECT name,checksum FROM schema_migrations ORDER BY name')).rows,before);
  await isolated.query("UPDATE schema_migrations SET checksum='synthetic-invalid-checksum' WHERE name=$1",[before[0].name]);
  await assert.rejects(migrate(isolated),/checksum mismatch/);
  assert.equal((await isolated.query('SELECT COUNT(*)::int AS count FROM schema_migrations')).rows[0].count,before.length);
  await isolated.query('UPDATE schema_migrations SET checksum=$1 WHERE name=$2',[before[0].checksum,before[0].name]);
  console.log('PASS: interrupted DDL rolls back completely, reapplication is idempotent, altered migration checksums are rejected (new synthetic database only)');
} finally {await isolated.end();await pool.end();}
