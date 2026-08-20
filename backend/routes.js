import express from 'express';
import { db } from './db.js';

const router = express.Router();

// Auth route
router.post('/auth/login', (req, res) => {
  const { pin, role } = req.body;
  const result = db.login(pin, role);
  if (result.success) {
    res.json(result);
  } else {
    res.status(401).json(result);
  }
});

// Company Info
router.get('/company', (req, res) => {
  res.json(db.getCompany());
});

// Users / Employees
router.get('/users', (req, res) => {
  res.json(db.getUsers());
});

// Shops - GET & POST (Add new shop)
router.get('/shops', (req, res) => {
  res.json(db.getShops());
});

router.post('/shops', (req, res) => {
  try {
    const result = db.addShop(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Assign Freezer to Shop
router.post('/shops/:id/freezer', (req, res) => {
  try {
    const shopId = req.params.id;
    const result = db.assignFreezer(shopId, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Collect Shop Due Payment
router.post('/shops/:id/collect-due', (req, res) => {
  try {
    const shopId = req.params.id;
    const result = db.collectShopDue(shopId, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Products
router.get('/products', (req, res) => {
  res.json(db.getProducts());
});

router.post('/products/:id/price', (req, res) => {
  try {
    const productId = req.params.id;
    const result = db.updateProductPrice(productId, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Employee stock
router.get('/employee-stock/:empId', (req, res) => {
  const empId = parseInt(req.params.empId, 10);
  res.json(db.getEmployeeStock(empId));
});

// Sales - GET & POST
router.get('/sales', (req, res) => {
  res.json(db.getSales());
});

router.post('/sales', (req, res) => {
  try {
    const sale = db.createSale(req.body);
    res.json({ success: true, sale });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Log damage
router.post('/damages', (req, res) => {
  try {
    const damage = db.addDamage(req.body);
    res.json({ success: true, damage });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Expenses - GET & POST
router.get('/expenses', (req, res) => {
  res.json(db.getExpenses());
});

router.post('/expenses', (req, res) => {
  try {
    const expense = db.addExpense(req.body);
    res.json({ success: true, expense });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Cash settlement
router.post('/settlements', (req, res) => {
  try {
    const settlement = db.saveCashSettlement(req.body);
    res.json({ success: true, settlement });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Receive dealer stock
router.post('/inventory/receive', (req, res) => {
  try {
    const result = db.receiveDealerStock(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Allocate stock to employee
router.post('/inventory/allocate', (req, res) => {
  try {
    const result = db.allocateStockToEmployee(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Dashboard metrics
router.get('/dashboard/summary', (req, res) => {
  res.json(db.getDashboardSummary());
});

export default router;
