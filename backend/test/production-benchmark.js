import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import bcrypt from 'bcrypt';

if (!process.env.AVS_TEST_DATABASE_URL || !/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_bench[a-z0-9_]*$/.test(process.env.AVS_TEST_DATABASE_URL)) throw new Error('A new isolated benchmark database is required');
process.env.DATABASE_URL=process.env.AVS_TEST_DATABASE_URL;
process.env.NODE_ENV='test';
process.env.AVS_NO_LISTEN='1';
process.env.FRONTEND_URL='http://localhost:4000';
process.env.SESSION_SECRET='synthetic-benchmark-secret-at-least-32-characters';
const {pool}=await import('../database/pg_pool.js');
const {migrate}=await import('../database/migrate.js');
const {salesReport}=await import('../reports.js');
const db=await import('../db_pg.js');
const existing=await pool.query("SELECT to_regclass('public.companies') AS name");
if(existing.rows[0].name) throw new Error('Benchmark requires a previously empty database');
await pool.query(await readFile(new URL('../database/migrations/000_production_baseline.sql',import.meta.url),'utf8'));
await pool.query("INSERT INTO companies(name) VALUES('Synthetic benchmark')");
await pool.query("INSERT INTO shops(company_id,name,code) SELECT 1,'Synthetic shop '||n,'SYNTH-'||n FROM generate_series(1,100)n");
await pool.query("INSERT INTO products(company_id,name,display_name,sku,warehouse_stock_units,pieces_per_unit,unit_selling_price,piece_selling_price) SELECT 1,'Synthetic product '||n,'Synthetic product '||n,'SYNTH-'||n,100000,10,100,10 FROM generate_series(1,100)n");
await pool.query("INSERT INTO employees(company_id,employee_code,full_name) SELECT 1,'SYNTH-'||n,'Synthetic employee '||n FROM generate_series(1,10)n");
async function seed(first,last) {
  await pool.query("INSERT INTO sales(company_id,bill_no,employee_id,employee_name,shop_id,shop_name,sale_date,total_amount,cash_paid,credit_paid,payment_mode) SELECT 1,'SYNTH-'||n,1+(n%10),'Synthetic employee '||(1+n%10),1+(n%100),'Synthetic shop '||(1+n%100),DATE '2026-01-01'+(n%280)::int,100,CASE WHEN n%2=0 THEN 100 ELSE 0 END,CASE WHEN n%2=1 THEN 100 ELSE 0 END,CASE WHEN n%2=0 THEN 'CASH' ELSE 'CREDIT' END FROM generate_series($1::int,$2::int)n",[first,last]);
  await pool.query("INSERT INTO sale_items(sale_id,product_id,product_name,qty,unit_type,rate,amount) SELECT n,1+(n%100),'Synthetic product',1,'Piece',CASE WHEN item=3 THEN 40 ELSE 30 END,CASE WHEN item=3 THEN 40 ELSE 30 END FROM generate_series($1::int,$2::int)n CROSS JOIN generate_series(1,3)item",[first,last]);
  await pool.query('ANALYZE');
}
const output={environment:{postgres:(await pool.query('SHOW server_version')).rows[0].server_version,node:process.version,concurrency:10},baseline:[],after:[]};
try {
  await seed(1,10000);
  let start=performance.now();const small=await db.getSales(1,{start_date:'2026-09-01',end_date:'2026-10-18'});output.baseline.push({invoices:10000,listing_ms:performance.now()-start,returned:small.length});
  await seed(10001,100000);
  start=performance.now();
  try { const large=await db.getSales(1,{start_date:'2026-09-01',end_date:'2026-10-18'});output.baseline.push({invoices:100000,listing_ms:performance.now()-start,returned:large.length}); }
  catch(error) { if(error.code!=='57014')throw error; output.baseline.push({invoices:100000,listing_ms:performance.now()-start,status:'STATEMENT_TIMEOUT'}); }
  await migrate();
  await pool.query('ANALYZE');
  for(const [name,work] of [['indexed_legacy_listing',()=>db.getSales(1,{start_date:'2026-09-01',end_date:'2026-10-18'})],['paginated_report',()=>salesReport(1,{from:'2026-09-01',to:'2026-10-18'})]]) {
    start=performance.now();const result=await work();output.after.push({name,invoices:100000,duration_ms:performance.now()-start,returned:Array.isArray(result)?result.length:result.rows.length});
  }
  const total=await salesReport(1);
  assert.equal(total.metrics.totalBills,100000);
  assert.equal(total.metrics.totalRevenue,10000000);
  assert.equal(total.metrics.totalReceived,5000000);
  assert.equal(total.metrics.totalBalance,5000000);
  output.explain=(await pool.query("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT * FROM sales WHERE company_id=1 AND sale_date BETWEEN '2026-09-01' AND '2026-10-18' ORDER BY sale_date DESC,id DESC LIMIT 100")).rows[0]['QUERY PLAN'];
  const role=(await pool.query("SELECT id FROM roles WHERE role_name='OWNER'")).rows[0].id;
  await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash,credential_kind) VALUES(1,$1,'benchmark-owner','Synthetic owner',$2,'password')",[role,await bcrypt.hash('Synthetic-benchmark-password!',12)]);
  const {app}=await import('../index.js');
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  let cookie='';
  const csrf=await fetch(base+'/api/auth/csrf');cookie=csrf.headers.get('set-cookie').split(';')[0];const token=(await csrf.json()).csrfToken;
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify({login_id:'benchmark-owner',pin:'Synthetic-benchmark-password!'})});
  assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];
  const samples=[];let errors=0;const cpuStart=process.cpuUsage(),batchStart=performance.now();
  await Promise.all(Array.from({length:10},async()=>{
    for(let index=0;index<5;index++){
      const begin=performance.now();
      const response=await fetch(base+'/api/reports/sales?from=2026-09-01&to=2026-10-18',{headers:{Cookie:cookie}});
      if(!response.ok)errors++;
      await response.arrayBuffer();samples.push(performance.now()-begin);
    }
  }));
  samples.sort((first,second)=>first-second);
  output.api={requests:samples.length,concurrency:10,p50_ms:samples[Math.ceil(samples.length*.5)-1],p95_ms:samples[Math.ceil(samples.length*.95)-1],errors,error_rate:errors/samples.length,node_cpu_microseconds:process.cpuUsage(cpuStart),elapsed_ms:performance.now()-batchStart,node_rss_bytes:process.memoryUsage().rss};
  await new Promise(resolve=>server.close(resolve));
  await mkdir(new URL('../../.tmp/',import.meta.url),{recursive:true});
  await writeFile(new URL('../../.tmp/production-benchmark.json',import.meta.url),JSON.stringify(output,null,2));
  console.log(JSON.stringify({...output,explain:'saved in .tmp/production-benchmark.json'},null,2));
  assert.equal(errors,0);
} finally { await pool.end(); }
