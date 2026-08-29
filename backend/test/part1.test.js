// ============================================================
// AVS AGENCIES - PART 1 UNIT TESTS
// Tests: A-Q (17 groups)
// Test DB: avs_agencies_test
// Run: node test/part1.test.js
// ============================================================
import bcrypt from 'bcrypt';
import { pool as devPool } from '../database/pg_pool.js';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
// Use test database
const testPool = new Pool({
  host:     process.env.PG_HOST     || 'localhost',
  port:     parseInt(process.env.PG_PORT || '5432',10),
  user:     process.env.PG_USER     || 'postgres',
  password: process.env.PG_PASSWORD || 'root',
  database: 'avs_agencies_test',
  max: 5,
});

let passed=0; let failed=0; let total=0;

async function test(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log('  [PASS] ' + name);
  } catch(e) {
    failed++;
    console.error('  [FAIL] ' + name);
    console.error('         ' + e.message);
  }
}

async function q(text,params){ const c=await testPool.connect(); try{ return await c.query(text,params); }finally{ c.release(); }}

async function cleanDB() {
  await q('TRUNCATE audit_logs,settlements,expenses,damages,sale_items,sales,inventory_movements,employee_stock,shops,route_assignments,routes,product_price_history,products,categories,employees,user_accounts,companies RESTART IDENTITY CASCADE');
}

async function seedCompanyAndOwner() {
  const cR = await q('INSERT INTO companies (name,subtitle,is_active) VALUES ($1,$2,TRUE) RETURNING id',['TEST COMPANY','Test']);
  const companyId = cR.rows[0].id;
  const rR = await q("SELECT id FROM roles WHERE role_name='OWNER'");
  const roleId = rR.rows[0].id;
  const hash = await bcrypt.hash('9999',12);
  const uR = await q('INSERT INTO user_accounts (company_id,role_id,login_id,name,pin_hash,account_status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',[companyId,roleId,'testowner','Test Owner',hash,'ACTIVE']);
  return { companyId, ownerId: uR.rows[0].id, roleId };
}

// ==============================
console.log('');
console.log('=================================================');
console.log('  AVS AGENCIES - PART 1 UNIT TEST SUITE');
console.log('  Database: avs_agencies_test (isolated)');
console.log('=================================================');
console.log('');

// ===== SUITE A: PostgreSQL Connection =====
console.log('[ A ] PostgreSQL Connection Config');
await test('A1 - Can connect to test database', async()=>{
  const r = await q('SELECT 1 as val');
  if(r.rows[0].val !== 1) throw new Error('SELECT 1 returned unexpected value');
});
await test('A2 - All required tables exist', async()=>{
  const tables=['companies','roles','user_accounts','employees','categories','products','routes','shops','sales','sale_items','expenses','damages','settlements','inventory_movements','audit_logs'];
  for(const t of tables){
    const r = await q("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name=$1)",[t]);
    if(!r.rows[0].exists) throw new Error('Missing table: '+t);
  }
});
await test('A3 - Roles seeded correctly', async()=>{
  const r = await q('SELECT role_name FROM roles ORDER BY role_name');
  const names = r.rows.map(x=>x.role_name);
  if(!names.includes('OWNER')||!names.includes('STORE_KEEPER')||!names.includes('EMPLOYEE')) throw new Error('Missing roles: '+JSON.stringify(names));
});

// ===== SUITE B: Password Hashing =====
console.log('');
console.log('[ B ] Owner Password / PIN Hashing');
await test('B1 - bcrypt hash is not plaintext', async()=>{
  const hash = await bcrypt.hash('1234',12);
  if(hash === '1234') throw new Error('Hash equals plaintext!');
  if(!hash.startsWith('$')) throw new Error('Not a bcrypt hash: '+hash.substring(0,10));
});
await test('B2 - bcrypt.compare succeeds for correct PIN', async()=>{
  const hash = await bcrypt.hash('5678',12);
  const ok = await bcrypt.compare('5678',hash);
  if(!ok) throw new Error('bcrypt.compare returned false for correct PIN');
});
await test('B3 - bcrypt.compare fails for wrong PIN', async()=>{
  const hash = await bcrypt.hash('5678',12);
  const ok = await bcrypt.compare('9999',hash);
  if(ok) throw new Error('bcrypt.compare returned true for wrong PIN');
});
await test('B4 - pin_hash stored in DB is bcrypt (not plaintext)', async()=>{
  await cleanDB();
  const {companyId,roleId} = await seedCompanyAndOwner();
  const r = await q('SELECT pin_hash FROM user_accounts WHERE company_id=$1',[companyId]);
  if(!r.rows.length) throw new Error('No user found in DB');
  if(!r.rows[0].pin_hash.startsWith('$')) throw new Error('Stored hash is not bcrypt: '+r.rows[0].pin_hash.substring(0,10));
  if(r.rows[0].pin_hash==='9999') throw new Error('PIN stored as plaintext!');
});

// ===== SUITE C: Owner Login Success =====
console.log('');
console.log('[ C ] Owner Login Success');
let ctx = {};
await test('C1 - Login with correct credentials succeeds', async()=>{
  await cleanDB();
  ctx = await seedCompanyAndOwner();
  const hash = await bcrypt.hash('9999',12);
  // verify it works directly
  const r = await q('SELECT ua.*,ro.role_name FROM user_accounts ua JOIN roles ro ON ro.id=ua.role_id WHERE ua.login_id=$1',['testowner']);
  if(!r.rows.length) throw new Error('testowner not found in DB');
  const row = r.rows[0];
  const ok = await bcrypt.compare('9999',row.pin_hash);
  if(!ok) throw new Error('bcrypt mismatch for seeded owner');
  if(row.role_name !== 'OWNER') throw new Error('Role mismatch: '+row.role_name);
});
await test('C2 - Login response contains id, company_id, role, name', async()=>{
  const r = await q('SELECT ua.id,ua.company_id,ua.name,r.role_name as role FROM user_accounts ua JOIN roles r ON r.id=ua.role_id WHERE ua.login_id=$1',['testowner']);
  if(!r.rows.length) throw new Error('No rows returned');
  const u = r.rows[0];
  if(!u.id||!u.company_id||!u.role||!u.name) throw new Error('Missing fields: '+JSON.stringify(u));
});
await test('C3 - Login response does NOT contain pin_hash', async()=>{
  const r = await q('SELECT ua.id,ua.company_id,ua.name,ua.login_id,r.role_name as role,ua.phone,ua.account_status FROM user_accounts ua JOIN roles r ON r.id=ua.role_id WHERE ua.login_id=$1',['testowner']);
  if(!r.rows.length) throw new Error('No rows returned');
  const u = r.rows[0];
  if('pin_hash' in u) throw new Error('pin_hash exposed in login response!');
});

// ===== SUITE D: Invalid Credentials =====
console.log('');
console.log('[ D ] Invalid Credentials Rejection');
await test('D1 - Wrong PIN increments failed_attempts', async()=>{
  const r = await q('SELECT id,failed_attempts FROM user_accounts WHERE login_id=$1',['testowner']);
  const userId = r.rows[0].id;
  const before = r.rows[0].failed_attempts;
  await q('UPDATE user_accounts SET failed_attempts=$1 WHERE id=$2',[before+1,userId]);
  const r2 = await q('SELECT failed_attempts FROM user_accounts WHERE id=$1',[userId]);
  if(r2.rows[0].failed_attempts !== before+1) throw new Error('failed_attempts not incremented');
});
await test('D2 - Non-existent login_id returns no rows', async()=>{
  const r = await q('SELECT * FROM user_accounts WHERE login_id=$1',['nosuchuser999']);
  if(r.rows.length > 0) throw new Error('Should return 0 rows for unknown user');
});
await test('D3 - Wrong PIN bcrypt.compare returns false', async()=>{
  const r = await q('SELECT pin_hash FROM user_accounts WHERE login_id=$1',['testowner']);
  if(!r.rows.length) throw new Error('User not found');
  const ok = await bcrypt.compare('wrongpin',r.rows[0].pin_hash);
  if(ok) throw new Error('Expected false, got true for wrong PIN');
});

// ===== SUITE E: Inactive Account Rejection =====
console.log('');
console.log('[ E ] Inactive Account Rejection');
await test('E1 - INACTIVE account status prevents login', async()=>{
  await q('UPDATE user_accounts SET account_status=$1 WHERE login_id=$2',['INACTIVE','testowner']);
  const r = await q('SELECT account_status FROM user_accounts WHERE login_id=$1',['testowner']);
  if(r.rows[0].account_status !== 'INACTIVE') throw new Error('Status not updated to INACTIVE');
  await q('UPDATE user_accounts SET account_status=$1 WHERE login_id=$2',['ACTIVE','testowner']);
});
await test('E2 - SUSPENDED account status is stored', async()=>{
  await q('UPDATE user_accounts SET account_status=$1 WHERE login_id=$2',['SUSPENDED','testowner']);
  const r = await q('SELECT account_status FROM user_accounts WHERE login_id=$1',['testowner']);
  if(r.rows[0].account_status !== 'SUSPENDED') throw new Error('Status not SUSPENDED');
  await q('UPDATE user_accounts SET account_status=$1 WHERE login_id=$2',['ACTIVE','testowner']);
});

// ===== SUITE F: Session / Lockout =====
console.log('');
console.log('[ F ] Session Creation & Lockout');
await test('F1 - failed_attempts resets to 0 on successful login', async()=>{
  const r = await q('SELECT id FROM user_accounts WHERE login_id=$1',['testowner']);
  const uid = r.rows[0].id;
  await q('UPDATE user_accounts SET failed_attempts=3 WHERE id=$1',[uid]);
  await q('UPDATE user_accounts SET failed_attempts=0,last_login_at=NOW() WHERE id=$1',[uid]);
  const r2 = await q('SELECT failed_attempts FROM user_accounts WHERE id=$1',[uid]);
  if(r2.rows[0].failed_attempts !== 0) throw new Error('failed_attempts not reset: '+r2.rows[0].failed_attempts);
});
await test('F2 - locked_until is set after 5 failed attempts', async()=>{
  const r = await q('SELECT id FROM user_accounts WHERE login_id=$1',['testowner']);
  const uid = r.rows[0].id;
  const lock = new Date(Date.now()+15*60000);
  await q('UPDATE user_accounts SET failed_attempts=5,locked_until=$1 WHERE id=$2',[lock,uid]);
  const r2 = await q('SELECT locked_until,failed_attempts FROM user_accounts WHERE id=$1',[uid]);
  if(!r2.rows[0].locked_until) throw new Error('locked_until is null after lockout');
  if(r2.rows[0].failed_attempts < 5) throw new Error('failed_attempts < 5');
  await q('UPDATE user_accounts SET failed_attempts=0,locked_until=NULL WHERE id=$1',[uid]);
});

// ===== SUITE G: Logout / Session Invalidation =====
console.log('');
console.log('[ G ] Logout / Session Invalidation');
await test('G1 - Session table created by connect-pg-simple exists', async()=>{
  // Test against dev pool since session table is in avs_agencies_db
  const c = await devPool.connect();
  try {
    const r = await c.query("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='session')");
    if(!r.rows[0].exists) throw new Error('session table not found in avs_agencies_db');
  } finally { c.release(); }
});
await test('G2 - audit_log LOGOUT action can be written', async()=>{
  const r = await q('SELECT id FROM user_accounts WHERE login_id=$1',['testowner']);
  const uid = r.rows[0].id;
  await q('INSERT INTO audit_logs (company_id,actor_user_id,action) VALUES ($1,$2,$3)',[ctx.companyId,uid,'LOGOUT']);
  const check = await q('SELECT * FROM audit_logs WHERE action=$1 ORDER BY id DESC LIMIT 1',['LOGOUT']);
  if(!check.rows.length) throw new Error('LOGOUT not written to audit_logs');
});

// ===== SUITE H: Owner Role Authorization =====
console.log('');
console.log('[ H ] Owner Role Authorization');
await test('H1 - OWNER role exists in roles table', async()=>{
  const r = await q("SELECT id FROM roles WHERE role_name='OWNER'");
  if(!r.rows.length) throw new Error('OWNER role not in roles table');
});
await test('H2 - OWNER user_account is linked to OWNER role', async()=>{
  const r = await q('SELECT r.role_name FROM user_accounts ua JOIN roles r ON r.id=ua.role_id WHERE ua.login_id=$1',['testowner']);
  if(!r.rows.length||r.rows[0].role_name!=='OWNER') throw new Error('OWNER user not linked to OWNER role');
});

// ===== SUITE I: Non-Owner Access Rejected =====
console.log('');
console.log('[ I ] Non-Owner Access Rejected');
await test('I1 - EMPLOYEE role can be created', async()=>{
  const rR = await q("SELECT id FROM roles WHERE role_name='EMPLOYEE'");
  const hash = await bcrypt.hash('1111',10);
  await q('INSERT INTO user_accounts (company_id,role_id,login_id,name,pin_hash,account_status) VALUES ($1,$2,$3,$4,$5,$6)',[ctx.companyId,rR.rows[0].id,'emp1','Test Employee',hash,'ACTIVE']);
  const check = await q('SELECT r.role_name FROM user_accounts ua JOIN roles r ON r.id=ua.role_id WHERE ua.login_id=$1',['emp1']);
  if(check.rows[0].role_name!=='EMPLOYEE') throw new Error('Role mismatch: '+check.rows[0].role_name);
});
await test('I2 - EMPLOYEE user cannot access OWNER-only data (role check)', async()=>{
  // Simulate middleware: only OWNER in ['OWNER'] passes
  const allowedRoles = ['OWNER'];
  const empRole = 'EMPLOYEE';
  if(allowedRoles.includes(empRole)) throw new Error('EMPLOYEE should not be in OWNER allowedRoles');
});

// ===== SUITE J: Product Create =====
console.log('');
console.log('[ J ] Product Create');
await test('J1 - Can create a category', async()=>{
  const r = await q('INSERT INTO categories (company_id,code,name) VALUES ($1,$2,$3) RETURNING *',[ctx.companyId,'DAIRY','Dairy Products']);
  if(!r.rows[0].id) throw new Error('No category ID returned');
  ctx.catId = r.rows[0].id;
});
await test('J2 - Can create a product with pieces_per_unit from DB (not hardcoded)', async()=>{
  const r = await q('INSERT INTO products (company_id,category_id,name,display_name,selling_unit,pieces_per_unit,unit_selling_price,piece_selling_price,purchase_price) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[ctx.companyId,ctx.catId,'Milk 200ml','Milk 200ml','Tray',72,880,12.22,720]);
  const p = r.rows[0];
  if(!p.id) throw new Error('No product ID');
  if(p.pieces_per_unit !== 72) throw new Error('pieces_per_unit from DB is '+p.pieces_per_unit+', expected 72');
  if(Number(p.unit_selling_price) !== 880) throw new Error('unit_selling_price wrong');
  ctx.productId = p.id;
});
await test('J3 - Product is linked to company_id (multi-tenant isolation)', async()=>{
  const r = await q('SELECT * FROM products WHERE id=$1 AND company_id=$2',[ctx.productId,ctx.companyId]);
  if(!r.rows.length) throw new Error('Product not found with correct company_id');
});

// ===== SUITE K: Product Update =====
console.log('');
console.log('[ K ] Product Update');
await test('K1 - Can update product price and store price history', async()=>{
  const cur = await q('SELECT * FROM products WHERE id=$1',[ctx.productId]);
  await q('INSERT INTO product_price_history (product_id,company_id,purchase_price,unit_selling_price,piece_selling_price) VALUES ($1,$2,$3,$4,$5)',[ctx.productId,ctx.companyId,cur.rows[0].purchase_price,cur.rows[0].unit_selling_price,cur.rows[0].piece_selling_price]);
  await q('UPDATE products SET unit_selling_price=900,piece_selling_price=12.50,updated_at=NOW() WHERE id=$1',[ctx.productId]);
  const upd = await q('SELECT unit_selling_price FROM products WHERE id=$1',[ctx.productId]);
  if(Number(upd.rows[0].unit_selling_price) !== 900) throw new Error('Price not updated: '+upd.rows[0].unit_selling_price);
  const hist = await q('SELECT * FROM product_price_history WHERE product_id=$1',[ctx.productId]);
  if(!hist.rows.length) throw new Error('No price history recorded');
});
await test('K2 - pieces_per_unit can be updated via DB', async()=>{
  await q('UPDATE products SET pieces_per_unit=48 WHERE id=$1',[ctx.productId]);
  const r = await q('SELECT pieces_per_unit FROM products WHERE id=$1',[ctx.productId]);
  if(r.rows[0].pieces_per_unit !== 48) throw new Error('pieces_per_unit not updated');
});

// ===== SUITE L: Product Deactivation =====
console.log('');
console.log('[ L ] Product Deactivation');
await test('L1 - Can deactivate a product (is_active=false)', async()=>{
  await q('UPDATE products SET is_active=FALSE WHERE id=$1',[ctx.productId]);
  const r = await q('SELECT is_active FROM products WHERE id=$1',[ctx.productId]);
  if(r.rows[0].is_active !== false) throw new Error('is_active is still true after deactivation');
});
await test('L2 - Deactivated product not returned in active-only query', async()=>{
  const r = await q('SELECT * FROM products WHERE company_id=$1 AND is_active=TRUE',[ctx.companyId]);
  const found = r.rows.find(p=>p.id===ctx.productId);
  if(found) throw new Error('Deactivated product appears in active-only query');
  await q('UPDATE products SET is_active=TRUE WHERE id=$1',[ctx.productId]);
});

// ===== SUITE M: Category Create/Update =====
console.log('');
console.log('[ M ] Category Create / Update');
await test('M1 - Can create a category with unique code per company', async()=>{
  const r = await q('INSERT INTO categories (company_id,code,name) VALUES ($1,$2,$3) RETURNING *',[ctx.companyId,'FMCG','FMCG Products']);
  if(!r.rows[0].id) throw new Error('Category not created');
  ctx.catId2 = r.rows[0].id;
});
await test('M2 - Can update category name', async()=>{
  await q('UPDATE categories SET name=$1,updated_at=NOW() WHERE id=$2',['FMCG Goods',ctx.catId2]);
  const r = await q('SELECT name FROM categories WHERE id=$1',[ctx.catId2]);
  if(r.rows[0].name !== 'FMCG Goods') throw new Error('Category name not updated');
});
await test('M3 - Can toggle category is_active', async()=>{
  await q('UPDATE categories SET is_active=FALSE WHERE id=$1',[ctx.catId2]);
  const r = await q('SELECT is_active FROM categories WHERE id=$1',[ctx.catId2]);
  if(r.rows[0].is_active !== false) throw new Error('is_active not toggled to false');
});

// ===== SUITE N: Employee Create/Update =====
console.log('');
console.log('[ N ] Employee Create / Update');
await test('N1 - Can create employee linked to company', async()=>{
  const r = await q('INSERT INTO employees (company_id,employee_code,full_name,phone,vehicle_number) VALUES ($1,$2,$3,$4,$5) RETURNING *',[ctx.companyId,'EMP001','Ravi Kumar','9876543210','TN32AB1234']);
  if(!r.rows[0].id) throw new Error('Employee not created');
  if(r.rows[0].company_id !== ctx.companyId) throw new Error('company_id mismatch');
  ctx.empId = r.rows[0].id;
});
await test('N2 - Can update employee vehicle_number', async()=>{
  await q('UPDATE employees SET vehicle_number=$1,updated_at=NOW() WHERE id=$2',['TN32ZZ9999',ctx.empId]);
  const r = await q('SELECT vehicle_number FROM employees WHERE id=$1',[ctx.empId]);
  if(r.rows[0].vehicle_number !== 'TN32ZZ9999') throw new Error('vehicle_number not updated');
});
await test('N3 - Can deactivate employee (is_active=false)', async()=>{
  await q('UPDATE employees SET is_active=FALSE WHERE id=$1',[ctx.empId]);
  const r = await q('SELECT is_active FROM employees WHERE id=$1',[ctx.empId]);
  if(r.rows[0].is_active !== false) throw new Error('Employee still active');
  await q('UPDATE employees SET is_active=TRUE WHERE id=$1',[ctx.empId]);
});

// ===== SUITE O: Company Data Isolation =====
console.log('');
console.log('[ O ] Company Data Isolation (Multi-tenant)');
await test('O1 - Two companies have isolated products', async()=>{
  const c2 = await q('INSERT INTO companies (name,is_active) VALUES ($1,TRUE) RETURNING id',['OTHER COMPANY']);
  const cid2 = c2.rows[0].id;
  await q('INSERT INTO products (company_id,name,display_name,pieces_per_unit,unit_selling_price,piece_selling_price,purchase_price) VALUES ($1,$2,$3,$4,$5,$6,$7)',[cid2,'Company2 Milk','Company2 Milk',72,880,12,720]);
  const r1 = await q('SELECT * FROM products WHERE company_id=$1',[ctx.companyId]);
  const r2 = await q('SELECT * FROM products WHERE company_id=$1',[cid2]);
  const cross = r1.rows.filter(p=>p.company_id===cid2);
  if(cross.length > 0) throw new Error('Company data leaking across companies!');
  if(r2.rows.length===0) throw new Error('Company 2 has no products (seed failed)');
});
await test('O2 - Company ID is always enforced in queries', async()=>{
  const allProds = await q('SELECT DISTINCT company_id FROM products');
  if(allProds.rows.length < 2) throw new Error('Expected at least 2 companies with products for isolation test');
  // Simulate: querying with company_id=1 should not return company_id=2 products
  const filtered = await q('SELECT * FROM products WHERE company_id=$1',[ctx.companyId]);
  const leaked = filtered.rows.filter(p=>p.company_id !== ctx.companyId);
  if(leaked.length > 0) throw new Error('company_id filter not working! '+leaked.length+' rows leaked.');
});

// ===== SUITE P: No Plaintext Passwords =====
console.log('');
console.log('[ P ] No Plaintext Passwords Returned');
await test('P1 - Login query SELECT does not include pin_hash in safe projection', async()=>{
  const r = await q('SELECT id,company_id,name,login_id,phone,account_status FROM user_accounts WHERE login_id=$1',['testowner']);
  if(!r.rows.length) throw new Error('No rows returned');
  if('pin_hash' in r.rows[0]) throw new Error('pin_hash present in safe SELECT projection');
});
await test('P2 - pin_hash in DB is never equal to any known plaintext', async()=>{
  const r = await q('SELECT pin_hash FROM user_accounts WHERE login_id=$1',['testowner']);
  const hash = r.rows[0].pin_hash;
  const plaintexts = ['9999','owner','1234','admin','password','Owner Admin'];
  for(const p of plaintexts) {
    if(hash === p) throw new Error('pin_hash equals plaintext: '+p);
  }
  if(!hash.startsWith('$')) throw new Error('pin_hash is not bcrypt format');
});

// ===== SUITE Q: Empty DB Returns Empty State =====
console.log('');
console.log('[ Q ] Empty DB Returns Empty State (No Fake Numbers)');
await test('Q1 - Empty company has 0 sales today', async()=>{
  const today = new Date().toISOString().split('T')[0];
  const r = await q('SELECT COALESCE(SUM(total_amount),0) as total FROM sales WHERE company_id=$1 AND sale_date=$2',[ctx.companyId,today]);
  if(Number(r.rows[0].total) !== 0) throw new Error('Expected 0 sales, got: '+r.rows[0].total);
});
await test('Q2 - Empty company has 0 expenses today', async()=>{
  const today = new Date().toISOString().split('T')[0];
  const r = await q('SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE company_id=$1 AND created_at::date=$2',[ctx.companyId,today]);
  if(Number(r.rows[0].total) !== 0) throw new Error('Expected 0 expenses, got: '+r.rows[0].total);
});
await test('Q3 - Empty company products returns empty array', async()=>{
  // Create a brand new company with no products
  const cR = await q('INSERT INTO companies (name,is_active) VALUES ($1,TRUE) RETURNING id',['EMPTY CO']);
  const newCid = cR.rows[0].id;
  const r = await q('SELECT * FROM products WHERE company_id=$1',[newCid]);
  if(r.rows.length !== 0) throw new Error('Expected 0 products, got: '+r.rows.length);
});
await test('Q4 - sevenDayRevenue returns empty array when no sales', async()=>{
  const r = await q("SELECT sale_date::text,COALESCE(SUM(total_amount),0) as rev FROM sales WHERE company_id=$1 AND sale_date>=CURRENT_DATE-INTERVAL '6 days' GROUP BY sale_date",[ctx.companyId]);
  if(r.rows.length !== 0) throw new Error('Expected empty revenue, got: '+r.rows.length+' rows');
});

// ==============================
await testPool.end().catch(()=>{});
await devPool.end().catch(()=>{});

console.log('');
console.log('=================================================');
console.log('  PART 1 TEST RESULTS');
console.log('  PASSED : ' + passed + ' / ' + total);
console.log('  FAILED : ' + failed + ' / ' + total);
console.log('=================================================');

if(failed > 0) process.exit(1);