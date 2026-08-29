import bcrypt from 'bcrypt';
import { pool } from './database/pg_pool.js';

const BCRYPT_ROUNDS = 12;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MIN = 15;

async function query(text, params) {
  if (!params) params = [];
  const c = await pool.connect();
  try { return await c.query(text, params); }
  finally { c.release(); }
}
async function queryOne(text, params) { const r = await query(text, params); return r.rows[0] || null; }
async function queryAll(text, params) { const r = await query(text, params); return r.rows; }

export async function auditLog(opts) {
  if (!opts) opts = {};
  const { companyId, actorUserId, action, entityType, entityId, metadata, ipAddress } = opts;
  try {
    await query(
      'INSERT INTO audit_logs (company_id,actor_user_id,action,entity_type,entity_id,metadata,ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [companyId||null,actorUserId||null,action,entityType||null,entityId||null,metadata?JSON.stringify(metadata):null,ipAddress||null]
    );
  } catch(e) { console.error("[auditLog]", e.message); }
}

export async function login(loginId, pin) {
  const row = await queryOne('SELECT ua.*, r.role_name FROM user_accounts ua JOIN roles r ON r.id=ua.role_id WHERE ua.login_id=$1', [loginId]);
  if (!row) return { success: false, message: 'Invalid credentials.' };
  if (row.account_status !== 'ACTIVE') return { success: false, message: 'Account ' + row.account_status + '. Contact administrator.' };
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    const m = Math.ceil((new Date(row.locked_until)-new Date())/60000);
    return { success: false, message: 'Locked. Try in '+m+' min.' };
  }
  const ok = await bcrypt.compare(String(pin), row.pin_hash);
  if (!ok) {
    const a = (row.failed_attempts||0)+1;
    if (a >= MAX_ATTEMPTS) {
      const lock = new Date(Date.now()+LOCKOUT_MIN*60000);
      await query('UPDATE user_accounts SET failed_attempts=$1,locked_until=$2,updated_at=NOW() WHERE id=$3',[a,lock,row.id]);
      await auditLog({companyId:row.company_id,actorUserId:row.id,action:'LOGIN_LOCKED'});
      return { success:false, message:'Too many attempts. Locked '+LOCKOUT_MIN+'min.' };
    }
    await query('UPDATE user_accounts SET failed_attempts=$1,updated_at=NOW() WHERE id=$2',[a,row.id]);
    await auditLog({companyId:row.company_id,action:'LOGIN_FAILED',entityId:row.id});
    return { success:false, message:'Invalid PIN. '+(MAX_ATTEMPTS-a)+' left.' };
  }
  await query('UPDATE user_accounts SET failed_attempts=0,locked_until=NULL,last_login_at=NOW(),updated_at=NOW() WHERE id=$1',[row.id]);
  await auditLog({companyId:row.company_id,actorUserId:row.id,action:'LOGIN_SUCCESS'});
  return { success:true, user:{id:row.id,company_id:row.company_id,name:row.name,login_id:row.login_id,role:row.role_name,phone:row.phone,account_status:row.account_status,last_login_at:row.last_login_at} };
}

export async function getUserById(uid) {
  return await queryOne('SELECT ua.id,ua.company_id,ua.name,ua.login_id,ua.phone,ua.account_status,ua.last_login_at,ua.employee_id,r.role_name as role FROM user_accounts ua JOIN roles r ON r.id=ua.role_id WHERE ua.id=$1',[uid]);
}

export async function getCompany(cid) { if(!cid) return null; return await queryOne('SELECT * FROM companies WHERE id=$1',[cid]); }
export async function updateCompany(cid,d) {
  const r = await queryOne('UPDATE companies SET name=COALESCE($1,name),subtitle=COALESCE($2,subtitle),address=COALESCE($3,address),phone=COALESCE($4,phone),email=COALESCE($5,email),updated_at=NOW() WHERE id=$6 RETURNING *',[d.name||null,d.subtitle||null,d.address||null,d.phone||null,d.email||null,cid]);
  return {success:true,company:r};
}

export async function getUsers(cid) {
  return await queryAll('SELECT ua.id,ua.company_id,ua.employee_id,ua.login_id,ua.name,ua.phone,ua.account_status as status,ua.failed_attempts,ua.last_login_at,ua.created_at,r.role_name as role,e.employee_code FROM user_accounts ua JOIN roles r ON r.id=ua.role_id LEFT JOIN employees e ON e.id=ua.employee_id WHERE ua.company_id=$1 ORDER BY ua.id',[cid]);
}
export async function addUser(cid,d) {
  if(!d.login_id||!d.pin||!d.role||!d.name) throw new Error('login_id,name,pin,role required.');
  const rr = await queryOne('SELECT id FROM roles WHERE role_name=$1',[d.role]);
  if(!rr) throw new Error('Unknown role: '+d.role);
  const h = await bcrypt.hash(String(d.pin),BCRYPT_ROUNDS);
  const row = await queryOne('INSERT INTO user_accounts (company_id,role_id,employee_id,login_id,name,phone,pin_hash) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,login_id,name,phone,account_status',[cid,rr.id,d.employee_id||null,d.login_id,d.name,d.phone||null,h]);
  return {success:true,user:Object.assign({},row,{role:d.role})};
}
export async function updateUser(cid,uid,d) {
  const row = await queryOne('UPDATE user_accounts SET login_id=COALESCE($1,login_id),name=COALESCE($2,name),phone=COALESCE($3,phone),account_status=COALESCE($4,account_status),updated_at=NOW() WHERE id=$5 AND company_id=$6 RETURNING id,login_id,name,phone,account_status',[d.login_id||null,d.name||null,d.phone||null,d.account_status||null,uid,cid]);
  if(!row) throw new Error('User not found.');
  return {success:true,user:row};
}
export async function resetUserPin(cid,uid,newPin) {
  if(!newPin||String(newPin).length<4) throw new Error('PIN must be >= 4 digits.');
  const h = await bcrypt.hash(String(newPin),BCRYPT_ROUNDS);
  const row = await queryOne('UPDATE user_accounts SET pin_hash=$1,failed_attempts=0,locked_until=NULL,updated_at=NOW() WHERE id=$2 AND company_id=$3 RETURNING id,name',[h,uid,cid]);
  if(!row) throw new Error('User not found.');
  return {success:true,message:'PIN reset for '+row.name};
}

export async function getEmployees(cid) {
  return await queryAll('SELECT e.*,ua.login_id,ua.account_status,r.role_name as role FROM employees e LEFT JOIN user_accounts ua ON ua.employee_id=e.id AND ua.company_id=e.company_id LEFT JOIN roles r ON r.id=ua.role_id WHERE e.company_id=$1 ORDER BY e.id',[cid]);
}
export async function addEmployee(cid,d) {
  if(!d.full_name) throw new Error('full_name required.');
  const row = await queryOne('INSERT INTO employees (company_id,employee_code,full_name,phone,email,designation,vehicle_number,joining_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[cid,d.employee_code||null,d.full_name,d.phone||null,d.email||null,d.designation||null,d.vehicle_number||null,d.joining_date||null]);
  return {success:true,employee:row};
}
export async function updateEmployee(cid,eid,d) {
  const row = await queryOne('UPDATE employees SET full_name=COALESCE($1,full_name),phone=COALESCE($2,phone),email=COALESCE($3,email),designation=COALESCE($4,designation),vehicle_number=COALESCE($5,vehicle_number),is_active=COALESCE($6,is_active),updated_at=NOW() WHERE id=$7 AND company_id=$8 RETURNING *',[d.full_name||null,d.phone||null,d.email||null,d.designation||null,d.vehicle_number||null,d.is_active!==undefined?d.is_active:null,eid,cid]);
  if(!row) throw new Error('Employee not found.');
  return {success:true,employee:row};
}

export async function getCategories(cid,activeOnly) {
  const x=activeOnly?' AND is_active=TRUE':'';
  return await queryAll('SELECT * FROM categories WHERE company_id=$1'+x+' ORDER BY name',[cid]);
}
export async function addCategory(cid,d) {
  if(!d.code||!d.name) throw new Error('code and name required.');
  const row = await queryOne('INSERT INTO categories (company_id,code,name,description) VALUES ($1,$2,$3,$4) RETURNING *',[cid,d.code.toUpperCase(),d.name,d.description||null]);
  return {success:true,category:row};
}
export async function updateCategory(cid,catId,d) {
  const row = await queryOne('UPDATE categories SET name=COALESCE($1,name),description=COALESCE($2,description),code=COALESCE($3,code),updated_at=NOW() WHERE id=$4 AND company_id=$5 RETURNING *',[d.name||null,d.description||null,d.code||null,catId,cid]);
  if(!row) throw new Error('Category not found.');
  return {success:true,category:row};
}
export async function toggleCategoryStatus(cid,catId,is_active) {
  const row = await queryOne('UPDATE categories SET is_active=$1,updated_at=NOW() WHERE id=$2 AND company_id=$3 RETURNING *',[is_active,catId,cid]);
  if(!row) throw new Error('Category not found.');
  return {success:true,category:row};
}
export async function deleteCategory(cid,catId) {
  await query('UPDATE categories SET is_active=FALSE,updated_at=NOW() WHERE id=$1 AND company_id=$2',[catId,cid]);
  return {success:true,message:'Category deactivated.'};
}

export async function getProducts(cid,filters) {
  if(!filters) filters={};
  let sql='SELECT p.*,c.name as category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.company_id=$1';
  const params=[cid]; let idx=2;
  if(filters.active==='true'||filters.active===true) sql+=' AND p.is_active=TRUE';
  if(filters.category_id){sql+=' AND p.category_id=$'+idx++;params.push(filters.category_id);}
  sql+=' ORDER BY p.name';
  return await queryAll(sql,params);
}
export async function addProduct(cid,d) {
  if(!d.name||!d.display_name) throw new Error('name and display_name required.');
  const row = await queryOne('INSERT INTO products (company_id,category_id,sku,barcode,name,display_name,base_unit,selling_unit,pieces_per_unit,purchase_price,unit_selling_price,piece_selling_price,min_stock_level,icon,image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *',[cid,d.category_id||null,d.sku||null,d.barcode||null,d.name,d.display_name,d.base_unit||'Piece',d.selling_unit||'Tray',d.pieces_per_unit||1,d.purchase_price||0,d.unit_selling_price||0,d.piece_selling_price||0,d.min_stock_level||0,d.icon||null,d.image_url||null]);
  return {success:true,product:row};
}
export async function updateProduct(cid,pid,d) {
  const row = await queryOne('UPDATE products SET category_id=COALESCE($1,category_id),name=COALESCE($2,name),display_name=COALESCE($3,display_name),base_unit=COALESCE($4,base_unit),selling_unit=COALESCE($5,selling_unit),pieces_per_unit=COALESCE($6,pieces_per_unit),min_stock_level=COALESCE($7,min_stock_level),icon=COALESCE($8,icon),sku=COALESCE($9,sku),updated_at=NOW() WHERE id=$10 AND company_id=$11 RETURNING *',[d.category_id||null,d.name||null,d.display_name||null,d.base_unit||null,d.selling_unit||null,d.pieces_per_unit||null,d.min_stock_level||null,d.icon||null,d.sku||null,pid,cid]);
  if(!row) throw new Error('Product not found.');
  return {success:true,product:row};
}
export async function toggleProductStatus(cid,pid,is_active) {
  const row = await queryOne('UPDATE products SET is_active=$1,updated_at=NOW() WHERE id=$2 AND company_id=$3 RETURNING *',[is_active,pid,cid]);
  if(!row) throw new Error('Product not found.');
  return {success:true,product:row};
}
export async function updateProductPrice(cid,pid,d,actorUid) {
  const cur = await queryOne('SELECT * FROM products WHERE id=$1 AND company_id=$2',[pid,cid]);
  if(!cur) throw new Error('Product not found.');
  await query('INSERT INTO product_price_history (product_id,company_id,purchase_price,unit_selling_price,piece_selling_price,changed_by_user_id) VALUES ($1,$2,$3,$4,$5,$6)',[pid,cid,cur.purchase_price,cur.unit_selling_price,cur.piece_selling_price,actorUid||null]);
  const row = await queryOne('UPDATE products SET purchase_price=COALESCE($1,purchase_price),unit_selling_price=COALESCE($2,unit_selling_price),piece_selling_price=COALESCE($3,piece_selling_price),pieces_per_unit=COALESCE($4,pieces_per_unit),updated_at=NOW() WHERE id=$5 AND company_id=$6 RETURNING *',[d.purchase_price||null,d.unit_selling_price||null,d.piece_selling_price||null,d.pieces_per_unit||null,pid,cid]);
  return {success:true,product:row};
}

export async function getRoutes(cid) {
  return await queryAll('SELECT r.*,ra.employee_id,e.full_name as driver_name,e.vehicle_number,ra.status,ra.dispatch_time FROM routes r LEFT JOIN route_assignments ra ON ra.route_id=r.id AND ra.assigned_date=CURRENT_DATE LEFT JOIN employees e ON e.id=ra.employee_id WHERE r.company_id=$1 AND r.is_active=TRUE ORDER BY r.code',[cid]);
}
export async function addRoute(cid,d) {
  if(!d.code||!d.name) throw new Error('code and name required.');
  const row = await queryOne('INSERT INTO routes (company_id,code,name) VALUES ($1,$2,$3) RETURNING *',[cid,d.code,d.name]);
  return {success:true,route:row};
}
export async function reassignDriverRoute(cid,routeId,newEmpId) {
  const r = await queryOne('SELECT * FROM routes WHERE id=$1 AND company_id=$2',[routeId,cid]);
  if(!r) throw new Error('Route not found.');
  await query('UPDATE route_assignments SET employee_id=$1 WHERE route_id=$2 AND assigned_date=CURRENT_DATE',[newEmpId,routeId]);
  return {success:true,message:'Driver reassigned.'};
}

export async function getShops(cid) { return await queryAll('SELECT * FROM shops WHERE company_id=$1 AND is_active=TRUE ORDER BY name',[cid]); }
export async function addShop(cid,d) {
  if(!d.name) throw new Error('name required.');
  const code = d.code||('SHP-'+Date.now());
  const row = await queryOne('INSERT INTO shops (company_id,code,name,owner_name,phone,address,distance,route_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[cid,code,d.name,d.owner_name||null,d.phone||null,d.address||null,d.distance||null,d.route_id||null]);
  return {success:true,shop:row};
}
export async function assignFreezer(cid,shopId,d) {
  const row = await queryOne('UPDATE shops SET has_freezer=TRUE,freezer_model=$1,freezer_serial=$2,freezer_date=$3,freezer_status=$4,updated_at=NOW() WHERE id=$5 AND company_id=$6 RETURNING *',[d.freezer_model||null,d.freezer_serial||null,d.freezer_date||null,d.freezer_status||'Active',shopId,cid]);
  if(!row) throw new Error('Shop not found.');
  return {success:true,shop:row};
}
export async function collectShopDue(cid,shopId,d) {
  const amt=Number(d.amount)||0;
  const row = await queryOne('UPDATE shops SET current_due=GREATEST(0,current_due-$1),updated_at=NOW() WHERE id=$2 AND company_id=$3 RETURNING current_due',[amt,shopId,cid]);
  if(!row) throw new Error('Shop not found.');
  return {success:true,remainingDue:row.current_due};
}

export async function getSales(cid,filters) {
  if(!filters) filters={};
  let sql='SELECT s.*,si.id as item_id,si.product_id,si.product_name as ipn,si.qty,si.unit_type,si.rate,si.amount as iamt FROM sales s LEFT JOIN sale_items si ON si.sale_id=s.id WHERE s.company_id=$1';
  const params=[cid]; let idx=2;
  if(filters.date){sql+=' AND s.sale_date=$'+idx++;params.push(filters.date);}
  sql+=' ORDER BY s.created_at DESC';
  const rows=await queryAll(sql,params);
  const map=new Map();
  for(const row of rows){
    if(!map.has(row.id)) map.set(row.id,{id:row.id,bill_no:row.bill_no,employee_id:row.employee_id,employee_name:row.employee_name,shop_id:row.shop_id,shop_name:row.shop_name,sale_date:row.sale_date,sale_time:row.sale_time,total_amount:row.total_amount,cash_paid:row.cash_paid,gpay_paid:row.gpay_paid,credit_paid:row.credit_paid,payment_mode:row.payment_mode,created_at:row.created_at,items:[]});
    if(row.item_id) map.get(row.id).items.push({id:row.item_id,product_id:row.product_id,product_name:row.ipn,qty:row.qty,unit_type:row.unit_type,rate:row.rate,amount:row.iamt});
  }
  return Array.from(map.values());
}
export async function createSale(cid,d) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const bill_no='INV-'+Date.now();
    const today=new Date().toISOString().split('T')[0];
    const sR=await client.query('INSERT INTO sales (company_id,bill_no,employee_id,employee_name,shop_id,shop_name,sale_date,sale_time,total_amount,cash_paid,gpay_paid,credit_paid,payment_mode) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *',[cid,bill_no,d.employee_id||null,d.employee_name||null,d.shop_id||null,d.shop_name||null,d.sale_date||today,d.sale_time||null,d.total_amount||0,d.cash_paid||0,d.gpay_paid||0,d.credit_paid||0,d.payment_mode||'CASH']);
    const sale=sR.rows[0];
    for(const item of (d.items||[])) await client.query('INSERT INTO sale_items (sale_id,product_id,product_name,qty,unit_type,rate,amount) VALUES ($1,$2,$3,$4,$5,$6,$7)',[sale.id,item.product_id||null,item.product_name,item.qty,item.unit_type||'Tray',item.rate,item.amount]);
    await client.query('COMMIT');
    return {success:true,sale};
  } catch(e){ await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

export async function getExpenses(cid) { return await queryAll('SELECT * FROM expenses WHERE company_id=$1 ORDER BY created_at DESC',[cid]); }
export async function addExpense(cid,d) {
  if(!d.title||!d.amount) throw new Error('title and amount required.');
  const row=await queryOne('INSERT INTO expenses (company_id,employee_id,title,category,amount,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',[cid,d.employee_id||null,d.title,d.category||'General',d.amount,d.notes||null]);
  return {success:true,expense:row};
}
export async function getDamages(cid) { return await queryAll('SELECT * FROM damages WHERE company_id=$1 ORDER BY created_at DESC',[cid]); }
export async function addDamage(cid,d) {
  const row=await queryOne('INSERT INTO damages (company_id,employee_id,employee_name,product_id,product_name,qty_units,reason,damage_cost) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[cid,d.employee_id||null,d.employee_name||null,d.product_id||null,d.product_name||null,d.qty_units||0,d.reason||null,d.damage_cost||0]);
  return {success:true,damage:row};
}
export async function getSettlements(cid) { return await queryAll('SELECT * FROM settlements WHERE company_id=$1 ORDER BY created_at DESC',[cid]); }
export async function saveSettlement(cid,d) {
  const diff=(Number(d.collected_amount)||0)-(Number(d.expected_amount)||0);
  const status=Math.abs(diff)<0.01?'BALANCED':diff>0?'SURPLUS':'DEFICIT';
  const row=await queryOne('INSERT INTO settlements (company_id,employee_id,employee_name,expected_amount,collected_amount,difference,reason,remarks,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[cid,d.employee_id||null,d.employee_name||null,d.expected_amount||0,d.collected_amount||0,diff,d.reason||null,d.remarks||null,status]);
  return {success:true,settlement:row};
}

export async function getStockMovements(cid,f) { return await queryAll('SELECT * FROM inventory_movements WHERE company_id=$1 ORDER BY created_at DESC LIMIT 200',[cid]); }
export async function addStockMovement(cid,d) {
  const mn='MOV-'+Date.now();
  const row=await queryOne('INSERT INTO inventory_movements (company_id,movement_no,movement_type,product_id,product_name,employee_id,employee_name,qty_units,unit,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[cid,mn,d.movement_type,d.product_id||null,d.product_name||null,d.employee_id||null,d.employee_name||null,d.qty_units||0,d.unit||'Tray',d.notes||null]);
  return {success:true,movement:row};
}
export async function getEmployeeStock(cid,eid) {
  return await queryAll('SELECT es.*,p.name as product_name,p.display_name,p.selling_unit,p.pieces_per_unit,p.unit_selling_price,p.piece_selling_price FROM employee_stock es JOIN products p ON p.id=es.product_id WHERE es.company_id=$1 AND es.employee_id=$2',[cid,eid]);
}

export async function getDashboardSummary(cid) {
  const today=new Date().toISOString().split('T')[0];
  const sQ=await query('SELECT COALESCE(SUM(total_amount),0) as ts,COALESCE(SUM(cash_paid),0) as cs,COALESCE(SUM(gpay_paid),0) as gs,COALESCE(SUM(credit_paid),0) as cr FROM sales WHERE company_id=$1 AND sale_date=$2',[cid,today]);
  const eQ=await query('SELECT COALESCE(SUM(amount),0) as t FROM expenses WHERE company_id=$1 AND created_at::date=$2',[cid,today]);
  const dQ=await query('SELECT COALESCE(SUM(damage_cost),0) as t FROM damages WHERE company_id=$1 AND created_at::date=$2',[cid,today]);
  const empQ=await query('SELECT COUNT(*) as t FROM employees WHERE company_id=$1 AND is_active=TRUE',[cid]);
  const prQ=await query('SELECT COUNT(*) as t FROM products WHERE company_id=$1 AND is_active=TRUE',[cid]);
  const shQ=await query('SELECT COUNT(*) as t,COALESCE(SUM(current_due),0) as td FROM shops WHERE company_id=$1 AND is_active=TRUE',[cid]);
  const inv=await queryAll('SELECT id,bill_no,employee_name,shop_name,total_amount,payment_mode,created_at FROM sales WHERE company_id=$1 ORDER BY created_at DESC LIMIT 10',[cid]);
  const rev=await query("SELECT sale_date::text as date,COALESCE(SUM(total_amount),0) as revenue FROM sales WHERE company_id=$1 AND sale_date>=CURRENT_DATE-INTERVAL '6 days' GROUP BY sale_date ORDER BY sale_date",[cid]);
  const s=sQ.rows[0]; const ts=Number(s.ts); const exp=Number(eQ.rows[0].t); const dmg=Number(dQ.rows[0].t);
  return {todaySales:ts,cashCollection:Number(s.cs),gpayCollection:Number(s.gs),creditSales:Number(s.cr),totalExpenses:exp,damageCost:dmg,netCollection:ts-exp-dmg,employeesActive:Number(empQ.rows[0].t),activeProducts:Number(prQ.rows[0].t),totalShops:Number(shQ.rows[0].t),totalDues:Number(shQ.rows[0].td),recentInvoices:inv,sevenDayRevenue:rev.rows};
}