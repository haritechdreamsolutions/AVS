import { pool } from './database/pg_pool.js';
import { paise, amount } from './financial.js';

export async function salesReport(cid, filters = {}, target = pool) {
  const params = [cid];
  const conditions = ["s.company_id=$1", "s.status IS DISTINCT FROM 'CANCELLED'"];
  const parameter = value => { params.push(value); return '$' + params.length; };
  for (const [key, comparison] of [['from','>='],['to','<=']]) {
    if (filters[key]) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(filters[key])) throw new Error('Invalid business date');
      conditions.push('s.sale_date' + comparison + parameter(filters[key]) + '::date');
    }
  }
  if (filters.from && filters.to && filters.from > filters.to) throw new Error('Invalid date range');
  if (filters.employee_id && filters.employee_id !== 'ALL') conditions.push('s.employee_id=' + parameter(filters.employee_id));
  if (filters.shop_id && filters.shop_id !== 'ALL') conditions.push('s.shop_id=' + parameter(filters.shop_id));
  if (filters.payment_mode && filters.payment_mode !== 'ALL') {
    if (!['CASH','GPAY','CREDIT','SPLIT'].includes(filters.payment_mode)) throw new Error('Invalid payment filter');
    conditions.push('s.payment_mode=' + parameter(filters.payment_mode));
  }
  for (const [key,comparison] of [['min_amount','>='],['max_amount','<=']]) if (filters[key] !== undefined && filters[key] !== '') conditions.push('s.total_amount' + comparison + parameter(amount(paise(filters[key]))) + '::numeric');
  if (filters.source === 'DIRECT') conditions.push('s.employee_id IS NULL');
  if (filters.source === 'ROUTE') conditions.push('s.employee_id IS NOT NULL');
  if (filters.search?.trim()) {
    if (filters.search.length > 100) throw new Error('Search is too long');
    const match = parameter('%' + filters.search.trim() + '%');
    conditions.push('(s.bill_no ILIKE ' + match + ' OR s.shop_name ILIKE ' + match + ' OR s.employee_name ILIKE ' + match + ' OR s.shop_id::text ILIKE ' + match + ')');
  }
  const exporting = filters.export === 'pdf';
  const page = exporting ? 1 : Number(filters.page || 1), pageSize = exporting ? 10000 : Number(filters.page_size || 100);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > (exporting ? 10000 : 100)) throw new Error('Invalid pagination');
  const status = filters.payment_status || 'ALL';
  if (!['ALL','PAID','PARTIAL','CREDIT'].includes(status)) throw new Error('Invalid payment status');
  const statusSql = status === 'PAID' ? 'balance_amount=0' : status === 'CREDIT' ? 'balance_amount>0 AND received_amount=0' : status === 'PARTIAL' ? 'balance_amount>0 AND received_amount>0' : 'TRUE';
  const cte = "WITH allocated AS (SELECT a.sale_id,SUM(a.amount) AS value FROM receipt_allocations a JOIN receipts r ON r.id=a.receipt_id WHERE r.company_id=$1 GROUP BY a.sale_id), refunded AS (SELECT sale_id,SUM(amount) AS value FROM payment_reversals WHERE company_id=$1 GROUP BY sale_id), filtered AS (SELECT s.*,s.employee_id IS NULL AS is_store_direct_sale,s.cash_paid+s.gpay_paid+COALESCE(a.value,0)-COALESCE(r.value,0) AS received_amount,s.credit_paid-COALESCE(a.value,0)+COALESCE(r.value,0) AS balance_amount FROM sales s LEFT JOIN allocated a ON a.sale_id=s.id LEFT JOIN refunded r ON r.sale_id=s.id WHERE " + conditions.join(' AND ') + '), matching AS (SELECT * FROM filtered WHERE ' + statusSql + ') ';

  const connection = await target.connect();
  try {
    await connection.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const totals = await connection.query(cte + 'SELECT COUNT(*)::int AS "totalBills",COALESCE(SUM(total_amount),0) AS "totalRevenue",COALESCE(SUM(received_amount),0) AS "totalReceived",COALESCE(SUM(balance_amount),0) AS "totalBalance",COALESCE(SUM(total_amount) FILTER(WHERE employee_id IS NULL),0) AS "storeRevenue",COALESCE(SUM(total_amount) FILTER(WHERE employee_id IS NOT NULL),0) AS "driverRevenue" FROM matching',params);
    if (exporting && totals.rows[0].totalBills > pageSize) throw new Error('PDF export exceeds 10000 bills. Select a smaller date range.');
    const rows = await connection.query(cte + 'SELECT * FROM matching ORDER BY sale_date DESC,id DESC LIMIT $' + (params.length+1) + ' OFFSET $' + (params.length+2),[...params,pageSize,(page-1)*pageSize]);
    await connection.query('COMMIT');
    return {rows:rows.rows,metrics:Object.fromEntries(Object.entries(totals.rows[0]).map(([key,value])=>[key,Number(value)])),page,page_size:pageSize};
  } catch (error) { await connection.query('ROLLBACK'); throw error; }
  finally { connection.release(); }
}
