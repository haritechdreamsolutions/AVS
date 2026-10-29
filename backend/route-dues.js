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
), fallback AS (
 SELECT route_id,COUNT(*) AS count,MIN(id) AS employee_id
 FROM employees WHERE company_id=$1 AND is_active=TRUE GROUP BY route_id
)
SELECT r.id,r.name,e.id AS driver_id,e.full_name AS driver_name,
 (ra.employee_id IS NULL AND COALESCE(f.count,0)>1) AS assignment_error,
 COALESCE(t.total,0)::text AS total,
 CASE WHEN $2::integer IS NULL THEN '[]'::json ELSE
 COALESCE((SELECT json_agg(json_build_object('id',p.id,'name',p.name,'balance',p.current_due::text) ORDER BY p.name,p.id)
 FROM positive_shops p WHERE p.route_id=r.id),'[]'::json) END AS shops
FROM routes r
LEFT JOIN totals t ON t.route_id=r.id
LEFT JOIN route_assignments ra ON ra.route_id=r.id AND ra.assigned_date=CURRENT_DATE
LEFT JOIN fallback f ON f.route_id=r.id
LEFT JOIN employees e ON e.id=COALESCE(ra.employee_id,CASE WHEN f.count=1 THEN f.employee_id END) AND e.company_id=$1
WHERE r.company_id=$1 AND r.is_active=TRUE AND ($2::integer IS NULL OR r.id=$2)
ORDER BY r.code,r.name,r.id`;

export function routeDuesHandler(query) {
 return async (req,res,next) => {
  const raw=req.params.routeId;
  if(raw!==undefined && (!/^[1-9]\d*$/.test(raw) || BigInt(raw)>2147483647n))
   return res.status(400).json({message:'Invalid route ID'});
  try {
   const {rows}=await query(routeDuesSQL,[req.session.companyId,raw===undefined?null:Number(raw)]);
   res.set('Cache-Control','no-store');
   if(raw!==undefined && !rows.length) return res.status(404).json({message:'Route not found'});
   return res.json(raw===undefined?rows:rows[0]);
  } catch(error) { next(error); }
 };
}
