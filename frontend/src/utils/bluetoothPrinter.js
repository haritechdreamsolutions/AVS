// Web Bluetooth ESC/POS 58mm Thermal Printer Utility

export const generateEscPosBuffer = (bill) => {
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

  const CMD_DOUBLE_HEIGHT_ON = [ESC, 0x21, 0x10];
  const CMD_DOUBLE_STRIKE_ON = [ESC, 0x47, 1];
  const CMD_DOUBLE_STRIKE_OFF = [ESC, 0x47, 0];
  const CMD_NORMAL_TEXT = [ESC, 0x21, 0x00];

  const encoder = new TextEncoder();
  let buffer = [];

  const addBytes = (bytes) => {
    buffer.push(...bytes);
  };

  const addText = (text, align = 'LEFT', bold = false, doubleHeight = false) => {
    if (align === 'CENTER') addBytes(ALIGN_CENTER);
    else if (align === 'RIGHT') addBytes(ALIGN_RIGHT);
    else addBytes(ALIGN_LEFT);

    if (doubleHeight) addBytes(CMD_DOUBLE_HEIGHT_ON);
    else addBytes(CMD_NORMAL_TEXT);

    if (bold) {
      addBytes(BOLD_ON);
      addBytes(CMD_DOUBLE_STRIKE_ON);
    }
    addBytes(Array.from(encoder.encode(text.replace(/₹/g, 'Rs.'))));
    if (bold) {
      addBytes(BOLD_OFF);
      addBytes(CMD_DOUBLE_STRIKE_OFF);
    }
    if (doubleHeight) addBytes(CMD_NORMAL_TEXT);
    addBytes(LINE_FEED);
  };

  const addLine = () => {
    addText("--------------------------------", 'CENTER');
  };

  const formatReceiptDate = (raw) => {
    if (!raw) {
      const d = new Date();
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    }
    if (typeof raw === 'string') {
      const clean = raw.split('T')[0];
      const parts = clean.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
        } else if (parts[2].length === 4) {
          return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
        }
      }
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    }
    return String(raw);
  };

  // Build ESC/POS Thermal Receipt
  addBytes(INITIALIZE);

  // Header
  const companyName = bill.company_name || 'AVS AGENCIES';
  const rawPhone = bill.company_phone || '9486334240';
  const cleanPhone = rawPhone.replace(/\+91\s*/g, '').replace(/\s+/g, '').trim();

  // Title with tight letter gap, tall and extra bold font
  addText(companyName, 'CENTER', true, true);
  
  // Centered address lines with normal spacing
  addText('No 71, Mailam Road', 'CENTER', false, false);
  addText('Kooteripattu', 'CENTER', false, false);
  addText(`Ph:${cleanPhone}`, 'CENTER', true, false);
  addLine();

  // Bill & Shop Info
  const rawBillNo = bill.bill_no || 'INV-000000';
  const billNo = rawBillNo.length > 12 ? (rawBillNo.substring(0, 9) + '...') : rawBillNo;
  const dateStr = formatReceiptDate(bill.sale_date || bill.date);
  addText(`Bill: ${billNo}`, 'LEFT', true);
  addText(`Date: ${dateStr} ${bill.sale_time || bill.time || ''}`, 'LEFT');
  addText(`Shop: ${bill.shop_name || 'Customer'} (${bill.shop_code || 'SHP-001'})`, 'LEFT', true);
  addText(`Emp: ${bill.employee_name || 'Driver'} ${bill.vehicle_no ? `| Veh: ${bill.vehicle_no}` : ''}`, 'LEFT');
  addLine();

  // Itemized Table Header (ITEM 13 + QTY 3 + RATE 6 + AMT 7 + 3 spaces = 32 cols)
  addText("ITEM           QTY   RATE     AMT", 'LEFT', true);
  addLine();

  // Items (Strictly actual bill items)
  const items = bill.items || [];

  items.forEach(item => {
    const rawName = (item.product_name || 'Item').replace(/₹/g, '');
    const pName = rawName.length > 13 ? rawName.substring(0, 13) : rawName.padEnd(13, ' ');
    const qtyNum = Math.floor(Number(item.qty || 1));
    const qtyStr = String(qtyNum).padStart(3, ' ');
    const rateStr = Number(item.rate || 0).toFixed(2).padStart(6, ' ');
    const amtStr = Number(item.amount || (qtyNum * Number(item.rate || 0))).toFixed(2).padStart(7, ' ');
    addText(`${pName} ${qtyStr} ${rateStr} ${amtStr}`, 'LEFT');
  });

  addLine();

  // Totals & Payment
  addText(`BILL TOTAL: RS. ${Number(bill.total_amount || 0).toFixed(2)}`, 'RIGHT', true);
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

  return buffer;
};

// 1. Web Bluetooth ESC/POS Print Method
export const printBillViaBluetooth = async (bill) => {
  if (!navigator.bluetooth) {
    throw new Error("Web Bluetooth API is not supported in this browser. Please use Chrome or Edge.");
  }

  const buffer = generateEscPosBuffer(bill);

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
      throw new Error("No printer selected. Please ensure printer is paired and Phone Location & Bluetooth are ON.");
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

// 2. Direct RawBT / Android Print Service Integration (Instant 100% Guaranteed Bluetooth Print)
export const printBillViaRawBT = (bill) => {
  const buffer = generateEscPosBuffer(bill);
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = window.btoa(binary);
  window.location.href = `rawbt:data:application/octet-stream;base64,${base64}`;
  return true;
};
