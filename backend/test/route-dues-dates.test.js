import assert from 'node:assert/strict';
import pg from '../node_modules/pg/lib/index.js';
import {datedRouteDuesSQL,routeDuesHandler} from '../route-dues.js';
const c=new pg.Client({host:'127.0.0.1',port:55439,user:'avs_test_admin',database:'postgres'});await c.connect();
try{
 await c.query('SET search_path TO pg_temp');
 await c.query(`CREATE TEMP TABLE routes(id int,company_id int,name text,code text,is_active bool);
 CREATE TEMP TABLE villages(id int,company_id int,route_id int);
 CREATE TEMP TABLE shops(id int,company_id int,name text,village_id int,route_id int,current_due numeric,ledger_ready bool,opening_due_remaining numeric,opening_balance numeric);
 CREATE TEMP TABLE employees(id int,company_id int,route_id int,full_name text,is_active bool);
 CREATE TEMP TABLE route_assignments(route_id int,employee_id int,assigned_date date);
 CREATE TEMP TABLE sales(id int,company_id int,shop_id int,sale_date date,credit_paid numeric,old_credit_paid numeric,status text);
 CREATE TEMP TABLE receipt_allocations(sale_id int,amount numeric);
 CREATE TEMP TABLE payment_reversals(sale_id int,company_id int,amount numeric);
 INSERT INTO routes VALUES(1,1,'Route A','A',true),(2,2,'Other','B',true);
 INSERT INTO shops VALUES(1,1,'Shop A',null,1,125,true,50,50),(2,2,'Other tenant',null,2,999,true,0,0);
 INSERT INTO sales VALUES(1,1,1,'2026-10-01',100,60,'ACTIVE'),(2,1,1,'2026-11-09',40,0,'ACTIVE'),(3,1,1,'2026-11-09',999,0,'CANCELLED'),(4,2,2,'2026-11-09',999,0,'ACTIVE'),(5,1,1,'2026-11-08',20,0,'ACTIVE');
 INSERT INTO receipt_allocations VALUES(2,5),(5,20);`);
 const report=async(from,to)=>(await c.query(datedRouteDuesSQL,[1,1,from,to])).rows[0];
 assert.equal((await report('2026-11-09','2026-11-09')).total,'35');
 assert.equal((await report('2026-10-01','2026-10-01')).total,'90');
 assert.equal((await report('2026-10-01','2026-11-09')).total,'125');
 assert.equal((await report('2026-11-08','2026-11-08')).total,'0');
 assert.equal((await report('2026-11-09','2026-11-09')).shops.length,1);
 let code;await routeDuesHandler(()=>{throw Error('Invalid dates must not query');})({session:{companyId:1},params:{routeId:'1'},query:{from:'2026-02-30',to:'2026-03-01'}},{status(v){code=v;return this},json(){}},e=>{throw e});assert.equal(code,400);
 console.log('PASS: receipt date ranges, old payment allocation, paid/cancelled bill exclusion, tenant isolation and date validation');
}finally{await c.end();}
