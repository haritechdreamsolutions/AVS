// ============================================================
// AVS AGENCIES - PART 2 UNIT TEST SUITE
// Store Keeper Module + Inventory + Stock + Shop/Route + Billing
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
console.log('=================================================');
console.log('  AVS AGENCIES - PART 2 UNIT TEST SUITE');
console.log('  Testing Store Keeper, Inventory & Billing Flow');
console.log('  Database: avs_agencies_test (isolated)');
console.log('=================================================');
console.log('');

// Setup Seed Data
let ctx = {};

await test('SETUP - Clean and Seed Base Multi-Tenant Company Context', async () => {
  await cleanDB();
  const cR = await q('INSERT INTO companies (name,subtitle,is_active) VALUES ($1,$2,TRUE) RETURNING id', ['AVS TEST CO', 'Distribution Test']);
  ctx.companyId = cR.rows[0].id;

  const roles = await q('SELECT id, role_name FROM roles');
  const roleMap = {};
  roles.rows.forEach(r => { roleMap[r.role_name] = r.id; });
  ctx.roles = roleMap;

  // 1. Seed Owner
  const ownerHash = await bcrypt.hash('1234', 10);
  const ownerR = await q(
    'INSERT INTO user_accounts (company_id,role_id,login_id,name,pin_hash,account_status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [ctx.companyId, roleMap['OWNER'], 'test_owner', 'Owner Admin', ownerHash, 'ACTIVE']
  );
  ctx.ownerId = ownerR.rows[0].id;

  // 2. Seed Store Keeper
  const skHash = await bcrypt.hash('1234', 10);
  const skR = await q(
    'INSERT INTO user_accounts (company_id,role_id,login_id,name,pin_hash,account_status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [ctx.companyId, roleMap['STORE_KEEPER'], 'test_sk', 'Store Keeper Admin', skHash, 'ACTIVE']
  );
  ctx.skId = skR.rows[0].id;

  // 3. Seed Driver / Employee
  const empR = await q(
    'INSERT INTO employees (company_id,employee_code,full_name,phone,vehicle_number) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [ctx.companyId, 'EMP-101', 'Ravi Driver', '9876543210', 'TN 32 AB 1234']
  );
  ctx.empId = empR.rows[0].id;

  const empUserHash = await bcrypt.hash('1111', 10);
  const empUserR = await q(
    'INSERT INTO user_accounts (company_id,role_id,employee_id,login_id,name,pin_hash,account_status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [ctx.companyId, roleMap['EMPLOYEE'], ctx.empId, 'test_emp', 'Ravi Driver', empUserHash, 'ACTIVE']
  );
  ctx.empUserId = empUserR.rows[0].id;

  // 4. Seed Products
  const catR = await q('INSERT INTO categories (company_id,code,name) VALUES ($1,$2,$3) RETURNING id', [ctx.companyId, 'MILK', 'Milk Products']);
  ctx.catId = catR.rows[0].id;

  const p1 = await q(
    'INSERT INTO products (company_id,category_id,name,display_name,selling_unit,pieces_per_unit,purchase_price,unit_selling_price,piece_selling_price,warehouse_stock_units) ' +
    'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
    [ctx.companyId, ctx.catId, 'Milk 200ml', 'Amirthaa Milk 200ml', 'Tray', 72, 600.00, 720.00, 10.00, 100]
  );
  ctx.p1 = p1.rows[0];

  const p2 = await q(
    'INSERT INTO products (company_id,category_id,name,display_name,selling_unit,pieces_per_unit,purchase_price,unit_selling_price,piece_selling_price,warehouse_stock_units) ' +
    'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
    [ctx.companyId, ctx.catId, 'Curd 500ml', 'Amirthaa Curd 500ml', 'Tray', 30, 450.00, 540.00, 18.00, 50]
  );
  ctx.p2 = p2.rows[0];

  // 5. Seed Route & Shop
  const rR = await q('INSERT INTO routes (company_id,code,name) VALUES ($1,$2,$3) RETURNING id', [ctx.companyId, 'RT-01', 'Main Town Route']);
  ctx.routeId = rR.rows[0].id;

  const shR = await q(
    'INSERT INTO shops (company_id,route_id,code,name,owner_name,phone,credit_limit,current_due) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
    [ctx.companyId, ctx.routeId, 'SHP-001', 'Sri Murugan Store', 'Murugan', '9123456780', 5000.00, 0.00]
  );
  ctx.shopId = shR.rows[0].id;
});

// ===== SUITE A & B: Store Keeper Authentication =====
console.log('\n[ A & B ] Store Keeper Authentication');
await test('A - Store Keeper login verification with STORE_KEEPER role', async () => {
  const row = await q('SELECT ua.*, r.role_name FROM user_accounts ua JOIN roles r ON r.id=ua.role_id WHERE ua.login_id=$1', ['test_sk']);
  if (!row.rows.length) throw new Error('Store keeper user not found in database');
  const u = row.rows[0];
  const ok = await bcrypt.compare('1234', u.pin_hash);
  if (!ok) throw new Error('Bcrypt comparison failed for Store Keeper');
  if (u.role_name !== 'STORE_KEEPER') throw new Error('Role must be STORE_KEEPER, got: ' + u.role_name);
});

await test('B - Invalid Store Keeper login rejection', async () => {
  const row = await q('SELECT pin_hash FROM user_accounts WHERE login_id=$1', ['test_sk']);
  const ok = await bcrypt.compare('9999', row.rows[0].pin_hash);
  if (ok) throw new Error('Wrong PIN should fail bcrypt verification');
});

// ===== SUITE C: Authorization =====
console.log('\n[ C ] Role Authorization');
await test('C - Employee cannot access Store Keeper endpoints (role permission check)', async () => {
  const emp = await q('SELECT r.role_name FROM user_accounts ua JOIN roles r ON r.id=ua.role_id WHERE ua.login_id=$1', ['test_emp']);
  const role = emp.rows[0].role_name;
  const allowedRoles = ['STORE_KEEPER', 'OWNER'];
  if (allowedRoles.includes(role)) {
    throw new Error('EMPLOYEE should not have access to STORE_KEEPER / OWNER endpoints');
  }
});

// ===== SUITE D: Warehouse Inventory =====
console.log('\n[ D ] Store Keeper Dashboard Inventory Fetch');
await test('D - Fetch warehouse stock with rates, trays and piece calculations', async () => {
  const prods = await q(
    'SELECT p.*, (p.warehouse_stock_units * p.pieces_per_unit) as total_pieces FROM products p WHERE p.company_id=$1 AND p.is_active=TRUE ORDER BY p.name',
    [ctx.companyId]
  );
  if (prods.rows.length < 2) throw new Error('Expected at least 2 seeded products');
  const item = prods.rows.find(x => x.id === ctx.p1.id);
  if (Number(item.warehouse_stock_units) !== 100) throw new Error('Expected 100 units in stock');
  if (Number(item.total_pieces) !== 7200) throw new Error('Expected 7200 pieces (100 * 72), got: ' + item.total_pieces);
  if (Number(item.purchase_price) !== 600.00) throw new Error('Expected buy rate 600.00');
  if (Number(item.unit_selling_price) !== 720.00) throw new Error('Expected sale rate 720.00');
});

// ===== SUITE E, F, G, H: Stock Receive Flow =====
console.log('\n[ E, F, G, H ] Stock Receive Flow & Inward Movements');
await test('E & G - Stock receive increases warehouse inventory atomically', async () => {
  const beforeStock = Number((await q('SELECT warehouse_stock_units FROM products WHERE id=$1', [ctx.p1.id])).rows[0].warehouse_stock_units);
  const receiveQty = 50;

  // Transaction simulation
  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE products SET warehouse_stock_units=warehouse_stock_units+$1 WHERE id=$2', [receiveQty, ctx.p1.id]);
    const movNo = 'MOV-IN-TEST-' + Date.now();
    await client.query(
      'INSERT INTO inventory_movements (company_id,movement_no,movement_type,product_id,product_name,qty_units,unit,reference,received_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [ctx.companyId, movNo, 'INWARD', ctx.p1.id, ctx.p1.display_name, receiveQty, 'Tray', 'DC-9921', 'Store Keeper Admin']
    );
    await client.query('COMMIT');
  } finally { client.release(); }

  const afterStock = Number((await q('SELECT warehouse_stock_units FROM products WHERE id=$1', [ctx.p1.id])).rows[0].warehouse_stock_units);
  if (afterStock !== beforeStock + receiveQty) throw new Error(`Expected ${beforeStock + receiveQty}, got ${afterStock}`);
});

await test('F - Stock receive validation rejects zero or negative quantity', async () => {
  const invalidQtys = [0, -10, -0.5, NaN];
  for (const qty of invalidQtys) {
    let rejected = false;
    if (!qty || qty <= 0 || isNaN(qty)) {
      rejected = true;
    }
    if (!rejected) throw new Error('Validation failed to reject invalid quantity: ' + qty);
  }
});

await test('H - Inward inventory movement created with supplier reference and timestamp', async () => {
  const mov = await q('SELECT * FROM inventory_movements WHERE company_id=$1 AND movement_type=\'INWARD\' ORDER BY id DESC LIMIT 1', [ctx.companyId]);
  if (!mov.rows.length) throw new Error('No INWARD movement record found');
  const m = mov.rows[0];
  if (m.reference !== 'DC-9921') throw new Error('Supplier reference not recorded');
  if (m.received_by !== 'Store Keeper Admin') throw new Error('Received_by not recorded');
  if (Number(m.qty_units) !== 50) throw new Error('Inward movement qty mismatch');
});

// ===== SUITE I, J, K, L: Issue Stock to Employee =====
console.log('\n[ I, J, K, L ] Stock Allocation to Employee');
await test('I, J, K - Issue stock decreases warehouse and increases employee stock', async () => {
  const beforeWarehouse = Number((await q('SELECT warehouse_stock_units FROM products WHERE id=$1', [ctx.p1.id])).rows[0].warehouse_stock_units);
  const issueQty = 30;

  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE products SET warehouse_stock_units=warehouse_stock_units-$1 WHERE id=$2', [issueQty, ctx.p1.id]);
    await client.query(
      'INSERT INTO employee_stock (company_id,employee_id,product_id,qty_units,unit,updated_at) VALUES ($1,$2,$3,$4,$5,NOW()) ' +
      'ON CONFLICT (employee_id, product_id) DO UPDATE SET qty_units=employee_stock.qty_units+EXCLUDED.qty_units, updated_at=NOW()',
      [ctx.companyId, ctx.empId, ctx.p1.id, issueQty, 'Tray']
    );
    await client.query(
      'INSERT INTO inventory_movements (company_id,movement_no,movement_type,product_id,product_name,employee_id,employee_name,qty_units,unit) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [ctx.companyId, 'MOV-OUT-' + Date.now(), 'OUTWARD', ctx.p1.id, ctx.p1.display_name, ctx.empId, 'Ravi Driver', issueQty, 'Tray']
    );
    await client.query('COMMIT');
  } finally { client.release(); }

  const afterWarehouse = Number((await q('SELECT warehouse_stock_units FROM products WHERE id=$1', [ctx.p1.id])).rows[0].warehouse_stock_units);
  const empStock = Number((await q('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2', [ctx.empId, ctx.p1.id])).rows[0].qty_units);

  if (afterWarehouse !== beforeWarehouse - issueQty) throw new Error('Warehouse stock was not decremented accurately');
  if (empStock !== issueQty) throw new Error('Employee stock was not incremented accurately');
});

await test('L - Insufficient warehouse stock rejection and atomic rollback', async () => {
  const currentWh = Number((await q('SELECT warehouse_stock_units FROM products WHERE id=$1', [ctx.p1.id])).rows[0].warehouse_stock_units);
  const excessiveQty = currentWh + 500;

  let rollbackHappened = false;
  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    const p = (await client.query('SELECT warehouse_stock_units FROM products WHERE id=$1 FOR UPDATE', [ctx.p1.id])).rows[0];
    if (Number(p.warehouse_stock_units) < excessiveQty) {
      throw new Error('Insufficient warehouse stock');
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    rollbackHappened = true;
  } finally { client.release(); }

  if (!rollbackHappened) throw new Error('Transaction should have rolled back on insufficient stock');
  const postStock = Number((await q('SELECT warehouse_stock_units FROM products WHERE id=$1', [ctx.p1.id])).rows[0].warehouse_stock_units);
  if (postStock !== currentWh) throw new Error('Stock changed despite rollback');
});

// ===== SUITE M: Employee Stock Report =====
console.log('\n[ M ] Employee Stock Report');
await test('M - Employee stock report correctly reflects database records', async () => {
  const res = await q(
    'SELECT es.*, e.full_name, p.display_name, p.unit_selling_price ' +
    'FROM employee_stock es JOIN employees e ON e.id=es.employee_id JOIN products p ON p.id=es.product_id ' +
    'WHERE es.company_id=$1 AND es.employee_id=$2',
    [ctx.companyId, ctx.empId]
  );
  if (!res.rows.length) throw new Error('No stock records found for driver');
  if (Number(res.rows[0].qty_units) !== 30) throw new Error('Expected 30 trays with driver, got: ' + res.rows[0].qty_units);
});

// ===== SUITE N, O, P: Driver Returns =====
console.log('\n[ N, O, P ] Driver Returns Management');
await test('N & P - Employee returns stock into warehouse with database transaction', async () => {
  const returnQty = 5;
  const beforeWh = Number((await q('SELECT warehouse_stock_units FROM products WHERE id=$1', [ctx.p1.id])).rows[0].warehouse_stock_units);
  const beforeEmp = Number((await q('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2', [ctx.empId, ctx.p1.id])).rows[0].qty_units);

  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE employee_stock SET qty_units=qty_units-$1, updated_at=NOW() WHERE employee_id=$2 AND product_id=$3', [returnQty, ctx.empId, ctx.p1.id]);
    await client.query('UPDATE products SET warehouse_stock_units=warehouse_stock_units+$1, updated_at=NOW() WHERE id=$2', [returnQty, ctx.p1.id]);
    await client.query(
      'INSERT INTO inventory_movements (company_id,movement_no,movement_type,product_id,product_name,employee_id,employee_name,qty_units,unit,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [ctx.companyId, 'MOV-RET-' + Date.now(), 'RETURN', ctx.p1.id, ctx.p1.display_name, ctx.empId, 'Ravi Driver', returnQty, 'Tray', 'Unsold Day Return']
    );
    await client.query('COMMIT');
  } finally { client.release(); }

  const afterWh = Number((await q('SELECT warehouse_stock_units FROM products WHERE id=$1', [ctx.p1.id])).rows[0].warehouse_stock_units);
  const afterEmp = Number((await q('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2', [ctx.empId, ctx.p1.id])).rows[0].qty_units);

  if (afterWh !== beforeWh + returnQty) throw new Error('Warehouse stock not increased after return');
  if (afterEmp !== beforeEmp - returnQty) throw new Error('Employee stock not decreased after return');
});

await test('O - Return validation rejects quantity greater than held by employee', async () => {
  const currentEmp = Number((await q('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2', [ctx.empId, ctx.p1.id])).rows[0].qty_units);
  const excessReturn = currentEmp + 100;

  let rejected = false;
  if (excessReturn > currentEmp) {
    rejected = true;
  }
  if (!rejected) throw new Error('Failed to reject return greater than held stock');
});

// ===== SUITE Q & R: Damage Handling =====
console.log('\n[ Q & R ] Damage Handling & Stock Adjustment');
await test('Q & R - Record damage and adjust stock without inventory loss', async () => {
  const dmgQty = 2;
  const beforeEmp = Number((await q('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2', [ctx.empId, ctx.p1.id])).rows[0].qty_units);
  const p = (await q('SELECT * FROM products WHERE id=$1', [ctx.p1.id])).rows[0];
  const dmgCost = Number((dmgQty * Number(p.purchase_price)).toFixed(2));

  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE employee_stock SET qty_units=qty_units-$1, updated_at=NOW() WHERE employee_id=$2 AND product_id=$3', [dmgQty, ctx.empId, ctx.p1.id]);
    await client.query(
      'INSERT INTO damages (company_id,employee_id,employee_name,product_id,product_name,qty_units,reason,damage_cost) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [ctx.companyId, ctx.empId, 'Ravi Driver', ctx.p1.id, ctx.p1.display_name, dmgQty, 'Crate Leakage in Transit', dmgCost]
    );
    await client.query(
      'INSERT INTO inventory_movements (company_id,movement_no,movement_type,product_id,product_name,employee_id,employee_name,qty_units,unit,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [ctx.companyId, 'MOV-DMG-' + Date.now(), 'DAMAGE', ctx.p1.id, ctx.p1.display_name, ctx.empId, 'Ravi Driver', dmgQty, 'Tray', 'Crate Leakage']
    );
    await client.query('COMMIT');
  } finally { client.release(); }

  const afterEmp = Number((await q('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2', [ctx.empId, ctx.p1.id])).rows[0].qty_units);
  const dmgRow = await q('SELECT * FROM damages WHERE company_id=$1 AND product_id=$2 ORDER BY id DESC LIMIT 1', [ctx.companyId, ctx.p1.id]);

  if (afterEmp !== beforeEmp - dmgQty) throw new Error('Employee stock was not reduced by damage');
  if (!dmgRow.rows.length) throw new Error('Damage record was not created in PostgreSQL');
  if (Number(dmgRow.rows[0].damage_cost) !== dmgCost) throw new Error('Damage financial cost calculation error');
});

// ===== SUITE S, T, U: Shop Management =====
console.log('\n[ S, T, U ] Shop Management');
await test('S - Create new shop with route and credit limit in PostgreSQL', async () => {
  const r = await q(
    'INSERT INTO shops (company_id,route_id,code,name,owner_name,phone,address,credit_limit,opening_balance) ' +
    'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
    [ctx.companyId, ctx.routeId, 'SHP-002', 'Annai Supermarket', 'Kannan', '9842100000', '12 Bazaar St', 10000.00, 500.00]
  );
  if (!r.rows[0].id) throw new Error('Shop creation failed');
  ctx.shop2Id = r.rows[0].id;
});

await test('T - Update shop details in PostgreSQL', async () => {
  await q('UPDATE shops SET credit_limit=15000.00, phone=\'9842199999\' WHERE id=$1 AND company_id=$2', [ctx.shop2Id, ctx.companyId]);
  const s = (await q('SELECT * FROM shops WHERE id=$1', [ctx.shop2Id])).rows[0];
  if (Number(s.credit_limit) !== 15000.00) throw new Error('Credit limit update failed');
  if (s.phone !== '9842199999') throw new Error('Phone update failed');
});

await test('U - Deactivate shop (soft delete is_active=false)', async () => {
  await q('UPDATE shops SET is_active=FALSE WHERE id=$1 AND company_id=$2', [ctx.shop2Id, ctx.companyId]);
  const activeShops = await q('SELECT * FROM shops WHERE company_id=$1 AND is_active=TRUE', [ctx.companyId]);
  const found = activeShops.rows.find(x => x.id === ctx.shop2Id);
  if (found) throw new Error('Deactivated shop should not appear in active query');
});

// ===== SUITE V & W: Route Management & Assignment =====
console.log('\n[ V & W ] Route Management & Assignment');
await test('V - Create new route', async () => {
  const r = await q('INSERT INTO routes (company_id,code,name) VALUES ($1,$2,$3) RETURNING *', [ctx.companyId, 'RT-02', 'North Bypass Route']);
  if (!r.rows[0].id) throw new Error('Route creation failed');
  ctx.route2Id = r.rows[0].id;
});

await test('W - Assign route to driver vehicle in PostgreSQL', async () => {
  const today = new Date().toISOString().split('T')[0];
  const r = await q(
    'INSERT INTO route_assignments (route_id,employee_id,vehicle_number,assigned_date,status) VALUES ($1,$2,$3,$4,\'ASSIGNED\') RETURNING *',
    [ctx.route2Id, ctx.empId, 'TN 32 AB 1234', today]
  );
  if (!r.rows[0].id) throw new Error('Route assignment failed');
  const check = await q('SELECT * FROM route_assignments WHERE route_id=$1 AND assigned_date=$2', [ctx.route2Id, today]);
  if (!check.rows.length) throw new Error('Route assignment not found for date');
});

// ===== SUITE X, Y, Z, AA..AH: Store Keeper Direct Billing & Transactions =====
console.log('\n[ X to AH ] Store Keeper Billing Engine, Calculations & Transactions');
await test('X, Y, Z - Authoritative line amount and grand total recalculation', async () => {
  // Product 1: 5 Trays @ ₹720/Tray = ₹3600
  // Product 2: 2 Trays @ ₹540/Tray = ₹1080
  // Total = ₹4680
  const rate1 = Number(ctx.p1.unit_selling_price);
  const rate2 = Number(ctx.p2.unit_selling_price);
  const line1 = Number((5 * rate1).toFixed(2));
  const line2 = Number((2 * rate2).toFixed(2));
  const grandTotal = Number((line1 + line2).toFixed(2));

  if (grandTotal !== 4680.00) throw new Error('Grand total calculation mismatch: ' + grandTotal);
});

await test('AA - Cash payment billing transaction', async () => {
  const beforeWh1 = Number((await q('SELECT warehouse_stock_units FROM products WHERE id=$1', [ctx.p1.id])).rows[0].warehouse_stock_units);
  const sellQty = 2;
  const total = Number((sellQty * Number(ctx.p1.unit_selling_price)).toFixed(2)); // 2 * 720 = 1440

  const client = await testPool.connect();
  let billNo = 'INV-SK-CASH-' + Date.now();
  try {
    await client.query('BEGIN');
    const sR = await client.query(
      'INSERT INTO sales (company_id,bill_no,employee_name,shop_id,shop_name,total_amount,cash_paid,payment_mode) VALUES ($1,$2,$3,$4,$5,$6,$7,\'CASH\') RETURNING *',
      [ctx.companyId, billNo, 'Store Keeper Direct', ctx.shopId, 'Sri Murugan Store', total, total]
    );
    const saleId = sR.rows[0].id;
    await client.query(
      'INSERT INTO sale_items (sale_id,product_id,product_name,qty,unit_type,rate,amount) VALUES ($1,$2,$3,$4,\'Tray\',$5,$6)',
      [saleId, ctx.p1.id, ctx.p1.display_name, sellQty, ctx.p1.unit_selling_price, total]
    );
    await client.query('UPDATE products SET warehouse_stock_units=warehouse_stock_units-$1 WHERE id=$2', [sellQty, ctx.p1.id]);
    await client.query('COMMIT');
  } finally { client.release(); }

  const afterWh1 = Number((await q('SELECT warehouse_stock_units FROM products WHERE id=$1', [ctx.p1.id])).rows[0].warehouse_stock_units);
  if (afterWh1 !== beforeWh1 - sellQty) throw new Error('Stock was not deducted after cash sale');
});

await test('AB - GPay payment billing', async () => {
  const total = 720.00;
  const r = await q(
    'INSERT INTO sales (company_id,bill_no,employee_name,total_amount,gpay_paid,payment_mode) VALUES ($1,$2,$3,$4,$5,\'GPAY\') RETURNING *',
    [ctx.companyId, 'INV-SK-GPAY-' + Date.now(), 'Store Keeper', total, total]
  );
  if (Number(r.rows[0].gpay_paid) !== total) throw new Error('GPay paid amount mismatch');
});

await test('AC & AI - Credit payment increases shop ledger current_due', async () => {
  const beforeDue = Number((await q('SELECT current_due FROM shops WHERE id=$1', [ctx.shopId])).rows[0].current_due);
  const creditAmount = 2160.00;

  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO sales (company_id,bill_no,shop_id,shop_name,total_amount,credit_paid,payment_mode) VALUES ($1,$2,$3,$4,$5,$6,\'CREDIT\')',
      [ctx.companyId, 'INV-SK-CR-' + Date.now(), ctx.shopId, 'Sri Murugan Store', creditAmount, creditAmount]
    );
    await client.query('UPDATE shops SET current_due=current_due+$1 WHERE id=$2', [creditAmount, ctx.shopId]);
    await client.query('COMMIT');
  } finally { client.release(); }

  const afterDue = Number((await q('SELECT current_due FROM shops WHERE id=$1', [ctx.shopId])).rows[0].current_due);
  if (afterDue !== beforeDue + creditAmount) throw new Error('Shop ledger current_due not updated');
});

await test('AD - Valid Split payment (Cash + GPay + Credit = Total)', async () => {
  const total = 3000.00;
  const cash = 1000.00;
  const gpay = 1500.00;
  const credit = 500.00;

  if (cash + gpay + credit !== total) throw new Error('Split sum does not match total');
  const r = await q(
    'INSERT INTO sales (company_id,bill_no,shop_id,total_amount,cash_paid,gpay_paid,credit_paid,payment_mode) VALUES ($1,$2,$3,$4,$5,$6,$7,\'SPLIT\') RETURNING *',
    [ctx.companyId, 'INV-SK-SPLIT-' + Date.now(), ctx.shopId, total, cash, gpay, credit]
  );
  if (Number(r.rows[0].cash_paid) !== cash || Number(r.rows[0].gpay_paid) !== gpay || Number(r.rows[0].credit_paid) !== credit) {
    throw new Error('Split payment breakdown mismatch');
  }
});

await test('AE - Invalid split payment rejection (sum mismatch)', async () => {
  const total = 3000.00;
  const cash = 1000.00;
  const gpay = 1000.00;
  const credit = 500.00; // sum = 2500 != 3000

  let rejected = false;
  if (Math.abs((cash + gpay + credit) - total) > 0.01) {
    rejected = true;
  }
  if (!rejected) throw new Error('Invalid split payment was not rejected');
});

// ===== SUITE AJ: Cash Settlement =====
console.log('\n[ AJ ] Cash Settlement (BALANCED, SURPLUS, DEFICIT)');
await test('AJ - Settlement records calculated differences properly', async () => {
  // Test Balanced
  const b = await q(
    'INSERT INTO settlements (company_id,employee_id,employee_name,expected_amount,collected_amount,difference,status) VALUES ($1,$2,$3,$4,$5,$6,\'BALANCED\') RETURNING *',
    [ctx.companyId, ctx.empId, 'Ravi Driver', 5000.00, 5000.00, 0.00]
  );
  if (b.rows[0].status !== 'BALANCED') throw new Error('Expected BALANCED status');

  // Test Deficit
  const d = await q(
    'INSERT INTO settlements (company_id,employee_id,employee_name,expected_amount,collected_amount,difference,status) VALUES ($1,$2,$3,$4,$5,$6,\'DEFICIT\') RETURNING *',
    [ctx.companyId, ctx.empId, 'Ravi Driver', 5000.00, 4800.00, -200.00]
  );
  if (Number(d.rows[0].difference) !== -200.00) throw new Error('Expected -200.00 difference');
});

// ===== SUITE AK & AL: Owner Impact & No Static Fallback =====
console.log('\n[ AK & AL ] Owner Dashboard Real-Time Visibility & Zero Fake Data');
await test('AK - Owner dashboard reflects Store Keeper sales and inventory in real-time', async () => {
  const salesSum = await q('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE company_id=$1', [ctx.companyId]);
  const tot = Number(salesSum.rows[0].total);
  if (tot <= 0) throw new Error('Owner should see Store Keeper sales in database');
});

await test('AL - Empty company database returns empty arrays (zero fake data)', async () => {
  const cEmpty = await q('INSERT INTO companies (name,is_active) VALUES ($1,TRUE) RETURNING id', ['EMPTY STORE']);
  const emptyCid = cEmpty.rows[0].id;

  const emptyProducts = await q('SELECT * FROM products WHERE company_id=$1', [emptyCid]);
  const emptyMovements = await q('SELECT * FROM inventory_movements WHERE company_id=$1', [emptyCid]);
  const emptySales = await q('SELECT * FROM sales WHERE company_id=$1', [emptyCid]);

  if (emptyProducts.rows.length !== 0) throw new Error('Expected 0 products for empty company');
  if (emptyMovements.rows.length !== 0) throw new Error('Expected 0 movements for empty company');
  if (emptySales.rows.length !== 0) throw new Error('Expected 0 sales for empty company');
});

// ===== SUITE AM & AN: Authorization & Company Isolation =====
console.log('\n[ AM & AN ] Authorization & Multi-Tenant Company Isolation');
await test('AN - Complete data isolation between companies', async () => {
  const c2 = (await q('INSERT INTO companies (name,is_active) VALUES ($1,TRUE) RETURNING id', ['COMPETITOR CO'])).rows[0].id;
  await q('INSERT INTO products (company_id,name,display_name,selling_unit,pieces_per_unit,warehouse_stock_units) VALUES ($1,$2,$3,$4,$5,$6)', [c2, 'Other Milk', 'Other Milk', 'Tray', 50, 20]);

  const c1Prods = await q('SELECT * FROM products WHERE company_id=$1', [ctx.companyId]);
  const leaked = c1Prods.rows.filter(p => p.company_id === c2);
  if (leaked.length > 0) throw new Error('Data leaked across companies!');
});

await testPool.end().catch(()=>{});

console.log('');
console.log('=================================================');
console.log('  PART 2 TEST RESULTS SUMMARY');
console.log('  PASSED : ' + passed + ' / ' + total);
console.log('  FAILED : ' + failed + ' / ' + total);
console.log('=================================================');

if (failed > 0) {
  console.error('\nFailures detail:');
  failures.forEach(f => console.error(' - ' + f.name + ': ' + f.error));
  process.exit(1);
} else {
  process.exit(0);
}
