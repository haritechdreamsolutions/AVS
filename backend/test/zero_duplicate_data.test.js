// ============================================================
// AVS AGENCIES - ZERO DUPLICATE DATA TEST SUITE
// Database: PostgreSQL
// ============================================================
import { 
  addProduct, 
  addShop,
  addRoute,
  addEmployee,
  getEmployees, 
  receiveStock, 
  getWarehouseStock, 
  getProducts,
  issueStockToEmployee, 
  getEmployeeStock, 
  createSale, 
  createEmployeeSale,
  getStockMovements 
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
  console.log('=== ZERO DUPLICATE DATA TEST SUITE ===\n');

  const cid = 1;
  let emp1, pCocola, pMilk, shop1, route1;

  await test('1. Driver / User Uniqueness — No Duplicate Drivers in Listing', async () => {
    const emps = await getEmployees(cid);
    emp1 = emps.find(e => e.full_name.toLowerCase() === 'tharun');
    if (!emp1) {
      const eRes = await addEmployee(cid, { full_name: 'Tharun', employee_code: 'EMP001', vehicle_number: 'TN32S2002' });
      emp1 = eRes.employee;
    }

    const allEmps = await getEmployees(cid);
    const tharunEntries = allEmps.filter(e => e.id === emp1.id);
    assert(tharunEntries.length === 1, 'Tharun must appear EXACTLY ONCE in employee list');
  });

  await test('2. Product Master Uniqueness — Reject Duplicate Product Names', async () => {
    const prods = await getProducts(cid);
    pCocola = prods.find(p => p.name.toLowerCase() === 'cocola 150ml');
    if (!pCocola) {
      const pRes = await addProduct(cid, {
        name: 'Cocola 150ml',
        display_name: 'Cocola Can 150ml',
        selling_unit: 'Box',
        base_unit: 'Piece',
        pieces_per_unit: 25,
        purchase_price: 250,
        unit_selling_price: 300,
        piece_selling_price: 12.00,
        warehouse_stock_units: 10
      });
      pCocola = pRes.product;
    }

    // Attempting to add duplicate product with same name should be rejected
    let thrown = false;
    try {
      await addProduct(cid, {
        name: 'Cocola 150ml',
        selling_unit: 'Box',
        purchase_price: 250
      });
    } catch (e) {
      thrown = true;
      assert(e.message.includes('already exists'), 'Duplicate product error expected');
    }
    assert(thrown, 'Duplicate product name must be rejected');

    const products = await getProducts(cid);
    const cocolaEntries = products.filter(p => p.name.toLowerCase() === 'cocola 150ml');
    assert(cocolaEntries.length === 1, 'Product catalog must contain exactly 1 Cocola 150ml');
  });

  await test('3. Warehouse Stock Balance — Exactly One Current Stock Row per Product', async () => {
    const wh = await getWarehouseStock(cid);
    const cocolaWh = wh.filter(p => p.id === pCocola.id);
    assert(cocolaWh.length === 1, 'Warehouse stock must return exactly 1 row for Cocola 150ml');
  });

  await test('4. Repeated Driver Allocation — Increments Single Balance without Duplicate Cards', async () => {
    // Receive 50 boxes into warehouse first to ensure ample stock
    await receiveStock(cid, {
      dealer_name: 'Beverage Plant',
      items: [{ product_id: pCocola.id, quantity: 50, unit: 'Box' }]
    });

    const initialStockList = await getEmployeeStock(cid, emp1.id);
    const initialCocola = initialStockList.find(s => s.product_id === pCocola.id);
    const initialQty = initialCocola ? Number(initialCocola.qty_units) : 0;

    // Allocation 1: Allocate 2 Boxes
    await issueStockToEmployee(cid, {
      employee_id: emp1.id,
      items: [{ product_id: pCocola.id, quantity: 2, unit: 'Box' }]
    });

    let driverStock = await getEmployeeStock(cid, emp1.id);
    let cocolaCards = driverStock.filter(s => s.product_id === pCocola.id);
    assert(cocolaCards.length === 1, 'Driver stock has EXACTLY 1 card for Cocola');
    assert(Number(cocolaCards[0].qty_units) === initialQty + 2, 'Driver stock increased by 2');

    // Allocation 2: Allocate another 3 Boxes
    await issueStockToEmployee(cid, {
      employee_id: emp1.id,
      items: [{ product_id: pCocola.id, quantity: 3, unit: 'Box' }]
    });

    driverStock = await getEmployeeStock(cid, emp1.id);
    cocolaCards = driverStock.filter(s => s.product_id === pCocola.id);
    assert(cocolaCards.length === 1, 'Driver stock STILL has exactly 1 card for Cocola (NO DUPLICATES)');
    assert(Number(cocolaCards[0].qty_units) === initialQty + 5, 'Accumulated driver stock is initial + 5');
  });

  await test('5. Allocation Idempotency Protection — Accidental Double Click Prevention', async () => {
    const idempotencyKey = 'ALLOC-REQ-' + Date.now();

    const stockBefore = await getEmployeeStock(cid, emp1.id);
    const cBefore = stockBefore.find(s => s.product_id === pCocola.id);
    const qtyBefore = cBefore ? Number(cBefore.qty_units) : 0;

    // Request 1
    const res1 = await issueStockToEmployee(cid, {
      employee_id: emp1.id,
      client_reference: idempotencyKey,
      items: [{ product_id: pCocola.id, quantity: 1, unit: 'Box' }]
    });
    assert(res1.success === true, 'First allocation succeeds');

    // Request 2 (Duplicate click with same idempotency key)
    const res2 = await issueStockToEmployee(cid, {
      employee_id: emp1.id,
      client_reference: idempotencyKey,
      items: [{ product_id: pCocola.id, quantity: 1, unit: 'Box' }]
    });
    assert(res2.isDuplicate === true, 'Second allocation detected as duplicate');

    // Stock must be qtyBefore + 1, not qtyBefore + 2
    const driverStock = await getEmployeeStock(cid, emp1.id);
    const cocola = driverStock.find(s => s.product_id === pCocola.id);
    assert(Number(cocola.qty_units) === qtyBefore + 1, 'Duplicate allocation prevented');
  });

  await test('6. Repeated Driver Billing — Decrements Single Balance without Duplicate Rows', async () => {
    const rRes = await addRoute(cid, { code: 'R-D' + Date.now().toString().slice(-4), name: 'Duplicate Test Route' });
    route1 = rRes.route || rRes;
    const sRes = await addShop(cid, { name: 'Dup Store ' + Date.now().toString().slice(-4), route_id: route1.id });
    shop1 = sRes.shop;

    const stockBefore = await getEmployeeStock(cid, emp1.id);
    const cBefore = stockBefore.find(s => s.product_id === pCocola.id);
    const qtyBefore = Number(cBefore.qty_units);

    // Bill 1: Sell 2 Boxes
    await createEmployeeSale(cid, emp1.id, 'Tharun', {
      shop_id: shop1.id,
      payment_mode: 'CASH',
      items: [{ product_id: pCocola.id, quantity: 2, unit_type: 'Box', rate: 300 }]
    });

    let driverStock = await getEmployeeStock(cid, emp1.id);
    let cocolaCards = driverStock.filter(s => s.product_id === pCocola.id);
    assert(cocolaCards.length === 1, 'Exactly 1 stock card after Bill 1');
    assert(Number(cocolaCards[0].qty_units) === qtyBefore - 2, 'Remaining driver stock is qtyBefore - 2');

    // Bill 2: Sell 1 Box
    await createEmployeeSale(cid, emp1.id, 'Tharun', {
      shop_id: shop1.id,
      payment_mode: 'CASH',
      items: [{ product_id: pCocola.id, quantity: 1, unit_type: 'Box', rate: 300 }]
    });

    driverStock = await getEmployeeStock(cid, emp1.id);
    cocolaCards = driverStock.filter(s => s.product_id === pCocola.id);
    assert(cocolaCards.length === 1, 'Still exactly 1 stock card after Bill 2 (NO DUPLICATES)');
    assert(Number(cocolaCards[0].qty_units) === qtyBefore - 3, 'Remaining driver stock is qtyBefore - 3');
  });

  await test('7. Bill Idempotency Protection — Double Billing Prevention', async () => {
    const billRef = 'INV-CLIENT-' + Date.now();

    const stockBefore = await getEmployeeStock(cid, emp1.id);
    const cBefore = stockBefore.find(s => s.product_id === pCocola.id);
    const qtyBefore = Number(cBefore.qty_units);

    // Bill Request 1
    const res1 = await createEmployeeSale(cid, emp1.id, 'Tharun', {
      client_reference: billRef,
      shop_id: shop1.id,
      payment_mode: 'CASH',
      items: [{ product_id: pCocola.id, quantity: 1, unit_type: 'Box', rate: 300 }]
    });
    assert(res1.success === true, 'First bill succeeds');

    // Bill Request 2 (Duplicate click with same client reference)
    const res2 = await createEmployeeSale(cid, emp1.id, 'Tharun', {
      client_reference: billRef,
      shop_id: shop1.id,
      payment_mode: 'CASH',
      items: [{ product_id: pCocola.id, quantity: 1, unit_type: 'Box', rate: 300 }]
    });
    assert(res2.isDuplicate === true, 'Second bill detected as duplicate');

    // Stock should be qtyBefore - 1, not qtyBefore - 2
    const driverStock = await getEmployeeStock(cid, emp1.id);
    const cocola = driverStock.find(s => s.product_id === pCocola.id);
    assert(Number(cocola.qty_units) === qtyBefore - 1, 'Duplicate bill deduction avoided');
  });

  await test('8. Stock Ledger Uniqueness — Exactly One Movement per Real Movement', async () => {
    const movements = await getStockMovements(cid, { product_id: pCocola.id });
    assert(movements.length > 0, 'Movements exist');

    // Verify all movement_no values are unique
    const movNos = movements.map(m => m.movement_no);
    const uniqueNos = new Set(movNos);
    assert(movNos.length === uniqueNos.size, 'All stock ledger movement_no values must be strictly unique');
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
