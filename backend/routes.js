import express from 'express';
import * as db from './db_pg.js';

const router = express.Router();

// ====== AUTH MIDDLEWARE ======
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, message: 'Unauthenticated. Please log in.' });
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: 'Unauthenticated.' });
    }
    if (!roles.includes(req.session.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden. Required: ' + roles.join(' or ') });
    }
    next();
  };
}

const getCid = (req) => req.session?.companyId || 1;

// ====== AUTH ROUTES ======
router.post('/auth/login', async (req, res) => {
  try {
    const { login_id, pin } = req.body;
    if (!login_id || !pin) {
      return res.status(400).json({ success: false, message: 'login_id and pin are required.' });
    }
    const result = await db.login(login_id, pin);
    if (!result.success) return res.status(401).json(result);
    req.session.userId = result.user.id;
    req.session.companyId = result.user.company_id;
    req.session.role = result.user.role;
    req.session.userRole = result.user.role;
    req.session.userName = result.user.name;
    req.session.employeeId = result.user.employee_id;
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/auth/logout', requireAuth, async (req, res) => {
  try {
    await db.auditLog({ companyId: req.session.companyId, actorUserId: req.session.userId, action: 'LOGOUT' });
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ success: false, message: 'Logout failed' });
      res.clearCookie('avs_session');
      res.json({ success: true, message: 'Logged out successfully' });
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await db.getUserById(req.session.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ====== OWNER DASHBOARD & SUMMARY ======
router.get('/dashboard/summary', requireAuth, async (req, res) => {
  try {
    const data = await db.getDashboardSummary(getCid(req));
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ====== STORE KEEPER POS & WAREHOUSE INVENTORY ======
router.get('/sk/dashboard', requireAuth, requireRole('STORE_KEEPER', 'OWNER'), async (req, res) => {
  try {
    const data = await db.getKeeperDashboard(getCid(req));
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/sk/inventory', requireAuth, requireRole('STORE_KEEPER', 'OWNER'), async (req, res) => {
  try {
    const products = await db.getWarehouseStock(getCid(req));
    res.json(products);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/inventory/warehouse-stock', requireAuth, async (req, res) => {
  try {
    const products = await db.getWarehouseStock(getCid(req));
    res.json(products);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/inventory/movements', requireAuth, async (req, res) => {
  try {
    const movements = await db.getStockMovements(getCid(req), req.query);
    res.json(movements);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post(['/sk/receive-stock', '/inventory/receive', '/inventory/inward'], requireAuth, requireRole('STORE_KEEPER', 'OWNER'), async (req, res) => {
  try {
    const result = await db.receiveStock(getCid(req), req.body, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.post(['/sk/issue-stock', '/inventory/issue', '/inventory/allocate'], requireAuth, requireRole('STORE_KEEPER', 'OWNER'), async (req, res) => {
  try {
    const result = await db.issueStockToEmployee(getCid(req), req.body, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.post(['/sk/return-stock', '/inventory/return', '/inventory/driver-return/submit'], requireAuth, requireRole('STORE_KEEPER', 'OWNER'), async (req, res) => {
  try {
    const result = await db.acceptEmployeeReturns(getCid(req), req.body, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.post(['/sk/damage-stock', '/inventory/damage'], requireAuth, requireRole('STORE_KEEPER', 'OWNER'), async (req, res) => {
  try {
    const result = await db.processDamage(getCid(req), req.body, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.get('/sk/employee-stock-report', requireAuth, requireRole('STORE_KEEPER', 'OWNER'), async (req, res) => {
  try {
    const report = await db.getAllEmployeeStockReport(getCid(req));
    res.json(report);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/sk/employee-summary/:id', requireAuth, requireRole('STORE_KEEPER', 'OWNER'), async (req, res) => {
  try {
    const summary = await db.getEmployeeAccountSummary(getCid(req), req.params.id, req.query.date);
    res.json(summary);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/sk/direct-billing', requireAuth, requireRole('STORE_KEEPER', 'OWNER'), async (req, res) => {
  try {
    const result = await db.createKeeperSale(getCid(req), req.body, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

// ====== EMPLOYEE / DRIVER MODULE ======
router.get('/emp/dashboard', requireAuth, requireRole('EMPLOYEE', 'DRIVER', 'OWNER', 'STORE_KEEPER'), async (req, res) => {
  try {
    const cid = getCid(req);
    const empId = req.session.employeeId || req.query.employee_id;
    if (!empId) return res.status(400).json({ success: false, message: 'No employee assigned to user' });
    const today = new Date().toISOString().split('T')[0];
    const summary = await db.getEmployeeAccountSummary(cid, empId, today);
    const shops = await db.getEmployeeAssignedShops(cid, empId, today);
    const stock = await db.getEmployeeStock(cid, empId);
    const reconciliation = await db.getDriverSessionReconciliation(cid, empId);
    res.json({ success: true, summary, shops, stock, reconciliation });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/emp/shops', requireAuth, requireRole('EMPLOYEE', 'DRIVER', 'OWNER', 'STORE_KEEPER'), async (req, res) => {
  try {
    const cid = getCid(req);
    const empId = req.session.employeeId || req.query.employee_id;
    const shops = await db.getEmployeeAssignedShops(cid, empId, req.query.date);
    res.json(shops);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get(['/employee-stock', '/employee-stock/:id', '/stock/employee/:id', '/emp/stock'], requireAuth, async (req, res) => {
  try {
    const cid = getCid(req);
    const requestedEmpId = req.params.id || req.session.employeeId || req.query.employee_id || req.session.userId;
    if (req.session?.userRole === 'DRIVER' && req.params.id && String(req.params.id) !== String(req.session.employeeId)) {
      return res.status(403).json({ success: false, message: "Forbidden: Drivers cannot view another driver's vehicle stock." });
    }
    const empId = (req.session?.userRole === 'DRIVER' && req.session.employeeId) ? req.session.employeeId : requestedEmpId;
    const stock = await db.getEmployeeStock(cid, empId);
    res.json(stock);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/emp/billing', requireAuth, requireRole('EMPLOYEE', 'DRIVER', 'OWNER'), async (req, res) => {
  try {
    const cid = getCid(req);
    const empId = req.session.employeeId || req.body.employee_id;
    const empName = req.session.userName || req.body.employee_name || 'Delivery Executive';
    const result = await db.createEmployeeSale(cid, empId, empName, req.body, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.post(['/emp/returns', '/driver/returns/submit', '/emp/returns/submit', '/driver/return/submit'], requireAuth, requireRole('EMPLOYEE', 'DRIVER', 'OWNER', 'STORE_KEEPER'), async (req, res) => {
  try {
    const cid = getCid(req);
    const empId = req.session.employeeId || req.body.employee_id;
    if (!empId) return res.status(400).json({ success: false, message: 'Employee ID is required.' });
    const result = await db.submitDriverReturn(cid, empId, req.body, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.post(['/sk/direct-return', '/sk/returns/accept-direct'], requireAuth, requireRole('STORE_KEEPER', 'OWNER'), async (req, res) => {
  try {
    const cid = getCid(req);
    const result = await db.acceptEmployeeReturns(cid, req.body, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.get(['/sk/driver-returns/eligible', '/sk/driver-returns/pending-drivers', '/sk/pending-returns', '/driver/returns/pending'], requireAuth, requireRole('STORE_KEEPER', 'OWNER', 'DRIVER', 'EMPLOYEE'), async (req, res) => {
  try {
    const cid = getCid(req);
    const eligible = await db.getEligibleDriversForReturn(cid);
    res.json(eligible);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/sk/driver-returns/expected/:driverId', requireAuth, requireRole('STORE_KEEPER', 'OWNER', 'DRIVER', 'EMPLOYEE'), async (req, res) => {
  try {
    const cid = getCid(req);
    const driverId = Number(req.params.driverId);
    if (!driverId) return res.status(400).json({ success: false, message: 'Valid driverId is required' });
    const sessionId = req.query.session_id ? Number(req.query.session_id) : null;
    const expected = await db.getDriverExpectedReturn(cid, driverId, sessionId);
    res.json({ success: true, ...expected });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.post(['/sk/driver-returns/verify', '/sk/driver-returns/accept', '/sk/returns/verify'], requireAuth, requireRole('STORE_KEEPER', 'OWNER'), async (req, res) => {
  try {
    const cid = getCid(req);
    const driverId = req.body.driver_id || req.body.employee_id;
    if (!driverId) return res.status(400).json({ success: false, message: 'Driver ID is required' });
    const result = await db.verifyAndAcceptDriverReturn(cid, Number(driverId), req.body, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.get(['/sk/driver-returns/history', '/driver/returns/history'], requireAuth, requireRole('STORE_KEEPER', 'OWNER', 'DRIVER', 'EMPLOYEE'), async (req, res) => {
  try {
    const cid = getCid(req);
    const limit = req.query.limit || 20;
    const history = await db.getDriverReturnHistory(cid, limit);
    res.json({ success: true, history });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get(['/sk/driver-returns/missing', '/driver/returns/missing', '/driver-returns/missing', '/inventory/missing-stock'], requireAuth, requireRole('STORE_KEEPER', 'OWNER', 'ADMIN'), async (req, res) => {
  try {
    const cid = getCid(req);
    const report = await db.getMissingStockReport(cid, req.query);
    res.json(report);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post(['/sk/returns/:id/accept', '/driver/returns/:id/accept'], requireAuth, requireRole('STORE_KEEPER', 'OWNER'), async (req, res) => {
  try {
    const cid = getCid(req);
    const result = await db.acceptStorekeeperReturn(cid, Number(req.params.id), req.body, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.get(['/emp/session/active', '/driver/session/active'], requireAuth, requireRole('EMPLOYEE', 'DRIVER', 'OWNER', 'STORE_KEEPER'), async (req, res) => {
  try {
    const cid = getCid(req);
    const empId = req.session.employeeId || req.query.employee_id || req.session.userId;
    if (!empId) return res.status(400).json({ success: false, message: 'Employee ID is required.' });
    const session = await db.getActiveDriverSession(cid, empId);
    res.json({ success: true, session });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get(['/emp/session/reconciliation', '/driver/session/reconciliation', '/driver/reconciliation', '/inventory/reconciliation'], requireAuth, requireRole('EMPLOYEE', 'DRIVER', 'OWNER', 'STORE_KEEPER'), async (req, res) => {
  try {
    const cid = getCid(req);
    const filterEmployeeId = (req.query.employee_id && req.query.employee_id !== 'ALL') ? Number(req.query.employee_id) : null;
    
    if ((req.session.userRole === 'OWNER' || req.session.userRole === 'STORE_KEEPER') && !req.query.session_id) {
      const fleetRecon = await db.getFleetStockReconciliation(cid, filterEmployeeId);
      return res.json(fleetRecon);
    }

    const empId = filterEmployeeId || req.session.employeeId || req.session.userId;
    if (!empId) return res.status(400).json({ success: false, message: 'Employee ID is required.' });
    const recon = await db.getDriverSessionReconciliation(cid, empId, req.query.session_id ? Number(req.query.session_id) : null);
    res.json(recon);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post(['/emp/session/close', '/driver/session/close'], requireAuth, requireRole('EMPLOYEE', 'DRIVER', 'OWNER', 'STORE_KEEPER'), async (req, res) => {
  try {
    const cid = getCid(req);
    const empId = req.session.employeeId || req.body.employee_id || req.query.employee_id || req.session.userId;
    if (!empId) return res.status(400).json({ success: false, message: 'Employee ID is required.' });
    const result = await db.closeDriverSession(cid, empId, req.body, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.get(['/emp/sessions/history', '/driver/sessions/history'], requireAuth, requireRole('EMPLOYEE', 'DRIVER', 'OWNER', 'STORE_KEEPER'), async (req, res) => {
  try {
    const cid = getCid(req);
    const empId = req.session.employeeId || req.query.employee_id || null;
    const history = await db.getDriverSessionHistory(cid, empId, req.query.limit || 20);
    res.json(history);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/emp/damages', requireAuth, requireRole('EMPLOYEE', 'DRIVER', 'OWNER', 'STORE_KEEPER'), async (req, res) => {
  try {
    const cid = getCid(req);
    const empId = req.session.employeeId || req.body.employee_id;
    const result = await db.processDamage(cid, Object.assign({}, req.body, { employee_id: empId }), req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.post(['/emp/day-closing', '/driver/end-day', '/emp/end-day'], requireAuth, requireRole('EMPLOYEE', 'DRIVER', 'OWNER'), async (req, res) => {
  try {
    const cid = getCid(req);
    const empId = req.session.employeeId || req.body.employee_id || req.session.userId;
    if (!empId) return res.status(400).json({ success: false, message: 'Employee ID is required.' });
    const result = await db.submitDriverEndDay(cid, empId, req.body, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.get('/emp/day-summary', requireAuth, requireRole('EMPLOYEE', 'DRIVER', 'OWNER', 'STORE_KEEPER'), async (req, res) => {
  try {
    const cid = getCid(req);
    const empId = req.session.employeeId || req.query.employee_id;
    const summary = await db.getEmployeeAccountSummary(cid, empId, req.query.date);
    res.json(summary);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ====== PRODUCTS ======
router.get('/products', requireAuth, async (req, res) => {
  try {
    const userRole = (req.session?.role || req.session?.userRole || '').toUpperCase();
    const queryParams = { ...req.query };
    if (userRole === 'STORE_KEEPER' || userRole === 'DRIVER' || queryParams.active === 'true' || queryParams.active === true) {
      queryParams.active = true;
    }
    const products = await db.getProducts(getCid(req), queryParams);
    res.json(products);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/products', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.addProduct(getCid(req), req.body);
    await db.auditLog({ companyId: getCid(req), actorUserId: req.session.userId, action: 'PRODUCT_CREATE', entityType: 'products', entityId: result.product.id });
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.put('/products/:id', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.updateProduct(getCid(req), req.params.id, req.body);
    await db.auditLog({ companyId: getCid(req), actorUserId: req.session.userId, action: 'PRODUCT_UPDATE', entityType: 'products', entityId: req.params.id });
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.patch('/products/:id/status', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.toggleProductStatus(getCid(req), req.params.id, req.body.is_active);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.delete('/products/:id', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.deleteProduct(getCid(req), req.params.id);
    await db.auditLog({ companyId: getCid(req), actorUserId: req.session.userId, action: 'PRODUCT_DELETE', entityType: 'products', entityId: req.params.id });
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.post('/products/:id/delete', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.deleteProduct(getCid(req), req.params.id);
    await db.auditLog({ companyId: getCid(req), actorUserId: req.session.userId, action: 'PRODUCT_DELETE', entityType: 'products', entityId: req.params.id });
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.post('/products/:id/price', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.updateProductPrice(getCid(req), req.params.id, req.body, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.put('/products/:id/price', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.updateProductPrice(getCid(req), req.params.id, req.body, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.get('/products/:id/uoms', requireAuth, async (req, res) => {
  try {
    const result = await db.getProductUoms(getCid(req), req.params.id);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.post('/products/:id/uoms', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.configureProductUom(getCid(req), req.params.id, req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

// ====== CATEGORIES ======
router.get('/categories', requireAuth, async (req, res) => {
  try {
    const categories = await db.getCategories(getCid(req), req.query.active === 'true');
    res.json(categories);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/categories', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.addCategory(getCid(req), req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.put('/categories/:id', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.updateCategory(getCid(req), req.params.id, req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.patch('/categories/:id/status', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.toggleCategoryStatus(getCid(req), req.params.id, req.body.is_active);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.delete('/categories/:id', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.deleteCategory(getCid(req), req.params.id);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

// ====== USERS ======
router.get('/users', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const users = await db.getUsers(getCid(req));
    res.json(users);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/users', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.addUser(getCid(req), req.body);
    await db.auditLog({ companyId: getCid(req), actorUserId: req.session.userId, action: 'USER_CREATE', entityType: 'user_accounts', entityId: result.user?.id });
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.put('/users/:id', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.updateUser(getCid(req), req.params.id, req.body);
    await db.auditLog({ companyId: getCid(req), actorUserId: req.session.userId, action: 'USER_UPDATE', entityType: 'user_accounts', entityId: req.params.id });
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.delete('/users/:id', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.deleteUser(getCid(req), req.params.id, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.post('/users/:id/reset-pin', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.resetUserPin(getCid(req), req.params.id, req.body.pin, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

// ====== EMPLOYEES & DRIVERS ======
router.get('/drivers', requireAuth, async (req, res) => {
  try {
    const cid = getCid(req);
    const drivers = await db.getDrivers(cid);
    console.log(`[DRIVER_API] endpoint: /drivers | userId: ${req.session?.userId} | role: ${req.session?.userRole} | companyId: ${cid} | rows: ${drivers.length} | driverIds: ${JSON.stringify(drivers.map(d => d.id))} | roles: ${JSON.stringify(drivers.map(d => d.user_role))}`);
    res.json(drivers);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/employees', requireAuth, async (req, res) => {
  try {
    const cid = getCid(req);
    const employees = await db.getEmployees(cid, req.query);
    if (req.query?.role === 'DRIVER' || req.query?.driversOnly === 'true' || req.query?.driversOnly === true) {
      console.log(`[DRIVER_API] endpoint: /employees?role=DRIVER | userId: ${req.session?.userId} | role: ${req.session?.userRole} | companyId: ${cid} | rows: ${employees.length} | driverIds: ${JSON.stringify(employees.map(d => d.id))} | roles: ${JSON.stringify(employees.map(d => d.user_role))}`);
    }
    res.json(employees);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/employees', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.addEmployee(getCid(req), req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.put('/employees/:id', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.updateEmployee(getCid(req), req.params.id, req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

// ====== ROUTES ======
router.get('/routes', requireAuth, async (req, res) => {
  try {
    const routes = await db.getRoutes(getCid(req));
    res.json(routes);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/routes/fleet-summary', requireAuth, async (req, res) => {
  try {
    const summary = await db.getFleetRouteSummary(getCid(req));
    res.json(summary);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/routes/driver/:driverId/summary', requireAuth, async (req, res) => {
  try {
    const summary = await db.getDriverDetailSummary(getCid(req), req.params.driverId);
    res.json(summary);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/routes', requireAuth, requireRole('OWNER', 'STORE_KEEPER'), async (req, res) => {
  try {
    const result = await db.addRoute(getCid(req), req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.put('/routes/:id', requireAuth, requireRole('OWNER', 'STORE_KEEPER'), async (req, res) => {
  try {
    const result = await db.updateRoute(getCid(req), req.params.id, req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.delete('/routes/:id', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.deleteRoute(getCid(req), req.params.id);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.post('/routes/:id/reassign', requireAuth, requireRole('OWNER', 'STORE_KEEPER'), async (req, res) => {
  try {
    const result = await db.reassignDriverRoute(getCid(req), req.params.id, req.body.new_driver_id || req.body.employee_id);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.post('/routes/:id/assign', requireAuth, requireRole('OWNER', 'STORE_KEEPER'), async (req, res) => {
  try {
    const { employee_id, vehicle_number, assigned_date } = req.body;
    const result = await db.assignRoute(getCid(req), req.params.id, employee_id, vehicle_number, assigned_date);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.get('/route-assignments', requireAuth, async (req, res) => {
  try {
    const assignments = await db.getRouteAssignments(getCid(req), req.query.date);
    res.json(assignments);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ====== VILLAGES ======
router.get('/villages', requireAuth, async (req, res) => {
  try {
    const villages = await db.getVillages(getCid(req), req.query);
    res.json(villages);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/villages', requireAuth, requireRole('OWNER', 'STORE_KEEPER'), async (req, res) => {
  try {
    const result = await db.addVillage(getCid(req), req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.put('/villages/:id', requireAuth, requireRole('OWNER', 'STORE_KEEPER'), async (req, res) => {
  try {
    const result = await db.updateVillage(getCid(req), req.params.id, req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.delete('/villages/:id', requireAuth, requireRole('OWNER', 'STORE_KEEPER'), async (req, res) => {
  try {
    const result = await db.deleteVillage(getCid(req), req.params.id);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

// ====== SHOPS ======
router.get('/shops', requireAuth, async (req, res) => {
  try {
    const cid = getCid(req);
    const userRole = (req.session?.role || req.session?.userRole || '').toUpperCase();
    const queryParams = { ...req.query };

    // If logged in as Driver, restrict shops to the driver's assigned route
    if (userRole === 'DRIVER' || userRole === 'EMPLOYEE') {
      const driverEmpId = req.session?.employee_id || req.session?.employeeId || req.session?.userId;
      if (driverEmpId) {
        queryParams.employee_id = driverEmpId;
      }
    }

    const shops = await db.getShops(cid, queryParams);
    res.json(shops);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/shops', requireAuth, requireRole('OWNER', 'STORE_KEEPER', 'EMPLOYEE'), async (req, res) => {
  try {
    const result = await db.addShop(getCid(req), req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.put('/shops/:id', requireAuth, requireRole('OWNER', 'STORE_KEEPER'), async (req, res) => {
  try {
    const result = await db.updateShop(getCid(req), req.params.id, req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.delete('/shops/:id', requireAuth, requireRole('OWNER', 'STORE_KEEPER'), async (req, res) => {
  try {
    const result = await db.deleteShop(getCid(req), req.params.id);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.post('/shops/:id/freezer', requireAuth, async (req, res) => {
  try {
    const result = await db.assignFreezer(getCid(req), req.params.id, req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.delete('/shops/:id/freezer', requireAuth, async (req, res) => {
  try {
    const result = await db.unassignFreezer(getCid(req), req.params.id);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

// ====== FREEZER MODELS MASTER ======
router.get('/freezer-models', requireAuth, async (req, res) => {
  try {
    const models = await db.getFreezerModels(getCid(req));
    res.json(models);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/freezer-models', requireAuth, async (req, res) => {
  try {
    const result = await db.createFreezerModel(getCid(req), req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.delete('/freezer-models/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.deleteFreezerModel(getCid(req), req.params.id);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.post('/shops/:id/collect-due', requireAuth, async (req, res) => {
  try {
    const result = await db.collectShopDue(getCid(req), req.params.id, req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

// ====== SALES & BILLING ======
router.get('/sales', requireAuth, async (req, res) => {
  try {
    const cid = getCid(req);
    const userRole = (req.session?.role || req.session?.userRole || '').toUpperCase();
    const queryParams = { ...req.query };
    if (userRole === 'DRIVER') {
      queryParams.employee_id = req.session.employeeId;
    }
    const sales = await db.getSales(cid, queryParams);
    res.json(sales);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/sales', requireAuth, async (req, res) => {
  try {
    const userRole = (req.session?.role || req.session?.userRole || '').toUpperCase();
    const payload = { ...req.body };
    if (userRole === 'DRIVER') {
      payload.employee_id = req.session.employeeId;
      payload.employee_name = req.session.userName || 'Driver POS';
      payload.is_store_direct_sale = false;
    } else if (userRole === 'STORE_KEEPER' || payload.is_store_direct_sale || payload.sale_type === 'STOREKEEPER_DIRECT') {
      payload.employee_id = null;
      payload.employee_name = req.session?.userName || 'Store Keeper';
      payload.is_store_direct_sale = true;
      payload.sale_type = 'STOREKEEPER_DIRECT';
      if (!payload.shop_name) payload.shop_name = 'AVS AGENCIES';
    }
    const result = await db.createSale(getCid(req), payload, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.get('/sales/:id', requireAuth, async (req, res) => {
  try {
    const cid = getCid(req);
    const saleId = req.params.id;
    const result = await db.getSaleById(cid, saleId);
    if (!result) return res.status(404).json({ success: false, message: 'Sale not found' });
    res.json(result);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put(['/sales/:id', '/sales/:id/edit'], requireAuth, async (req, res) => {
  const userRole = (req.session?.role || req.session?.userRole || '').toUpperCase();
  if (userRole === 'DRIVER') {
    return res.status(403).json({ success: false, message: 'Forbidden: Finalized bills are strictly read-only for Drivers.' });
  }
  return res.status(400).json({ success: false, message: 'Finalized financial transactions are immutable. Use cancellation/voiding workflow instead.' });
});

router.patch('/sales/:id', requireAuth, async (req, res) => {
  const userRole = (req.session?.role || req.session?.userRole || '').toUpperCase();
  if (userRole === 'DRIVER') {
    return res.status(403).json({ success: false, message: 'Forbidden: Finalized bills cannot be modified by Drivers.' });
  }
  return res.status(400).json({ success: false, message: 'Finalized financial transactions are immutable.' });
});

router.delete('/sales/:id', requireAuth, async (req, res) => {
  const userRole = (req.session?.role || req.session?.userRole || '').toUpperCase();
  if (userRole === 'DRIVER') {
    return res.status(403).json({ success: false, message: 'Forbidden: Finalized bills cannot be deleted by Drivers.' });
  }
  try {
    const result = await db.cancelSale(getCid(req), parseInt(req.params.id, 10), req.session.userId, userRole);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.post('/sales/:id/cancel', requireAuth, async (req, res) => {
  const userRole = (req.session?.role || req.session?.userRole || '').toUpperCase();
  if (userRole === 'DRIVER') {
    return res.status(403).json({ success: false, message: 'Forbidden: Drivers cannot cancel finalized bills. Contact Store Keeper or Owner.' });
  }
  try {
    const result = await db.cancelSale(getCid(req), parseInt(req.params.id, 10), req.session.userId, userRole);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

// ====== EXPENSES, DAMAGES, SETTLEMENTS ======
router.get('/expenses', requireAuth, async (req, res) => {
  try {
    const expenses = await db.getExpenses(getCid(req), req.query);
    res.json(expenses);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/expenses', requireAuth, async (req, res) => {
  try {
    const payload = Object.assign({}, req.body, {
      employee_id: req.body.employee_id || req.session.employeeId || null
    });
    const result = await db.addExpense(getCid(req), payload, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.put('/expenses/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.updateExpense(getCid(req), req.params.id, req.body, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.delete('/expenses/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.deleteExpense(getCid(req), req.params.id, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.get('/damages/summary', requireAuth, async (req, res) => {
  try {
    const summary = await db.getDamageAnalyticsSummary(getCid(req), req.query);
    res.json(summary);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/damages', requireAuth, async (req, res) => {
  try {
    const damages = await db.getDamages(getCid(req), req.query, req.session.role, req.session.employeeId);
    res.json(damages);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/damages/:id/verify', requireAuth, requireRole('STORE_KEEPER', 'OWNER', 'ADMIN'), async (req, res) => {
  try {
    const { action, notes } = req.body;
    const result = await db.verifyOrRejectDamage(getCid(req), req.params.id, action, notes, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.post('/damages', requireAuth, async (req, res) => {
  try {
    const empId = req.session.role === 'DRIVER' || req.session.role === 'EMPLOYEE'
      ? req.session.employeeId
      : (req.body.employee_id || req.session.employeeId);
    const result = await db.addDamage(getCid(req), Object.assign({}, req.body, { employee_id: empId }), req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.get('/settlements', requireAuth, async (req, res) => {
  try {
    const settlements = await db.getSettlements(getCid(req), req.query);
    res.json(settlements);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/settlements', requireAuth, async (req, res) => {
  try {
    const result = await db.saveSettlement(getCid(req), req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

// ====== STOCK MOVEMENTS ======
router.get('/stock/movements', requireAuth, async (req, res) => {
  try {
    const movements = await db.getStockMovements(getCid(req), req.query);
    res.json(movements);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/stock/movements', requireAuth, async (req, res) => {
  try {
    const result = await db.addStockMovement(getCid(req), req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.get('/stock/employee/:id', requireAuth, async (req, res) => {
  try {
    const stock = await db.getEmployeeStock(getCid(req), req.params.id);
    res.json(stock);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ====== PHASE 4: EXECUTIVE ANALYTICS, RECONCILIATION & AUDIT TRAIL ======
router.get('/analytics/dashboard', requireAuth, requireRole('OWNER', 'ADMIN', 'STORE_KEEPER'), async (req, res) => {
  try {
    const data = await db.getOwnerExecutiveDashboard(getCid(req), req.query);
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/analytics/reconciliation', requireAuth, requireRole('OWNER', 'ADMIN', 'STORE_KEEPER'), async (req, res) => {
  try {
    const data = await db.getAdvancedReconciliation(getCid(req), req.query);
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/analytics/driver-performance', requireAuth, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const data = await db.getDriverPerformanceReport(getCid(req), req.query);
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/analytics/route-performance', requireAuth, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const data = await db.getRoutePerformanceReport(getCid(req), req.query);
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/analytics/shop-performance', requireAuth, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const data = await db.getShopPerformanceReport(getCid(req), req.query);
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/analytics/product-performance', requireAuth, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const data = await db.getProductPerformanceReport(getCid(req), req.query);
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/audit-logs', requireAuth, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const data = await db.getAuditTrail(getCid(req), req.query);
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ====== PHASE 5: INVENTORY ALERTS & REORDERS ======
router.get('/inventory/alerts', requireAuth, requireRole('OWNER', 'ADMIN', 'STORE_KEEPER'), async (req, res) => {
  try {
    const data = await db.getInventoryAlertsAndReorders(getCid(req));
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ====== PHASE 5: STOCK ADJUSTMENT ======
router.post('/inventory/adjust', requireAuth, requireRole('OWNER', 'ADMIN', 'STORE_KEEPER'), async (req, res) => {
  try {
    const result = await db.adjustStock(getCid(req), req.body, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

// ====== PHASE 5: NOTIFICATIONS ======
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    const data = await db.getNotifications(getCid(req), req.session.role, req.session.userId, req.query);
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.patch('/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const result = await db.markNotificationAsRead(getCid(req), req.params.id, req.session.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.post('/notifications/mark-all-read', requireAuth, async (req, res) => {
  try {
    const result = await db.markAllNotificationsAsRead(getCid(req), req.session.role, req.session.userId);
    res.json(result);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ====== PHASE 5: EXPORTS (CSV / JSON REPORT FORMAT) ======
router.get('/export/:reportType', requireAuth, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const format = (req.query.format || 'json').toLowerCase();
    const data = await db.getExportData(getCid(req), req.params.reportType, req.query);

    if (format === 'csv') {
      const headerRow = data.columns.join(',');
      const rows = data.rows.map(r => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
      const csvContent = [headerRow, ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.reportType}_export_${Date.now()}.csv"`);
      return res.send(csvContent);
    }

    res.json(data);
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

export default router;

