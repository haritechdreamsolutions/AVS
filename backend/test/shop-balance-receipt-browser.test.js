import assert from 'node:assert/strict';
import {writeFile,unlink} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createServer} from '../../frontend/node_modules/vite/dist/node/index.js';
const root=new URL('../../frontend',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const server=await createServer({configFile:false,root,server:{host:'127.0.0.1',port:0}});
const harness=new URL('../../frontend/shop-balance-test.html',import.meta.url);
let browser;
try {
 await writeFile(harness,'<div id="root"></div><script type="module">import React from "react";import{createRoot}from"react-dom/client";import{ShopBalanceReceipt}from"/src/components/Owner/ShopBalanceReceipt.jsx";createRoot(document.getElementById("root")).render(React.createElement(ShopBalanceReceipt));</script>');
 await server.listen();
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 let writes=0;
 await page.route('**/api/**',async r=>{
  if(r.request().method()!=='GET')writes++;
  const url=r.request().url();
  const data=url.includes('/details')?{name:'A very long shop name '.repeat(5),rows:[{date:'2026-10-01',milk:'12',curd:'7',balance:'120.03'}],total:'120.03'}:url.includes('/shops')?[{id:17,name:'Same name'}]:[{id:1,name:'Route A'},{id:2,name:'Empty route'}];
  await r.fulfill({json:url.includes('/routes/2/')?[]:data});
 });
 await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/shop-balance-test.html');
 await page.getByLabel('Route Name').selectOption('1');
 await page.getByLabel('Shop Name').selectOption('17');
 await page.getByText('Total Balance: ₹120.03').waitFor();
 await page.evaluate(()=>{window.print=()=>{window.__printed=true;};});
 await page.getByRole('button',{name:'Print',exact:true}).click();
 await page.waitForFunction(()=>window.__printed);
 await page.emulateMedia({media:'print'});
 assert.equal(await page.locator('#shop-balance-receipt h1').innerText(),'AVS AGENCIES');
 assert.equal(await page.locator('#shop-balance-receipt th').allTextContents().then(x=>x.join(',')),'Date,M,C,Bal');
 assert.match(await page.locator('#shop-balance-receipt').innerText(),/TOTAL BAL: ₹120.03/);
 assert.equal(await page.locator('#root').evaluate(el=>getComputedStyle(el).display),'none');
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 await page.emulateMedia({media:'screen'});
 assert.equal(await page.getByLabel('Shop Name').inputValue(),'17');
 await page.getByLabel('Route Name').selectOption('2');
 assert.equal(await page.getByLabel('Shop Name').inputValue(),'');
 await page.getByText('No active shops in this route.').waitFor();
 assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth),true);
 assert.equal(writes,0);
 console.log('PASS: mobile controls, stale selection, snapshot, 58mm print isolation, dialog lifecycle, preserved filters, GET-only');
}finally{await browser?.close();await server.close();await unlink(harness).catch(()=>{});}

