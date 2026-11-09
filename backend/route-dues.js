import {validDates} from './shop-balance-receipt.js';
// current_due is the existing shop ledger balance maintained by billing,
// collections, refunds and returns. Keep NUMERIC arithmetic in PostgreSQL.
export const routeDuesSQL = `
WITH positive_shops AS (
 SELECT s.id,s.name,s.current_due,COALESCE(v.route_id,s.route_id) AS route_id
 FROM shops s LEFT JOIN villages v ON v.id=s.village_id AND v.company_id=s.company_id
 WHERE s.company_id=$1 AND s.current_due>0
 AND ($2::integer IS NULL OR COALESCE(v.route_id,s.route_id)=$2)
), totals AS (
 SELECT route_id,SUM(current_due) AS total FROM positive_shops GROUP BY route_id
), drivers AS (
 SELECT route_id,MIN(id) AS employee_id,
 string_agg(NULLIF(trim(full_name),''), ', ' ORDER BY full_name,id) AS driver_name
 FROM employees e WHERE company_id=$1 AND is_active=TRUE
 AND NOT EXISTS (SELECT 1 FROM route_assignments ra WHERE ra.route_id=e.route_id AND ra.assigned_date=CURRENT_DATE)
 GROUP BY route_id
 UNION ALL
 SELECT ra.route_id,MIN(e.id),
 string_agg(NULLIF(trim(e.full_name),''), ', ' ORDER BY e.full_name,e.id)
 FROM (SELECT DISTINCT route_id,employee_id FROM route_assignments WHERE assigned_date=CURRENT_DATE) ra
 JOIN employees e ON e.id=ra.employee_id AND e.company_id=$1 AND e.is_active=TRUE
 GROUP BY ra.route_id
)
SELECT r.id,r.name,d.employee_id AS driver_id,d.driver_name,
 FALSE AS assignment_error,
 COALESCE(t.total,0)::text AS total,
 CASE WHEN $2::integer IS NULL THEN '[]'::json ELSE
 COALESCE((SELECT json_agg(json_build_object('id',p.id,'name',p.name,'balance',p.current_due::text) ORDER BY p.name,p.id)
 FROM positive_shops p WHERE p.route_id=r.id),'[]'::json) END AS shops
FROM routes r
LEFT JOIN totals t ON t.route_id=r.id
LEFT JOIN drivers d ON d.route_id=r.id
WHERE r.company_id=$1 AND r.is_active=TRUE AND ($2::integer IS NULL OR r.id=$2)
ORDER BY r.code,r.name,r.id`;

export function routeDuesHandler(query) {
 return async (req,res,next) => {
  const raw=req.params.routeId;
  if(raw!==undefined && (!/^[1-9]\d*$/.test(raw) || BigInt(raw)>2147483647n))
   return res.status(400).json({message:'Invalid route ID'});
  try {
   const {from,to}=req.query||{};
   if((from||to)&&(!raw||!validDates(from,to)))return res.status(400).json({message:'Valid route and inclusive date range required'});
   const {rows}=await query(from?datedRouteDuesSQL:routeDuesSQL,[req.session.companyId,raw===undefined?null:Number(raw),...(from?[from,to]:[])]);
   res.set('Cache-Control','no-store');
   if(raw!==undefined && !rows.length) return res.status(404).json({message:'Route not found'});
   return res.json(raw===undefined?rows:{...rows[0],...(from?{from,to}:{})});
  } catch(error) { next(error); }
 };
}

// Allocate legacy collections across the complete ledger first, then select bill
// dates. This prevents an old collection being deducted again in each range.
const datedShops = `WITH route_shops AS (
 SELECT s.*,COALESCE(v.route_id,s.route_id) report_route_id FROM shops s
 LEFT JOIN villages v ON v.id=s.village_id AND v.company_id=s.company_id
 WHERE s.company_id=$1 AND COALESCE(v.route_id,s.route_id)=$2
), entries AS (
 SELECT sh.id shop_id,0 id,NULL::date date,
 CASE WHEN sh.ledger_ready THEN sh.opening_due_remaining ELSE sh.opening_balance END outstanding
 FROM route_shops sh
 UNION ALL
 SELECT sh.id,s.id,s.sale_date,
 s.credit_paid-COALESCE(a.allocated,0)+COALESCE(p.refunded,0)
 FROM route_shops sh JOIN sales s ON s.shop_id=sh.id AND s.company_id=$1
 LEFT JOIN LATERAL (SELECT SUM(amount) allocated FROM receipt_allocations WHERE sale_id=s.id) a ON TRUE
 LEFT JOIN LATERAL (SELECT SUM(amount) refunded FROM payment_reversals WHERE sale_id=s.id AND company_id=$1) p ON TRUE
 WHERE s.status='ACTIVE'
), collections AS (
 SELECT sh.id,COALESCE(SUM(s.old_credit_paid),0) paid FROM route_shops sh
 LEFT JOIN sales s ON s.shop_id=sh.id AND s.company_id=$1 AND s.status='ACTIVE' GROUP BY sh.id
), remaining AS (
 SELECT e.*,GREATEST(0,e.outstanding-GREATEST(0,c.paid-
 COALESCE(SUM(e.outstanding) OVER(PARTITION BY e.shop_id ORDER BY e.date NULLS FIRST,e.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0))) balance
 FROM entries e JOIN collections c ON c.id=e.shop_id
), positive_shops AS (
 SELECT sh.id,sh.name,sh.report_route_id route_id,SUM(r.balance) current_due
 FROM route_shops sh JOIN remaining r ON r.shop_id=sh.id
 WHERE r.date BETWEEN $3::date AND $4::date
 GROUP BY sh.id,sh.name,sh.report_route_id HAVING SUM(r.balance)>0
)`;
export const datedRouteDuesSQL = datedShops + routeDuesSQL.slice(routeDuesSQL.indexOf(', totals AS'));
