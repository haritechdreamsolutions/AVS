import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID}from'node:crypto';
if(!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL||''))throw Error('Isolated test database required');
process.env.DATABASE_URL=process.env.AVS_TEST_DATABASE_URL;
const {pool}=await import('../database/pg_pool.js');const{migrate}=await import('../database/migrate.js');await migrate();
const catalog=await import('../supplier-catalog.js'),db=await import('../db_pg.js');
const cid=(await pool.query("INSERT INTO companies(name) VALUES('Synthetic existing catalogue') RETURNING id")).rows[0].id;
const actor=(await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash) VALUES($1,(SELECT id FROM roles WHERE role_name='OWNER'),$2,'Owner','unusable') RETURNING id",[cid,randomUUID()])).rows[0].id;
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6ioAAAAASUVORK5CYII=';
const createMaster=async(name,unit,ppu,rate)=>(await pool.query('INSERT INTO products(company_id,name,display_name,sku,selling_unit,base_unit,pieces_per_unit,purchase_price,image_url) VALUES($1,$2,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[cid,name,randomUUID(),unit,unit==='Tray'?'Piece':unit,ppu,rate,image])).rows[0];
const milk=await createMaster('Master Milk','Tray',12,120),box=await createMaster('Milk Box','Box',1,250),spare=await createMaster('Unassigned','Case',1,90);
let a,b;
const stock=async id=>Number((await pool.query('SELECT warehouse_stock_units FROM products WHERE id=$1',[id])).rows[0].warehouse_stock_units);
const activate=(supplier,p,rate,piece)=>catalog.saveCompanyProduct(cid,supplier,null,{existing_product_id:p.id,buy_rates:{tray_rate:rate,...(piece===undefined?{}:{piece_rate:piece})}},actor);
const receive=()=>({supplier_id:a.id,items:[{product_id:milk.id,quantity:14/12,total_pieces:14,inward_trays:1,inward_pieces:2,unit:'Tray',rate:120,piece_rate:11,total_amount:142}],idempotency_key:randomUUID()});
try{
 await test('new company starts with no active products and creates no new masters',async()=>{
  a=(await catalog.saveCompany(cid,null,{name:'Company A',contact_person:'Manager A',phone:'123'},actor)).supplier;b=(await catalog.saveCompany(cid,null,{name:'Company B',contact_person:'Manager B',phone:'456'},actor)).supplier;
  assert.equal((await catalog.companyProducts(cid,a.id)).products.length,0);
  await assert.rejects(catalog.saveCompanyProduct(cid,a.id,null,{name:'Unexpected new product',buy_rates:{tray_rate:10}},actor),/existing product/);
  assert.equal((await pool.query('SELECT count(*)::int n FROM products WHERE company_id=$1',[cid])).rows[0].n,3);
 });
 await test('activate only existing products; separate company catalogues and rates',async()=>{
  await activate(a.id,milk,120,11);await activate(b.id,box,250);
  assert.deepEqual((await catalog.companyProducts(cid,a.id)).products.map(p=>p.id),[milk.id]);assert.deepEqual((await catalog.companyProducts(cid,b.id)).products.map(p=>p.id),[box.id]);
  assert.equal((await catalog.companyProducts(cid,a.id)).products[0].image_url,image);
  assert.equal((await pool.query('SELECT count(*)::int n FROM products WHERE company_id=$1',[cid])).rows[0].n,3);
 });
 await test('company activation cannot rename or replace the master product image/packaging/selling price',async()=>{
  await catalog.saveCompanyProduct(cid,a.id,milk.id,{name:'Changed',image_url:null,pieces_per_unit:72,selling_price:999,buy_rates:{tray_rate:120,piece_rate:11}},actor);
  const p=(await pool.query('SELECT * FROM products WHERE id=$1',[milk.id])).rows[0];assert.equal(p.name,'Master Milk');assert.equal(p.image_url,image);assert.equal(p.pieces_per_unit,12);assert.equal(Number(p.unit_selling_price),0);
 });
 await test('unauthorized/inactive products, invalid rates and wrong company are blocked',async()=>{
  await assert.rejects(catalog.companyProducts(cid+9999,a.id),/not found/);
  await assert.rejects(catalog.saveCompanyProduct(cid+9999,a.id,null,{existing_product_id:milk.id,buy_rates:{tray_rate:1}},actor),/not found/);
  await assert.rejects(activate(a.id,spare,-1),/nonnegative/);
  await pool.query('UPDATE products SET is_active=FALSE WHERE id=$1',[spare.id]);await assert.rejects(activate(a.id,spare,90),/inactive/);
 });
 await test('receipt retries update stock once and use exact owner tray/piece rates',async()=>{
  const payload=receive();const results=await Promise.all(Array.from({length:6},()=>db.receiveStock(cid,payload,actor)));assert.equal(new Set(results.map(r=>r.results[0].movement.id)).size,1);assert.equal(Math.round(await stock(milk.id)*12),14);assert.equal(Number(results[0].results[0].movement.total_amount),142);
  await assert.rejects(db.receiveStock(cid,{...receive(),supplier_id:b.id},actor),/not assigned/);
 });
 await test('company/product/date filters show recorded receipt quantities and amounts',async()=>{
  const result=await db.getSupplierInwardStockReport(cid,{supplier_id:a.id,product_id:milk.id});assert.equal(result.records.length,1);assert.equal(result.summary.total_valuation,142);assert.equal(Math.round(Number(result.records[0].qty_units)*12),14);assert.equal(Number(result.records[0].rate),120);
  assert.equal((await db.getSupplierInwardStockReport(cid,{supplier_id:b.id})).records.length,0);assert.equal((await db.getSupplierInwardStockReport(cid,{start_date:'2000-01-01',end_date:'2000-01-02'})).records.length,0);
 });
 await test('deactivation hides product from receiving while keeping stock and purchase history',async()=>{
  const before=await stock(milk.id);await catalog.removeCompanyProduct(cid,a.id,milk.id,actor);assert.equal((await catalog.companyProducts(cid,a.id)).products.length,0);assert.equal(await stock(milk.id),before);await assert.rejects(db.receiveStock(cid,receive(),actor),/not assigned/);
  assert.equal((await db.getSupplierInwardStockReport(cid,{supplier_id:a.id})).summary.total_valuation,142);assert.equal((await catalog.purchaseReportProducts(cid,a.id)).length,0);assert.deepEqual((await catalog.purchaseReportProducts(cid,b.id)).map(p=>p.id),[box.id]);
  await activate(a.id,milk,150,12.5);assert.equal((await db.getSupplierInwardStockReport(cid,{supplier_id:a.id})).summary.total_valuation,142);
 });
 await test('legacy high precision rates cannot block toggles, rate edits or receiving',async()=>{
  const legacy=(await catalog.saveCompany(cid,null,{name:'Legacy import',contact_person:'Manager',phone:'123'},actor)).supplier;
  const imported={[milk.id]:{tray_rate:120.00000000000001,piece_rate:10.000000000000002,is_active:true},[box.id]:{tray_rate:'250.0000',is_active:true},[spare.id]:{tray_rate:'invalid legacy row',is_active:false}};
  await pool.query('UPDATE suppliers SET product_rates=$1::jsonb WHERE id=$2',[JSON.stringify(imported),legacy.id]);
  const before=await stock(milk.id);
  assert.equal((await catalog.companyProducts(cid,legacy.id)).products.find(p=>p.id===milk.id).buy_rates.piece_rate,10);
  await catalog.removeCompanyProduct(cid,legacy.id,milk.id,actor);
  assert.ok(!(await catalog.companyProducts(cid,legacy.id)).products.some(p=>p.id===milk.id));
  const reactivated=await catalog.activateCompanyProduct(cid,legacy.id,milk.id,actor);
  assert.equal(reactivated.supplier.product_rates[milk.id].piece_rate,10);
  assert.deepEqual(reactivated.supplier.product_rates[spare.id],imported[spare.id]);
  await catalog.saveCompanyProduct(cid,legacy.id,milk.id,{buy_rates:{tray_rate:120,piece_rate:10}},actor);
  await assert.rejects(catalog.saveCompanyProduct(cid,legacy.id,milk.id,{buy_rates:{tray_rate:'120.001',piece_rate:10}},actor),/two decimal/);
  await db.receiveStock(cid,{supplier_id:legacy.id,items:[{product_id:milk.id,quantity:14/12,total_pieces:14,inward_trays:1,inward_pieces:2,unit:'Tray',rate:120,piece_rate:10,total_amount:140}],idempotency_key:randomUUID()},actor);
  assert.equal(Math.round(((await stock(milk.id))-before)*12),14);
  await assert.rejects(catalog.activateCompanyProduct(cid+9999,legacy.id,milk.id,actor),/not found/);
 });
 await test('globally inactive products and deleted companies cannot receive; reports remain',async()=>{
  await pool.query('UPDATE products SET is_active=FALSE WHERE id=$1',[milk.id]);assert.equal((await catalog.companyProducts(cid,a.id)).products.length,0);assert.equal((await catalog.purchaseReportProducts(cid,a.id)).length,0);await assert.rejects(db.receiveStock(cid,receive(),actor),/inactive/);
  await catalog.removeCompany(cid,a.id,actor);await catalog.removeCompany(cid,a.id,actor);assert.equal((await db.getSupplierInwardStockReport(cid,{supplier_id:a.id})).summary.total_valuation,142);
 });
 await test('active brand report shows only selected brand receipts within the chosen business date',async()=>{
  const yesterday=await db.receiveStock(cid,{supplier_id:b.id,items:[{product_id:box.id,quantity:2,unit:'Box',rate:250,total_amount:500}],idempotency_key:randomUUID()},actor);
  await pool.query("UPDATE inventory_movements SET created_at=(CURRENT_DATE-1)+TIME '12:00' WHERE id=$1",[yesterday.results[0].movement.id]);
  await db.receiveStock(cid,{supplier_id:b.id,items:[{product_id:box.id,quantity:1,unit:'Box',rate:250,total_amount:250}],idempotency_key:randomUUID()},actor);
  const c=(await catalog.saveCompany(cid,null,{name:'Another brand',contact_person:'Manager',phone:'789'},actor)).supplier;
  await activate(c.id,box,400);
  await db.receiveStock(cid,{supplier_id:c.id,items:[{product_id:box.id,quantity:1,unit:'Box',rate:400,total_amount:400}],idempotency_key:randomUUID()},actor);
  const date=(await pool.query('SELECT CURRENT_DATE::text date')).rows[0].date;
  const filters={supplier_id:b.id,start_date:date,end_date:date,active_products_only:true};
  let report=await db.getSupplierInwardStockReport(cid,filters);assert.equal(report.records.length,1);assert.equal(report.summary.total_valuation,250);assert.equal(Number(report.records[0].qty_units),1);
  const before=await stock(box.id);await catalog.removeCompanyProduct(cid,b.id,box.id,actor);
  report=await db.getSupplierInwardStockReport(cid,filters);assert.equal(report.records.length,0);assert.equal(await stock(box.id),before);
  assert.equal((await db.getSupplierInwardStockReport(cid,{supplier_id:b.id})).summary.total_valuation,750);
  assert.equal((await db.getSupplierInwardStockReport(cid,{...filters,supplier_id:c.id})).summary.total_valuation,400);
 });
}finally{await pool.end();}
