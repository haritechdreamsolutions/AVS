import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fixture=JSON.parse(await readFile('.tmp/local-preview.json','utf8'));
if(!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_preview[a-z0-9_]*$/.test(fixture.admin_url))throw new Error('Explicit isolated preview required');
process.env.DATABASE_URL=fixture.admin_url;
const {pool}=await import('../database/pg_pool.js');
const {reconcile}=await import('../database/reconcile.js');
try {
  const snapshot=async()=>(await pool.query('SELECT current_due,opening_due_remaining,ledger_ready FROM shops WHERE id=$1',[fixture.shop])).rows;
  const before=await snapshot();
  const clean=await reconcile(fixture.company);
  assert.ok(clean.filter(row=>row.status!=='NOT_VERIFIED').every(row=>row.status==='PASS'));
  assert.equal(clean.find(row=>row.name==='historical_warehouse_opening_and_physical_counts').status,'NOT_VERIFIED');
  assert.deepEqual(await snapshot(),before);
  const company=(await pool.query("INSERT INTO companies(name) VALUES('Synthetic reconciliation edge cases') RETURNING id")).rows[0].id;
  await pool.query("INSERT INTO shops(company_id,name,current_due,ledger_ready,opening_due_remaining) VALUES($1,'Unapproved opening',100,false,0),($1,'Mismatched opening',20,true,10)",[company]);
  const employee=(await pool.query("INSERT INTO employees(company_id,employee_code,full_name) VALUES($1,'RECONCILE','Synthetic employee') RETURNING id",[company])).rows[0].id;
  const product=(await pool.query("INSERT INTO products(company_id,name,display_name) VALUES($1,'Synthetic stock','Synthetic stock') RETURNING id",[company])).rows[0].id;
  await pool.query('INSERT INTO employee_stock(company_id,employee_id,product_id,qty_units) VALUES($1,$2,$3,1)',[company,employee,product]);
  const flagged=await reconcile(company);
  for(const name of ['unapproved_shop_opening_balances','shop_due_mismatches','employee_stock_ledger_mismatches'])assert.equal(flagged.find(row=>row.name===name).count,1);
  await assert.rejects(reconcile(2147483647),/Company not found/);
  const guarded={connect:async()=>{
    const client=await pool.connect();
    return {query:async(sql,params)=>{
      if(sql==='SELECT id FROM companies WHERE id=$1')await client.query('UPDATE companies SET name=name WHERE id=$1',params);
      return client.query(sql,params);
    },release:()=>client.release()};
  }};
  await assert.rejects(reconcile(fixture.company,guarded),error=>error.code==='25006');
  console.log('PASS: reconciliation is read-only, company-scoped, catches opening/ledger mismatches and never certifies unknown historical stock');
} finally {await pool.end();}
