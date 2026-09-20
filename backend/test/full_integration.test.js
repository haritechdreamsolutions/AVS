// ============================================================
// AVS AGENCIES - FULL END-TO-END MULTI-ROLE INTEGRATION TEST
// Complete Lifecycle: Owner -> Store Keeper -> Employee -> Owner
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
console.log('  AVS AGENCIES - FULL INTEGRATION TEST SUITE');
console.log('  Testing Full Multi-Role Workflow in PostgreSQL');
console.log('==================================================================');
console.log('');

let ctx = {};

// STEP 1: OWNER SETUP
console.log('\n[ STEP 1 ] Owner: Products, Pricing, Staff, Routes & Shops');
await test('1.1 - Initialize company & roles', async () => {
  await cleanDB();
  const cR = await q('INSERT INTO companies (name,subtitle,is_active) VALUES ($1,$2,TRUE) RETURNING id', ['AVS FULL FLOW CO', 'End to End']);
  ctx.companyId = cR.rows[0].id;
  const roles = await q('SELECT id, role_name FROM roles');
  ctx.roles = {};
  roles.rows.forEach(r => { ctx.roles[r.role_name] = r.id; });
});

await test('1.2 - Owner creates product catalog with buy & sale prices', async () => {
  const cat = await q('INSERT INTO categories (company_id,code,name) VALUES ($1,$2,$3) RETURNING id', [ctx.companyId, 'DAIRY', 'Dairy Products']);
  ctx.catId = cat.rows[0].id;

  // Milk 200ml: 72 pcs/tray, Buy: ₹600, Sale: ₹660/Tray (₹9.17/pc)
  const p1 = await q(
    'INSERT INTO products (company_id,category_id,name,display_name,selling_unit,base_unit,pieces_per_unit,purchase_price,unit_selling_price,piece_selling_price,warehouse_stock_units) ' +
    'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0) RETURNING *',
    [ctx.companyId, ctx.catId, 'Milk 200ml', 'Amirthaa Milk 200ml', 'Tray', 'Piece', 72, 600.00, 660.00, 9.17]
  );
  ctx.p1 = p1.rows[0];

  // Curd 500ml: 30 pcs/tray, Buy: ₹450, Sale: ₹540/Tray (₹18.00/pc)
  const p2 = await q(
    'INSERT INTO products (company_id,category_id,name,display_name,selling_unit,base_unit,pieces_per_unit,purchase_price,unit_selling_price,piece_selling_price,warehouse_stock_units) ' +
    'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0) RETURNING *',
    [ctx.companyId, ctx.catId, 'Curd 500ml', 'Amirthaa Curd 500ml', 'Tray', 'Piece', 30, 450.00, 540.00, 18.00]
  );
  ctx.p2 = p2.rows[0];
});

await test('1.3 - Owner creates Store Keeper and Delivery Employee accounts', async () => {
  const skHash = await bcrypt.hash('1234', 10);
  const sk = await q(
    'INSERT INTO user_accounts (company_id,role_id,login_id,name,pin_hash,account_status) VALUES ($1,$2,$3,$4,$5,\'ACTIVE\') RETURNING id',
    [ctx.companyId, ctx.roles['STORE_KEEPER'], 'keeper1', 'Mani Store Keeper', skHash]
  );
  ctx.skId = sk.rows[0].id;

  const emp = await q(
    'INSERT INTO employees (company_id,employee_code,full_name,phone,vehicle_number) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [ctx.companyId, 'EMP-555', 'Ravi Driver', '9876543210', 'TN 32 AB 9999']
  );
  ctx.empId = emp.rows[0].id;

  const empHash = await bcrypt.hash('1111', 10);
  await q(
    'INSERT INTO user_accounts (company_id,role_id,employee_id,login_id,name,pin_hash,account_status) VALUES ($1,$2,$3,$4,$5,$6,\'ACTIVE\')',
    [ctx.companyId, ctx.roles['EMPLOYEE'], ctx.empId, 'driver1', 'Ravi Driver', empHash]
  );
});

await test('1.4 - Owner creates Route & Shop and assigns route to Employee', async () => {
  const rt = await q('INSERT INTO routes (company_id,code,name) VALUES ($1,$2,$3) RETURNING id', [ctx.companyId, 'RT-SALEM', 'Salem City Route']);
  ctx.routeId = rt.rows[0].id;

  const sh = await q(
    'INSERT INTO shops (company_id,route_id,code,name,owner_name,phone,credit_limit,current_due) VALUES ($1,$2,$3,$4,$5,$6,$7,0) RETURNING id',
    [ctx.companyId, ctx.routeId, 'SHP-888', 'Ganesh Store', 'Ganesh', '9000012345', 10000.00]
  );
  ctx.shopId = sh.rows[0].id;

  const today = new Date().toISOString().split('T')[0];
  await q(
    'INSERT INTO route_assignments (route_id,employee_id,vehicle_number,assigned_date,status) VALUES ($1,$2,$3,$4,\'ASSIGNED\')',
    [ctx.routeId, ctx.empId, 'TN 32 AB 9999', today]
  );
});

// STEP 2: STORE KEEPER OPERATIONS
console.log('\n[ STEP 2 ] Store Keeper: Inward Stock Receive & Vehicle Allocation');
await test('2.1 - Store Keeper receives 100 trays of Milk into warehouse', async () => {
  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE products SET warehouse_stock_units=warehouse_stock_units+100 WHERE id=$1', [ctx.p1.id]);
    await client.query(
      'INSERT INTO inventory_movements (company_id,movement_no,movement_type,product_id,product_name,qty_units,unit,reference,received_by,movement_date) VALUES ($1,$2,\'INWARD\',$3,$4,100,\'Tray\',\'DC-1090\',\'Mani Keeper\',CURRENT_DATE)',
      [ctx.companyId, 'MOV-IN-' + Date.now(), ctx.p1.id, ctx.p1.display_name]
    );
    await client.query('COMMIT');
  } finally { client.release(); }

  const stock = (await q('SELECT warehouse_stock_units FROM products WHERE id=$1', [ctx.p1.id])).rows[0].warehouse_stock_units;
  if (Number(stock) !== 100) throw new Error('Warehouse stock mismatch: ' + stock);
});

await test('2.2 - Store Keeper issues 25 trays of Milk to Employee vehicle', async () => {
  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE products SET warehouse_stock_units=warehouse_stock_units-25 WHERE id=$1', [ctx.p1.id]);
    await client.query(
      'INSERT INTO employee_stock (company_id,employee_id,product_id,qty_units,unit,updated_at) VALUES ($1,$2,$3,25,\'Tray\',NOW())',
      [ctx.companyId, ctx.empId, ctx.p1.id]
    );
    await client.query(
      'INSERT INTO inventory_movements (company_id,movement_no,movement_type,product_id,product_name,employee_id,employee_name,qty_units,unit,movement_date) VALUES ($1,$2,\'OUTWARD\',$3,$4,$5,\'Ravi Driver\',25,\'Tray\',CURRENT_DATE)',
      [ctx.companyId, 'MOV-OUT-' + Date.now(), ctx.p1.id, ctx.p1.display_name, ctx.empId]
    );
    await client.query('COMMIT');
  } finally { client.release(); }

  const whStock = Number((await q('SELECT warehouse_stock_units FROM products WHERE id=$1', [ctx.p1.id])).rows[0].warehouse_stock_units);
  const empStock = Number((await q('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2', [ctx.empId, ctx.p1.id])).rows[0].qty_units);

  if (whStock !== 75) throw new Error('Warehouse should have 75 trays');
  if (empStock !== 25) throw new Error('Employee should hold 25 trays');
});

// STEP 3: EMPLOYEE FIELD BILLING
console.log('\n[ STEP 3 ] Employee: Shop Selection, Billing POS & Split Payment');
await test('3.1 - Employee bills 144 pieces (2 trays) Milk @ ₹9.17 = ₹1320.48 with SPLIT payment', async () => {
  const sellPieces = 144;
  const rate = 9.17;
  const total = Number((sellPieces * rate).toFixed(2)); // 1320.48
  const cash = 500.00;
  const gpay = 500.00;
  const credit = 320.48;

  const client = await testPool.connect();
  let billNo = 'INV-FULL-01';
  try {
    await client.query('BEGIN');
    const sR = await client.query(
      'INSERT INTO sales (company_id,bill_no,employee_id,employee_name,shop_id,shop_name,sale_date,total_amount,cash_paid,gpay_paid,credit_paid,payment_mode) ' +
      'VALUES ($1,$2,$3,\'Ravi Driver\',$4,\'Ganesh Store\',CURRENT_DATE,$5,$6,$7,$8,\'SPLIT\') RETURNING id',
      [ctx.companyId, billNo, ctx.empId, ctx.shopId, total, cash, gpay, credit]
    );
    const saleId = sR.rows[0].id;
    await client.query(
      'INSERT INTO sale_items (sale_id,product_id,product_name,qty,unit_type,rate,amount) VALUES ($1,$2,$3,$4,\'Piece\',$5,$6)',
      [saleId, ctx.p1.id, ctx.p1.display_name, sellPieces, rate, total]
    );
    // Deduct 2 trays from employee stock
    await client.query('UPDATE employee_stock SET qty_units=qty_units-2 WHERE employee_id=$1 AND product_id=$2', [ctx.empId, ctx.p1.id]);
    // Add credit to shop ledger
    await client.query('UPDATE shops SET current_due=current_due+$1 WHERE id=$2', [credit, ctx.shopId]);
    await client.query('COMMIT');
  } finally { client.release(); }

  const postEmpStock = Number((await q('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2', [ctx.empId, ctx.p1.id])).rows[0].qty_units);
  const shopDue = Number((await q('SELECT current_due FROM shops WHERE id=$1', [ctx.shopId])).rows[0].current_due);

  if (postEmpStock !== 23) throw new Error('Expected 23 trays remaining in vehicle, got: ' + postEmpStock);
  if (shopDue !== credit) throw new Error('Shop ledger due mismatch: ' + shopDue);
});

// STEP 4: RETURNS & DAMAGES
console.log('\n[ STEP 4 ] Employee: Unsold Returns & Transit Damage Entry');
await test('4.1 - Employee returns 3 unsold trays to warehouse and records 1 damaged tray', async () => {
  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    // Return 3 trays
    await client.query('UPDATE employee_stock SET qty_units=qty_units-3 WHERE employee_id=$1 AND product_id=$2', [ctx.empId, ctx.p1.id]);
    await client.query('UPDATE products SET warehouse_stock_units=warehouse_stock_units+3 WHERE id=$1', [ctx.p1.id]);
    // Damage 1 tray
    await client.query('UPDATE employee_stock SET qty_units=qty_units-1 WHERE employee_id=$1 AND product_id=$2', [ctx.empId, ctx.p1.id]);
    await client.query(
      'INSERT INTO damages (company_id,employee_id,employee_name,product_id,product_name,qty_units,reason,damage_cost) VALUES ($1,$2,\'Ravi Driver\',$3,$4,1,\'Transit Leakage\',600.00)',
      [ctx.companyId, ctx.empId, ctx.p1.id, ctx.p1.display_name]
    );
    await client.query('COMMIT');
  } finally { client.release(); }

  const finalEmpStock = Number((await q('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2', [ctx.empId, ctx.p1.id])).rows[0].qty_units);
  const finalWhStock = Number((await q('SELECT warehouse_stock_units FROM products WHERE id=$1', [ctx.p1.id])).rows[0].warehouse_stock_units);

  // 25 taken - 2 sold - 3 returned - 1 damaged = 19
  if (finalEmpStock !== 19) throw new Error('Expected 19 trays in vehicle, got: ' + finalEmpStock);
  // 75 remaining in warehouse + 3 returned = 78
  if (finalWhStock !== 78) throw new Error('Expected 78 trays in warehouse, got: ' + finalWhStock);
});

// STEP 5: STORE KEEPER CLOSING & OWNER REPORTING
console.log('\n[ STEP 5 ] Store Keeper Account Closing & Owner Financial Dashboard');
await test('5.1 - Store Keeper & Owner verify balanced daily reconciliation', async () => {
  const sales = await q('SELECT COALESCE(SUM(total_amount),0) as tot, COALESCE(SUM(cash_paid),0) as cash, COALESCE(SUM(gpay_paid),0) as gpay, COALESCE(SUM(credit_paid),0) as cr FROM sales WHERE company_id=$1', [ctx.companyId]);
  const s = sales.rows[0];

  if (Number(s.tot) !== 1320.48) throw new Error('Total sales mismatch: ' + s.tot);
  if (Number(s.cash) !== 500.00) throw new Error('Cash mismatch: ' + s.cash);
  if (Number(s.gpay) !== 500.00) throw new Error('GPay mismatch: ' + s.gpay);
  if (Number(s.cr) !== 320.48) throw new Error('Credit mismatch: ' + s.cr);

  const damages = await q('SELECT COALESCE(SUM(damage_cost),0) as cost FROM damages WHERE company_id=$1', [ctx.companyId]);
  if (Number(damages.rows[0].cost) !== 600.00) throw new Error('Damage cost mismatch: ' + damages.rows[0].cost);
});

await testPool.end().catch(()=>{});

console.log('');
console.log('==================================================================');
console.log('  FULL INTEGRATION TEST RESULTS');
console.log('  PASSED : ' + passed + ' / ' + total);
console.log('  FAILED : ' + failed + ' / ' + total);
console.log('==================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
