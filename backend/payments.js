import { pool } from './database/pg_pool.js';
import { paise, amount, requestIdentity, businessDate, retryTransaction } from './financial.js';

function transaction(work) { return retryTransaction(()=>transactionAttempt(work)); }
async function transactionAttempt(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function identityLock(client, cid, operation, data) {
  const identity = requestIdentity(data);
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [operation + ':' + cid + ':' + identity.key]);
  return identity;
}
async function authorizedShop(client, cid, shopId, actor) {
  const result = await client.query('SELECT * FROM shops WHERE id=$1 AND company_id=$2 FOR UPDATE', [shopId,cid]);
  const shop = result.rows[0];
  if (!shop) throw new Error('Shop not found');
  if (['DRIVER','EMPLOYEE'].includes(actor.role)) {
    const assigned = await client.query('SELECT e.id FROM employees e LEFT JOIN villages v ON v.id=$3 WHERE e.id=$1 AND e.company_id=$2 AND e.route_id=COALESCE(v.route_id,$4)', [actor.employee_id,cid,shop.village_id,shop.route_id]);
    if (!assigned.rows.length) throw new Error('Forbidden: shop is outside assigned route');
  } else if (!['OWNER','STORE_KEEPER'].includes(actor.role)) throw new Error('Forbidden');
  return shop;
}
export async function collectDue(cid, shopId, data, actor) {
  return transaction(async client => {
    const identity = await identityLock(client,cid,'collection',data);
    const existing = await client.query('SELECT * FROM receipts WHERE company_id=$1 AND request_key=$2',[cid,identity.key]);
    if (existing.rows.length) {
      if (existing.rows[0].request_hash !== identity.hash || Number(existing.rows[0].shop_id) !== Number(shopId)) throw new Error('Idempotency key already used for a different request');
      await authorizedShop(client,cid,shopId,actor);
      return {success:true, receipt:existing.rows[0], isDuplicate:true};
    }
    const shop = await authorizedShop(client,cid,shopId,actor);
    if (['DRIVER','EMPLOYEE'].includes(actor.role)) {
      await client.query('SELECT id FROM employees WHERE id=$1 AND company_id=$2 FOR UPDATE',[actor.employee_id,cid]);
      const closed=await client.query('SELECT id FROM settlements WHERE company_id=$1 AND employee_id=$2 AND settlement_date=CURRENT_DATE',[cid,actor.employee_id]);
      if(closed.rows.length)throw new Error('Daily settlement is finalized');
    }
    if (!shop.ledger_ready) throw new Error('Legacy shop balances require approved reconciliation before collections');
    const received = paise(data.amount);
    const mode = String(data.payment_mode || '').toUpperCase();
    if (!received || !['CASH','GPAY'].includes(mode)) throw new Error('Positive amount and CASH/GPAY payment mode required');
    if (received > paise(shop.current_due)) throw new Error('Collection exceeds outstanding balance');
    const invoices = await client.query("SELECT s.*, COALESCE((SELECT SUM(a.amount) FROM receipt_allocations a WHERE a.sale_id=s.id),0) AS allocated, COALESCE((SELECT SUM(r.amount) FROM payment_reversals r WHERE r.sale_id=s.id),0) AS refunded FROM sales s WHERE s.company_id=$1 AND s.shop_id=$2 AND s.status='ACTIVE' ORDER BY s.sale_date,s.id FOR UPDATE OF s",[cid,shopId]);
    const balance = paise(shop.opening_due_remaining) + invoices.rows.reduce((sum,sale)=>sum+paise(sale.credit_paid)-paise(sale.allocated)+paise(sale.refunded),0);
    if (balance !== paise(shop.current_due)) throw new Error('Shop ledger does not reconcile; collection requires review');
    const receipt = (await client.query('INSERT INTO receipts(company_id,shop_id,employee_id,created_by,request_key,request_hash,amount,payment_mode,reference,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,clock_timestamp()) RETURNING *',[cid,shopId,actor.employee_id || null,actor.id,identity.key,identity.hash,amount(received),mode,data.reference || null])).rows[0];
    let remaining = received;
    const opening = Math.min(remaining,paise(shop.opening_due_remaining));
    if (opening) {
      await client.query('INSERT INTO receipt_allocations(receipt_id,amount) VALUES($1,$2)',[receipt.id,amount(opening)]);
      await client.query('UPDATE shops SET opening_due_remaining=opening_due_remaining-$1 WHERE id=$2',[amount(opening),shopId]);
      remaining -= opening;
    }
    for (const sale of invoices.rows) {
      const outstanding = paise(sale.credit_paid)-paise(sale.allocated)+paise(sale.refunded);
      const allocation = Math.min(remaining,outstanding);
      if (allocation > 0) {
        await client.query('INSERT INTO receipt_allocations(receipt_id,sale_id,amount) VALUES($1,$2,$3)',[receipt.id,sale.id,amount(allocation)]);
        remaining -= allocation;
      }
      if (!remaining) break;
    }
    if (remaining) throw new Error('Collection allocation could not be reconciled');
    const updated = (await client.query('UPDATE shops SET current_due=current_due-$1,updated_at=NOW() WHERE id=$2 RETURNING current_due',[amount(received),shopId])).rows[0];
    await client.query("INSERT INTO audit_logs(company_id,actor_user_id,action,entity_type,entity_id) VALUES($1,$2,'PAYMENT_RECEIVED','receipts',$3)",[cid,actor.id,receipt.id]);
    return {success:true,receipt,remainingDue:Number(updated.current_due)};
  });
}
export async function refundSale(cid, saleId, data, actor) {
  if (!['OWNER','STORE_KEEPER'].includes(actor.role)) throw new Error('Forbidden');
  return transaction(async client => {
    const identity = await identityLock(client,cid,'refund',data);
    const prior = await client.query('SELECT * FROM payment_reversals WHERE company_id=$1 AND request_key=$2',[cid,identity.key]);
    if (prior.rows.length) {
      if (prior.rows[0].request_hash !== identity.hash || Number(prior.rows[0].sale_id) !== Number(saleId)) throw new Error('Idempotency key already used');
      return {success:true,reversal:prior.rows[0],isDuplicate:true};
    }
    const lookup = await client.query('SELECT shop_id,employee_id,session_id,sale_date::text FROM sales WHERE id=$1 AND company_id=$2',[saleId,cid]);
    if (!lookup.rows.length) throw new Error('Invoice not found');
    await authorizedShop(client,cid,lookup.rows[0].shop_id,actor);
    const invoice = lookup.rows[0];
    if (invoice.employee_id) {
      await client.query('SELECT id FROM employees WHERE id=$1 AND company_id=$2 FOR UPDATE',[invoice.employee_id,cid]);
      const finalized = await client.query("SELECT id FROM driver_sessions WHERE id=$1 AND company_id=$2 AND employee_id=$3 AND status IN ('CLOSED','COMPLETED','RECONCILED','RETURN_VERIFIED')",[invoice.session_id,cid,invoice.employee_id]);
      const settled = await client.query('SELECT id FROM settlements WHERE company_id=$1 AND employee_id=$2 AND settlement_date IN ($3::date,$4::date)',[cid,invoice.employee_id,invoice.sale_date,businessDate()]);
      if (finalized.rows.length || settled.rows.length) throw new Error('Refund is blocked: the driver session or settlement is finalized.');
    }
    const sale = (await client.query('SELECT * FROM sales WHERE id=$1 AND company_id=$2 FOR UPDATE',[saleId,cid])).rows[0];
    if (sale.status !== 'ACTIVE' || sale.financial_version !== 1) throw new Error('Only reconciled active invoices can be refunded');
    const mode = String(data.payment_mode || '').toUpperCase();
    const refund = paise(data.amount);
    if (!refund || !['CASH','GPAY'].includes(mode) || !String(data.reason || '').trim()) throw new Error('Refund requires positive amount, original payment method and reason');
    const originalRefund = await client.query('SELECT COALESCE(SUM(original_amount),0)::text AS total FROM payment_reversals WHERE sale_id=$1 AND payment_mode=$2',[saleId,mode]);
    const originalAvailable = paise(mode === 'CASH' ? sale.cash_paid : sale.gpay_paid) - paise(originalRefund.rows[0].total);
    const allocations = await client.query('SELECT a.*,COALESCE((SELECT SUM(ra.amount) FROM reversal_allocations ra WHERE ra.receipt_allocation_id=a.id),0)::text AS reversed FROM receipt_allocations a JOIN receipts r ON r.id=a.receipt_id WHERE a.sale_id=$1 AND r.payment_mode=$2 ORDER BY a.id',[saleId,mode]);
    const available = originalAvailable + allocations.rows.reduce((sum,row)=>sum+paise(row.amount)-paise(row.reversed),0);
    if (refund > available) throw new Error('Refund exceeds received payment in this method');
    const original = Math.min(refund,originalAvailable);
    const reversal = (await client.query('INSERT INTO payment_reversals(company_id,sale_id,created_by,request_key,request_hash,amount,payment_mode,reason,reference,original_amount) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[cid,saleId,actor.id,identity.key,identity.hash,amount(refund),mode,data.reason,data.reference || null,amount(original)])).rows[0];
    let remaining = refund-original;
    for (const allocation of allocations.rows) {
      const value = Math.min(remaining,paise(allocation.amount)-paise(allocation.reversed));
      if (value > 0) {
        await client.query('INSERT INTO reversal_allocations(reversal_id,receipt_allocation_id,amount) VALUES($1,$2,$3)',[reversal.id,allocation.id,amount(value)]);
        remaining -= value;
      }
      if (!remaining) break;
    }
    await client.query('UPDATE shops SET current_due=current_due+$1,updated_at=NOW() WHERE id=$2',[amount(refund),sale.shop_id]);
    await client.query("INSERT INTO audit_logs(company_id,actor_user_id,action,entity_type,entity_id) VALUES($1,$2,'PAYMENT_REFUNDED','payment_reversals',$3)",[cid,actor.id,reversal.id]);
    return {success:true,reversal};
  });
}
export async function settle(cid,data,actor) {
  if (!['OWNER','STORE_KEEPER'].includes(actor.role)) throw new Error('Forbidden');
  return transaction(async client => {
    const identity = await identityLock(client,cid,'settlement',data);
    const date = data.settlement_date || businessDate();
    const employeeId = Number(data.employee_id);
    if (!Number.isSafeInteger(employeeId) || employeeId<=0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Valid employee and business date required');
    const employee = await client.query('SELECT id FROM employees WHERE id=$1 AND company_id=$2 FOR UPDATE',[employeeId,cid]);
    if (!employee.rows.length) throw new Error('Employee not found');
    const existing = await client.query('SELECT * FROM settlements WHERE company_id=$1 AND employee_id=$2 AND settlement_date=$3',[cid,employeeId,date]);
    if (existing.rows.length) {
      if (existing.rows[0].request_key !== identity.key || existing.rows[0].request_hash !== identity.hash) throw new Error('Settlement already recorded; review existing settlement');
      return {success:true,settlement:existing.rows[0],isDuplicate:true};
    }
    const flow=await cashFlow(client,cid,employeeId,{start:date,end:date});
    const expenses=(await client.query('SELECT COALESCE(SUM(amount),0)::text AS total FROM expenses WHERE company_id=$1 AND employee_id=$2 AND expense_date=$3',[cid,employeeId,date])).rows[0].total;
    const expected=amount(Math.round(Number(flow.cash)*100)-paise(expenses));

    const collected = paise(data.collected_amount);
    const difference = collected-Math.round(Number(expected)*100);
    const result = await client.query('INSERT INTO settlements(company_id,employee_id,employee_name,settlement_date,expected_amount,collected_amount,difference,reason,remarks,status,request_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',[cid,employeeId,data.employee_name || null,date,expected,amount(collected),amount(difference),data.reason || null,data.remarks || null,difference===0?'BALANCED':difference>0?'SURPLUS':'DEFICIT',identity.key,identity.hash]);
    return {success:true,settlement:result.rows[0]};
  });
}
export async function cashFlow(client,cid,employeeId,{start=null,end=null,sessionId=null}={}) {
  const params=[cid,employeeId || null,start,end];
  const scoped = sessionId !== null;
  if (scoped) params.push(sessionId);
  const tripSales = scoped ? ' AND s.session_id=$5' : '';
  const tripEvent = scoped ? " AND EXISTS (SELECT 1 FROM driver_sessions ds WHERE ds.id=$5 AND ds.company_id=$1 AND ds.employee_id=$2 AND receipts.created_at>=ds.opened_at AND (ds.status NOT IN ('CLOSED','COMPLETED','RECONCILED','RETURN_VERIFIED') OR receipts.created_at<=ds.closed_at))" : '';
  const salesDate="($3::date IS NULL OR s.sale_date>=$3) AND ($4::date IS NULL OR s.sale_date<=$4)" + tripSales;
  const eventDate="($3::date IS NULL OR (created_at AT TIME ZONE 'Asia/Kolkata')::date>=$3) AND ($4::date IS NULL OR (created_at AT TIME ZONE 'Asia/Kolkata')::date<=$4)" + tripEvent;
  const result=await client.query(`WITH events AS (
    SELECT s.cash_paid AS cash,s.gpay_paid AS gpay FROM sales s
    WHERE s.company_id=$1 AND ($2::int IS NULL OR s.employee_id=$2) AND ${salesDate}
    UNION ALL
    SELECT CASE WHEN payment_mode='CASH' THEN amount ELSE 0 END,CASE WHEN payment_mode='GPAY' THEN amount ELSE 0 END
    FROM receipts WHERE company_id=$1 AND ($2::int IS NULL OR employee_id=$2) AND ${eventDate}
    UNION ALL
    SELECT CASE WHEN r.payment_mode='CASH' THEN -r.amount ELSE 0 END,CASE WHEN r.payment_mode='GPAY' THEN -r.amount ELSE 0 END
    FROM payment_reversals r JOIN sales s ON s.id=r.sale_id
    WHERE r.company_id=$1 AND ($2::int IS NULL OR s.employee_id=$2)
      AND ($3::date IS NULL OR (r.created_at AT TIME ZONE 'Asia/Kolkata')::date>=$3)
      AND ($4::date IS NULL OR (r.created_at AT TIME ZONE 'Asia/Kolkata')::date<=$4)${tripSales}
  ) SELECT COALESCE(SUM(cash),0)::text AS cash,COALESCE(SUM(gpay),0)::text AS gpay FROM events`,params);
  return result.rows[0];
}

