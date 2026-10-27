import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../database/pg_pool.js';
import { receiveStock } from '../db_pg.js';

test('supplier receipt supports whole Box/Case and exact loose Tray pieces atomically', {
  skip: process.env.AVS_STOCK_RECEIVE_DB_TEST !== '1'
}, async (t) => {
  const client = await pool.connect(), originalConnect = pool.connect;
  t.after(async () => {pool.connect=originalConnect;client.release();await pool.end();});
  for (const table of ['categories','products','inventory_movements','suppliers','audit_logs']) {
    await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`);
    await client.query(`CREATE TEMP SEQUENCE receive_${table}_ids START WITH 900001`);
    await client.query(`ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT nextval('pg_temp.receive_${table}_ids')`);
  }
  await client.query("INSERT INTO categories(id,company_id,code,name,operational_unit) VALUES(1,1,'TRAY','Tray','Piece'),(2,1,'BOX','Box','Box'),(3,1,'CASE','Case','Case')");
  await client.query(`INSERT INTO products(id,company_id,category_id,sku,name,display_name,base_unit,selling_unit,pieces_per_unit,purchase_price,warehouse_stock_units,is_active)
    VALUES(1,1,1,'TRAY','Test milk','Test milk','Piece','Tray',72,720,0,TRUE),
          (2,1,2,'BOX','Test box','Test box','Box','Box',1,600,0,TRUE),
          (3,1,3,'CASE','Test case','Test case','Case','Case',1,500,0,TRUE)`);
  pool.connect=async()=>({query:(...args)=>client.query(...args),release(){}});
  const stock=async id=>Number((await client.query('SELECT warehouse_stock_units FROM products WHERE id=$1',[id])).rows[0].warehouse_stock_units);
  const pieceItem=count=>({product_id:1,quantity:count/72,unit:'Tray',rate:720,total_pieces:count,inward_trays:Math.floor(count/72),inward_pieces:count%72});

  await t.test('mixed receipt saves Tray + loose pieces, Box and Case in one submit', async () => {
    const result=await receiveStock(1,{supplier_name:'Synthetic supplier',items:[pieceItem(73),{product_id:2,quantity:2,unit:'Box',rate:600},{product_id:3,quantity:3,unit:'Case',rate:500}]},null);
    assert.equal(result.success,true);
    assert.equal(Math.round(await stock(1)*72),73);
    assert.equal(await stock(2),2);
    assert.equal(await stock(3),3);
    const rows=(await client.query('SELECT product_id,unit,qty_units,total_amount FROM inventory_movements ORDER BY product_id')).rows;
    assert.deepEqual(rows.map(row=>row.unit),['Tray','Box','Case']);
    assert.equal(Number(rows[1].total_amount),1200);
    assert.equal(Number(rows[2].total_amount),1500);
  });
  await t.test('cached four-decimal payload works only when exact piece totals agree', async () => {
    const item=pieceItem(1);
    item.quantity=Number(item.quantity.toFixed(4));
    assert.equal((await receiveStock(1,{items:[item]},null)).success,true);
    assert.equal(Math.round(await stock(1)*72),74);
    await assert.rejects(receiveStock(1,{items:[{...pieceItem(1),quantity:2}]},null),/does not match/);
    await assert.rejects(receiveStock(1,{items:[{...pieceItem(1),inward_pieces:2}]},null),/counts do not match/);
    await assert.rejects(receiveStock(1,{items:[{...pieceItem(1),total_pieces:1.5}]},null),/whole operational pieces/);
  });
  await t.test('repeated single-piece receipts do not accumulate whole-piece drift', async () => {
    const before=Math.round(await stock(1)*72);
    for(let i=0;i<72;i++) await receiveStock(1,{items:[pieceItem(1)]},null);
    assert.equal(Math.round(await stock(1)*72),before+72);
  });
  await t.test('invalid fractional Box/Case rolls back the entire mixed receipt', async () => {
    const before=await stock(1);
    const count=(await client.query('SELECT COUNT(*)::int AS n FROM inventory_movements')).rows[0].n;
    for(const [id,unit] of [[2,'Box'],[3,'Case']]) {
      await assert.rejects(receiveStock(1,{items:[pieceItem(1),{product_id:id,quantity:1.5,unit}]},null),/whole number/);
      assert.equal(await stock(1),before);
    }
    assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM inventory_movements')).rows[0].n,count);
    await assert.rejects(receiveStock(2,{items:[{product_id:2,quantity:1,unit:'Box'}]},null),/not found/);
    await assert.rejects(receiveStock(1,{items:[{product_id:2,quantity:1,unit:'Tray'}]},null),/configured selling unit/);
  });
});
