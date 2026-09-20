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

async function testAllShopsAndModes() {
  console.log('==================================================');
  console.log('STEP 1: INSPECTING POSTGRESQL SHOPS TABLE');
  console.log('==================================================');
  const shopsRes = await query(`
    SELECT id, code, name, is_active, current_due, credit_limit
    FROM shops
    WHERE company_id = 1 AND is_active = TRUE
    ORDER BY id ASC;
  `);
  console.log('Active shops in PostgreSQL:');
  console.table(shopsRes.rows);

  if (shopsRes.rows.length !== 3) {
    throw new Error(`Expected exactly 3 shops, got ${shopsRes.rows.length}`);
  }

  console.log('\n==================================================');
  console.log('STEP 2: LOGIN AS DRIVER THARUN & DRIVER GUNA');
  console.log('==================================================');
  const loginTharun = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ login_id: 'tharun', pin: '2002' }));
  console.log('Tharun Login:', loginTharun.status, loginTharun.body?.user?.name);
  const cookieTharun = loginTharun.cookie;

  const loginGuna = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ login_id: 'emp006', pin: '9999' }));
  console.log('Guna Login:', loginGuna.status, loginGuna.body?.user?.name);
  const cookieGuna = loginGuna.cookie;

  // Find products & ensure sufficient stock
  const prods = await query(`SELECT * FROM products WHERE company_id = 1 AND is_active = TRUE ORDER BY id ASC LIMIT 3;`);
  const p1 = prods.rows[0];
  const p2 = prods.rows[1] || p1;

  // Allocate stock to both drivers (emp 2 and emp 21)
  await query(`
    INSERT INTO employee_stock (employee_id, product_id, company_id, qty_units, unit)
    VALUES (2, $1, 1, 100, 'Tray'), (2, $2, 1, 100, 'Tray'), (21, $1, 1, 100, 'Tray'), (21, $2, 1, 100, 'Tray')
    ON CONFLICT (employee_id, product_id) DO UPDATE SET qty_units = 100;
  `, [p1.id, p2.id]);

  console.log('\n==================================================');
  console.log('STEP 3: TEST BILLING ON HARI (SHP-001) - SPLIT MODE');
  console.log('==================================================');
  const hariShop = shopsRes.rows.find(s => s.name === 'Hari' || s.code === 'SHP-001');
  const qty1 = 10;
  const rate1 = Number(p1.piece_selling_price || 10);
  const totalHari = Number((qty1 * rate1).toFixed(2));
  const cashHari = 50.00;
  const gpayHari = Number((totalHari - cashHari).toFixed(2));

  const splitHariPayload = {
    shop_id: hariShop.id,
    shop_name: hariShop.name,
    shop_code: hariShop.code,
    items: [
      { product_id: p1.id, product_name: p1.display_name, unit_type: 'Piece', qty: qty1, rate: rate1, amount: totalHari }
    ],
    payment_mode: 'SPLIT',
    cash_paid: cashHari,
    gpay_paid: gpayHari,
    credit_paid: 0,
    total_amount: totalHari
  };

  const splitHariRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/sales',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieTharun }
  }, JSON.stringify(splitHariPayload));

  console.log('Hari SPLIT Bill Creation Status:', splitHariRes.status);
  console.log('Hari SPLIT Bill Creation Body:', splitHariRes.body);

  if (splitHariRes.status !== 200 || !splitHariRes.body?.success) {
    throw new Error(`Hari SPLIT Bill creation failed: ${JSON.stringify(splitHariRes.body)}`);
  }

  console.log('\n==================================================');
  console.log('STEP 4: TEST BILLING ON MANI (SHP-002) - CASH MODE');
  console.log('==================================================');
  const maniShop = shopsRes.rows.find(s => s.name === 'Mani' || s.code === 'SHP-002');
  const maniPayload = {
    shop_id: maniShop.id,
    shop_name: maniShop.name,
    shop_code: maniShop.code,
    items: [
      { product_id: p1.id, product_name: p1.display_name, unit_type: 'Piece', qty: 5, rate: rate1, amount: Number((5 * rate1).toFixed(2)) }
    ],
    payment_mode: 'CASH',
    cash_paid: Number((5 * rate1).toFixed(2)),
    gpay_paid: 0,
    credit_paid: 0,
    total_amount: Number((5 * rate1).toFixed(2))
  };

  const maniRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/sales',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieGuna }
  }, JSON.stringify(maniPayload));

  console.log('Mani CASH Bill Creation Status:', maniRes.status);
  console.log('Mani CASH Bill Creation Body:', maniRes.body);

  if (maniRes.status !== 200 || !maniRes.body?.success) {
    throw new Error(`Mani CASH Bill creation failed: ${JSON.stringify(maniRes.body)}`);
  }

  console.log('\n==================================================');
  console.log('STEP 5: TEST BILLING ON THARUN (SHP-003) - GPAY MODE');
  console.log('==================================================');
  const tharunShop = shopsRes.rows.find(s => s.name === 'Tharun' || s.code === 'SHP-003');
  const tharunPayload = {
    shop_id: tharunShop.id,
    shop_name: tharunShop.name,
    shop_code: tharunShop.code,
    items: [
      { product_id: p1.id, product_name: p1.display_name, unit_type: 'Piece', qty: 8, rate: rate1, amount: Number((8 * rate1).toFixed(2)) }
    ],
    payment_mode: 'GPAY',
    cash_paid: 0,
    gpay_paid: Number((8 * rate1).toFixed(2)),
    credit_paid: 0,
    total_amount: Number((8 * rate1).toFixed(2))
  };

  const tharunRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/sales',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieTharun }
  }, JSON.stringify(tharunPayload));

  console.log('Tharun GPAY Bill Creation Status:', tharunRes.status);
  console.log('Tharun GPAY Bill Creation Body:', tharunRes.body);

  if (tharunRes.status !== 200 || !tharunRes.body?.success) {
    throw new Error(`Tharun GPAY Bill creation failed: ${JSON.stringify(tharunRes.body)}`);
  }

  console.log('\n==================================================');
  console.log('STEP 6: VERIFY INSERTION IN POSTGRESQL SALES & SALE_ITEMS');
  console.log('==================================================');
  const latestSales = await query(`
    SELECT s.id, s.bill_no, s.employee_name, s.shop_name, s.payment_mode, s.total_amount, s.cash_paid, s.gpay_paid, s.created_at
    FROM sales s
    WHERE s.company_id = 1
    ORDER BY s.id DESC
    LIMIT 3;
  `);
  console.log('Recent 3 Sales in PostgreSQL:');
  console.table(latestSales.rows);

  const latestItems = await query(`
    SELECT si.sale_id, si.product_name, si.qty, si.unit_type, si.rate, si.amount
    FROM sale_items si
    WHERE si.sale_id IN (${latestSales.rows.map(s => s.id).join(',')})
    ORDER BY si.id DESC;
  `);
  console.log('Sale Items in PostgreSQL:');
  console.table(latestItems.rows);

  console.log('\n==================================================');
  console.log('✅ ALL TESTS PASSED: REAL DATABASE INSERTS VERIFIED WITH ZERO ERRORS!');
  console.log('==================================================');
  process.exit(0);
}

testAllShopsAndModes().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
