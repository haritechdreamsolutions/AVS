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

async function testE2EBillCreation() {
  console.log('=== 1. ENSURE DRIVER HAS ALLOCATED STOCK FOR TESTING ===');
  // Find driver Tharun (emp ID 2 or similar)
  const empRes = await query(`SELECT * FROM employees WHERE employee_code = 'EMP001' AND company_id = 1;`);
  const emp = empRes.rows[0];
  console.log('Driver employee:', emp.id, emp.full_name);

  // Find a product
  const prodRes = await query(`SELECT * FROM products WHERE company_id = 1 AND is_active = TRUE ORDER BY id ASC LIMIT 1;`);
  const prod = prodRes.rows[0];
  console.log('Test product:', prod.id, prod.display_name, 'pieces_per_unit:', prod.pieces_per_unit, 'piece_price:', prod.piece_selling_price);

  // Ensure driver has 10 units (Trays/Boxes) of stock
  await query(`
    INSERT INTO employee_stock (employee_id, product_id, company_id, qty_units, unit)
    VALUES ($1, $2, 1, 10, 'Tray')
    ON CONFLICT (employee_id, product_id)
    DO UPDATE SET qty_units = 10, updated_at = NOW();
  `, [emp.id, prod.id]);

  // Find shop
  const shopRes = await query(`SELECT * FROM shops WHERE company_id = 1 AND is_active = TRUE ORDER BY id ASC LIMIT 1;`);
  const shop = shopRes.rows[0];
  console.log('Test shop:', shop.id, shop.name, shop.code);

  console.log('\n=== 2. LOGIN AS DRIVER THARUN ===');
  const loginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ login_id: 'tharun', pin: '2002' }));

  console.log('Login Status:', loginRes.status, 'User:', loginRes.body?.user?.name);
  const cookie = loginRes.cookie;

  console.log('\n=== 3. SUBMIT SPLIT BILL WITH 40 PIECES (PRODUCING FRACTIONAL UOM CONVERSION) ===');
  const ppu = Number(prod.pieces_per_unit || 1);
  const rate = Number(prod.piece_selling_price || 12);
  const qty = 40; // 40 Pieces
  const lineAmt = Number((qty * rate).toFixed(2));
  const cashPaid = 100;
  const gpayPaid = Number((lineAmt - cashPaid).toFixed(2));

  console.log(`Testing with qty = ${qty} pieces, ppu = ${ppu}, conversion = ${qty / ppu} units`);
  console.log(`Total amount = ₹${lineAmt}, Cash = ₹${cashPaid}, GPay = ₹${gpayPaid}`);

  const billPayload = {
    shop_id: shop.id,
    shop_name: shop.name,
    shop_code: shop.code,
    items: [
      {
        product_id: prod.id,
        product_name: prod.display_name,
        unit_type: 'Piece',
        qty: qty,
        rate: rate,
        amount: lineAmt
      }
    ],
    payment_mode: 'SPLIT',
    cash_paid: cashPaid,
    gpay_paid: gpayPaid,
    credit_paid: 0,
    total_amount: lineAmt
  };

  const saleRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/sales',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    }
  }, JSON.stringify(billPayload));

  console.log('Bill Creation Status:', saleRes.status);
  console.log('Bill Creation Response:', saleRes.body);

  if (saleRes.status !== 200 || !saleRes.body?.success) {
    throw new Error(`Bill creation failed: ${JSON.stringify(saleRes.body)}`);
  }

  const createdSale = saleRes.body.sale;
  const createdItems = saleRes.body.items;

  console.log('\n=== 4. VERIFYING GENERATED BILL RECORD IN POSTGRESQL ===');
  console.log('Generated Bill No:', createdSale.bill_no);
  console.log('Total Amount:', createdSale.total_amount);
  console.log('Cash Paid:', createdSale.cash_paid);
  console.log('GPay Paid:', createdSale.gpay_paid);
  console.log('Items in Bill:', createdItems.length);
  console.log('Items details:', createdItems);

  console.log('\n=== 5. VERIFYING REMAINING DRIVER VEHICLE STOCK ===');
  const esAfter = await query(`
    SELECT es.*, (es.qty_units * p.pieces_per_unit) as remaining_pieces
    FROM employee_stock es
    JOIN products p ON p.id = es.product_id
    WHERE es.employee_id = $1 AND es.product_id = $2 AND es.company_id = 1;
  `, [emp.id, prod.id]);
  
  console.log('Driver stock row in DB:', esAfter.rows[0]);
  const expectedPieces = Math.floor(10 * ppu - qty);
  const actualPieces = Math.floor(Number(esAfter.rows[0].remaining_pieces));
  console.log(`Expected remaining pieces: ${expectedPieces}, Actual: ${actualPieces}`);

  if (Math.abs(expectedPieces - actualPieces) > 0.01) {
    throw new Error(`Stock mismatch: expected ${expectedPieces}, got ${actualPieces}`);
  }

  console.log('\n✅ ALL E2E TESTS PASSED WITH ZERO ERRORS!');
  process.exit(0);
}

testE2EBillCreation().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
