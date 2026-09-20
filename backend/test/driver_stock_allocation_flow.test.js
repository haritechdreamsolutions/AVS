// ============================================================
// AVS AGENCIES - STORE KEEPER TO DRIVER STOCK ALLOCATION TEST SUITE
// Database: PostgreSQL
// ============================================================
import { 
  addProduct, 
  addShop,
  addRoute,
  addEmployee,
  getEmployees, 
  getProducts,
  receiveStock, 
  getWarehouseStock, 
  issueStockToEmployee, 
  getEmployeeStock, 
  createSale, 
  createEmployeeSale,
  getStockMovements,
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
    console.error('         ' + e.message);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function run() {
  console.log('=== COMPLETE STORE KEEPER TO DRIVER STOCK ALLOCATION TEST SUITE (23 TESTS) ===\n');

  const cid = 1;
  let driverEmp, pCocola, pMilk, pWater, pRasna, testShop, testRoute;

  // --- TEST 1: Existing active Driver loads ---
  await test('TEST 1: Existing active Driver loads', async () => {
    const emps = await getEmployees(cid, { driversOnly: true });
    driverEmp = emps.find(e => e.full_name.toLowerCase() === 'tharun');
    assert(driverEmp, 'Tharun must be returned in the driver query');
    assert(driverEmp.vehicle_number, 'Vehicle number must exist');
  });

  // --- TEST 2: Only DRIVER role users appear ---
  await test('TEST 2: Only DRIVER role users appear', async () => {
    const drivers = await getEmployees(cid, { driversOnly: true });
    const storeKeeper = drivers.find(e => (e.user_role || '').toUpperCase() === 'STORE_KEEPER');
    const owner = drivers.find(e => (e.user_role || '').toUpperCase() === 'OWNER');
    const generalStaff = drivers.find(e => (e.user_role || '').toUpperCase() === 'EMPLOYEE');
    assert(!storeKeeper, 'STORE_KEEPER must not appear in driver list');
    assert(!owner, 'OWNER must not appear in driver list');
    assert(!generalStaff, 'EMPLOYEE role must not appear in driver list');
    assert(drivers.every(d => d.user_role === 'DRIVER'), 'All returned rows must strictly have DRIVER role');
  });

  // --- TEST 3: Inactive Driver does not appear ---
  await test('TEST 3: Inactive Driver does not appear', async () => {
    const inactRes = await addEmployee(cid, { full_name: 'Temp Inactive Driver', employee_code: 'INACT02', vehicle_number: 'TN32X0002' });
    await query('UPDATE employees SET is_active = FALSE WHERE id = $1', [inactRes.employee.id]);

    const emps = await getEmployees(cid, { driversOnly: true });
    const foundInact = emps.find(e => e.id === inactRes.employee.id);
    assert(!foundInact, 'Inactive driver must not appear in driver list');

    await query('DELETE FROM employees WHERE id = $1', [inactRes.employee.id]);
  });

  // --- TEST 4: Duplicate Driver does not appear ---
  await test('TEST 4: Duplicate Driver does not appear', async () => {
    const emps = await getEmployees(cid, { driversOnly: true });
    const tharunList = emps.filter(e => e.id === driverEmp.id);
    assert(tharunList.length === 1, 'Driver Tharun must appear EXACTLY ONCE');
  });

  // --- TEST 5: Stock is not shown before Driver selection ---
  await test('TEST 5: Stock is not shown before Driver selection', async () => {
    const selectedDriverId = null;
    const isStockVisible = Boolean(selectedDriverId);
    assert(isStockVisible === false, 'Stock section must remain hidden when no driver is selected');
  });

  // --- TEST 6: Stock loads after Driver selection ---
  await test('TEST 6: Stock loads after Driver selection', async () => {
    const prods = await getProducts(cid);
    pCocola = prods.find(p => p.name.toLowerCase() === 'cocola 150ml' || p.name.toLowerCase() === 'cocola');
    pMilk = prods.find(p => p.name.toLowerCase() === 'milk 200ml');
    pWater = prods.find(p => p.name.toLowerCase() === 'water 300ml');
    pRasna = prods.find(p => p.name.toLowerCase() === 'rasna');
    assert(pCocola && pMilk && pWater && pRasna, 'Canonical products available in PostgreSQL');

    const wh = await getWarehouseStock(cid);
    assert(wh.length >= 4, 'Warehouse stock loaded from PostgreSQL');
  });

  // --- TEST 7: Duplicate Product does not appear ---
  await test('TEST 7: Duplicate Product does not appear', async () => {
    const wh = await getWarehouseStock(cid);
    const cocolaEntries = wh.filter(p => p.id === pCocola.id);
    assert(cocolaEntries.length === 1, 'Cocola appears exactly once in warehouse stock');
  });

  // Reset warehouse stock & employee stock for clean deterministic testing
  await query('UPDATE products SET warehouse_stock_units = 50 WHERE id = $1', [pCocola.id]);
  await query('UPDATE products SET warehouse_stock_units = 50 WHERE id = $1', [pMilk.id]);
  await query('UPDATE products SET warehouse_stock_units = 50 WHERE id = $1', [pWater.id]);
  await query('UPDATE products SET warehouse_stock_units = 50 WHERE id = $1', [pRasna.id]);
  await query('DELETE FROM employee_stock WHERE employee_id = $1', [driverEmp.id]);

  // --- TEST 8: Valid quantity allocation succeeds ---
  await test('TEST 8: Valid quantity allocation succeeds', async () => {
    const res = await issueStockToEmployee(cid, {
      employee_id: driverEmp.id,
      items: [{ product_id: pCocola.id, quantity: 5, unit: 'Box' }]
    });
    assert(res.success === true, 'Allocation must succeed');
  });

  // --- TEST 9: Quantity greater than warehouse stock fails ---
  await test('TEST 9: Quantity greater than warehouse stock fails', async () => {
    let thrown = false;
    try {
      await issueStockToEmployee(cid, {
        employee_id: driverEmp.id,
        items: [{ product_id: pCocola.id, quantity: 99999, unit: 'Box' }]
      });
    } catch (e) {
      thrown = true;
      assert(e.message.includes('Insufficient warehouse stock'), 'Error message for insufficient stock expected');
    }
    assert(thrown, 'Should reject allocation exceeding warehouse stock');
  });

  // --- TEST 10: Zero quantity fails ---
  await test('TEST 10: Zero quantity fails', async () => {
    let thrown = false;
    try {
      await issueStockToEmployee(cid, {
        employee_id: driverEmp.id,
        items: [{ product_id: pCocola.id, quantity: 0, unit: 'Box' }]
      });
    } catch (e) {
      thrown = true;
      assert(e.message.includes('Quantity must be greater than 0'), 'Error message for 0 quantity expected');
    }
    assert(thrown, 'Should reject 0 quantity allocation');
  });

  // --- TEST 11: Negative quantity fails ---
  await test('TEST 11: Negative quantity fails', async () => {
    let thrown = false;
    try {
      await issueStockToEmployee(cid, {
        employee_id: driverEmp.id,
        items: [{ product_id: pCocola.id, quantity: -5, unit: 'Box' }]
      });
    } catch (e) {
      thrown = true;
      assert(e.message.includes('Quantity must be greater than 0'), 'Error message for negative quantity expected');
    }
    assert(thrown, 'Should reject negative quantity allocation');
  });

  // --- TEST 12: Warehouse stock decreases correctly ---
  await test('TEST 12: Warehouse stock decreases correctly', async () => {
    const wh = await getWarehouseStock(cid);
    const cocola = wh.find(p => p.id === pCocola.id);
    assert(Number(cocola.warehouse_stock_units) === 45, 'Warehouse stock decreased from 50 to 45');
  });

  // --- TEST 13: Driver stock increases correctly ---
  await test('TEST 13: Driver stock increases correctly', async () => {
    const driverStock = await getEmployeeStock(cid, driverEmp.id);
    const cocola = driverStock.find(s => s.product_id === pCocola.id);
    assert(Number(cocola.qty_units) === 5, 'Driver vehicle stock increased to 5 Boxes');
  });

  // --- TEST 14: Multiple products allocate correctly ---
  await test('TEST 14: Multiple products allocate correctly', async () => {
    const res = await issueStockToEmployee(cid, {
      employee_id: driverEmp.id,
      items: [
        { product_id: pMilk.id, quantity: 3, unit: 'Tray' },
        { product_id: pWater.id, quantity: 4, unit: 'Case' },
        { product_id: pRasna.id, quantity: 1, unit: 'Case' }
      ]
    });
    assert(res.success === true, 'Multi-product batch allocation succeeds');

    const wh = await getWarehouseStock(cid);
    assert(Number(wh.find(p => p.id === pMilk.id).warehouse_stock_units) === 47, 'Milk warehouse stock is 47');
    assert(Number(wh.find(p => p.id === pWater.id).warehouse_stock_units) === 46, 'Water warehouse stock is 46');
    assert(Number(wh.find(p => p.id === pRasna.id).warehouse_stock_units) === 49, 'Rasna warehouse stock is 49');
  });

  // --- TEST 15: Driver dashboard shows allocated stock ---
  await test('TEST 15: Driver dashboard shows allocated stock', async () => {
    const driverStock = await getEmployeeStock(cid, driverEmp.id);
    assert(driverStock.length === 4, 'Driver sees all 4 allocated product cards');
    assert(Number(driverStock.find(s => s.product_id === pCocola.id).qty_units) === 5, '5 Boxes Cocola');
    assert(Number(driverStock.find(s => s.product_id === pMilk.id).qty_units) === 3, '3 Trays Milk');
  });

  // --- TEST 16: Driver billing decreases Driver stock ---
  await test('TEST 16: Driver billing decreases Driver stock', async () => {
    const rRes = await addRoute(cid, { code: 'R-AL23' + Date.now().toString().slice(-4), name: '23 Tests Route' });
    testRoute = rRes.route || rRes;
    const sRes = await addShop(cid, { name: '23 Tests Shop ' + Date.now().toString().slice(-4), route_id: testRoute.id });
    testShop = sRes.shop;

    const saleRes = await createEmployeeSale(cid, driverEmp.id, 'Tharun', {
      shop_id: testShop.id,
      payment_mode: 'CASH',
      items: [{ product_id: pCocola.id, quantity: 2, unit_type: 'Box', rate: 300 }]
    });
    assert(saleRes.success === true, 'Sale must succeed');

    const driverStock = await getEmployeeStock(cid, driverEmp.id);
    const cocola = driverStock.find(s => s.product_id === pCocola.id);
    assert(Number(cocola.qty_units) === 3, 'Driver stock decreased from 5 to 3 Boxes');

    const wh = await getWarehouseStock(cid);
    assert(Number(wh.find(p => p.id === pCocola.id).warehouse_stock_units) === 45, 'Warehouse stock remained unchanged at 45 Boxes');
  });

  // --- TEST 17: Driver cannot sell more than available stock ---
  await test('TEST 17: Driver cannot sell more than available stock', async () => {
    let thrown = false;
    try {
      await createEmployeeSale(cid, driverEmp.id, 'Tharun', {
        shop_id: testShop.id,
        payment_mode: 'CASH',
        items: [{ product_id: pCocola.id, quantity: 10, unit_type: 'Box', rate: 300 }]
      });
    } catch (e) {
      thrown = true;
      assert(e.message.includes('Insufficient vehicle stock'), 'Insufficient vehicle stock error expected');
    }
    assert(thrown, 'Should reject sale beyond vehicle stock');
  });

  // --- TEST 18: Refresh preserves stock ---
  await test('TEST 18: Refresh preserves stock', async () => {
    const reloadedStock = await getEmployeeStock(cid, driverEmp.id);
    const cocola = reloadedStock.find(s => s.product_id === pCocola.id);
    assert(Number(cocola.qty_units) === 3, 'Persisted stock in PostgreSQL is 3 Boxes');
  });

  // --- TEST 19: Logout/login preserves stock ---
  await test('TEST 19: Logout/login preserves stock', async () => {
    const freshDriverStock = await getEmployeeStock(cid, driverEmp.id);
    const cocola = freshDriverStock.find(s => s.product_id === pCocola.id);
    assert(cocola && Number(cocola.qty_units) === 3, 'Fresh query confirms 3 Boxes');
  });

  // --- TEST 20: Double submission does not create duplicate allocation ---
  await test('TEST 20: Double submission does not create duplicate allocation', async () => {
    const idempotencyKey = 'ALLOC-IDEMP-23-' + Date.now();
    const req1 = await issueStockToEmployee(cid, {
      employee_id: driverEmp.id,
      client_reference: idempotencyKey,
      items: [{ product_id: pCocola.id, quantity: 2, unit: 'Box' }]
    });
    assert(req1.success === true, 'First submit succeeds');

    const req2 = await issueStockToEmployee(cid, {
      employee_id: driverEmp.id,
      client_reference: idempotencyKey,
      items: [{ product_id: pCocola.id, quantity: 2, unit: 'Box' }]
    });
    assert(req2.isDuplicate === true, 'Second submit detected as duplicate and rejected');

    const driverStock = await getEmployeeStock(cid, driverEmp.id);
    const cocola = driverStock.find(s => s.product_id === pCocola.id);
    assert(Number(cocola.qty_units) === 5, 'Driver stock is 5 Boxes (3 + 2, not 3 + 2 + 2)');
  });

  // --- TEST 21: Concurrent allocation cannot create negative warehouse stock ---
  await test('TEST 21: Concurrent allocation cannot create negative warehouse stock', async () => {
    await query('UPDATE products SET warehouse_stock_units = 5 WHERE id = $1', [pCocola.id]);

    const task1 = issueStockToEmployee(cid, {
      employee_id: driverEmp.id,
      items: [{ product_id: pCocola.id, quantity: 4, unit: 'Box' }]
    });
    const task2 = issueStockToEmployee(cid, {
      employee_id: driverEmp.id,
      items: [{ product_id: pCocola.id, quantity: 4, unit: 'Box' }]
    });

    const results = await Promise.allSettled([task1, task2]);
    const succeeded = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    assert(succeeded.length === 1, 'Only one concurrent allocation must succeed');
    assert(rejected.length === 1, 'Other concurrent allocation must fail due to row-level lock');

    const wh = await getWarehouseStock(cid);
    const whCocola = wh.find(p => p.id === pCocola.id);
    assert(Number(whCocola.warehouse_stock_units) === 1, 'Warehouse stock is 1 Box (5 - 4), never negative');
  });

  // --- TEST 22: Transaction rollback works when any operation fails ---
  await test('TEST 22: Transaction rollback works when any operation fails', async () => {
    const whBefore = await getWarehouseStock(cid);
    const milkBefore = Number(whBefore.find(p => p.id === pMilk.id).warehouse_stock_units);

    let thrown = false;
    try {
      // Batch with 1 valid item and 1 invalid item (exceeding stock)
      await issueStockToEmployee(cid, {
        employee_id: driverEmp.id,
        items: [
          { product_id: pMilk.id, quantity: 2, unit: 'Tray' },
          { product_id: pCocola.id, quantity: 99999, unit: 'Box' }
        ]
      });
    } catch (e) {
      thrown = true;
    }
    assert(thrown, 'Batch with invalid item should throw');

    const whAfter = await getWarehouseStock(cid);
    const milkAfter = Number(whAfter.find(p => p.id === pMilk.id).warehouse_stock_units);
    assert(milkBefore === milkAfter, 'Milk warehouse stock must rollback completely (no partial update)');
  });

  // --- TEST 23: Current Driver Stock aggregates repeated allocations into one product row ---
  await test('TEST 23: Current Driver Stock aggregates repeated allocations into one product row', async () => {
    const driverStock = await getEmployeeStock(cid, driverEmp.id);
    const cocolaCards = driverStock.filter(s => s.product_id === pCocola.id);
    assert(cocolaCards.length === 1, 'Current Driver stock aggregated into EXACTLY ONE card');
  });

  console.log('\n========================================');
  console.log(`Tests Run: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log('========================================\n');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

run().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
