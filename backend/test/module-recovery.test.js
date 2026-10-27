import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { frontendAssets } from '../frontendAssets.js';
import { installModuleRecovery, isModuleLoadError } from '../../frontend/src/utils/moduleRecovery.js';

function fakeWindow({dirty=false, offline=false, storageFails=false, previous=null}={}) {
  const listeners = new Map(); let reloads=0, prevented=0;
  const storage = new Map(previous ? [['avs.module-recovery-at',String(previous)]] : []);
  const win={navigator:{onLine:!offline},location:{reload(){reloads++;}},
    sessionStorage:{getItem:k=>storage.get(k),setItem(k,v){if(storageFails)throw Error('Denied');storage.set(k,v);}},
    addEventListener(k,v){listeners.set(k,v);},removeEventListener(k){listeners.delete(k);}};
  const dispose=installModuleRecovery(win);
  if(dirty)listeners.get('input')();
  return {win,storage,dispose,listeners,fire(message='Failed to fetch dynamically imported module'){
    listeners.get('vite:preloadError')({payload:Error(message),preventDefault(){prevented++;}});
  },get reloads(){return reloads;},get prevented(){return prevented;}};
}

test('recognizes browser chunk errors without treating business errors as reload requests',()=>{
  for(const message of ['Failed to fetch dynamically imported module: /assets/old.js','Importing a module script failed.','error loading dynamically imported module','Loading chunk 42 failed'])assert.equal(isModuleLoadError(Error(message)),true);
  assert.equal(isModuleLoadError(Error('Invalid sales unit')),false);
});
test('initial stale module reloads once; repeated failure cannot loop across page loads',()=>{
  const first=fakeWindow();first.fire();first.fire();assert.equal(first.reloads,1);assert.equal(first.prevented,1);
  const next=fakeWindow({previous:Number(first.storage.get('avs.module-recovery-at'))});next.fire();assert.equal(next.reloads,0);
  first.dispose();assert.equal(first.listeners.size,0);
});
for(const [name,options] of [['unsaved input',{dirty:true}],['offline',{offline:true}],['blocked browser storage',{storageFails:true}]])test(`${name} prevents automatic navigation`,()=>{
  const f=fakeWindow(options);f.fire();assert.equal(f.reloads,0);assert.equal(f.prevented,0);
});
test('unrelated errors stay visible; expired recovery guard allows a later update',()=>{
  const f=fakeWindow({previous:Date.now()-360000});f.fire('Invalid sales unit');assert.equal(f.reloads,0);f.fire();assert.equal(f.reloads,1);
});

test('HTTP cache policy and real browser stale-chunk recovery preserve edited fields', {timeout:60000},async t=>{
  const directory=await mkdtemp(path.join(tmpdir(),'avs-module-test-'));
  await mkdir(path.join(directory,'assets'));
  await writeFile(path.join(directory,'assets','retained-old123.js'),'export default "old tab works";');
  const source=await readFile(new URL('../../frontend/src/utils/moduleRecovery.js',import.meta.url),'utf8');
  await writeFile(path.join(directory,'recovery.js'),source);
  await writeFile(path.join(directory,'index.html'),`<!doctype html><input id="qty" value=""><script type="module">
    import {installModuleRecovery} from '/recovery.js';installModuleRecovery(window);
    window.tryMissing=async()=>{try{await import('/assets/missing-version.js');}catch(error){
      const e=new Event('vite:preloadError',{cancelable:true});e.payload=error;window.dispatchEvent(e);
      if(!e.defaultPrevented)document.body.dataset.recovery='manual';
    }};window.ready=true;
  </script>`);
  const app=express();app.use(frontendAssets(directory));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}`;
  for(const endpoint of ['/','/index.html','/dashboard']){
    const res=await fetch(url+endpoint,{headers:{Accept:'text/html'}});assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-cache');
  }
  const asset=await fetch(url+'/assets/retained-old123.js');assert.equal(asset.status,200);assert.match(asset.headers.get('cache-control'),/immutable/);
  const missing=await fetch(url+'/assets/missing-version.js');assert.equal(missing.status,404);assert.equal(missing.headers.get('cache-control'),'no-store');assert.doesNotMatch(await missing.text(),/doctype/i);
  const browser=await chromium.launch({headless:true,...(process.env.AVS_TEST_BROWSER === 'chromium' ? {} : {channel:'msedge'})});t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(url);await page.waitForFunction(()=>window.ready);
  assert.equal(await page.evaluate(async()=> (await import('/assets/retained-old123.js')).default),'old tab works');
  const navigation=page.waitForEvent('framenavigated');await page.evaluate(()=>{void window.tryMissing();});await navigation;await page.waitForFunction(()=>window.ready);
  assert.ok(await page.evaluate(()=>sessionStorage.getItem('avs.module-recovery-at')));
  await page.evaluate(()=>window.tryMissing());assert.equal(await page.locator('body').getAttribute('data-recovery'),'manual');
  await page.evaluate(()=>sessionStorage.clear());await page.locator('#qty').fill('12');await page.evaluate(()=>window.tryMissing());
  assert.equal(await page.locator('#qty').inputValue(),'12');assert.equal(await page.evaluate(()=>sessionStorage.getItem('avs.module-recovery-at')),null);
});
