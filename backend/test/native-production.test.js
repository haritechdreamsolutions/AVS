import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
if (!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL || '')) throw new Error('Explicit disposable test database required');
Object.assign(process.env,{DATABASE_URL:process.env.AVS_TEST_DATABASE_URL,NODE_ENV:'test',SESSION_SECRET:'synthetic-native-verification-session-secret',FRONTEND_URL:'http://localhost:4000',AVS_NO_LISTEN:'1'});
const { pool } = await import('../database/pg_pool.js');
const { app } = await import('../index.js');
const server = app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const base = 'http://127.0.0.1:'+server.address().port;
const company = (await pool.query("INSERT INTO companies(name) VALUES('Synthetic native API verification') RETURNING id")).rows[0].id;
const login = randomUUID(), password = 'Synthetic-native-password!';
await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash,credential_kind) VALUES($1,(SELECT id FROM roles WHERE role_name='OWNER'),$2,'Synthetic owner',$3,'password')",[company,login,await bcrypt.hash(password,12)]);
let cookie = '', token = '';
async function request(route,method='GET',body) {
  const response = await fetch(base+route,{method,headers:{Cookie:cookie,Origin:'http://localhost:4000','Content-Type':'application/json','X-CSRF-Token':token},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const received = response.headers.get('set-cookie');
  if(received)cookie=received.split(';')[0];
  return response;
}
try {
  await test('login regenerates the session and report/API failures stay JSON',async()=>{
    token=(await (await request('/api/auth/csrf')).json()).csrfToken;
    const initialCookie=cookie;
    const loggedIn=await request('/api/auth/login','POST',{login_id:login,pin:password});
    assert.equal(loggedIn.status,200);
    assert.notEqual(cookie,initialCookie);
    token=(await (await request('/api/auth/csrf')).json()).csrfToken;
    const report=await request('/api/reports/sales');
    assert.equal(report.status,200);
    assert.equal((await report.json()).metrics.totalBills,0);
    const absent=await request('/api/does-not-exist');
    assert.equal(absent.status,404);
    assert.equal((await absent.json()).success,false);
    const reset=await request('/system/migrate');
    assert.equal(reset.status,404);
  });
  await test('existing payment collection and refund APIs retain their authenticated actor',async()=>{
    const shop=(await pool.query("INSERT INTO shops(company_id,name,ledger_ready,current_due) VALUES($1,'Synthetic native shop',true,20) RETURNING id",[company])).rows[0].id;
    const sale=(await pool.query("INSERT INTO sales(company_id,bill_no,shop_id,sale_date,total_amount,credit_paid,payment_mode,financial_version) VALUES($1,$2,$3,CURRENT_DATE,20,20,'CREDIT',1) RETURNING id",[company,randomUUID(),shop])).rows[0].id;
    const collection=await request('/api/shops/'+shop+'/collect-due','POST',{amount:20,payment_mode:'CASH',idempotency_key:randomUUID()});
    assert.equal(collection.status,200);
    assert.equal((await collection.json()).remainingDue,0);
    const refund=await request('/api/sales/'+sale+'/refund','POST',{amount:20,payment_mode:'CASH',reason:'Synthetic API verification',idempotency_key:randomUUID()});
    assert.equal(refund.status,200);
    assert.equal((await refund.json()).success,true);
    assert.equal(Number((await pool.query('SELECT current_due FROM shops WHERE id=$1',[shop])).rows[0].current_due),20);
    const report=await (await request('/api/reports/sales')).json();
    assert.equal(report.metrics.totalRevenue,20);
    assert.equal(report.metrics.totalReceived,0);
    assert.equal(report.metrics.totalBalance,20);
  });
  await test('built frontend and its script assets are served without API interception',async()=>{
    const page=await fetch(base+'/');
    assert.equal(page.status,200);
    assert.match(page.headers.get('content-type'),/text\/html/);
    const document=await page.text();
    const script=document.match(/src="([^"]+\.js)"/);
    assert.ok(script);
    const asset=await fetch(base+script[1]);
    assert.equal(asset.status,200);
    assert.match(asset.headers.get('content-type'),/javascript/);
    assert.equal(asset.headers.get('x-content-type-options'),'nosniff');
  });
  await test('throttled login errors are JSON and preserve a retry interval',async()=>{
    let limited=false;
    for(let attempt=0;attempt<11;attempt++) {
      const response=await request('/api/auth/login','POST',{login_id:'missing-'+randomUUID(),pin:'wrong'});
      if(response.status===429) {
        assert.equal((await response.json()).success,false);
        assert.ok(Number(response.headers.get('retry-after'))>0);
        limited=true;
        break;
      }
    }
    assert.ok(limited);
  });
} finally { await new Promise(resolve=>server.close(resolve)); await pool.end(); }
