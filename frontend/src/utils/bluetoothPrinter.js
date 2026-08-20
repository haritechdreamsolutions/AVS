// Web Bluetooth ESC/POS 58mm Thermal Printer Utility

export const printBillViaBluetooth = async (bill) => {
  if (!navigator.bluetooth) {
    throw new Error("Web Bluetooth API is not supported in this browser. Please use Chrome or Edge.");
  }

  // Standard ESC/POS Command Constants
  const ESC = 0x1B;
  const GS = 0x1D;
  const INITIALIZE = [ESC, 0x40];
  const ALIGN_CENTER = [ESC, 0x61, 1];
  const ALIGN_LEFT = [ESC, 0x61, 0];
  const ALIGN_RIGHT = [ESC, 0x61, 2];
  const BOLD_ON = [ESC, 0x45, 1];
  const BOLD_OFF = [ESC, 0x45, 0];
  const LINE_FEED = [0x0A];
  const CUT_PAPER = [GS, 0x56, 66, 0];

  const encoder = new TextEncoder();

  // Helper to construct ESC/POS Byte Buffer
  let buffer = [];

  const addBytes = (bytes) => {
    buffer.push(...bytes);
  };

  const addText = (text, align = 'LEFT', bold = false) => {
    if (align === 'CENTER') addBytes(ALIGN_CENTER);
    else if (align === 'RIGHT') addBytes(ALIGN_RIGHT);
    else addBytes(ALIGN_LEFT);

    if (bold) addBytes(BOLD_ON);
    addBytes(Array.from(encoder.encode(text)));
    if (bold) addBytes(BOLD_OFF);
    addBytes(LINE_FEED);
  };

  const addLine = () => {
    addText("--------------------------------", 'CENTER');
  };

  // Build ESC/POS Thermal Receipt
  addBytes(INITIALIZE);

  // Header
  addText("AVS DISTRIBUTORS", 'CENTER', true);
  addText("Distribution Management System", 'CENTER');
  addText("Salem, Tamil Nadu | +91 98765 43210", 'CENTER');
  addLine();

  // Bill & Shop Info
  addText(`Bill No: ${bill.bill_no || '#81021'}`, 'LEFT', true);
  addText(`Date: ${bill.date || '08-08-2026'} ${bill.time || '10:45 AM'}`, 'LEFT');
  addText(`Shop: ${bill.shop_name || 'Mani Store #102'}`, 'LEFT', true);
  addText(`Emp: ${bill.employee_name || 'Tharun'} (${bill.vehicle_no || 'TN 32 XX 2222'})`, 'LEFT');
  addLine();

  // Itemized Table Header
  addText("ITEM             QTY   RATE   TOTAL", 'LEFT', true);
  addLine();

  // Items
  const items = bill.items || [
    { product_name: "200ml Milk", qty: 1, rate: 850, amount: 850 },
    { product_name: "Coccola 500ml", qty: 2, rate: 400, amount: 800 }
  ];

  items.forEach(item => {
    const pName = (item.product_name || 'Item').padEnd(14, ' ').substring(0, 14);
    const qty = String(item.qty).padStart(3, ' ');
    const rate = String(item.rate).padStart(6, ' ');
    const amt = String(item.amount).padStart(7, ' ');
    addText(`${pName} ${qty} ${rate} ${amt}`, 'LEFT');
  });

  addLine();

  // Totals & Payment
  addText(`TOTAL AMOUNT: RS. ${bill.total_amount || 1650}`, 'RIGHT', true);
  addText(`PAYMENT MODE: ${bill.payment_mode || 'SPLIT'}`, 'RIGHT', true);

  if (bill.cash_paid > 0) addText(`Cash Paid: RS. ${bill.cash_paid}`, 'RIGHT');
  if (bill.gpay_paid > 0) addText(`GPay Paid: RS. ${bill.gpay_paid}`, 'RIGHT');
  if (bill.credit_paid > 0) addText(`Credit Due: RS. ${bill.credit_paid}`, 'RIGHT');

  addLine();
  addText("Thank You! Visit Again", 'CENTER', true);
  addText("AVS POS System", 'CENTER');
  addBytes(LINE_FEED);
  addBytes(LINE_FEED);
  addBytes(LINE_FEED);
  addBytes(CUT_PAPER);

  // Connect to Bluetooth Thermal Printer Device
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      '00001101-0000-1000-8000-00805f9b34fb', // Standard Serial Port Profile (SPP)
      '000018f0-0000-1000-8000-00805f9b34fb', // Thermal Printer Service
      '49535343-fe7d-4ae5-8fa9-9fafd205e455'
    ]
  });

  const server = await device.gatt.connect();

  // Find Bluetooth Characteristic for ESC/POS Binary Write
  let targetCharacteristic = null;
  const services = await server.getPrimaryServices();

  for (const service of services) {
    const characteristics = await service.getCharacteristics();
    for (const char of characteristics) {
      if (char.properties.write || char.properties.writeWithoutResponse) {
        targetCharacteristic = char;
        break;
      }
    }
    if (targetCharacteristic) break;
  }

  if (!targetCharacteristic) {
    throw new Error("Could not find writable Bluetooth characteristic for thermal printer.");
  }

  // Send Data in 100-byte Chunks
  const uint8Array = new Uint8Array(buffer);
  const chunkSize = 100;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    if (targetCharacteristic.properties.writeWithoutResponse) {
      await targetCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await targetCharacteristic.writeValue(chunk);
    }
  }

  return true;
};
