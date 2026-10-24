import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';

if(!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL||''))throw Error('Explicit isolated test database required');
Object.assign(process.env,{DATABASE_URL:process.env.AVS_TEST_DATABASE_URL,NODE_ENV:'test',AVS_NO_LISTEN:'1',SESSION_SECRET:'synthetic-user-update-session-secret',FRONTEND_URL:'http://127.0.0.1:55645'});
const {pool}=await import('../database/pg_pool.js');
const {app}=await import('../index.js');
const server=app.listen(55645,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const base='http://127.0.0.1:55645';
const password='Synthetic-owner-update-password!';
async function account() {
  const company=(await pool.query("INSERT INTO companies(name) VALUES('Synthetic user update') RETURNING id")).rows[0].id;
  const login='update-'+randomUUID();
  const owner=(await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash,credential_kind) VALUES($1,(SELECT id FROM roles WHERE role_name='OWNER'),$2,'Synthetic update owner',$3,'password') RETURNING id",[company,login,await bcrypt.hash(password,12)])).rows[0].id;
  return {company,login,owner};
}
async function client(login) {
  let cookie='',token='';
  const request=async(path,method='GET',body)=>{
    const response=await fetch(base+path,{method,headers:{cookie,Origin:base,'Content-Type':'application/json','X-CSRF-Token':token},...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
    return response;
  };
  const refresh=async()=>{token=(await(await request('/api/auth/csrf')).json()).csrfToken;};
  await refresh();
  assert.equal((await request('/api/auth/login','POST',{login_id:login,pin:password})).status,200);
  await refresh();
  return request;
}
try {
  await test('editing an unlinked owner preserves null employee and the active session',async()=>{
    const record=await account(),request=await client(record.login);
    const user=(await(await request('/api/users')).json()).find(row=>row.id===record.owner);
    for(const employee_id of [null,'']){
      const response=await request('/api/users/'+record.owner,'PUT',{...user,name:'Updated synthetic owner',employee_id,route_id:null});
      assert.equal(response.status,200);
      assert.equal((await response.json()).user.employee_id,null);
      assert.equal((await request('/api/users')).status,200);
    }
  });
  await test('invalid employee IDs are rejected without changing the account or session',async()=>{
    const record=await account(),request=await client(record.login);
    for(const employee_id of [0,-1,'not-an-id']){
      assert.equal((await request('/api/users/'+record.owner,'PUT',{employee_id})).status,400);
      assert.equal((await request('/api/users')).status,200);
    }
    assert.equal((await pool.query('SELECT employee_id FROM user_accounts WHERE id=$1',[record.owner])).rows[0].employee_id,null);
  });
  await test('security changes still revoke the changed user, not the editing owner',async()=>{
    const record=await account(),request=await client(record.login);
    const otherLogin='other-'+randomUUID();
    const other=(await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash,credential_kind) VALUES($1,(SELECT id FROM roles WHERE role_name='OWNER'),$2,'Synthetic other owner',$3,'password') RETURNING id",[record.company,otherLogin,await bcrypt.hash(password,12)])).rows[0].id;
    const otherRequest=await client(otherLogin);
    assert.equal((await request('/api/users/'+other,'PUT',{role:'STORE_KEEPER'})).status,200);
    assert.equal((await otherRequest('/api/users')).status,401);
    assert.equal((await request('/api/users')).status,200);
  });
  if(process.env.AVS_TEST_USERS_BROWSER==='1')await test('owner profile update reloads Users Master; security edits show sign-in instead of a load error',async()=>{
    const {chromium}=await import('@playwright/test');
    const browser=await chromium.launch({headless:true,...(process.env.AVS_TEST_BROWSER==='chromium'?{}:{channel:'msedge'})});
    try{
      const record=await account();
      const page=await browser.newPage();
      await page.goto(base);
      await page.getByPlaceholder('Enter your Login ID (e.g. owner)').fill(record.login);
      await page.locator('#login-credential').fill(password);
      await page.getByRole('button',{name:'Enter',exact:true}).click();
      await page.getByRole('button',{name:'Users Master',exact:true}).click();
      const row=page.getByRole('row').filter({hasText:record.login});
      await row.getByRole('button',{name:'Edit',exact:true}).click();
      let form=page.locator('form').last();
      await form.locator('input:not([disabled])').first().fill('Updated browser owner');
      const reloaded=page.waitForResponse(response=>response.url()===base+'/api/users'&&response.request().method()==='GET');
      await page.getByRole('button',{name:'Save Changes',exact:true}).click();
      assert.equal((await reloaded).status(),200);
      await row.getByText('Updated browser owner',{exact:true}).waitFor();
      assert.equal(await page.getByText('Unable to load users. Please try again.',{exact:true}).count(),0);
      await row.getByRole('button',{name:'Edit',exact:true}).click();
      form=page.locator('form').last();
      await form.locator('select').first().selectOption('STORE_KEEPER');
      await page.getByRole('button',{name:'Save Changes',exact:true}).click();
      await page.getByRole('button',{name:'Sign in again',exact:true}).waitFor();
      assert.equal((await page.request.get(base+'/api/users')).status(),401);
      assert.equal(await page.getByText('Unable to load users. Please try again.',{exact:true}).count(),0);
      await page.getByRole('button',{name:'Sign in again',exact:true}).click();
      await page.getByPlaceholder('Enter your Login ID (e.g. owner)').waitFor();
    }finally{await browser.close();}
  });
}finally{await new Promise(resolve=>server.close(resolve));await pool.end();}
