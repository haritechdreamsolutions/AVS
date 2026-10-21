import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { driverUnitPrice, reviewDriverPrices } from '../../frontend/src/utils/driverPricing.js';
import { getOperationalUnit } from '../../frontend/src/utils/unitHelper.js';

const pieceProduct = { id:1,base_unit:'Piece',selling_unit:'Piece',pieces_per_unit:1,piece_selling_price:10,unit_selling_price:100,direct_sale_rate:12 };
await test('driver prices use the actual submitted unit, including base-unit products',()=>{
  assert.equal(driverUnitPrice(pieceProduct,getOperationalUnit(pieceProduct).operationalUnit),10);
  assert.equal(driverUnitPrice({...pieceProduct,selling_unit:'Tray'},'Piece'),10);
  assert.equal(driverUnitPrice({...pieceProduct,selling_unit:'Case'},'Case'),100);
  assert.throws(()=>driverUnitPrice({...pieceProduct,piece_selling_price:0},'Piece'),/not configured/);
  assert.throws(()=>driverUnitPrice(pieceProduct,'Box'),/unit changed/);
});
await test('stale prices update the reviewed total using exact paise without mutating the cart',()=>{
  const original = {items:[{product_id:1,unit_type:'Piece',qty:3,rate:100}],total_amount:300};
  const reviewed = reviewDriverPrices(original,[{...pieceProduct,piece_selling_price:10.05}]);
  assert.equal(reviewed.changed,true);
  assert.equal(reviewed.bill.total_amount,30.15);
  assert.equal(reviewed.bill.items[0].rate,10.05);
  assert.equal(original.items[0].rate,100);
  assert.equal(reviewDriverPrices(reviewed.bill,[{...pieceProduct,piece_selling_price:10.05}]).changed,false);
  assert.throws(()=>reviewDriverPrices(original,[]),/unavailable/);
});

if (!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL || '')) throw new Error('Explicit isolated test database required');
process.env.DATABASE_URL=process.env.AVS_TEST_DATABASE_URL;
const { pool }=await import('../database/pg_pool.js');
const db=await import('../db_pg.js');
try {
  await test('corrected driver prices persist a bill; forged prices still roll back',async()=>{
    const company=(await pool.query("INSERT INTO companies(name) VALUES('Synthetic driver pricing') RETURNING id")).rows[0].id;
    const route=(await pool.query("INSERT INTO routes(company_id,name,code) VALUES($1,'Synthetic route',$2) RETURNING id",[company,randomUUID().slice(0,16)])).rows[0].id;
    const employee=(await pool.query("INSERT INTO employees(company_id,employee_code,full_name,route_id) VALUES($1,$2,'Synthetic driver',$3) RETURNING id",[company,randomUUID().slice(0,16),route])).rows[0].id;
    const owner=(await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash) VALUES($1,(SELECT id FROM roles WHERE role_name='OWNER'),$2,'Synthetic owner','test-only-hash') RETURNING id",[company,randomUUID()])).rows[0].id;
    const shop=(await pool.query("INSERT INTO shops(company_id,name,route_id,ledger_ready) VALUES($1,'Synthetic pricing shop',$2,true) RETURNING id",[company,route])).rows[0].id;
    const product=(await pool.query("INSERT INTO products(company_id,name,display_name,base_unit,selling_unit,pieces_per_unit,piece_selling_price,unit_selling_price,direct_sale_rate,warehouse_stock_units) VALUES($1,'Synthetic item','Synthetic item','Piece','Piece',1,10.05,100,12,10) RETURNING *",[company])).rows[0];
    await db.issueStockToEmployee(company,{employee_id:employee,items:[{product_id:product.id,quantity:10,unit:'Piece'}],idempotency_key:randomUUID()},owner);
    const cart={shop_id:shop,items:[{product_id:product.id,unit_type:getOperationalUnit(product).operationalUnit,qty:3,rate:100}],total_amount:300,payment_mode:'CASH',idempotency_key:randomUUID()};
    await assert.rejects(db.createEmployeeSale(company,employee,'Synthetic driver',cart,owner),/Price changed/);
    assert.equal(Number((await pool.query('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2',[employee,product.id])).rows[0].qty_units),10);
    const reviewed=reviewDriverPrices(cart,[product]);
    const result=await db.createEmployeeSale(company,employee,'Synthetic driver',reviewed.bill,owner);
    assert.equal(Number(result.sale.total_amount),30.15);
    assert.equal(Number(result.sale.cash_paid),30.15);
    assert.equal(Number((await pool.query('SELECT rate FROM sale_items WHERE sale_id=$1',[result.sale.id])).rows[0].rate),10.05);
    assert.equal(Number((await pool.query('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2',[employee,product.id])).rows[0].qty_units),7);
  });
} finally {await pool.end();}
