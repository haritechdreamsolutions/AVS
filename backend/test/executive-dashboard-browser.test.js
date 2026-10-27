import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

test('dashboard midnight rollover and responsive layout in a real browser', {
  skip: process.env.AVS_DASHBOARD_BROWSER_TEST !== '1', timeout:120000
}, async () => {
  if (!process.env.AVS_ADMIN_PASSWORD) throw new Error('Local verification password required.');
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  const signIn = async (page) => {
    await page.goto('http://localhost:4000/');
    await page.getByPlaceholder('Enter your Login ID (e.g. owner)').fill('administrator');
    await page.getByLabel('Password or driver PIN').fill(process.env.AVS_ADMIN_PASSWORD);
    await page.getByRole('button',{name:'Enter',exact:true}).click();
    await page.getByText('ADMIN EXECUTIVE DASHBOARD',{exact:true}).waitFor({timeout:30000});
  };
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    await signIn(page);
    await page.locator('[data-sonner-toast]').first().waitFor({state:'hidden',timeout:10000}).catch(()=>{});
    await mkdir('.tmp',{recursive:true});
    assert.equal(await page.getByRole('button',{name:'Reset Live Data',exact:true}).count(),0);
    for (const [label,width,height] of [['desktop',1440,1000],['tablet',1024,900],['mobile',390,844]]) {
      await page.setViewportSize({width,height});
      const dimensions = await page.evaluate(()=>({width:window.innerWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(dimensions.scroll <= dimensions.width + 1, label+' must not overflow horizontally');
      await page.locator('aside').evaluate(async element=>{await Promise.all(element.getAnimations().map(animation=>animation.finished));});
      await page.screenshot({path:'.tmp/dashboard-'+label+'.png',fullPage:true});
    }
    await page.close();

    // Use synthetic read responses and a controllable clock, leaving real records untouched.
    const midnight = await browser.newPage({viewport:{width:1440,height:1000}});
    const before = new Date('2026-10-27T18:29:30Z');
    const oldDay = '2026-10-27';
    const oldSale = {id:98001,bill_no:'MIDNIGHT-OLD-BILL',employee_name:'Store Keeper POS',is_store_direct_sale:true,
      total_amount:100,cash_paid:100,gpay_paid:0,credit_paid:0,sale_date:oldDay,status:'ACTIVE',items:[]};
    await midnight.route('**/api/sales',route=>route.fulfill({json:[oldSale]}));
    let holdNextOld = false, releaseOld;
    let signalHeld;
    const held = new Promise(resolve=>{signalHeld=resolve;});
    const payload = (day,amount) => ({period:'CUSTOM',date_range:{start:day,end:day},
      kpis:{gross_sales:amount,cash_collected:amount,gpay_collected:0,credit_issued:0,expenses:0,damage_loss:0,cogs:0,net_profit:amount,profit_margin_pct:0},
      payment_modes:{cash:amount,gpay:0,credit:0,split_bills_count:0},expense_breakdown:{},
      analytics:{seven_day_trend:[{date:oldDay,day:'Old day',sales:100,label:'100',height:'100%'},
        {date:'2026-10-28',day:'Today',sales:0,label:'0',height:'8%'}],seven_day_total:100,daily_average:100,highest_day:'Old day',top_products_today:[],payment_breakdown:[],payment_total:amount}});
    await midnight.route('**/api/analytics/dashboard?**',async route=>{
      const day = new URL(route.request().url()).searchParams.get('start_date');
      if (day === oldDay && holdNextOld) {
        holdNextOld = false;
        await new Promise(resolve=>{
          releaseOld = async () => {await route.fulfill({json:payload(day,999)});resolve();};
          signalHeld();
        });
      } else await route.fulfill({json:payload(day,day === oldDay ? 100 : 0)});
    });
    await signIn(midnight);
    // Keep the test-only browser cookie independent of the deliberately shifted UI clock.
    const cookies = await midnight.context().cookies();
    await midnight.context().addCookies(cookies.map(cookie=>({...cookie,expires:-1})));
    await midnight.clock.install({time:before});
    await midnight.reload();
    await midnight.getByText('ADMIN EXECUTIVE DASHBOARD',{exact:true}).waitFor();
    const todayCard = midnight.getByText('TODAY Sales',{exact:true}).locator('..');
    await midnight.getByText('MIDNIGHT-OLD-BILL',{exact:true}).waitFor();
    await midnight.getByText('Updating...',{exact:true}).waitFor({state:'hidden'});
    assert.match(await todayCard.innerText(),/100/);
    holdNextOld = true;
    await midnight.getByTitle('Refresh Live Data').click();
    await held;
    const newRequest = midnight.waitForResponse(r=>r.url().includes('/api/analytics/dashboard?') && r.url().includes('start_date=2026-10-28'));
    const untilMidnight = await midnight.evaluate(()=>Math.max(0,new Date('2026-10-27T18:30:00Z').getTime()-Date.now()+500));
    await midnight.clock.runFor(untilMidnight);
    await newRequest;
    await midnight.getByText('All Bills (0)',{exact:true}).waitFor();
    await releaseOld();
    await midnight.clock.runFor(100);
    assert.equal(await midnight.getByText('MIDNIGHT-OLD-BILL',{exact:true}).count(),0);
    assert.doesNotMatch(await todayCard.innerText(),/100|999/);
    await midnight.getByRole('button',{name:'YESTERDAY',exact:true}).click();
    await midnight.getByText('MIDNIGHT-OLD-BILL',{exact:true}).waitFor();
    await midnight.close();
    console.log('PASS: responsive desktop/tablet/mobile, IST midnight rollover, stale response rejection and preserved Yesterday history.');
  } finally {
    await browser.close();
  }
});
