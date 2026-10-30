import { businessDate } from './financial.js';

export function validId(value) { return /^[1-9]\d*$/.test(String(value)) && BigInt(value)<=2147483647n; }
export function validDates(from,to) {
 const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'') && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;
 return valid(from)&&valid(to)&&from<=to;
}
// Single statement: every financial input belongs to the same PostgreSQL snapshot.
export const receiptSQL = `
WITH shop AS (
 SELECT s.* FROM shops s LEFT JOIN villages v ON v.id=s.village_id AND v.company_id=s.company_id
 JOIN routes r ON r.id=COALESCE(v.route_id,s.route_id) AND r.company_id=s.company_id AND r.is_active=TRUE
 WHERE s.company_id=$1 AND s.id=$3 AND s.is_active=TRUE AND r.id=$2
), bills AS (
 SELECT s.id,s.sale_date,s.credit_paid,
 s.credit_paid-COALESCE(a.allocated,0)+COALESCE(p.refunded,0) AS outstanding,
 COALESCE(q.milk,0) AS milk,COALESCE(q.curd,0) AS curd
 FROM sales s JOIN shop sh ON sh.id=s.shop_id AND sh.company_id=s.company_id
 LEFT JOIN LATERAL (SELECT SUM(amount) allocated FROM receipt_allocations WHERE sale_id=s.id) a ON TRUE
 LEFT JOIN LATERAL (SELECT SUM(amount) refunded FROM payment_reversals WHERE sale_id=s.id AND company_id=$1) p ON TRUE
 LEFT JOIN LATERAL (
 SELECT SUM(CASE WHEN lower(COALESCE(c.name,'')||' '||p.name) LIKE '%milk%' THEN
 CASE WHEN lower(si.unit_type)=lower(p.base_unit) THEN si.qty
 WHEN si.conversion_to_base IS NOT NULL THEN si.qty*si.conversion_to_base ELSE si.qty*p.pieces_per_unit END ELSE 0 END) milk,
 SUM(CASE WHEN lower(COALESCE(c.name,'')||' '||p.name) LIKE '%curd%' THEN
 CASE WHEN lower(si.unit_type)=lower(p.base_unit) THEN si.qty
 WHEN si.conversion_to_base IS NOT NULL THEN si.qty*si.conversion_to_base ELSE si.qty*p.pieces_per_unit END ELSE 0 END) curd
 FROM sale_items si JOIN products p ON p.id=si.product_id AND p.company_id=$1
 LEFT JOIN categories c ON c.id=p.category_id
 WHERE si.sale_id=s.id
 ) q ON TRUE
 WHERE s.status='ACTIVE'
), inputs AS (
 SELECT sh.*,
 CASE WHEN sh.ledger_ready THEN sh.opening_due_remaining ELSE sh.opening_balance END AS opening,
 COALESCE((SELECT SUM(old_credit_paid) FROM sales WHERE company_id=$1 AND shop_id=$3 AND status='ACTIVE'),0) AS old_paid
 FROM shop sh
), entries AS (
 SELECT 0 AS id,NULL::date AS date,opening AS outstanding,0::numeric AS milk,0::numeric AS curd FROM inputs
 UNION ALL SELECT id,sale_date,outstanding,milk,curd FROM bills
), fifo AS (
 SELECT *,GREATEST(0,outstanding-GREATEST(0,(SELECT old_paid FROM inputs)-
 COALESCE(SUM(outstanding) OVER (ORDER BY date NULLS FIRST,id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0))) AS remaining FROM entries
), daily AS (
 SELECT date,SUM(remaining) balance,SUM(CASE WHEN remaining>0 THEN milk ELSE 0 END) milk,
 SUM(CASE WHEN remaining>0 THEN curd ELSE 0 END) curd FROM fifo GROUP BY date
)
SELECT i.name,i.current_due::text,
 ((SELECT COALESCE(SUM(remaining),0) FROM fifo)=i.current_due AND NOT EXISTS(SELECT 1 FROM entries WHERE outstanding<0)) AS reconciled,
 COALESCE((SELECT json_agg(json_build_object('date',date,'milk',milk::text,'curd',curd::text,'balance',balance::text) ORDER BY date NULLS FIRST)
 FROM daily WHERE date IS NULL OR date BETWEEN $4::date AND $5::date),'[]'::json) rows,
 (SELECT COALESCE(SUM(balance),0)::text FROM daily WHERE date IS NULL OR date BETWEEN $4::date AND $5::date) total
FROM inputs i`;

export function shopBalanceHandlers(query) {
 const error=(res,status,message)=>res.status(status).json({message});
 return {
 routes: async(req,res,next)=>{try {
  res.set('Cache-Control','no-store');
  res.json((await query('SELECT id,name FROM routes WHERE company_id=$1 AND is_active=TRUE ORDER BY name,id',[req.session.companyId])).rows);
 }catch(e){next(e);}},
 shops: async(req,res,next)=>{try {
  if(!validId(req.params.routeId))return error(res,400,'Invalid route ID');
  const rows=(await query(`SELECT s.id,s.name FROM shops s
  LEFT JOIN villages v ON v.id=s.village_id AND v.company_id=s.company_id
  JOIN routes r ON r.id=COALESCE(v.route_id,s.route_id) AND r.company_id=s.company_id
  WHERE s.company_id=$1 AND r.id=$2 AND r.is_active=TRUE AND s.is_active=TRUE ORDER BY s.name,s.id`,[req.session.companyId,req.params.routeId])).rows;
  res.set('Cache-Control','no-store');res.json(rows);
 }catch(e){next(e);}},
 details: async(req,res,next)=>{try {
  const {routeId,shopId}=req.query;
  const from=req.query.from||'0001-01-01',to=req.query.to||'9999-12-31';
  if(!validId(routeId)||!validId(shopId)||!validDates(from,to))return error(res,400,'Valid route, shop and inclusive date range required');
  const row=(await query(receiptSQL,[req.session.companyId,routeId,shopId,from,to])).rows[0];
  if(!row)return error(res,404,'Shop not found in selected active route');
  if(!row.reconciled)return error(res,409,'Reconciliation required: invoice history does not match the shop balance. No receipt can be generated.');
  res.set('Cache-Control','no-store');res.json({...row,business_date:businessDate()});
 }catch(e){next(e);}}
 };
}
