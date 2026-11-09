import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {createServer} from '../../frontend/node_modules/vite/dist/node/index.js';
import bcrypt from '../node_modules/bcrypt/bcrypt.js';
if(!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL||''))throw Error('Isolated test database required');
process.env.DATABASE_URL=process.env.AVS_TEST_DATABASE_URL;process.env.AVS_NO_LISTEN='1';process.env.NODE_ENV='development';
const {pool}=await import('../database/pg_pool.js');const {migrate}=await import('../database/migrate.js');await migrate();
const tenant=(await pool.query("INSERT INTO companies(name) VALUES('Synthetic purchase UI') RETURNING id")).rows[0].id;
const password='Synthetic-12345',hash=await bcrypt.hash(password,4);
const ids={};
for(const role of ['OWNER','STORE_KEEPER']){
 const login=role.toLowerCase()+'-'+randomUUID();ids[role]={login};
 await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash,credential_kind) VALUES($1,(SELECT id FROM roles WHERE role_name=$2),$3,$2,$4,'password')",[tenant,role,login,hash]);
}
const vite=await createServer({configFile:false,root:fileURLToPath(new URL('../../frontend',import.meta.url)),plugins:[{name:'test-context',enforce:'pre',transform(code,id){if(id.replaceAll('\\','/').endsWith('/src/context/AppContext.jsx'))return code+'\nexport {AppContext as TestAppContext};';}}],server:{host:'127.0.0.1',port:0}});
await vite.listen();const origin=`http://127.0.0.1:${vite.httpServer.address().port}`;process.env.FRONTEND_URL=origin;
const {app}=await import('../index.js');const api=app.listen(0,'127.0.0.1');await new Promise(r=>api.once('listening',r));
// Use a proxy middleware registered before Vite fallback through a plugin-free HTTP forwarder.
const {default:http}=await import('node:http');
const proxy=http.createServer((req,res)=>{
 const target=req.url.startsWith('/api/')?api.address().port:vite.httpServer.address().port;
 const remote=http.request({hostname:'127.0.0.1',port:target,path:req.url,method:req.method,headers:{...req.headers,origin:origin}},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});req.pipe(remote);remote.on('error',()=>{res.statusCode=502;res.end();});
});proxy.listen(0,'127.0.0.1');await new Promise(r=>proxy.once('listening',r));const base=`http://127.0.0.1:${proxy.address().port}`;
const harness=new URL('../../frontend/purchase-ui-check.html',import.meta.url);
await writeFile(harness,`<html><body style="margin:0;background:#e8f4fa;font-family:Arial"><div id="root"></div><script type="module">
import React,{useState,useEffect}from'react';import{createRoot}from'react-dom/client';
import{TestAppContext,apiFetch}from'/src/context/AppContext.jsx';import{OwnerSuppliersView}from'/src/components/Owner/OwnerSuppliersView.jsx';import{StockReceiveModal}from'/src/components/StoreKeeper/StockReceiveModal.jsx';
function Harness(){const[suppliers,setSuppliers]=useState([]),[closed,setClosed]=useState(false);const refresh=async()=>{const r=await apiFetch('/api/suppliers');const list=await r.json();setSuppliers(list);return list;};useEffect(()=>{refresh();},[]);const receive=async data=>{const r=await apiFetch('/api/inventory/receive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return r.json();};return React.createElement(TestAppContext.Provider,{value:{apiFetch,API_URL:'/api',refreshData:refresh,suppliers:[{id:999999,name:'Cached phantom',is_active:true},...suppliers],products:[],fetchSuppliers:refresh,receiveDealerStock:receive}},location.search.includes('keeper')?(closed?React.createElement('p',null,'Stock received and modal closed'):React.createElement(StockReceiveModal,{onClose:()=>setClosed(true)})):React.createElement(OwnerSuppliersView));}createRoot(document.getElementById('root')).render(React.createElement(Harness));
</script></body></html>`);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const ownerContext=await browser.newContext({viewport:{width:1440,height:1000}}),keeperContext=await browser.newContext({viewport:{width:1440,height:1000}});
 async function login(context,role){const csrf=await(await context.request.get(base+'/api/auth/csrf')).json();const r=await context.request.post(base+'/api/auth/login',{headers:{'X-CSRF-Token':csrf.csrfToken},data:{login_id:ids[role].login,pin:password}});assert.equal(r.status(),200,await r.text());}
 await login(ownerContext,'OWNER');await login(keeperContext,'STORE_KEEPER');
 const owner=await ownerContext.newPage(),keeper=await keeperContext.newPage();const errors=[];owner.on('pageerror',e=>errors.push(e.message));keeper.on('pageerror',e=>errors.push(e.message));
 const image=await owner.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=100;canvas.height=100;const c=canvas.getContext('2d');c.fillStyle='#198b66';c.fillRect(0,0,100,100);return canvas.toDataURL('image/png');});
 const csrf=await(await ownerContext.request.get(base+'/api/auth/csrf')).json();
 const masters=[];
 for(const [name,unit,ppu,rate] of [['Master Milk','Tray',12,120],['Milk Case','Case',1,250],['Spare Box','Box',1,90]]){
  const response=await ownerContext.request.post(base+'/api/products',{headers:{'X-CSRF-Token':csrf.csrfToken},data:{name,display_name:name,sku:randomUUID(),selling_unit:unit,base_unit:unit==='Tray'?'Piece':unit,pieces_per_unit:ppu,purchase_price:rate,image_url:image}});
  assert.equal(response.status(),200,await response.text());masters.push((await response.json()).product);
 }
 await owner.goto(base+'/purchase-ui-check.html');
 async function company(name){await owner.getByRole('button',{name:'Add company',exact:true}).click();const modal=owner.getByRole('dialog');await modal.getByLabel('Company name',{exact:true}).fill(name);await modal.getByLabel('Manager name',{exact:true}).fill('Manager '+name);await modal.getByLabel('Manager phone',{exact:true}).fill('9876543210');await modal.getByRole('button',{name:'Save company',exact:true}).click();await modal.waitFor({state:'detached'});await owner.getByRole('switch',{name:'Activate Master Milk',exact:true}).waitFor();}
 await company('Alpha Dairy');assert.equal(await owner.getByRole('button',{name:'Add product',exact:true}).count(),0);assert.equal(await owner.getByRole('switch').count(),3);
 await owner.getByRole('button',{name:'Edit rates Master Milk',exact:true}).click();let modal=owner.getByRole('dialog');
 assert.equal(await modal.getByLabel('Product name',{exact:true}).count(),0);
 await modal.getByLabel('Purchase rate / Tray',{exact:false}).fill('240');assert.equal(await modal.getByLabel('Purchase rate / piece',{exact:false}).inputValue(),'20.00');
 await modal.getByLabel('Purchase rate / Tray',{exact:false}).fill('120');await modal.getByLabel('Purchase rate / piece',{exact:false}).fill('11');await modal.getByRole('button',{name:'Save & activate',exact:true}).click();await modal.waitFor({state:'detached'});
 await owner.getByRole('switch',{name:'Deactivate Master Milk',exact:true}).waitFor();
 await company('Beta Foods');
 const toggleRequests=[];const recordToggle=request=>toggleRequests.push(new URL(request.url()).pathname);owner.on('request',recordToggle);
 const toggleStart=performance.now();
 await owner.getByRole('switch',{name:'Activate Milk Case',exact:true}).click();await owner.getByRole('switch',{name:'Deactivate Milk Case',exact:true}).waitFor();
 owner.off('request',recordToggle);
 assert.ok(!toggleRequests.some(path=>path==='/api/products'||path==='/api/suppliers'||path==='/api/dashboard/summary'),'Toggle must not refetch the app directory');
 console.log('Company activation UI update: '+Math.round(performance.now()-toggleStart)+'ms');
 assert.equal((await pool.query('SELECT COUNT(*)::int n FROM products WHERE company_id=$1',[tenant])).rows[0].n,3);
 assert.equal(Number((await pool.query('SELECT warehouse_stock_units FROM products WHERE id=$1',[masters[0].id])).rows[0].warehouse_stock_units),0);
 await owner.screenshot({path:'.tmp/existing-company-products.png',fullPage:true});
 await keeper.goto(base+'/purchase-ui-check.html?keeper');await keeper.getByText('Master Milk',{exact:true}).waitFor();
 assert.equal(await keeper.getByText('Milk Case',{exact:true}).count(),0);assert.equal(await keeper.getByText('Spare Box',{exact:true}).count(),0);assert.equal(await keeper.locator('input[type=number]').count(),2);
 const photo=keeper.locator('img[alt="Master Milk"]');assert.equal(await photo.getAttribute('src'),image);await photo.evaluate(img=>img.decode());
 assert.equal(await keeper.locator('select option').filter({hasText:'Cached phantom'}).count(),0);
 const betaId=await keeper.locator('select option').filter({hasText:'Beta Foods'}).getAttribute('value');const alphaId=await keeper.locator('select option').filter({hasText:'Alpha Dairy'}).getAttribute('value');
 await keeper.locator('select').first().selectOption(betaId);await keeper.getByText('Milk Case',{exact:true}).waitFor();assert.equal(await keeper.locator('input[type=number]').count(),1);assert.equal(await keeper.getByText('PCS',{exact:true}).count(),0);
 await keeper.locator('select').first().selectOption(alphaId);await keeper.getByText('Master Milk',{exact:true}).waitFor();const inputs=keeper.locator('input[type=number]');await inputs.nth(0).fill('1');await inputs.nth(1).fill('2');
 await keeper.getByText('142.00',{exact:false}).first().waitFor();await keeper.getByRole('button',{name:'CONFIRM STOCK RECEIVE',exact:false}).click();await keeper.getByText('Stock received and modal closed',{exact:true}).waitFor();
 assert.equal(Math.round(Number((await pool.query('SELECT warehouse_stock_units FROM products WHERE id=$1',[masters[0].id])).rows[0].warehouse_stock_units)*12),14);
 await owner.getByRole('button',{name:'Purchase history',exact:true}).click();await owner.getByLabel('Filter company').selectOption(alphaId);await owner.getByRole('cell',{name:'Master Milk',exact:true}).waitFor();
 assert.deepEqual(await owner.locator('.ci-report-table thead th').allTextContents(),['Date','Product name','Qty','Litres','Rate','Total amount']);assert.match(await owner.locator('.ci-report-table tbody').innerText(),/1 Tray \+ 2 Pcs/);assert.match(await owner.locator('.ci-report-table tfoot').innerText(),/142.00/);
 const options=await owner.getByLabel('Filter product').locator('option').allTextContents();assert.ok(options.includes('Master Milk'));assert.ok(!options.includes('Milk Case'));assert.ok(!options.includes('Spare Box'));
 await owner.getByLabel('From date',{exact:true}).fill('2000-01-01');await owner.getByLabel('To date',{exact:true}).fill('2000-01-02');await owner.getByText('No purchases match these filters.',{exact:true}).waitFor();
 await owner.getByLabel('From date',{exact:true}).fill('');await owner.getByLabel('To date',{exact:true}).fill(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date()));await owner.getByRole('cell',{name:'Master Milk',exact:true}).waitFor();
 await owner.evaluate(()=>{window.print=()=>{window.printInvoked=true;};});await owner.getByRole('button',{name:'Print A4',exact:true}).click();await owner.waitForFunction(()=>window.printInvoked);await owner.emulateMedia({media:'print'});assert.equal(await owner.locator('#ci-purchase-print').evaluate(e=>getComputedStyle(e).display),'block');assert.equal(await owner.locator('#ci-purchase-print h1').innerText(),'Alpha Dairy');assert.equal(await owner.locator('#ci-purchase-print h2,#ci-purchase-print .ci-print-meta').count(),0);assert.ok(await owner.locator('#ci-purchase-print tbody td').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=14));await owner.screenshot({path:'.tmp/company-only-a4-preview.png',fullPage:true});await owner.pdf({path:'.tmp/existing-products-report-a4.pdf',preferCSSPageSize:true});await owner.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await owner.emulateMedia({media:'screen'});
 await owner.getByRole('button',{name:'Companies & products',exact:true}).click();const alphaCard=owner.locator('.ci-company-card').filter({has:owner.getByRole('heading',{name:'Alpha Dairy',exact:true})});await alphaCard.getByRole('button',{name:'View products',exact:true}).click();
 await owner.getByRole('switch',{name:'Deactivate Master Milk',exact:true}).click();await owner.getByRole('switch',{name:'Activate Master Milk',exact:true}).waitFor();
 await keeper.reload();await keeper.getByText('No active products for this company. Ask the owner to activate existing products in Companies & Inward.',{exact:true}).waitFor();assert.equal(await keeper.locator('input[type=number]').count(),0);
 await owner.getByRole('button',{name:'Purchase history',exact:true}).click();
 await owner.waitForFunction(()=>!document.querySelector('select[aria-label="Filter product"]').disabled);
 assert.deepEqual(await owner.getByLabel('Filter product').locator('option').allTextContents(),['All products']);
 await owner.getByText('No purchases match these filters.',{exact:true}).waitFor();assert.match(await owner.locator('.ci-report-table tfoot').innerText(),/0.00/);
 await owner.getByRole('button',{name:'Companies & products',exact:true}).click();

 await owner.getByRole('switch',{name:'Activate Master Milk',exact:true}).click();await owner.getByRole('switch',{name:'Deactivate Master Milk',exact:true}).waitFor();await keeper.reload();await keeper.getByText('Master Milk',{exact:true}).waitFor();await keeper.getByText('11.00',{exact:false}).waitFor();
 assert.equal(Math.round(Number((await pool.query('SELECT warehouse_stock_units FROM products WHERE id=$1',[masters[0].id])).rows[0].warehouse_stock_units)*12),14);
 for(const width of [320,390,768,1440]){await owner.setViewportSize({width,height:900});assert.equal(await owner.locator('.ci-page').evaluate(e=>e.scrollWidth<=e.clientWidth),true);}
 await owner.getByRole('button',{name:'Purchase history',exact:true}).click();await owner.getByRole('cell',{name:'Master Milk',exact:true}).waitFor();assert.match(await owner.locator('.ci-report-table tfoot').innerText(),/142.00/);
 const denied=await keeperContext.request.post(base+'/api/suppliers',{headers:{'X-CSRF-Token':(await(await keeperContext.request.get(base+'/api/auth/csrf')).json()).csrfToken},data:{name:'Forbidden'}});assert.equal(denied.status(),403);
 assert.deepEqual(errors,[]);console.log('PASS: existing master products only, per-company activation/deactivation, preserved rates/images, company-scoped receiving, exact stock update, date/product filtered history, A4 and mobile layout');
}catch(e){let i=0;for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:'.tmp/purchase-test-error-'+(++i)+'.png',fullPage:true}).catch(()=>{});throw e;}finally{await browser.close();await unlink(harness).catch(()=>{});await vite.close();await new Promise(r=>proxy.close(r));await new Promise(r=>api.close(r));await pool.end();}
