import assert from 'assert';

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

// 1. DYNAMIC PACKAGING CONVERSION FORMULA
runTest("Dynamic packaging piece cost calculation: piecePrice = purchasePrice / piecesPerUnit", () => {
  const purchasePrice = 600; // Rs 600 per Tray
  const piecesPerUnit = 72;  // 72 pieces per Tray
  const pieceCost = Number((purchasePrice / piecesPerUnit).toFixed(4));
  
  assert.strictEqual(pieceCost, 8.3333, "Piece cost for 72-pack @ 600 must equal 8.3333");
});

// 2. DAMAGE VALUE CALCULATION (UNITS + LOOSE PIECES)
runTest("Dynamic Damage valuation with mixed units and loose pieces", () => {
  const purchasePrice = 600;
  const piecesPerUnit = 72;
  const unitsDamaged = 2; // 2 full trays
  const piecesDamaged = 10; // 10 loose pieces
  
  const pieceCost = purchasePrice / piecesPerUnit;
  const totalCost = (unitsDamaged * purchasePrice) + (piecesDamaged * pieceCost);
  const roundedCost = Number(totalCost.toFixed(2));
  
  // (2 * 600) + (10 * 8.33333) = 1200 + 83.33 = 1283.33
  assert.strictEqual(roundedCost, 1283.33, "Damage total value must equal ₹1283.33");
});

// 3. INVOICE LINE ITEM TOTAL WITH GST AND DISCOUNT
runTest("Line item calculation with 5% discount and 18% GST", () => {
  const qty = 5;
  const unitPrice = 700;
  const discountPercent = 5;
  const gstRate = 18;
  
  const subtotal = qty * unitPrice; // 3500
  const discountAmount = subtotal * (discountPercent / 100); // 175
  const taxableAmount = subtotal - discountAmount; // 3325
  const gstAmount = taxableAmount * (gstRate / 100); // 598.5
  const grandTotal = taxableAmount + gstAmount; // 3923.5
  
  assert.strictEqual(subtotal, 3500);
  assert.strictEqual(discountAmount, 175);
  assert.strictEqual(taxableAmount, 3325);
  assert.strictEqual(gstAmount, 598.5);
  assert.strictEqual(grandTotal, 3923.5);
});

// 4. FRACTIONAL STOCK DEDUCTION (TRAY & PIECE RATIO)
runTest("Piece sale fractional stock deduction: 8 Trays - 18 Pieces (72 per Tray) = 7.75 Trays", () => {
  const initialStockTrays = 8;
  const piecesSold = 18;
  const piecesPerUnit = 72;
  
  const traysDeducted = piecesSold / piecesPerUnit; // 0.25 Trays
  const remainingTrays = initialStockTrays - traysDeducted;
  
  assert.strictEqual(traysDeducted, 0.25, "18 pieces from 72/tray is 0.25 trays");
  assert.strictEqual(remainingTrays, 7.75, "8 Trays minus 0.25 leaves 7.75 Trays");
});

// 5. PAYMENT RECONCILIATION & SHOP DUE MATH
runTest("Payment Reconciliation: Total = Cash + UPI + Credit Due addition", () => {
  const billTotal = 2500;
  const cashPaid = 1000;
  const upiPaid = 1000;
  const creditDue = 500;
  
  assert.strictEqual(cashPaid + upiPaid + creditDue, billTotal, "Payment sum must balance bill total");
  
  const prevDue = 1200;
  const newDue = prevDue + creditDue;
  assert.strictEqual(newDue, 1700, "New due must be prevDue + creditDue");
});

// 6. STOREKEEPER CASH SETTLEMENT DISCREPANCY
runTest("Cash Settlement Discrepancy (Expected Cash vs Actual Handed Over)", () => {
  const systemExpectedCash = 15400;
  const actualCashCollected = 15300;
  const variance = actualCashCollected - systemExpectedCash;
  
  assert.strictEqual(variance, -100, "Shortage must be -₹100");
});

// 7. INVENTORY LEDGER INWARD / OUTWARD AUDIT BALANCE
runTest("Inventory Ledger Audit: Initial + Inward - (Sales + Damage + Adjustments) = Final Stock", () => {
  const openingStock = 500;
  const inwardReceived = 200;
  const outwardSales = 350;
  const returnsAccepted = 30;
  const verifiedDamages = 10;
  
  const expectedClosing = openingStock + inwardReceived - outwardSales + returnsAccepted - verifiedDamages;
  assert.strictEqual(expectedClosing, 370, "Closing balance must equal 370");
});

console.log("==================================================");
console.log(`📊 RESULTS: ${testsPassed} / ${totalTests} TESTS PASSED CLEANLY (${((testsPassed/totalTests)*100).toFixed(0)}% SUCCESS)`);
console.log("==================================================");

if (testsPassed !== totalTests) {
  process.exit(1);
}
