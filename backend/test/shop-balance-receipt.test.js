import test from 'node:test';
import assert from 'node:assert/strict';
import pg from '../node_modules/pg/lib/index.js';
import {receiptSQL,validDates,validId,shopBalanceHandlers} from '../shop-balance-receipt.js';
test('IDs and real inclusive date ranges',()=>{
 for(const id of ['0','-1','1 OR 1=1','2147483648'])assert.equal(validId(id),false);
 assert.equal(validId('12'),true);
 assert.equal(validDates('2026-02-30','2026-03-01'),false);
 assert.equal(validDates('2026-10-02','2026-10-01'),false);
 assert.equal(validDates('2026-10-01','2026-10-01'),true);
});
test('handlers reject invalid IDs before querying',async()=>{
 let calls=0;const h=shopBalanceHandlers(async()=>{calls++;return {rows:[]};});
 const res={status(n){this.code=n;return this;},json(){}};
 await h.shops({params:{routeId:'0'}},res,()=>{});
 assert.equal(res.code,400);assert.equal(calls,0);
});
test('Postgres receipt FIFO, quantities, date boundaries and isolation',async()=>{
 const client=new pg.Client({host:'127.0.0.1',port:55439,user:'avs_test_admin',database:'postgres',connectionTimeoutMillis:2000});
 await client.connect();
 try{
 await client.query('SET search_path TO pg_temp');
 await client.query(`
 CREATE TEMP TABLE routes(id int,company_id int,name text,is_active bool);
 CREATE TEMP TABLE villages(id int,company_id int,route_id int);
 CREATE TEMP TABLE shops(id int,company_id int,name text,is_active bool,village_id int,route_id int,ledger_ready bool,opening_due_remaining numeric,opening_balance numeric,current_due numeric);
 CREATE TEMP TABLE sales(id int,company_id int,shop_id int,sale_date date,credit_paid numeric,old_credit_paid numeric,status text);
 CREATE TEMP TABLE receipt_allocations(sale_id int,amount numeric);
 CREATE TEMP TABLE payment_reversals(sale_id int,company_id int,amount numeric);
 CREATE TEMP TABLE products(id int,company_id int,name text,category_id int,base_unit text,pieces_per_unit numeric);
 CREATE TEMP TABLE categories(id int,name text);
 CREATE TEMP TABLE sale_items(sale_id int,product_id int,unit_type text,qty numeric,conversion_to_base numeric);
 INSERT INTO routes VALUES(1,1,'Route',true),(2,2,'Foreign',true),(3,1,'Deleted',false);
 INSERT INTO shops VALUES(1,1,'Shop',true,null,1,true,20,20,120.03);
 INSERT INTO products VALUES(1,1,'milk 200ml',1,'Piece',12),(2,1,'curd 200ml',1,'Piece',12);
 INSERT INTO categories VALUES(1,'Tray');
 INSERT INTO sales VALUES(1,1,1,'2026-10-01',100.01,0,'ACTIVE'),(2,1,1,'2026-10-02',50.02,0,'ACTIVE'),(3,1,1,'2026-10-02',0,0,'ACTIVE'),(4,1,1,'2026-10-03',0,30,'ACTIVE');
 INSERT INTO receipt_allocations VALUES(1,30);
 INSERT INTO payment_reversals VALUES(1,1,10);
 INSERT INTO sale_items VALUES(1,1,'Tray',1,12),(2,2,'Piece',7,1),(3,1,'Piece',90,1);
 `);
 const run=async(from='2026-10-01',to='2026-10-03',cid=1,route=1)=>(await client.query(receiptSQL,[cid,route,1,from,to])).rows;
 let row=(await run())[0];
 assert.equal(row.reconciled,true);assert.equal(row.total,'120.03');
 assert.equal(row.rows[0].balance,'0');assert.equal(row.rows[1].milk,'12');
 assert.equal(row.rows[1].balance,'70.01');assert.equal(row.rows[2].curd,'7');
 assert.equal(row.rows[2].milk,'0');assert.equal(row.rows[3].milk,'0');
 row=(await run('2026-10-02','2026-10-02'))[0];
 assert.equal(row.total,'50.02');assert.equal(row.rows.length,2);
 assert.equal((await run('2026-10-01','2026-10-03',2)).length,0);
 assert.equal((await run('2026-10-01','2026-10-03',1,3)).length,0);
 await client.query('UPDATE shops SET current_due=999');
 assert.equal((await run())[0].reconciled,false);
 }finally{await client.end();}
});
