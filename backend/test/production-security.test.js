import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';

if (!process.env.AVS_TEST_DATABASE_URL || !/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL)) throw new Error('Explicit isolated test database required');
process.env.DATABASE_URL = process.env.AVS_TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'synthetic-test-session-secret-at-least-32-bytes';
process.env.FRONTEND_URL = 'http://localhost:4000';
process.env.AVS_NO_LISTEN = '1';
const { pool } = await import('../database/pg_pool.js');
const { migrate } = await import('../database/migrate.js');
await migrate();
const { app } = await import('../index.js');
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const company = (await pool.query("INSERT INTO companies(name) VALUES('Synthetic Security Test') RETURNING id")).rows[0].id;
const route = (await pool.query("INSERT INTO routes(company_id,name,code) VALUES($1,'Synthetic route','SYNTH') RETURNING id", [company])).rows[0].id;
const employee = (await pool.query("INSERT INTO employees(company_id,employee_code,full_name,route_id) VALUES($1,'SYNTH','Synthetic driver',$2) RETURNING id", [company,route])).rows[0].id;
const ids = {};
for (const [login, role, secret] of [['synthetic-owner','OWNER','Synthetic-owner-password!'],['synthetic-driver','EMPLOYEE','482916']]) {
  const roleId = (await pool.query('SELECT id FROM roles WHERE role_name=$1', [role])).rows[0].id;
  ids[login] = (await pool.query("INSERT INTO user_accounts(company_id,role_id,employee_id,login_id,name,pin_hash,credential_kind) VALUES($1,$2,$3,$4,$4,$5,$6) RETURNING id", [company,roleId,role === 'EMPLOYEE' ? employee : null,login,await bcrypt.hash(secret,12),role === 'OWNER' ? 'password':'pin'])).rows[0].id;
}
async function client(login, password) {
  let cookie = '', token = '';
  const request = async (path, method = 'GET', data, extra = {}) => {
    const response = await fetch(base + path, { method, headers: { Origin: 'http://localhost:4000', Cookie: cookie, 'Content-Type':'application/json', ...(token ? {'X-CSRF-Token':token}:{}), ...extra }, body: data === undefined ? undefined : JSON.stringify(data) });
    const received = response.headers.get('set-cookie');
    if (received) cookie = received.split(';')[0];
    return response;
  };
  const refresh = async () => { token = (await (await request('/api/auth/csrf')).json()).csrfToken; };
  await refresh();
  if (login) {
    assert.equal((await request('/api/auth/login','POST',{login_id:login,pin:password})).status,200);
    await refresh();
  }
  return { request, refresh };
}
try {
  await test('anonymous supplier and reset access is blocked', async () => {
    const anonymous = await client();
    for (const path of ['/api/suppliers','/api/freezers','/api/system/reset-transactions','/system/migrate']) {
      const result = await anonymous.request(path);
      assert.ok([401,404].includes(result.status), path + ': ' + result.status);
    }
  });
  await test('untrusted credentialed origin is rejected', async () => {
    assert.equal((await fetch(base + '/api/auth/csrf',{headers:{Origin:'https://evil.netlify.app'}})).status,403);
  });
  await test('CSRF is required for login', async () => {
    const anonymous = await client();
    assert.equal((await anonymous.request('/api/auth/login','POST',{login_id:'synthetic-owner',pin:'Synthetic-owner-password!'},{'X-CSRF-Token':'wrong'})).status,403);
  });
  await test('employee cannot administer suppliers, settlements or cancellations', async () => {
    const driver = await client('synthetic-driver','482916');
    for (const path of ['/api/suppliers','/api/settlements','/api/sales/1/cancel']) assert.equal((await driver.request(path,'POST',{})).status,403,path);
  });
  await test('role and credential changes revoke existing sessions', async () => {
    const owner = await client('synthetic-owner','Synthetic-owner-password!');
    await pool.query('UPDATE user_accounts SET pin_hash=$1 WHERE id=$2',[await bcrypt.hash('Changed-synthetic-password!',12),ids['synthetic-owner']]);
    assert.equal((await owner.request('/api/auth/me')).status,401);
  });
  await test('migration reapplication is idempotent', async () => { await migrate(); });

  await test('owner read contracts remain available across application modules', async () => {
    const owner = await client('synthetic-owner','Changed-synthetic-password!');
    const endpoints=['/dashboard/summary','/sk/dashboard','/products','/categories','/employees','/drivers','/routes','/routes/fleet-summary','/villages','/shops','/suppliers','/suppliers/inward-report','/freezers','/freezer-models','/damages','/damages/summary','/expenses','/settlements','/inventory/alerts','/analytics/dashboard','/analytics/reconciliation','/analytics/driver-performance','/analytics/route-performance','/analytics/shop-performance','/analytics/product-performance','/audit-logs','/notifications'];
    const failures=[];
    for(const endpoint of endpoints) {
      const result=await owner.request('/api'+endpoint);
      if(result.status!==200)failures.push({endpoint,status:result.status});
    }
    assert.deepEqual(failures,[]);
  });
  await test('employee cannot mutate freezer assets through shop aliases',async()=>{
    const driver=await client('synthetic-driver','482916');
    assert.equal((await driver.request('/api/shops/1/freezer','POST',{model_name:'Synthetic'})).status,403);
  });

  await test('driver object access and expense attribution cannot target another employee',async()=>{
    const driver=await client('synthetic-driver','482916');
    const other=(await pool.query("INSERT INTO employees(company_id,employee_code,full_name) VALUES($1,'OTHER','Other synthetic employee') RETURNING id",[company])).rows[0].id;
    const expense=(await pool.query("INSERT INTO expenses(company_id,employee_id,title,category,amount) VALUES($1,$2,'Synthetic expense','Fuel',1) RETURNING id",[company,other])).rows[0].id;
    assert.equal((await driver.request('/api/expenses/'+expense,'PUT',{amount:2})).status,404);
    assert.equal((await driver.request('/api/expenses','POST',{employee_id:other,category:'Fuel',amount:2})).status,403);
    assert.equal((await driver.request('/api/inventory/reconciliation?employee_id='+other)).status,403);
    assert.equal((await driver.request('/api/stock/employee/'+other)).status,403);
    assert.equal((await driver.request('/api/driver/returns/history')).status,200);
  });
  await test('account suspension and role changes invalidate active sessions',async()=>{
    for(const change of ['status','role']){
      const login='synthetic-revoke-'+change;
      const account=(await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash,credential_kind) VALUES($1,(SELECT id FROM roles WHERE role_name='OWNER'),$2,$2,$3,'password') RETURNING id",[company,login,await bcrypt.hash('Synthetic-revocation-password!',12)])).rows[0].id;
      const owner=await client(login,'Synthetic-revocation-password!');
      if(change==='status')await pool.query("UPDATE user_accounts SET account_status='SUSPENDED' WHERE id=$1",[account]);
      else await pool.query("UPDATE user_accounts SET role_id=(SELECT id FROM roles WHERE role_name='EMPLOYEE') WHERE id=$1",[account]);
      assert.equal((await owner.request('/api/users')).status,401);
    }
  });
  await test('malformed report dates cannot reach interpolated report SQL',async()=>{
    const owner=await client('synthetic-owner','Changed-synthetic-password!');
    assert.equal((await owner.request("/api/analytics/dashboard?start_date="+encodeURIComponent("2026-01-01' OR '1'='1"))).status,400);
  });
  await test('failed logins never lock an account',async()=>{
    const database=await import('../db_pg.js');
    const result=await Promise.all(Array.from({length:5},()=>database.login('synthetic-driver','bad-pin')));
    assert.ok(result.every(row=>!row.success));
    const row=(await pool.query('SELECT failed_attempts,locked_until FROM user_accounts WHERE id=$1',[ids['synthetic-driver']])).rows[0];
    assert.equal(row.failed_attempts,5);
    assert.equal(row.locked_until,null);
    assert.equal((await database.login('synthetic-driver','482916')).success,true);
  });
  await test('login request throttling returns a retry interval',async()=>{
    const anonymous=await client();
    let limited=false;
    for(let attempt=0;attempt<12;attempt++){
      const response=await anonymous.request('/api/auth/login','POST',{login_id:'unknown-synthetic-account',pin:'invalid'});
      if(response.status===429){limited=true;assert.ok(Number(response.headers.get('retry-after'))>0);}
    }
    assert.equal(limited,true);
  });
} finally {
  await new Promise(resolve => server.close(resolve));
  await pool.end();
}
