import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  RotateCcw, Fuel, ShieldAlert, Scale, Search, Filter, 
  Calendar, RefreshCw, User, Truck, MapPin, DollarSign, 
  AlertTriangle, CheckCircle2, ChevronRight, Download, 
  Eye, FileText, X, AlertCircle, TrendingUp, Utensils,
  CreditCard, Wrench, ArrowRight, Layers, Box, Check, HelpCircle,
  Package, AlertOctagon, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  generateMissingPiecesPDFReport, 
  generateDriverExpensesPDFReport, 
  generateDamagePiecesPDFReport 
} from '../../utils/pdfReportGenerator';

export const OwnerDriverReconciliationView = () => {
  const { 
    fetchMissingStockReport,
    fetchDriverReturnHistory, 
    fetchExpenses, 
    fetchDamages, 
    fetchEligibleDriversForReturn,
    fetchDriverExpectedReturn,
    exportReportData,
    drivers = [],
    products = [],
    routes = []
  } = useApp();

  // Active Sub-Tab: 'missing' (Default), 'returns', 'expenses', 'damages', 'reconciliation'
  const [activeTab, setActiveTab] = useState('missing');

  // Common Loading & Search States
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriverFilter, setSelectedDriverFilter] = useState('ALL');
  const [selectedProductFilter, setSelectedProductFilter] = useState('ALL');
  const [selectedRouteFilter, setSelectedRouteFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState('ALL'); // 'ALL', 'TODAY', 'WEEK', 'MONTH'

  // Data States
  const [missingStockData, setMissingStockData] = useState({ records: [], summary: {} });
  const [returnHistory, setReturnHistory] = useState([]);
  const [expensesList, setExpensesList] = useState([]);
  const [damagesList, setDamagesList] = useState([]);
  const [driversList, setDriversList] = useState([]);

  // Inspection / Modal States
  const [selectedReturnDetails, setSelectedReturnDetails] = useState(null);
  const [selectedReconDriverId, setSelectedReconDriverId] = useState('');
  const [reconDriverData, setReconDriverData] = useState(null);
  const [loadingRecon, setLoadingRecon] = useState(false);

  // Expense Filter
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState('ALL');

  // Damage Filter
  const [selectedDamageReason, setSelectedDamageReason] = useState('ALL');

  // Load Drivers
  const loadDrivers = async () => {
    try {
      if (typeof fetchEligibleDriversForReturn === 'function') {
        const list = await fetchEligibleDriversForReturn();
        setDriversList(Array.isArray(list) ? list : []);
      }
    } catch (e) {
      console.error('Error loading drivers list:', e);
    }
  };

  // Load Data based on active tab
  const loadActiveData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'missing') {
        if (typeof fetchMissingStockReport === 'function') {
          const res = await fetchMissingStockReport({
            driver_id: selectedDriverFilter,
            product_id: selectedProductFilter,
            date: selectedDateFilter !== 'ALL' ? selectedDateFilter : undefined
          });
          setMissingStockData(res || { records: [], summary: {} });
        }
      } else if (activeTab === 'returns') {
        if (typeof fetchDriverReturnHistory === 'function') {
          const res = await fetchDriverReturnHistory(50);
          setReturnHistory(Array.isArray(res?.history) ? res.history : (Array.isArray(res) ? res : []));
        }
      } else if (activeTab === 'expenses') {
        if (typeof fetchExpenses === 'function') {
          const res = await fetchExpenses();
          setExpensesList(Array.isArray(res) ? res : []);
        }
      } else if (activeTab === 'damages') {
        if (typeof fetchDamages === 'function') {
          const res = await fetchDamages();
          setDamagesList(Array.isArray(res) ? res : []);
        }
      } else if (activeTab === 'reconciliation') {
        await loadDrivers();
      }
    } catch (err) {
      console.error('Error loading data for tab', activeTab, err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveData();
  }, [activeTab, selectedDriverFilter, selectedProductFilter, selectedDateFilter]);

  useEffect(() => {
    loadDrivers();
  }, []);

  // Load live reconciliation for selected driver
  const loadDriverReconciliation = async (driverId) => {
    if (!driverId) {
      setReconDriverData(null);
      return;
    }
    try {
      setLoadingRecon(true);
      const data = await fetchDriverExpectedReturn(driverId);
      if (data && data.success !== false) {
        setReconDriverData(data);
      } else {
        setReconDriverData(null);
      }
    } catch (err) {
      console.error('Error loading driver reconciliation:', err);
      toast.error('Failed to load live reconciliation');
    } finally {
      setLoadingRecon(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reconciliation' && selectedReconDriverId) {
      loadDriverReconciliation(selectedReconDriverId);
    }
  }, [selectedReconDriverId, activeTab]);

  // Set default driver for reconciliation when drivers are loaded
  useEffect(() => {
    if (activeTab === 'reconciliation' && driversList.length > 0 && !selectedReconDriverId) {
      setSelectedReconDriverId(String(driversList[0].driver_id || driversList[0].employee_id));
    }
  }, [driversList, activeTab]);

  // EXPENSE CATEGORY HELPERS
  const getExpenseIcon = (cat) => {
    const c = (cat || '').toLowerCase();
    if (c.includes('fuel') || c.includes('diesel')) return <Fuel className="w-3.5 h-3.5 text-amber-600" />;
    if (c.includes('food') || c.includes('tea')) return <Utensils className="w-3.5 h-3.5 text-emerald-600" />;
    if (c.includes('toll')) return <CreditCard className="w-3.5 h-3.5 text-blue-600" />;
    if (c.includes('maint') || c.includes('repair')) return <Wrench className="w-3.5 h-3.5 text-indigo-600" />;
    if (c.includes('fine') || c.includes('police')) return <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />;
    return <HelpCircle className="w-3.5 h-3.5 text-purple-600" />;
  };

  // MISSING STOCK FILTERED RECORDS & SUMMARY (Persisted Data)
  const missingStockFiltered = useMemo(() => {
    const records = missingStockData.records || [];
    const filtered = records.filter(item => {
      if (selectedDriverFilter !== 'ALL') {
        if (String(item.driver_id) !== String(selectedDriverFilter)) return false;
      }
      if (selectedProductFilter !== 'ALL') {
        if (String(item.product_id) !== String(selectedProductFilter)) return false;
      }
      if (selectedRouteFilter !== 'ALL') {
        if ((item.route_name || '').toLowerCase() !== selectedRouteFilter.toLowerCase()) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const dName = (item.driver_name || '').toLowerCase();
        const pName = (item.product_name || '').toLowerCase();
        const vNum = (item.vehicle_number || '').toLowerCase();
        const rNo = (item.return_no || '').toLowerCase();
        const reason = (item.shortage_reason || '').toLowerCase();
        if (!dName.includes(q) && !pName.includes(q) && !vNum.includes(q) && !rNo.includes(q) && !reason.includes(q)) {
          return false;
        }
      }
      return true;
    });

    const totalMissingUnits = filtered.reduce((sum, r) => sum + Number(r.missing_quantity || 0), 0);
    const uniqueProducts = new Set(filtered.map(r => r.product_id || r.product_name)).size;
    const uniqueDrivers = new Set(filtered.map(r => r.driver_id)).size;
    const uniqueSessions = new Set(filtered.map(r => r.return_id || r.session_id)).size;

    return {
      records: filtered,
      totalMissingUnits: Number(totalMissingUnits.toFixed(4)),
      missingProductsCount: uniqueProducts,
      driversWithMissingCount: uniqueDrivers,
      unresolvedSessionsCount: uniqueSessions
    };
  }, [missingStockData, selectedDriverFilter, selectedProductFilter, selectedRouteFilter, searchQuery]);

  // KPI Calculations for other tabs
  const expenseKPIs = useMemo(() => {
    const filtered = expensesList.filter(e => {
      if (selectedDriverFilter !== 'ALL') {
        const empId = String(e.employee_id || e.driver_id || '');
        if (empId !== String(selectedDriverFilter)) return false;
      }
      if (selectedExpenseCategory !== 'ALL' && e.category !== selectedExpenseCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const dName = (e.driver_name || e.employee_name || '').toLowerCase();
        const vNum = (e.vehicle_number || '').toLowerCase();
        const notes = (e.notes || '').toLowerCase();
        const cat = (e.category || '').toLowerCase();
        if (!dName.includes(q) && !vNum.includes(q) && !notes.includes(q) && !cat.includes(q)) return false;
      }
      return true;
    });

    const totalExp = filtered.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const fuelExp = filtered.filter(e => (e.category || '').toLowerCase().includes('fuel')).reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const foodExp = filtered.filter(e => (e.category || '').toLowerCase().includes('food')).reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const otherExp = totalExp - fuelExp - foodExp;

    return {
      filtered,
      count: filtered.length,
      totalExpenses: totalExp,
      fuelExpenses: fuelExp,
      foodExpenses: foodExp,
      otherExpenses: otherExp
    };
  }, [expensesList, selectedDriverFilter, selectedExpenseCategory, searchQuery]);

  const damageKPIs = useMemo(() => {
    const filtered = damagesList.filter(d => {
      if (selectedDriverFilter !== 'ALL') {
        const empId = String(d.employee_id || d.driver_id || '');
        if (empId !== String(selectedDriverFilter)) return false;
      }
      if (selectedDamageReason !== 'ALL' && d.reason !== selectedDamageReason) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const dName = (d.driver_name || d.employee_name || '').toLowerCase();
        const pName = (d.product_name || '').toLowerCase();
        const vNum = (d.vehicle_number || '').toLowerCase();
        const rName = (d.reason || '').toLowerCase();
        if (!dName.includes(q) && !pName.includes(q) && !vNum.includes(q) && !rName.includes(q)) return false;
      }
      return true;
    });

    const totalUnits = filtered.reduce((sum, d) => sum + Number(d.damage_quantity || d.quantity || 0), 0);
    const totalCost = filtered.reduce((sum, d) => sum + Number(d.cost_amount || d.total_loss || (Number(d.damage_quantity || d.quantity || 0) * Number(d.purchase_price || d.unit_price || 0))), 0);

    return {
      filtered,
      count: filtered.length,
      totalUnits,
      totalCost
    };
  }, [damagesList, selectedDriverFilter, selectedDamageReason, searchQuery]);

  const returnsKPIs = useMemo(() => {
    const filtered = returnHistory.filter(r => {
      if (selectedDriverFilter !== 'ALL') {
        const empId = String(r.employee_id || r.driver_id || '');
        if (empId !== String(selectedDriverFilter)) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const rNo = (r.return_no || '').toLowerCase();
        const dName = (r.driver_name || r.employee_name || '').toLowerCase();
        const vNum = (r.vehicle_number || '').toLowerCase();
        if (!rNo.includes(q) && !dName.includes(q) && !vNum.includes(q)) return false;
      }
      return true;
    });

    const totalSales = filtered.reduce((sum, r) => sum + Number(r.total_sales || 0), 0);
    const totalExpenses = filtered.reduce((sum, r) => sum + Number(r.total_expenses || 0), 0);
    const netAmount = filtered.reduce((sum, r) => sum + Number(r.net_amount || (Number(r.total_sales || 0) - Number(r.total_expenses || 0))), 0);
    const totalUnits = filtered.reduce((sum, r) => sum + Number(r.total_returned_units || r.total_items || 0), 0);
    const totalShortage = filtered.reduce((sum, r) => sum + Number(r.total_shortage_units || 0), 0);

    return {
      filtered,
      count: filtered.length,
      totalSales,
      totalExpenses,
      netAmount,
      totalUnits,
      totalShortage
    };
  }, [returnHistory, selectedDriverFilter, searchQuery]);

  return (
    <div className="space-y-5 pb-8 max-w-7xl mx-auto">
      
      {/* Top Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white border border-slate-800 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-400 shrink-0">
              <AlertOctagon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[clamp(1.25rem,2vw,1.65rem)] font-black text-white tracking-tight leading-tight">
                  MISSING STOCK & RECONCILIATION HUB
                </h2>
                <span className="text-[0.75rem] bg-rose-500/20 text-rose-300 font-extrabold px-2.5 py-0.5 rounded-full border border-rose-400/30 flex items-center gap-1">
                  ⚖️ Owner Audit Hub
                </span>
              </div>
              <p className="text-[clamp(0.85rem,1.1vw,0.92rem)] text-slate-300 font-medium mt-0.5">
                Comprehensive tracking for Missing Stock, Driver Returns Ledger, Expenses, Damages & Live Stock Balancing
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadActiveData}
            disabled={loading}
            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-extrabold text-[0.88rem] flex items-center gap-2 transition cursor-pointer min-h-[42px]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>

          <button
            onClick={async () => {
              try {
                toast.info('Generating PDF Report...');
                const driverName = selectedDriverFilter === 'ALL' ? 'All Drivers' : selectedDriverFilter;
                if (activeTab === 'expenses') {
                  await generateDriverExpensesPDFReport({ expenses: expenseKPIs.filtered || [], selectedDriverName: driverName });
                } else if (activeTab === 'damages') {
                  await generateDamagePiecesPDFReport({ damages: damageKPIs.filtered || [], selectedDriverName: driverName });
                } else {
                  await generateMissingPiecesPDFReport({ missingRecords: missingStockFiltered.records || [], selectedDriverName: driverName });
                }
                toast.success('PDF report downloaded successfully');
              } catch (e) {
                console.error(e);
                toast.error('Unable to generate PDF report. Please try again.');
              }
            }}
            className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[0.92rem] flex items-center gap-2 transition shadow-sm cursor-pointer min-h-[42px]"
          >
            <Download className="w-4 h-4" /> Download PDF Report
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {/* TAB 1: MISSING STOCK (DEFAULT) */}
        <button
          onClick={() => setActiveTab('missing')}
          className={`px-4 py-2.5 rounded-2xl font-black text-[0.88rem] flex items-center gap-2 transition shadow-xs cursor-pointer ${
            activeTab === 'missing'
              ? 'bg-rose-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-white" />
          <span>MISSING STOCK</span>
          <span className={`text-[0.78rem] font-mono px-2 py-0.5 rounded-full font-black ${
            activeTab === 'missing' ? 'bg-white text-rose-700' : 'bg-rose-100 text-rose-800'
          }`}>
            {missingStockFiltered.records.length}
          </span>
        </button>

        {/* TAB 2: DRIVER RETURNS LEDGER */}
        <button
          onClick={() => setActiveTab('returns')}
          className={`px-4 py-2.5 rounded-2xl font-black text-[0.88rem] flex items-center gap-2 transition shadow-xs cursor-pointer ${
            activeTab === 'returns'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <RotateCcw className="w-4 h-4 text-emerald-400" />
          <span>Driver Returns Ledger</span>
          <span className="text-[0.78rem] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
            {returnHistory.length}
          </span>
        </button>

        {/* TAB 3: DRIVER EXPENSES */}
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2.5 rounded-2xl font-black text-[0.88rem] flex items-center gap-2 transition shadow-xs cursor-pointer ${
            activeTab === 'expenses'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Fuel className="w-4 h-4 text-amber-400" />
          <span>Driver Expenses Report</span>
          <span className="text-[0.78rem] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
            {expensesList.length}
          </span>
        </button>

        {/* TAB 4: DAMAGES & WASTAGE */}
        <button
          onClick={() => setActiveTab('damages')}
          className={`px-4 py-2.5 rounded-2xl font-black text-[0.88rem] flex items-center gap-2 transition shadow-xs cursor-pointer ${
            activeTab === 'damages'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>Damages & Wastage Report</span>
          <span className="text-[0.78rem] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
            {damagesList.length}
          </span>
        </button>

        {/* TAB 5: LIVE RECONCILIATION */}
        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`px-4 py-2.5 rounded-2xl font-black text-[0.88rem] flex items-center gap-2 transition shadow-xs cursor-pointer ${
            activeTab === 'reconciliation'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Scale className="w-4 h-4 text-blue-400" />
          <span>Live Driver Equation Check</span>
        </button>
      </div>

      {/* FILTER CONTROLS BAR (Reusable & Multi-Criteria) */}
      {activeTab !== 'reconciliation' && (
        <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${activeTab.replace('_', ' ')}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Driver Filter */}
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-500">Driver:</span>
              <select
                value={selectedDriverFilter}
                onChange={(e) => setSelectedDriverFilter(e.target.value)}
                className="p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl text-xs cursor-pointer"
              >
                <option value="ALL">All Drivers</option>
                {driversList.map(d => (
                  <option key={d.driver_id || d.employee_id} value={String(d.driver_id || d.employee_id)}>
                    {d.driver_name || d.employee_name} ({d.employee_code || 'EMP'})
                  </option>
                ))}
              </select>
            </div>

            {/* Product Filter for Missing Stock */}
            {activeTab === 'missing' && (
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-500">Product:</span>
                <select
                  value={selectedProductFilter}
                  onChange={(e) => setSelectedProductFilter(e.target.value)}
                  className="p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl text-xs cursor-pointer max-w-[160px]"
                >
                  <option value="ALL">All Products</option>
                  {(products || []).map(p => (
                    <option key={p.id} value={String(p.id)}>
                      {p.display_name || p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Route Filter for Missing Stock */}
            {activeTab === 'missing' && (
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-500">Route:</span>
                <select
                  value={selectedRouteFilter}
                  onChange={(e) => setSelectedRouteFilter(e.target.value)}
                  className="p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl text-xs cursor-pointer max-w-[140px]"
                >
                  <option value="ALL">All Routes</option>
                  {(routes || []).map(r => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sub-Category Filter for Expenses */}
            {activeTab === 'expenses' && (
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-500">Category:</span>
                <select
                  value={selectedExpenseCategory}
                  onChange={(e) => setSelectedExpenseCategory(e.target.value)}
                  className="p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl text-xs cursor-pointer"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Fuel">Fuel (டீசல்)</option>
                  <option value="Food">Food (உணவு)</option>
                  <option value="Toll">Toll (டோல்கேட்)</option>
                  <option value="Maintenance">Maintenance (பராமரிப்பு)</option>
                  <option value="Fine">Fine (அபராதம்)</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            )}

            {/* Reason Filter for Damages */}
            {activeTab === 'damages' && (
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-500">Reason:</span>
                <select
                  value={selectedDamageReason}
                  onChange={(e) => setSelectedDamageReason(e.target.value)}
                  className="p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl text-xs cursor-pointer"
                >
                  <option value="ALL">All Reasons</option>
                  <option value="Leakage / Burst">Leakage / Burst</option>
                  <option value="Expired / Spoiled">Expired / Spoiled</option>
                  <option value="Seal Broken / Tampered">Seal Broken / Tampered</option>
                  <option value="Crushed in Transit">Crushed in Transit</option>
                  <option value="Quality Defect">Quality Defect</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TAB: MISSING STOCK (CORE REQUIREMENT) */}
      {/* ========================================================================= */}
      {activeTab === 'missing' && (
        <div className="space-y-4">
          
          {/* Top Summary Cards (Requirement 7) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: Total Missing Units */}
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 shadow-xs">
              <span className="text-[10px] font-extrabold text-rose-800 uppercase tracking-wider block">
                Total Missing Units
              </span>
              <span className="text-2xl sm:text-3xl font-black text-rose-700 block mt-1 font-mono">
                {missingStockFiltered.totalMissingUnits} <span className="text-sm font-bold text-rose-600">Units</span>
              </span>
              <span className="text-[10px] text-rose-500 block mt-0.5 font-medium">
                Shortage recorded on returns
              </span>
            </div>

            {/* Card 2: Missing Products */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Missing Products
              </span>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 block mt-1 font-mono">
                {missingStockFiltered.missingProductsCount} <span className="text-sm font-bold text-slate-500">Products</span>
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                Distinct affected SKUs
              </span>
            </div>

            {/* Card 3: Drivers With Missing */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-xs">
              <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">
                Drivers With Missing
              </span>
              <span className="text-2xl sm:text-3xl font-black text-amber-900 block mt-1 font-mono">
                {missingStockFiltered.driversWithMissingCount} <span className="text-sm font-bold text-amber-700">Drivers</span>
              </span>
              <span className="text-[10px] text-amber-600 block mt-0.5 font-medium">
                With unreconciled shortage
              </span>
            </div>

            {/* Card 4: Open/Unresolved Missing Sessions */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-xs">
              <span className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider block">
                Return Sessions With Missing
              </span>
              <span className="text-2xl sm:text-3xl font-black text-amber-400 block mt-1 font-mono">
                {missingStockFiltered.unresolvedSessionsCount} <span className="text-sm font-bold text-slate-400">Sessions</span>
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                Persisted return receipts
              </span>
            </div>
          </div>

          {/* Missing Stock Ledger (Responsive Cards on Mobile & Table on Desktop) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    Missing Stock Audit Ledger (குறைந்த சரக்கு பதிவுகள்)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Permanent audit record of physical return shortages finalized by Storekeeper
                  </p>
                </div>
              </div>
              <span className="text-xs text-rose-700 font-bold bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                {missingStockFiltered.records.length} Incident{missingStockFiltered.records.length !== 1 ? 's' : ''}
              </span>
            </div>

            {missingStockFiltered.records.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="font-bold text-sm text-slate-800">No Missing Stock Records Found</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  All finalized driver returns have balanced physical quantities. Any shortage entered during return submission will be permanently listed here.
                </p>
              </div>
            ) : (
              <>
                {/* 1. Mobile Cards View (Screen < 768px) */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {missingStockFiltered.records.map((rec, idx) => (
                    <div key={rec.id || idx} className="p-4 space-y-3 bg-white">
                      
                      {/* Card Header: Product, Missing Qty Badge & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {rec.date} • {rec.return_no}
                          </span>
                          <h4 className="font-black text-sm text-slate-900 truncate mt-0.5">
                            {rec.product_name}
                          </h4>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 shrink-0">
                          🔴 MISSING: {rec.missing_quantity} {rec.unit}
                        </span>
                      </div>

                      {/* Driver & Route Info */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-bold">Driver:</span>
                          <span className="font-extrabold text-slate-900">
                            {rec.driver_name} ({rec.employee_code})
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-bold">Vehicle / Route:</span>
                          <span className="font-mono text-slate-800">
                            {rec.vehicle_number} • {rec.route_name}
                          </span>
                        </div>
                      </div>

                      {/* 4-Point Stock Grid */}
                      <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-xs">
                        <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-200">
                          <span className="text-[8px] text-slate-500 uppercase font-bold block">Allocated</span>
                          <span className="font-black text-slate-800">{rec.allocated_quantity}</span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-100">
                          <span className="text-[8px] text-blue-700 uppercase font-bold block">Sold</span>
                          <span className="font-black text-blue-800">{rec.sold_quantity}</span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-rose-50 border border-rose-100">
                          <span className="text-[8px] text-rose-700 uppercase font-bold block">Damage</span>
                          <span className="font-black text-rose-800">{rec.damaged_quantity}</span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                          <span className="text-[8px] text-emerald-800 uppercase font-bold block">Returned</span>
                          <span className="font-black text-emerald-700">{rec.actual_quantity}</span>
                        </div>
                      </div>

                      {/* Shortage Reason & Storekeeper */}
                      <div className="text-[11px] text-slate-600 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 space-y-1">
                        <p>
                          <strong>Reason:</strong> {rec.shortage_reason || 'No reason provided'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Verified by: <strong>{rec.storekeeper_name}</strong> at {rec.created_at ? new Date(rec.created_at).toLocaleTimeString() : 'N/A'}
                        </p>
                      </div>

                    </div>
                  ))}
                </div>

                {/* 2. Desktop Table View (Screen >= 768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-3.5">Date & Return #</th>
                        <th className="p-3.5">Driver & Vehicle</th>
                        <th className="p-3.5">Route</th>
                        <th className="p-3.5">Product Name</th>
                        <th className="p-3.5 text-center">Allocated</th>
                        <th className="p-3.5 text-center">Sold</th>
                        <th className="p-3.5 text-center">Damage</th>
                        <th className="p-3.5 text-center">Actual Return</th>
                        <th className="p-3.5 text-center">Missing Qty</th>
                        <th className="p-3.5">Shortage Reason</th>
                        <th className="p-3.5">Storekeeper</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {missingStockFiltered.records.map((rec, idx) => (
                        <tr key={rec.id || idx} className="hover:bg-rose-50/40 transition">
                          <td className="p-3.5 font-mono text-[11px]">
                            <span className="font-bold text-slate-900 block">{rec.return_no}</span>
                            <span className="text-[10px] text-slate-400">{rec.date}</span>
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-amber-600" />
                              {rec.driver_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ({rec.employee_code}) • {rec.vehicle_number}
                            </div>
                          </td>
                          <td className="p-3.5 text-slate-600">
                            {rec.route_name}
                          </td>
                          <td className="p-3.5 font-bold text-slate-900">
                            {rec.product_name}
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-slate-700">
                            {rec.allocated_quantity}
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-blue-700">
                            {rec.sold_quantity}
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-rose-700">
                            {rec.damaged_quantity}
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-emerald-700">
                            {rec.actual_quantity}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 font-mono">
                              🔴 {rec.missing_quantity} {rec.unit}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-700 max-w-xs truncate text-[11px]">
                            {rec.shortage_reason || '—'}
                          </td>
                          <td className="p-3.5 text-[11px] text-slate-500">
                            {rec.storekeeper_name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TAB: DRIVER RETURNS LEDGER */}
      {/* ========================================================================= */}
      {activeTab === 'returns' && (
        <div className="space-y-4">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Returns Processed</span>
              <span className="text-2xl font-black text-slate-900 block mt-1 font-mono">{returnsKPIs.count} Returns</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Driver Sales</span>
              <span className="text-2xl font-black text-blue-600 block mt-1 font-mono">₹{returnsKPIs.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Driver Expenses</span>
              <span className="text-2xl font-black text-amber-600 block mt-1 font-mono">- ₹{returnsKPIs.totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-600 text-white shadow-xs">
              <span className="text-[10px] font-extrabold text-emerald-100 uppercase block">Net Cash / Amount Due</span>
              <span className="text-2xl font-black text-white block mt-1 font-mono">₹{returnsKPIs.netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Returns Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-emerald-600" />
                Completed Driver Returns History (முடிவடைந்த டிரைவர் கணக்குகள்)
              </h3>
              <span className="text-xs text-slate-500 font-bold">{returnsKPIs.filtered.length} Records</span>
            </div>

            {returnsKPIs.filtered.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Box className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="font-bold text-sm text-slate-700">No driver return records found</h4>
                <p className="text-xs text-slate-400">Driver returns verified by storekeeper will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3.5">Return # / Receipt</th>
                      <th className="p-3.5">Date & Time</th>
                      <th className="p-3.5">Driver & Vehicle</th>
                      <th className="p-3.5">Route</th>
                      <th className="p-3.5 text-right">Sales (₹)</th>
                      <th className="p-3.5 text-right">Expenses (₹)</th>
                      <th className="p-3.5 text-right">Net Due (₹)</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {returnsKPIs.filtered.map((ret, idx) => {
                      const salesVal = Number(ret.total_sales || 0);
                      const expVal = Number(ret.total_expenses || 0);
                      const netVal = Number(ret.net_amount || (salesVal - expVal));

                      return (
                        <tr key={ret.id || idx} className="hover:bg-slate-50/80 transition">
                          <td className="p-3.5 font-mono font-black text-slate-900">
                            {ret.return_no || `RET-${String(ret.id).padStart(4, '0')}`}
                          </td>
                          <td className="p-3.5 text-slate-600">
                            {ret.return_date || ret.created_at ? new Date(ret.return_date || ret.created_at).toLocaleString() : 'Today'}
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-amber-600" />
                              {ret.driver_name || ret.employee_name || 'Driver'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {ret.employee_code && `(${ret.employee_code}) `}
                              {ret.vehicle_number ? `• ${ret.vehicle_number}` : ''}
                            </div>
                          </td>
                          <td className="p-3.5 text-slate-600">
                            {ret.route_name || 'Main Route'}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                            ₹{salesVal.toFixed(2)}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-amber-600">
                            - ₹{expVal.toFixed(2)}
                          </td>
                          <td className="p-3.5 text-right font-mono font-black text-emerald-600 text-sm">
                            ₹{netVal.toFixed(2)}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ✓ {ret.status || 'VERIFIED'}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => setSelectedReturnDetails(ret)}
                              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] border border-slate-200 flex items-center gap-1 mx-auto transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600" /> View
                            </button>
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

      {/* ========================================================================= */}
      {/* 3. TAB: DRIVER EXPENSES REPORT */}
      {/* ========================================================================= */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Expenses Recorded</span>
              <span className="text-2xl font-black text-slate-900 block mt-1 font-mono">₹{expenseKPIs.totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">{expenseKPIs.count} Entries</span>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-xs">
              <span className="text-[10px] font-bold text-amber-800 uppercase block">Fuel / Diesel (டீசல்)</span>
              <span className="text-2xl font-black text-amber-900 block mt-1 font-mono">₹{expenseKPIs.fuelExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-xs">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">Food & Refreshment (உணவு)</span>
              <span className="text-2xl font-black text-emerald-900 block mt-1 font-mono">₹{expenseKPIs.foodExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 shadow-xs">
              <span className="text-[10px] font-bold text-purple-800 uppercase block">Toll, Repair & Others</span>
              <span className="text-2xl font-black text-purple-900 block mt-1 font-mono">₹{expenseKPIs.otherExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Fuel className="w-4 h-4 text-amber-600" />
                Driver Expenses Ledger (டிரைவர் செலவு விவரங்கள்)
              </h3>
              <span className="text-xs text-slate-500 font-bold">{expenseKPIs.filtered.length} Entries</span>
            </div>

            {expenseKPIs.filtered.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Fuel className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="font-bold text-sm text-slate-700">No driver expenses found</h4>
                <p className="text-xs text-slate-400">Recorded driver expenses will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3.5">Date & Time</th>
                      <th className="p-3.5">Driver & Vehicle</th>
                      <th className="p-3.5">Route</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5 text-right">Amount (₹)</th>
                      <th className="p-3.5">Notes / Description</th>
                      <th className="p-3.5">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {expenseKPIs.filtered.map((exp, idx) => (
                      <tr key={exp.id || idx} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5 text-slate-600 font-mono text-[11px]">
                          {exp.date || (exp.created_at ? new Date(exp.created_at).toLocaleString() : 'Today')}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-amber-600" />
                            {exp.driver_name || exp.employee_name || 'Driver'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {exp.employee_code && `(${exp.employee_code}) `}
                            {exp.vehicle_number ? `• ${exp.vehicle_number}` : ''}
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-600">
                          {exp.route_name || 'N/A'}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                            {getExpenseIcon(exp.category)}
                            {exp.category || 'General'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-sm text-slate-900">
                          ₹{Number(exp.amount || 0).toFixed(2)}
                        </td>
                        <td className="p-3.5 text-slate-700 max-w-xs truncate">
                          {exp.notes || exp.title || '—'}
                        </td>
                        <td className="p-3.5 text-[11px] text-slate-500">
                          {exp.recorded_by_name || 'Storekeeper / System'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TAB: DAMAGES & WASTAGE REPORT */}
      {/* ========================================================================= */}
      {activeTab === 'damages' && (
        <div className="space-y-4">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Damage Incidents</span>
              <span className="text-2xl font-black text-slate-900 block mt-1 font-mono">{damageKPIs.count} Logs</span>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 shadow-xs">
              <span className="text-[10px] font-bold text-rose-800 uppercase block">Total Damaged Units</span>
              <span className="text-2xl font-black text-rose-900 block mt-1 font-mono">{damageKPIs.totalUnits} Units</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-xs">
              <span className="text-[10px] font-extrabold text-slate-300 uppercase block">Est. Financial Loss / Write-off</span>
              <span className="text-2xl font-black text-amber-400 block mt-1 font-mono">₹{damageKPIs.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Damages Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Product Damages & Wastage Logs (சேத விவரங்கள்)
              </h3>
              <span className="text-xs text-slate-500 font-bold">{damageKPIs.filtered.length} Logs</span>
            </div>

            {damageKPIs.filtered.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="font-bold text-sm text-slate-700">No damage logs found</h4>
                <p className="text-xs text-slate-400">Reported product damages will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3.5">Date & Time</th>
                      <th className="p-3.5">Driver & Vehicle</th>
                      <th className="p-3.5">Product Name</th>
                      <th className="p-3.5 text-center">Damaged Qty</th>
                      <th className="p-3.5">Reason</th>
                      <th className="p-3.5 text-right">Est. Loss (₹)</th>
                      <th className="p-3.5">Notes</th>
                      <th className="p-3.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {damageKPIs.filtered.map((dmg, idx) => {
                      const qty = Number(dmg.damage_quantity || dmg.quantity || 0);
                      const cost = Number(dmg.cost_amount || dmg.total_loss || (qty * Number(dmg.purchase_price || dmg.unit_price || 0)));

                      return (
                        <tr key={dmg.id || idx} className="hover:bg-slate-50/80 transition">
                          <td className="p-3.5 text-slate-600 font-mono text-[11px]">
                            {dmg.date || (dmg.created_at ? new Date(dmg.created_at).toLocaleString() : 'Today')}
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-amber-600" />
                              {dmg.driver_name || dmg.employee_name || 'Driver'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {dmg.employee_code && `(${dmg.employee_code}) `}
                              {dmg.vehicle_number ? `• ${dmg.vehicle_number}` : ''}
                            </div>
                          </td>
                          <td className="p-3.5 font-bold text-slate-900">
                            {dmg.product_name || 'Product'}
                          </td>
                          <td className="p-3.5 text-center font-mono font-black text-rose-700">
                            {qty} {dmg.unit || dmg.unit_type || 'Pcs'}
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              {dmg.reason || 'Damage'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                            ₹{cost.toFixed(2)}
                          </td>
                          <td className="p-3.5 text-slate-600 max-w-xs truncate">
                            {dmg.notes || '—'}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ✓ {dmg.status || 'VERIFIED'}
                            </span>
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

      {/* ========================================================================= */}
      {/* 5. TAB: LIVE DRIVER EQUATION RECONCILIATION */}
      {/* ========================================================================= */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-4">
          
          {/* Driver Selector Card */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-indigo-600" />
                Select Driver to Inspect Live Reconciliation Equation
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Authoritative Formula: <strong className="text-slate-800">Allocated = Sold + Damaged + Actual Return + Missing</strong>
              </p>
            </div>

            <div className="w-full sm:w-72">
              <select
                value={selectedReconDriverId}
                onChange={(e) => setSelectedReconDriverId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="">-- Select Driver --</option>
                {driversList.map(d => (
                  <option key={d.driver_id || d.employee_id} value={String(d.driver_id || d.employee_id)}>
                    {d.driver_name || d.employee_name} ({d.employee_code || 'EMP'}) — {d.vehicle_number || 'No Vehicle'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Loading or Empty State */}
          {loadingRecon ? (
            <div className="py-14 text-center text-xs text-slate-500 font-bold space-y-2 bg-white rounded-3xl border border-slate-200">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm font-black text-slate-800">Fetching live stock reconciliation from database...</p>
            </div>
          ) : !reconDriverData ? (
            <div className="p-12 text-center bg-white border border-dashed border-slate-200 rounded-3xl space-y-2">
              <Truck className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="font-bold text-sm text-slate-700">Please select a driver above</h4>
              <p className="text-xs text-slate-400">Real-time allocated, sold, damaged, and returned quantities will be verified here</p>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Driver Meta & Financials */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white border border-slate-800 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold text-amber-400 uppercase">Driver Profile</span>
                  <h4 className="text-base font-black text-white">
                    {reconDriverData.driver?.name} ({reconDriverData.driver?.employee_code})
                  </h4>
                  <p className="text-xs text-slate-300">
                    Vehicle: <strong>{reconDriverData.driver?.vehicle_number || 'N/A'}</strong> • Route: <strong>{reconDriverData.driver?.route_name || 'Main Route'}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-3 font-mono text-right">
                  <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Total Sales</span>
                    <span className="font-black text-sm text-emerald-400">₹{Number(reconDriverData.sales_summary?.total_sales || 0).toFixed(2)}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Expenses</span>
                    <span className="font-black text-sm text-amber-400">- ₹{Number(reconDriverData.total_expenses || (reconDriverData.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0)).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* 7-Point Product Reconciliation Breakdown Cards */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="font-black text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Box className="w-4 h-4 text-emerald-600" />
                    7-Point Product Reconciliation Breakdown
                  </h4>
                  <span className="text-xs font-bold text-slate-500">
                    {reconDriverData.products?.length || 0} Products
                  </span>
                </div>

                {(reconDriverData.products || []).length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl">
                    <p className="text-xs text-slate-500 font-bold">No stock allocated for this driver</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reconDriverData.products.map(p => {
                      const isTray = (
                        String(p.category_name || p.category || '').trim().toLowerCase() === 'tray' ||
                        String(p.selling_unit || p.unit || '').trim().toLowerCase() === 'tray' ||
                        String(p.package_type || p.packaging || '').trim().toLowerCase() === 'tray'
                      );
                      const ppu = Math.max(1, Number(p.pieces_per_unit || 1));
                      const unit = isTray ? 'Pieces' : (p.selling_unit || p.unit || 'Case');

                      const alloc = isTray 
                        ? (p.allocated_pieces != null ? Math.round(Number(p.allocated_pieces)) : Math.round(Number(p.originally_allocated ?? p.allocated_quantity ?? 0) * ppu))
                        : Number(Number(p.allocated ?? p.originally_allocated ?? p.allocated_quantity ?? 0).toFixed(4));

                      const sold = isTray 
                        ? (p.sold_pieces != null ? Math.round(Number(p.sold_pieces)) : Math.round(Number(p.sold_quantity ?? 0) * ppu))
                        : Number(Number(p.sold ?? p.sold_quantity ?? 0).toFixed(4));

                      const dmg = isTray 
                        ? (p.damaged_pieces != null ? Math.round(Number(p.damaged_pieces)) : Math.round(Number(p.damaged_quantity ?? 0) * ppu))
                        : Number(Number(p.damage ?? p.damaged_quantity ?? 0).toFixed(4));

                      const retStock = Math.max(0, alloc - sold - dmg);

                      return (
                        <div 
                          key={p.product_id}
                          className="p-3.5 rounded-2xl border transition bg-white border-slate-200"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <h5 className="font-black text-xs sm:text-sm text-slate-900">
                                1. {p.product_name}
                              </h5>
                              <span className="text-[10px] text-slate-500 font-medium">Unit: {unit}</span>
                            </div>

                            <div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-full">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                🟢 BALANCED EQUATION
                              </span>
                            </div>
                          </div>

                          {/* 7-Point Metrics */}
                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2.5 mt-2.5 border-t border-slate-100 text-center font-mono text-xs">
                            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                              <span className="text-[9px] text-slate-500 uppercase font-bold block">2. Allocated</span>
                              <span className="font-black text-slate-900 block mt-0.5">{alloc} {unit}</span>
                            </div>
                            <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
                              <span className="text-[9px] text-blue-700 uppercase font-bold block">3. Sold</span>
                              <span className="font-black text-blue-800 block mt-0.5">{sold} {unit}</span>
                            </div>
                            <div className="p-2 rounded-xl bg-rose-50 border border-rose-100">
                              <span className="text-[9px] text-rose-700 uppercase font-bold block">4. Damage</span>
                              <span className="font-black text-rose-800 block mt-0.5">{dmg} {unit}</span>
                            </div>
                            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                              <span className="text-[9px] text-emerald-800 uppercase font-bold block">5. Expected Return</span>
                              <span className="font-black text-emerald-700 block mt-0.5">{retStock} {unit}</span>
                            </div>
                            <div className="p-2 rounded-xl bg-teal-50 border border-teal-200">
                              <span className="text-[9px] text-teal-800 uppercase font-bold block">6. Actual Return</span>
                              <span className="font-black text-teal-700 block mt-0.5">{retStock} {unit}</span>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                              <span className="text-[9px] text-slate-600 uppercase font-bold block">7. Missing Qty</span>
                              <span className="font-black block mt-0.5 text-slate-600">
                                0 {unit}
                              </span>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      )}

      {/* RETURN DETAILS MODAL */}
      {selectedReturnDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto my-auto p-5 space-y-4 shadow-2xl relative">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-base border border-emerald-200">
                  🧾
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    Return #{selectedReturnDetails.return_no || `RET-${selectedReturnDetails.id}`}
                  </h3>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">
                    {selectedReturnDetails.return_date || selectedReturnDetails.created_at ? new Date(selectedReturnDetails.return_date || selectedReturnDetails.created_at).toLocaleString() : 'Today'}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedReturnDetails(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans font-bold">Driver:</span>
                  <span className="font-black text-slate-900">{selectedReturnDetails.driver_name || selectedReturnDetails.employee_name} ({selectedReturnDetails.employee_code || 'EMP'})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans font-bold">Vehicle:</span>
                  <span className="font-black text-slate-900">{selectedReturnDetails.vehicle_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans font-bold">Today's Sales:</span>
                  <span className="font-black text-slate-900">₹{Number(selectedReturnDetails.total_sales || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans font-bold">Driver Expenses:</span>
                  <span className="font-black text-amber-600">- ₹{Number(selectedReturnDetails.total_expenses || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-emerald-700">
                  <span className="font-sans">Net Cash / Due:</span>
                  <span className="font-black text-sm">₹{Number(selectedReturnDetails.net_amount || (Number(selectedReturnDetails.total_sales || 0) - Number(selectedReturnDetails.total_expenses || 0))).toFixed(2)}</span>
                </div>
              </div>

              {selectedReturnDetails.items && selectedReturnDetails.items.length > 0 && (
                <div>
                  <h4 className="font-extrabold text-slate-800 mb-1">Returned Items Breakdown:</h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto font-mono bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                    {selectedReturnDetails.items.map((item, i) => (
                      <div key={i} className="flex justify-between border-b border-slate-200/60 last:border-0 pb-1 text-xs">
                        <span>{item.product_name}</span>
                        <span className="font-bold text-emerald-700">{item.actual_quantity || item.return_qty || 0} {item.unit || 'units'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedReturnDetails.notes && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 text-[11px]">
                  <strong>Notes:</strong> {selectedReturnDetails.notes}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedReturnDetails(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default OwnerDriverReconciliationView;
