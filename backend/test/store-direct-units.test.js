import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { getStoreDirectPricing } from '../../frontend/src/utils/storeDirectPricing.js';
import { pool } from '../database/pg_pool.js';
import { createSale } from '../db_pg.js';

const fixtures = [
  {id:1,name:'Milk',base_unit:'Piece',selling_unit:'Tray',pieces_per_unit:72,piece_selling_price:10,unit_selling_price:720,direct_sale_rate:12},
  {id:2,name:'Whole box',base_unit:'Box',selling_unit:'Box',pieces_per_unit:1,piece_selling_price:700,unit_selling_price:700,direct_sale_rate:20},
  {id:3,name:'Whole case',base_unit:'Case',selling_unit:'Case',pieces_per_unit:1,piece_selling_price:500,unit_selling_price:500,direct_sale_rate:15},
  {id:4,name:'Legacy case',base_unit:'Piece',selling_unit:'Case',pieces_per_unit:24,piece_selling_price:10,unit_selling_price:240,direct_sale_rate:8}
];

test('direct POS submits only configured units at the matching server price', () => {
  const expected = [['Piece',12],['Box',20],['Case',15],['Case',240]];
  fixtures.forEach((product,index)=>{
    const info=getStoreDirectPricing(product);
    assert.deepEqual([info.unitType,info.rate],expected[index]);
    assert.ok([product.base_unit,product.selling_unit].includes(info.unitType));
  });
  const fallback=getStoreDirectPricing({...fixtures[0],direct_sale_rate:0});
  assert.equal(fallback.rate,10);
});

test('cart submission and receipt fallback retain item units instead of forcing Piece', async () => {
  const source=await readFile(new URL('../../frontend/src/components/StoreKeeper/StoreDirectBillingModal.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/unit_type:\s*'Piece'/);
  assert.match(source,/unit_type: item\.unit_type/);
  assert.match(source,/unit_type: i\.unit_type/);
});

test('direct bills persist mixed units, exact prices, payments and warehouse deductions', {
  skip:process.env.AVS_DIRECT_POS_DB_TEST !== '1'
}, async (t) => {
  const client=await pool.connect(),originalConnect=pool.connect;
  t.after(async()=>{pool.connect=originalConnect;client.release();await pool.end();});
  for(const table of ['products','shops','sales','sale_items','inventory_movements','audit_logs']) {
    await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`);
    await client.query(`CREATE TEMP SEQUENCE direct_${table}_ids START WITH 900001`);
    await client.query(`ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT nextval('pg_temp.direct_${table}_ids')`);
  }
  await client.query("INSERT INTO shops(id,company_id,code,name,current_due,ledger_ready) VALUES(1,1,'COUNTER','AVS AGENCIES',0,TRUE)");
  for(const product of fixtures) await client.query(
    'INSERT INTO products(id,company_id,sku,name,display_name,base_unit,selling_unit,pieces_per_unit,piece_selling_price,unit_selling_price,direct_sale_rate,warehouse_stock_units,is_active) VALUES($1,1,$2,$2,$2,$3,$4,$5,$6,$7,$8,10,TRUE)',
    [product.id,product.name,product.base_unit,product.selling_unit,product.pieces_per_unit,product.piece_selling_price,product.unit_selling_price,product.direct_sale_rate]);
  pool.connect=async()=>({query:(...args)=>client.query(...args),release(){}});
  const items=fixtures.map(product=>({product_id:product.id,qty:1,unit_type:getStoreDirectPricing(product).unitType,rate:getStoreDirectPricing(product).rate}));
  const total=items.reduce((sum,item)=>sum+item.rate,0);
  for(const mode of ['CASH','GPAY','SPLIT','CREDIT']) {
    const payload={idempotency_key:randomUUID(),bill_no:'TEST-'+randomUUID(),is_store_direct_sale:true,employee_id:null,payment_mode:mode,
      cash_paid:mode==='CASH'?total:mode==='SPLIT'?100:0,gpay_paid:mode==='GPAY'?total:mode==='SPLIT'?total-100:0,credit_paid:mode==='CREDIT'?total:0,items};
    const result=await createSale(1,payload,null);
    assert.equal(result.success,true);
    assert.equal(Number(result.sale.total_amount),total);
    assert.equal(result.sale.employee_id,null);
    assert.equal(Number(result.sale.cash_paid)+Number(result.sale.gpay_paid)+Number(result.sale.credit_paid),total);
    const persisted=(await client.query('SELECT product_id,unit_type,rate,stock_qty_units FROM sale_items WHERE sale_id=$1 ORDER BY product_id',[result.sale.id])).rows;
    assert.deepEqual(persisted.map(row=>row.unit_type),['Piece','Box','Case','Case']);
    assert.deepEqual(persisted.map(row=>Number(row.rate)),[12,20,15,240]);
    assert.ok(Math.abs(Number(persisted[0].stock_qty_units)-1/72)<0.00000001);
    assert.equal(Number(persisted[1].stock_qty_units),1);
    const replay=await createSale(1,payload,null);
    assert.equal(replay.isDuplicate,true);
    assert.equal(replay.sale.id,result.sale.id);
  }
  assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM sales')).rows[0].n,4);
  assert.equal(Number((await client.query('SELECT warehouse_stock_units FROM products WHERE id=2')).rows[0].warehouse_stock_units),6);
  const before=(await client.query('SELECT id,warehouse_stock_units FROM products ORDER BY id')).rows;
  await assert.rejects(createSale(1,{idempotency_key:randomUUID(),is_store_direct_sale:true,payment_mode:'CASH',items:[{product_id:2,qty:1,unit_type:'Piece',rate:20}]},null),/Invalid sales unit/);
  await assert.rejects(createSale(1,{idempotency_key:randomUUID(),is_store_direct_sale:true,payment_mode:'CASH',items:[{product_id:2,qty:1,unit_type:'Box',rate:999}]},null),/Price changed/);
  assert.deepEqual((await client.query('SELECT id,warehouse_stock_units FROM products ORDER BY id')).rows,before);
});
