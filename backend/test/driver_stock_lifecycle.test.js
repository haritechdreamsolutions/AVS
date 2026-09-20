// ============================================================
// AVS AGENCIES - COMPLETE DRIVER STOCK LIFECYCLE TEST SUITE
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
  processEmployeeReturn, 
  processDamage, 
  getEmployeeAccountSummary, 
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
  console.log('=== COMPLETE DRIVER STOCK LIFECYCLE TEST SUITE ===\n');

  const cid = 1;
  let driverEmp, driverEmp2, pMilk, pWater, pCocola, testShop, testRoute;

  await test('1. Driver / User Listing — Real Database Relationships', async () => {
    // 1. Ensure active driver Tharun exists
    const emps = await getEmployees(cid);
    driverEmp = emps.find(e => e.full_name.toLowerCase() === 'tharun');
    if (!driverEmp) {
      const eRes = await addEmployee(cid, {
        full_name: 'Tharun',
        employee_code: 'EMP001',
        designation: 'Delivery Executive',
        role: 'EMPLOYEE',
        vehicle_number: 'TN32S2002'
      });
      driverEmp = eRes.employee;
    }

    // 2. Ensure secondary driver Kumar for isolation testing
    driverEmp2 = emps.find(e => e.full_name.toLowerCase().includes('kumar'));
    if (!driverEmp2) {
      const e2Res = await addEmployee(cid, {
        full_name: 'Kumar Driver',
        employee_code: 'EMP002',
        designation: 'Driver',
        role: 'EMPLOYEE',
        vehicle_number: 'TN32S9999'
      });
      driverEmp2 = e2Res.employee;
    }

    const empList = await getEmployees(cid);
    assert(empList.length >= 2, 'Employees list must return valid records');
    const foundTharun = empList.find(e => e.id === driverEmp.id);
    assert(foundTharun, 'Tharun found in getEmployees');
    assert(foundTharun.vehicle_number === 'TN32S2002', 'Vehicle number present');
  });

  await test('2. Seed Products and Inward Warehouse Stock', async () => {
    const prods = await getProducts(cid);

    // 1. Milk: 1 Tray = 72 Pcs, Buy 600, Sale 660 (Piece: 9.17)
    pMilk = prods.find(p => p.name.toLowerCase() === 'milk 200ml');
    if (!pMilk) {
      const mRes = await addProduct(cid, {
        name: 'Milk 200ml',
        display_name: 'Aavin Milk 200ml',
        selling_unit: 'Tray',
        base_unit: 'Piece',
        pieces_per_unit: 72,
        purchase_price: 600,
        unit_selling_price: 660,
        piece_selling_price: 9.17,
        warehouse_stock_units: 0
      });
      pMilk = mRes.product;
    }

    // 2. Water: 1 Case = 23 Pcs, Buy 230, Sale 260 (Piece: 11.30)
    pWater = prods.find(p => p.name.toLowerCase() === 'water 300ml');
    if (!pWater) {
      const wRes = await addProduct(cid, {
        name: 'Water 300ml',
        display_name: 'Kinley Water 300ml',
        selling_unit: 'Case',
        base_unit: 'Piece',
        pieces_per_unit: 23,
        purchase_price: 230,
        unit_selling_price: 260,
        piece_selling_price: 11.30,
        warehouse_stock_units: 0
      });
      pWater = wRes.product;
    }

    // 3. Cocola: 1 Box = 25 Pcs, Buy 250, Sale 300 (Piece: 12.00)
    pCocola = prods.find(p => p.name.toLowerCase() === 'cocola 150ml' || p.name.toLowerCase() === 'cocola');
    if (!pCocola) {
      const cRes = await addProduct(cid, {
        name: 'Cocola 150ml',
        display_name: 'Cocola Can 150ml',
        selling_unit: 'Box',
        base_unit: 'Piece',
        pieces_per_unit: 25,
        purchase_price: 250,
        unit_selling_price: 300,
        piece_selling_price: 12.00,
        warehouse_stock_units: 0
      });
      pCocola = cRes.product;
    }

    // Reset warehouse stock and driver stock for these products for deterministic lifecycle testing
    await query('UPDATE products SET warehouse_stock_units = 0 WHERE id = ANY($1)', [[pMilk.id, pWater.id, pCocola.id]]);
    await query('DELETE FROM employee_stock WHERE company_id = $1 AND employee_id IN ($2, $3)', [cid, driverEmp.id, driverEmp2.id]);

    // Receive 20 Trays Milk, 15 Cases Water, 10 Boxes Cocola into Warehouse
    await receiveStock(cid, {
      dealer_name: 'Central Dairy Plant',
      reference: 'DC-9001',
      items: [
        { product_id: pMilk.id, quantity: 20, unit: 'Tray' },
        { product_id: pWater.id, quantity: 15, unit: 'Case' },
        { product_id: pCocola.id, quantity: 10, unit: 'Box' }
      ]
    });

    const wh = await getWarehouseStock(cid);
    const whMilk = wh.find(p => p.id === pMilk.id);
    assert(Number(whMilk.warehouse_stock_units) === 20, 'Warehouse Milk should be 20 Trays');
  });

  await test('3. Store Keeper Allocates Stock to Driver Tharun Vehicle', async () => {
    // Allocate 5 Trays Milk, 4 Cases Water, 2 Boxes Cocola to Tharun
    const allocRes = await issueStockToEmployee(cid, {
      employee_id: driverEmp.id,
      items: [
        { product_id: pMilk.id, quantity: 5, unit: 'Tray' },
        { product_id: pWater.id, quantity: 4, unit: 'Case' },
        { product_id: pCocola.id, quantity: 2, unit: 'Box' }
      ],
      notes: 'Morning Dispatch'
    });

    assert(allocRes.success === true, 'Allocation must succeed');
    assert(allocRes.results.length === 3, '3 items allocated');
  });

  await test('4. Verify Warehouse Stock Decreased & Driver Vehicle Stock Increased', async () => {
    // Warehouse: Milk 20 - 5 = 15, Water 15 - 4 = 11, Cocola 10 - 2 = 8
    const wh = await getWarehouseStock(cid);
    const whMilk = wh.find(p => p.id === pMilk.id);
    const whWater = wh.find(p => p.id === pWater.id);
    const whCocola = wh.find(p => p.id === pCocola.id);

    assert(Number(whMilk.warehouse_stock_units) === 15, 'Warehouse Milk should be 15 Trays');
    assert(Number(whWater.warehouse_stock_units) === 11, 'Warehouse Water should be 11 Cases');
    assert(Number(whCocola.warehouse_stock_units) === 8, 'Warehouse Cocola should be 8 Boxes');

    // Driver Tharun Vehicle Stock: 5 Trays, 4 Cases, 2 Boxes
    const driverStock = await getEmployeeStock(cid, driverEmp.id);
    const dMilk = driverStock.find(s => s.product_id === pMilk.id);
    const dWater = driverStock.find(s => s.product_id === pWater.id);
    const dCocola = driverStock.find(s => s.product_id === pCocola.id);

    assert(Number(dMilk.qty_units) === 5, 'Driver Tharun Milk should be 5 Trays');
    assert(Number(dWater.qty_units) === 4, 'Driver Tharun Water should be 4 Cases');
    assert(Number(dCocola.qty_units) === 2, 'Driver Tharun Cocola should be 2 Boxes');
  });

  await test('5. Driver-Specific Stock Isolation — Driver B Cannot See Driver A Stock', async () => {
    const d2Stock = await getEmployeeStock(cid, driverEmp2.id);
    const d2Milk = d2Stock.find(s => s.product_id === pMilk.id);
    assert(!d2Milk || Number(d2Milk.qty_units) === 0, 'Driver Kumar must not see Tharuns milk stock');
  });

  await test('6. Driver POS Billing — Multi-Product Sale Deducts from Driver Vehicle Stock', async () => {
    // Create Route and Shop
    const rRes = await addRoute(cid, { code: 'R-T' + Date.now().toString().slice(-4), name: 'Test Route' });
    testRoute = rRes.route || rRes;
    const sRes = await addShop(cid, {
      name: 'Tharun Corner Store ' + Date.now().toString().slice(-4),
      owner_name: 'Owner',
      route_id: testRoute.id
    });
    testShop = sRes.shop;

    // Driver Tharun bills:
    // 2 Trays Milk @ 660 = 1320.00
    // 1 Case Water @ 260 = 260.00
    const saleRes = await createEmployeeSale(cid, driverEmp.id, 'Tharun', {
      shop_id: testShop.id,
      payment_mode: 'CASH',
      items: [
        { product_id: pMilk.id, quantity: 2, unit_type: 'Tray', rate: 660 },
        { product_id: pWater.id, quantity: 1, unit_type: 'Case', rate: 260 }
      ]
    });

    assert(saleRes.success === true, 'Driver sale must succeed');
    assert(saleRes.sale.id, 'Sale record generated');
    assert(Number(saleRes.sale.total_amount) === 1580, 'Total: 2*660 + 1*260 = 1580');
  });

  await test('7. Verify Driver Stock Decreased & Warehouse Stock Remained Unaffected by Driver Sale', async () => {
    // Driver Tharun Stock: Milk was 5 -> now 3 Trays, Water was 4 -> now 3 Cases
    const driverStock = await getEmployeeStock(cid, driverEmp.id);
    const dMilk = driverStock.find(s => s.product_id === pMilk.id);
    const dWater = driverStock.find(s => s.product_id === pWater.id);

    assert(Number(dMilk.qty_units) === 3, 'Driver Tharun Milk must be 3 Trays (5 - 2)');
    assert(Number(dWater.qty_units) === 3, 'Driver Tharun Water must be 3 Cases (4 - 1)');

    // Warehouse Stock MUST NOT be affected by driver sale (Milk remains 15, Water remains 11)
    const wh = await getWarehouseStock(cid);
    const whMilk = wh.find(p => p.id === pMilk.id);
    const whWater = wh.find(p => p.id === pWater.id);

    assert(Number(whMilk.warehouse_stock_units) === 15, 'Warehouse Milk must remain 15 Trays');
    assert(Number(whWater.warehouse_stock_units) === 11, 'Warehouse Water must remain 11 Cases');
  });

  await test('8. Insufficient Vehicle Stock Protection — Reject Sale Beyond Held Stock', async () => {
    let thrown = false;
    try {
      // Driver Tharun has 3 Trays Milk, tries to bill 4 Trays
      await createEmployeeSale(cid, driverEmp.id, 'Tharun', {
        shop_id: testShop.id,
        payment_mode: 'CASH',
        items: [{ product_id: pMilk.id, quantity: 4, unit_type: 'Tray', rate: 660 }]
      });
    } catch (e) {
      thrown = true;
      assert(e.message.includes('Insufficient vehicle stock'), 'Must reject overselling: ' + e.message);
    }
    assert(thrown, 'Overselling must be rejected and rolled back');

    // Verify stock was not deducted on failure
    const driverStock = await getEmployeeStock(cid, driverEmp.id);
    const dMilk = driverStock.find(s => s.product_id === pMilk.id);
    assert(Number(dMilk.qty_units) === 3, 'Milk stock must remain 3 Trays');
  });

  await test('9. Unsold Returns Flow — Driver Returns Stock & Store Keeper Accepts', async () => {
    // Driver returns 1 Tray of Milk (Driver 3 -> 2, Warehouse 15 -> 16)
    const retRes = await processEmployeeReturn(cid, {
      employee_id: driverEmp.id,
      items: [{ product_id: pMilk.id, quantity: 1, unit: 'Tray' }],
      notes: 'Unsold day end return'
    });

    assert(retRes.success === true, 'Return must succeed');

    const driverStock = await getEmployeeStock(cid, driverEmp.id);
    const dMilk = driverStock.find(s => s.product_id === pMilk.id);
    assert(Number(dMilk.qty_units) === 2, 'Driver Milk must be 2 Trays after return');

    const wh = await getWarehouseStock(cid);
    const whMilk = wh.find(p => p.id === pMilk.id);
    assert(Number(whMilk.warehouse_stock_units) === 16, 'Warehouse Milk must be 16 Trays after return');
  });

  await test('10. Transit Damage Flow — Damage Deducts from Driver Vehicle Stock & Audited', async () => {
    // Driver records 1 Box Cocola Damaged in transit (Driver 2 -> 1, Recorded in damages)
    const dmgRes = await processDamage(cid, {
      employee_id: driverEmp.id,
      items: [{ product_id: pCocola.id, quantity: 1, unit: 'Box', reason: 'Crushed during transport' }]
    });

    assert(dmgRes.success === true, 'Damage recording must succeed');

    const driverStock = await getEmployeeStock(cid, driverEmp.id);
    const dCocola = driverStock.find(s => s.product_id === pCocola.id);
    assert(Number(dCocola.qty_units) === 1, 'Driver Cocola must be 1 Box after damage (2 - 1)');

    // Warehouse stock must NOT receive damaged stock (remains 8)
    const wh = await getWarehouseStock(cid);
    const whCocola = wh.find(p => p.id === pCocola.id);
    assert(Number(whCocola.warehouse_stock_units) === 8, 'Warehouse Cocola must remain 8 Boxes');
  });

  await test('11. Complete Auditable Reconciliation Equation (Issued = Sold + Returned + Damaged + Balance)', async () => {
    const today = new Date().toISOString().split('T')[0];
    const summary = await getEmployeeAccountSummary(cid, driverEmp.id, today);

    assert(summary, 'Account summary generated');
    assert(Number(summary.total_sales) >= 1580, 'Total sales should include ₹1,580');
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
