// Isolated React harness: mock reporting GETs; never connects to an application DB.
import assert from 'node:assert/strict';
import {writeFile,unlink} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createServer} from '../../frontend/node_modules/vite/dist/node/index.js';
const server=await createServer({configFile:false,root:new URL('../../frontend',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),server:{host:'127.0.0.1',port:0}});
const harness=new URL('../../frontend/route-dues-test.html',import.meta.url);
await writeFile(harness,`<html><body><div id="root"></div><script type="module">
 import React from 'react';
 import {createRoot} from 'react-dom/client';
 import {RouteBasedDues} from '/src/components/Owner/RouteBasedDues.jsx';
 import {Toaster} from 'sonner';
 createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,React.createElement(RouteBasedDues),React.createElement(Toaster)));
 </script></body></html>`);
await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
let passed=0;
try {
 for(const channel of ['msedge','chrome']) {
  let browser;
  try {browser=await chromium.launch({channel,headless:true});}
  catch(error){console.log(`NOT RUN ${channel}: ${error.message.split('\n')[0]}`);continue;}
  try {
   const page=await browser.newPage();page.on('pageerror',e=>console.log('PAGE ERROR',e.message));let mode='positive',detailCalls=0;
   const positive={id:1,name:'Route A',driver_name:'Ravi',total:'123.45',shops:[{id:9,name:'Long shop name '.repeat(12),balance:'123.45'}]};
   await page.route('**/api/owner/route-dues**',async route=>{
    const detail=route.request().url().endsWith('/1');
    if(detail)detailCalls++;
    if(detail&&mode==='error')return route.fulfill({status:500,body:'failure'});
    const data=detail?(mode==='zero'?{...positive,total:'0',shops:[]}:positive):[{...positive,total:'0',shops:[]},{id:2,name:'Empty route',driver_name:null,total:'0',shops:[]}];
    await route.fulfill({json:data});
   });
   await page.goto(base+'/route-dues-test.html');
   await page.getByRole('button',{name:'View',exact:true}).first().waitFor();
   assert.equal(await page.locator('tbody tr').count(),2);
   assert.equal(await page.getByRole('heading',{name:'Route balance',exact:true}).count(),1);
   assert.equal(await page.getByRole('button',{name:'Refresh',exact:true}).count(),0);
   for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await page.locator('.route-balance-page').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
    assert.equal(await page.getByRole('button',{name:'View',exact:true}).count(),2);
    if(width===390)await page.screenshot({path:'.tmp/route-balance-mobile.png'});
   }
   await page.evaluate(()=>{window.printCount=0;window.print=()=>{window.printCount++;};});
   mode='zero';await page.getByRole('button',{name:'View',exact:true}).first().click();
   await page.getByText('No pending due shops',{exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),0);
   assert.equal(await page.evaluate(()=>window.printCount),0);
   mode='error';await page.getByRole('button',{name:'View',exact:true}).first().click();
   await page.getByText('Unable to load route dues. Please retry.',{exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),0);
   mode='positive';await page.getByRole('button',{name:'View',exact:true}).first().click();await page.getByRole('dialog').waitFor();
   assert.ok((await page.getByRole('dialog').innerText()).includes('₹123.45'));
   for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900});
    const dialog=page.getByRole('dialog');
    assert.equal(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth),true);
    const heading=await dialog.locator('th').last().boundingBox();
    const money=await dialog.locator('td').last().boundingBox();
    assert.ok(Math.abs((heading.x+heading.width)-(money.x+money.width))<2);
   }
   await page.screenshot({path:'.tmp/route-dues-modal-desktop.png'});
   await page.getByRole('button',{name:'Print',exact:true}).click();
   await page.waitForFunction(()=>window.printCount===1);
   assert.equal(await page.getByRole('button',{name:'Print',exact:true}).isDisabled(),true);
   await page.emulateMedia({media:'print'});
   assert.equal(await page.locator('#root').evaluate(e=>getComputedStyle(e).display),'none');
   const receipt=page.locator('#route-dues-receipt');assert.equal(await receipt.isVisible(),true);
   assert.ok((await receipt.innerText()).includes('Grand Total: ₹123.45'));
   assert.equal(await receipt.locator('tbody tr').count(),1);
   assert.equal(await receipt.evaluate(e=>e.scrollWidth<=e.clientWidth),true);
   await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
   assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await receipt.count(),0);
   await page.emulateMedia({media:'screen'});
   await page.getByRole('button',{name:'View',exact:true}).first().click();await page.getByRole('dialog').waitFor();
   await page.getByRole('button',{name:'Close',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);
   // A browser may leave print media without delivering afterprint.
   await page.getByRole('button',{name:'View',exact:true}).first().click();await page.getByRole('dialog').waitFor();
   await page.getByRole('button',{name:'Print',exact:true}).click();
   await page.waitForFunction(()=>window.printCount===2);
   await page.emulateMedia({media:'print'});
   await page.waitForTimeout(100);
   await page.emulateMedia({media:'screen'});
   await page.getByRole('dialog').waitFor({state:'detached'});
   assert.equal(await receipt.count(),0);
   // Late duplicate lifecycle events must not close a newly opened modal.
   await page.getByRole('button',{name:'View',exact:true}).first().click();await page.getByRole('dialog').waitFor();
   await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
   assert.equal(await page.getByRole('dialog').count(),1);
   await page.evaluate(()=>{window.print=()=>{throw new Error('Printer dialog unavailable');};});
   await page.getByRole('button',{name:'Print',exact:true}).click();
   await page.getByText('Unable to open print dialog. Please retry.',{exact:true}).waitFor();
   assert.equal(await page.getByRole('dialog').count(),1);
   assert.equal(await page.getByRole('button',{name:'Print',exact:true}).isEnabled(),true);
   assert.ok(detailCalls>=4);console.log(`PASS ${channel}: live balance, no-dues, error, modal, snapshot, print CSS, afterprint and close`);passed++;
  } finally {await browser.close();}
 }
 if(!passed)process.exitCode=1;
} finally {await server.close();await unlink(harness);}


