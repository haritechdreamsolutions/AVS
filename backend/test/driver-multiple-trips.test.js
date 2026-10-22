import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';
import {chromium,expect} from '@playwright/test';
import {businessDate} from '../financial.js';

if(!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL||'')) throw Error('Explicit isolated test database required');
const base='http://127.0.0.1:55650';
Object.assign(process.env,{DATABASE_URL:process.env.AVS_TEST_DATABASE_URL,NODE_ENV:'test',AVS_NO_LISTEN:'1',SESSION_SECRET:'synthetic-multiple-trips-secret',FRONTEND_URL:base});
const {pool}=await import('../database/pg_pool.js');
const db=await import('../db_pg.js');
const {collectDue,settle}=await import('../payments.js');
const {app}=await import('../index.js');
const server=app.listen(55650,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
let browser;
try {
  const company=(await pool.query("INSERT INTO companies(name) VALUES('Synthetic multiple trips') RETURNING id")).rows[0].id;
  const routes=[],shops=[],products=[];
  for(let index=0;index<2;index++) {
    routes.push((await pool.query('INSERT INTO routes(company_id,name,code) VALUES($1,$2,$3) RETURNING id',[company,'Synthetic trip route '+index,'TRIP'+index])).rows[0].id);
    shops.push((await pool.query('INSERT INTO shops(company_id,name,code,route_id,ledger_ready) VALUES($1,$2,$3,$4,true) RETURNING id',[company,'Synthetic trip shop '+index,'TRIP'+index,routes[index]])).rows[0].id);
    products.push((await pool.query("INSERT INTO products(company_id,name,display_name,base_unit,selling_unit,pieces_per_unit,purchase_price,piece_selling_price,unit_selling_price,warehouse_stock_units) VALUES($1,$2,$2,'Piece','Case',1,2,10,10,100) RETURNING id",[company,'Synthetic trip item '+index])).rows[0].id);
  }
  const employee=(await pool.query("INSERT INTO employees(company_id,employee_code,full_name,route_id) VALUES($1,'TRIPS','Synthetic trip driver',$2) RETURNING id",[company,routes[0]])).rows[0].id;
  const password='Synthetic-trip-password!',login='trips-'+randomUUID(),hash=await bcrypt.hash(password,12);
  const owner=(await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash,credential_kind) VALUES($1,(SELECT id FROM roles WHERE role_name='OWNER'),$2,'Synthetic trip owner',$3,'password') RETURNING id",[company,'owner-'+randomUUID(),hash])).rows[0].id;
  await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash,credential_kind) VALUES($1,(SELECT id FROM roles WHERE role_name='STORE_KEEPER'),$2,'Synthetic trip keeper',$3,'password')",[company,login,hash]);
  const driver=(await pool.query("INSERT INTO user_accounts(company_id,employee_id,role_id,login_id,name,pin_hash,credential_kind) VALUES($1,$2,(SELECT id FROM roles WHERE role_name='DRIVER'),$3,'Synthetic trip driver',$4,'pin') RETURNING id",[company,employee,'driver-'+randomUUID(),await bcrypt.hash('482916',12)])).rows[0].id;
  const actor={id:driver,employee_id:employee,role:'DRIVER'};
  const allocation=(items,key=randomUUID())=>db.issueStockToEmployee(company,{employee_id:employee,items:items.map(([product_id,quantity])=>({product_id,quantity,unit:'Case'})),idempotency_key:key},owner);
  const sale=(shop,product,qty,mode,extra={})=>db.createEmployeeSale(company,employee,'Synthetic trip driver',{shop_id:shop,payment_mode:mode,items:[{product_id:product,qty,unit_type:'Case',rate:10}],idempotency_key:randomUUID(),...extra},driver);
  const snapshot=async sessionId=>JSON.stringify({
    session:(await pool.query('SELECT * FROM driver_sessions WHERE id=$1',[sessionId])).rows,
    returns:(await pool.query('SELECT * FROM driver_returns WHERE session_id=$1 ORDER BY id',[sessionId])).rows,
    expenses:(await pool.query('SELECT * FROM expenses WHERE session_id=$1 ORDER BY id',[sessionId])).rows,
    damages:(await pool.query('SELECT * FROM damages WHERE session_id=$1 ORDER BY id',[sessionId])).rows,
    stock:(await pool.query('SELECT * FROM stock_transactions WHERE session_id=$1 ORDER BY id',[sessionId])).rows
  });

  const first=(await allocation([[products[0],20]])).session;
  await sale(shops[0],products[0],5,'SPLIT',{cash_paid:30,gpay_paid:10,credit_paid:10});
  await collectDue(company,shops[0],{amount:4,payment_mode:'CASH',idempotency_key:randomUUID()},actor);
  const expense=(await db.addExpense(company,{employee_id:employee,session_id:first.id,category:'Fuel',amount:8,notes:'First-trip-only expense'},owner)).expense;
  const damage=(await db.processDamage(company,{employee_id:employee,session_id:first.id,product_id:products[0],quantity:1,unit:'Case'},owner)).damage;
  const firstData=await db.getDriverExpectedReturn(company,employee);
  assert.equal(firstData.products[0].expected_return,14);
  assert.equal(firstData.total_expenses,8);
  assert.equal(firstData.sales_summary.cash_collected,34);
  const firstReturn=await db.verifyAndAcceptDriverReturn(company,employee,{session_id:first.id,items:[{product_id:products[0],unit:'Case',actual_quantity:14}]},owner);
  assert.equal(firstReturn.summary.total_sales,50);
  assert.equal(firstReturn.summary.total_expenses,8);
  assert.equal((await pool.query('SELECT session_date::text AS date FROM driver_sessions WHERE id=$1',[first.id])).rows[0].date,businessDate());
  const historical=await snapshot(first.id);
  const cleared=await db.getDriverExpectedReturn(company,employee);
  assert.equal(cleared.session.status,'AWAITING_ALLOCATION');
  assert.deepEqual(cleared.expenses,[]);
  assert.deepEqual(cleared.products,[]);
  assert.equal(cleared.sales_summary.total_sales,0);
  assert.equal(cleared.sales_summary.cash_collected,0);
  await assert.rejects(db.addExpense(company,{employee_id:employee,category:'Fuel',amount:1},owner),/locked/);

  await db.assignRoute(company,routes[1],employee,null,businessDate());
  const key=randomUUID();
  const allocations=await Promise.all(Array.from({length:5},()=>allocation([[products[0],10],[products[1],6]],key)));
  const second=allocations[0].session;
  assert.notEqual(second.id,first.id);
  assert.ok(new Date(second.opened_at)>=new Date(JSON.parse(historical).session[0].closed_at));
  assert.equal(second.route_id,routes[1]);
  assert.equal(new Set(allocations.map(result=>result.session.id)).size,1);
  const fresh=await db.getDriverExpectedReturn(company,employee);
  assert.equal(fresh.session.id,second.id);
  assert.equal(fresh.total_expenses,0);
  assert.deepEqual(fresh.expenses,[]);
  assert.equal(fresh.sales_summary.total_sales,0);
  assert.equal(fresh.sales_summary.cash_collected,0);
  assert.deepEqual(fresh.products.map(product=>product.sold),[0,0]);
  await assert.rejects(db.updateExpense(company,expense.id,{amount:99},owner),/finalized/);
  await assert.rejects(db.deleteExpense(company,expense.id,owner),/finalized/);
  await assert.rejects(db.updateDamage(company,damage.id,{quantity:2},owner),/finalized/);
  await assert.rejects(db.deleteDamage(company,damage.id,owner),/finalized/);
  await assert.rejects(db.addExpense(company,{employee_id:employee,session_id:first.id,category:'Fuel',amount:1},owner),/trip changed/);
  await sale(shops[1],products[0],2,'CASH');
  await sale(shops[1],products[1],1,'CREDIT');
  await collectDue(company,shops[1],{amount:5,payment_mode:'GPAY',idempotency_key:randomUUID()},actor);
  await db.processDamage(company,{employee_id:employee,session_id:second.id,product_id:products[1],quantity:2,unit:'Case'},owner);

  browser=await chromium.launch({headless:true,...(process.env.AVS_TEST_BROWSER==='chromium'?{}:{channel:'msedge'})});
  const page=await browser.newPage();
  page.setDefaultTimeout(20000);
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(base);
  await page.getByPlaceholder('Enter your Login ID (e.g. owner)').fill(login);
  await page.locator('#login-credential').fill(password);
  await page.getByRole('button',{name:'Enter',exact:true}).click();
  await page.getByRole('button',{name:'Stock Return Driver',exact:true}).click();
  const selection=page.locator('select').first();
  await selection.selectOption(String(employee));
  await expect(page.getByText('No expenses recorded for this trip',{exact:true})).toBeVisible();
  await expect(page.getByText('First-trip-only expense',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'+ ADD EXPENSE',exact:true}).click();
  const amounts=page.getByPlaceholder('0.00',{exact:true});
  await expect(amounts).toHaveCount(4);
  for(const input of await amounts.all()) assert.equal(await input.inputValue(),'');
  await amounts.first().fill('3');
  await page.getByRole('button',{name:/Save Expenses/}).click();
  await expect(amounts).toHaveCount(0);
  const ready=await db.getDriverExpectedReturn(company,employee);
  assert.equal(ready.total_expenses,3);
  assert.equal(ready.sales_summary.total_sales,30);
  assert.equal(ready.sales_summary.cash_collected,20);
  assert.equal(ready.sales_summary.gpay_collected,5);
  const submitted=page.waitForResponse(response=>response.url().endsWith('/api/sk/driver-returns/verify'));
  await page.getByRole('button',{name:/SUBMIT RETURN & UPDATE WAREHOUSE INVENTORY/}).click();
  const response=await submitted,data=await response.json();
  assert.equal(response.status(),200,data.message);
  assert.equal(data.summary.total_sales,30);
  assert.equal(data.summary.total_expenses,3);
  await expect(selection).toHaveValue('');
  await page.getByRole('button',{name:'Done & Process Another Return',exact:true}).click();
  await selection.selectOption(String(employee));
  await expect(page.getByText(/No active trip\. Allocate new stock/)).toBeVisible();
  assert.equal(await snapshot(first.id),historical);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM driver_sessions WHERE company_id=$1',[company])).rows[0].count,2);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM driver_returns WHERE company_id=$1',[company])).rows[0].count,2);
  assert.deepEqual((await pool.query('SELECT warehouse_stock_units FROM products WHERE id=ANY($1) ORDER BY id',[products])).rows.map(row=>Number(row.warehouse_stock_units)),[92,97]);
  await assert.rejects(db.verifyAndAcceptDriverReturn(company,employee,{session_id:first.id,items:[{product_id:products[0],unit:'Case',actual_quantity:14}]},owner),/already been submitted/);
  const settlement=await settle(company,{employee_id:employee,collected_amount:43,idempotency_key:randomUUID()},{id:owner,role:'OWNER'});
  assert.equal(Number(settlement.settlement.expected_amount),43);
  await assert.rejects(allocation([[products[0],1]]),/Daily settlement is finalized/);
  assert.equal(await snapshot(first.id),historical);
  const legacy=(await pool.query("INSERT INTO employees(company_id,employee_code,full_name,route_id) VALUES($1,'LEGACY-TRIP','Synthetic legacy stock driver',$2) RETURNING id",[company,routes[0]])).rows[0].id;
  await pool.query("INSERT INTO employee_stock(company_id,employee_id,product_id,qty_units,unit) VALUES($1,$2,$3,1,'Case')",[company,legacy,products[0]]);
  await assert.rejects(db.issueStockToEmployee(company,{employee_id:legacy,items:[{product_id:products[0],quantity:1,unit:'Case'}],idempotency_key:randomUUID()},owner),/requires reconciliation/);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM driver_sessions WHERE employee_id=$1',[legacy])).rows[0].count,0);
  console.log('PASS: same-day two-route trips, concurrent retry-safe allocation, fresh expense form, session-only totals/stock/collections, browser return and reset, immutable history, duplicate rejection and unchanged daily settlement lock.');
} finally { if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve)); await pool.end(); }
