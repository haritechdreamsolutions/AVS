import {companyProductActive} from '../shared/supplierProducts.js';
import {uploadedProductImage} from './product-image.js';
import {pool} from './database/pg_pool.js';
import {paise,amount,retryTransaction} from './financial.js';
import {randomUUID} from 'node:crypto';

async function transaction(work){return retryTransaction(async()=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await work(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}});}
async function audit(c,cid,actor,action,id,metadata={}){await c.query('INSERT INTO audit_logs(company_id,actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5,$6)',[cid,actor,action,'suppliers',id,JSON.stringify(metadata)]);}
export function purchaseRates(value){
 const obj=value&&typeof value==='object'?value:{tray_rate:value};
 const tray=paise(obj.tray_rate??obj.rate??0);
 const piece=obj.piece_rate===undefined||obj.piece_rate===''?null:paise(obj.piece_rate);
 return {tray_rate:Number(amount(tray)),...(piece===null?{}:{piece_rate:Number(amount(piece))}),is_active:obj.is_active!==false,...(Object.hasOwn(obj,'image_url')?{image_url:uploadedProductImage(obj.image_url)}:{})};
}
async function lockedSupplier(c,cid,id){const row=(await c.query('SELECT * FROM suppliers WHERE company_id=$1 AND id=$2 AND is_active=TRUE FOR UPDATE',[cid,id])).rows[0];if(!row)throw Error('Company not found or inactive');return row;}
async function saveRates(c,cid,supplierId,rates){
 const clean={};
 const entries=Object.entries(rates||{});
 for(const [id,value] of entries){
  if(!/^[1-9]\d*$/.test(id))throw Error('Invalid company product');
  clean[id]=purchaseRates(value);
 }
 const ids=Object.keys(clean).map(Number);
 if(ids.length){
  const found=await c.query('SELECT id FROM products WHERE company_id=$1 AND id=ANY($2::int[])',[cid,ids]);
  if(found.rows.length!==ids.length)throw Error('Company product is unavailable');
 }
 await c.query('DELETE FROM supplier_product_rates WHERE company_id=$1 AND supplier_id=$2',[cid,supplierId]);
 if(ids.length)await c.query(`INSERT INTO supplier_product_rates(company_id,supplier_id,product_id,buy_rate)
  SELECT $1,$2,r.product_id,r.buy_rate FROM jsonb_to_recordset($3::jsonb) AS r(product_id integer,buy_rate numeric)`,
  [cid,supplierId,JSON.stringify(ids.map(id=>({product_id:id,buy_rate:clean[id].tray_rate})))]);
 return (await c.query('UPDATE suppliers SET product_rates=$1::jsonb,updated_at=NOW() WHERE id=$2 AND company_id=$3 RETURNING *',[JSON.stringify(clean),supplierId,cid])).rows[0];
}
export async function saveCompany(cid,id,data,actor){return transaction(async c=>{
 const old=id?await lockedSupplier(c,cid,id):{};
 const name=String(data.name??old.name??'').trim();if(!name||name.length>150)throw Error('Company name is required (maximum 150 characters)');
 const manager=String(data.contact_person??old.contact_person??'').trim();const phone=String(data.phone??old.phone??'').trim();
 if(!manager||!phone)throw Error('Manager name and phone are required');
 if(manager.length>100||phone.length>30)throw Error('Manager details are too long');
 await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['supplier-name:'+cid+':'+name.toLowerCase()]);
 const duplicate=await c.query('SELECT id FROM suppliers WHERE company_id=$1 AND lower(trim(name))=lower($2) AND is_active=TRUE AND id<>$3',[cid,name,id||0]);
 if(duplicate.rows.length)throw Error('Company name already exists');
 let row;
 if(id)row=(await c.query('UPDATE suppliers SET name=$1,contact_person=$2,phone=$3,updated_at=NOW() WHERE id=$4 AND company_id=$5 RETURNING *',[name,manager,phone,id,cid])).rows[0];
 else row=(await c.query('INSERT INTO suppliers(company_id,name,code,contact_person,phone,product_rates) VALUES($1,$2,$3,$4,$5,$6::jsonb) RETURNING *',[cid,name,'SUP-'+randomUUID().slice(0,12),manager,phone,'{}'])).rows[0];
 if(data.product_rates!==undefined)row=await saveRates(c,cid,row.id,typeof data.product_rates==='string'?JSON.parse(data.product_rates):data.product_rates);
 await audit(c,cid,actor,id?'SUPPLIER_UPDATED':'SUPPLIER_CREATED',row.id,{name});return {success:true,supplier:row};
});}
export async function removeCompany(cid,id,actor){return transaction(async c=>{
 const row=(await c.query('SELECT id,is_active FROM suppliers WHERE id=$1 AND company_id=$2 FOR UPDATE',[id,cid])).rows[0];
 if(!row)throw Error('Company not found');
 if(!row.is_active)return {success:true,message:'Company already removed; purchase history retained.'};
 await c.query('UPDATE suppliers SET is_active=FALSE,updated_at=NOW() WHERE id=$1 AND company_id=$2',[id,cid]);
 await audit(c,cid,actor,'SUPPLIER_DEACTIVATED',id);return {success:true,message:'Company removed; purchase history retained.'};
});}
export async function companyProducts(cid,id,{summaryOnly=false}={}){
 const supplier=(await pool.query('SELECT * FROM suppliers WHERE company_id=$1 AND id=$2 AND is_active=TRUE',[cid,id])).rows[0];if(!supplier)throw Error('Company not found');
 if(summaryOnly)return {supplier,products:[]};
 const products=(await pool.query("SELECT p.*,c.name category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id AND c.company_id=p.company_id WHERE p.company_id=$1 AND p.deleted_at IS NULL AND p.is_active=TRUE AND $2::jsonb ? p.id::text ORDER BY p.name,p.id",[cid,JSON.stringify(supplier.product_rates||{})])).rows;
 return {supplier,products:products.filter(p=>companyProductActive(supplier.product_rates,p.id)).map(p=>{const rates=purchaseRates(supplier.product_rates[p.id]);return {...p,buy_rates:rates};})};
}
export async function saveCompanyProduct(cid,supplierId,productId,data,actor){return transaction(async c=>{
 const supplier=await lockedSupplier(c,cid,supplierId);
 const id=productId||data.existing_product_id;
 if(!id||!Number.isSafeInteger(Number(id))||Number(id)<=0)throw Error('Select an existing product from Products & Rates.');
 const product=(await c.query('SELECT * FROM products WHERE company_id=$1 AND id=$2 AND deleted_at IS NULL AND is_active=TRUE FOR UPDATE',[cid,id])).rows[0];
 if(!product)throw Error('Product not found or inactive');
 if(productId&&!companyProductActive(supplier.product_rates,id))throw Error('Product is not active for this company');
 const rates=purchaseRates({...data.buy_rates??data,is_active:true});
 if(rates.tray_rate<=0)throw Error('Purchase rate per unit must be greater than zero');
 const previous=supplier.product_rates?.[product.id];
 if(previous&&typeof previous==='object'&&Object.hasOwn(previous,'image_url'))rates.image_url=previous.image_url;
 const updated=await saveRates(c,cid,supplierId,{...(supplier.product_rates||{}),[product.id]:rates});
 await audit(c,cid,actor,productId?'COMPANY_PRODUCT_RATES_UPDATED':'COMPANY_PRODUCT_ACTIVATED',supplierId,{product_id:product.id,buy_rates:{tray_rate:rates.tray_rate,piece_rate:rates.piece_rate}});
 return {success:true,product,supplier:updated};
});}

export async function removeCompanyProduct(cid,supplierId,productId,actor){return transaction(async c=>{
 const supplier=await lockedSupplier(c,cid,supplierId);const rates={...(supplier.product_rates||{})};
 if(!Object.hasOwn(rates,String(productId)))throw Error('Product not assigned to this company');
 rates[productId]={...purchaseRates(rates[productId]),is_active:false};const updated=await saveRates(c,cid,supplierId,rates);
 await audit(c,cid,actor,'COMPANY_PRODUCT_REMOVED',supplierId,{product_id:productId});return {success:true,supplier:updated};
});}

export async function purchaseReportProducts(cid,supplierId){
 const id=supplierId&&supplierId!=='ALL'?Number(supplierId):null;
 if(id!==null&&(!Number.isSafeInteger(id)||id<=0))throw Error('Invalid company');
 if(id!==null&&!(await pool.query('SELECT id FROM suppliers WHERE company_id=$1 AND id=$2',[cid,id])).rows.length)throw Error('Company not found');
 return (await pool.query(`SELECT p.id,p.display_name,p.name FROM products p
 WHERE p.company_id=$1 AND p.is_active=TRUE AND p.deleted_at IS NULL AND
 EXISTS(SELECT 1 FROM suppliers s WHERE s.company_id=$1 AND s.is_active=TRUE
 AND ($2::int IS NULL OR s.id=$2) AND s.product_rates ? p.id::text
 AND COALESCE((s.product_rates->p.id::text->>'is_active')::boolean,TRUE))
 ORDER BY p.display_name,p.id`,[cid,id])).rows;
}
