import { randomBytes } from 'node:crypto';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import bcrypt from 'bcrypt';

const uri=process.env.AVS_TEST_DATABASE_URL;
if(!uri || !/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_preview[a-z0-9_]*$/.test(uri))throw new Error('A new isolated preview database is required');
process.env.DATABASE_URL=uri;
const {pool}=await import('../database/pg_pool.js');
const {migrate}=await import('../database/migrate.js');
try {
  if((await pool.query("SELECT to_regclass('companies') AS existing")).rows[0].existing)throw new Error('Preview setup requires an empty synthetic database');
  await migrate();
  const company=(await pool.query("INSERT INTO companies(name) VALUES('LOCAL SYNTHETIC DEMO ONLY') RETURNING id")).rows[0].id;
  const village=(await pool.query("INSERT INTO villages(company_id,name,code) VALUES($1,'Local Test Village','LOCAL') RETURNING id",[company])).rows[0].id;
  const shop=(await pool.query("INSERT INTO shops(company_id,name,code,village_id,ledger_ready) VALUES($1,'Local Test Shop','LOCAL',$2,true) RETURNING id",[company,village])).rows[0].id;
  const product=(await pool.query("INSERT INTO products(company_id,name,display_name,pieces_per_unit,unit_selling_price,piece_selling_price,direct_sale_rate,warehouse_stock_units) VALUES($1,'Local Test Milk','Local Test Milk',10,100,10,10,10) RETURNING id",[company])).rows[0].id;
  const password=randomBytes(24).toString('base64url'),hash=await bcrypt.hash(password,12);
  for(const [login,role] of [['local.owner','OWNER'],['local.keeper','STORE_KEEPER']]) {
    await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash,credential_kind) VALUES($1,(SELECT id FROM roles WHERE role_name=$2),$3,$3,$4,'password')",[company,role,login,hash]);
  }
  const suffix=Date.now(),runtime='avs_preview_runtime_'+suffix,backup='avs_preview_backup_'+suffix;
  await pool.query('CREATE ROLE '+runtime+' LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION');
  await pool.query('CREATE ROLE '+backup+' NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION');
  const grants=(await readFile(new URL('../database/runtime-grants.sql',import.meta.url),'utf8')).replaceAll('avs_runtime',runtime).replaceAll('avs_backup',backup).replaceAll('avs_agencies_db',new URL(uri).pathname.slice(1));
  await pool.query(grants);
  const connection=new URL(uri);connection.username=runtime;
  await mkdir('.tmp',{recursive:true});
  await writeFile('.tmp/local-preview.json',JSON.stringify({url:'http://127.0.0.1:5000',owner:'local.owner',keeper:'local.keeper',password,database_url:connection.toString(),admin_url:uri,company,shop,product,session_secret:randomBytes(48).toString('hex')},null,2),{mode:0o600});
  console.log('Synthetic demo prepared. Credentials and local-only settings: .tmp/local-preview.json (ignored by Git).');
} finally {await pool.end();}
