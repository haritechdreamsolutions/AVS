// Only temporary tables on the explicit loopback test cluster; no app data or migrations.
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from '../node_modules/pg/lib/index.js';
import {routeDuesSQL} from '../route-dues.js';
const client=new pg.Client({host:'127.0.0.1',port:55439,user:'avs_test_admin',database:'postgres',connectionTimeoutMillis:2000});
await client.connect();
try {
 await client.query('SET search_path TO pg_temp');
 await client.query(`CREATE TEMP TABLE routes(id int primary key,company_id int,name text,code text,is_active bool);
 CREATE TEMP TABLE villages(id int primary key,company_id int,route_id int);
 CREATE TEMP TABLE shops(id int primary key,company_id int,name text,village_id int,route_id int,current_due numeric);
 CREATE TEMP TABLE employees(id int primary key,company_id int,route_id int,full_name text,is_active bool);
 CREATE TEMP TABLE route_assignments(route_id int,employee_id int,assigned_date date,unique(route_id,assigned_date));
 INSERT INTO routes VALUES(1,1,'A','A',true),(2,1,'Empty','B',true),(3,1,'Paid','C',true),(4,2,'Other company','A',true),(5,1,'Inactive','Z',false),(6,1,'Multiple drivers','D',true);
 INSERT INTO villages VALUES(1,1,1),(2,2,4);
 INSERT INTO shops VALUES(1,1,'Same',1,3,10.01),(2,1,'Same',null,1,20.02),(3,1,'Paid',null,3,0),(4,1,'Negative',null,1,-500),(5,2,'Other company',null,1,999),(6,1,'Cross-company village',2,1,0.03);
 INSERT INTO employees VALUES(1,1,1,'Fallback',true),(2,1,1,'Today',true),(3,1,3,'Sole driver',true),(4,1,6,'One',true),(5,1,6,'Two',true),(6,2,2,'Foreign',true);
 INSERT INTO route_assignments VALUES(1,2,CURRENT_DATE);`);
 await test('SQL keeps all active company routes exactly once, including empty and zero routes',async()=>{
  const {rows}=await client.query(routeDuesSQL,[1,null]);
  assert.deepEqual(rows.map(r=>r.id),[1,2,3,6]);assert.equal(rows[0].total,'30.06');
  assert.equal(rows[1].total,'0');assert.equal(rows[1].driver_name,null);
  assert.equal(rows[0].driver_name,'Today');assert.equal(rows[2].driver_name,'Sole driver');assert.equal(rows[3].assignment_error,true);
 });
 await test('detail respects village precedence, distinct IDs, positive filtering and exact decimal sum',async()=>{
  const {rows:[detail]}=await client.query(routeDuesSQL,[1,1]);
  assert.deepEqual(detail.shops.map(s=>s.id),[6,1,2]);
  assert.equal(detail.total,'30.06');assert.equal(detail.shops[1].name,detail.shops[2].name);
  assert.equal((await client.query(routeDuesSQL,[1,4])).rows.length,0);
 });
 await test('latest ledger balance changes affect summary and detail together',async()=>{
  // Fixture-only changes emulate the final balances maintained by existing billing.
  await client.query('UPDATE shops SET current_due=0 WHERE company_id=1');
  let detail=(await client.query(routeDuesSQL,[1,1])).rows[0];assert.equal(detail.total,'0');assert.deepEqual(detail.shops,[]);
  await client.query('UPDATE shops SET current_due=123.45 WHERE id=1');
  detail=(await client.query(routeDuesSQL,[1,1])).rows[0];
  const summary=(await client.query(routeDuesSQL,[1,null])).rows[0];assert.equal(detail.total,'123.45');assert.equal(summary.total,detail.total);
 });
} finally {await client.end();}
