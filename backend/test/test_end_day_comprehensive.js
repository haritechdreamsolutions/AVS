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

async function runEndDayComprehensiveSuite() {
  console.log('==================================================================');
  console.log('  AVS AGENCIES - DRIVER END OF DAY SCREEN INTEGRITY SUITE         ');
  console.log('==================================================================\n');

  const today = new Date().toISOString().split('T')[0];

  // 1. Login Driver Tharun (Emp ID: 2) and Driver Guna (Emp ID: 21)
  const loginTharun = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ login_id: 'tharun', pin: '2002' }));

  const loginGuna = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ login_id: 'emp006', pin: '9999' }));

  const cookieTharun = loginTharun.cookie;
  const cookieGuna = loginGuna.cookie;
  const empTharunId = loginTharun.body.user.employee_id || 2;
  const empGunaId = loginGuna.body.user.employee_id || 21;

  console.log(`✅ Logged in Driver Tharun (Emp ID: ${empTharunId}) & Driver Guna (Emp ID: ${empGunaId})`);

  // Clean today's test records for Tharun and Guna to start from clean state
  await query('DELETE FROM sales WHERE company_id=1 AND (sale_date = $1::date OR created_at::date = $1::date);', [today]);
  await query('DELETE FROM expenses WHERE company_id=1 AND created_at::date = $1::date;', [today]);
  await query('DELETE FROM settlements WHERE company_id=1 AND settlement_date = $1::date;', [today]);

  const shops = await query('SELECT * FROM shops WHERE company_id=1 AND is_active=TRUE ORDER BY id ASC;');
  const shop = shops.rows[0];
  const prods = await query('SELECT * FROM products WHERE company_id=1 AND is_active=TRUE ORDER BY id ASC;');
  const p1 = prods.rows[0];
  const p2 = prods.rows[1] || p1;

  // Set stock for Tharun
  const ppu1 = Number(p1.pieces_per_unit || 1);
  const ppu2 = Number(p2.pieces_per_unit || 1);
  await query(`
    INSERT INTO employee_stock (employee_id, product_id, company_id, qty_units, unit)
    VALUES ($1, $2, 1, 100, 'Tray'), ($1, $3, 1, 100, 'Tray')
    ON CONFLICT (employee_id, product_id) DO UPDATE SET qty_units = 100;
  `, [empTharunId, p1.id, p2.id]);

  // ==========================================
  // TEST 1: NO TRANSACTIONS
  // ==========================================
  console.log('\n--- TEST 1: No Transactions Today ---');
  const res1 = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/emp/day-summary?employee_id=${empTharunId}&date=${today}`,
    method: 'GET',
    headers: { 'Cookie': cookieTharun }
  });

  console.log('Summary 1:', res1.body);
  if (res1.body.total_sales !== 0 || res1.body.total_bills !== 0 || res1.body.net_sales !== 0) {
    throw new Error('TEST 1 FAILED: Expected 0 sales and 0 bills');
  }
  console.log('✅ TEST 1 PASSED: Empty day returns ₹0.00 for all totals');

  // ==========================================
  // TEST 2: CASH BILL
  // ==========================================
  console.log('\n--- TEST 2: Create ₹500 Cash Bill ---');
  const bill1 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/sales',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieTharun }
  }, JSON.stringify({
    shop_id: shop.id,
    shop_name: shop.name,
    shop_code: shop.code,
    items: [{ product_id: p1.id, product_name: p1.display_name, unit_type: 'Piece', qty: 10, rate: 50, amount: 500 }],
    payment_mode: 'CASH',
    cash_paid: 500,
    total_amount: 500
  }));
  if (bill1.status !== 200 || !bill1.body?.success) throw new Error('Bill 1 failed');

  const res2 = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/emp/day-summary?employee_id=${empTharunId}&date=${today}`,
    method: 'GET',
    headers: { 'Cookie': cookieTharun }
  });
  console.log('Summary 2:', res2.body);
  if (res2.body.total_sales !== 500 || res2.body.total_bills !== 1 || res2.body.cash_collected !== 500) {
    throw new Error('TEST 2 FAILED');
  }
  console.log('✅ TEST 2 PASSED: Cash bill correctly recorded');

  // ==========================================
  // TEST 3: GPAY BILL
  // ==========================================
  console.log('\n--- TEST 3: Create ₹750 GPay Bill ---');
  const bill2 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/sales',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieTharun }
  }, JSON.stringify({
    shop_id: shop.id,
    shop_name: shop.name,
    shop_code: shop.code,
    items: [{ product_id: p2.id, product_name: p2.display_name, unit_type: 'Piece', qty: 15, rate: 50, amount: 750 }],
    payment_mode: 'GPAY',
    gpay_paid: 750,
    total_amount: 750
  }));
  if (bill2.status !== 200 || !bill2.body?.success) throw new Error('Bill 2 failed');

  const res3 = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/emp/day-summary?employee_id=${empTharunId}&date=${today}`,
    method: 'GET',
    headers: { 'Cookie': cookieTharun }
  });
  console.log('Summary 3:', res3.body);
  if (res3.body.total_sales !== 1250 || res3.body.total_bills !== 2 || res3.body.gpay_collected !== 750) {
    throw new Error('TEST 3 FAILED');
  }
  console.log('✅ TEST 3 PASSED: GPay bill correctly recorded');

  // ==========================================
  // TEST 4: SPLIT BILL (Cash 300, GPay 700)
  // ==========================================
  console.log('\n--- TEST 4: Create ₹1000 Split Bill (Cash 300, GPay 700) ---');
  const bill3 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/sales',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieTharun }
  }, JSON.stringify({
    shop_id: shop.id,
    shop_name: shop.name,
    shop_code: shop.code,
    items: [{ product_id: p1.id, product_name: p1.display_name, unit_type: 'Piece', qty: 20, rate: 50, amount: 1000 }],
    payment_mode: 'SPLIT',
    cash_paid: 300,
    gpay_paid: 700,
    total_amount: 1000
  }));
  if (bill3.status !== 200 || !bill3.body?.success) throw new Error('Bill 3 failed');

  const res4 = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/emp/day-summary?employee_id=${empTharunId}&date=${today}`,
    method: 'GET',
    headers: { 'Cookie': cookieTharun }
  });
  console.log('Summary 4:', res4.body);
  if (res4.body.total_sales !== 2250 || res4.body.total_bills !== 3 || res4.body.cash_collected !== 800 || res4.body.gpay_collected !== 1450) {
    throw new Error('TEST 4 FAILED');
  }
  console.log('✅ TEST 4 PASSED: Split bill reconciled (Cash: 800, GPay: 1450, Total: 2250)');

  // ==========================================
  // TEST 5: EXPENSE ENTRY & NET SALES
  // ==========================================
  console.log('\n--- TEST 5: Add Diesel ₹100 & Food ₹50 Expenses ---');
  const exp1 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/expenses',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieTharun }
  }, JSON.stringify({ employee_id: empTharunId, category: 'Diesel', amount: 100 }));
  if (exp1.status !== 200 || !exp1.body?.success) throw new Error('Expense 1 failed');

  const exp2 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/expenses',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieTharun }
  }, JSON.stringify({ employee_id: empTharunId, category: 'Food', amount: 50 }));
  if (exp2.status !== 200 || !exp2.body?.success) throw new Error('Expense 2 failed');

  const res5 = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/emp/day-summary?employee_id=${empTharunId}&date=${today}`,
    method: 'GET',
    headers: { 'Cookie': cookieTharun }
  });
  console.log('Summary 5:', res5.body);
  if (res5.body.total_expenses !== 150 || res5.body.net_sales !== 2100) {
    throw new Error(`TEST 5 FAILED: Expected expenses 150 and net sales 2100, got ${res5.body.total_expenses}, ${res5.body.net_sales}`);
  }
  console.log('✅ TEST 5 PASSED: Expenses correctly deducted: Net Sales = Total Sales (2250) - Expenses (150) = ₹2,100');

  // ==========================================
  // TEST 7: DRIVER ISOLATION (Guna does not see Tharun)
  // ==========================================
  console.log('\n--- TEST 7: Driver Isolation ---');
  const resGuna = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/emp/day-summary?employee_id=${empGunaId}&date=${today}`,
    method: 'GET',
    headers: { 'Cookie': cookieGuna }
  });
  console.log('Guna Summary:', resGuna.body);
  if (resGuna.body.total_sales !== 0 || resGuna.body.total_bills !== 0 || resGuna.body.total_expenses !== 0) {
    throw new Error('TEST 7 FAILED: Guna should not see Tharun transactions');
  }
  console.log('✅ TEST 7 PASSED: Driver Guna has 0 sales/expenses while Tharun has ₹2,250');

  // ==========================================
  // TEST 9: END DAY IDEMPOTENCY & SETTLEMENT
  // ==========================================
  console.log('\n--- TEST 9: End Day Idempotency & Settlement ---');
  const set1 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/settlements',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieTharun }
  }, JSON.stringify({
    employee_id: empTharunId,
    employee_name: 'Tharun',
    settlement_date: today,
    expected_amount: res5.body.total_sales,
    collected_amount: res5.body.cash_collected + res5.body.gpay_collected
  }));
  console.log('First Settlement Status:', set1.status, set1.body);
  if (set1.status !== 200 || !set1.body?.success) throw new Error('Settlement 1 failed');

  // Second attempt (duplicate click)
  const set2 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/settlements',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieTharun }
  }, JSON.stringify({
    employee_id: empTharunId,
    employee_name: 'Tharun',
    settlement_date: today,
    expected_amount: res5.body.total_sales,
    collected_amount: res5.body.cash_collected + res5.body.gpay_collected
  }));
  console.log('Second Settlement Status:', set2.status, set2.body);
  if (set2.status !== 200 || !set2.body?.success || set2.body?.message !== 'Day already closed') {
    throw new Error('TEST 9 FAILED: Duplicate settlement should return existing record');
  }

  const resClosed = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/emp/day-summary?employee_id=${empTharunId}&date=${today}`,
    method: 'GET',
    headers: { 'Cookie': cookieTharun }
  });
  console.log('Closed Day Summary:', resClosed.body);
  if (!resClosed.body.is_closed) throw new Error('Day should be marked is_closed: true');
  console.log('✅ TEST 9 PASSED: Day successfully closed with idempotency');

  console.log('\n==================================================================');
  console.log('🎉 ALL END OF DAY TESTS PASSED WITH 100% SUCCESS!                ');
  console.log('==================================================================');
  process.exit(0);
}

runEndDayComprehensiveSuite().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
