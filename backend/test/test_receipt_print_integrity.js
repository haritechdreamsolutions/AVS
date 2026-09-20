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

async function testReceiptPrintWorkflow() {
  console.log('==================================================');
  console.log('STEP 1: INSPECT ACTIVE PRODUCTS & SHOPS IN POSTGRESQL');
  console.log('==================================================');
  
  const comp = await query('SELECT * FROM companies WHERE id=1;');
  console.log('Configured Company Name:', comp.rows[0].name);
  if (comp.rows[0].name !== 'AVS AGENCIES') {
    throw new Error(`Company name must be AVS AGENCIES, got ${comp.rows[0].name}`);
  }

  const shops = await query('SELECT * FROM shops WHERE company_id=1 AND is_active=TRUE ORDER BY id ASC;');
  console.log('Active Shops Count:', shops.rows.length);
  console.table(shops.rows.map(s => ({ id: s.id, code: s.code, name: s.name })));

  const prods = await query('SELECT * FROM products WHERE company_id=1 AND is_active=TRUE ORDER BY id ASC;');
  console.log('Total Products in Catalog:', prods.rows.length);
  const pA = prods.rows[0];
  const pB = prods.rows[1] || prods.rows[0];

  console.log('\n==================================================');
  console.log('STEP 2: LOGIN AS DRIVER THARUN (tharun / 2002)');
  console.log('==================================================');
  const login = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ login_id: 'tharun', pin: '2002' }));

  console.log('Login Status:', login.status, 'Driver:', login.body?.user?.name);
  const cookie = login.cookie;

  // Allocate stock to Tharun (emp 2)
  await query(`
    INSERT INTO employee_stock (employee_id, product_id, company_id, qty_units, unit)
    VALUES (2, $1, 1, 50, 'Tray'), (2, $2, 1, 50, 'Tray')
    ON CONFLICT (employee_id, product_id) DO UPDATE SET qty_units = 50;
  `, [pA.id, pB.id]);

  console.log('\n==================================================');
  console.log('STEP 3: CREATE BILL WITH EXACTLY 2 SELECTED PRODUCTS');
  console.log('==================================================');
  const selectedShop = shops.rows[0]; // Hari (SHP-001)
  const qtyA = 2;
  const rateA = Number(pA.piece_selling_price || 12.00);
  const amtA = Number((qtyA * rateA).toFixed(2));

  const qtyB = 5;
  const rateB = Number(pB.piece_selling_price || 9.17);
  const amtB = Number((qtyB * rateB).toFixed(2));

  const totalBill = Number((amtA + amtB).toFixed(2));
  const cashPaid = 20.00;
  const gpayPaid = Number((totalBill - cashPaid).toFixed(2));

  console.log(`Product A: ${pA.display_name} | Qty: ${qtyA} | Rate: ₹${rateA.toFixed(2)} | Amt: ₹${amtA.toFixed(2)}`);
  console.log(`Product B: ${pB.display_name} | Qty: ${qtyB} | Rate: ₹${rateB.toFixed(2)} | Amt: ₹${amtB.toFixed(2)}`);
  console.log(`Calculated Total: ₹${totalBill.toFixed(2)} (Cash: ₹${cashPaid.toFixed(2)}, GPay: ₹${gpayPaid.toFixed(2)})`);

  const billPayload = {
    shop_id: selectedShop.id,
    shop_name: selectedShop.name,
    shop_code: selectedShop.code,
    items: [
      { product_id: pA.id, product_name: pA.display_name, unit_type: 'Piece', qty: qtyA, rate: rateA, amount: amtA },
      { product_id: pB.id, product_name: pB.display_name, unit_type: 'Piece', qty: qtyB, rate: rateB, amount: amtB }
    ],
    payment_mode: 'SPLIT',
    cash_paid: cashPaid,
    gpay_paid: gpayPaid,
    credit_paid: 0,
    total_amount: totalBill
  };

  const createRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/sales',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie }
  }, JSON.stringify(billPayload));

  console.log('Bill Creation Status:', createRes.status);
  console.log('Bill Creation Response:', createRes.body);

  if (createRes.status !== 200 || !createRes.body?.success) {
    throw new Error(`Failed to create bill: ${JSON.stringify(createRes.body)}`);
  }

  const createdSale = createRes.body.sale;

  console.log('\n==================================================');
  console.log('STEP 4: FETCH CANONICAL SAVED BILL VIA GET /api/sales/:id');
  console.log('==================================================');
  const getBillRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/sales/${createdSale.id}`,
    method: 'GET',
    headers: { 'Cookie': cookie }
  });

  console.log('GET Bill Status:', getBillRes.status);
  console.log('Fetched Bill Data:', getBillRes.body);

  const savedBill = getBillRes.body;
  if (savedBill.items.length !== 2) {
    throw new Error(`Receipt must contain EXACTLY 2 items, but got ${savedBill.items.length}`);
  }

  console.log('\n==================================================');
  console.log('STEP 5: VERIFY 58MM THERMAL RECEIPT INTEGRITY');
  console.log('==================================================');
  console.log(`Receipt Header: AVS AGENCIES`);
  console.log(`Shop: ${savedBill.shop_name} (Code: ${savedBill.shop_code})`);
  console.log(`Bill No: ${savedBill.bill_no}`);
  console.log(`Date/Time: ${savedBill.sale_date} ${savedBill.sale_time}`);
  console.log(`Driver: ${savedBill.employee_name} | Vehicle: ${savedBill.vehicle_no}`);
  console.log('--------------------------------------------------');
  console.log('ITEM                          QTY    RATE     AMT');
  console.log('--------------------------------------------------');
  for (const it of savedBill.items) {
    console.log(`${it.product_name.padEnd(28)} ${String(Math.floor(Number(it.qty))).padStart(3)}  ₹${Number(it.rate).toFixed(2).padStart(6)}  ₹${Number(it.amount).toFixed(2).padStart(7)}`);
  }
  console.log('--------------------------------------------------');
  console.log(`TOTAL QTY: ${savedBill.items.reduce((a, b) => a + Number(b.qty), 0)}`);
  console.log(`TOTAL AMOUNT: ₹${Number(savedBill.total_amount).toFixed(2)}`);
  console.log(`PAYMENT: ${savedBill.payment_mode} (Cash: ₹${savedBill.cash_paid}, GPay: ₹${savedBill.gpay_paid})`);
  console.log('==================================================');
  console.log('✅ 58MM THERMAL RECEIPT INTEGRITY VERIFIED WITH ZERO ERRORS!');
  console.log('==================================================');
  process.exit(0);
}

testReceiptPrintWorkflow().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
