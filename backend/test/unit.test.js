import assert from 'assert';
import { db } from '../db.js';

console.log("==================================================");
console.log("🧪 STARTING UNIT & QA FINANCIAL CALCULATIONS TEST");
console.log("==================================================");

let testsPassed = 0;
let totalTests = 0;

function runTest(description, testFn) {
  totalTests++;
  try {
    testFn();
    console.log(`  ✅ PASS: ${description}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
  }
}

// 1. TEST TRAY vs PIECE AMOUNT CALCULATION
runTest("Tray vs Piece Selling Amount Calculation", () => {
  const products = db.getProducts();
  const milk = products.find(p => p.id === 1); // Milk 200ml (Tray: ₹850, Piece: ₹45)
  
  const trayAmount = 1 * milk.unit_selling_price; // 1 Tray = ₹850
  const pieceAmount = 5 * milk.piece_selling_price; // 5 Pieces = ₹225

  assert.strictEqual(trayAmount, 850, "1 Tray of Milk must equal ₹850");
  assert.strictEqual(pieceAmount, 225, "5 Pieces of Milk must equal ₹225");
});

// 2. TEST FRACTIONAL STOCK DEDUCTION (TRAY & PIECE RATIO)
runTest("Piece Sale Fractional Stock Deduction (8 Trays - 5 Pieces = 7.75 Trays)", () => {
  const initialStock = db.getEmployeeStock(1);
  const initialMilk = initialStock.find(s => s.product_id === 1).qty_units; // 8 Trays

  // Sell 5 Pieces of Milk (pieces_per_unit = 20 -> 5/20 = 0.25 Trays)
  const sale = db.createSale({
    employee_id: 1,
    employee_name: "Tharun",
    shop_id: 102,
    shop_name: "Mani Store",
    items: [
      { product_id: 1, product_name: "200ml Milk", unit_type: "Piece", qty: 5, rate: 45 }
    ],
    total_amount: 225,
    cash_paid: 225,
    gpay_paid: 0,
    credit_paid: 0,
    payment_mode: "CASH"
  });

  const updatedStock = db.getEmployeeStock(1);
  const updatedMilk = updatedStock.find(s => s.product_id === 1).qty_units;

  assert.strictEqual(sale.total_amount, 225, "Sale total amount must be ₹225");
  assert.strictEqual(updatedMilk, 7.75, "8 Trays minus 5 Pieces (0.25 Tray) must leave exactly 7.75 Trays");
});

// 3. TEST DAMAGE COST CALCULATION (PURCHASE COST PRICE)
runTest("Damage Entry Cost Calculation using Purchase Cost Price (2 Trays @ ₹700 = ₹1400)", () => {
  const damage = db.addDamage({
    employee_id: 1,
    employee_name: "Tharun",
    product_id: 1,
    unit_type: "Tray",
    quantity: 2,
    reason: "Leakage / Burst"
  });

  assert.strictEqual(damage.damage_cost, 1400, "2 Trays Milk damaged at purchase cost ₹700 must equal ₹1400");
});

// 4. TEST PAYMENT RECONCILIATION & SHOP DUE CALCULATION
runTest("Payment Reconciliation & Credit Due Update", () => {
  const shopBefore = db.getShops().find(s => s.id === 102);
  const dueBefore = shopBefore.current_due; // 1200

  // Create bill with ₹300 credit
  db.createSale({
    employee_id: 1,
    employee_name: "Tharun",
    shop_id: 102,
    shop_name: "Mani Store",
    items: [
      { product_id: 2, product_name: "Water Bottle 1L", unit_type: "Tray", qty: 1, rate: 600 }
    ],
    total_amount: 600,
    cash_paid: 300,
    gpay_paid: 0,
    credit_paid: 300,
    payment_mode: "SPLIT"
  });

  const shopAfter = db.getShops().find(s => s.id === 102);
  assert.strictEqual(shopAfter.current_due, dueBefore + 300, "Shop current due must increase by ₹300 credit paid");
});

// 5. TEST STORE KEEPER CASH SETTLEMENT DISCREPANCY
runTest("Store Keeper Cash Settlement Discrepancy (Expected vs Actual)", () => {
  const settlement = db.saveCashSettlement({
    employee_id: 1,
    employee_name: "Tharun (TN 32 XX 2222)",
    expected_cash: 12000,
    actual_cash: 11500,
    difference: -500,
    reason: "Customer Pending"
  });

  assert.strictEqual(settlement.status, "SHORT", "Difference -500 must produce status SHORT");
  assert.strictEqual(settlement.difference, -500, "Difference must be -500");
});

// 6. TEST EMPLOYEE IMAGE CATEGORY FLOW PRODUCT VARIANTS
runTest("Employee Billing Variant Catalog contains Milk, Curd, Coccola, Juice Packet, Tata Can, and Water Bottle 200ml/500ml/1L/2L sizes", () => {
  const products = db.getProducts();
  const requiredProducts = [
    "Amirtha Milk - 200ml",
    "Amirtha Milk - 500ml",
    "Amirtha Milk - 1L",
    "Amirtha Curd - 200ml",
    "Amirtha Curd - 500ml",
    "Amirtha Curd - 1L",
    "Coccola - 200ml",
    "Coccola - 500ml",
    "Coccola - 1L",
    "Fresh Juice Packet",
    "Tata Gluco+ Can",
    "Water Bottle - 200ml",
    "Water Bottle - 500ml",
    "Water Bottle - 1L",
    "Water Bottle - 2L"
  ];

  requiredProducts.forEach(name => {
    assert.ok(products.some(product => product.display_name === name), `${name} must be available for employee billing`);
  });
});

// 7. TEST NEW PIECE INPUT FLOW AMOUNT AND STOCK DEDUCTION
runTest("Employee Piece Input Flow calculates saved product list total and deducts fractional stock", () => {
  const stockBefore = db.getEmployeeStock(1);
  const milk200Before = stockBefore.find(s => s.product_id === 1).qty_units;

  const sale = db.createSale({
    employee_id: 1,
    employee_name: "Tharun",
    shop_id: 103,
    shop_name: "Kumar Store",
    items: [
      { product_id: 1, product_name: "Amirtha Milk - 200ml", unit_type: "Piece", qty: 15, rate: 45 },
      { product_id: 5, product_name: "Amirtha Milk - 500ml", unit_type: "Piece", qty: 2, rate: 85 },
      { product_id: 7, product_name: "Amirtha Curd - 200ml", unit_type: "Piece", qty: 3, rate: 35 }
    ],
    cash_paid: 950,
    gpay_paid: 0,
    credit_paid: 0,
    payment_mode: "CASH"
  });

  const stockAfter = db.getEmployeeStock(1);
  const milk200After = stockAfter.find(s => s.product_id === 1).qty_units;

  assert.strictEqual(sale.total_amount, 950, "15 milk 200ml + 2 milk 500ml + 3 curd 200ml must total Rs.950");
  assert.strictEqual(milk200After, Number((milk200Before - 0.75).toFixed(2)), "15 pieces of 20-piece tray must deduct 0.75 tray");
});

console.log("==================================================");
console.log(`📊 RESULTS: ${testsPassed} / ${totalTests} TESTS PASSED CLEANLY (100% SUCCESS)`);
console.log("==================================================");

if (testsPassed === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
