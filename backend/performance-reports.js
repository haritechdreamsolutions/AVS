import { pool } from './database/pg_pool.js';

const range = column => `($2::date IS NULL OR ${column}>=$2) AND ($3::date IS NULL OR ${column}<=$3)`;
const events = `events AS (
  SELECT employee_id,shop_id,cash_paid AS cash,gpay_paid AS gpay FROM sales WHERE company_id=$1 AND ${range('sale_date')}
  UNION ALL SELECT employee_id,shop_id,CASE WHEN payment_mode='CASH' THEN amount ELSE 0 END,CASE WHEN payment_mode='GPAY' THEN amount ELSE 0 END FROM receipts WHERE company_id=$1 AND ${range("(created_at AT TIME ZONE 'Asia/Kolkata')::date")}
  UNION ALL SELECT s.employee_id,s.shop_id,CASE WHEN r.payment_mode='CASH' THEN -r.amount ELSE 0 END,CASE WHEN r.payment_mode='GPAY' THEN -r.amount ELSE 0 END FROM payment_reversals r JOIN sales s ON s.id=r.sale_id AND s.company_id=r.company_id WHERE r.company_id=$1 AND ${range("(r.created_at AT TIME ZONE 'Asia/Kolkata')::date")}
), active_sales AS (SELECT * FROM sales WHERE company_id=$1 AND status IS DISTINCT FROM 'CANCELLED' AND ${range('sale_date')})`;
const numericRows = (rows,keys) => rows.map(row=>({...row,...Object.fromEntries(keys.map(key=>[key,Number(row[key] || 0)]))}));

export async function driverPerformance(cid,{start=null,end=null}={},target=pool) {
  const result=await target.query(`WITH ${events},
    sold AS (SELECT employee_id,COUNT(*) AS total_bills,SUM(total_amount) AS total_sales,SUM(credit_paid) AS credit_sales FROM active_sales GROUP BY employee_id),
    flow AS (SELECT employee_id,SUM(cash) AS cash_collected,SUM(gpay) AS gpay_collected FROM events GROUP BY employee_id),
    spent AS (SELECT employee_id,SUM(amount) AS total_expenses FROM expenses WHERE company_id=$1 AND ${range('expense_date')} GROUP BY employee_id),
    returned AS (SELECT employee_id,SUM(total_accepted_good) AS total_good_returns FROM driver_returns WHERE company_id=$1 AND ${range("(created_at AT TIME ZONE 'Asia/Kolkata')::date")} GROUP BY employee_id),
    damaged AS (SELECT employee_id,SUM(damage_cost) AS total_damage_cost,SUM(base_quantity) AS total_damage_pieces FROM damages WHERE company_id=$1 AND ${range("(created_at AT TIME ZONE 'Asia/Kolkata')::date")} GROUP BY employee_id),
    worked AS (SELECT employee_id,COUNT(DISTINCT session_date) AS working_days FROM driver_sessions WHERE company_id=$1 AND ${range('session_date')} GROUP BY employee_id),
    quantities AS (SELECT s.employee_id,SUM(i.qty) AS total_quantity_sold FROM sale_items i JOIN active_sales s ON s.id=i.sale_id GROUP BY s.employee_id)
    SELECT e.id AS driver_id,e.full_name AS driver_name,COALESCE(e.vehicle_number,'Route Vehicle') AS vehicle_number,COALESCE(r.name,'Assigned Route') AS route_name,
      sold.total_bills,sold.total_sales,sold.credit_sales,flow.cash_collected,flow.gpay_collected,spent.total_expenses,returned.total_good_returns,damaged.total_damage_cost,damaged.total_damage_pieces,worked.working_days,quantities.total_quantity_sold,
      COALESCE(sold.total_sales,0)-COALESCE(spent.total_expenses,0)-COALESCE(damaged.total_damage_cost,0) AS net_financial_contribution
    FROM employees e LEFT JOIN routes r ON r.id=e.route_id AND r.company_id=e.company_id
    LEFT JOIN sold ON sold.employee_id=e.id LEFT JOIN flow ON flow.employee_id=e.id LEFT JOIN spent ON spent.employee_id=e.id LEFT JOIN returned ON returned.employee_id=e.id LEFT JOIN damaged ON damaged.employee_id=e.id LEFT JOIN worked ON worked.employee_id=e.id LEFT JOIN quantities ON quantities.employee_id=e.id
    WHERE e.company_id=$1 AND e.is_active=TRUE ORDER BY COALESCE(sold.total_sales,0) DESC`,[cid,start,end]);
  return numericRows(result.rows,['working_days','total_bills','total_sales','cash_collected','gpay_collected','credit_sales','total_expenses','total_good_returns','total_damage_cost','total_damage_pieces','total_quantity_sold','net_financial_contribution']);
}

export async function routePerformance(cid,{start=null,end=null}={},target=pool) {
  const result=await target.query(`WITH ${events},
    villages_count AS (SELECT route_id,COUNT(*) AS villages_count FROM villages WHERE company_id=$1 GROUP BY route_id),
    shop_stats AS (SELECT route_id,COUNT(*) AS total_shops,COUNT(*) FILTER(WHERE is_active=TRUE) AS active_shops,SUM(current_due) AS outstanding_dues FROM shops WHERE company_id=$1 GROUP BY route_id),
    sold AS (SELECT sh.route_id,COUNT(*) AS total_bills,SUM(s.total_amount) AS total_sales,SUM(s.credit_paid) AS credit_sales FROM active_sales s JOIN shops sh ON sh.id=s.shop_id AND sh.company_id=s.company_id GROUP BY sh.route_id),
    flow AS (SELECT sh.route_id,SUM(e.cash) AS cash_collected,SUM(e.gpay) AS gpay_collected FROM events e JOIN shops sh ON sh.id=e.shop_id AND sh.company_id=$1 GROUP BY sh.route_id),
    quantities AS (SELECT sh.route_id,SUM(i.qty) AS total_quantity_sold FROM sale_items i JOIN active_sales s ON s.id=i.sale_id JOIN shops sh ON sh.id=s.shop_id AND sh.company_id=s.company_id GROUP BY sh.route_id)
    SELECT r.id AS route_id,r.code AS route_code,r.name AS route_name,v.villages_count,sh.total_shops,sh.active_shops,sh.outstanding_dues,sold.total_bills,sold.total_sales,sold.credit_sales,flow.cash_collected,flow.gpay_collected,quantities.total_quantity_sold
    FROM routes r LEFT JOIN villages_count v ON v.route_id=r.id LEFT JOIN shop_stats sh ON sh.route_id=r.id LEFT JOIN sold ON sold.route_id=r.id LEFT JOIN flow ON flow.route_id=r.id LEFT JOIN quantities ON quantities.route_id=r.id
    WHERE r.company_id=$1 ORDER BY COALESCE(sold.total_sales,0) DESC`,[cid,start,end]);
  return numericRows(result.rows,['villages_count','total_shops','active_shops','outstanding_dues','total_bills','total_sales','cash_collected','gpay_collected','credit_sales','total_quantity_sold']);
}
