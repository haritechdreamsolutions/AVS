import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createServer} from '../../frontend/node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
import {writeFile,unlink} from 'node:fs/promises';
const server=await createServer({configFile:false,root:fileURLToPath(new URL('../../frontend',import.meta.url)),server:{host:'127.0.0.1',port:0}});
await server.listen();
const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
const harness=new URL('../../frontend/shop-printer-check.html',import.meta.url);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const report={name:'Tamil shop',total:'36.12',rows:[{date:null,milk:'0',curd:'0',balance:'0.00'},{date:'2026-11-03',milk:'0',curd:'4.00',balance:'36.12'}]};
 await page.route('**/api/owner/shop-balance-receipt/**',route=>{
  const url=route.request().url();
  return route.fulfill({json:url.includes('/details?')?report:url.endsWith('/shops')?[{id:9,name:report.name}]:[{id:1,name:'Route A'}]});
 });
 await writeFile(harness,`<html><body><div id="root"></div><script type="module">
 import React from 'react';import {createRoot} from 'react-dom/client';
 import {ShopBalanceReceipt} from '/src/components/Owner/ShopBalanceReceipt.jsx';
 createRoot(document.getElementById('root')).render(React.createElement(ShopBalanceReceipt));
 </script></body></html>`);
 await page.goto(origin+'/shop-printer-check.html');
 const selectReport=async()=>{
  await page.getByLabel('Route Name').selectOption('1');
  await page.getByLabel('Shop Name').selectOption('9');
  await page.getByRole('heading',{name:report.name,exact:true}).waitFor();
 };
 await selectReport();
 assert.equal(await page.getByLabel('Thermal paper size').inputValue(),'80mm');
 await page.getByLabel('Thermal paper size').selectOption('58mm');
 await page.reload();await selectReport();
 assert.equal(await page.getByLabel('Thermal paper size').inputValue(),'58mm');
 await page.evaluate(()=>Object.defineProperty(navigator,'bluetooth',{configurable:true,value:{requestDevice:async()=>{throw new DOMException('Cancelled','NotFoundError');}}}));
 await page.getByRole('button',{name:'Print',exact:true}).click();
 await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/cancelled/);
 assert.equal(await page.getByLabel('Shop Name').inputValue(),'9');
 await page.evaluate(()=>{
  window.printJobs=[];window.printerPickers=0;
  const characteristic={properties:{writeWithoutResponse:true},writeValueWithoutResponse:async bytes=>window.printJobs.push([...bytes])};
  const gatt={connected:false,connect:async()=>{gatt.connected=true;return {getPrimaryServices:async()=>[{getCharacteristics:async()=>[characteristic]}]};}};
  Object.defineProperty(navigator,'bluetooth',{configurable:true,value:{requestDevice:async()=>{window.printerPickers++;return {gatt};}}});
 });
 for(const paper of ['58mm','80mm']){
  await page.getByLabel('Thermal paper size').selectOption(paper);
  await page.evaluate(()=>{window.printJobs=[];});
  await page.getByRole('button',{name:'Print',exact:true}).click();
  await page.getByText('Receipt sent to thermal printer.',{exact:true}).waitFor();
  assert.equal(page.url(),origin+'/shop-printer-check.html');
  assert.equal(await page.getByLabel('Shop Name').inputValue(),'9');
  assert.match(await page.locator('.sbr-total').innerText(),/36.12/);
  const maxWidth=await page.evaluate(()=>{
   const bytes=window.printJobs.flat();let offset=5,max=0;
   while(offset<bytes.length-7){const width=bytes[offset+4]+256*bytes[offset+5],rows=bytes[offset+6]+256*bytes[offset+7];max=Math.max(max,width);offset+=8+width*rows;}
   return max;
  });
  assert.equal(maxWidth,paper==='58mm'?48:72);
 }
 assert.equal(await page.evaluate(()=>window.printerPickers),1);
 await page.reload();await selectReport();
 assert.equal(await page.getByLabel('Thermal paper size').inputValue(),'80mm');
 const rendered=await page.evaluate(async report=>{
  const {shopBalanceBuffer}=await import('/src/services/shopBalancePrinter.js');
  const original=CanvasRenderingContext2D.prototype.fillText,strings=[];
  CanvasRenderingContext2D.prototype.fillText=function(value,...args){strings.push(value);return original.call(this,value,...args);};
  try{shopBalanceBuffer({...report,name:'கடை பெயர்',printedAt:'2026-11-03',routeName:'Route A'},'80mm');}finally{CanvasRenderingContext2D.prototype.fillText=original;}
  return strings.join(' ');
 },report);
 assert.match(rendered,/கடை பெயர்/);assert.match(rendered,/Opening Balance/);assert.match(rendered,/36.12/);assert.match(rendered,/Milk/);assert.match(rendered,/Curd/);
 await page.setViewportSize({width:390,height:850});
 assert.equal(await page.locator('.sbr-page').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
 await page.screenshot({path:'.tmp/shop-balance-printer-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: saved 58/80-85mm choice after reload, direct BLE printing, paired-printer reuse, cancel retry, same page/shop/totals, Tamil and all receipt columns, mobile layout');
}finally{await browser.close();await server.close();await unlink(harness).catch(()=>{});}
