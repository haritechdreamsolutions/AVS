import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
if(!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(process.env.AVS_TEST_DATABASE_URL||''))throw Error('Explicit isolated test database required');
process.env.DATABASE_URL=process.env.AVS_TEST_DATABASE_URL;
const {pool}=await import('../database/pg_pool.js');
const {addEmployee,reserveEmployeeCode,updateEmployee}=await import('../db_pg.js');
const company=(await pool.query("INSERT INTO companies(name) VALUES('Synthetic automatic employee codes') RETURNING id")).rows[0].id;
try {
  await test('ten simultaneous employee creations receive distinct database-allocated codes and IDs',async()=>{
    const results=await Promise.all(Array.from({length:10},(_,index)=>addEmployee(company,{full_name:'Synthetic employee '+index,designation:'Owner'})));
    assert.equal(new Set(results.map(result=>result.employee.id)).size,10);
    assert.equal(new Set(results.map(result=>result.employee.employee_code)).size,10);
    for(const result of results)assert.equal(result.employee.employee_code,'EMP'+String(result.employee.id).padStart(3,'0'));
  });
  await test('existing codes and legacy employee IDs are skipped without renumbering records',async()=>{
    const next=Number((await pool.query("SELECT nextval(pg_get_serial_sequence('employees','id')) AS id")).rows[0].id);
    const reservedCode='EMP'+String(next+2).padStart(3,'0');
    const original=(await pool.query("INSERT INTO employees(company_id,employee_code,full_name) VALUES($1,$2,'Synthetic legacy employee') RETURNING id",[company,reservedCode.toLowerCase()])).rows[0].id;
    const generated=await addEmployee(company,{full_name:'Synthetic new employee'});
    assert.notEqual(generated.employee.employee_code,reservedCode);
    assert.equal((await pool.query('SELECT employee_code FROM employees WHERE id=$1',[original])).rows[0].employee_code,reservedCode.toLowerCase());
    await assert.rejects(addEmployee(company,{full_name:'Synthetic duplicate',employee_code:reservedCode}),/already exists/);
    const future=Number((await pool.query("SELECT nextval(pg_get_serial_sequence('employees','id')) AS id")).rows[0].id)+1;
    await pool.query("INSERT INTO employees(id,company_id,full_name,employee_code) VALUES($1,$2,'Synthetic imported employee',$3)",[future,company,'IMPORTED-'+randomUUID().slice(0,12)]);
    const afterImport=await addEmployee(company,{full_name:'Synthetic after import'});
    assert.notEqual(afterImport.employee.id,future);
  });
  await test('manual codes remain supported and invalid routes do not leave partial employees',async()=>{
    const manual=await addEmployee(company,{full_name:'Synthetic manual employee',employee_code:' manual01 '});
    assert.equal(manual.employee.employee_code,'MANUAL01');
    await assert.rejects(addEmployee(company,{full_name:'Synthetic duplicate',employee_code:'manual01'}),/already exists/);
    await assert.rejects(addEmployee(company,{full_name:'Synthetic rejected route',route_id:2147483647}),/Route must belong/);
    assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM employees WHERE company_id=$1 AND full_name='Synthetic rejected route'",[company])).rows[0].count,0);
    await assert.rejects(updateEmployee(company,manual.employee.id,{employee_code:'CHANGED'}),/cannot be changed/);
    const edited=await updateEmployee(company,manual.employee.id,{full_name:'Synthetic renamed employee',employee_code:'MANUAL01'});
    assert.equal(edited.employee.employee_code,'MANUAL01');
  });
  await test('pre-save reservations are unique, retry-safe and protected against code changes and duplicate saves',async()=>{
    const reservations=await Promise.all(Array.from({length:10},()=>reserveEmployeeCode(company,{idempotency_key:randomUUID()})));
    assert.equal(new Set(reservations.map(row=>row.employee_code)).size,10);
    const key=randomUUID();
    const repeats=await Promise.all(Array.from({length:10},()=>reserveEmployeeCode(company,{idempotency_key:key})));
    assert.equal(new Set(repeats.map(row=>row.employee_code)).size,1);
    const reserved=repeats[0];
    assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM employees WHERE id=$1',[reserved.employee_id])).rows[0].count,0);
    await assert.rejects(addEmployee(company,{full_name:'Synthetic tampering',employee_code:'CUSTOM',employee_code_reservation:key}),/automatic and cannot be changed/);
    await assert.rejects(addEmployee(company,{full_name:'Synthetic stolen code',employee_code:reserved.employee_code}),/reserved/);
    const payload={full_name:'Synthetic reserved employee',employee_code_reservation:key};
    const saved=await Promise.all(Array.from({length:10},()=>addEmployee(company,payload)));
    assert.equal(new Set(saved.map(row=>row.employee.id)).size,1);
    assert.equal(saved[0].employee.employee_code,reserved.employee_code);
    assert.equal(saved[0].employee.id,reserved.employee_id);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM employees WHERE company_id=$1 AND employee_code=$2',[company,reserved.employee_code])).rows[0].count,1);
    await assert.rejects(addEmployee(company,{...payload,full_name:'Changed retry'}),/different details/);
    const other=(await pool.query("INSERT INTO companies(name) VALUES('Synthetic reservation boundary') RETURNING id")).rows[0].id;
    await assert.rejects(addEmployee(other,{full_name:'Synthetic wrong company',employee_code_reservation:key}),/reservation is invalid/);
  });
  if(process.env.AVS_TEST_EMPLOYEE_BROWSER==='1')await test('Step 1 allocates unique codes and passes them to newly created user accounts',async()=>{
    const {default:bcrypt}=await import('bcrypt');
    const {chromium,expect}=await import('@playwright/test');
    Object.assign(process.env,{NODE_ENV:'test',AVS_NO_LISTEN:'1',SESSION_SECRET:'synthetic-employee-code-browser-secret',FRONTEND_URL:'http://127.0.0.1:55646'});
    const {app}=await import('../index.js');
    const login='codes-'+randomUUID(),password='Synthetic-employee-password!';
    await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash,credential_kind) VALUES($1,(SELECT id FROM roles WHERE role_name='OWNER'),$2,'Synthetic code owner',$3,'password')",[company,login,await bcrypt.hash(password,12)]);
    const server=app.listen(55646,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    let browser;
    try{
      browser=await chromium.launch({headless:true,...(process.env.AVS_TEST_BROWSER==='chromium'?{}:{channel:'msedge'})});
      const page=await browser.newPage();
      await page.goto('http://127.0.0.1:55646');
      await page.getByPlaceholder('Enter your Login ID (e.g. owner)').fill(login);
      await page.locator('#login-credential').fill(password);
      await page.getByRole('button',{name:'Enter',exact:true}).click();
      await page.getByRole('button',{name:'Users Master',exact:true}).click();
      const codes=[];
      for(let index=0;index<2;index++){
        await page.getByRole('button',{name:'Add User Account',exact:true}).click();
        await page.getByRole('button',{name:/Create New Employee$/}).click();
        const codeField=page.getByRole('textbox',{name:'Employee Code',exact:true});
        await expect(codeField).toHaveValue(/^EMP\d{3,}$/);
        assert.equal(await codeField.isDisabled(),true);
        const displayedCode=await codeField.inputValue();
        if(index===0){
          await page.locator('form').last().getByRole('button',{name:'Cancel',exact:true}).click();
          await page.getByRole('button',{name:'Add User Account',exact:true}).click();
          await page.getByRole('button',{name:/Create New Employee$/}).click();
          await expect(codeField).toHaveValue(displayedCode);
          await page.reload();
          await page.getByRole('button',{name:'Users Master',exact:true}).click();
          await page.getByRole('button',{name:'Add User Account',exact:true}).click();
          await page.getByRole('button',{name:/Create New Employee$/}).click();
          await expect(codeField).toHaveValue(displayedCode);
        }
        await page.getByPlaceholder('e.g. Kumar S or Suresh Driver').fill('Synthetic browser employee '+index);
        await page.locator('form select').first().selectOption('Owner');
        const saved=page.waitForResponse(response=>response.url().endsWith('/api/employees')&&response.request().method()==='POST');
        await page.getByRole('button',{name:'Save Employee & Proceed',exact:true}).click();
        const response=await saved;
        assert.equal(response.status(),200);
        assert.equal(Object.hasOwn(response.request().postDataJSON(),'employee_code'),false);
        const employee=(await response.json()).employee;
        assert.match(employee.employee_code,/^EMP\d{3,}$/);
        assert.equal(employee.employee_code,displayedCode);
        codes.push(employee.employee_code);
        const form=page.locator('form').last();
        assert.equal(await form.locator('input[type="text"]').first().inputValue(),employee.employee_code.toLowerCase());
        await form.locator('input[type="password"]').nth(0).fill(password);
        await form.locator('input[type="password"]').nth(1).fill(password);
        await form.getByRole('button',{name:'Create User Account',exact:true}).click();
        await page.getByRole('row').filter({hasText:employee.employee_code.toLowerCase()}).waitFor();
        assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM user_accounts WHERE company_id=$1 AND employee_id=$2',[company,employee.id])).rows[0].count,1);
        await page.getByRole('row').filter({hasText:employee.employee_code.toLowerCase()}).getByRole('button',{name:'Edit',exact:true}).click();
        assert.equal(await page.getByRole('textbox',{name:'Employee Code',exact:true}).isDisabled(),true);
        assert.equal(await page.getByRole('textbox',{name:'Employee Code',exact:true}).inputValue(),displayedCode);
        await page.locator('form').last().getByRole('button',{name:'Cancel',exact:true}).click();
      }
      assert.equal(new Set(codes).size,2);
    }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
  });
}finally{await pool.end();}
