import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dashboardBusinessDay, dashboardDateRange, millisecondsToDashboardMidnight, dashboardPeriodSales } from '../../frontend/src/utils/executiveDashboardPeriod.js';
import { pool } from '../database/pg_pool.js';
import { getOwnerExecutiveDashboard } from '../db_pg.js';

test('the dashboard day rolls over at 00:00 IST, independently of UTC', () => {
  const before = new Date('2026-10-27T18:29:59.999Z');
  const after = new Date('2026-10-27T18:30:00.000Z');
  assert.equal(dashboardBusinessDay(before),'2026-10-27');
  assert.equal(dashboardBusinessDay(after),'2026-10-28');
  assert.equal(millisecondsToDashboardMidnight(before),1);
  assert.equal(millisecondsToDashboardMidnight(after),86400000);
  assert.deepEqual(dashboardDateRange('TODAY',after),{start:'2026-10-28',end:'2026-10-28'});
  assert.deepEqual(dashboardDateRange('YESTERDAY',after),{start:'2026-10-27',end:'2026-10-27'});
  assert.deepEqual(dashboardDateRange('TODAY',new Date('2026-12-31T18:30:00Z')),{start:'2027-01-01',end:'2027-01-01'});
});

test('live feed and PDF exclude yesterday, tomorrow and cancelled invoices', () => {
  const rows = [{id:1,sale_date:'2026-10-27'},
    {id:2,created_at:'2026-10-27T18:30:00Z'},
    {id:3,sale_date:'2026-10-28'},
    {id:4,created_at:'2026-10-28T18:29:59.999Z'},
    {id:5,created_at:'2026-10-28T18:30:00Z'},
    {id:6,sale_date:'2026-10-28',status:'CANCELLED'}];
  assert.deepEqual(dashboardPeriodSales(rows,{start:'2026-10-28',end:'2026-10-28'}).map(row=>row.id),[2,3,4]);
});

test('dashboard has no destructive reset action or stale summary fallback', async () => {
  const source = await readFile(new URL('../../frontend/src/components/Owner/OwnerDashboardOverview.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/resetTransactionsAndInventory|Reset Live Data|handleConfirmReset|summary\?\./);
  assert.match(source,/millisecondsToDashboardMidnight/);
  assert.match(source,/visibilitychange/);
});

test('executive API scopes KPIs, invoices and top products to one business day without deleting history', {
  skip: process.env.AVS_DASHBOARD_DAY_DB_TEST !== '1'
}, async (t) => {
  const client = await pool.connect(), originalConnect = pool.connect;
  t.after(async () => {pool.connect=originalConnect;client.release();await pool.end();});
  await client.query(`CREATE TEMP TABLE sales(id INTEGER,company_id INTEGER,employee_id INTEGER,bill_no TEXT,employee_name TEXT,shop_name TEXT,total_amount NUMERIC,cash_paid NUMERIC,gpay_paid NUMERIC,credit_paid NUMERIC,payment_mode TEXT,created_at TIMESTAMPTZ,sale_date DATE,status TEXT);
    CREATE TEMP TABLE sale_items(sale_id INTEGER,product_id INTEGER,unit_type TEXT,qty NUMERIC,amount NUMERIC);
    CREATE TEMP TABLE expenses(company_id INTEGER,category TEXT,amount NUMERIC,created_at TIMESTAMPTZ,expense_date DATE);
    CREATE TEMP TABLE damages(company_id INTEGER,damage_cost NUMERIC,status TEXT,created_at TIMESTAMPTZ);
    CREATE TEMP TABLE driver_returns(company_id INTEGER,total_accepted_good NUMERIC,created_at TIMESTAMPTZ);
    CREATE TEMP TABLE products(id INTEGER,company_id INTEGER,is_active BOOLEAN,purchase_price NUMERIC,pieces_per_unit NUMERIC,display_name TEXT,name TEXT,icon TEXT,selling_unit TEXT);
    CREATE TEMP TABLE employees(company_id INTEGER,is_active BOOLEAN);
    CREATE TEMP TABLE shops(company_id INTEGER,is_active BOOLEAN,current_due NUMERIC);
    CREATE TEMP TABLE receipts(company_id INTEGER,employee_id INTEGER,created_at TIMESTAMPTZ,amount NUMERIC,payment_mode TEXT);
    CREATE TEMP TABLE payment_reversals(company_id INTEGER,sale_id INTEGER,created_at TIMESTAMPTZ,amount NUMERIC,payment_mode TEXT);`);
  const today=dashboardBusinessDay(), yesterday=dashboardDateRange('YESTERDAY').start;
  const tomorrow=new Date(new Date(today+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10);
  const rows=[
    [1,1,'OLD',1000,1000,0,0,yesterday+'T23:59:59+05:30',yesterday,'ACTIVE'],
    [2,1,'MIDNIGHT',100,60,30,10,today+'T00:00:00+05:30',today,'ACTIVE'],
    [3,1,'LAST-MOMENT',200,150,40,10,today+'T23:59:59.999+05:30',today,'ACTIVE'],
    [4,1,'FUTURE',9000,9000,0,0,tomorrow+'T00:00:00+05:30',tomorrow,'ACTIVE'],
    [5,2,'OTHER-COMPANY',777,777,0,0,today+'T01:00:00+05:30',today,'ACTIVE'],
    [6,1,'CANCELLED',888,0,0,0,today+'T02:00:00+05:30',today,'CANCELLED']];
  for(const row of rows){
    await client.query('INSERT INTO sales(id,company_id,bill_no,total_amount,cash_paid,gpay_paid,credit_paid,created_at,sale_date,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',row);
    await client.query("INSERT INTO sale_items VALUES($1,1,'Box',1,$2)",[row[0],row[3]]);
  }
  await client.query("INSERT INTO products VALUES(1,1,TRUE,10,1,'Test Box','Test Box',NULL,'Box')");
  for(const [day,expense,damage,returned] of [[yesterday,50,40,9],[today,12,4,2],[tomorrow,99,80,8]]){
    await client.query("INSERT INTO expenses VALUES(1,'Fuel',$1,$2,$3)",[expense,day+'T12:00:00+05:30',day]);
    await client.query("INSERT INTO damages VALUES(1,$1,'VERIFIED',$2)",[damage,day+'T12:00:00+05:30']);
    await client.query('INSERT INTO driver_returns VALUES(1,$1,$2)',[returned,day+'T12:00:00+05:30']);
  }
  await client.query("INSERT INTO expenses VALUES(1,'Backdated',100,$1,$2)",[today+'T12:00:00+05:30',yesterday]);
  await client.query("INSERT INTO receipts VALUES(1,NULL,$1,3,'CASH')",[today+'T01:00:00+05:30']);
  await client.query("INSERT INTO payment_reversals VALUES(1,2,$1,2,'CASH')",[today+'T02:00:00+05:30']);
  pool.connect=async()=>({query:(...args)=>client.query(...args),release(){}});
  const result=await getOwnerExecutiveDashboard(1);
  assert.equal(result.period,'TODAY');
  assert.deepEqual(result.date_range,{start:today,end:today});
  assert.equal(result.kpis.gross_sales,300);
  assert.equal(result.kpis.expenses,12);
  assert.equal(result.kpis.damage_loss,4);
  assert.equal(result.totalGoodReturns,2);
  assert.equal(result.kpis.cash_collected,211);
  assert.equal(result.kpis.gpay_collected,70);
  assert.equal(result.kpis.credit_issued,20);
  assert.equal(result.recentInvoices.length,2);
  assert.deepEqual(result.recentInvoices.map(row=>row.bill_no).sort(),['LAST-MOMENT','MIDNIGHT']);
  assert.equal(result.analytics.top_products_today[0].amount,300);
  const historical=await getOwnerExecutiveDashboard(1,{period:'YESTERDAY'});
  assert.equal(historical.kpis.gross_sales,1000);
  assert.equal(historical.kpis.expenses,150);
  const range=await getOwnerExecutiveDashboard(1,{period:'CUSTOM',start_date:yesterday,end_date:today});
  assert.equal(range.kpis.gross_sales,1300);
  assert.equal(range.analytics.top_products_today[0].amount,1300);
  assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM sales')).rows[0].n,6);
});
