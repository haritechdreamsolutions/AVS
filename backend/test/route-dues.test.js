import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {routeDuesHandler,routeDuesSQL} from '../route-dues.js';

function response() {return {code:200,headers:{},status(n){this.code=n;return this;},set(k,v){this.headers[k]=v;return this;},json(data){this.data=data;return this;}};}
test('summary uses authenticated company and returns every query row including empty routes',async()=>{
 const rows=[{id:1,total:'0',shops:[]},{id:2,total:'12.30'}];
 const res=response();
 await routeDuesHandler(async(sql,args)=>{assert.equal(sql,routeDuesSQL);assert.deepEqual(args,[7,null]);return {rows};})({params:{},session:{companyId:7}},res,assert.fail);
 assert.deepEqual(res.data,rows);assert.equal(res.headers['Cache-Control'],'no-store');
});
test('detail uses parameterized company and route, preserving decimal strings',async()=>{
 const row={id:12,total:'90071992547409.91',shops:[{id:1,name:'Same name',balance:'0.01'},{id:2,name:'Same name',balance:'90071992547409.90'}]};
 const res=response();await routeDuesHandler(async(sql,args)=>{assert.deepEqual(args,[7,12]);return {rows:[row]};})({params:{routeId:'12'},session:{companyId:7}},res,assert.fail);
 assert.deepEqual(res.data,row);
});
for(const routeId of ['0','-1','1.5','1 OR 1=1','2147483648','01','NaN'])test(`reject invalid identifier ${routeId}`,async()=>{
 const res=response();await routeDuesHandler(()=>assert.fail('must not query'))({params:{routeId},session:{companyId:7}},res,assert.fail);assert.equal(res.code,400);
});
test('unknown and cross-company routes return 404, valid empty route returns 200',async()=>{
 for(const rows of [[],[{id:1,total:'0',shops:[]}]]) {
  const res=response();await routeDuesHandler(async()=>({rows}))({params:{routeId:'1'},session:{companyId:7}},res,assert.fail);
  assert.equal(res.code,rows.length?200:404);
 }
});
test('database failure propagates instead of returning zero',async()=>{
 const failure=new Error('database offline');const res=response();let caught;
 await routeDuesHandler(async()=>{throw failure;})({params:{},session:{companyId:7}},res,e=>caught=e);
 assert.equal(caught,failure);assert.equal(res.data,undefined);
});
test('query is read only, positive-only, company scoped, deterministic and uses unique shop rows',()=>{
 assert.doesNotMatch(routeDuesSQL,/\b(INSERT|UPDATE|DELETE|ALTER|CREATE)\b/i);
 for(const fragment of ['s.company_id=$1','r.company_id=$1','e.company_id=$1','s.current_due>0','COALESCE(v.route_id,s.route_id)','ORDER BY r.code,r.name,r.id','ORDER BY p.name,p.id','SUM(current_due)','r.is_active=TRUE','f.count=1','f.count,0)>1'])assert.ok(routeDuesSQL.includes(fragment),fragment);
 assert.doesNotMatch(routeDuesSQL,/JOIN sales|JOIN receipt/);
});
test('both endpoints explicitly require OWNER',async()=>{
 const routes=await readFile(new URL('../routes.js',import.meta.url),'utf8');
 for(const path of ['/owner/route-dues','/owner/route-dues/:routeId'])assert.ok(routes.includes(`router.get('${path}', requireRole('OWNER'), routeDuesHandler(db.query))`));
});
test('currency formatter preserves exact decimals',async()=>{
 const source=await readFile(new URL('../../frontend/src/components/Owner/RouteBasedDues.jsx',import.meta.url),'utf8');
 const body=source.slice(source.indexOf('export function duesCurrency'),source.indexOf("const endpoint=" )).replace('export ','');
 const format=new Function(`${body};return duesCurrency;`)();
 assert.equal(format('90071992547409.91'),'₹9,00,71,99,25,47,409.91');assert.equal(format('0'),'₹0.00');assert.equal(format('0.01'),'₹0.01');
});
