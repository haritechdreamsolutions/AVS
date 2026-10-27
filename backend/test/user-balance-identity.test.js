import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBalanceUsers, getBalanceRecordKey } from '../../frontend/src/utils/userBalanceIdentity.js';

test('same-name current and former users remain separate by employee ID', () => {
  const old = {employee_id:10,employee_name:'Akash',total_amount:100};
  const current = {employee_id:20,employee_name:'Akash',total_amount:200};
  const people = buildBalanceUsers({employees:[{id:20,full_name:'Akash'}],users:[{id:50,employee_id:20,name:'Akash',role:'DRIVER',account_status:'ACTIVE'}],sales:[old,current]});
  assert.equal(people.find(u => u.id === '10').isHistorical,true);
  assert.equal(people.find(u => u.id === '20').isHistorical,false);
  const totals = new Map();
  for (const row of [old,current]) totals.set(getBalanceRecordKey(row),(totals.get(getBalanceRecordKey(row)) || 0) + row.total_amount);
  assert.equal(totals.get('10'),100);
  assert.equal(totals.get('20'),200);
  assert.equal([old,current].filter(row => getBalanceRecordKey(row) === '20').length,1);
});

test('a current account ID never impersonates an old employee ID', () => {
  const people = buildBalanceUsers({users:[{id:10,name:'New user',role:'EMPLOYEE',account_status:'ACTIVE'}],sales:[{employee_id:10,employee_name:'Former user'}]});
  assert.equal(people.find(u => u.id === 'USER_10').name,'New user');
  assert.equal(people.find(u => u.id === '10').name,'Former user');
});

test('current users remain visible without history; inactive users need history', () => {
  const people = buildBalanceUsers({employees:[{id:1,full_name:'Current'},{id:2,full_name:'Inactive',is_active:false},{id:3,full_name:'Suspended'}],users:[{id:10,employee_id:3,name:'Suspended',role:'DRIVER',account_status:'SUSPENDED'}]});
  assert.ok(people.some(u => u.id === '1'));
  assert.equal(people.some(u => u.id === '2' || u.id === '3'),false);
});

test('active owner, administrator and store keeper accounts also appear without inventing employee IDs', () => {
  const users = [{id:1,role:'OWNER',name:'Administrator',is_system_administrator:true,account_status:'ACTIVE'},
    {id:2,role:'STORE_KEEPER',name:'Current keeper',account_status:'ACTIVE'},
    {id:3,role:'OWNER',name:'Old owner',account_status:'INACTIVE'}];
  const people = buildBalanceUsers({users});
  assert.equal(people.find(u => u.id === 'USER_1').name,'Administrator');
  assert.equal(people.find(u => u.id === 'USER_2').name,'Current keeper');
  assert.equal(people.some(u => u.id === 'USER_3'),false);
});

test('former users with only expenses, damages or shortages keep their own records', () => {
  const records = [{employee_id:11,employee_name:'Expense only',expense_date:'2026-10-27',amount:25},{employee_id:12,employee_name:'Damage only',base_quantity:4},{driver_id:13,driver_name:'Shortage only',missing_quantity:2}];
  const people = buildBalanceUsers({expenses:[records[0]],damages:[records[1]],shortages:[records[2]]});
  for (const record of records) assert.equal(people.find(u => u.id === getBalanceRecordKey(record)).isHistorical,true);
});

test('driver and employee sources merge by ID while duplicate names stay distinct', () => {
  const people = buildBalanceUsers({employees:[{id:5,full_name:'Same name'},{id:6,full_name:'Same name'}],drivers:[{id:5,employee_id:5,full_name:'Same name',user_account_id:100}],users:[{id:100,employee_id:5,name:'Renamed current user',role:'DRIVER',account_status:'ACTIVE'}]});
  assert.equal(people.filter(u => u.id === '5').length,1);
  assert.equal(people.find(u => u.id === '5').name,'Renamed current user');
  assert.ok(people.some(u => u.id === '6'));
});

test('name-only history stays separate from newly created users with the same name', () => {
  const row = {employee_name:'Akash'};
  const people = buildBalanceUsers({employees:[{id:20,full_name:'Akash'}],sales:[row]});
  assert.equal(getBalanceRecordKey(row),'NAME_akash');
  assert.ok(people.find(u => u.id === 'NAME_akash').isHistorical);
  assert.equal(people.find(u => u.id === '20').isHistorical,false);
});

test('counter attribution uses recorded context, not magic employee IDs or substrings', () => {
  assert.equal(getBalanceRecordKey({employee_id:6,employee_name:'Real driver'}),'6');
  assert.equal(getBalanceRecordKey({employee_id:8,employee_name:'Store Kumar',is_store_direct_sale:true}),'8');
  assert.equal(getBalanceRecordKey({employee_name:'Store Keeper POS',is_store_direct_sale:true}),'STORE');
  assert.equal(getBalanceRecordKey({employee_name:'Fuel expense',expense_date:'2026-10-27'}),'STORE');
});
