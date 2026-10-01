import assert from 'assert';

// Standard ESC/POS Command Constants
const ESC = 0x1B;
const GS = 0x1D;
const CMD_INITIALIZE = [ESC, 0x40];
const CMD_ALIGN_CENTER = [ESC, 0x61, 1];
const CMD_BOLD_ON = [ESC, 0x45, 1];

function generateEscPos58mmBuffer(bill) {
  const encoder = new TextEncoder();
  const buffer = [];

  const addBytes = (bytes) => buffer.push(...bytes);
  const addText = (text = '', align = 'LEFT', bold = false) => {
    if (align === 'CENTER') addBytes([ESC, 0x61, 1]);
    else if (align === 'RIGHT') addBytes([ESC, 0x61, 2]);
    else addBytes([ESC, 0x61, 0]);

    if (bold) addBytes([ESC, 0x45, 1]);
    const cleanText = text.replace(/₹/g, 'Rs.').replace(/[^\x20-\x7E\n]/g, ' ');
    addBytes(Array.from(encoder.encode(cleanText)));
    if (bold) addBytes([ESC, 0x45, 0]);
    addBytes([0x0A]);
  };

  const addDashedLine = () => addText('--------------------------------', 'CENTER');
  const addTwoColumnRow = (leftText, rightText, bold = false) => {
    const totalWidth = 32;
    const cleanLeft = String(leftText || '').replace(/₹/g, 'Rs.');
    const cleanRight = String(rightText || '').replace(/₹/g, 'Rs.');
    const maxLeftLen = totalWidth - cleanRight.length - 1;
    const truncatedLeft = cleanLeft.length > maxLeftLen ? cleanLeft.substring(0, maxLeftLen) : cleanLeft;
    const spaceCount = Math.max(1, totalWidth - truncatedLeft.length - cleanRight.length);
    const line = truncatedLeft + ' '.repeat(spaceCount) + cleanRight;
    addText(line, 'LEFT', bold);
  };

  addBytes(CMD_INITIALIZE);
  addText(bill.company_name || 'AVS AGENCIES', 'CENTER', true);
  addDashedLine();
  addTwoColumnRow(`Bill: ${bill.bill_no || 'INV-001'}`, `${bill.sale_date || '2026-10-01'}`, true);
  addTwoColumnRow(`Shop: ${bill.shop_name || 'Hari'}`, '10:30 AM', true);
  addDashedLine();
  addText('ITEM           QTY   RATE    AMT', 'LEFT', true);
  addDashedLine();

  (bill.items || []).forEach(item => {
    const rawName = (item.product_name || 'Item').replace(/₹/g, '');
    const pName = rawName.length > 13 ? rawName.substring(0, 13) : rawName.padEnd(13, ' ');
    const qtyNum = Math.floor(Number(item.qty || 1));
    const qtyStr = String(qtyNum).padStart(4, ' ');
    const rateStr = Number(item.rate || 0).toFixed(2).padStart(6, ' ');
    const amtStr = Number(item.amount || (qtyNum * Number(item.rate || 0))).toFixed(2).padStart(7, ' ');
    addText(`${pName} ${qtyStr} ${rateStr} ${amtStr}`, 'LEFT', false);
  });

  addDashedLine();
  addTwoColumnRow('TOTAL ITEMS:', `${(bill.items || []).length}`, false);
  addTwoColumnRow('BILL TOTAL:', `Rs. ${Number(bill.total_amount || 0).toFixed(2)}`, true);
  addDashedLine();
  addText('Thank You! Visit Again', 'CENTER', true);
  addBytes([0x0A, 0x0A, GS, 0x56, 66, 0]);

  return new Uint8Array(buffer);
}

function testBuffer() {
  const sampleBill = {
    company_name: 'AVS AGENCIES',
    bill_no: 'INV-20261001-001',
    sale_date: '2026-10-01',
    shop_name: 'Hari Stores',
    items: [
      { product_name: 'Aavin Green Milk 500ml', qty: 10, rate: 22.0, amount: 220.0 },
      { product_name: 'Curd 200g Pouch', qty: 5, rate: 15.0, amount: 75.0 }
    ],
    total_amount: 295.0
  };

  const uint8 = generateEscPos58mmBuffer(sampleBill);
  console.log('Generated ESC/POS byte length:', uint8.length);
  assert(uint8.length > 50, 'Buffer should be non-empty and formatted');
  assert.strictEqual(uint8[0], ESC, 'First byte should be ESC (0x1B)');
  assert.strictEqual(uint8[1], 0x40, 'Second byte should be @ (0x40)');
  console.log('✅ ESC/POS 58mm Buffer generation passed all integrity tests!');
}

testBuffer();
