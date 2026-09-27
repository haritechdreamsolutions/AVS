import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Building2, Plus, Download, Filter, Calendar, Search, 
  Layers, Package, CheckCircle2, RefreshCw, Edit3, Trash2,
  X, Save, FileText, TrendingUp, DollarSign, Clock, User, Phone, MapPin, Tag
} from 'lucide-react';
import { toast } from 'sonner';
import { generateSupplierInwardPDFReport } from '../../utils/pdfReportGenerator';

export const OwnerSuppliersView = () => {
  const { 
    suppliers = [], 
    products = [], 
    companyInfo, 
    addSupplier, 
    updateSupplier, 
    deleteSupplier, 
    fetchSupplierInwardReport, 
    refreshData 
  } = useApp();

  // Active view tab: 'inward' or 'directory'
  const [activeSubTab, setActiveSubTab] = useState('inward');

  // Filter States
  const [selectedSupplierId, setSelectedSupplierId] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('THIS_MONTH');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  // Report Data State
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportData, setReportData] = useState({
    records: [],
    summary: { total_inward_qty: 0, total_batches: 0, total_companies: 0, total_valuation: 0 },
    product_totals: []
  });

  // Active products for rate configuration
  const activeProducts = useMemo(() => {
    return (products || []).filter(p => p.is_active !== false && p.is_active !== 0);
  }, [products]);

  // Company Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [productRates, setProductRates] = useState({});
  const [savingSupplier, setSavingSupplier] = useState(false);

  // Quick Rate Modal State (for quick rate update without editing full company)
  const [rateModalSupplier, setRateModalSupplier] = useState(null);
  const [quickRates, setQuickRates] = useState({});
  const [savingQuickRates, setSavingQuickRates] = useState(false);

  // Date filter shortcuts
  const handleDateShortcut = (period) => {
    setDateFilter(period);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (period === 'TODAY') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (period === 'YESTERDAY') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (period === 'THIS_WEEK') {
      const curr = new Date();
      const first = curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1);
      const monday = new Date(curr.setDate(first));
      setStartDate(monday.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (period === 'THIS_MONTH') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (period === 'ALL') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Load Inward Report from API
  const loadInwardReport = async () => {
    setLoadingReport(true);
    try {
      const filters = {
        supplier_id: selectedSupplierId,
        start_date: startDate || undefined,
        end_date: endDate || undefined
      };
      const data = await fetchSupplierInwardReport(filters);
      if (data) {
        setReportData({
          records: data.records || [],
          summary: data.summary || { total_inward_qty: 0, total_batches: 0, total_companies: 0, total_valuation: 0 },
          product_totals: data.product_totals || []
        });
      }
    } catch (err) {
      console.error('Failed to load supplier inward report', err);
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    loadInwardReport();
  }, [selectedSupplierId, startDate, endDate]);

  // Selected supplier object
  const currentSupplier = useMemo(() => {
    if (selectedSupplierId === 'ALL') return null;
    return suppliers.find(s => String(s.id) === String(selectedSupplierId));
  }, [suppliers, selectedSupplierId]);

  // Filtered inward records by search term
  const filteredRecords = useMemo(() => {
    const list = reportData.records || [];
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(r => 
      (r.supplier_name && r.supplier_name.toLowerCase().includes(q)) ||
      (r.product_name && r.product_name.toLowerCase().includes(q)) ||
      (r.created_by_name && r.created_by_name.toLowerCase().includes(q)) ||
      (r.notes && r.notes.toLowerCase().includes(q))
    );
  }, [reportData.records, searchTerm]);

  // Modal Open Handlers
  const handleOpenAddModal = () => {
    setEditingSupplier(null);
    setCompanyName('');
    setCompanyCode('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setGstin('');
    setNotes('');
    setIsActive(true);

    // Initialize product rates with default base prices
    const initialRates = {};
    activeProducts.forEach(p => {
      initialRates[p.id] = p.base_price || p.purchase_price || '';
    });
    setProductRates(initialRates);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (supplier) => {
    setEditingSupplier(supplier);
    setCompanyName(supplier.name || '');
    setCompanyCode(supplier.code || '');
    setContactPerson(supplier.contact_person || '');
    setPhone(supplier.phone || '');
    setEmail(supplier.email || '');
    setAddress(supplier.address || '');
    setGstin(supplier.gstin || '');
    setNotes(supplier.notes || '');
    setIsActive(supplier.is_active !== false);

    // Load supplier's saved rates or fallback to product base price
    const savedRates = supplier.product_rates || {};
    const initialRates = {};
    activeProducts.forEach(p => {
      initialRates[p.id] = savedRates[p.id] !== undefined ? savedRates[p.id] : (p.base_price || p.purchase_price || '');
    });
    setProductRates(initialRates);
    setIsModalOpen(true);
  };

  const handleRateChange = (productId, val) => {
    setProductRates(prev => ({
      ...prev,
      [productId]: val
    }));
  };

  const handleQuickRateChange = (productId, val) => {
    setQuickRates(prev => ({
      ...prev,
      [productId]: val
    }));
  };

  const handleOpenQuickRates = (supplier) => {
    setRateModalSupplier(supplier);
    const savedRates = supplier.product_rates || {};
    const initialRates = {};
    activeProducts.forEach(p => {
      initialRates[p.id] = savedRates[p.id] !== undefined ? savedRates[p.id] : (p.base_price || p.purchase_price || '');
    });
    setQuickRates(initialRates);
  };

  const handleSaveQuickRates = async (e) => {
    e.preventDefault();
    if (!rateModalSupplier) return;

    setSavingQuickRates(true);
    const res = await updateSupplier(rateModalSupplier.id, {
      product_rates: quickRates
    });
    setSavingQuickRates(false);

    if (res.success) {
      toast.success(`Buy rates updated for ${rateModalSupplier.name}!`);
      setRateModalSupplier(null);
      refreshData();
    } else {
      toast.error(res.message || 'Failed to update rates.');
    }
  };

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error('Please enter the company name.');
      return;
    }

    setSavingSupplier(true);
    const payload = {
      name: companyName.trim(),
      code: companyCode.trim() || undefined,
      contact_person: contactPerson.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      gstin: gstin.trim() || undefined,
      notes: notes.trim() || undefined,
      product_rates: productRates,
      is_active: isActive
    };

    let res;
    if (editingSupplier) {
      res = await updateSupplier(editingSupplier.id, payload);
    } else {
      res = await addSupplier(payload);
    }

    setSavingSupplier(false);

    if (res.success) {
      toast.success(editingSupplier ? 'Company & Buy Rates updated successfully!' : 'New Production Company added with Buy Rates!');
      setIsModalOpen(false);
      refreshData();
      loadInwardReport();
    } else {
      toast.error(res.message || 'Failed to save company.');
    }
  };

  const handleDeleteSupplier = async (supplier) => {
    if (!window.confirm(`Are you sure you want to delete company "${supplier.name}"?`)) {
      return;
    }

    const res = await deleteSupplier(supplier.id);
    if (res.success) {
      toast.success('Company removed successfully.');
      if (selectedSupplierId === String(supplier.id)) {
        setSelectedSupplierId('ALL');
      }
      refreshData();
      loadInwardReport();
    } else {
      toast.error(res.message || 'Failed to delete company.');
    }
  };

  // PDF Export Trigger
  const handleDownloadPDF = async () => {
    try {
      const supplierName = currentSupplier ? currentSupplier.name : 'All Production Companies';
      const dateRangeText = (startDate && endDate) 
        ? `${startDate} to ${endDate}` 
        : (dateFilter === 'ALL' ? 'All Time Records' : dateFilter.replace(/_/g, ' '));

      toast.loading('Generating Supplier Inward PDF Report...', { id: 'pdf-toast' });
      
      await generateSupplierInwardPDFReport({
        supplierName,
        period: dateFilter,
        dateRangeText,
        kpis: {
          total_inward_qty: reportData.summary.total_inward_qty,
          total_batches: reportData.summary.total_batches,
          total_valuation: reportData.summary.total_valuation,
          total_companies: selectedSupplierId === 'ALL' ? (suppliers.length || 1) : 1
        },
        productTotals: reportData.product_totals || [],
        records: filteredRecords || [],
        companyInfo
      });

      toast.success('Supplier Inward PDF Downloaded Successfully!', { id: 'pdf-toast' });
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF report', { id: 'pdf-toast' });
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      
      {/* TOP HEADER & ACTION BUTTONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-blue-200/60 shadow-lg shadow-blue-500/5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Companies & Inward
                <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  கம்பெனி & வரவு
                </span>
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                Production supplier masters, buy rates pricing, inward calculations, and audit reports.
              </p>
            </div>
          </div>
        </div>

        {/* 2 Top Right Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <button
            onClick={handleDownloadPDF}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-white border border-blue-300 hover:bg-blue-50 text-blue-900 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>Download PDF Report</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Company</span>
          </button>
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="bg-white/90 backdrop-blur-md p-4 rounded-3xl border border-blue-200/60 shadow-md space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Company Filter Dropdown */}
          <div className="flex-1 flex items-center gap-2">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-600" />
              Company:
            </span>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full bg-blue-50/70 border border-blue-200 focus:border-blue-500 rounded-2xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
            >
              <option value="ALL">🏭 All Production Companies ({suppliers.length})</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.code ? `(${s.code})` : ''} {s.is_active === false ? '• (Inactive)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Date Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {[
              { id: 'TODAY', label: 'Today' },
              { id: 'YESTERDAY', label: 'Yesterday' },
              { id: 'THIS_WEEK', label: 'This Week' },
              { id: 'THIS_MONTH', label: 'This Month' },
              { id: 'ALL', label: 'All Time' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handleDateShortcut(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  dateFilter === p.id 
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30' 
                    : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDateFilter('CUSTOM');
                }}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
              />
              <span className="text-slate-400 text-xs font-bold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDateFilter('CUSTOM');
                }}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
              />
            </div>

            <button
              onClick={() => {
                handleDateShortcut('THIS_MONTH');
                setSelectedSupplierId('ALL');
                setSearchTerm('');
              }}
              title="Reset Filters"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('inward')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                activeSubTab === 'inward'
                  ? 'bg-blue-100/80 text-blue-900 border border-blue-300'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Inward Stock & Calculation (வரவு கணக்கு)
            </button>

            <button
              onClick={() => setActiveSubTab('directory')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                activeSubTab === 'directory'
                  ? 'bg-blue-100/80 text-blue-900 border border-blue-300'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4 text-blue-600" />
              Company Directory & Buy Rates ({suppliers.length})
            </button>
          </div>

          {/* Search box for inward records */}
          {activeSubTab === 'inward' && (
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search product / company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white/85 backdrop-blur-md p-4 rounded-3xl border border-blue-100 shadow-md">
          <div className="flex items-center justify-between text-blue-600 mb-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Total Inward Qty</span>
            <Package className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            {Number(reportData.summary.total_inward_qty || 0).toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] font-bold text-blue-600">Trays / Units Received</span>
        </div>

        <div className="bg-white/85 backdrop-blur-md p-4 rounded-3xl border border-blue-100 shadow-md">
          <div className="flex items-center justify-between text-emerald-600 mb-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Total Batches</span>
            <Clock className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            {reportData.summary.total_batches || 0}
          </p>
          <span className="text-[10px] font-bold text-emerald-600">Inward Movements</span>
        </div>

        <div className="bg-white/85 backdrop-blur-md p-4 rounded-3xl border border-blue-100 shadow-md">
          <div className="flex items-center justify-between text-amber-600 mb-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Total Valuation</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            ₹{Number(reportData.summary.total_valuation || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <span className="text-[10px] font-bold text-amber-600">Purchase Amount (Qty × Buy Rate)</span>
        </div>

        <div className="bg-white/85 backdrop-blur-md p-4 rounded-3xl border border-blue-100 shadow-md">
          <div className="flex items-center justify-between text-indigo-600 mb-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Active Companies</span>
            <Building2 className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            {selectedSupplierId === 'ALL' ? suppliers.length : 1}
          </p>
          <span className="text-[10px] font-bold text-indigo-600">Suppliers Selected</span>
        </div>
      </div>

      {/* TAB CONTENT 1: INWARD STOCK & CALCULATION */}
      {activeSubTab === 'inward' && (
        <div className="space-y-6">
          
          {/* Product-wise calculation summary */}
          <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-blue-200/60 p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600" />
                  Product Quantity & Valuation Calculation (பொருட்கள் வாரியான கணக்கு)
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedSupplierId === 'ALL' ? 'Total quantity & purchase cost received across all companies' : `Received stock calculation for ${currentSupplier?.name || 'Selected Company'}`}
                </p>
              </div>
              <span className="text-xs font-black bg-blue-50 text-blue-700 px-3 py-1 rounded-xl border border-blue-200">
                {reportData.product_totals.length} Products Inwarded
              </span>
            </div>

            {loadingReport ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <p className="text-xs font-bold">Calculating inward quantities...</p>
              </div>
            ) : reportData.product_totals.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                No inward stock recorded for this company and date range.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {reportData.product_totals.map(pt => (
                  <div 
                    key={pt.product_id}
                    className="p-4 rounded-2xl bg-slate-50 hover:bg-blue-50/50 transition-all border border-slate-200 space-y-2 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-sm text-slate-900 truncate">
                          {pt.product_name}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {pt.batch_count || 0} batches received
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-black text-blue-700 block">
                          {Number(pt.total_received_quantity || 0).toLocaleString('en-IN')} {pt.selling_unit || 'Tray'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-slate-500">Total Purchase Value:</span>
                      <span className="font-black text-emerald-700 font-mono">
                        ₹{Number(pt.total_received_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detailed Inward Transactions Table */}
          <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-blue-200/60 p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Detailed Inward Batch Transactions (வரவு பரிவர்த்தனை பட்டியல்)
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Complete history of stock received into the warehouse with Qty × Buy Rate calculation.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {filteredRecords.length} records found
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-[11px] font-black text-slate-600 uppercase tracking-wider border-b border-slate-200">
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Company / Supplier</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3 text-right">Received Qty</th>
                    <th className="p-3 text-right">Buy Rate (₹)</th>
                    <th className="p-3 text-right">Total Amount (₹)</th>
                    <th className="p-3">Received By</th>
                    <th className="p-3">Reference / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400">
                        No inward transactions match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((rec, idx) => {
                      const qty = Number(rec.quantity_change || rec.quantity || 0);
                      const rate = Number(rec.rate || 0);
                      const total = Number(rec.total_amount || (qty * rate));
                      return (
                        <tr key={rec.id || idx} className="hover:bg-blue-50/40 transition-colors">
                          <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {rec.created_at ? new Date(rec.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                          </td>
                          <td className="p-3 font-bold text-blue-900">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-blue-600" />
                              <span>{rec.supplier_name || rec.notes?.replace('Dealer Inward: ', '') || 'Direct Supplier'}</span>
                            </div>
                          </td>
                          <td className="p-3 font-extrabold text-slate-900">
                            {rec.product_name}
                          </td>
                          <td className="p-3 text-right font-black text-emerald-700 text-sm">
                            +{qty} <span className="text-[10px] font-bold text-slate-500">{rec.unit || 'Tray'}</span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-700">
                            ₹{rate.toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-blue-800 text-sm">
                            ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-slate-600">
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                              <User className="w-3 h-3" />
                              {rec.created_by_name || 'Store Keeper'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 text-[11px]">
                            {rec.notes || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: COMPANY DIRECTORY & BUY RATES */}
      {activeSubTab === 'directory' && (
        <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-blue-200/60 p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Production Supplier Directory & Buy Rates (கம்பெனி & கொள்முதல் விலை)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Manage production suppliers and customize product buy rates per company.
              </p>
            </div>

            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              + Add New Company
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {suppliers.map(s => {
              const rates = s.product_rates || {};
              const configuredRatesCount = Object.keys(rates).filter(k => Number(rates[k]) > 0).length;

              return (
                <div 
                  key={s.id}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-white transition-all border border-slate-200 shadow-sm space-y-3 relative group"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-base text-slate-900">{s.name}</h4>
                        {s.code && (
                          <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-mono">
                            {s.code}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                        <User className="w-3 h-3 text-slate-400" />
                        Contact: {s.contact_person || 'Not specified'}
                      </p>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.is_active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {s.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Buy Rates Badge / Quick Action */}
                  <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-blue-900 font-bold">
                      <Tag className="w-3.5 h-3.5 text-blue-600" />
                      <span>{configuredRatesCount > 0 ? `${configuredRatesCount} Products Buy Rate Configured` : 'Default Product Rates'}</span>
                    </div>
                    <button
                      onClick={() => handleOpenQuickRates(s)}
                      className="text-[11px] font-black text-blue-600 hover:text-blue-800 bg-white px-2 py-1 rounded-lg border border-blue-200 shadow-xs"
                    >
                      Set Rates ✏️
                    </button>
                  </div>

                  <div className="text-xs space-y-1 text-slate-600 pt-1 border-t border-slate-200/60">
                    {s.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{s.phone}</span>
                      </div>
                    )}
                    {s.address && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{s.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <button
                      onClick={() => handleOpenQuickRates(s)}
                      className="text-xs font-extrabold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      Buy Rates Matrix
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(s)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Company Details & Rates"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSupplier(s)}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Company"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ADD / EDIT COMPANY MODAL (WITH EMBEDDED PRODUCT BUY RATES) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-4 sm:p-6 space-y-4 shadow-2xl my-auto max-h-[94dvh] overflow-y-auto animate-scale-in">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-900">
                    {editingSupplier ? 'Edit Company & Buy Rates' : 'Add Production Company & Buy Rates'}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500">
                    சப்ளையர் விபரம் & பொருட்களின் வாங்கும் விலை (Buy Rate)
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveSupplier} className="space-y-4">
              
              {/* SECTION 1: COMPANY BASIC INFO */}
              <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  1. Company Details (கம்பெனி விபரம்)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Arokya Dairy"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase">
                      Company Code / Short
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ARKY"
                      value={companyCode}
                      onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                      className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      placeholder="Manager / Sales Rep"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: PRODUCT BUY RATES MATRIX */}
              <div className="space-y-3 bg-blue-50/50 p-3.5 rounded-2xl border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-blue-600" />
                      2. Product Buy Rates / கொள்முதல் விலை (₹ per Tray/Unit)
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Store Keeper stock receive பண்ணும்போது இந்த விலை தானாக apply ஆகும்.
                    </p>
                  </div>
                  <span className="text-[10px] font-black bg-white text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
                    {activeProducts.length} Products
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {activeProducts.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No active products available.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeProducts.map(prod => (
                        <div 
                          key={prod.id}
                          className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-blue-100 shadow-xs gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">{prod.icon || '🥛'}</span>
                            <div className="truncate">
                              <span className="font-extrabold text-xs text-slate-900 block truncate">
                                {prod.display_name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Unit: {prod.selling_unit || 'Tray'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-xs font-bold text-slate-400">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={productRates[prod.id] !== undefined ? productRates[prod.id] : ''}
                              onChange={(e) => handleRateChange(prod.id, e.target.value)}
                              className="w-20 bg-blue-50/40 border border-blue-200 focus:border-blue-500 rounded-lg px-2 py-1 text-right text-xs font-black text-blue-900 focus:outline-none"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 3: ADDITIONAL SETTINGS & ACTIVE STATUS */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="active_check"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <label htmlFor="active_check" className="text-xs font-bold text-slate-800 select-none">
                    Active Supplier (Store Keeper Receive Stock Dropdown-ல் காண்பி)
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSupplier}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingSupplier ? 'Saving...' : (editingSupplier ? 'Update Company & Rates' : 'Save Company & Rates')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK RATES EDIT MODAL */}
      {rateModalSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-5 space-y-4 shadow-2xl my-auto animate-scale-in">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    Product Buy Rates: {rateModalSupplier.name}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500">
                    கம்பெனிக்கான வாங்கும் விலை (Buy Rate) மாற்றம்
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setRateModalSupplier(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickRates} className="space-y-4">
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {activeProducts.map(prod => (
                  <div 
                    key={prod.id}
                    className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{prod.icon || '🥛'}</span>
                      <div className="truncate">
                        <span className="font-extrabold text-xs text-slate-900 block truncate">
                          {prod.display_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Unit: {prod.selling_unit || 'Tray'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={quickRates[prod.id] !== undefined ? quickRates[prod.id] : ''}
                        onChange={(e) => handleQuickRateChange(prod.id, e.target.value)}
                        className="w-24 bg-white border border-slate-300 focus:border-blue-500 rounded-lg px-2 py-1.5 text-right text-xs font-black text-blue-900 focus:outline-none shadow-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRateModalSupplier(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQuickRates}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingQuickRates ? 'Saving Rates...' : 'Save Buy Rates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
