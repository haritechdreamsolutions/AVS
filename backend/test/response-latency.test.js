import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../../frontend/src/context/AppContext.jsx',import.meta.url),'utf8');
test('confirmed allocation returns without waiting for background masters refresh',async()=>{
 const a=source.indexOf('  const allocateStock ='),b=source.indexOf('  const processDriverReturn',a);
 let modules;
 const context=vm.createContext({
 apiFetch:async()=>({json:async()=>({success:true,message:'Allocated'})}),
 API_URL:'/api',fetchData:names=>{modules=names;return new Promise(()=>{});}
 });
 const allocate=vm.runInContext(source.slice(a,b)+';allocateStock',context);
 const result=await Promise.race([allocate({employee_id:7,items:[]}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Allocation waited for refresh')),500))]);
 assert.equal(result.success,true);
 assert.ok(modules.includes('products'));assert.ok(!modules.includes('shops'));
});
test('rejected allocation never starts a stock refresh',async()=>{
 const a=source.indexOf('  const allocateStock ='),b=source.indexOf('  const processDriverReturn',a);
 let refreshed=false;
 const context=vm.createContext({apiFetch:async()=>({json:async()=>({success:false,message:'Not available'})}),API_URL:'/api',fetchData:()=>{refreshed=true;}});
 const allocate=vm.runInContext(source.slice(a,b)+';allocateStock',context);
 assert.equal((await allocate({})).success,false);assert.equal(refreshed,false);
});
