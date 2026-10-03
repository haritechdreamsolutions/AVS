// ============================================================================
// AVS POS - 58mm ESC/POS Bluetooth Thermal Printer Service
// Specifically engineered for EXEO EX58C & standard 58mm ESC/POS thermal printers
// Uses Direct Chrome Web Bluetooth GATT Device Connection with Fast Reconnect Cache
// ============================================================================

let cachedDevice = null;
let cachedCharacteristic = null;

/**
 * Generates an ESC/POS binary buffer strictly formatted for 58mm thermal rolls.
 * Standard 58mm width = 32 ASCII characters per line.
 */
export const generateEscPos58mmBuffer = (bill) => {
  const ESC = 0x1B;
  const GS = 0x1D;

  // ESC/POS Commands
  const CMD_INITIALIZE = [ESC, 0x40]; // Initialize printer
  const CMD_ALIGN_LEFT = [ESC, 0x61, 0];
  const CMD_ALIGN_CENTER = [ESC, 0x61, 1];
  const CMD_ALIGN_RIGHT = [ESC, 0x61, 2];
  const CMD_BOLD_ON = [ESC, 0x45, 1];
  const CMD_BOLD_OFF = [ESC, 0x45, 0];
  const CMD_DOUBLE_STRIKE_ON = [ESC, 0x47, 1];
  const CMD_DOUBLE_STRIKE_OFF = [ESC, 0x47, 0];
  const CMD_DOUBLE_SIZE_ON = [GS, 0x21, 0x11]; // Double Width + Double Height (Large Bold Title)
  const CMD_DOUBLE_HEIGHT_ON = [ESC, 0x21, 0x10]; // Double Height only
  const CMD_NORMAL_TEXT = [GS, 0x21, 0x00];
  const CMD_LINE_FEED = [0x0A];
  const CMD_CUT = [GS, 0x56, 66, 0];

  const encoder = new TextEncoder();
  const buffer = [];

  const addBytes = (bytes) => {
    buffer.push(...bytes);
  };

  const addText = (text = '', align = 'LEFT', bold = false, size = 'NORMAL') => {
    if (align === 'CENTER') addBytes(CMD_ALIGN_CENTER);
    else if (align === 'RIGHT') addBytes(CMD_ALIGN_RIGHT);
    else addBytes(CMD_ALIGN_LEFT);

    if (size === 'DOUBLE_SIZE' || size === true) {
      addBytes(CMD_DOUBLE_SIZE_ON);
    } else if (size === 'DOUBLE_HEIGHT') {
      addBytes(CMD_DOUBLE_HEIGHT_ON);
    } else {
      addBytes(CMD_NORMAL_TEXT);
    }

    if (bold) {
      addBytes(CMD_BOLD_ON);
      addBytes(CMD_DOUBLE_STRIKE_ON);
    }

    // Clean special characters to ensure flawless 58mm thermal font rendering
    const cleanText = text
      .replace(/₹/g, 'Rs.')
      .replace(/[^\x20-\x7E\n]/g, ' '); // Strip non-ASCII to prevent junk characters on hardware

    addBytes(Array.from(encoder.encode(cleanText)));

    if (bold) {
      addBytes(CMD_BOLD_OFF);
      addBytes(CMD_DOUBLE_STRIKE_OFF);
    }
    if (size) addBytes(CMD_NORMAL_TEXT);
    addBytes(CMD_LINE_FEED);
  };

  const addDashedLine = () => {
    addText('--------------------------------', 'CENTER');
  };

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

  // Helper: Strictly format date as DD-MM-YYYY
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

  // 1. Initialize Printer
  addBytes(CMD_INITIALIZE);

  // 2. Company Header
  const companyName = bill.company_name || 'AVS AGENCIES';
  const rawPhone = bill.company_phone || '9486334240';
  const cleanPhone = rawPhone.replace(/\+91\s*/g, '').replace(/\s+/g, '').trim();

  // Title: Extra Bold & Large font with clean blank line below
  addText(companyName, 'CENTER', true, 'DOUBLE_SIZE');
  addBytes(CMD_LINE_FEED); // Space below title
  
  // Single line address & phone
  addText('No 71, Mailam Road, Kooteripattu', 'CENTER', false);
  addText(`Ph: ${cleanPhone}`, 'CENTER', true);
  addDashedLine();

  // 3. Bill & Customer Metadata
  const rawBillNo = bill.bill_no || bill.sale?.bill_no || 'INV-000000';
  const billNo = rawBillNo.length > 12 ? (rawBillNo.substring(0, 9) + '...') : rawBillNo;
  const dateStr = formatReceiptDate(bill.sale_date || bill.date);
  const timeStr = bill.sale_time || bill.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const shopName = bill.shop_name || bill.shop?.name || 'Customer';
  const shopCode = bill.shop_code || bill.shop?.code || 'SHP-001';
  const empName = bill.employee_name || bill.driver_name || 'Driver';
  const vehicleNo = bill.vehicle_no || bill.vehicle_number || '';

  addTwoColumnRow(`Bill: ${billNo}`, `${dateStr}`, true);
  addTwoColumnRow(`Shop: ${shopName}`, `${timeStr}`, true);
  addTwoColumnRow(`Code: ${shopCode}`, `Emp: ${empName}`, false);
  if (vehicleNo) {
    addText(`Vehicle: ${vehicleNo}`, 'LEFT', false);
  }
  addDashedLine();

  // 4. Items Table (ITEM (12) + QTY (3) + RATE (6) + AMT (8) + 3 spaces = 32 cols exactly)
  addText('ITEM          QTY   RATE      AMT', 'LEFT', true);
  addDashedLine();

  const items = bill.items || bill.sale?.items || [];

  items.forEach((item) => {
    const rawName = (item.product_name || 'Item').replace(/₹/g, '');
    const pName = rawName.length > 12 ? rawName.substring(0, 12) : rawName.padEnd(12, ' ');
    const qtyNum = Math.floor(Number(item.qty || 1));
    const qtyStr = String(qtyNum).padStart(3, ' ');
    const rateStr = Number(item.rate || 0).toFixed(2).padStart(6, ' ');
    const amtStr = Number(item.amount || (qtyNum * Number(item.rate || 0))).toFixed(2).padStart(8, ' ');

    addText(`${pName} ${qtyStr} ${rateStr} ${amtStr}`, 'LEFT', false);
  });

  if (items.length === 0) {
    addText('No items billed', 'CENTER', false);
  }

  addDashedLine();

  // 5. Totals Section
  const totalAmount = Number(bill.total_amount || 0);
  const previousDue = Number(bill.previous_due || bill.shop_previous_due || 0);
  const oldCreditPaid = Number(bill.old_credit_paid || 0);
  const grandTotal = totalAmount + previousDue;

  addTwoColumnRow('BILL TOTAL:', `Rs. ${totalAmount.toFixed(2)}`, true);

  if (previousDue > 0) {
    addTwoColumnRow('OLD CREDIT:', `Rs. ${previousDue.toFixed(2)}`, false);
    if (oldCreditPaid > 0) {
      addTwoColumnRow('OLD CREDIT PAID:', `Rs. ${oldCreditPaid.toFixed(2)}`, false);
    }
    addTwoColumnRow('NET GRAND TOTAL:', `Rs. ${grandTotal.toFixed(2)}`, true);
  }

  addDashedLine();

  // 6. Payment Breakdown
  const paymentMode = (bill.payment_mode || 'CASH').toUpperCase();
  const cashPaid = Number(bill.cash_paid || 0);
  const gpayPaid = Number(bill.gpay_paid || 0);
  const creditPaid = Number(bill.credit_paid || 0);
  const shopBalance = Number(bill.shop_current_due !== undefined ? bill.shop_current_due : (bill.balance || 0));

  addTwoColumnRow('PAYMENT MODE:', paymentMode, true);

  if (paymentMode === 'SPLIT') {
    if (cashPaid > 0) addTwoColumnRow('Cash Paid:', `Rs. ${cashPaid.toFixed(2)}`, false);
    if (gpayPaid > 0) addTwoColumnRow('GPay / UPI Paid:', `Rs. ${gpayPaid.toFixed(2)}`, false);
    if (creditPaid > 0) addTwoColumnRow('Credit on Bill:', `Rs. ${creditPaid.toFixed(2)}`, false);
    addTwoColumnRow('Total Paid:', `Rs. ${(cashPaid + gpayPaid).toFixed(2)}`, true);
  } else if (paymentMode === 'CASH') {
    const received = cashPaid > 0 ? cashPaid : (totalAmount + oldCreditPaid);
    addTwoColumnRow('Cash Received:', `Rs. ${received.toFixed(2)}`, false);
  } else if (paymentMode === 'GPAY') {
    const received = gpayPaid > 0 ? gpayPaid : (totalAmount + oldCreditPaid);
    addTwoColumnRow('GPay Received:', `Rs. ${received.toFixed(2)}`, false);
  } else if (paymentMode === 'CREDIT') {
    addTwoColumnRow('Credit Amount:', `Rs. ${totalAmount.toFixed(2)}`, false);
  }

  addTwoColumnRow('SHOP BALANCE:', `Rs. ${shopBalance.toFixed(2)}`, true);
  addDashedLine();

  // 7. Footer
  addText('Thank You! Visit Again', 'CENTER', true);
  addText(companyName, 'CENTER', false);
  addBytes(CMD_LINE_FEED);
  addBytes(CMD_LINE_FEED);
  addBytes(CMD_LINE_FEED);
  addBytes(CMD_CUT);

  return new Uint8Array(buffer);
};

/**
 * Direct Web Bluetooth GATT Print implementation (Native Chrome Bluetooth Device Selector).
 * Automatically caches the connected EX58C printer for instant one-click subsequent printing.
 */
export const printViaWebBluetooth = async (billData) => {
  if (!navigator.bluetooth) {
    // Fallback if browser does not support Web Bluetooth
    return printViaRawBT(billData);
  }

  const escPosBytes = generateEscPos58mmBuffer(billData);

  let device = cachedDevice;
  let writeCharacteristic = cachedCharacteristic;

  // 1. Try reusing existing active connected characteristic (Lightning Fast, zero popup)
  if (device && device.gatt && device.gatt.connected && writeCharacteristic) {
    try {
      const chunkSize = 100;
      for (let i = 0; i < escPosBytes.length; i += chunkSize) {
        const chunk = escPosBytes.slice(i, i + chunkSize);
        if (writeCharacteristic.properties.writeWithoutResponse) {
          await writeCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await writeCharacteristic.writeValue(chunk);
        }
      }
      return { success: true, transport: 'WebBluetooth' };
    } catch (e) {
      console.warn("Cached write error, attempting reconnect...", e);
      writeCharacteristic = null;
    }
  }

  // 2. Try reconnecting to cached device if disconnected
  if (device && device.gatt && !device.gatt.connected) {
    try {
      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      for (const service of services) {
        try {
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              writeCharacteristic = char;
              break;
            }
          }
        } catch (e) {}
        if (writeCharacteristic) break;
      }
      if (writeCharacteristic) {
        cachedCharacteristic = writeCharacteristic;
        const chunkSize = 100;
        for (let i = 0; i < escPosBytes.length; i += chunkSize) {
          const chunk = escPosBytes.slice(i, i + chunkSize);
          if (writeCharacteristic.properties.writeWithoutResponse) {
            await writeCharacteristic.writeValueWithoutResponse(chunk);
          } else {
            await writeCharacteristic.writeValue(chunk);
          }
        }
        return { success: true, transport: 'WebBluetooth' };
      }
    } catch (e) {
      console.warn("Reconnection failed, opening Bluetooth search...", e);
      device = null;
    }
  }

  // 3. Open native Bluetooth device picker
  device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      '000018f0-0000-1000-8000-00805f9b34fb', // ESC/POS Service
      '0000e0ff-0000-1000-8000-00805f9b34fb',
      '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC BLE
      'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // PosBank / Xprinter BLE
      '0000ff00-0000-1000-8000-00805f9b34fb', // Custom ESC/POS BLE
      '0000ae00-0000-1000-8000-00805f9b34fb', // Goojprt BLE
      '0000fee7-0000-1000-8000-00805f9b34fb'  // Generic POS BLE
    ]
  });

  if (!device) {
    throw new Error('No Bluetooth printer selected.');
  }

  cachedDevice = device;

  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices();

  for (const service of services) {
    try {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          writeCharacteristic = char;
          break;
        }
      }
    } catch (e) {
      // try next service
    }
    if (writeCharacteristic) break;
  }

  if (!writeCharacteristic) {
    throw new Error('Could not find writable Bluetooth characteristic for EX58C.');
  }

  cachedCharacteristic = writeCharacteristic;

  // Chunk write (100 bytes per chunk)
  const chunkSize = 100;
  for (let i = 0; i < escPosBytes.length; i += chunkSize) {
    const chunk = escPosBytes.slice(i, i + chunkSize);
    if (writeCharacteristic.properties.writeWithoutResponse) {
      await writeCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await writeCharacteristic.writeValue(chunk);
    }
  }

  return { success: true, transport: 'WebBluetooth' };
};

/**
 * Fallback to RawBT URL scheme
 */
export const printViaRawBT = (billData) => {
  const escPosBytes = generateEscPos58mmBuffer(billData);
  let binary = '';
  for (let i = 0; i < escPosBytes.byteLength; i++) {
    binary += String.fromCharCode(escPosBytes[i]);
  }
  const base64Data = window.btoa(binary);
  const rawBtUrl = `rawbt:data:application/octet-stream;base64,${base64Data}`;
  window.location.href = rawBtUrl;
  return { success: true, transport: 'RawBT' };
};

/**
 * Universal 58mm Thermal Print Dispatcher
 * Directly connects via Web Bluetooth to EX58C
 */
export const printThermalReceipt = async (billData) => {
  if (!billData) {
    throw new Error('Receipt data is missing.');
  }

  return await printViaWebBluetooth(billData);
};
