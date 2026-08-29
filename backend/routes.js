import express from 'express';
import * as db from './db_pg.js';
import { auditLog } from './db_pg.js';

const router = express.Router();

// ============================================================
// MIDDLEWARE
// ============================================================

export const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Please login.', code: 'NOT_AUTHENTICATED' });
  }
  next();
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.session || !req.session.role || !roles.includes(req.session.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.', code: 'INSUFFICIENT_ROLE' });
  }
  next();
};

export const requireCompanyScope = (req, res, next) => {
  if (!req.session || !req.session.companyId) {
    return res.status(403).json({ success: false, message: 'No company context. Please login.', code: 'NO_COMPANY_SCOPE' });
  }
  req.companyId = req.session.companyId;
  next();
};

export const requireDriverOwnership = (req, res, next) => {
  const targetId = parseInt(req.params.empId || req.params.id || req.query.driver_id, 10);
  if (!targetId) return next();
  if (req.session.role === 'OWNER' || req.session.role === 'STORE_KEEPER') return next();
  if (req.session.role === 'EMPLOYEE' && req.session.userId === targetId) return next();
  return res.status(403).json({ success: false, message: 'Access denied to other driver data.', code: 'ACCESS_DENIED' });
};

// ============================================================
// AUTH
// ============================================================

router.post('/auth/login', async (req, res) => {
  try {
    const { login_id, pin, role } = req.body;
    if (!login_id || !pin) {
      return res.status(400).json({ success: false, message: 'login_id and pin are required.' });
    }
    const result = await db.login(login_id, pin);
    if (result.success) {
      req.session.userId    = result.user.id;
      req.session.role      = result.user.role;
      req.session.companyId = result.user.company_id;
      return res.json({ success: true, user: result.user });
    }
    return res.status(401).json(result);
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ success: false, message: 'Login error.' });
  }
});

router.post('/auth/logout', (req, res) => {
  const userId    = req.session.userId;
  const companyId = req.session.companyId;
  req.session.destroy(async (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Could not log out.' });
    await auditLog({ companyId, actorUserId: userId, action: 'LOGOUT' });
    res.clearCookie('avs_session');
    return res.json({ success: true, message: 'Logged out successfully.' });
  });
});

router.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await db.getUserById(req.session.userId);
    if (!user) return res.status(401).json({ success: false, message: 'Session expired.' });
    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Session check failed.' });
  }
});

// ============================================================
// COMPANY
// ============================================================

router.get('/company', requireAuth, requireCompanyScope, async (req, res) => {
  try {
    const company = await db.getCompany(req.companyId);
    return res.json(company || {});
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/company', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try {
    const result = await db.updateCompany(req.companyId, req.body);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// ============================================================
// USERS
// ============================================================

router.get('/users', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try { return res.json(await db.getUsers(req.companyId)); }
  catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.post('/users', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try {
    const result = await db.addUser(req.companyId, req.body);
    await auditLog({ companyId: req.companyId, actorUserId: req.session.userId, action: 'USER_CREATED', entityType: 'user_accounts', entityId: result.user.id });
    return res.status(201).json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.put('/users/:id', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try {
    const result = await db.updateUser(req.companyId, req.params.id, req.body);
    await auditLog({ companyId: req.companyId, actorUserId: req.session.userId, action: 'USER_UPDATED', entityType: 'user_accounts', entityId: req.params.id });
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.post('/users/:id/reset-pin', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try {
    const result = await db.resetUserPin(req.companyId, req.params.id, req.body.pin);
    await auditLog({ companyId: req.companyId, actorUserId: req.session.userId, action: 'USER_PIN_RESET', entityType: 'user_accounts', entityId: req.params.id });
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

// ============================================================
// EMPLOYEES
// ============================================================

router.get('/employees', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try { return res.json(await db.getEmployees(req.companyId)); }
  catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.post('/employees', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try {
    const result = await db.addEmployee(req.companyId, req.body);
    await auditLog({ companyId: req.companyId, actorUserId: req.session.userId, action: 'EMPLOYEE_CREATED', entityType: 'employees', entityId: result.employee.id });
    return res.status(201).json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.put('/employees/:id', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try {
    const result = await db.updateEmployee(req.companyId, req.params.id, req.body);
    await auditLog({ companyId: req.companyId, actorUserId: req.session.userId, action: 'EMPLOYEE_UPDATED', entityType: 'employees', entityId: req.params.id });
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.patch('/employees/:id/status', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try {
    const result = await db.updateEmployee(req.companyId, req.params.id, { is_active: req.body.status === 'Active' });
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

// ============================================================
// CATEGORIES
// ============================================================

router.get('/categories', requireAuth, requireCompanyScope, async (req, res) => {
  try {
    const activeOnly = req.query.active === 'true';
    return res.json(await db.getCategories(req.companyId, activeOnly));
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.post('/categories', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try {
    const result = await db.addCategory(req.companyId, req.body);
    await auditLog({ companyId: req.companyId, actorUserId: req.session.userId, action: 'CATEGORY_CREATED', entityType: 'categories', entityId: result.category.id });
    return res.status(201).json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.put('/categories/:id', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try {
    const result = await db.updateCategory(req.companyId, req.params.id, req.body);
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.patch('/categories/:id/status', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try {
    const result = await db.toggleCategoryStatus(req.companyId, req.params.id, req.body.is_active);
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/categories/:id', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try {
    const result = await db.deleteCategory(req.companyId, req.params.id);
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

// ============================================================
// PRODUCTS
// ============================================================

router.get('/products', requireAuth, requireCompanyScope, async (req, res) => {
  try { return res.json(await db.getProducts(req.companyId, req.query)); }
  catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.post('/products', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try {
    const result = await db.addProduct(req.companyId, req.body);
    await auditLog({ companyId: req.companyId, actorUserId: req.session.userId, action: 'PRODUCT_CREATED', entityType: 'products', entityId: result.product.id });
    return res.status(201).json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.put('/products/:id', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try {
    const result = await db.updateProduct(req.companyId, req.params.id, req.body);
    await auditLog({ companyId: req.companyId, actorUserId: req.session.userId, action: 'PRODUCT_UPDATED', entityType: 'products', entityId: req.params.id });
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.patch('/products/:id/status', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try {
    const result = await db.toggleProductStatus(req.companyId, req.params.id, req.body.is_active);
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.post('/products/:id/price', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try {
    const result = await db.updateProductPrice(req.companyId, req.params.id, req.body, req.session.userId);
    await auditLog({ companyId: req.companyId, actorUserId: req.session.userId, action: 'PRODUCT_PRICE_UPDATED', entityType: 'products', entityId: req.params.id, metadata: req.body });
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

// ============================================================
// ROUTES
// ============================================================

router.get('/routes', requireAuth, requireCompanyScope, async (req, res) => {
  try { return res.json(await db.getRoutes(req.companyId)); }
  catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.post('/routes', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try {
    const result = await db.addRoute(req.companyId, req.body);
    return res.status(201).json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.post('/routes/:id/reassign', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try {
    const result = await db.reassignDriverRoute(req.companyId, req.params.id, req.body.new_driver_id);
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.get('/routes/fleet-summary', requireAuth, requireCompanyScope, async (req, res) => {
  try { return res.json(await db.getRoutes(req.companyId)); }
  catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// ============================================================
// SHOPS
// ============================================================

router.get('/shops', requireAuth, requireCompanyScope, async (req, res) => {
  try { return res.json(await db.getShops(req.companyId)); }
  catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.post('/shops', requireAuth, requireCompanyScope, async (req, res) => {
  try {
    const result = await db.addShop(req.companyId, req.body);
    await auditLog({ companyId: req.companyId, actorUserId: req.session.userId, action: 'SHOP_CREATED', entityType: 'shops', entityId: result.shop.id });
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.post('/shops/:id/freezer', requireAuth, requireCompanyScope, async (req, res) => {
  try {
    const result = await db.assignFreezer(req.companyId, req.params.id, req.body);
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.post('/shops/:id/collect-due', requireAuth, requireCompanyScope, async (req, res) => {
  try {
    const result = await db.collectShopDue(req.companyId, req.params.id, req.body);
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

// ============================================================
// SALES
// ============================================================

router.get('/sales', requireAuth, requireCompanyScope, async (req, res) => {
  try { return res.json(await db.getSales(req.companyId, req.query)); }
  catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.post('/sales', requireAuth, requireCompanyScope, async (req, res) => {
  try {
    const result = await db.createSale(req.companyId, req.body);
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

// ============================================================
// EXPENSES, DAMAGES, SETTLEMENTS
// ============================================================

router.get('/expenses', requireAuth, requireCompanyScope, async (req, res) => {
  try { return res.json(await db.getExpenses(req.companyId)); }
  catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.post('/expenses', requireAuth, requireCompanyScope, async (req, res) => {
  try {
    const result = await db.addExpense(req.companyId, req.body);
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.post('/damages', requireAuth, requireCompanyScope, async (req, res) => {
  try {
    const result = await db.addDamage(req.companyId, req.body);
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.post('/settlements', requireAuth, requireCompanyScope, async (req, res) => {
  try {
    const result = await db.saveSettlement(req.companyId, req.body);
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

// ============================================================
// INVENTORY
// ============================================================

router.get('/inventory/movements', requireAuth, requireCompanyScope, async (req, res) => {
  try { return res.json(await db.getStockMovements(req.companyId, req.query)); }
  catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.post('/inventory/inward', requireAuth, requireCompanyScope, async (req, res) => {
  try {
    const result = await db.addStockMovement(req.companyId, Object.assign({}, req.body, { movement_type: 'INWARD' }));
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.post('/inventory/receive', requireAuth, requireCompanyScope, async (req, res) => {
  try {
    const result = await db.addStockMovement(req.companyId, Object.assign({}, req.body, { movement_type: 'INWARD' }));
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.post('/inventory/issue', requireAuth, requireCompanyScope, async (req, res) => {
  try {
    const result = await db.addStockMovement(req.companyId, Object.assign({}, req.body, { movement_type: 'OUTWARD' }));
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.post('/inventory/allocate', requireAuth, requireCompanyScope, async (req, res) => {
  try {
    const result = await db.addStockMovement(req.companyId, Object.assign({}, req.body, { movement_type: 'OUTWARD' }));
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.post('/inventory/return', requireAuth, requireCompanyScope, async (req, res) => {
  try {
    const result = await db.addStockMovement(req.companyId, Object.assign({}, req.body, { movement_type: 'RETURN' }));
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.post('/inventory/driver-return/submit', requireAuth, requireCompanyScope, async (req, res) => {
  try {
    const result = await db.addStockMovement(req.companyId, Object.assign({}, req.body, { movement_type: 'RETURN' }));
    return res.json({ success: true, return_record: result.movement });
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.get('/inventory/driver-return/pending', requireAuth, requireCompanyScope, async (req, res) => {
  try { return res.json(await db.getStockMovements(req.companyId, { movement_type: 'RETURN' })); }
  catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.post('/inventory/return/:id/verify', requireAuth, requireCompanyScope, async (req, res) => {
  return res.json({ success: true, message: 'Return verified.' });
});

router.post('/inventory/damage', requireAuth, requireCompanyScope, async (req, res) => {
  try {
    const result = await db.addDamage(req.companyId, req.body);
    return res.json(result);
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

router.get('/inventory/reconciliation', requireAuth, requireCompanyScope, async (req, res) => {
  try { return res.json(await db.getStockMovements(req.companyId, {})); }
  catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.get('/inventory/reconciliation/product', requireAuth, requireCompanyScope, async (req, res) => {
  try { return res.json(await db.getStockMovements(req.companyId, {})); }
  catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.get('/inventory/product/:id/history', requireAuth, requireCompanyScope, async (req, res) => {
  try { return res.json({ product: null, movements: [] }); }
  catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.get('/employee-stock/:empId', requireAuth, requireCompanyScope, requireDriverOwnership, async (req, res) => {
  try { return res.json(await db.getEmployeeStock(req.companyId, req.params.empId)); }
  catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.get('/routes/driver/:id/summary', requireAuth, requireCompanyScope, async (req, res) => {
  try { return res.json({}); }
  catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// ============================================================
// DASHBOARD
// ============================================================

router.get('/dashboard/summary', requireAuth, requireRole('OWNER'), requireCompanyScope, async (req, res) => {
  try {
    return res.json(await db.getDashboardSummary(req.companyId));
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
