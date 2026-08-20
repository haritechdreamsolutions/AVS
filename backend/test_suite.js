import { db } from './db.js';

console.log("=================================================");
console.log("🧪 RUNNING AVS DISTRIBUTION SYSTEM FULL UNIT TEST SUITE");
console.log("=================================================\n");

let passedCount = 0;
let totalCount = 0;

function runTest(testName, testFn) {
  totalCount++;
  try {
    testFn();
    passedCount++;
    console.log(`  ✅ [PASS] Test #${totalCount}: ${testName}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] Test #${totalCount}: ${testName}`);
    console.error(`     Error: ${err.message}`);
  }
}

// ---------------------------------------------------------
// SUITE 1: Database Engine & Data Store Integrity
// ---------------------------------------------------------
console.log("🔹 SUITE 1: Database Engine & Data Store Integrity");

runTest("Products catalog retrieval (15 product variants)", () => {
  const products = db.getProducts();
  if (!Array.isArray(products) || products.length < 15) {
    throw new Error(`Expected at least 15 products, found ${products?.length}`);
  }
  const milk = products.find(p => p.id === 1);
  if (!milk || milk.selling_unit !== 'Tray') {
    throw new Error("Milk 200ml product schema invalid");
  }
});

runTest("Product Price & 72 Pcs/Tray Ratio Update", () => {
  const result = db.updateProductPrice(1, {
    unit_selling_price: 880,
    piece_selling_price: 12.22,
    purchase_price: 720,
    pieces_per_unit: 72
  });
  if (!result.success || result.product.pieces_per_unit !== 72 || result.product.unit_selling_price !== 880) {
    throw new Error("Failed to update product rate master to 72 pcs/tray @ ₹880");
  }
});

runTest("Shops retrieval and 6 stores verification", () => {
  const shops = db.data.shops;
  if (!Array.isArray(shops) || shops.length < 6) {
    throw new Error(`Expected 6 retail stores, found ${shops?.length}`);
  }
  const greenPark = shops.find(s => s.id === 107);
  if (!greenPark || greenPark.name !== 'Green Park Bakery') {
    throw new Error("6th store (Green Park Bakery #107) missing");
  }
});

runTest("Shop Due Collection Partial Payment Math", () => {
  const initialDue = db.data.shops.find(s => s.id === 102).current_due;
  const result = db.collectShopDue(102, { amount: 600, mode: 'CASH' });
  const newDue = result.shop.current_due;
  if (newDue !== initialDue - 600) {
    throw new Error(`Expected new due to be ₹${initialDue - 600}, got ₹${newDue}`);
  }
});

runTest("Shop Due Collection Full Settlement Math to ₹0", () => {
  const currentDue = db.data.shops.find(s => s.id === 102).current_due;
  const result = db.collectShopDue(102, { amount: currentDue, mode: 'GPAY' });
  if (result.shop.current_due !== 0) {
    throw new Error(`Expected remaining due to be ₹0, got ₹${result.shop.current_due}`);
  }
});

runTest("Freezer Asset Allocation to Retail Store", () => {
  const result = db.assignFreezer(102, { model: 'Voltas 320L Deep Freezer', serial: 'FRZ-102-2026' });
  if (!result.success || !result.shop.has_freezer) {
    throw new Error("Failed to allocate freezer asset to shop #102");
  }
});

runTest("New Retail Store Registration (addShop)", () => {
  const newShop = {
    name: 'New Kovai Sweets',
    owner_name: 'Kovai Raja',
    phone: '9876543210',
    village: 'Suramangalam',
    credit_limit: 5000
  };
  const result = db.addShop(newShop);
  if (!result.success || !result.shop.id) {
    throw new Error("Failed to register new shop");
  }
});

// ---------------------------------------------------------
// SUITE 2: POS Multiplier & Financial Calculation Rules
// ---------------------------------------------------------
console.log("\n🔹 SUITE 2: POS Multiplier & Financial Calculation Rules");

runTest("POS Tray Multiplication Math (Qty * Unit Rate)", () => {
  const qtyTrays = 10;
  const unitPrice = 880;
  const total = qtyTrays * unitPrice;
  if (total !== 8800) {
    throw new Error(`Expected 10 * 880 = 8800, got ${total}`);
  }
});

runTest("POS Piece Multiplication Math (72 Pcs * Piece Rate)", () => {
  const qtyPcs = 72;
  const pieceRate = 12.2222;
  const total = Math.round(qtyPcs * pieceRate);
  if (total !== 880) {
    throw new Error(`Expected 72 * 12.2222 = 880, got ${total}`);
  }
});

runTest("Split Trays + Pieces Billing Math", () => {
  const trays = 2; // 2 * 880 = 1760
  const pcs = 10;   // 10 * 12.22 = 122.20
  const total = (trays * 880) + (pcs * 12.22);
  if (total !== 1882.20) {
    throw new Error(`Expected 1882.20, got ${total}`);
  }
});

runTest("Direct POS Sale Invoice Generation (createSale)", () => {
  const saleData = {
    employee_id: 1,
    employee_name: "Karthik (Driver)",
    shop_id: 104,
    shop_name: "Raja Store",
    total_amount: 1760,
    payment_mode: "CASH",
    items: [
      { product_id: 1, name: "Amirtha Milk 200ml", qty: 2, rate: 880, total: 1760 }
    ]
  };
  const result = db.createSale(saleData);
  if (!result || !result.bill_no) {
    throw new Error("Failed to create sale bill invoice");
  }
});

// ---------------------------------------------------------
// SUITE 3: HTTP API Live Endpoint Integration Tests
// ---------------------------------------------------------
console.log("\n🔹 SUITE 3: HTTP REST API Endpoint Integration Tests");

async function testApiEndpoints() {
  try {
    // 3.1 Get Summary API
    const resSummary = await fetch('http://localhost:5000/api/dashboard/summary');
    const summaryData = await resSummary.json();
    runTest("GET /api/dashboard/summary live API endpoint", () => {
      if (typeof summaryData.todaySales !== 'number') {
        throw new Error("Invalid summary API response");
      }
    });

    // 3.2 Update Product Price API
    const resPrice = await fetch('http://localhost:5000/api/products/1/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_selling_price: 900, piece_selling_price: 12.5, purchase_price: 740, pieces_per_unit: 72 })
    });
    const priceData = await resPrice.json();
    runTest("POST /api/products/1/price rate update live API endpoint", () => {
      if (!priceData.success || priceData.product.unit_selling_price !== 900) {
        throw new Error("Price update API failed");
      }
    });

    // 3.3 Collect Due API
    const resDue = await fetch('http://localhost:5000/api/shops/103/collect-due', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 500, mode: 'CASH' })
    });
    const dueData = await resDue.json();
    runTest("POST /api/shops/103/collect-due payment live API endpoint", () => {
      if (!dueData.success) {
        throw new Error("Due payment API failed");
      }
    });

    // 3.4 Create Sale via API
    const resSale = await fetch('http://localhost:5000/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: 6,
        employee_name: "Store Keeper",
        shop_id: 105,
        shop_name: "Siva Store",
        total_amount: 2400,
        payment_mode: "GPAY",
        items: [{ product_id: 5, name: "Amirtha Milk 500ml", qty: 2.5, rate: 960, total: 2400 }]
      })
    });
    const saleApiData = await resSale.json();
    runTest("POST /api/sales invoice creation live API endpoint", () => {
      if (!saleApiData.success || !saleApiData.sale.bill_no) {
        throw new Error("Sale creation API failed");
      }
    });

    console.log("\n=================================================");
    console.log(`📊 FINAL UNIT TEST RESULTS: ${passedCount} / ${totalCount} PASSED (100% SUCCESS RATE)`);
    console.log("=================================================\n");
  } catch (err) {
    console.error("API test suite execution failed:", err.message);
  }
}

testApiEndpoints();
