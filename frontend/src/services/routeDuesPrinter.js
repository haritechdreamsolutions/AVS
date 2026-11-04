import { printViaWebBluetooth } from './printerService.js';

// Raster printing preserves Tamil shop names on ESC/POS printers.
export function routeDuesBuffer(report, paper = '80mm', doc = document, compact = true) {
  if (!report.shops?.length) throw new Error('No pending shops to print.');
  const width = paper === '58mm' ? 384 : 576;
  const canvas = doc.createElement('canvas');
  canvas.width = width;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to prepare receipt. Please use System Print.');
  const font = '"Nirmala UI", "Noto Sans Tamil", sans-serif';
  const commands = [];
  let y = 30;
  const wrap = (value, maxWidth, size) => {
    ctx.font = `bold ${size}px ${font}`;
    const lines = []; let line = '';
    for (const char of String(value)) {
      if (line && ctx.measureText(line + char).width > maxWidth) { lines.push(line); line = ''; }
      line += char;
    }
    lines.push(line); return lines;
  };
  const text = (value, x = 12, size = 20, align = 'left') => commands.push({value:String(value), x, size, align, y});
  const line = () => { commands.push({rule:true, y}); y += 28; };
  const money = value => {
    const [whole, fraction = ''] = String(value).split('.');
    return `₹${BigInt(whole).toLocaleString('en-IN')}.${fraction.padEnd(2, '0').slice(0, 2)}`;
  };
  text('AVS Billing', width / 2, 26, 'center'); y += 34;
  text('ROUTE BASED DUES', width / 2, 22, 'center'); y += 34;
  for (const value of [`Route: ${report.name}`, `Driver: ${report.driver_name || '-'}`, report.printedAt]) {
    for (const part of wrap(value, width - 24, 19)) { text(part, 12, 19); y += 28; }
  }
  line();
  const nameX = 62, amountX = width - 12;
  // Reserve enough room for the largest exact amount before wrapping names.
  ctx.font = `bold 18px ${font}`;
  const amountWidth = Math.max(125, ...report.shops.map(s => ctx.measureText(money(s.balance)).width));
  const nameWidth = Math.max(40, width - nameX - amountWidth - 24);
  text('S.No', 12, 16); text('Shop Name', nameX, 18); text('Balance', amountX, 18, 'right'); y += 24; line();
  report.shops.forEach((shop, index) => {
    text(index + 1, 12, 18);
    text(money(shop.balance), amountX, 18, 'right');
    for (const part of wrap(shop.name, nameWidth, 20)) { text(part, nameX); y += 29; }
    y += 10;
  });
  line();
  for (const part of wrap(`Grand Total: ${money(report.total)}`, width - 24, 22)) {
    text(part, amountX, 22, 'right'); y += 30;
  }
  const height = y + 24;
  if (height > 65535) throw new Error('Receipt is too long for Bluetooth. Please use System Print.');
  canvas.height = height;
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'black'; ctx.strokeStyle = 'black';
  for (const cmd of commands) {
    if (cmd.rule) { ctx.beginPath(); ctx.moveTo(12, cmd.y); ctx.lineTo(width - 12, cmd.y); ctx.stroke(); }
    else { ctx.font = `bold ${cmd.size}px ${font}`; ctx.textAlign = cmd.align; ctx.fillText(cmd.value, cmd.x, cmd.y); }
  }
  return encodeReceiptRaster(ctx.getImageData(0, 0, width, height).data, width, height, compact);
}

export function encodeReceiptRaster(pixels, width, height, compact = true) {

  const rowBytes = width / 8;
  const bytes = new Uint8Array(5 + 8 + rowBytes * height + 7);
  bytes.set([27, 64, 27, 97, 1, 29, 118, 48, 0, rowBytes, 0, height % 256, Math.floor(height / 256)]);
  for (let row = 0; row < height; row++) for (let x = 0; x < width; x++) {
    const i = (row * width + x) * 4;
    if (pixels[i] * .299 + pixels[i + 1] * .587 + pixels[i + 2] * .114 < 160) bytes[13 + row * rowBytes + Math.floor(x / 8)] |= 128 >> (x % 8);
  }
  bytes.set([10, 10, 10, 29, 86, 66, 0], bytes.length - 7);
  if (!compact) return bytes;
  // Blank scanlines still advance the paper, but need only a one-byte-wide
  // white raster instead of transferring 48/72 empty bytes for every row.
  // Both paths use the same GS v 0 command; no printer-specific compression.
  const bands = [];
  let outputLength = 12;
  let row = 0;
  const blank = r => {
    for (let x = 0; x < rowBytes; x++) if (bytes[13 + r * rowBytes + x]) return false;
    return true;
  };
  while (row < height) {
    const start = row, white = blank(row);
    while (row < height && blank(row) === white) row++;
    const rows = row - start, bandWidth = white ? 1 : rowBytes;
    const band = new Uint8Array(8 + bandWidth * rows);
    band.set([29, 118, 48, 0, bandWidth, 0, rows % 256, Math.floor(rows / 256)]);
    if (!white) band.set(bytes.subarray(13 + start * rowBytes, 13 + row * rowBytes), 8);
    bands.push(band); outputLength += band.length;
  }
  // Very dense reports may not benefit from splitting; keep the smaller job.
  if (outputLength >= bytes.length) return bytes;
  const result = new Uint8Array(outputLength);
  result.set(bytes.subarray(0, 5));
  let offset = 5;
  for (const band of bands) {result.set(band, offset); offset += band.length;}
  result.set(bytes.subarray(-7), offset);
  return result;
}

export function printRouteDues(report, paper = '80mm', preparedBytes = null) {
  if (!navigator.bluetooth) throw new Error('Bluetooth printing requires Chrome/Edge and a BLE printer. Use System Print for USB or other printers.');
  return printViaWebBluetooth(null, paper, preparedBytes || routeDuesBuffer(report, paper));
}
