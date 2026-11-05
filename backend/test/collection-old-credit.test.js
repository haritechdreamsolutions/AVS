import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
if (!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL||'')) throw Error('Explicit isolated test database required');
process.env.DATABASE_URL=process.env.AVS_TEST_DATABASE_URL;
const {pool}=await import('../database/pg_pool.js');
const {migrate}=await import('../database/migrate.js');await migrate();
const db=await import('../db_pg.js');
const {collectDue,cashFlow}=await import('../payments.js');
const {collectionLedger}=await import('../collection-ledger.js');
const {receiptSQL}=await import('../shop-balance-receipt.js');
const company=(await pool.query("INSERT INTO companies(name) VALUES('Synthetic old-credit collection') RETURNING id")).rows[0].id;
const owner=(await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash,credential_kind) VALUES($1,(SELECT id FROM roles WHERE role_name='OWNER'),$2,'Synthetic owner','unusable','password') RETURNING id",[company,randomUUID().slice(0,18)])).rows[0].id;
const actor={id:owner,role:'OWNER'};
const route=(await pool.query("INSERT INTO routes(company_id,name,code) VALUES($1,'Synthetic route',$2) RETURNING id",[company,randomUUID().slice(0,18)])).rows[0].id;
const product=(await pool.query("INSERT INTO products(company_id,name,display_name,warehouse_stock_units,pieces_per_unit,piece_selling_price,direct_sale_rate) VALUES($1,'Synthetic milk','Synthetic milk',10000,10,10,10) RETURNING id",[company])).rows[0].id;
const bill=(shop,qty,mode='CREDIT',old=0)=>db.createKeeperSale(company,{shop_id:shop,is_store_direct_sale:true,payment_mode:mode,old_credit_paid:old,items:[{product_id:product,qty,unit_type:'Piece',rate:10}],idempotency_key:randomUUID()},owner);
async function fixture(ready=true){
 const shop=(await pool.query("INSERT INTO shops(company_id,name,code,route_id,opening_balance,opening_due_remaining,current_due,ledger_ready) VALUES($1,'Synthetic shop',$2,$3,40,$4,40,$5) RETURNING id",[company,randomUUID().slice(0,18),route,ready?40:0,ready])).rows[0].id;
 const first=await bill(shop,10),second=await bill(shop,5);
 await bill(shop,1,'CASH',60);
 return {shop,first:first.sale.id,second:second.sale.id};
}
const due=async shop=>(await pool.query('SELECT current_due::text FROM shops WHERE id=$1',[shop])).rows[0].current_due;
try{
 await test('recorded old payments reduce opening then invoices without fabricating payments',()=>{
  const invoice={credit_paid:'100',allocated:'10',refunded:'0',old_credit_paid:'60'};
  const ledger=collectionLedger('40',[invoice]);
  assert.equal(ledger.opening,0);assert.equal(ledger.balance,7000);assert.equal(ledger.invoices[0].outstanding,7000);
  assert.throws(()=>collectionLedger('0',[{...invoice,allocated:'101'}]),/reconciliation/);
  assert.throws(()=>collectionLedger('0',[{...invoice,old_credit_paid:'100'}]),/reconciliation/);
 });
 for(const ready of [true,false])await test(`collect after bill-time old-credit payment, ledger_ready=${ready}`,async()=>{
  const f=await fixture(ready);assert.equal(await due(f.shop),'130.00');
  const payload={amount:100,payment_mode:'GPAY',idempotency_key:randomUUID()};
  const results=await Promise.all(Array.from({length:10},()=>collectDue(company,f.shop,payload,actor)));
  assert.equal(new Set(results.map(r=>r.receipt.id)).size,1);
  const allocations=(await pool.query('SELECT sale_id,amount::text FROM receipt_allocations WHERE receipt_id=$1 ORDER BY id',[results[0].receipt.id])).rows;
  assert.deepEqual(allocations,[{sale_id:f.first,amount:'80.00'},{sale_id:f.second,amount:'20.00'}]);
  assert.equal(await due(f.shop),'30.00');
  await collectDue(company,f.shop,{amount:30,payment_mode:'CASH',idempotency_key:randomUUID()},actor);
  assert.equal(await due(f.shop),'0.00');
  const report=(await pool.query(receiptSQL,[company,route,f.shop,'0001-01-01','9999-12-31'])).rows[0];
  assert.equal(report.reconciled,true);assert.equal(Number(report.total),0);
  assert.equal((await pool.query('SELECT COUNT(*)::int count FROM receipts WHERE shop_id=$1',[f.shop])).rows[0].count,2);
 });
 await test('real mismatches, overcollection and foreign shops remain blocked with no writes',async()=>{
  const f=await fixture();await pool.query('UPDATE shops SET current_due=current_due+1 WHERE id=$1',[f.shop]);
  await assert.rejects(collectDue(company,f.shop,{amount:10,payment_mode:'CASH',idempotency_key:randomUUID()},actor),/does not reconcile/);
  assert.equal((await pool.query('SELECT COUNT(*)::int count FROM receipts WHERE shop_id=$1',[f.shop])).rows[0].count,0);
  await assert.rejects(collectDue(company,f.shop,{amount:132,payment_mode:'CASH',idempotency_key:randomUUID()},actor),/exceeds/);
  await assert.rejects(collectDue(company+100000,f.shop,{amount:10,payment_mode:'CASH',idempotency_key:randomUUID()},actor),/Shop not found/);
 });
 await test('ordinary collections still use opening-first FIFO',async()=>{
  const shop=(await pool.query("INSERT INTO shops(company_id,name,code,opening_balance,opening_due_remaining,current_due,ledger_ready) VALUES($1,'Ordinary',$2,40,40,40,true) RETURNING id",[company,randomUUID().slice(0,18)])).rows[0].id;
  const sale=await bill(shop,2);
  const result=await collectDue(company,shop,{amount:50,payment_mode:'CASH',idempotency_key:randomUUID()},actor);
  const allocations=(await pool.query('SELECT sale_id,amount::text FROM receipt_allocations WHERE receipt_id=$1 ORDER BY id',[result.receipt.id])).rows;
  assert.deepEqual(allocations,[{sale_id:null,amount:'40.00'},{sale_id:sale.sale.id,amount:'10.00'}]);
  assert.equal(await due(shop),'10.00');
 });
 await test('old-credit cash is not counted as a new receipt or duplicated in cash flow',async()=>{
  const flow=await cashFlow(pool,company,null,{});
  // Three bill-time old-credit payments of 60 plus their cash bills of 10;
  // two successful CASH collections of 30 and ordinary collection of 50.
  assert.equal(flow.cash,'320.00');assert.equal(flow.gpay,'200.00');
 });
 await test('driver credit is visible in shop dues and next bill collects it exactly once',async()=>{
  const employee=(await pool.query("INSERT INTO employees(company_id,employee_code,full_name,route_id) VALUES($1,$2,'Credit driver',$3) RETURNING id",[company,randomUUID().slice(0,15),route])).rows[0].id;
  const shop=(await pool.query("INSERT INTO shops(company_id,name,code,route_id,ledger_ready) VALUES($1,'Driver credit shop',$2,$3,true) RETURNING id",[company,randomUUID().slice(0,15),route])).rows[0].id;
  const item=(await pool.query("INSERT INTO products(company_id,name,display_name,base_unit,selling_unit,pieces_per_unit,piece_selling_price,unit_selling_price,warehouse_stock_units) VALUES($1,'Credit item','Credit item','Piece','Piece',1,10,10,100) RETURNING id",[company])).rows[0].id;
  await db.issueStockToEmployee(company,{employee_id:employee,items:[{product_id:item,quantity:20,unit:'Piece'}],idempotency_key:randomUUID()},owner);
  const cart={shop_id:shop,items:[{product_id:item,unit_type:'Piece',qty:2,rate:10}],payment_mode:'CREDIT',idempotency_key:randomUUID()};
  const first=await db.createEmployeeSale(company,employee,'Credit driver',cart,owner);
  assert.equal(Number(first.sale.shop_current_due),20);
  assert.equal(Number((await db.getShops(company)).find(s=>s.id===shop).current_due),20);
  const next={...cart,payment_mode:'CASH',old_credit_paid:20,clear_previous_due:true,include_old_credit:true,idempotency_key:randomUUID()};
  const paid=await db.createEmployeeSale(company,employee,'Credit driver',next,owner);
  assert.equal(Number(paid.sale.previous_due),20);assert.equal(Number(paid.sale.old_credit_paid),20);
  assert.equal(Number(paid.sale.cash_paid),40);assert.equal(Number(paid.sale.shop_current_due),0);
  await db.createEmployeeSale(company,employee,'Credit driver',next,owner);
  assert.equal(Number((await db.getShops(company)).find(s=>s.id===shop).current_due),0);
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM sales WHERE shop_id=$1',[shop])).rows[0].n,2);
 });
 await test('split collection saves cash and UPI atomically, keeps unpaid credit and retries once',async()=>{
  const village=(await pool.query("INSERT INTO villages(company_id,name,code,route_id,status) VALUES($1,'Split village',$2,$3,'ACTIVE') RETURNING id",[company,randomUUID().slice(0,18),route])).rows[0].id;
  const employee=(await pool.query("INSERT INTO employees(company_id,employee_code,full_name,route_id) VALUES($1,$2,'Split route driver',$3) RETURNING id",[company,randomUUID().slice(0,18),route])).rows[0].id;
  const shop=(await pool.query("INSERT INTO shops(company_id,name,code,route_id,village_id,ledger_ready) VALUES($1,'Split shop',$2,$3,$4,true) RETURNING id",[company,randomUUID().slice(0,18),route,village])).rows[0].id;
  await bill(shop,120);assert.equal(await due(shop),'1200.00');
  const before=await cashFlow(pool,company,null,{});
  const data={amount:1000,payment_mode:'SPLIT',cash_amount:600,gpay_amount:400,idempotency_key:randomUUID()};
  const results=await Promise.all(Array.from({length:8},()=>collectDue(company,shop,data,actor)));
  assert.ok(results.every(r=>r.remainingDue===200));assert.equal(await due(shop),'200.00');
  const receipts=(await pool.query('SELECT payment_mode,amount::text FROM receipts WHERE shop_id=$1 ORDER BY id',[shop])).rows;
  assert.deepEqual(receipts,[{payment_mode:'CASH',amount:'600.00'},{payment_mode:'GPAY',amount:'400.00'}]);
  assert.equal(Number((await db.getShops(company)).find(s=>s.id===shop).current_due),200);
  assert.equal(Number((await db.getShops(company,{employee_id:employee})).find(s=>s.id===shop).current_due),200);
  const flow=await cashFlow(pool,company,null,{});assert.equal(Number(flow.cash)-Number(before.cash),600);assert.equal(Number(flow.gpay)-Number(before.gpay),400);
  for(const changes of [{amount:300,cash_amount:300,gpay_amount:0},{amount:100,cash_amount:99,gpay_amount:0},{amount:100,cash_amount:-1,gpay_amount:101},{amount:100,cash_amount:'0.001',gpay_amount:100}])await assert.rejects(collectDue(company,shop,{...data,...changes,idempotency_key:randomUUID()},actor));
  assert.equal(await due(shop),'200.00');
  await collectDue(company,shop,{amount:100,payment_mode:'SPLIT',cash_amount:0,gpay_amount:100,idempotency_key:randomUUID()},actor);
  assert.equal(await due(shop),'100.00');
  const final=await collectDue(company,shop,{amount:100,payment_mode:'CASH',idempotency_key:randomUUID()},actor);
  assert.equal(final.remainingDue,0);
 });
}finally{await pool.end();}
