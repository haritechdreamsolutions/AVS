import {validId} from './shop-balance-receipt.js';
export const freezerReceiptSQL=`
SELECT s.id shop_id,s.name shop_name,s.phone contact,f.id assignment_id,
 COALESCE(NULLIF(f.serial_no,''),'-') freezer_id,f.model_name freezer_type
FROM shops s
LEFT JOIN villages v ON v.id=s.village_id AND v.company_id=s.company_id
JOIN routes r ON r.id=COALESCE(v.route_id,s.route_id) AND r.company_id=s.company_id AND r.is_active=TRUE
JOIN shop_freezers f ON f.shop_id=s.id AND f.company_id=s.company_id
WHERE s.company_id=$1 AND r.id=$2 AND s.is_active=TRUE
UNION ALL
SELECT s.id,s.name,s.phone,NULL,COALESCE(NULLIF(s.freezer_serial,''),'-'),s.freezer_model
FROM shops s
LEFT JOIN villages v ON v.id=s.village_id AND v.company_id=s.company_id
JOIN routes r ON r.id=COALESCE(v.route_id,s.route_id) AND r.company_id=s.company_id AND r.is_active=TRUE
WHERE s.company_id=$1 AND r.id=$2 AND s.is_active=TRUE AND s.has_freezer=TRUE
AND NOT EXISTS(SELECT 1 FROM shop_freezers f WHERE f.shop_id=s.id AND f.company_id=s.company_id)
ORDER BY shop_name,shop_id,assignment_id`;
export function freezerReceiptHandler(query){
 return async(req,res,next)=>{
  if(!validId(req.params.routeId))return res.status(400).json({message:'Invalid route ID'});
  try{
   const routes=await query('SELECT id,name FROM routes WHERE id=$1 AND company_id=$2 AND is_active=TRUE',[req.params.routeId,req.session.companyId]);
   if(!routes.rows.length)return res.status(404).json({message:'Route not found'});
   const result=await query(freezerReceiptSQL,[req.session.companyId,req.params.routeId]);
   res.set('Cache-Control','no-store');res.json({route:routes.rows[0],rows:result.rows});
  }catch(e){next(e);}
 };
}
