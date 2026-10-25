import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pool } from '../database/pg_pool.js';
import { deleteProduct, getProducts, toggleProductStatus, updateProduct, updateProductPrice, configureProductUom } from '../db_pg.js';

// Fixtures are session-local temporary tables. No real product/history rows change.
test('delete removes products from refreshed lists and preserves old bookings', {
  skip: process.env.AVS_PRODUCT_DELETE_DB_TEST !== '1'
}, async (t) => {
  const client = await pool.connect();
  const originalConnect = pool.connect;
  t.after(async () => { pool.connect = originalConnect; client.release(); await pool.end(); });
  for (const table of ['products', 'categories', 'product_uoms', 'sale_items', 'employee_stock', 'stock_transactions']) {
    await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS)`);
  }
  const migration = await readFile(new URL('../database/migrations/009_product_deletion.sql', import.meta.url), 'utf8');
  await client.query(migration);
  await client.query(migration);
  pool.connect = async () => ({ query: (...args) => client.query(...args), release() {} });
  await client.query(`INSERT INTO products(id,company_id,name,display_name,warehouse_stock_units,is_active)
    VALUES (9001,1,'Booked milk','Booked milk',12,TRUE),
           (9002,1,'Inactive milk','Inactive milk',0,FALSE),
           (9003,1,'Active milk','Active milk',0,TRUE),
           (9004,2,'Other company','Other company',0,TRUE)`);
  await client.query("INSERT INTO sale_items(id,sale_id,product_id,product_name,qty,rate,amount) VALUES(9001,9001,9001,'Booked milk',2,30,60)");
  await client.query('INSERT INTO employee_stock(id,company_id,employee_id,product_id,qty_units) VALUES(9001,1,9001,9001,4)');
  await client.query("INSERT INTO stock_transactions(id,company_id,session_id,employee_id,product_id,unit,transaction_type,qty_units) VALUES(9001,1,9001,9001,9001,'Tray','ALLOCATION',4)");
  const historySql = 'SELECT si.*,p.display_name,p.pieces_per_unit,p.warehouse_stock_units FROM sale_items si JOIN products p ON p.id=si.product_id';
  const before = (await client.query(historySql)).rows;
  const stockBefore = (await client.query('SELECT * FROM employee_stock')).rows;
  const ledgerBefore = (await client.query('SELECT * FROM stock_transactions')).rows;

  await t.test('existing history and stock do not block delete', async () => {
    assert.equal((await deleteProduct(1, 9001)).success, true);
    const product = (await client.query('SELECT * FROM products WHERE id=9001')).rows[0];
    assert.ok(product.deleted_at);
    assert.equal(product.is_active, false);
    assert.equal(Number(product.warehouse_stock_units), 12);
  });
  await t.test('all, active, inactive and search refreshes exclude deleted products', async () => {
    for (const filter of [{}, { active: true }, { active: false }, { search: 'Booked' }]) {
      const products = await getProducts(1, filter);
      assert.equal(products.some(p => p.id === 9001), false);
      assert.equal(products.some(p => p.company_id !== 1), false);
    }
    assert.deepEqual((await getProducts(1, { active: false })).map(p => p.id), [9002]);
    assert.deepEqual((await getProducts(1, { active: true })).map(p => p.id), [9003]);
  });
  await t.test('old booking joins, amounts, units and stock history are unchanged', async () => {
    assert.deepEqual((await client.query(historySql)).rows, before);
    assert.deepEqual((await client.query('SELECT * FROM employee_stock')).rows, stockBefore);
    assert.deepEqual((await client.query('SELECT * FROM stock_transactions')).rows, ledgerBefore);
  });
  await t.test('repeat delete succeeds and preserves original deletion time', async () => {
    const timestamp = (await client.query('SELECT deleted_at FROM products WHERE id=9001')).rows;
    assert.equal((await deleteProduct(1, 9001)).success, true);
    assert.deepEqual((await client.query('SELECT deleted_at FROM products WHERE id=9001')).rows, timestamp);
  });
  await t.test('missing and cross-company rows cannot be deleted', async () => {
    await assert.rejects(deleteProduct(1, 9004), /not found/);
    await assert.rejects(deleteProduct(1, -1), /not found/);
    assert.equal((await client.query('SELECT deleted_at FROM products WHERE id=9004')).rows[0].deleted_at, null);
  });
  await t.test('deleted products cannot be reactivated or edited by stale clients', async () => {
    await assert.rejects(toggleProductStatus(1, 9001, true), /not found/);
    await assert.rejects(updateProduct(1, 9001, { name: 'Changed' }), /not found/);
    await assert.rejects(updateProductPrice(1, 9001, {}, 1), /not found/);
    await assert.rejects(configureProductUom(1, 9001, { uom: 'Piece' }), /not found/);
    await assert.rejects(client.query('UPDATE products SET is_active=TRUE WHERE id=9001'), e => e.code === '23514');
  });
  await t.test('other products still support active/inactive toggle', async () => {
    assert.equal((await toggleProductStatus(1, 9002, true)).product.is_active, true);
    assert.equal((await toggleProductStatus(1, 9002, false)).product.is_active, false);
  });
});
