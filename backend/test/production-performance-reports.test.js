import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const uri=process.env.AVS_TEST_DATABASE_URL;
if(!uri || !/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(uri))throw new Error('Explicit isolated test database required');
process.env.DATABASE_URL=uri;
const {pool}=await import('../database/pg_pool.js');
const {migrate}=await import('../database/migrate.js');await migrate();
const {driverPerformance,routePerformance}=await import('../performance-reports.js');
const {getShopPerformanceReport,getDriverExpectedReturn,getProductPerformanceReport}=await import('../db_pg.js');
const {businessDate}=await import('../financial.js');
const company=(await pool.query("INSERT INTO companies(name) VALUES('Synthetic performance reports') RETURNING id")).rows[0].id;
const route=(await pool.query("INSERT INTO routes(company_id,code,name) VALUES($1,$2,'Synthetic route') RETURNING id",[company,randomUUID().slice(0,12)])).rows[0].id;
const employee=(await pool.query("INSERT INTO employees(company_id,employee_code,full_name,route_id) VALUES($1,$2,'Synthetic driver',$3) RETURNING id",[company,randomUUID().slice(0,12),route])).rows[0].id;
const owner=(await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash) VALUES($1,(SELECT id FROM roles WHERE role_name='OWNER'),$2,'Synthetic owner','unusable-synthetic-hash') RETURNING id",[company,randomUUID()])).rows[0].id;
const shop=(await pool.query("INSERT INTO shops(company_id,name,route_id,ledger_ready,current_due) VALUES($1,'Synthetic shop',$2,true,6) RETURNING id",[company,route])).rows[0].id;
try {
  const date=businessDate();
  const active=(await pool.query("INSERT INTO sales(company_id,bill_no,employee_id,shop_id,sale_date,total_amount,cash_paid,credit_paid,payment_mode,status) VALUES($1,$2,$3,$4,$5,10,4,6,'SPLIT','ACTIVE') RETURNING id",[company,randomUUID(),employee,shop,date])).rows[0].id;
  const cancelled=(await pool.query("INSERT INTO sales(company_id,bill_no,employee_id,shop_id,sale_date,total_amount,cash_paid,credit_paid,payment_mode,status) VALUES($1,$2,$3,$4,$5,10,4,6,'SPLIT','CANCELLED') RETURNING id",[company,randomUUID(),employee,shop,date])).rows[0].id;
  const product=(await pool.query("INSERT INTO products(company_id,name,display_name,pieces_per_unit,purchase_price) VALUES($1,'Synthetic report product','Synthetic report product',10,20) RETURNING id",[company])).rows[0].id;
  await pool.query("INSERT INTO sale_items(sale_id,product_id,product_name,qty,unit_type,rate,amount,stock_qty_units) VALUES($1,$3,'Synthetic report product',2,'Piece',5,10,0.2),($2,$3,'Synthetic report product',5,'Piece',2,10,0.5)",[active,cancelled,product]);
  await pool.query("INSERT INTO receipts(company_id,shop_id,employee_id,created_by,request_key,request_hash,amount,payment_mode) VALUES($1,$2,$3,$4,$5,'synthetic',2,'CASH')",[company,shop,employee,owner,randomUUID()]);
  await pool.query("INSERT INTO payment_reversals(company_id,sale_id,created_by,request_key,request_hash,amount,original_amount,payment_mode,reason) VALUES($1,$2,$3,$4,'synthetic',4,4,'CASH','Synthetic completed refund')",[company,cancelled,owner,randomUUID()]);
  for(const report of [driverPerformance,routePerformance]) {
    let queries=0;
    const rows=await report(company,{start:date,end:date},{query:(...args)=>{queries++;return pool.query(...args);}});
    assert.equal(queries,1);
    assert.equal(rows.length,1);
    assert.equal(rows[0].total_sales,10);
    assert.equal(rows[0].total_bills,1);
    assert.equal(rows[0].cash_collected,6);
    assert.equal(rows[0].credit_sales,6);
    assert.equal((await report(company+100000,{start:date,end:date})).length,0);
  }
  assert.equal((await getShopPerformanceReport(company,{start_date:date,end_date:date}))[0].total_sales,10);
  const products=await getProductPerformanceReport(company,{start_date:date,end_date:date});
  assert.equal(products[0].total_sold_units,0.2);
  assert.equal(products[0].total_sold_pieces,2);
  assert.equal(products[0].total_sales_value,10);
  await getDriverExpectedReturn(company,employee);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM driver_sessions WHERE company_id=$1',[company])).rows[0].count,0);
  console.log('PASS: grouped driver/route reports use one query each, exclude cancelled revenue, include receipts/refunds, isolate companies; shop totals and read-only return preview verified');
} finally {await pool.end();}
