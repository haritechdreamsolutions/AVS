import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
if (!process.env.AVS_TEST_DATABASE_URL || !/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL)) throw new Error('Explicit isolated test database required');
process.env.DATABASE_URL=process.env.AVS_TEST_DATABASE_URL;
const {pool}=await import('../database/pg_pool.js');
const {migrate}=await import('../database/migrate.js');
await migrate();
const {salesReport}=await import('../reports.js');
const company=(await pool.query("INSERT INTO companies(name) VALUES('Synthetic Report Test') RETURNING id")).rows[0].id;
await pool.query("INSERT INTO sales(company_id,bill_no,shop_name,sale_date,total_amount,cash_paid,credit_paid,payment_mode) SELECT $1,$2||n,'Report shop','2026-10-18',10,4,6,'SPLIT' FROM generate_series(1,205)n",[company,'REPORT-'+randomUUID()]);
try {
  await test('report totals cover all matching invoices, independently of page',async()=>{
    const first=await salesReport(company,{page:1,page_size:100});
    const third=await salesReport(company,{page:3,page_size:100});
    assert.equal(first.rows.length,100);
    assert.equal(third.rows.length,5);
    assert.deepEqual(third.metrics,first.metrics);
    assert.equal(first.metrics.totalBills,205);
    assert.equal(first.metrics.totalRevenue,2050);
    assert.equal(first.metrics.totalReceived,820);
    assert.equal(first.metrics.totalBalance,1230);
    assert.equal(new Set([...first.rows,...third.rows].map(row=>row.id)).size,105);
  });
  await test('date, search and company boundaries are applied before aggregation',async()=>{
    assert.equal((await salesReport(company,{from:'2026-10-19'})).metrics.totalBills,0);
    assert.equal((await salesReport(company,{search:'Report shop'})).metrics.totalBills,205);
    assert.equal((await salesReport(company,{search:"' OR 1=1 --"})).metrics.totalBills,0);
    assert.equal((await salesReport(company+100000)).metrics.totalBills,0);
    await assert.rejects(salesReport(company,{page_size:100000}));
  });
  await test('PDF export includes every matching page and refuses silent truncation',async()=>{
    const result=await salesReport(company,{export:'pdf',page:3});
    assert.equal(result.rows.length,205);
    assert.equal(result.metrics.totalRevenue,2050);
    assert.equal(result.rows.reduce((sum,row)=>sum+Number(row.balance_amount),0),1230);
    await pool.query("INSERT INTO sales(company_id,bill_no,shop_name,sale_date,total_amount,cash_paid,credit_paid,payment_mode) SELECT $1,$2||n,'Export limit shop','2026-10-18',10,4,6,'SPLIT' FROM generate_series(1,10000)n",[company,'EXPORT-'+randomUUID()]);
    await assert.rejects(salesReport(company,{export:'pdf'}),/smaller date range/);
  });
} finally { await pool.end(); }
