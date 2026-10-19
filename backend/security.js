import { randomBytes, timingSafeEqual } from 'node:crypto';
import * as db from './db_pg.js';

export async function requireAuth(req, res, next) {
  if (req.authValidated) return next();
  if (!req.session?.userId) return res.status(401).json({ success: false, message: 'Please log in.' });
  try {
    const user = await db.getUserById(req.session.userId);
    if (!user || !['OWNER','STORE_KEEPER','DRIVER','EMPLOYEE'].includes(user.role) || user.account_status !== 'ACTIVE' || user.auth_version !== req.session.authVersion) {
      return req.session.destroy(() => res.status(401).json({ success: false, message: 'Please log in again.' }));
    }
    Object.assign(req.session, { role: user.role, userRole: user.role, employeeId: user.employee_id, companyId: user.company_id });
    req.authValidated = true;
    req.authUser = user;
    next();
  } catch (error) { next(error); }
}

export function requireRole(...roles) {
  return (req, res, next) => requireAuth(req, res, () => roles.includes(req.session.role) ? next() : res.sendStatus(403));
}

export function csrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const supplied = req.get('X-CSRF-Token') || '';
  const expected = req.session?.csrfToken || '';
  if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res.status(403).json({ success: false, message: 'Invalid request token. Refresh and retry.' });
  }
  next();
}

export function csrfToken(req, res) {
  req.session.csrfToken ||= randomBytes(32).toString('hex');
  res.set('Cache-Control', 'no-store').json({ csrfToken: req.session.csrfToken });
}

export function loginLimiter() {
  const attempts = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const key = req.ip;
    const entry = attempts.get(key) || { count: 0, until: now + 60_000 };
    if (attempts.size >= 10000 && !attempts.has(key)) return res.sendStatus(429);
    entry.count++;
    attempts.set(key, entry);
    if (entry.count > 10) {
      res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000)));
      return res.sendStatus(429);
    }
    next();
  };
}

export async function authorize(req, res, next) {
  for(const key of ['start_date','end_date','from','to','date']) {
    const value=req.query[key];
    if(value === undefined || value === '' || (key==='date' && value==='today'))continue;
    if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value) return res.status(400).json({success:false,message:'Invalid business date'});
  }
  if (req.path === '/auth/login' || req.path === '/health') return next();
  return requireAuth(req, res, async () => {
    const role = req.session.role;
    const writing = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const path = req.path;
    if (/^\/(?:system|admin)(?:\/|$)/.test(path)) return res.sendStatus(404);
    if (writing && /\/freezers?(?:\/|$)/.test(path) && !['OWNER','STORE_KEEPER'].includes(role)) return res.sendStatus(403);
    if (writing && /^\/(?:suppliers|freezers|shop-freezers|freezer-models|settlements|stock|inventory|sk)(?:\/|$)/.test(path) && !['OWNER', 'STORE_KEEPER'].includes(role)) return res.sendStatus(403);
    if (!['DRIVER', 'EMPLOYEE'].includes(role)) return next();
    const employeeId = req.session.employeeId;
    if (!employeeId) return res.sendStatus(403);
    try {
      if (/^\/(?:suppliers|freezers|shop-freezers|freezer-models)(?:\/|$)/.test(path)) return res.sendStatus(403);
      if (path === '/routes/fleet-summary') return res.sendStatus(403);
      const routeDriver = path.match(/^\/routes\/driver\/(\d+)\/summary$/);
      if(routeDriver && String(routeDriver[1])!==String(employeeId)) return res.sendStatus(403);
      if(path === '/routes') return res.json((await db.getRoutes(req.session.companyId)).filter(route=>String(route.id)===String(req.authUser.route_id)));
      if(path === '/villages') return res.json((await db.getVillages(req.session.companyId)).filter(village=>String(village.route_id)===String(req.authUser.route_id)));
      if(path === '/route-assignments') return res.json((await db.getRouteAssignments(req.session.companyId,req.query.date)).filter(assignment=>String(assignment.employee_id)===String(employeeId)));
      if (path === '/employees' || path === '/drivers') return res.json([await db.getUserById(req.session.userId)]);
      if (path === '/dashboard/summary') return res.json(await db.getEmployeeAccountSummary(req.session.companyId,employeeId));
      if (path === '/inventory/warehouse-stock') return res.sendStatus(403);
      if (path === '/inventory/movements' || path === '/stock/movements') req.query.employee_id = employeeId;
      for (const input of [req.query, req.body || {}]) {
        for (const key of ['employee_id', 'driver_id']) if (input[key] && String(input[key]) !== String(employeeId)) return res.sendStatus(403);
      }
      const requestedSession = req.query.session_id || req.body?.session_id;
      if (requestedSession) {
        const result = await db.query('SELECT id FROM driver_sessions WHERE id=$1 AND employee_id=$2 AND company_id=$3', [requestedSession, employeeId, req.session.companyId]);
        if (!result.rows.length) return res.sendStatus(403);
      }
      const stock = path.match(/^\/(?:employee-stock|stock\/employee)\/(\d+)$/);
      if (stock && String(stock[1]) !== String(employeeId)) return res.sendStatus(403);
      const saleMatch = path.match(/^\/sales\/([^/]+)(?:\/(?:edit|cancel|refund))?$/);
      if (saleMatch) {
        if (writing) return res.sendStatus(403);
        const sale = await db.getSaleById(req.session.companyId, saleMatch[1]);
        if (!sale || String(sale.employee_id) !== String(employeeId)) return res.sendStatus(404);
      }
      const record = path.match(/^\/(expenses|damages)\/(\d+)$/);
      if (record) {
        const table = record[1] === 'expenses' ? 'expenses' : 'damages';
        const result = await db.query('SELECT employee_id FROM ' + table + ' WHERE id=$1 AND company_id=$2', [record[2], req.session.companyId]);
        if (!result.rows.length || String(result.rows[0].employee_id) !== String(employeeId)) return res.sendStatus(404);
      }
      if (path === '/expenses' || path === '/settlements') req.query.employee_id = employeeId;
      if (/^\/shops\/[^/]+\/freezers?$/.test(path)) {
        const shops = await db.getEmployeeAssignedShops(req.session.companyId,employeeId);
        if(!shops.some(shop=>String(shop.id)===path.split('/')[2]))return res.sendStatus(404);
      }
      if (path === '/expenses' && writing) req.body.employee_id = employeeId;
      if (path === '/damages/summary') return res.sendStatus(403);
      const expectedReturn = path.match(/^\/sk\/driver-returns\/expected\/(\d+)$/);
      if(expectedReturn && String(expectedReturn[1]) !== String(employeeId)) return res.sendStatus(403);
      if (path === '/shops' && writing) {
        const user = await db.getUserById(req.session.userId);
        if (!user.route_id) return res.sendStatus(403);
        if (req.body.village_id) {
          const result = await db.query('SELECT id FROM villages WHERE id=$1 AND company_id=$2 AND route_id=$3', [req.body.village_id, req.session.companyId, user.route_id]);
          if (!result.rows.length) return res.sendStatus(403);
        }
        req.body.route_id = user.route_id;
      }

      next();
    } catch (error) { next(error); }
  });
}

