import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium, expect} from '@playwright/test';
// Require an explicitly isolated local database and externally supplied test credentials.
if (!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL || '')) throw new Error('Explicit isolated test database required.');
if (!process.env.AVS_TEST_OWNER_LOGIN || !process.env.AVS_TEST_OWNER_PASSWORD) throw new Error('Explicit test owner credentials required.');
process.env.DATABASE_URL = process.env.AVS_TEST_DATABASE_URL;
const {pool} = await import('../database/pg_pool.js');
const {deleteProduct} = await import('../db_pg.js');

if (process.env.AVS_TEST_PRODUCT_DELETE !== '1') throw new Error('Set AVS_TEST_PRODUCT_DELETE=1 to test with temporary local records.');
let browser, productId, ledgerId;
try {
  const {rows:[owner]} = await pool.query('SELECT company_id FROM user_accounts WHERE login_id=$1', [process.env.AVS_TEST_OWNER_LOGIN]);
  const name = `DELETE-CHECK-${randomUUID()}`;
  const {rows:[product]} = await pool.query('INSERT INTO products(company_id,name,display_name,pack_size) VALUES($1,$2,$2,$3) RETURNING id', [owner.company_id,name,'test']);
  productId=product.id;
  await assert.rejects(deleteProduct(-1,productId), /Product not found/);
  assert.equal((await pool.query('SELECT is_active FROM products WHERE id=$1',[productId])).rows[0].is_active,true);
  const {rows:[employee]}=await pool.query('SELECT id FROM employees WHERE company_id=$1 LIMIT 1',[owner.company_id]);
  if(employee){
    const {rows:[ledger]}=await pool.query("INSERT INTO stock_transactions(company_id,employee_id,product_id,unit,transaction_type,qty_units,total_cost) VALUES($1,$2,$3,'Tray','ALLOCATION',1,25) RETURNING id",[owner.company_id,employee.id,productId]);
    ledgerId=ledger.id;
    await pool.query("INSERT INTO employee_stock(company_id,employee_id,product_id,qty_units) VALUES($1,$2,$3,1)",[owner.company_id,employee.id,productId]);
  }
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage();
  await page.goto('http://localhost:4000');
  await page.getByPlaceholder('Enter your Login ID (e.g. owner)').fill(process.env.AVS_TEST_OWNER_LOGIN);
  await page.getByLabel('Password or driver PIN').fill(process.env.AVS_TEST_OWNER_PASSWORD);
  await page.getByRole('button',{name:'Enter',exact:true}).click();
  await page.getByRole('button',{name:/Products & Rates/}).click();

  const searchInput=page.getByPlaceholder('Search Product Name, Category...');
  await searchInput.fill(name);
  await page.locator('button[title="Delete Product"]').first().click();
  const dialog=page.getByRole('dialog',{name:'Confirm permanent product deletion'});
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM products WHERE id=$1',[productId])).rows[0].count,1);
  await page.locator('button[title="Delete Product"]').first().click();
  const response=page.waitForResponse(r=>r.url().endsWith(`/api/products/${productId}`)&&r.request().method()==='DELETE');
  await dialog.getByRole('button',{name:'Yes, Delete Product'}).click();
  const deletedResponse=await response;
  assert.equal(deletedResponse.status(),200,await deletedResponse.text());
  await expect(dialog).toHaveCount(0);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM products WHERE id=$1',[productId])).rows[0].count,0);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM employee_stock WHERE product_id=$1',[productId])).rows[0].count,0);
  if(ledgerId){const {rows:[row]}=await pool.query('SELECT * FROM stock_transactions WHERE id=$1',[ledgerId]);assert.equal(row.product_id,null);assert.equal(Number(row.total_cost),25);assert.ok(row.notes.includes(name));}
  await page.reload();
  await page.getByRole('button',{name:/Products & Rates/}).click();
  await searchInput.fill(name);
  await expect(page.locator('button[title="Delete Product"]')).toHaveCount(0);
  await assert.rejects(deleteProduct(owner.company_id,productId), /Product not found/);
  console.log('PASS: company isolation, cancel, confirmed DELETE, database removal, stock cleanup, retained ledger amounts and reload.');
} finally {
  await browser?.close();
  if(ledgerId)await pool.query('DELETE FROM stock_transactions WHERE id=$1',[ledgerId]);
  if(productId){await pool.query('DELETE FROM employee_stock WHERE product_id=$1',[productId]);await pool.query('DELETE FROM products WHERE id=$1',[productId]);}
  await pool.end();
}
