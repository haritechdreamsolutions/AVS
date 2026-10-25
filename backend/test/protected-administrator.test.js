import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { pool } from '../database/pg_pool.js';
import { login, getUserById, getUsers, updateUser, deleteUser, resetPin, addUser } from '../db_pg.js';

test('protected administrator remains available when all ordinary accounts are deleted', {
  skip: process.env.AVS_ADMINISTRATOR_DB_TEST !== '1'
}, async (t) => {
  const client = await pool.connect(), originalConnect = pool.connect;
  t.after(async () => { pool.connect = originalConnect; client.release(); await pool.end(); });
  await client.query('CREATE TEMP TABLE user_accounts (LIKE public.user_accounts INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)');
  await client.query('CREATE TEMP TABLE audit_logs(id SERIAL PRIMARY KEY,company_id INTEGER,actor_user_id INTEGER,action TEXT,entity_type TEXT,entity_id INTEGER,metadata JSONB,ip_address TEXT)');
  await client.query('CREATE TRIGGER protected_administrator_row BEFORE INSERT OR UPDATE OR DELETE ON user_accounts FOR EACH ROW EXECUTE FUNCTION public.protect_system_administrator()');
  await client.query('CREATE TRIGGER protected_administrator_truncate BEFORE TRUNCATE ON user_accounts FOR EACH STATEMENT EXECUTE FUNCTION public.protect_system_administrator()');
  pool.connect = async () => ({ query: (...args) => client.query(...args), release() {} });
  const roles = (await client.query("SELECT id,role_name FROM roles WHERE role_name IN ('OWNER','STORE_KEEPER')")).rows;
  const ownerId = roles.find(r => r.role_name === 'OWNER').id;
  const keeperId = roles.find(r => r.role_name === 'STORE_KEEPER').id;
  const password = 'Synthetic-administrator-password!';
  const hash = await bcrypt.hash(password, 12);
  await client.query(`INSERT INTO user_accounts(id,company_id,role_id,login_id,name,pin_hash,credential_kind,is_system_administrator)
    VALUES(9001,1,$1,'administrator','Administrator',$3,'password',TRUE),
          (9002,1,$2,'ordinary-test-user','Ordinary user',$3,'password',FALSE)`, [ownerId,keeperId,hash]);

  await t.test('login and session identity identify Administrator with management access', async () => {
    const result = await login('Administrator', password);
    assert.equal(result.success, true);
    assert.equal(result.user.is_system_administrator, true);
    assert.equal(result.user.display_role, 'Administrator');
    assert.equal(result.user.role, 'OWNER');
    assert.equal((await getUserById(9001)).is_system_administrator, true);
    assert.equal((await getUsers(1)).find(u => u.id === 9001).is_system_administrator, true);
  });
  await t.test('API service rejects edit, deactivation, delete and password reset', async () => {
    await assert.rejects(updateUser(1,9001,{name:'Changed'},9002), /cannot be edited/);
    await assert.rejects(updateUser(1,9001,{status:'INACTIVE'},9002), /cannot be edited/);
    await assert.rejects(deleteUser(1,9001,9002), /cannot be deleted/);
    await assert.rejects(resetPin(1,9001,'Changed-password!',9002), /cannot be reset/);
    await assert.rejects(addUser(1,{role:'OWNER',login_id:'administrator',pin:'Another-password!'},9002), /reserved/);
  });
  await t.test('database rejects direct changes, removal, demotion and bulk truncate', async () => {
    for (const sql of [
      'DELETE FROM user_accounts WHERE id=9001',
      "UPDATE user_accounts SET login_id='changed' WHERE id=9001",
      "UPDATE user_accounts SET pin_hash='changed' WHERE id=9001",
      "UPDATE user_accounts SET account_status='INACTIVE' WHERE id=9001",
      'UPDATE user_accounts SET is_system_administrator=FALSE WHERE id=9001',
      'UPDATE user_accounts SET is_system_administrator=TRUE WHERE id=9002',
      'TRUNCATE user_accounts'
    ]) await assert.rejects(client.query(sql), e => e.code === '42501');
  });
  await t.test('wrong password fails without preventing later correct login', async () => {
    assert.equal((await login('administrator','incorrect')).success, false);
    assert.equal((await login('administrator',password)).success, true);
  });
  await t.test('ordinary account editing and deletion work; Administrator still logs in alone', async () => {
    assert.equal((await updateUser(1,9002,{name:'Updated ordinary user'},9001)).success, true);
    assert.equal((await deleteUser(1,9002,9001)).success, true);
    assert.equal((await getUsers(1)).length, 1);
    assert.equal((await login('administrator',password)).success, true);
  });
});
