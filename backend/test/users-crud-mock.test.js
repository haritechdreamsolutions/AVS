import test from 'node:test';
import assert from 'node:assert/strict';
import {pool} from '../database/pg_pool.js';
import * as db from '../db_pg.js';
import {requireRole} from '../security.js';

// Every database request is intercepted. No PostgreSQL connection or record is created.
const originalConnect=pool.connect;
const account={id:404,company_id:12,employee_id:904,role_id:3,role_name:'DRIVER',login_id:'fixture-driver',name:'Fixture Driver',account_status:'INACTIVE'};
const employee={id:904,route_id:204,vehicle_number:null};
let calls=[];
function mock(handler){calls=[];pool.connect=async()=>({release(){},query:async(sql,params=[])=>{calls.push({sql,params});return {rows:await handler(sql,params)};}});}
function normal(sql,p){
 if(sql.startsWith('SELECT ua.*'))return p[0]==account.id&&p[1]===12?[{...account}]:[];
 if(sql.startsWith('SELECT id FROM employees'))return [{...employee}];
 if(sql.startsWith('SELECT id, role_name FROM roles'))return [{id:3,role_name:'DRIVER'}];
 if(sql.startsWith('SELECT vehicle_number'))return [{vehicle_number:null}];
 if(sql.startsWith('UPDATE user_accounts')&&sql.includes('RETURNING'))return [{...account,login_id:p[0],name:p[2],account_status:p[3],employee_id:p[4]}];
 if(sql.includes('FROM sales'))return [{count:0}];
 return [];
}
try{
 await test('Users Master authorization remains owner-only',async()=>{
  for(const role of ['OWNER','STORE_KEEPER','DRIVER','EMPLOYEE']){
   let allowed=false,status=null;
   requireRole('OWNER')({authValidated:true,session:{role}},{sendStatus:value=>{status=value;}},()=>{allowed=true;});
   assert.equal(allowed,role==='OWNER');assert.equal(status,role==='OWNER'?null:403);
  }
 });
 await test('list returns account IDs and joins employee/route details without fixture fallbacks',async()=>{
  mock(sql=>sql.includes('FROM user_accounts ua')?[{id:404,employee_id:904,employee_code:'TEST004',role:'DRIVER',status:'INACTIVE',route_id:204}]:[]);
  const rows=await db.getUsers(12);assert.equal(rows[0].id,404);assert.equal(rows[0].employee_id,904);assert.ok(calls[0].sql.includes('SELECT ua.id'));assert.deepEqual(calls[0].params,[12]);
 });
 await test('linked inactive driver update addresses account and employee separately',async()=>{
  mock(normal);const result=await db.updateUser(12,404,{name:'Fixture edited',employee_id:904,status:'INACTIVE',route_id:204});assert.equal(result.success,true);
  const accountUpdate=calls.find(c=>c.sql.startsWith('UPDATE user_accounts'));assert.equal(accountUpdate.params[5],404);assert.equal(accountUpdate.params[4],904);
  for(const call of calls.filter(c=>c.sql.startsWith('UPDATE employees')))assert.equal(call.params[1],904);
 });
 await test('sales-linked delete preserves account under existing deactivation rule',async()=>{
  mock((sql,p)=>sql.includes('FROM sales')?[{count:2}]:normal(sql,p));const result=await db.deleteUser(12,404,5);assert.match(result.message,/deactivated/);assert.equal(calls.some(c=>c.sql.startsWith('DELETE FROM user_accounts')),false);
 });
 await test('unreferenced user delete targets only selected account ID',async()=>{
  mock(normal);await db.deleteUser(12,404,5);const deletion=calls.find(c=>c.sql.startsWith('DELETE FROM user_accounts'));assert.deepEqual(deletion.params,[404,12]);
 });
 await test('missing or other-company account fails before any mutation',async()=>{
  mock(normal);await assert.rejects(db.updateUser(13,404,{name:'Rejected'}),/not found/);assert.equal(calls.some(c=>/^(INSERT|UPDATE|DELETE)/.test(c.sql)),false);
 });
 await test('duplicate create login and invalid credential are rejected before mutation',async()=>{
  mock((sql)=>sql.startsWith('SELECT * FROM employees')?[employee]:sql.includes('LOWER(login_id)')?[{id:404}]:[]);
  await assert.rejects(db.addUser(12,{employee_id:904,role:'DRIVER',login_id:'fixture-driver',pin:'4567'}),/Login ID already taken/);
  await assert.rejects(db.addUser(12,{employee_id:904,role:'DRIVER',login_id:'fixture-new',pin:'invalid'}),/Driver PIN/);
  assert.equal(calls.some(c=>/^(INSERT|UPDATE|DELETE)/.test(c.sql)),false);
 });
 await test('delete constraint errors propagate without false success',async()=>{
  mock((sql,p)=>{if(sql.startsWith('DELETE FROM user_accounts'))throw Error('Fixture foreign key constraint');return normal(sql,p);});await assert.rejects(db.deleteUser(12,404,5),/Fixture foreign key constraint/);
 });
}finally{pool.connect=originalConnect;await pool.end();}
