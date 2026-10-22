import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

if (!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL || '')) throw new Error('Explicit disposable test database required');
process.env.DATABASE_URL = process.env.AVS_TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
const { pool } = await import('../database/pg_pool.js');
const { migrate } = await import('../database/migrate.js');
const { refundSale, settle, cashFlow } = await import('../payments.js');
const { businessDate } = await import('../financial.js');
await migrate();
const company = (await pool.query("INSERT INTO companies(name) VALUES('Synthetic refund verification') RETURNING id")).rows[0].id;
const owner = (await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash) VALUES($1,(SELECT id FROM roles WHERE role_name='OWNER'),$2,'Synthetic refund owner','unusable-test-hash') RETURNING id", [company,randomUUID()])).rows[0].id;
const actor = { id: owner, role: 'OWNER' };
async function fixture(status = 'ACTIVE') {
  const employee = (await pool.query("INSERT INTO employees(company_id,employee_code,full_name) VALUES($1,$2,'Synthetic refund driver') RETURNING id", [company,randomUUID()])).rows[0].id;
  const shop = (await pool.query("INSERT INTO shops(company_id,name,ledger_ready) VALUES($1,'Synthetic refund shop',true) RETURNING id", [company])).rows[0].id;
  const session = (await pool.query('INSERT INTO driver_sessions(company_id,employee_id,session_date,status) VALUES($1,$2,$3,$4) RETURNING id',[company,employee,businessDate(),status])).rows[0].id;
  const sale = (await pool.query("INSERT INTO sales(company_id,bill_no,shop_id,employee_id,session_id,sale_date,total_amount,cash_paid,credit_paid,payment_mode,financial_version) VALUES($1,$2,$3,$4,$5,$6,20,20,0,'CASH',1) RETURNING id",[company,randomUUID(),shop,employee,session,businessDate()])).rows[0].id;
  return {employee,shop,session,sale};
}
const payment = () => ({ amount:20,payment_mode:'CASH',reason:'Synthetic verification',idempotency_key:randomUUID() });
async function unchanged(record) {
  assert.equal(Number((await pool.query('SELECT current_due FROM shops WHERE id=$1',[record.shop])).rows[0].current_due),0);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM payment_reversals WHERE sale_id=$1',[record.sale])).rows[0].count,0);
}
try {
  await test('every finalized session status rejects refunds without financial writes', async () => {
    for (const status of ['CLOSED','COMPLETED','RECONCILED','RETURN_VERIFIED']) {
      const record = await fixture(status);
      await assert.rejects(refundSale(company,record.sale,payment(),actor),/finalized/);
      await unchanged(record);
    }
  });
  await test('settled active driver rejects refund and preserves the settlement', async () => {
    const record = await fixture();
    const saved = await settle(company,{employee_id:record.employee,collected_amount:20,idempotency_key:randomUUID()},actor);
    await assert.rejects(refundSale(company,record.sale,payment(),actor),/finalized/);
    await unchanged(record);
    const row = (await pool.query('SELECT * FROM settlements WHERE id=$1',[saved.settlement.id])).rows[0];
    assert.deepEqual(row,saved.settlement);
    assert.equal(Number((await cashFlow(pool,company,record.employee,{start:businessDate(),end:businessDate()})).cash),20);
  });
  await test('refund before finalization remains allowed and completed retries still replay', async () => {
    const record = await fixture();
    const data = payment();
    const first = await refundSale(company,record.sale,data,actor);
    await pool.query("UPDATE driver_sessions SET status='CLOSED' WHERE id=$1",[record.session]);
    const retry = await refundSale(company,record.sale,data,actor);
    assert.equal(retry.reversal.id,first.reversal.id);
    assert.equal(retry.isDuplicate,true);
    assert.equal(Number((await pool.query('SELECT current_due FROM shops WHERE id=$1',[record.shop])).rows[0].current_due),20);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM payment_reversals WHERE sale_id=$1',[record.sale])).rows[0].count,1);
  });
  await test('concurrent refund and settlement serialize and retain identical reported cash', async () => {
    for (let iteration = 0; iteration < 5; iteration++) {
      const record = await fixture();
      const results = await Promise.allSettled([
        refundSale(company,record.sale,payment(),actor),
        settle(company,{employee_id:record.employee,collected_amount:20,idempotency_key:randomUUID()},actor)
      ]);
      assert.equal(results[1].status,'fulfilled');
      if (results[0].status === 'rejected') assert.match(results[0].reason.message,/finalized/);
      const expected = Number(results[1].value.settlement.expected_amount);
      const flow = await cashFlow(pool,company,record.employee,{start:businessDate(),end:businessDate()});
      assert.equal(Number(flow.cash),expected);
    }
  });
} finally { await pool.end(); }
