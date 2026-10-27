import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { driverUnitPrice, getDriverBillingInfo, reviewDriverPrices } from '../../frontend/src/utils/driverPricing.js';
import { pool } from '../database/pg_pool.js';
import { createEmployeeSale } from '../db_pg.js';

const products=[
  {id:1,name:'Milk',category_name:'Tray',base_unit:'Piece',selling_unit:'Tray',pieces_per_unit:72,piece_selling_price:8.61,unit_selling_price:620,direct_sale_rate:10},
  {id:2,name:'Water',category_name:'Case',base_unit:'Case',selling_unit:'Case',pieces_per_unit:1,piece_selling_price:9.72,unit_selling_price:700,direct_sale_rate:20},
  {id:3,name:'Rasna',category_name:'Box',base_unit:'Box',selling_unit:'Box',pieces_per_unit:1,piece_selling_price:700,unit_selling_price:700,direct_sale_rate:12},
  {id:4,name:'Legacy case',category_name:'Case',base_unit:'Piece',selling_unit:'Case',pieces_per_unit:24,piece_selling_price:10,unit_selling_price:300,direct_sale_rate:8}
];

test('driver Tray uses piece price while whole Case/Box use full Selling Rate',()=>{
  assert.deepEqual(products.map(p=>getDriverBillingInfo(p).unitType),['Piece','Case','Box','Case']);
  assert.deepEqual(products.map(p=>driverUnitPrice(p,getDriverBillingInfo(p).unitType)),[8.61,700,700,300]);
  assert.equal(driverUnitPrice(products[1],'Case')*2,1400);
  assert.equal(driverUnitPrice(products[3],'Case')*1,300);
  assert.equal(getDriverBillingInfo({...products[1],name:'Milk carton'}).isTray,false);
  assert.throws(()=>driverUnitPrice(products[3],'Piece'),/unit changed/);
  assert.equal(driverUnitPrice({...products[1],direct_sale_rate:999},'Case'),700);
});

test('payment review corrects stale Case piece prices without mutating the original bill',()=>{
  const bill={items:[{product_id:2,unit_type:'Case',qty:2,rate:9.72,amount:19.44}],total_amount:19.44};
  const reviewed=reviewDriverPrices(bill,products);
  assert.equal(reviewed.changed,true);
  assert.equal(reviewed.bill.items[0].rate,700);
  assert.equal(reviewed.bill.total_amount,1400);
  assert.equal(bill.total_amount,19.44);
  assert.equal(reviewDriverPrices(reviewed.bill,products).changed,false);
});

test('Thulasi-style driver bill persists full bulk rates and deducts full vehicle units',{
  skip:process.env.AVS_DRIVER_BULK_DB_TEST!=='1'
},async t=>{
  const client=await pool.connect(),originalConnect=pool.connect;
  t.after(async()=>{pool.connect=originalConnect;client.release();await pool.end();});
  for(const table of ['categories','products','employees','routes','villages','shops','employee_stock','driver_sessions','route_assignments','settlements','sales','sale_items','inventory_movements','stock_transactions','audit_logs']){
    await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`);
    await client.query(`CREATE TEMP SEQUENCE driver_bulk_${table}_ids START WITH 900001`);
    await client.query(`ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT nextval('pg_temp.driver_bulk_${table}_ids')`);
  }
  await client.query("INSERT INTO categories(id,company_id,code,name,operational_unit) VALUES(1,1,'TRAY','Tray','Piece'),(2,1,'CASE','Case','Case'),(3,1,'BOX','Box','Box')");
  await client.query("INSERT INTO routes(id,company_id,code,name) VALUES(1,1,'R1','Synthetic route'),(2,1,'R2','Other route')");
  await client.query("INSERT INTO villages(id,company_id,code,name,route_id,status) VALUES(1,1,'V1','Synthetic village',1,'ACTIVE'),(2,1,'V2','Other village',2,'ACTIVE')");
  await client.query("INSERT INTO employees(id,company_id,employee_code,full_name,route_id,is_active) VALUES(1,1,'DRIVER','Synthetic driver',1,TRUE)");
  await client.query("INSERT INTO shops(id,company_id,code,name,route_id,village_id,current_due,ledger_ready) VALUES(1,1,'SHOP-0003','Thulasi',1,1,0,TRUE),(2,1,'OTHER','Other route shop',2,2,0,TRUE)");
  await client.query("INSERT INTO driver_sessions(id,company_id,employee_id,route_id,session_date,status,opened_at) VALUES(1,1,1,1,CURRENT_DATE,'OPEN',NOW())");
  for(const p of products){
    const category=p.category_name==='Tray'?1:p.category_name==='Case'?2:3;
    await client.query('INSERT INTO products(id,company_id,category_id,sku,name,display_name,base_unit,selling_unit,pieces_per_unit,piece_selling_price,unit_selling_price,direct_sale_rate,warehouse_stock_units,is_active) VALUES($1,1,$2,$3,$3,$3,$4,$5,$6,$7,$8,$9,20,TRUE)',
      [p.id,category,p.name,p.base_unit,p.selling_unit,p.pieces_per_unit,p.piece_selling_price,p.unit_selling_price,p.direct_sale_rate]);
    await client.query('INSERT INTO employee_stock(company_id,employee_id,product_id,qty_units) VALUES(1,1,$1,5)',[p.id]);
  }
  pool.connect=async()=>({query:(...args)=>client.query(...args),release(){}});
  const items=products.map(p=>({product_id:p.id,qty:1,unit_type:getDriverBillingInfo(p).unitType,rate:driverUnitPrice(p,getDriverBillingInfo(p).unitType)}));
  const payload={idempotency_key:randomUUID(),bill_no:'DRIVER-'+randomUUID(),shop_id:1,payment_mode:'CASH',cash_paid:1708.61,items};
  const saved=await createEmployeeSale(1,1,'Synthetic driver',payload,null);
  assert.equal(Number(saved.sale.total_amount),1708.61);
  assert.equal(saved.sale.shop_id,1);
  const rows=(await client.query('SELECT product_id,unit_type,rate,stock_qty_units FROM sale_items WHERE sale_id=$1 ORDER BY product_id',[saved.sale.id])).rows;
  assert.deepEqual(rows.map(row=>row.unit_type),['Piece','Case','Box','Case']);
  assert.deepEqual(rows.map(row=>Number(row.rate)),[8.61,700,700,300]);
  assert.deepEqual(rows.slice(1).map(row=>Number(row.stock_qty_units)),[1,1,1]);
  const held=(await client.query('SELECT product_id,qty_units FROM employee_stock ORDER BY product_id')).rows;
  assert.ok(Math.abs(Number(held[0].qty_units)-(5-1/72))<0.00000001);
  assert.deepEqual(held.slice(1).map(row=>Number(row.qty_units)),[4,4,4]);
  assert.equal((await createEmployeeSale(1,1,'Synthetic driver',payload,null)).isDuplicate,true);
  const twoCases=await createEmployeeSale(1,1,'Synthetic driver',{...payload,idempotency_key:randomUUID(),bill_no:'CASES-'+randomUUID(),cash_paid:1400,items:[{product_id:2,unit_type:'Case',qty:2,rate:700}]},null);
  assert.equal(Number(twoCases.sale.total_amount),1400);
  assert.equal(Number((await client.query('SELECT qty_units FROM employee_stock WHERE product_id=2')).rows[0].qty_units),2);
  const before=(await client.query('SELECT product_id,qty_units FROM employee_stock ORDER BY product_id')).rows;
  await assert.rejects(createEmployeeSale(1,1,'Synthetic driver',{...payload,idempotency_key:randomUUID(),items:[{product_id:2,unit_type:'Case',qty:1,rate:9.72}]},null),/Price changed/);
  await assert.rejects(createEmployeeSale(1,1,'Synthetic driver',{...payload,idempotency_key:randomUUID(),items:[{product_id:4,unit_type:'Piece',qty:1,rate:10}]},null),/Driver billing unit changed/);
  await assert.rejects(createEmployeeSale(1,1,'Synthetic driver',{...payload,idempotency_key:randomUUID(),shop_id:2},null),/Unauthorized/);
  assert.deepEqual((await client.query('SELECT product_id,qty_units FROM employee_stock ORDER BY product_id')).rows,before);
  assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM sales')).rows[0].n,2);
  assert.ok((await client.query('SELECT warehouse_stock_units FROM products')).rows.every(row=>Number(row.warehouse_stock_units)===20));
});
