// ============================================================
// AVS AGENCIES - DRIVER RETURN RECONCILIATION EXACT CALCULATION TEST
// ============================================================
import {
  addProduct,
  addEmployee,
  addRoute,
  addVillage,
  addShop,
  getProducts,
  getEmployeeStock,
  issueStockToEmployee,
  createEmployeeSale,
  addDamage,
  getDriverExpectedReturn,
  verifyAndAcceptDriverReturn,
  getMissingStockReport,
  query
} from '../db_pg.js';

let passed = 0;
let failed = 0;
let total = 0;

async function test(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log('  [PASS] ' + name);
  } catch (e) {
    failed++;
    console.error('  [FAIL] ' + name);
    console.error(e.stack || e.message);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function run() {
  console.log('=== DRIVER RETURN RECONCILIATION EXACT CALCULATION TEST ===\n');
  const cid = 1;
  const uniqueSuffix = Date.now().toString().slice(-4);
  let testDriver, testProduct, testShop;

  await test('1. Setup Driver and Product (100 Pieces Allocation)', async () => {
    const rRes = await addRoute(cid, { code: 'R-' + uniqueSuffix, name: 'Test Route ' + uniqueSuffix });
    const route = rRes.route || rRes;

    const vRes = await addVillage(cid, { name: 'Village ' + uniqueSuffix, route_id: route.id });
    const village = vRes.village || vRes;

    const empRes = await addEmployee(cid, {
      full_name: 'Test Driver Return ' + uniqueSuffix,
      employee_code: 'DRV-' + uniqueSuffix,
      designation: 'Driver',
      role: 'EMPLOYEE',
      vehicle_number: 'TN32-' + uniqueSuffix,
      route_id: route.id
    });
    testDriver = empRes.employee;
    assert(testDriver && testDriver.id, 'Test driver created');

    const sRes = await addShop(cid, {
      name: 'Shop ' + uniqueSuffix,
      owner_name: 'Owner ' + uniqueSuffix,
      route_id: route.id,
      village_id: village.id
    });
    testShop = sRes.shop;

    const pRes = await addProduct(cid, {
      name: 'Milk 500ml Test ' + uniqueSuffix,
      display_name: 'Milk 500ml Test ' + uniqueSuffix,
      selling_unit: 'Piece',
      base_unit: 'Piece',
      pieces_per_unit: 1,
      purchase_price: 25.00,
      unit_selling_price: 30.00,
      warehouse_stock_units: 500
    });
    testProduct = pRes.product;
    assert(testProduct && testProduct.id, 'Test product created with 500 warehouse units');

    const allocRes = await issueStockToEmployee(cid, {
      employee_id: testDriver.id,
      items: [{ product_id: testProduct.id, quantity: 100, unit: 'Piece' }]
    }, 1);
    assert(allocRes.success, 'Stock allocation succeeded');

    const driverStock = await getEmployeeStock(cid, testDriver.id);
    const dItem = driverStock.find(s => Number(s.product_id) === Number(testProduct.id));
    assert(Number(dItem.qty_units) === 100, 'Driver should hold 100 units, got ' + dItem?.qty_units);
  });

  await test('2. Driver Sells 70 Pieces and Records 10 Pieces Damage', async () => {
    const saleRes = await createEmployeeSale(cid, testDriver.id, testDriver.full_name, {
      shop_id: testShop.id,
      payment_mode: 'CASH',
      items: [{ product_id: testProduct.id, quantity: 70, unit_type: 'Piece', rate: 30.00 }]
    });
    assert(saleRes && saleRes.sale, '70 pieces sold successfully');

    const dmgRes = await addDamage(cid, {
      employee_id: testDriver.id,
      product_id: testProduct.id,
      items: [{ product_id: testProduct.id, damage_qty: 10, unit: 'Piece', reason: 'Leakage / Burst' }],
      reason: 'Leakage / Burst'
    }, 1);
    assert(dmgRes && dmgRes.success, '10 pieces damage recorded successfully');

    const expected = await getDriverExpectedReturn(cid, testDriver.id);
    const prodRecon = expected.products.find(p => Number(p.product_id) === Number(testProduct.id));
    assert(prodRecon, 'Product present in driver return expected calculation');
    assert(prodRecon.allocated === 100, 'Allocated should be 100, got ' + prodRecon.allocated);
    assert(prodRecon.sold === 70, 'Sold should be 70, got ' + prodRecon.sold);
    assert(prodRecon.damage === 10, 'Damage should be 10, got ' + prodRecon.damage);
    assert(prodRecon.expected_return === 20, 'Expected return should be 20 (100 - 70 - 10), got ' + prodRecon.expected_return);
  });

  await test('3. Physical Return of 18 Pieces -> 2 Shortage and Warehouse Update', async () => {
    const allProds1 = await getProducts(cid);
    const preProd = allProds1.find(p => Number(p.id) === Number(testProduct.id));
    const initialWarehouseStock = Number(preProd.warehouse_stock_units);

    const returnPayload = {
      employee_id: testDriver.id,
      shortage_reason: '2 packets fell off crate and missing',
      items: [{ product_id: testProduct.id, actual_quantity: 18, unit: 'Piece', shortage_reason: '2 packets fell off crate and missing' }]
    };

    const retResult = await verifyAndAcceptDriverReturn(cid, testDriver.id, returnPayload, 1);
    assert(retResult && retResult.success, 'Return verified and accepted');

    const allProds2 = await getProducts(cid);
    const postProd = allProds2.find(p => Number(p.id) === Number(testProduct.id));
    const finalWarehouseStock = Number(postProd.warehouse_stock_units);
    assert(
      finalWarehouseStock === initialWarehouseStock + 18,
      'Warehouse stock must increase by exactly 18 (from ' + initialWarehouseStock + ' to ' + (initialWarehouseStock + 18) + '), got ' + finalWarehouseStock
    );

    const heldPost = await getEmployeeStock(cid, testDriver.id);
    const heldItem = heldPost.find(s => Number(s.product_id) === Number(testProduct.id));
    assert(!heldItem || Number(heldItem.qty_units) === 0, 'Driver stock must be zeroed out (0)');

    const sessRes = await query(
      'SELECT status FROM driver_sessions WHERE employee_id = $1 ORDER BY id DESC LIMIT 1',
      [testDriver.id]
    );
    assert(sessRes.rows[0]?.status === 'CLOSED', 'Driver session must be CLOSED, got ' + sessRes.rows[0]?.status);

    const missingRep = await getMissingStockReport(cid, { driver_id: testDriver.id });
    assert(missingRep && missingRep.records && missingRep.records.length > 0, 'Missing stock report must contain record for driver');
    const driverShortageItem = missingRep.records[0];
    const totalMissing = Number(driverShortageItem.missing_quantity || driverShortageItem.shortage_units || 0);
    assert(
      totalMissing === 2,
      'Missing stock report must report exactly 2 shortage units, got ' + totalMissing
    );
  });

  console.log('\n========================================');
  console.log('TEST RESULTS: ' + passed + ' Passed, ' + failed + ' Failed out of ' + total);
  console.log('========================================\n');
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('Fatal test error:', err); process.exit(1); });
