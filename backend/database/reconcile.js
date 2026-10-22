import { fileURLToPath } from 'node:url';
import { pool } from './pg_pool.js';

export async function reconcile(companyId,target=pool) {
  if(!Number.isSafeInteger(companyId) || companyId<=0)throw new Error('Explicit company ID required');
  const client=await target.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    if(!(await client.query('SELECT id FROM companies WHERE id=$1',[companyId])).rows.length)throw new Error('Company not found');
    const results=[];
    async function check(name,sql) {
      const count=Number((await client.query(sql,[companyId])).rows[0].count);
      results.push({name,count,status:count?'REVIEW_REQUIRED':'PASS'});
    }
    await check('unapproved_shop_opening_balances','SELECT COUNT(*) AS count FROM shops WHERE company_id=$1 AND ledger_ready IS NOT TRUE');
    await check('shop_due_mismatches',`WITH allocated AS (SELECT sale_id,SUM(amount) AS amount FROM receipt_allocations GROUP BY sale_id), refunded AS (SELECT sale_id,SUM(amount) AS amount FROM payment_reversals WHERE company_id=$1 GROUP BY sale_id), outstanding AS (
      SELECT s.shop_id,SUM(s.credit_paid-COALESCE(a.amount,0)+COALESCE(r.amount,0)) AS amount FROM sales s LEFT JOIN allocated a ON a.sale_id=s.id LEFT JOIN refunded r ON r.sale_id=s.id WHERE s.company_id=$1 AND s.status IS DISTINCT FROM 'CANCELLED' GROUP BY s.shop_id)
      SELECT COUNT(*) AS count FROM shops sh LEFT JOIN outstanding o ON o.shop_id=sh.id WHERE sh.company_id=$1 AND sh.ledger_ready=TRUE AND sh.current_due<>sh.opening_due_remaining+COALESCE(o.amount,0)`);
    await check('incomplete_receipt_allocations',`SELECT COUNT(*) AS count FROM receipts r LEFT JOIN (SELECT receipt_id,SUM(amount) AS amount FROM receipt_allocations GROUP BY receipt_id) a ON a.receipt_id=r.id WHERE r.company_id=$1 AND r.amount<>COALESCE(a.amount,0)`);
    await check('cross_shop_receipt_allocations',`SELECT COUNT(*) AS count FROM receipt_allocations a JOIN receipts r ON r.id=a.receipt_id JOIN sales s ON s.id=a.sale_id WHERE r.company_id=$1 AND (s.company_id<>r.company_id OR s.shop_id<>r.shop_id)`);
    await check('incomplete_refund_allocations',`SELECT COUNT(*) AS count FROM payment_reversals r LEFT JOIN (SELECT reversal_id,SUM(amount) AS amount FROM reversal_allocations GROUP BY reversal_id) a ON a.reversal_id=r.id WHERE r.company_id=$1 AND r.amount<>r.original_amount+COALESCE(a.amount,0)`);
    await check('legacy_invoices_without_financial_history','SELECT COUNT(*) AS count FROM sales WHERE company_id=$1 AND financial_version=0');
    await check('negative_stock','SELECT (SELECT COUNT(*) FROM products WHERE company_id=$1 AND warehouse_stock_units<0)+(SELECT COUNT(*) FROM employee_stock WHERE company_id=$1 AND qty_units<0) AS count');
    await check('stock_ledger_units_requiring_review',`SELECT COUNT(*) AS count FROM stock_transactions st JOIN products p ON p.id=st.product_id WHERE st.company_id=$1 AND (st.unit IS NULL OR LOWER(st.unit)<>LOWER(p.selling_unit) OR st.transaction_type NOT IN ('ALLOCATION','SALE','GOOD_RETURN','DAMAGE','SHORTAGE'))`);
    await check('employee_stock_ledger_mismatches',`WITH ledger AS (
      SELECT st.employee_id,st.product_id,SUM(CASE WHEN st.transaction_type='ALLOCATION' THEN st.qty_units ELSE -st.qty_units END) AS balance,
        BOOL_AND(st.unit IS NOT NULL AND LOWER(st.unit)=LOWER(p.selling_unit) AND st.transaction_type IN ('ALLOCATION','SALE','GOOD_RETURN','DAMAGE','SHORTAGE')) AS comparable
      FROM stock_transactions st JOIN products p ON p.id=st.product_id WHERE st.company_id=$1 AND st.employee_id IS NOT NULL GROUP BY st.employee_id,st.product_id)
      SELECT COUNT(*) AS count FROM ledger l FULL JOIN (SELECT * FROM employee_stock WHERE company_id=$1) es ON es.employee_id=l.employee_id AND es.product_id=l.product_id WHERE (l.comparable OR l.comparable IS NULL) AND ABS(COALESCE(l.balance,0)-COALESCE(es.qty_units,0))>0.00000001`);
    results.push({name:'historical_warehouse_opening_and_physical_counts',status:'NOT_VERIFIED',reason:'Requires approved opening counts, complete warehouse movement history and physical stock sign-off; no automatic backfill is safe.'});
    await client.query('COMMIT');
    return results;
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally {client.release();}
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  if(!process.argv.includes('--read-only'))throw new Error('Use --read-only with an explicit AVS_RECONCILE_COMPANY_ID on an approved restored copy');
  try {
    const result=await reconcile(Number(process.env.AVS_RECONCILE_COMPANY_ID));
    console.log(JSON.stringify(result,null,2));
    if(result.some(row=>row.status!=='PASS'))process.exitCode=1;
  } finally {await pool.end();}
}
