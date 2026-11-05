import { getTrayVolume } from '../shared/productVolume.js';

// EXISTS prevents repeated accepted returns from duplicating a session's sales.
export const routeSalesSQL = `
 SELECT s.id AS sale_id, s.shop_id, COALESCE(s.shop_name,sh.name,'Shop') AS shop_name,
 COALESCE(s.sale_date::text,to_char(s.created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD')) AS date,
 ds.route_id, si.product_id, si.product_name, si.qty, si.unit_type,
 si.stock_qty_units, si.conversion_to_base, p.pack_size,p.pieces_per_unit,c.name AS category_name
 FROM sales s
 JOIN driver_sessions ds ON ds.id=s.session_id AND ds.company_id=s.company_id
 JOIN sale_items si ON si.sale_id=s.id
 LEFT JOIN products p ON p.id=si.product_id AND p.company_id=s.company_id
 LEFT JOIN categories c ON c.id=p.category_id AND c.company_id=p.company_id
 LEFT JOIN shops sh ON sh.id=s.shop_id AND sh.company_id=s.company_id
 WHERE s.company_id=$1 AND COALESCE(s.status,'ACTIVE')!='CANCELLED'
 AND p.id IS NOT NULL AND p.deleted_at IS NULL
 AND EXISTS (SELECT 1 FROM driver_returns dr WHERE dr.company_id=s.company_id
   AND dr.session_id=s.session_id AND dr.status IN ('VERIFIED','ACCEPTED')
   AND dr.checked_at IS NOT NULL AND dr.checked_by IS NOT NULL)
 AND ($2::integer IS NULL OR ds.route_id=$2)
 ORDER BY date DESC,s.id,si.id`;

export function buildRouteSales(lines) {
 const grouped=new Map();
 for(const line of lines){
  // Shop identity, rather than a bill's name snapshot, merges repeat trips.
  const key=JSON.stringify([line.route_id,line.date,line.shop_id ?? line.shop_name]);
  if(!grouped.has(key))grouped.set(key,{route_id:line.route_id,date:line.date,shop_id:line.shop_id,shop_name:line.shop_name,products:{},litres:0});
  const row=grouped.get(key),pid=String(line.product_id);
  const volume=getTrayVolume(line),qty=Number(line.qty)||0;
  const ppu=Number(line.conversion_to_base)||Number(line.pieces_per_unit)||1;
  const isPiece=/^(piece|pieces|pcs|pc|packet|pouches|pouch)$/i.test(line.unit_type||'');
  const pieces=isPiece?qty:Math.round(Number(line.stock_qty_units ?? qty)*ppu);
  const litres=volume ? pieces*volume.pieceMl/1000 : 0;
  const cell=row.products[pid] ||= {qty:0,unit:volume?'Pcs':line.unit_type||'',litres:0,isTray:!!volume};
  cell.qty+=volume?pieces:qty;cell.litres+=litres;row.litres+=litres;
 }
 return [...grouped.values()];
}

export function routeSalesHandler(query){
 return async(req,res,next)=>{
  const raw=req.params.routeId;
  if(raw!==undefined&&(!/^[1-9]\d*$/.test(raw)||BigInt(raw)>2147483647n))return res.status(400).json({message:'Invalid route ID'});
  try{
   const cid=req.session.companyId;
   const {rows:routes}=await query('SELECT id,name FROM routes WHERE company_id=$1 AND is_active=TRUE ORDER BY code,name,id',[cid]);
   const route=routes.find(r=>String(r.id)===raw);
   if(raw!==undefined&&!route)return res.status(404).json({message:'Route not found'});
   const {rows:lines}=await query(routeSalesSQL,[cid,raw===undefined?null:Number(raw)]);
   const rows=buildRouteSales(lines);
   res.set('Cache-Control','no-store');
   if(raw===undefined){
    const totals=new Map();for(const r of rows)totals.set(String(r.route_id),(totals.get(String(r.route_id))||0)+r.litres);
    return res.json(routes.map(r=>({...r,litres:totals.get(String(r.id))||0})));
   }
   const {rows:products}=await query("SELECT id,COALESCE(NULLIF(display_name,''),name) AS name,pack_size FROM products WHERE company_id=$1 AND deleted_at IS NULL ORDER BY id",[cid]);
   return res.json({route,products,rows});
  }catch(error){next(error);}
 };
}
