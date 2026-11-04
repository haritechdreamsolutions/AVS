import test from 'node:test';
import assert from 'node:assert/strict';
if(!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL||''))throw Error('Isolated database required');
process.env.DATABASE_URL=process.env.AVS_TEST_DATABASE_URL;
const {pool}=await import('../database/pg_pool.js');
const {migrate}=await import('../database/migrate.js');await migrate();
const db=await import('../db_pg.js');
const cid=(await pool.query("INSERT INTO companies(name) VALUES('Delete test') RETURNING id")).rows[0].id;
async function user(name,role='DRIVER',emp=null){return (await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash,employee_id) VALUES($1,(SELECT id FROM roles WHERE role_name=$2),$3,$3,'test-hash',$4) RETURNING id",[cid,role,name,emp])).rows[0].id;}
const actor=await user('owner','OWNER');
try{
 await test('old and new users edit atomically without changing old bills or route history',async()=>{
  const route=(await pool.query("INSERT INTO routes(company_id,code,name) VALUES($1,'EDIT','Edit route') RETURNING id",[cid])).rows[0].id;
  const emp=(await pool.query("INSERT INTO employees(company_id,employee_code,full_name,route_id) VALUES($1,'EDIT','Original name',$2) RETURNING id",[cid,route])).rows[0].id;
  const uid=await user('old-edit','DRIVER',emp);
  const sale=(await pool.query("INSERT INTO sales(company_id,bill_no,employee_id,employee_name) VALUES($1,'EDIT-OLD',$2,'Original name') RETURNING *",[cid,emp])).rows[0];
  await pool.query("INSERT INTO route_assignments(route_id,employee_id,assigned_date,status) VALUES($1,$2,'2000-01-01','COMPLETED')",[route,emp]);
  const history=(await pool.query('SELECT * FROM route_assignments WHERE employee_id=$1',[emp])).rows;
  await db.updateUser(cid,uid,{name:'Updated name',login_id:'old-edited',phone:'9876543210',route_id:route},actor);
  assert.equal((await db.getUserById(uid)).name,'Updated name');
  assert.equal((await db.getUserById(uid)).phone,'9876543210');
  assert.deepEqual((await pool.query('SELECT * FROM route_assignments WHERE employee_id=$1',[emp])).rows,history);
  await assert.rejects(db.updateUser(cid,uid,{name:'Should rollback',phone:'000',route_id:999999},actor),/Route must belong/);
  assert.equal((await db.getUserById(uid)).name,'Updated name');
  assert.equal((await db.getUserById(uid)).phone,'9876543210');
  await db.updateUser(cid,uid,{route_id:null},actor);
  assert.deepEqual((await pool.query('SELECT * FROM route_assignments WHERE employee_id=$1',[emp])).rows,history);
  assert.deepEqual((await pool.query('SELECT * FROM sales WHERE id=$1',[sale.id])).rows[0],sale);
  const fresh=await user('new-edit','STORE_KEEPER');
  await db.updateUser(cid,fresh,{name:'Fresh edited',phone:'123',status:'INACTIVE'},actor);
  assert.equal((await db.getUserById(fresh)).account_status,'INACTIVE');
  await db.updateUser(cid,fresh,{status:'ACTIVE'},actor);
  assert.equal((await db.getUserById(fresh)).account_status,'ACTIVE');
  await assert.rejects(db.updateUser(cid+999,uid,{name:'Wrong company'},actor),/not found/);
  await assert.rejects(db.updateUser(cid,actor,{status:'INACTIVE'},actor),/only active OWNER/);
 });
 await test('old user removal preserves sales, receipt foreign keys, balances and historical names',async()=>{
  const emp=(await pool.query("INSERT INTO employees(company_id,employee_code,full_name) VALUES($1,'OLD','Akash') RETURNING id",[cid])).rows[0].id;
  const uid=await user('akash','DRIVER',emp);
  const shop=(await pool.query("INSERT INTO shops(company_id,code,name,current_due) VALUES($1,'SHOP','Shop',20) RETURNING id",[cid])).rows[0].id;
  const sale=(await pool.query("INSERT INTO sales(company_id,bill_no,employee_id,employee_name,shop_id,total_amount,credit_paid,payment_mode) VALUES($1,'OLD-BILL',$2,'Akash',$3,20,20,'CREDIT') RETURNING *",[cid,emp,shop])).rows[0];
  const receipt=(await pool.query("INSERT INTO receipts(company_id,shop_id,created_by,request_key,request_hash,amount,payment_mode) VALUES($1,$2,$3,'test','test',5,'CASH') RETURNING *",[cid,shop,uid])).rows[0];
  assert.equal((await db.deleteUser(cid,uid,actor)).success,true);
  assert.ok(!(await db.getUsers(cid)).some(u=>u.id===uid));
  assert.deepEqual((await pool.query('SELECT * FROM sales WHERE id=$1',[sale.id])).rows[0],sale);
  assert.deepEqual((await pool.query('SELECT * FROM receipts WHERE id=$1',[receipt.id])).rows[0],receipt);
  assert.equal(Number((await pool.query('SELECT current_due FROM shops WHERE id=$1',[shop])).rows[0].current_due),20);
  assert.equal((await db.getUserById(uid)).account_status,'INACTIVE');
  await assert.rejects(db.updateUser(cid,uid,{status:'ACTIVE'},actor),/not found/);
  await assert.rejects(db.toggleUserStatus(cid,uid,'ACTIVE',actor),/not found/);
  await assert.rejects(db.resetPin(cid,uid,'1234',actor),/not found/);
  assert.equal((await db.deleteUser(cid,uid,actor)).success,true);
 });
 await test('new user removal, tenant isolation, self and last-owner protection',async()=>{
  const uid=await user('new');await assert.rejects(db.deleteUser(cid+999,uid,actor),/not found/);
  assert.equal((await db.deleteUser(cid,uid,actor)).success,true);
  await assert.rejects(db.deleteUser(cid,actor,actor),/own account/);
  await assert.rejects(db.deleteUser(cid,actor,null),/only active OWNER/);
  assert.ok((await db.getUsers(cid)).some(u=>u.id===actor));
 });
}finally{await pool.end();}
