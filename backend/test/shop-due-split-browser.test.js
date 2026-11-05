import test from 'node:test';import assert from 'node:assert/strict';
import {writeFile,unlink}from'node:fs/promises';import{fileURLToPath}from'node:url';
import{chromium}from'@playwright/test';import{createServer}from'../../frontend/node_modules/vite/dist/node/index.js';
test('owner split collection previews unpaid credit and submits only received cash/UPI',async()=>{
 const file=new URL('../../frontend/due-split-check.html',import.meta.url);
 const vite=await createServer({configFile:false,root:fileURLToPath(new URL('../../frontend',import.meta.url)),optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','lucide-react','sonner']},plugins:[{name:'test-context',enforce:'pre',transform(code,id){if(id.replaceAll('\\','/').endsWith('/src/context/AppContext.jsx'))return code+'\nexport{AppContext as TestAppContext};';}}],server:{host:'127.0.0.1',port:0}});let browser;
 try{
  await writeFile(file,`<div id="root"></div><script type="module">
import React,{useState}from'react';import{createRoot}from'react-dom/client';import{TestAppContext}from'/src/context/AppContext.jsx';import{ShopsManagementView}from'/src/components/Owner/ShopsManagementView.jsx';
function Harness(){const[shops,setShops]=useState([{id:1,name:'Split Shop',code:'S1',current_due:1200}]);window.reset=()=>setShops([{id:1,name:'Split Shop',code:'S1',current_due:1200}]);return React.createElement(TestAppContext.Provider,{value:{shops,setShops,villages:[],routes:[],sales:[],refreshData:async()=>{},collectShopDue:async(id,data)=>{window.submitted=data;const remainingDue=1200-data.amount;setShops(s=>s.map(x=>({...x,current_due:remainingDue})));return{success:true,remainingDue};}}},React.createElement(ShopsManagementView));}createRoot(document.getElementById('root')).render(React.createElement(Harness));
</script>`);
  await vite.listen();browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/due-split-check.html`);
  for(const [cash,gpay]of[['1000',''],['','1000'],['600','400']]){
   await page.getByRole('button',{name:'Collect Due',exact:true}).click();await page.getByRole('button',{name:'Split',exact:true}).click();
   await page.getByLabel('Split cash received').fill(cash);await page.getByLabel('Split GPay received').fill(gpay);
   assert.equal(await page.getByTestId('remaining-credit').innerText(),'₹200.00');
   await page.getByRole('button',{name:'RECORD PAYMENT & UPDATE DUE',exact:true}).click();await page.getByRole('heading',{name:'Collect Store Due Payment'}).waitFor({state:'detached'});
   const data=await page.evaluate(()=>window.submitted);assert.equal(data.mode,'SPLIT');assert.equal(data.amount,1000);assert.equal(data.cash_amount,Number(cash));assert.equal(data.gpay_amount,Number(gpay));
   await page.getByRole('button',{name:'Collect Due',exact:true}).click();assert.match(await page.locator('body').innerText(),/200/);await page.getByRole('button',{name:'Cancel',exact:true}).click();
   await page.evaluate(()=>window.reset());
  }
  await page.getByRole('button',{name:'Collect Due',exact:true}).click();await page.getByRole('button',{name:'Split',exact:true}).click();
  await page.getByLabel('Split cash received').fill('1300');assert.equal(await page.getByRole('button',{name:'RECORD PAYMENT & UPDATE DUE',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:/GPay \/ UPI/}).click();await page.getByLabel('Payment received amount').fill('1000');
  await page.getByRole('button',{name:'RECORD PAYMENT & UPDATE DUE',exact:true}).click();assert.equal((await page.evaluate(()=>window.submitted)).mode,'GPAY');
 }finally{if(browser)await browser.close();await vite.close();await unlink(file).catch(()=>{});}
});
