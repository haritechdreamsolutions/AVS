// ============================================================
// AVS AGENCIES - STOCK RECEIVE & INVENTORY INTEGRITY TEST SUITE
// Isolated Database: avs_agencies_test
// ============================================================
import pg from 'pg';
import 'dotenv/config';
import { receiveStock, getWarehouseStock, getStockMovements, addProduct, getProducts, query } from '../db_pg.js';

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
  console.log('=== STOCK RECEIVE & INVENTORY INTEGRITY TEST SUITE ===\n');

  const cid = 1;
  let pCocola, pRasna, pWater;

  await test('1. Setup / Seed Test Products with Custom UOM & Conversions', async () => {
    const prods = await getProducts(cid);
    pCocola = prods.find(p => p.name.toLowerCase() === 'cocola' || p.name.toLowerCase() === 'cocola 150ml');
    if (!pCocola) {
      const cRes = await addProduct(cid, {
        name: 'cocola 150ml',
        display_name: 'cocola 150ml',
        selling_unit: 'Box',
        base_unit: 'Piece',
        pieces_per_unit: 25,
        purchase_price: 250,
        unit_selling_price: 300,
        warehouse_stock_units: 0
      });
      pCocola = cRes.product;
    }

    pRasna = prods.find(p => p.name.toLowerCase() === 'rasna');
    if (!pRasna) {
      const rRes = await addProduct(cid, {
        name: 'Rasna',
        display_name: 'Rasna 50ml',
        selling_unit: 'Case',
        base_unit: 'Piece',
        pieces_per_unit: 30,
        purchase_price: 180,
        unit_selling_price: 210,
        warehouse_stock_units: 0
      });
      pRasna = rRes.product;
    }

    pWater = prods.find(p => p.name.toLowerCase() === 'water 300ml');
    if (!pWater) {
      const wRes = await addProduct(cid, {
        name: 'Water 300ml',
        display_name: 'Water 300ml',
        selling_unit: 'Case',
        base_unit: 'Piece',
        pieces_per_unit: 23,
        purchase_price: 230,
        unit_selling_price: 260,
        warehouse_stock_units: 0
      });
      pWater = wRes.product;
    }

    // Reset warehouse stock for test products cleanly in DB
    await query('UPDATE products SET warehouse_stock_units = 0 WHERE id = ANY($1)', [[pCocola.id, pRasna.id, pWater.id]]);

    assert(pCocola && pRasna && pWater, 'Products found/created in PostgreSQL');
  });

  await test('2. Stock Receive Multi-Product Batch (10 Box Cocola + 10 Case Rasna)', async () => {
    const res = await receiveStock(cid, {
      dealer_name: 'Dairy Plant Supplier',
      reference: 'DC-1049',
      received_by: 'Store Keeper',
      items: [
        { product_id: pCocola.id, quantity: 10, unit: 'Box' },
        { product_id: pRasna.id, quantity: 10, unit: 'Case' }
      ]
    });

    assert(res.success === true, 'receiveStock must succeed');
    assert(res.results.length === 2, '2 items processed');
  });

  await test('3. Verify Warehouse Stock Balance updated in PostgreSQL', async () => {
    const stockList = await getWarehouseStock(cid);
    const stockCocola = stockList.find(p => p.id === pCocola.id);
    const stockRasna = stockList.find(p => p.id === pRasna.id);

    assert(stockCocola, 'Cocola found in warehouse stock');
    assert(Number(stockCocola.warehouse_stock_units) === 10, 'Cocola stock should be 10 Box');
    assert(Number(stockCocola.total_pieces_available) === 250, 'Cocola total pieces should be 10 * 25 = 250');

    assert(stockRasna, 'Rasna found in warehouse stock');
    assert(Number(stockRasna.warehouse_stock_units) === 10, 'Rasna stock should be 10 Case');
    assert(Number(stockRasna.total_pieces_available) === 300, 'Rasna total pieces should be 10 * 30 = 300');
  });

  await test('4. Verify Recent Inventory Movements in PostgreSQL have accurate details', async () => {
    const movs = await getStockMovements(cid, { movement_type: 'INWARD' });
    const movCocola = movs.find(m => m.product_id === pCocola.id);
    const movRasna = movs.find(m => m.product_id === pRasna.id);

    assert(movCocola, 'Inward movement for Cocola must exist');
    assert(movCocola.product_name === pCocola.display_name, 'Product name must match');
    assert(Number(movCocola.qty_units) === 10, 'Quantity units must be 10');
    assert(movCocola.unit === 'Box', 'Unit must be Box');
    assert(movCocola.reference === 'DC-1049', 'Reference DC-1049');

    assert(movRasna, 'Inward movement for Rasna must exist');
    assert(movRasna.product_name === pRasna.display_name, 'Product name must match');
    assert(Number(movRasna.qty_units) === 10, 'Quantity units must be 10');
    assert(movRasna.unit === 'Case', 'Unit must be Case');
  });

  await test('5. Water 300ml — First Receive: 10 Case (230 Pieces)', async () => {
    const res = await receiveStock(cid, {
      dealer_name: 'Aqua Bottlers',
      reference: 'INV-AQUA-01',
      items: [{ product_id: pWater.id, quantity: 10, unit: 'Case' }]
    });
    assert(res.success === true);

    const stockList = await getWarehouseStock(cid);
    const stockWater = stockList.find(p => p.id === pWater.id);
    assert(Number(stockWater.warehouse_stock_units) === 10, 'Water stock should be 10 Case');
    assert(Number(stockWater.total_pieces_available) === 230, 'Water pieces should be 10 * 23 = 230');
  });

  await test('6. Water 300ml — Second Receive (Accumulation): 5 Case (Final: 15 Case, 345 Pieces)', async () => {
    const res = await receiveStock(cid, {
      dealer_name: 'Aqua Bottlers',
      reference: 'INV-AQUA-02',
      items: [{ product_id: pWater.id, quantity: 5, unit: 'Case' }]
    });
    assert(res.success === true);

    const stockList = await getWarehouseStock(cid);
    const stockWater = stockList.find(p => p.id === pWater.id);
    assert(Number(stockWater.warehouse_stock_units) === 15, 'Water stock must accumulate to 15 Case (10 + 5)');
    assert(Number(stockWater.total_pieces_available) === 345, 'Water pieces must accumulate to 15 * 23 = 345');
  });

  await test('7. Validation — Reject 0 and Negative Quantities', async () => {
    let thrown = false;
    try {
      await receiveStock(cid, {
        items: [{ product_id: pWater.id, quantity: 0, unit: 'Case' }]
      });
    } catch (e) {
      thrown = true;
      assert(e.message.includes('Quantity must be greater than 0'));
    }
    assert(thrown, '0 quantity must be rejected');

    thrown = false;
    try {
      await receiveStock(cid, {
        items: [{ product_id: pWater.id, quantity: -5, unit: 'Case' }]
      });
    } catch (e) {
      thrown = true;
      assert(e.message.includes('Quantity must be greater than 0'));
    }
    assert(thrown, 'Negative quantity must be rejected');
  });

  await test('8. Multi-Tenant Company Isolation — Reject Receive for Other Company Product', async () => {
    const otherCid = 2;
    let thrown = false;
    try {
      await receiveStock(otherCid, {
        items: [{ product_id: pWater.id, quantity: 10, unit: 'Case' }]
      });
    } catch (e) {
      thrown = true;
      assert(e.message.includes('Product not found or inactive'));
    }
    assert(thrown, 'Cannot receive stock for another company product');
  });

  await test('9. Atomic Transaction Rollback on Invalid Item in Batch', async () => {
    const beforeStock = await getWarehouseStock(cid);
    const beforeWater = beforeStock.find(p => p.id === pWater.id).warehouse_stock_units;

    let thrown = false;
    try {
      await receiveStock(cid, {
        items: [
          { product_id: pWater.id, quantity: 10, unit: 'Case' },
          { product_id: 999999, quantity: 5, unit: 'Case' }
        ]
      });
    } catch (e) {
      thrown = true;
    }
    assert(thrown, 'Batch with invalid product must fail');

    const afterStock = await getWarehouseStock(cid);
    const afterWater = afterStock.find(p => p.id === pWater.id).warehouse_stock_units;
    assert(Number(beforeWater) === Number(afterWater), 'Stock must rollback completely on error');
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
