import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
if (!process.env.AVS_TEST_DATABASE_URL || !/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL)) throw new Error('Explicit isolated test database required');
process.env.DATABASE_URL=process.env.AVS_TEST_DATABASE_URL;
const {pool}=await import('../database/pg_pool.js');
const {migrate}=await import('../database/migrate.js');
await migrate();
const db=await import('../db_pg.js');
const {refundSale,collectDue,settle}=await import('../payments.js');
const {paise,businessDate}=await import('../financial.js');
const company=(await pool.query("INSERT INTO companies(name) VALUES('Synthetic Billing Test') RETURNING id")).rows[0].id;
const owner=(await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash,credential_kind) VALUES($1,(SELECT id FROM roles WHERE role_name='OWNER'),$2,'Synthetic owner','unusable-synthetic-hash','password') RETURNING id",[company,'billing-'+randomUUID()])).rows[0].id;
const shop=(await pool.query("INSERT INTO shops(company_id,name,code,ledger_ready) VALUES($1,'Synthetic shop','SYNTH',true) RETURNING id",[company])).rows[0].id;
const product=(await pool.query("INSERT INTO products(company_id,name,display_name,warehouse_stock_units,pieces_per_unit,unit_selling_price,piece_selling_price,direct_sale_rate) VALUES($1,'Synthetic product','Synthetic product',1000,10,95,10,10) RETURNING id",[company])).rows[0].id;
const actor={id:owner,role:'OWNER'};
const bill=(changes={})=>({shop_id:shop,is_store_direct_sale:true,sale_type:'STOREKEEPER_DIRECT',payment_mode:'CASH',items:[{product_id:product,qty:2,unit_type:'Piece',rate:10}],idempotency_key:randomUUID(),...changes});
const stock=async()=>Number((await pool.query('SELECT warehouse_stock_units FROM products WHERE id=$1',[product])).rows[0].warehouse_stock_units);
const due=async()=>Number((await pool.query('SELECT current_due FROM shops WHERE id=$1',[shop])).rows[0].current_due);
try {
  await test('money rejects negative, excessive precision and nonfinite values',()=>{
    for(const value of [-1,'0.001','Infinity','NaN']) assert.throws(()=>paise(value));
    assert.equal(paise('10.01'),1001);
    assert.equal(businessDate(new Date('2026-10-01T20:00:00Z')),'2026-10-02');
  });
  await test('ten concurrent identical requests create one invoice and one stock deduction',async()=>{
    const data=bill();
    const before=await stock();
    const results=await Promise.all(Array.from({length:10},()=>db.createKeeperSale(company,data,owner)));
    assert.equal(new Set(results.map(result=>result.sale.id)).size,1);
    assert.equal(await stock(),before-0.2);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM sales WHERE company_id=$1 AND request_key=$2',[company,data.idempotency_key])).rows[0].count,1);
    await assert.rejects(db.createKeeperSale(company,{...data,items:[{...data.items[0],qty:3}]},owner),/Idempotency/);
  });
  await test('tampered prices, fractional quantities, old-dues clearing and invalid splits roll back',async()=>{
    const before=await stock();
    for(const data of [
      bill({items:[{product_id:product,qty:2,unit_type:'Piece',rate:0}]}),
      bill({items:[{product_id:product,qty:1.5,unit_type:'Piece',rate:10}]}),
      bill({old_credit_paid:10}),
      bill({payment_mode:'SPLIT',cash_paid:19.51,gpay_paid:0,credit_paid:0}),
      bill({payment_mode:'SPLIT',cash_paid:25,gpay_paid:0,credit_paid:-5}),
    ]) await assert.rejects(db.createKeeperSale(company,data,owner));
    assert.equal(await stock(),before);
  });
  await test('credit receipt allocation, refund and cancellation preserve balance and stock',async()=>{
    const beforeStock=await stock(),beforeDue=await due();
    const result=await db.createKeeperSale(company,bill({payment_mode:'CREDIT'}),owner);
    assert.equal(await due(),beforeDue+20);
    const payment={amount:20,payment_mode:'CASH',idempotency_key:randomUUID()};
    const receipts=await Promise.all(Array.from({length:10},()=>collectDue(company,shop,payment,actor)));
    assert.equal(new Set(receipts.map(result=>result.receipt.id)).size,1);
    assert.equal(await due(),beforeDue);
    await assert.rejects(db.cancelSale(company,result.sale.id,owner,'OWNER'),/refund/i);
    await refundSale(company,result.sale.id,{amount:20,payment_mode:'CASH',reason:'Synthetic cancellation',idempotency_key:randomUUID()},actor);
    assert.equal(await due(),beforeDue+20);
    await db.cancelSale(company,result.sale.id,owner,'OWNER');
    assert.equal(await due(),beforeDue);
    assert.equal(await stock(),beforeStock);
    await db.cancelSale(company,result.sale.id,owner,'OWNER');
    assert.equal(await stock(),beforeStock);
  });
  await test('cash invoice requires refund before cancellation',async()=>{
    const beforeDue=await due();
    const result=await db.createKeeperSale(company,bill(),owner);
    await assert.rejects(db.cancelSale(company,result.sale.id,owner,'EMPLOYEE'),/cannot cancel/);
    await assert.rejects(db.cancelSale(company,result.sale.id,owner,'OWNER'),/refund/i);
    const data={amount:20,payment_mode:'CASH',reason:'Synthetic refund',idempotency_key:randomUUID()};
    await refundSale(company,result.sale.id,data,actor);
    await refundSale(company,result.sale.id,data,actor);
    await db.cancelSale(company,result.sale.id,owner,'OWNER');
    assert.equal(await due(),beforeDue);
  });
  await test('distinct concurrent invoices have unique numbers',async()=>{
    const results=await Promise.all(Array.from({length:10},()=>db.createKeeperSale(company,bill(),owner)));
    assert.equal(new Set(results.map(result=>result.sale.bill_no)).size,10);
  });
  await test('new sessions serialize on employee and settlements ignore client expected amount',async()=>{
    const employee=(await pool.query("INSERT INTO employees(company_id,employee_code,full_name) VALUES($1,'CONCURRENT','Synthetic concurrent employee') RETURNING id",[company])).rows[0].id;
    const sessions=await Promise.all(Array.from({length:10},()=>db.getOrCreateActiveDriverSession(company,employee)));
    assert.equal(new Set(sessions.map(session=>session.id)).size,1);
    const data={employee_id:employee,expected_amount:999999,collected_amount:0,idempotency_key:randomUUID()};
    const results=await Promise.all(Array.from({length:10},()=>settle(company,data,actor)));
    assert.equal(new Set(results.map(result=>result.settlement.id)).size,1);
    assert.equal(Number(results[0].settlement.expected_amount),0);
  });

  await test('fractional internal packaging allocation and driver cancellation preserve canonical ledger',async()=>{
    const route=(await pool.query("INSERT INTO routes(company_id,name,code) VALUES($1,'Driver test route','DRVTEST') RETURNING id",[company])).rows[0].id;
    const employee=(await pool.query("INSERT INTO employees(company_id,employee_code,full_name,route_id) VALUES($1,'DRVTEST','Synthetic driver',$2) RETURNING id",[company,route])).rows[0].id;
    const driverShop=(await pool.query("INSERT INTO shops(company_id,name,code,route_id,ledger_ready) VALUES($1,'Driver shop','DRVTEST',$2,true) RETURNING id",[company,route])).rows[0].id;
    const allocation={employee_id:employee,items:[{product_id:product,quantity:0.5,unit:'Tray'}],idempotency_key:randomUUID()};
    const before=await stock();
    const results=await Promise.all(Array.from({length:10},()=>db.issueStockToEmployee(company,allocation,owner)));
    assert.equal(new Set(results.map(result=>result.session.id)).size,1);
    assert.equal(await stock(),before-0.5);
    await assert.rejects(db.issueStockToEmployee(company,{...allocation,items:[{product_id:product,quantity:1,unit:'Tray'}]},owner),/different allocation/);
    const sale=await db.createEmployeeSale(company,employee,'Synthetic driver',bill({shop_id:driverShop,is_store_direct_sale:false,sale_type:'DRIVER_DELIVERY',items:[{product_id:product,qty:2,unit_type:'Piece',rate:10}]}),owner);
    const entries=(await pool.query("SELECT unit,SUM(qty_units)::text AS quantity FROM stock_transactions WHERE company_id=$1 AND employee_id=$2 AND transaction_type='SALE' GROUP BY unit",[company,employee])).rows;
    assert.equal(entries.length,1);assert.equal(entries[0].unit,'Tray');assert.equal(Number(entries[0].quantity),0.2);
    await refundSale(company,sale.sale.id,{amount:20,payment_mode:'CASH',reason:'Synthetic driver cancellation',idempotency_key:randomUUID()},actor);
    await db.cancelSale(company,sale.sale.id,owner,'OWNER');
    assert.equal(Number((await pool.query("SELECT SUM(qty_units)::text AS quantity FROM stock_transactions WHERE company_id=$1 AND employee_id=$2 AND transaction_type='SALE'",[company,employee])).rows[0].quantity),0);
    assert.equal(Number((await pool.query('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2',[employee,product])).rows[0].qty_units),0.5);
  });
  await test('receipts allocate opening dues before oldest invoices',async()=>{
    const otherShop=(await pool.query("INSERT INTO shops(company_id,name,code,ledger_ready,opening_balance,opening_due_remaining,current_due) VALUES($1,'FIFO shop','FIFO',true,5,5,5) RETURNING id",[company])).rows[0].id;
    const first=await db.createKeeperSale(company,bill({shop_id:otherShop,payment_mode:'CREDIT'}),owner);
    const second=await db.createKeeperSale(company,bill({shop_id:otherShop,payment_mode:'CREDIT',items:[{product_id:product,qty:3,unit_type:'Piece',rate:10}]}),owner);
    const result=await collectDue(company,otherShop,{amount:35,payment_mode:'GPAY',idempotency_key:randomUUID()},actor);
    const allocations=(await pool.query('SELECT sale_id,amount FROM receipt_allocations WHERE receipt_id=$1 ORDER BY id',[result.receipt.id])).rows;
    assert.deepEqual(allocations.map(row=>[row.sale_id,Number(row.amount)]),[[null,5],[first.sale.id,20],[second.sale.id,10]]);
  });
} finally { await pool.end(); }
