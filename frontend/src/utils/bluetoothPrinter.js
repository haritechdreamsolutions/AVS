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
  const companyName = bill.company_name || 'AVS AGENCIES';
  const companySubtitle = bill.company_subtitle || 'Agencies Management System';
  addText(companyName, 'CENTER', true);
  addText(companySubtitle, 'CENTER');
  addText("Salem, Tamil Nadu | +91 98765 43210", 'CENTER');
  addLine();

  // Bill & Shop Info
  addText(`Bill No: ${bill.bill_no || 'INV-000000'}`, 'LEFT', true);
  addText(`Date: ${bill.sale_date || bill.date || ''} ${bill.sale_time || bill.time || ''}`, 'LEFT');
  addText(`Shop: ${bill.shop_name || 'Customer'} (${bill.shop_code || 'SHP-001'})`, 'LEFT', true);
  addText(`Emp: ${bill.employee_name || 'Driver'} ${bill.vehicle_no ? `| Veh: ${bill.vehicle_no}` : ''}`, 'LEFT');
  addLine();

  // Itemized Table Header
  addText("ITEM             QTY   RATE   TOTAL", 'LEFT', true);
  addLine();

  // Items (Strictly actual bill items)
  const items = bill.items || [];

  items.forEach(item => {
    const pName = (item.product_name || 'Item').padEnd(14, ' ').substring(0, 14);
    const qty = String(Math.floor(Number(item.qty || 1))).padStart(3, ' ');
    const rate = `₹${Number(item.rate || 0).toFixed(2)}`.padStart(7, ' ');
    const amt = `₹${Number(item.amount || 0).toFixed(2)}`.padStart(8, ' ');
    addText(`${pName} ${qty} ${rate} ${amt}`, 'LEFT');
  });

  addLine();

  // Totals & Payment
  const totalQty = items.reduce((acc, it) => acc + (Math.floor(Number(it.qty)) || 0), 0);
  addText(`TOTAL QTY: ${totalQty}`, 'LEFT', true);
  addText(`TOTAL AMOUNT: RS. ${Number(bill.total_amount || 0).toFixed(2)}`, 'RIGHT', true);
  addText(`PAYMENT MODE: ${bill.payment_mode || 'CASH'}`, 'RIGHT', true);

  if (bill.payment_mode === 'SPLIT') {
    if (Number(bill.cash_paid) > 0) addText(`Cash Paid: RS. ${Number(bill.cash_paid).toFixed(2)}`, 'RIGHT');
    if (Number(bill.gpay_paid) > 0) addText(`GPay Paid: RS. ${Number(bill.gpay_paid).toFixed(2)}`, 'RIGHT');
    if (Number(bill.credit_paid) > 0) addText(`Credit Due: RS. ${Number(bill.credit_paid).toFixed(2)}`, 'RIGHT');
    addText(`Balance: RS. 0.00`, 'RIGHT');
  } else if (bill.payment_mode === 'CASH') {
    addText(`Cash Paid: RS. ${Number(bill.total_amount || 0).toFixed(2)}`, 'RIGHT');
  } else if (bill.payment_mode === 'GPAY') {
    addText(`GPay Paid: RS. ${Number(bill.total_amount || 0).toFixed(2)}`, 'RIGHT');
  } else {
    addText(`Credit Due: RS. ${Number(bill.total_amount || 0).toFixed(2)}`, 'RIGHT');
  }

  addLine();
  addText("Thank You! Visit Again", 'CENTER', true);
  addText(companyName, 'CENTER');
  addBytes(LINE_FEED);
  addBytes(LINE_FEED);
  addBytes(LINE_FEED);
  addBytes(CUT_PAPER);

  // Connect to Bluetooth Thermal Printer Device
  let device;
  try {
    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb', // ESC/POS Thermal Printer Service
        '00001101-0000-1000-8000-00805f9b34fb', // Standard Serial Port Profile (SPP)
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC BLE Thermal Printer
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // PosBank / Xprinter BLE
        '0000ff00-0000-1000-8000-00805f9b34fb', // Custom ESC/POS BLE
        '0000ae00-0000-1000-8000-00805f9b34fb', // Goojprt / MPT BLE
        '0000fee7-0000-1000-8000-00805f9b34fb'  // Generic POS BLE
      ]
    });
  } catch (reqErr) {
    if (reqErr.name === 'NotFoundError') {
      throw new Error("No printer selected. Please turn ON Phone Location (GPS) & select your EXEO printer.");
    }
    throw reqErr;
  }

  const server = await device.gatt.connect();

  // Find Bluetooth Characteristic for ESC/POS Binary Write
  let targetCharacteristic = null;
  const services = await server.getPrimaryServices();

  for (const service of services) {
    try {
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          targetCharacteristic = char;
          break;
        }
      }
    } catch (e) {
      // Ignore service read error and try next
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
