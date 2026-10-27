import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../database/pg_pool.js';
import { addShop } from '../db_pg.js';

test('shop creation saves ledger fields without changing existing shops', {
  skip: process.env.AVS_SHOP_CREATE_DB_TEST !== '1'
}, async (t) => {
  const client = await pool.connect(), originalConnect = pool.connect;
  t.after(async () => { pool.connect = originalConnect; client.release(); await pool.end(); });
  await client.query('CREATE TEMP TABLE shops (LIKE public.shops INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)');
  await client.query('CREATE TEMP SEQUENCE shop_creation_test_ids START WITH 900001');
  await client.query("ALTER TABLE shops ALTER COLUMN id SET DEFAULT nextval('pg_temp.shop_creation_test_ids')");
  await client.query('CREATE TEMP TABLE routes(id INTEGER PRIMARY KEY,name TEXT,code TEXT)');
  await client.query('CREATE TEMP TABLE villages(id INTEGER PRIMARY KEY,company_id INTEGER,name TEXT,code TEXT,route_id INTEGER,status TEXT)');
  await client.query("INSERT INTO routes VALUES(1,'Synthetic route','R1')");
  await client.query("INSERT INTO villages VALUES(1,1,'Synthetic village','V1',1,'ACTIVE'),(2,2,'Other company','V2',1,'ACTIVE'),(3,1,'Inactive village','V3',1,'INACTIVE')");
  pool.connect = async () => ({ query: (...args) => client.query(...args), release() {} });
  const existing = (await addShop(1,{name:'Existing shop',village_id:1,opening_balance:125})).shop;
  const before = (await client.query('SELECT * FROM shops WHERE id=$1',[existing.id])).rows;

  await t.test('modal payload creates a shop with automatic code, owner name and derived route', async () => {
    const result = await addShop(1,{name:'New shop',owner_name:'Test Owner',phone:'9876543210',village_id:1,distance_km:3,has_freezer:false});
    assert.equal(result.success,true);
    assert.match(result.shop.code,/^SHOP-\d{4,}$/);
    assert.notEqual(result.shop.code,existing.code);
    assert.equal(result.shop.owner_name,'Test Owner');
    assert.equal(result.shop.route_id,1);
    assert.equal(result.shop.village_name,'Synthetic village');
    assert.equal(result.shop.ledger_ready,true);
    assert.equal(Number(result.shop.opening_due_remaining),0);
    assert.equal(Number(result.shop.current_due),0);
    assert.equal(result.shop.freezer_model,null);
  });
  await t.test('freezer and opening balance are saved consistently', async () => {
    const {shop} = await addShop(1,{name:'Freezer shop',village_id:1,has_freezer:true,freezer_model:'Test freezer',opening_balance:250.50});
    assert.equal(shop.has_freezer,true);
    assert.equal(shop.freezer_model,'Test freezer');
    for(const column of ['opening_balance','opening_due_remaining','current_due']) assert.equal(Number(shop[column]),250.50);
  });
  await t.test('invalid, inactive and cross-company villages leave no partial shops', async () => {
    const count = (await client.query('SELECT COUNT(*)::int AS n FROM shops')).rows[0].n;
    for(const village_id of [2,3,999]) await assert.rejects(addShop(1,{name:'Rejected',village_id}),/does not exist or is inactive/);
    assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM shops')).rows[0].n,count);
  });
  await t.test('existing shop details and balances remain unchanged', async () => {
    assert.deepEqual((await client.query('SELECT * FROM shops WHERE id=$1',[existing.id])).rows,before);
  });
});
