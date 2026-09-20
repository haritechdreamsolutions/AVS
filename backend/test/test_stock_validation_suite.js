import http from 'http';
import { query } from '../db_pg.js';

function request(options, bodyData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const cookie = res.headers['set-cookie'] ? res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ') : '';
        try { resolve({ status: res.statusCode, body: JSON.parse(data), cookie }); }
        catch (e) { resolve({ status: res.statusCode, raw: data, cookie }); }
      });
    });
    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

async function runStockValidationSuite() {
  console.log('==================================================================');
  console.log('  AVS AGENCIES - VEHICLE STOCK BILLING VALIDATION TEST SUITE      ');
  console.log('==================================================================\n');

  // 1. Driver Login (Tharun / 2002)
  const login = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ login_id: 'tharun', pin: '2002' }));

  if (login.status !== 200 || !login.body?.success) {
    throw new Error('Driver login failed');
  }
  const cookie = login.cookie;
  const driverId = login.body.user.employee_id || 2;
  console.log(`✅ Logged in as Driver Tharun (Emp ID: ${driverId})`);

  // Active shops
  const shops = await query('SELECT * FROM shops WHERE company_id=1 AND is_active=TRUE ORDER BY id ASC;');
  const shop = shops.rows[0]; // Hari (SHP-001)

  // Products
  const prods = await query('SELECT * FROM products WHERE company_id=1 AND is_active=TRUE ORDER BY id ASC;');
  const pA = prods[0] || prods.rows[0]; // Product A
  const pB = prods[1] || prods.rows[1]; // Product B
  const pC = prods[2] || prods.rows[2]; // Product C

  // Reset stock for Driver Tharun:
  // pA: 0 Pcs
  // pB: 20 Pcs (stored in units: 20 / ppu)
  // pC: 50 Pcs (stored in units: 50 / ppu)
  const ppuA = Number(pA.pieces_per_unit || 1);
  const ppuB = Number(pB.pieces_per_unit || 1);
  const ppuC = Number(pC.pieces_per_unit || 1);

  await query('DELETE FROM employee_stock WHERE employee_id=$1;', [driverId]);
  
  // Insert stock
  await query(`
    INSERT INTO employee_stock (employee_id, product_id, company_id, qty_units, unit)
    VALUES 
      ($1, $2, 1, $3, 'Tray'),
      ($1, $4, 1, $5, 'Tray')
    ON CONFLICT (employee_id, product_id) DO UPDATE SET qty_units = EXCLUDED.qty_units;
  `, [driverId, pB.id, (20 / ppuB), pC.id, (50 / ppuC)]);

  console.log('\n--- Initial Stock Configuration ---');
  console.log(`Product A (${pA.display_name}): 0 Pcs (Out of Stock)`);
  console.log(`Product B (${pB.display_name}): 20 Pcs`);
  console.log(`Product C (${pC.display_name}): 50 Pcs`);

  // ==========================================
  // TEST 1: Stock = 0, Request Qty = 1 -> Must be REJECTED
  // ==========================================
  console.log('\n--- TEST 1: Stock = 0, Requested Qty = 1 ---');
  const res1 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/sales',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie }
  }, JSON.stringify({
    shop_id: shop.id,
    shop_name: shop.name,
    shop_code: shop.code,
    items: [
      { product_id: pA.id, product_name: pA.display_name, unit_type: 'Piece', qty: 1, rate: 10, amount: 10 }
    ],
    payment_mode: 'CASH',
    cash_paid: 10,
    total_amount: 10
  }));

  console.log(`Response Status: ${res1.status}, Message: ${res1.body?.message}`);
  if (res1.status === 200 && res1.body?.success) {
    throw new Error('TEST 1 FAILED: Stock 0 was allowed to be billed!');
  }
  console.log('✅ TEST 1 PASSED: Stock 0 correctly rejected with Insufficient Stock error');

  // ==========================================
  // TEST 2: Stock = 1, Request Qty = 1 -> Allowed
  // ==========================================
  console.log('\n--- TEST 2: Stock = 1, Requested Qty = 1 ---');
  await query(`
    INSERT INTO employee_stock (employee_id, product_id, company_id, qty_units, unit)
    VALUES ($1, $2, 1, $3, 'Tray')
    ON CONFLICT (employee_id, product_id) DO UPDATE SET qty_units = $3;
  `, [driverId, pA.id, (1 / ppuA)]);

  const res2 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/sales',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie }
  }, JSON.stringify({
    shop_id: shop.id,
    shop_name: shop.name,
    shop_code: shop.code,
    items: [
      { product_id: pA.id, product_name: pA.display_name, unit_type: 'Piece', qty: 1, rate: 10, amount: 10 }
    ],
    payment_mode: 'CASH',
    cash_paid: 10,
    total_amount: 10
  }));

  console.log(`Response Status: ${res2.status}, Success: ${res2.body?.success}`);
  if (res2.status !== 200 || !res2.body?.success) {
    throw new Error(`TEST 2 FAILED: ${JSON.stringify(res2.body)}`);
  }
  
  // Verify stock is now 0
  const st2 = await query('SELECT qty_units FROM employee_stock WHERE employee_id=$1 AND product_id=$2;', [driverId, pA.id]);
  console.log(`Stock after selling 1: ${Number(st2.rows[0].qty_units) * ppuA} Pcs`);
  if (Number(st2.rows[0].qty_units) > 0.0001) throw new Error('Stock should be 0');
  console.log('✅ TEST 2 PASSED: Quantity 1 allowed, stock correctly decreased to 0');

  // ==========================================
  // TEST 3 & 4: Stock = 10, Qty = 11 -> Rejected, Qty = 10 -> Allowed
  // ==========================================
  console.log('\n--- TEST 3 & 4: Stock = 10, Test Qty = 11 (Reject) & Qty = 10 (Allow) ---');
  await query(`
    INSERT INTO employee_stock (employee_id, product_id, company_id, qty_units, unit)
    VALUES ($1, $2, 1, $3, 'Tray')
    ON CONFLICT (employee_id, product_id) DO UPDATE SET qty_units = $3;
  `, [driverId, pA.id, (10 / ppuA)]);

  // Attempt 11
  const res4 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/sales',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie }
  }, JSON.stringify({
    shop_id: shop.id,
    shop_name: shop.name,
    shop_code: shop.code,
    items: [
      { product_id: pA.id, product_name: pA.display_name, unit_type: 'Piece', qty: 11, rate: 10, amount: 110 }
    ],
    payment_mode: 'CASH',
    cash_paid: 110,
    total_amount: 110
  }));
  console.log(`Attempt 11 Pcs -> Status: ${res4.status}, Message: ${res4.body?.message}`);
  if (res4.status === 200 && res4.body?.success) {
    throw new Error('TEST 4 FAILED: Qty 11 was allowed when stock was 10!');
  }
  console.log('✅ TEST 4 PASSED: Attempting 11 when stock is 10 is rejected');

  // Attempt 10
  const res3 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/sales',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie }
  }, JSON.stringify({
    shop_id: shop.id,
    shop_name: shop.name,
    shop_code: shop.code,
    items: [
      { product_id: pA.id, product_name: pA.display_name, unit_type: 'Piece', qty: 10, rate: 10, amount: 100 }
    ],
    payment_mode: 'CASH',
    cash_paid: 100,
    total_amount: 100
  }));
  console.log(`Attempt 10 Pcs -> Status: ${res3.status}, Success: ${res3.body?.success}`);
  if (res3.status !== 200 || !res3.body?.success) {
    throw new Error('TEST 3 FAILED: Qty 10 should be allowed when stock is 10');
  }
  console.log('✅ TEST 3 PASSED: Qty 10 allowed and deducted');

  // ==========================================
  // TEST 7: Multi-product bill with in-stock products
  // Product B (stock=20): qty=5
  // Product C (stock=50): qty=10
  // Product A (stock=0): qty=0 (not included)
  // ==========================================
  console.log('\n--- TEST 7: Multi-product bill with valid quantities ---');
  const rateB = Number(pB.piece_selling_price || 12.00);
  const rateC = Number(pC.piece_selling_price || 15.00);
  const total7 = Number((5 * rateB + 10 * rateC).toFixed(2));

  const res7 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/sales',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie }
  }, JSON.stringify({
    shop_id: shop.id,
    shop_name: shop.name,
    shop_code: shop.code,
    items: [
      { product_id: pB.id, product_name: pB.display_name, unit_type: 'Piece', qty: 5, rate: rateB, amount: (5 * rateB) },
      { product_id: pC.id, product_name: pC.display_name, unit_type: 'Piece', qty: 10, rate: rateC, amount: (10 * rateC) }
    ],
    payment_mode: 'SPLIT',
    cash_paid: 50.00,
    gpay_paid: Number((total7 - 50.00).toFixed(2)),
    total_amount: total7
  }));

  console.log(`Multi-Product Bill Status: ${res7.status}, Bill No: ${res7.body?.sale?.bill_no}`);
  if (res7.status !== 200 || !res7.body?.success) {
    throw new Error('TEST 7 FAILED: Valid multi-product bill failed');
  }

  // Fetch bill
  const billDetails = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/sales/${res7.body.sale.id}`,
    method: 'GET',
    headers: { 'Cookie': cookie }
  });

  console.log(`Saved Bill Items Count: ${billDetails.body?.items?.length}`);
  if (billDetails.body?.items?.length !== 2) {
    throw new Error('Bill should contain EXACTLY 2 items (B and C)');
  }
  console.log('✅ TEST 7 PASSED: Multi-product bill successfully created and contains only selected in-stock items');

  console.log('\n==================================================================');
  console.log('🎉 ALL STOCK VALIDATION TESTS PASSED WITH 100% SUCCESS!          ');
  console.log('==================================================================');
  process.exit(0);
}

runStockValidationSuite().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
