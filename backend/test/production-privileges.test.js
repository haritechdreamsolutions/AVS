import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const uri=process.env.AVS_TEST_DATABASE_URL;
if(!uri || !/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(uri))throw new Error('Explicit isolated test database required');
const admin=new pg.Pool({connectionString:uri,max:1});
const suffix=Date.now(),runtime='avs_test_runtime_'+suffix,backup='avs_test_backup_'+suffix;
const parsed=new URL(uri),database=parsed.pathname.slice(1);
try {
  await admin.query('CREATE ROLE '+runtime+' LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION');
  await admin.query('CREATE ROLE '+backup+' NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION');
  const grants=(await readFile(new URL('../database/runtime-grants.sql',import.meta.url),'utf8')).replaceAll('avs_runtime',runtime).replaceAll('avs_backup',backup).replaceAll('avs_agencies_db',database);
  await admin.query(grants);
  const company=(await admin.query("INSERT INTO companies(name) VALUES('Synthetic privilege company') RETURNING id")).rows[0].id;
  const owner=(await admin.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash,credential_kind) VALUES($1,(SELECT id FROM roles WHERE role_name='OWNER'),$2,'Synthetic owner','unusable-synthetic-hash','password') RETURNING id",[company,'privileges-'+randomUUID()])).rows[0].id;
  const shop=(await admin.query("INSERT INTO shops(company_id,name,ledger_ready) VALUES($1,'Synthetic shop',true) RETURNING id",[company])).rows[0].id;
  const product=(await admin.query("INSERT INTO products(company_id,name,display_name,warehouse_stock_units,pieces_per_unit,unit_selling_price,piece_selling_price,direct_sale_rate) VALUES($1,'Synthetic privilege product','Synthetic privilege product',10,10,100,10,10) RETURNING id",[company])).rows[0].id;
  parsed.username=runtime;
  const data={shop_id:shop,is_store_direct_sale:true,sale_type:'STOREKEEPER_DIRECT',payment_mode:'CASH',items:[{product_id:product,qty:2,unit_type:'Piece',rate:10}],idempotency_key:randomUUID()};
  const script=[
    "import assert from 'node:assert/strict';",
    "import {pool} from './backend/database/pg_pool.js';",
    "import {createKeeperSale} from './backend/db_pg.js';",
    "import {refundSale,collectDue} from './backend/payments.js';",
    "import {randomUUID} from 'node:crypto';",
    "import {verifySchema} from './backend/database/migrate.js';",
    "try { process.env.NODE_ENV='production'; await verifySchema();",
    "const permissions=(await pool.query(\"SELECT has_schema_privilege(current_user,'public','CREATE') AS ddl,has_table_privilege(current_user,'receipts','DELETE') AS delete_receipts,has_table_privilege(current_user,'stock_transactions','UPDATE') AS rewrite_stock,has_table_privilege(current_user,'sales','DELETE') AS delete_sales\")).rows[0];",
    "assert.deepEqual(permissions,{ddl:false,delete_receipts:false,rewrite_stock:false,delete_sales:false});",
    "const result=await createKeeperSale("+company+","+JSON.stringify(data)+","+owner+");",
    "assert.equal(result.success,true);",
    "const actor={id:"+owner+",role:'OWNER'};",
    "await refundSale("+company+",result.sale.id,{amount:20,payment_mode:'CASH',reason:'Synthetic runtime refund',idempotency_key:randomUUID()},actor);",
    "await collectDue("+company+","+shop+",{amount:20,payment_mode:'CASH',idempotency_key:randomUUID()},actor);",
    "await refundSale("+company+",result.sale.id,{amount:20,payment_mode:'CASH',reason:'Synthetic allocated receipt refund',idempotency_key:randomUUID()},actor);",
    "assert.equal(Number((await pool.query('SELECT current_due FROM shops WHERE id=$1', ["+shop+"])).rows[0].current_due),20);",
    "console.log('PASS: restricted runtime billing, collections, original/receipt refunds and startup checks; financial rewriting denied');",
    "} finally { await pool.end(); }"
  ].join('\n');
  const excessive=spawnSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,NODE_ENV:'test',DATABASE_URL:uri},encoding:'utf8',windowsHide:true});
  assert.notEqual(excessive.status,0);
  assert.match(excessive.stderr,/excessive privileges/);
  const child=spawnSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,NODE_ENV:'test',DATABASE_URL:parsed.toString()},encoding:'utf8',windowsHide:true});
  assert.equal(child.status,0,child.stderr);
  console.log(child.stdout.trim());
} finally {await admin.end();}
