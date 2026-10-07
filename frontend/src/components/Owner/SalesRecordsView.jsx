import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ShoppingBag, Search, Filter, Eye, Printer, DollarSign, 
  Smartphone, CreditCard, ArrowRightLeft, UserCheck, Truck, 
  Store, Calendar, Clock, X, ChevronRight, CheckCircle2, 
  Layers, RotateCcw, AlertTriangle, ChevronDown, SlidersHorizontal, Download 
} from 'lucide-react';
import { toast } from 'sonner';
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

// Helper function to format any date string into DD-MM-YYYY format
const formatDMY = (dateStr) => {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [y, m, d] = dateStr.substring(0, 10).split('-');
    return `${d}-${m}-${y}`;
  }
  if (/^\d{2}-\d{2}-\d{4}/.test(dateStr)) {
    return dateStr.substring(0, 10);
  }
  const dt = new Date(dateStr);
  if (!isNaN(dt.getTime())) {
    const d = String(dt.getDate()).padStart(2, '0');
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const y = dt.getFullYear();
    return `${d}-${m}-${y}`;
  }
  return dateStr;
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

// Helper function to calculate exact received (varavu), balance (due), and total amount for any bill
const getSaleFinancials = (sale) => {
  if (!sale) return { total: 0, received: 0, balance: 0 };
  const total = Number(sale.total_amount || sale.grand_total || 0);
  const mode = (sale.payment_mode || 'CASH').toUpperCase();
  
  let received = 0;
  if (sale.received_amount !== undefined && sale.received_amount !== null && !isNaN(Number(sale.received_amount))) {
    received = Number(sale.received_amount);
  } else if (sale.cash_paid !== undefined || sale.gpay_paid !== undefined) {
    received = Number(sale.cash_paid || 0) + Number(sale.gpay_paid || 0);
  } else if (mode === 'CASH' || mode === 'GPAY' || mode === 'UPI' || mode === 'ONLINE') {
    received = total;
  } else if (mode === 'CREDIT' || mode === 'DUE') {
    received = 0;
  } else {
    received = total;
  }

  let balance = 0;
  if (sale.balance_amount !== undefined && sale.balance_amount !== null && !isNaN(Number(sale.balance_amount))) {
    balance = Number(sale.balance_amount);
  } else if (sale.balance !== undefined && sale.balance !== null && !isNaN(Number(sale.balance))) {
    balance = Number(sale.balance);
  } else if (sale.due_amount !== undefined && sale.due_amount !== null && !isNaN(Number(sale.due_amount))) {
    balance = Number(sale.due_amount);
  } else {
    balance = Math.max(0, total - received);
  }

  return {
    total,
    received,
    balance
  };
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
    let totalRev = 0;
    let totalRec = 0;
    let totalBal = 0;
    let storeRev = 0;

    list.forEach(s => {
      const { total, received, balance } = getSaleFinancials(s);
      totalRev += total;
      totalRec += received;
      totalBal += balance;

      const isStore = s.is_store_direct_sale || Number(s.employee_id) === 6 || (s.employee_name && s.employee_name.toLowerCase().includes('store'));
      if (isStore) {
        storeRev += total;
      }
    });

    const driverRev = totalRev - storeRev;

    return {
      totalBills: list.length,
      totalRevenue: totalRev,
      totalReceived: totalRec,
      totalBalance: totalBal,
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
    const mode = (typeof sale === 'string' ? sale : (sale?.payment_mode || 'CASH')).toUpperCase();
    if (mode === 'CASH') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1.5 shadow-2xs">
          <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> CASH
        </span>
      );
    }
    if (mode === 'GPAY' || mode === 'UPI' || mode === 'ONLINE') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-black bg-sky-100 text-sky-800 border border-sky-300 inline-flex items-center gap-1.5 shadow-2xs">
          <Smartphone className="w-3.5 h-3.5 text-sky-600" /> GPAY
        </span>
      );
    }
    if (mode === 'CREDIT' || mode === 'DUE') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1.5 shadow-2xs">
          <CreditCard className="w-3.5 h-3.5 text-amber-600" /> CREDIT
        </span>
      );
    }
    if (mode === 'SPLIT') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-300 inline-flex items-center gap-1.5 shadow-2xs">
          <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" /> SPLIT
        </span>
      );
    }
    return <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs">{mode}</span>;
  };

  const renderSellerBadge = (sale) => {
    const isStore = sale.is_store_direct_sale || Number(sale.employee_id) === 6 || (sale.employee_name && sale.employee_name.toLowerCase().includes('store'));
    if (isStore) {
      return (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm border border-sky-200 shrink-0 shadow-2xs">
            🏬
          </div>
          <div>
            <span className="font-black text-slate-900 text-xs sm:text-sm block leading-tight">Store Keeper</span>
            <span className="text-[10px] text-sky-800 font-extrabold bg-sky-100 px-2 py-0.5 rounded-lg border border-sky-200 inline-block mt-0.5">Store Counter</span>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm border border-sky-200 shrink-0 shadow-2xs">
          🚚
        </div>
        <div>
          <span className="font-black text-slate-900 text-xs sm:text-sm block leading-tight">{sale.employee_name || 'Driver'}</span>
          <span className="text-[10px] text-slate-500 font-mono font-bold block">{sale.vehicle_no || 'Vehicle'}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-6">
      
      {/* Top Banner */}
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white border-2 border-sky-900 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-200 shrink-0">
              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                SALES & BILLING RECORDS
                <span className="text-[10px] sm:text-xs bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  🔴 Live Feed
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-sky-200 font-bold mt-0.5">Real-time Sales Log from Store Counter & Employee Delivery Routes</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          <span className="font-mono font-black text-xs sm:text-sm text-emerald-300 bg-emerald-500/15 px-3.5 py-2 rounded-2xl border border-emerald-400/30 shadow-xs">
            Revenue: ₹{metrics.totalRevenue.toLocaleString()}
          </span>
          <button
            onClick={async () => {
              try {
                if (!filteredSales || filteredSales.length === 0) {
                  toast.error('No sales records found to export for the selected filter.');
                  return;
                }
                const dateLabel = quickDate !== 'CUSTOM' 
                  ? (quickDate === 'ALL' ? 'All Dates' : quickDate.replace(/_/g, ' ')) 
                  : `${fromDate || 'Start'} to ${toDate || 'End'}`;
                
                toast.info('Generating Sales Report PDF...');
                await generateSalesRecordsPDFReport({ 
                  sales: filteredSales,
                  period: quickDate,
                  dateRangeText: dateLabel,
                  companyInfo: { name: 'AVS AGENCIES', address: 'Villupuram, Tamil Nadu' }
                });
                toast.success('🎉 Sales PDF Report downloaded successfully!');
              } catch (err) {
                console.error('PDF download error:', err);
                toast.error('Failed to generate PDF: ' + (err.message || 'Unknown error'));
              }
            }}
            className="px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs flex items-center gap-1.5 border border-white/20 transition cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </div>

      {/* DYNAMIC KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-card p-4 sm:p-5 rounded-2xl bg-white border-l-4 border-sky-600 border-2 border-sky-100 shadow-xs">
          <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-tight block">
            Total Bills Generated {activeFiltersCount > 0 && '(Filtered)'}
          </span>
          <div className="font-mono font-black text-xl sm:text-2xl text-slate-900 mt-1">
            {metrics.totalBills} <span className="text-xs sm:text-sm text-slate-500 font-bold">Bills</span>
          </div>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl bg-white border-l-4 border-emerald-500 border-2 border-sky-100 shadow-xs">
          <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-tight block">
            Total Sales Revenue {activeFiltersCount > 0 && '(Filtered)'}
          </span>
          <div className="font-mono font-black text-xl sm:text-2xl text-emerald-600 mt-1">
            ₹{metrics.totalRevenue.toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl bg-white border-l-4 border-indigo-500 border-2 border-sky-100 shadow-xs">
          <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-tight block">
            Direct Counter Sales {activeFiltersCount > 0 && '(Filtered)'}
          </span>
          <div className="font-mono font-black text-xl sm:text-2xl text-indigo-600 mt-1">
            ₹{metrics.storeRevenue.toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl bg-white border-l-4 border-blue-500 border-2 border-sky-100 shadow-xs">
          <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-tight block">
            Driver Route Sales {activeFiltersCount > 0 && '(Filtered)'}
          </span>
          <div className="font-mono font-black text-xl sm:text-2xl text-blue-600 mt-1">
            ₹{metrics.driverRevenue.toLocaleString()}
          </div>
        </div>
      </div>

      {/* ADVANCED FILTER CONTROL PANEL */}
      <div className="glass-panel p-4 sm:p-5 rounded-3xl bg-white border-2 border-sky-200 space-y-3.5 shadow-sm">
        
        {/* ROW 1: SEARCH BAR + QUICK DATE PILLS + ADVANCED TOGGLE */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          
          {/* Structured Search Input */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-sky-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Bill #, Shop, Employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm font-black bg-sky-50/50 border-2 border-sky-200 rounded-2xl focus:outline-none focus:border-sky-600 focus:bg-white transition shadow-2xs"
            />
          </div>

          {/* Quick Date Pills Bar */}
          <div className="flex items-center gap-1.5 bg-sky-100/70 p-1 rounded-2xl border border-sky-200 text-xs overflow-x-auto max-w-full">
            <button
              onClick={() => handleQuickDateSelect('ALL')}
              className={`px-3 py-1.5 rounded-xl font-black transition whitespace-nowrap cursor-pointer ${
                quickDate === 'ALL' ? 'bg-white text-sky-950 shadow-xs border border-sky-200' : 'text-sky-800 hover:text-slate-900'
              }`}
            >
              All Dates
            </button>
            <button
              onClick={() => handleQuickDateSelect('TODAY')}
              className={`px-3 py-1.5 rounded-xl font-black transition whitespace-nowrap cursor-pointer ${
                quickDate === 'TODAY' ? 'bg-sky-600 text-white shadow-xs' : 'text-sky-800 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handleQuickDateSelect('YESTERDAY')}
              className={`px-3 py-1.5 rounded-xl font-black transition whitespace-nowrap cursor-pointer ${
                quickDate === 'YESTERDAY' ? 'bg-sky-600 text-white shadow-xs' : 'text-sky-800 hover:text-slate-900'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => handleQuickDateSelect('THIS_WEEK')}
              className={`px-3 py-1.5 rounded-xl font-black transition whitespace-nowrap cursor-pointer ${
                quickDate === 'THIS_WEEK' ? 'bg-sky-600 text-white shadow-xs' : 'text-sky-800 hover:text-slate-900'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => handleQuickDateSelect('THIS_MONTH')}
              className={`px-3 py-1.5 rounded-xl font-black transition whitespace-nowrap cursor-pointer ${
                quickDate === 'THIS_MONTH' ? 'bg-sky-600 text-white shadow-xs' : 'text-sky-800 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => handleQuickDateSelect('CUSTOM')}
              className={`px-3 py-1.5 rounded-xl font-black transition whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                quickDate === 'CUSTOM' ? 'bg-sky-600 text-white shadow-xs' : 'text-sky-800 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Custom Range
            </button>
          </div>

          {/* Toggle Advanced Filters Button */}
          <button
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-1.5 border-2 transition cursor-pointer ${
              isAdvancedOpen || activeFiltersCount > 0
                ? 'bg-sky-100 text-sky-900 border-sky-300'
                : 'bg-white text-slate-700 border-sky-200 hover:bg-sky-50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-sky-600" />
            Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* CUSTOM DATE RANGE PICKER */}
        {(quickDate === 'CUSTOM' || isAdvancedOpen) && (
          <div className="pt-2 border-t border-sky-100 flex flex-wrap items-center gap-3 text-xs bg-sky-50/60 p-3 rounded-2xl border border-sky-200">
            <span className="font-black text-slate-700 flex items-center gap-1">
              <Calendar className="w-4 h-4 text-sky-600" /> Date Range:
            </span>
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-500">From:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setQuickDate('CUSTOM'); }}
                className="p-2 font-bold bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-sky-600 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-500">To:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setQuickDate('CUSTOM'); }}
                className="p-2 font-bold bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-sky-600 text-xs"
              />
            </div>
            {dateError && (
              <span className="text-rose-600 font-black text-xs flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {dateError}
              </span>
            )}
          </div>
        )}

        {/* COLLAPSIBLE ADVANCED FILTERS PANEL */}
        {isAdvancedOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-3 border-t border-sky-100 text-xs">
            
            {/* 1. Seller / Generated By */}
            <div>
              <label className="font-black text-slate-700 block mb-1">Seller / Generated By</label>
              <select
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
                className="w-full p-2.5 font-bold bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-sky-600"
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
              <label className="font-black text-slate-700 block mb-1">Payment Method</label>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="w-full p-2.5 font-bold bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-sky-600"
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
              <label className="font-black text-slate-700 block mb-1">Sales Source</label>
              <select
                value={salesSource}
                onChange={(e) => setSalesSource(e.target.value)}
                className="w-full p-2.5 font-bold bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-sky-600"
              >
                <option value="ALL">All Sales Sources</option>
                <option value="DIRECT">🏬 Direct Counter Sale</option>
                <option value="ROUTE">🚚 Driver Route Sale</option>
              </select>
            </div>

            {/* 4. Customer / Shop */}
            <div>
              <label className="font-black text-slate-700 block mb-1">Shop / Customer</label>
              <select
                value={shopFilter}
                onChange={(e) => setShopFilter(e.target.value)}
                className="w-full p-2.5 font-bold bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-sky-600"
              >
                <option value="ALL">All Shops & Customers</option>
                {availableShops.map(sh => (
                  <option key={sh.id} value={sh.id}>{sh.name} (#{sh.id})</option>
                ))}
              </select>
            </div>

            {/* 5. Minimum & Maximum Amount */}
            <div className="sm:col-span-2">
              <label className="font-black text-slate-700 block mb-1">Invoice Amount Range (₹)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min ₹ (e.g. 500)"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-1/2 p-2.5 font-mono font-bold bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-sky-600"
                />
                <span className="font-black text-slate-400">→</span>
                <input
                  type="number"
                  placeholder="Max ₹ (e.g. 5000)"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="w-1/2 p-2.5 font-mono font-bold bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-sky-600"
                />
              </div>
              {amountError && <span className="text-[10px] text-rose-600 font-bold block mt-1">{amountError}</span>}
            </div>

            {/* 6. Payment Status */}
            <div>
              <label className="font-black text-slate-700 block mb-1">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full p-2.5 font-bold bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-sky-600"
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
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-sky-100 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-black text-sky-800 uppercase text-[10px] mr-1">Active Filters:</span>
              
              {(fromDate || toDate) && (
                <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-900 font-black text-xs border border-sky-200 flex items-center gap-1">
                  📅 Date: {fromDate || 'Start'} → {toDate || 'End'}
                  <button onClick={() => { setFromDate(''); setToDate(''); setQuickDate('ALL'); }} className="hover:text-sky-600 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {sellerFilter !== 'ALL' && (
                <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-900 font-black text-xs border border-sky-200 flex items-center gap-1">
                  👤 Seller: {sellerFilter === 'STORE' ? 'Store Keeper' : (availableSellers.find(s => s.id === sellerFilter)?.name || sellerFilter)}
                  <button onClick={() => setSellerFilter('ALL')} className="hover:text-sky-600 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {paymentFilter !== 'ALL' && (
                <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-900 font-black text-xs border border-sky-200 flex items-center gap-1">
                  💳 Payment: {paymentFilter}
                  <button onClick={() => setPaymentFilter('ALL')} className="hover:text-sky-600 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {salesSource !== 'ALL' && (
                <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-900 font-black text-xs border border-sky-200 flex items-center gap-1">
                  🚚 Source: {salesSource === 'DIRECT' ? 'Direct Counter' : 'Driver Route'}
                  <button onClick={() => setSalesSource('ALL')} className="hover:text-sky-600 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {shopFilter !== 'ALL' && (
                <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-900 font-black text-xs border border-sky-200 flex items-center gap-1">
                  🏪 Shop: {availableShops.find(sh => sh.id === shopFilter)?.name || shopFilter}
                  <button onClick={() => setShopFilter('ALL')} className="hover:text-sky-600 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {(minAmount !== '' || maxAmount !== '') && (
                <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-900 font-black text-xs border border-sky-200 flex items-center gap-1">
                  💰 Amount: ₹{minAmount || '0'} → ₹{maxAmount || '∞'}
                  <button onClick={() => { setMinAmount(''); setMaxAmount(''); }} className="hover:text-sky-600 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {paymentStatus !== 'ALL' && (
                <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-900 font-black text-xs border border-sky-200 flex items-center gap-1">
                  Status: {paymentStatus}
                  <button onClick={() => setPaymentStatus('ALL')} className="hover:text-sky-600 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {searchQuery.trim() && (
                <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-900 font-black text-xs border border-sky-200 flex items-center gap-1">
                  🔍 Search: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:text-sky-600 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              onClick={handleClearAllFilters}
              className="text-xs font-black text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear All Filters
            </button>
          </div>
        )}

      </div>

      {/* FILTER SUMMARY BAR WITH DETAILED FINANCIALS */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 text-xs sm:text-sm font-bold text-slate-700">
        <div>
          Showing <span className="text-sky-800 font-black">{filteredSales.length}</span> of <span className="text-slate-900 font-black">{sales.length}</span> Total Bills
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 font-mono font-black text-xs sm:text-sm">
          <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-xl border border-emerald-200 shadow-2xs">
            Collected (வரவு): ₹{metrics.totalReceived.toLocaleString()}
          </span>
          <span className="bg-rose-50 text-rose-700 px-3 py-1 rounded-xl border border-rose-200 shadow-2xs">
            Balance (பாக்கி): ₹{metrics.totalBalance.toLocaleString()}
          </span>
          <span className="bg-sky-50 text-sky-900 px-3 py-1 rounded-xl border border-sky-200 shadow-2xs">
            Total Revenue: ₹{metrics.totalRevenue.toLocaleString()}
          </span>
        </div>
      </div>

      {/* MAIN BILLING TABLE & MOBILE CARD PANEL */}
      <div className="glass-panel rounded-3xl bg-white border-2 border-sky-200 overflow-hidden shadow-sm">
        
        {/* DESKTOP TABLE VIEW */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-sky-200 font-black text-slate-800 bg-sky-50/90 uppercase tracking-wider text-xs">
                <th className="p-4 pl-5">Bill No & Date</th>
                <th className="p-4">Bill Generated By</th>
                <th className="p-4">Shop Name</th>
                <th className="p-4 text-right">Received (வரவு)</th>
                <th className="p-4 text-right">Balance (பாக்கி)</th>
                <th className="p-4 text-right">Total Amount</th>
                <th className="p-4 text-center">Payment Method</th>
                <th className="p-4 pr-5 text-center">Action Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-12 text-center bg-sky-50/30">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center mx-auto text-xl font-bold border border-sky-200">
                        🔍
                      </div>
                      <h4 className="font-black text-base text-slate-900">No Sales Bills Found</h4>
                      <p className="text-xs text-slate-500 font-medium">
                        No invoices match your selected filter criteria. Try adjusting your dates, seller, or payment mode options.
                      </p>
                      {activeFiltersCount > 0 && (
                        <button
                          onClick={handleClearAllFilters}
                          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale, idx) => {
                  const billDate = formatDMY(sale.date || sale.sale_date || sale.created_at) || 'Today';
                  const financials = getSaleFinancials(sale);

                  return (
                    <tr key={sale.bill_no || idx} className="hover:bg-sky-50/60 transition-colors">
                      <td className="p-4 pl-5">
                        <span className="font-mono font-black text-sm sm:text-base text-sky-700 block">
                          #{sale.bill_no}
                        </span>
                        <span className="text-xs text-slate-600 font-mono font-bold flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-sky-500" /> {billDate} • {sale.time || 'Live'}
                        </span>
                      </td>
                      <td className="p-4">{renderSellerBadge(sale)}</td>
                      <td className="p-4">
                        <span className="font-black text-slate-900 text-sm sm:text-base block">
                          {sale.shop_name || sale.customer_name || 'Direct Walk-in Customer'}
                        </span>
                        {sale.shop_id && (
                          <span className="text-[10px] text-slate-400 font-mono font-bold">Shop ID #{sale.shop_id}</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-mono font-black text-sm sm:text-base text-emerald-700">
                        ₹{financials.received.toLocaleString()}
                      </td>
                      <td className="p-4 text-right font-mono font-black text-sm sm:text-base text-rose-700">
                        ₹{financials.balance.toLocaleString()}
                      </td>
                      <td className="p-4 text-right font-mono font-black text-sm sm:text-base text-slate-900">
                        ₹{financials.total.toLocaleString()}
                      </td>
                      <td className="p-4 text-center">{renderPaymentBadge(sale)}</td>
                      <td className="p-4 pr-5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedSaleDetails(sale)}
                            className="px-3 py-1.5 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-900 font-black text-xs flex items-center gap-1.5 transition border border-sky-300 cursor-pointer shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                          <button
                            onClick={() => setPrintThermalBill(sale)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs flex items-center gap-1.5 transition border border-slate-300 cursor-pointer shadow-2xs"
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
        <div className="block md:hidden divide-y divide-sky-100">
          {filteredSales.length === 0 ? (
            <div className="p-8 text-center bg-sky-50/50 space-y-2">
              <span className="text-xl">🔍</span>
              <p className="font-bold text-xs text-slate-700">No Sales Invoices Found</p>
            </div>
          ) : (
            filteredSales.map((sale, idx) => {
              const billDate = formatDMY(sale.date || sale.sale_date || sale.created_at) || 'Today';
              const financials = getSaleFinancials(sale);

              return (
                <div key={sale.bill_no || idx} className="p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm sm:text-base text-sky-700">#{sale.bill_no}</span>
                      {renderPaymentBadge(sale)}
                    </div>
                    <span className="font-mono font-black text-base text-slate-900">
                      ₹{financials.total.toLocaleString()}
                    </span>
                  </div>

                  {/* Financial Breakdown (Varavu vs Due) */}
                  <div className="flex items-center justify-between gap-2 text-xs font-mono font-bold bg-sky-50/70 p-2.5 rounded-xl border border-sky-100">
                    <span className="text-emerald-700">
                      வரவு: <strong className="font-black">₹{financials.received.toLocaleString()}</strong>
                    </span>
                    <span className="text-rose-700">
                      பாக்கி: <strong className="font-black">₹{financials.balance.toLocaleString()}</strong>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-black text-slate-900">
                      {sale.shop_name || sale.customer_name || 'Walk-in Customer'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono font-bold">
                      {billDate} {sale.time}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>{renderSellerBadge(sale)}</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedSaleDetails(sale)}
                        className="px-3 py-2 rounded-xl bg-sky-100 text-sky-900 font-black text-xs border border-sky-300 flex items-center gap-1 min-h-[40px] cursor-pointer"
                      >
                        <Eye className="w-4 h-4" /> View
                      </button>
                      <button
                        onClick={() => setPrintThermalBill(sale)}
                        className="p-2.5 rounded-xl bg-slate-100 text-slate-800 font-black text-xs border border-slate-300 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* SALE DETAILS MODAL */}
      {selectedSaleDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 lg:p-6 overflow-y-auto">
          <div className="bg-gradient-to-b from-sky-50 via-white to-sky-50/90 border-2 border-sky-200 rounded-3xl max-w-full sm:max-w-2xl lg:max-w-3xl w-full max-h-[92vh] overflow-y-auto my-auto p-4 sm:p-6 lg:p-7 space-y-4 sm:space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-sky-200/80 pb-3.5 sm:pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-200 shrink-0">
                  <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base sm:text-lg lg:text-xl text-slate-900 tracking-tight">
                      Bill Invoice
                    </h3>
                    <span className="font-mono font-black text-xs sm:text-sm text-sky-800 bg-sky-100 px-2.5 py-0.5 rounded-lg border border-sky-300">
                      #{selectedSaleDetails.bill_no}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-sky-700 flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-sky-500" />
                    {formatDMY(selectedSaleDetails.date || selectedSaleDetails.sale_date || selectedSaleDetails.created_at) || 'Today'} • {selectedSaleDetails.time || 'Live'}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedSaleDetails(null)} 
                className="p-2 rounded-2xl text-slate-400 hover:text-slate-700 hover:bg-sky-100 transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Metadata Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
              {/* Customer / Retailer Shop */}
              <div className="bg-sky-100/70 border-2 border-sky-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-1">
                <span className="text-[11px] sm:text-xs font-black text-sky-800 uppercase tracking-wider flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-sky-600" /> Shop / Customer
                </span>
                <span className="font-black text-sm sm:text-base text-slate-900 block truncate">
                  {selectedSaleDetails.shop_name || selectedSaleDetails.customer_name || 'Walk-in Customer'}
                </span>
                {selectedSaleDetails.shop_id && (
                  <span className="text-[10px] text-sky-700 font-mono font-bold block">Shop ID #{selectedSaleDetails.shop_id}</span>
                )}
              </div>

              {/* Bill Generated By */}
              <div className="bg-sky-100/70 border-2 border-sky-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-1">
                <span className="text-[11px] sm:text-xs font-black text-sky-800 uppercase tracking-wider flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-sky-600" /> Billed By
                </span>
                <span className="font-black text-sm sm:text-base text-slate-900 block truncate">
                  {selectedSaleDetails.employee_name || 'Store Keeper'}
                </span>
                {selectedSaleDetails.vehicle_no && (
                  <span className="text-[10px] text-sky-700 font-mono font-bold block">Vehicle: {selectedSaleDetails.vehicle_no}</span>
                )}
              </div>

              {/* Payment Mode */}
              <div className="bg-sky-100/70 border-2 border-sky-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] sm:text-xs font-black text-sky-800 uppercase tracking-wider block">Payment Mode</span>
                  <div className="mt-1">
                    {renderPaymentBadge(selectedSaleDetails)}
                  </div>
                </div>
              </div>

              {/* Total Invoice Amount Banner */}
              <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-2 border-emerald-500 rounded-2xl p-3.5 sm:p-4 shadow-md flex items-center justify-between">
                <div>
                  <span className="text-[11px] sm:text-xs font-bold text-emerald-100 uppercase tracking-wider block">Total Bill Amount</span>
                  <span className="font-mono font-black text-xl sm:text-2xl text-white block mt-0.5">
                    ₹{Number(selectedSaleDetails.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-black text-slate-700 uppercase tracking-wider">
                  PURCHASED LINE ITEMS (பொருட்கள் பட்டியல்)
                </label>
                <span className="text-xs font-extrabold text-sky-800 bg-sky-100 px-3 py-0.5 rounded-full border border-sky-200">
                  {(selectedSaleDetails.items || []).length} Item{(selectedSaleDetails.items || []).length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="rounded-2xl border-2 border-sky-200 overflow-hidden shadow-xs bg-white">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead className="bg-sky-100/90 border-b-2 border-sky-200 font-black text-slate-800 uppercase text-[11px] sm:text-xs tracking-wider">
                    <tr>
                      <th className="p-3 sm:p-3.5 pl-4">Item Name</th>
                      <th className="p-3 sm:p-3.5 text-center">Quantity</th>
                      <th className="p-3 sm:p-3.5 text-right">Rate</th>
                      <th className="p-3 sm:p-3.5 pr-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100">
                    {(selectedSaleDetails.items || []).length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-6 text-center text-xs text-slate-400 font-bold">
                          No item breakdown available.
                        </td>
                      </tr>
                    ) : (
                      (selectedSaleDetails.items || []).map((item, i) => (
                        <tr key={i} className="hover:bg-sky-50/50 transition-colors">
                          <td className="p-3 sm:p-3.5 pl-4 font-black text-slate-900">
                            {item.product_name || item.name}
                          </td>
                          <td className="p-3 sm:p-3.5 text-center font-mono font-black text-sky-900">
                            <span className="bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200 inline-block">
                              {item.qty} {item.unit_type || 'Tray'}
                            </span>
                          </td>
                          <td className="p-3 sm:p-3.5 text-right font-mono font-bold text-slate-700">
                            ₹{Number(item.rate || 0).toFixed(2)}
                          </td>
                          <td className="p-3 sm:p-3.5 pr-4 text-right font-mono font-black text-slate-900">
                            ₹{Number(item.amount || (item.qty * item.rate) || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-sky-50/80 border-t-2 border-sky-200 font-black text-slate-900">
                    <tr>
                      <td colSpan="3" className="p-3 sm:p-3.5 pl-4 uppercase text-xs font-black text-slate-700">
                        Total Payable Amount:
                      </td>
                      <td className="p-3 sm:p-3.5 pr-4 text-right font-mono font-black text-sm sm:text-base text-emerald-700">
                        ₹{Number(selectedSaleDetails.total_amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedSaleDetails(null)}
                className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs sm:text-sm cursor-pointer transition border border-slate-300"
              >
                Close
              </button>
              <button
                onClick={() => { setPrintThermalBill(selectedSaleDetails); setSelectedSaleDetails(null); }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 uppercase tracking-wider shadow-lg shadow-sky-300/60 cursor-pointer transition active:scale-[0.98]"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" />
                Print Thermal Bill
              </button>
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
