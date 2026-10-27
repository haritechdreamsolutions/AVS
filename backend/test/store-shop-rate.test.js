import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { getStoreShopPricing } from '../../frontend/src/utils/storeShopPricing.js';
import { getStoreDirectPricing } from '../../frontend/src/utils/storeDirectPricing.js';
import { driverUnitPrice } from '../../frontend/src/utils/driverPricing.js';
import { pool } from '../database/pg_pool.js';
import { createSale } from '../db_pg.js';

const products=[
  {id:1,name:'Milk',base_unit:'Piece',selling_unit:'Tray',pieces_per_unit:72,piece_selling_price:10,unit_selling_price:720,direct_sale_rate:12},
  {id:2,name:'Whole box',base_unit:'Box',selling_unit:'Box',pieces_per_unit:1,piece_selling_price:700,unit_selling_price:800,direct_sale_rate:20},
  {id:3,name:'Whole case',base_unit:'Case',selling_unit:'Case',pieces_per_unit:1,piece_selling_price:500,unit_selling_price:300,direct_sale_rate:15},
  {id:4,name:'Legacy case',base_unit:'Piece',selling_unit:'Case',pieces_per_unit:24,piece_selling_price:10,unit_selling_price:240,direct_sale_rate:8}
];

test('only Tray bills pieces; Box/Case use whole-unit Selling Rate',()=>{
  assert.deepEqual(products.map(p=>getStoreShopPricing(p).rate),[10,800,300,240]);
  assert.deepEqual(products.map(p=>getStoreShopPricing(p).unitType),['Piece','Box','Case','Case']);
  assert.equal(products.reduce((sum,p)=>sum+getStoreShopPricing(p).rate*2,0),2700);
  for(const product of products) assert.equal(getStoreShopPricing({...product,direct_sale_rate:999}).rate,getStoreShopPricing(product).rate);
  assert.equal(getStoreShopPricing({...products[0],piece_selling_price:0}).rate,0);
  assert.equal(getStoreShopPricing({...products[2],piece_selling_price:0}).rate,300);
  assert.equal(getStoreShopPricing({...products[2],name:'Milk carton',category_name:'Case'}).isTray,false);
  assert.equal(getStoreShopPricing({...products[2],name:'Milk carton',category_name:'Case'}).rate*1,300);
  assert.equal(getStoreShopPricing({...products[0],category_name:'Tray'}).isTray,true);
  assert.equal(getStoreShopPricing({...products[0],category_name:'Tray'}).rate*5,50);
});

test('direct POS and driver prices retain their existing rules',()=>{
  assert.deepEqual(products.map(p=>getStoreDirectPricing(p).rate),[12,20,15,240]);
  assert.equal(driverUnitPrice(products[0],'Piece'),10);
  assert.equal(driverUnitPrice(products[3],'Case'),240);
});

test('shop bill sends a separate price policy without any direct rate fallback',async()=>{
  const source=await readFile(new URL('../../frontend/src/components/StoreKeeper/StoreShopBillingModal.jsx',import.meta.url),'utf8');
  assert.match(source,/sale_type: 'STOREKEEPER_SHOP'/);
  assert.doesNotMatch(source,/direct_sale_rate/);
});

test('selected shop billing persists Tray piece rates and bulk whole-unit rates',{
  skip:process.env.AVS_SHOP_RATE_DB_TEST!=='1'
},async t=>{
  const client=await pool.connect(),originalConnect=pool.connect;
  t.after(async()=>{pool.connect=originalConnect;client.release();await pool.end();});
  for(const table of ['products','shops','sales','sale_items','inventory_movements','audit_logs']){
    await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`);
    await client.query(`CREATE TEMP SEQUENCE shop_rate_${table}_ids START WITH 900001`);
    await client.query(`ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT nextval('pg_temp.shop_rate_${table}_ids')`);
  }
  await client.query("INSERT INTO shops(id,company_id,code,name,current_due,ledger_ready) VALUES(1,1,'COUNTER','AVS AGENCIES',0,TRUE),(2,1,'SHOP','Selected shop',50,TRUE),(3,2,'OTHER','Other company',0,TRUE)");
  for(const p of products) await client.query('INSERT INTO products(id,company_id,sku,name,display_name,base_unit,selling_unit,pieces_per_unit,piece_selling_price,unit_selling_price,direct_sale_rate,warehouse_stock_units,is_active) VALUES($1,1,$2,$2,$2,$3,$4,$5,$6,$7,$8,10,TRUE)',
    [p.id,p.name,p.base_unit,p.selling_unit,p.pieces_per_unit,p.piece_selling_price,p.unit_selling_price,p.direct_sale_rate]);
  pool.connect=async()=>({query:(...args)=>client.query(...args),release(){}});
  const shopItems=products.map(p=>({product_id:p.id,unit_type:getStoreShopPricing(p).unitType,qty:2,rate:getStoreShopPricing(p).rate}));
  const payload={idempotency_key:randomUUID(),bill_no:'SHOP-'+randomUUID(),sale_type:'STOREKEEPER_SHOP',is_store_direct_sale:true,shop_id:2,employee_id:null,payment_mode:'CASH',cash_paid:2700,items:shopItems};
  const saved=await createSale(1,payload,null);
  assert.equal(saved.sale.shop_id,2);
  assert.equal(saved.sale.employee_id,null);
  assert.equal(Number(saved.sale.total_amount),2700);
  assert.equal(Number(saved.sale.shop_current_due),50);
  const rows=(await client.query('SELECT unit_type,rate,amount FROM sale_items WHERE sale_id=$1 ORDER BY product_id',[saved.sale.id])).rows;
  assert.deepEqual(rows.map(row=>row.unit_type),['Piece','Box','Case','Case']);
  assert.deepEqual(rows.map(row=>Number(row.rate)),[10,800,300,240]);
  assert.deepEqual(rows.map(row=>Number(row.amount)),[20,1600,600,480]);
  const stockAfterShop=(await client.query('SELECT id,warehouse_stock_units FROM products ORDER BY id')).rows;
  assert.equal(Number(stockAfterShop[1].warehouse_stock_units),8);
  assert.equal(Number(stockAfterShop[2].warehouse_stock_units),8);
  assert.equal(Number(stockAfterShop[3].warehouse_stock_units),8);
  assert.ok(Math.abs(Number(stockAfterShop[0].warehouse_stock_units)-(10-2/72))<0.00000001);
  assert.equal((await createSale(1,payload,null)).isDuplicate,true);
  const directItems=products.map(p=>({product_id:p.id,unit_type:getStoreDirectPricing(p).unitType,qty:1,rate:getStoreDirectPricing(p).rate}));
  const direct=await createSale(1,{idempotency_key:randomUUID(),bill_no:'DIRECT-'+randomUUID(),is_store_direct_sale:true,sale_type:'STOREKEEPER_DIRECT',employee_id:null,payment_mode:'CASH',cash_paid:287,items:directItems},null);
  assert.equal(direct.sale.shop_id,1);
  assert.equal(Number(direct.sale.total_amount),287);
  const credit=await createSale(1,{...payload,idempotency_key:randomUUID(),bill_no:'CREDIT-'+randomUUID(),payment_mode:'CREDIT',cash_paid:0,items:[{product_id:1,unit_type:'Piece',qty:1,rate:10}]},null);
  assert.equal(Number(credit.sale.shop_current_due),60);
  const collected=await createSale(1,{...payload,idempotency_key:randomUUID(),bill_no:'DUE-'+randomUUID(),payment_mode:'GPAY',cash_paid:0,gpay_paid:70,old_credit_paid:60,items:[{product_id:1,unit_type:'Piece',qty:1,rate:10}]},null);
  assert.equal(Number(collected.sale.total_amount),10);
  assert.equal(Number(collected.sale.shop_current_due),0);
  const before=(await client.query('SELECT id,warehouse_stock_units FROM products ORDER BY id')).rows;
  await assert.rejects(createSale(1,{...payload,idempotency_key:randomUUID(),bill_no:'INVALID-'+randomUUID(),items:[{product_id:1,unit_type:'Piece',qty:1,rate:12}]},null),/Price changed/);
  await assert.rejects(createSale(1,{...payload,idempotency_key:randomUUID(),shop_id:3},null),/Selected shop not found/);
  await assert.rejects(createSale(1,{...payload,idempotency_key:randomUUID(),shop_id:null},null),/Shop selection is required/);
  await assert.rejects(createSale(1,{...payload,idempotency_key:randomUUID(),items:[{product_id:4,unit_type:'Piece',qty:1,rate:240}]},null),/Shop billing unit changed/);
  assert.deepEqual((await client.query('SELECT id,warehouse_stock_units FROM products ORDER BY id')).rows,before);
  assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM sales')).rows[0].n,4);
});
