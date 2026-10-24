import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const fixture=JSON.parse(await readFile('.tmp/local-preview.json','utf8'));
if(!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_preview[a-z0-9_]*$/.test(fixture.admin_url))throw new Error('Explicit isolated preview required');
process.env.DATABASE_URL=fixture.admin_url;
const {pool}=await import('../database/pg_pool.js');
const {refundSale,settle,cashFlow}=await import('../payments.js');
const {businessDate}=await import('../financial.js');
try {
  const company=(await pool.query("INSERT INTO companies(name) VALUES('Synthetic closed-day refund check') RETURNING id")).rows[0].id;
  const employee=(await pool.query("INSERT INTO employees(company_id,employee_code,full_name) VALUES($1,'REFUND-CLOSED','Synthetic driver') RETURNING id",[company])).rows[0].id;
  const owner=(await pool.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash) VALUES($1,(SELECT id FROM roles WHERE role_name='OWNER'),$2,'Synthetic owner','unusable-synthetic-hash') RETURNING id",[company,randomUUID()])).rows[0].id;
  const shop=(await pool.query("INSERT INTO shops(company_id,name,ledger_ready) VALUES($1,'Synthetic shop',true) RETURNING id",[company])).rows[0].id;
  const session=(await pool.query("INSERT INTO driver_sessions(company_id,employee_id,session_date,status) VALUES($1,$2,$3,'CLOSED') RETURNING id",[company,employee,businessDate()])).rows[0].id;
  const sale=(await pool.query("INSERT INTO sales(company_id,bill_no,shop_id,employee_id,session_id,sale_date,total_amount,cash_paid,credit_paid,payment_mode,financial_version) VALUES($1,$2,$3,$4,$5,$6,20,20,0,'CASH',1) RETURNING id",[company,randomUUID(),shop,employee,session,businessDate()])).rows[0].id;
  const actor={id:owner,role:'OWNER'};
  const settled=await settle(company,{employee_id:employee,collected_amount:20,idempotency_key:randomUUID()},actor);
  let refundError=null;
  try {await refundSale(company,sale,{amount:20,payment_mode:'CASH',reason:'Synthetic owner refund after closed settlement',idempotency_key:randomUUID()},actor);}catch(error){refundError=error.message;}
  const flow=await cashFlow(pool,company,employee,{start:businessDate(),end:businessDate()});
  const result={status:refundError?'REFUND_BLOCKED':'BLOCKER_REPRODUCED',refund_rejected:!!refundError,closed_settlement_expected:Number(settled.settlement.expected_amount),driver_reported_cash_after_refund:Number(flow.cash),required_decision:'Block finalized refunds, or introduce approved refunding-till accounting that preserves closed driver settlements'};
  await writeFile('.tmp/local-refund-finalization.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  if(!refundError)process.exitCode=2;
} finally {await pool.end();}
