import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';

if(!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL||'')) throw Error('Explicit isolated test database required');
const base='http://127.0.0.1:55647';
Object.assign(process.env,{DATABASE_URL:process.env.AVS_TEST_DATABASE_URL,NODE_ENV:'test',AVS_NO_LISTEN:'1',SESSION_SECRET:'synthetic-storekeeper-direct-secret',FRONTEND_URL:base});
const {pool}=await import('../database/pg_pool.js');
const {createSale}=await import('../db_pg.js');
const {app}=await import('../index.js');
const server=app.listen(55647,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
try {
  await test('linked storekeeper bills without a driver route using warehouse stock; payments and retries persist correctly',async()=>{
    const company=(await pool.query("INSERT INTO companies(name) VALUES('Synthetic storekeeper direct') RETURNING id")).rows[0].id;
    const employee=(await pool.query("INSERT INTO employees(company_id,employee_code,full_name,designation) VALUES($1,$2,'Synthetic counter employee','Store Keeper') RETURNING id",[company,randomUUID().slice(0,16)])).rows[0].id;
    const login='counter-'+randomUUID(),password='Synthetic-counter-password!';
    const user=(await pool.query("INSERT INTO user_accounts(company_id,role_id,employee_id,login_id,name,pin_hash,credential_kind) VALUES($1,(SELECT id FROM roles WHERE role_name='STORE_KEEPER'),$2,$3,'Synthetic counter employee',$4,'password') RETURNING id",[company,employee,login,await bcrypt.hash(password,12)])).rows[0].id;
    const product=(await pool.query("INSERT INTO products(company_id,name,display_name,base_unit,selling_unit,pieces_per_unit,piece_selling_price,unit_selling_price,direct_sale_rate,warehouse_stock_units) VALUES($1,'Synthetic item','Synthetic item','Piece','Piece',1,10,10,12,100) RETURNING id",[company])).rows[0].id;
    let cookie='',token='';
    const request=async(path,method='GET',body)=>{
      const response=await fetch(base+path,{method,headers:{cookie,Origin:base,'Content-Type':'application/json','X-CSRF-Token':token},...(body?{body:JSON.stringify(body)}:{})});
      if(response.headers.get('set-cookie')) cookie=response.headers.get('set-cookie').split(';')[0];
      return response;
    };
    token=(await(await request('/api/auth/csrf')).json()).csrfToken;
    assert.equal((await request('/api/auth/login','POST',{login_id:login,pin:password})).status,200);
    token=(await(await request('/api/auth/csrf')).json()).csrfToken;
    let shop;
    for(const mode of ['CASH','GPAY','CREDIT','SPLIT']) {
      const payload={employee_id:null,employee_name:'Synthetic counter employee',is_store_direct_sale:true,sale_type:'STOREKEEPER_DIRECT',shop_name:'AVS AGENCIES',payment_mode:mode,cash_paid:mode==='SPLIT'?5:mode==='CASH'?12:0,gpay_paid:mode==='SPLIT'?4:mode==='GPAY'?12:0,credit_paid:mode==='SPLIT'?3:mode==='CREDIT'?12:0,items:[{product_id:product,unit_type:'Piece',qty:1,rate:12}],idempotency_key:randomUUID()};
      const response=await request('/api/sales','POST',payload);
      const data=await response.json();
      assert.equal(response.status,200,data.message);
      assert.equal(data.sale.employee_id,null);
      assert.equal(data.sale.session_id,null);
      assert.equal(data.sale.employee_name,'Synthetic counter employee');
      assert.equal(Number(data.sale.total_amount),12);
      assert.equal(Number(data.sale.cash_paid),payload.cash_paid);
      assert.equal(Number(data.sale.gpay_paid),payload.gpay_paid);
      assert.equal(Number(data.sale.credit_paid),payload.credit_paid);
      shop=data.sale.shop_id;
      const retry=await request('/api/sales','POST',payload);
      assert.equal(retry.status,200);
      assert.equal((await retry.json()).sale.id,data.sale.id);
    }
    assert.equal(Number((await pool.query('SELECT warehouse_stock_units FROM products WHERE id=$1',[product])).rows[0].warehouse_stock_units),96);
    assert.equal(Number((await pool.query('SELECT current_due FROM shops WHERE id=$1',[shop])).rows[0].current_due),15);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM sales WHERE company_id=$1',[company])).rows[0].count,4);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM driver_sessions WHERE company_id=$1',[company])).rows[0].count,0);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM employee_stock WHERE company_id=$1',[company])).rows[0].count,0);
    await assert.rejects(createSale(company,{employee_id:employee,employee_name:'Synthetic counter employee',shop_id:shop,sale_type:'DRIVER_DELIVERY',is_store_direct_sale:false,payment_mode:'CASH',items:[{product_id:product,unit_type:'Piece',qty:1,rate:10}],idempotency_key:randomUUID()},user),/not assigned to any active route/);
  });
} finally { await new Promise(resolve=>server.close(resolve)); await pool.end(); }
