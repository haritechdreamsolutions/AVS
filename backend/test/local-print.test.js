import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const fixture=JSON.parse(await readFile('.tmp/local-preview.json','utf8'));
if(fixture.url!=='http://127.0.0.1:5000')throw new Error('Local preview required');
const browser=await chromium.launch({headless:true,channel:'msedge'});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  await page.route('**/*',route=>route.request().url().startsWith(fixture.url+'/')?route.continue():route.abort());
  await page.goto(fixture.url);
  await page.getByPlaceholder('Enter your Login ID (e.g. owner)').fill(fixture.owner);
  await page.getByLabel('Password or driver PIN').fill(fixture.password);
  await page.getByRole('button',{name:'Enter',exact:true}).click();
  await page.getByRole('button',{name:'Sales & Bills',exact:true}).click();
  await page.getByTitle('Print Invoice',{exact:true}).first().click();
  const receipt=page.locator('.printable-thermal-receipt, .printable-thermal-80mm');
  await receipt.getByText('Local Test Milk',{exact:true}).waitFor();
  assert.ok((await receipt.innerText()).includes(fixture.keeper),'Reprints must preserve the saved seller, not the viewing owner');
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('body').evaluate(element=>getComputedStyle(element).backgroundImage),'none');
  for(const span of await receipt.locator('span.font-mono').all())assert.equal(await span.evaluate(element=>getComputedStyle(element).whiteSpace),'nowrap');
  const bounds=await receipt.boundingBox();
  assert.ok(bounds.width<=310);
  for(const span of await receipt.locator('.receipt-meta > .flex > span').all())assert.ok((await span.boundingBox()).x+(await span.boundingBox()).width<=bounds.x+bounds.width+1);
  await page.pdf({path:'.tmp/local-preview-receipt.pdf',width:bounds.width+'px',height:Math.ceil(bounds.height+20)+'px',printBackground:true,margin:{top:0,right:0,bottom:0,left:0}});
  await receipt.screenshot({path:'.tmp/local-preview-receipt.png'});
  console.log('PASS: saved invoice print layout has no page background, unbroken monetary amounts and a receipt-width PDF; physical printer remains unverified');
} finally {await browser.close();}
