import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {createServer} from '../../frontend/node_modules/vite/dist/node/index.js';

test('shop Done badges reset at IST midnight and follow only today active bills',async()=>{
 const harness=new URL('../../frontend/shop-day-check.html',import.meta.url);
 const saveHarness=new URL('../../frontend/shop-save-check.html',import.meta.url);
 const vite=await createServer({configFile:false,root:fileURLToPath(new URL('../../frontend',import.meta.url)),optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','lucide-react','sonner']},plugins:[{name:'test-context',enforce:'pre',transform(code,id){if(id.replaceAll('\\','/').endsWith('/src/context/AppContext.jsx'))return code+'\nexport {AppContext as TestAppContext};';}}],server:{host:'127.0.0.1',port:0}});
 let browser;
 try{
  await writeFile(harness,`<div id="root"></div><script type="module">
import React from 'react';import{createRoot}from'react-dom/client';import{TestAppContext}from'/src/context/AppContext.jsx';import{ShopSelection}from'/src/components/Employee/ShopSelection.jsx';
const root=createRoot(document.getElementById('root'));const shops=[1,2,3].map(id=>({id,name:'Shop '+id,village_id:1,completed:true}));
window.renderSales=sales=>root.render(React.createElement(TestAppContext.Provider,{value:{shops,villages:[{id:1,name:'Village'}],sales}},React.createElement(ShopSelection,{selectedVillage:{id:1,name:'Village'},onSelectShop:()=>{}})));
window.renderSales([{shop_id:1,sale_date:'2026-11-04'},{shop_id:2,sale_date:'2026-11-05'},{shop_id:3,sale_date:'2026-11-05',status:'CANCELLED'}]);
</script>`);
  await vite.listen();browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();
  await page.clock.install({time:new Date('2026-11-05T23:59:59+05:30')});
  await page.clock.pauseAt(new Date('2026-11-05T23:59:59+05:30'));
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/shop-day-check.html`);
  await page.getByText('Shop 2',{exact:true}).waitFor();
  assert.equal(await page.getByText('Done',{exact:true}).count(),1);
  await page.clock.runFor(1500);
  assert.equal(await page.getByText('Done',{exact:true}).count(),0);
  await page.evaluate(()=>window.renderSales([{shop_id:1,sale_date:'2026-11-04'},{shop_id:2,sale_date:'2026-11-05'},{shop_id:3,sale_date:'2026-11-06'}]));
  await page.getByText('Done',{exact:true}).waitFor();
  assert.equal(await page.getByText('Done',{exact:true}).count(),1);
  await page.clock.setSystemTime(new Date('2026-11-07T08:00:00+05:30'));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByText('Done',{exact:true}).waitFor({state:'detached'});
  assert.equal(await page.getByText('Done',{exact:true}).count(),0);
  // Exercise the actual provider: successful POST followed by an unrelated refresh failure.
  await writeFile(saveHarness,`<div id="root"></div><script type="module">
import React from 'react';import{createRoot}from'react-dom/client';import{AppProvider,useApp}from'/src/context/AppContext.jsx';import{ShopSelection}from'/src/components/Employee/ShopSelection.jsx';
function Harness(){const app=useApp();window.testApp=app;return React.createElement(ShopSelection,{selectedVillage:{id:1,name:'Village'},onSelectShop:()=>{}});}createRoot(document.getElementById('root')).render(React.createElement(AppProvider,null,React.createElement(Harness)));
</script>`);
  let saved=false,failSale=false;
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   let body=[];let status=200;
   if(path.endsWith('/auth/me'))body={success:true,user:{id:1,employee_id:1,role:'DRIVER',name:'Test'}};
   else if(path.endsWith('/auth/csrf'))body={csrfToken:'test'};
   else if(path.endsWith('/sales')&&route.request().method()==='POST'){
    if(failSale){status=400;body={success:false,message:'Rejected'};}
    else{saved=true;body={success:true,sale:{id:55,bill_no:'TEST-55',shop_id:2,sale_date:'2026-11-07',total_amount:20,credit_paid:20,payment_mode:'CREDIT',shop_current_due:20,items:[]}};}
   }else if(path.endsWith('/products')&&saved){status=500;body={message:'Synthetic refresh failure'};}
   else if(path.endsWith('/shops'))body=[1,2,3].map(id=>({id,name:'Shop '+id,village_id:1,current_due:saved&&id===2?40:0}));
   else if(path.endsWith('/villages'))body=[{id:1,name:'Village'}];
   else if(path.endsWith('/sales'))body=saved?[{id:55,shop_id:2,sale_date:'2026-11-07'}]:[];
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/shop-save-check.html`);
  await page.getByText('Shop 2',{exact:true}).waitFor();
  assert.equal(await page.getByText('Done',{exact:true}).count(),0);
  assert.equal((await page.evaluate(()=>window.testApp.createSale({shop_id:2,total_amount:20}))).success,true);
  await page.getByText('Done',{exact:true}).waitFor();
  await page.getByRole('alert').waitFor();
  await page.waitForFunction(()=>window.testApp.shops.find(s=>s.id===2)?.current_due===40);
  assert.equal(await page.getByText('Done',{exact:true}).count(),1);
  failSale=true;
  assert.equal((await page.evaluate(()=>window.testApp.createSale({shop_id:3,total_amount:20}))).success,false);
  assert.equal(await page.getByText('Done',{exact:true}).count(),1);
  // Retrying the same saved invoice does not duplicate it in state.
  failSale=false;
  await page.evaluate(()=>window.testApp.createSale({shop_id:2,total_amount:20}));
  assert.equal(await page.evaluate(()=>window.testApp.sales.filter(s=>s.id===55).length),1);
  await page.clock.runFor(86400000);
  await page.getByText('Done',{exact:true}).waitFor({state:'detached'});
  await page.route('**/api/products',route=>route.fulfill({contentType:'application/json',body:JSON.stringify([{id:1,name:'Item',base_unit:'Piece',selling_unit:'Piece',pieces_per_unit:1,piece_selling_price:10,unit_selling_price:10}])}));
  await page.evaluate(async()=>{
   const React=(await import('/node_modules/.vite/deps/react.js')).default;
   const rootModule=await import('/node_modules/.vite/deps/react-dom_client.js');
   const createRoot=(rootModule.default||rootModule).createRoot;
   const {AppProvider}=await import('/src/context/AppContext.jsx');
   const {PaymentModal}=await import('/src/components/Employee/PaymentModal.jsx');
   document.getElementById('root').style.display='none';
   const container=document.createElement('div');document.body.append(container);
   createRoot(container).render(React.createElement(AppProvider,null,React.createElement(PaymentModal,{billData:{shop_id:2,total_amount:20,previous_due:20,items:[{product_id:1,qty:2,unit_type:'Piece',rate:10}]},onConfirmBill:bill=>{window.confirmedBill=bill;},onBack:()=>{}})));
  });
  await page.getByRole('button').filter({hasText:'40.00'}).click();
  await page.getByRole('button',{name:/CONFIRM & PRINT BILL/}).click();
  await page.waitForFunction(()=>!!window.confirmedBill);
  const payment=await page.evaluate(()=>window.confirmedBill);
  assert.equal(payment.old_credit_paid,20);assert.equal(payment.cash_paid,40);
  assert.equal(payment.clear_previous_due,true);assert.equal(payment.total_amount,20);
 }finally{if(browser)await browser.close();await vite.close();await unlink(harness).catch(()=>{});await unlink(saveHarness).catch(()=>{});}
});
