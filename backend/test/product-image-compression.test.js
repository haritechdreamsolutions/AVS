import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';
import {chromium,expect} from '@playwright/test';
import {validateProductImage} from '../product-image.js';

if(!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL||'')) throw Error('Explicit isolated test database required');
const base='http://127.0.0.1:55652';
Object.assign(process.env,{DATABASE_URL:process.env.AVS_TEST_DATABASE_URL,NODE_ENV:'test',AVS_NO_LISTEN:'1',SESSION_SECRET:'synthetic-product-image-secret',FRONTEND_URL:base});
const {pool}=await import('../database/pg_pool.js');
const db=await import('../db_pg.js');
const {app}=await import('../index.js');
const server=app.listen(55652,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
let browser;
try {
  browser=await chromium.launch({headless:true,...(process.env.AVS_TEST_BROWSER==='chromium'?{}:{channel:'msedge'})});
  const scratch=await browser.newPage();
  const source=await readFile('frontend/src/utils/imageNormalizer.js','utf8');
  const images=await scratch.evaluate(async source=>{
    const moduleUrl=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
    const {normalizeProductImage}=await import(moduleUrl);
    URL.revokeObjectURL(moduleUrl);
    const canvas=document.createElement('canvas');
    canvas.width=1024;canvas.height=1024;
    const context=canvas.getContext('2d');
    const pixels=context.createImageData(1024,1024);
    let seed=482916;
    for(let offset=0;offset<pixels.data.length;offset+=4) {
      for(let channel=0;channel<3;channel++) {
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        pixels.data[offset+channel]=seed>>>24;
      }
      pixels.data[offset+3]=255;
    }
    context.putImageData(pixels,0,0);
    const noiseBlob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    const large=await normalizeProductImage(new File([noiseBlob],'large.png',{type:'image/png'}));
    const original=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(noiseBlob);});
    canvas.width=256;canvas.height=512;
    context.fillStyle='#1450e6';context.fillRect(0,0,256,512);
    context.fillStyle='white';context.font='bold 36px sans-serif';context.fillText('AVS',80,240);
    context.font='24px sans-serif';context.fillText('PRODUCT',60,280);
    const formats={};
    for(const type of ['image/png','image/jpeg','image/webp']) {
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,type,0.95));
      formats[type]=await normalizeProductImage(new File([blob],'portrait',{type}));
    }
    const decoded=new Image();decoded.src=formats['image/png'];await decoded.decode();
    const output=document.createElement('canvas');output.width=decoded.width;output.height=decoded.height;
    const rendered=output.getContext('2d');rendered.drawImage(decoded,0,0);
    const edges=rendered.getImageData(10,250,1,1).data;
    const center=rendered.getImageData(256,100,1,1).data;
    const errors=[];
    for(const file of [{type:'image/png',size:51*1024*1024},new File(['bad'],'invalid.png',{type:'image/png'}),new File(['<svg/>'],'bad.svg',{type:'image/svg+xml'})]) {
      try {await normalizeProductImage(file);errors.push(null);} catch(error) {errors.push(error.message);}
    }
    const nativeToBlob=HTMLCanvasElement.prototype.toBlob;
    let fallback;
    HTMLCanvasElement.prototype.toBlob=function(callback,type,quality){return nativeToBlob.call(this,callback,type==='image/webp'?'image/png':type,quality);};
    try {
      const blob=await new Promise(resolve=>nativeToBlob.call(canvas,resolve,'image/png'));
      fallback=await normalizeProductImage(new File([blob],'fallback.png',{type:'image/png'}));
    } finally {HTMLCanvasElement.prototype.toBlob=nativeToBlob;}
    return {original,originalBytes:noiseBlob.size,large,formats,errors,fallback,width:decoded.width,height:decoded.height,edgeAlpha:edges[3],center:Array.from(center)};
  },source);
  assert.ok(images.originalBytes>2*1024*1024);
  for(const image of [images.large,...Object.values(images.formats),images.fallback]) {
    assert.ok(Buffer.byteLength(image)<=100*1024);
    assert.ok(Buffer.from(image.split(',')[1],'base64').length<=72*1024);
    assert.equal(validateProductImage(image),image);
  }
  assert.equal(images.width,512);assert.equal(images.height,512);
  assert.equal(images.edgeAlpha,0);
  assert.ok(images.center[2]>200&&images.center[3]===255);
  assert.match(images.fallback,/^data:image\/jpeg;base64,/);
  assert.match(images.errors[0],/50 MB/);
  assert.match(images.errors[1],/damaged/);
  assert.match(images.errors[2],/JPG, PNG or WebP/);
  for(const image of [images.original,'data:image/svg+xml;base64,PHN2Zy8+','data:image/webp;base64,YmFk']) assert.throws(()=>validateProductImage(image));
  assert.equal(validateProductImage('/images/existing-product.png'),'/images/existing-product.png');

  const company=(await pool.query("INSERT INTO companies(name) VALUES('Synthetic image compression') RETURNING id")).rows[0].id;
  await pool.query("INSERT INTO categories(company_id,name,code,operational_unit) VALUES($1,'Synthetic image category','IMAGE','Piece')",[company]);
  const login='images-'+randomUUID(),password='Synthetic-image-password!';
  await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash,credential_kind) VALUES($1,(SELECT id FROM roles WHERE role_name='OWNER'),$2,'Synthetic image owner',$3,'password')",[company,login,await bcrypt.hash(password,12)]);
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  page.setDefaultTimeout(20000);
  await page.goto(base);
  await page.getByPlaceholder('Enter your Login ID (e.g. owner)').fill(login);
  await page.locator('#login-credential').fill(password);
  await page.getByRole('button',{name:'Enter',exact:true}).click();
  await page.getByRole('button',{name:/Products & Rates/}).click();
  await page.getByRole('button',{name:'+ Add New Product',exact:true}).click();
  await page.getByPlaceholder('e.g. Milk, Water, Curd').fill('Synthetic image product');
  await page.getByPlaceholder('e.g. Milk 200ml').fill('Synthetic image product');
  await page.getByPlaceholder('0.00',{exact:true}).fill('12');
  await page.locator('input[type=file]').setInputFiles({name:'large.png',mimeType:'image/png',buffer:Buffer.from(images.original.split(',')[1],'base64')});
  await expect(page.getByRole('button',{name:'SAVE & REGISTER PRODUCT',exact:true})).toBeEnabled();
  const created=page.waitForResponse(response=>response.url().endsWith('/api/products')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'SAVE & REGISTER PRODUCT',exact:true}).click();
  const response=await created,data=await response.json();
  assert.equal(response.status(),200,data.message);
  const product=data.product;
  const stored=(await pool.query('SELECT image_url,octet_length(image_url) AS bytes FROM products WHERE id=$1',[product.id])).rows[0];
  assert.ok(stored.bytes<=100*1024);
  assert.equal(stored.image_url,response.request().postDataJSON().image);
  await page.reload();
  await page.getByRole('button',{name:/Products & Rates/}).click();
  await page.getByTitle('Edit Product',{exact:true}).first().click();
  await page.locator('input[type=file]').setInputFiles({name:'clear-portrait.png',mimeType:'image/png',buffer:Buffer.from(images.formats['image/png'].split(',')[1],'base64')});
  await expect(page.getByRole('button',{name:'Save Changes',exact:true})).toBeEnabled();
  const updated=page.waitForResponse(response=>response.url().endsWith('/api/products/'+product.id)&&response.request().method()==='PUT');
  await page.getByRole('button',{name:'Save Changes',exact:true}).click();
  const updateResponse=await updated,updateData=await updateResponse.json();
  assert.equal(updateResponse.status(),200,updateData.message);
  assert.notEqual(updateData.product.image_url,stored.image_url);
  assert.equal(updateData.product.image_url,updateResponse.request().postDataJSON().image);
  for(const field of ['unit_selling_price','piece_selling_price','direct_sale_rate','warehouse_stock_units','pieces_per_unit']) {
    assert.equal(Number(updateData.product[field]),Number(product[field]));
  }
  await page.reload();
  await page.getByRole('button',{name:/Products & Rates/}).click();
  const productImage=page.locator('img[src^="data:image/"]').first();
  await expect(productImage).toBeVisible();
  await page.waitForFunction(()=>Array.from(document.images).some(image=>image.src.startsWith('data:image/')&&image.complete&&image.naturalWidth>0));
  await page.screenshot({path:'.tmp/product-image-reloaded.png',fullPage:true});
  const reloaded=(await db.getProducts(company,{})).find(item=>item.id===product.id);
  assert.equal(reloaded.image,reloaded.image_url);
  assert.ok(reloaded.image.startsWith('data:image/webp;base64,'));
  const csrf=(await(await page.request.get(base+'/api/auth/csrf')).json()).csrfToken;
  const rejected=await page.request.put(base+'/api/products/'+product.id,{headers:{Origin:base,'X-CSRF-Token':csrf},data:{image:images.original}});
  assert.equal(rejected.status(),413);
  const oversized='data:image/png;base64,'+Buffer.alloc(80*1024).toString('base64');
  const sizeRejected=await page.request.put(base+'/api/products/'+product.id,{headers:{Origin:base,'X-CSRF-Token':csrf},data:{image:oversized}});
  assert.equal(sizeRejected.status(),400);
  assert.match((await sizeRejected.json()).message,/too large/);
  assert.equal((await pool.query('SELECT image_url FROM products WHERE id=$1',[product.id])).rows[0].image_url,reloaded.image_url);
  await pool.query('UPDATE products SET image_url=$1 WHERE id=$2',[images.original,product.id]);
  const preserved=await db.updateProduct(company,product.id,{image:images.original});
  assert.equal(preserved.product.image_url,images.original);
  const results={originalBytes:images.originalBytes,compressedBinaryBytes:Buffer.from(images.large.split(',')[1],'base64').length,storedDataBytes:stored.bytes,portraitDimensions:[images.width,images.height],formats:['PNG','JPEG','WebP'],status:'PASS'};
  await writeFile('.tmp/product-image-results.json',JSON.stringify(results,null,2));
  console.log('PASS: multi-MB compression, stored-size cap, aspect/transparency, JPEG fallback, invalid-input rejection, actual owner create/edit/reload and unchanged legacy images. '+JSON.stringify(results));
} finally {if(browser) await browser.close();await new Promise(resolve=>server.close(resolve));await pool.end();}
