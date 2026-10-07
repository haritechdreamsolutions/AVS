import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Building2, Plus, Download, Filter, Calendar, Search, 
  Layers, Package, CheckCircle2, RefreshCw, Edit3, Trash2,
  X, Save, FileText, TrendingUp, DollarSign, Clock, User, Phone, MapPin, Tag, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { generateSupplierInwardPDFReport } from '../../utils/pdfReportGenerator';
import { sortProductsCustom } from '../../utils/productOrderHelper';
import { getOperationalUnit } from '../../utils/unitHelper';
import { ProductImage } from '../common/ProductImage';
import { resolveProductImageUrl } from '../../utils/productImageHelper';

export const OwnerSuppliersView = () => {
  const { 
    suppliers = [], 
    products = [], 
    stockMovements = [],
    companyInfo, 
    addSupplier, 
    updateSupplier, 
    deleteSupplier, 
    fetchSupplierInwardReport, 
    refreshData 
  } = useApp();

  // Active view tab: 'directory' (show companies & rates first) or 'inward'
  const [activeSubTab, setActiveSubTab] = useState('directory');

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
  const [directorySearch, setDirectorySearch] = useState('');

  // Report Data State
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportData, setReportData] = useState({
    records: [],
    summary: { total_inward_qty: 0, total_batches: 0, total_companies: 0, total_valuation: 0 },
    product_totals: []
  });

  // Active products for rate configuration
  const activeProducts = useMemo(() => {
    return sortProductsCustom((products || []).filter(p => p.is_active !== false && p.is_active !== 0));
  }, [products]);

  // Company Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [companyName, setCompanyName] = useState('');
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

  // Selected supplier object
  const currentSupplier = useMemo(() => {
    if (selectedSupplierId === 'ALL') return null;
    return suppliers.find(s => String(s.id) === String(selectedSupplierId));
  }, [suppliers, selectedSupplierId]);

  // Helper to compute inward data from client-side stockMovements in real-time
  const computeInwardFromMovements = () => {
    const inwardMovs = (stockMovements || []).filter(m => {
      const type = (m.movement_type || m.type || '').toUpperCase();
      if (type !== 'INWARD') return false;

      // Match supplier if not ALL
      if (selectedSupplierId && selectedSupplierId !== 'ALL') {
        const matchesId = String(m.supplier_id) === String(selectedSupplierId);
        const suppObj = suppliers.find(s => String(s.id) === String(selectedSupplierId));
        const matchesName = suppObj && (
          (m.supplier_name && m.supplier_name.toLowerCase() === suppObj.name.toLowerCase()) ||
          (m.reference && m.reference.toLowerCase().includes(suppObj.name.toLowerCase())) ||
          (m.notes && m.notes.toLowerCase().includes(suppObj.name.toLowerCase()))
        );
        if (!matchesId && !matchesName) return false;
      }

      // Date range filter
      const movDate = (m.movement_date || m.created_at || '').split('T')[0];
      if (startDate && movDate && movDate < startDate) return false;
      if (endDate && movDate && movDate > endDate) return false;

      return true;
    });

    let totalUnits = 0;
    let totalValuation = 0;
    const prodMap = new Map();
    const suppSet = new Set();

    const formattedRecords = inwardMovs.map(m => {
      const prod = products.find(p => p.id === Number(m.product_id) || p.name === m.product_name || p.display_name === m.product_name);
      const supp = suppliers.find(s => String(s.id) === String(m.supplier_id) || s.name === m.supplier_name);
      const qty = Number(m.qty_units || m.quantity || m.quantity_change || 0);
      const rate = Number(m.rate || (supp?.product_rates?.[m.product_id]) || (prod ? (supp?.product_rates?.[prod.id]) : 0) || prod?.purchase_price || 0);
      const total = Number(m.total_amount || (qty * rate));
      const sName = m.supplier_name || supp?.name || m.reference || m.notes?.replace('Supplier: ', '')?.replace('Dealer Inward: ', '') || 'Direct Supplier';
      const pName = m.product_name || prod?.display_name || prod?.name || 'Stock Item';
      const unit = m.unit || prod?.selling_unit || 'Tray';

      totalUnits += qty;
      totalValuation += total;
      suppSet.add(sName);

      const pKey = m.product_id ? `p_${m.product_id}` : `name_${pName}`;
      if (!prodMap.has(pKey)) {
        prodMap.set(pKey, {
          product_id: m.product_id || prod?.id,
          product_name: pName,
          unit: unit,
          selling_unit: unit,
          total_units: 0,
          total_qty: 0,
          total_received_quantity: 0,
          total_amount: 0,
          total_received_amount: 0,
          batches_count: 0,
          batch_count: 0
        });
      }
      const pEntry = prodMap.get(pKey);
      pEntry.total_units += qty;
      pEntry.total_qty += qty;
      pEntry.total_received_quantity += qty;
      pEntry.total_amount += total;
      pEntry.total_received_amount += total;
      pEntry.batches_count += 1;
      pEntry.batch_count += 1;

      return {
        id: m.id,
        movement_no: m.movement_no,
        product_id: m.product_id || prod?.id,
        product_name: pName,
        unit: unit,
        selling_unit: unit,
        supplier_id: m.supplier_id || supp?.id,
        supplier_name: sName,
        qty_units: qty,
        quantity: qty,
        quantity_change: qty,
        rate: rate,
        total_amount: total,
        received_by: m.received_by || m.created_by_name || 'Store Keeper',
        created_by_name: m.received_by || m.created_by_name || 'Store Keeper',
        reference: m.reference,
        notes: m.notes,
        created_at: m.created_at || new Date().toISOString()
      };
    });

    const productTotals = Array.from(prodMap.values())
      .filter(pt => (pt.total_units > 0 || pt.total_qty > 0))
      .map(pt => ({
        ...pt,
        avg_rate: pt.total_units > 0 ? (pt.total_amount / pt.total_units) : 0
      })).sort((a, b) => b.total_units - a.total_units);

    return {
      records: formattedRecords,
      summary: {
        total_inward_qty: totalUnits,
        total_batches: formattedRecords.length,
        total_companies: suppSet.size || (selectedSupplierId === 'ALL' ? suppliers.filter(s => s.is_active !== false).length : (currentSupplier ? 1 : 0)),
        total_valuation: totalValuation
      },
      product_totals: productTotals
    };
  };

  // Load Inward Report from API or Local Movement Cache
  const loadInwardReport = async () => {
    setLoadingReport(true);
    try {
      const filters = {
        supplier_id: selectedSupplierId,
        start_date: startDate || undefined,
        end_date: endDate || undefined
      };
      const data = await fetchSupplierInwardReport(filters);
      if (data && Array.isArray(data.records) && data.records.length > 0) {
        setReportData({
          records: data.records,
          summary: data.summary || { total_inward_qty: 0, total_batches: 0, total_companies: 0, total_valuation: 0 },
          product_totals: data.product_totals || []
        });
      } else {
        // Compute from client-side stock movements
        const localData = computeInwardFromMovements();
        setReportData(localData);
      }
    } catch (err) {
      console.error('Failed to load supplier inward report', err);
      const localData = computeInwardFromMovements();
      setReportData(localData);
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    loadInwardReport();
  }, [selectedSupplierId, startDate, endDate, stockMovements]);

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

  // Filtered suppliers for directory
  const filteredSuppliers = useMemo(() => {
    const list = suppliers || [];
    if (!directorySearch.trim()) return list;
    const q = directorySearch.toLowerCase();
    return list.filter(s => 
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q)) ||
      (s.code && s.code.toLowerCase().includes(q))
    );
  }, [suppliers, directorySearch]);

  // Helper to extract tray and piece rates for a product from rates JSON
  const getProductConfiguredRates = (ratesObj, prod) => {
    if (!ratesObj || !prod) return { trayRate: 0, pieceRate: 0, hasRate: false };
    const val = ratesObj[prod.id];
    const ppu = Math.max(1, Number(prod.pieces_per_unit || 1));
    const opUnit = getOperationalUnit(prod);

    if (val === undefined || val === null || val === '') {
      return { trayRate: 0, pieceRate: 0, hasRate: false };
    }

    if (typeof val === 'object') {
      const t = Number(val.tray_rate !== undefined ? val.tray_rate : (val.rate || 0));
      const p = val.piece_rate !== undefined && val.piece_rate !== '' && !isNaN(Number(val.piece_rate))
        ? Number(val.piece_rate)
        : (t > 0 && opUnit.isPieceBased ? parseFloat((t / ppu).toFixed(2)) : 0);
      return {
        trayRate: t,
        pieceRate: p,
        hasRate: t > 0 || p > 0
      };
    }

    const num = Number(val);
    const p = num > 0 && opUnit.isPieceBased ? parseFloat((num / ppu).toFixed(2)) : 0;
    return {
      trayRate: num,
      pieceRate: p,
      hasRate: num > 0
    };
  };

  // Modal Open Handlers
  const handleOpenAddModal = () => {
    setEditingSupplier(null);
    setCompanyName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setGstin('');
    setNotes('');
    setIsActive(true);

    const initialRates = {};
    activeProducts.forEach(p => {
      initialRates[p.id] = { tray_rate: '', piece_rate: '' };
    });
    setProductRates(initialRates);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (supplier) => {
    setEditingSupplier(supplier);
    setCompanyName(supplier.name || '');
    setContactPerson(supplier.contact_person || '');
    setPhone(supplier.phone || '');
    setEmail(supplier.email || '');
    setAddress(supplier.address || '');
    setGstin(supplier.gstin || '');
    setNotes(supplier.notes || '');
    setIsActive(supplier.is_active !== false);

    const savedRates = supplier.product_rates || {};
    const initialRates = {};
    activeProducts.forEach(p => {
      const ppu = Math.max(1, Number(p.pieces_per_unit || 1));
      const opUnit = getOperationalUnit(p);
      const raw = savedRates[p.id];
      if (raw !== undefined && raw !== null && raw !== '') {
        if (typeof raw === 'object') {
          const t = raw.tray_rate !== undefined ? raw.tray_rate : (raw.rate || '');
          const pRate = raw.piece_rate !== undefined ? raw.piece_rate : '';
          initialRates[p.id] = {
            tray_rate: t,
            piece_rate: pRate !== '' ? pRate : (t && Number(t) > 0 && opUnit.isPieceBased ? (Number(t) / ppu).toFixed(2) : '')
          };
        } else {
          const num = Number(raw);
          initialRates[p.id] = {
            tray_rate: raw,
            piece_rate: num > 0 && opUnit.isPieceBased ? (num / ppu).toFixed(2) : ''
          };
        }
      } else {
        initialRates[p.id] = { tray_rate: '', piece_rate: '' };
      }
    });
    setProductRates(initialRates);
    setIsModalOpen(true);
  };

  const handleOpenQuickRates = (supplier) => {
    setRateModalSupplier(supplier);
    const savedRates = supplier.product_rates || {};
    const initialRates = {};
    activeProducts.forEach(p => {
      const ppu = Math.max(1, Number(p.pieces_per_unit || 1));
      const opUnit = getOperationalUnit(p);
      const raw = savedRates[p.id];
      if (raw !== undefined && raw !== null && raw !== '') {
        if (typeof raw === 'object') {
          const t = raw.tray_rate !== undefined ? raw.tray_rate : (raw.rate || '');
          const pRate = raw.piece_rate !== undefined ? raw.piece_rate : '';
          initialRates[p.id] = {
            tray_rate: t,
            piece_rate: pRate !== '' ? pRate : (t && Number(t) > 0 && opUnit.isPieceBased ? (Number(t) / ppu).toFixed(2) : '')
          };
        } else {
          const num = Number(raw);
          initialRates[p.id] = {
            tray_rate: raw,
            piece_rate: num > 0 && opUnit.isPieceBased ? (num / ppu).toFixed(2) : ''
          };
        }
      } else {
        initialRates[p.id] = { tray_rate: '', piece_rate: '' };
      }
    });
    setQuickRates(initialRates);
  };

  const handleTrayRateChange = (prod, val, isQuick = false) => {
    const ppu = Math.max(1, Number(prod.pieces_per_unit || 1));
    const opUnit = getOperationalUnit(prod);
    const setter = isQuick ? setQuickRates : setProductRates;

    setter(prev => {
      const currentProd = prev[prod.id] || {};
      const oldTray = typeof currentProd === 'object' ? currentProd.tray_rate : currentProd;
      const oldPiece = typeof currentProd === 'object' ? currentProd.piece_rate : '';
      
      let autoPiece = oldPiece;
      const oldAuto = oldTray && Number(oldTray) > 0 ? (Number(oldTray) / ppu).toFixed(2) : '';
      if (opUnit.isPieceBased && (oldPiece === '' || oldPiece === oldAuto)) {
        autoPiece = val && Number(val) > 0 ? (Number(val) / ppu).toFixed(2) : '';
      }

      return {
        ...prev,
        [prod.id]: {
          tray_rate: val,
          piece_rate: autoPiece
        }
      };
    });
  };

  const handlePieceRateChange = (prod, val, isQuick = false) => {
    const setter = isQuick ? setQuickRates : setProductRates;
    setter(prev => {
      const currentProd = prev[prod.id] || {};
      const oldTray = typeof currentProd === 'object' ? currentProd.tray_rate : currentProd;
      return {
        ...prev,
        [prod.id]: {
          tray_rate: oldTray !== undefined ? oldTray : '',
          piece_rate: val
        }
      };
    });
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
    <div className="space-y-6 pb-12 animate-fade-in text-[#002244]">
      
      {/* TOP HEADER & ACTION BUTTONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-sky-300/80 shadow-lg shadow-sky-500/10">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#002244] tracking-tight flex items-center gap-2">
                Companies & Inward
                <span className="text-xs font-bold text-sky-800 bg-sky-100 border border-sky-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  கம்பெனி & வரவு
                </span>
              </h1>
              <p className="text-xs text-sky-950/80 font-medium">
                Production supplier masters, buy rates pricing, inward calculations, and audit reports.
              </p>
            </div>
          </div>
        </div>

        {/* 2 Top Right Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <button
            onClick={handleDownloadPDF}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-white border border-sky-300 hover:bg-sky-50 text-[#002244] font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Download className="w-4 h-4 text-sky-600" />
            <span>Download PDF Report</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Company</span>
          </button>
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="bg-white/85 backdrop-blur-md p-4 rounded-3xl border border-sky-300/80 shadow-md space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Company Filter Dropdown */}
          <div className="flex-1 flex items-center gap-2">
            <span className="text-xs font-black text-[#002244] uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-sky-600" />
              Company:
            </span>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full bg-sky-50/70 border border-sky-300 focus:border-sky-500 rounded-2xl px-3.5 py-2 text-xs font-bold text-[#002244] focus:outline-none focus:ring-2 focus:ring-sky-500/20 shadow-sm"
            >
              <option value="ALL">🏭 All Production Companies ({suppliers.length})</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.is_active === false ? '• (Inactive)' : ''}
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
                    ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-sm shadow-blue-500/30' 
                    : 'bg-sky-100/60 text-[#002244] hover:bg-sky-200/70'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-sky-50/80 border border-sky-300 rounded-2xl px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDateFilter('CUSTOM');
                }}
                className="bg-transparent text-xs font-bold text-[#002244] focus:outline-none"
              />
              <span className="text-sky-600 font-bold text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDateFilter('CUSTOM');
                }}
                className="bg-transparent text-xs font-bold text-[#002244] focus:outline-none"
              />
            </div>

            <button
              onClick={() => {
                handleDateShortcut('THIS_MONTH');
                setSelectedSupplierId('ALL');
                setSearchTerm('');
              }}
              title="Reset Filters"
              className="p-2 rounded-xl bg-sky-100/80 hover:bg-sky-200 text-[#002244] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex items-center justify-between border-t border-sky-100 pt-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('inward')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                activeSubTab === 'inward'
                  ? 'bg-sky-200/80 text-[#002244] border border-sky-400 font-black shadow-xs'
                  : 'text-sky-800 hover:text-[#002244]'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-sky-600" />
              Inward Stock & Calculation (வரவு கணக்கு)
            </button>

            <button
              onClick={() => setActiveSubTab('directory')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                activeSubTab === 'directory'
                  ? 'bg-sky-200/80 text-[#002244] border border-sky-400 font-black shadow-xs'
                  : 'text-sky-800 hover:text-[#002244]'
              }`}
            >
              <Building2 className="w-4 h-4 text-sky-600" />
              Company Directory & Buy Rates ({suppliers.length})
            </button>
          </div>

          {/* Search box for inward records */}
          {activeSubTab === 'inward' && (
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-sky-400" />
              <input
                type="text"
                placeholder="Search product / company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-sky-50/80 border border-sky-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-[#002244] focus:outline-none focus:border-sky-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white/85 backdrop-blur-md p-4 rounded-3xl border border-sky-200/80 shadow-md">
          <div className="flex items-center justify-between text-sky-600 mb-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-sky-800">Total Inward Qty</span>
            <Package className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#002244]">
            {Number(reportData.summary.total_inward_qty || 0).toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] font-bold text-sky-700">Trays / Units Received</span>
        </div>

        <div className="bg-white/85 backdrop-blur-md p-4 rounded-3xl border border-sky-200/80 shadow-md">
          <div className="flex items-center justify-between text-emerald-600 mb-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-sky-800">Total Batches</span>
            <Clock className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#002244]">
            {reportData.summary.total_batches || 0}
          </p>
          <span className="text-[10px] font-bold text-emerald-700">Inward Movements</span>
        </div>

        <div className="bg-white/85 backdrop-blur-md p-4 rounded-3xl border border-sky-200/80 shadow-md">
          <div className="flex items-center justify-between text-amber-600 mb-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-sky-800">Total Valuation</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#002244]">
            ₹{Number(reportData.summary.total_valuation || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <span className="text-[10px] font-bold text-amber-700">Purchase Amount (Qty × Buy Rate)</span>
        </div>

        <div className="bg-white/85 backdrop-blur-md p-4 rounded-3xl border border-sky-200/80 shadow-md">
          <div className="flex items-center justify-between text-indigo-600 mb-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-sky-800">Active Companies</span>
            <Building2 className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#002244]">
            {selectedSupplierId === 'ALL' ? suppliers.length : 1}
          </p>
          <span className="text-[10px] font-bold text-indigo-700">Suppliers Selected</span>
        </div>
      </div>

      {/* TAB CONTENT 1: INWARD STOCK & CALCULATION */}
      {activeSubTab === 'inward' && (
        <div className="space-y-6">
          
          {/* Product-wise calculation summary */}
          <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-sky-300/80 p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-base text-[#002244] flex items-center gap-2">
                  <Layers className="w-5 h-5 text-sky-600" />
                  Product Quantity & Valuation Calculation (பொருட்கள் வாரியான கணக்கு)
                </h3>
                <p className="text-xs text-sky-900/80 font-medium">
                  {selectedSupplierId === 'ALL' ? 'Total quantity & purchase cost received across all companies' : `Received stock calculation for ${currentSupplier?.name || 'Selected Company'}`}
                </p>
              </div>
              <span className="text-xs font-black bg-sky-100 text-sky-800 px-3 py-1 rounded-xl border border-sky-200">
                {reportData.product_totals.length} Products Inwarded
              </span>
            </div>

            {loadingReport ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-sky-600">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <p className="text-xs font-bold">Calculating inward quantities...</p>
              </div>
            ) : reportData.product_totals.length === 0 ? (
              <div className="py-10 text-center text-sky-800/60 text-xs">
                No inward stock recorded for this company and date range.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {reportData.product_totals.map((pt, idx) => {
                  const matchedProd = products.find(p => p.id === Number(pt.product_id) || p.name === pt.product_name || p.display_name === pt.product_name);
                  return (
                    <div 
                      key={pt.product_id || idx}
                      className="p-4 rounded-3xl bg-gradient-to-b from-sky-50 via-white to-sky-50/70 hover:to-sky-100/70 transition-all border-2 border-sky-200 hover:border-sky-300 space-y-3 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <ProductImage 
                          src={resolveProductImageUrl(matchedProd)}
                          alt={pt.product_name}
                          size={46}
                          icon={matchedProd?.icon || '📦'}
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-sm sm:text-base text-[#002244] truncate">
                            {pt.product_name}
                          </h4>
                          <p className="text-xs text-sky-800 font-bold">
                            {pt.batch_count || pt.batches_count || 0} batches received
                          </p>
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-sky-200/90 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-sky-900 block">Total Inward Qty</span>
                          <span className="text-base sm:text-lg font-black text-blue-900 font-mono">
                            {Number(pt.total_received_quantity || pt.total_qty || pt.total_units || 0).toLocaleString('en-IN')} <span className="text-xs font-bold text-sky-700">{pt.selling_unit || pt.unit || 'Tray'}</span>
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-sky-900 block">Purchase Value</span>
                          <span className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                            ₹{Number(pt.total_received_amount || pt.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detailed Inward Transactions Table */}
          <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-sky-300/80 p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-base text-[#002244] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-sky-600" />
                  Detailed Inward Batch Transactions (வரவு பரிவர்த்தனை பட்டியல்)
                </h3>
                <p className="text-xs text-sky-900/80 font-medium">
                  Complete history of stock received into the warehouse with Qty × Buy Rate calculation.
                </p>
              </div>
              <span className="text-xs font-bold text-sky-800">
                {filteredRecords.length} records found
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-sky-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sky-100/70 text-[11px] font-black text-sky-900 uppercase tracking-wider border-b border-sky-200">
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
                <tbody className="divide-y divide-sky-100 text-xs font-medium text-[#002244]">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-sky-800/60">
                        No inward transactions match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((rec, idx) => {
                      const qty = Number(rec.quantity_change || rec.quantity || 0);
                      const rate = Number(rec.rate || 0);
                      const total = Number(rec.total_amount || (qty * rate));
                      return (
                        <tr key={rec.id || idx} className="hover:bg-sky-100/50 transition-colors">
                          <td className="p-3 font-mono text-[11px] text-sky-800 whitespace-nowrap">
                            {rec.created_at ? new Date(rec.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                          </td>
                          <td className="p-3 font-bold text-blue-900">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-sky-600" />
                              <span>{rec.supplier_name || rec.notes?.replace('Dealer Inward: ', '') || 'Direct Supplier'}</span>
                            </div>
                          </td>
                          <td className="p-3 font-extrabold text-[#002244]">
                            {rec.product_name}
                          </td>
                          <td className="p-3 text-right font-black text-emerald-700 text-sm">
                            +{qty} <span className="text-[10px] font-bold text-sky-800">{rec.unit || 'Tray'}</span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-sky-900">
                            ₹{rate.toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-blue-800 text-sm">
                            ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-sky-900">
                            <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-900 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                              <User className="w-3 h-3" />
                              {rec.created_by_name || 'Store Keeper'}
                            </span>
                          </td>
                          <td className="p-3 text-sky-800 text-[11px]">
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
        <div className="space-y-6">

          {/* Section Heading & Quick Add Bar */}
          <div className="bg-white/85 backdrop-blur-md p-4 rounded-3xl border border-sky-300/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-[#002244] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600" />
                Production Companies & Assigned Product Buy Rates (கம்பெனிகள் & கொள்முதல் விலை)
              </h2>
              <p className="text-xs text-sky-950 font-medium">
                Here are all registered production companies. You can view, edit company details, or adjust product buy rates at any time.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-black bg-sky-100 text-sky-900 px-3 py-1 rounded-xl border border-sky-300">
                {filteredSuppliers.length} Companies Registered
              </span>
              <button
                onClick={handleOpenAddModal}
                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Company</span>
              </button>
            </div>
          </div>

          {/* COMPANY CARDS GRID WITH LIVE PRODUCT RATES */}
          {filteredSuppliers.length === 0 ? (
            <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-sky-300/80 p-8 text-center space-y-3 shadow-md">
              <Building2 className="w-12 h-12 text-sky-400 mx-auto" />
              <h3 className="font-black text-sm text-[#002244]">No Production Companies Found</h3>
              <p className="text-xs text-sky-800 max-w-md mx-auto font-medium">
                Add your production suppliers (e.g., Arokya, Cavin's, Dodla) to configure product buy rates for inward stock calculations.
              </p>
              <button
                onClick={handleOpenAddModal}
                className="px-5 py-2 rounded-2xl bg-sky-600 text-white font-black text-xs inline-flex items-center gap-2 shadow-md"
              >
                <Plus className="w-4 h-4" />
                Add First Company
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
              {filteredSuppliers.map(s => {
                const rates = s.product_rates || {};
                const configuredCount = Object.keys(rates).filter(k => {
                  const r = rates[k];
                  if (typeof r === 'object' && r !== null) {
                    return Number(r.tray_rate) > 0 || Number(r.piece_rate) > 0;
                  }
                  return Number(r) > 0;
                }).length;

                return (
                  <div 
                    key={s.id}
                    className="p-5 sm:p-6 rounded-3xl bg-gradient-to-b from-sky-50/50 via-white to-sky-50/70 hover:to-sky-100/50 transition-all border-2 border-sky-300/90 shadow-md hover:shadow-lg space-y-4 relative group"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-sky-200 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-blue-500/20">
                          {s.name ? s.name.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div>
                          <h3 className="font-black text-base sm:text-lg text-[#002244] leading-snug">
                            {s.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-sky-900 font-bold">
                            {s.code && <span className="bg-sky-100 px-2 py-0.5 rounded-lg text-[11px] font-mono border border-sky-300">{s.code}</span>}
                            <span>Contact: {s.contact_person || 'Not specified'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-black px-3 py-1 rounded-full ${s.is_active !== false ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                          {s.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    {/* Contact & Info Chips */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-sky-950 font-semibold bg-sky-100/50 p-3 rounded-2xl border border-sky-200">
                      <div className="flex items-center gap-2 truncate">
                        <Phone className="w-4 h-4 text-sky-600 shrink-0" />
                        <span className="font-bold text-sky-950 truncate">{s.phone || 'Phone not set'}</span>
                      </div>
                      <div className="flex items-center gap-2 truncate">
                        <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                        <span className="truncate">{s.address || 'Address not set'}</span>
                      </div>
                      {s.gstin && (
                        <div className="col-span-1 sm:col-span-2 flex items-center gap-2 text-xs font-mono text-sky-900">
                          <Tag className="w-4 h-4 text-sky-600 shrink-0" />
                          <span>GSTIN: <strong>{s.gstin}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* PRODUCT BUY RATES SECTION (PROMINENTLY DISPLAYED WITH PRODUCT IMAGE) */}
                    <div className="space-y-2.5 bg-gradient-to-b from-sky-100/60 to-sky-50/80 p-4 rounded-2xl border-2 border-sky-300">
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-black text-[#002244] uppercase tracking-wider flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-sky-700" />
                          Configured Buy Rates ({configuredCount}/{activeProducts.length})
                        </span>

                        <button
                          onClick={() => handleOpenQuickRates(s)}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-sky-50 text-sky-900 border-2 border-sky-300 text-xs font-black shadow-sm flex items-center gap-1.5 transition-all hover:scale-[1.03]"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-sky-600" />
                          <span>Edit Rates ✏️</span>
                        </button>
                      </div>

                      {activeProducts.length === 0 ? (
                        <p className="text-xs text-sky-800">No active products.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 max-h-56 overflow-y-auto pr-1">
                          {activeProducts.map(prod => {
                            const opUnit = getOperationalUnit(prod);
                            const isTray = opUnit.isPieceBased;
                            const ratesInfo = getProductConfiguredRates(rates, prod);

                            return (
                              <div 
                                key={prod.id}
                                className={`p-2.5 rounded-2xl border-2 transition-all flex items-center gap-3 ${
                                  ratesInfo.hasRate 
                                    ? 'bg-white border-sky-300 shadow-xs' 
                                    : 'bg-white/60 border-sky-200/80 text-sky-800/70'
                                }`}
                              >
                                <ProductImage 
                                  src={resolveProductImageUrl(prod)}
                                  alt={prod.display_name}
                                  size={38}
                                  icon={prod.icon || '📦'}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="font-black text-[#002244] truncate text-xs sm:text-sm" title={prod.display_name}>
                                    {prod.display_name}
                                  </div>
                                  {isTray ? (
                                    <div className="flex items-center gap-2 mt-0.5 text-xs">
                                      <span className="text-sky-900 font-black">
                                        Tray: <span className={`font-mono ${ratesInfo.trayRate > 0 ? 'text-blue-900 font-black' : 'text-slate-400'}`}>
                                          {ratesInfo.trayRate > 0 ? `₹${ratesInfo.trayRate.toFixed(2)}` : '₹0'}
                                        </span>
                                      </span>
                                      <span className="text-indigo-900 font-black">
                                        Pcs: <span className={`font-mono ${ratesInfo.pieceRate > 0 ? 'text-indigo-900 font-black' : 'text-slate-400'}`}>
                                          {ratesInfo.pieceRate > 0 ? `₹${ratesInfo.pieceRate.toFixed(2)}` : '₹0'}
                                        </span>
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="mt-0.5 text-xs font-black text-blue-900 font-mono">
                                      {ratesInfo.trayRate > 0 ? `₹${ratesInfo.trayRate.toFixed(2)}` : '₹0.00'} <span className="text-[10px] text-sky-700 font-sans font-bold">/{prod.selling_unit || 'Unit'}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Card Bottom Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-sky-100">
                      <button
                        onClick={() => {
                          setSelectedSupplierId(String(s.id));
                          setActiveSubTab('inward');
                        }}
                        className="text-xs font-black text-sky-700 hover:text-sky-900 hover:underline flex items-center gap-1"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>View Inward History ➔</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenQuickRates(s)}
                          className="px-3 py-1.5 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-900 font-extrabold text-xs flex items-center gap-1 transition-colors"
                        >
                          <DollarSign className="w-3.5 h-3.5 text-sky-700" />
                          <span>Rates</span>
                        </button>

                        <button
                          onClick={() => handleOpenEditModal(s)}
                          className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs flex items-center gap-1 shadow-sm transition-colors"
                          title="Edit Company Details & Rates"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => handleDeleteSupplier(s)}
                          className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl transition-colors"
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
          )}

          {/* COMPREHENSIVE PRODUCT BUY RATES COMPARISON MATRIX TABLE */}
          {suppliers.length > 0 && activeProducts.length > 0 && (
            <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-sky-300/80 p-5 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-black text-base text-[#002244] flex items-center gap-2">
                    <Layers className="w-5 h-5 text-sky-600" />
                    Product Buy Rates Comparison Matrix (அனைத்து கம்பெனி விலை ஒப்பீடு)
                  </h3>
                  <p className="text-xs text-sky-950 font-medium">
                    Side-by-side product purchase price comparison across all registered production suppliers.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-sky-200 shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-sky-100/90 text-[#002244] font-black border-b border-sky-200">
                      <th className="p-3 sticky left-0 bg-sky-100 z-10">Product Name</th>
                      <th className="p-3">Unit</th>
                      {suppliers.map(s => (
                        <th key={s.id} className="p-3 text-right">
                          <div className="font-black text-[#002244]">{s.name}</div>
                          <button
                            onClick={() => handleOpenQuickRates(s)}
                            className="text-[10px] text-sky-700 hover:underline font-bold"
                          >
                            Edit ✏️
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100 bg-white/70">
                    {activeProducts.map(prod => {
                      const opUnit = getOperationalUnit(prod);
                      const isTray = opUnit.isPieceBased;
                      return (
                        <tr key={prod.id} className="hover:bg-sky-50/80 transition-colors">
                          <td className="p-3 sticky left-0 bg-white/95 z-10">
                            <div className="flex items-center gap-2.5">
                              <ProductImage
                                src={resolveProductImageUrl(prod)}
                                alt={prod.display_name}
                                size={36}
                                icon={prod.icon || '📦'}
                              />
                              <div>
                                <span className="font-black text-xs sm:text-sm text-[#002244] block">
                                  {prod.display_name}
                                </span>
                                <span className="text-[10px] font-bold text-sky-800 block">
                                  {prod.pieces_per_unit ? `${prod.pieces_per_unit} Pcs / Tray` : (prod.category || 'Standard')}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-sky-900 font-bold text-xs">
                            {prod.selling_unit || 'Tray'}
                          </td>
                          {suppliers.map(s => {
                            const ratesInfo = getProductConfiguredRates(s.product_rates, prod);
                            return (
                              <td key={s.id} className="p-3 text-right font-mono font-bold">
                                {ratesInfo.hasRate ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="text-blue-900 font-black text-xs bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-300 shadow-2xs">
                                      ₹{ratesInfo.trayRate.toFixed(2)} {isTray ? '/Tray' : ''}
                                    </span>
                                    {isTray && ratesInfo.pieceRate > 0 && (
                                      <span className="text-indigo-900 font-black text-[11px] bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-200">
                                        ₹{ratesInfo.pieceRate.toFixed(2)}/Pcs
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-medium text-xs">₹0.00</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ADD / EDIT COMPANY MODAL (WITH EMBEDDED PRODUCT BUY RATES) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0a192f]/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
          <div className="bg-gradient-to-b from-sky-50 via-white to-sky-50/95 border-2 border-sky-300 rounded-3xl max-w-2xl w-full p-4 sm:p-6 space-y-4 shadow-2xl my-auto max-h-[94dvh] overflow-y-auto animate-scale-in text-[#002244]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-sky-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-xl text-[#002244]">
                    {editingSupplier ? 'Edit Company & Buy Rates' : 'Add Production Company & Buy Rates'}
                  </h3>
                  <p className="text-xs font-bold text-sky-800">
                    சப்ளையர் விபரம் & பொருட்களின் வாங்கும் விலை (Buy Rate)
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-sky-600 hover:text-sky-900 rounded-xl hover:bg-sky-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveSupplier} className="space-y-4">
              
              {/* SECTION 1: COMPANY BASIC INFO */}
              <div className="space-y-3 bg-sky-100/50 p-4 rounded-2xl border-2 border-sky-200">
                <h4 className="text-xs sm:text-sm font-black text-[#002244] uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-sky-600" />
                  1. Company Details (கம்பெனி விபரம்)
                </h4>

                {/* Company Name Full Width */}
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-[#002244] uppercase tracking-wider">
                    Company Name / தயாரிப்பு கம்பெனி பெயர் *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Arokya Dairy / Cavin's / Dodla"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-white border-2 border-sky-300 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-black text-[#002244] focus:outline-none shadow-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-extrabold text-[#002244] uppercase">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      placeholder="Manager / Sales Rep"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="w-full bg-white border border-sky-300 focus:border-sky-500 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-[#002244] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-extrabold text-[#002244] uppercase">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-white border border-sky-300 focus:border-sky-500 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-[#002244] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: PRODUCT BUY RATES MATRIX WITH PRODUCT IMAGE */}
              <div className="space-y-3 bg-gradient-to-b from-sky-100/70 to-sky-50/80 p-4 rounded-2xl border-2 border-sky-300">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-[#002244] uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-sky-600" />
                      2. Product Buy Rates / கொள்முதல் விலை (Tray & Piece Rates)
                    </h4>
                    <p className="text-xs text-sky-900/90 font-bold">
                      Store Keeper stock receive பண்ணும்போது Tray மற்றும் Piece-க்கு இந்த விலை தானாக apply ஆகும்.
                    </p>
                  </div>
                  <span className="text-xs font-black bg-white text-sky-900 px-3 py-1 rounded-xl border border-sky-300 shadow-2xs">
                    {activeProducts.length} Products
                  </span>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {activeProducts.length === 0 ? (
                    <p className="text-xs text-sky-700 text-center py-4">No active products available.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {activeProducts.map(prod => {
                        const opUnit = getOperationalUnit(prod);
                        const isTray = opUnit.isPieceBased;
                        const currentVal = productRates[prod.id];
                        const trayVal = typeof currentVal === 'object' ? (currentVal.tray_rate ?? '') : (currentVal ?? '');
                        const pieceVal = typeof currentVal === 'object' ? (currentVal.piece_rate ?? '') : '';

                        return (
                          <div 
                            key={prod.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 rounded-2xl border-2 border-sky-200/90 hover:border-sky-400 shadow-xs gap-3 transition-all"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <ProductImage 
                                src={resolveProductImageUrl(prod)}
                                alt={prod.display_name}
                                size={44}
                                icon={prod.icon || '🥛'}
                              />
                              <div className="truncate">
                                <span className="font-black text-xs sm:text-sm text-[#002244] block truncate">
                                  {prod.display_name}
                                </span>
                                <span className="text-xs font-bold text-sky-800 block">
                                  {prod.selling_unit || 'Tray'} ({prod.pieces_per_unit || 1} Pcs/Tray)
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 justify-end flex-wrap sm:flex-nowrap">
                              {isTray ? (
                                <>
                                  {/* Tray Rate Box */}
                                  <div className="flex items-center gap-1.5 bg-sky-50 px-2.5 py-1 rounded-xl border-2 border-sky-300">
                                    <span className="text-xs font-black text-sky-900">₹/Tray</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder="0.00"
                                      value={trayVal}
                                      onChange={(e) => handleTrayRateChange(prod, e.target.value)}
                                      className="w-20 bg-white border border-sky-300 focus:border-sky-500 rounded-lg px-2 py-1 text-right text-xs sm:text-sm font-black text-blue-900 focus:outline-none"
                                    />
                                  </div>

                                  {/* Piece Rate Box */}
                                  <div className="flex items-center gap-1.5 bg-indigo-50 px-2.5 py-1 rounded-xl border-2 border-indigo-200">
                                    <span className="text-xs font-black text-indigo-900">₹/Pcs</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder="0.00"
                                      value={pieceVal}
                                      onChange={(e) => handlePieceRateChange(prod, e.target.value)}
                                      className="w-16 bg-white border border-indigo-300 focus:border-indigo-500 rounded-lg px-1.5 py-1 text-right text-xs sm:text-sm font-black text-indigo-900 focus:outline-none"
                                    />
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center gap-1.5 bg-sky-50 px-3 py-1 rounded-xl border-2 border-sky-300">
                                  <span className="text-xs font-black text-sky-900">₹/{prod.selling_unit || 'Unit'}</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={trayVal}
                                    onChange={(e) => handleTrayRateChange(prod, e.target.value)}
                                    className="w-24 bg-white border border-sky-300 focus:border-sky-500 rounded-lg px-2 py-1 text-right text-xs sm:text-sm font-black text-blue-900 focus:outline-none"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 3: ADDITIONAL SETTINGS & ACTIVE STATUS */}
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="active_check"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-5 h-5 text-sky-600 rounded-lg border-2 border-sky-300 focus:ring-sky-500"
                  />
                  <label htmlFor="active_check" className="text-xs sm:text-sm font-black text-[#002244] select-none">
                    Active Supplier (Store Keeper Receive Stock Dropdown-ல் காண்பி)
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-sky-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-sky-900 hover:bg-sky-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSupplier}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
        <div className="fixed inset-0 z-50 bg-[#0a192f]/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-gradient-to-b from-sky-50 via-white to-sky-50/95 border-2 border-sky-300 rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-4 shadow-2xl my-auto animate-scale-in text-[#002244]">
            
            <div className="flex items-center justify-between border-b border-sky-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Tag className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-xl text-[#002244]">
                    Buy Rates: {rateModalSupplier.name}
                  </h3>
                  <p className="text-xs font-bold text-sky-800">
                    கம்பெனிக்கான வாங்கும் விலை (Buy Rate) மாற்றம்
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setRateModalSupplier(null)}
                className="p-2 text-sky-600 hover:text-sky-900 rounded-xl hover:bg-sky-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickRates} className="space-y-4">
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {activeProducts.map(prod => {
                  const opUnit = getOperationalUnit(prod);
                  const isTray = opUnit.isPieceBased;
                  const currentVal = quickRates[prod.id];
                  const trayVal = typeof currentVal === 'object' ? (currentVal.tray_rate ?? '') : (currentVal ?? '');
                  const pieceVal = typeof currentVal === 'object' ? (currentVal.piece_rate ?? '') : '';

                  return (
                    <div 
                      key={prod.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 rounded-2xl border-2 border-sky-200/90 hover:border-sky-400 gap-3 shadow-xs transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <ProductImage 
                          src={resolveProductImageUrl(prod)}
                          alt={prod.display_name}
                          size={46}
                          icon={prod.icon || '🥛'}
                        />
                        <div className="truncate">
                          <span className="font-black text-xs sm:text-sm text-[#002244] block truncate">
                            {prod.display_name}
                          </span>
                          <span className="text-xs font-bold text-sky-800 block">
                            {prod.selling_unit || 'Tray'} ({prod.pieces_per_unit || 1} Pcs)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 justify-end flex-wrap sm:flex-nowrap">
                        {isTray ? (
                          <>
                            <div className="flex items-center gap-1.5 bg-sky-50 px-2.5 py-1 rounded-xl border-2 border-sky-300">
                              <span className="text-xs font-black text-sky-900">₹/Tray</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={trayVal}
                                onChange={(e) => handleTrayRateChange(prod, e.target.value, true)}
                                className="w-20 bg-white border border-sky-300 focus:border-sky-500 rounded-lg px-2 py-1 text-right text-xs sm:text-sm font-black text-blue-900 focus:outline-none"
                              />
                            </div>
                            <div className="flex items-center gap-1.5 bg-indigo-50 px-2.5 py-1 rounded-xl border-2 border-indigo-200">
                              <span className="text-xs font-black text-indigo-900">₹/Pcs</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={pieceVal}
                                onChange={(e) => handlePieceRateChange(prod, e.target.value, true)}
                                className="w-16 bg-white border border-indigo-300 focus:border-indigo-500 rounded-lg px-1.5 py-1 text-right text-xs sm:text-sm font-black text-indigo-900 focus:outline-none"
                              />
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-sky-50 px-3 py-1 rounded-xl border-2 border-sky-300">
                            <span className="text-xs font-black text-sky-900">₹/{prod.selling_unit || 'Case'}</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={trayVal}
                              onChange={(e) => handleTrayRateChange(prod, e.target.value, true)}
                              className="w-24 bg-white border border-sky-300 focus:border-sky-500 rounded-lg px-2 py-1 text-right text-xs sm:text-sm font-black text-blue-900 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-sky-200">
                <button
                  type="button"
                  onClick={() => setRateModalSupplier(null)}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-sky-900 hover:bg-sky-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQuickRates}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
