import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';
import {chromium,expect} from '@playwright/test';

if(!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL||'')) throw Error('Explicit isolated test database required');
const base='http://127.0.0.1:55648';
Object.assign(process.env,{DATABASE_URL:process.env.AVS_TEST_DATABASE_URL,NODE_ENV:'test',AVS_NO_LISTEN:'1',SESSION_SECRET:'synthetic-shop-pricing-secret',FRONTEND_URL:base});
const {pool}=await import('../database/pg_pool.js');
const {app}=await import('../index.js');
const server=app.listen(55648,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
let browser;
try {
  const company=(await pool.query("INSERT INTO companies(name) VALUES('Synthetic shop pricing') RETURNING id")).rows[0].id;
  const village=(await pool.query("INSERT INTO villages(company_id,name,code) VALUES($1,'Synthetic pricing village','PRICE') RETURNING id",[company])).rows[0].id;
  const employee=(await pool.query("INSERT INTO employees(company_id,employee_code,full_name) VALUES($1,'PRICE','Synthetic keeper') RETURNING id",[company])).rows[0].id;
  const login='shop-price-'+randomUUID(),password='Synthetic-shop-password!';
  await pool.query("INSERT INTO user_accounts(company_id,role_id,employee_id,login_id,name,pin_hash,credential_kind) VALUES($1,(SELECT id FROM roles WHERE role_name='STORE_KEEPER'),$2,$3,'Synthetic keeper',$4,'password')",[company,employee,login,await bcrypt.hash(password,12)]);
  const shop=(await pool.query("INSERT INTO shops(company_id,name,code,village_id,opening_balance,current_due,ledger_ready) VALUES($1,'Synthetic pricing shop','PRICE',$2,20,20,true) RETURNING id",[company,village])).rows[0].id;
  const products=[];
  for(const [name,unit,ppu,direct] of [['Synthetic Piece','Piece',1,12],['Synthetic Milk','Tray',10,15],['Synthetic Case','Case',10,15]]) {
    products.push((await pool.query("INSERT INTO products(company_id,name,display_name,base_unit,selling_unit,pieces_per_unit,piece_selling_price,unit_selling_price,direct_sale_rate,warehouse_stock_units) VALUES($1,$2,$2,'Piece',$3,$4,10,100,$5,10) RETURNING id",[company,name,unit,ppu,direct])).rows[0].id);
  }
  browser=await chromium.launch({headless:true,...(process.env.AVS_TEST_BROWSER==='chromium'?{}:{channel:'msedge'})});
  const page=await browser.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(base);
  await page.getByPlaceholder('Enter your Login ID (e.g. owner)').fill(login);
  await page.locator('#login-credential').fill(password);
  await page.getByRole('button',{name:'Enter',exact:true}).click();
  await page.getByRole('button',{name:'Shop Bill',exact:true}).first().click();
  await page.getByRole('heading',{name:'Synthetic pricing village',exact:true}).click();
  await page.getByRole('heading',{name:'Synthetic pricing shop',exact:true}).click();
  const inputs=page.getByPlaceholder('0',{exact:true});
  await expect(inputs).toHaveCount(3);
  for(const input of await inputs.all()) await input.fill('2');
  await page.getByRole('button',{name:'Proceed to Payment',exact:true}).click();
  const saved=page.waitForResponse(response=>response.url().endsWith('/api/sales')&&response.request().method()==='POST');
  await page.getByRole('button',{name:/GENERATE SHOP BILL & PRINT/}).click();
  const response=await saved,data=await response.json();
  assert.equal(response.status(),200,data.message);
  assert.equal(Number(data.sale.total_amount),254);
  assert.equal(Number(data.sale.cash_paid),254);
  assert.equal(data.sale.employee_id,null);
  await expect(page.locator('.printable-thermal-80mm')).toBeVisible();
  const persisted=(await pool.query('SELECT product_id,rate FROM sale_items WHERE sale_id=$1 ORDER BY product_id',[data.sale.id])).rows;
  assert.deepEqual(persisted.map(item=>Number(item.rate)),[12,15,100]);
  assert.equal(Number((await pool.query('SELECT current_due FROM shops WHERE id=$1',[shop])).rows[0].current_due),20);
  const payload=response.request().postDataJSON();
  payload.idempotency_key=randomUUID();payload.client_reference=payload.idempotency_key;payload.items[0].rate=1;
  const rejected=await page.request.post(base+'/api/sales',{headers:{Origin:base,'X-CSRF-Token':response.request().headers()['x-csrf-token']},data:payload});
  assert.equal(rejected.status(),400);
  assert.match((await rejected.json()).message,/Price changed/);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM sales WHERE company_id=$1',[company])).rows[0].count,1);
  const stock=(await pool.query('SELECT warehouse_stock_units FROM products WHERE id=ANY($1) ORDER BY id',[products])).rows.map(row=>Number(row.warehouse_stock_units));
  assert.deepEqual(stock,[8,9.8,8]);
  console.log('PASS: real storekeeper shop-bill browser flow, Piece/Tray/Case rates, persisted payment/receipt, unchanged old due, stock and forged-price rollback.');
} finally { if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve)); await pool.end(); }
