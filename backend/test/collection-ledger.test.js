import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionLedger} from '../collection-ledger.js';
const sale=(credit,old=0,allocated=0,refunded=0)=>({credit_paid:String(credit),old_credit_paid:String(old),allocated:String(allocated),refunded:String(refunded)});
test('recorded bill-time old credit explains the reported local mismatches exactly',()=>{
 assert.equal(collectionLedger('0',[sale('122.64','52.92','35.28')]).balance,3444);
 assert.equal(collectionLedger('0',[sale('112.52','76.40')]).balance,3612);
});
test('FIFO applies old credit to opening before oldest invoices',()=>{
 const ledger=collectionLedger('40',[sale('100'),sale('50'),sale('0','60')]);
 assert.equal(ledger.opening,0);assert.deepEqual(ledger.invoices.map(s=>s.outstanding),[8000,5000,0]);assert.equal(ledger.balance,13000);
});
test('repeated collections do not consume old credit twice',()=>{
 const ledger=collectionLedger('40',[sale('100',0,'80'),sale('50',0,'20'),sale('0','60')]);
 assert.equal(ledger.balance,3000);assert.deepEqual(ledger.invoices.map(s=>s.outstanding),[0,3000,0]);
});
test('partial opening collections retain the correct old-credit offset',()=>{
 assert.equal(collectionLedger('100',[sale('0','30')]).opening,7000);
 assert.equal(collectionLedger('80',[sale('0','30')]).opening,5000);
 assert.equal(collectionLedger('30',[sale('0','30')]).opening,0);
});
test('ordinary payments and refunds retain existing arithmetic',()=>{
 const ledger=collectionLedger('5',[sale('20',0,'10','3')]);
 assert.equal(ledger.balance,1800);assert.equal(ledger.opening,500);
});
test('invalid allocations and excess old credit stay blocked',()=>{
 assert.throws(()=>collectionLedger('0',[sale('10',0,'11')]),/reconciliation/);
 assert.throws(()=>collectionLedger('0',[sale('10','11')]),/reconciliation/);
 assert.throws(()=>collectionLedger('0',[sale('10','-1')]),/nonnegative/);
});
