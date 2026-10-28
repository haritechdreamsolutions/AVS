import test from 'node:test';
import {mkdir} from 'node:fs/promises';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
test('82mm direct Bluetooth stock report returns only after successful writes and supports failure retry', {skip:process.env.AVS_STOCK_PRINT_BROWSER_TEST !== '1', timeout:90000}, async()=>{
if(!process.env.AVS_ADMIN_PASSWORD)throw Error('Local verification password required');
await mkdir('.tmp',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.AVS_TEST_BROWSER === 'chromium' ? {} : {channel:'msedge'})});
try {
const page=await browser.newPage();
await page.route('**/api/auth/login',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();const data=await response.json();data.user={...data.user,role:'STORE_KEEPER',role_name:'STORE_KEEPER',is_system_administrator:false};await route.fulfill({response,json:data});});
await page.route('**/api/sk/driver-returns/eligible',r=>r.fulfill({json:[{driver_id:999,driver_name:'Print Check Driver',employee_code:'PRINT',vehicle_number:'TN-PRINT'}]}));
await page.route('**/api/sk/driver-returns/expected/999',r=>r.fulfill({json:{success:true,driver:{id:999,name:'Print Check Driver',vehicle_number:'TN-PRINT'},products:[{product_id:999,product_name:'Print Check Case',base_unit:'Case',selling_unit:'Case',pieces_per_unit:1,allocated:10,sold:3,damage:0}],sales_summary:{},expenses:[],damages:[]}}));
await page.goto('http://localhost:4000');
await page.getByPlaceholder('Enter your Login ID (e.g. owner)').fill('administrator');
await page.getByLabel('Password or driver PIN').fill(process.env.AVS_ADMIN_PASSWORD);
await page.getByRole('button',{name:'Enter',exact:true}).click();
await page.getByRole('button',{name:'Stock Return Driver',exact:true}).click();
await page.locator('select').filter({has:page.locator('option[value="999"]')}).selectOption('999');
await page.getByRole('button',{name:'Stock view',exact:true}).click();
await page.locator('#thermal-58mm-stock-sheet').waitFor();
await page.evaluate(()=>{
  window.stockPrinterWrites=[];window.stockPrinterPicks=0;window.stockPrinterFail=false;
  const char={properties:{write:true},async writeValue(bytes){
    if(window.stockPrinterFail)throw Error('Disconnected');
    window.stockPrinterWrites.push(Array.from(bytes));
  }};
  const server={getPrimaryServices:async()=>[{getCharacteristics:async()=>[char]}]};
  const device={gatt:{connected:true,connect:async()=>server}};
  Object.defineProperty(navigator,'bluetooth',{configurable:true,value:{requestDevice:async()=>{window.stockPrinterPicks++;return device;}}});
  window.print=()=>{throw Error('Browser PDF dialog must not be used');};
  const draw=CanvasRenderingContext2D.prototype.fillText;
  window.stockPrinterLabels=[];
  CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.stockPrinterLabels.push(String(text));return draw.call(this,text,...args);};
});
await page.getByRole('button',{name:'Print',exact:true}).click();
await page.locator('#stock-sheet-print-root').waitFor({state:'detached'});
assert.equal(await page.locator('select').filter({has:page.locator('option[value="999"]')}).inputValue(),'999');
const printed=await page.evaluate(()=>({picks:window.stockPrinterPicks,bytes:window.stockPrinterWrites.flat(),labels:window.stockPrinterLabels}));
assert.equal(printed.picks,1);assert.ok(printed.bytes.length>1000);
assert.deepEqual(printed.bytes.slice(0,13),[27,64,27,97,1,29,118,48,0,72,0,printed.bytes[11],printed.bytes[12]]);
assert.ok(printed.labels.includes('Print Check Case'));assert.ok(printed.labels.includes('10'));assert.ok(printed.labels.includes('3'));assert.ok(printed.labels.includes('7'));
await page.getByRole('button',{name:'Stock view',exact:true}).click();
await page.evaluate(()=>{window.stockPrinterFail=true;});
await page.getByRole('button',{name:'Print',exact:true}).click();
await page.getByText(/Printer connection interrupted/).first().waitFor();
assert.equal(await page.locator('#stock-sheet-print-root').count(),1);
await page.evaluate(()=>{window.stockPrinterFail=false;});
await page.getByRole('button',{name:'Print',exact:true}).click();
await page.locator('#stock-sheet-print-root').waitFor({state:'detached'});
console.log('PASS: Direct Bluetooth 576-dot stock report, visible product/counts preserved, no PDF dialog, return only after writes, failure remains open and retry succeeds.');
}finally{await browser.close();}


});

