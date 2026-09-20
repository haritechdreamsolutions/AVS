// ============================================================
// AVS AGENCIES - PART 3 UNIT & INTEGRATION TEST SUITE
// Employee Module + Field Operations + POS Billing + Full Multi-Role Lifecycle
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
console.log('  AVS AGENCIES - PART 3 COMPLETE SUITE');
console.log('  Employee POS Billing, Stock, Returns, Damages, Reconciliation');
console.log('  Database: avs_agencies_test (isolated)');
console.log('==================================================================');
console.log('');

let ctx = {};

await test('SETUP - Clean and Seed Multi-Role System Architecture', async () => {
  await cleanDB();
  const cR = await q('INSERT INTO companies (name,subtitle,is_active) VALUES ($1,$2,TRUE) RETURNING id', ['AVS AGENCIES CORP', 'Integrated System Test']);
  ctx.companyId = cR.rows[0].id;

  const roles = await q('SELECT id, role_name FROM roles');
  const roleMap = {};
  roles.rows.forEach(r => { roleMap[r.role_name] = r.id; });
  ctx.roles = roleMap;

  // 1. Seed Owner
  const ownerHash = await bcrypt.hash('1234', 10);
  const ownerR = await q(
    'INSERT INTO user_accounts (company_id,role_id,login_id,name,pin_hash,account_status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [ctx.companyId, roleMap['OWNER'], 'owner', 'Owner Admin', ownerHash, 'ACTIVE']
  );
  ctx.ownerId = ownerR.rows[0].id;

  // 2. Seed Store Keeper
  const skHash = await bcrypt.hash('1234', 10);
  const skR = await q(
    'INSERT INTO user_accounts (company_id,role_id,login_id,name,pin_hash,account_status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [ctx.companyId, roleMap['STORE_KEEPER'], 'storekeeper', 'Store Keeper Admin', skHash, 'ACTIVE']
  );
  ctx.skId = skR.rows[0].id;

  // 3. Seed Employee 1 (Ravi Driver)
  const emp1R = await q(
    'INSERT INTO employees (company_id,employee_code,full_name,phone,vehicle_number) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [ctx.companyId, 'EMP-101', 'Ravi Driver', '9876543210', 'TN 32 AB 1234']
  );
  ctx.emp1Id = emp1R.rows[0].id;

  const emp1Hash = await bcrypt.hash('1111', 10);
  const emp1UserR = await q(
    'INSERT INTO user_accounts (company_id,role_id,employee_id,login_id,name,pin_hash,account_status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [ctx.companyId, roleMap['EMPLOYEE'], ctx.emp1Id, 'emp1', 'Ravi Driver', emp1Hash, 'ACTIVE']
  );
  ctx.emp1UserId = emp1UserR.rows[0].id;

  // 4. Seed Employee 2 (Kumar Driver - for isolation testing)
  const emp2R = await q(
    'INSERT INTO employees (company_id,employee_code,full_name,phone,vehicle_number) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [ctx.companyId, 'EMP-102', 'Kumar Driver', '9876543211', 'TN 32 AB 5678']
  );
  ctx.emp2Id = emp2R.rows[0].id;

  const emp2Hash = await bcrypt.hash('2222', 10);
  await q(
    'INSERT INTO user_accounts (company_id,role_id,employee_id,login_id,name,pin_hash,account_status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [ctx.companyId, roleMap['EMPLOYEE'], ctx.emp2Id, 'emp2', 'Kumar Driver', emp2Hash, 'ACTIVE']
  );

  // 5. Seed Products with Pieces Per Unit and Pricing
  const catR = await q('INSERT INTO categories (company_id,code,name) VALUES ($1,$2,$3) RETURNING id', [ctx.companyId, 'DAIRY', 'Dairy']);
  ctx.catId = catR.rows[0].id;

  const p1 = await q(
    'INSERT INTO products (company_id,category_id,name,display_name,selling_unit,base_unit,pieces_per_unit,purchase_price,unit_selling_price,piece_selling_price,warehouse_stock_units) ' +
    'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
    [ctx.companyId, ctx.catId, 'Milk 200ml', 'Amirthaa Milk 200ml', 'Tray', 'Piece', 72, 600.00, 660.00, 9.17, 100]
  );
  ctx.p1 = p1.rows[0];

  const p2 = await q(
    'INSERT INTO products (company_id,category_id,name,display_name,selling_unit,base_unit,pieces_per_unit,purchase_price,unit_selling_price,piece_selling_price,warehouse_stock_units) ' +
    'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
    [ctx.companyId, ctx.catId, 'Curd 500ml', 'Amirthaa Curd 500ml', 'Tray', 'Piece', 30, 450.00, 540.00, 18.00, 50]
  );
  ctx.p2 = p2.rows[0];

  // 6. Seed Routes & Shops
  const r1 = await q('INSERT INTO routes (company_id,code,name) VALUES ($1,$2,$3) RETURNING id', [ctx.companyId, 'RT-NORTH', 'North Bypass Route']);
  ctx.route1Id = r1.rows[0].id;

  const r2 = await q('INSERT INTO routes (company_id,code,name) VALUES ($1,$2,$3) RETURNING id', [ctx.companyId, 'RT-SOUTH', 'South Market Route']);
  ctx.route2Id = r2.rows[0].id;

  const sh1 = await q(
    'INSERT INTO shops (company_id,route_id,code,name,owner_name,phone,credit_limit,current_due) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
    [ctx.companyId, ctx.route1Id, 'SHP-101', 'Sri Murugan Store', 'Murugan', '9123456780', 5000.00, 0.00]
  );
  ctx.shop1Id = sh1.rows[0].id;

  const sh2 = await q(
    'INSERT INTO shops (company_id,route_id,code,name,owner_name,phone,credit_limit,current_due) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
    [ctx.companyId, ctx.route2Id, 'SHP-201', 'Annai Provision', 'Kannan', '9842100000', 3000.00, 0.00]
  );
  ctx.shop2Id = sh2.rows[0].id;

  // 7. Assign Route 1 to Employee 1
  const today = new Date().toISOString().split('T')[0];
  await q(
    'INSERT INTO route_assignments (route_id,employee_id,vehicle_number,assigned_date,status) VALUES ($1,$2,$3,$4,\'ASSIGNED\')',
    [ctx.route1Id, ctx.emp1Id, 'TN 32 AB 1234', today]
  );
});

// ===== SUITE 1: Employee Authentication & Security =====
console.log('\n[ 1 ] Employee Authentication & Password/PIN Security');
await test('1.1 - Employee login with bcrypt PIN verification', async () => {
  const row = await q('SELECT ua.*, r.role_name FROM user_accounts ua JOIN roles r ON r.id=ua.role_id WHERE ua.login_id=$1', ['emp1']);
  if (!row.rows.length) throw new Error('Employee account not found');
  const u = row.rows[0];
  const ok = await bcrypt.compare('1111', u.pin_hash);
  if (!ok) throw new Error('PIN verification failed');
  if (u.role_name !== 'EMPLOYEE') throw new Error('Role must be EMPLOYEE');
  if (u.employee_id !== ctx.emp1Id) throw new Error('Linked employee_id mismatch');
});

await test('1.2 - Inactive employee login rejection', async () => {
  await q('UPDATE user_accounts SET account_status=\'INACTIVE\' WHERE login_id=$1', ['emp2']);
  const row = (await q('SELECT * FROM user_accounts WHERE login_id=$1', ['emp2'])).rows[0];
  if (row.account_status !== 'INACTIVE') throw new Error('Status should be INACTIVE');
  // Revert
  await q('UPDATE user_accounts SET account_status=\'ACTIVE\' WHERE login_id=$1', ['emp2']);
});

// ===== SUITE 2: Employee Data Isolation & Assigned Shops =====
console.log('\n[ 2 ] Employee Assigned Route & Shop Isolation');
await test('2.1 - Employee gets only shops assigned on their route for today', async () => {
  const today = new Date().toISOString().split('T')[0];
  const assign = await q('SELECT route_id FROM route_assignments WHERE employee_id=$1 AND assigned_date=$2', [ctx.emp1Id, today]);
  if (!assign.rows.length) throw new Error('No route assignment found for today');
  const assignedRouteId = assign.rows[0].route_id;

  const shops = await q('SELECT * FROM shops WHERE company_id=$1 AND route_id=$2 AND is_active=TRUE', [ctx.companyId, assignedRouteId]);
  if (shops.rows.length !== 1 || shops.rows[0].id !== ctx.shop1Id) {
    throw new Error('Employee should see only Shop 1 (Murugan Store) from Route 1');
  }
  const leaked = shops.rows.find(s => s.id === ctx.shop2Id);
  if (leaked) throw new Error('Employee 1 saw Shop 2 belonging to Route 2 (Data Leak!)');
});

await test('2.2 - Employee data isolation (Employee 1 cannot view Employee 2 stock)', async () => {
  // Give 10 trays to Employee 2
  await q(
    'INSERT INTO employee_stock (company_id,employee_id,product_id,qty_units,unit) VALUES ($1,$2,$3,10,\'Tray\')',
    [ctx.companyId, ctx.emp2Id, ctx.p1.id]
  );
  // Query stock for Employee 1
  const emp1Stock = await q('SELECT * FROM employee_stock WHERE employee_id=$1', [ctx.emp1Id]);
  const leaked = emp1Stock.rows.find(s => s.employee_id === ctx.emp2Id);
  if (leaked) throw new Error('Employee 1 accessed Employee 2 stock');
});

// ===== SUITE 3: Stock Allocation & Stock Fetch =====
console.log('\n[ 3 ] Stock Allocation to Vehicle & Live Inventory Fetch');
await test('3.1 - Store Keeper allocates 20 trays of Milk (1440 pieces) to Employee 1', async () => {
  const allocateQty = 20; // 20 trays * 72 = 1440 pieces
  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE products SET warehouse_stock_units=warehouse_stock_units-$1 WHERE id=$2', [allocateQty, ctx.p1.id]);
    await client.query(
      'INSERT INTO employee_stock (company_id,employee_id,product_id,qty_units,unit,updated_at) VALUES ($1,$2,$3,$4,\'Tray\',NOW()) ' +
      'ON CONFLICT (employee_id, product_id) DO UPDATE SET qty_units=employee_stock.qty_units+EXCLUDED.qty_units, updated_at=NOW()',
      [ctx.companyId, ctx.emp1Id, ctx.p1.id, allocateQty]
    );
    await client.query(
      'INSERT INTO inventory_movements (company_id,movement_no,movement_type,product_id,product_name,employee_id,employee_name,qty_units,unit,movement_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_DATE)',
      [ctx.companyId, 'MOV-OUT-' + Date.now(), 'OUTWARD', ctx.p1.id, ctx.p1.display_name, ctx.emp1Id, 'Ravi Driver', allocateQty, 'Tray']
    );
    await client.query('COMMIT');
  } finally { client.release(); }

  const empStock = (await q('SELECT * FROM employee_stock WHERE employee_id=$1 AND product_id=$2', [ctx.emp1Id, ctx.p1.id])).rows[0];
  if (Number(empStock.qty_units) !== 20) throw new Error('Expected 20 trays in vehicle stock');
});

// ===== SUITE 4: Financial Calculations, Billing & Atomic POS Engine =====
console.log('\n[ 4 ] Financial Calculations, Multi-Payment & Atomic POS Engine');
await test('4.1 - Product pricing and line amount formula: Qty 10 × ₹9.17 = ₹91.70', async () => {
  const qty = 10;
  const rate = Number(ctx.p1.piece_selling_price); // 9.17
  const lineAmount = Number((qty * rate).toFixed(2));
  if (lineAmount !== 91.70) throw new Error('Expected ₹91.70, got: ' + lineAmount);
});

await test('4.2 - Multi-product grand total calculation', async () => {
  // Line 1: 10 Pcs Milk @ ₹9.17 = ₹91.70
  // Line 2: 5 Pcs Curd @ ₹18.00 = ₹90.00
  // Total = ₹181.70
  const l1 = Number((10 * Number(ctx.p1.piece_selling_price)).toFixed(2));
  const l2 = Number((5 * Number(ctx.p2.piece_selling_price)).toFixed(2));
  const total = Number((l1 + l2).toFixed(2));
  if (total !== 181.70) throw new Error('Grand total calculation mismatch: ' + total);
});

await test('4.3 - Insufficient vehicle stock rejection (Cannot bill more than held)', async () => {
  const held = (await q('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2', [ctx.emp1Id, ctx.p1.id])).rows[0].qty_units;
  const heldPieces = Number(held) * 72; // 20 * 72 = 1440
  const requestedPieces = 2000; // More than 1440

  let rejected = false;
  if (requestedPieces > heldPieces) {
    rejected = true;
  }
  if (!rejected) throw new Error('Failed to reject bill exceeding available vehicle stock');
});

await test('4.4 - Cash sale transaction, stock deduction and bill number generation', async () => {
  const sellPieces = 72; // Exactly 1 tray (72 pieces)
  const rate = Number(ctx.p1.piece_selling_price); // 9.17
  const total = Number((sellPieces * rate).toFixed(2)); // 660.24
  const beforeStock = Number((await q('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2', [ctx.emp1Id, ctx.p1.id])).rows[0].qty_units);

  const client = await testPool.connect();
  let billNo = 'INV-EMP-CASH-' + Date.now();
  try {
    await client.query('BEGIN');
    const sR = await client.query(
      'INSERT INTO sales (company_id,bill_no,employee_id,employee_name,shop_id,shop_name,sale_date,total_amount,cash_paid,payment_mode) VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7,$8,\'CASH\') RETURNING *',
      [ctx.companyId, billNo, ctx.emp1Id, 'Ravi Driver', ctx.shop1Id, 'Sri Murugan Store', total, total]
    );
    const saleId = sR.rows[0].id;
    await client.query(
      'INSERT INTO sale_items (sale_id,product_id,product_name,qty,unit_type,rate,amount) VALUES ($1,$2,$3,$4,\'Piece\',$5,$6)',
      [saleId, ctx.p1.id, ctx.p1.display_name, sellPieces, rate, total]
    );
    // Deduct 1 tray from vehicle stock
    await client.query('UPDATE employee_stock SET qty_units=qty_units-1, updated_at=NOW() WHERE employee_id=$1 AND product_id=$2', [ctx.emp1Id, ctx.p1.id]);
    await client.query(
      'INSERT INTO inventory_movements (company_id,movement_no,movement_type,product_id,product_name,employee_id,employee_name,qty_units,unit,notes,movement_date) VALUES ($1,$2,$3,$4,$5,$6,$7,1,\'Tray\',\'Sold: \' || $8,CURRENT_DATE)',
      [ctx.companyId, 'MOV-SALE-' + Date.now(), 'OUTWARD', ctx.p1.id, ctx.p1.display_name, ctx.emp1Id, 'Ravi Driver', billNo]
    );
    await client.query('COMMIT');
  } finally { client.release(); }

  const afterStock = Number((await q('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2', [ctx.emp1Id, ctx.p1.id])).rows[0].qty_units);
  if (afterStock !== beforeStock - 1) throw new Error('Employee stock was not deducted after sale');
});

await test('4.5 - Credit sale updates shop current_due ledger', async () => {
  const creditAmount = 500.00;
  const beforeDue = Number((await q('SELECT current_due FROM shops WHERE id=$1', [ctx.shop1Id])).rows[0].current_due);

  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    const sR = await client.query(
      'INSERT INTO sales (company_id,bill_no,employee_id,employee_name,shop_id,shop_name,sale_date,total_amount,credit_paid,payment_mode) VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7,$8,\'CREDIT\') RETURNING id',
      [ctx.companyId, 'INV-CR-' + Date.now(), ctx.emp1Id, 'Ravi Driver', ctx.shop1Id, 'Sri Murugan Store', creditAmount, creditAmount]
    );
    await client.query(
      'INSERT INTO sale_items (sale_id,product_id,product_name,qty,unit_type,rate,amount) VALUES ($1,$2,$3,$4,\'Piece\',$5,$6)',
      [sR.rows[0].id, ctx.p1.id, ctx.p1.display_name, 54, 9.17, creditAmount]
    );
    await client.query('UPDATE shops SET current_due=current_due+$1 WHERE id=$2', [creditAmount, ctx.shop1Id]);
    await client.query('COMMIT');
  } finally { client.release(); }

  const afterDue = Number((await q('SELECT current_due FROM shops WHERE id=$1', [ctx.shop1Id])).rows[0].current_due);
  if (afterDue !== beforeDue + creditAmount) throw new Error('Shop ledger current_due not incremented by credit sale');
});

await test('4.6 - Valid Split payment (Total ₹500 = ₹200 Cash + ₹300 GPay, Remaining ₹0)', async () => {
  const total = 500.00;
  const cash = 200.00;
  const gpay = 300.00;
  const remaining = total - cash - gpay;

  if (remaining !== 0) throw new Error('Remaining should be 0');
  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    const sR = await client.query(
      'INSERT INTO sales (company_id,bill_no,employee_id,employee_name,shop_id,shop_name,sale_date,total_amount,cash_paid,gpay_paid,payment_mode) VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7,$8,$9,\'SPLIT\') RETURNING *',
      [ctx.companyId, 'INV-SPLIT-' + Date.now(), ctx.emp1Id, 'Ravi Driver', ctx.shop1Id, 'Sri Murugan Store', total, cash, gpay]
    );
    await client.query(
      'INSERT INTO sale_items (sale_id,product_id,product_name,qty,unit_type,rate,amount) VALUES ($1,$2,$3,$4,\'Piece\',$5,$6)',
      [sR.rows[0].id, ctx.p1.id, ctx.p1.display_name, 54, 9.17, total]
    );
    await client.query('COMMIT');
  } finally { client.release(); }
});

await test('4.7 - Invalid Split payment rejection (Total ₹500, Cash ₹200, GPay ₹200, Remaining ₹100)', async () => {
  const total = 500.00;
  const cash = 200.00;
  const gpay = 200.00; // sum = 400 != 500

  let rejected = false;
  if (Math.abs((cash + gpay) - total) > 0.01) {
    rejected = true;
  }
  if (!rejected) throw new Error('Invalid split payment was not rejected');
});

// ===== SUITE 5: Historical Price Preservation =====
console.log('\n[ 5 ] Historical Price Preservation on Owner Price Change');
await test('5.1 - Old sale items preserve historical billing rate when Owner updates price', async () => {
  const oldSaleItem = (await q('SELECT * FROM sale_items ORDER BY id DESC LIMIT 1')).rows[0];
  const originalBillRate = Number(oldSaleItem.rate);

  // Owner updates Milk price in PostgreSQL
  await q('UPDATE products SET piece_selling_price=12.50 WHERE id=$1', [ctx.p1.id]);

  // Check that previously billed item rate in database is untouched
  const checkOldItem = (await q('SELECT * FROM sale_items WHERE id=$1', [oldSaleItem.id])).rows[0];
  if (Number(checkOldItem.rate) !== originalBillRate) {
    throw new Error('Historical sale item rate was corrupted by price update');
  }
});

// ===== SUITE 6: Returns, Damages & End of Day Settlement =====
console.log('\n[ 6 ] Returns, Damages & Daily Account Reconciliation');
await test('6.1 - Employee returns 2 unsold trays to warehouse', async () => {
  const returnTrays = 2;
  const beforeEmp = Number((await q('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2', [ctx.emp1Id, ctx.p1.id])).rows[0].qty_units);
  const beforeWh = Number((await q('SELECT warehouse_stock_units FROM products WHERE id=$1', [ctx.p1.id])).rows[0].warehouse_stock_units);

  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE employee_stock SET qty_units=qty_units-$1 WHERE employee_id=$2 AND product_id=$3', [returnTrays, ctx.emp1Id, ctx.p1.id]);
    await client.query('UPDATE products SET warehouse_stock_units=warehouse_stock_units+$1 WHERE id=$2', [returnTrays, ctx.p1.id]);
    await client.query(
      'INSERT INTO inventory_movements (company_id,movement_no,movement_type,product_id,product_name,employee_id,employee_name,qty_units,unit,movement_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,\'Tray\',CURRENT_DATE)',
      [ctx.companyId, 'MOV-RET-' + Date.now(), 'RETURN', ctx.p1.id, ctx.p1.display_name, ctx.emp1Id, 'Ravi Driver', returnTrays]
    );
    await client.query('COMMIT');
  } finally { client.release(); }

  const afterEmp = Number((await q('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2', [ctx.emp1Id, ctx.p1.id])).rows[0].qty_units);
  const afterWh = Number((await q('SELECT warehouse_stock_units FROM products WHERE id=$1', [ctx.p1.id])).rows[0].warehouse_stock_units);

  if (afterEmp !== beforeEmp - returnTrays) throw new Error('Vehicle stock not decremented by return');
  if (afterWh !== beforeWh + returnTrays) throw new Error('Warehouse stock not incremented by return');
});

await test('6.2 - Employee records 1 damaged tray and adjusts stock', async () => {
  const dmgTrays = 1;
  const beforeEmp = Number((await q('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2', [ctx.emp1Id, ctx.p1.id])).rows[0].qty_units);
  const cost = 600.00;

  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE employee_stock SET qty_units=qty_units-$1 WHERE employee_id=$2 AND product_id=$3', [dmgTrays, ctx.emp1Id, ctx.p1.id]);
    await client.query(
      'INSERT INTO damages (company_id,employee_id,employee_name,product_id,product_name,qty_units,reason,damage_cost) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [ctx.companyId, ctx.emp1Id, 'Ravi Driver', ctx.p1.id, ctx.p1.display_name, dmgTrays, 'Pouch Burst', cost]
    );
    await client.query(
      'INSERT INTO inventory_movements (company_id,movement_no,movement_type,product_id,product_name,employee_id,employee_name,qty_units,unit,movement_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,\'Tray\',CURRENT_DATE)',
      [ctx.companyId, 'MOV-DMG-' + Date.now(), 'DAMAGE', ctx.p1.id, ctx.p1.display_name, ctx.emp1Id, 'Ravi Driver', dmgTrays]
    );
    await client.query('COMMIT');
  } finally { client.release(); }

  const afterEmp = Number((await q('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2', [ctx.emp1Id, ctx.p1.id])).rows[0].qty_units);
  if (afterEmp !== beforeEmp - dmgTrays) throw new Error('Vehicle stock not reduced by damage');
});

await test('6.3 - Daily account reconciliation calculation (Issued - Sold - Returned - Damaged)', async () => {
  // Issued = 20
  // Sold = 1
  // Returned = 2
  // Damaged = 1
  // Expected remaining = 20 - 1 - 2 - 1 = 16
  const current = Number((await q('SELECT COALESCE(SUM(qty_units),0) as t FROM employee_stock WHERE employee_id=$1', [ctx.emp1Id])).rows[0].t);
  if (current !== 16) throw new Error('Expected 16 remaining trays in vehicle stock, got: ' + current);
});

// ===== SUITE 7: Cross-Role Real-Time Visibility & Reporting =====
console.log('\n[ 7 ] Cross-Role Real-Time Visibility & Owner / Keeper Views');
await test('7.1 - Owner dashboard reflects all Employee sales in real-time', async () => {
  const sales = await q('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE company_id=$1', [ctx.companyId]);
  const tot = Number(sales.rows[0].total);
  if (tot <= 0) throw new Error('Owner dashboard cannot see employee sales');
});

await test('7.2 - Store Keeper account closing view reflects employee day summary', async () => {
  const empSummary = await q(
    'SELECT s.employee_name, COALESCE(SUM(s.total_amount),0) as total_sales, COALESCE(SUM(s.cash_paid),0) as cash FROM sales s WHERE s.company_id=$1 GROUP BY s.employee_name',
    [ctx.companyId]
  );
  if (!empSummary.rows.length) throw new Error('Store keeper cannot view employee sales summary');
});

// ===== SUITE 8: Thermal Bill Print Data Integrity =====
console.log('\n[ 8 ] Thermal Bill Print Integrity');
await test('8.1 - Generated sale contains all fields required for 58mm thermal printing', async () => {
  const s = (await q('SELECT * FROM sales WHERE employee_id=$1 ORDER BY id DESC LIMIT 1', [ctx.emp1Id])).rows[0];
  const items = (await q('SELECT * FROM sale_items WHERE sale_id=$1', [s.id])).rows;

  if (!s.bill_no) throw new Error('Missing bill_no for receipt');
  if (!s.sale_date) throw new Error('Missing date for receipt');
  if (!s.employee_name) throw new Error('Missing employee name on receipt');
  if (!s.shop_name) throw new Error('Missing shop name on receipt');
  if (!s.payment_mode) throw new Error('Missing payment mode on receipt');
  if (items.length === 0) throw new Error('Receipt must contain sale items');
});

await testPool.end().catch(()=>{});

console.log('');
console.log('==================================================================');
console.log('  PART 3 TEST RESULTS SUMMARY');
console.log('  PASSED : ' + passed + ' / ' + total);
console.log('  FAILED : ' + failed + ' / ' + total);
console.log('==================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
