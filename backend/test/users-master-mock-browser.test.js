import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const base='http://127.0.0.1:4000';
const usersFixture=[
 {id:7,name:'Fixture Store',login_id:'fixture-store',role:'STORE_KEEPER',status:'ACTIVE',employee_id:null},
 {id:5,name:'Fixture Owner',login_id:'fixture-owner',role:'OWNER',status:'ACTIVE',employee_id:null},
 {id:4,name:'Fixture Driver',login_id:'fixture-driver',role:'DRIVER',status:'INACTIVE',employee_id:104,employee_code:'TEST004',route_id:204,route_name:'Fixture Existing Route',route_code:'TEST204'}
];
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
const only=process.env.AVS_USERS_MOCK_CASE;
async function scenario(name,work,options={}) {
 if(only && !name.includes(only))return;
 const page=await browser.newPage();page.setDefaultTimeout(5000);let users=structuredClone(usersFixture),requests=[],failure=options.failure;
 page.on('pageerror',error=>console.log('Harness page error: '+error.message));
 const routes=options.missingRoute?[]:[{id:204,name:'Fixture Existing Route',code:'TEST204'}];
 const employees=[{id:105,full_name:'Fixture Unlinked Employee',employee_code:'TEST005',is_active:true,route_id:204}];
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin!==base)throw Error('Unexpected external request blocked');
  if(url.pathname==='/audit-users')return route.fulfill({contentType:'text/html',body:`<html><body><div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module">import React from '/node_modules/.vite/deps/react.js';import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';import {UsersMaster} from '/src/components/Owner/UsersMaster.jsx';ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(UsersMaster));</script></body></html>`});
  if(url.pathname.startsWith('/src/context/AppContext'))return route.fulfill({contentType:'application/javascript',body:`export const useApp=()=>({API_URL:'/api',currentUser:{id:5,company_id:1,role:'OWNER'},apiFetch:(url,options)=>fetch(url,options)});`});
  if(!url.pathname.startsWith('/api/'))return route.continue();
  const method=req.method(),path=url.pathname,body=req.postDataJSON();requests.push({method,path,body});
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(method==='GET')return json(path==='/api/users'?users:path==='/api/employees'?employees:path==='/api/routes'?routes:[]);
  if(failure)return json({success:false,message:failure},400);
  if(path==='/api/users'&&method==='POST'){
   if(users.some(u=>u.login_id===body.login_id))return json({success:false,message:'Login ID already taken. Please choose another.'},400);
   const user={...body,id:88,status:'ACTIVE',employee_code:'TEST004'};users.push(user);return json({success:true,user});
  }
  const id=Number(path.split('/').pop());
  if(method==='PUT'){const user=users.find(u=>u.id===id);Object.assign(user,body);return json({success:true,user});}
  if(method==='DELETE'){users=users.filter(u=>u.id!==id);return json({success:true,message:'Fixture user deleted.'});}
  throw Error('Unexpected mutation blocked: '+method+' '+path);
 });
 try{await page.goto(base+'/audit-users');await expect(page.getByText('User Accounts Master',{exact:true})).toBeVisible();await expect(page.getByRole('row').filter({hasText:'fixture-driver'})).toBeVisible();await work({page,requests,users:()=>users});results.push({name,status:'PASS'});}catch(error){results.push({name,status:'FAIL',message:error.message.slice(0,800)});}finally{await page.close();}
}
try {
 await scenario('API list, selected account ID, fields, edit cancel',async({page,requests})=>{
  const row=page.getByRole('row').filter({hasText:'fixture-driver'});
  for(const text of ['#4','DRIVER','INACTIVE','TEST004','Fixture Existing Route'])await expect(row).toContainText(text);
  await row.getByRole('button',{name:'Edit',exact:true}).click();const form=page.locator('form');
  await expect(page.getByLabel('Employee Code')).toHaveValue('TEST004');await expect(form.locator('input').nth(2)).toHaveValue('fixture-driver');
  await form.locator('input').nth(1).fill('Cancelled fixture');await form.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(requests.filter(r=>r.method!=='GET').length,0);
 });
 await scenario('Update targets account 4 rather than employee 104 and refreshes memory fixture',async({page,requests,users})=>{
  await page.getByRole('row').filter({hasText:'fixture-driver'}).getByRole('button',{name:'Edit',exact:true}).click();
  await page.locator('form input').nth(1).fill('Updated fixture driver');await page.getByRole('button',{name:'Save Changes',exact:true}).click();
  await expect(page.getByRole('row').filter({hasText:'fixture-driver'})).toContainText('Updated fixture driver');const req=requests.find(r=>r.method==='PUT');assert.equal(req.path,'/api/users/4');assert.equal(req.body.employee_id,104);assert.equal(req.body.route_id,204);assert.equal(users().find(u=>u.id===5).name,'Fixture Owner');await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.getByText('Updated fixture driver',{exact:true})).toBeVisible();
 });
 await scenario('Existing assigned route missing from active options remains editable',async({page,requests})=>{
  await page.getByRole('row').filter({hasText:'fixture-driver'}).getByRole('button',{name:'Edit',exact:true}).click();
  const route=page.locator('form select').last();assert.equal(await route.evaluate(e=>e.checkValidity()),true,'Existing route must remain a valid selected option');await expect(route).toHaveValue('204');await page.getByRole('button',{name:'Save Changes',exact:true}).click();await expect(page.getByText('User updated successfully',{exact:true})).toBeVisible();assert.equal(requests.find(r=>r.method==='PUT').body.route_id,204);
 },{missingRoute:true});
 await scenario('Delete cancel sends no request; confirm targets only selected account',async({page,requests,users})=>{
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('row').filter({hasText:'fixture-driver'}).getByRole('button',{name:'Delete',exact:true}).click();assert.equal(requests.filter(r=>r.method==='DELETE').length,0);
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('row').filter({hasText:'fixture-driver'}).getByRole('button',{name:'Delete',exact:true}).click();await expect(page.getByText('fixture-driver',{exact:true})).toHaveCount(0);assert.equal(requests.find(r=>r.method==='DELETE').path,'/api/users/4');assert.equal(users().length,2);
 });
 await scenario('Update API failure stays in modal and shows real message',async({page})=>{
  await page.getByRole('row').filter({hasText:'fixture-driver'}).getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('button',{name:'Save Changes',exact:true}).click();await expect(page.getByText('Fixture constraint failure',{exact:true})).toBeVisible();await expect(page.getByText('User updated successfully',{exact:true})).toHaveCount(0);
 },{failure:'Fixture constraint failure'});
 await scenario('Delete API failure retains selected user and shows message',async({page})=>{
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('row').filter({hasText:'fixture-driver'}).getByRole('button',{name:'Delete',exact:true}).click();await expect(page.getByText('Fixture deletion constraint',{exact:true})).toBeVisible();await expect(page.getByText('fixture-driver',{exact:true})).toBeVisible();
 },{failure:'Fixture deletion constraint'});
 await scenario('Create validates credentials and duplicate login; valid submit uses API and refresh',async({page,requests})=>{
  await page.getByRole('button',{name:'Add User Account',exact:true}).click();let form=page.locator('form');const fields=form.locator('input');
  // Existing employee mode only: all writes terminate in this in-memory API mock.
  await form.locator('select').first().selectOption('DRIVER');await fields.nth(0).fill('fixture-driver');await fields.nth(1).fill('4567');await fields.nth(2).fill('4568');await form.getByRole('button',{name:'Create User Account',exact:true}).click();await expect(page.getByText('Initial PIN and Confirm PIN do not match.',{exact:true})).toBeVisible();assert.equal(requests.filter(r=>r.method==='POST').length,0);
  await fields.nth(2).fill('4567');await form.getByRole('button',{name:'Create User Account',exact:true}).click();await expect(page.getByText('Login ID already taken. Please choose another.',{exact:true})).toBeVisible();await fields.nth(0).fill('fixture-new');await form.getByRole('button',{name:'Create User Account',exact:true}).click();await expect(page.getByText('fixture-new',{exact:true})).toBeVisible();assert.equal(requests.filter(r=>r.method==='POST').length,2);assert.equal(Number(requests.filter(r=>r.method==='POST').at(-1).body.employee_id),105);
 });
}finally{await browser.close();}
console.log(JSON.stringify(results,null,2));process.exitCode=results.some(r=>r.status==='FAIL')?1:0;
