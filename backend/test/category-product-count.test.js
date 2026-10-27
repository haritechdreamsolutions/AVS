import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../database/pg_pool.js';
import { getCategories, deleteCategory, deleteProduct, toggleCategoryStatus, addProduct } from '../db_pg.js';
import { isCategoryActive } from '../../frontend/src/utils/categoryStatus.js';

test('category status handles API booleans and legacy numeric forms consistently', () => {
  for (const value of [false,0,'0','false']) assert.equal(isCategoryActive(value),false);
  for (const value of [true,1,'1','true',undefined]) assert.equal(isCategoryActive(value),true);
});

test('category counts and deletion use only products remaining in the catalogue', {
  skip: process.env.AVS_CATEGORY_COUNT_DB_TEST !== '1'
}, async (t) => {
  const client = await pool.connect(), originalConnect = pool.connect;
  t.after(async () => { pool.connect = originalConnect; client.release(); await pool.end(); });
  await client.query('CREATE TEMP TABLE categories (LIKE public.categories INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)');
  await client.query(`CREATE TEMP TABLE products (
    id INTEGER PRIMARY KEY,company_id INTEGER,category_id INTEGER REFERENCES pg_temp.categories(id) ON DELETE SET NULL,
    name TEXT,is_active BOOLEAN DEFAULT TRUE,deleted_at TIMESTAMPTZ,updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`INSERT INTO categories(id,company_id,code,name) VALUES
    (9001,1,'DELETED','Deleted products only'),(9002,1,'MIXED','Mixed products'),
    (9003,1,'EMPTY','Empty category'),(9004,2,'OTHER','Other company')`);
  await client.query(`INSERT INTO products(id,company_id,category_id,name,is_active,deleted_at) VALUES
    (1,1,9001,'Historical product',FALSE,NOW()),(2,1,9002,'Active product',TRUE,NULL),
    (3,1,9002,'Inactive product',FALSE,NULL),(4,1,9002,'Deleted product',FALSE,NOW()),
    (5,2,9002,'Other company product',TRUE,NULL)`);
  pool.connect = async () => ({ query: (...args) => client.query(...args), release() {} });

  await t.test('deleted products do not inflate counts; listed inactive products still count', async () => {
    const categories = await getCategories(1);
    assert.equal(categories.find(c => c.id === 9001).product_count,0);
    assert.equal(categories.find(c => c.id === 9002).product_count,2);
    assert.equal(categories.find(c => c.id === 9003).product_count,0);
    assert.equal(categories.some(c => c.id === 9004),false);
  });
  await t.test('listed products still prevent category deletion', async () => {
    await assert.rejects(deleteCategory(1,9002),/2 product\(s\)/);
    assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM categories WHERE id=9002')).rows[0].n,1);
  });
  await t.test('inactive status survives refresh and is excluded from new product choices', async () => {
    const changed = await toggleCategoryStatus(1,9002,false);
    assert.equal(changed.category.is_active,false);
    assert.equal((await getCategories(1)).find(c => c.id === 9002).is_active,false);
    assert.equal((await getCategories(1,true)).some(c => c.id === 9002),false);
    await assert.rejects(addProduct(1,{name:'Rejected product',category_id:9002}),/inactive or unavailable/);
    await assert.rejects(addProduct(1,{name:'Rejected product',category:'Mixed products'}),/inactive or unavailable/);
    const reactivated = await toggleCategoryStatus(1,9002,true);
    assert.equal(reactivated.category.is_active,true);
    assert.equal((await getCategories(1,true)).some(c => c.id === 9002),true);
    assert.equal((await getCategories(1)).find(c => c.id === 9002).product_count,2);
  });
  await t.test('zero-count categories can be removed without deleting archived products', async () => {
    assert.equal((await deleteCategory(1,9001)).success,true);
    const historical = (await client.query('SELECT * FROM products WHERE id=1')).rows[0];
    assert.equal(historical.name,'Historical product');
    assert.ok(historical.deleted_at);
    assert.equal(historical.category_id,null);
    assert.equal((await deleteCategory(1,9003)).success,true);
  });
  await t.test('deleting the remaining products updates the count to zero', async () => {
    await deleteProduct(1,2);
    assert.equal((await getCategories(1)).find(c => c.id === 9002).product_count,1);
    await deleteProduct(1,3);
    assert.equal((await getCategories(1)).find(c => c.id === 9002).product_count,0);
  });
  await t.test('cross-company category removal stays forbidden', async () => {
    await assert.rejects(deleteCategory(1,9004),/not found/);
  });
});
