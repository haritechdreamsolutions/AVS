import {encodeReceiptRaster} from './routeDuesPrinter.js';
import {formatLitres} from '../../../shared/productVolume.js';
import { printViaWebBluetooth } from './printerService.js';

// 80/82mm ESC/POS printers use a 576-dot printable area. Raster output preserves Tamil names.
export function stockReportBuffer(report, doc = document, paper = '80mm') {
  const width = paper === '58mm' ? 384 : 576, padding = 12;
  const scale=width/576;
  const positions=[330,400,470].map(x=>Math.round(x*scale));
  const canvas = doc.createElement('canvas');
  canvas.width = width;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to prepare stock report for printing.');
  const font = '"Nirmala UI", "Noto Sans Tamil", sans-serif';
  ctx.font = `bold 20px ${font}`;
  const wrap = (text, maxWidth) => {
    const lines = []; let line = '';
    for (const char of String(text)) {
      if (line && ctx.measureText(line + char).width > maxWidth) { lines.push(line); line = ''; }
      line += char;
    }
    lines.push(line); return lines;
  };
  const rows = report.items.map(item => ({...item, lines:wrap(item.name, Math.round(250*scale))}));
  canvas.height = 530 + wrap(`Route: ${report.route || "Not assigned"}`, width-padding*2).length*27 + rows.reduce((height, row) => height + Math.max(32, row.lines.length * 27 + 10), 0)
    + wrap(`Driver: ${report.driver}`, width-padding*2).length*27
    + wrap(`Vehicle: ${report.vehicle}`, width-padding*2).length*27;
  ctx.font = `bold 20px ${font}`;
  ctx.fillStyle = 'white'; ctx.fillRect(0,0,width,canvas.height);
  ctx.fillStyle = 'black'; ctx.strokeStyle = 'black';
  let y = 34;
  const text = (value, x=padding, size=20, align='left') => {
    ctx.font = `bold ${size}px ${font}`; ctx.textAlign = align;
    ctx.fillText(String(value), x, y, width-padding*2);
  };
  const rule = () => {ctx.beginPath();ctx.moveTo(padding,y);ctx.lineTo(width-padding,y);ctx.stroke();y+=28;};
  text('AVS AGENCIES',width/2,28,'center'); y+=30;
  text('DRIVER STOCK SHEET',width/2,22,'center');y+=30;
  for (const line of wrap(`Driver: ${report.driver}`,width-padding*2)) {text(line);y+=27;}
  for (const line of wrap(`Vehicle: ${report.vehicle}`,width-padding*2)) {text(line);y+=27;}
  text(report.date);y+=20;rule();
  y+=8;
  for (const line of wrap(`Route: ${report.route || 'Not assigned'}`,width-padding*2)) {text(line);y+=27;}
  rule();
  text('ITEM');text('ASG',positions[0],18,'right');text('SLD',positions[1],18,'right');text('AVL',positions[2],18,'right');text('CHK',width-padding,18,'right');y+=18;rule();
  for (const row of rows) {
    row.lines.forEach((line,i)=>{text(line,padding,20);if(i===0){text(row.alloc,positions[0],20,'right');text(row.sold,positions[1],20,'right');text(row.retStock,positions[2],20,'right');ctx.strokeRect(width-padding-20,y-18,20,20);}y+=27;});
    y+=10;
  }
  rule();
  for (const [label,value] of [['TOTAL ASSIGNED:',report.totalAllocated],['TOTAL SOLD:',report.totalSold],['TOTAL AVAILABLE:',report.totalReturn]]) {
    text(label,padding,22);text(value,width-padding,24,'right');y+=34;
  }
  if(report.litres){rule();const headings=['TOTAL L','SOLD L','AVL L'];const values=[report.litres.allocated,report.litres.sold,report.litres.available];headings.forEach((label,i)=>text(label,(i+.5)*width/3,16,'center'));y+=28;values.forEach((value,i)=>text(formatLitres(value)+' L',(i+.5)*width/3,18,'center'));y+=34;}
  text('*** END OF STOCK SHEET ***',width/2,18,'center');y+=38;
  const pixels=ctx.getImageData(0,0,width,y).data;
  return encodeReceiptRaster(pixels,width,y);
}

export async function printStockReport(report, paper = '80mm') {
  if (!report.items.length) throw new Error('No stock products are available to print.');
  const bytes=stockReportBuffer(report,document,paper);
  return printViaWebBluetooth(null,paper,bytes,{preferResponse:true,writeDelayMs:12});
}
