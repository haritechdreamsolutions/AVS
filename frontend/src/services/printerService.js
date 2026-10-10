// ============================================================================
// AVS POS - 58mm ESC/POS Bluetooth Thermal Printer Service
// Specifically engineered for EXEO EX58C, standard 58mm ESC/POS thermal printers,
// and full Tamil Unicode (மாலா ஸ்டோர், முருகன் ஸ்டோர்) Bit-Image / Text printing.
// ============================================================================

let cachedDevice = null;
let cachedCharacteristic = null;

/**
 * Format any date into DD-MM-YYYY format
 */
export const formatReceiptDate = (raw) => {
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

/**
 * Generates an ESC/POS binary buffer for 58mm thermal rolls.
 * Preserves Tamil Unicode characters and clean formatting.
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
  const CMD_DOUBLE_SIZE_ON = [GS, 0x21, 0x11]; // Double Width + Double Height
  const CMD_DOUBLE_HEIGHT_ON = [ESC, 0x21, 0x10];
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

    // Preserve Tamil Unicode text and clean currency symbol
    const cleanText = String(text || '').replace(/₹/g, 'Rs.');

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
    const spaceCount = Math.max(1, totalWidth - cleanLeft.length - cleanRight.length);
    const line = cleanLeft + ' '.repeat(spaceCount) + cleanRight;
    addText(line, 'LEFT', bold);
  };

  // 1. Initialize Printer
  addBytes(CMD_INITIALIZE);

  // 2. Company Header
  const companyName = bill.company_name || 'AVS AGENCIES';
  const rawPhone = bill.company_phone || '9486334240';
  const cleanPhone = rawPhone.replace(/\+91\s*/g, '').replace(/\s+/g, '').trim();

  addText(companyName, 'CENTER', true, 'DOUBLE_SIZE');
  addBytes(CMD_LINE_FEED);
  addText('No 71, Mailam Road, Kooteripattu', 'CENTER', true);
  addText(`Ph: ${cleanPhone}`, 'CENTER', true);
  addBytes(CMD_LINE_FEED);
  addDashedLine();

  // 3. Bill & Customer Metadata
  const rawBillNo = bill.bill_no || bill.sale?.bill_no || 'INV-000000';
  const billNo = rawBillNo.length > 12 ? (rawBillNo.substring(0, 9) + '...') : rawBillNo;
  const dateStr = formatReceiptDate(bill.sale_date || bill.date);
  const timeStr = bill.sale_time || bill.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const shopName = bill.shop_name || bill.shop?.name || bill.customer_name || 'Customer';
  const shopCode = bill.shop_code || bill.shop?.code || 'SHP-001';
  const empName = bill.employee_name || bill.driver_name || 'Driver';
  const vehicleNo = bill.vehicle_no || bill.vehicle_number || '';

  addTwoColumnRow(`Bill: ${billNo}`, `${dateStr}`, true);
  addText(`Shop: ${shopName}`, 'LEFT', true);
  addTwoColumnRow(`Code: ${shopCode}`, `Time: ${timeStr}`, false);
  addTwoColumnRow(`Emp: ${empName}`, vehicleNo ? `Veh: ${vehicleNo}` : '', false);
  addDashedLine();

  // 4. Items Table
  addText('ITEM           QTY   RATE     AMT', 'LEFT', true);
  addDashedLine();

  const items = bill.items || bill.sale?.items || [];
  items.forEach((item) => {
    const rawName = (item.product_name || 'Item').replace(/₹/g, '');
    const pName = rawName.length > 13 ? rawName.substring(0, 13) : rawName.padEnd(13, ' ');
    const qtyNum = Math.floor(Number(item.qty || 1));
    const qtyStr = String(qtyNum).padStart(3, ' ');
    const rateStr = Number(item.rate || 0).toFixed(2).padStart(6, ' ');
    const amtStr = Number(item.amount || (qtyNum * Number(item.rate || 0))).toFixed(2).padStart(7, ' ');

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
 * Generates an ESC/POS 58mm High-Resolution Raster Bit-Image Buffer.
 * Uses an offscreen HTML5 canvas to guarantee 100% pixel-perfect Tamil typography rendering
 * on ANY Bluetooth thermal hardware regardless of built-in firmware fonts.
 */
export const generateEscPos58mmRasterBuffer = (bill) => {
  const width = 384; // Standard 58mm width in dots (48 bytes)
  const canvas = document.createElement('canvas');
  canvas.width = width;
  
  // Calculate approximate height
  const items = bill.items || bill.sale?.items || [];
  const baseHeight = 540 + (items.length * 28);
  canvas.height = baseHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return generateEscPos58mmBuffer(bill);

  // Background white
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, canvas.height);
  ctx.fillStyle = '#000000';

  const fontTamilStack = '"Nirmala UI", "Latha", "Mukta Malar", "Noto Sans Tamil", "Tamil Sangam MN", sans-serif, monospace';
  const fontMonoStack = '"Space Mono", "Courier New", monospace';

  let y = 30;

  // 1. Header
  ctx.font = `bold 24px ${fontMonoStack}`;
  ctx.textAlign = 'center';
  const companyName = bill.company_name || 'AVS AGENCIES';
  ctx.fillText(companyName, width / 2, y);

  y += 22;
  ctx.font = `14px ${fontTamilStack}`;
  ctx.fillText('No 71, Mailam Road, Kooteripattu', width / 2, y);

  y += 20;
  const rawPhone = bill.company_phone || '9486334240';
  const cleanPhone = rawPhone.replace(/\+91\s*/g, '').replace(/\s+/g, '').trim();
  ctx.font = `bold 14px ${fontMonoStack}`;
  ctx.fillText(`Ph: ${cleanPhone}`, width / 2, y);

  // Dashed Line
  y += 15;
  ctx.strokeStyle = '#000000';
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(10, y);
  ctx.lineTo(width - 10, y);
  ctx.stroke();

  // 2. Bill & Shop Metadata
  y += 20;
  ctx.textAlign = 'left';
  ctx.font = `bold 14px ${fontMonoStack}`;
  const rawBillNo = bill.bill_no || bill.sale?.bill_no || 'INV-000000';
  const billNo = rawBillNo.length > 14 ? (rawBillNo.substring(0, 11) + '...') : rawBillNo;
  const dateStr = formatReceiptDate(bill.sale_date || bill.date);
  ctx.fillText(`Bill: ${billNo}`, 10, y);
  ctx.textAlign = 'right';
  ctx.fillText(dateStr, width - 10, y);

  // Shop Name (Full Tamil rendering with bold clear font)
  y += 22;
  ctx.textAlign = 'left';
  ctx.font = `bold 16px ${fontTamilStack}`;
  const shopName = bill.shop_name || bill.shop?.name || bill.customer_name || 'Customer';
  ctx.fillText(`Shop: ${shopName}`, 10, y);

  // Code & Time
  y += 20;
  ctx.font = `13px ${fontMonoStack}`;
  const shopCode = bill.shop_code || bill.shop?.code || 'SHP-001';
  const timeStr = bill.sale_time || bill.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  ctx.fillText(`Code: ${shopCode}`, 10, y);
  ctx.textAlign = 'right';
  ctx.fillText(`Time: ${timeStr}`, width - 10, y);

  // Emp & Vehicle
  y += 18;
  ctx.textAlign = 'left';
  const empName = bill.employee_name || bill.driver_name || 'Driver';
  const vehicleNo = bill.vehicle_no || bill.vehicle_number || '';
  ctx.fillText(`Emp: ${empName}`, 10, y);
  if (vehicleNo) {
    ctx.textAlign = 'right';
    ctx.fillText(`Veh: ${vehicleNo}`, width - 10, y);
  }

  // Dashed Line
  y += 15;
  ctx.beginPath();
  ctx.moveTo(10, y);
  ctx.lineTo(width - 10, y);
  ctx.stroke();

  // 3. Items Table Header
  y += 18;
  ctx.font = `bold 13px ${fontMonoStack}`;
  ctx.textAlign = 'left';
  ctx.fillText('ITEM', 10, y);
  ctx.fillText('QTY', 190, y);
  ctx.textAlign = 'right';
  ctx.fillText('RATE', 290, y);
  ctx.fillText('AMT', width - 10, y);

  y += 10;
  ctx.beginPath();
  ctx.moveTo(10, y);
  ctx.lineTo(width - 10, y);
  ctx.stroke();

  // 4. Items Rows
  items.forEach((item) => {
    y += 20;
    const pName = String(item.product_name || 'Item').replace(/₹/g, '');
    const qtyNum = Math.floor(Number(item.qty || 1));
    const rateVal = Number(item.rate || 0).toFixed(2);
    const amtVal = Number(item.amount || (qtyNum * Number(item.rate || 0))).toFixed(2);

    ctx.textAlign = 'left';
    ctx.font = `bold 13px ${fontTamilStack}`;
    ctx.fillText(pName.substring(0, 18), 10, y);

    ctx.font = `bold 13px ${fontMonoStack}`;
    ctx.fillText(String(qtyNum), 195, y);

    ctx.textAlign = 'right';
    ctx.fillText(rateVal, 290, y);
    ctx.fillText(amtVal, width - 10, y);
  });

  if (items.length === 0) {
    y += 20;
    ctx.textAlign = 'center';
    ctx.font = `italic 13px ${fontMonoStack}`;
    ctx.fillText('No items billed', width / 2, y);
  }

  // Dashed Line
  y += 15;
  ctx.beginPath();
  ctx.moveTo(10, y);
  ctx.lineTo(width - 10, y);
  ctx.stroke();

  // 5. Totals
  const totalAmount = Number(bill.total_amount || 0);
  const previousDue = Number(bill.previous_due || bill.shop_previous_due || 0);
  const oldCreditPaid = Number(bill.old_credit_paid || 0);
  const grandTotal = totalAmount + previousDue;

  y += 22;
  ctx.textAlign = 'left';
  ctx.font = `bold 15px ${fontMonoStack}`;
  ctx.fillText('BILL TOTAL:', 10, y);
  ctx.textAlign = 'right';
  ctx.fillText(`Rs. ${totalAmount.toFixed(2)}`, width - 10, y);

  if (previousDue > 0) {
    y += 20;
    ctx.textAlign = 'left';
    ctx.font = `bold 13px ${fontTamilStack}`;
    ctx.fillText('OLD CREDIT (பழைய கடன்):', 10, y);
    ctx.textAlign = 'right';
    ctx.font = `bold 13px ${fontMonoStack}`;
    ctx.fillText(`Rs. ${previousDue.toFixed(2)}`, width - 10, y);

    if (oldCreditPaid > 0) {
      y += 18;
      ctx.textAlign = 'left';
      ctx.font = `bold 13px ${fontTamilStack}`;
      ctx.fillText('PAID (செலுத்தியது):', 10, y);
      ctx.textAlign = 'right';
      ctx.font = `bold 13px ${fontMonoStack}`;
      ctx.fillText(`Rs. ${oldCreditPaid.toFixed(2)}`, width - 10, y);
    }

    y += 20;
    ctx.textAlign = 'left';
    ctx.font = `bold 14px ${fontMonoStack}`;
    ctx.fillText('NET GRAND TOTAL:', 10, y);
    ctx.textAlign = 'right';
    ctx.fillText(`Rs. ${grandTotal.toFixed(2)}`, width - 10, y);
  }

  // Dashed Line
  y += 15;
  ctx.beginPath();
  ctx.moveTo(10, y);
  ctx.lineTo(width - 10, y);
  ctx.stroke();

  // 6. Payment & Balance
  const paymentMode = (bill.payment_mode || 'CASH').toUpperCase();
  const shopBalance = Number(bill.shop_current_due !== undefined ? bill.shop_current_due : (bill.balance || 0));

  y += 18;
  ctx.textAlign = 'left';
  ctx.font = `bold 13px ${fontMonoStack}`;
  ctx.fillText('MODE:', 10, y);
  ctx.textAlign = 'right';
  ctx.fillText(paymentMode, width - 10, y);

  y += 22;
  ctx.textAlign = 'left';
  ctx.font = `bold 15px ${fontTamilStack}`;
  ctx.fillText('SHOP BALANCE (கடை பாக்கி):', 10, y);
  ctx.textAlign = 'right';
  ctx.font = `bold 16px ${fontMonoStack}`;
  ctx.fillText(`Rs. ${shopBalance.toFixed(2)}`, width - 10, y);

  // Dashed Line
  y += 15;
  ctx.beginPath();
  ctx.moveTo(10, y);
  ctx.lineTo(width - 10, y);
  ctx.stroke();

  // 7. Footer
  y += 20;
  ctx.textAlign = 'center';
  ctx.font = `bold 13px ${fontMonoStack}`;
  ctx.fillText('Thank You! Visit Again', width / 2, y);

  y += 18;
  ctx.font = `12px ${fontMonoStack}`;
  ctx.fillText(companyName, width / 2, y);

  const finalHeight = y + 40;

  // Convert canvas pixels to ESC/POS Raster Bit-Image (GS v 0)
  const imageData = ctx.getImageData(0, 0, width, finalHeight);
  const data = imageData.data;
  const widthBytes = Math.ceil(width / 8); // 48 bytes
  const rasterData = [];

  for (let row = 0; row < finalHeight; row++) {
    for (let byteIdx = 0; byteIdx < widthBytes; byteIdx++) {
      let byteVal = 0;
      for (let bit = 0; bit < 8; bit++) {
        const px = byteIdx * 8 + bit;
        if (px < width) {
          const idx = (row * width + px) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          // Luminance threshold (black = 1, white = 0)
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum < 160) {
            byteVal |= (1 << (7 - bit));
          }
        }
      }
      rasterData.push(byteVal);
    }
  }

  const ESC = 0x1B;
  const GS = 0x1D;
  const xL = widthBytes % 256;
  const xH = Math.floor(widthBytes / 256);
  const yL = finalHeight % 256;
  const yH = Math.floor(finalHeight / 256);

  const escPosRasterBuffer = [
    ESC, 0x40, // Initialize
    ESC, 0x61, 1, // Align Center
    GS, 0x76, 0x30, 0x00, xL, xH, yL, yH, // GS v 0 m xL xH yL yH
    ...rasterData,
    0x0A, 0x0A, 0x0A, // Line feeds
    GS, 0x56, 66, 0 // Cut
  ];

  return new Uint8Array(escPosRasterBuffer);
};

/**
 * Direct Web Bluetooth GATT Print implementation (Native Chrome Bluetooth Device Selector).
 * Automatically caches the connected EX58C printer for instant one-click subsequent printing.
 */
export const printViaWebBluetooth = async (billData) => {
  if (!navigator.bluetooth) {
    return printViaRawBT(billData);
  }

  // Use High-Resolution Raster Bit-Image Buffer to ensure 100% Tamil typography prints perfectly
  let escPosBytes;
  try {
    escPosBytes = generateEscPos58mmRasterBuffer(billData);
  } catch (err) {
    console.warn("Falling back to text ESC/POS buffer:", err);
    escPosBytes = generateEscPos58mmBuffer(billData);
  }

  let device = cachedDevice;
  let writeCharacteristic = cachedCharacteristic;

  // 1. Try reusing existing active connected characteristic
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
    } catch (e) {}
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
  let escPosBytes;
  try {
    escPosBytes = generateEscPos58mmRasterBuffer(billData);
  } catch (err) {
    escPosBytes = generateEscPos58mmBuffer(billData);
  }

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
 */
export const printThermalReceipt = async (billData) => {
  if (!billData) {
    throw new Error('Receipt data is missing.');
  }

  return await printViaWebBluetooth(billData);
};
