import assert from 'node:assert/strict';
import {writeFile,unlink} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createServer} from '../../frontend/node_modules/vite/dist/node/index.js';
const root=new URL('../../frontend',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const server=await createServer({configFile:false,root,server:{host:'127.0.0.1',port:0}});
const harness=new URL('../../frontend/login-lockout-test.html',import.meta.url);
await writeFile(harness,`<html><body><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';
import {AppProvider} from '/src/context/AppContext.jsx';import {RoleLoginScreen} from '/src/components/common/RoleLoginScreen.jsx';
createRoot(document.getElementById('root')).render(React.createElement(AppProvider,null,React.createElement(RoleLoginScreen,{onLoginSuccess:()=>{window.loginSucceeded=true;}})));
</script></body></html>`);
await server.listen();
try {
 for(const channel of ['chrome','msedge']) {
  const browser=await chromium.launch({channel,headless:true});
  try {
   const page=await browser.newPage();let attempts=0;
   await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/auth/csrf'))return route.fulfill({json:{csrfToken:'synthetic'}});
    if(path.endsWith('/auth/login')) {
     attempts++;
     const data=JSON.parse(route.request().postData());
     if(data.pin==='Correct-password!')return route.fulfill({json:{success:true,user:{id:1,role:'OWNER'}}});
     return route.fulfill({status:401,json:{success:false,code:'INVALID_CREDENTIALS',message:'Invalid credentials.'}});
    }
    return route.fulfill({json:{success:false}});
   });
   await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/login-lockout-test.html');
   await page.clock.install();
   const id=page.getByPlaceholder('Enter your Login ID (e.g. owner)'),pin=page.getByLabel('Password or driver PIN');
   await id.fill('synthetic-owner');
   for(let n=1;n<=3;n++) {
    await pin.fill('wrong-password');await page.getByRole('button',{name:'Enter',exact:true}).click();
    await pin.waitFor();await assert.doesNotReject(()=>page.waitForFunction(()=>document.getElementById('login-credential').value===''));
    assert.equal(attempts,n);
   }
   const wait=page.getByRole('button',{name:/Wait/});assert.equal(await wait.isDisabled(),true);
   assert.ok((await page.locator('body').innerText()).includes('Please wait 1 minute'));
   await pin.fill('Correct-password!');await pin.press('Enter');assert.equal(attempts,3);
   await page.clock.fastForward(30000);assert.ok((await wait.innerText()).includes('0:30'));
   await page.reload();assert.equal(await page.getByRole('button',{name:/Wait/}).isDisabled(),true);
   await page.clock.fastForward(61000);
   await id.fill('synthetic-owner');await pin.fill('Correct-password!');
   await page.getByRole('button',{name:'Enter',exact:true}).click();await page.waitForFunction(()=>window.loginSucceeded===true);
   assert.equal(attempts,4);console.log('PASS '+channel+': three failures, disabled button, Enter blocked, countdown, reload persistence, expiry and correct login');
  } finally {await browser.close();}
 }
} finally {await server.close();await unlink(harness);}
