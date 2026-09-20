import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ProductImage } from '../common/ProductImage';
import { 
  Package, Search, DollarSign, ArrowUpRight, ArrowDownLeft, 
  Sparkles, CheckCircle2, AlertTriangle, Layers, Info, X, 
  Truck, RotateCcw, Plus, SlidersHorizontal, Eye, ShieldAlert, 
  TrendingUp, Clock, FileText, CheckCircle, AlertCircle, Bell, Download, Wrench, RefreshCw
} from 'lucide-react';
import { generateInventoryPDFReport } from '../../utils/pdfReportGenerator';

const PRODUCT_IMAGES = {
  1: { image: '/images/amirthaa_milk_200ml.png', sizeBadge: '200 ml', category: 'Dairy', bgTone: 'from-blue-500/10 to-blue-50 border-blue-200', textTone: 'text-blue-700' },
  5: { image: '/images/amirthaa_milk_500ml.png', sizeBadge: '500 ml', category: 'Dairy', bgTone: 'from-blue-500/10 to-blue-50 border-blue-200', textTone: 'text-blue-700' },
  6: { image: '/images/amirthaa_milk_1l.jpg', sizeBadge: '1 Ltr', category: 'Dairy', bgTone: 'from-blue-500/10 to-blue-50 border-blue-200', textTone: 'text-blue-700' },
  7: { image: '/images/amirthaa_curd_200ml.jpg', sizeBadge: '200 ml', category: 'Curd', bgTone: 'from-amber-500/10 to-amber-50 border-amber-200', textTone: 'text-amber-700' },
  8: { image: '/images/amirthaa_curd_500ml.jpg', sizeBadge: '500 ml', category: 'Curd', bgTone: 'from-amber-500/10 to-amber-50 border-amber-200', textTone: 'text-amber-700' },
  9: { image: '/images/amirthaa_curd_1l.jpg', sizeBadge: '1 Ltr', category: 'Curd', bgTone: 'from-amber-500/10 to-amber-50 border-amber-200', textTone: 'text-amber-700' },
  10: { image: '/images/coccola_200ml.png', sizeBadge: '200 ml', category: 'Beverage', bgTone: 'from-rose-500/10 to-rose-50 border-rose-200', textTone: 'text-rose-700' },
  3: { image: '/images/coccola_500ml.png', sizeBadge: '500 ml', category: 'Beverage', bgTone: 'from-rose-500/10 to-rose-50 border-rose-200', textTone: 'text-rose-700' },
  11: { image: '/images/coccola_1l.png', sizeBadge: '1 Ltr', category: 'Beverage', bgTone: 'from-rose-500/10 to-rose-50 border-rose-200', textTone: 'text-rose-700' },
  12: { image: '/images/juice_hero.jpg', sizeBadge: 'Fresh Pack', category: 'Juice', bgTone: 'from-orange-500/10 to-orange-50 border-orange-200', textTone: 'text-orange-700' },
  15: { image: '/images/tata_hero.jpg', sizeBadge: 'Gluco Can', category: 'Juice', bgTone: 'from-yellow-500/10 to-yellow-50 border-yellow-200', textTone: 'text-yellow-700' },
  18: { image: '/images/aquafresh_water_200ml.png', sizeBadge: '200 ml', category: 'Water', bgTone: 'from-cyan-500/10 to-cyan-50 border-cyan-200', textTone: 'text-cyan-700' },
  19: { image: '/images/aquafresh_water_500ml.png', sizeBadge: '500 ml', category: 'Water', bgTone: 'from-cyan-500/10 to-cyan-50 border-cyan-200', textTone: 'text-cyan-700' },
  2: { image: '/images/aquafresh_water_1l.png', sizeBadge: '1 Ltr', category: 'Water', bgTone: 'from-cyan-500/10 to-cyan-50 border-cyan-200', textTone: 'text-cyan-700' },
  20: { image: '/images/aquafresh_water_2l.png', sizeBadge: '2 Ltr', category: 'Water', bgTone: 'from-cyan-500/10 to-cyan-50 border-cyan-200', textTone: 'text-cyan-700' }
};

export const AdminInventoryView = ({ hideActionButtons }) => {
  const { 
    products = [], categories = [], stockMovements = [], users = [],
    receiveDealerStock, allocateStock, processDriverReturn, submitDriverReturn,
    fetchPendingReturns, fetchEligibleDriversForReturn, fetchDriverExpectedReturn, verifyDriverReturn, fetchDriverReturnHistory, addDamage, fetchStockHistory, 
    fetchReconciliation, fetchAdvancedReconciliation, fetchDamages, fetchDamageSummary, verifyDamageRecord,
    fetchInventoryAlerts, adjustStock, exportReportData,
    currentUser, activeRole 
  } = useApp();

  const userRole = (activeRole || currentUser?.role || '').toUpperCase();
  const isOwnerRole = userRole === 'OWNER' || userRole === 'ADMIN';
  const isDriverRole = userRole === 'EMPLOYEE' || userRole === 'DRIVER';
  const showActionButtons = !hideActionButtons && !isOwnerRole && !isDriverRole;
  const driverUsers = useMemo(() => (users || []).filter(u => u.role === 'EMPLOYEE' || u.role === 'DRIVER'), [users]);

  const [activeTab, setActiveTab] = useState('OVERVIEW'); // OVERVIEW, MOVEMENTS, RECONCILIATION, PENDING_RETURNS, SHORTAGES, DAMAGES, ALERTS
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState('ALL'); // ALL, HEALTHY, LOW, CRITICAL
  const [movementTypeFilter, setMovementTypeFilter] = useState('ALL');
  const [reconcileDriverFilter, setReconcileDriverFilter] = useState('ALL');

  // Phase 5 Inventory Alerts State
  const [alertsData, setAlertsData] = useState(null);
  const [alertStatusFilter, setAlertStatusFilter] = useState('ALL'); // ALL, OUT_OF_STOCK, LOW_STOCK, NORMAL
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  // Damage Records State (Phase 3)
  const [damagesList, setDamagesList] = useState([]);
  const [damageSummary, setDamageSummary] = useState(null);
  const [loadingDamages, setLoadingDamages] = useState(false);
  const [damageStatusFilter, setDamageStatusFilter] = useState('ALL');
  const [damageDriverFilter, setDamageDriverFilter] = useState('ALL');
  const [damageProductFilter, setDamageProductFilter] = useState('ALL');
  const [damageReasonFilter, setDamageReasonFilter] = useState('ALL');
  const [damageDateRange, setDamageDateRange] = useState('ALL');
  const [selectedDamageForVerify, setSelectedDamageForVerify] = useState(null);
  const [verifyActionNotes, setVerifyActionNotes] = useState('');
  const [isVerifyingDamage, setIsVerifyingDamage] = useState(false);

  // Modals state
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [issueConfirmData, setIssueConfirmData] = useState(null); // Before/After stock confirmation dialog
  const [selectedProductTimeline, setSelectedProductTimeline] = useState(null);
  const [productHistoryLogs, setProductHistoryLogs] = useState([]);
  const [reconciliationList, setReconciliationList] = useState([]);
  const [pendingReturnsList, setPendingReturnsList] = useState([]);
  const [returnHistoryList, setReturnHistoryList] = useState([]);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Form states
  const [inwardForm, setInwardForm] = useState({ dealer_name: 'Amirtha Foods Ltd', bill_no: '', product_id: '', quantity: '', unit_type: 'Tray', notes: '' });
  const [issueForm, setIssueForm] = useState({ employee_id: '1', product_id: '', quantity: '', unit_type: 'Tray', notes: '' });
  const [returnForm, setReturnForm] = useState({ employee_id: '1', product_id: '', quantity: '', damaged_quantity: '0', unit_type: 'Tray', notes: '' });
  const [damageForm, setDamageForm] = useState({ damage_source: 'WAREHOUSE', employee_id: '1', product_id: '', quantity: '', unit_type: 'Tray', reason: 'Leakage / Burst', notes: '' });
  const [adjustForm, setAdjustForm] = useState({ product_id: '', quantity: '', unit_type: 'Tray', adjustment_type: 'ADD', reason: 'Physical count correction', notes: '' });

  const loadAlertsData = async () => {
    if (!fetchInventoryAlerts) return;
    try {
      setLoadingAlerts(true);
      const data = await fetchInventoryAlerts();
      if (data) setAlertsData(data);
    } catch (e) {
      console.error("Error loading alerts:", e);
    } finally {
      setLoadingAlerts(false);
    }
  };

  useEffect(() => {
    loadAlertsData();
  }, [products]);

  // Fetch Driver Reconciliation & Pending Returns Data
  const loadReconciliationData = async () => {
    try {
      if (fetchAdvancedReconciliation) {
        const filters = {};
        if (reconcileDriverFilter !== 'ALL') filters.employee_id = reconcileDriverFilter;
        const res = await fetchAdvancedReconciliation(filters);
        if (res && res.success && Array.isArray(res.reconciliation)) {
          setReconciliationList(res.reconciliation);
          return;
        }
      }
      if (fetchReconciliation) {
        const res = await fetchReconciliation(reconcileDriverFilter === 'ALL' ? null : reconcileDriverFilter);
        let list = [];
        if (Array.isArray(res)) {
          list = res;
        } else if (Array.isArray(res?.reconciliation)) {
          list = res.reconciliation;
        } else if (Array.isArray(res?.products)) {
          list = res.products;
        } else if (Array.isArray(res?.data)) {
          list = res.data;
        }
        setReconciliationList(list);
      }
    } catch (err) {
      console.error("Error loading reconciliation data:", err);
    }
  };

  const loadPendingReturnsData = async () => {
    if (!fetchPendingReturns) return;
    try {
      const res = await fetchPendingReturns();
      let list = Array.isArray(res) ? res : [];
      
      const enriched = await Promise.all(list.map(async (driver) => {
        if (Array.isArray(driver.items) && driver.items.length > 0) {
          return {
            ...driver,
            id: driver.id || driver.session_id || driver.driver_id,
            return_no: driver.return_no || (driver.session_id ? `RET-${driver.session_id}` : `RET-${driver.driver_id || driver.id}`),
            date: driver.date || driver.session_date || new Date().toISOString().split('T')[0],
            time: driver.time || (driver.updated_at ? new Date(driver.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending')
          };
        }

        let items = [];
        const driverId = driver.driver_id || driver.employee_id || driver.id;
        if (fetchDriverExpectedReturn && driverId) {
          try {
            const exp = await fetchDriverExpectedReturn(driverId, driver.session_id);
            if (exp && Array.isArray(exp.products)) {
              items = exp.products.map(p => ({
                product_id: p.product_id,
                product_name: p.product_name,
                category_name: p.category_name || 'General',
                unit_name: p.unit_name || 'Box',
                pieces_per_unit: p.pieces_per_unit || 1,
                driver_good_pcs: Number(p.expected_return_good_pcs ?? p.good_return_pieces ?? 0),
                driver_damaged_pcs: Number(p.expected_return_damage_pcs ?? p.damage_return_pieces ?? 0),
                verified_good_pcs: Number(p.verified_good_pieces ?? p.expected_return_good_pcs ?? p.good_return_pieces ?? 0),
                verified_damaged_pcs: Number(p.verified_damage_pieces ?? p.expected_return_damage_pcs ?? p.damage_return_pieces ?? 0)
              }));
            }
          } catch (e) {
            console.error("Error fetching expected return for driver:", e);
          }
        }

        return {
          ...driver,
          id: driver.id || driver.session_id || driver.driver_id,
          return_no: driver.return_no || (driver.session_id ? `RET-${driver.session_id}` : `RET-${driver.driver_id || driver.id}`),
          date: driver.date || driver.session_date || new Date().toISOString().split('T')[0],
          time: driver.time || (driver.updated_at ? new Date(driver.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'),
          items
        };
      }));

      setPendingReturnsList(enriched);
    } catch (err) {
      console.error("Error loading pending returns data:", err);
      setPendingReturnsList([]);
    }
  };

  const loadDamagesData = async () => {
    if (!fetchDamages) return;
    try {
      setLoadingDamages(true);
      const filters = {};
      if (damageStatusFilter !== 'ALL') filters.status = damageStatusFilter;
      if (damageDriverFilter !== 'ALL') filters.employee_id = damageDriverFilter;
      if (damageProductFilter !== 'ALL') filters.product_id = damageProductFilter;
      if (damageReasonFilter !== 'ALL') filters.reason = damageReasonFilter;

      const now = new Date();
      if (damageDateRange === 'TODAY') {
        filters.date = now.toISOString().split('T')[0];
      } else if (damageDateRange === 'YESTERDAY') {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        filters.date = y.toISOString().split('T')[0];
      } else if (damageDateRange === 'THIS_WEEK') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        filters.start_date = d.toISOString().split('T')[0];
        filters.end_date = now.toISOString().split('T')[0];
      } else if (damageDateRange === 'THIS_MONTH') {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        filters.start_date = d.toISOString().split('T')[0];
        filters.end_date = now.toISOString().split('T')[0];
      }

      const [list, summaryRes] = await Promise.all([
        fetchDamages(filters),
        fetchDamageSummary ? fetchDamageSummary(filters) : Promise.resolve(null)
      ]);
      setDamagesList(Array.isArray(list) ? list : []);
      if (summaryRes) setDamageSummary(summaryRes);
    } catch (err) {
      console.error("Error loading damage records:", err);
    } finally {
      setLoadingDamages(false);
    }
  };

  const handleVerifyOrRejectDamage = async (action) => {
    if (!selectedDamageForVerify || !verifyDamageRecord) return;
    try {
      setIsVerifyingDamage(true);
      const res = await verifyDamageRecord(selectedDamageForVerify.id, action, verifyActionNotes);
      if (res.success) {
        setActionSuccess(`Damage #${selectedDamageForVerify.id} successfully marked as ${action === 'VERIFY' ? 'VERIFIED' : 'REJECTED'}`);
        setSelectedDamageForVerify(null);
        setVerifyActionNotes('');
        loadDamagesData();
      } else {
        setActionError(res.message || 'Action failed');
      }
    } catch (err) {
      setActionError(err.message || 'Action error');
    } finally {
      setIsVerifyingDamage(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'RECONCILIATION') {
      loadReconciliationData();
    } else if (activeTab === 'PENDING_RETURNS') {
      loadPendingReturnsData();
    } else if (activeTab === 'DAMAGES') {
      loadDamagesData();
    }
  }, [activeTab, reconcileDriverFilter, damageStatusFilter, damageDriverFilter, damageProductFilter, damageReasonFilter, damageDateRange]);

  // Initial load of damage summary for tab badge
  useEffect(() => {
    if (fetchDamageSummary) {
      fetchDamageSummary().then(res => {
        if (res) setDamageSummary(res);
      }).catch(e => console.error(e));
    }
  }, []);

  // Handle Product Timeline Inspection
  const handleOpenTimeline = async (prod) => {
    setSelectedProductTimeline(prod);
    if (fetchStockHistory) {
      const res = await fetchStockHistory(prod.id);
      setProductHistoryLogs(res.movements || []);
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const catMatch = selectedCategory === 'ALL' || String(p.category_id) === String(selectedCategory) || (p.category && p.category.toLowerCase() === selectedCategory.toLowerCase());
      const nameMatch = !searchQuery || p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      
      const pcsCount = Math.round((p.warehouse_stock_units || 0) * (p.pieces_per_unit || 1));
      const minPcs = (p.min_stock_level || 5) * (p.pieces_per_unit || 1);
      
      let status = 'HEALTHY';
      if (pcsCount === 0) status = 'OUT_OF_STOCK';
      else if (pcsCount <= minPcs) status = 'LOW';

      const statusMatch = stockStatusFilter === 'ALL' || stockStatusFilter === status;

      return catMatch && nameMatch && statusMatch;
    });
  }, [products, selectedCategory, searchQuery, stockStatusFilter]);

  // Overall Inventory Metrics
  const metrics = useMemo(() => {
    let totalValuation = 0;
    let totalPcs = 0;
    let totalTrays = 0;

    (products || []).forEach(p => {
      const stockUnits = Number(p.warehouse_stock_units) || 0;
      const pcsPerUnit = Number(p.pieces_per_unit) || 1;
      const pcs = Math.round(stockUnits * pcsPerUnit);
      const val = stockUnits * (Number(p.unit_selling_price) || 0);

      totalPcs += pcs;
      totalTrays += stockUnits;
      totalValuation += val;
    });

    const inwardCount = (stockMovements || []).filter(m => m.movement_type === 'INWARD').reduce((acc, m) => acc + (Number(m.qty_trays || m.qty_units) || 0), 0);
    const issuedCount = (stockMovements || []).filter(m => m.movement_type === 'DRIVER_ISSUE' || m.movement_type === 'OUTWARD').reduce((acc, m) => acc + (Number(m.qty_trays || m.qty_units) || 0), 0);
    const returnCount = (stockMovements || []).filter(m => m.movement_type === 'DRIVER_RETURN' || m.movement_type === 'RETURN').reduce((acc, m) => acc + (Number(m.qty_trays || m.qty_units) || 0), 0);
    const damageCount = (stockMovements || []).filter(m => (m.movement_type || '').includes('DAMAGE')).reduce((acc, m) => acc + (Number(m.qty_trays || m.qty_units) || 0), 0);

    return {
      totalValuation: Math.round(totalValuation),
      totalPcs: totalPcs,
      totalTrays: parseFloat(Number(totalTrays || 0).toFixed(1)),
      totalVariants: (products || []).length,
      inwardTrays: parseFloat(Number(inwardCount || 0).toFixed(1)),
      issuedTrays: parseFloat(Number(issuedCount || 0).toFixed(1)),
      returnTrays: parseFloat(Number(returnCount || 0).toFixed(1)),
      damageTrays: parseFloat(Number(damageCount || 0).toFixed(1))
    };
  }, [products, stockMovements]);

  // Process Stock Inward Submission
  const handleInwardSubmit = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    if (!inwardForm.product_id || !inwardForm.quantity || Number(inwardForm.quantity) <= 0) {
      setActionError('Please select a valid product and enter a positive quantity.');
      return;
    }

    const payload = {
      dealer_name: inwardForm.dealer_name,
      bill_no: inwardForm.bill_no || `REC-${Date.now()}`,
      created_by: currentUser?.name || 'Store Keeper',
      items: [{
        product_id: Number(inwardForm.product_id),
        quantity: Number(inwardForm.quantity),
        unit_type: inwardForm.unit_type
      }]
    };

    const res = await receiveDealerStock(payload);
    if (res.success) {
      setActionSuccess('Stock Inward received successfully!');
      setShowInwardModal(false);
      setInwardForm({ dealer_name: 'Amirtha Foods Ltd', bill_no: '', product_id: '', quantity: '', unit_type: 'Tray', notes: '' });
    } else {
      setActionError(res.message || 'Failed to process Stock Inward');
    }
  };

  // Initiate Stock Issue (Open Confirmation Dialog with Before/After Math)
  const handleIssueInitiate = (e) => {
    e.preventDefault();
    setActionError('');

    if (!issueForm.product_id || !issueForm.quantity || Number(issueForm.quantity) <= 0) {
      setActionError('Please select a driver, product, and positive quantity.');
      return;
    }

    const prod = products.find(p => Number(p.id) === Number(issueForm.product_id));
    if (!prod) {
      setActionError('Selected product not found.');
      return;
    }

    const pcsPerUnit = prod.pieces_per_unit || 20;
    const isPiece = issueForm.unit_type === 'Piece';
    const requestedTrays = isPiece ? (Number(issueForm.quantity) / pcsPerUnit) : Number(issueForm.quantity);

    // Validate Warehouse Stock Sufficiency
    if ((prod.warehouse_stock_units || 0) < requestedTrays) {
      setActionError(`Insufficient warehouse stock! Requested ${requestedTrays} ${prod.selling_unit}s, but only ${prod.warehouse_stock_units} ${prod.selling_unit}s are available in warehouse.`);
      return;
    }

    const warehouseBefore = prod.warehouse_stock_units || 0;
    const warehouseAfter = parseFloat((warehouseBefore - requestedTrays).toFixed(2));

    setIssueConfirmData({
      employee_id: Number(issueForm.employee_id),
      employee_name: issueForm.employee_id === '1' ? 'Tharun (Driver)' : 'Driver',
      product: prod,
      requested_trays: requestedTrays,
      requested_pcs: isPiece ? Number(issueForm.quantity) : (Number(issueForm.quantity) * pcsPerUnit),
      warehouse_before: warehouseBefore,
      warehouse_after: warehouseAfter,
      unit_type: issueForm.unit_type
    });
  };

  // Confirm Stock Issue Execution
  const handleIssueConfirmExecute = async () => {
    if (!issueConfirmData) return;

    const payload = {
      employee_id: issueConfirmData.employee_id,
      employee_name: issueConfirmData.employee_name,
      created_by: currentUser?.name || 'Store Keeper',
      items: [{
        product_id: issueConfirmData.product.id,
        quantity: issueForm.quantity,
        unit_type: issueForm.unit_type
      }]
    };

    const res = await allocateStock(payload);
    if (res.success) {
      setActionSuccess(`Stock issued to ${issueConfirmData.employee_name} successfully!`);
      setIssueConfirmData(null);
      setShowIssueModal(false);
      setIssueForm({ employee_id: '1', product_id: '', quantity: '', unit_type: 'Tray', notes: '' });
    } else {
      setActionError(res.message || 'Failed to issue stock.');
    }
  };

  // Process Driver Return Submission (Step 1: Driver Declaration)
  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    if (!returnForm.product_id || (Number(returnForm.quantity || 0) <= 0 && Number(returnForm.damaged_quantity || 0) <= 0)) {
      setActionError('Please select a driver, product, and enter valid good or damaged return quantity.');
      return;
    }

    const payload = {
      employee_id: Number(returnForm.employee_id),
      created_by: currentUser?.name || 'Driver',
      items: [{
        product_id: Number(returnForm.product_id),
        quantity: Number(returnForm.quantity || 0),
        damaged_quantity: Number(returnForm.damaged_quantity || 0),
        unit_type: returnForm.unit_type
      }]
    };

    const res = submitDriverReturn ? await submitDriverReturn(payload) : await processDriverReturn(payload);
    if (res.success) {
      setActionSuccess('Driver return declaration submitted successfully! Pending Storekeeper physical verification.');
      setShowReturnModal(false);
      setReturnForm({ employee_id: '1', product_id: '', quantity: '', damaged_quantity: '0', unit_type: 'Tray', notes: '' });
      if (fetchPendingReturns) {
        const list = await fetchPendingReturns();
        setPendingReturnsList(list || []);
      }
    } else {
      setActionError(res.message || 'Failed to process return.');
    }
  };

  // Storekeeper Return Verification (Step 2: Physical Verification & Approval)
  const handleVerifyReturn = async (returnObjOrId) => {
    setActionError('');
    setActionSuccess('');

    try {
      let res;
      if (typeof returnObjOrId === 'object' && returnObjOrId !== null) {
        const driverId = returnObjOrId.driver_id || returnObjOrId.employee_id || returnObjOrId.id;
        const returnPayload = {
          driver_id: Number(driverId),
          session_id: returnObjOrId.session_id ? Number(returnObjOrId.session_id) : undefined,
          verified_by: currentUser?.name || 'Store Keeper',
          products: (returnObjOrId.items || []).map(i => ({
            product_id: Number(i.product_id),
            good_pieces: Number(i.verified_good_pcs ?? i.driver_good_pcs ?? 0),
            damage_pieces: Number(i.verified_damaged_pcs ?? i.driver_damaged_pcs ?? 0),
            damage_reason: 'DRIVER_RETURN_DAMAGE',
            notes: 'Verified via Inventory Panel'
          }))
        };
        res = await verifyDriverReturn(returnPayload);
      } else {
        res = await verifyDriverReturn(returnObjOrId, { verified_by: currentUser?.name || 'Store Keeper' });
      }

      if (res && res.success) {
        setActionSuccess('Driver return physically verified and approved! Warehouse stock updated.');
        await loadPendingReturnsData();
        if (fetchReconciliation) {
          await loadReconciliationData();
        }
      } else {
        setActionError(res?.message || 'Failed to verify driver return.');
      }
    } catch (err) {
      setActionError(err.message || 'Error verifying return');
    }
  };

  // Process Damage Submission
  const handleDamageSubmit = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    if (!damageForm.product_id || !damageForm.quantity || Number(damageForm.quantity) <= 0) {
      setActionError('Please select a product and entering damage quantity.');
      return;
    }

    const payload = {
      damage_source: damageForm.damage_source,
      employee_id: damageForm.damage_source === 'DRIVER' ? Number(damageForm.employee_id) : null,
      product_id: Number(damageForm.product_id),
      quantity: Number(damageForm.quantity),
      unit_type: damageForm.unit_type,
      reason: damageForm.reason,
      notes: damageForm.notes,
      created_by: currentUser?.name || 'Store Keeper'
    };

    const res = await addDamage(payload);
    if (res) {
      setActionSuccess('Damage record created successfully!');
      setShowDamageModal(false);
      setDamageForm({ damage_source: 'WAREHOUSE', employee_id: '1', product_id: '', quantity: '', unit_type: 'Tray', reason: 'Leakage / Burst', notes: '' });
    }
  };

  // Process Transaction-Safe Stock Adjustment (Phase 5)
  const handleStockAdjustSubmit = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    if (!adjustForm.product_id || !adjustForm.quantity) {
      setActionError('Please select a product and enter an adjustment quantity.');
      return;
    }

    try {
      const payload = {
        product_id: Number(adjustForm.product_id),
        quantity: Number(adjustForm.quantity),
        unit_type: adjustForm.unit_type,
        adjustment_type: adjustForm.adjustment_type,
        reason: adjustForm.reason,
        notes: adjustForm.notes
      };

      const res = await adjustStock(payload);
      if (res && res.success) {
        setActionSuccess(`Stock adjusted successfully! ${res.product_name} new stock: ${res.new_warehouse_stock_units} Trays.`);
        setShowAdjustModal(false);
        setAdjustForm({ product_id: '', quantity: '', unit_type: 'Tray', adjustment_type: 'ADD', reason: 'Physical count correction', notes: '' });
        loadAlertsData();
      } else {
        setActionError(res?.message || 'Failed to adjust stock.');
      }
    } catch (err) {
      setActionError(err.message || 'Error executing stock adjustment.');
    }
  };

  return (
    <div className="space-y-5 pb-6">
      
      {/* Top Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                DISTRIBUTION INVENTORY CONTROL
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  🟢 Ledger Traceable
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">Warehouse Inward, Driver Distribution, Route Returns, Damage Ledger & Stock Alerts</p>
            </div>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="relative z-10 grid grid-cols-2 sm:flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {showActionButtons && (
            <>
              <button
                onClick={() => setShowInwardModal(true)}
                className="px-3.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-1.5 transition min-h-[44px]"
              >
                <Plus className="w-4 h-4" /> Stock Inward
              </button>
              <button
                onClick={() => setShowIssueModal(true)}
                className="px-3.5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-1.5 transition min-h-[44px]"
              >
                <Truck className="w-4 h-4" /> Issue to Driver
              </button>
              <button
                onClick={() => setShowReturnModal(true)}
                className="px-3.5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-1.5 transition min-h-[44px]"
              >
                <RotateCcw className="w-4 h-4" /> Driver Return
              </button>
              <button
                onClick={() => setShowDamageModal(true)}
                className="px-3.5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-1.5 transition min-h-[44px]"
              >
                <AlertTriangle className="w-4 h-4" /> Record Damage
              </button>
            </>
          )}
          {!isDriverRole && (
            <>
              <button
                onClick={() => setShowAdjustModal(true)}
                className="px-3.5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-1.5 transition min-h-[44px]"
              >
                <Wrench className="w-4 h-4" /> Adjust Stock
              </button>
              <button
                onClick={() => generateInventoryPDFReport({ inventory: products })}
                className="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-1.5 transition min-h-[44px] cursor-pointer"
                title="Download current warehouse inventory PDF Report"
              >
                <Download className="w-4 h-4" /> Download PDF Report
              </button>
            </>
          )}
        </div>
      </div>

      {/* Global Action Alerts */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> {actionSuccess}</span>
          <button onClick={() => setActionSuccess('')}><X className="w-4 h-4 text-emerald-600" /></button>
        </div>
      )}
      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-600" /> {actionError}</span>
          <button onClick={() => setActionError('')}><X className="w-4 h-4 text-rose-600" /></button>
        </div>
      )}

      {/* KPI Overview Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-emerald-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Stock Asset Valuation</span>
          <div className="font-mono font-black text-2xl text-emerald-600 mt-1">
            ₹{metrics.totalValuation.toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-blue-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Total Pieces Available</span>
          <div className="font-mono font-black text-2xl text-blue-600 mt-1">
            {metrics.totalPcs.toLocaleString()} <span className="text-xs font-bold text-blue-700">Pcs</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-indigo-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Inward vs Issued (Trays)</span>
          <div className="font-mono font-black text-lg text-indigo-700 mt-1">
            In: {metrics.inwardTrays} | Out: {metrics.issuedTrays}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-purple-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Returns vs Damage</span>
          <div className="font-mono font-black text-lg text-purple-700 mt-1">
            Ret: {metrics.returnTrays} | Dam: {metrics.damageTrays}
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1 text-xs overflow-x-auto scrollbar-none whitespace-nowrap">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2.5 rounded-2xl font-black transition flex items-center gap-1.5 ${
            activeTab === 'OVERVIEW'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Package className="w-4 h-4" /> Warehouse Stock Overview
        </button>

        <button
          onClick={() => setActiveTab('MOVEMENTS')}
          className={`px-4 py-2.5 rounded-2xl font-black transition flex items-center gap-1.5 ${
            activeTab === 'MOVEMENTS'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" /> Stock Movement History Ledger ({stockMovements.length})
        </button>

        {!isDriverRole && (
          <button
            onClick={() => setActiveTab('PENDING_RETURNS')}
            className={`px-4 py-2.5 rounded-2xl font-black transition flex items-center gap-1.5 relative ${
              activeTab === 'PENDING_RETURNS'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
            }`}
          >
            <Clock className="w-4 h-4" /> Storekeeper Return Approvals
            {pendingReturnsList.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                {pendingReturnsList.length}
              </span>
            )}
          </button>
        )}

        {!isDriverRole && (
          <button
            onClick={() => setActiveTab('RECONCILIATION')}
            className={`px-4 py-2.5 rounded-2xl font-black transition flex items-center gap-1.5 ${
              activeTab === 'RECONCILIATION'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" /> Driver Route Stock Reconciliation Audit
          </button>
        )}

        <button
          onClick={() => setActiveTab('DAMAGES')}
          className={`px-4 py-2.5 rounded-2xl font-black transition flex items-center gap-1.5 relative ${
            activeTab === 'DAMAGES'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> Damage & Wastage Records
          {damageSummary?.summary?.pending_count > 0 && (
            <span className="ml-1 bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
              {damageSummary.summary.pending_count} PENDING
            </span>
          )}
        </button>

        <button
          onClick={() => { setActiveTab('ALERTS'); loadAlertsData(); }}
          className={`px-4 py-2.5 rounded-2xl font-black transition flex items-center gap-1.5 relative ${
            activeTab === 'ALERTS'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
          }`}
        >
          <Bell className="w-4 h-4" /> Stock Alerts & Reorders
          {alertsData?.summary?.low_stock_count > 0 && (
            <span className="ml-1 bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
              {alertsData.summary.low_stock_count} LOW
            </span>
          )}
          {alertsData?.summary?.out_of_stock_count > 0 && (
            <span className="ml-1 bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
              {alertsData.summary.out_of_stock_count} OOS
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: WAREHOUSE STOCK OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
          
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="p-1.5 font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value)}
                className="p-1.5 font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              >
                <option value="ALL">All Stock Statuses</option>
                <option value="HEALTHY">🟢 Healthy Stock</option>
                <option value="LOW">🟡 Low Stock</option>
                <option value="OUT_OF_STOCK">🔴 Out of Stock</option>
              </select>
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map(prod => {
              const actualImage = prod.image_url || prod.image || (PRODUCT_IMAGES[prod.id]?.image) || '';
              const meta = {
                image: actualImage,
                sizeBadge: prod.pack_size || (PRODUCT_IMAGES[prod.id]?.sizeBadge) || 'Standard',
                category: prod.category || prod.category_name || (PRODUCT_IMAGES[prod.id]?.category) || 'Product',
                bgTone: (PRODUCT_IMAGES[prod.id]?.bgTone) || 'from-slate-500/10 to-slate-50 border-slate-200',
                textTone: (PRODUCT_IMAGES[prod.id]?.textTone) || 'text-slate-700'
              };
              const pcsCount = Math.round((prod.warehouse_stock_units || 0) * (prod.pieces_per_unit || 1));
              const stockValuation = Math.round((prod.warehouse_stock_units || 0) * (prod.unit_selling_price || 0));

              return (
                <div 
                  key={prod.id} 
                  onClick={() => handleOpenTimeline(prod)}
                  className="relative group bg-white rounded-3xl p-3.5 border border-slate-200 hover:border-blue-400 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-pointer"
                >
                  
                  {/* Hero Photo Container */}
                  <div className={`relative w-full h-44 rounded-2xl bg-gradient-to-b ${meta.bgTone || 'from-slate-50 to-slate-100/80'} border border-slate-200/80 overflow-hidden flex items-center justify-center pt-9 pb-2 px-3 group-hover:scale-[1.01] transition-transform duration-300`}>
                    
                    {/* Size & Ratio Badge */}
                    <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-xs backdrop-blur-md bg-white/95 ${meta.textTone} border-slate-200`}>
                        {meta.sizeBadge}
                      </span>
                      <span className="text-[9px] font-mono font-bold bg-slate-900/80 text-white px-2 py-0.5 rounded-full backdrop-blur-md">
                        1 {prod.selling_unit || 'Tray'} = {prod.pieces_per_unit || 20} Pcs
                      </span>
                    </div>

                    {/* Price Tag */}
                    <div className="absolute top-2 right-2 z-10">
                      <span className="font-mono font-black text-[11px] text-slate-800 bg-white/95 backdrop-blur-md px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                        ₹{prod.unit_selling_price} / {prod.selling_unit}
                      </span>
                    </div>

                    {/* Product Photo */}
                    <ProductImage
                      src={actualImage}
                      alt={prod.display_name}
                      size={96}
                      icon={prod.icon}
                    />
                  </div>

                  {/* Details Footer */}
                  <div className="pt-3 space-y-2.5">
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <h4 className="font-black text-xs text-slate-900 leading-tight truncate group-hover:text-blue-600 transition-colors">
                          {prod.display_name}
                        </h4>
                        <span className="text-[9px] text-slate-400 font-mono">SKU: {prod.sku}</span>
                      </div>
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 shrink-0">
                        {prod.category || 'Dairy'}
                      </span>
                    </div>

                    {/* Highlighted Stock Box */}
                    <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Available Stock:</span>
                        <div className="flex items-baseline gap-1">
                          <span className="font-mono font-black text-base text-emerald-600 leading-none">
                            {pcsCount.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-extrabold uppercase">Pcs</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] border-t border-slate-200/60 pt-1">
                        <span className="font-mono font-bold text-indigo-600">
                          ({prod.warehouse_stock_units} {prod.selling_unit || 'Trays'})
                        </span>
                        <span className="font-mono font-bold text-purple-700">
                          Val: ₹{stockValuation.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-slate-400">Click to view timeline audit</span>
                      <span className="text-blue-600 flex items-center gap-0.5">Timeline →</span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* TAB 2: STOCK MOVEMENT HISTORY LEDGER */}
      {activeTab === 'MOVEMENTS' && (
        <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Stock Movement Ledger (சரக்கு மாற்ற பதிவேடு)
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Immutable audit log of all Stock Inward, Driver Issues, Returns, and Damage</p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <select
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
                className="p-1.5 font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              >
                <option value="ALL">All Movement Types</option>
                <option value="INWARD">📥 Stock Inward</option>
                <option value="DRIVER_ISSUE">🚚 Driver Issue</option>
                <option value="DRIVER_RETURN">🔄 Driver Return</option>
                <option value="DRIVER_DAMAGE">⚠️ Driver Damage</option>
                <option value="WAREHOUSE_DAMAGE">💥 Warehouse Damage</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 font-extrabold text-slate-700 bg-slate-50 uppercase tracking-wider">
                  <th className="p-3 pl-4">Date & Ref #</th>
                  <th className="p-3">Product & Category</th>
                  <th className="p-3 text-center">Movement Type</th>
                  <th className="p-3 text-center">Quantity (Trays / Pcs)</th>
                  <th className="p-3">Source → Destination</th>
                  <th className="p-3">Employee / Driver</th>
                  <th className="p-3 pr-4">Created By & Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockMovements.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-400 font-bold">No stock movements recorded yet.</td>
                  </tr>
                ) : (
                  stockMovements
                    .filter(m => movementTypeFilter === 'ALL' || m.movement_type === movementTypeFilter)
                    .map(m => (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 pl-4">
                          <span className="font-mono font-black text-slate-900 block">#{m.reference_id}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{m.date} • {m.time}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-extrabold text-slate-900 block">{m.product_name}</span>
                          <span className="text-[9px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 inline-block">{m.category_name}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border inline-block ${
                            m.movement_type === 'INWARD' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            m.movement_type === 'DRIVER_ISSUE' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                            m.movement_type === 'DRIVER_RETURN' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                            'bg-rose-100 text-rose-800 border-rose-300'
                          }`}>
                            {m.movement_type}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono font-black">
                          {m.qty_trays} {m.unit_name || 'Trays'} ({m.qty_pieces} Pcs)
                        </td>
                        <td className="p-3 text-xs font-bold text-slate-700">
                          {m.source_location} → {m.destination_location}
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          {m.employee_name || '—'}
                        </td>
                        <td className="p-3 pr-4 text-xs">
                          <span className="font-extrabold text-slate-900 block">{m.created_by}</span>
                          <span className="text-[10px] text-slate-500">{m.reason || 'Routine movement'}</span>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* TAB: STOREKEEPER RETURN APPROVALS (PENDING VERIFICATION) */}
      {activeTab === 'PENDING_RETURNS' && !isDriverRole && (
        <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                Storekeeper Driver Return Approvals (டிரைவர் ரிட்டர்ன் சரிபார்ப்பு)
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Physical goods verification before updating warehouse stock & damage ledgers.</p>
            </div>
            <button onClick={loadPendingReturnsData} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200">
              🔄 Refresh List
            </button>
          </div>

          {pendingReturnsList.length === 0 ? (
            <div className="p-8 text-center bg-amber-50/50 rounded-2xl border border-amber-200/50">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h4 className="font-black text-sm text-slate-800">All Driver Returns Verified!</h4>
              <p className="text-xs text-slate-500 font-semibold mt-1">There are no pending driver return declarations waiting for physical storekeeper verification.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingReturnsList.map(ret => (
                <div key={ret.id} className="p-4 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50/50 to-orange-50/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                    <div>
                      <span className="font-black text-slate-900 text-sm">{ret.driver_name || ret.employee_name}</span>
                      <span className="ml-2 font-mono text-xs text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-bold">#{ret.return_no}</span>
                      <span className="ml-2 text-xs text-slate-500">{ret.date} • {ret.time}</span>
                    </div>
                    <span className="px-3 py-1 bg-amber-500 text-white rounded-full text-[10px] font-black uppercase tracking-wider">
                      Pending Physical Verification
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs bg-white rounded-xl border border-slate-200">
                      <thead>
                        <tr className="bg-slate-100 font-extrabold text-slate-700 border-b border-slate-200">
                          <th className="p-2.5">Product & Category</th>
                          <th className="p-2.5 text-center">Driver Declared Good</th>
                          <th className="p-2.5 text-center">Driver Declared Damaged</th>
                          <th className="p-2.5 text-center">Physical Good Verified</th>
                          <th className="p-2.5 text-center">Physical Damage Verified</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold">
                        {(ret.items || []).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-3 text-center text-slate-400 font-medium">
                              No product line items found for this return session
                            </td>
                          </tr>
                        ) : (
                          (ret.items || []).map((item, idx) => (
                            <tr key={idx}>
                              <td className="p-2.5">
                                <span className="font-black text-slate-900 block">{item.product_name}</span>
                                <span className="text-[9px] text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">{item.category_name}</span>
                              </td>
                              <td className="p-2.5 text-center font-mono text-emerald-700">
                                {Math.round(item.driver_good_pcs / (item.pieces_per_unit || 1))} {item.unit_name || 'Box'}s ({item.driver_good_pcs} Pcs)
                              </td>
                              <td className="p-2.5 text-center font-mono text-rose-700">
                                {Math.round(item.driver_damaged_pcs / (item.pieces_per_unit || 1))} {item.unit_name || 'Box'}s ({item.driver_damaged_pcs} Pcs)
                              </td>
                              <td className="p-2.5 text-center font-mono font-black text-emerald-800">
                                {item.verified_good_pcs} Pcs
                              </td>
                              <td className="p-2.5 text-center font-mono font-black text-rose-800">
                                {item.verified_damaged_pcs} Pcs
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                      onClick={() => handleVerifyReturn(ret)}
                      className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-black text-xs hover:bg-emerald-700 shadow-md flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" /> Approve & Update Warehouse Stock
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PRODUCT-LEVEL DRIVER RECONCILIATION AUDIT */}
      {activeTab === 'RECONCILIATION' && !isDriverRole && (
        <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-600" />
                Product-Level Driver Route Stock Reconciliation Audit
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Strict Ledger Audit Formula: Issued - (Sold + Good Return + Damaged + Balance) = 0</p>
            </div>

            {/* Driver Filter Dropdown */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-extrabold text-slate-600">Filter Driver:</span>
              <select
                value={reconcileDriverFilter}
                onChange={(e) => setReconcileDriverFilter(e.target.value)}
                className="p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
              >
                <option value="ALL">All 6 Drivers</option>
                {driverUsers.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.vehicle_no || 'Route Driver'})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 font-extrabold text-slate-700 bg-slate-50 uppercase tracking-wider">
                  <th className="p-3 pl-4">Driver Name</th>
                  <th className="p-3">Product & Category</th>
                  <th className="p-3 text-center">Issued</th>
                  <th className="p-3 text-center">Sold</th>
                  <th className="p-3 text-center">Good Return</th>
                  <th className="p-3 text-center">Damaged</th>
                  <th className="p-3 text-center">Current Bal</th>
                  <th className="p-3 text-center">Variance</th>
                  <th className="p-3 pr-4 text-center">Audit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!Array.isArray(reconciliationList) || reconciliationList.length === 0) ? (
                  <tr>
                    <td colSpan="9" className="p-8 text-center text-slate-400 font-bold">No driver stock allocation data recorded yet.</td>
                  </tr>
                ) : (
                  reconciliationList.map((rec, idx) => {
                    const piecesPerUnit = Number(rec.pieces_per_unit || 1);
                    const sellingUnit = rec.selling_unit || rec.unit || 'Tray';
                    const issuedTrays = Number(rec.issued_trays ?? rec.allocated ?? 0);
                    const issuedPcs = Number(rec.issued_pcs ?? (issuedTrays * piecesPerUnit));
                    const soldTrays = Number(rec.sold_trays ?? rec.sold ?? 0);
                    const soldPcs = Number(rec.sold_pcs ?? (soldTrays * piecesPerUnit));
                    const returnTrays = Number(rec.good_return_trays ?? rec.good_return ?? 0);
                    const returnPcs = Number(rec.good_return_pcs ?? (returnTrays * piecesPerUnit));
                    const dmgTrays = Number(rec.damaged_trays ?? rec.damage ?? 0);
                    const dmgPcs = Number(rec.damaged_pcs ?? (dmgTrays * piecesPerUnit));
                    const balTrays = Number(rec.current_balance_trays ?? rec.remaining_physical ?? 0);
                    const balPcs = Number(rec.current_balance_pcs ?? (balTrays * piecesPerUnit));
                    const variancePcs = Number(rec.variance_pcs ?? rec.difference ?? 0);
                    const isReconciled = rec.status === 'RECONCILED' || rec.is_reconciled === true || variancePcs === 0;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 pl-4">
                          <span className="font-black text-slate-900 text-xs block">{rec.driver_name || 'Driver'}</span>
                          <span className="text-[9px] text-slate-400 font-mono">{rec.vehicle_no || 'Route Driver'}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-extrabold text-slate-900 block">{rec.product_name}</span>
                          <span className="text-[9px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 inline-block">{rec.category_name || 'Dairy'}</span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-blue-700">
                          {issuedTrays} {sellingUnit}s ({issuedPcs} Pcs)
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-emerald-700">
                          {soldTrays} {sellingUnit}s ({soldPcs} Pcs)
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-purple-700">
                          {returnTrays} {sellingUnit}s ({returnPcs} Pcs)
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-rose-700">
                          {dmgTrays} {sellingUnit}s ({dmgPcs} Pcs)
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-900">
                          {balTrays} {sellingUnit}s ({balPcs} Pcs)
                        </td>
                        <td className="p-3 text-center font-mono font-black">
                          {variancePcs === 0 ? '0 Pcs' : `${variancePcs > 0 ? '+' : ''}${variancePcs} Pcs`}
                        </td>
                        <td className="p-3 pr-4 text-center">
                          {isReconciled ? (
                            <span className="px-3 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> RECONCILED
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> MISMATCH ({variancePcs} Pcs)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: DAMAGES & WASTAGE MANAGEMENT (PHASE 3) */}
      {activeTab === 'DAMAGES' && (
        <div className="space-y-4">
          {/* Damages KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-rose-500 border border-slate-200 shadow-xs">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-tight block">Total Damage Loss</span>
              <div className="font-mono font-black text-2xl text-rose-600 mt-1">
                ₹{Number(damageSummary?.summary?.total_damage_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                {damageSummary?.summary?.total_records || damagesList.length} total entries
              </span>
            </div>

            <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-amber-500 border border-slate-200 shadow-xs">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-tight block">Pending Verification</span>
              <div className="font-mono font-black text-2xl text-amber-600 mt-1">
                ₹{Number(damageSummary?.summary?.pending_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-amber-700 font-bold mt-0.5 block">
                {damageSummary?.summary?.pending_count || 0} records awaiting review
              </span>
            </div>

            <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-emerald-500 border border-slate-200 shadow-xs">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-tight block">Verified Damage Loss</span>
              <div className="font-mono font-black text-2xl text-emerald-600 mt-1">
                ₹{Number(damageSummary?.summary?.verified_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-emerald-700 font-bold mt-0.5 block">
                {damageSummary?.summary?.verified_count || 0} approved entries
              </span>
            </div>

            <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-slate-500 border border-slate-200 shadow-xs">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-tight block">Rejected Claims</span>
              <div className="font-mono font-black text-2xl text-slate-700 mt-1">
                ₹{Number(damageSummary?.summary?.rejected_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500 font-bold mt-0.5 block">
                {damageSummary?.summary?.rejected_count || 0} rejected records
              </span>
            </div>

            <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-indigo-500 border border-slate-200 shadow-xs col-span-2 lg:col-span-1">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-tight block">Total Damaged Pieces</span>
              <div className="font-mono font-black text-2xl text-indigo-700 mt-1">
                {Math.round(Number(damageSummary?.summary?.total_base_pieces || 0)).toLocaleString()} <span className="text-xs font-bold text-indigo-500">Pcs</span>
              </div>
              <span className="text-[10px] text-indigo-600 font-medium mt-0.5 block">
                Dynamic Piece Packaging
              </span>
            </div>
          </div>

          {/* Top Driver & Product Analytics Overview */}
          {damageSummary && ((damageSummary.top_drivers && damageSummary.top_drivers.length > 0) || (damageSummary.top_products && damageSummary.top_products.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Top Drivers Card */}
              {damageSummary.top_drivers && damageSummary.top_drivers.length > 0 && (
                <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-amber-600" /> Driver Damage Rankings
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Sorted by Total Loss</span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {damageSummary.top_drivers.slice(0, 5).map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                        <div>
                          <span className="font-black text-slate-900">{d.driver_name}</span>
                          <span className="text-[10px] text-slate-500 ml-1.5">({d.route_name || 'Route'})</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-rose-600 block">₹{Number(d.total_cost).toFixed(2)}</span>
                          <span className="text-[9px] text-slate-400 font-mono">{Math.round(Number(d.total_pieces))} Pcs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Products Card */}
              {damageSummary.top_products && damageSummary.top_products.length > 0 && (
                <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-rose-600" /> Top Damaged Products
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">High Loss Products</span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {damageSummary.top_products.slice(0, 5).map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="truncate max-w-[180px]">
                          <span className="font-black text-slate-900">{p.product_name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-rose-600 block">₹{Number(p.total_cost).toFixed(2)}</span>
                          <span className="text-[9px] text-slate-400 font-mono">{Math.round(Number(p.total_pieces))} Pieces</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main Damage Records Grid & Filters */}
          <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
            {/* Header & Filter Bar */}
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                    Damage & Wastage Audit Records
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Real-time persisted damage records • Dynamic Tray/Piece unit conversion & financial accounting
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={loadDamagesData}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Refresh
                  </button>
                  {showActionButtons && (
                    <button
                      onClick={() => setShowDamageModal(true)}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" /> Record Damage
                    </button>
                  )}
                </div>
              </div>

              {/* Advanced Filter Controls */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs pt-1">
                {/* Status Filter */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Status</label>
                  <select
                    value={damageStatusFilter}
                    onChange={(e) => setDamageStatusFilter(e.target.value)}
                    className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">Pending Verification</option>
                    <option value="VERIFIED">Verified Damage</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>

                {/* Date Range Filter */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Time Period</label>
                  <select
                    value={damageDateRange}
                    onChange={(e) => setDamageDateRange(e.target.value)}
                    className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="ALL">All Time</option>
                    <option value="TODAY">Today</option>
                    <option value="YESTERDAY">Yesterday</option>
                    <option value="THIS_WEEK">Last 7 Days</option>
                    <option value="THIS_MONTH">This Month</option>
                  </select>
                </div>

                {/* Driver Filter */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Driver / Source</label>
                  <select
                    value={damageDriverFilter}
                    onChange={(e) => setDamageDriverFilter(e.target.value)}
                    className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="ALL">All Drivers & Warehouse</option>
                    {driverUsers.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {/* Product Filter */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Product</label>
                  <select
                    value={damageProductFilter}
                    onChange={(e) => setDamageProductFilter(e.target.value)}
                    className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="ALL">All Products</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.display_name || p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Reason Filter */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Damage Reason</label>
                  <select
                    value={damageReasonFilter}
                    onChange={(e) => setDamageReasonFilter(e.target.value)}
                    className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="ALL">All Reasons</option>
                    <option value="Leakage">Leakage / Burst</option>
                    <option value="Broken">Damaged / Broken</option>
                    <option value="Expired">Expired</option>
                    <option value="Missing">Missing</option>
                    <option value="Transport">Transport Damage</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table of Damage Records */}
            {loadingDamages ? (
              <div className="py-12 text-center text-xs text-slate-500 font-bold">
                <div className="w-7 h-7 border-3 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Loading damage records...
              </div>
            ) : damagesList.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
                No damage records match the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 font-extrabold text-slate-700 bg-slate-50 uppercase tracking-wider">
                      <th className="p-3 pl-4">Date & Time</th>
                      <th className="p-3">Driver / Route</th>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-center">Damage Qty</th>
                      <th className="p-3 text-center">Base Qty</th>
                      <th className="p-3 text-right">Damage Cost</th>
                      <th className="p-3">Reason / Notes</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 pr-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {damagesList.map((dmg) => {
                      const isPiece = String(dmg.damage_unit || dmg.unit || '').toLowerCase().includes('piece');
                      const baseQty = Number(dmg.base_quantity || (isPiece ? dmg.qty_units : dmg.qty_units * Number(dmg.pieces_per_unit || 1)));
                      const status = (dmg.status || 'PENDING').toUpperCase();

                      return (
                        <tr key={dmg.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 pl-4 whitespace-nowrap">
                            <span className="font-bold text-slate-900 block">
                              {dmg.created_at ? new Date(dmg.created_at).toLocaleDateString() : 'Today'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {dmg.created_at ? new Date(dmg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </td>

                          <td className="p-3">
                            <span className="font-extrabold text-slate-900 block">
                              {dmg.driver_name || dmg.employee_name || 'Warehouse Direct'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {dmg.route_name ? `Route: ${dmg.route_name}` : (dmg.vehicle_number || 'Direct Write-off')}
                            </span>
                          </td>

                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {dmg.product_image ? (
                                <img src={dmg.product_image} alt="" className="w-6 h-6 rounded object-contain bg-white border border-slate-200 p-0.5" />
                              ) : (
                                <span>📦</span>
                              )}
                              <span className="font-bold text-slate-900">{dmg.product_name}</span>
                            </div>
                          </td>

                          <td className="p-3 text-center font-mono font-bold text-rose-700">
                            {Number(dmg.qty_units)} {dmg.damage_unit || dmg.unit || 'Tray'}
                          </td>

                          <td className="p-3 text-center font-mono text-slate-600">
                            {Math.round(baseQty)} Pcs
                          </td>

                          <td className="p-3 text-right font-mono font-black text-rose-600">
                            ₹{Number(dmg.damage_cost || 0).toFixed(2)}
                          </td>

                          <td className="p-3 max-w-[200px]">
                            <span className="font-semibold text-slate-800 block truncate">{dmg.reason || 'Wastage'}</span>
                            {dmg.notes && dmg.notes !== dmg.reason && (
                              <span className="text-[10px] text-slate-400 block truncate">{dmg.notes}</span>
                            )}
                          </td>

                          <td className="p-3 text-center whitespace-nowrap">
                            {status === 'VERIFIED' ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-emerald-600" /> VERIFIED
                              </span>
                            ) : status === 'REJECTED' ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-rose-600" /> REJECTED
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1 animate-pulse">
                                <Clock className="w-3 h-3 text-amber-700" /> PENDING
                              </span>
                            )}
                          </td>

                          <td className="p-3 pr-4 text-center whitespace-nowrap">
                            {status === 'PENDING' && !isDriverRole ? (
                              <button
                                onClick={() => {
                                  setSelectedDamageForVerify(dmg);
                                  setVerifyActionNotes('');
                                }}
                                className="px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-[11px] rounded-lg shadow-xs transition cursor-pointer"
                              >
                                Review & Verify
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">
                                {dmg.verified_by_name ? `By ${dmg.verified_by_name}` : 'Completed'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DAMAGE VERIFY / REJECT ACTION MODAL */}
      {selectedDamageForVerify && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                Review & Verify Damage Record #{selectedDamageForVerify.id}
              </h3>
              <button 
                type="button" 
                onClick={() => setSelectedDamageForVerify(null)}
                disabled={isVerifyingDamage}
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Damage Details Summary Box */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Driver / Source:</span>
                <span className="font-black text-slate-900">{selectedDamageForVerify.driver_name || selectedDamageForVerify.employee_name || 'Warehouse'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Product:</span>
                <span className="font-black text-slate-900">{selectedDamageForVerify.product_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Damage Quantity:</span>
                <span className="font-mono font-black text-rose-600">
                  {selectedDamageForVerify.qty_units} {selectedDamageForVerify.damage_unit || selectedDamageForVerify.unit} ({Math.round(selectedDamageForVerify.base_quantity || selectedDamageForVerify.qty_units)} Pcs)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Financial Loss Amount:</span>
                <span className="font-mono font-black text-rose-700 text-sm">
                  ₹{Number(selectedDamageForVerify.damage_cost || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Reported Reason:</span>
                <span className="font-semibold text-slate-800">{selectedDamageForVerify.reason || 'Wastage'}</span>
              </div>
            </div>

            {/* Verification Notes */}
            <div className="space-y-1 text-xs">
              <label className="font-extrabold text-slate-700 block">Verification Notes / Inspection Remarks:</label>
              <textarea
                value={verifyActionNotes}
                onChange={(e) => setVerifyActionNotes(e.target.value)}
                placeholder="e.g. Physical pouch verified broken by Storekeeper. Approved for wastage write-off."
                rows={2}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-medium">
              💡 <b>Note:</b> Verifying will record the financial loss and inventory ledger movement (DAMAGE). Damaged stock will <b>NOT</b> be added to sellable warehouse inventory.
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={isVerifyingDamage}
                onClick={() => handleVerifyOrRejectDamage('REJECT')}
                className="py-2.5 px-4 bg-rose-100 hover:bg-rose-200 text-rose-800 font-black text-xs rounded-xl border border-rose-300 transition cursor-pointer disabled:opacity-50"
              >
                {isVerifyingDamage ? 'Processing...' : '✕ Reject Claim'}
              </button>

              <button
                type="button"
                disabled={isVerifyingDamage}
                onClick={() => handleVerifyOrRejectDamage('VERIFY')}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isVerifyingDamage ? 'Processing...' : '✓ Approve & Verify'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: STOCK ALERTS & REORDER MANAGEMENT (PHASE 5) */}
      {activeTab === 'ALERTS' && (
        <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-5 shadow-sm">
          
          {/* Header & Status Indicator */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-600" /> Real-time Warehouse Stock Alerts & Reorder Engine
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Automated threshold monitoring against minimum stock levels to prevent stockouts and optimize replenishment.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadAlertsData}
                disabled={loadingAlerts}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs flex items-center gap-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAlerts ? 'animate-spin' : ''}`} /> Refresh Alerts
              </button>
              <button
                onClick={() => exportReportData('inventory', {}, 'csv')}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center gap-1.5 transition shadow-xs"
              >
                <Download className="w-3.5 h-3.5" /> Export Inventory CSV
              </button>
            </div>
          </div>

          {/* Alert KPI Summary Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight block">Total Monitored</span>
              <div className="font-mono font-black text-xl text-slate-900 mt-1">
                {alertsData?.summary?.total_products || products.length} <span className="text-xs font-bold text-slate-500">Products</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-tight block">Normal Stock</span>
              <div className="font-mono font-black text-xl text-emerald-700 mt-1">
                {alertsData?.summary?.normal_count ?? '-'} <span className="text-xs font-bold text-emerald-600">Variants</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="text-[10px] font-black text-amber-700 uppercase tracking-tight block">Low Stock Alerts</span>
              <div className="font-mono font-black text-xl text-amber-700 mt-1">
                {alertsData?.summary?.low_stock_count ?? '-'} <span className="text-xs font-bold text-amber-600">Variants</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
              <span className="text-[10px] font-black text-rose-700 uppercase tracking-tight block">Out of Stock</span>
              <div className="font-mono font-black text-xl text-rose-700 mt-1">
                {alertsData?.summary?.out_of_stock_count ?? '-'} <span className="text-xs font-bold text-rose-600">Variants</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 col-span-2 lg:col-span-1">
              <span className="text-[10px] font-black text-indigo-700 uppercase tracking-tight block">Reorders Required</span>
              <div className="font-mono font-black text-xl text-indigo-700 mt-1">
                {alertsData?.summary?.reorder_needed_count ?? '-'} <span className="text-xs font-bold text-indigo-600">Items ({alertsData?.summary?.total_reorder_qty || 0} Trays)</span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
              {[
                { id: 'ALL', label: 'All Items' },
                { id: 'OUT_OF_STOCK', label: '🔴 Out of Stock' },
                { id: 'LOW_STOCK', label: '🟡 Low Stock' },
                { id: 'NORMAL', label: '🟢 Normal Stock' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setAlertStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl font-extrabold transition ${
                    alertStatusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter by product or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Alerts Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-extrabold">
                  <th className="p-3">Product Variant</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Current Stock</th>
                  <th className="p-3 text-right">Min Stock Threshold</th>
                  <th className="p-3 text-center">Alert Status</th>
                  <th className="p-3 text-center">Reorder Status</th>
                  <th className="p-3 text-right">Suggested Replenishment</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(alertsData?.alerts || [])
                  .filter(item => {
                    if (alertStatusFilter !== 'ALL' && item.stock_status !== alertStatusFilter) return false;
                    if (searchQuery) {
                      const q = searchQuery.toLowerCase();
                      const matchName = (item.display_name || '').toLowerCase().includes(q);
                      const matchSku = (item.sku || '').toLowerCase().includes(q);
                      return matchName || matchSku;
                    }
                    return true;
                  })
                  .map(item => {
                    const isOutOfStock = item.stock_status === 'OUT_OF_STOCK';
                    const isLowStock = item.stock_status === 'LOW_STOCK';
                    return (
                      <tr key={item.product_id} className={`hover:bg-slate-50/80 transition ${isOutOfStock ? 'bg-rose-50/30' : isLowStock ? 'bg-amber-50/30' : ''}`}>
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <ProductImage src={PRODUCT_IMAGES[item.product_id]?.image || ''} size={36} />
                            <div>
                              <span className="font-extrabold text-slate-900 block text-xs">{item.display_name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">SKU: {item.sku} • 1 {item.selling_unit} = {item.pieces_per_unit} Pcs</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-slate-600">{item.category_name || 'General'}</span>
                        </td>
                        <td className="p-3 text-right font-mono">
                          <div className="font-black text-slate-900 text-xs">{item.warehouse_stock_units} {item.selling_unit}s</div>
                          <div className="text-[10px] text-slate-500 font-medium">({item.warehouse_stock_pieces} Pcs)</div>
                        </td>
                        <td className="p-3 text-right font-mono">
                          <div className="font-bold text-slate-700 text-xs">{item.min_stock_level} {item.selling_unit}s</div>
                          <div className="text-[10px] text-slate-400 font-medium">({item.min_stock_pieces} Pcs)</div>
                        </td>
                        <td className="p-3 text-center">
                          {isOutOfStock ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-600" /> OUT OF STOCK
                            </span>
                          ) : isLowStock ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-amber-600" /> LOW STOCK
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-600" /> NORMAL
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {item.reorder_status === 'REORDER_REQUIRED' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-300">
                              REORDER REQUIRED
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">Sufficient</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {item.suggested_reorder_units > 0 ? (
                            <span className="font-black text-indigo-700 text-xs">
                              +{item.suggested_reorder_units} {item.selling_unit}s ({item.suggested_reorder_pieces} Pcs)
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold text-xs">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => {
                              setAdjustForm({
                                product_id: String(item.product_id),
                                quantity: item.suggested_reorder_units > 0 ? String(item.suggested_reorder_units) : '1',
                                unit_type: 'Tray',
                                adjustment_type: 'ADD',
                                reason: 'Physical count correction',
                                notes: ''
                              });
                              setShowAdjustModal(true);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 rounded-lg text-[11px] font-extrabold border border-slate-200 transition"
                          >
                            Adjust Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STOCK INWARD MODAL */}
      {showInwardModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form onSubmit={handleInwardSubmit} className="bg-white border border-slate-200 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto my-auto p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" /> Record Company Stock Inward
              </h3>
              <button type="button" onClick={() => setShowInwardModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Company / Supplier Name</label>
                <input
                  type="text"
                  value={inwardForm.dealer_name}
                  onChange={(e) => setInwardForm({ ...inwardForm, dealer_name: e.target.value })}
                  className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Select Product</label>
                <select
                  value={inwardForm.product_id}
                  onChange={(e) => setInwardForm({ ...inwardForm, product_id: e.target.value })}
                  className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  required
                >
                  <option value="">-- Choose Product Variant --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.display_name} (Stock: {p.warehouse_stock_units} {p.selling_unit})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Quantity</label>
                  <input
                    type="number"
                    step="any"
                    value={inwardForm.quantity}
                    onChange={(e) => setInwardForm({ ...inwardForm, quantity: e.target.value })}
                    placeholder="e.g. 50"
                    className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Unit Type</label>
                  <select
                    value={inwardForm.unit_type}
                    onChange={(e) => setInwardForm({ ...inwardForm, unit_type: e.target.value })}
                    className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="Tray">Tray / Box</option>
                    <option value="Piece">Piece / Pcs</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowInwardModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs">Confirm Inward</button>
            </div>
          </form>
        </div>
      )}

      {/* ISSUE STOCK MODAL */}
      {showIssueModal && !issueConfirmData && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form onSubmit={handleIssueInitiate} className="bg-white border border-slate-200 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto my-auto p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600" /> Issue Stock to Driver Route
              </h3>
              <button type="button" onClick={() => setShowIssueModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Select Driver</label>
                <select
                  value={issueForm.employee_id}
                  onChange={(e) => setIssueForm({ ...issueForm, employee_id: e.target.value })}
                  className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                >
                  {driverUsers.map(d => (
                    <option key={d.id} value={d.id}>🚚 {d.name} ({d.vehicle_no || 'Route Driver'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Select Product</label>
                <select
                  value={issueForm.product_id}
                  onChange={(e) => setIssueForm({ ...issueForm, product_id: e.target.value })}
                  className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  required
                >
                  <option value="">-- Choose Product Variant --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.display_name} (Warehouse Available: {p.warehouse_stock_units} {p.selling_unit}s)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Quantity</label>
                  <input
                    type="number"
                    step="any"
                    value={issueForm.quantity}
                    onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })}
                    placeholder="e.g. 10"
                    className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Unit Type</label>
                  <select
                    value={issueForm.unit_type}
                    onChange={(e) => setIssueForm({ ...issueForm, unit_type: e.target.value })}
                    className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="Tray">Tray / Box</option>
                    <option value="Piece">Piece / Pcs</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowIssueModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-extrabold text-xs">Review & Issue</button>
            </div>
          </form>
        </div>
      )}

      {/* STOCK ISSUE CONFIRMATION DIALOG WITH BEFORE/AFTER MATH */}
      {issueConfirmData && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg border border-blue-200">
                🚚
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900">Confirm Stock Allocation</h3>
                <span className="text-[10px] text-slate-500 font-bold">Verify warehouse stock deduction & driver balance</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans font-bold">Driver Name:</span>
                <span className="font-black text-slate-900">{issueConfirmData.employee_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans font-bold">Product Item:</span>
                <span className="font-black text-blue-700">{issueConfirmData.product.display_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans font-bold">Issue Quantity:</span>
                <span className="font-black text-purple-700">{issueConfirmData.requested_trays} Trays ({issueConfirmData.requested_pcs} Pcs)</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between">
                <span className="text-slate-500 font-sans font-bold">Warehouse Before:</span>
                <span className="font-bold text-slate-900">{issueConfirmData.warehouse_before} Trays</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans font-bold">Warehouse After:</span>
                <span className="font-black text-emerald-600">{issueConfirmData.warehouse_after} Trays</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setIssueConfirmData(null)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">Back / Edit</button>
              <button onClick={handleIssueConfirmExecute} className="px-5 py-2 rounded-xl bg-blue-600 text-white font-extrabold text-xs shadow-md">Confirm Stock Issue</button>
            </div>
          </div>
        </div>
      )}

      {/* DRIVER RETURN MODAL */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleReturnSubmit} className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-600" /> Process Unsold Driver Return
              </h3>
              <button type="button" onClick={() => setShowReturnModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Select Driver</label>
                <select
                  value={returnForm.employee_id}
                  onChange={(e) => setReturnForm({ ...returnForm, employee_id: e.target.value })}
                  className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                >
                  {driverUsers.map(d => (
                    <option key={d.id} value={d.id}>🚚 {d.name} ({d.vehicle_no || 'Route Driver'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Select Product</label>
                <select
                  value={returnForm.product_id}
                  onChange={(e) => setReturnForm({ ...returnForm, product_id: e.target.value })}
                  className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  required
                >
                  <option value="">-- Choose Product Variant --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.display_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Good Return Qty</label>
                  <input
                    type="number"
                    step="any"
                    value={returnForm.quantity}
                    onChange={(e) => setReturnForm({ ...returnForm, quantity: e.target.value })}
                    placeholder="e.g. 4"
                    className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Damaged Return Qty</label>
                  <input
                    type="number"
                    step="any"
                    value={returnForm.damaged_quantity}
                    onChange={(e) => setReturnForm({ ...returnForm, damaged_quantity: e.target.value })}
                    placeholder="e.g. 1"
                    className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Unit Type</label>
                <select
                  value={returnForm.unit_type}
                  onChange={(e) => setReturnForm({ ...returnForm, unit_type: e.target.value })}
                  className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="Tray">Tray / Box</option>
                  <option value="Piece">Piece / Pcs</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowReturnModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-purple-600 text-white font-extrabold text-xs">Submit Return Declaration</button>
            </div>
          </form>
        </div>
      )}

      {/* RECORD DAMAGE MODAL */}
      {showDamageModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleDamageSubmit} className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" /> Record Product Damage
              </h3>
              <button type="button" onClick={() => setShowDamageModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Damage Source</label>
                <select
                  value={damageForm.damage_source}
                  onChange={(e) => setDamageForm({ ...damageForm, damage_source: e.target.value })}
                  className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="WAREHOUSE">🏢 Warehouse Damage</option>
                  <option value="DRIVER">🚚 Driver Route Damage</option>
                </select>
              </div>

              {damageForm.damage_source === 'DRIVER' && (
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Select Driver</label>
                  <select
                    value={damageForm.employee_id}
                    onChange={(e) => setDamageForm({ ...damageForm, employee_id: e.target.value })}
                    className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    {driverUsers.map(d => (
                      <option key={d.id} value={d.id}>🚚 {d.name} ({d.vehicle_no || 'Route Driver'})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Select Product</label>
                <select
                  value={damageForm.product_id}
                  onChange={(e) => setDamageForm({ ...damageForm, product_id: e.target.value })}
                  className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  required
                >
                  <option value="">-- Choose Product Variant --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.display_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Damaged Quantity</label>
                  <input
                    type="number"
                    step="any"
                    value={damageForm.quantity}
                    onChange={(e) => setDamageForm({ ...damageForm, quantity: e.target.value })}
                    placeholder="e.g. 1"
                    className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Unit Type</label>
                  <select
                    value={damageForm.unit_type}
                    onChange={(e) => setDamageForm({ ...damageForm, unit_type: e.target.value })}
                    className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="Tray">Tray / Box</option>
                    <option value="Piece">Piece / Pcs</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowDamageModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-rose-600 text-white font-extrabold text-xs">Record Damage</button>
            </div>
          </form>
        </div>
      )}

      {/* STOCK ADJUSTMENT MODAL (PHASE 5) */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form onSubmit={handleStockAdjustSubmit} className="bg-white border border-slate-200 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto my-auto p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-600" /> Transaction-Safe Stock Adjustment
              </h3>
              <button type="button" onClick={() => setShowAdjustModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Select Product</label>
                <select
                  value={adjustForm.product_id}
                  onChange={(e) => setAdjustForm({ ...adjustForm, product_id: e.target.value })}
                  className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  required
                >
                  <option value="">-- Choose Product Variant --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.display_name} (Current: {p.warehouse_stock_units} Trays / {Math.round(p.warehouse_stock_units * p.pieces_per_unit)} Pcs)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Adjustment Mode</label>
                  <select
                    value={adjustForm.adjustment_type}
                    onChange={(e) => setAdjustForm({ ...adjustForm, adjustment_type: e.target.value })}
                    className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="ADD">➕ Add Stock (Surplus)</option>
                    <option value="SUBTRACT">➖ Subtract Stock (Shortage)</option>
                    <option value="SET">🔄 Set Exact Stock (Count)</option>
                  </select>
                </div>
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Unit Type</label>
                  <select
                    value={adjustForm.unit_type}
                    onChange={(e) => setAdjustForm({ ...adjustForm, unit_type: e.target.value })}
                    className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="Tray">Tray / Box</option>
                    <option value="Piece">Piece / Pcs</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Adjustment Quantity</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={adjustForm.quantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                  placeholder="e.g. 5"
                  className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  required
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Reason for Adjustment</label>
                <select
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="Physical count correction">Physical count correction (Stocktaking)</option>
                  <option value="Breakage / Waste not in damage flow">Breakage / Waste not in damage flow</option>
                  <option value="Dealer replacement directly to warehouse">Dealer replacement directly to warehouse</option>
                  <option value="System reconciliation correction">System reconciliation correction</option>
                  <option value="Sample / Promo stock release">Sample / Promo stock release</option>
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Audit Notes / Reference</label>
                <textarea
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  placeholder="Optional explanatory notes for audit trail..."
                  rows={2}
                  className="w-full p-2 font-medium bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              {/* Real-time Math Preview */}
              {adjustForm.product_id && adjustForm.quantity && (() => {
                const selectedProd = products.find(p => String(p.id) === String(adjustForm.product_id));
                if (!selectedProd) return null;
                const currentUnits = Number(selectedProd.warehouse_stock_units || 0);
                const isPiece = (adjustForm.unit_type || 'Tray').toUpperCase() === 'PIECE' || (adjustForm.unit_type || '').toUpperCase() === 'PCS';
                const convFactor = Number(selectedProd.pieces_per_unit || 1);
                const deltaUnits = isPiece ? (Number(adjustForm.quantity) / convFactor) : Number(adjustForm.quantity);
                
                let targetUnits = currentUnits;
                if (adjustForm.adjustment_type === 'ADD') targetUnits = currentUnits + deltaUnits;
                else if (adjustForm.adjustment_type === 'SUBTRACT') targetUnits = currentUnits - deltaUnits;
                else if (adjustForm.adjustment_type === 'SET') targetUnits = deltaUnits;

                const isNegative = targetUnits < 0;

                return (
                  <div className={`p-3 rounded-2xl border font-mono text-[11px] space-y-1 ${isNegative ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex justify-between font-sans font-bold">
                      <span className="text-slate-500">Current Warehouse Stock:</span>
                      <span>{currentUnits.toFixed(2)} Trays ({Math.round(currentUnits * convFactor)} Pcs)</span>
                    </div>
                    <div className="flex justify-between font-sans font-bold">
                      <span className="text-slate-500">Calculated Stock After:</span>
                      <span className={isNegative ? 'text-rose-600 font-black' : 'text-emerald-600 font-black'}>
                        {targetUnits.toFixed(2)} Trays ({Math.round(targetUnits * convFactor)} Pcs)
                      </span>
                    </div>
                    {isNegative && (
                      <div className="text-rose-600 font-sans font-black text-[10px] pt-1">
                        ⚠️ Error: Stock cannot be negative. Please adjust quantity.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAdjustModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs shadow-md">Apply Adjustment</button>
            </div>
          </form>
        </div>
      )}

      {/* PRODUCT STOCK HISTORY TIMELINE DRAWER / MODAL */}
      {selectedProductTimeline && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <ProductImage src={selectedProductTimeline.image_url || selectedProductTimeline.image || (PRODUCT_IMAGES[selectedProductTimeline.id]?.image) || ''} size={48} icon={selectedProductTimeline.icon} />
                <div>
                  <h3 className="font-black text-base text-slate-900">{selectedProductTimeline.display_name}</h3>
                  <span className="text-[10px] text-slate-500 font-mono">Stock Audit Timeline • SKU: {selectedProductTimeline.sku}</span>
                </div>
              </div>
              <button onClick={() => setSelectedProductTimeline(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 font-sans font-bold block text-[10px]">Current Warehouse:</span>
                  <span className="font-black text-emerald-600">{selectedProductTimeline.warehouse_stock_units} Trays ({Math.round(selectedProductTimeline.warehouse_stock_units * selectedProductTimeline.pieces_per_unit)} Pcs)</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans font-bold block text-[10px]">Packaging Ratio:</span>
                  <span className="font-black text-slate-900">1 {selectedProductTimeline.selling_unit} = {selectedProductTimeline.pieces_per_unit} Pcs</span>
                </div>
              </div>

              <span className="font-extrabold text-slate-700 block">Movement Audit Log:</span>
              <div className="space-y-2">
                {productHistoryLogs.length === 0 ? (
                  <p className="text-slate-400 font-bold text-center py-4">No movement entries recorded for this product variant.</p>
                ) : (
                  productHistoryLogs.map((log, i) => (
                    <div key={i} className="p-3 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-2">
                      <div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border inline-block mb-1 ${
                          log.movement_type === 'INWARD' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                          log.movement_type === 'DRIVER_ISSUE' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                          log.movement_type === 'DRIVER_RETURN' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                          'bg-rose-100 text-rose-800 border-rose-300'
                        }`}>
                          {log.movement_type}
                        </span>
                        <span className="font-extrabold text-slate-900 block text-xs">{log.source_location} → {log.destination_location}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{log.date} • {log.time}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-black text-slate-900 block text-xs">
                          {log.qty_trays} {log.unit_name}s
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">({log.qty_pieces} Pcs)</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedProductTimeline(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-extrabold text-xs"
            >
              Close Timeline
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
