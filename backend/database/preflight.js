import { fileURLToPath } from 'node:url';
import { pool } from './pg_pool.js';

export async function preflight(target=pool) {
  const client=await target.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const checks=[
      ['duplicate_invoice_numbers','sales','SELECT COUNT(*)::int AS count FROM (SELECT 1 FROM sales GROUP BY company_id,bill_no HAVING COUNT(*)>1) duplicates'],
      ['duplicate_logins','user_accounts','SELECT COUNT(*)::int AS count FROM (SELECT 1 FROM user_accounts GROUP BY LOWER(TRIM(login_id)) HAVING COUNT(*)>1) duplicates'],
      ['negative_warehouse_stock','products','SELECT COUNT(*)::int AS count FROM products WHERE warehouse_stock_units<0 OR pieces_per_unit<=0'],
      ['negative_employee_stock','employee_stock','SELECT COUNT(*)::int AS count FROM employee_stock WHERE qty_units<0'],
      ['duplicate_employee_stock','employee_stock','SELECT COUNT(*)::int AS count FROM (SELECT 1 FROM employee_stock GROUP BY employee_id,product_id HAVING COUNT(*)>1) duplicates'],
      ['duplicate_settlements','settlements','SELECT COUNT(*)::int AS count FROM (SELECT 1 FROM settlements WHERE employee_id IS NOT NULL GROUP BY company_id,employee_id,settlement_date HAVING COUNT(*)>1) duplicates'],
      ['competing_sessions','driver_sessions',"SELECT COUNT(*)::int AS count FROM (SELECT 1 FROM driver_sessions WHERE status NOT IN ('CLOSED','COMPLETED','RECONCILED','RETURN_VERIFIED') GROUP BY company_id,employee_id HAVING COUNT(*)>1) duplicates"],
      ['orphan_sale_items','sale_items','SELECT COUNT(*)::int AS count FROM sale_items i WHERE NOT EXISTS(SELECT 1 FROM sales s WHERE s.id=i.sale_id)'],
      ['orphan_stock','employee_stock','SELECT COUNT(*)::int AS count FROM employee_stock st WHERE NOT EXISTS(SELECT 1 FROM employees e WHERE e.id=st.employee_id AND e.company_id=st.company_id) OR NOT EXISTS(SELECT 1 FROM products p WHERE p.id=st.product_id AND p.company_id=st.company_id)'],
    ];
    const results=[];
    for(const [name,table,sql] of checks) {
      const exists=await client.query('SELECT to_regclass($1) AS relation',[table]);
      if(!exists.rows[0].relation) { results.push({name,status:'ABSENT_ON_FRESH_INSTALL'}); continue; }
      const result=await client.query(sql);
      results.push({name,count:result.rows[0].count,status:result.rows[0].count?'REVIEW_REQUIRED':'PASS'});
    }
    await client.query('COMMIT');
    return results;
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  try { const result=await preflight(); console.log(JSON.stringify(result,null,2)); if(result.some(check=>check.status==='REVIEW_REQUIRED')) process.exitCode=1; }
  finally { await pool.end(); }
}
