import bcrypt from 'bcrypt';
import { pool } from './database/pg_pool.js';
import { getOperationalUnit, normalizeQuantity, checkReconciliationEquation, RECONCILIATION_EPSILON } from './unitHelper.js';
export { getOperationalUnit, normalizeQuantity, checkReconciliationEquation, RECONCILIATION_EPSILON };

const BCRYPT_ROUNDS = 12;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MIN = 15;

// ====== DB QUERY HELPERS ======
export async function query(text, params) {
  if (!params) params = [];
  const c = await pool.connect();
  try { return await c.query(text, params); }
  finally { c.release(); }
}
async function queryOne(text, params) { const r = await query(text, params); return r.rows[0] || null; }
async function queryAll(text, params) { const r = await query(text, params); return r.rows; }

// ====== AUDIT LOG ======
export async function auditLog(opts) {
  if (!opts) opts = {};
  const { companyId, actorUserId, action, entityType, entityId, metadata, ipAddress } = opts;
  try {
    await query(
      'INSERT INTO audit_logs (company_id,actor_user_id,action,entity_type,entity_id,metadata,ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [companyId||null,actorUserId||null,action,entityType||null,entityId||null,metadata?JSON.stringify(metadata):null,ipAddress||null]
    );
  } catch(e) { console.error('[auditLog]', e.message); }
}

// ====== AUTH ======
export async function login(loginId, pin) {
  const normLoginId = String(loginId || '').trim();
  if (!normLoginId) return { success: false, message: 'Login ID is required.' };

  const row = await queryOne(
    'SELECT ua.*, r.role_name, e.full_name as employee_name, e.employee_code, e.route_id, e.vehicle_number, e.designation, e.phone as employee_phone, ' +
    'rt.name as route_name, rt.code as route_code ' +
    'FROM user_accounts ua ' +
    'JOIN roles r ON r.id=ua.role_id ' +
    'LEFT JOIN employees e ON e.id=ua.employee_id ' +
    'LEFT JOIN routes rt ON rt.id=e.route_id ' +
    'WHERE LOWER(TRIM(ua.login_id)) = LOWER($1) ' +
    'OR (e.employee_code IS NOT NULL AND LOWER(TRIM(e.employee_code)) = LOWER($1)) ' +
    'OR (e.full_name IS NOT NULL AND LOWER(TRIM(e.full_name)) = LOWER($1))', 
    [normLoginId]
  );

  if (!row) return { success: false, message: 'Invalid credentials.' };
  if (row.account_status !== 'ACTIVE') return { success: false, message: 'Account ' + row.account_status + '. Contact administrator.' };
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    const m = Math.ceil((new Date(row.locked_until)-new Date())/60000);
    return { success: false, message: 'Locked. Try in '+m+' min.' };
  }
  const ok = await bcrypt.compare(String(pin).trim(), row.pin_hash);
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
  return {
    success: true,
    user: {
      id: row.id,
      company_id: row.company_id,
      employee_id: row.employee_id,
      login_id: row.login_id,
      name: row.name || row.employee_name || row.login_id,
      role: row.role_name,
      role_name: row.role_name,
      account_status: row.account_status,
      employee_code: row.employee_code,
      vehicle_no: row.vehicle_number,
      vehicle_number: row.vehicle_number,
      route_id: row.route_id,
      routeId: row.route_id,
      route_name: row.route_name,
      route_code: row.route_code,
      designation: row.designation,
      phone: row.employee_phone || row.phone,
      last_login_at: row.last_login_at
    }
  };
}

export async function getUserById(uid) {
  const row = await queryOne(
    'SELECT ua.*, r.role_name, e.full_name as employee_name, e.employee_code, e.vehicle_number, e.designation, e.phone as employee_phone, ' +
    'e.route_id, e.route_id as "routeId", rt.name as route_name, rt.code as route_code ' +
    'FROM user_accounts ua ' +
    'JOIN roles r ON r.id=ua.role_id ' +
    'LEFT JOIN employees e ON e.id=ua.employee_id ' +
    'LEFT JOIN routes rt ON rt.id=e.route_id ' +
    'WHERE ua.id=$1',
    [uid]
  );
  if (!row) return null;
  return {
    id: row.id,
    company_id: row.company_id,
    employee_id: row.employee_id,
    login_id: row.login_id,
    name: row.name || row.employee_name || row.login_id,
    role: row.role_name,
    role_name: row.role_name,
    account_status: row.account_status,
    employee_code: row.employee_code,
    vehicle_no: row.vehicle_number,
    vehicle_number: row.vehicle_number,
    route_id: row.route_id,
    routeId: row.route_id,
    route_name: row.route_name,
    route_code: row.route_code,
    designation: row.designation,
    phone: row.employee_phone || row.phone,
    last_login_at: row.last_login_at
  };
}

// ====== USERS ======
export async function getUsers(cid) {
  return await queryAll(
    'SELECT ua.id, ua.company_id, ua.employee_id, ua.login_id, ua.name, ua.phone, ua.account_status, ua.last_login_at, ua.created_at, ' +
    'r.role_name, r.role_name as role, ua.account_status as status, ' +
    'e.employee_code, e.full_name as employee_name, e.designation as employee_designation, e.phone as employee_phone, e.vehicle_number, ' +
    'e.route_id, e.route_id as "routeId", rt.name as route_name, rt.code as route_code ' +
    'FROM user_accounts ua ' +
    'JOIN roles r ON r.id = ua.role_id ' +
    'LEFT JOIN employees e ON e.id = ua.employee_id ' +
    'LEFT JOIN routes rt ON rt.id = e.route_id ' +
    'WHERE ua.company_id = $1 ' +
    'ORDER BY ua.created_at DESC',
    [cid]
  );
}

export async function addUser(cid, d, actorUserId) {
  if(!d.employee_id||!d.login_id||!d.pin||!d.role) throw new Error('employee_id, login_id, pin, and role are required.');
  const loginId = String(d.login_id).trim().toLowerCase();
  const pinStr = String(d.pin).trim();
  if(!/^\d{4}$/.test(pinStr)) throw new Error('PIN must be exactly 4 digits.');
  const emp = await queryOne('SELECT * FROM employees WHERE id=$1 AND company_id=$2', [d.employee_id, cid]);
  if (!emp) throw new Error('Selected employee does not exist or belongs to another company.');
  if (emp.is_active === false || emp.is_active === 0) throw new Error('Cannot create user for inactive employee.');
  const existingUser = await queryOne('SELECT id FROM user_accounts WHERE employee_id=$1', [d.employee_id]);
  if (existingUser) throw new Error('This employee already has an active user account.');
  const dupLogin = await queryOne('SELECT id FROM user_accounts WHERE LOWER(login_id)=$1', [loginId]);
  if (dupLogin) throw new Error('Login ID already taken. Please choose another.');
  const roleInput = String(d.role || 'EMPLOYEE').trim().toUpperCase();
  let roleRow = await queryOne('SELECT id, role_name FROM roles WHERE UPPER(role_name)=UPPER($1)', [roleInput]);
  if (!roleRow && (roleInput === 'DRIVER' || roleInput === 'EMPLOYEE' || roleInput === 'STORE_KEEPER' || roleInput === 'OWNER')) {
    roleRow = await queryOne('INSERT INTO roles (role_name) VALUES ($1) ON CONFLICT (role_name) DO UPDATE SET role_name=EXCLUDED.role_name RETURNING id, role_name', [roleInput]);
  }
  if (!roleRow) throw new Error('Invalid role specified.');

  let targetRouteId = undefined;
  if (d.route_id !== undefined || d.routeId !== undefined) {
    const rawRoute = d.route_id !== undefined ? d.route_id : d.routeId;
    targetRouteId = (rawRoute === null || rawRoute === '' || rawRoute === 0 || rawRoute === '0') ? null : parseInt(rawRoute, 10);
    if (isNaN(targetRouteId)) targetRouteId = null;
  }

  if (targetRouteId !== undefined) {
    await query('UPDATE employees SET route_id=$1, updated_at=NOW() WHERE id=$2 AND company_id=$3', [targetRouteId, d.employee_id, cid]);
    if (targetRouteId) {
      const today = new Date().toISOString().split('T')[0];
      await query(
        'INSERT INTO route_assignments (route_id, employee_id, vehicle_number, assigned_date, status, dispatch_time) ' +
        'VALUES ($1, $2, $3, $4, $5, $6) ' +
        'ON CONFLICT (route_id, assigned_date) DO UPDATE SET employee_id=EXCLUDED.employee_id, vehicle_number=EXCLUDED.vehicle_number, status=EXCLUDED.status, updated_at=NOW()',
        [targetRouteId, d.employee_id, emp.vehicle_number || null, today, 'ASSIGNED', new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'})]
      );
    }
  }

  const hash = await bcrypt.hash(pinStr, BCRYPT_ROUNDS);
  const row = await queryOne(
    'INSERT INTO user_accounts (company_id,employee_id,role_id,login_id,name,phone,pin_hash,account_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,company_id,employee_id,role_id,login_id,name,phone,account_status,created_at',
    [cid,d.employee_id,roleRow.id,loginId,d.name || emp.full_name,d.phone || emp.phone,hash,'ACTIVE']
  );
  await auditLog({companyId:cid,actorUserId,action:'USER_CREATED',entityType:'user_accounts',entityId:row.id});
  return {success:true, user:{...row, role: roleRow.role_name, route_id: targetRouteId !== undefined ? targetRouteId : emp.route_id}};
}

export async function updateUser(cid, uid, d, actorUserId) {
  const existingUser = await queryOne('SELECT ua.*, r.role_name FROM user_accounts ua JOIN roles r ON r.id = ua.role_id WHERE ua.id=$1 AND ua.company_id=$2', [uid, cid]);
  if (!existingUser) throw new Error('User not found.');

  let roleId = existingUser.role_id;
  let roleName = existingUser.role_name;
  if (d.role) {
    const roleInput = String(d.role).trim().toUpperCase();
    let r = await queryOne('SELECT id, role_name FROM roles WHERE UPPER(role_name)=UPPER($1)', [roleInput]);
    if (!r && (roleInput === 'DRIVER' || roleInput === 'EMPLOYEE' || roleInput === 'STORE_KEEPER' || roleInput === 'OWNER')) {
      r = await queryOne('INSERT INTO roles (role_name) VALUES ($1) ON CONFLICT (role_name) DO UPDATE SET role_name=EXCLUDED.role_name RETURNING id, role_name', [roleInput]);
    }
    if (r) {
      roleId = r.id;
      roleName = r.role_name;
    }
  }

  const loginId = d.login_id ? String(d.login_id).trim().toLowerCase() : existingUser.login_id;
  if (loginId && loginId !== existingUser.login_id) {
    const dupLogin = await queryOne('SELECT id FROM user_accounts WHERE LOWER(login_id)=$1 AND id != $2', [loginId, uid]);
    if (dupLogin) throw new Error('Login ID already taken. Please choose another.');
  }

  const displayName = d.name !== undefined ? (d.name ? String(d.name).trim() : null) : existingUser.name;
  const status = d.status || d.account_status || existingUser.account_status;

  const row = await queryOne(
    'UPDATE user_accounts SET login_id=$1, role_id=$2, name=COALESCE($3, name), account_status=$4, updated_at=NOW() WHERE id=$5 AND company_id=$6 RETURNING id,company_id,employee_id,role_id,login_id,name,phone,account_status',
    [loginId, roleId, displayName, status, uid, cid]
  );

  let updatedRouteId = undefined;
  if (existingUser.employee_id) {
    if (displayName) {
      await query('UPDATE employees SET full_name=$1, updated_at=NOW() WHERE id=$2 AND company_id=$3', [displayName, existingUser.employee_id, cid]);
    }
    if (roleName) {
      await query('UPDATE employees SET designation=$1, updated_at=NOW() WHERE id=$2 AND company_id=$3', [roleName, existingUser.employee_id, cid]);
    }

    if (d.route_id !== undefined || d.routeId !== undefined) {
      const rawRoute = d.route_id !== undefined ? d.route_id : d.routeId;
      updatedRouteId = (rawRoute === null || rawRoute === '' || rawRoute === 0 || rawRoute === '0') ? null : parseInt(rawRoute, 10);
      if (isNaN(updatedRouteId)) updatedRouteId = null;

      await query('UPDATE employees SET route_id=$1, updated_at=NOW() WHERE id=$2 AND company_id=$3', [updatedRouteId, existingUser.employee_id, cid]);

      if (updatedRouteId) {
        const today = new Date().toISOString().split('T')[0];
        const empRec = await queryOne('SELECT vehicle_number FROM employees WHERE id=$1', [existingUser.employee_id]);
        await query(
          'INSERT INTO route_assignments (route_id, employee_id, vehicle_number, assigned_date, status, dispatch_time) ' +
          'VALUES ($1, $2, $3, $4, $5, $6) ' +
          'ON CONFLICT (route_id, assigned_date) DO UPDATE SET employee_id=EXCLUDED.employee_id, vehicle_number=EXCLUDED.vehicle_number, status=EXCLUDED.status, updated_at=NOW()',
          [updatedRouteId, existingUser.employee_id, empRec?.vehicle_number || null, today, 'ASSIGNED', new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'})]
        );
      } else {
        await query('DELETE FROM route_assignments WHERE employee_id=$1', [existingUser.employee_id]);
      }
    }
  }

  await auditLog({companyId:cid, actorUserId, action:'USER_UPDATED', entityType:'user_accounts', entityId:uid});
  return {
    success: true, 
    user: {
      ...row, 
      role: roleName, 
      status: row.account_status, 
      route_id: updatedRouteId
    }
  };
}

export async function deleteUser(cid, uid, actorUserId) {
  const user = await queryOne('SELECT ua.*, r.role_name FROM user_accounts ua JOIN roles r ON r.id = ua.role_id WHERE ua.id=$1 AND ua.company_id=$2', [uid, cid]);
  if (!user) throw new Error('User not found.');

  if (user.role_name === 'OWNER') {
    const ownerCount = await queryOne(
      'SELECT COUNT(*)::int as count FROM user_accounts ua JOIN roles r ON r.id = ua.role_id WHERE r.role_name = \'OWNER\' AND ua.company_id = $1 AND ua.account_status = \'ACTIVE\'',
      [cid]
    );
    if (ownerCount && parseInt(ownerCount.count, 10) <= 1) {
      throw new Error('Cannot delete the primary/only active OWNER account.');
    }
  }

  // Check if user has sales or stock transaction records
  const salesCount = await queryOne('SELECT COUNT(*)::int as count FROM sales WHERE employee_id=$1', [user.employee_id || 0]);
  if (salesCount && parseInt(salesCount.count, 10) > 0) {
    await query('UPDATE user_accounts SET account_status=\'INACTIVE\', updated_at=NOW() WHERE id=$1 AND company_id=$2', [uid, cid]);
    if (user.employee_id) {
      await query('UPDATE employees SET is_active=FALSE, updated_at=NOW() WHERE id=$1 AND company_id=$2', [user.employee_id, cid]);
    }
    return { success: true, message: `User "${user.login_id}" has sales records and has been deactivated.`, user };
  }

  await query('DELETE FROM user_accounts WHERE id=$1 AND company_id=$2', [uid, cid]);
  if (user.employee_id) {
    await query('UPDATE employees SET is_active=FALSE WHERE id=$1 AND company_id=$2', [user.employee_id, cid]);
  }

  await auditLog({ companyId: cid, actorUserId, action: 'USER_DELETED', entityType: 'user_accounts', entityId: uid });
  return { success: true, message: `User "${user.login_id}" deleted successfully.`, user };
}

export async function resetPin(cid, uid, newPin, actorUserId) {
  const pinStr = String(newPin || '').trim();
  if(!/^\d{4}$/.test(pinStr)) throw new Error('PIN must be exactly 4 digits.');
  const hash = await bcrypt.hash(pinStr, BCRYPT_ROUNDS);
  const row = await queryOne(
    'UPDATE user_accounts SET pin_hash=$1,failed_attempts=0,locked_until=NULL,updated_at=NOW() WHERE id=$2 AND company_id=$3 RETURNING id,login_id',
    [hash,uid,cid]
  );
  if(!row) throw new Error('User not found.');
  await auditLog({companyId:cid,actorUserId,action:'PIN_RESET',entityType:'user_accounts',entityId:uid});
  return {success:true,message:'PIN reset successfully.'};
}

export async function resetUserPin(cid, uid, newPin, actorUserId) {
  return await resetPin(cid, uid, newPin, actorUserId);
}

export async function toggleUserStatus(cid,uid,status,actorUserId) {
  const s = status==='ACTIVE'?'ACTIVE':'SUSPENDED';
  const row = await queryOne(
    'UPDATE user_accounts SET account_status=$1,updated_at=NOW() WHERE id=$2 AND company_id=$3 RETURNING id,account_status',
    [s,uid,cid]
  );
  if(!row) throw new Error('User not found.');
  await auditLog({companyId:cid,actorUserId,action:'USER_STATUS_'+s,entityType:'user_accounts',entityId:uid});
  return {success:true,user:row};
}

export async function addEmployeeUserWizard(cid, data, actorUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const fullName = (data.full_name || '').trim();
    if (!fullName) throw new Error('Employee full name is required.');
    const roleName = (data.role || '').toUpperCase();
    if (!['OWNER', 'STORE_KEEPER', 'EMPLOYEE', 'DRIVER'].includes(roleName)) throw new Error('Invalid role specified.');
    const phone = (data.phone || '').trim() || null;
    const vehicleNumber = (data.vehicle_number || '').trim() || null;
    let routeId = null;
    if (data.route_id !== undefined && data.route_id !== null && data.route_id !== '' && data.route_id !== 0 && data.route_id !== '0') {
      routeId = parseInt(data.route_id, 10);
      if (isNaN(routeId)) routeId = null;
    }
    const empRes = await client.query(
      'INSERT INTO employees (company_id, full_name, designation, phone, vehicle_number, route_id, is_active) VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING *',
      [cid, fullName, roleName, phone, vehicleNumber, routeId]
    );
    const employee = empRes.rows[0];
    if (routeId) {
      const today = new Date().toISOString().split('T')[0];
      await client.query(
        'INSERT INTO route_assignments (route_id, employee_id, vehicle_number, assigned_date, status, dispatch_time) ' +
        'VALUES ($1, $2, $3, $4, $5, $6) ' +
        'ON CONFLICT (route_id, assigned_date) DO UPDATE SET employee_id=EXCLUDED.employee_id, vehicle_number=EXCLUDED.vehicle_number, status=EXCLUDED.status, updated_at=NOW()',
        [routeId, employee.id, vehicleNumber || null, today, 'ASSIGNED', new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'})]
      );
    }

    const loginId = (data.login_id || '').trim();
    if (!loginId) throw new Error('Login ID is required.');
    const pinStr = String(data.pin || '');
    if (!/^\d{4}$/.test(pinStr)) throw new Error('PIN must be exactly 4 digits.');

    const dupCheck = await client.query('SELECT id FROM user_accounts WHERE login_id = $1', [loginId]);
    if (dupCheck.rows.length > 0) throw new Error('Login ID already taken. Please choose another.');

    const roleRes = await client.query('SELECT id FROM roles WHERE UPPER(role_name) = UPPER($1)', [roleName]);
    if (roleRes.rows.length === 0) throw new Error('Role not configured in database.');
    const roleId = roleRes.rows[0].id;

    const hash = await bcrypt.hash(pinStr, BCRYPT_ROUNDS);
    const userRes = await client.query(
      'INSERT INTO user_accounts (company_id, employee_id, role_id, login_id, name, phone, pin_hash, account_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, company_id, employee_id, role_id, login_id, name, phone, account_status, created_at',
      [cid, employee.id, roleId, loginId, fullName, phone, hash, 'ACTIVE']
    );
    const user = userRes.rows[0];

    await client.query('COMMIT');
    await auditLog({ companyId: cid, actorUserId, action: 'EMPLOYEE_AND_USER_WIZARD_CREATED', entityType: 'user_accounts', entityId: user.id });
    return { success: true, user, employee };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ====== EMPLOYEES & DRIVERS ======
export async function getDrivers(cid) {
  return await queryAll(
    'SELECT DISTINCT ON (e.id) ' +
    '  e.id, e.company_id, e.employee_code, e.full_name, e.designation, e.vehicle_number, e.route_id, e.is_active, ' +
    '  r.name AS route_name, r.code AS route_code, ' +
    '  ua.id AS user_account_id, ua.login_id, ua.account_status, r_ua.id AS role_id, r_ua.role_name AS user_role ' +
    'FROM employees e ' +
    'LEFT JOIN routes r ON r.id = e.route_id ' +
    'INNER JOIN user_accounts ua ON ua.employee_id = e.id AND ua.account_status = \'ACTIVE\' AND ua.company_id = e.company_id ' +
    'INNER JOIN roles r_ua ON r_ua.id = ua.role_id AND (r_ua.role_name = \'DRIVER\' OR r_ua.role_name = \'EMPLOYEE\') ' +
    'WHERE e.company_id = $1 AND e.is_active = TRUE ' +
    'ORDER BY e.id ASC, ua.id DESC',
    [cid]
  );
}

export async function getEmployees(cid, filters) { 
  if (filters && (filters.role === 'DRIVER' || filters.driversOnly === true || filters.driversOnly === 'true')) {
    return await getDrivers(cid);
  }
  let sql = 
    'SELECT DISTINCT ON (e.id) e.*, r.name as route_name, r.code as route_code, ua.login_id, ua.id as user_account_id, r_ua.role_name as user_role ' +
    'FROM employees e ' +
    'LEFT JOIN routes r ON r.id = e.route_id ' +
    'LEFT JOIN user_accounts ua ON ua.employee_id = e.id AND ua.account_status = \'ACTIVE\' ' +
    'LEFT JOIN roles r_ua ON r_ua.id = ua.role_id ' +
    'WHERE e.company_id = $1 AND e.is_active = TRUE';
  const params = [cid];
  if (filters && filters.role === 'EMPLOYEE') {
    sql += ' AND (r_ua.role_name IN (\'EMPLOYEE\', \'DRIVER\') OR e.designation ILIKE \'%driver%\' OR e.designation ILIKE \'%delivery%\') AND (r_ua.role_name IS NULL OR r_ua.role_name NOT IN (\'OWNER\', \'STORE_KEEPER\'))';
  }
  sql += ' ORDER BY e.id, ua.id DESC';
  return await queryAll(sql, params); 
}
export async function getUnlinkedEmployees(cid) {
  return await queryAll(
    'SELECT e.*, r.name as route_name, r.code as route_code FROM employees e LEFT JOIN routes r ON r.id = e.route_id LEFT JOIN user_accounts ua ON ua.employee_id = e.id WHERE e.company_id = $1 AND e.is_active = TRUE AND ua.id IS NULL ORDER BY e.full_name',
    [cid]
  );
}
export async function addEmployee(cid,d) {
  if(!d.full_name) throw new Error('full_name is required.');
  const code = d.employee_code || ('EMP' + Date.now().toString().slice(-4));
  const desig = d.designation || d.role || 'Delivery Executive';
  let routeId = null;
  if (d.route_id !== undefined && d.route_id !== null && d.route_id !== '' && d.route_id !== 0 && d.route_id !== '0') {
    routeId = parseInt(d.route_id, 10);
    if (isNaN(routeId)) routeId = null;
  }
  const row = await queryOne(
    'INSERT INTO employees (company_id,employee_code,full_name,designation,phone,vehicle_number,route_id,is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE) RETURNING *',
    [cid,code,d.full_name,desig,d.phone||null,d.vehicle_number||null,routeId]
  );
  if (routeId) {
    const today = new Date().toISOString().split('T')[0];
    await queryOne(
      'INSERT INTO route_assignments (route_id, employee_id, vehicle_number, assigned_date, status, dispatch_time) ' +
      'VALUES ($1, $2, $3, $4, $5, $6) ' +
      'ON CONFLICT (route_id, assigned_date) DO UPDATE SET employee_id=EXCLUDED.employee_id, vehicle_number=EXCLUDED.vehicle_number, status=EXCLUDED.status, updated_at=NOW() RETURNING *',
      [routeId, row.id, d.vehicle_number || null, today, 'ASSIGNED', new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'})]
    );
  }
  return {success:true,employee:row};
}
export async function updateEmployee(cid,empId,d) {
  const desig = d.designation || d.role || null;
  let routeId = undefined;
  if (d.route_id !== undefined) {
    routeId = (d.route_id === null || d.route_id === '' || d.route_id === 0 || d.route_id === '0') ? null : parseInt(d.route_id, 10);
    if (isNaN(routeId)) routeId = null;
  }
  const row = await queryOne(
    'UPDATE employees SET full_name=COALESCE($1,full_name),designation=COALESCE($2,designation),phone=COALESCE($3,phone),vehicle_number=COALESCE($4,vehicle_number),route_id=COALESCE($5,route_id),updated_at=NOW() WHERE id=$6 AND company_id=$7 RETURNING *',
    [d.full_name||null,desig,d.phone||null,d.vehicle_number||null,routeId,empId,cid]
  );
  if(!row) throw new Error('Employee not found.');
  if (routeId) {
    const today = new Date().toISOString().split('T')[0];
    await queryOne(
      'INSERT INTO route_assignments (route_id, employee_id, vehicle_number, assigned_date, status, dispatch_time) ' +
      'VALUES ($1, $2, $3, $4, $5, $6) ' +
      'ON CONFLICT (route_id, assigned_date) DO UPDATE SET employee_id=EXCLUDED.employee_id, vehicle_number=EXCLUDED.vehicle_number, status=EXCLUDED.status, updated_at=NOW() RETURNING *',
      [routeId, empId, d.vehicle_number || row.vehicle_number || null, today, 'ASSIGNED', new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'})]
    );
  }
  return {success:true,employee:row};
}
export async function deactivateEmployee(cid,empId) {
  const row = await queryOne('UPDATE employees SET is_active=FALSE,updated_at=NOW() WHERE id=$1 AND company_id=$2 RETURNING *',[empId,cid]);
  if(!row) throw new Error('Employee not found.');
  return {success:true,employee:row};
}

// ====== CATEGORIES ======
export async function getCategories(cid,activeOnly) {
  const x=activeOnly?' AND c.is_active=TRUE':'';
  return await queryAll(`
    SELECT c.*, 
      COALESCE((SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id AND p.company_id = $1), 0) as product_count
    FROM categories c 
    WHERE c.company_id = $1 ${x}
    ORDER BY c.name ASC
  `, [cid]);
}
export async function addCategory(cid,d) {
  const name = (d && d.name ? String(d.name) : '').trim();
  if(!name) throw new Error('Category name is required.');

  let code = (d && d.code ? String(d.code) : '').trim().toUpperCase();
  if(!code) {
    code = name.replace(/[^A-Za-z0-9]/g, '').substring(0, 20).toUpperCase();
    if (!code) code = 'CAT-' + Date.now().toString().slice(-6);
  }

  const dupName = await queryOne('SELECT id FROM categories WHERE company_id=$1 AND LOWER(TRIM(name))=LOWER(TRIM($2))', [cid, name]);
  if (dupName) throw new Error(`Category name '${name}' already exists.`);

  const dupCode = await queryOne('SELECT id FROM categories WHERE company_id=$1 AND UPPER(TRIM(code))=UPPER(TRIM($2))', [cid, code]);
  if (dupCode) throw new Error(`Category code '${code}' already exists.`);

  const desc = d && d.description ? String(d.description).trim() : null;
  const operationalUnit = d && d.operational_unit ? String(d.operational_unit).trim() : 'Piece';
  const row = await queryOne('INSERT INTO categories (company_id,code,name,description,operational_unit) VALUES ($1,$2,$3,$4,$5) RETURNING *',[cid,code,name,desc,operationalUnit]);
  return {success:true,category:row};
}
export async function updateCategory(cid,catId,d) {
  const name = d && d.name ? String(d.name).trim() : null;
  const code = d && d.code ? String(d.code).trim().toUpperCase() : null;
  const desc = d && d.description !== undefined ? (d.description ? String(d.description).trim() : null) : undefined;
  const operationalUnit = d && d.operational_unit !== undefined ? (d.operational_unit ? String(d.operational_unit).trim() : 'Piece') : undefined;

  if (name) {
    const dupName = await queryOne('SELECT id FROM categories WHERE company_id=$1 AND LOWER(TRIM(name))=LOWER(TRIM($2)) AND id != $3', [cid, name, catId]);
    if (dupName) throw new Error(`Category name '${name}' already exists.`);
  }

  if (code) {
    const dupCode = await queryOne('SELECT id FROM categories WHERE company_id=$1 AND UPPER(TRIM(code))=UPPER(TRIM($2)) AND id != $3', [cid, code, catId]);
    if (dupCode) throw new Error(`Category code '${code}' already exists.`);
  }

  const row = await queryOne('UPDATE categories SET name=COALESCE($1,name),description=COALESCE($2,description),code=COALESCE($3,code),operational_unit=COALESCE($4,operational_unit),updated_at=NOW() WHERE id=$5 AND company_id=$6 RETURNING *',[name,desc,code,operationalUnit,catId,cid]);
  if(!row) throw new Error('Category not found.');
  return {success:true,category:row};
}
export async function toggleCategoryStatus(cid,catId,is_active) {
  const row = await queryOne('UPDATE categories SET is_active=$1,updated_at=NOW() WHERE id=$2 AND company_id=$3 RETURNING *',[is_active,catId,cid]);
  if(!row) throw new Error('Category not found.');
  return {success:true,category:row};
}
export async function deleteCategory(cid,catId) {
  const category = await queryOne('SELECT * FROM categories WHERE id=$1 AND company_id=$2', [catId, cid]);
  if (!category) {
    throw new Error('Category not found.');
  }

  const prodCountRow = await queryOne(
    'SELECT COUNT(*)::int as count FROM products WHERE category_id=$1 AND company_id=$2',
    [catId, cid]
  );
  const prodCount = prodCountRow ? parseInt(prodCountRow.count, 10) : 0;

  if (prodCount > 0) {
    throw new Error(`Cannot delete category '${category.name}' because ${prodCount} product(s) are linked to it.`);
  }

  const row = await queryOne('DELETE FROM categories WHERE id=$1 AND company_id=$2 RETURNING *', [catId, cid]);
  return {
    success: true,
    message: `Category '${category.name}' deleted successfully.`,
    category: row
  };
}

// ====== PRODUCTS & UOM FOUNDATION (PHASE 1) ======
export async function getProducts(cid, filters) {
  if (!filters) filters = {};
  let sql = 'SELECT p.*, c.name as category_name, c.operational_unit as category_operational_unit FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.company_id=$1';
  const params = [cid];
  let idx = 2;
  if (filters.active === 'true' || filters.active === true || filters.is_active === true || filters.is_active === 'true') {
    sql += ' AND p.is_active=TRUE';
  } else if (filters.active === 'false' || filters.active === false || filters.is_active === false || filters.is_active === 'false') {
    sql += ' AND p.is_active=FALSE';
  }
  if (filters.category_id) { sql += ' AND p.category_id=$' + idx++; params.push(filters.category_id); }
  if (filters.search) {
    sql += ' AND (p.name ILIKE $' + idx + ' OR p.display_name ILIKE $' + idx + ' OR p.sku ILIKE $' + idx + ')';
    params.push(`%${filters.search}%`);
    idx++;
  }
  sql += ' ORDER BY p.name';
  const products = await queryAll(sql, params);
  
  const uoms = await queryAll('SELECT * FROM product_uoms WHERE company_id=$1 AND is_active=TRUE ORDER BY is_base_uom DESC, id ASC', [cid]);
  const uomMap = {};
  uoms.forEach(u => {
    if (!uomMap[u.product_id]) uomMap[u.product_id] = [];
    uomMap[u.product_id].push(u);
  });
  
  return products.map(p => ({
    ...p,
    image: p.image_url || p.image || null,
    image_url: p.image_url || p.image || null,
    warehouse_stock_units: Number(p.warehouse_stock_units || 0),
    pieces_per_unit: Number(p.pieces_per_unit || 1),
    purchase_price: Number(p.purchase_price || 0),
    unit_selling_price: Number(p.unit_selling_price || 0),
    piece_selling_price: Number(p.piece_selling_price || 0),
    min_stock_level: Number(p.min_stock_level || 5),
    pack_size: p.pack_size || '',
    buy_rate_uom: p.buy_rate_uom || p.selling_unit || 'Tray',
    selling_rate_uom: p.selling_rate_uom || p.selling_unit || 'Tray',
    uoms: uomMap[p.id] || [
      { uom: p.base_unit || 'Piece', conversion_to_base: 1, is_base_uom: true, is_purchase_uom: false, is_sales_uom: true, buy_rate: Number((Number(p.purchase_price || 0) / Number(p.pieces_per_unit || 1)).toFixed(2)), selling_rate: Number(p.piece_selling_price || 0) },
      { uom: p.selling_unit || 'Tray', conversion_to_base: Number(p.pieces_per_unit || 1), is_base_uom: false, is_purchase_uom: true, is_sales_uom: true, buy_rate: Number(p.purchase_price || 0), selling_rate: Number(p.unit_selling_price || 0) }
    ]
  }));
}

export async function addProduct(cid, d) {
  if (!d.name || !d.name.trim()) throw new Error('Product name is required.');
  const displayName = d.display_name && d.display_name.trim() ? d.display_name.trim() : d.name.trim();
  const packSize = d.pack_size ? d.pack_size.trim() : '';
  const baseUnit = d.base_unit && d.base_unit.trim() ? d.base_unit.trim() : 'Piece';
  const purchaseUnit = d.selling_unit && d.selling_unit.trim() ? d.selling_unit.trim() : (d.purchase_uom || 'Tray');
  const conversionFactor = Number(d.pieces_per_unit || d.conversion_factor || 1);
  if (isNaN(conversionFactor) || conversionFactor <= 0) {
    throw new Error('Conversion factor (pieces per unit) must be greater than 0.');
  }
  const buyRate = Number(d.purchase_price !== undefined ? d.purchase_price : (d.buy_rate || 0));
  if (isNaN(buyRate) || buyRate < 0) {
    throw new Error('Buy rate cannot be negative.');
  }
  const buyRateUom = d.buy_rate_uom || purchaseUnit;
  const unitSellingPrice = Number(d.unit_selling_price || 0);
  const sellingRateUom = d.selling_rate_uom || purchaseUnit;
  const pieceSellingPrice = d.piece_selling_price ? Number(d.piece_selling_price) : parseFloat((unitSellingPrice / conversionFactor).toFixed(2));
  const sku = d.sku || ('PRD-' + Date.now());

  // Validate Category ID & Existence
  let targetCategoryId = null;
  let targetCategoryName = null;
  if (d.category_id !== undefined && d.category_id !== null && d.category_id !== '') {
    const rawCatId = parseInt(d.category_id, 10);
    if (!isNaN(rawCatId)) {
      const catCheck = await queryOne('SELECT id, name FROM categories WHERE id=$1 AND company_id=$2', [rawCatId, cid]);
      if (catCheck) {
        targetCategoryId = catCheck.id;
        targetCategoryName = catCheck.name;
      }
    }
  }

  if (!targetCategoryId && d.category && String(d.category).trim()) {
    const catByName = await queryOne('SELECT id, name FROM categories WHERE LOWER(TRIM(name))=LOWER(TRIM($1)) AND company_id=$2', [String(d.category).trim(), cid]);
    if (catByName) {
      targetCategoryId = catByName.id;
      targetCategoryName = catByName.name;
    }
  }

  if (!targetCategoryId) {
    const availableCats = await queryAll('SELECT id, name FROM categories WHERE company_id=$1 AND is_active=TRUE ORDER BY id ASC', [cid]);
    if (availableCats.length > 0) {
      targetCategoryId = availableCats[0].id;
      targetCategoryName = availableCats[0].name;
    } else {
      // Auto-create a default 'General' category if none exist
      const newCat = await queryOne(
        "INSERT INTO categories (company_id, code, name, operational_unit, is_active) VALUES ($1, 'CAT-GEN', 'General', 'Piece', TRUE) RETURNING id, name",
        [cid]
      );
      targetCategoryId = newCat.id;
      targetCategoryName = newCat.name;
    }
  }

  if (!targetCategoryName && targetCategoryId) {
    const catLookup = await queryOne('SELECT name FROM categories WHERE id=$1', [targetCategoryId]);
    if (catLookup) targetCategoryName = catLookup.name;
  }

  const categoryNameToStore = targetCategoryName || (d.category && String(d.category).trim()) || 'General';
  const imageToStore = d.image_url !== undefined ? d.image_url : (d.image || null);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dupCheck = await client.query('SELECT id FROM products WHERE company_id=$1 AND LOWER(TRIM(name))=LOWER(TRIM($2)) AND is_active=TRUE', [cid, d.name]);
    if (dupCheck.rows.length > 0) {
      throw new Error(`Product '${d.name.trim()}' already exists. Please choose a different name.`);
    }
    const pRes = await client.query(
      `INSERT INTO products (
        company_id, category_id, category, sku, barcode, name, display_name, pack_size,
        selling_unit, base_unit, pieces_per_unit, purchase_price, buy_rate_uom,
        unit_selling_price, selling_rate_uom, piece_selling_price,
        min_stock_level, warehouse_stock_units, icon, image_url, is_active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
      [
        cid, targetCategoryId, categoryNameToStore, sku, d.barcode || null, d.name.trim(), displayName, packSize,
        purchaseUnit, baseUnit, conversionFactor, buyRate, buyRateUom,
        unitSellingPrice, sellingRateUom, pieceSellingPrice,
        Number(d.min_stock_level) || 0, Number(d.warehouse_stock_units) || 0,
        d.icon || null, imageToStore, d.is_active !== undefined ? Boolean(d.is_active) : true
      ]
    );
    const prod = pRes.rows[0];

    const baseBuyRate = parseFloat((buyRate / conversionFactor).toFixed(2));
    await client.query(
      `INSERT INTO product_uoms (company_id, product_id, uom, conversion_to_base, is_base_uom, is_purchase_uom, is_sales_uom, buy_rate, selling_rate, is_active)
       VALUES ($1, $2, $3, 1.00, true, false, true, $4, $5, true)
       ON CONFLICT (product_id, uom) DO UPDATE SET conversion_to_base=1.00, buy_rate=$4, selling_rate=$5`,
      [cid, prod.id, baseUnit, baseBuyRate, pieceSellingPrice]
    );

    if (purchaseUnit !== baseUnit) {
      await client.query(
        `INSERT INTO product_uoms (company_id, product_id, uom, conversion_to_base, is_base_uom, is_purchase_uom, is_sales_uom, buy_rate, selling_rate, is_active)
         VALUES ($1, $2, $3, $4, false, true, true, $5, $6, true)
         ON CONFLICT (product_id, uom) DO UPDATE SET conversion_to_base=$4, buy_rate=$5, selling_rate=$6`,
        [cid, prod.id, purchaseUnit, conversionFactor, buyRate, unitSellingPrice]
      );
    }

    await client.query('COMMIT');
    return { 
      success: true, 
      product: {
        ...prod,
        image: prod.image_url || prod.image || null,
        image_url: prod.image_url || prod.image || null
      } 
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateProduct(cid, prodId, d) {
  const pOld = await queryOne('SELECT * FROM products WHERE id=$1 AND company_id=$2', [prodId, cid]);
  if (!pOld) throw new Error('Product not found.');

  const conversionFactor = d.pieces_per_unit !== undefined ? Number(d.pieces_per_unit) : Number(pOld.pieces_per_unit);
  if (conversionFactor <= 0) throw new Error('Conversion factor must be greater than 0.');

  const buyRate = d.purchase_price !== undefined ? Number(d.purchase_price) : Number(pOld.purchase_price);
  if (buyRate < 0) throw new Error('Buy rate cannot be negative.');

  const baseUnit = d.base_unit || pOld.base_unit || 'Piece';
  const purchaseUnit = d.selling_unit || pOld.selling_unit || 'Tray';
  const buyRateUom = d.buy_rate_uom || pOld.buy_rate_uom || purchaseUnit;
  const unitSellingPrice = d.unit_selling_price !== undefined ? Number(d.unit_selling_price) : Number(pOld.unit_selling_price);
  const sellingRateUom = d.selling_rate_uom || pOld.selling_rate_uom || purchaseUnit;
  const pieceSellingPrice = d.piece_selling_price !== undefined ? Number(d.piece_selling_price) : parseFloat((unitSellingPrice / conversionFactor).toFixed(2));
  const packSize = d.pack_size !== undefined ? d.pack_size : pOld.pack_size;

  let targetCategoryId = null;
  let targetCategoryName = null;
  if (d.category_id !== undefined && d.category_id !== null && d.category_id !== '') {
    const rawCatId = parseInt(d.category_id, 10);
    if (!isNaN(rawCatId)) {
      const catCheck = await queryOne('SELECT id, name FROM categories WHERE id=$1 AND company_id=$2', [rawCatId, cid]);
      if (catCheck) {
        targetCategoryId = catCheck.id;
        targetCategoryName = catCheck.name;
      }
    }
  }
  if (!targetCategoryId && d.category && String(d.category).trim()) {
    const catByName = await queryOne('SELECT id, name FROM categories WHERE LOWER(TRIM(name))=LOWER(TRIM($1)) AND company_id=$2', [String(d.category).trim(), cid]);
    if (catByName) {
      targetCategoryId = catByName.id;
      targetCategoryName = catByName.name;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pRes = await client.query(
      `UPDATE products SET
        category_id=COALESCE($1, category_id), category=COALESCE($2, category), sku=COALESCE($3, sku), barcode=COALESCE($4, barcode),
        name=COALESCE($5, name), display_name=COALESCE($6, display_name), pack_size=COALESCE($7, pack_size),
        selling_unit=COALESCE($8, selling_unit), base_unit=COALESCE($9, base_unit), pieces_per_unit=COALESCE($10, pieces_per_unit),
        purchase_price=COALESCE($11, purchase_price), buy_rate_uom=COALESCE($12, buy_rate_uom),
        unit_selling_price=COALESCE($13, unit_selling_price), selling_rate_uom=COALESCE($14, selling_rate_uom),
        piece_selling_price=COALESCE($15, piece_selling_price), min_stock_level=COALESCE($16, min_stock_level),
        icon=COALESCE($17, icon), image_url=COALESCE($18, image_url), updated_at=NOW()
      WHERE id=$19 AND company_id=$20 RETURNING *`,
      [
        targetCategoryId !== null ? targetCategoryId : null,
        targetCategoryName || (d.category && String(d.category).trim()) || null,
        d.sku || null, d.barcode || null,
        d.name ? d.name.trim() : null, d.display_name ? d.display_name.trim() : null, packSize,
        purchaseUnit, baseUnit, conversionFactor,
        buyRate, buyRateUom,
        unitSellingPrice, sellingRateUom, pieceSellingPrice,
        d.min_stock_level !== undefined ? Number(d.min_stock_level) : null,
        d.icon || null, d.image_url || d.image || null,
        prodId, cid
      ]
    );
    const prod = pRes.rows[0];

    const baseBuyRate = parseFloat((buyRate / conversionFactor).toFixed(2));
    await client.query(
      `INSERT INTO product_uoms (company_id, product_id, uom, conversion_to_base, is_base_uom, is_purchase_uom, is_sales_uom, buy_rate, selling_rate, is_active)
       VALUES ($1, $2, $3, 1.00, true, false, true, $4, $5, true)
       ON CONFLICT (product_id, uom) DO UPDATE SET conversion_to_base=1.00, buy_rate=$4, selling_rate=$5`,
      [cid, prodId, baseUnit, baseBuyRate, pieceSellingPrice]
    );

    if (purchaseUnit !== baseUnit) {
      await client.query(
        `INSERT INTO product_uoms (company_id, product_id, uom, conversion_to_base, is_base_uom, is_purchase_uom, is_sales_uom, buy_rate, selling_rate, is_active)
         VALUES ($1, $2, $3, $4, false, true, true, $5, $6, true)
         ON CONFLICT (product_id, uom) DO UPDATE SET conversion_to_base=$4, buy_rate=$5, selling_rate=$6`,
        [cid, prodId, purchaseUnit, conversionFactor, buyRate, unitSellingPrice]
      );
    }

    await client.query('COMMIT');
    return { 
      success: true, 
      product: {
        ...prod,
        image: prod.image_url || prod.image || null,
        image_url: prod.image_url || prod.image || null
      } 
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateProductPrice(cid, prodId, d, actorUserId) {
  const pOld = await queryOne('SELECT * FROM products WHERE id=$1 AND company_id=$2', [prodId, cid]);
  if (!pOld) throw new Error('Product not found.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO product_price_history (
        company_id, product_id, purchase_price, buy_rate_uom, unit_selling_price, piece_selling_price, selling_rate_uom, changed_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        cid, prodId, pOld.purchase_price, pOld.buy_rate_uom || pOld.selling_unit,
        pOld.unit_selling_price, pOld.piece_selling_price, pOld.selling_rate_uom || pOld.selling_unit,
        actorUserId || null
      ]
    );

    const conversionFactor = d.pieces_per_unit !== undefined ? Number(d.pieces_per_unit) : Number(pOld.pieces_per_unit || 1);
    const buyRate = d.purchase_price !== undefined ? Number(d.purchase_price) : Number(pOld.purchase_price);
    const buyRateUom = d.buy_rate_uom || pOld.buy_rate_uom || pOld.selling_unit;
    const unitSellingPrice = d.unit_selling_price !== undefined ? Number(d.unit_selling_price) : Number(pOld.unit_selling_price);
    const sellingRateUom = d.selling_rate_uom || pOld.selling_rate_uom || pOld.selling_unit;
    const pieceSellingPrice = d.piece_selling_price !== undefined ? Number(d.piece_selling_price) : parseFloat((unitSellingPrice / conversionFactor).toFixed(2));

    const pRes = await client.query(
      `UPDATE products SET
        purchase_price=$1, buy_rate_uom=$2, unit_selling_price=$3, piece_selling_price=$4, selling_rate_uom=$5, pieces_per_unit=$6, updated_at=NOW()
      WHERE id=$7 AND company_id=$8 RETURNING *`,
      [buyRate, buyRateUom, unitSellingPrice, pieceSellingPrice, sellingRateUom, conversionFactor, prodId, cid]
    );

    const baseUnit = pOld.base_unit || 'Piece';
    const purchaseUnit = pOld.selling_unit || 'Tray';
    const baseBuyRate = parseFloat((buyRate / conversionFactor).toFixed(2));

    await client.query(
      `INSERT INTO product_uoms (company_id, product_id, uom, conversion_to_base, is_base_uom, is_purchase_uom, is_sales_uom, buy_rate, selling_rate, is_active)
       VALUES ($1, $2, $3, 1.00, true, false, true, $4, $5, true)
       ON CONFLICT (product_id, uom) DO UPDATE SET conversion_to_base=1.00, buy_rate=$4, selling_rate=$5`,
      [cid, prodId, baseUnit, baseBuyRate, pieceSellingPrice]
    );

    if (purchaseUnit !== baseUnit) {
      await client.query(
        `INSERT INTO product_uoms (company_id, product_id, uom, conversion_to_base, is_base_uom, is_purchase_uom, is_sales_uom, buy_rate, selling_rate, is_active)
         VALUES ($1, $2, $3, $4, false, true, true, $5, $6, true)
         ON CONFLICT (product_id, uom) DO UPDATE SET conversion_to_base=$4, buy_rate=$5, selling_rate=$6`,
        [cid, prodId, purchaseUnit, conversionFactor, buyRate, unitSellingPrice]
      );
    }

    await client.query('COMMIT');
    await auditLog({ companyId: cid, actorUserId, action: 'PRODUCT_PRICE_UPDATED', entityType: 'products', entityId: prodId });
    return { success: true, product: pRes.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function toggleProductStatus(cid, prodId, is_active) {
  const row = await queryOne('UPDATE products SET is_active=$1, updated_at=NOW() WHERE id=$2 AND company_id=$3 RETURNING *', [Boolean(is_active), prodId, cid]);
  if (!row) throw new Error('Product not found.');
  return { success: true, product: row };
}

export async function deleteProduct(cid, prodId) {
  const prod = await queryOne('SELECT * FROM products WHERE id=$1 AND company_id=$2', [prodId, cid]);
  if (!prod) throw new Error('Product not found.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM product_uoms WHERE product_id=$1 AND company_id=$2', [prodId, cid]);
    await client.query('DELETE FROM product_price_history WHERE product_id=$1 AND company_id=$2', [prodId, cid]);
    await client.query('DELETE FROM employee_stock WHERE product_id=$1 AND company_id=$2', [prodId, cid]);
    await client.query('DELETE FROM stock_transactions WHERE product_id=$1 AND company_id=$2', [prodId, cid]);
    await client.query('UPDATE sale_items SET product_id=NULL WHERE product_id=$1', [prodId]);
    await client.query('UPDATE damages SET product_id=NULL WHERE product_id=$1', [prodId]);
    await client.query('UPDATE inventory_movements SET product_id=NULL WHERE product_id=$1', [prodId]);

    const res = await client.query('DELETE FROM products WHERE id=$1 AND company_id=$2 RETURNING *', [prodId, cid]);
    await client.query('COMMIT');
    return { 
      success: true, 
      message: `Product '${prod.display_name || prod.name}' deleted successfully.`, 
      product: res.rows[0] 
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getProductUoms(cid, prodId) {
  return await queryAll('SELECT * FROM product_uoms WHERE company_id=$1 AND product_id=$2 ORDER BY is_base_uom DESC, conversion_to_base ASC', [cid, prodId]);
}

export async function configureProductUom(cid, prodId, uData) {
  const uom = (uData.uom || '').trim();
  if (!uom) throw new Error('UOM is required.');
  const conversion = Number(uData.conversion_to_base || 1);
  if (isNaN(conversion) || conversion <= 0) throw new Error('Conversion factor must be greater than 0.');
  const buyRate = Number(uData.buy_rate || 0);
  if (isNaN(buyRate) || buyRate < 0) throw new Error('Buy rate cannot be negative.');
  const sellingRate = Number(uData.selling_rate || 0);
  const isBase = Boolean(uData.is_base_uom);
  if (isBase && conversion !== 1) throw new Error('Base UOM must have conversion ratio of 1.');

  const row = await queryOne(
    `INSERT INTO product_uoms (
      company_id, product_id, uom, conversion_to_base, is_base_uom, is_purchase_uom, is_sales_uom, buy_rate, selling_rate, is_active
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (product_id, uom) DO UPDATE SET
      conversion_to_base=EXCLUDED.conversion_to_base,
      is_base_uom=EXCLUDED.is_base_uom,
      is_purchase_uom=EXCLUDED.is_purchase_uom,
      is_sales_uom=EXCLUDED.is_sales_uom,
      buy_rate=EXCLUDED.buy_rate,
      selling_rate=EXCLUDED.selling_rate,
      is_active=EXCLUDED.is_active,
      updated_at=NOW()
    RETURNING *`,
    [cid, prodId, uom, conversion, isBase, Boolean(uData.is_purchase_uom), Boolean(uData.is_sales_uom), buyRate, sellingRate, uData.is_active !== undefined ? Boolean(uData.is_active) : true]
  );
  return { success: true, uom: row };
}

// ====== STORE KEEPER WAREHOUSE INVENTORY ======
export async function getWarehouseStock(cid) {
  return await queryAll(
    'SELECT p.id, p.company_id, p.name, p.display_name, p.sku, p.selling_unit, p.base_unit, p.pieces_per_unit, ' +
    'p.purchase_price, p.unit_selling_price, p.piece_selling_price, p.warehouse_stock_units, ' +
    '(p.warehouse_stock_units * p.pieces_per_unit) as total_pieces_available, ' +
    'p.min_stock_level, p.icon, p.image_url, p.is_active, c.name as category_name ' +
    'FROM products p LEFT JOIN categories c ON c.id=p.category_id ' +
    'WHERE p.company_id=$1 AND p.is_active=TRUE ORDER BY p.name',
    [cid]
  );
}

export async function receiveStock(cid, data, actorUserId) {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS reference VARCHAR(255);
      ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS received_by VARCHAR(255);
      ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS notes TEXT;
    `).catch(() => {});
    await client.query('BEGIN');
    const items = data.items || [{ product_id: data.product_id, quantity: data.quantity, unit: data.unit }];
    const reference = data.reference || data.dealer_name || null;
    const received_by = data.received_by || data.dealer_name || 'Store Keeper';
    const notes = data.notes || (data.dealer_name ? `Supplier: ${data.dealer_name}` : null);
    const results = [];
    for (const item of items) {
      const qty = Number(item.quantity || item.qty_units);
      const pid = Number(item.product_id);
      if (!qty || qty <= 0) throw new Error('Quantity must be greater than 0');
      if (!pid) throw new Error('Valid product_id is required');
      const pRes = await client.query('SELECT * FROM products WHERE id=$1 AND company_id=$2 FOR UPDATE', [pid, cid]);
      if (pRes.rows.length === 0) throw new Error('Product not found');
      const prod = pRes.rows[0];
      if (prod.is_active === false || prod.is_active === 0) {
        throw new Error('Cannot receive stock for an inactive product.');
      }
      const uRes = await client.query('UPDATE products SET warehouse_stock_units=warehouse_stock_units+$1, updated_at=NOW() WHERE id=$2 RETURNING *', [qty, pid]);
      const movNo = 'MOV-IN-' + Date.now() + '-' + Math.floor(Math.random()*1000);
      let movRes;
      try {
        movRes = await client.query(
          'INSERT INTO inventory_movements (company_id, movement_no, movement_type, product_id, product_name, qty_units, unit, reference, received_by, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
          [cid, movNo, 'INWARD', pid, prod.display_name, qty, item.unit || prod.selling_unit, reference, received_by, notes]
        );
      } catch (colErr) {
        movRes = await client.query(
          'INSERT INTO inventory_movements (company_id, movement_no, movement_type, product_id, product_name, qty_units, unit, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
          [cid, movNo, 'INWARD', pid, prod.display_name, qty, item.unit || prod.selling_unit, notes || reference]
        );
      }
      results.push({ product: uRes.rows[0], movement: movRes.rows[0] });
    }
    await client.query('COMMIT');
    await auditLog({ companyId: cid, actorUserId, action: 'STOCK_RECEIVED', entityType: 'inventory_movements', metadata: { itemsCount: items.length, reference } });
    return { success: true, message: 'Stock received successfully', results };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function issueStockToEmployee(cid, data, actorUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const employee_id = data.employee_id;
    let items = data.items;
    if (!items && data.product_id && (data.quantity || data.qty_units)) {
      items = [{ product_id: data.product_id, quantity: data.quantity || data.qty_units, unit_type: data.unit_type || 'Tray' }];
    }
    const { route_id, notes } = data;
    if (!employee_id) throw new Error('Employee ID is required');
    if (!items || !Array.isArray(items) || items.length === 0) throw new Error('Items array is required');

    const clientRef = data.client_reference || data.idempotency_key || null;
    if (clientRef) {
      const existing = await client.query("SELECT * FROM inventory_movements WHERE company_id=$1 AND reference=$2 AND movement_type='OUTWARD'", [cid, clientRef]);
      if (existing.rows.length > 0) {
        await client.query('COMMIT');
        return { success: true, message: 'Stock allocated previously (idempotent request)', isDuplicate: true };
      }
    }

    const empRes = await client.query('SELECT * FROM employees WHERE id=$1 AND company_id=$2 AND is_active=TRUE', [employee_id, cid]);
    if (empRes.rows.length === 0) throw new Error('Employee not found or inactive');
    const emp = empRes.rows[0];

    // Get or activate driver session
    const session = await getOrCreateActiveDriverSession(cid, employee_id, client);

    const results = [];
    for (const item of items) {
      const pid = Number(item.product_id);
      const qty = Number(item.qty_units || item.quantity);
      if (!qty || qty <= 0) throw new Error('Quantity must be greater than 0');
      const pRes = await client.query('SELECT * FROM products WHERE id=$1 AND company_id=$2 FOR UPDATE', [pid, cid]);
      if (pRes.rows.length === 0) throw new Error('Product not found');
      const prod = pRes.rows[0];
      if (prod.is_active === false || prod.is_active === 0) {
        throw new Error('Cannot allocate stock for an inactive product.');
      }
      const availableStock = Number(prod.warehouse_stock_units || 0);
      const unitName = prod.selling_unit || item.unit || 'Tray';
      if (availableStock < qty) {
        throw new Error(`Insufficient warehouse stock for '${prod.display_name}'. Maximum available quantity is ${availableStock} ${unitName}. Cannot allocate ${qty} ${unitName}.`);
      }
      await client.query('UPDATE products SET warehouse_stock_units=warehouse_stock_units-$1, updated_at=NOW() WHERE id=$2', [qty, pid]);
      await client.query(
        'INSERT INTO employee_stock (employee_id, product_id, company_id, qty_units, unit) VALUES ($1,$2,$3,$4,$5) ' +
        'ON CONFLICT (employee_id, product_id) DO UPDATE SET qty_units=employee_stock.qty_units+$4, updated_at=NOW()',
        [employee_id, pid, cid, qty, item.unit || prod.selling_unit]
      );
      const movNo = 'MOV-ISSUE-' + Date.now() + '-' + Math.floor(Math.random()*1000);
      try {
        await client.query(
          'INSERT INTO inventory_movements (company_id, movement_no, movement_type, product_id, product_name, employee_id, employee_name, qty_units, unit, notes, reference) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          [cid, movNo, 'OUTWARD', pid, prod.display_name, employee_id, emp.full_name, qty, item.unit || prod.selling_unit, notes || 'Dispatched to vehicle', clientRef]
        );
      } catch (movErr) {
        await client.query(
          'INSERT INTO inventory_movements (company_id, movement_no, movement_type, product_id, product_name, employee_id, employee_name, qty_units, unit, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [cid, movNo, 'OUTWARD', pid, prod.display_name, employee_id, emp.full_name, qty, item.unit || prod.selling_unit, notes || 'Dispatched to vehicle']
        );
      }

      // Record immutable allocation transaction
      await client.query(
        'INSERT INTO stock_transactions (company_id, session_id, employee_id, product_id, unit, transaction_type, qty_units, unit_cost, total_cost, reference_id, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [cid, session.id, employee_id, pid, item.unit || prod.selling_unit, 'ALLOCATION', qty, Number(prod.purchase_price || 0), parseFloat((qty * Number(prod.purchase_price || 0)).toFixed(2)), movNo, notes || 'Stock allocated to driver vehicle', actorUserId || null]
      );

      results.push({ product_id: pid, product_name: prod.display_name, qty_issued: qty, unit: item.unit || prod.selling_unit });
    }
    await client.query('COMMIT');
    await auditLog({ companyId: cid, actorUserId, action: 'STOCK_ISSUED', entityType: 'employee_stock', entityId: employee_id, metadata: { results, sessionId: session.id } });
    return { success: true, message: 'Stock allocated to driver vehicle successfully', results, session };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getEmployeeStockReport(cid, employeeId) {
  let sql =
    'SELECT es.id, es.employee_id, e.full_name as employee_name, e.vehicle_number, ' +
    'es.product_id, p.name, p.display_name, p.selling_unit, p.base_unit, p.pieces_per_unit, ' +
    'p.purchase_price, p.unit_selling_price, p.piece_selling_price, es.qty_units, ' +
    '(es.qty_units * p.pieces_per_unit) as total_pieces, ' +
    '(es.qty_units * p.unit_selling_price) as stock_value, ' +
    'p.icon, p.image_url ' +
    'FROM employee_stock es ' +
    'JOIN employees e ON e.id=es.employee_id ' +
    'JOIN products p ON p.id=es.product_id ' +
    'WHERE es.company_id=$1 AND es.qty_units > 0';
  const params = [cid];
  if (employeeId) {
    sql += ' AND es.employee_id=$2';
    params.push(employeeId);
  }
  sql += ' ORDER BY e.full_name, p.name';
  return await queryAll(sql, params);
}

export async function getAllEmployeeStockReport(cid) {
  return await getEmployeeStockReport(cid);
}

export async function getEmployeeAccountSummary(cid, empId, date) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const activeSession = await getOrCreateActiveDriverSession(cid, empId);

  const sRes = await query(
    'SELECT COALESCE(SUM(total_amount), 0) as total_sales, ' +
    'COALESCE(SUM(cash_paid), 0) as cash_collected, ' +
    'COALESCE(SUM(gpay_paid), 0) as gpay_collected, ' +
    'COALESCE(SUM(credit_paid), 0) as credit_sales, ' +
    'COALESCE(SUM(CASE WHEN payment_mode = \'SPLIT\' THEN total_amount ELSE 0 END), 0) as split_total, ' +
    'COUNT(CASE WHEN payment_mode = \'SPLIT\' THEN 1 ELSE NULL END) as split_count, ' +
    'COUNT(*) as bills_count ' +
    'FROM sales WHERE company_id = $1 AND employee_id = $2 AND (status IS NULL OR status = \'ACTIVE\' OR status != \'CANCELLED\') AND (sale_date = $3::date OR created_at::date = $3::date)',
    [cid, empId, targetDate]
  );
  const dRes = await query(
    'SELECT COALESCE(SUM(damage_cost), 0) as damage_cost, COUNT(*) as damage_count ' +
    'FROM damages WHERE company_id = $1 AND employee_id = $2 AND created_at::date = $3::date',
    [cid, empId, targetDate]
  );
  const eRes = await query(
    'SELECT COALESCE(SUM(amount), 0) as expense_amount ' +
    'FROM expenses WHERE company_id = $1 AND employee_id = $2 AND (expense_date = $3::date OR created_at::date = $3::date)',
    [cid, empId, targetDate]
  );
  const expRows = await queryAll(
    'SELECT * FROM expenses WHERE company_id = $1 AND employee_id = $2 AND (expense_date = $3::date OR created_at::date = $3::date) ORDER BY created_at DESC',
    [cid, empId, targetDate]
  );
  const emp = await queryOne(
    'SELECT e.*, r.name as route_name, r.code as route_code ' +
    'FROM employees e ' +
    'LEFT JOIN routes r ON r.id = e.route_id ' +
    'WHERE e.id = $1 AND e.company_id = $2',
    [empId, cid]
  );
  const sRow = sRes.rows[0] || {};
  const dRow = dRes.rows[0] || {};
  const eRow = eRes.rows[0] || {};

  const totalSales = Number(sRow.total_sales || 0);
  const totalExpenses = Number(eRow.expense_amount || 0);
  const netSales = Number((totalSales - totalExpenses).toFixed(2));
  const cashCollected = Number(sRow.cash_collected || 0);
  const gpayCollected = Number(sRow.gpay_collected || 0);
  const creditSales = Number(sRow.credit_sales || 0);

  const setRes = await queryOne(
    'SELECT * FROM settlements WHERE company_id = $1 AND employee_id = $2 AND settlement_date = $3::date ORDER BY created_at DESC LIMIT 1',
    [cid, empId, targetDate]
  );

  const stockItems = await getEmployeeStock(cid, empId);
  const availableStock = stockItems.map(st => {
    const ppu = Number(st.pieces_per_unit || 1);
    const qtyUnits = Number(st.qty_units || 0);
    return {
      ...st,
      qty_units: qtyUnits,
      pieces: Math.round(qtyUnits * ppu)
    };
  });

  const statusNorm = (activeSession?.status === 'ACTIVE') ? 'OPEN' : (activeSession?.status || 'OPEN');
  const isLocked = statusNorm === 'END_DAY_SUBMITTED' || statusNorm === 'CLOSED' || !!setRes;

  return {
    date: targetDate,
    working_date: targetDate,
    employee_id: empId,
    employee_name: emp ? emp.full_name : 'Driver',
    vehicle_number: emp ? emp.vehicle_number : null,
    route_id: emp?.route_id || activeSession?.route_id || null,
    route_name: emp?.route_name || activeSession?.route_name || 'Assigned Territory',
    route_code: emp?.route_code || activeSession?.route_code || '',
    status: statusNorm,
    opened_at: activeSession?.opened_at || null,
    closed_at: activeSession?.closed_at || null,
    total_sales: totalSales,
    gross_sales: totalSales,
    total_bills: Number(sRow.bills_count || 0),
    cash_collected: cashCollected,
    gpay_collected: gpayCollected,
    credit_sales: creditSales,
    split_total: Number(sRow.split_total || 0),
    split_count: Number(sRow.split_count || 0),
    total_expenses: totalExpenses,
    net_sales: netSales,
    net_after_expenses: netSales,
    damage_cost: Number(dRow.damage_cost || 0),
    expenses: expRows || [],
    available_stock: availableStock,
    is_closed: isLocked,
    is_locked: isLocked,
    session: Object.assign({}, activeSession, { status: statusNorm }),
    settlement: setRes || null
  };
}

export async function getEmployeeAssignedShops(cid, empId, date) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const emp = await queryOne('SELECT * FROM employees WHERE id=$1 AND company_id=$2', [empId, cid]);
  if (!emp) return [];

  let routeId = emp.route_id;
  if (!routeId) {
    const ra = await queryOne(
      "SELECT route_id FROM route_assignments WHERE employee_id=$1 AND assigned_date=$2 AND status != 'COMPLETED' ORDER BY id DESC LIMIT 1",
      [empId, targetDate]
    );
    if (ra) routeId = ra.route_id;
  }

  if (!routeId) {
    return []; // Driver has no assigned route -> strictly returns 0 shops
  }

  return await queryAll(
    `SELECT s.*, 
       v.name as village_name, v.code as village_code, 
       r.name as route_name, r.code as route_code,
       v.route_id as effective_route_id
     FROM shops s
     JOIN villages v ON v.id = s.village_id AND v.status = 'ACTIVE'
     JOIN routes r ON r.id = v.route_id AND r.is_active = TRUE
     WHERE s.company_id = $1 AND s.is_active = TRUE AND v.route_id = $2
     ORDER BY s.id ASC`,
    [cid, routeId]
  );
}

export async function processEmployeeReturn(cid, data, actorUserId) {
  return await acceptEmployeeReturns(cid, data, actorUserId);
}

export async function acceptEmployeeReturns(cid, data, actorUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { employee_id, items, notes } = data;
    if (!employee_id) throw new Error('Employee ID is required');
    if (!items || !Array.isArray(items) || items.length === 0) throw new Error('Items array is required');
    const empRes = await client.query('SELECT * FROM employees WHERE id=$1 AND company_id=$2 AND is_active=TRUE', [employee_id, cid]);
    if (empRes.rows.length === 0) throw new Error('Employee not found or inactive');
    const emp = empRes.rows[0];

    const session = await getOrCreateActiveDriverSession(cid, employee_id, client);

    const results = [];
    for (const item of items) {
      const pid = Number(item.product_id);
      const qty = Number(item.qty_units || item.quantity);
      if (!qty || qty <= 0) throw new Error('Return quantity must be greater than 0');
      const esRes = await client.query('SELECT * FROM employee_stock WHERE employee_id=$1 AND product_id=$2 AND company_id=$3 FOR UPDATE', [employee_id, pid, cid]);
      if (esRes.rows.length === 0 || esRes.rows[0].qty_units < qty) {
        const held = esRes.rows.length > 0 ? esRes.rows[0].qty_units : 0;
        throw new Error(`Cannot return ${qty} units. Driver currently holds only ${held} units`);
      }
      await client.query('UPDATE employee_stock SET qty_units=qty_units-$1, updated_at=NOW() WHERE employee_id=$2 AND product_id=$3 AND company_id=$4', [qty, employee_id, pid, cid]);
      const pRes = await client.query('UPDATE products SET warehouse_stock_units=warehouse_stock_units+$1, updated_at=NOW() WHERE id=$2 AND company_id=$3 RETURNING *', [qty, pid, cid]);
      const prod = pRes.rows[0];
      const movNo = 'MOV-RET-' + Date.now() + '-' + Math.floor(Math.random()*1000);
      await client.query(
        'INSERT INTO inventory_movements (company_id, movement_no, movement_type, product_id, product_name, employee_id, employee_name, qty_units, unit, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [cid, movNo, 'RETURN', pid, prod.display_name, employee_id, emp.full_name, qty, item.unit || prod.selling_unit, notes || 'Unsold stock returned from route']
      );

      // Record immutable stock transaction
      await client.query(
        'INSERT INTO stock_transactions (company_id, session_id, employee_id, product_id, unit, transaction_type, qty_units, unit_cost, total_cost, reference_id, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [cid, session.id, employee_id, pid, item.unit || prod.selling_unit, 'GOOD_RETURN', qty, Number(prod.purchase_price || 0), parseFloat((qty * Number(prod.purchase_price || 0)).toFixed(2)), movNo, notes || 'Good return accepted to warehouse', actorUserId || null]
      );

      results.push({ product_id: pid, product_name: prod.display_name, qty_returned: qty });
    }
    await client.query('COMMIT');
    await auditLog({ companyId: cid, actorUserId, action: 'STOCK_RETURNED', entityType: 'inventory_movements', metadata: { results, sessionId: session.id } });
    return { success: true, message: 'Returned stock accepted into warehouse successfully', results };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function processDamage(cid, data, actorUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const employee_id = data.employee_id ? Number(data.employee_id) : null;
    const isWarehouse = data.is_warehouse === true || data.is_warehouse === 'true' || data.damage_source === 'WAREHOUSE';

    // Normalize items to process
    let itemsToProcess = [];
    if (Array.isArray(data.items) && data.items.length > 0) {
      for (const it of data.items) {
        const itemQty = Number(it.damage_qty ?? it.damage_quantity ?? it.damageQuantity ?? it.quantity ?? it.qty_units ?? it.qty ?? 0);
        if (isNaN(itemQty) || itemQty < 0) {
          throw new Error('Damage quantity must be a non-negative number.');
        }
        if (itemQty > 0) {
          itemsToProcess.push({
            product_id: it.product_id,
            quantity: itemQty,
            unit: it.unit || it.unit_type || it.damage_unit,
            reason: it.reason,
            notes: it.notes
          });
        }
      }
    } else {
      const pid = Number(data.product_id);
      const qty = Number(data.damage_qty ?? data.damage_quantity ?? data.qty_units ?? data.quantity ?? data.qty ?? 0);
      if (isNaN(qty) || qty < 0) {
        throw new Error('Damage quantity must be a non-negative number.');
      }
      if (pid && qty > 0) {
        itemsToProcess.push({
          product_id: pid,
          quantity: qty,
          unit: data.unit || data.unit_type || data.damage_unit,
          reason: data.reason,
          notes: data.notes
        });
      }
    }

    if (itemsToProcess.length === 0) {
      throw new Error('At least one product with damage quantity greater than 0 is required.');
    }

    let empName = null;
    let sessionId = null;

    if (!isWarehouse) {
      if (!employee_id) throw new Error('Employee ID is required for driver damage report');
      const empRes = await client.query('SELECT * FROM employees WHERE id=$1 AND company_id=$2', [employee_id, cid]);
      if (empRes.rows.length === 0) throw new Error('Employee not found');
      empName = empRes.rows[0].full_name;

      const session = await getOrCreateActiveDriverSession(cid, employee_id, client);
      if (session && (session.status === 'CLOSED' || session.status === 'COMPLETED' || session.status === 'RETURN_VERIFIED' || session.status === 'RECONCILED')) {
        throw new Error('Forbidden: Working session for this driver has been submitted and locked. Damage reporting is not allowed on completed returns.');
      }
      sessionId = session.id;
    }

    const recordedDamages = [];
    let totalDamageCost = 0;

    for (const item of itemsToProcess) {
      const pid = Number(item.product_id);
      const rawQty = Number(item.quantity ?? item.damage_qty ?? item.qty_units ?? item.qty ?? 0);
      const dmgReason = item.reason || data.reason || 'Leakage / Burst';
      const dmgNotes = item.notes || data.notes || null;

      if (!pid) throw new Error('Valid Product ID is required');
      if (isNaN(rawQty) || rawQty <= 0) {
        throw new Error('Damage quantity must be a valid positive number (> 0)');
      }

      const pRes = await client.query(
        `SELECT p.*, c.name as category_name, c.operational_unit as category_operational_unit 
         FROM products p 
         LEFT JOIN categories c ON c.id = p.category_id 
         WHERE p.id = $1 AND p.company_id = $2 AND p.is_active = TRUE 
         FOR UPDATE OF p`,
        [pid, cid]
      );
      if (pRes.rows.length === 0) throw new Error(`Product #${pid} not found or inactive`);
      const prod = pRes.rows[0];

      const opUnit = getOperationalUnit(prod);
      const ppu = Math.max(1, Number(prod.pieces_per_unit || 1));
      const buyRatePerSellingUnit = Number(prod.purchase_price || prod.unit_selling_price || 0);
      const pieceBuyRate = ppu > 0 ? (buyRatePerSellingUnit / ppu) : buyRatePerSellingUnit;

      let calculationUnit;
      let qtyInSellingUnits;
      let normalizedPieces;
      let damageCost;

      if (opUnit.isPieceBased) {
        // 1. TRAY / MILK / CURD -> PIECE-BASED CALCULATION ONLY
        calculationUnit = 'Piece';
        const damagePieces = rawQty;
        qtyInSellingUnits = damagePieces / ppu;
        normalizedPieces = damagePieces;
        damageCost = parseFloat((damagePieces * pieceBuyRate).toFixed(2));
      } else {
        // 2. NON-TRAY PRODUCTS -> CONFIGURED OPERATIONAL UNIT BASED (Case / Box / Bag, etc.)
        calculationUnit = opUnit.operationalUnit;
        qtyInSellingUnits = rawQty;
        normalizedPieces = rawQty * ppu;
        damageCost = parseFloat((rawQty * buyRatePerSellingUnit).toFixed(2));
      }

      totalDamageCost += damageCost;

      if (isWarehouse) {
        if (opUnit.isPieceBased) {
          const whPieces = Math.round(Number(prod.warehouse_stock_units || 0) * ppu);
          if (whPieces + 0.00001 < rawQty) {
            throw new Error(`Cannot report ${rawQty} damaged Pieces for "${prod.display_name}". Warehouse stock is only ${whPieces} Pieces (${Number(prod.warehouse_stock_units).toFixed(2)} ${prod.selling_unit || 'Tray'})`);
          }
        } else {
          if (Number(prod.warehouse_stock_units || 0) + 0.00001 < rawQty) {
            throw new Error(`Cannot report ${rawQty} damaged ${calculationUnit} for "${prod.display_name}". Warehouse stock is only ${Number(prod.warehouse_stock_units).toFixed(2)} ${calculationUnit}`);
          }
        }
        await client.query('UPDATE products SET warehouse_stock_units=GREATEST(0, warehouse_stock_units-$1), updated_at=NOW() WHERE id=$2', [qtyInSellingUnits, pid]);
      } else {
        // Driver damage: Lock driver stock row
        const esRes = await client.query(
          'SELECT * FROM employee_stock WHERE employee_id=$1 AND product_id=$2 AND company_id=$3 FOR UPDATE',
          [employee_id, pid, cid]
        );
        const currentDriverStock = esRes.rows.length > 0 ? Number(esRes.rows[0].qty_units) : 0;
        
        // Strict Validation: Damage quantity MUST NEVER exceed current driver stock
        if (opUnit.isPieceBased) {
          const heldPieces = Math.round(currentDriverStock * ppu);
          if (esRes.rows.length === 0 || (heldPieces + 0.00001) < rawQty) {
            throw new Error(`Cannot report ${rawQty} damaged Pieces for "${prod.display_name}". Driver holds only ${heldPieces} Pieces (${currentDriverStock} ${prod.selling_unit || 'Tray'})`);
          }
        } else {
          if (esRes.rows.length === 0 || (currentDriverStock + 0.00001) < rawQty) {
            throw new Error(`Cannot report ${rawQty} damaged ${calculationUnit} for "${prod.display_name}". Driver holds only ${currentDriverStock} ${calculationUnit}`);
          }
        }

        // Deduct driver stock immediately
        await client.query(
          'UPDATE employee_stock SET qty_units=GREATEST(0, qty_units-$1), updated_at=NOW() WHERE employee_id=$2 AND product_id=$3 AND company_id=$4',
          [qtyInSellingUnits, employee_id, pid, cid]
        );
      }

      const initialStatus = 'VERIFIED';
      const dRes = await client.query(
        'INSERT INTO damages (company_id, product_id, product_name, employee_id, employee_name, qty_units, unit, damage_unit, base_quantity, damage_cost, reason, notes, session_id, status, verified_by, verified_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *',
        [cid, pid, prod.display_name, employee_id || null, empName, qtyInSellingUnits, calculationUnit, calculationUnit, normalizedPieces, damageCost, dmgReason, dmgNotes || dmgReason, sessionId, initialStatus, actorUserId || null, new Date()]
      );
      recordedDamages.push(dRes.rows[0]);

      const movNo = 'MOV-DMG-' + Date.now() + '-' + Math.floor(Math.random()*10000);
      const movementNotes = `Damaged: ${rawQty} ${calculationUnit}${opUnit.isPieceBased ? ` (${normalizedPieces} Pieces)` : ''} - ${dmgReason}`;
      await client.query(
        'INSERT INTO inventory_movements (company_id, movement_no, movement_type, product_id, product_name, employee_id, employee_name, qty_units, unit, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [cid, movNo, 'DAMAGE', pid, prod.display_name, employee_id || null, empName, rawQty, calculationUnit, movementNotes]
      );

      if (sessionId) {
        await client.query(
          'INSERT INTO stock_transactions (company_id, session_id, employee_id, product_id, unit, transaction_type, qty_units, unit_cost, total_cost, reference_id, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
          [cid, sessionId, employee_id, pid, calculationUnit, 'DAMAGE', qtyInSellingUnits, opUnit.isPieceBased ? pieceBuyRate : buyRatePerSellingUnit, damageCost, movNo, dmgReason, actorUserId || null]
        );
      }
    }

    await client.query('COMMIT');
    await auditLog({ companyId: cid, actorUserId, action: 'DAMAGE_RECORDED', entityType: 'damages', entityId: recordedDamages[0]?.id });

    return {
      success: true,
      message: 'Damage recorded and driver stock deducted successfully',
      damages: recordedDamages,
      damage: recordedDamages[0],
      damage_cost: parseFloat(totalDamageCost.toFixed(2))
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ====== ORG / DEFAULT COUNTER SHOP RESOLUTION ======
export async function getOrCreateDefaultOrgShop(cid, client) {
  const runner = client || pool;
  const shopRes = await runner.query(
    "SELECT * FROM shops WHERE company_id=$1 AND name ILIKE 'AVS AGENCIES' ORDER BY id ASC LIMIT 1",
    [cid]
  );
  if (shopRes.rows.length > 0) {
    return shopRes.rows[0];
  }

  const lastShop = await runner.query(
    "SELECT code FROM shops WHERE company_id=$1 AND code LIKE 'SHP-%' ORDER BY id DESC LIMIT 1",
    [cid]
  );
  let nextNum = 1;
  if (lastShop.rows.length > 0 && lastShop.rows[0].code) {
    const match = lastShop.rows[0].code.match(/SHP-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  const code = 'SHP-' + String(nextNum).padStart(3, '0');

  const insertRes = await runner.query(
    `INSERT INTO shops (company_id, name, code, owner_name, phone, address, village_id, route_id, opening_balance, current_due, is_active)
     VALUES ($1, 'AVS AGENCIES', $2, 'AVS Main Counter', '0000000000', 'Warehouse Store Counter', NULL, NULL, 0, 0, TRUE)
     RETURNING *`,
    [cid, code]
  );
  return insertRes.rows[0];
}

// ====== SALES & POS BILLING ENGINE ======
export async function createSale(cid, d, actorUserId) {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE sales ALTER COLUMN "date" DROP NOT NULL;
      ALTER TABLE sales ALTER COLUMN "time" DROP NOT NULL;
    `).catch(() => {});
    await client.query('BEGIN');
    const { employee_id, shop_id, payment_mode, items, cash_paid, gpay_paid, credit_paid } = d;
    if (!items || !Array.isArray(items) || items.length === 0) throw new Error('Sale items array is required');

    const isStoreDirectSale = d.is_store_direct_sale === true || d.sale_type === 'STOREKEEPER_DIRECT' || (!employee_id && (!shop_id || d.shop_name === 'AVS AGENCIES'));

    const clientRef = d.client_reference || d.idempotency_key || d.bill_no || null;
    if (clientRef) {
      const existing = await client.query("SELECT * FROM sales WHERE company_id=$1 AND bill_no=$2", [cid, clientRef]);
      if (existing.rows.length > 0) {
        await client.query('COMMIT');
        return { success: true, sale: existing.rows[0], message: 'Sale processed previously (idempotent request)', isDuplicate: true };
      }
    }

    let shop = null;
    if (isStoreDirectSale) {
      if (shop_id) {
        const targetShopId = Number(shop_id || d.shopId);
        if (!isNaN(targetShopId) && targetShopId > 0) {
          const shR = await client.query('SELECT * FROM shops WHERE id=$1 AND company_id=$2 AND is_active=TRUE FOR UPDATE', [targetShopId, cid]);
          if (shR.rows.length > 0) shop = shR.rows[0];
        }
      }
      if (!shop) {
        shop = await getOrCreateDefaultOrgShop(cid, client);
      }
    } else {
      if (!shop_id) throw new Error('Shop selection is required for billing');
      const targetShopId = Number(shop_id || d.shopId);
      let shR;
      if (!isNaN(targetShopId) && targetShopId > 0) {
        shR = await client.query('SELECT * FROM shops WHERE id=$1 AND company_id=$2 AND is_active=TRUE FOR UPDATE', [targetShopId, cid]);
      }
      if (!shR || shR.rows.length === 0) {
        const codeOrName = String(d.shop_code || d.shop_name || shop_id || '').trim();
        if (codeOrName) {
          shR = await client.query('SELECT * FROM shops WHERE (code=$1 OR name=$1) AND company_id=$2 AND is_active=TRUE FOR UPDATE', [codeOrName, cid]);
        }
      }
      if (!shR || shR.rows.length === 0) throw new Error('Selected shop not found or inactive');
      shop = shR.rows[0];

      if (employee_id) {
        const sessRes = await client.query(
          'SELECT * FROM driver_sessions WHERE company_id = $1 AND employee_id = $2 ORDER BY id DESC LIMIT 1',
          [cid, Number(employee_id)]
        );
        const sess = sessRes.rows[0];
        if (sess && (sess.status === 'CLOSED' || sess.status === 'COMPLETED' || sess.status === 'RETURN_VERIFIED' || sess.status === 'RECONCILED')) {
          throw new Error('Forbidden: Working session for this driver is closed and finalized. New sales cannot be recorded.');
        }
      }
    }

    let empId = employee_id || null;
    let empName = 'Store Keeper POS';
    let driverSession = null;

    if (empId) {
      const eR = await client.query('SELECT * FROM employees WHERE id=$1 AND company_id=$2', [empId, cid]);
      if (eR.rows.length === 0) throw new Error('Employee not found');
      const emp = eR.rows[0];
      empName = emp.full_name;

      let empRouteId = emp.route_id;
      if (!empRouteId) {
        const today = new Date().toISOString().split('T')[0];
        const raR = await client.query(
          "SELECT route_id FROM route_assignments WHERE employee_id=$1 AND assigned_date=$2 AND status != 'COMPLETED' ORDER BY id DESC LIMIT 1",
          [empId, today]
        );
        if (raR.rows.length > 0) empRouteId = raR.rows[0].route_id;
      }

      if (!empRouteId) {
        throw new Error('Driver is not assigned to any active route.');
      }

      // Security check: Verify shop belongs to driver's route via village -> route_id
      const shopRouteRes = await client.query(
        `SELECT s.id, s.name, v.route_id as village_route_id, s.route_id as shop_route_id 
         FROM shops s 
         LEFT JOIN villages v ON v.id = s.village_id 
         WHERE s.id = $1 AND s.company_id = $2`,
        [shop.id, cid]
      );
      const effectiveRouteId = shopRouteRes.rows.length > 0 
        ? (shopRouteRes.rows[0].village_route_id || shopRouteRes.rows[0].shop_route_id)
        : null;

      if (!effectiveRouteId || Number(effectiveRouteId) !== Number(empRouteId)) {
        throw new Error(`Unauthorized: Shop '${shop.name}' does not belong to Driver's assigned route.`);
      }

      driverSession = await getOrCreateActiveDriverSession(cid, empId, client);
      if (driverSession.status === 'END_DAY_SUBMITTED' || driverSession.status === 'CLOSED') {
        throw new Error("Today's working day has already been submitted. Cannot create new bills.");
      }
      if (driverSession.status === 'RETURN_PENDING') {
        throw new Error('Cannot bill new sales while returned stock is pending Storekeeper check. Please wait for verification.');
      }
    }

    let computedTotal = 0;
    const evaluatedItems = [];

    for (const item of items) {
      const pid = Number(item.product_id);
      const qty = Number(item.qty || item.quantity);
      if (!qty || qty <= 0) throw new Error('Quantity must be greater than 0');
      const pR = await client.query('SELECT * FROM products WHERE id=$1 AND company_id=$2 AND is_active=TRUE FOR UPDATE', [pid, cid]);
      if (pR.rows.length === 0) throw new Error(`Product ID ${pid} not found`);
      const prod = pR.rows[0];

      const itemUnit = item.unit_type || item.unit || prod.selling_unit || 'Tray';
      const isBaseUnit = itemUnit.toLowerCase() === (prod.base_unit || 'piece').toLowerCase();
      const ppu = Number(prod.pieces_per_unit || 1);
      const qtyInSellingUnits = isBaseUnit ? (qty / ppu) : qty;

      let unitRate = (item.rate !== undefined && item.rate !== null && !isNaN(Number(item.rate)))
        ? Number(item.rate)
        : (isBaseUnit ? Number(prod.piece_selling_price || (Number(prod.unit_selling_price || 0) / ppu).toFixed(2)) : Number(prod.unit_selling_price || 0));
      
      const lineAmt = parseFloat((qty * unitRate).toFixed(2));
      computedTotal += lineAmt;

      if (empId) {
        const esR = await client.query('SELECT * FROM employee_stock WHERE employee_id=$1 AND product_id=$2 AND company_id=$3 FOR UPDATE', [empId, pid, cid]);
        const heldUnits = esR.rows.length > 0 ? Number(esR.rows[0].qty_units) : 0;
        if (isBaseUnit) {
          const heldPieces = Math.round(heldUnits * ppu);
          if (heldPieces < qty || heldUnits <= 0) {
            throw new Error(`Insufficient vehicle stock for '${prod.display_name}'. Available: ${heldPieces} Pcs, Attempted: ${qty} Pcs`);
          }
        } else {
          if (heldUnits < qty || heldUnits <= 0) {
            throw new Error(`Insufficient vehicle stock for '${prod.display_name}'. Available: ${heldUnits} ${prod.selling_unit}, Attempted: ${qty} ${prod.selling_unit}`);
          }
        }
        await client.query('UPDATE employee_stock SET qty_units = GREATEST(0, qty_units - $1), updated_at=NOW() WHERE employee_id=$2 AND product_id=$3 AND company_id=$4', [qtyInSellingUnits, empId, pid, cid]);
      } else {
        const whUnits = Number(prod.warehouse_stock_units || 0);
        if (isBaseUnit) {
          const whPieces = Math.round(whUnits * ppu);
          if (whPieces < qty || whUnits <= 0) {
            throw new Error(`Insufficient warehouse stock for '${prod.display_name}'. Available: ${whPieces} Pcs, Attempted: ${qty} Pcs`);
          }
        } else {
          if (whUnits < qty || whUnits <= 0) {
            throw new Error(`Insufficient warehouse stock for '${prod.display_name}'. Available: ${whUnits} ${prod.selling_unit}, Attempted: ${qty} ${prod.selling_unit}`);
          }
        }
        await client.query('UPDATE products SET warehouse_stock_units = GREATEST(0, warehouse_stock_units - $1), updated_at=NOW() WHERE id=$2', [qtyInSellingUnits, pid]);
      }

      evaluatedItems.push({
        product_id: pid,
        product_name: prod.display_name,
        image_url: prod.image_url,
        icon: prod.icon,
        qty: Math.floor(qty),
        qtyInSellingUnits,
        unit_type: itemUnit,
        rate: unitRate,
        amount: lineAmt
      });
    }

    computedTotal = parseFloat(computedTotal.toFixed(2));
    const shopPrevDue = Number(shop?.current_due || 0);
    let oldCreditPaid = Number(d.old_credit_paid || (d.clear_previous_due ? shopPrevDue : 0));

    // If client paid more than bill total in cash/gpay, attribute excess to old credit
    if (oldCreditPaid === 0 && shopPrevDue > 0) {
      const extraPaid = Math.max(0, (Number(cash_paid || 0) + Number(gpay_paid || 0)) - computedTotal);
      if (extraPaid > 0) {
        oldCreditPaid = Math.min(shopPrevDue, extraPaid);
      }
    }

    let cash = 0, gpay = 0, credit = 0;
    const mode = (payment_mode || 'CASH').toUpperCase();

    if (mode === 'CASH') {
      cash = computedTotal + oldCreditPaid;
    } else if (mode === 'GPAY') {
      gpay = computedTotal + oldCreditPaid;
    } else if (mode === 'CREDIT') {
      credit = computedTotal;
    } else if (mode === 'SPLIT') {
      cash = Number(cash_paid || 0);
      gpay = Number(gpay_paid || 0);
      credit = Number(credit_paid || 0);
      const sum = parseFloat((cash + gpay + credit).toFixed(2));
      const expectedTotal = parseFloat((computedTotal + oldCreditPaid).toFixed(2));
      if (Math.abs(sum - expectedTotal) > 0.05 && Math.abs(sum - computedTotal) > 0.05) {
        throw new Error(`Split payment sum (₹${sum}) does not equal expected total (₹${expectedTotal})`);
      }
    } else {
      throw new Error(`Invalid payment mode '${payment_mode}'`);
    }

    if (oldCreditPaid > 0 && shop) {
      await client.query('UPDATE shops SET current_due=GREATEST(0, current_due - $1), updated_at=NOW() WHERE id=$2', [oldCreditPaid, shop.id]);
    }

    if (credit > 0 && shop) {
      await client.query('UPDATE shops SET current_due=current_due+$1, updated_at=NOW() WHERE id=$2', [credit, shop.id]);
    }

    const billNo = clientRef || ('INV-' + Date.now().toString().slice(-6));
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    let sR;
    try {
      sR = await client.query(
        'INSERT INTO sales (company_id, bill_no, employee_id, employee_name, shop_id, shop_name, sale_date, sale_time, total_amount, cash_paid, gpay_paid, credit_paid, payment_mode, previous_due, old_credit_paid) ' +
        'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *',
        [cid, billNo, empId, empName, shop ? shop.id : null, shop ? shop.name : (d.shop_name || 'Customer'), today, nowTime, computedTotal, cash, gpay, credit, mode, shopPrevDue, oldCreditPaid]
      );
    } catch (insertErr) {
      try {
        sR = await client.query(
          'INSERT INTO sales (company_id, bill_no, employee_id, employee_name, shop_id, shop_name, sale_date, sale_time, total_amount, cash_paid, gpay_paid, credit_paid, payment_mode) ' +
          'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *',
          [cid, billNo, empId, empName, shop ? shop.id : null, shop ? shop.name : (d.shop_name || 'Customer'), today, nowTime, computedTotal, cash, gpay, credit, mode]
        );
      } catch (insertErr2) {
        sR = await client.query(
          'INSERT INTO sales (company_id, bill_no, employee_id, employee_name, shop_id, shop_name, "date", "time", total_amount, cash_paid, gpay_paid, credit_paid, payment_mode) ' +
          'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *',
          [cid, billNo, empId, empName, shop ? shop.id : null, shop ? shop.name : (d.shop_name || 'Customer'), today, nowTime, computedTotal, cash, gpay, credit, mode]
        );
      }
    }
    const sale = sR.rows[0];
    sale.shop_code = shop?.code || '';
    sale.previous_due = shopPrevDue;
    sale.shop_previous_due = shopPrevDue;
    sale.old_credit_paid = oldCreditPaid;
    sale.shop_current_due = Math.max(0, shopPrevDue - oldCreditPaid) + credit;

    for (const item of evaluatedItems) {
      await client.query(
        'INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_type, rate, amount) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [sale.id, item.product_id, item.product_name, item.qty, item.unit_type, item.rate, item.amount]
      );
      const movNo = 'MOV-SALE-' + Date.now() + '-' + Math.floor(Math.random()*1000);
      await client.query(
        'INSERT INTO inventory_movements (company_id, movement_no, movement_type, product_id, product_name, employee_id, employee_name, qty_units, unit, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [cid, movNo, 'OUTWARD', item.product_id, item.product_name, empId, empName, item.qty, item.unit_type, 'Sold: ' + billNo]
      );

      // Record immutable stock transaction for Driver sales
      if (empId && driverSession) {
        await client.query(
          'INSERT INTO stock_transactions (company_id, session_id, employee_id, product_id, unit, transaction_type, qty_units, unit_cost, total_cost, reference_id, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
          [cid, driverSession.id, empId, item.product_id, item.unit_type, 'SALE', item.qtyInSellingUnits, item.rate, item.amount, billNo, 'Sold to shop: ' + shop.name, actorUserId || null]
        );
      }
    }

    await client.query('COMMIT');
    await auditLog({ companyId: cid, actorUserId, action: 'SALE_CREATED', entityType: 'sales', entityId: sale.id, metadata: { billNo, total: computedTotal, mode } });
    return { success: true, sale, items: evaluatedItems };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function createEmployeeSale(cid, empId, empName, d, actorUserId) {
  return await createSale(cid, {
    ...d,
    employee_id: empId,
    employee_name: empName
  }, actorUserId);
}

export async function createKeeperSale(cid, d, actorUserId) {
  return await createSale(cid, {
    ...d,
    employee_id: null,
    employee_name: 'Store Keeper POS'
  }, actorUserId);
}

export async function getSales(cid, filters) {
  if (!filters) filters = {};
  let sql = `
    SELECT s.*, 
      s.sale_date::text as sale_date,
      COALESCE(s.sale_date::text, to_char(s.created_at, 'YYYY-MM-DD')) as date,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', si.id,
          'sale_id', si.sale_id,
          'product_id', si.product_id,
          'product_name', si.product_name,
          'name', si.product_name,
          'qty', si.qty,
          'unit_type', si.unit_type,
          'rate', si.rate,
          'amount', si.amount,
          'total', si.amount,
          'image_url', p.image_url,
          'icon', p.icon
        ) ORDER BY si.id ASC)
        FROM sale_items si
        LEFT JOIN products p ON p.id = si.product_id
        WHERE si.sale_id = s.id
      ), '[]'::json) as items
    FROM sales s 
    WHERE s.company_id = $1
      AND (s.status IS NULL OR s.status = 'ACTIVE' OR s.status != 'CANCELLED')
  `;
  const params = [cid];
  let idx = 2;
  if (filters.employee_id) { sql += ' AND s.employee_id=$' + idx++; params.push(filters.employee_id); }
  if (filters.shop_id) { sql += ' AND s.shop_id=$' + idx++; params.push(filters.shop_id); }
  if (filters.date) { sql += ' AND s.sale_date=$' + idx++; params.push(filters.date); }
  if (filters.start_date || filters.from) { sql += ' AND s.sale_date >= $' + idx++; params.push(filters.start_date || filters.from); }
  if (filters.end_date || filters.to) { sql += ' AND s.sale_date <= $' + idx++; params.push(filters.end_date || filters.to); }
  if (filters.payment_mode && filters.payment_mode !== 'ALL') { sql += ' AND UPPER(s.payment_mode) = $' + idx++; params.push(filters.payment_mode.toUpperCase()); }
  if (filters.search && filters.search.trim()) {
    const q = `%${filters.search.trim()}%`;
    sql += ` AND (s.bill_no ILIKE $${idx} OR s.shop_name ILIKE $${idx} OR s.employee_name ILIKE $${idx})`;
    params.push(q);
    idx++;
  }
  sql += ' ORDER BY s.sale_date DESC, s.created_at DESC LIMIT 500';
  return await queryAll(sql, params);
}

export async function getSaleById(cid, saleId) {
  const isNumeric = !isNaN(Number(saleId));
  let sale = null;
  if (isNumeric) {
    sale = await queryOne(`
      SELECT s.*, sh.code as shop_code, COALESCE(sh.current_due, 0) as shop_current_due, 
             COALESCE(s.previous_due, sh.current_due, 0) as previous_due, 
             COALESCE(s.old_credit_paid, 0) as old_credit_paid,
             COALESCE(e.vehicle_number, '') as vehicle_no 
      FROM sales s 
      LEFT JOIN shops sh ON sh.id = s.shop_id 
      LEFT JOIN employees e ON e.id = s.employee_id 
      WHERE s.id=$1 AND s.company_id=$2
    `, [Number(saleId), cid]);
  }
  if (!sale) {
    sale = await queryOne(`
      SELECT s.*, sh.code as shop_code, COALESCE(sh.current_due, 0) as shop_current_due, 
             COALESCE(s.previous_due, sh.current_due, 0) as previous_due, 
             COALESCE(s.old_credit_paid, 0) as old_credit_paid,
             COALESCE(e.vehicle_number, '') as vehicle_no 
      FROM sales s 
      LEFT JOIN shops sh ON sh.id = s.shop_id 
      LEFT JOIN employees e ON e.id = s.employee_id 
      WHERE s.bill_no=$1 AND s.company_id=$2
    `, [String(saleId), cid]);
  }
  if (!sale) return null;
  const items = await queryAll(`
    SELECT si.*, si.product_name as name, si.amount as total, p.image_url, p.icon 
    FROM sale_items si 
    LEFT JOIN products p ON p.id = si.product_id 
    WHERE si.sale_id=$1 
    ORDER BY si.id ASC
  `, [sale.id]);
  return { ...sale, items };
}

export async function cancelSale(cid, saleId, actorUserId, actorRole) {
  if (actorRole === 'DRIVER') {
    throw new Error('Drivers cannot cancel or reverse finalized bills. Contact Store Keeper or Owner.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sR = await client.query('SELECT * FROM sales WHERE id=$1 AND company_id=$2 FOR UPDATE', [saleId, cid]);
    if (sR.rows.length === 0) throw new Error('Sale not found');
    const sale = sR.rows[0];
    if (sale.status === 'CANCELLED') {
      await client.query('COMMIT');
      return { success: true, message: 'Sale is already cancelled', sale };
    }

    if (sale.employee_id) {
      const sessionRes = await client.query(
        'SELECT * FROM driver_sessions WHERE company_id = $1 AND employee_id = $2 ORDER BY id DESC LIMIT 1',
        [cid, sale.employee_id]
      );
      const session = sessionRes.rows[0];
      if (session && (session.status === 'CLOSED' || session.status === 'COMPLETED' || session.status === 'RETURN_VERIFIED' || session.status === 'RECONCILED')) {
        throw new Error('Forbidden: Bills from closed and reconciled driver return sessions cannot be cancelled.');
      }
    }

    const itemsRes = await client.query('SELECT * FROM sale_items WHERE sale_id=$1', [sale.id]);
    for (const item of itemsRes.rows) {
      const pid = item.product_id;
      const qty = Number(item.qty);
      const unit = item.unit_type;
      
      const pR = await client.query('SELECT * FROM products WHERE id=$1', [pid]);
      const prod = pR.rows[0];
      const ppu = Number(prod?.pieces_per_unit || 1);
      const isBaseUnit = unit.toLowerCase() === (prod?.base_unit || 'piece').toLowerCase();
      const qtyInSellingUnits = isBaseUnit ? (qty / ppu) : qty;

      if (sale.employee_id) {
        await client.query(
          'UPDATE employee_stock SET qty_units=qty_units+$1, updated_at=NOW() WHERE employee_id=$2 AND product_id=$3 AND company_id=$4',
          [qtyInSellingUnits, sale.employee_id, pid, cid]
        );
      } else {
        await client.query(
          'UPDATE products SET warehouse_stock_units=warehouse_stock_units+$1, updated_at=NOW() WHERE id=$2',
          [qtyInSellingUnits, pid]
        );
      }

      const movNo = 'MOV-REV-' + Date.now() + '-' + Math.floor(Math.random()*1000);
      await client.query(
        'INSERT INTO inventory_movements (company_id, movement_no, movement_type, product_id, product_name, employee_id, employee_name, qty_units, unit, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [cid, movNo, 'INWARD', pid, item.product_name, sale.employee_id, sale.employee_name, qty, unit, 'Reversal for Cancelled Bill: ' + sale.bill_no]
      );
    }

    if (Number(sale.credit_paid || 0) > 0 && sale.shop_id) {
      await client.query('UPDATE shops SET current_due=GREATEST(0, current_due-$1), updated_at=NOW() WHERE id=$2', [Number(sale.credit_paid), sale.shop_id]);
    }

    const updatedRes = await client.query(
      "UPDATE sales SET status='CANCELLED' WHERE id=$1 RETURNING *",
      [sale.id]
    );

    await client.query('COMMIT');
    await auditLog({ companyId: cid, actorUserId, action: 'SALE_CANCELLED', entityType: 'sales', entityId: sale.id, metadata: { billNo: sale.bill_no, total: sale.total_amount } });
    return { success: true, message: 'Sale cancelled and stock reversed successfully', sale: updatedRes.rows[0] };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ====== ROUTES & ASSIGNMENTS ======
export async function getRoutes(cid) {
  return await queryAll(`
    SELECT r.*, 
      ra.employee_id, e.full_name as driver_name, e.vehicle_number, ra.status as assignment_status, ra.dispatch_time,
      (SELECT COUNT(*)::int FROM villages v WHERE v.route_id = r.id AND v.company_id = $1 AND v.status = 'ACTIVE') as village_count,
      (SELECT COUNT(*)::int FROM shops s JOIN villages v ON v.id = s.village_id WHERE v.route_id = r.id AND s.company_id = $1 AND s.is_active = TRUE) as shop_count
    FROM routes r
    LEFT JOIN route_assignments ra ON ra.route_id = r.id AND ra.assigned_date = CURRENT_DATE
    LEFT JOIN employees e ON e.id = COALESCE(ra.employee_id, (SELECT id FROM employees WHERE route_id = r.id AND company_id = $1 LIMIT 1))
    WHERE r.company_id = $1 AND r.is_active = TRUE 
    ORDER BY r.code ASC, r.name ASC
  `, [cid]);
}

export async function addRoute(cid, d) {
  const name = (d && d.name ? String(d.name) : '').trim();
  if (!name) throw new Error('Route name is required.');

  // Duplicate prevention within owner company
  const existingName = await queryOne(
    'SELECT id FROM routes WHERE company_id=$1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) AND is_active = TRUE',
    [cid, name]
  );
  if (existingName) {
    throw new Error(`Route "${name}" already exists for this Owner.`);
  }

  let code = (d && d.code ? String(d.code) : '').trim().toUpperCase();
  if (!code) {
    const lastR = await queryOne(
      "SELECT code FROM routes WHERE company_id=$1 AND code LIKE 'ROUTE-%' ORDER BY id DESC LIMIT 1",
      [cid]
    );
    let nextNum = 1;
    if (lastR && lastR.code) {
      const match = lastR.code.match(/\d+/);
      if (match) nextNum = parseInt(match[0], 10) + 1;
    }
    code = `ROUTE-${String(nextNum).padStart(4, '0')}`;
    let exists = await queryOne('SELECT id FROM routes WHERE company_id=$1 AND code=$2', [cid, code]);
    while (exists) {
      nextNum++;
      code = `ROUTE-${String(nextNum).padStart(4, '0')}`;
      exists = await queryOne('SELECT id FROM routes WHERE company_id=$1 AND code=$2', [cid, code]);
    }
  }

  const row = await queryOne('INSERT INTO routes (company_id, code, name, is_active) VALUES ($1, $2, $3, TRUE) RETURNING *', [cid, code, name]);
  return { success: true, route: row };
}

export async function updateRoute(cid, routeId, d) {
  const name = d.name ? String(d.name).trim() : null;
  if (name) {
    const existing = await queryOne(
      'SELECT id FROM routes WHERE company_id=$1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) AND id != $3 AND is_active = TRUE',
      [cid, name, routeId]
    );
    if (existing) throw new Error(`Route "${name}" already exists.`);
  }
  const row = await queryOne(
    'UPDATE routes SET code=COALESCE($1,code), name=COALESCE($2,name), updated_at=NOW() WHERE id=$3 AND company_id=$4 RETURNING *',
    [d.code ? String(d.code).trim().toUpperCase() : null, name, routeId, cid]
  );
  if (!row) throw new Error('Route not found.');
  return { success: true, route: row };
}

export async function deleteRoute(cid, routeId) {
  const villageCount = await queryOne(
    'SELECT COUNT(*)::int as count FROM villages WHERE route_id=$1 AND company_id=$2 AND status=\'ACTIVE\'',
    [routeId, cid]
  );
  if (villageCount && villageCount.count > 0) {
    throw new Error(`Cannot delete route. There are ${villageCount.count} active village(s) assigned to this route. Please reassign or delete the villages first.`);
  }
  const row = await queryOne('UPDATE routes SET is_active=FALSE, updated_at=NOW() WHERE id=$1 AND company_id=$2 RETURNING *', [routeId, cid]);
  if (!row) throw new Error('Route not found.');
  return { success: true, message: 'Route deleted successfully.' };
}

export async function assignRoute(cid, routeId, employeeId, vehicleNumber, assignedDate) {
  const date = assignedDate || new Date().toISOString().split('T')[0];
  const r = await queryOne('SELECT * FROM routes WHERE id=$1 AND company_id=$2 AND is_active=TRUE', [routeId, cid]);
  if (!r) throw new Error('Route not found.');
  const e = await queryOne('SELECT * FROM employees WHERE id=$1 AND company_id=$2', [employeeId, cid]);
  if (!e) throw new Error('Employee not found.');

  // Update employee's route_id
  await queryOne('UPDATE employees SET route_id=$1, updated_at=NOW() WHERE id=$2 AND company_id=$3', [routeId, employeeId, cid]);

  const row = await queryOne(
    'INSERT INTO route_assignments (route_id, employee_id, vehicle_number, assigned_date, status, dispatch_time) ' +
    'VALUES ($1, $2, $3, $4, $5, $6) ' +
    'ON CONFLICT (route_id, assigned_date) DO UPDATE SET employee_id=EXCLUDED.employee_id, vehicle_number=EXCLUDED.vehicle_number, status=EXCLUDED.status, updated_at=NOW() RETURNING *',
    [routeId, employeeId, vehicleNumber || e.vehicle_number || null, date, 'ASSIGNED', new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'})]
  );
  return { success: true, assignment: row };
}

export async function getRouteAssignments(cid, date) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  return await queryAll(
    'SELECT ra.*, r.code as route_code, r.name as route_name, e.full_name as employee_name, e.phone as employee_phone ' +
    'FROM route_assignments ra JOIN routes r ON r.id=ra.route_id JOIN employees e ON e.id=ra.employee_id ' +
    'WHERE r.company_id=$1 AND ra.assigned_date=$2 ORDER BY r.code',
    [cid, targetDate]
  );
}

// ====== VILLAGES ======
export async function getVillages(cid, filters = {}) {
  let sql = `
    SELECT v.*, r.name as route_name, r.code as route_code,
      (SELECT COUNT(*)::int FROM shops s WHERE s.village_id = v.id AND s.company_id = $1 AND s.is_active = TRUE) as shop_count
    FROM villages v 
    LEFT JOIN routes r ON r.id = v.route_id
    WHERE v.company_id = $1 AND v.status = 'ACTIVE'
  `;
  const params = [cid];
  let idx = 2;
  if (filters.route_id) {
    sql += ` AND v.route_id = $${idx++}`;
    params.push(Number(filters.route_id));
  }
  sql += ' ORDER BY v.name ASC';
  return await queryAll(sql, params);
}

export async function addVillage(cid, d) {
  const name = (d && d.name ? String(d.name) : '').trim();
  if (!name) throw new Error('Village name is required.');

  if (!d.route_id) {
    throw new Error('Route assignment is required for creating a Village.');
  }
  const routeId = parseInt(d.route_id, 10);
  if (isNaN(routeId)) throw new Error('Invalid Route ID.');
  const route = await queryOne('SELECT id, name, code FROM routes WHERE id=$1 AND company_id=$2 AND is_active=TRUE', [routeId, cid]);
  if (!route) throw new Error('Selected route does not exist or is inactive.');

  // Duplicate prevention within owner company
  const existingName = await queryOne(
    'SELECT id FROM villages WHERE company_id=$1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) AND status = \'ACTIVE\'',
    [cid, name]
  );
  if (existingName) {
    throw new Error(`Village "${name}" already exists for this Owner.`);
  }

  let code = (d.code && String(d.code).trim()) || '';
  if (!code) {
    const lastVil = await queryOne('SELECT code FROM villages WHERE company_id=$1 AND code LIKE \'VIL-%\' ORDER BY id DESC LIMIT 1', [cid]);
    let nextNum = 1;
    if (lastVil && lastVil.code) {
      const match = lastVil.code.match(/\d+/);
      if (match) nextNum = parseInt(match[0], 10) + 1;
    }
    code = `VIL-${String(nextNum).padStart(3, '0')}`;
    let exists = await queryOne('SELECT id FROM villages WHERE company_id=$1 AND code=$2', [cid, code]);
    while (exists) {
      nextNum++;
      code = `VIL-${String(nextNum).padStart(3, '0')}`;
      exists = await queryOne('SELECT id FROM villages WHERE company_id=$1 AND code=$2', [cid, code]);
    }
  }

  const row = await queryOne(
    'INSERT INTO villages (company_id, code, name, route_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [cid, code, name, route.id, d.status || 'ACTIVE']
  );
  return { 
    success: true, 
    village: { 
      ...row, 
      route_name: route.name, 
      route_code: route.code,
      shop_count: 0
    } 
  };
}

export async function updateVillage(cid, id, d) {
  const name = d.name ? String(d.name).trim() : null;
  if (name) {
    const existing = await queryOne(
      'SELECT id FROM villages WHERE company_id=$1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) AND id != $3 AND status = \'ACTIVE\'',
      [cid, name, id]
    );
    if (existing) throw new Error(`Village "${name}" already exists for this Owner.`);
  }

  let routeId = undefined;
  if (d.route_id !== undefined && d.route_id !== null && d.route_id !== '') {
    const rId = parseInt(d.route_id, 10);
    if (isNaN(rId)) throw new Error('Invalid Route ID.');
    const route = await queryOne('SELECT id, name FROM routes WHERE id=$1 AND company_id=$2 AND is_active=TRUE', [rId, cid]);
    if (!route) throw new Error('Selected route does not exist or is inactive.');
    routeId = route.id;
  }

  const row = await queryOne(
    `UPDATE villages SET 
       name = COALESCE($1, name), 
       route_id = CASE WHEN $2::boolean THEN $3::integer ELSE route_id END, 
       status = COALESCE($4, status), 
       updated_at = NOW() 
     WHERE id = $5 AND company_id = $6 
     RETURNING *`,
    [name, routeId !== undefined, routeId || null, d.status || null, id, cid]
  );
  if (!row) throw new Error('Village not found.');

  // Cascade update route_id on shops in this village to keep cached route_id synchronized
  if (routeId) {
    await queryOne('UPDATE shops SET route_id = $1, updated_at = NOW() WHERE village_id = $2 AND company_id = $3', [routeId, id, cid]);
  }

  const populated = await queryOne(
    `SELECT v.*, r.name as route_name, r.code as route_code,
       (SELECT COUNT(*)::int FROM shops s WHERE s.village_id = v.id AND s.company_id = $1 AND s.is_active = TRUE) as shop_count
     FROM villages v
     LEFT JOIN routes r ON r.id = v.route_id
     WHERE v.id = $2`,
    [cid, id]
  );

  return { success: true, village: populated || row };
}

export async function deleteVillage(cid, id) {
  const shopCount = await queryOne('SELECT COUNT(*)::int as count FROM shops WHERE village_id=$1 AND company_id=$2 AND is_active=TRUE', [id, cid]);
  if (shopCount && shopCount.count > 0) {
    const row = await queryOne(
      'UPDATE villages SET status=\'INACTIVE\', updated_at=NOW() WHERE id=$1 AND company_id=$2 RETURNING *',
      [id, cid]
    );
    return { success: true, message: 'Village marked inactive because it has active linked shops.', village: row };
  }
  const row = await queryOne('UPDATE villages SET status=\'INACTIVE\', updated_at=NOW() WHERE id=$1 AND company_id=$2 RETURNING *', [id, cid]);
  if (!row) throw new Error('Village not found.');
  return { success: true, message: 'Village deleted successfully.' };
}

// ====== SHOPS ======
export async function getShops(cid, filters = {}) {
  let sql = `
    SELECT s.*, 
      v.name as village_name, v.code as village_code, 
      COALESCE(r.name, vr.name) as route_name, COALESCE(r.code, vr.code) as route_code,
      COALESCE(v.route_id, s.route_id) as route_id,
      COALESCE((
        SELECT COUNT(*)::int 
        FROM sales sa 
        WHERE sa.shop_id = s.id AND sa.company_id = s.company_id
      ), 0) as bills_count
    FROM shops s
    LEFT JOIN villages v ON v.id = s.village_id
    LEFT JOIN routes vr ON vr.id = v.route_id
    LEFT JOIN routes r ON r.id = s.route_id
    WHERE s.company_id = $1 AND s.is_active = TRUE
  `;
  const params = [cid];
  let idx = 2;

  if (filters.village_id) {
    sql += ` AND s.village_id = $${idx++}`;
    params.push(Number(filters.village_id));
  }

  if (filters.route_id) {
    sql += ` AND (v.route_id = $${idx} OR s.route_id = $${idx})`;
    idx++;
    params.push(Number(filters.route_id));
  }

  if (filters.employee_id) {
    const emp = await queryOne('SELECT route_id FROM employees WHERE id=$1 AND company_id=$2', [Number(filters.employee_id), cid]);
    const driverRouteId = emp?.route_id;
    if (!driverRouteId) {
      return []; // Driver without assigned route gets no shops
    }
    sql += ` AND (v.route_id = $${idx++} AND v.status = 'ACTIVE')`;
    params.push(driverRouteId);
  }

  sql += ' ORDER BY s.id ASC';
  return await queryAll(sql, params);
}

export async function addShop(cid, d) {
  const name = (d && d.name ? String(d.name) : '').trim();
  if (!name) throw new Error('Shop name is required.');

  if (!d.village_id && d.village_id !== 0) {
    throw new Error('Village selection is required for creating a Shop.');
  }
  const villageId = parseInt(d.village_id, 10);
  if (isNaN(villageId)) throw new Error('Invalid village ID.');
  const vil = await queryOne(
    'SELECT v.id, v.name, v.route_id, r.name as route_name, r.code as route_code FROM villages v LEFT JOIN routes r ON r.id = v.route_id WHERE v.id=$1 AND v.company_id=$2 AND v.status=\'ACTIVE\'',
    [villageId, cid]
  );
  if (!vil) throw new Error('Selected village does not exist or is inactive.');

  // Auto-derive route_id strictly from the Village's route_id
  const routeId = vil.route_id || (d.route_id ? parseInt(d.route_id, 10) : null);

  let code = (d.code && String(d.code).trim()) || '';
  if (!code) {
    const lastShop = await queryOne(
      'SELECT code FROM shops WHERE company_id=$1 AND (code LIKE \'SHOP-%\' OR code LIKE \'SHP-%\') ORDER BY id DESC LIMIT 1',
      [cid]
    );
    let nextNum = 1;
    if (lastShop && lastShop.code) {
      const match = lastShop.code.match(/\d+/);
      if (match) nextNum = parseInt(match[0], 10) + 1;
    }
    code = `SHOP-${String(nextNum).padStart(4, '0')}`;
    let exists = await queryOne('SELECT id FROM shops WHERE company_id=$1 AND code=$2', [cid, code]);
    while (exists) {
      nextNum++;
      code = `SHOP-${String(nextNum).padStart(4, '0')}`;
      exists = await queryOne('SELECT id FROM shops WHERE company_id=$1 AND code=$2', [cid, code]);
    }
  }

  const hasFreezer = Boolean(d.has_freezer);
  const freezerModel = hasFreezer ? (d.freezer_model || 'Blue Star 300L Visicooler') : null;
  const freezerStatus = hasFreezer ? (d.freezer_status || 'Active') : null;
  const distanceKm = d.distance_km !== undefined && d.distance_km !== null ? Math.max(0, Number(d.distance_km) || 0) : (d.distance ? parseFloat(d.distance) || 0 : 0);
  const distanceStr = d.distance ? String(d.distance).trim() : `${distanceKm} km`;

  const row = await queryOne(
    `INSERT INTO shops (
      company_id, code, name, owner_name, phone, address, distance, distance_km,
      village_id, route_id, credit_limit, opening_balance, has_freezer, freezer_model, freezer_status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [
      cid, code, name,
      d.owner_name ? String(d.owner_name).trim() : null,
      d.phone ? String(d.phone).trim() : null,
      d.address ? String(d.address).trim() : null,
      distanceStr,
      distanceKm,
      vil.id,
      routeId,
      Number(d.credit_limit) || 0,
      Number(d.opening_balance) || 0,
      hasFreezer, freezerModel, freezerStatus
    ]
  );

  const populated = await queryOne(
    `SELECT s.*, 
       v.name as village_name, v.code as village_code, 
       COALESCE(r.name, vr.name) as route_name, COALESCE(r.code, vr.code) as route_code,
       COALESCE(v.route_id, s.route_id) as route_id
     FROM shops s
     LEFT JOIN villages v ON v.id = s.village_id
     LEFT JOIN routes vr ON vr.id = v.route_id
     LEFT JOIN routes r ON r.id = s.route_id
     WHERE s.id = $1`,
    [row.id]
  );
  return { success: true, shop: populated || row };
}

export async function updateShop(cid, shopId, d) {
  let villageId = undefined;
  let routeId = undefined;
  let updateVillage = false;

  if (d.village_id !== undefined) {
    updateVillage = true;
    if (d.village_id === null || d.village_id === '' || d.village_id === 0 || d.village_id === '0') {
      villageId = null;
      routeId = null;
    } else {
      const vId = parseInt(d.village_id, 10);
      if (!isNaN(vId)) {
        const vil = await queryOne('SELECT id, name, route_id FROM villages WHERE id=$1 AND company_id=$2', [vId, cid]);
        if (!vil) throw new Error('Selected village is not available for this Owner.');
        villageId = vil.id;
        routeId = vil.route_id; // auto-derive from village
      }
    }
  }

  const hasFreezer = d.has_freezer !== undefined ? Boolean(d.has_freezer) : undefined;
  const freezerModel = d.freezer_model !== undefined ? (d.freezer_model || null) : undefined;
  const distanceKm = d.distance_km !== undefined && d.distance_km !== null ? Math.max(0, Number(d.distance_km) || 0) : undefined;
  const distanceStr = d.distance !== undefined ? String(d.distance).trim() : (distanceKm !== undefined ? `${distanceKm} km` : undefined);

  const row = await queryOne(
    `UPDATE shops SET 
      name=COALESCE($1,name), owner_name=COALESCE($2,owner_name), 
      phone=COALESCE($3,phone), address=COALESCE($4,address), distance=COALESCE($5,distance), distance_km=COALESCE($6,distance_km),
      village_id = CASE WHEN $7::boolean THEN $8::integer ELSE village_id END,
      route_id = CASE WHEN $7::boolean THEN $9::integer ELSE COALESCE($9, route_id) END,
      credit_limit=COALESCE($10,credit_limit),
      has_freezer=COALESCE($11,has_freezer), freezer_model=COALESCE($12,freezer_model)
    WHERE id=$13 AND company_id=$14 RETURNING *`,
    [
      d.name ? String(d.name).trim() : null,
      d.owner_name !== undefined ? (d.owner_name ? String(d.owner_name).trim() : null) : null,
      d.phone !== undefined ? (d.phone ? String(d.phone).trim() : null) : null,
      d.address !== undefined ? (d.address ? String(d.address).trim() : null) : null,
      distanceStr !== undefined ? distanceStr : null,
      distanceKm !== undefined ? distanceKm : null,
      updateVillage,
      villageId,
      routeId !== undefined ? routeId : (d.route_id ? parseInt(d.route_id, 10) : null),
      d.credit_limit !== undefined ? Number(d.credit_limit) : null,
      hasFreezer !== undefined ? hasFreezer : null,
      freezerModel !== undefined ? freezerModel : null,
      shopId, cid
    ]
  );
  if(!row) throw new Error('Shop not found.');

  const populated = await queryOne(
    `SELECT s.*, 
       v.name as village_name, v.code as village_code, 
       COALESCE(r.name, vr.name) as route_name, COALESCE(r.code, vr.code) as route_code,
       COALESCE(v.route_id, s.route_id) as route_id
     FROM shops s
     LEFT JOIN villages v ON v.id = s.village_id
     LEFT JOIN routes vr ON vr.id = v.route_id
     LEFT JOIN routes r ON r.id = s.route_id
     WHERE s.id = $1`,
    [row.id]
  );
  return {success:true, shop: populated || row};
}

export async function deactivateShop(cid, shopId) {
  const row = await queryOne('UPDATE shops SET is_active=FALSE WHERE id=$1 AND company_id=$2 RETURNING *', [shopId, cid]);
  if(!row) throw new Error('Shop not found.');
  return {success:true, message:'Shop deactivated successfully', shop:row};
}

export async function deleteShop(cid, shopId) {
  const sId = parseInt(shopId, 10);
  const shop = await queryOne('SELECT * FROM shops WHERE id=$1 AND company_id=$2', [sId, cid]);
  if (!shop) throw new Error('Shop not found.');

  const salesCount = await queryOne('SELECT COUNT(*)::int as count FROM sales WHERE shop_id=$1 AND company_id=$2', [sId, cid]);
  if (salesCount && parseInt(salesCount.count, 10) > 0) {
    await query('UPDATE shops SET is_active=FALSE WHERE id=$1 AND company_id=$2', [sId, cid]);
    return { success: true, message: `Shop "${shop.name}" has transaction history and has been deactivated.`, shop };
  }

  await query('DELETE FROM shops WHERE id=$1 AND company_id=$2', [sId, cid]);
  return { success: true, message: `Shop "${shop.name}" deleted successfully.`, shop };
}

export async function getFreezerModels(cid) {
  return await queryAll('SELECT * FROM freezer_models WHERE company_id=$1 AND is_active=TRUE ORDER BY brand ASC, capacity ASC, model_name ASC', [cid]);
}

export async function createFreezerModel(cid, d) {
  const brand = (d.brand || 'Other').trim();
  const capacity = (d.capacity || '').trim();
  const modelName = (d.model_name || d.name || `${brand} ${capacity}`).trim();
  const freezerType = (d.freezer_type || 'Deep Freezer').trim();
  const desc = (d.description || '').trim();

  const row = await queryOne(`
    INSERT INTO freezer_models (company_id, brand, capacity, model_name, freezer_type, description, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, TRUE)
    RETURNING *
  `, [cid, brand, capacity, modelName, freezerType, desc]);

  return { success: true, model: row };
}

export async function deleteFreezerModel(cid, id) {
  await query('UPDATE freezer_models SET is_active=FALSE WHERE id=$1 AND company_id=$2', [id, cid]);
  return { success: true, message: 'Freezer model removed successfully.' };
}

export async function getFreezers(cid, shopId = null) {
  let sql = `
    SELECT 
      sf.id,
      sf.company_id,
      sf.shop_id,
      sf.model_name,
      sf.serial_no,
      sf.allocation_date,
      sf.status,
      sf.notes,
      sf.created_at,
      sf.updated_at,
      sh.name as shop_name,
      sh.code as shop_code,
      sh.owner_name,
      sh.phone,
      v.id as village_id,
      v.name as village_name,
      r.id as route_id,
      r.name as route_name
    FROM shop_freezers sf
    JOIN shops sh ON sh.id = sf.shop_id
    LEFT JOIN villages v ON v.id = sh.village_id
    LEFT JOIN routes r ON r.id = sh.route_id
    WHERE (sf.company_id = $1 OR $1 = 1 OR sf.company_id IS NULL)
  `;
  const params = [cid];
  if (shopId) {
    sql += ` AND sf.shop_id = $2`;
    params.push(Number(shopId));
  }
  sql += ` ORDER BY sf.id DESC`;
  return await queryAll(sql, params);
}

export async function assignFreezer(cid, shopId, d) {
  const fModel = d.freezer_model || d.model || d.model_name || 'Deep Freezer';
  const fSerial = String(d.freezer_serial || d.serial || d.serial_no || `FRZ-${Date.now().toString().slice(-6)}`).trim();
  const fDate = d.freezer_date || d.date || d.allocation_date || new Date().toISOString().split('T')[0];
  const fStatus = d.freezer_status || d.status || 'Active';
  const fNotes = d.notes || null;

  // Insert into shop_freezers
  const freezerRow = await queryOne(`
    INSERT INTO shop_freezers (company_id, shop_id, model_name, serial_no, allocation_date, status, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [cid, shopId, fModel, fSerial, fDate, fStatus, fNotes]);

  // Update shops table for backward compatibility
  const shopRow = await queryOne(`
    UPDATE shops 
    SET has_freezer = TRUE, freezer_model = $1, freezer_serial = $2, freezer_date = $3, freezer_status = $4, updated_at = NOW() 
    WHERE id = $5 AND (company_id = $6 OR $6 = 1 OR company_id IS NULL) 
    RETURNING *
  `, [fModel, fSerial, fDate, fStatus, shopId, cid]);

  if (!shopRow) throw new Error('Shop not found.');
  return { success: true, freezer: freezerRow, shop: shopRow };
}

export async function updateFreezer(cid, freezerId, d) {
  const fModel = d.freezer_model || d.model || d.model_name;
  const fSerial = d.freezer_serial || d.serial || d.serial_no;
  const fDate = d.freezer_date || d.date || d.allocation_date;
  const fStatus = d.freezer_status || d.status;
  const fNotes = d.notes;

  const freezerRow = await queryOne(`
    UPDATE shop_freezers
    SET model_name = COALESCE($1, model_name),
        serial_no = COALESCE($2, serial_no),
        allocation_date = COALESCE($3, allocation_date),
        status = COALESCE($4, status),
        notes = COALESCE($5, notes),
        updated_at = NOW()
    WHERE id = $6 AND (company_id = $7 OR $7 = 1 OR company_id IS NULL)
    RETURNING *
  `, [fModel, fSerial, fDate, fStatus, fNotes, freezerId, cid]);

  if (!freezerRow) throw new Error('Freezer asset not found.');

  // Update shop record with latest freezer info if applicable
  if (freezerRow.shop_id) {
    await query(`
      UPDATE shops 
      SET freezer_model = $1, freezer_serial = $2, freezer_date = $3, freezer_status = $4, updated_at = NOW()
      WHERE id = $5
    `, [freezerRow.model_name, freezerRow.serial_no, freezerRow.allocation_date, freezerRow.status, freezerRow.shop_id]);
  }

  return { success: true, freezer: freezerRow };
}

export async function unassignFreezer(cid, targetId, shopId = null) {
  let deletedFreezer = await queryOne(`
    DELETE FROM shop_freezers 
    WHERE id = $1 AND (company_id = $2 OR $2 = 1 OR company_id IS NULL)
    RETURNING *
  `, [targetId, cid]);

  let targetShopId = deletedFreezer?.shop_id || shopId || targetId;

  // Fallback: If not deleted by id, try by shop_id
  if (!deletedFreezer && targetShopId) {
    deletedFreezer = await queryOne(`
      DELETE FROM shop_freezers
      WHERE shop_id = $1 AND (company_id = $2 OR $2 = 1 OR company_id IS NULL)
      RETURNING *
    `, [targetShopId, cid]);
  }

  // Update shops table flag & latest info
  if (targetShopId) {
    const remaining = await queryOne(`SELECT COUNT(*) as count FROM shop_freezers WHERE shop_id = $1`, [targetShopId]);
    const remCount = Number(remaining?.count || 0);
    if (remCount === 0) {
      await query(`
        UPDATE shops 
        SET has_freezer = FALSE, freezer_model = NULL, freezer_serial = NULL, freezer_date = NULL, freezer_status = NULL, updated_at = NOW() 
        WHERE id = $1
      `, [targetShopId]);
    } else {
      const latest = await queryOne(`SELECT * FROM shop_freezers WHERE shop_id = $1 ORDER BY id DESC LIMIT 1`, [targetShopId]);
      if (latest) {
        await query(`
          UPDATE shops 
          SET has_freezer = TRUE, freezer_model = $1, freezer_serial = $2, freezer_date = $3, freezer_status = $4, updated_at = NOW() 
          WHERE id = $5
        `, [latest.model_name, latest.serial_no, latest.allocation_date, latest.status, targetShopId]);
      }
    }
  }

  return { success: true, message: 'Freezer removed successfully.', freezer: deletedFreezer };
}

export async function collectShopDue(cid,shopId,d) {
  const amt=Number(d.amount)||0;
  const row = await queryOne('UPDATE shops SET current_due=GREATEST(0,current_due-$1) WHERE id=$2 AND company_id=$3 RETURNING current_due',[amt,shopId,cid]);
  if(!row) throw new Error('Shop not found.');
  return {success:true,remainingDue:Number(row.current_due)};
}

// ====== EXPENSES ======
export async function getExpenses(cid, filters) {
  if (!filters) filters = {};
  let sql = `
    SELECT 
      ex.id,
      ex.company_id,
      ex.employee_id,
      COALESCE(e.full_name, ex.title) as employee_name,
      e.full_name as driver_name,
      e.employee_code,
      e.vehicle_number,
      r.name as route_name,
      ex.session_id,
      ex.title,
      ex.category,
      ex.amount,
      ex.notes,
      ex.expense_date,
      ex.created_at,
      ex.updated_at,
      COALESCE(u.name, 'Storekeeper') as recorded_by_name
    FROM expenses ex
    LEFT JOIN employees e ON e.id = ex.employee_id
    LEFT JOIN routes r ON r.id = e.route_id
    LEFT JOIN driver_sessions ds ON ds.id = ex.session_id
    LEFT JOIN user_accounts u ON u.employee_id = ex.employee_id
    WHERE ex.company_id = $1
  `;
  const params = [cid];
  let idx = 2;
  if (filters.employee_id || filters.driver_id) {
    sql += ' AND ex.employee_id = $' + idx++;
    params.push(filters.employee_id || filters.driver_id);
  }
  if (filters.category && filters.category !== 'ALL') {
    sql += ' AND UPPER(ex.category) = $' + idx++;
    params.push(filters.category.toUpperCase());
  }
  if (filters.date && filters.date !== 'ALL') {
    sql += ' AND (ex.expense_date = $' + idx + '::date OR ex.created_at::date = $' + idx + '::date)';
    idx++;
    params.push(filters.date);
  } else {
    if (filters.start_date && filters.start_date !== 'ALL') {
      sql += ' AND (ex.expense_date >= $' + idx + '::date OR ex.created_at::date >= $' + idx + '::date)';
      idx++;
      params.push(filters.start_date);
    }
    if (filters.end_date && filters.end_date !== 'ALL') {
      sql += ' AND (ex.expense_date <= $' + idx + '::date OR ex.created_at::date <= $' + idx + '::date)';
      idx++;
      params.push(filters.end_date);
    }
  }
  sql += ' ORDER BY ex.created_at DESC';
  return await queryAll(sql, params);
}
export async function addExpense(cid, d, actorUserId) {
  if (!d.category || d.amount === undefined || d.amount === null) throw new Error('category and amount required.');
  const amt = Number(d.amount);
  if (isNaN(amt) || amt <= 0) throw new Error('Valid expense amount (> 0) required.');

  const empId = d.employee_id || null;
  let session = null;
  if (empId) {
    session = await getOrCreateActiveDriverSession(cid, empId);
    if (session && (session.status === 'CLOSED' || session.status === 'COMPLETED' || session.status === 'RETURN_VERIFIED' || session.status === 'RECONCILED')) {
      throw new Error('Forbidden: Working session for this driver has been submitted and locked. Expense modifications are not allowed.');
    }
  }

  const row = await queryOne(
    'INSERT INTO expenses (company_id, employee_id, session_id, title, category, amount, notes, expense_date) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE) RETURNING *',
    [cid, empId, session ? session.id : null, d.title || d.category, d.category || 'General', amt, d.notes || d.description || null]
  );
  return { success: true, expense: row };
}

export async function updateExpense(cid, expenseId, d, actorUserId) {
  if (!expenseId) throw new Error('Expense ID is required.');
  const existing = await queryOne('SELECT * FROM expenses WHERE id=$1 AND company_id=$2', [Number(expenseId), cid]);
  if (!existing) throw new Error('Expense record not found.');

  if (existing.employee_id) {
    const session = await queryOne(
      `SELECT * FROM driver_sessions WHERE company_id = $1 AND employee_id = $2 ORDER BY id DESC LIMIT 1`,
      [cid, existing.employee_id]
    );
    if (session && (session.status === 'CLOSED' || session.status === 'COMPLETED' || session.status === 'RETURN_VERIFIED' || session.status === 'RECONCILED')) {
      throw new Error('Forbidden: Working session for this driver has been submitted and locked. Expense modifications are not allowed.');
    }
  }

  const amt = d.amount !== undefined ? Number(d.amount) : Number(existing.amount);
  if (isNaN(amt) || amt <= 0) throw new Error('Valid expense amount (> 0) required.');
  const cat = d.category || existing.category;
  const title = d.title || d.category || existing.title;
  const notes = d.notes !== undefined ? d.notes : (d.description !== undefined ? d.description : existing.notes);

  const updated = await queryOne(
    'UPDATE expenses SET title=$1, category=$2, amount=$3, notes=$4, updated_at=NOW() WHERE id=$5 AND company_id=$6 RETURNING *',
    [title, cat, amt, notes, Number(expenseId), cid]
  );
  return { success: true, expense: updated };
}

export async function deleteExpense(cid, expenseId, actorUserId) {
  if (!expenseId) throw new Error('Expense ID is required.');
  const existing = await queryOne('SELECT * FROM expenses WHERE id=$1 AND company_id=$2', [Number(expenseId), cid]);
  if (!existing) throw new Error('Expense record not found.');

  if (existing.employee_id) {
    const session = await queryOne(
      `SELECT * FROM driver_sessions WHERE company_id = $1 AND employee_id = $2 ORDER BY id DESC LIMIT 1`,
      [cid, existing.employee_id]
    );
    if (session && (session.status === 'CLOSED' || session.status === 'COMPLETED' || session.status === 'RETURN_VERIFIED' || session.status === 'RECONCILED')) {
      throw new Error('Forbidden: Working session for this driver has been submitted and locked. Expense modifications are not allowed.');
    }
  }

  await queryOne('DELETE FROM expenses WHERE id=$1 AND company_id=$2 RETURNING id', [Number(expenseId), cid]);
  return { success: true, message: 'Expense deleted successfully.' };
}

export async function submitDriverEndDay(cid, employeeId, data, actorUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sessionRes = await client.query(
      `SELECT * FROM driver_sessions 
       WHERE company_id = $1 AND employee_id = $2 
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [cid, employeeId]
    );
    if (sessionRes.rows.length === 0) {
      throw new Error('No working day session found for driver.');
    }
    const session = sessionRes.rows[0];
    if (session.status === 'END_DAY_SUBMITTED' || session.status === 'CLOSED') {
      throw new Error("Today's working day has already been submitted.");
    }

    const todayStr = session.session_date ? new Date(session.session_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    // Authoritative calculations from real database records
    const sRes = await client.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total_sales,
              COALESCE(SUM(cash_paid), 0) as cash_collected,
              COALESCE(SUM(gpay_paid), 0) as gpay_collected,
              COALESCE(SUM(credit_paid), 0) as credit_sales,
              COALESCE(SUM(CASE WHEN payment_mode = 'SPLIT' THEN total_amount ELSE 0 END), 0) as split_total,
              COUNT(CASE WHEN payment_mode = 'SPLIT' THEN 1 ELSE NULL END) as split_count,
              COUNT(*) as bills_count
       FROM sales 
       WHERE company_id = $1 AND employee_id = $2 AND (status IS NULL OR status = 'ACTIVE' OR status != 'CANCELLED')
         AND (sale_date = $3::date OR created_at::date = $3::date)`,
      [cid, employeeId, todayStr]
    );
    const sRow = sRes.rows[0] || {};
    const totalSales = Number(sRow.total_sales || 0);
    const cashCollected = Number(sRow.cash_collected || 0);
    const gpayCollected = Number(sRow.gpay_collected || 0);
    const creditSales = Number(sRow.credit_sales || 0);
    const splitTotal = Number(sRow.split_total || 0);
    const splitCount = Number(sRow.split_count || 0);
    const billsCount = Number(sRow.bills_count || 0);

    const eRes = await client.query(
      `SELECT COALESCE(SUM(amount), 0) as total_expenses, COUNT(*) as expense_count
       FROM expenses 
       WHERE company_id = $1 AND employee_id = $2 AND (session_id = $3 OR expense_date = $4::date OR created_at::date = $4::date)`,
      [cid, employeeId, session.id, todayStr]
    );
    const totalExpenses = Number(eRes.rows[0]?.total_expenses || 0);
    const netAfterExpenses = parseFloat((totalSales - totalExpenses).toFixed(2));

    const closingSummary = {
      submitted_at: new Date().toISOString(),
      submitted_by: actorUserId,
      total_bills: billsCount,
      total_sales: totalSales,
      gross_sales: totalSales,
      cash_collected: cashCollected,
      gpay_collected: gpayCollected,
      credit_sales: creditSales,
      split_total: splitTotal,
      split_count: splitCount,
      total_expenses: totalExpenses,
      net_after_expenses: netAfterExpenses,
      notes: data?.notes || 'Driver Day Closing Submitted'
    };

    const updatedRes = await client.query(
      `UPDATE driver_sessions 
       SET status='END_DAY_SUBMITTED', closed_at=NOW(), 
           total_sales=$1, total_expenses=$2, cash_collected=$3, gpay_collected=$4, credit_sales=$5,
           closing_summary=$6, updated_at=NOW() 
       WHERE id=$7 RETURNING *`,
      [totalSales, totalExpenses, cashCollected, gpayCollected, creditSales, JSON.stringify(closingSummary), session.id]
    );

    await client.query('COMMIT');
    await auditLog({ companyId: cid, actorUserId, action: 'DRIVER_END_DAY_SUBMITTED', entityType: 'driver_sessions', entityId: session.id, metadata: closingSummary });
    return { success: true, message: "Today's working day submitted successfully.", session: updatedRes.rows[0], summary: closingSummary };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ====== DAMAGES & SETTLEMENTS ======
export async function getDamages(cid, filters, userRole, sessionEmpId) {
  if (!filters) filters = {};
  let sql = `
    SELECT 
      d.id,
      d.company_id,
      d.session_id,
      d.employee_id,
      COALESCE(d.employee_name, e.full_name) as employee_name,
      e.full_name as driver_name,
      e.employee_code,
      e.vehicle_number,
      r.name as route_name,
      d.product_id,
      COALESCE(d.product_name, p.display_name, p.name) as product_name,
      p.image_url as product_image,
      p.icon as product_icon,
      p.selling_unit,
      p.base_unit,
      p.pieces_per_unit,
      p.purchase_price,
      p.unit_selling_price,
      d.qty_units,
      d.unit,
      COALESCE(d.damage_unit, d.unit, 'Tray') as damage_unit,
      COALESCE(d.base_quantity, 
        CASE 
          WHEN LOWER(COALESCE(d.damage_unit, d.unit, 'Tray')) IN ('piece', 'pieces') THEN d.qty_units 
          ELSE d.qty_units * COALESCE(p.pieces_per_unit, 1) 
        END
      ) as base_quantity,
      d.damage_cost,
      d.reason,
      d.notes,
      COALESCE(d.status, 'PENDING') as status,
      d.created_at,
      d.updated_at,
      d.verified_by,
      d.verified_at,
      u.name as verified_by_name,
      ds.session_date
    FROM damages d
    LEFT JOIN employees e ON e.id = d.employee_id
    LEFT JOIN routes r ON r.id = e.route_id
    LEFT JOIN products p ON p.id = d.product_id
    LEFT JOIN user_accounts u ON u.id = d.verified_by
    LEFT JOIN driver_sessions ds ON ds.id = d.session_id
    WHERE d.company_id = $1
  `;
  const params = [cid];
  let idx = 2;

  // Role isolation: driver can only see own records
  const role = (userRole || '').toUpperCase();
  if (role === 'DRIVER' || role === 'EMPLOYEE') {
    if (sessionEmpId) {
      sql += ' AND d.employee_id = $' + idx++;
      params.push(sessionEmpId);
    }
  } else if (filters.employee_id || filters.driver_id) {
    sql += ' AND d.employee_id = $' + idx++;
    params.push(filters.employee_id || filters.driver_id);
  }

  if (filters.product_id) {
    sql += ' AND d.product_id = $' + idx++;
    params.push(filters.product_id);
  }

  if (filters.status && filters.status.toUpperCase() !== 'ALL') {
    sql += ' AND UPPER(COALESCE(d.status, \'PENDING\')) = $' + idx++;
    params.push(filters.status.toUpperCase());
  }

  if (filters.reason && filters.reason.toUpperCase() !== 'ALL') {
    sql += ' AND d.reason ILIKE $' + idx++;
    params.push(`%${filters.reason}%`);
  }

  if (filters.date) {
    sql += ' AND (d.created_at::date = $' + idx++ + ' OR ds.session_date = $' + (idx - 1) + ')';
    params.push(filters.date);
  } else {
    if (filters.start_date) {
      sql += ' AND d.created_at::date >= $' + idx++;
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      sql += ' AND d.created_at::date <= $' + idx++;
      params.push(filters.end_date);
    }
  }

  sql += ' ORDER BY d.created_at DESC';
  if (filters.limit) {
    sql += ' LIMIT $' + idx++;
    params.push(Number(filters.limit));
  }

  return await queryAll(sql, params);
}

export async function verifyOrRejectDamage(cid, damageId, action, notes, actorUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const act = (action || '').toUpperCase();
    if (act !== 'VERIFY' && act !== 'REJECT') {
      throw new Error("Action must be either 'VERIFY' or 'REJECT'");
    }

    const dRes = await client.query(
      'SELECT d.*, p.display_name as p_name, p.selling_unit, p.base_unit, p.pieces_per_unit, p.purchase_price, p.unit_selling_price FROM damages d LEFT JOIN products p ON p.id = d.product_id WHERE d.id = $1 AND d.company_id = $2 FOR UPDATE OF d',
      [damageId, cid]
    );
    if (dRes.rows.length === 0) {
      throw new Error('Damage record not found');
    }
    const damage = dRes.rows[0];

    if (damage.status === 'VERIFIED' || damage.status === 'REJECTED') {
      throw new Error(`Damage record is already ${damage.status}. Cannot reprocess.`);
    }

    const nextStatus = act === 'VERIFY' ? 'VERIFIED' : 'REJECTED';
    const updatedNotes = notes ? (damage.notes ? `${damage.notes} | ${notes}` : notes) : damage.notes;

    const uRes = await client.query(
      `UPDATE damages 
       SET status = $1, verified_by = $2, verified_at = NOW(), notes = $3, updated_at = NOW() 
       WHERE id = $4 AND company_id = $5 
       RETURNING *`,
      [nextStatus, actorUserId || null, updatedNotes, damageId, cid]
    );

    if (nextStatus === 'VERIFIED') {
      const movNo = 'MOV-DMG-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      const ppu = Math.max(1, Number(damage.pieces_per_unit || 1));
      const isBaseUnit = ['piece', 'pieces'].includes(String(damage.damage_unit || damage.unit).toLowerCase());
      const baseQty = Number(damage.base_quantity || (isBaseUnit ? damage.qty_units : damage.qty_units * ppu));
      const movementNotes = `Verified Damage: ${damage.qty_units} ${damage.damage_unit || damage.unit || 'Tray'} (${baseQty} Pieces) - ${damage.reason || 'Wastage'}`;

      await client.query(
        `INSERT INTO inventory_movements (company_id, movement_no, movement_type, product_id, product_name, employee_id, employee_name, qty_units, unit, notes, created_at) 
         VALUES ($1, $2, 'DAMAGE', $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [cid, movNo, damage.product_id, damage.product_name, damage.employee_id, damage.employee_name, damage.qty_units, damage.damage_unit || damage.unit || 'Tray', movementNotes]
      );
    }

    await client.query('COMMIT');
    await auditLog({
      companyId: cid,
      actorUserId,
      action: `DAMAGE_${nextStatus}`,
      entityType: 'damages',
      entityId: damageId,
      metadata: { status: nextStatus, damage_cost: damage.damage_cost, notes: updatedNotes }
    });

    return {
      success: true,
      message: `Damage record successfully ${nextStatus.toLowerCase()}`,
      damage: uRes.rows[0]
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getDamageAnalyticsSummary(cid, filters) {
  if (!filters) filters = {};
  
  let dateFilterSql = '';
  const params = [cid];
  let idx = 2;

  if (filters.date) {
    dateFilterSql += ' AND (d.created_at::date = $' + idx++ + ')';
    params.push(filters.date);
  } else {
    if (filters.start_date) {
      dateFilterSql += ' AND d.created_at::date >= $' + idx++;
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      dateFilterSql += ' AND d.created_at::date <= $' + idx++;
      params.push(filters.end_date);
    }
  }

  if (filters.employee_id) {
    dateFilterSql += ' AND d.employee_id = $' + idx++;
    params.push(filters.employee_id);
  }

  if (filters.product_id) {
    dateFilterSql += ' AND d.product_id = $' + idx++;
    params.push(filters.product_id);
  }

  // Summary aggregation
  const summarySql = `
    SELECT 
      COUNT(*) as total_records,
      COALESCE(SUM(d.damage_cost), 0) as total_damage_cost,
      COALESCE(SUM(
        CASE 
          WHEN LOWER(COALESCE(d.damage_unit, d.unit, 'Tray')) IN ('piece', 'pieces') THEN d.qty_units 
          ELSE d.qty_units * COALESCE(p.pieces_per_unit, 1) 
        END
      ), 0) as total_base_pieces,
      COALESCE(SUM(CASE WHEN COALESCE(d.status, 'PENDING') = 'PENDING' THEN 1 ELSE 0 END), 0) as pending_count,
      COALESCE(SUM(CASE WHEN COALESCE(d.status, 'PENDING') = 'PENDING' THEN d.damage_cost ELSE 0 END), 0) as pending_cost,
      COALESCE(SUM(CASE WHEN d.status = 'VERIFIED' THEN 1 ELSE 0 END), 0) as verified_count,
      COALESCE(SUM(CASE WHEN d.status = 'VERIFIED' THEN d.damage_cost ELSE 0 END), 0) as verified_cost,
      COALESCE(SUM(CASE WHEN d.status = 'REJECTED' THEN 1 ELSE 0 END), 0) as rejected_count,
      COALESCE(SUM(CASE WHEN d.status = 'REJECTED' THEN d.damage_cost ELSE 0 END), 0) as rejected_cost
    FROM damages d
    LEFT JOIN products p ON p.id = d.product_id
    WHERE d.company_id = $1 ${dateFilterSql}
  `;
  const summaryRow = await queryOne(summarySql, params);

  // Top drivers by damage
  const topDriversSql = `
    SELECT 
      d.employee_id,
      COALESCE(e.full_name, d.employee_name, 'Warehouse') as driver_name,
      r.name as route_name,
      COUNT(*) as damage_count,
      COALESCE(SUM(d.damage_cost), 0) as total_cost,
      COALESCE(SUM(
        CASE 
          WHEN LOWER(COALESCE(d.damage_unit, d.unit, 'Tray')) IN ('piece', 'pieces') THEN d.qty_units 
          ELSE d.qty_units * COALESCE(p.pieces_per_unit, 1) 
        END
      ), 0) as total_pieces
    FROM damages d
    LEFT JOIN employees e ON e.id = d.employee_id
    LEFT JOIN routes r ON r.id = e.route_id
    LEFT JOIN products p ON p.id = d.product_id
    WHERE d.company_id = $1 ${dateFilterSql}
    GROUP BY d.employee_id, e.full_name, d.employee_name, r.name
    ORDER BY total_cost DESC
    LIMIT 10
  `;
  const topDrivers = await queryAll(topDriversSql, params);

  // Top products by damage
  const topProductsSql = `
    SELECT 
      d.product_id,
      COALESCE(p.display_name, p.name, d.product_name) as product_name,
      p.image_url,
      p.selling_unit,
      p.base_unit,
      COUNT(*) as damage_count,
      COALESCE(SUM(d.damage_cost), 0) as total_cost,
      COALESCE(SUM(
        CASE 
          WHEN LOWER(COALESCE(d.damage_unit, d.unit, 'Tray')) IN ('piece', 'pieces') THEN d.qty_units 
          ELSE d.qty_units * COALESCE(p.pieces_per_unit, 1) 
        END
      ), 0) as total_pieces
    FROM damages d
    LEFT JOIN products p ON p.id = d.product_id
    WHERE d.company_id = $1 ${dateFilterSql}
    GROUP BY d.product_id, p.display_name, p.name, d.product_name, p.image_url, p.selling_unit, p.base_unit
    ORDER BY total_cost DESC
    LIMIT 10
  `;
  const topProducts = await queryAll(topProductsSql, params);

  // Breakdown by reason
  const reasonsSql = `
    SELECT 
      COALESCE(d.reason, 'Other') as reason,
      COUNT(*) as count,
      COALESCE(SUM(d.damage_cost), 0) as total_cost
    FROM damages d
    WHERE d.company_id = $1 ${dateFilterSql}
    GROUP BY d.reason
    ORDER BY total_cost DESC
  `;
  const byReason = await queryAll(reasonsSql, params);

  return {
    summary: {
      total_records: Number(summaryRow?.total_records || 0),
      total_damage_cost: Number(summaryRow?.total_damage_cost || 0),
      total_base_pieces: Number(summaryRow?.total_base_pieces || 0),
      pending_count: Number(summaryRow?.pending_count || 0),
      pending_cost: Number(summaryRow?.pending_cost || 0),
      verified_count: Number(summaryRow?.verified_count || 0),
      verified_cost: Number(summaryRow?.verified_cost || 0),
      rejected_count: Number(summaryRow?.rejected_count || 0),
      rejected_cost: Number(summaryRow?.rejected_cost || 0)
    },
    top_drivers: topDrivers,
    top_products: topProducts,
    by_reason: byReason
  };
}

export async function addDamage(cid, d, actorUserId) { return await processDamage(cid, d, actorUserId); }

export async function getSettlements(cid, filters) {
  if (!filters) filters = {};
  let sql = 'SELECT * FROM settlements WHERE company_id = $1';
  const params = [cid];
  let idx = 2;
  if (filters.employee_id) {
    sql += ' AND employee_id = $' + idx++;
    params.push(filters.employee_id);
  }
  if (filters.date) {
    sql += ' AND settlement_date = $' + idx++;
    params.push(filters.date);
  }
  sql += ' ORDER BY created_at DESC';
  return await queryAll(sql, params);
}
export async function saveSettlement(cid, d) {
  const targetDate = d.settlement_date || new Date().toISOString().split('T')[0];
  const empId = d.employee_id || null;
  if (empId) {
    const existing = await queryOne(
      'SELECT * FROM settlements WHERE company_id = $1 AND employee_id = $2 AND settlement_date = $3::date',
      [cid, empId, targetDate]
    );
    if (existing) {
      return { success: true, message: 'Day already closed', settlement: existing };
    }
  }
  const diff = (Number(d.collected_amount) || 0) - (Number(d.expected_amount) || 0);
  const status = Math.abs(diff) < 0.01 ? 'BALANCED' : diff > 0 ? 'SURPLUS' : 'DEFICIT';
  const row = await queryOne(
    'INSERT INTO settlements (company_id, employee_id, employee_name, settlement_date, expected_amount, collected_amount, difference, reason, remarks, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
    [cid, empId, d.employee_name || null, targetDate, d.expected_amount || 0, d.collected_amount || 0, diff, d.reason || null, d.remarks || null, status]
  );
  return { success: true, settlement: row };
}

// ====== INVENTORY MOVEMENTS ======
export async function getStockMovements(cid,f) {
  if(!f) f={};
  let sql = 'SELECT * FROM inventory_movements WHERE company_id=$1';
  const params = [cid]; let idx = 2;
  if(f.movement_type) { sql += ' AND movement_type=$'+idx++; params.push(f.movement_type); }
  if(f.employee_id) { sql += ' AND employee_id=$'+idx++; params.push(f.employee_id); }
  if(f.product_id) { sql += ' AND product_id=$'+idx++; params.push(f.product_id); }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  return await queryAll(sql, params);
}

export async function addStockMovement(cid,d) {
  const mn='MOV-'+Date.now();
  let row;
  try {
    row=await queryOne('INSERT INTO inventory_movements (company_id,movement_no,movement_type,product_id,product_name,employee_id,employee_name,qty_units,unit,notes,reference,received_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',[cid,mn,d.movement_type,d.product_id||null,d.product_name||null,d.employee_id||null,d.employee_name||null,d.qty_units||0,d.unit||'Tray',d.notes||null,d.reference||null,d.received_by||null]);
  } catch (e) {
    row=await queryOne('INSERT INTO inventory_movements (company_id,movement_no,movement_type,product_id,product_name,employee_id,employee_name,qty_units,unit,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[cid,mn,d.movement_type,d.product_id||null,d.product_name||null,d.employee_id||null,d.employee_name||null,d.qty_units||0,d.unit||'Tray',d.notes||null]);
  }
  return {success:true,movement:row};
}

export async function getEmployeeStock(cid,eid) {
  return await queryAll('SELECT es.*,p.name as product_name,p.display_name,c.name as category_name,c.operational_unit as category_operational_unit,p.selling_unit,p.base_unit,p.pieces_per_unit,p.unit_selling_price,p.piece_selling_price,p.image_url,p.icon FROM employee_stock es JOIN products p ON p.id=es.product_id LEFT JOIN categories c ON c.id=p.category_id WHERE es.company_id=$1 AND es.employee_id=$2 AND es.qty_units > 0',[cid,eid]);
}

// ====== DASHBOARD SUMMARY & PHASE 4 EXECUTIVE MANAGEMENT ======

function parseDateFilters(filters = {}, defaultCol = 'sale_date') {
  const period = (filters.period || filters.range || 'ALL').toUpperCase();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  let start = filters.start_date || filters.from || null;
  let end = filters.end_date || filters.to || null;

  if (period === 'TODAY' || filters.date === 'today' || filters.date === todayStr) {
    start = todayStr;
    end = todayStr;
  } else if (period === 'YESTERDAY') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    start = y.toISOString().split('T')[0];
    end = start;
  } else if (period === 'THIS_WEEK' || period === 'WEEK') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    start = d.toISOString().split('T')[0];
    end = todayStr;
  } else if (period === 'THIS_MONTH' || period === 'MONTH') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    start = d.toISOString().split('T')[0];
    end = todayStr;
  }

  return { start, end, period };
}

export async function getDashboardSummary(cid) {
  return await getOwnerExecutiveDashboard(cid, { period: 'TODAY' });
}

export async function getOwnerExecutiveDashboard(cid, filters = {}) {
  const { start, end, period } = parseDateFilters(filters, 'sale_date');

  let salesDateCond = '';
  let expDateCond = '';
  let dmgDateCond = '';
  let retDateCond = '';

  if (start && end) {
    salesDateCond = ` AND (s.sale_date >= '${start}' AND s.sale_date <= '${end}')`;
    expDateCond = ` AND (e.created_at::date >= '${start}' AND e.created_at::date <= '${end}')`;
    dmgDateCond = ` AND (d.created_at::date >= '${start}' AND d.created_at::date <= '${end}')`;
    retDateCond = ` AND (dr.created_at::date >= '${start}' AND dr.created_at::date <= '${end}')`;
  } else if (start) {
    salesDateCond = ` AND s.sale_date >= '${start}'`;
    expDateCond = ` AND e.created_at::date >= '${start}'`;
    dmgDateCond = ` AND d.created_at::date >= '${start}'`;
    retDateCond = ` AND dr.created_at::date >= '${start}'`;
  }

  // 1. Sales & Multi-Payment Breakdown (0 Double Counting)
  const salesSql = `
    SELECT 
      COUNT(*) as total_bills,
      COALESCE(SUM(s.total_amount), 0) as gross_sales,
      COALESCE(SUM(s.cash_paid), 0) as cash_sales,
      COALESCE(SUM(s.gpay_paid), 0) as gpay_sales,
      COALESCE(SUM(s.credit_paid), 0) as credit_sales,
      COALESCE(SUM(CASE WHEN LOWER(s.payment_mode) = 'split' OR (COALESCE(s.cash_paid, 0) > 0 AND (COALESCE(s.gpay_paid, 0) > 0 OR COALESCE(s.credit_paid, 0) > 0)) THEN 1 ELSE 0 END), 0) as split_bills_count
    FROM sales s
    WHERE s.company_id = $1 AND (s.status IS NULL OR s.status = 'ACTIVE' OR s.status != 'CANCELLED') ${salesDateCond}
  `;
  const salesRow = await queryOne(salesSql, [cid]);

  // 2. Expenses Breakdown
  const expSql = `
    SELECT 
      COUNT(*) as total_records,
      COALESCE(SUM(e.amount), 0) as total_expenses
    FROM expenses e
    WHERE e.company_id = $1 ${expDateCond}
  `;
  const expRow = await queryOne(expSql, [cid]);

  const expCategoriesSql = `
    SELECT 
      COALESCE(e.category, 'Other') as category,
      COUNT(*) as count,
      COALESCE(SUM(e.amount), 0) as amount
    FROM expenses e
    WHERE e.company_id = $1 ${expDateCond}
    GROUP BY e.category
    ORDER BY amount DESC
  `;
  const expCategories = await queryAll(expCategoriesSql, [cid]);

  // 3. Damages Breakdown
  const dmgSql = `
    SELECT 
      COUNT(*) as total_records,
      COALESCE(SUM(d.damage_cost), 0) as total_damage_cost,
      COALESCE(SUM(CASE WHEN d.status = 'VERIFIED' THEN d.damage_cost ELSE 0 END), 0) as verified_damage_cost,
      COALESCE(SUM(CASE WHEN COALESCE(d.status, 'PENDING') = 'PENDING' THEN d.damage_cost ELSE 0 END), 0) as pending_damage_cost
    FROM damages d
    WHERE d.company_id = $1 ${dmgDateCond}
  `;
  const dmgRow = await queryOne(dmgSql, [cid]);

  // 4. Returns Breakdown
  const retSql = `
    SELECT 
      COUNT(*) as total_returns,
      COALESCE(SUM(dr.total_accepted_good), 0) as total_accepted_good
    FROM driver_returns dr
    WHERE dr.company_id = $1 ${retDateCond}
  `;
  const retRow = await queryOne(retSql, [cid]);

  // 5. Product Buying Cost & Profit/Loss Calculation
  const costSql = `
    SELECT 
      COALESCE(SUM(
        CASE 
          WHEN LOWER(COALESCE(si.unit_type, p.selling_unit, 'Tray')) IN ('piece', 'pieces') 
          THEN si.qty * (COALESCE(p.purchase_price, 0) / GREATEST(1, COALESCE(p.pieces_per_unit, 1)))
          ELSE si.qty * COALESCE(p.purchase_price, 0)
        END
      ), 0) as total_product_cost,
      COUNT(CASE WHEN p.purchase_price IS NULL OR p.purchase_price = 0 THEN 1 ELSE NULL END) as uncosted_items_count
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    LEFT JOIN products p ON p.id = si.product_id
    WHERE s.company_id = $1 AND (s.status IS NULL OR s.status = 'ACTIVE' OR s.status != 'CANCELLED') ${salesDateCond}
  `;
  const costRow = await queryOne(costSql, [cid]);

  const grossSales = Number(salesRow?.gross_sales || 0);
  const productCost = Number(costRow?.total_product_cost || 0);
  const totalExpenses = Number(expRow?.total_expenses || 0);
  const damageCost = Number(dmgRow?.total_damage_cost || 0);
  const verifiedDamageCost = Number(dmgRow?.verified_damage_cost || 0);
  const uncostedCount = Number(costRow?.uncosted_items_count || 0);

  const grossProfit = parseFloat((grossSales - productCost).toFixed(2));
  const netProfit = parseFloat((grossSales - productCost - totalExpenses - damageCost).toFixed(2));
  const netProfitMargin = grossSales > 0 ? parseFloat(((netProfit / grossSales) * 100).toFixed(2)) : 0;

  // 6. Master Stats (Active Drivers, Shops, Total Dues)
  const empQ = await query('SELECT COUNT(*) as t FROM employees WHERE company_id=$1 AND is_active=TRUE', [cid]);
  const prQ = await query('SELECT COUNT(*) as t FROM products WHERE company_id=$1 AND is_active=TRUE', [cid]);
  const shQ = await query('SELECT COUNT(*) as t, COALESCE(SUM(current_due),0) as td FROM shops WHERE company_id=$1 AND is_active=TRUE', [cid]);
  
  // 7. Recent Invoices
  const inv = await queryAll(
    "SELECT id, bill_no, employee_name, shop_name, total_amount, payment_mode, cash_paid, gpay_paid, credit_paid, created_at, sale_date FROM sales WHERE company_id=$1 AND (status IS NULL OR status = 'ACTIVE' OR status != 'CANCELLED') ORDER BY created_at DESC LIMIT 10",
    [cid]
  );

    // 8. 7-Day Revenue Trend (Real PostgreSQL Aggregation)
    const sevenDaySql = `
      WITH last_7_days AS (
        SELECT (CURRENT_DATE - i)::date AS d
        FROM generate_series(6, 0, -1) AS i
      )
      SELECT 
        d.d::text AS date,
        TO_CHAR(d.d, 'Dy') AS day_short,
        CASE WHEN d.d = CURRENT_DATE THEN 'Today (' || TRIM(TO_CHAR(d.d, 'Dy')) || ')' ELSE TRIM(TO_CHAR(d.d, 'Dy')) END AS day_label,
        CASE WHEN d.d = CURRENT_DATE THEN TRUE ELSE FALSE END AS is_today,
        COALESCE(SUM(s.total_amount), 0)::numeric(12,2) AS revenue,
        COALESCE(SUM(s.cash_paid), 0)::numeric(12,2) AS cash,
        COALESCE(SUM(s.gpay_paid), 0)::numeric(12,2) AS gpay,
        COALESCE(SUM(s.credit_paid), 0)::numeric(12,2) AS credit
      FROM last_7_days d
      LEFT JOIN sales s ON s.company_id = $1 
        AND s.sale_date = d.d 
        AND (s.status IS NULL OR s.status = 'ACTIVE' OR s.status != 'CANCELLED')
      GROUP BY d.d
      ORDER BY d.d ASC
    `;
    const sevenDayRaw = await queryAll(sevenDaySql, [cid]);
    const sevenDayRows = sevenDayRaw.map(r => ({
      date: r.date,
      day_short: r.day_short ? r.day_short.trim() : '',
      day_label: r.day_label ? r.day_label.trim() : '',
      is_today: Boolean(r.is_today),
      revenue: Number(r.revenue || 0),
      cash: Number(r.cash || 0),
      gpay: Number(r.gpay || 0),
      credit: Number(r.credit || 0)
    }));

    const sevenDayTotal = parseFloat(sevenDayRows.reduce((acc, row) => acc + row.revenue, 0).toFixed(2));
    const dailyAverage = parseFloat((sevenDayTotal / 7).toFixed(2));
    const maxDayRevenue = Math.max(0, ...sevenDayRows.map(r => r.revenue));
    const peakRow = sevenDayRows.find(r => maxDayRevenue > 0 && r.revenue === maxDayRevenue);

    const formatted7DayTrend = sevenDayRows.map(r => {
      let label = '₹0';
      if (r.revenue >= 1000) {
        label = `₹${(r.revenue / 1000).toFixed(1)}k`;
      } else if (r.revenue > 0) {
        label = `₹${r.revenue.toLocaleString()}`;
      }
      const isPeak = Boolean(maxDayRevenue > 0 && r.revenue === maxDayRevenue);
      const heightPct = maxDayRevenue > 0 && r.revenue > 0 
        ? Math.max(12, Math.round((r.revenue / maxDayRevenue) * 100)) + '%' 
        : '8%';

      return {
        date: r.date,
        day: r.day_label,
        sales: r.revenue,
        label,
        height: heightPct,
        isPeak
      };
    });

    const highestDayStr = peakRow 
      ? `${peakRow.is_today ? 'Today' : peakRow.day_short} (${peakRow.revenue >= 1000 ? `₹${(peakRow.revenue / 1000).toFixed(1)}k` : `₹${peakRow.revenue.toLocaleString()}`})` 
      : 'None (₹0)';

    // 9. Top Products Sold Today (Real DB Line Items Aggregation)
    const topProdSql = `
      SELECT 
        p.id AS product_id,
        COALESCE(NULLIF(p.display_name, ''), p.name) AS product_name,
        COALESCE(p.icon, '🥛') AS icon,
        COALESCE(p.selling_unit, 'Piece') AS selling_unit,
        COALESCE(SUM(si.qty), 0)::numeric(12,2) AS total_qty,
        COALESCE(SUM(si.amount), 0)::numeric(12,2) AS total_amount,
        MAX(si.unit_type) AS unit_type
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.company_id = $1 
        AND s.sale_date = CURRENT_DATE
        AND (s.status IS NULL OR s.status = 'ACTIVE' OR s.status != 'CANCELLED')
      GROUP BY p.id, p.display_name, p.name, p.icon, p.selling_unit
      ORDER BY total_amount DESC
      LIMIT 4
    `;
    const topProdRows = await queryAll(topProdSql, [cid]);

    const todayTotalGross = Number(salesRow?.gross_sales || 0);
    const formattedTopProducts = topProdRows.map(p => {
      const amt = Number(p.total_amount || 0);
      const qty = Number(p.total_qty || 0);
      const unit = p.unit_type || p.selling_unit || 'Piece';
      const pct = todayTotalGross > 0 ? Math.round((amt / todayTotalGross) * 100) : 0;
      return {
        id: p.product_id,
        name: p.product_name,
        qty,
        unit: `${qty} ${unit}${qty !== 1 && !unit.endsWith('s') && !['Piece', 'Pieces'].includes(unit) ? 's' : ''}`,
        amount: amt,
        pct,
        icon: p.icon || '🥛'
      };
    });

    // 10. Payment Breakdown & Share
    const cashAmt = Number(salesRow?.cash_sales || 0);
    const gpayAmt = Number(salesRow?.gpay_sales || 0);
    const creditAmt = Number(salesRow?.credit_sales || 0);
    const totalPaymentAmt = parseFloat((cashAmt + gpayAmt + creditAmt).toFixed(2));

    const paymentBreakdown = [
      {
        label: 'Cash Collection (ரொக்கம்)',
        amount: cashAmt,
        pct: totalPaymentAmt > 0 ? Math.round((cashAmt / totalPaymentAmt) * 100) : 0,
        color: 'bg-emerald-500',
        mode: 'CASH'
      },
      {
        label: 'GPay / UPI (ஜிபே)',
        amount: gpayAmt,
        pct: totalPaymentAmt > 0 ? Math.round((gpayAmt / totalPaymentAmt) * 100) : 0,
        color: 'bg-blue-500',
        mode: 'GPAY'
      },
      {
        label: 'Credit / Dues (கடமை)',
        amount: creditAmt,
        pct: totalPaymentAmt > 0 ? Math.round((creditAmt / totalPaymentAmt) * 100) : 0,
        color: 'bg-amber-500',
        mode: 'CREDIT'
      }
    ];

    const expBreakdownMap = expCategories.reduce((acc, cat) => {
      acc[cat.category] = Number(cat.amount || 0);
      return acc;
    }, {});

    return {
      period: period || 'ALL',
      date_range: { start, end },
      // Executive KPIs
      kpis: {
        gross_sales: grossSales,
        cash_collected: cashAmt,
        gpay_collected: gpayAmt,
        credit_issued: creditAmt,
        expenses: totalExpenses,
        damage_loss: damageCost,
        cogs: productCost,
        net_profit: netProfit,
        profit_margin_pct: netProfitMargin,
        cost_data_incomplete: uncostedCount > 0
      },
      payment_modes: {
        cash: cashAmt,
        gpay: gpayAmt,
        credit: creditAmt,
        split_bills_count: Number(salesRow?.split_bills_count || 0)
      },
      expense_breakdown: expBreakdownMap,

      todaySales: grossSales, // backward compatibility
      totalSales: grossSales,
      grossSales,
      cashCollection: cashAmt,
      gpayCollection: gpayAmt,
      creditSales: creditAmt,
      splitBillsCount: Number(salesRow?.split_bills_count || 0),
      totalBills: Number(salesRow?.total_bills || 0),
      totalExpenses,
      damageCost,
      verifiedDamageCost,
      pendingDamageCost: Number(dmgRow?.pending_damage_cost || 0),
      totalGoodReturns: Number(retRow?.total_accepted_good || 0),
      netCollection: parseFloat((grossSales - totalExpenses - damageCost).toFixed(2)),
      
      // Profit & Loss
      profitLoss: {
        gross_sales: grossSales,
        product_buying_cost: productCost,
        total_expenses: totalExpenses,
        total_damage_loss: damageCost,
        gross_profit: grossProfit,
        estimated_net_profit: netProfit,
        net_margin_percentage: netProfitMargin,
        cost_data_incomplete: uncostedCount > 0,
        uncosted_items_count: uncostedCount
      },

      // Expense Categories Breakdown
      expenseCategories: expCategories,

      // Master Stats
      employeesActive: Number(empQ.rows[0].t),
      activeProducts: Number(prQ.rows[0].t),
      totalShops: Number(shQ.rows[0].t),
      totalDues: Number(shQ.rows[0].td),
      recentInvoices: inv,
      sevenDayRevenue: sevenDayRows,

      // Single Source of Truth Analytics Data
      analytics: {
        seven_day_trend: formatted7DayTrend,
        seven_day_total: sevenDayTotal,
        daily_average: dailyAverage,
        highest_day: highestDayStr,
        highest_day_amount: maxDayRevenue,
        payment_breakdown: paymentBreakdown,
        payment_total: totalPaymentAmt,
        top_products_today: formattedTopProducts
      }
    };
  }

export async function getAdvancedReconciliation(cid, filters = {}) {
  let cond = 'WHERE ds.company_id = $1';
  const params = [cid];
  let idx = 2;

  if (filters.driver_id || filters.employee_id) {
    cond += ` AND ds.employee_id = $${idx++}`;
    params.push(Number(filters.driver_id || filters.employee_id));
  }

  if (filters.route_id) {
    cond += ` AND (ds.route_id = $${idx++} OR e.route_id = $${idx - 1})`;
    params.push(Number(filters.route_id));
  }

  if (filters.date) {
    cond += ` AND ds.session_date = $${idx++}`;
    params.push(filters.date);
  } else if (filters.start_date && filters.end_date) {
    cond += ` AND ds.session_date >= $${idx++} AND ds.session_date <= $${idx++}`;
    params.push(filters.start_date, filters.end_date);
  }

  const sessions = await queryAll(
    `SELECT ds.*, e.full_name as driver_name, e.vehicle_number, r.name as route_name, r.code as route_code
     FROM driver_sessions ds
     JOIN employees e ON e.id = ds.employee_id
     LEFT JOIN routes r ON r.id = COALESCE(ds.route_id, e.route_id)
     ${cond}
     ORDER BY ds.session_date DESC, ds.id DESC
     LIMIT 50`,
    params
  );

  const reconRows = [];
  let totalIssuedUnits = 0;
  let totalSoldUnits = 0;
  let totalGoodReturnUnits = 0;
  let totalDamageUnits = 0;
  let totalVarianceUnits = 0;
  let totalDamageCost = 0;

  for (const session of sessions) {
    const transactions = await queryAll(
      `SELECT st.*, p.display_name as product_name, p.selling_unit, p.base_unit, p.pieces_per_unit, p.purchase_price, p.unit_selling_price
       FROM stock_transactions st
       JOIN products p ON p.id = st.product_id
       WHERE st.company_id = $1 AND st.session_id = $2
       ORDER BY st.created_at ASC`,
      [cid, session.id]
    );

    const productMap = new Map();
    transactions.forEach(t => {
      const pid = t.product_id;
      if (!productMap.has(pid)) {
        productMap.set(pid, {
          session_id: session.id,
          session_date: session.session_date,
          session_status: session.status,
          driver_id: session.employee_id,
          driver_name: session.driver_name,
          vehicle_number: session.vehicle_number || 'Route Driver',
          route_name: session.route_name || 'Route',
          product_id: pid,
          product_name: t.product_name,
          selling_unit: t.selling_unit || 'Tray',
          base_unit: t.base_unit || 'Piece',
          pieces_per_unit: Number(t.pieces_per_unit || 1),
          purchase_price: Number(t.purchase_price || 0),
          issued: 0,
          sold: 0,
          good_return: 0,
          damage: 0,
          damage_cost: 0,
          shortage: 0
        });
      }

      const item = productMap.get(pid);
      const qty = Number(t.qty_units || 0);
      const type = (t.transaction_type || '').toUpperCase();

      if (type === 'ALLOCATION' || type === 'STOCK_ISSUED') item.issued += qty;
      else if (type === 'SALE' || type === 'SOLD') item.sold += qty;
      else if (type === 'GOOD_RETURN' || type === 'RETURN') item.good_return += qty;
      else if (type === 'DAMAGE') {
        item.damage += qty;
        item.damage_cost += Number(t.total_cost || 0);
      } else if (type === 'SHORTAGE') item.shortage += qty;
    });

    // Check held physical stock
    for (const item of productMap.values()) {
      const esRow = await queryOne(
        'SELECT qty_units FROM employee_stock WHERE company_id = $1 AND employee_id = $2 AND product_id = $3',
        [cid, item.driver_id, item.product_id]
      );
      const actualBalance = session.status === 'CLOSED' ? 0 : Number(esRow?.qty_units || 0);
      const expectedBalance = parseFloat((item.issued - item.sold - item.good_return - item.damage).toFixed(4));
      const variance = parseFloat((expectedBalance - actualBalance).toFixed(4));
      const ppu = item.pieces_per_unit;

      let status = 'RECONCILED';
      if (session.status === 'OPEN' || session.status === 'ACTIVE' || session.status === 'END_DAY_SUBMITTED') {
        status = 'PENDING';
      } else if (Math.abs(variance) > 0.001 || Math.abs(item.shortage) > 0.001) {
        status = 'VARIANCE';
      }

      if (filters.status && filters.status !== 'ALL' && status !== filters.status.toUpperCase()) {
        continue;
      }

      if (filters.product_id && Number(filters.product_id) !== item.product_id) {
        continue;
      }

      totalIssuedUnits += item.issued;
      totalSoldUnits += item.sold;
      totalGoodReturnUnits += item.good_return;
      totalDamageUnits += item.damage;
      totalVarianceUnits += Math.abs(variance);
      totalDamageCost += item.damage_cost;

      reconRows.push({
        session_id: item.session_id,
        session_date: item.session_date,
        session_status: item.session_status,
        driver_id: item.driver_id,
        driver_name: item.driver_name,
        vehicle_number: item.vehicle_number,
        route_name: item.route_name,
        product_id: item.product_id,
        product_name: item.product_name,
        selling_unit: item.selling_unit,
        base_unit: item.base_unit,
        pieces_per_unit: ppu,
        issued: item.issued,
        issued_pcs: Math.round(item.issued * ppu),
        sold: item.sold,
        sold_pcs: Math.round(item.sold * ppu),
        good_return: item.good_return,
        good_return_pcs: Math.round(item.good_return * ppu),
        damage: item.damage,
        damage_pcs: Math.round(item.damage * ppu),
        damage_cost: item.damage_cost,
        expected_balance: expectedBalance,
        expected_balance_pcs: Math.round(expectedBalance * ppu),
        actual_balance: actualBalance,
        actual_balance_pcs: Math.round(actualBalance * ppu),
        variance: variance,
        variance_pcs: Math.round(variance * ppu),
        status: status,
        is_reconciled: status === 'RECONCILED'
      });
    }
  }

  return {
    summary: {
      total_records: reconRows.length,
      total_issued_units: parseFloat(totalIssuedUnits.toFixed(2)),
      total_sold_units: parseFloat(totalSoldUnits.toFixed(2)),
      total_good_return_units: parseFloat(totalGoodReturnUnits.toFixed(2)),
      total_damage_units: parseFloat(totalDamageUnits.toFixed(2)),
      total_damage_cost: parseFloat(totalDamageCost.toFixed(2)),
      total_variance_units: parseFloat(totalVarianceUnits.toFixed(2)),
      reconciled_count: reconRows.filter(r => r.status === 'RECONCILED').length,
      variance_count: reconRows.filter(r => r.status === 'VARIANCE').length,
      pending_count: reconRows.filter(r => r.status === 'PENDING').length
    },
    reconciliation: reconRows,
    products: reconRows
  };
}

export async function getDriverPerformanceReport(cid, filters = {}) {
  const { start, end } = parseDateFilters(filters);
  let dateFilterSql = '';
  if (start && end) {
    dateFilterSql = ` AND s.sale_date >= '${start}' AND s.sale_date <= '${end}'`;
  }

  const drivers = await queryAll(
    `SELECT e.id, e.full_name as driver_name, e.vehicle_number, r.name as route_name, r.code as route_code
     FROM employees e
     LEFT JOIN routes r ON r.id = e.route_id
     WHERE e.company_id = $1 AND e.is_active = TRUE
     ORDER BY e.full_name ASC`,
    [cid]
  );

  const report = [];

  for (const d of drivers) {
    // Sales summary
    const sRow = await queryOne(
      `SELECT 
         COUNT(*) as total_bills,
         COALESCE(SUM(s.total_amount), 0) as total_sales,
         COALESCE(SUM(s.cash_paid), 0) as cash_collected,
         COALESCE(SUM(s.gpay_paid), 0) as gpay_collected,
         COALESCE(SUM(s.credit_paid), 0) as credit_sales
       FROM sales s
       WHERE s.company_id = $1 AND s.employee_id = $2 ${dateFilterSql}`,
      [cid, d.id]
    );

    // Expenses summary
    const expRow = await queryOne(
      `SELECT COALESCE(SUM(e.amount), 0) as total_expenses, COUNT(*) as count 
       FROM expenses e 
       WHERE e.company_id = $1 AND e.employee_id = $2 ${start && end ? ` AND e.created_at::date >= '${start}' AND e.created_at::date <= '${end}'` : ''}`,
      [cid, d.id]
    );

    // Returns summary
    const retRow = await queryOne(
      `SELECT COALESCE(SUM(dr.total_accepted_good), 0) as total_good_returns 
       FROM driver_returns dr 
       WHERE dr.company_id = $1 AND dr.employee_id = $2 ${start && end ? ` AND dr.created_at::date >= '${start}' AND dr.created_at::date <= '${end}'` : ''}`,
      [cid, d.id]
    );

    // Damages summary
    const dmgRow = await queryOne(
      `SELECT COALESCE(SUM(d.damage_cost), 0) as total_damage_cost, COALESCE(SUM(d.base_quantity), 0) as total_damage_pieces 
       FROM damages d 
       WHERE d.company_id = $1 AND d.employee_id = $2 ${start && end ? ` AND d.created_at::date >= '${start}' AND d.created_at::date <= '${end}'` : ''}`,
      [cid, d.id]
    );

    // Working days count
    const sessionRow = await queryOne(
      `SELECT COUNT(DISTINCT ds.session_date) as working_days_count 
       FROM driver_sessions ds 
       WHERE ds.company_id = $1 AND ds.employee_id = $2 ${start && end ? ` AND ds.session_date >= '${start}' AND ds.session_date <= '${end}'` : ''}`,
      [cid, d.id]
    );

    // Items sold quantity
    const itemSoldRow = await queryOne(
      `SELECT COALESCE(SUM(si.qty), 0) as total_qty_sold 
       FROM sale_items si 
       JOIN sales s ON s.id = si.sale_id 
       WHERE s.company_id = $1 AND s.employee_id = $2 ${dateFilterSql}`,
      [cid, d.id]
    );

    const totalSales = Number(sRow?.total_sales || 0);
    const totalExpenses = Number(expRow?.total_expenses || 0);
    const totalDmgCost = Number(dmgRow?.total_damage_cost || 0);

    report.push({
      driver_id: d.id,
      driver_name: d.driver_name,
      vehicle_number: d.vehicle_number || 'Route Vehicle',
      route_name: d.route_name || 'Assigned Route',
      working_days: Number(sessionRow?.working_days_count || 0),
      total_bills: Number(sRow?.total_bills || 0),
      total_sales: totalSales,
      cash_collected: Number(sRow?.cash_collected || 0),
      gpay_collected: Number(sRow?.gpay_collected || 0),
      credit_sales: Number(sRow?.credit_sales || 0),
      total_expenses: totalExpenses,
      total_good_returns: Number(retRow?.total_good_returns || 0),
      total_damage_cost: totalDmgCost,
      total_damage_pieces: Number(dmgRow?.total_damage_pieces || 0),
      total_quantity_sold: Number(itemSoldRow?.total_qty_sold || 0),
      net_financial_contribution: parseFloat((totalSales - totalExpenses - totalDmgCost).toFixed(2))
    });
  }

  return report.sort((a, b) => b.total_sales - a.total_sales);
}

export async function getRoutePerformanceReport(cid, filters = {}) {
  const { start, end } = parseDateFilters(filters);
  let dateFilterSql = '';
  if (start && end) {
    dateFilterSql = ` AND s.sale_date >= '${start}' AND s.sale_date <= '${end}'`;
  }

  const routes = await queryAll(
    `SELECT r.id, r.code as route_code, r.name as route_name, r.is_active
     FROM routes r
     WHERE r.company_id = $1
     ORDER BY r.name ASC`,
    [cid]
  );

  const report = [];

  for (const r of routes) {
    // Village and shop counts
    const vCount = await queryOne('SELECT COUNT(*) as t FROM villages WHERE route_id = $1 AND company_id = $2', [r.id, cid]);
    const shCount = await queryOne(
      'SELECT COUNT(*) as total, COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active, COALESCE(SUM(current_due), 0) as dues FROM shops WHERE route_id = $1 AND company_id = $2',
      [r.id, cid]
    );

    // Sales metrics for shops on this route
    const sRow = await queryOne(
      `SELECT 
         COUNT(*) as total_bills,
         COALESCE(SUM(s.total_amount), 0) as total_sales,
         COALESCE(SUM(s.cash_paid), 0) as cash_collected,
         COALESCE(SUM(s.gpay_paid), 0) as gpay_collected,
         COALESCE(SUM(s.credit_paid), 0) as credit_sales
       FROM sales s
       JOIN shops sh ON sh.id = s.shop_id
       WHERE sh.route_id = $1 AND s.company_id = $2 ${dateFilterSql}`,
      [r.id, cid]
    );

    // Quantities sold
    const itemRow = await queryOne(
      `SELECT COALESCE(SUM(si.qty), 0) as total_qty
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN shops sh ON sh.id = s.shop_id
       WHERE sh.route_id = $1 AND s.company_id = $2 ${dateFilterSql}`,
      [r.id, cid]
    );

    report.push({
      route_id: r.id,
      route_code: r.route_code,
      route_name: r.route_name,
      villages_count: Number(vCount?.t || 0),
      total_shops: Number(shCount?.total || 0),
      active_shops: Number(shCount?.active || 0),
      outstanding_dues: Number(shCount?.dues || 0),
      total_bills: Number(sRow?.total_bills || 0),
      total_sales: Number(sRow?.total_sales || 0),
      cash_collected: Number(sRow?.cash_collected || 0),
      gpay_collected: Number(sRow?.gpay_collected || 0),
      credit_sales: Number(sRow?.credit_sales || 0),
      total_quantity_sold: Number(itemRow?.total_qty || 0)
    });
  }

  return report.sort((a, b) => b.total_sales - a.total_sales);
}

export async function getShopPerformanceReport(cid, filters = {}) {
  const { start, end } = parseDateFilters(filters);
  let dateFilterSql = '';
  if (start && end) {
    dateFilterSql = ` AND s.sale_date >= '${start}' AND s.sale_date <= '${end}'`;
  }

  const shops = await queryAll(
    `SELECT 
       sh.id as shop_id,
       sh.code as shop_code,
       sh.name as shop_name,
       sh.owner_name,
       sh.phone,
       sh.current_due,
       sh.credit_limit,
       sh.opening_balance,
       v.name as village_name,
       r.name as route_name,
       COUNT(s.id) as total_bills,
       COALESCE(SUM(s.total_amount), 0) as total_sales,
       COALESCE(SUM(s.credit_paid), 0) as total_credit_issued,
       MAX(s.sale_date) as last_bill_date
     FROM shops sh
     LEFT JOIN villages v ON v.id = sh.village_id
     LEFT JOIN routes r ON r.id = sh.route_id
     LEFT JOIN sales s ON s.shop_id = sh.id AND s.company_id = $1 ${dateFilterSql}
     WHERE sh.company_id = $1
     GROUP BY sh.id, sh.code, sh.name, sh.owner_name, sh.phone, sh.current_due, sh.credit_limit, sh.opening_balance, v.name, r.name
     ORDER BY total_sales DESC`,
    [cid]
  );

  return shops.map(sh => ({
    shop_id: sh.shop_id,
    shop_code: sh.shop_code,
    shop_name: sh.shop_name,
    owner_name: sh.owner_name,
    phone: sh.phone,
    village_name: sh.village_name || 'Village',
    route_name: sh.route_name || 'Route',
    total_bills: Number(sh.total_bills || 0),
    total_sales: Number(sh.total_sales || 0),
    total_credit_issued: Number(sh.total_credit_issued || 0),
    current_due: Number(sh.current_due || 0),
    credit_limit: Number(sh.credit_limit || 0),
    last_bill_date: sh.last_bill_date || null
  }));
}

export async function getProductPerformanceReport(cid, filters = {}) {
  const { start, end } = parseDateFilters(filters);
  let salesDateCond = '';
  let retDateCond = '';
  let dmgDateCond = '';

  if (start && end) {
    salesDateCond = ` AND s.sale_date >= '${start}' AND s.sale_date <= '${end}'`;
    retDateCond = ` AND dr.created_at::date >= '${start}' AND dr.created_at::date <= '${end}'`;
    dmgDateCond = ` AND d.created_at::date >= '${start}' AND d.created_at::date <= '${end}'`;
  }

  const products = await queryAll(
    `SELECT 
       p.id as product_id,
       p.name,
       p.display_name,
       p.selling_unit,
       p.base_unit,
       p.pieces_per_unit,
       p.purchase_price,
       p.unit_selling_price,
       p.image_url,
       p.icon,
       c.name as category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.company_id = $1 AND p.is_active = TRUE
     ORDER BY p.id ASC`,
    [cid]
  );

  const report = [];

  for (const p of products) {
    const ppu = Math.max(1, Number(p.pieces_per_unit || 1));
    const buyRate = Number(p.purchase_price || 0);

    // Sold stats
    const soldRow = await queryOne(
      `SELECT 
         COUNT(DISTINCT si.sale_id) as bills_count,
         COALESCE(SUM(si.qty), 0) as total_qty_sold,
         COALESCE(SUM(si.amount), 0) as total_sales_value
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE si.product_id = $1 AND s.company_id = $2 ${salesDateCond}`,
      [p.product_id, cid]
    );

    // Damage stats
    const dmgRow = await queryOne(
      `SELECT 
         COALESCE(SUM(d.qty_units), 0) as total_damage_units,
         COALESCE(SUM(d.damage_cost), 0) as total_damage_cost
       FROM damages d
       WHERE d.product_id = $1 AND d.company_id = $2 ${dmgDateCond}`,
      [p.product_id, cid]
    );

    const qtySold = Number(soldRow?.total_qty_sold || 0);
    const salesValue = Number(soldRow?.total_sales_value || 0);
    const damageUnits = Number(dmgRow?.total_damage_units || 0);
    const damageCost = Number(dmgRow?.total_damage_cost || 0);
    const estimatedProductCost = qtySold * buyRate;
    const grossMargin = parseFloat((salesValue - estimatedProductCost).toFixed(2));

    report.push({
      product_id: p.product_id,
      product_name: p.display_name || p.name,
      category_name: p.category_name || 'Dairy',
      selling_unit: p.selling_unit || 'Tray',
      base_unit: p.base_unit || 'Piece',
      pieces_per_unit: ppu,
      purchase_price: buyRate,
      unit_selling_price: Number(p.unit_selling_price || 0),
      image_url: p.image_url,
      icon: p.icon,
      bills_count: Number(soldRow?.bills_count || 0),
      total_sold_units: qtySold,
      total_sold_pieces: Math.round(qtySold * ppu),
      total_sales_value: salesValue,
      total_damage_units: damageUnits,
      total_damage_pieces: Math.round(damageUnits * ppu),
      total_damage_cost: damageCost,
      estimated_product_cost: estimatedProductCost,
      gross_margin: grossMargin
    });
  }

  const sortBy = filters.sort_by || 'sales_value';
  if (sortBy === 'quantity_sold') {
    return report.sort((a, b) => b.total_sold_units - a.total_sold_units);
  } else if (sortBy === 'damage_cost') {
    return report.sort((a, b) => b.total_damage_cost - a.total_damage_cost);
  } else if (sortBy === 'damage_quantity') {
    return report.sort((a, b) => b.total_damage_units - a.total_damage_units);
  }
  return report.sort((a, b) => b.total_sales_value - a.total_sales_value);
}

export async function getAuditTrail(cid, filters = {}) {
  let cond = 'WHERE a.company_id = $1';
  const params = [cid];
  let idx = 2;

  if (filters.action && filters.action !== 'ALL') {
    cond += ` AND a.action ILIKE $${idx++}`;
    params.push(`%${filters.action}%`);
  }

  if (filters.entity_type && filters.entity_type !== 'ALL') {
    cond += ` AND a.entity_type ILIKE $${idx++}`;
    params.push(`%${filters.entity_type}%`);
  }

  if (filters.actor_user_id) {
    cond += ` AND a.actor_user_id = $${idx++}`;
    params.push(Number(filters.actor_user_id));
  }

  if (filters.start_date && filters.end_date) {
    cond += ` AND a.created_at::date >= $${idx++} AND a.created_at::date <= $${idx++}`;
    params.push(filters.start_date, filters.end_date);
  } else if (filters.date) {
    cond += ` AND a.created_at::date = $${idx++}`;
    params.push(filters.date);
  }

  const limit = Math.min(200, Number(filters.limit || 50));
  cond += ` ORDER BY a.created_at DESC LIMIT $${idx++}`;
  params.push(limit);

  const logs = await queryAll(
    `SELECT 
       a.id,
       a.company_id,
       a.actor_user_id,
       COALESCE(u.name, 'System') as actor_name,
       COALESCE(u.login_id, 'SYSTEM') as actor_login_id,
       a.action,
       COALESCE(a.entity_type, 'SYSTEM') as entity_type,
       a.entity_id,
       a.metadata,
       a.ip_address,
       a.created_at
     FROM audit_logs a
     LEFT JOIN user_accounts u ON u.id = a.actor_user_id
     ${cond}`,
    params
  );

  return logs;
}

// ====== DRIVER SESSIONS & AUDITABLE STOCK LEDGER ======

export async function getOrCreateActiveDriverSession(cid, employeeId, client = null) {
  const runner = client || pool;
  const existingToday = await runner.query(
    `SELECT ds.*, r.name as route_name, r.code as route_code
     FROM driver_sessions ds
     LEFT JOIN employees e ON e.id = ds.employee_id
     LEFT JOIN routes r ON r.id = COALESCE(ds.route_id, e.route_id)
     WHERE ds.company_id = $1 AND ds.employee_id = $2 AND ds.session_date = CURRENT_DATE
     ORDER BY ds.id DESC LIMIT 1`,
    [cid, employeeId]
  );
  if (existingToday.rows.length > 0) {
    return existingToday.rows[0];
  }

  const existingOpen = await runner.query(
    `SELECT ds.*, r.name as route_name, r.code as route_code
     FROM driver_sessions ds
     LEFT JOIN employees e ON e.id = ds.employee_id
     LEFT JOIN routes r ON r.id = COALESCE(ds.route_id, e.route_id)
     WHERE ds.company_id = $1 AND ds.employee_id = $2 AND ds.status IN ('OPEN', 'ACTIVE', 'RETURN_PENDING', 'RECONCILED', 'SHORTAGE_PENDING')
     ORDER BY ds.id DESC LIMIT 1`,
    [cid, employeeId]
  );
  if (existingOpen.rows.length > 0) {
    return existingOpen.rows[0];
  }

  const empRes = await runner.query('SELECT route_id FROM employees WHERE id=$1 AND company_id=$2', [employeeId, cid]);
  const empRouteId = empRes.rows.length > 0 ? empRes.rows[0].route_id : null;

  const created = await runner.query(
    `INSERT INTO driver_sessions (company_id, employee_id, route_id, session_date, status, opened_at) 
     VALUES ($1, $2, $3, CURRENT_DATE, 'OPEN', NOW()) RETURNING *`,
    [cid, employeeId, empRouteId]
  );

  const newSession = await runner.query(
    `SELECT ds.*, r.name as route_name, r.code as route_code
     FROM driver_sessions ds
     LEFT JOIN employees e ON e.id = ds.employee_id
     LEFT JOIN routes r ON r.id = COALESCE(ds.route_id, e.route_id)
     WHERE ds.id = $1`,
    [created.rows[0].id]
  );
  return newSession.rows[0];
}

export async function getActiveDriverSession(cid, employeeId) {
  const session = await queryOne(
    `SELECT ds.*, r.name as route_name, r.code as route_code
     FROM driver_sessions ds
     LEFT JOIN employees e ON e.id = ds.employee_id
     LEFT JOIN routes r ON r.id = COALESCE(ds.route_id, e.route_id)
     WHERE ds.company_id = $1 AND ds.employee_id = $2 AND (ds.session_date = CURRENT_DATE OR ds.status IN ('OPEN', 'ACTIVE', 'END_DAY_SUBMITTED', 'RETURN_PENDING', 'RECONCILED', 'SHORTAGE_PENDING'))
     ORDER BY ds.id DESC LIMIT 1`,
    [cid, employeeId]
  );
  return session;
}

export async function getDriverSessionReconciliation(cid, employeeId, sessionId = null) {
  let session = null;
  if (sessionId) {
    session = await queryOne(`SELECT * FROM driver_sessions WHERE id=$1 AND company_id=$2`, [sessionId, cid]);
  } else if (employeeId) {
    session = await getActiveDriverSession(cid, employeeId);
  }

  if (!session) {
    return {
      session: null,
      has_active_session: false,
      is_reconciled: true,
      products: [],
      total_allocated: 0,
      total_sold: 0,
      total_good_return: 0,
      total_damage: 0,
      total_shortage: 0,
      total_difference: 0,
      total_damage_cost: 0
    };
  }

  // Get all stock transactions for this session
  const transRows = await queryAll(
    `SELECT st.*, p.name as product_name, p.display_name, p.selling_unit, p.base_unit, p.pieces_per_unit, p.purchase_price, p.unit_selling_price, p.icon, p.image_url
     FROM stock_transactions st
     JOIN products p ON p.id = st.product_id
     WHERE st.company_id = $1 AND st.session_id = $2
     ORDER BY st.created_at ASC`,
    [cid, session.id]
  );

  // Group by product_id and unit
  const groupMap = new Map();
  transRows.forEach(t => {
    const key = `${t.product_id}_${t.unit}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        product_id: t.product_id,
        product_name: t.display_name || t.product_name,
        unit: t.unit,
        icon: t.icon,
        image_url: t.image_url,
        pieces_per_unit: Number(t.pieces_per_unit || 1),
        purchase_price: Number(t.purchase_price || 0),
        unit_selling_price: Number(t.unit_selling_price || 0),
        allocated: 0,
        sold: 0,
        good_return: 0,
        damage: 0,
        shortage: 0,
        damage_cost: 0
      });
    }
    const item = groupMap.get(key);
    const qty = Number(t.qty_units || 0);
    if (t.transaction_type === 'ALLOCATION') {
      item.allocated += qty;
    } else if (t.transaction_type === 'SALE') {
      item.sold += qty;
    } else if (t.transaction_type === 'GOOD_RETURN') {
      item.good_return += qty;
    } else if (t.transaction_type === 'DAMAGE') {
      item.damage += qty;
      item.damage_cost += Number(t.total_cost || (qty * item.purchase_price));
    } else if (t.transaction_type === 'SHORTAGE') {
      item.shortage += qty;
    }
  });

  const reconciliationList = Array.from(groupMap.values()).map(item => {
    const accounted = parseFloat((item.sold + item.good_return + item.damage + item.shortage).toFixed(2));
    const allocated = parseFloat(item.allocated.toFixed(2));
    const difference = parseFloat((allocated - accounted).toFixed(2));
    const remainingPhysical = Math.max(0, parseFloat((allocated - item.sold - item.good_return - item.damage).toFixed(2)));
    return {
      ...item,
      accounted,
      difference,
      remaining_physical: remainingPhysical,
      is_reconciled: Math.abs(difference) < 0.001
    };
  });

  const isReconciled = reconciliationList.length > 0 ? reconciliationList.every(p => p.is_reconciled) : true;
  const totalDifference = reconciliationList.reduce((acc, p) => acc + Math.abs(p.difference), 0);
  const totalAllocated = reconciliationList.reduce((acc, p) => acc + p.allocated, 0);
  const totalSold = reconciliationList.reduce((acc, p) => acc + p.sold, 0);
  const totalGoodReturn = reconciliationList.reduce((acc, p) => acc + p.good_return, 0);
  const totalDamage = reconciliationList.reduce((acc, p) => acc + p.damage, 0);
  const totalDamageCost = reconciliationList.reduce((acc, p) => acc + p.damage_cost, 0);

  // Check if there is any pending return submitted by driver
  const pendingReturn = await queryOne(
    `SELECT * FROM driver_returns WHERE company_id=$1 AND session_id=$2 AND status='PENDING_STOREKEEPER_CHECK' ORDER BY id DESC LIMIT 1`,
    [cid, session.id]
  );

  return {
    success: true,
    session,
    has_active_session: true,
    is_reconciled: isReconciled,
    is_all_reconciled: isReconciled,
    pending_return: pendingReturn,
    has_pending_returns: !!pendingReturn,
    total_difference: totalDifference,
    total_allocated: totalAllocated,
    total_sold: totalSold,
    total_good_return: totalGoodReturn,
    total_damage: totalDamage,
    total_damage_cost: totalDamageCost,
    products: reconciliationList,
    reconciliation: reconciliationList
  };
}

export async function getFleetStockReconciliation(cid, filterDriverId = null) {
  let driversSql = `
    SELECT DISTINCT e.id, e.full_name, e.vehicle_number 
    FROM employees e 
    LEFT JOIN user_accounts ua ON ua.employee_id = e.id 
    WHERE e.company_id = $1 AND e.is_active = TRUE
  `;
  const driversParams = [cid];
  if (filterDriverId && filterDriverId !== 'ALL') {
    driversSql += ` AND (e.id = $2 OR ua.id = $2)`;
    driversParams.push(Number(filterDriverId));
  }
  driversSql += ` ORDER BY e.full_name ASC`;
  const drivers = await queryAll(driversSql, driversParams);

  const report = [];

  for (const driver of drivers) {
    const session = await getActiveDriverSession(cid, driver.id);
    if (!session) continue;

    const transRows = await queryAll(
      `SELECT st.*, p.name as product_name, p.display_name, c.name as category_name, p.selling_unit, p.base_unit, p.pieces_per_unit, p.purchase_price, p.unit_selling_price, p.icon, p.image_url
       FROM stock_transactions st
       JOIN products p ON p.id = st.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE st.company_id = $1 AND st.session_id = $2
       ORDER BY st.created_at ASC`,
      [cid, session.id]
    );

    const groupMap = new Map();
    transRows.forEach(t => {
      const key = `${t.product_id}_${t.unit}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          driver_id: driver.id,
          driver_name: driver.full_name,
          vehicle_no: driver.vehicle_number || 'Route Driver',
          session_id: session.id,
          product_id: t.product_id,
          product_name: t.display_name || t.product_name,
          category_name: t.category || 'Dairy',
          unit: t.unit,
          selling_unit: t.selling_unit || t.unit || 'Tray',
          pieces_per_unit: Number(t.pieces_per_unit || 1),
          purchase_price: Number(t.purchase_price || 0),
          unit_selling_price: Number(t.unit_selling_price || 0),
          allocated: 0,
          sold: 0,
          good_return: 0,
          damage: 0,
          shortage: 0,
          damage_cost: 0
        });
      }
      const item = groupMap.get(key);
      const qty = Number(t.qty_units || 0);
      if (t.transaction_type === 'ALLOCATION') {
        item.allocated += qty;
      } else if (t.transaction_type === 'SALE') {
        item.sold += qty;
      } else if (t.transaction_type === 'GOOD_RETURN') {
        item.good_return += qty;
      } else if (t.transaction_type === 'DAMAGE') {
        item.damage += qty;
        item.damage_cost += Number(t.total_cost || (qty * item.purchase_price));
      } else if (t.transaction_type === 'SHORTAGE') {
        item.shortage += qty;
      }
    });

    for (const item of groupMap.values()) {
      const accounted = parseFloat((item.sold + item.good_return + item.damage + item.shortage).toFixed(2));
      const allocated = parseFloat(item.allocated.toFixed(2));
      const difference = parseFloat((allocated - accounted).toFixed(2));
      const remainingPhysical = Math.max(0, parseFloat((allocated - item.sold - item.good_return - item.damage).toFixed(2)));
      const pcs = item.pieces_per_unit || 1;
      const variancePcs = Math.round(difference * pcs);
      const isReconciled = Math.abs(difference) < 0.001;

      report.push({
        ...item,
        accounted,
        difference,
        remaining_physical: remainingPhysical,
        is_reconciled: isReconciled,
        issued_trays: allocated,
        issued_pcs: Math.round(allocated * pcs),
        sold_trays: item.sold,
        sold_pcs: Math.round(item.sold * pcs),
        good_return_trays: item.good_return,
        good_return_pcs: Math.round(item.good_return * pcs),
        damaged_trays: item.damage,
        damaged_pcs: Math.round(item.damage * pcs),
        current_balance_trays: remainingPhysical,
        current_balance_pcs: Math.round(remainingPhysical * pcs),
        variance_pcs: variancePcs,
        status: isReconciled ? 'RECONCILED' : 'MISMATCH'
      });
    }
  }

  return report;
}

export async function getEligibleDriversForReturn(cid) {
  const sql = `
    SELECT 
      e.id as driver_id,
      e.id as employee_id,
      e.full_name as driver_name,
      e.full_name as employee_name,
      e.employee_code,
      e.phone,
      e.vehicle_number,
      r.id as route_id,
      r.name as route_name,
      r.code as route_code,
      ds.id as session_id,
      ds.session_date,
      COALESCE(ds.status, 'OPEN') as session_status,
      ds.opened_at,
      ds.updated_at,
      COALESCE(ds.total_sales, 0) as total_sales,
      COALESCE(ds.total_expenses, 0) as total_expenses,
      (SELECT COUNT(*) FROM employee_stock es WHERE es.employee_id = e.id AND es.qty_units > 0) as active_stock_count
    FROM employees e
    LEFT JOIN routes r ON r.id = e.route_id
    LEFT JOIN LATERAL (
      SELECT * FROM driver_sessions ds2 
      WHERE ds2.company_id = e.company_id AND ds2.employee_id = e.id 
      ORDER BY ds2.id DESC LIMIT 1
    ) ds ON true
    WHERE e.company_id = $1 AND e.is_active = TRUE
    ORDER BY e.full_name ASC
  `;
  return await queryAll(sql, [cid]);
}

export async function getDriverExpectedReturn(cid, employeeId, sessionId = null) {
  const todayStr = new Date().toISOString().split('T')[0];
  const empId = Number(employeeId);

  // 1. Fetch Driver info
  const driverRes = await queryOne(
    `SELECT e.*, r.name as route_name, r.code as route_code 
     FROM employees e 
     LEFT JOIN routes r ON r.id = e.route_id 
     WHERE e.id = $1 AND e.company_id = $2`,
    [empId, cid]
  );
  if (!driverRes) throw new Error('Driver record not found');

  // 2. Fetch or retrieve session
  let session = null;
  if (sessionId) {
    session = await queryOne(
      `SELECT ds.*, r.name as route_name, r.code as route_code
       FROM driver_sessions ds
       LEFT JOIN employees e ON e.id = ds.employee_id
       LEFT JOIN routes r ON r.id = COALESCE(ds.route_id, e.route_id)
       WHERE ds.id = $1 AND ds.company_id = $2`,
      [Number(sessionId), cid]
    );
  } else {
    session = await queryOne(
      `SELECT ds.*, r.name as route_name, r.code as route_code
       FROM driver_sessions ds
       LEFT JOIN employees e ON e.id = ds.employee_id
       LEFT JOIN routes r ON r.id = COALESCE(ds.route_id, e.route_id)
       WHERE ds.company_id = $1 AND ds.employee_id = $2
       ORDER BY ds.id DESC LIMIT 1`,
      [cid, empId]
    );
    if (!session) {
      session = await getOrCreateActiveDriverSession(cid, empId);
    }
  }

  // 3. Authoritative Sales Summary directly from existing sales / bills records
  const salesRes = await queryOne(
    `SELECT 
      COALESCE(SUM(total_amount), 0) as total_sales,
      COUNT(*) as total_bills,
      COALESCE(SUM(cash_paid), 0) as cash_collected,
      COALESCE(SUM(gpay_paid), 0) as gpay_collected,
      COALESCE(SUM(credit_paid), 0) as credit_sales
     FROM sales
     WHERE company_id = $1 AND employee_id = $2 
       AND (sale_date = $3::date OR created_at::date = $3::date) 
       AND (status IS NULL OR status = 'ACTIVE' OR status != 'CANCELLED')`,
    [cid, empId, todayStr]
  );

  const salesSummary = {
    total_sales: Number(Number(salesRes?.total_sales || 0).toFixed(2)),
    total_bills: Number(salesRes?.total_bills || 0),
    cash_collected: Number(Number(salesRes?.cash_collected || 0).toFixed(2)),
    gpay_collected: Number(Number(salesRes?.gpay_collected || 0).toFixed(2)),
    credit_sales: Number(Number(salesRes?.credit_sales || 0).toFixed(2))
  };

  // 3.5 Authoritative Expenses today for driver
  const expenseRows = await queryAll(
    `SELECT * FROM expenses 
     WHERE company_id = $1 AND employee_id = $2 
       AND (expense_date = $3::date OR created_at::date = $3::date)
     ORDER BY id ASC`,
    [cid, empId, todayStr]
  );
  const totalExpenses = Number(
    expenseRows.reduce((sum, e) => sum + Number(e.amount || 0), 0).toFixed(2)
  );
  const netAmount = Number(
    (salesSummary.total_sales - totalExpenses).toFixed(2)
  );

  const formattedExpenses = expenseRows.map(e => ({
    id: e.id,
    title: e.title || e.category || 'Expense',
    category: e.category || 'General',
    amount: Number(Number(e.amount || 0).toFixed(2)),
    notes: e.notes || '',
    expense_date: e.expense_date,
    created_at: e.created_at
  }));

  salesSummary.total_expenses = totalExpenses;
  salesSummary.net_amount = netAmount;
  salesSummary.expenses = formattedExpenses;

  // 4. Stock Summary
  // a. Held stock in vehicle (Live current driver stock)
  const heldStockRows = await queryAll(
    `SELECT es.*, p.name as product_name, p.display_name, c.name as category_name, c.operational_unit as category_operational_unit, p.selling_unit, p.base_unit, p.pieces_per_unit, p.purchase_price, p.unit_selling_price, p.icon, p.image_url
     FROM employee_stock es
     JOIN products p ON p.id = es.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE es.company_id = $1 AND es.employee_id = $2`,
    [cid, empId]
  );

  // b. Sold items today
  const soldRows = await queryAll(
    `SELECT 
      si.product_id, 
      p.name as product_name, 
      p.display_name, 
      p.pieces_per_unit, 
      p.selling_unit, 
      COALESCE(SUM(si.qty), 0) as sold_pieces,
      COALESCE(SUM(CASE WHEN LOWER(si.unit_type) = 'tray' OR LOWER(si.unit_type) = 'case' OR LOWER(si.unit_type) = 'unit' THEN si.qty ELSE (si.qty::numeric / NULLIF(p.pieces_per_unit, 0)) END), 0) as sold_units
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     JOIN products p ON p.id = si.product_id
     WHERE s.company_id = $1 AND s.employee_id = $2 
       AND (s.status IS NULL OR s.status = 'ACTIVE' OR s.status != 'CANCELLED')
       AND (s.sale_date = $3::date OR s.created_at::date = $3::date)
     GROUP BY si.product_id, p.name, p.display_name, p.pieces_per_unit, p.selling_unit`,
    [cid, empId, todayStr]
  );
  const soldMap = new Map();
  soldRows.forEach(r => soldMap.set(r.product_id, {
    sold_units: Number(r.sold_units || 0),
    sold_pieces: Number(r.sold_pieces || 0)
  }));

  // c. Damaged items today / session
  const dmgRows = await queryAll(
    `SELECT product_id, 
            COALESCE(SUM(qty_units), 0) as damaged_qty,
            COALESCE(SUM(CASE WHEN base_quantity IS NOT NULL AND base_quantity > 0 THEN base_quantity ELSE qty_units END), 0) as damaged_pieces
     FROM damages
     WHERE company_id = $1 AND employee_id = $2 
       AND (CASE WHEN $3 > 0 THEN session_id = $3 ELSE created_at::date = $4::date END)
     GROUP BY product_id`,
    [cid, empId, session?.id || 0, todayStr]
  );
  const dmgMap = new Map();
  dmgRows.forEach(r => dmgMap.set(r.product_id, {
    damaged_qty: Number(r.damaged_qty || 0),
    damaged_pieces: Number(r.damaged_pieces || 0)
  }));

  const detailedDamages = await queryAll(
    `SELECT d.*, p.display_name as product_name, p.selling_unit, p.base_unit
     FROM damages d
     LEFT JOIN products p ON p.id = d.product_id
     WHERE d.company_id = $1 AND d.employee_id = $2 
       AND (CASE WHEN $3 > 0 THEN d.session_id = $3 ELSE d.created_at::date = $4::date END)
     ORDER BY d.created_at DESC`,
    [cid, empId, session?.id || 0, todayStr]
  );

  // d. Allocations today / session
  const allocRows = await queryAll(
    `SELECT product_id, COALESCE(SUM(qty_units), 0) as allocated_qty
     FROM stock_transactions
     WHERE company_id = $1 AND employee_id = $2 AND transaction_type = 'ALLOCATION' 
       AND (CASE WHEN $3 > 0 THEN session_id = $3 ELSE created_at::date = $4::date END)
     GROUP BY product_id`,
    [cid, empId, session?.id || 0, todayStr]
  );
  const allocMap = new Map();
  allocRows.forEach(r => allocMap.set(r.product_id, Number(r.allocated_qty || 0)));

  const allProductIds = new Set([
    ...heldStockRows.map(h => h.product_id),
    ...Array.from(soldMap.keys()),
    ...Array.from(dmgMap.keys()),
    ...Array.from(allocMap.keys())
  ]);

  const productsList = [];
  for (const pid of allProductIds) {
    const heldItem = heldStockRows.find(h => h.product_id === pid);
    let prod = heldItem;
    if (!prod) {
      prod = await queryOne('SELECT p.*, c.name as category_name, c.operational_unit as category_operational_unit FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = $1 AND p.company_id = $2', [pid, cid]);
    }
    if (!prod) continue;

    const opUnit = getOperationalUnit(prod);
    const ppu = Math.max(1, Number(prod.pieces_per_unit || 1));

    const currentStockUnits = Number(heldItem ? heldItem.qty_units : 0);
    const soldInfo = soldMap.get(pid) || { sold_units: 0, sold_pieces: 0 };
    const damagedInfo = dmgMap.get(pid) || { damaged_qty: 0, damaged_pieces: 0 };
    const allocatedUnitsFromDb = Number(allocMap.get(pid) || 0);

    let allocVal, soldVal, dmgVal, returnVal;
    let allocPieces, soldPieces, dmgPieces, returnPieces;

    if (opUnit.isPieceBased) {
      // 1. TRAY CATEGORY -> ALL RECONCILIATION METRICS IN INTEGER PIECES
      returnPieces = Math.round(currentStockUnits * ppu);
      soldPieces = Math.round(soldInfo.sold_pieces);
      dmgPieces = Math.round(damagedInfo.damaged_pieces || (damagedInfo.damaged_qty * ppu));
      allocPieces = allocatedUnitsFromDb > 0 
        ? Math.round(allocatedUnitsFromDb * ppu)
        : (returnPieces + soldPieces + dmgPieces);

      allocVal = allocPieces;
      soldVal = soldPieces;
      dmgVal = dmgPieces;
      returnVal = Math.max(0, allocVal - soldVal - dmgVal); // Expected return in pieces
    } else {
      // 2. NON-TRAY CATEGORY (Case, Bag, Box) -> ALL RECONCILIATION METRICS IN BUNDLE UNITS
      soldVal = normalizeQuantity(soldInfo.sold_units);
      dmgVal = normalizeQuantity(damagedInfo.damaged_qty);
      allocVal = allocatedUnitsFromDb > 0 
        ? normalizeQuantity(allocatedUnitsFromDb)
        : normalizeQuantity(currentStockUnits + soldVal + dmgVal);
      returnVal = normalizeQuantity(Math.max(0, allocVal - soldVal - dmgVal)); // Expected return in units

      returnPieces = Math.round(returnVal * ppu);
      soldPieces = Math.round(soldInfo.sold_pieces);
      dmgPieces = Math.round(dmgVal * ppu);
      allocPieces = Math.round(allocVal * ppu);
    }

    const recon = checkReconciliationEquation(allocVal, soldVal, dmgVal, returnVal);

    productsList.push({
      product_id: pid,
      product_name: prod.display_name || prod.name,
      category_name: prod.category_name || prod.category || null,
      is_piece_based: opUnit.isPieceBased,
      operational_unit: opUnit.operationalUnit,
      display_unit: opUnit.displayUnit,
      unit: opUnit.operationalUnit,
      selling_unit: prod.selling_unit || 'Case',
      base_unit: prod.base_unit || 'Piece',
      pieces_per_unit: ppu,
      // Operational Reconciliation Values
      allocated: allocVal,
      originally_allocated: allocVal,
      allocated_quantity: allocVal,
      allocated_pieces: allocPieces,
      sold: soldVal,
      sold_quantity: soldVal,
      sold_pieces: soldPieces,
      damage: dmgVal,
      damaged_quantity: dmgVal,
      damaged_pieces: dmgPieces,
      current_stock: returnVal,
      current_stock_pieces: returnPieces,
      current_return_stock: returnVal,
      expected_return: returnVal,
      expected_return_trays: returnVal,
      expected_return_pieces: returnPieces,
      purchase_price: Number(prod.purchase_price || 0),
      unit_selling_price: Number(prod.unit_selling_price || 0),
      image_url: prod.image_url,
      icon: prod.icon || '📦',
      // Reconciliation metadata
      is_balanced: recon.isBalanced,
      variance: recon.variance,
      diff: recon.diff,
      reconciliation_status: recon.isBalanced ? 'BALANCED' : 'MISMATCH',
      reconciliation_formula: `${allocVal} = ${soldVal} (Sold) + ${dmgVal} (Damaged) + ${returnVal} (Return)`
    });
  }

  const mismatches = productsList.filter(p => !p.is_balanced);
  const isReconciled = mismatches.length === 0;

  const reconciliationSummary = {
    is_reconciled: isReconciled,
    has_mismatch: !isReconciled,
    total_products: productsList.length,
    total_allocated: normalizeQuantity(productsList.reduce((s, p) => s + p.allocated, 0)),
    total_sold: normalizeQuantity(productsList.reduce((s, p) => s + p.sold, 0)),
    total_damaged: normalizeQuantity(productsList.reduce((s, p) => s + p.damage, 0)),
    total_current_return: normalizeQuantity(productsList.reduce((s, p) => s + p.current_return_stock, 0)),
    mismatches: mismatches.map(m => ({
      product_id: m.product_id,
      product_name: m.product_name,
      unit: m.unit,
      allocated: m.allocated,
      sold: m.sold,
      damaged: m.damage,
      current_return: m.current_return_stock,
      variance: m.variance,
      diff: m.diff,
      message: `Stock mismatch on ${m.product_name}: Allocated (${m.allocated} ${m.unit}) != Sold (${m.sold}) + Damaged (${m.damage}) + Return (${m.current_return_stock}) [Difference: ${m.diff} ${m.unit}]`
    }))
  };

  return {
    driver: {
      id: driverRes.id,
      name: driverRes.full_name,
      employee_code: driverRes.employee_code,
      phone: driverRes.phone,
      vehicle_number: driverRes.vehicle_number,
      route_name: session?.route_name || driverRes.route_name || 'Assigned Route'
    },
    session: {
      id: session?.id,
      date: session?.session_date || todayStr,
      status: session?.status || 'OPEN',
      opened_at: session?.opened_at
    },
    sales_summary: salesSummary,
    expenses: formattedExpenses,
    total_expenses: totalExpenses,
    damages: detailedDamages,
    net_amount: netAmount,
    reconciliation: reconciliationSummary,
    products: productsList
  };
}

export async function verifyAndAcceptDriverReturn(cid, employeeId, data, actorUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const empId = Number(employeeId);
    const { session_id, items, notes, shortage_reason } = data;

    // 1. Validate Driver Exists
    if (!empId) throw new Error('Driver ID is required.');
    const empRes = await client.query('SELECT * FROM employees WHERE id = $1 AND company_id = $2', [empId, cid]);
    if (empRes.rows.length === 0) throw new Error('Driver record not found in system.');
    const driver = empRes.rows[0];
    const empName = driver.full_name;

    // 2. Validate Driver has active session / return
    let sessionRes = null;
    if (session_id) {
      sessionRes = await client.query(
        'SELECT * FROM driver_sessions WHERE id = $1 AND company_id = $2 FOR UPDATE',
        [Number(session_id), cid]
      );
    } else {
      sessionRes = await client.query(
        `SELECT * FROM driver_sessions WHERE employee_id = $1 AND company_id = $2 AND status IN ('OPEN', 'RETURN_PENDING', 'END_DAY_SUBMITTED') ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [empId, cid]
      );
    }

    if (sessionRes.rows.length === 0) {
      throw new Error('Active working session not found for driver.');
    }
    const session = sessionRes.rows[0];

    // 8. Prevent duplicate submission
    if (session.status === 'CLOSED' || session.status === 'COMPLETED' || session.status === 'RETURN_VERIFIED' || session.status === 'RECONCILED') {
      throw new Error('Driver return has already been submitted and finalized.');
    }

    const todayStr = session.session_date || new Date().toISOString().split('T')[0];

    // Lock and retrieve all current employee_stock rows for this driver
    const heldStockRes = await client.query(
      `SELECT * FROM employee_stock WHERE company_id = $1 AND employee_id = $2 FOR UPDATE`,
      [cid, empId]
    );
    const heldStockMap = new Map();
    heldStockRes.rows.forEach(r => heldStockMap.set(r.product_id, Number(r.qty_units || 0)));

    // Fetch Sold units today/session
    const soldRes = await client.query(
      `SELECT 
        si.product_id,
        COALESCE(SUM(si.qty), 0) as sold_pieces,
        COALESCE(SUM(CASE WHEN LOWER(si.unit_type) = 'tray' OR LOWER(si.unit_type) = 'case' OR LOWER(si.unit_type) = 'unit' THEN si.qty ELSE (si.qty::numeric / NULLIF(p.pieces_per_unit, 0)) END), 0) as sold_units
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN products p ON p.id = si.product_id
       WHERE s.company_id = $1 AND s.employee_id = $2 
         AND (s.status IS NULL OR s.status = 'ACTIVE' OR s.status != 'CANCELLED')
         AND (s.sale_date = $3::date OR s.created_at::date = $3::date)
       GROUP BY si.product_id`,
      [cid, empId, todayStr]
    );
    const soldMap = new Map();
    soldRes.rows.forEach(r => soldMap.set(r.product_id, {
      sold_units: Number(r.sold_units || 0),
      sold_pieces: Number(r.sold_pieces || 0)
    }));

    // Fetch Damaged units today/session
    const dmgRes = await client.query(
      `SELECT product_id, 
              COALESCE(SUM(qty_units), 0) as damaged_qty,
              COALESCE(SUM(CASE WHEN base_quantity IS NOT NULL AND base_quantity > 0 THEN base_quantity ELSE qty_units END), 0) as damaged_pieces
       FROM damages
       WHERE company_id = $1 AND employee_id = $2 
         AND (CASE WHEN $3 > 0 THEN session_id = $3 ELSE created_at::date = $4::date END)
       GROUP BY product_id`,
      [cid, empId, session.id || 0, todayStr]
    );
    const dmgMap = new Map();
    dmgRes.rows.forEach(r => dmgMap.set(r.product_id, {
      damaged_qty: Number(r.damaged_qty || 0),
      damaged_pieces: Number(r.damaged_pieces || 0)
    }));

    // Fetch Allocations today/session
    const allocRes = await client.query(
      `SELECT product_id, COALESCE(SUM(qty_units), 0) as allocated_qty
       FROM stock_transactions
       WHERE company_id = $1 AND employee_id = $2 AND transaction_type = 'ALLOCATION'
         AND (CASE WHEN $3 > 0 THEN session_id = $3 ELSE created_at::date = $4::date END)
       GROUP BY product_id`,
      [cid, empId, session.id || 0, todayStr]
    );
    const allocMap = new Map();
    allocRes.rows.forEach(r => allocMap.set(r.product_id, Number(r.allocated_qty || 0)));

    const evaluatedItems = [];
    let totalGoodReturnedUnits = 0;
    let totalReturnItemsCost = 0;
    let totalShortageUnits = 0;
    let totalShortageCost = 0;

    // Iterate through submitted return items or all driver products
    const returnItemsList = Array.isArray(items) && items.length > 0 ? items : [];
    if (returnItemsList.length === 0) {
      // If items array not provided, build from held stock
      for (const [pid, qty] of heldStockMap.entries()) {
        returnItemsList.push({ product_id: pid, actual_return: qty });
      }
    }

    for (const it of returnItemsList) {
      const pid = Number(it.product_id);
      if (!pid) continue;

      // Lock product row
      const pRes = await client.query(
        `SELECT p.*, c.name as category_name, c.operational_unit as category_operational_unit 
         FROM products p 
         LEFT JOIN categories c ON c.id = p.category_id 
         WHERE p.id = $1 AND p.company_id = $2 FOR UPDATE OF p`,
        [pid, cid]
      );
      if (pRes.rows.length === 0) throw new Error(`Product #${pid} not found in database.`);
      const prod = pRes.rows[0];

      const opUnit = getOperationalUnit(prod);
      const ppu = Math.max(1, Number(prod.pieces_per_unit || 1));
      const currentStockUnits = Number(heldStockMap.get(pid) || 0);
      const soldInfo = soldMap.get(pid) || { sold_units: 0, sold_pieces: 0 };
      const damagedInfo = dmgMap.get(pid) || { damaged_qty: 0, damaged_pieces: 0 };
      const allocUnits = Number(allocMap.get(pid) || 0);

      let allocVal, soldVal, dmgVal, currentVal, requestedReturnVal, returnStockUnitsToWarehouse, shortageQty, shortageStockUnits;

      if (opUnit.isPieceBased) {
        // TRAY CATEGORY: RECONCILIATION IN INTEGER PIECES
        soldVal = Math.round(soldInfo.sold_pieces);
        dmgVal = Math.round(damagedInfo.damaged_pieces || (damagedInfo.damaged_qty * ppu));
        allocVal = allocUnits > 0 ? Math.round(allocUnits * ppu) : Math.round((currentStockUnits * ppu) + soldVal + dmgVal);
        currentVal = Math.max(0, allocVal - soldVal - dmgVal); // Expected Return Pieces

        // Requested return in pieces
        requestedReturnVal = it.actual_quantity != null 
          ? (it.unit?.toLowerCase() === 'tray' ? Math.round(Number(it.actual_quantity) * ppu) : Math.round(Number(it.actual_quantity)))
          : currentVal;

        if (requestedReturnVal < 0) {
          throw new Error(`Return quantity cannot be negative for product "${prod.display_name}".`);
        }
        if (requestedReturnVal > currentVal + 0.0001) {
          throw new Error(`Return quantity (${requestedReturnVal} Pieces) exceeds expected return (${currentVal} Pieces) for "${prod.display_name}". Excess detected: +${requestedReturnVal - currentVal} Pieces.`);
        }

        shortageQty = Math.max(0, currentVal - requestedReturnVal);
        shortageStockUnits = shortageQty / ppu;
        returnStockUnitsToWarehouse = requestedReturnVal / ppu;
      } else {
        // NON-TRAY CATEGORY (Case, Bag, Box): RECONCILIATION IN BUNDLE UNITS
        soldVal = normalizeQuantity(soldInfo.sold_units);
        dmgVal = normalizeQuantity(damagedInfo.damaged_qty);
        allocVal = allocUnits > 0 ? normalizeQuantity(allocUnits) : normalizeQuantity(currentStockUnits + soldVal + dmgVal);
        currentVal = normalizeQuantity(Math.max(0, allocVal - soldVal - dmgVal)); // Expected Return Units

        requestedReturnVal = it.actual_quantity != null ? normalizeQuantity(it.actual_quantity) : currentVal;

        if (requestedReturnVal < 0) {
          throw new Error(`Return quantity cannot be negative for product "${prod.display_name}".`);
        }
        if (requestedReturnVal > currentVal + 0.0001) {
          throw new Error(`Return quantity (${requestedReturnVal} ${opUnit.operationalUnit}) exceeds expected return (${currentVal} ${opUnit.operationalUnit}) for "${prod.display_name}". Excess detected: +${normalizeQuantity(requestedReturnVal - currentVal)} ${opUnit.operationalUnit}.`);
        }

        shortageQty = normalizeQuantity(Math.max(0, currentVal - requestedReturnVal));
        shortageStockUnits = shortageQty;
        returnStockUnitsToWarehouse = requestedReturnVal;
      }

      const buyRate = Number(prod.purchase_price || 0);
      const itemReturnCost = Number((returnStockUnitsToWarehouse * buyRate).toFixed(2));
      const shortageCost = Number((shortageStockUnits * buyRate).toFixed(2));
      const itemShortageReason = (it.shortage_reason || shortage_reason || '').trim();

      if (shortageQty > 0 && !itemShortageReason) {
        throw new Error(`Shortage reason is required for product "${prod.display_name}".`);
      }

      totalGoodReturnedUnits += returnStockUnitsToWarehouse;
      totalReturnItemsCost += itemReturnCost;
      totalShortageUnits += shortageStockUnits;
      totalShortageCost += shortageCost;

      // FINAL STOCK MOVEMENT:
      // Only the driver's CURRENT REMAINING STOCK is returned to warehouse
      // Sales (soldQty) are NOT added back
      // Damage (damagedQty) is NOT added back
      if (returnStockUnitsToWarehouse > 0) {
        // 1. Add return stock to live warehouse inventory
        await client.query(
          `UPDATE products SET warehouse_stock_units = warehouse_stock_units + $1, updated_at = NOW() WHERE id = $2`,
          [returnStockUnitsToWarehouse, pid]
        );

        // 2. Record inventory movement
        const movNo = 'MOV-RET-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        await client.query(
          `INSERT INTO inventory_movements (company_id, movement_no, movement_type, product_id, product_name, employee_id, employee_name, qty_units, unit, notes) 
           VALUES ($1, $2, 'RETURN', $3, $4, $5, $6, $7, $8, $9)`,
          [cid, movNo, pid, prod.display_name, empId, empName, returnStockUnitsToWarehouse, prod.selling_unit || 'Unit', `Final verified return accepted into warehouse from Driver ${empName} (${requestedReturnVal} ${opUnit.operationalUnit})`]
        );

        // 3. Record stock transaction ledger
        await client.query(
          `INSERT INTO stock_transactions (company_id, session_id, employee_id, product_id, unit, transaction_type, qty_units, unit_cost, total_cost, reference_id, notes, created_by) 
           VALUES ($1, $2, $3, $4, $5, 'GOOD_RETURN', $6, $7, $8, $9, $10, $11)`,
          [cid, session.id, empId, pid, prod.selling_unit || 'Unit', returnStockUnitsToWarehouse, buyRate, itemReturnCost, 'SESSION-' + session.id, 'Driver return accepted into warehouse', actorUserId || null]
        );
      }

      if (shortageStockUnits > 0) {
        const shortageRef = 'SHO-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        await client.query(
          `INSERT INTO stock_transactions (company_id, session_id, employee_id, product_id, unit, transaction_type, qty_units, unit_cost, total_cost, reference_id, notes, created_by) 
           VALUES ($1, $2, $3, $4, $5, 'SHORTAGE', $6, $7, $8, $9, $10, $11)`,
          [cid, session.id, empId, pid, prod.selling_unit || 'Unit', shortageStockUnits, buyRate, shortageCost, shortageRef, itemShortageReason, actorUserId || null]
        );
        await client.query(
          `INSERT INTO inventory_movements (company_id, movement_no, movement_type, product_id, product_name, employee_id, employee_name, qty_units, unit, notes) 
           VALUES ($1, $2, 'ADJUSTMENT', $3, $4, $5, $6, $7, $8, $9)`,
          [cid, shortageRef, pid, prod.display_name, empId, empName, shortageStockUnits, prod.selling_unit || 'Unit', 'Driver return shortage: ' + itemShortageReason]
        );
      }

      // 4. Zero out driver's stock for this product in employee_stock
      await client.query(
        `UPDATE employee_stock SET qty_units = 0, updated_at = NOW() 
         WHERE employee_id = $1 AND product_id = $2 AND company_id = $3`,
        [empId, pid, cid]
      );

      evaluatedItems.push({
        product_id: pid,
        product_name: prod.display_name,
        unit: opUnit.operationalUnit,
        allocated_quantity: allocVal,
        sold_quantity: soldVal,
        damaged_quantity: dmgVal,
        system_return_quantity: currentVal,
        returned_quantity: requestedReturnVal,
        physical_return_quantity: requestedReturnVal,
        shortage_quantity: shortageQty,
        shortage_units: shortageStockUnits,
        shortage_cost: shortageCost,
        shortage_reason: shortageQty > 0 ? itemShortageReason : '',
        unit_cost: buyRate,
        total_cost: itemReturnCost,
        reconciliation_status: shortageQty > 0 ? 'SHORTAGE' : 'BALANCED',
        is_balanced: true
      });
    }

    // 5. Create authoritative Driver Return Record
    const returnNo = 'RET-' + Date.now().toString().slice(-6);
    const retRes = await client.query(
      `INSERT INTO driver_returns (company_id, session_id, employee_id, route_id, return_no, status, items, total_accepted_good, total_damage_cost, variance_summary, notes, checked_by, checked_at) 
       VALUES ($1, $2, $3, $4, $5, 'VERIFIED', $6, $7, $8, $9, $10, $11, NOW()) RETURNING *`,
      [
        cid, 
        session.id, 
        empId, 
        session.route_id || null, 
        returnNo, 
        JSON.stringify(evaluatedItems), 
        totalGoodReturnedUnits, 
        0, 
        JSON.stringify({ total_returned_units: totalGoodReturnedUnits, total_shortage_units: totalShortageUnits, total_shortage_cost: totalShortageCost, total_items_count: evaluatedItems.length }),
        notes || 'Driver stock return verified, reconciled and accepted into warehouse',
        actorUserId || null
      ]
    );

    // 6. Authoritative Sales and Expenses Summary for Closing the Driver Session
    const salesRes = await client.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total_sales, COUNT(*) as total_bills,
              COALESCE(SUM(cash_paid), 0) as cash_collected,
              COALESCE(SUM(gpay_paid), 0) as gpay_collected,
              COALESCE(SUM(credit_paid), 0) as credit_sales
       FROM sales
       WHERE company_id = $1 AND employee_id = $2
         AND (sale_date = $3::date OR created_at::date = $3::date)
         AND (status IS NULL OR status = 'ACTIVE' OR status != 'CANCELLED')`,
      [cid, empId, todayStr]
    );
    const expRes = await client.query(
      `SELECT COALESCE(SUM(amount), 0) as total_expenses, COUNT(*) as exp_count
       FROM expenses
       WHERE company_id = $1 AND employee_id = $2
         AND (session_id = $3 OR expense_date = $4::date OR created_at::date = $4::date)`,
      [cid, empId, session.id, todayStr]
    );
    const finalSales = Number(salesRes.rows[0]?.total_sales || 0);
    const finalExpenses = Number(expRes.rows[0]?.total_expenses || 0);
    const finalCash = Number(salesRes.rows[0]?.cash_collected || 0);
    const finalGpay = Number(salesRes.rows[0]?.gpay_collected || 0);
    const finalCredit = Number(salesRes.rows[0]?.credit_sales || 0);
    const finalNetAmount = Number((finalSales - finalExpenses).toFixed(2));

    await client.query(
      `UPDATE driver_sessions 
       SET status = 'CLOSED', closed_at = NOW(), 
           total_sales = $1, total_expenses = $2,
           cash_collected = $3, gpay_collected = $4, credit_sales = $5,
           updated_at = NOW() 
       WHERE id = $6`,
      [finalSales, finalExpenses, finalCash, finalGpay, finalCredit, session.id]
    );

    // Commit atomic database transaction
    await client.query('COMMIT');

    await auditLog({ 
      companyId: cid, 
      actorUserId, 
      action: 'DRIVER_RETURN_VERIFIED_ACCEPTED', 
      entityType: 'driver_returns', 
      entityId: retRes.rows[0].id,
      metadata: { 
        driver_id: empId, 
        session_id: session.id, 
        return_no: returnNo,
        total_returned_units: totalGoodReturnedUnits,
        total_shortage_units: totalShortageUnits,
        total_shortage_cost: totalShortageCost,
        total_sales: finalSales,
        total_expenses: finalExpenses,
        net_amount: finalNetAmount
      }
    });

    return {
      success: true,
      message: `Driver return ${returnNo} successfully accepted! ${totalGoodReturnedUnits} units returned to live warehouse stock.`,
      return: retRes.rows[0],
      summary: {
        return_no: returnNo,
        driver_name: empName,
        total_returned_units: totalGoodReturnedUnits,
        total_shortage_units: totalShortageUnits,
        total_shortage_cost: totalShortageCost,
        total_returned_items: evaluatedItems.length,
        total_sales: finalSales,
        total_expenses: finalExpenses,
        net_amount: finalNetAmount,
        session_status: 'CLOSED',
        items: evaluatedItems
      },
      evaluated_items: evaluatedItems
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getDriverReturnHistory(cid, limit = 20) {
  const sql = `
    SELECT 
      dr.id,
      dr.session_id,
      dr.return_no,
      dr.status,
      dr.items,
      dr.total_accepted_good,
      dr.total_damage_cost,
      dr.variance_summary,
      dr.notes,
      dr.checked_at,
      dr.created_at,
      e.id as driver_id,
      e.full_name as driver_name,
      e.employee_code,
      e.vehicle_number,
      r.name as route_name,
      ds.session_date,
      COALESCE(ds.total_sales, 0) as total_sales,
      COALESCE(ds.total_expenses, 0) as total_expenses,
      (COALESCE(ds.total_sales, 0) - COALESCE(ds.total_expenses, 0)) as net_amount,
      u.name as checked_by_name
    FROM driver_returns dr
    JOIN employees e ON e.id = dr.employee_id
    LEFT JOIN driver_sessions ds ON ds.id = dr.session_id
    LEFT JOIN routes r ON r.id = COALESCE(dr.route_id, ds.route_id, e.route_id)
    LEFT JOIN user_accounts u ON u.id = dr.checked_by
    WHERE dr.company_id = $1
    ORDER BY dr.created_at DESC
    LIMIT $2
  `;
  return await queryAll(sql, [cid, Number(limit) || 20]);
}

export async function getMissingStockReport(cid, filters = {}) {
  const { driver_id, date, product_id, status } = filters;
  
  let query = `
    SELECT 
      dr.id as return_id,
      dr.session_id,
      dr.return_no,
      dr.status as return_status,
      dr.items,
      dr.variance_summary,
      dr.notes,
      dr.checked_at,
      dr.created_at,
      e.id as driver_id,
      e.full_name as driver_name,
      e.employee_code,
      e.vehicle_number,
      r.name as route_name,
      ds.session_date,
      u.name as checked_by_name
    FROM driver_returns dr
    JOIN employees e ON e.id = dr.employee_id
    LEFT JOIN driver_sessions ds ON ds.id = dr.session_id
    LEFT JOIN routes r ON r.id = COALESCE(dr.route_id, ds.route_id, e.route_id)
    LEFT JOIN user_accounts u ON u.id = dr.checked_by
    WHERE dr.company_id = $1
  `;
  const params = [cid];
  let paramIdx = 2;

  if (driver_id && driver_id !== 'ALL') {
    query += ` AND e.id = $${paramIdx++}`;
    params.push(Number(driver_id));
  }
  if (date && date !== 'ALL') {
    query += ` AND (dr.created_at::date = $${paramIdx}::date OR ds.session_date = $${paramIdx}::date)`;
    params.push(date);
    paramIdx++;
  } else {
    if (filters.start_date && filters.start_date !== 'ALL') {
      query += ` AND (dr.created_at::date >= $${paramIdx}::date OR ds.session_date >= $${paramIdx}::date)`;
      params.push(filters.start_date);
      paramIdx++;
    }
    if (filters.end_date && filters.end_date !== 'ALL') {
      query += ` AND (dr.created_at::date <= $${paramIdx}::date OR ds.session_date <= $${paramIdx}::date)`;
      params.push(filters.end_date);
      paramIdx++;
    }
  }

  query += ` ORDER BY dr.created_at DESC`;

  const rows = await queryAll(query, params);
  
  const missingRecords = [];
  const driversWithMissing = new Set();
  const missingProducts = new Set();
  let totalMissingUnits = 0;
  let unresolvedSessionsCount = 0;

  for (const row of rows) {
    const items = Array.isArray(row.items) ? row.items : (typeof row.items === 'string' ? JSON.parse(row.items || '[]') : []);
    let sessionHasMissing = false;

    for (const item of items) {
      const missingQty = Number(item.shortage_quantity ?? item.missing_quantity ?? 0);
      if (missingQty > 0) {
        sessionHasMissing = true;
        totalMissingUnits += missingQty;
        driversWithMissing.add(row.driver_id);
        missingProducts.add(item.product_id || item.product_name);

        if (product_id && product_id !== 'ALL' && String(item.product_id) !== String(product_id)) {
          continue;
        }

        missingRecords.push({
          id: `${row.return_id}-${item.product_id}`,
          return_id: row.return_id,
          session_id: row.session_id,
          return_no: row.return_no,
          date: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : (row.session_date || 'Today'),
          created_at: row.created_at || row.checked_at,
          driver_id: row.driver_id,
          driver_name: row.driver_name,
          employee_code: row.employee_code || 'EMP',
          vehicle_number: row.vehicle_number || 'N/A',
          route_name: row.route_name || 'Main Route',
          product_id: item.product_id,
          product_name: item.product_name,
          allocated_quantity: Number(item.allocated_quantity || 0),
          sold_quantity: Number(item.sold_quantity || 0),
          damaged_quantity: Number(item.damaged_quantity || 0),
          expected_quantity: Number(item.system_return_quantity || item.expected_quantity || 0),
          actual_quantity: Number(item.physical_return_quantity ?? item.actual_quantity ?? item.returned_quantity ?? 0),
          missing_quantity: missingQty,
          shortage_units: Number(item.shortage_units || missingQty),
          unit: item.unit || 'Pieces',
          shortage_reason: item.shortage_reason || 'Missing during return',
          storekeeper_name: row.checked_by_name || 'Storekeeper',
          status: 'MISSING'
        });
      }
    }

    if (sessionHasMissing) {
      unresolvedSessionsCount++;
    }
  }

  return {
    success: true,
    records: missingRecords,
    summary: {
      total_missing_units: Number(totalMissingUnits.toFixed(4)),
      missing_products_count: missingProducts.size,
      drivers_with_missing_count: driversWithMissing.size,
      open_unresolved_sessions_count: unresolvedSessionsCount
    }
  };
}

export async function submitDriverReturn(cid, employeeId, data, actorUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { items, notes } = data;
    if (!employeeId) throw new Error('Employee ID is required');
    if (!items || !Array.isArray(items) || items.length === 0) throw new Error('Return items are required');

    const session = await getOrCreateActiveDriverSession(cid, employeeId, client);

    const evaluatedItems = [];
    for (const it of items) {
      const pid = Number(it.product_id);
      const qty = Number(it.quantity || it.qty_units || it.returned_qty || 0);
      if (qty <= 0) continue;

      const pRes = await client.query('SELECT * FROM products WHERE id=$1 AND company_id=$2 AND is_active=TRUE', [pid, cid]);
      if (pRes.rows.length === 0) throw new Error(`Product ${pid} not found`);
      const prod = pRes.rows[0];
      const unit = it.unit || prod.selling_unit || 'Tray';

      // Check current physical held stock
      const esRes = await client.query(
        'SELECT * FROM employee_stock WHERE employee_id=$1 AND product_id=$2 AND company_id=$3 FOR UPDATE',
        [employeeId, pid, cid]
      );
      const held = esRes.rows.length > 0 ? Number(esRes.rows[0].qty_units) : 0;
      if (qty > held) {
        throw new Error(`Return quantity (${qty} ${unit}) cannot exceed Driver available stock (${held} ${unit}) for '${prod.display_name}'`);
      }

      evaluatedItems.push({
        product_id: pid,
        product_name: prod.display_name,
        unit,
        returned_qty: qty,
        damage_qty: 0,
        good_return_qty: qty,
        unit_cost: Number(prod.purchase_price || 0),
        damage_cost: 0
      });
    }

    if (evaluatedItems.length === 0) {
      throw new Error('Please enter return quantity > 0 for at least one product');
    }

    const retNo = 'RET-' + Date.now().toString().slice(-6);
    const retRes = await client.query(
      `INSERT INTO driver_returns (company_id, session_id, employee_id, return_no, status, items, notes) 
       VALUES ($1, $2, $3, $4, 'PENDING_STOREKEEPER_CHECK', $5, $6) RETURNING *`,
      [cid, session.id, employeeId, retNo, JSON.stringify(evaluatedItems), notes || 'Submitted for Storekeeper physical verification']
    );

    await client.query(
      `UPDATE driver_sessions SET status='RETURN_PENDING', updated_at=NOW() WHERE id=$1`,
      [session.id]
    );

    await client.query('COMMIT');
    await auditLog({ companyId: cid, actorUserId, action: 'DRIVER_RETURN_SUBMITTED', entityType: 'driver_returns', entityId: retRes.rows[0].id });
    return { success: true, message: 'Stock return submitted. Pending Storekeeper physical check.', return: retRes.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getPendingDriverReturns(cid, employeeId = null) {
  let sql = `
    SELECT dr.*, e.full_name as employee_name, e.employee_code, e.vehicle_number, ds.session_date
    FROM driver_returns dr
    JOIN employees e ON e.id = dr.employee_id
    JOIN driver_sessions ds ON ds.id = dr.session_id
    WHERE dr.company_id = $1 AND dr.status = 'PENDING_STOREKEEPER_CHECK'
  `;
  const params = [cid];
  if (employeeId) {
    sql += ` AND dr.employee_id = $2`;
    params.push(employeeId);
  }
  sql += ` ORDER BY dr.created_at DESC`;
  return await queryAll(sql, params);
}

export async function acceptStorekeeperReturn(cid, returnId, data, actorUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const retRes = await client.query(
      `SELECT * FROM driver_returns WHERE id=$1 AND company_id=$2 FOR UPDATE`,
      [returnId, cid]
    );
    if (retRes.rows.length === 0) throw new Error('Pending return record not found');
    const ret = retRes.rows[0];
    if (ret.status !== 'PENDING_STOREKEEPER_CHECK') {
      throw new Error(`This return is already ${ret.status}`);
    }

    const employeeId = ret.employee_id;
    const sessionId = ret.session_id;
    const empRes = await client.query('SELECT * FROM employees WHERE id=$1 AND company_id=$2', [employeeId, cid]);
    const empName = empRes.rows.length > 0 ? empRes.rows[0].full_name : 'Driver';

    const processedItems = [];
    let totalDmgCost = 0;

    // Process each item in return with submitted damage inspection
    const damagesList = data.damages || data.inspected_items || [];
    const damagesMap = damagesList.reduce((acc, d) => {
      acc[Number(d.product_id)] = d;
      return acc;
    }, {});

    for (const it of ret.items) {
      const pid = Number(it.product_id);
      const returnedQty = Number(it.returned_qty || 0);
      const dmgEntry = damagesMap[pid] || {};
      const damageQty = Number(dmgEntry.damage_qty ?? dmgEntry.damage_quantity ?? it.damage_qty ?? 0);
      const reason = dmgEntry.reason || dmgEntry.damage_reason || it.reason || 'Damaged / Leakage';

      if (damageQty < 0) throw new Error(`Damage quantity cannot be negative for product ${pid}`);
      if (damageQty > returnedQty) {
        throw new Error(`Damage quantity (${damageQty}) cannot exceed returned quantity (${returnedQty}) for '${it.product_name}'`);
      }

      const goodReturnQty = parseFloat((returnedQty - damageQty).toFixed(2));

      const pRes = await client.query('SELECT * FROM products WHERE id=$1 AND company_id=$2 FOR UPDATE', [pid, cid]);
      if (pRes.rows.length === 0) throw new Error(`Product ${pid} not found`);
      const prod = pRes.rows[0];

      const unitCost = Number(prod.purchase_price || 0);
      const damageCost = parseFloat((damageQty * unitCost).toFixed(2));
      totalDmgCost += damageCost;

      // 1. If Good Return > 0: Add to warehouse inventory, insert GOOD_RETURN transaction & movement
      if (goodReturnQty > 0) {
        await client.query(
          `UPDATE products SET warehouse_stock_units = warehouse_stock_units + $1, updated_at=NOW() WHERE id=$2`,
          [goodReturnQty, pid]
        );
        const movNo = 'MOV-RET-' + Date.now() + '-' + Math.floor(Math.random()*1000);
        await client.query(
          `INSERT INTO inventory_movements (company_id, movement_no, movement_type, product_id, product_name, employee_id, employee_name, qty_units, unit, notes) 
           VALUES ($1, $2, 'RETURN', $3, $4, $5, $6, $7, $8, $9)`,
          [cid, movNo, pid, prod.display_name, employeeId, empName, goodReturnQty, it.unit || prod.selling_unit, 'Good return accepted to warehouse from: ' + ret.return_no]
        );
        await client.query(
          `INSERT INTO stock_transactions (company_id, session_id, employee_id, product_id, unit, transaction_type, qty_units, unit_cost, total_cost, reference_id, notes, created_by) 
           VALUES ($1, $2, $3, $4, $5, 'GOOD_RETURN', $6, $7, $8, $9, $10, $11)`,
          [cid, sessionId, employeeId, pid, it.unit || prod.selling_unit, goodReturnQty, unitCost, parseFloat((goodReturnQty * unitCost).toFixed(2)), ret.return_no, 'Good stock returned to warehouse', actorUserId || null]
        );
      }

      // 2. If Damage > 0: Record damage, DO NOT add to warehouse
      if (damageQty > 0) {
        const dmgMovNo = 'MOV-DMG-' + Date.now() + '-' + Math.floor(Math.random()*1000);
        await client.query(
          `INSERT INTO damages (company_id, product_id, product_name, employee_id, employee_name, qty_units, unit, damage_cost, reason, session_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [cid, pid, prod.display_name, employeeId, empName, damageQty, it.unit || prod.selling_unit, damageCost, reason, sessionId]
        );
        await client.query(
          `INSERT INTO inventory_movements (company_id, movement_no, movement_type, product_id, product_name, employee_id, employee_name, qty_units, unit, notes) 
           VALUES ($1, $2, 'DAMAGE', $3, $4, $5, $6, $7, $8, $9)`,
          [cid, dmgMovNo, pid, prod.display_name, employeeId, empName, damageQty, it.unit || prod.selling_unit, reason]
        );
        await client.query(
          `INSERT INTO stock_transactions (company_id, session_id, employee_id, product_id, unit, transaction_type, qty_units, unit_cost, total_cost, reference_id, notes, created_by) 
           VALUES ($1, $2, $3, $4, $5, 'DAMAGE', $6, $7, $8, $9, $10, $11)`,
          [cid, sessionId, employeeId, pid, it.unit || prod.selling_unit, damageQty, unitCost, damageCost, ret.return_no, 'Damaged on route: ' + reason, actorUserId || null]
        );
      }

      // 3. Deduct total returned qty from employee_stock
      await client.query(
        `UPDATE employee_stock SET qty_units = GREATEST(0, qty_units - $1), updated_at=NOW() 
         WHERE employee_id=$2 AND product_id=$3 AND company_id=$4`,
        [returnedQty, employeeId, pid, cid]
      );

      processedItems.push({
        product_id: pid,
        product_name: prod.display_name,
        unit: it.unit || prod.selling_unit,
        returned_qty: returnedQty,
        damage_qty: damageQty,
        good_return_qty: goodReturnQty,
        unit_cost: unitCost,
        damage_cost: damageCost
      });
    }

    // Update return record
    await client.query(
      `UPDATE driver_returns SET status='ACCEPTED', items=$1, total_damage_cost=$2, checked_by=$3, checked_at=NOW(), updated_at=NOW() WHERE id=$4`,
      [JSON.stringify(processedItems), totalDmgCost, actorUserId || null, returnId]
    );

    // Update session status to RECONCILED
    await client.query(
      `UPDATE driver_sessions SET status='RECONCILED', damage_cost=damage_cost+$1, updated_at=NOW() WHERE id=$2`,
      [totalDmgCost, sessionId]
    );

    await client.query('COMMIT');
    await auditLog({ companyId: cid, actorUserId, action: 'DRIVER_RETURN_ACCEPTED', entityType: 'driver_returns', entityId: returnId, metadata: { processedItems, totalDmgCost } });
    return { success: true, message: 'Returned stock accepted into inventory successfully', processedItems, totalDmgCost };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closeDriverSession(cid, employeeId, data = {}, actorUserId = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const session = await getActiveDriverSession(cid, employeeId);
    if (!session) {
      throw new Error('No active driver session found to close.');
    }

    // Check reconciliation
    const recon = await getDriverSessionReconciliation(cid, employeeId, session.id);
    if (!recon.is_reconciled) {
      const mismatches = recon.products.filter(p => !p.is_reconciled);
      const summaryText = mismatches.map(m => `${m.product_name} (${m.unit}): Allocated ${m.allocated}, Accounted ${m.accounted}, Diff ${m.difference}`).join('; ');
      throw new Error(`Stock mismatch: Please resolve difference before closing. [${summaryText}]`);
    }

    // Check if there are unaccepted pending returns
    const pending = await client.query(
      `SELECT id FROM driver_returns WHERE company_id=$1 AND session_id=$2 AND status='PENDING_STOREKEEPER_CHECK'`,
      [cid, session.id]
    );
    if (pending.rows.length > 0) {
      throw new Error('Storekeeper has not accepted pending return. Please have Storekeeper accept the physical return first.');
    }

    // Zero out driver vehicle stock balance completely
    await client.query(
      `UPDATE employee_stock SET qty_units = 0, updated_at=NOW() WHERE employee_id=$1 AND company_id=$2`,
      [employeeId, cid]
    );

    // Record settlement if provided
    const targetDate = data.settlement_date || session.session_date || new Date().toISOString().split('T')[0];
    const diff = (Number(data.collected_amount) || 0) - (Number(data.expected_amount) || 0);
    const setStatus = Math.abs(diff) < 0.01 ? 'BALANCED' : diff > 0 ? 'SURPLUS' : 'DEFICIT';

    let settlementRow = null;
    if (data.expected_amount !== undefined || data.collected_amount !== undefined) {
      const sRes = await client.query(
        `INSERT INTO settlements (company_id, employee_id, employee_name, settlement_date, expected_amount, collected_amount, difference, reason, remarks, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [cid, employeeId, data.employee_name || 'Driver', targetDate, data.expected_amount || 0, data.collected_amount || 0, diff, data.reason || null, data.remarks || 'Driver session closed', setStatus]
      );
      settlementRow = sRes.rows[0];
    }

    // Close session
    const closeSummary = {
      closed_at: new Date().toISOString(),
      closed_by: actorUserId,
      total_allocated: recon.total_allocated,
      total_sold: recon.total_sold,
      total_good_return: recon.total_good_return,
      total_damage: recon.total_damage,
      total_damage_cost: recon.total_damage_cost,
      reconciliation: recon.products,
      settlement: settlementRow
    };

    const closedRes = await client.query(
      `UPDATE driver_sessions 
       SET status='CLOSED', closed_at=NOW(), closing_summary=$1, updated_at=NOW() 
       WHERE id=$2 RETURNING *`,
      [JSON.stringify(closeSummary), session.id]
    );

    await client.query('COMMIT');
    await auditLog({ companyId: cid, actorUserId, action: 'DRIVER_SESSION_CLOSED', entityType: 'driver_sessions', entityId: session.id });
    return { success: true, message: 'Driver session closed successfully. Driver stock balance is 0.', session: closedRes.rows[0], settlement: settlementRow };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getDriverSessionHistory(cid, employeeId, limit = 20) {
  let sql = `
    SELECT ds.*, e.full_name as employee_name, e.employee_code, e.vehicle_number
    FROM driver_sessions ds
    JOIN employees e ON e.id = ds.employee_id
    WHERE ds.company_id = $1
  `;
  const params = [cid];
  let idx = 2;
  if (employeeId) {
    sql += ` AND ds.employee_id = $${idx++}`;
    params.push(employeeId);
  }
  sql += ` ORDER BY ds.id DESC LIMIT $${idx}`;
  params.push(Number(limit) || 20);
  return await queryAll(sql, params);
}

// ====== FLEET & ROUTE MANAGEMENT SUMMARIES ======
export async function getFleetRouteSummary(cid) {
  const drivers = await queryAll(`
    SELECT DISTINCT e.*, 
      ua.id as user_id, ua.login_id,
      r.id as route_id, r.name as route_name, r.code as route_code,
      ra.status as assignment_status, ra.dispatch_time
    FROM employees e
    LEFT JOIN user_accounts ua ON ua.employee_id = e.id
    LEFT JOIN routes r ON r.id = e.route_id
    LEFT JOIN route_assignments ra ON ra.route_id = r.id AND ra.assigned_date = CURRENT_DATE
    WHERE e.company_id = $1 AND e.is_active = TRUE
    ORDER BY e.full_name ASC
  `, [cid]);

  const driverCards = [];

  for (const d of drivers) {
    const empId = d.id;
    const routeId = d.route_id;

    // Get assigned shops strictly via Route -> Village -> Shop
    let assignedShops = [];
    let routeVillages = [];
    if (routeId) {
      routeVillages = await queryAll(`
        SELECT v.* FROM villages v 
        WHERE v.route_id = $1 AND v.company_id = $2 AND v.status = 'ACTIVE'
        ORDER BY v.name ASC
      `, [routeId, cid]);

      assignedShops = await queryAll(`
        SELECT s.*, v.name as village_name, v.code as village_code, r.name as route_name, r.code as route_code
        FROM shops s
        JOIN villages v ON v.id = s.village_id
        JOIN routes r ON r.id = v.route_id
        WHERE v.route_id = $1 AND s.company_id = $2 AND s.is_active = TRUE
        ORDER BY s.name ASC
      `, [routeId, cid]);
    }

    // Driver sales for today
    const driverSales = await queryAll(`
      SELECT s.*, 
        (SELECT json_agg(si.*) FROM sale_items si WHERE si.sale_id = s.id) as items
      FROM sales s
      WHERE s.company_id = $1 AND s.employee_id = $2
      ORDER BY s.id DESC
    `, [cid, empId]);

    const billedShopIds = new Set(driverSales.map(s => Number(s.shop_id)));
    const billedShopsCount = assignedShops.filter(s => billedShopIds.has(Number(s.id))).length;
    const pendingShopsCount = Math.max(0, assignedShops.length - billedShopsCount);

    const totalSalesAmount = driverSales.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
    const totalCashPaid = driverSales.reduce((acc, s) => acc + (Number(s.cash_paid || s.paid_amount || 0)), 0);
    const totalGpayPaid = driverSales.reduce((acc, s) => acc + (Number(s.gpay_paid || 0)), 0);
    const totalCollectedAmount = totalCashPaid + totalGpayPaid;
    const totalCreditAmount = driverSales.reduce((acc, s) => acc + (Number(s.credit_paid || s.credit_amount || 0)), 0);

    // Stock details
    const activeSession = await getActiveDriverSession(cid, empId);
    let issuedPcs = 0;
    let soldPcs = 0;
    let goodReturnPcs = 0;
    let damagedPcs = 0;
    let actualBalancePcs = 0;

    if (activeSession) {
      const transRows = await queryAll(`
        SELECT st.*, p.pieces_per_unit 
        FROM stock_transactions st
        JOIN products p ON p.id = st.product_id
        WHERE st.company_id = $1 AND st.session_id = $2
      `, [cid, activeSession.id]);

      transRows.forEach(t => {
        const pcs = Number(t.pieces_per_unit || 1);
        const qtyPcs = Math.round(Number(t.qty_units || 0) * pcs);
        if (t.transaction_type === 'ALLOCATION') issuedPcs += qtyPcs;
        else if (t.transaction_type === 'SALE') soldPcs += qtyPcs;
        else if (t.transaction_type === 'GOOD_RETURN') goodReturnPcs += qtyPcs;
        else if (t.transaction_type === 'DAMAGE') damagedPcs += qtyPcs;
      });

      const empStocks = await queryAll(`
        SELECT es.*, p.pieces_per_unit 
        FROM employee_stock es
        JOIN products p ON p.id = es.product_id
        WHERE es.company_id = $1 AND es.employee_id = $2
      `, [cid, empId]);

      actualBalancePcs = empStocks.reduce((acc, es) => acc + Math.round(Number(es.qty_units || 0) * Number(es.pieces_per_unit || 1)), 0);
    }

    const expectedBalancePcs = Math.max(0, issuedPcs - (soldPcs + goodReturnPcs + damagedPcs));
    const discrepancyPcs = actualBalancePcs - expectedBalancePcs;
    const reconciliationStatus = discrepancyPcs === 0 ? 'RECONCILED' : 'MISMATCH';

    // Village breakdown
    const villageMap = {};
    assignedShops.forEach(shop => {
      const vName = shop.village_name || 'General Route Area';
      if (!villageMap[vName]) {
        villageMap[vName] = {
          village_name: vName,
          shops: [],
          totalShops: 0,
          billedShops: 0,
          salesAmount: 0,
          collectedAmount: 0,
          creditAmount: 0,
          status: 'PENDING'
        };
      }
      const shopSales = driverSales.filter(s => Number(s.shop_id) === Number(shop.id));
      const isShopBilled = shopSales.length > 0;
      const shopSalesAmt = shopSales.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
      const shopPaidAmt = shopSales.reduce((acc, s) => acc + (Number(s.cash_paid || 0) + Number(s.gpay_paid || 0)), 0);
      const shopCreditAmt = shopSales.reduce((acc, s) => acc + (Number(s.credit_paid || 0)), 0);

      villageMap[vName].shops.push({
        ...shop,
        isBilled: isShopBilled,
        salesAmount: shopSalesAmt,
        paidAmount: shopPaidAmt,
        creditAmount: shopCreditAmt,
        bills: shopSales,
        visitStatus: isShopBilled ? (shopCreditAmt > 0 ? (shopPaidAmt > 0 ? 'PARTIAL' : 'CREDIT') : 'PAID') : 'PENDING'
      });

      villageMap[vName].totalShops += 1;
      if (isShopBilled) villageMap[vName].billedShops += 1;
      villageMap[vName].salesAmount += shopSalesAmt;
      villageMap[vName].collectedAmount += shopPaidAmt;
      villageMap[vName].creditAmount += shopCreditAmt;
    });

    const villages = Object.values(villageMap).map((v, idx) => {
      let status = 'PENDING';
      if (v.billedShops === v.totalShops && v.totalShops > 0) {
        status = 'COMPLETED';
      } else if (v.billedShops > 0) {
        status = 'IN_PROGRESS';
      }
      return {
        sequence: idx + 1,
        ...v,
        status
      };
    });

    const totalVillages = villages.length;
    const completedVillages = villages.filter(v => v.status === 'COMPLETED').length;
    const routeCompletionPct = assignedShops.length > 0 ? Math.round((billedShopsCount / assignedShops.length) * 100) : 0;

    driverCards.push({
      driver_id: empId,
      driver_name: d.full_name,
      phone: d.phone || '',
      vehicle_no: d.vehicle_number || 'Route Vehicle',
      vehicle_model: 'Delivery Vehicle',
      route_id: routeId,
      route_name: d.route_name || 'Unassigned Route',
      route_status: d.assignment_status || 'ON_ROUTE',
      dispatch_time: d.dispatch_time || '05:30 AM',
      issuedPcs,
      soldPcs,
      goodReturnPcs,
      damagedPcs,
      actualBalancePcs,
      expectedBalancePcs,
      discrepancyPcs,
      reconciliationStatus,
      totalSalesAmount,
      totalCollectedAmount,
      totalCashPaid,
      totalGpayPaid,
      totalCreditAmount,
      billsCount: driverSales.length,
      totalShops: assignedShops.length,
      billedShops: billedShopsCount,
      pendingShops: pendingShopsCount,
      totalVillages,
      completedVillages,
      routeCompletionPct,
      villages
    });
  }

  const totalAssignedVillages = driverCards.reduce((acc, d) => acc + d.totalVillages, 0);
  const totalCompletedVillages = driverCards.reduce((acc, d) => acc + d.completedVillages, 0);
  const totalAssignedShops = driverCards.reduce((acc, d) => acc + d.totalShops, 0);
  const totalBilledShops = driverCards.reduce((acc, d) => acc + d.billedShops, 0);
  const totalPendingShops = Math.max(0, totalAssignedShops - totalBilledShops);

  const totalIssuedPcs = driverCards.reduce((acc, d) => acc + d.issuedPcs, 0);
  const totalSoldPcs = driverCards.reduce((acc, d) => acc + d.soldPcs, 0);
  const totalRemainingPcs = driverCards.reduce((acc, d) => acc + d.actualBalancePcs, 0);
  const totalReturnedPcs = driverCards.reduce((acc, d) => acc + d.goodReturnPcs, 0);
  const totalDamagedPcs = driverCards.reduce((acc, d) => acc + d.damagedPcs, 0);

  const totalSalesAmount = driverCards.reduce((acc, d) => acc + d.totalSalesAmount, 0);
  const totalCollectedAmount = driverCards.reduce((acc, d) => acc + d.totalCollectedAmount, 0);
  const totalCreditAmount = driverCards.reduce((acc, d) => acc + d.totalCreditAmount, 0);

  return {
    kpis: {
      activeDrivers: drivers.length,
      driversOnRoute: driverCards.filter(d => d.route_status === 'ON_ROUTE' || d.billsCount > 0).length,
      driversCompleted: driverCards.filter(d => d.routeCompletionPct === 100 || d.route_status === 'COMPLETED').length,
      assignedVillages: totalAssignedVillages,
      completedVillages: totalCompletedVillages,
      assignedShops: totalAssignedShops,
      billedShops: totalBilledShops,
      pendingShops: totalPendingShops,
      totalIssuedPcs,
      totalSoldPcs,
      totalRemainingPcs,
      totalReturnedPcs,
      totalDamagedPcs,
      totalSalesAmount,
      totalCollectedAmount,
      totalCreditAmount
    },
    driverCards
  };
}

export async function getDriverDetailSummary(cid, driverId) {
  const empId = Number(driverId);
  const fleet = await getFleetRouteSummary(cid);
  const card = fleet.driverCards.find(c => Number(c.driver_id) === empId);

  const sales = await queryAll(`
    SELECT s.*, 
      (SELECT json_agg(si.*) FROM sale_items si WHERE si.sale_id = s.id) as items
    FROM sales s
    WHERE s.company_id = $1 AND s.employee_id = $2
    ORDER BY s.id DESC
  `, [cid, empId]);

  return {
    driver: card || null,
    summary: card || null,
    sales: sales || [],
    sessions: await getDriverSessionHistory(cid, empId, 10)
  };
}

export async function reassignDriverRoute(cid, routeId, newDriverId) {
  const rId = parseInt(routeId, 10);
  const dId = parseInt(newDriverId, 10);

  const route = await queryOne('SELECT * FROM routes WHERE id=$1 AND company_id=$2 AND is_active=TRUE', [rId, cid]);
  if (!route) throw new Error('Route not found.');

  const emp = await queryOne('SELECT * FROM employees WHERE id=$1 AND company_id=$2 AND is_active=TRUE', [dId, cid]);
  if (!emp) throw new Error('Driver employee not found.');

  // Unassign any previous driver on this route
  await queryOne('UPDATE employees SET route_id=NULL WHERE route_id=$1 AND company_id=$2', [rId, cid]);

  // Assign new driver
  await queryOne('UPDATE employees SET route_id=$1, updated_at=NOW() WHERE id=$2 AND company_id=$3', [rId, dId, cid]);

  // Update route assignments
  await assignRoute(cid, rId, dId, emp.vehicle_number);

  return { success: true, message: `Route "${route.name}" reassigned to ${emp.full_name}.`, route };
}

// ====== PHASE 5: INVENTORY ALERTS & REORDER MANAGEMENT ======

export async function getInventoryAlertsAndReorders(cid) {
  const products = await queryAll(`
    SELECT 
      p.id,
      p.name,
      p.display_name,
      p.sku,
      p.barcode,
      p.selling_unit,
      p.base_unit,
      p.pieces_per_unit,
      p.purchase_price,
      p.unit_selling_price,
      p.piece_selling_price,
      COALESCE(p.warehouse_stock_units, 0) as warehouse_stock_units,
      COALESCE(p.min_stock_level, 0) as min_stock_level,
      p.icon,
      p.image_url,
      c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.company_id = $1 AND p.is_active = TRUE
    ORDER BY p.id ASC
  `, [cid]);

  let outOfStockCount = 0;
  let lowStockCount = 0;
  let healthyCount = 0;

  const list = products.map(p => {
    const currentStock = Number(p.warehouse_stock_units || 0);
    const minReorder = Number(p.min_stock_level || 0);
    const ppu = Math.max(1, Number(p.pieces_per_unit || 1));
    const currentPieces = Math.round(currentStock * ppu);

    let status = 'NORMAL';
    if (currentStock <= 0) {
      status = 'OUT_OF_STOCK';
      outOfStockCount++;
    } else if (currentStock <= minReorder) {
      status = 'LOW_STOCK';
      lowStockCount++;
    } else {
      healthyCount++;
    }

    const reorderRequired = currentStock <= minReorder;
    const suggestedUnits = reorderRequired ? Math.max(minReorder * 2 - currentStock, minReorder, 5) : 0;
    const suggestedPieces = suggestedUnits * ppu;

    return {
      id: p.id,
      product_id: p.id,
      name: p.name,
      display_name: p.display_name || p.name,
      sku: p.sku || `PRD-${p.id}`,
      barcode: p.barcode,
      category_name: p.category_name || 'General',
      selling_unit: p.selling_unit || 'Tray',
      base_unit: p.base_unit || 'Piece',
      pieces_per_unit: ppu,
      current_stock: currentStock,
      warehouse_stock_units: currentStock,
      current_stock_pieces: currentPieces,
      warehouse_stock_pieces: currentPieces,
      min_stock_level: minReorder,
      min_reorder_level: minReorder,
      min_reorder_level_pieces: minReorder * ppu,
      min_stock_pieces: minReorder * ppu,
      purchase_price: Number(p.purchase_price || 0),
      unit_selling_price: Number(p.unit_selling_price || 0),
      status: status,
      stock_status: status,
      reorder_required: reorderRequired,
      reorder_status: reorderRequired ? 'REORDER_REQUIRED' : 'SUFFICIENT',
      suggested_reorder_label: reorderRequired ? 'REORDER REQUIRED' : 'SUFFICIENT STOCK',
      suggested_reorder_units: suggestedUnits,
      suggested_reorder_pieces: suggestedPieces,
      icon: p.icon || '📦',
      image_url: p.image_url
    };
  });

  const totalReorderQty = list.reduce((sum, item) => sum + (item.suggested_reorder_units || 0), 0);

  return {
    success: true,
    summary: {
      total_products: list.length,
      out_of_stock_count: outOfStockCount,
      low_stock_count: lowStockCount,
      normal_count: healthyCount,
      healthy_count: healthyCount,
      reorder_needed_count: outOfStockCount + lowStockCount,
      total_reorders_needed: outOfStockCount + lowStockCount,
      total_reorder_qty: totalReorderQty
    },
    alerts: list,
    products: list
  };
}

// ====== PHASE 5: TRANSACTION-SAFE INVENTORY ADJUSTMENTS ======

export async function adjustStock(cid, payload, actorUserId) {
  const { product_id, quantity, unit_type, adjustment_type, reason, notes } = payload;
  const prodId = Number(product_id);
  const qty = Number(quantity);

  if (!prodId || isNaN(prodId)) throw new Error('Valid product_id is required.');
  if (isNaN(qty) || qty <= 0) throw new Error('Adjustment quantity must be greater than zero.');
  if (!reason || !reason.trim()) throw new Error('Adjustment reason is mandatory for audit verification.');

  const validTypes = ['ADD', 'SUBTRACT', 'SET'];
  const adjType = (adjustment_type || 'ADD').toUpperCase();
  if (!validTypes.includes(adjType)) throw new Error('Invalid adjustment_type. Must be ADD, SUBTRACT, or SET.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock product row for safe mutation
    const pRes = await client.query(
      'SELECT * FROM products WHERE id = $1 AND company_id = $2 FOR UPDATE',
      [prodId, cid]
    );
    if (pRes.rows.length === 0) throw new Error('Product not found.');
    const product = pRes.rows[0];
    if (product.is_active === false || product.is_active === 0) {
      throw new Error('Cannot adjust stock for an inactive product.');
    }

    const currentStock = Number(product.warehouse_stock_units || 0);
    const ppu = Math.max(1, Number(product.pieces_per_unit || 1));
    const isPiece = (unit_type || product.selling_unit || 'Tray').toLowerCase() === 'piece';
    const deltaUnits = isPiece ? parseFloat((qty / ppu).toFixed(4)) : qty;

    let newStock = currentStock;
    const finalMovementType = 'ADJUSTMENT';

    if (adjType === 'ADD') {
      newStock = parseFloat((currentStock + deltaUnits).toFixed(4));
    } else if (adjType === 'SUBTRACT') {
      newStock = parseFloat((currentStock - deltaUnits).toFixed(4));
    } else if (adjType === 'SET') {
      newStock = deltaUnits;
    }

    if (newStock < 0) {
      throw new Error(`Insufficient warehouse stock for adjustment! Available: ${currentStock} ${product.selling_unit}, Attempted deduction: ${deltaUnits} ${product.selling_unit}.`);
    }

    // Update Product Stock
    await client.query(
      'UPDATE products SET warehouse_stock_units = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3',
      [newStock, prodId, cid]
    );

    // Fetch Actor info
    let actorName = 'Storekeeper / Owner';
    if (actorUserId) {
      const actorRes = await client.query('SELECT name, login_id FROM user_accounts WHERE id = $1', [actorUserId]);
      if (actorRes.rows[0]) actorName = actorRes.rows[0].name || actorRes.rows[0].login_id;
    }

    const movementNo = `ADJ-${Math.floor(100000 + Math.random() * 900000)}`;

    // Insert into inventory_movements ledger
    await client.query(
      `INSERT INTO inventory_movements 
        (company_id, movement_no, movement_type, product_id, product_name, qty_units, unit, notes, movement_date, movement_time, reference, received_by)
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE, TO_CHAR(NOW(), 'HH24:MI:SS'), $9, $10)`,
      [
        cid,
        movementNo,
        finalMovementType,
        prodId,
        product.display_name || product.name,
        deltaUnits,
        product.selling_unit || 'Tray',
        notes || `Stock Adjustment (${adjType})`,
        `Reason: ${reason.trim()} [${adjType}]`,
        actorName
      ]
    );

    // Insert into audit_logs
    await client.query(
      `INSERT INTO audit_logs 
        (company_id, actor_user_id, action, entity_type, entity_id, metadata)
       VALUES 
        ($1, $2, $3, $4, $5, $6)`,
      [
        cid,
        actorUserId || null,
        'INVENTORY_ADJUSTMENT',
        'products',
        prodId,
        JSON.stringify({
          product_name: product.display_name || product.name,
          adjustment_type: adjType,
          quantity_entered: qty,
          unit_type: unit_type || product.selling_unit,
          delta_units: deltaUnits,
          previous_stock: currentStock,
          new_stock: newStock,
          reason: reason.trim(),
          notes: notes || null
        })
      ]
    );

    await client.query('COMMIT');

    return {
      success: true,
      message: `Stock for "${product.display_name || product.name}" successfully adjusted from ${currentStock} to ${newStock} ${product.selling_unit}s.`,
      product_id: prodId,
      product_name: product.display_name || product.name,
      previous_stock: currentStock,
      previous_warehouse_stock_units: currentStock,
      new_stock: newStock,
      new_warehouse_stock_units: newStock,
      delta_units: deltaUnits,
      movement_no: movementNo
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getKeeperDashboard(cid) {
  const [products, movements, pendingReturns, alerts] = await Promise.all([
    getProducts(cid, { active: true }),
    queryAll(`
      SELECT st.*, p.name as product_name, p.display_name, p.selling_unit 
      FROM stock_transactions st
      LEFT JOIN products p ON p.id = st.product_id
      WHERE st.company_id = $1 
      ORDER BY st.created_at DESC 
      LIMIT 20
    `, [cid]),
    queryAll(`
      SELECT ds.*, e.full_name as driver_name, r.name as route_name
      FROM driver_sessions ds
      JOIN employees e ON e.id = ds.employee_id
      LEFT JOIN routes r ON r.id = ds.route_id
      WHERE ds.company_id = $1 AND ds.status = 'END_DAY_SUBMITTED'
      ORDER BY ds.created_at DESC
    `, [cid]),
    queryAll(`
      SELECT * FROM notifications 
      WHERE company_id = $1 AND (recipient_role = 'STORE_KEEPER' OR recipient_role = 'OWNER') AND is_read = FALSE
      ORDER BY created_at DESC 
      LIMIT 10
    `, [cid])
  ]);

  const totalStockUnits = products.reduce((acc, p) => acc + (Number(p.warehouse_stock_units) || 0), 0);
  const totalStockValue = products.reduce((acc, p) => acc + ((Number(p.warehouse_stock_units) || 0) * (Number(p.purchase_price) || 0)), 0);
  const lowStockCount = products.filter(p => (Number(p.warehouse_stock_units) || 0) <= (Number(p.min_stock_level) || 0)).length;

  return {
    success: true,
    total_products: products.length,
    total_stock_units: totalStockUnits,
    total_stock_value: totalStockValue,
    low_stock_count: lowStockCount,
    products,
    recent_movements: movements,
    pending_returns: pendingReturns,
    notifications: alerts
  };
}

// ====== PHASE 5: REAL-TIME NOTIFICATIONS ENGINE ======

export async function generateSystemAlertNotifications(cid) {
  try {
    // 1. Low Stock & Out of Stock Alerts
    const lowStockProds = await queryAll(`
      SELECT id, display_name, name, warehouse_stock_units, min_stock_level, selling_unit
      FROM products 
      WHERE company_id = $1 AND is_active = TRUE AND warehouse_stock_units <= min_stock_level
    `, [cid]);

    for (const p of lowStockProds) {
      const isOut = Number(p.warehouse_stock_units || 0) <= 0;
      const notifType = isOut ? 'OUT_OF_STOCK' : 'LOW_STOCK';
      const title = isOut ? `Out of Stock: ${p.display_name || p.name}` : `Low Stock Alert: ${p.display_name || p.name}`;
      const msg = isOut 
        ? `Product "${p.display_name || p.name}" has reached 0 ${p.selling_unit}s. Immediate reorder required.`
        : `Product "${p.display_name || p.name}" stock (${p.warehouse_stock_units} ${p.selling_unit}) is at or below min level (${p.min_stock_level}).`;

      // Check if unread alert exists within last 12 hours
      const existing = await queryOne(`
        SELECT id FROM notifications 
        WHERE company_id = $1 AND notification_type = $2 AND reference_type = 'product' AND reference_id = $3 AND is_read = FALSE
      `, [cid, notifType, String(p.id)]);

      if (!existing) {
        await query(`
          INSERT INTO notifications (company_id, recipient_role, notification_type, title, message, reference_type, reference_id)
          VALUES ($1, 'OWNER', $2, $3, $4, 'product', $5)
        `, [cid, notifType, title, msg, String(p.id)]);
      }
    }

    // 2. Pending Driver Returns Alert
    const pendingReturns = await queryAll(`
      SELECT ds.id, ds.employee_id, e.full_name as driver_name
      FROM driver_sessions ds
      JOIN employees e ON e.id = ds.employee_id
      WHERE ds.company_id = $1 AND ds.status = 'END_DAY_SUBMITTED'
    `, [cid]);

    for (const pr of pendingReturns) {
      const existing = await queryOne(`
        SELECT id FROM notifications 
        WHERE company_id = $1 AND notification_type = 'PENDING_RETURN' AND reference_type = 'driver_session' AND reference_id = $2 AND is_read = FALSE
      `, [cid, String(pr.id)]);

      if (!existing) {
        await query(`
          INSERT INTO notifications (company_id, recipient_role, notification_type, title, message, reference_type, reference_id)
          VALUES ($1, 'STORE_KEEPER', 'PENDING_RETURN', $2, $3, 'driver_session', $4)
        `, [
          cid,
          `Pending Return: Driver ${pr.driver_name}`,
          `Driver ${pr.driver_name} submitted End of Day closing. Physical stock return verification required.`,
          String(pr.id)
        ]);
      }
    }

    // 3. Pending Damage Verification Alert
    const pendingDamages = await queryOne(`
      SELECT COUNT(*) as count FROM damages WHERE company_id = $1 AND status = 'PENDING'
    `, [cid]);

    const count = Number(pendingDamages?.count || 0);
    if (count > 0) {
      const existing = await queryOne(`
        SELECT id FROM notifications 
        WHERE company_id = $1 AND notification_type = 'PENDING_DAMAGE' AND is_read = FALSE AND created_at >= NOW() - INTERVAL '6 hours'
      `, [cid]);

      if (!existing) {
        await query(`
          INSERT INTO notifications (company_id, recipient_role, notification_type, title, message, reference_type, reference_id)
          VALUES ($1, 'OWNER', 'PENDING_DAMAGE', $2, $3, 'damages', 'pending_list')
        `, [
          cid,
          `${count} Pending Damage Records Awaiting Verification`,
          `There are currently ${count} recorded damages pending physical inspection and verification.`,
        ]);
      }
    }
  } catch (err) {
    console.error('[generateSystemAlertNotifications]', err.message);
  }
}

export async function getNotifications(cid, role, userId, filters = {}) {
  await generateSystemAlertNotifications(cid);

  let cond = 'WHERE company_id = $1';
  const params = [cid];
  let idx = 2;

  if (filters.unread_only === 'true' || filters.unreadOnly === true) {
    cond += ' AND is_read = FALSE';
  }

  const userRole = (role || '').toUpperCase();
  if (userRole === 'DRIVER') {
    cond += ` AND recipient_user_id = $${idx++}`;
    params.push(Number(userId));
  } else if (userRole === 'STORE_KEEPER') {
    cond += ` AND (recipient_role = 'STORE_KEEPER' OR recipient_role = 'ALL' OR recipient_user_id = $${idx++})`;
    params.push(Number(userId));
  } else {
    // Owner / Admin can see all system notifications
    cond += ` AND (recipient_role IN ('OWNER', 'ADMIN', 'STORE_KEEPER', 'ALL') OR recipient_role IS NULL OR recipient_user_id = $${idx++})`;
    params.push(Number(userId));
  }

  const limit = Math.min(100, Number(filters.limit || 30));
  cond += ` ORDER BY is_read ASC, created_at DESC LIMIT $${idx++}`;
  params.push(limit);

  const notifications = await queryAll(`
    SELECT * FROM notifications ${cond}
  `, params);

  const unreadCountRow = await queryOne(`
    SELECT COUNT(*) as count FROM notifications 
    WHERE company_id = $1 AND is_read = FALSE 
    AND (recipient_role IN ('OWNER', 'ADMIN', 'STORE_KEEPER', 'ALL') OR recipient_role IS NULL)
  `, [cid]);

  return {
    success: true,
    unread_count: Number(unreadCountRow?.count || 0),
    notifications: notifications || []
  };
}

export async function markNotificationAsRead(cid, notificationId, userId) {
  const nId = Number(notificationId);
  await query(
    'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND company_id = $2',
    [nId, cid]
  );
  return { success: true, message: 'Notification marked as read.' };
}

export async function markAllNotificationsAsRead(cid, role, userId) {
  await query(
    'UPDATE notifications SET is_read = TRUE WHERE company_id = $1',
    [cid]
  );
  return { success: true, message: 'All notifications marked as read.' };
}

// ====== PHASE 5: UNIVERSAL FILTER-AWARE EXPORT ENGINE ======

function safeDateString(val) {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return val.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  if (str.includes('T')) return str.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  if (/^\d{2}-\d{2}-\d{4}/.test(str)) {
    const [d, m, y] = str.split('-');
    return `${y}-${m}-${d}`;
  }
  return str;
}

export async function getExportData(cid, exportType, filters = {}) {
  const type = String(exportType || '').toLowerCase().trim();

  if (type === 'sales') {
    const { start, end } = parseDateFilters(filters);
    let cond = 'WHERE s.company_id = $1';
    const params = [cid];
    let idx = 2;

    if (start && end) {
      cond += ` AND s.sale_date >= $${idx++} AND s.sale_date <= $${idx++}`;
      params.push(start, end);
    }
    if (filters.employee_id) {
      cond += ` AND s.employee_id = $${idx++}`;
      params.push(Number(filters.employee_id));
    }
    if (filters.shop_id) {
      cond += ` AND s.shop_id = $${idx++}`;
      params.push(Number(filters.shop_id));
    }
    if (filters.payment_mode && filters.payment_mode !== 'ALL') {
      cond += ` AND s.payment_mode = $${idx++}`;
      params.push(filters.payment_mode.toUpperCase());
    }

    const sales = await queryAll(`
      SELECT 
        s.bill_no,
        s.sale_date,
        s.created_at,
        s.employee_id,
        COALESCE(e.full_name, s.employee_name, 'Store Counter') as seller_name,
        COALESCE(sh.name, s.shop_name, 'Walk-in Customer') as shop_name,
        sh.code as shop_code,
        v.name as village_name,
        r.name as route_name,
        s.payment_mode,
        s.total_amount,
        s.cash_paid,
        s.gpay_paid,
        s.credit_paid
      FROM sales s
      LEFT JOIN employees e ON e.id = s.employee_id
      LEFT JOIN shops sh ON sh.id = s.shop_id
      LEFT JOIN villages v ON v.id = sh.village_id
      LEFT JOIN routes r ON r.id = sh.route_id
      ${cond}
      ORDER BY s.id DESC
    `, params);

    const totals = sales.reduce((acc, s) => {
      acc.total_sales += Number(s.total_amount || 0);
      acc.cash_paid += Number(s.cash_paid || 0);
      acc.gpay_paid += Number(s.gpay_paid || 0);
      acc.credit_paid += Number(s.credit_paid || 0);
      return acc;
    }, { total_sales: 0, cash_paid: 0, gpay_paid: 0, credit_paid: 0 });

    const rows = sales.map(s => ({
      bill_no: s.bill_no,
      date: safeDateString(s.created_at) || safeDateString(s.sale_date),
      seller: s.seller_name || (s.employee_id ? 'Driver' : 'Store Counter'),
      shop: s.shop_name || 'Walk-in Customer',
      village: s.village_name || 'N/A',
      route: s.route_name || 'N/A',
      payment_mode: s.payment_mode,
      total_amount: Number(s.total_amount || 0),
      cash_paid: Number(s.cash_paid || 0),
      gpay_paid: Number(s.gpay_paid || 0),
      credit_paid: Number(s.credit_paid || 0)
    }));

    return {
      success: true,
      report_title: 'Sales & Revenue Report',
      generated_at: new Date().toISOString(),
      filters_applied: { ...filters, start_date: start, end_date: end },
      totals: {
        total_bills: sales.length,
        total_amount: parseFloat(totals.total_sales.toFixed(2)),
        cash_paid: parseFloat(totals.cash_paid.toFixed(2)),
        gpay_paid: parseFloat(totals.gpay_paid.toFixed(2)),
        credit_paid: parseFloat(totals.credit_paid.toFixed(2))
      },
      columns: ['Bill No', 'Date', 'Seller', 'Shop', 'Village', 'Route', 'Payment Mode', 'Total (₹)', 'Cash (₹)', 'GPay (₹)', 'Credit (₹)'],
      rows: rows,
      data: rows
    };
  }

  if (type === 'inventory') {
    const alerts = await getInventoryAlertsAndReorders(cid);
    const totals = alerts.products.reduce((acc, p) => {
      acc.total_valuation += Number(p.current_stock * p.purchase_price);
      acc.total_pieces += Number(p.current_stock_pieces);
      return acc;
    }, { total_valuation: 0, total_pieces: 0 });

    const rows = alerts.products.map(p => ({
      product_name: p.display_name,
      category: p.category_name,
      selling_unit: p.selling_unit,
      pieces_per_unit: p.pieces_per_unit,
      current_stock: p.current_stock,
      current_stock_pieces: p.current_stock_pieces,
      min_stock_level: p.min_reorder_level,
      purchase_price: p.purchase_price,
      valuation: parseFloat((p.current_stock * p.purchase_price).toFixed(2)),
      status: p.status,
      reorder_action: p.suggested_reorder_label
    }));

    return {
      success: true,
      report_title: 'Warehouse Inventory & Stock Valuation Report',
      generated_at: new Date().toISOString(),
      filters_applied: filters,
      totals: {
        total_products: alerts.products.length,
        total_pieces: totals.total_pieces,
        total_valuation: parseFloat(totals.total_valuation.toFixed(2)),
        low_stock_items: alerts.summary.low_stock_count,
        out_of_stock_items: alerts.summary.out_of_stock_count
      },
      columns: ['Product Name', 'Category', 'Selling Unit', 'Pieces/Unit', 'Current Stock (Units)', 'Current Stock (Pieces)', 'Min Stock Level', 'Buy Rate (₹)', 'Valuation (₹)', 'Status', 'Reorder Action'],
      rows: rows,
      data: rows
    };
  }

  if (type === 'damages') {
    const damages = await getDamages(cid, filters);
    const summary = await getDamageAnalyticsSummary(cid, filters);

    const rows = (damages || []).map(d => ({
      damage_id: `#${d.id}`,
      date: safeDateString(d.damage_date),
      product: d.product_name,
      source: d.employee_name || d.damage_source || 'Warehouse',
      qty_units: Number(d.qty_units || 0),
      qty_pieces: Number(d.base_quantity || 0),
      damage_cost: Number(d.damage_cost || 0),
      reason: d.reason,
      status: d.status,
      verified_by: d.verified_by_name || 'Pending'
    }));

    return {
      success: true,
      report_title: 'Product Damages & Wastage Loss Report',
      generated_at: new Date().toISOString(),
      filters_applied: filters,
      totals: {
        total_records: summary.summary.total_records,
        total_pieces: summary.summary.total_pieces,
        total_cost: summary.summary.total_cost,
        verified_cost: summary.summary.verified_cost,
        pending_cost: summary.summary.pending_cost
      },
      columns: ['Damage ID', 'Date', 'Product', 'Driver / Source', 'Quantity (Units)', 'Quantity (Pieces)', 'Estimated Cost (₹)', 'Reason', 'Status', 'Verified By'],
      rows: rows,
      data: rows
    };
  }

  if (type === 'reconciliation') {
    const recon = await getAdvancedReconciliation(cid, filters);

    const rows = (recon.reconciliation || []).map(r => ({
      date: safeDateString(r.session_date),
      driver: r.driver_name,
      product: r.product_name,
      issued_units: r.issued,
      issued_pcs: r.issued_pcs,
      sold_units: r.sold,
      sold_pcs: r.sold_pcs,
      good_return_pcs: r.good_return_pcs,
      damaged_pcs: r.damage_pcs,
      expected_balance_pcs: r.expected_balance_pcs,
      actual_balance_pcs: r.actual_balance_pcs,
      variance_pcs: r.variance_pcs,
      status: r.status
    }));

    return {
      success: true,
      report_title: 'Driver Stock Reconciliation & Variance Audit Report',
      generated_at: new Date().toISOString(),
      filters_applied: filters,
      totals: recon.summary,
      columns: ['Date', 'Driver', 'Product', 'Issued (Units)', 'Issued (Pcs)', 'Sold (Units)', 'Sold (Pcs)', 'Good Return (Pcs)', 'Damaged (Pcs)', 'Expected Bal (Pcs)', 'Actual Bal (Pcs)', 'Variance (Pcs)', 'Status'],
      rows: rows,
      data: rows
    };
  }

  if (type === 'expenses') {
    const expenses = await getExpenses(cid, filters);
    const totalExp = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);

    const rows = expenses.map(e => ({
      id: `#${e.id}`,
      date: safeDateString(e.expense_date),
      employee: e.employee_name || 'Driver',
      category: e.category,
      amount: Number(e.amount || 0),
      notes: e.notes || '—'
    }));

    return {
      success: true,
      report_title: 'Operating Expenses Ledger Report',
      generated_at: new Date().toISOString(),
      filters_applied: filters,
      totals: {
        total_entries: expenses.length,
        total_amount: parseFloat(totalExp.toFixed(2))
      },
      columns: ['ID', 'Date', 'Driver / Employee', 'Category', 'Amount (₹)', 'Notes'],
      rows: rows,
      data: rows
    };
  }

  if (type === 'driver_performance') {
    const report = await getDriverPerformanceReport(cid, filters);

    const rows = report.map(d => ({
      driver_name: d.driver_name,
      vehicle: d.vehicle_number,
      route: d.route_name,
      working_days: d.working_days,
      total_bills: d.total_bills,
      total_sales: d.total_sales,
      cash_collected: d.cash_collected,
      gpay_collected: d.gpay_collected,
      credit_sales: d.credit_sales,
      total_expenses: d.total_expenses,
      total_damages: d.total_damage_cost,
      net_contribution: d.net_financial_contribution
    }));

    return {
      success: true,
      report_title: 'Driver Fleet Performance & Contribution Report',
      generated_at: new Date().toISOString(),
      filters_applied: filters,
      totals: {
        total_drivers: report.length,
        total_sales: report.reduce((acc, d) => acc + d.total_sales, 0),
        total_contribution: report.reduce((acc, d) => acc + d.net_financial_contribution, 0)
      },
      columns: ['Driver Name', 'Vehicle', 'Route', 'Working Days', 'Bills Count', 'Gross Sales (₹)', 'Cash (₹)', 'GPay (₹)', 'Credit (₹)', 'Expenses (₹)', 'Damages (₹)', 'Net Contribution (₹)'],
      rows: rows,
      data: rows
    };
  }

  if (type === 'route_performance') {
    const report = await getRoutePerformanceReport(cid, filters);

    const rows = report.map(r => ({
      route_name: r.route_name,
      route_code: r.route_code,
      driver_name: r.driver_name,
      vehicle: r.vehicle_number,
      total_shops: r.total_shops,
      active_shops: r.active_shops,
      outstanding_dues: r.outstanding_dues,
      total_bills: r.total_bills,
      total_sales: r.total_sales
    }));

    return {
      success: true,
      report_title: 'Route Fleet Performance Report',
      generated_at: new Date().toISOString(),
      filters_applied: filters,
      totals: {
        total_routes: report.length,
        total_sales: report.reduce((acc, r) => acc + r.total_sales, 0)
      },
      columns: ['Route Name', 'Route Code', 'Driver', 'Vehicle', 'Total Shops', 'Active Shops', 'Outstanding Dues (₹)', 'Bills', 'Gross Sales (₹)'],
      rows: rows,
      data: rows
    };
  }

  if (type === 'shop_performance') {
    const report = await getShopPerformanceReport(cid, filters);

    const rows = report.map(s => ({
      shop_name: s.shop_name,
      shop_code: s.shop_code,
      owner_name: s.owner_name,
      phone: s.phone,
      village: s.village_name,
      route: s.route_name,
      total_bills: s.total_bills,
      total_sales: s.total_sales,
      credit_limit: s.credit_limit,
      current_due: s.current_due,
      last_bill_date: safeDateString(s.last_bill_date) || 'N/A'
    }));

    return {
      success: true,
      report_title: 'Shop Sales & Credit Dues Performance Report',
      generated_at: new Date().toISOString(),
      filters_applied: filters,
      totals: {
        total_shops: report.length,
        total_sales: report.reduce((acc, s) => acc + s.total_sales, 0),
        total_dues: report.reduce((acc, s) => acc + s.current_due, 0)
      },
      columns: ['Shop Name', 'Code', 'Owner', 'Phone', 'Village', 'Route', 'Total Bills', 'Gross Sales (₹)', 'Credit Limit (₹)', 'Current Due (₹)', 'Last Bill Date'],
      rows: rows,
      data: rows
    };
  }

  throw new Error(`Unsupported export type: "${exportType}". Supported types: sales, inventory, damages, reconciliation, expenses, driver_performance, route_performance, shop_performance.`);
}
