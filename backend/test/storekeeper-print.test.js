import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium, expect} from '@playwright/test';

const url='http://127.0.0.1:5000';
const bill={id:900001,bill_no:'SYNTHETIC-PRINT',shop_name:'Synthetic shop',employee_name:'Synthetic keeper',sale_date:new Date().toISOString().slice(0,10),total_amount:12,cash_paid:12,payment_mode:'CASH',items:[{product_name:'Synthetic item',qty:1,rate:12,amount:12}]};
const browser=await chromium.launch({headless:true,channel:'msedge'});
try {
  for(const role of ['keeper','owner']) {
    const context=await browser.newContext();
    const page=await context.newPage();
    page.setDefaultTimeout(15000);
    await page.route('**/api/**',route=>{
      const path=new URL(route.request().url()).pathname.replace('/api','');
      let data=[];
      if(path==='/auth/me') data={success:true,user:{id:900001,name:'Synthetic print user',role:role==='keeper'?'STORE_KEEPER':'OWNER'}};
      else if(path==='/dashboard/summary') data={};
      else if(path==='/reports/sales') data={rows:[bill],total:1};
      else if(path==='/sales') data=[bill];
      else if(path===`/sales/${bill.id}`) data=bill;
      return route.fulfill({json:data});
    });
    await page.goto(url);
    await page.getByRole('button',{name:role==='keeper'?'Sales & Receipts':'Sales & Bills',exact:true}).click();
    await page.getByTitle('Print Invoice',{exact:true}).first().click();
    const receipt=page.locator(role==='keeper'?'.printable-thermal-80mm':'.printable-thermal-receipt');
    await expect(receipt).toBeVisible();
    await page.emulateMedia({media:'print'});
    const width=await receipt.evaluate(element=>element.getBoundingClientRect().width);
    assert.ok(Math.abs(width-(role==='keeper'?80:58)*96/25.4)<1);
    if(role==='keeper') {
      assert.equal(await receipt.locator('span').first().evaluate(element=>getComputedStyle(element).fontSize),'14px');
      assert.ok(await page.locator('style').allTextContents().then(styles=>styles.some(style=>style.includes('size: 80mm auto'))));
      await page.pdf({path:'.tmp/storekeeper-80mm-receipt.pdf',width:'80mm',height:'300mm',preferCSSPageSize:true});
    }
    await context.close();
  }
  const source=await readFile('frontend/src/components/StoreKeeper/StockReturnModal.jsx','utf8');
  const css=source.match(/<style dangerouslySetInnerHTML=\{\{ __html: `([\s\S]*?)`\}\} \/>/)[1];
  const page=await browser.newPage();
  await page.setContent(`<style>${css}</style><div style="position:fixed;overflow:hidden;height:100px"><div id="thermal-58mm-stock-sheet"><h3>AVS AGENCIES</h3><p>DRIVER STOCK SHEET</p>${'<div class="truncate">Synthetic Tamil product / stock quantity 123</div>'.repeat(60)}</div></div>`);
  await page.emulateMedia({media:'print'});
  const stock=page.locator('#thermal-58mm-stock-sheet');
  assert.ok(Math.abs((await stock.boundingBox()).width-80*96/25.4)<1);
  assert.equal(await stock.locator('p').evaluate(element=>getComputedStyle(element).fontSize),'14px');
  assert.equal(await stock.locator('h3').evaluate(element=>getComputedStyle(element).fontSize),'22px');
  assert.equal(await stock.locator('..').evaluate(element=>getComputedStyle(element).overflow),'visible');
  await page.pdf({path:'.tmp/storekeeper-stock-80mm.pdf',width:'80mm',height:'600mm',preferCSSPageSize:true});
  const printerSource=await readFile('frontend/src/services/printerService.js','utf8');
  const raster=await page.evaluate(async source=>{
    const printer=await import(URL.createObjectURL(new Blob([source],{type:'text/javascript'})));
    const fonts=[];
    const original=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){
      if(text==='Synthetic item') fonts.push(this.font);
      return original.call(this,text,...args);
    };
    try {
      const bill={total_amount:12,payment_mode:'CASH',items:[{product_name:'Synthetic item',qty:1,rate:12,amount:12}]};
      const wide=printer.generateEscPos80mmRasterBuffer({...bill,storekeeper_print:true});
      printer.generateEscPos80mmRasterBuffer(bill);
      const narrow=printer.generateEscPos58mmRasterBuffer(bill);
      return {fonts,wideWidth:wide[9]+wide[10]*256,narrowWidth:narrow[9]+narrow[10]*256};
    } finally { CanvasRenderingContext2D.prototype.fillText=original; }
  },printerSource);
  assert.match(raster.fonts[0],/20px/);
  assert.match(raster.fonts[1],/16px/);
  assert.equal(raster.wideWidth,72);
  assert.equal(raster.narrowWidth,48);
  console.log('PASS: storekeeper 80mm receipt and stock layout, larger fonts, unclipped stock wrapper; owner stays 58mm. Physical printer NOT TESTED.');
} finally { await browser.close(); }
