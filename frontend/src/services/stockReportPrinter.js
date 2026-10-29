import { printViaWebBluetooth } from './printerService.js';

// 80/82mm ESC/POS printers use a 576-dot printable area. Raster output preserves Tamil names.
export function stockReportBuffer(report, doc = document) {
  const width = 576, padding = 12;
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
  const rows = report.items.map(item => ({...item, lines:wrap(item.name, 250)}));
  canvas.height = 370 + rows.reduce((height, row) => height + Math.max(32, row.lines.length * 27 + 10), 0)
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
  text('ITEM');text('ASG',330,18,'right');text('SLD',400,18,'right');text('AVL',470,18,'right');text('CHK',width-padding,18,'right');y+=18;rule();
  for (const row of rows) {
    row.lines.forEach((line,i)=>{text(line,padding,20);if(i===0){text(row.alloc,330,20,'right');text(row.sold,400,20,'right');text(row.retStock,470,20,'right');ctx.strokeRect(528,y-18,20,20);}y+=27;});
    y+=10;
  }
  rule();
  for (const [label,value] of [['TOTAL ASSIGNED:',report.totalAllocated],['TOTAL SOLD:',report.totalSold],['TOTAL AVAILABLE:',report.totalReturn]]) {
    text(label,padding,22);text(value,width-padding,24,'right');y+=34;
  }
  text('*** END OF STOCK SHEET ***',width/2,18,'center');y+=38;
  const pixels=ctx.getImageData(0,0,width,y).data;
  const rowBytes=width/8, bytes=new Uint8Array(8+rowBytes*y+7);
  bytes.set([0x1d,0x76,0x30,0, rowBytes,0,y%256,Math.floor(y/256)]);
  for(let row=0;row<y;row++)for(let x=0;x<width;x++){
    const i=(row*width+x)*4;
    if(pixels[i]*0.299+pixels[i+1]*0.587+pixels[i+2]*0.114<160)bytes[8+row*rowBytes+Math.floor(x/8)]|=128>>(x%8);
  }
  bytes.set([10,10,10,0x1d,0x56,66,0],bytes.length-7);
  const result=new Uint8Array(bytes.length+5);result.set([27,64,27,97,1]);result.set(bytes,5);
  return result;
}

export async function printStockReport(report) {
  if (!report.items.length) throw new Error('No stock products are available to print.');
  const bytes=stockReportBuffer(report);
  return printViaWebBluetooth(null,'80mm',bytes);
}
