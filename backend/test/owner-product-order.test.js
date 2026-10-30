import test from 'node:test';
import assert from 'node:assert/strict';
import {sortOwnerProducts} from '../../frontend/src/utils/ownerProductOrder.js';
test('owner product order follows sizes, new products and removals without mutating input',()=>{
 const names=['milk 200ml','curd 200ml','milk 500ml','curd 500ml','TM milk 500ml','FCM milk 1000ml','curd 100ml','curd 1000ml','curd 5000ml','buttermilk 200ml','buttermilk 500ml','Cooldrink 200ml','Water 300ml','Water 500ml','Water 1ltr'];
 const products=names.map((name,id)=>({name,id})).reverse();
 assert.deepEqual(sortOwnerProducts(products).map(p=>p.name),names);
 assert.equal(products[0].name,'Water 1ltr');
 assert.deepEqual(sortOwnerProducts(products.filter(p=>p.name!=='milk 500ml')).map(p=>p.name),names.filter(n=>n!=='milk 500ml'));
 const added=sortOwnerProducts([...products,{id:99,name:'New Brand milk 200ml'}]);
 assert.equal(added.findIndex(p=>p.id===99),1);
});
