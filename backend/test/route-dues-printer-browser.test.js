// Synthetic report only: no database or physical printer is used.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import {createServer} from '../../frontend/node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
import {writeFile,unlink} from 'node:fs/promises';

const server=await createServer({configFile:false,root:fileURLToPath(new URL('../../frontend',import.meta.url)),server:{host:'127.0.0.1',port:0}});
await server.listen();
const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
const harness=new URL('../../frontend/route-printer-check.html',import.meta.url);
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
 const page = await browser.newPage();
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 const report={id:1,name:'எறையூர்',driver_name:'AKASH, Ravi',total:'3722.50',shops:[
  {id:1,name:'அண்ணாமலை ஸ்டோர்',balance:'3702.50'},
  {id:2,name:'Long shop name '.repeat(8),balance:'20.00'}
 ]};
 await page.route('**/api/owner/route-dues**',route=>route.fulfill({json:route.request().url().endsWith('/1')?report:[report]}));
 await writeFile(harness,`<html><body><div id="root"></div><script type="module">
 import React from 'react';
 import {createRoot} from 'react-dom/client';
 import {RouteBasedDues} from '/src/components/Owner/RouteBasedDues.jsx';
 createRoot(document.getElementById('root')).render(React.createElement(RouteBasedDues));
 </script></body></html>`);
 await page.goto(origin+'/route-printer-check.html');
 await page.getByRole('button',{name:'View',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 for(const width of [390,1440]) {
  await page.setViewportSize({width,height:width===390?800:1000});
  assert.equal(await page.locator('.dues-modal').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  if(width===390)await page.screenshot({path:'.tmp/owner-route-printer-mobile.png'});
 }
 assert.match(await page.locator('.dues-preview-total').innerText(),/3,722.50/);
 await page.screenshot({path:'.tmp/owner-route-printer-preview.png'});
 const raster = await page.evaluate(async report=>{
  const {routeDuesBuffer}=await import('/src/services/routeDuesPrinter.js');
  return ['58mm','80mm'].map(paper=>{
   const data={...report,printedAt:'03/11/2026'};
   const bytes=routeDuesBuffer(data,paper);
   const original=routeDuesBuffer(data,paper,document,false);
   const rowBytes=paper==='58mm'?48:72;
   const restored=[];
   let offset=5;
   while(offset<bytes.length-7) {
    if(bytes[offset]!==29||bytes[offset+1]!==118)throw Error('Invalid raster band');
    const cols=bytes[offset+4]+bytes[offset+5]*256;
    const rows=bytes[offset+6]+bytes[offset+7]*256;
    for(let row=0;row<rows;row++) {
     const pixels=Array.from(bytes.slice(offset+8+row*cols,offset+8+(row+1)*cols));
     restored.push(...pixels,...new Array(rowBytes-cols).fill(0));
    }
    offset+=8+cols*rows;
   }
   const expected=original.slice(13,-7);
   return {identical:restored.length===expected.length&&restored.every((b,i)=>b===expected[i]),length:bytes.length,original:original.length,tail:[...bytes.slice(-7)]};
  });
 },report);
 for(const result of raster) {
  assert.equal(result.identical,true,'Fast output must preserve every printed dot and row');
  assert.ok(result.length<result.original*.8,'Expected at least 20% less Bluetooth data');
  assert.deepEqual(result.tail,[10,10,10,29,86,66,0]);
 }
 console.log('Raster data reduction:',raster.map(r=>Math.round((1-r.length/r.original)*100)+'%').join(', '));
 // Unsupported transport gives a retryable error, retaining report and totals.
 await page.evaluate(()=>Object.defineProperty(navigator,'bluetooth',{configurable:true,value:undefined}));
 await page.getByRole('button',{name:'Print',exact:true}).click();
 await page.getByRole('alert').waitFor();
 assert.match(await page.getByRole('alert').innerText(),/System Print/);
 assert.equal(await page.getByRole('dialog').count(),1);
 // Fake GATT captures the actual bytes delivered by the existing transport.
 await page.evaluate(()=>{
  window.writes=[];window.pickerCount=0;
  const characteristic={properties:{writeWithoutResponse:true},writeValueWithoutResponse:async bytes=>window.writes.push([...bytes])};
  const gatt={connected:false,connect:async()=>{gatt.connected=true;return {getPrimaryServices:async()=>[{getCharacteristics:async()=>[characteristic]}]};}};
  Object.defineProperty(navigator,'bluetooth',{configurable:true,value:{requestDevice:async()=>{window.pickerCount++;return {gatt};}}});
 });
 await page.getByRole('button',{name:'Print',exact:true}).click();
 await page.waitForFunction(()=>window.writes.length>0);
 await page.getByRole('dialog').waitFor({state:'detached'});
 await page.getByRole('button',{name:'View',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 assert.ok(await page.evaluate(()=>window.writes.flat().includes(72)));
 await page.getByLabel('Receipt paper').selectOption('58mm');
 await page.evaluate(()=>{window.writes=[];});
 await page.getByRole('button',{name:'Print',exact:true}).click();
 await page.waitForFunction(()=>window.writes.length>0);
 await page.getByRole('dialog').waitFor({state:'detached'});
 await page.getByRole('button',{name:'View',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 assert.ok(await page.evaluate(()=>window.writes.flat().includes(48)));
 assert.equal(await page.evaluate(()=>window.pickerCount),1,'Connected thermal printer should be reused without another picker');
 // System print uses the selected paper and only the receipt is visible.
 await page.evaluate(()=>{window.print=()=>{
  window.printResult={elapsed:performance.now()-window.printStarted,text:document.getElementById('route-dues-receipt').innerText,css:[...document.querySelectorAll('style')].map(s=>s.textContent).join('')};
 };});
 await page.evaluate(()=>{window.printStarted=performance.now();});
 await page.getByRole('button',{name:'System Print',exact:true}).click();
 await page.waitForFunction(()=>!!window.printResult);
 const printed=await page.evaluate(()=>window.printResult);
 assert.ok(printed.elapsed<1000,`Print opened too slowly: ${printed.elapsed}ms`);
 assert.equal(await page.getByRole('dialog').count(),1);
 assert.equal(await page.getByRole('alert').count(),0);
 console.log(`Installed-printer dialog invoked in ${Math.round(printed.elapsed)}ms (mock printer)`);
 assert.match(printed.text,/அண்ணாமலை/);assert.match(printed.text,/3,722.50/);assert.match(printed.css,/size:58mm/);
 assert.deepEqual(errors,[]);
 console.log('PASS: direct Print sends 58/80mm Tamil receipts, returns to route overview after success, retains modal on error, reuses paired printer, System Print and unchanged totals');
} finally {await browser.close();await server.close();await unlink(harness).catch(()=>{});}
