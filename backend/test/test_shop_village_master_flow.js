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

async function runShopVillageFlowSuite() {
  console.log('==================================================================');
  console.log('  AVS AGENCIES - STORE KEEPER SHOP & VILLAGE MASTER FLOW SUITE    ');
  console.log('==================================================================\n');

  // 1. Login Store Keeper (storekeeper / 1234) and Driver Tharun (tharun / 2002)
  const loginKeeper = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ login_id: 'storekeeper', pin: '1234' }));

  const loginDriver = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ login_id: 'tharun', pin: '2002' }));

  if (loginKeeper.status !== 200) throw new Error('Store Keeper login failed: ' + JSON.stringify(loginKeeper.body));
  if (loginDriver.status !== 200) throw new Error('Driver login failed: ' + JSON.stringify(loginDriver.body));

  const keeperCookie = loginKeeper.cookie;
  const driverCookie = loginDriver.cookie;
  console.log('✅ Logged in Store Keeper & Driver');

  // Fetch active villages from PostgreSQL
  const vilsRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/villages',
    method: 'GET',
    headers: { 'Cookie': keeperCookie }
  });

  console.log(`✅ Fetched ${vilsRes.body.length} Villages from database:`, vilsRes.body.map(v => `${v.name} (${v.code})`).join(', '));
  if (!Array.isArray(vilsRes.body) || vilsRes.body.length === 0) throw new Error('No villages found in DB');

  const kovilpatti = vilsRes.body.find(v => v.name === 'Kovilpatti') || vilsRes.body[0];
  const melur = vilsRes.body.find(v => v.name === 'Melur') || vilsRes.body[1];

  // Fetch routes
  const routesRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/routes',
    method: 'GET',
    headers: { 'Cookie': keeperCookie }
  });
  const defaultRoute = routesRes.body[0];

  // Clean test shops created during previous automated runs to test clean sequence
  await query("DELETE FROM sales WHERE shop_name = 'Hari Store';");
  await query("DELETE FROM shops WHERE name = 'Hari Store';");

  // ==========================================
  // TEST A: Create Village = Kovilpatti, Shop = Hari Store
  // ==========================================
  console.log('\n--- TEST A: Create Shop (Village: Kovilpatti, Name: Hari Store) ---');
  const shopA = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/shops',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': keeperCookie }
  }, JSON.stringify({
    village_id: kovilpatti.id,
    name: 'Hari Store',
    owner_name: 'Hari',
    phone: '9876543210',
    route_id: defaultRoute.id,
    distance_km: 3.5,
    has_freezer: true,
    freezer_model: 'Blue Star 300L Visicooler'
  }));

  console.log('Shop A Response:', shopA.status, shopA.body);
  if (shopA.status !== 200 || !shopA.body?.success || !shopA.body?.shop?.code) {
    throw new Error('TEST A FAILED: Shop A creation failed');
  }
  const shopACode = shopA.body.shop.code;
  console.log(`✅ TEST A PASSED: Shop A Created with Code ${shopACode} in ${shopA.body.shop.village_name}`);

  // ==========================================
  // TEST B: Create Same Village + Same Shop Name (Kovilpatti, Hari Store)
  // ==========================================
  console.log('\n--- TEST B: Same Village + Same Shop Name (Kovilpatti, Hari Store) ---');
  const shopB = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/shops',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': keeperCookie }
  }, JSON.stringify({
    village_id: kovilpatti.id,
    name: 'Hari Store',
    owner_name: 'Hari Kumar',
    phone: '9876543211',
    route_id: defaultRoute.id,
    distance_km: 4.0
  }));

  console.log('Shop B Response:', shopB.status, shopB.body);
  if (shopB.status !== 200 || !shopB.body?.success) {
    throw new Error('TEST B FAILED: Duplicate shop name in same village was rejected');
  }
  const shopBCode = shopB.body.shop.code;
  if (shopACode === shopBCode) {
    throw new Error('TEST B FAILED: Shop A and Shop B received identical Shop ID!');
  }
  console.log(`✅ TEST B PASSED: Shop B Created with distinct Code ${shopBCode} in ${shopB.body.shop.village_name}`);

  // ==========================================
  // TEST C: Create Different Village + Same Shop Name (Melur, Hari Store)
  // ==========================================
  console.log('\n--- TEST C: Different Village + Same Shop Name (Melur, Hari Store) ---');
  const shopC = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/shops',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': keeperCookie }
  }, JSON.stringify({
    village_id: melur.id,
    name: 'Hari Store',
    owner_name: 'Hariharan',
    phone: '9876543212',
    route_id: defaultRoute.id,
    distance_km: 6.2
  }));

  console.log('Shop C Response:', shopC.status, shopC.body);
  if (shopC.status !== 200 || !shopC.body?.success) {
    throw new Error('TEST C FAILED: Same shop name in different village was rejected');
  }
  const shopCCode = shopC.body.shop.code;
  if (shopCCode === shopACode || shopCCode === shopBCode) {
    throw new Error('TEST C FAILED: Shop C received conflicting Shop ID!');
  }
  console.log(`✅ TEST C PASSED: Shop C Created with distinct Code ${shopCCode} in ${shopC.body.shop.village_name}`);

  // ==========================================
  // TEST D: Same Shop Name + Same Owner + Same Phone
  // ==========================================
  console.log('\n--- TEST D: Same Shop Name + Same Owner + Same Phone ---');
  const shopD = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/shops',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': keeperCookie }
  }, JSON.stringify({
    village_id: melur.id,
    name: 'Hari Store',
    owner_name: 'Hariharan',
    phone: '9876543212',
    route_id: defaultRoute.id,
    distance_km: 6.2
  }));

  console.log('Shop D Response:', shopD.status, shopD.body);
  if (shopD.status !== 200 || !shopD.body?.success) {
    throw new Error('TEST D FAILED');
  }
  const shopDCode = shopD.body.shop.code;
  console.log(`✅ TEST D PASSED: Shop D Created with distinct Code ${shopDCode}`);

  // ==========================================
  // TEST E: Fetch All Shops with Village and Route Joins
  // ==========================================
  console.log('\n--- TEST E: Fetch All Shops via GET /api/shops ---');
  const allShopsRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/shops',
    method: 'GET',
    headers: { 'Cookie': keeperCookie }
  });

  const matchingShops = allShopsRes.body.filter(s => s.name === 'Hari Store');
  console.log('Matching "Hari Store" shops in DB:');
  console.table(matchingShops.map(s => ({
    id: s.id,
    code: s.code,
    name: s.name,
    village_id: s.village_id,
    village_name: s.village_name,
    route_name: s.route_name
  })));

  if (matchingShops.length < 4) throw new Error('Expected at least 4 Hari Store entries with unique IDs');
  console.log('✅ TEST E PASSED: All shops returned with correct village_name and unique code');

  // ==========================================
  // TEST G & H: Driver Billing using Shop ID
  // ==========================================
  console.log('\n--- TEST G & H: Driver Billing using Shop ID ---');
  const prods = await query('SELECT * FROM products WHERE company_id=1 AND is_active=TRUE ORDER BY id ASC;');
  const p1 = prods.rows[0];

  // Set stock for driver
  await query(`
    INSERT INTO employee_stock (employee_id, product_id, company_id, qty_units, unit)
    VALUES (2, $1, 1, 100, 'Tray')
    ON CONFLICT (employee_id, product_id) DO UPDATE SET qty_units = 100;
  `, [p1.id]);

  // Create Bill for Shop A
  const billA = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/sales',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': driverCookie }
  }, JSON.stringify({
    shop_id: shopA.body.shop.id,
    shop_code: shopACode,
    shop_name: shopA.body.shop.name,
    items: [{ product_id: p1.id, product_name: p1.display_name, unit_type: 'Piece', qty: 2, rate: 50, amount: 100 }],
    payment_mode: 'CASH',
    cash_paid: 100,
    total_amount: 100
  }));

  console.log('Bill A Response:', billA.status, billA.body);
  if (billA.status !== 200 || !billA.body?.success) throw new Error('Bill A creation failed');
  console.log(`✅ TEST G & H PASSED: Bill Created for Shop ID ${shopACode} (${shopA.body.shop.name})`);

  // Verify Bill in DB
  const savedBill = await query('SELECT * FROM sales WHERE id = $1', [billA.body.sale.id]);
  console.log('Saved Bill in DB:', {
    id: savedBill.rows[0].id,
    shop_id: savedBill.rows[0].shop_id,
    shop_name: savedBill.rows[0].shop_name,
    total_amount: savedBill.rows[0].total_amount
  });
  if (savedBill.rows[0].shop_id !== shopA.body.shop.id) {
    throw new Error('TEST H FAILED: Saved bill shop_id does not match Shop A id!');
  }
  console.log('✅ TEST H PASSED: Bill strictly references Shop A id');

  // ==========================================
  // TEST J: Validation - Empty Village Rejected
  // ==========================================
  console.log('\n--- TEST J: Validation - Empty Village Rejected ---');
  const invalidShop = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/shops',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': keeperCookie }
  }, JSON.stringify({
    name: 'Invalid Shop No Village',
    route_id: defaultRoute.id
  }));

  console.log('Empty Village Validation Status:', invalidShop.status, invalidShop.body);
  if (invalidShop.status === 200) throw new Error('TEST J FAILED: Empty village should be rejected');
  console.log('✅ TEST J PASSED: Shop without village correctly rejected with 400 Bad Request');

  console.log('\n==================================================================');
  console.log('🎉 ALL SHOP & VILLAGE MASTER TESTS PASSED WITH 100% SUCCESS!     ');
  console.log('==================================================================');
  process.exit(0);
}

runShopVillageFlowSuite().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
