import {printViaWebBluetooth} from './printerService.js';
import {encodeReceiptRaster} from './routeDuesPrinter.js';

const currency=value=>{
 const [whole,fraction='']=String(value||'0').split('.');
 return `₹${BigInt(whole).toLocaleString('en-IN')}.${fraction.padEnd(2,'0').slice(0,2)}`;
};
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('-'):value;

export function shopBalanceBuffer(report,paper='80mm',doc=document){
 if(!report.rows?.length)throw Error('No receipt rows to print.');
 const width=paper==='58mm'?384:576;
 const canvas=doc.createElement('canvas');canvas.width=width;
 const ctx=canvas.getContext('2d');
 if(!ctx)throw Error('Unable to prepare receipt. Please use System Print.');
 const font='"Nirmala UI", "Noto Sans Tamil", sans-serif';
 const commands=[];let y=32;
 const text=(value,x=12,size=19,align='left')=>commands.push({value:String(value),x,size,align,y});
 const wrap=(value,maxWidth,size=19)=>{
  ctx.font=`bold ${size}px ${font}`;
  const lines=[];let line='';
  for(const char of String(value)){
   if(line&&ctx.measureText(line+char).width>maxWidth){lines.push(line);line='';}
   line+=char;
  }
  lines.push(line);return lines;
 };
 const rule=()=>{commands.push({rule:true,y});y+=28;};
 text('AVS AGENCIES',width/2,26,'center');y+=34;
 text('SHOP BALANCE RECEIPT',width/2,20,'center');y+=34;
 for(const line of wrap(report.name,width-24,22)){text(line,12,22);y+=30;}
 for(const line of wrap(`Route: ${report.routeName||'-'}`,width-24)){text(line);y+=27;}
 text(`Printed: ${date(report.printedAt)}`);y+=28;
 if(report.from&&report.to){
  for(const line of wrap(`${date(report.from)} - ${date(report.to)}`,width-24)){text(line);y+=27;}
 }
 rule();
 const dateWidth=Math.floor(width*.34),milkX=Math.floor(width*.49),curdX=Math.floor(width*.65),balanceX=width-12;
 text('Date',12,17);text('Milk',milkX,17,'right');text('Curd',curdX,17,'right');text('Balance',balanceX,17,'right');y+=23;
 text('(pcs)',milkX,14,'right');text('(pcs)',curdX,14,'right');y+=20;rule();
 for(const row of report.rows){
  const columns=[
   {lines:wrap(date(row.date)||'Opening Balance',dateWidth-18,17),x:12,align:'left'},
   {lines:wrap(row.milk,width*.14,17),x:milkX,align:'right'},
   {lines:wrap(row.curd,width*.14,17),x:curdX,align:'right'},
   {lines:wrap(currency(row.balance),width*.30-12,17),x:balanceX,align:'right'}
  ];
  const lines=Math.max(...columns.map(c=>c.lines.length));
  for(let i=0;i<lines;i++){
   for(const col of columns)if(col.lines[i]!==undefined)text(col.lines[i],col.x,17,col.align);
   y+=25;
  }
  y+=10;
 }
 rule();
 for(const line of wrap(`TOTAL BAL: ${currency(report.total)}`,width-24,23)){
  text(line,balanceX,23,'right');y+=32;
 }
 const height=y+24;
 if(height>65535)throw Error('Receipt is too long. Please use System Print.');
 canvas.height=height;ctx.fillStyle='white';ctx.fillRect(0,0,width,height);
 ctx.fillStyle='black';ctx.strokeStyle='black';
 for(const cmd of commands){
  if(cmd.rule){ctx.beginPath();ctx.moveTo(12,cmd.y);ctx.lineTo(width-12,cmd.y);ctx.stroke();}
  else{ctx.font=`bold ${cmd.size}px ${font}`;ctx.textAlign=cmd.align;ctx.fillText(cmd.value,cmd.x,cmd.y);}
 }
 return encodeReceiptRaster(ctx.getImageData(0,0,width,height).data,width,height);
}

export function printShopBalance(report,paper='80mm',bytes=null){
 if(!navigator.bluetooth)throw Error('Direct printing requires Chrome/Edge and a BLE thermal printer. Use System Print for USB or other printers.');
 return printViaWebBluetooth(null,paper,bytes||shopBalanceBuffer(report,paper));
}
