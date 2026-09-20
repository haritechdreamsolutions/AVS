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

async function testAllShops() {
  console.log('=== 1. FETCHING THE 3 ACTIVE SHOPS FROM POSTGRESQL ===');
  const shopsRes = await query(`
    SELECT id, code, name, is_active, current_due
    FROM shops
    WHERE company_id = 1 AND is_active = TRUE
    ORDER BY id ASC;
  `);
  console.log('Active shops in DB:', shopsRes.rows);

  if (shopsRes.rows.length !== 3) {
    throw new Error(`Expected exactly 3 shops, got ${shopsRes.rows.length}`);
  }

  console.log('\n=== 2. LOGIN AS DRIVER (tharun / 2002) ===');
  const login = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ login_id: 'tharun', pin: '2002' }));

  console.log('Login Status:', login.status, 'Driver:', login.body?.user?.name);
  const cookie = login.cookie;

  // Get active products
  const prods = await query(`SELECT * FROM products WHERE company_id = 1 AND is_active = TRUE ORDER BY id ASC LIMIT 2;`);
  const prod1 = prods.rows[0];
  const prod2 = prods.rows[1] || prods.rows[0];

  // Allocate stock to Tharun (emp 2) for testing
  await query(`
    INSERT INTO employee_stock (employee_id, product_id, company_id, qty_units, unit)
    VALUES (2, $1, 1, 50, 'Tray')
    ON CONFLICT (employee_id, product_id) DO UPDATE SET qty_units = 50;
  `, [prod1.id]);

  if (prod2.id !== prod1.id) {
    await query(`
      INSERT INTO employee_stock (employee_id, product_id, company_id, qty_units, unit)
      VALUES (2, $1, 1, 50, 'Tray')
      ON CONFLICT (employee_id, product_id) DO UPDATE SET qty_units = 50;
    `, [prod2.id]);
  }

  console.log('\n=== 3. TESTING BILL CREATION FOR ALL 3 SHOPS ===');
  for (const shop of shopsRes.rows) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Testing Shop: ${shop.name} (ID: ${shop.id}, Code: ${shop.code})`);

    const rate1 = Number(prod1.piece_selling_price || 10);
    const rate2 = Number(prod2.piece_selling_price || 15);
    const qty1 = 5;
    const qty2 = 2;
    const line1 = Number((qty1 * rate1).toFixed(2));
    const line2 = Number((qty2 * rate2).toFixed(2));
    const totalAmt = Number((line1 + line2).toFixed(2));
    const cash = Number((totalAmt * 0.5).toFixed(2));
    const gpay = Number((totalAmt - cash).toFixed(2));

    const payload = {
      shop_id: shop.id,
      shop_name: shop.name,
      shop_code: shop.code,
      items: [
        { product_id: prod1.id, product_name: prod1.display_name, unit_type: 'Piece', qty: qty1, rate: rate1, amount: line1 },
        { product_id: prod2.id, product_name: prod2.display_name, unit_type: 'Piece', qty: qty2, rate: rate2, amount: line2 }
      ],
      payment_mode: 'SPLIT',
      cash_paid: cash,
      gpay_paid: gpay,
      credit_paid: 0,
      total_amount: totalAmt
    };

    const res = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/sales',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      }
    }, JSON.stringify(payload));

    console.log(`Response Status: ${res.status}`);
    console.log(`Response Body:`, res.body);

    if (res.status !== 200 || !res.body?.success) {
      throw new Error(`Failed to create bill for shop ${shop.name}: ${JSON.stringify(res.body)}`);
    }

    console.log(`✅ SUCCESS for Shop: ${shop.name} | Bill No: ${res.body.sale.bill_no} | Total: ₹${res.body.sale.total_amount}`);
  }

  console.log('\n==================================================');
  console.log('✅ ALL 3 SHOPS (Hari, Mani, Tharun) BILLING TESTS PASSED!');
  console.log('==================================================');
  process.exit(0);
}

testAllShops().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
