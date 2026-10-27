import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProductCategory, applyProductSellingUnit } from '../../frontend/src/utils/productPackaging.js';
import { getOperationalUnit as frontendUnit } from '../../frontend/src/utils/unitHelper.js';
import { getOperationalUnit as backendUnit } from '../unitHelper.js';
import { driverUnitPrice } from '../../frontend/src/utils/driverPricing.js';
import { pool } from '../database/pg_pool.js';
import { addProduct } from '../db_pg.js';

const trayForm = {base_unit:'Piece',selling_unit:'Tray',buy_rate_uom:'Tray',selling_rate_uom:'Tray',pieces_per_unit:72,unit_selling_price:720,piece_selling_price:10};

for (const unit of ['Box','Case']) {
  test(`${unit} selection and default selection use whole-package sales and prices`, () => {
    for (const operational_unit of [unit,'Piece']) {
      const category = {id:1,name:unit,operational_unit};
      const form = applyProductCategory(trayForm,category);
      for (const field of ['base_unit','selling_unit','buy_rate_uom','selling_rate_uom']) assert.equal(form[field],unit);
      assert.equal(form.pieces_per_unit,1);
      assert.equal(form.piece_selling_price,720);
      for (const helper of [frontendUnit,backendUnit]) {
        const operational = helper(form,category);
        assert.equal(operational.operationalUnit,unit);
        assert.equal(operational.isPieceBased,false);
        assert.equal(operational.piecesPerPackagingUnit,1);
        assert.equal(driverUnitPrice(form,operational.operationalUnit) * 2,1440);
      }
      const reset = applyProductCategory({...trayForm,name:''},category);
      assert.equal(reset.selling_unit,unit);
      assert.equal(reset.pieces_per_unit,1);
    }
    const manual = applyProductSellingUnit(trayForm,unit);
    assert.equal(manual.base_unit,unit);
    assert.equal(manual.pieces_per_unit,1);
    assert.equal(manual.piece_selling_price,manual.unit_selling_price);
  });
}

test('switching Box to Tray, Milk and Curd restores piece conversion', () => {
  const box = applyProductSellingUnit(trayForm,'Box');
  for (const [name,ratio] of [['Tray',72],['Milk',72],['Curd',30]]) {
    const category = {id:2,name,operational_unit:'Piece'};
    const form = applyProductCategory(box,category);
    assert.equal(form.selling_unit,'Tray');
    assert.equal(form.base_unit,'Piece');
    assert.equal(form.pieces_per_unit,ratio);
    assert.equal(form.piece_selling_price,720/ratio);
    assert.equal(frontendUnit(form,category).isPieceBased,true);
    assert.equal(backendUnit(form,category).isPieceBased,true);
  }
  assert.equal(applyProductSellingUnit(box,'Tray').pieces_per_unit,72);
  assert.equal(applyProductCategory(trayForm,{id:3,name:'Tray',operational_unit:'Piece'}).pieces_per_unit,72);
});

test('new Box, Case and Tray products persist matching units and UOM rates', {
  skip: process.env.AVS_PACKAGING_DB_TEST !== '1'
}, async (t) => {
  const client = await pool.connect(), originalConnect = pool.connect;
  t.after(async () => { pool.connect = originalConnect; client.release(); await pool.end(); });
  for (const table of ['categories','products','product_uoms']) {
    await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`);
    await client.query(`CREATE TEMP SEQUENCE packaging_${table}_ids START WITH 900001`);
    await client.query(`ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT nextval('pg_temp.packaging_${table}_ids')`);
  }
  await client.query(`INSERT INTO categories(id,company_id,code,name,operational_unit) VALUES
    (1,1,'BOX','Box','Box'),(2,1,'CASE','Case','Case'),(3,1,'TRAY','Tray','Piece')`);
  pool.connect = async () => ({ query: (...args) => client.query(...args), release() {} });
  for (const [id,unit] of [[1,'Box'],[2,'Case'],[3,'Tray']]) {
    const category = {id,name:unit,operational_unit:unit === 'Tray' ? 'Piece' : unit};
    const form = applyProductCategory({...trayForm,name:`Synthetic ${unit}`,purchase_price:600},category);
    const { product } = await addProduct(1,form);
    assert.equal(product.selling_unit,unit);
    assert.equal(Number(product.pieces_per_unit),unit === 'Tray' ? 72 : 1);
    assert.equal(product.base_unit,unit === 'Tray' ? 'Piece' : unit);
    assert.equal(product.buy_rate_uom,unit);
    assert.equal(product.selling_rate_uom,unit);
    const uoms = (await client.query('SELECT * FROM product_uoms WHERE product_id=$1',[product.id])).rows;
    const base = uoms.find(row => row.is_base_uom);
    assert.equal(Number(base.selling_rate),unit === 'Tray' ? 10 : 720);
    assert.equal(backendUnit(product,category).operationalUnit,unit === 'Tray' ? 'Piece' : unit);
  }
});
