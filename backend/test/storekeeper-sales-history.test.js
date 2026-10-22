import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';
import {chromium,expect} from '@playwright/test';

if(!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL||'')) throw Error('Explicit isolated test database required');
const base='http://127.0.0.1:55649';
Object.assign(process.env,{DATABASE_URL:process.env.AVS_TEST_DATABASE_URL,NODE_ENV:'test',AVS_NO_LISTEN:'1',SESSION_SECRET:'synthetic-sales-history-secret',FRONTEND_URL:base});
const {pool}=await import('../database/pg_pool.js');
const {createSale}=await import('../db_pg.js');
const {app}=await import('../index.js');
const server=app.listen(55649,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
let browser;
try {
  const company=(await pool.query("INSERT INTO companies(name) VALUES('Synthetic history company') RETURNING id")).rows[0].id;
  const otherCompany=(await pool.query("INSERT INTO companies(name) VALUES('Synthetic other history company') RETURNING id")).rows[0].id;
  const employee=(await pool.query("INSERT INTO employees(company_id,employee_code,full_name) VALUES($1,'HISTORY','Synthetic history employee') RETURNING id",[company])).rows[0].id;
  const password='Synthetic-history-password!',hash=await bcrypt.hash(password,12),accounts={};
  for(const role of ['STORE_KEEPER','OWNER','DRIVER']) {
    const login='history-'+randomUUID();
    await pool.query("INSERT INTO user_accounts(company_id,role_id,employee_id,login_id,name,pin_hash,credential_kind) VALUES($1,(SELECT id FROM roles WHERE role_name=$2),$3,$4,'Synthetic history user',$5,'password')",[company,role,employee,login,hash]);
    accounts[role]=login;
  }
  const bills=[];
  for(const cid of [company,otherCompany]) {
    const product=(await pool.query("INSERT INTO products(company_id,name,display_name,base_unit,selling_unit,pieces_per_unit,piece_selling_price,unit_selling_price,direct_sale_rate,warehouse_stock_units) VALUES($1,'Synthetic history item','Synthetic history item','Piece','Piece',1,12,12,12,10) RETURNING id",[cid])).rows[0].id;
    bills.push((await createSale(cid,{is_store_direct_sale:true,sale_type:'STOREKEEPER_DIRECT',employee_name:'Store Keeper',payment_mode:'CASH',items:[{product_id:product,unit_type:'Piece',qty:1,rate:12}],idempotency_key:randomUUID()})).sale);
  }
  assert.equal((await fetch(base+'/api/reports/sales')).status,401);
  browser=await chromium.launch({headless:true,...(process.env.AVS_TEST_BROWSER==='chromium'?{}:{channel:'msedge'})});
  for(const role of ['STORE_KEEPER','OWNER','DRIVER']) {
    const context=await browser.newContext();
    const page=await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(base);
    await page.getByPlaceholder('Enter your Login ID (e.g. owner)').fill(accounts[role]);
    await page.locator('#login-credential').fill(password);
    const loggedIn=page.waitForResponse(response=>response.url().endsWith('/api/auth/login'));
    await page.getByRole('button',{name:'Enter',exact:true}).click();
    assert.equal((await loggedIn).status(),200);
    const report=await page.request.get(base+`/api/reports/sales?company_id=${otherCompany}`);
    assert.equal(report.status(),role==='DRIVER'?403:200);
    if(role!=='DRIVER') {
      const data=await report.json();
      assert.deepEqual(data.rows.map(sale=>sale.id),[bills[0].id]);
      assert.equal(data.metrics.totalRevenue,12);
      assert.equal((await page.request.get(base+`/api/sales/${bills[1].id}`)).status(),404);
    }
    if(role==='STORE_KEEPER') {
      const loaded=page.waitForResponse(response=>response.url().includes('/api/reports/sales?'));
      await page.getByRole('button',{name:'Sales & Receipts',exact:true}).click();
      assert.equal((await loaded).status(),200);
      await page.getByTitle('Print Invoice',{exact:true}).first().click();
      const receipt=page.locator('.printable-thermal-80mm');
      await expect(receipt).toBeVisible();
      await expect(receipt.getByText('Synthetic history item',{exact:true})).toBeVisible();
    }
    await context.close();
  }
  console.log('PASS: storekeeper history and receipt reprint browser flow; owner retained, driver/anonymous denied, cross-company invoices hidden.');
} finally { if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve)); await pool.end(); }
