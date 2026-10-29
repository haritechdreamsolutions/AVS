import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import {randomUUID} from 'node:crypto';
if(!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL||''))throw Error('Explicit isolated test database required');
process.env.DATABASE_URL=process.env.AVS_TEST_DATABASE_URL;
Object.assign(process.env,{NODE_ENV:'test',SESSION_SECRET:'route-dues-synthetic-session-secret-32-characters',FRONTEND_URL:'http://localhost:4000',AVS_NO_LISTEN:'1'});
const {pool}=await import('../database/pg_pool.js');
const {migrate}=await import('../database/migrate.js');await migrate();
const {app}=await import('../index.js');const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base='http://127.0.0.1:'+server.address().port;
const company=(await pool.query("INSERT INTO companies(name) VALUES('Route dues synthetic API') RETURNING id")).rows[0].id;
const other=(await pool.query("INSERT INTO companies(name) VALUES('Route dues foreign API') RETURNING id")).rows[0].id;
const route=(await pool.query("INSERT INTO routes(company_id,name,code) VALUES($1,'Route API','DUES') RETURNING id",[company])).rows[0].id;
const foreign=(await pool.query("INSERT INTO routes(company_id,name,code) VALUES($1,'Foreign route','DUES') RETURNING id",[other])).rows[0].id;
await pool.query("INSERT INTO shops(company_id,name,route_id,current_due) VALUES($1,'Positive',$2,12.34),($1,'Paid',$2,0),($3,'Foreign shop',$2,999)",[company,route,other]);
async function login(role) {
 const name='dues-'+randomUUID();const password='Synthetic-route-dues-password!';
 const roleId=(await pool.query('SELECT id FROM roles WHERE role_name=$1',[role])).rows[0].id;
 await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash,credential_kind) VALUES($1,$2,$3,$3,$4,'password')",[company,roleId,name,await bcrypt.hash(password,4)]);
 let cookie='';async function request(path,options={}){const res=await fetch(base+'/api'+path,{...options,headers:{Origin:'http://localhost:4000',Cookie:cookie,'Content-Type':'application/json',...options.headers}});const value=res.headers.get('set-cookie');if(value)cookie=value.split(';')[0];return res;}
 const token=(await (await request('/auth/csrf')).json()).csrfToken;
 assert.equal((await request('/auth/login',{method:'POST',headers:{'X-CSRF-Token':token},body:JSON.stringify({login_id:name,pin:password})})).status,200);
 return request;
}
try {
 await test('anonymous requests cannot access route dues',async()=>assert.equal((await fetch(base+'/api/owner/route-dues')).status,401));
 const owner=await login('OWNER'),keeper=await login('STORE_KEEPER');
 await test('non-owner cannot access either endpoint',async()=>{for(const path of ['/owner/route-dues','/owner/route-dues/'+route])assert.equal((await keeper(path)).status,403);});
 await test('owner summary/detail reconcile, exclude foreign shops and never change balances',async()=>{
  const before=(await pool.query('SELECT id,current_due FROM shops WHERE company_id=$1 ORDER BY id',[company])).rows;
  const summary=await (await owner('/owner/route-dues')).json();assert.equal(summary.length,1);assert.equal(summary[0].total,'12.34');
  const detail=await (await owner('/owner/route-dues/'+route)).json();assert.equal(detail.total,summary[0].total);assert.equal(detail.shops.length,1);assert.equal(detail.shops[0].name,'Positive');
  assert.deepEqual((await pool.query('SELECT id,current_due FROM shops WHERE company_id=$1 ORDER BY id',[company])).rows,before);
 });
 await test('foreign routes return 404 and malformed route IDs return 400',async()=>{assert.equal((await owner('/owner/route-dues/'+foreign)).status,404);assert.equal((await owner('/owner/route-dues/1%20OR%201=1')).status,400);});
} finally {await new Promise(r=>server.close(r));await pool.end();}
