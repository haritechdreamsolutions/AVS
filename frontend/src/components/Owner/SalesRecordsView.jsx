import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ShoppingBag, Search, Filter, Eye, Printer, DollarSign, 
  Smartphone, CreditCard, ArrowRightLeft, UserCheck, Truck, 
  Store, Calendar, Clock, X, ChevronRight, CheckCircle2, 
  Layers, RotateCcw, AlertTriangle, ChevronDown, SlidersHorizontal, Download 
} from 'lucide-react';
import { ThermalBillModal } from '../Employee/ThermalBillModal';
import { generateSalesRecordsPDFReport } from '../../utils/pdfReportGenerator';

const PRODUCT_IMAGES = {
  1: { image: '/images/amirthaa_milk_200ml.png', sizeBadge: '200 ml' },
  5: { image: '/images/amirthaa_milk_500ml.png', sizeBadge: '500 ml' },
  6: { image: '/images/amirthaa_milk_1l.jpg', sizeBadge: '1 Ltr' },
  7: { image: '/images/amirthaa_curd_200ml.jpg', sizeBadge: '200 ml' },
  8: { image: '/images/amirthaa_curd_500ml.jpg', sizeBadge: '500 ml' },
  9: { image: '/images/amirthaa_curd_1l.jpg', sizeBadge: '1 Ltr' },
  10: { image: '/images/coccola_200ml.png', sizeBadge: '200 ml' },
  3: { image: '/images/coccola_500ml.png', sizeBadge: '500 ml' },
  11: { image: '/images/coccola_1l.png', sizeBadge: '1 Ltr' },
  12: { image: '/images/juice_hero.jpg', sizeBadge: 'Fresh Pack' },
  15: { image: '/images/tata_hero.jpg', sizeBadge: 'Gluco Can' },
  18: { image: '/images/aquafresh_water_200ml.png', sizeBadge: '200 ml' },
  19: { image: '/images/aquafresh_water_500ml.png', sizeBadge: '500 ml' },
  2: { image: '/images/aquafresh_water_1l.png', sizeBadge: '1 Ltr' },
  20: { image: '/images/aquafresh_water_2l.png', sizeBadge: '2 Ltr' }
};

// Helper function to format JS Date object into YYYY-MM-DD string
const formatYMD = (dateObj) => {
  if (!dateObj || isNaN(dateObj.getTime())) return '';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Helper function to extract exact YYYY-MM-DD from any sale object (respecting IST business dates)
const extractSaleDateYMD = (sale) => {
  if (!sale) return '';
  // 1. Direct sale_date string from PostgreSQL
  if (typeof sale.sale_date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(sale.sale_date)) {
    return sale.sale_date.substring(0, 10);
  }
  // 2. Direct date string
  if (typeof sale.date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(sale.date)) {
      return sale.date.substring(0, 10);
    }
    if (/^\d{2}-\d{2}-\d{4}/.test(sale.date)) {
      const [d, m, y] = sale.date.split('-');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  // 3. From created_at timestamp
  if (sale.created_at) {
    const d = new Date(sale.created_at);
    if (!isNaN(d.getTime())) {
      return formatYMD(d);
    }
  }
  return '';
};

export const SalesRecordsView = () => {
  const { sales = [], shops = [], API_URL, apiFetch, exportReportData } = useApp();

  // ------------------------------------------------------------------
  // ADVANCED FILTER STATE MANAGEMENT
  // ------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [quickDate, setQuickDate] = useState('ALL'); // ALL, TODAY, YESTERDAY, THIS_WEEK, THIS_MONTH, CUSTOM
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sellerFilter, setSellerFilter] = useState('ALL'); // ALL, STORE, or employee_id string
  const [paymentFilter, setPaymentFilter] = useState('ALL'); // ALL, CASH, GPAY, CREDIT, SPLIT
  const [salesSource, setSalesSource] = useState('ALL'); // ALL, DIRECT, ROUTE
  const [shopFilter, setShopFilter] = useState('ALL'); // ALL or shop_id string
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('ALL'); // ALL, PAID, PARTIAL, CREDIT

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [selectedSaleDetails, setSelectedSaleDetails] = useState(null);
  const [printThermalBill, setPrintThermalBill] = useState(null);

  useEffect(() => {
    if (selectedSaleDetails && (!selectedSaleDetails.items || selectedSaleDetails.items.length === 0)) {
      const saleId = selectedSaleDetails.id || selectedSaleDetails.bill_no;
      if (saleId && apiFetch && API_URL) {
        apiFetch(`${API_URL}/sales/${saleId}`)
          .then(res => res.json())
          .then(data => {
            if (data && data.id) {
              setSelectedSaleDetails(data);
            }
          })
          .catch(err => console.error("Error loading sale items:", err));
      }
    }
  }, [selectedSaleDetails, API_URL, apiFetch]);

  // Extract unique sellers dynamically from actual sales & employees
  const availableSellers = useMemo(() => {
    const sellersMap = new Map();
    (sales || []).forEach(s => {
      if (s.is_store_direct_sale || Number(s.employee_id) === 6 || (s.employee_name && s.employee_name.toLowerCase().includes('store'))) {
        sellersMap.set('STORE', { id: 'STORE', name: '🏬 Store Keeper (Counter)' });
      } else if (s.employee_id) {
        sellersMap.set(String(s.employee_id), { id: String(s.employee_id), name: `🚚 ${s.employee_name || 'Driver'}` });
      }
    });
    return Array.from(sellersMap.values());
  }, [sales]);

  // Extract unique shops dynamically from actual sales records
  const availableShops = useMemo(() => {
    const shopMap = new Map();
    (shops || []).forEach(sh => {
      shopMap.set(String(sh.id), { id: String(sh.id), name: sh.name });
    });
    (sales || []).forEach(s => {
      if (s.shop_id && !shopMap.has(String(s.shop_id))) {
        shopMap.set(String(s.shop_id), { id: String(s.shop_id), name: s.shop_name || `Shop #${s.shop_id}` });
      }
    });
    return Array.from(shopMap.values());
  }, [sales, shops]);

  // Handle Quick Date Selection
  const handleQuickDateSelect = (mode) => {
    setQuickDate(mode);
    const now = new Date();
    const todayYmd = formatYMD(now);

    if (mode === 'ALL') {
      setFromDate('');
      setToDate('');
    } else if (mode === 'TODAY') {
      setFromDate(todayYmd);
      setToDate(todayYmd);
    } else if (mode === 'YESTERDAY') {
      const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yestYmd = formatYMD(yest);
      setFromDate(yestYmd);
      setToDate(yestYmd);
    } else if (mode === 'THIS_WEEK') {
      const day = now.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      setFromDate(formatYMD(monday));
      setToDate(formatYMD(sunday));
    } else if (mode === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFromDate(formatYMD(firstDay));
      setToDate(formatYMD(lastDay));
    } else if (mode === 'CUSTOM') {
      if (!fromDate) setFromDate(todayYmd);
      if (!toDate) setToDate(todayYmd);
    }
  };

  // Date Range Validation Check
  const dateError = useMemo(() => {
    if (fromDate && toDate && fromDate > toDate) {
      return "From date cannot be later than To date.";
    }
    return null;
  }, [fromDate, toDate]);

  // Amount Range Validation Check
  const amountError = useMemo(() => {
    if (minAmount !== '' && maxAmount !== '' && Number(minAmount) > Number(maxAmount)) {
      return "Minimum amount cannot be greater than Maximum amount.";
    }
    if ((minAmount !== '' && Number(minAmount) < 0) || (maxAmount !== '' && Number(maxAmount) < 0)) {
      return "Amount values cannot be negative.";
    }
    return null;
  }, [minAmount, maxAmount]);

  // ------------------------------------------------------------------
  // COMBINED MULTI-FIELD FILTER ENGINE (BOOLEAN AND LOGIC)
  // ------------------------------------------------------------------
  const filteredSales = useMemo(() => {
    if (dateError) return []; // Block execution if invalid date range

    return (sales || []).filter(sale => {
      const saleYmd = extractSaleDateYMD(sale);
      const isStoreCounter = sale.is_store_direct_sale || Number(sale.employee_id) === 6 || sale.role === 'STORE_KEEPER' || (sale.employee_name && sale.employee_name.toLowerCase().includes('store'));

      // 1. DATE RANGE FILTER (From Date <= saleYmd <= To Date, inclusive)
      if (fromDate && saleYmd && saleYmd < fromDate) return false;
      if (toDate && saleYmd && saleYmd > toDate) return false;
      if ((fromDate || toDate) && !saleYmd) return false;

      // 2. SELLER FILTER
      if (sellerFilter !== 'ALL') {
        if (sellerFilter === 'STORE') {
          if (!isStoreCounter) return false;
        } else {
          if (String(sale.employee_id) !== String(sellerFilter)) return false;
        }
      }

      // 3. PAYMENT METHOD FILTER
      if (paymentFilter !== 'ALL') {
        const mode = (sale.payment_mode || 'CASH').toUpperCase();
        if (mode !== paymentFilter.toUpperCase()) return false;
      }

      // 4. SALES SOURCE FILTER
      if (salesSource !== 'ALL') {
        if (salesSource === 'DIRECT' && !isStoreCounter) return false;
        if (salesSource === 'ROUTE' && isStoreCounter) return false;
      }

      // 5. SHOP / CUSTOMER FILTER
      if (shopFilter !== 'ALL') {
        if (String(sale.shop_id) !== String(shopFilter) && (!sale.shop_name || !sale.shop_name.toLowerCase().includes(String(shopFilter).toLowerCase()))) {
          return false;
        }
      }

      // 6. AMOUNT RANGE FILTER
      const amt = Number(sale.total_amount || 0);
      if (minAmount !== '' && amt < Number(minAmount)) return false;
      if (maxAmount !== '' && amt > Number(maxAmount)) return false;

      // 7. PAYMENT STATUS FILTER
      if (paymentStatus !== 'ALL') {
        const mode = (sale.payment_mode || 'CASH').toUpperCase();
        let status = 'PAID';
        if (mode === 'CREDIT' || (sale.credit_paid || 0) > 0 || (sale.balance || 0) > 0) {
          status = (sale.cash_paid > 0 || sale.gpay_paid > 0) ? 'PARTIAL' : 'CREDIT';
        }
        if (mode === 'SPLIT') status = 'PARTIAL';

        if (status !== paymentStatus.toUpperCase()) return false;
      }

      // 8. BILL NUMBER & MULTI-FIELD SEARCH
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const bNo = (sale.bill_no || '').toLowerCase();
        const sName = (sale.shop_name || sale.customer_name || '').toLowerCase();
        const eName = (sale.employee_name || '').toLowerCase();
        const sId = String(sale.shop_id || '').toLowerCase();

        if (!bNo.includes(q) && !sName.includes(q) && !eName.includes(q) && !sId.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [sales, fromDate, toDate, sellerFilter, paymentFilter, salesSource, shopFilter, minAmount, maxAmount, paymentStatus, searchQuery, dateError]);

  // ------------------------------------------------------------------
  // DYNAMIC TOP KPI SUMMARY CARDS (BASED ON FILTERED RESULTS)
  // ------------------------------------------------------------------
  const metrics = useMemo(() => {
    const list = filteredSales;
    const totalRev = list.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
    const storeRev = list.filter(s => s.is_store_direct_sale || Number(s.employee_id) === 6 || (s.employee_name && s.employee_name.toLowerCase().includes('store')))
      .reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
    const driverRev = totalRev - storeRev;

    return {
      totalBills: list.length,
      totalRevenue: totalRev,
      storeRevenue: storeRev,
      driverRevenue: driverRev
    };
  }, [filteredSales]);

  // RESET ALL FILTERS
  const handleClearAllFilters = () => {
    setSearchQuery('');
    setQuickDate('ALL');
    setFromDate('');
    setToDate('');
    setSellerFilter('ALL');
    setPaymentFilter('ALL');
    setSalesSource('ALL');
    setShopFilter('ALL');
    setMinAmount('');
    setMaxAmount('');
    setPaymentStatus('ALL');
  };

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (quickDate !== 'ALL' || fromDate || toDate) count++;
    if (sellerFilter !== 'ALL') count++;
    if (paymentFilter !== 'ALL') count++;
    if (salesSource !== 'ALL') count++;
    if (shopFilter !== 'ALL') count++;
    if (minAmount !== '' || maxAmount !== '') count++;
    if (paymentStatus !== 'ALL') count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [quickDate, fromDate, toDate, sellerFilter, paymentFilter, salesSource, shopFilter, minAmount, maxAmount, paymentStatus, searchQuery]);

  const renderPaymentBadge = (sale) => {
    const mode = (sale.payment_mode || 'CASH').toUpperCase();
    if (mode === 'CASH') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
          <DollarSign className="w-3 h-3 text-emerald-600" /> CASH
        </span>
      );
    }
    if (mode === 'GPAY') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300 inline-flex items-center gap-1">
          <Smartphone className="w-3 h-3 text-blue-600" /> GPAY
        </span>
      );
    }
    if (mode === 'CREDIT') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
          <CreditCard className="w-3 h-3 text-amber-600" /> CREDIT
        </span>
      );
    }
    if (mode === 'SPLIT') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-300 inline-flex items-center gap-1">
          <ArrowRightLeft className="w-3 h-3 text-purple-600" /> SPLIT (C:₹{sale.cash_paid || 0} | G:₹{sale.gpay_paid || 0})
        </span>
      );
    }
    return <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-300">{mode}</span>;
  };

  const renderSellerBadge = (sale) => {
    const isStore = sale.is_store_direct_sale || Number(sale.employee_id) === 6 || (sale.employee_name && sale.employee_name.toLowerCase().includes('store'));
    if (isStore) {
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs border border-purple-200 shrink-0">
            🏬
          </div>
          <div>
            <span className="font-extrabold text-slate-900 text-xs block leading-tight">Store Keeper</span>
            <span className="text-[9px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 inline-block">Store Counter</span>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200 shrink-0">
          🚚
        </div>
        <div>
          <span className="font-extrabold text-slate-900 text-xs block leading-tight">{sale.employee_name || 'Driver'}</span>
          <span className="text-[9px] text-slate-500 font-mono block">{sale.vehicle_no || 'Vehicle'}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-6">
      
      {/* Top Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-purple-950 text-white border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                SALES & BILLING RECORDS
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  🔴 Live Real-Time Feed
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">Real-time Sales Log from Store Counter & Employee Delivery Routes</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <span className="font-mono font-black text-sm text-emerald-400 bg-emerald-500/10 px-3.5 py-2 rounded-2xl border border-emerald-400/30">
            Filtered Revenue: ₹{metrics.totalRevenue.toLocaleString()}
          </span>
          <button
            onClick={() => generateSalesRecordsPDFReport({ 
              sales: filteredBills,
              dateRangeText: activeDatePreset !== 'CUSTOM' ? activeDatePreset : `${fromDate || ''} - ${toDate || ''}`,
              companyInfo: companySettings
            })}
            className="px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs flex items-center gap-1.5 border border-white/20 transition cursor-pointer"
          >
            <Download className="w-4 h-4" /> Download PDF Report
          </button>
        </div>
      </div>

      {/* DYNAMIC KPI SUMMARY CARDS (FOLLOWS ACTIVE FILTERS STRICTLY) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-emerald-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">
            Total Bills Generated {activeFiltersCount > 0 && '(Filtered)'}
          </span>
          <div className="font-mono font-black text-2xl text-slate-900 mt-1">
            {metrics.totalBills} <span className="text-xs text-slate-500 font-bold">Bills</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-blue-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">
            Total Sales Revenue {activeFiltersCount > 0 && '(Filtered)'}
          </span>
          <div className="font-mono font-black text-2xl text-emerald-600 mt-1">
            ₹{metrics.totalRevenue.toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-purple-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">
            Direct Counter Sales {activeFiltersCount > 0 && '(Filtered)'}
          </span>
          <div className="font-mono font-black text-2xl text-purple-600 mt-1">
            ₹{metrics.storeRevenue.toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-indigo-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">
            Driver Route Sales {activeFiltersCount > 0 && '(Filtered)'}
          </span>
          <div className="font-mono font-black text-2xl text-indigo-600 mt-1">
            ₹{metrics.driverRevenue.toLocaleString()}
          </div>
        </div>
      </div>

      {/* ADVANCED FILTER CONTROL PANEL */}
      <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
        
        {/* ROW 1: SEARCH BAR + QUICK DATE PILLS + ADVANCED TOGGLE */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          
          {/* Structured Search Input */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Bill #, Shop, Employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-purple-500 focus:bg-white transition"
            />
          </div>

          {/* Quick Date Pills Bar */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs overflow-x-auto max-w-full">
            <button
              onClick={() => handleQuickDateSelect('ALL')}
              className={`px-3 py-1.5 rounded-xl font-extrabold transition whitespace-nowrap ${
                quickDate === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Dates
            </button>
            <button
              onClick={() => handleQuickDateSelect('TODAY')}
              className={`px-3 py-1.5 rounded-xl font-extrabold transition whitespace-nowrap ${
                quickDate === 'TODAY' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handleQuickDateSelect('YESTERDAY')}
              className={`px-3 py-1.5 rounded-xl font-extrabold transition whitespace-nowrap ${
                quickDate === 'YESTERDAY' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => handleQuickDateSelect('THIS_WEEK')}
              className={`px-3 py-1.5 rounded-xl font-extrabold transition whitespace-nowrap ${
                quickDate === 'THIS_WEEK' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => handleQuickDateSelect('THIS_MONTH')}
              className={`px-3 py-1.5 rounded-xl font-extrabold transition whitespace-nowrap ${
                quickDate === 'THIS_MONTH' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => handleQuickDateSelect('CUSTOM')}
              className={`px-3 py-1.5 rounded-xl font-extrabold transition whitespace-nowrap flex items-center gap-1 ${
                quickDate === 'CUSTOM' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Custom Range
            </button>
          </div>

          {/* Toggle Advanced Filters Button */}
          <button
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 border transition ${
              isAdvancedOpen || activeFiltersCount > 0
                ? 'bg-purple-50 text-purple-900 border-purple-300'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-purple-600" />
            Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* CUSTOM DATE RANGE PICKER (VISIBLE WHEN QUICKDATE IS CUSTOM OR ADVANCED IS OPEN) */}
        {(quickDate === 'CUSTOM' || isAdvancedOpen) && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs bg-purple-50/50 p-3 rounded-2xl border border-purple-100">
            <span className="font-extrabold text-slate-700 flex items-center gap-1">
              <Calendar className="w-4 h-4 text-purple-600" /> Date Range:
            </span>
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-500">From:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setQuickDate('CUSTOM'); }}
                className="p-1.5 font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-500">To:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setQuickDate('CUSTOM'); }}
                className="p-1.5 font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
              />
            </div>
            {dateError && (
              <span className="text-rose-600 font-extrabold text-[11px] flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {dateError}
              </span>
            )}
          </div>
        )}

        {/* COLLAPSIBLE ADVANCED FILTERS PANEL */}
        {isAdvancedOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-3 border-t border-slate-100 text-xs">
            
            {/* 1. Seller / Generated By */}
            <div>
              <label className="font-extrabold text-slate-700 block mb-1">Seller / Generated By</label>
              <select
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
                className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
              >
                <option value="ALL">All Sellers & Roles</option>
                <option value="STORE">🏬 Store Keeper (Counter)</option>
                {availableSellers.filter(s => s.id !== 'STORE').map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* 2. Payment Method */}
            <div>
              <label className="font-extrabold text-slate-700 block mb-1">Payment Method</label>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
              >
                <option value="ALL">All Payment Modes</option>
                <option value="CASH">💵 Cash Only</option>
                <option value="GPAY">📱 GPay / UPI Only</option>
                <option value="CREDIT">💳 Credit / Due Only</option>
                <option value="SPLIT">🔀 Split Payment Only</option>
              </select>
            </div>

            {/* 3. Sales Source */}
            <div>
              <label className="font-extrabold text-slate-700 block mb-1">Sales Source</label>
              <select
                value={salesSource}
                onChange={(e) => setSalesSource(e.target.value)}
                className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
              >
                <option value="ALL">All Sales Sources</option>
                <option value="DIRECT">🏬 Direct Counter Sale</option>
                <option value="ROUTE">🚚 Driver Route Sale</option>
              </select>
            </div>

            {/* 4. Customer / Shop */}
            <div>
              <label className="font-extrabold text-slate-700 block mb-1">Shop / Customer</label>
              <select
                value={shopFilter}
                onChange={(e) => setShopFilter(e.target.value)}
                className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
              >
                <option value="ALL">All Shops & Customers</option>
                {availableShops.map(sh => (
                  <option key={sh.id} value={sh.id}>{sh.name} (#{sh.id})</option>
                ))}
              </select>
            </div>

            {/* 5. Minimum & Maximum Amount */}
            <div className="sm:col-span-2">
              <label className="font-extrabold text-slate-700 block mb-1">Invoice Amount Range (₹)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min ₹ (e.g. 500)"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-1/2 p-2 font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
                />
                <span className="font-black text-slate-400">→</span>
                <input
                  type="number"
                  placeholder="Max ₹ (e.g. 5000)"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="w-1/2 p-2 font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
                />
              </div>
              {amountError && <span className="text-[10px] text-rose-600 font-bold block mt-1">{amountError}</span>}
            </div>

            {/* 6. Payment Status */}
            <div>
              <label className="font-extrabold text-slate-700 block mb-1">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
              >
                <option value="ALL">All Payment Statuses</option>
                <option value="PAID">🟢 Fully Paid</option>
                <option value="PARTIAL">🟡 Partially Paid</option>
                <option value="CREDIT">🔴 Credit / Outstanding Due</option>
              </select>
            </div>

          </div>
        )}

        {/* ACTIVE FILTER CHIPS & CLEAR ALL BAR */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-extrabold text-slate-500 uppercase text-[10px] mr-1">Active Filters:</span>
              
              {(fromDate || toDate) && (
                <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 font-bold text-[11px] border border-purple-200 flex items-center gap-1">
                  📅 Date: {fromDate || 'Start'} → {toDate || 'End'}
                  <button onClick={() => { setFromDate(''); setToDate(''); setQuickDate('ALL'); }} className="hover:text-purple-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {sellerFilter !== 'ALL' && (
                <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 font-bold text-[11px] border border-purple-200 flex items-center gap-1">
                  👤 Seller: {sellerFilter === 'STORE' ? 'Store Keeper' : (availableSellers.find(s => s.id === sellerFilter)?.name || sellerFilter)}
                  <button onClick={() => setSellerFilter('ALL')} className="hover:text-purple-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {paymentFilter !== 'ALL' && (
                <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 font-bold text-[11px] border border-purple-200 flex items-center gap-1">
                  💳 Payment: {paymentFilter}
                  <button onClick={() => setPaymentFilter('ALL')} className="hover:text-purple-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {salesSource !== 'ALL' && (
                <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 font-bold text-[11px] border border-purple-200 flex items-center gap-1">
                  🚚 Source: {salesSource === 'DIRECT' ? 'Direct Counter' : 'Driver Route'}
                  <button onClick={() => setSalesSource('ALL')} className="hover:text-purple-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {shopFilter !== 'ALL' && (
                <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 font-bold text-[11px] border border-purple-200 flex items-center gap-1">
                  🏪 Shop: {availableShops.find(sh => sh.id === shopFilter)?.name || shopFilter}
                  <button onClick={() => setShopFilter('ALL')} className="hover:text-purple-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {(minAmount !== '' || maxAmount !== '') && (
                <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 font-bold text-[11px] border border-purple-200 flex items-center gap-1">
                  💰 Amount: ₹{minAmount || '0'} → ₹{maxAmount || '∞'}
                  <button onClick={() => { setMinAmount(''); setMaxAmount(''); }} className="hover:text-purple-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {paymentStatus !== 'ALL' && (
                <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 font-bold text-[11px] border border-purple-200 flex items-center gap-1">
                  Status: {paymentStatus}
                  <button onClick={() => setPaymentStatus('ALL')} className="hover:text-purple-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {searchQuery.trim() && (
                <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 font-bold text-[11px] border border-purple-200 flex items-center gap-1">
                  🔍 Search: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:text-purple-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              onClick={handleClearAllFilters}
              className="text-xs font-black text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear All Filters
            </button>
          </div>
        )}

      </div>

      {/* FILTER SUMMARY BAR */}
      <div className="flex items-center justify-between px-2 text-xs font-bold text-slate-600">
        <span>
          Showing <span className="text-purple-700 font-extrabold">{filteredSales.length}</span> of <span className="text-slate-900">{sales.length}</span> Total Bills
        </span>
        <span>
          Filtered Sales Revenue: <span className="text-emerald-700 font-mono font-black text-sm">₹{metrics.totalRevenue.toLocaleString()}</span>
        </span>
      </div>

      {/* MAIN BILLING TABLE & MOBILE CARD PANEL */}
      <div className="glass-panel rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        
        {/* DESKTOP TABLE VIEW */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 font-extrabold text-slate-700 bg-slate-50 uppercase tracking-wider">
                <th className="p-3.5 pl-5">Bill No & Time</th>
                <th className="p-3.5">Bill Generated By</th>
                <th className="p-3.5">Customer / Shop Name</th>
                <th className="p-3.5 text-center">Items Count</th>
                <th className="p-3.5 text-right">Total Amount</th>
                <th className="p-3.5 text-center">Payment Method</th>
                <th className="p-3.5 pr-5 text-center">Action Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center bg-slate-50/50">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto text-xl font-bold border border-purple-200">
                        🔍
                      </div>
                      <h4 className="font-black text-base text-slate-900">No Sales Bills Found</h4>
                      <p className="text-xs text-slate-500 font-medium">
                        No invoices match your selected filter criteria. Try adjusting your dates, seller, or payment mode options.
                      </p>
                      {activeFiltersCount > 0 && (
                        <button
                          onClick={handleClearAllFilters}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale, idx) => {
                  const itemsCount = (sale.items || []).reduce((acc, i) => acc + (Number(i.qty) || 0), 0);

                  return (
                    <tr key={sale.bill_no || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 pl-5">
                        <span className="font-mono font-black text-sm text-purple-700 block">
                          #{sale.bill_no}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400" /> {sale.date || 'Today'} • {sale.time || 'Live'}
                        </span>
                      </td>
                      <td className="p-3.5">{renderSellerBadge(sale)}</td>
                      <td className="p-3.5">
                        <span className="font-extrabold text-slate-900 text-xs block">
                          {sale.shop_name || sale.customer_name || 'Direct Walk-in Customer'}
                        </span>
                        {sale.shop_id && (
                          <span className="text-[9px] text-slate-400 font-mono">Shop ID #{sale.shop_id}</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold">
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 rounded-full border border-slate-200">
                          {itemsCount} Units
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-sm text-slate-900">
                        ₹{Number(sale.total_amount || 0).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-center">{renderPaymentBadge(sale)}</td>
                      <td className="p-3.5 pr-5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedSaleDetails(sale)}
                            className="p-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold text-[11px] flex items-center gap-1 transition border border-purple-200"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                          <button
                            onClick={() => setPrintThermalBill(sale)}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] flex items-center gap-1 transition border border-slate-200"
                            title="Print Invoice"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-600" /> Print
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARD VIEW */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredSales.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 space-y-2">
              <span className="text-xl">🔍</span>
              <p className="font-bold text-xs text-slate-700">No Sales Invoices Found</p>
            </div>
          ) : (
            filteredSales.map((sale, idx) => (
              <div key={sale.bill_no || idx} className="p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm text-purple-700">#{sale.bill_no}</span>
                    {renderPaymentBadge(sale.payment_mode)}
                  </div>
                  <span className="font-mono font-black text-base text-emerald-600">
                    ₹{Number(sale.total_amount || 0).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-900">
                    {sale.shop_name || sale.customer_name || 'Walk-in Customer'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {sale.date} {sale.time}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>{renderSellerBadge(sale)}</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedSaleDetails(sale)}
                      className="px-3 py-2 rounded-xl bg-purple-50 text-purple-700 font-extrabold text-xs border border-purple-200 flex items-center gap-1 min-h-[44px]"
                    >
                      <Eye className="w-4 h-4" /> View
                    </button>
                    <button
                      onClick={() => setPrintThermalBill(sale)}
                      className="p-2.5 rounded-xl bg-slate-100 text-slate-700 font-extrabold text-xs border border-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {/* SALE DETAILS MODAL */}
      {selectedSaleDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto my-auto p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900">Bill Invoice #{selectedSaleDetails.bill_no}</h3>
                <span className="text-[10px] text-slate-500 font-mono">{selectedSaleDetails.date} • {selectedSaleDetails.time}</span>
              </div>
              <button onClick={() => setSelectedSaleDetails(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[10px]">Customer / Retailer:</span>
                  <span className="font-black text-slate-900 text-xs">{selectedSaleDetails.shop_name || selectedSaleDetails.customer_name || 'Walk-in'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Bill Generated By:</span>
                  <span className="font-black text-slate-900 text-xs">{selectedSaleDetails.employee_name || 'Store Keeper'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Payment Mode:</span>
                  <span className="font-black text-purple-700">{selectedSaleDetails.payment_mode}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Total Amount:</span>
                  <span className="font-black text-emerald-600 text-sm">₹{selectedSaleDetails.total_amount}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1.5">
                <span className="font-extrabold text-slate-700 block">Line Items:</span>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 font-extrabold text-slate-700 uppercase text-[9px]">
                      <tr>
                        <th className="p-2">Item Name</th>
                        <th className="p-2 text-center">Qty</th>
                        <th className="p-2 text-right">Rate</th>
                        <th className="p-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedSaleDetails.items || []).map((item, i) => (
                        <tr key={i}>
                          <td className="p-2 font-bold">{item.product_name || item.name}</td>
                          <td className="p-2 text-center font-mono">{item.qty} {item.unit_type || 'Tray'}</td>
                          <td className="p-2 text-right font-mono">₹{item.rate}</td>
                          <td className="p-2 text-right font-mono font-black">₹{item.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => { setPrintThermalBill(selectedSaleDetails); setSelectedSaleDetails(null); }}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-extrabold text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Thermal Bill
                </button>
                <button
                  onClick={() => setSelectedSaleDetails(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THERMAL BILL MODAL */}
      {printThermalBill && (
        <ThermalBillModal
          sale={printThermalBill}
          onClose={() => setPrintThermalBill(null)}
        />
      )}

    </div>
  );
};
