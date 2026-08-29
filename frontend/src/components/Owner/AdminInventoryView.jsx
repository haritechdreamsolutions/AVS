import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ProductImage } from '../common/ProductImage';
import { 
  Package, Search, DollarSign, ArrowUpRight, ArrowDownLeft, 
  Sparkles, CheckCircle2, AlertTriangle, Layers, Info, X, 
  Truck, RotateCcw, Plus, SlidersHorizontal, Eye, ShieldAlert, 
  TrendingUp, Clock, FileText, CheckCircle, AlertCircle
} from 'lucide-react';

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

export const AdminInventoryView = () => {
  const { 
    products = [], categories = [], stockMovements = [], users = [],
    receiveDealerStock, allocateStock, processDriverReturn, submitDriverReturn,
    fetchPendingReturns, verifyDriverReturn, addDamage, fetchStockHistory, 
    fetchReconciliation, currentUser 
  } = useApp();

  const isDriverRole = currentUser?.role === 'EMPLOYEE';
  const driverUsers = useMemo(() => (users || []).filter(u => u.role === 'EMPLOYEE'), [users]);

  const [activeTab, setActiveTab] = useState('OVERVIEW'); // OVERVIEW, MOVEMENTS, RECONCILIATION, PENDING_RETURNS
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState('ALL'); // ALL, HEALTHY, LOW, CRITICAL
  const [movementTypeFilter, setMovementTypeFilter] = useState('ALL');
  const [reconcileDriverFilter, setReconcileDriverFilter] = useState('ALL');

  // Modals state
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [issueConfirmData, setIssueConfirmData] = useState(null); // Before/After stock confirmation dialog
  const [selectedProductTimeline, setSelectedProductTimeline] = useState(null);
  const [productHistoryLogs, setProductHistoryLogs] = useState([]);
  const [reconciliationList, setReconciliationList] = useState([]);
  const [pendingReturnsList, setPendingReturnsList] = useState([]);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Form states
  const [inwardForm, setInwardForm] = useState({ dealer_name: 'Amirtha Foods Ltd', bill_no: '', product_id: '', quantity: '', unit_type: 'Tray', notes: '' });
  const [issueForm, setIssueForm] = useState({ employee_id: '1', product_id: '', quantity: '', unit_type: 'Tray', notes: '' });
  const [returnForm, setReturnForm] = useState({ employee_id: '1', product_id: '', quantity: '', damaged_quantity: '0', unit_type: 'Tray', notes: '' });
  const [damageForm, setDamageForm] = useState({ damage_source: 'WAREHOUSE', employee_id: '1', product_id: '', quantity: '', unit_type: 'Tray', reason: 'Leakage / Burst', notes: '' });

  // Fetch Driver Reconciliation & Pending Returns Data
  const loadReconciliationData = async () => {
    if (fetchReconciliation) {
      const res = await fetchReconciliation(reconcileDriverFilter);
      setReconciliationList(res || []);
    }
  };

  const loadPendingReturnsData = async () => {
    if (fetchPendingReturns) {
      const res = await fetchPendingReturns();
      setPendingReturnsList(res || []);
    }
  };

  useEffect(() => {
    if (activeTab === 'RECONCILIATION') {
      loadReconciliationData();
    } else if (activeTab === 'PENDING_RETURNS') {
      loadPendingReturnsData();
    }
  }, [activeTab, reconcileDriverFilter]);

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
      const pcsPerUnit = p.pieces_per_unit || 1;
      const pcs = Math.round((p.warehouse_stock_units || 0) * pcsPerUnit);
      const val = (p.warehouse_stock_units || 0) * (p.unit_selling_price || 0);

      totalPcs += pcs;
      totalTrays += (p.warehouse_stock_units || 0);
      totalValuation += val;
    });

    const inwardCount = (stockMovements || []).filter(m => m.movement_type === 'INWARD').reduce((acc, m) => acc + (m.qty_trays || 0), 0);
    const issuedCount = (stockMovements || []).filter(m => m.movement_type === 'DRIVER_ISSUE').reduce((acc, m) => acc + (m.qty_trays || 0), 0);
    const returnCount = (stockMovements || []).filter(m => m.movement_type === 'DRIVER_RETURN').reduce((acc, m) => acc + (m.qty_trays || 0), 0);
    const damageCount = (stockMovements || []).filter(m => m.movement_type.includes('DAMAGE')).reduce((acc, m) => acc + (m.qty_trays || 0), 0);

    return {
      totalValuation: Math.round(totalValuation),
      totalPcs: totalPcs,
      totalTrays: parseFloat(totalTrays.toFixed(1)),
      totalVariants: products.length,
      inwardTrays: parseFloat(inwardCount.toFixed(1)),
      issuedTrays: parseFloat(issuedCount.toFixed(1)),
      returnTrays: parseFloat(returnCount.toFixed(1)),
      damageTrays: parseFloat(damageCount.toFixed(1))
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
  const handleVerifyReturn = async (returnId) => {
    setActionError('');
    setActionSuccess('');

    const res = await verifyDriverReturn(returnId, { verified_by: currentUser?.name || 'Store Keeper' });
    if (res.success) {
      setActionSuccess('Driver return physically verified and approved! Warehouse stock updated.');
      if (fetchPendingReturns) {
        const list = await fetchPendingReturns();
        setPendingReturnsList(list || []);
      }
      if (fetchReconciliation) {
        const recs = await fetchReconciliation(reconcileDriverFilter);
        setReconciliationList(recs || []);
      }
    } else {
      setActionError(res.message || 'Failed to verify driver return.');
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
              <p className="text-xs text-slate-300 font-medium mt-0.5">Warehouse Inward, Driver Distribution, Route Returns & Damage Ledger</p>
            </div>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="relative z-10 grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
          {!isDriverRole && (
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
              const meta = PRODUCT_IMAGES[prod.id] || {
                image: prod.image || '/images/milk_200ml.svg',
                sizeBadge: 'Item',
                category: prod.category || 'Product',
                bgTone: 'from-slate-500/10 to-slate-50 border-slate-200',
                textTone: 'text-slate-700'
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
                      src={meta.image}
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
                      <span className="font-black text-slate-900 text-sm">{ret.driver_name}</span>
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
                        {ret.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="p-2.5">
                              <span className="font-black text-slate-900 block">{item.product_name}</span>
                              <span className="text-[9px] text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">{item.category_name}</span>
                            </td>
                            <td className="p-2.5 text-center font-mono text-emerald-700">
                              {Math.round(item.driver_good_pcs / item.pieces_per_unit)} {item.unit_name}s ({item.driver_good_pcs} Pcs)
                            </td>
                            <td className="p-2.5 text-center font-mono text-rose-700">
                              {Math.round(item.driver_damaged_pcs / item.pieces_per_unit)} {item.unit_name}s ({item.driver_damaged_pcs} Pcs)
                            </td>
                            <td className="p-2.5 text-center font-mono font-black text-emerald-800">
                              {item.verified_good_pcs} Pcs
                            </td>
                            <td className="p-2.5 text-center font-mono font-black text-rose-800">
                              {item.verified_damaged_pcs} Pcs
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                      onClick={() => handleVerifyReturn(ret.id)}
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
                {reconciliationList.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-8 text-center text-slate-400 font-bold">No driver stock allocation data recorded yet.</td>
                  </tr>
                ) : (
                  reconciliationList.map((rec, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 pl-4">
                        <span className="font-black text-slate-900 text-xs block">{rec.driver_name}</span>
                        <span className="text-[9px] text-slate-400 font-mono">{rec.vehicle_no || 'Driver'}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-extrabold text-slate-900 block">{rec.product_name}</span>
                        <span className="text-[9px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 inline-block">{rec.category_name}</span>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-blue-700">
                        {rec.issued_trays} {rec.selling_unit}s ({rec.issued_pcs} Pcs)
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-700">
                        {rec.sold_trays} {rec.selling_unit}s ({rec.sold_pcs} Pcs)
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-purple-700">
                        {rec.good_return_trays} {rec.selling_unit}s ({rec.good_return_pcs} Pcs)
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-rose-700">
                        {rec.damaged_trays} {rec.selling_unit}s ({rec.damaged_pcs} Pcs)
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-900">
                        {rec.current_balance_trays} {rec.selling_unit}s ({rec.current_balance_pcs} Pcs)
                      </td>
                      <td className="p-3 text-center font-mono font-black">
                        {rec.variance_pcs === 0 ? '0 Pcs' : `${rec.variance_pcs > 0 ? '+' : ''}${rec.variance_pcs} Pcs`}
                      </td>
                      <td className="p-3 pr-4 text-center">
                        {rec.status === 'RECONCILED' ? (
                          <span className="px-3 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> RECONCILED
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> MISMATCH ({rec.variance_pcs} Pcs)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
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

      {/* PRODUCT STOCK HISTORY TIMELINE DRAWER / MODAL */}
      {selectedProductTimeline && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <ProductImage src={PRODUCT_IMAGES[selectedProductTimeline.id]?.image || selectedProductTimeline.image} size={48} />
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
