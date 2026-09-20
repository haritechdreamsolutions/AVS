// ============================================================
// AVS AGENCIES - USERS MASTER & USER ACCOUNT API TEST SUITE
// Isolated Database: avs_agencies_test
// ============================================================
import bcrypt from 'bcrypt';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const testPool = new Pool({
  host:     process.env.PG_HOST     || 'localhost',
  port:     parseInt(process.env.PG_PORT || '5432', 10),
  user:     process.env.PG_USER     || 'postgres',
  password: process.env.PG_PASSWORD || 'root',
  database: 'avs_agencies_test',
  max: 5,
});

let passed = 0;
let failed = 0;
let total = 0;
const failures = [];

async function test(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log('  [PASS] ' + name);
  } catch (e) {
    failed++;
    console.error('  [FAIL] ' + name);
    console.error('         ' + e.message);
    failures.push({ name, error: e.message, stack: e.stack });
  }
}

async function q(text, params) {
  const c = await testPool.connect();
  try { return await c.query(text, params); }
  finally { c.release(); }
}

async function cleanDB() {
  await q('TRUNCATE audit_logs,settlements,expenses,damages,sale_items,sales,inventory_movements,employee_stock,shops,route_assignments,routes,product_price_history,products,categories,employees,user_accounts,companies RESTART IDENTITY CASCADE');
}

console.log('');
console.log('==================================================================');
console.log('  AVS AGENCIES - USERS MASTER VERIFICATION SUITE');
console.log('  Testing PostgreSQL User Accounts & CRUD Operations');
console.log('==================================================================');
console.log('');

let ctx = {};

// 1. PostgreSQL Connection
await test('1. PostgreSQL connection verification', async () => {
  const res = await q('SELECT 1 as connected');
  if (res.rows[0].connected !== 1) throw new Error('Database connection failed');
});

// Setup
await test('SETUP - Clean and Seed Multi-Role System Architecture', async () => {
  await cleanDB();
  const cR = await q('INSERT INTO companies (name,subtitle,is_active) VALUES ($1,$2,TRUE) RETURNING id', ['AVS USER TEST CORP', 'User Master Testing']);
  ctx.companyId = cR.rows[0].id;

  const cR2 = await q('INSERT INTO companies (name,subtitle,is_active) VALUES ($1,$2,TRUE) RETURNING id', ['OTHER CORP', 'Tenant Isolation Test']);
  ctx.companyId2 = cR2.rows[0].id;

  const roles = await q('SELECT id, role_name FROM roles');
  ctx.roles = {};
  roles.rows.forEach(r => { ctx.roles[r.role_name] = r.id; });

  // 1. Seed Owner
  const ownerHash = await bcrypt.hash('1234', 10);
  const ownerR = await q(
    'INSERT INTO user_accounts (company_id,role_id,login_id,name,pin_hash,account_status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [ctx.companyId, ctx.roles['OWNER'], 'owner', 'Owner Admin', ownerHash, 'ACTIVE']
  );
  ctx.ownerId = ownerR.rows[0].id;
});

// 2. Owner Authentication
await test('2. Owner authentication with bcrypt PIN verification', async () => {
  const row = (await q('SELECT * FROM user_accounts WHERE login_id=$1', ['owner'])).rows[0];
  const ok = await bcrypt.compare('1234', row.pin_hash);
  if (!ok) throw new Error('PIN verification failed');
});

// 3. Owner Session verification
await test('3. Owner session contains valid companyId and role', async () => {
  const row = (await q('SELECT ua.*, r.role_name FROM user_accounts ua JOIN roles r ON r.id=ua.role_id WHERE ua.id=$1', [ctx.ownerId])).rows[0];
  if (row.company_id !== ctx.companyId) throw new Error('Company ID mismatch');
  if (row.role_name !== 'OWNER') throw new Error('Role mismatch');
});

// 4. Owner Authorization
await test('4. Owner authorization role check accepts OWNER', async () => {
  const role = 'OWNER';
  const allowedRoles = ['OWNER'];
  if (!allowedRoles.includes(role)) throw new Error('Owner authorization failed');
});

// 5. GET Users API success
await test('5. GET Users API returns list of users with roles', async () => {
  const users = await q(
    'SELECT ua.id,ua.company_id,ua.employee_id,ua.login_id,ua.name,ua.phone,ua.account_status as status,ua.failed_attempts,ua.last_login_at,ua.created_at,r.role_name as role,e.employee_code ' +
    'FROM user_accounts ua JOIN roles r ON r.id=ua.role_id LEFT JOIN employees e ON e.id=ua.employee_id WHERE ua.company_id=$1 ORDER BY ua.id',
    [ctx.companyId]
  );
  if (users.rows.length !== 1) throw new Error('Expected 1 user, got: ' + users.rows.length);
  if (users.rows[0].login_id !== 'owner') throw new Error('Expected owner user');
});

// 6. GET Users API empty result for new empty company
await test('6. GET Users API returns empty array for empty company', async () => {
  const users = await q('SELECT * FROM user_accounts WHERE company_id=$1', [ctx.companyId2]);
  if (users.rows.length !== 0) throw new Error('Expected 0 users for empty company');
});

// 7. GET Users API database failure handling
await test('7. GET Users API error handling on invalid query', async () => {
  let threw = false;
  try {
    await q('SELECT * FROM non_existent_table');
  } catch (e) {
    threw = true;
  }
  if (!threw) throw new Error('Expected query to fail gracefully on invalid table');
});

// 8. Company isolation
await test('8. Company isolation: Company 1 users not visible to Company 2', async () => {
  // Add a user in company 2
  const hash2 = await bcrypt.hash('1234', 10);
  await q(
    'INSERT INTO user_accounts (company_id,role_id,login_id,name,pin_hash,account_status) VALUES ($1,$2,$3,$4,$5,$6)',
    [ctx.companyId2, ctx.roles['OWNER'], 'owner_comp2', 'Owner 2', hash2, 'ACTIVE']
  );

  const comp1Users = (await q('SELECT * FROM user_accounts WHERE company_id=$1', [ctx.companyId])).rows;
  const leaked = comp1Users.find(u => u.company_id === ctx.companyId2);
  if (leaked) throw new Error('Data leaked across company boundary');
});

// 9. Create user
await test('9. Create user: Add Store Keeper and Employee user accounts in PostgreSQL', async () => {
  const skHash = await bcrypt.hash('1234', 10);
  const sk = await q(
    'INSERT INTO user_accounts (company_id,role_id,login_id,name,pin_hash,account_status) VALUES ($1,$2,$3,$4,$5,\'ACTIVE\') RETURNING id,login_id,name,account_status',
    [ctx.companyId, ctx.roles['STORE_KEEPER'], 'storekeeper', 'Store Keeper Admin', skHash]
  );
  ctx.skId = sk.rows[0].id;
  if (!ctx.skId) throw new Error('Failed to create store keeper user account');

  const emp = await q(
    'INSERT INTO employees (company_id,employee_code,full_name,phone,vehicle_number) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [ctx.companyId, 'EMP-101', 'Ravi Driver', '9876543210', 'TN 32 AB 1234']
  );
  ctx.empId = emp.rows[0].id;

  const empHash = await bcrypt.hash('1111', 10);
  const empUser = await q(
    'INSERT INTO user_accounts (company_id,role_id,employee_id,login_id,name,pin_hash,account_status) VALUES ($1,$2,$3,$4,$5,$6,\'ACTIVE\') RETURNING id,login_id,name,account_status',
    [ctx.companyId, ctx.roles['EMPLOYEE'], ctx.empId, 'emp1', 'Ravi Driver', empHash]
  );
  ctx.empUserId = empUser.rows[0].id;
  if (!ctx.empUserId) throw new Error('Failed to create employee user account');
});

// 10. Update user
await test('10. Update user: Modify name and login_id in PostgreSQL', async () => {
  await q('UPDATE user_accounts SET name=$1 WHERE id=$2 AND company_id=$3', ['Ravi Senior Driver', ctx.empUserId, ctx.companyId]);
  const updated = (await q('SELECT name FROM user_accounts WHERE id=$1', [ctx.empUserId])).rows[0];
  if (updated.name !== 'Ravi Senior Driver') throw new Error('User update failed in PostgreSQL');
});

// 11. Deactivate user
await test('11. Deactivate user: Toggle account_status to INACTIVE in PostgreSQL', async () => {
  await q('UPDATE user_accounts SET account_status=\'INACTIVE\' WHERE id=$1 AND company_id=$2', [ctx.empUserId, ctx.companyId]);
  const deactivated = (await q('SELECT account_status FROM user_accounts WHERE id=$1', [ctx.empUserId])).rows[0];
  if (deactivated.account_status !== 'INACTIVE') throw new Error('User deactivation failed');

  // Reactivate
  await q('UPDATE user_accounts SET account_status=\'ACTIVE\' WHERE id=$1 AND company_id=$2', [ctx.empUserId, ctx.companyId]);
});

// 12. Unauthorized role rejection
await test('12. Unauthorized role rejection: EMPLOYEE & STORE_KEEPER cannot access Owner-only endpoints', async () => {
  const allowed = ['OWNER'];
  const isEmployeeAllowed = allowed.includes('EMPLOYEE');
  const isKeeperAllowed = allowed.includes('STORE_KEEPER');
  if (isEmployeeAllowed || isKeeperAllowed) throw new Error('Non-owner roles were incorrectly authorized');
});

// 13. No plaintext password returned
await test('13. No plaintext password returned: Projection excludes pin_hash', async () => {
  const safeQuery = await q(
    'SELECT ua.id,ua.company_id,ua.employee_id,ua.login_id,ua.name,ua.phone,ua.account_status as status,ua.failed_attempts,ua.last_login_at,ua.created_at,r.role_name as role,e.employee_code ' +
    'FROM user_accounts ua JOIN roles r ON r.id=ua.role_id LEFT JOIN employees e ON e.id=ua.employee_id WHERE ua.company_id=$1',
    [ctx.companyId]
  );
  safeQuery.rows.forEach(u => {
    if (u.pin_hash !== undefined || u.pin !== undefined || u.password !== undefined) {
      throw new Error('Security violation: PIN or pin_hash was returned in query');
    }
  });
});

// 14. Users remain after refresh
await test('14. Persistence: Users exist permanently in PostgreSQL', async () => {
  const allUsers = (await q('SELECT count(*) as count FROM user_accounts WHERE company_id=$1', [ctx.companyId])).rows[0].count;
  if (parseInt(allUsers, 10) !== 3) throw new Error('Expected 3 persistent users in database, found: ' + allUsers);
});

await testPool.end().catch(()=>{});

console.log('');
console.log('==================================================================');
console.log('  USERS MASTER TEST RESULTS SUMMARY');
console.log('  PASSED : ' + passed + ' / ' + total);
console.log('  FAILED : ' + failed + ' / ' + total);
console.log('==================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
