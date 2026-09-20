function calculateSplit(totalAmount, cashInput) {
  const total = Number(Number(totalAmount).toFixed(2));
  let cashVal = Math.max(0, Number(cashInput) || 0);
  if (cashVal > total) {
    cashVal = total; // clamped
  }
  const numCash = Number(cashVal.toFixed(2));
  const numGpay = Number(Math.max(0, total - numCash).toFixed(2));
  const totalPaid = Number((numCash + numGpay).toFixed(2));
  const remaining = Number(Math.max(0, total - totalPaid).toFixed(2));

  return { total, numCash, numGpay, totalPaid, remaining };
}

function testSplitCalculations() {
  console.log('=== TESTING DYNAMIC SPLIT CALCULATIONS ===\n');

  const testCases = [
    { total: 474.70, cash: 0, expGpay: 474.70, expPaid: 474.70, expRem: 0.00 },
    { total: 474.70, cash: 100, expGpay: 374.70, expPaid: 474.70, expRem: 0.00 },
    { total: 474.70, cash: 200, expGpay: 274.70, expPaid: 474.70, expRem: 0.00 },
    { total: 474.70, cash: 300, expGpay: 174.70, expPaid: 474.70, expRem: 0.00 },
    { total: 474.70, cash: 400, expGpay: 74.70, expPaid: 474.70, expRem: 0.00 },
    { total: 474.70, cash: 474.70, expGpay: 0.00, expPaid: 474.70, expRem: 0.00 },
    { total: 474.70, cash: 500, expGpay: 0.00, expPaid: 474.70, expRem: 0.00 }, // clamped
    { total: 1250.50, cash: 250.25, expGpay: 1000.25, expPaid: 1250.50, expRem: 0.00 },
    { total: 93.37, cash: 50, expGpay: 43.37, expPaid: 93.37, expRem: 0.00 }
  ];

  let passed = 0;
  testCases.forEach((tc, idx) => {
    const res = calculateSplit(tc.total, tc.cash);
    console.log(`Test ${idx + 1}: Total = ₹${tc.total}, Cash = ₹${tc.cash}`);
    console.log(`   ➔ GPay: ₹${res.numGpay} (Expected: ₹${tc.expGpay})`);
    console.log(`   ➔ Paid: ₹${res.totalPaid} (Expected: ₹${tc.expPaid})`);
    console.log(`   ➔ Remaining: ₹${res.remaining} (Expected: ₹${tc.expRem})`);

    if (res.numGpay === tc.expGpay && res.totalPaid === tc.expPaid && res.remaining === tc.expRem) {
      console.log('   ✅ PASS\n');
      passed++;
    } else {
      console.error('   ❌ FAIL\n');
      process.exit(1);
    }
  });

  console.log(`\nALL ${passed}/${testCases.length} SPLIT PAYMENT TESTS PASSED!`);
}

testSplitCalculations();
