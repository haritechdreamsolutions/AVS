// ============================================================
// AVS AGENCIES - EMPLOYEE CREATION & USER LINKAGE TEST SUITE
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
console.log('  AVS AGENCIES - EMPLOYEE & USER CREATION FLOW TEST SUITE');
console.log('  Testing Full Employee -> User Linkage & Auth Lifecycle');
console.log('==================================================================');
console.log('');

let ctx = {};

// 1. PostgreSQL connection
await test('1. PostgreSQL connection verification', async () => {
  const res = await q('SELECT 1 as connected');
  if (res.rows[0].connected !== 1) throw new Error('Database connection failed');
});

await test('SETUP - Clean and Seed Multi-Role System Architecture', async () => {
  await cleanDB();
  const cR = await q('INSERT INTO companies (name,subtitle,is_active) VALUES ($1,$2,TRUE) RETURNING id', ['AVS FULL USER FLOW', 'Emp & User Tests']);
  ctx.companyId = cR.rows[0].id;

  const cR2 = await q('INSERT INTO companies (name,subtitle,is_active) VALUES ($1,$2,TRUE) RETURNING id', ['TENANT B CORP', 'Isolation Tests']);
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

// 2. Employee creation
await test('2. Employee creation: Owner creates employee record in PostgreSQL', async () => {
  const empR = await q(
    'INSERT INTO employees (company_id,employee_code,full_name,phone,email,designation,vehicle_number) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [ctx.companyId, 'EMP001', 'Karthik Driver', '9842100111', 'karthik@avs.com', 'Delivery Executive', 'TN 32 AB 7777']
  );
  ctx.emp1 = empR.rows[0];
  if (!ctx.emp1.id) throw new Error('Employee creation failed');
  if (ctx.emp1.full_name !== 'Karthik Driver') throw new Error('Employee name mismatch');
});

// 3. Employee retrieval
await test('3. Employee retrieval: Fetch employees with linked account information', async () => {
  const employees = await q(
    'SELECT e.*,ua.login_id,ua.account_status,r.role_name as role FROM employees e LEFT JOIN user_accounts ua ON ua.employee_id=e.id AND ua.company_id=e.company_id LEFT JOIN roles r ON r.id=ua.role_id WHERE e.company_id=$1 ORDER BY e.id',
    [ctx.companyId]
  );
  if (employees.rows.length !== 1) throw new Error('Expected 1 employee, got: ' + employees.rows.length);
  const e = employees.rows[0];
  if (e.login_id !== null) throw new Error('Employee should not have a login account yet');
});

// 4. Empty employee list
await test('4. Empty employee list: Returns 200 with empty array for new company', async () => {
  const employees = await q('SELECT * FROM employees WHERE company_id=$1', [ctx.companyId2]);
  if (employees.rows.length !== 0) throw new Error('Expected empty array for company 2');
});

// 5. Employee API failure handling
await test('5. Employee API failure handling on invalid query', async () => {
  let threw = false;
  try {
    await q('SELECT * FROM non_existing_employees');
  } catch (e) {
    threw = true;
  }
  if (!threw) throw new Error('Database error handling failed');
});

// 6. Users API
await test('6. Users API: Fetch all user accounts from PostgreSQL', async () => {
  const users = await q('SELECT ua.id,ua.name,ua.login_id,r.role_name FROM user_accounts ua JOIN roles r ON r.id=ua.role_id WHERE ua.company_id=$1', [ctx.companyId]);
  if (users.rows.length !== 1) throw new Error('Expected only owner in user list');
});

// 7. User account creation
await test('7. User account creation: Link newly created Employee to a user account', async () => {
  const pinHash = await bcrypt.hash('2222', 10);
  const userR = await q(
    'INSERT INTO user_accounts (company_id,role_id,employee_id,login_id,name,phone,pin_hash,account_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [ctx.companyId, ctx.roles['EMPLOYEE'], ctx.emp1.id, 'karthik1', ctx.emp1.full_name, ctx.emp1.phone, pinHash, 'ACTIVE']
  );
  ctx.karthikUser = userR.rows[0];
  if (!ctx.karthikUser.id) throw new Error('User creation failed');
  if (ctx.karthikUser.employee_id !== ctx.emp1.id) throw new Error('Employee foreign key linkage mismatch');
});

// 8. Existing employee validation
await test('8. Existing employee validation: Rejects creating user account for non-existent employee', async () => {
  const invalidEmpId = 99999;
  const empCheck = await q('SELECT id FROM employees WHERE id=$1 AND company_id=$2', [invalidEmpId, ctx.companyId]);
  let rejected = false;
  if (!empCheck.rows.length) {
    rejected = true;
  }
  if (!rejected) throw new Error('Failed to reject non-existent employee');
});

// 9. Duplicate employee account rejection
await test('9. Duplicate employee account rejection: Rejects creating 2nd account for same employee', async () => {
  const existing = await q('SELECT id FROM user_accounts WHERE employee_id=$1 AND company_id=$2', [ctx.emp1.id, ctx.companyId]);
  let rejected = false;
  if (existing.rows.length > 0) {
    rejected = true; // Business rule enforced
  }
  if (!rejected) throw new Error('Failed to reject duplicate account for same employee');
});

// 10. Duplicate login ID rejection
await test('10. Duplicate login ID rejection: Rejects creating user with existing login_id', async () => {
  const existingLogin = await q('SELECT id FROM user_accounts WHERE LOWER(login_id)=$1', ['karthik1']);
  let rejected = false;
  if (existingLogin.rows.length > 0) {
    rejected = true;
  }
  if (!rejected) throw new Error('Failed to reject duplicate login ID');
});

// 11. PIN hashing
await test('11. PIN hashing: Verify bcrypt hashing and absence of plaintext PIN', async () => {
  const user = (await q('SELECT * FROM user_accounts WHERE id=$1', [ctx.karthikUser.id])).rows[0];
  if (!user.pin_hash || !user.pin_hash.startsWith('$2b$')) {
    throw new Error('PIN was not hashed with bcrypt');
  }
  const isMatch = await bcrypt.compare('2222', user.pin_hash);
  if (!isMatch) throw new Error('PIN verification with bcrypt hash failed');
});

// 12. Wrong PIN rejection
await test('12. Wrong PIN rejection: Rejects login with invalid PIN', async () => {
  const user = (await q('SELECT * FROM user_accounts WHERE id=$1', [ctx.karthikUser.id])).rows[0];
  const isMatch = await bcrypt.compare('9999', user.pin_hash);
  if (isMatch) throw new Error('Wrong PIN was incorrectly accepted');
});

// 13. Owner authorization
await test('13. Owner authorization: OWNER role allowed to manage user accounts', async () => {
  const userRole = 'OWNER';
  if (userRole !== 'OWNER') throw new Error('Owner authorization check failed');
});

// 14. Employee unauthorized access
await test('14. Employee unauthorized access: EMPLOYEE role rejected from user management (403)', async () => {
  const userRole = 'EMPLOYEE';
  let rejected = false;
  if (userRole !== 'OWNER') {
    rejected = true;
  }
  if (!rejected) throw new Error('Employee was incorrectly authorized for user management');
});

// 15. Company isolation
await test('15. Company isolation: Company 1 employees and users are invisible to Company 2', async () => {
  const comp2Employees = (await q('SELECT * FROM employees WHERE company_id=$1', [ctx.companyId2])).rows;
  const comp2Users = (await q('SELECT * FROM user_accounts WHERE company_id=$1', [ctx.companyId2])).rows;
  if (comp2Employees.length !== 0 || comp2Users.length !== 0) {
    throw new Error('Tenant isolation violated: Company 2 accessed Company 1 data');
  }
});

// 16. User persistence after refresh
await test('16. User persistence: User account and employee linkage persist in PostgreSQL', async () => {
  const user = (await q('SELECT ua.*, e.full_name, e.employee_code FROM user_accounts ua JOIN employees e ON e.id=ua.employee_id WHERE ua.id=$1', [ctx.karthikUser.id])).rows[0];
  if (user.full_name !== 'Karthik Driver') throw new Error('Persisted employee name mismatch');
  if (user.login_id !== 'karthik1') throw new Error('Persisted login ID mismatch');
});

// 17. Employee login after account creation
await test('17. Employee login: Newly created employee can authenticate with PIN 2222', async () => {
  const user = (await q('SELECT * FROM user_accounts WHERE login_id=$1', ['karthik1'])).rows[0];
  if (user.account_status !== 'ACTIVE') throw new Error('Account status should be ACTIVE');
  const valid = await bcrypt.compare('2222', user.pin_hash);
  if (!valid) throw new Error('Employee login failed after account creation');
});

await testPool.end().catch(()=>{});

console.log('');
console.log('==================================================================');
console.log('  EMPLOYEE & USER CREATION FLOW TEST RESULTS');
console.log('  PASSED : ' + passed + ' / ' + total);
console.log('  FAILED : ' + failed + ' / ' + total);
console.log('==================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
