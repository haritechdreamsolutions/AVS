import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp, apiFetch, API_URL } from '../../context/AppContext';
import { resolveProductImageUrl } from '../../utils/productImageHelper';
import { getProductDisplayRank } from '../../utils/productOrderHelper';
import { 
  Search, Calendar, RotateCcw, AlertTriangle, X,
  Layers, AlertCircle, TrendingDown, Package, Sparkles
} from 'lucide-react';

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

// Helper function to extract exact YYYY-MM-DD from any sale object
const extractSaleDateYMD = (sale) => {
  if (!sale) return '';
  if (typeof sale.sale_date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(sale.sale_date)) {
    return sale.sale_date.substring(0, 10);
  }
  if (typeof sale.date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(sale.date)) {
      return sale.date.substring(0, 10);
    }
    if (/^\d{2}-\d{2}-\d{4}/.test(sale.date)) {
      const [d, m, y] = sale.date.split('-');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  if (sale.created_at) {
    const d = new Date(sale.created_at);
    if (!isNaN(d.getTime())) {
      return formatYMD(d);
    }
  }
  return '';
};

// Generic Date extractor for expenses, damages, and shortages
const extractGenericDateYMD = (item) => {
  if (!item) return '';
  if (item.expense_date && typeof item.expense_date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.expense_date)) {
    return item.expense_date.substring(0, 10);
  }
  if (item.session_date && typeof item.session_date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.session_date)) {
    return item.session_date.substring(0, 10);
  }
  if (item.date && typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.date)) {
    return item.date.substring(0, 10);
  }
  if (item.created_at) {
    const d = new Date(item.created_at);
    if (!isNaN(d.getTime())) {
      return formatYMD(d);
    }
  }
  return '';
};

// Helper to calculate exact financials for any sale
const getSaleFinancials = (sale) => {
  if (!sale) return { total: 0, received: 0, balance: 0, oldCreditPaid: 0 };
  const total = Number(sale.total_amount || sale.grand_total || 0);
  const oldCreditPaid = Number(sale.old_credit_paid || 0);
  const mode = (sale.payment_mode || 'CASH').toUpperCase();

  let received = 0;
  if (sale.cash_paid !== undefined || sale.gpay_paid !== undefined) {
    received = Number(sale.cash_paid || 0) + Number(sale.gpay_paid || 0);
  } else if (sale.received_amount !== undefined && sale.received_amount !== null && !isNaN(Number(sale.received_amount))) {
    received = Number(sale.received_amount);
  } else if (mode === 'CASH' || mode === 'GPAY' || mode === 'UPI' || mode === 'ONLINE') {
    received = total + oldCreditPaid;
  } else if (mode === 'CREDIT' || mode === 'DUE') {
    received = 0;
  } else {
    received = total + oldCreditPaid;
  }

  let balance = 0;
  if (sale.credit_paid !== undefined && sale.credit_paid !== null && !isNaN(Number(sale.credit_paid))) {
    balance = Number(sale.credit_paid);
  } else if (sale.balance_amount !== undefined && sale.balance_amount !== null && !isNaN(Number(sale.balance_amount))) {
    balance = Number(sale.balance_amount);
  } else if (sale.balance !== undefined && sale.balance !== null && !isNaN(Number(sale.balance))) {
    balance = Number(sale.balance);
  } else if (sale.due_amount !== undefined && sale.due_amount !== null && !isNaN(Number(sale.due_amount))) {
    balance = Number(sale.due_amount);
  } else if (mode === 'CREDIT' || mode === 'DUE') {
    balance = total;
  } else {
    balance = Math.max(0, total - Math.max(0, received - oldCreditPaid));
  }

  return {
    total,
    received,
    balance,
    oldCreditPaid
  };
};

export const UserBalanceView = () => {
  const { sales = [], employees = [], products = [] } = useApp();

  // Additional Data State
  const [expenses, setExpenses] = useState([]);
  const [damages, setDamages] = useState([]);
  const [shortages, setShortages] = useState([]);
  const [isLoadingExtra, setIsLoadingExtra] = useState(false);

  // Popup Modal States
  const [damageModalData, setDamageModalData] = useState(null); // { userName, vehicleNumber, items: [], totalCount }
  const [shortageModalData, setShortageModalData] = useState(null); // { userName, vehicleNumber, items: [], totalCount }

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [quickDate, setQuickDate] = useState('ALL'); // ALL, TODAY, YESTERDAY, THIS_WEEK, THIS_MONTH, CUSTOM
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [userFilter, setUserFilter] = useState('ALL'); // 'ALL', 'STORE', or employee_id string

  // Fetch Expenses, Damages, Shortages from DB
  const loadExtraData = useCallback(async () => {
    setIsLoadingExtra(true);
    try {
      const [expRes, dmgRes, shtRes] = await Promise.all([
        apiFetch(`${API_URL}/expenses`).then(r => r.ok ? r.json() : []).catch(() => []),
        apiFetch(`${API_URL}/damages`).then(r => r.ok ? r.json() : []).catch(() => []),
        apiFetch(`${API_URL}/sk/driver-returns/missing`).then(r => r.ok ? r.json() : { records: [] }).catch(() => ({ records: [] }))
      ]);

      setExpenses(Array.isArray(expRes) ? expRes : []);
      setDamages(Array.isArray(dmgRes) ? dmgRes : []);
      setShortages(Array.isArray(shtRes?.records) ? shtRes.records : (Array.isArray(shtRes) ? shtRes : []));
    } catch (err) {
      console.error('Error loading extra balance data:', err);
    } finally {
      setIsLoadingExtra(false);
    }
  }, []);

  useEffect(() => {
    loadExtraData();
  }, [loadExtraData]);

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

  // Extract all unique users (Store Keeper + Drivers)
  const availableUsers = useMemo(() => {
    const map = new Map();
    map.set('STORE', {
      id: 'STORE',
      name: 'Store Keeper (Counter Direct)',
      vehicleNumber: 'Counter',
      icon: '🏬'
    });

    (employees || []).forEach(emp => {
      map.set(String(emp.id), {
        id: String(emp.id),
        name: emp.full_name || `Driver #${emp.id}`,
        vehicleNumber: emp.vehicle_number || '',
        icon: '🚚'
      });
    });

    (sales || []).forEach(s => {
      if (s.employee_id && !map.has(String(s.employee_id)) && !s.is_store_direct_sale) {
        map.set(String(s.employee_id), {
          id: String(s.employee_id),
          name: s.employee_name || `Driver #${s.employee_id}`,
          vehicleNumber: s.vehicle_number || '',
          icon: '🚚'
        });
      }
    });

    return Array.from(map.values());
  }, [employees, sales]);

  // Filter sales by date range and search
  const filteredSales = useMemo(() => {
    if (dateError) return [];

    return (sales || []).filter(sale => {
      const saleYmd = extractSaleDateYMD(sale);
      const isStoreCounter = sale.is_store_direct_sale || Number(sale.employee_id) === 6 || (sale.employee_name && sale.employee_name.toLowerCase().includes('store'));

      // Date Range Filter
      if (fromDate && saleYmd && saleYmd < fromDate) return false;
      if (toDate && saleYmd && saleYmd > toDate) return false;
      if ((fromDate || toDate) && !saleYmd) return false;

      // User Filter
      if (userFilter !== 'ALL') {
        if (userFilter === 'STORE') {
          if (!isStoreCounter) return false;
        } else {
          if (String(sale.employee_id) !== String(userFilter) || isStoreCounter) return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const bNo = (sale.bill_no || '').toLowerCase();
        const sName = (sale.shop_name || sale.customer_name || '').toLowerCase();
        const eName = (sale.employee_name || '').toLowerCase();
        if (!bNo.includes(q) && !sName.includes(q) && !eName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [sales, fromDate, toDate, userFilter, searchQuery, dateError]);

  // Filter expenses by date range
  const filteredExpenses = useMemo(() => {
    if (dateError) return [];
    return (expenses || []).filter(exp => {
      const expYmd = extractGenericDateYMD(exp);
      if (fromDate && expYmd && expYmd < fromDate) return false;
      if (toDate && expYmd && expYmd > toDate) return false;
      if ((fromDate || toDate) && !expYmd) return false;

      if (userFilter !== 'ALL') {
        if (userFilter === 'STORE') {
          if (exp.employee_id) return false;
        } else {
          if (String(exp.employee_id) !== String(userFilter)) return false;
        }
      }
      return true;
    });
  }, [expenses, fromDate, toDate, userFilter, dateError]);

  // Filter damages by date range
  const filteredDamages = useMemo(() => {
    if (dateError) return [];
    return (damages || []).filter(dmg => {
      const dmgYmd = extractGenericDateYMD(dmg);
      if (fromDate && dmgYmd && dmgYmd < fromDate) return false;
      if (toDate && dmgYmd && dmgYmd > toDate) return false;
      if ((fromDate || toDate) && !dmgYmd) return false;

      if (userFilter !== 'ALL') {
        if (userFilter === 'STORE') {
          if (dmg.employee_id) return false;
        } else {
          if (String(dmg.employee_id) !== String(userFilter)) return false;
        }
      }
      return true;
    });
  }, [damages, fromDate, toDate, userFilter, dateError]);

  // Filter shortages by date range
  const filteredShortages = useMemo(() => {
    if (dateError) return [];
    return (shortages || []).filter(sht => {
      const shtYmd = extractGenericDateYMD(sht);
      if (fromDate && shtYmd && shtYmd < fromDate) return false;
      if (toDate && shtYmd && shtYmd > toDate) return false;
      if ((fromDate || toDate) && !shtYmd) return false;

      const driverId = sht.driver_id || sht.employee_id;
      if (userFilter !== 'ALL') {
        if (userFilter === 'STORE') {
          if (driverId) return false;
        } else {
          if (String(driverId) !== String(userFilter)) return false;
        }
      }
      return true;
    });
  }, [shortages, fromDate, toDate, userFilter, dateError]);

  // Aggregate stats per user (Sales + Expenses + Damages + Shortages)
  const userSummaries = useMemo(() => {
    const summaryMap = new Map();

    availableUsers.forEach(u => {
      summaryMap.set(u.id, {
        user: u,
        totalSales: 0,
        totalReceived: 0,
        totalBalance: 0,
        oldCreditCollected: 0,
        totalExpenses: 0,
        damageProducts: [],
        totalDamagePieces: 0,
        shortageProducts: [],
        totalShortagePieces: 0
      });
    });

    // 1. Process Sales
    filteredSales.forEach(sale => {
      const isStoreCounter = sale.is_store_direct_sale || Number(sale.employee_id) === 6 || (sale.employee_name && sale.employee_name.toLowerCase().includes('store'));
      const key = isStoreCounter ? 'STORE' : String(sale.employee_id || 'STORE');

      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          user: {
            id: key,
            name: sale.employee_name || 'Driver',
            vehicleNumber: sale.vehicle_number || '',
            icon: '🚚'
          },
          totalSales: 0,
          totalReceived: 0,
          totalBalance: 0,
          oldCreditCollected: 0,
          totalExpenses: 0,
          damageProducts: [],
          totalDamagePieces: 0,
          shortageProducts: [],
          totalShortagePieces: 0
        });
      }

      const entry = summaryMap.get(key);
      const fin = getSaleFinancials(sale);

      entry.totalSales += fin.total;
      entry.totalReceived += fin.received;
      entry.totalBalance += fin.balance;
      entry.oldCreditCollected += fin.oldCreditPaid;
    });

    // 2. Process Expenses per Driver
    filteredExpenses.forEach(exp => {
      const key = exp.employee_id ? String(exp.employee_id) : 'STORE';
      if (summaryMap.has(key)) {
        summaryMap.get(key).totalExpenses += Number(exp.amount || 0);
      }
    });

    // 3. Process Damages per Driver
    const dmgMapByUser = new Map();
    filteredDamages.forEach(dmg => {
      const key = dmg.employee_id ? String(dmg.employee_id) : 'STORE';
      if (!dmgMapByUser.has(key)) {
        dmgMapByUser.set(key, new Map());
      }
      const userDmgMap = dmgMapByUser.get(key);
      const pid = dmg.product_id || 0;
      const pObj = products.find(p => p.id === pid) || {};
      const pName = dmg.product_name || pObj.display_name || pObj.name || `Product #${pid}`;
      const pieces = Math.round(Number(dmg.base_quantity ?? dmg.qty_units ?? 0));
      const unit = dmg.damage_unit || dmg.unit || pObj.base_unit || 'Piece';
      const img = resolveProductImageUrl({ ...pObj, ...dmg, display_name: pName, name: pName });

      if (!userDmgMap.has(pid)) {
        userDmgMap.set(pid, {
          productId: pid,
          productName: pName,
          imageUrl: img,
          totalPieces: 0,
          unit,
          productObj: pObj
        });
      }
      userDmgMap.get(pid).totalPieces += pieces;
    });

    dmgMapByUser.forEach((productMap, userKey) => {
      if (summaryMap.has(userKey)) {
        const sortedProducts = Array.from(productMap.values())
          .filter(p => p.totalPieces > 0)
          .sort((a, b) => getProductDisplayRank(a.productObj || { name: a.productName }) - getProductDisplayRank(b.productObj || { name: b.productName }));
        const totalPcs = sortedProducts.reduce((sum, p) => sum + p.totalPieces, 0);
        summaryMap.get(userKey).damageProducts = sortedProducts;
        summaryMap.get(userKey).totalDamagePieces = totalPcs;
      }
    });

    // 4. Process Shortages per Driver
    const shortMapByUser = new Map();
    filteredShortages.forEach(sht => {
      const key = sht.driver_id ? String(sht.driver_id) : (sht.employee_id ? String(sht.employee_id) : 'STORE');
      if (!shortMapByUser.has(key)) {
        shortMapByUser.set(key, new Map());
      }
      const userShortMap = shortMapByUser.get(key);
      const pid = sht.product_id || 0;
      const pObj = products.find(p => p.id === pid) || {};
      const pName = sht.product_name || pObj.display_name || pObj.name || `Product #${pid}`;
      const pieces = Math.round(Number(sht.missing_quantity ?? sht.shortage_units ?? 0));
      const unit = sht.unit || pObj.base_unit || 'Piece';
      const img = resolveProductImageUrl({ ...pObj, ...sht, display_name: pName, name: pName });

      if (!userShortMap.has(pid)) {
        userShortMap.set(pid, {
          productId: pid,
          productName: pName,
          imageUrl: img,
          totalPieces: 0,
          unit,
          productObj: pObj
        });
      }
      userShortMap.get(pid).totalPieces += pieces;
    });

    shortMapByUser.forEach((productMap, userKey) => {
      if (summaryMap.has(userKey)) {
        const sortedProducts = Array.from(productMap.values())
          .filter(p => p.totalPieces > 0)
          .sort((a, b) => getProductDisplayRank(a.productObj || { name: a.productName }) - getProductDisplayRank(b.productObj || { name: b.productName }));
        const totalPcs = sortedProducts.reduce((sum, p) => sum + p.totalPieces, 0);
        summaryMap.get(userKey).shortageProducts = sortedProducts;
        summaryMap.get(userKey).totalShortagePieces = totalPcs;
      }
    });

    let list = Array.from(summaryMap.values());

    if (userFilter !== 'ALL') {
      list = list.filter(item => item.user.id === userFilter);
    } else {
      list.sort((a, b) => {
        if (b.totalSales !== a.totalSales) return b.totalSales - a.totalSales;
        return a.user.name.localeCompare(b.user.name);
      });
    }

    return list;
  }, [availableUsers, filteredSales, filteredExpenses, filteredDamages, filteredShortages, userFilter, products]);

  // Overall Aggregated Totals
  const overallMetrics = useMemo(() => {
    let salesAmt = 0;
    let receivedAmt = 0;
    let balanceAmt = 0;
    let oldCreditAmt = 0;
    let expenseAmt = 0;
    let damagePcs = 0;
    let shortagePcs = 0;

    userSummaries.forEach(u => {
      salesAmt += u.totalSales;
      receivedAmt += u.totalReceived;
      balanceAmt += u.totalBalance;
      oldCreditAmt += u.oldCreditCollected;
      expenseAmt += u.totalExpenses;
      damagePcs += u.totalDamagePieces;
      shortagePcs += u.totalShortagePieces;
    });

    return {
      totalSales: Math.round(salesAmt),
      totalReceived: Math.round(receivedAmt),
      totalBalance: Math.round(balanceAmt),
      oldCreditCollected: Math.round(oldCreditAmt),
      totalExpenses: Math.round(expenseAmt),
      totalDamagePieces: damagePcs,
      totalShortagePieces: shortagePcs
    };
  }, [userSummaries]);

  // Reset Filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setQuickDate('ALL');
    setFromDate('');
    setToDate('');
    setUserFilter('ALL');
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (quickDate !== 'ALL' || fromDate || toDate) count++;
    if (userFilter !== 'ALL') count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [quickDate, fromDate, toDate, userFilter, searchQuery]);

  // Open Damage Popup
  const openDamageModal = (summary) => {
    setDamageModalData({
      userName: summary.user.name,
      vehicleNumber: summary.user.vehicleNumber,
      items: summary.damageProducts,
      totalCount: summary.totalDamagePieces
    });
  };

  // Open Shortage Popup
  const openShortageModal = (summary) => {
    setShortageModalData({
      userName: summary.user.name,
      vehicleNumber: summary.user.vehicleNumber,
      items: summary.shortageProducts,
      totalCount: summary.totalShortagePieces
    });
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-8 bg-sky-50/50 p-2 sm:p-4 rounded-3xl">
      
      {/* TOP 4 FINANCIAL KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        
        {/* Card 1: Total Sales */}
        <div className="glass-card p-3.5 sm:p-5 rounded-2xl bg-white border-l-4 sm:border-l-6 border-indigo-600 border border-sky-200 shadow-sm">
          <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-tight block">
            TOTAL SALES (விற்பனை)
          </span>
          <div className="font-mono font-black text-lg sm:text-2xl lg:text-3xl text-indigo-700 mt-1 sm:mt-2">
            ₹{overallMetrics.totalSales.toLocaleString('en-IN')}
          </div>
        </div>

        {/* Card 2: Old Credit Collected */}
        <div className="glass-card p-3.5 sm:p-5 rounded-2xl bg-white border-l-4 sm:border-l-6 border-amber-500 border border-sky-200 shadow-sm">
          <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-tight block">
            OLD CREDIT (பழைய கடன் வசூல்)
          </span>
          <div className="font-mono font-black text-lg sm:text-2xl lg:text-3xl text-amber-700 mt-1 sm:mt-2">
            ₹{overallMetrics.oldCreditCollected.toLocaleString('en-IN')}
          </div>
        </div>

        {/* Card 3: Total Received */}
        <div className="glass-card p-3.5 sm:p-5 rounded-2xl bg-white border-l-4 sm:border-l-6 border-emerald-600 border border-sky-200 shadow-sm">
          <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-tight block">
            TOTAL RECEIVED (மொத்த வரவு)
          </span>
          <div className="font-mono font-black text-lg sm:text-2xl lg:text-3xl text-emerald-600 mt-1 sm:mt-2">
            ₹{overallMetrics.totalReceived.toLocaleString('en-IN')}
          </div>
        </div>

        {/* Card 4: Balance / Credit Given */}
        <div className="glass-card p-3.5 sm:p-5 rounded-2xl bg-white border-l-4 sm:border-l-6 border-rose-600 border border-sky-200 shadow-sm">
          <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-tight block">
            BALANCE (மொத்த பாக்கி)
          </span>
          <div className="font-mono font-black text-lg sm:text-2xl lg:text-3xl text-rose-600 mt-1 sm:mt-2">
            ₹{overallMetrics.totalBalance.toLocaleString('en-IN')}
          </div>
        </div>

      </div>

      {/* FILTER CONTROLS PANEL */}
      <div className="glass-panel p-3 sm:p-4 rounded-2xl bg-white border border-sky-200 space-y-3 shadow-xs">
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          
          {/* Search Bar */}
          <div className="relative w-full sm:w-48 lg:w-56 shrink-0">
            <Search className="w-3.5 h-3.5 text-sky-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search User, Shop, Bill #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 sm:py-2 text-xs font-bold bg-sky-50/70 border border-sky-200 rounded-xl focus:outline-none focus:border-sky-600 focus:bg-white transition text-slate-900"
            />
          </div>

          {/* Quick Date Range Pills */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-1 bg-sky-100/80 p-1 rounded-xl border border-sky-200 text-[11px] sm:text-xs">
            <button
              onClick={() => handleQuickDateSelect('ALL')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                quickDate === 'ALL' ? 'bg-white text-sky-950 shadow-xs border border-sky-200' : 'text-sky-800 hover:text-slate-900'
              }`}
            >
              All Dates
            </button>
            <button
              onClick={() => handleQuickDateSelect('TODAY')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                quickDate === 'TODAY' ? 'bg-sky-600 text-white shadow-xs' : 'text-sky-800 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handleQuickDateSelect('YESTERDAY')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                quickDate === 'YESTERDAY' ? 'bg-sky-600 text-white shadow-xs' : 'text-sky-800 hover:text-slate-900'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => handleQuickDateSelect('THIS_WEEK')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                quickDate === 'THIS_WEEK' ? 'bg-sky-600 text-white shadow-xs' : 'text-sky-800 hover:text-slate-900'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => handleQuickDateSelect('THIS_MONTH')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                quickDate === 'THIS_MONTH' ? 'bg-sky-600 text-white shadow-xs' : 'text-sky-800 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => handleQuickDateSelect('CUSTOM')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                quickDate === 'CUSTOM' ? 'bg-sky-600 text-white shadow-xs' : 'text-sky-800 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3 h-3" /> Custom
            </button>
          </div>

          {/* User Filter Dropdown */}
          <div className="w-full sm:w-44 lg:w-52 shrink-0">
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full p-1.5 sm:p-2 font-bold text-xs bg-sky-50 border border-sky-200 rounded-xl focus:outline-none focus:border-sky-600 text-slate-800 cursor-pointer"
            >
              <option value="ALL">All Users & Drivers</option>
              <option value="STORE">🏬 Store Keeper</option>
              {availableUsers.filter(u => u.id !== 'STORE').map(u => (
                <option key={u.id} value={u.id}>🚚 {u.name}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Custom Date Range Picker */}
        {quickDate === 'CUSTOM' && (
          <div className="pt-3 border-t border-sky-100 flex flex-wrap items-center gap-3 text-xs sm:text-sm bg-sky-50/70 p-3 rounded-2xl border border-sky-200">
            <span className="font-black text-slate-800 flex items-center gap-1">
              <Calendar className="w-4 h-4 text-sky-600" /> Date Range:
            </span>
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-600">From:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setQuickDate('CUSTOM'); }}
                className="p-2 font-bold bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-sky-600 text-xs sm:text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-600">To:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setQuickDate('CUSTOM'); }}
                className="p-2 font-bold bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-sky-600 text-xs sm:text-sm"
              />
            </div>
            {dateError && (
              <span className="text-rose-600 font-black text-xs sm:text-sm flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> {dateError}
              </span>
            )}
          </div>
        )}

        {/* Active Filters Clear Bar */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-sky-100 text-xs sm:text-sm">
            <span className="text-slate-600 font-bold">
              Filters Active ({activeFiltersCount})
            </span>
            <button
              onClick={handleClearFilters}
              className="text-xs sm:text-sm font-black text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
            </button>
          </div>
        )}

      </div>

      {/* MAIN USER BALANCE TABLE (DESKTOP) */}
      <div className="glass-panel rounded-3xl bg-white border-2 border-sky-200 overflow-hidden shadow-sm">
        
        <div className="hidden md:block overflow-x-auto max-w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-sky-200 bg-sky-100/90 text-[11px] sm:text-xs text-slate-800">
                <th className="py-2.5 px-3 pl-4 sm:pl-5 text-left font-black tracking-tight text-slate-900">
                  <span>USER NAME</span>
                  <span className="text-[10px] font-semibold text-slate-500 block normal-case leading-tight">பயனாளர் பெயர்</span>
                </th>
                <th className="py-2.5 px-3 text-right font-black tracking-tight text-indigo-950">
                  <span>TOTAL SALES</span>
                  <span className="text-[10px] font-semibold text-slate-500 block normal-case leading-tight">விற்பனை</span>
                </th>
                <th className="py-2.5 px-3 text-right font-black tracking-tight text-amber-950">
                  <span>OLD CREDIT</span>
                  <span className="text-[10px] font-semibold text-slate-500 block normal-case leading-tight">பழைய வரவு</span>
                </th>
                <th className="py-2.5 px-3 text-right font-black tracking-tight text-emerald-950">
                  <span>TOTAL RECEIVED</span>
                  <span className="text-[10px] font-semibold text-slate-500 block normal-case leading-tight">மொத்த வரவு</span>
                </th>
                <th className="py-2.5 px-3 text-right font-black tracking-tight text-rose-950">
                  <span>BALANCE GIVEN</span>
                  <span className="text-[10px] font-semibold text-slate-500 block normal-case leading-tight">பாக்கி</span>
                </th>
                <th className="py-2.5 px-3 text-right font-black tracking-tight bg-amber-50/70 text-amber-950">
                  <span>EXPENSE</span>
                  <span className="text-[10px] font-semibold text-amber-700 block normal-case leading-tight">செலவு</span>
                </th>
                <th className="py-2.5 px-3 text-center font-black tracking-tight bg-rose-50/70 text-rose-950">
                  <span>DAMAGE</span>
                  <span className="text-[10px] font-semibold text-rose-700 block normal-case leading-tight">சேதம்</span>
                </th>
                <th className="py-2.5 px-3 pr-4 sm:pr-5 text-center font-black tracking-tight bg-orange-50/70 text-orange-950">
                  <span>SHORTAGE</span>
                  <span className="text-[10px] font-semibold text-orange-700 block normal-case leading-tight">குறைவு</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100">
              {userSummaries.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-10 text-center bg-sky-50/40">
                    <p className="font-black text-sm sm:text-base text-slate-700">No User Records Found</p>
                  </td>
                </tr>
              ) : (
                userSummaries.map((summary) => {
                  const { user, totalSales, totalReceived, totalBalance, oldCreditCollected, totalExpenses, totalDamagePieces, totalShortagePieces } = summary;
                  return (
                    <tr key={user.id} className="hover:bg-sky-50/70 transition-colors">
                      
                      {/* User Name */}
                      <td className="p-3.5 pl-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-2xl bg-sky-100 text-sky-900 border border-sky-200 flex items-center justify-center font-bold text-base shrink-0">
                            {user.icon || '👤'}
                          </div>
                          <div>
                            <span className="font-black text-slate-900 text-sm sm:text-base block leading-tight">
                              {user.name}
                            </span>
                            {user.vehicleNumber && user.vehicleNumber !== 'Counter' && (
                              <span className="text-[11px] font-bold text-slate-500 block">
                                {user.vehicleNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Total Sales */}
                      <td className="p-3.5 text-right font-mono font-black text-sm sm:text-base text-indigo-700">
                        ₹{Math.round(totalSales).toLocaleString('en-IN')}
                      </td>

                      {/* Old Credit Collected */}
                      <td className="p-3.5 text-right font-mono font-black text-sm sm:text-base text-amber-700">
                        ₹{Math.round(oldCreditCollected).toLocaleString('en-IN')}
                      </td>

                      {/* Total Received */}
                      <td className="p-3.5 text-right font-mono font-black text-sm sm:text-base text-emerald-700">
                        ₹{Math.round(totalReceived).toLocaleString('en-IN')}
                      </td>

                      {/* Balance Given */}
                      <td className="p-3.5 text-right font-mono font-black text-sm sm:text-base text-rose-700">
                        ₹{Math.round(totalBalance).toLocaleString('en-IN')}
                      </td>

                      {/* 1st NEW COLUMN: Expense (செலவு) */}
                      <td className="p-3.5 text-right font-mono font-black text-sm sm:text-base text-amber-900 bg-amber-50/30">
                        ₹{Math.round(totalExpenses).toLocaleString('en-IN')}
                      </td>

                      {/* 2nd NEW COLUMN: Damage (சேதம்) */}
                      <td className="p-3.5 text-center bg-rose-50/30">
                        {totalDamagePieces > 0 ? (
                          <button
                            onClick={() => openDamageModal(summary)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 border-2 border-rose-300 rounded-xl font-black text-xs sm:text-sm shadow-xs transition hover:scale-105 active:scale-95 cursor-pointer"
                            title="Click to view damaged products breakdown"
                          >
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{totalDamagePieces} Pcs</span>
                            <span className="text-[10px] uppercase font-bold bg-rose-200/80 text-rose-900 px-1.5 py-0.5 rounded-md">View</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 font-bold text-xs sm:text-sm">0 Pcs</span>
                        )}
                      </td>

                      {/* 3rd NEW COLUMN: Shortage (குறைவு) */}
                      <td className="p-3.5 pr-5 text-center bg-orange-50/30">
                        {totalShortagePieces > 0 ? (
                          <button
                            onClick={() => openShortageModal(summary)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-900 border-2 border-orange-300 rounded-xl font-black text-xs sm:text-sm shadow-xs transition hover:scale-105 active:scale-95 cursor-pointer"
                            title="Click to view shortage products breakdown"
                          >
                            <TrendingDown className="w-4 h-4 text-orange-600 shrink-0" />
                            <span>{totalShortagePieces} Pcs</span>
                            <span className="text-[10px] uppercase font-bold bg-orange-200/80 text-orange-950 px-1.5 py-0.5 rounded-md">View</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 font-bold text-xs sm:text-sm">0 Pcs</span>
                        )}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS VIEW */}
        <div className="block md:hidden divide-y divide-sky-100">
          {userSummaries.length === 0 ? (
            <div className="p-6 text-center bg-sky-50/50">
              <p className="font-black text-xs text-slate-700">No Records Found</p>
            </div>
          ) : (
            userSummaries.map((summary) => {
              const { user, totalSales, totalReceived, totalBalance, oldCreditCollected, totalExpenses, totalDamagePieces, totalShortagePieces } = summary;
              return (
                <div key={user.id} className="p-3.5 space-y-3 bg-white">
                  
                  {/* Username & Vehicle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-900 border border-sky-200 flex items-center justify-center font-bold text-sm shrink-0">
                        {user.icon || '👤'}
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-slate-900 leading-tight">{user.name}</h4>
                        {user.vehicleNumber && user.vehicleNumber !== 'Counter' && (
                          <span className="text-[10px] font-bold text-slate-500">{user.vehicleNumber}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financial 4-Grid */}
                  <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono font-bold bg-sky-50/80 p-2.5 rounded-2xl border border-sky-200">
                    <div className="bg-white p-2 rounded-xl border border-sky-100">
                      <span className="text-[10px] font-black uppercase text-slate-500 block">Sales (விற்பனை)</span>
                      <span className="font-black text-indigo-700 text-sm">₹{Math.round(totalSales).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-sky-100">
                      <span className="text-[10px] font-black uppercase text-slate-500 block">Old Credit (பழைய வரவு)</span>
                      <span className="font-black text-amber-700 text-sm">₹{Math.round(oldCreditCollected).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-sky-100">
                      <span className="text-[10px] font-black uppercase text-slate-500 block">Varavu (வரவு)</span>
                      <span className="font-black text-emerald-700 text-sm">₹{Math.round(totalReceived).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-sky-100">
                      <span className="text-[10px] font-black uppercase text-slate-500 block">Paakki (பாக்கி)</span>
                      <span className="font-black text-rose-700 text-sm">₹{Math.round(totalBalance).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* 3 Mobile Badges: Expense, Damage, Shortage */}
                  <div className="grid grid-cols-3 gap-2">
                    {/* Mobile Expense */}
                    <div className="bg-amber-50 border border-amber-200 p-2 rounded-xl text-center">
                      <span className="text-[10px] font-black text-amber-800 uppercase block">Expense</span>
                      <span className="font-mono font-black text-amber-950 text-xs sm:text-sm">
                        ₹{Math.round(totalExpenses).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* Mobile Damage */}
                    <button
                      disabled={totalDamagePieces === 0}
                      onClick={() => openDamageModal(summary)}
                      className={`p-2 rounded-xl border text-center transition ${
                        totalDamagePieces > 0
                          ? 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-900 cursor-pointer shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-400 opacity-70 cursor-default'
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase block">Damage</span>
                      <span className="font-mono font-black text-xs sm:text-sm block">
                        {totalDamagePieces} Pcs
                      </span>
                    </button>

                    {/* Mobile Shortage */}
                    <button
                      disabled={totalShortagePieces === 0}
                      onClick={() => openShortageModal(summary)}
                      className={`p-2 rounded-xl border text-center transition ${
                        totalShortagePieces > 0
                          ? 'bg-orange-50 hover:bg-orange-100 border-orange-300 text-orange-950 cursor-pointer shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-400 opacity-70 cursor-default'
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase block">Shortage</span>
                      <span className="font-mono font-black text-xs sm:text-sm block">
                        {totalShortagePieces} Pcs
                      </span>
                    </button>
                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>

      {/* ============================================================ */}
      {/* DAMAGE POPUP MODAL (LIGHT-BLUE THEME, BIG FONTS, IMAGES) */}
      {/* ============================================================ */}
      {damageModalData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-gradient-to-b from-sky-50 via-white to-sky-100/90 border-2 border-sky-300 rounded-3xl max-w-lg w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b-2 border-sky-200 bg-sky-900 text-white flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-sm">
                  <AlertCircle className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-white leading-tight">
                    Damage Stock Details (சேத விவரங்கள்)
                  </h3>
                  <p className="text-xs text-sky-200 font-bold mt-0.5">
                    Driver: <span className="text-white">{damageModalData.userName}</span> {damageModalData.vehicleNumber && `(${damageModalData.vehicleNumber})`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDamageModalData(null)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-sky-100 hover:text-white flex items-center justify-center transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Products List with Images and Counts */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-3 bg-sky-50/50">
              {damageModalData.items.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border-2 border-sky-200">
                  <Package className="w-10 h-10 text-sky-400 mx-auto mb-2" />
                  <p className="font-black text-slate-700 text-sm sm:text-base">No Damaged Products Recorded</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {damageModalData.items.map((item, idx) => (
                    <div 
                      key={item.productId || idx}
                      className="flex items-center justify-between p-3.5 bg-white border-2 border-sky-200 hover:border-rose-300 rounded-2xl shadow-xs transition"
                    >
                      {/* Left: Product Image & Name */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-sky-50 border border-sky-200 p-1.5 flex items-center justify-center shrink-0 shadow-xs">
                          {item.imageUrl ? (
                            <img 
                              src={item.imageUrl} 
                              alt={item.productName} 
                              className="w-full h-full object-contain rounded-xl"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <Package className="w-6 h-6 text-sky-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-slate-900 text-sm sm:text-base truncate leading-snug">
                            {item.productName}
                          </h4>
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mt-0.5">
                            Unit: {item.unit || 'Piece'}
                          </span>
                        </div>
                      </div>

                      {/* Right: Damage Piece Count */}
                      <div className="text-right shrink-0 pl-3">
                        <span className="inline-block px-3 py-1.5 bg-rose-100 border-2 border-rose-300 text-rose-900 font-mono font-black text-base sm:text-lg rounded-xl shadow-xs">
                          {item.totalPieces} Pcs
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer: Total Summary */}
            <div className="p-4 sm:p-5 border-t-2 border-sky-200 bg-sky-100/90 flex items-center justify-between shrink-0">
              <span className="font-black text-slate-900 text-sm sm:text-base uppercase tracking-wide">
                Total Damaged Count (மொத்த சேதம்)
              </span>
              <span className="font-mono font-black text-lg sm:text-2xl text-rose-700 bg-white px-4 py-1.5 rounded-2xl border-2 border-rose-300 shadow-xs">
                {damageModalData.totalCount} Pieces
              </span>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SHORTAGE POPUP MODAL (LIGHT-BLUE THEME, BIG FONTS, IMAGES) */}
      {/* ============================================================ */}
      {shortageModalData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-gradient-to-b from-sky-50 via-white to-sky-100/90 border-2 border-sky-300 rounded-3xl max-w-lg w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b-2 border-sky-200 bg-sky-900 text-white flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-sm">
                  <TrendingDown className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-white leading-tight">
                    Shortage Stock Details (குறைவு விவரங்கள்)
                  </h3>
                  <p className="text-xs text-sky-200 font-bold mt-0.5">
                    Driver: <span className="text-white">{shortageModalData.userName}</span> {shortageModalData.vehicleNumber && `(${shortageModalData.vehicleNumber})`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShortageModalData(null)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-sky-100 hover:text-white flex items-center justify-center transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Products List with Images and Shortage Counts */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-3 bg-sky-50/50">
              {shortageModalData.items.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border-2 border-sky-200">
                  <Package className="w-10 h-10 text-sky-400 mx-auto mb-2" />
                  <p className="font-black text-slate-700 text-sm sm:text-base">No Shortage Stock Recorded</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {shortageModalData.items.map((item, idx) => (
                    <div 
                      key={item.productId || idx}
                      className="flex items-center justify-between p-3.5 bg-white border-2 border-sky-200 hover:border-orange-300 rounded-2xl shadow-xs transition"
                    >
                      {/* Left: Product Image & Name */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-sky-50 border border-sky-200 p-1.5 flex items-center justify-center shrink-0 shadow-xs">
                          {item.imageUrl ? (
                            <img 
                              src={item.imageUrl} 
                              alt={item.productName} 
                              className="w-full h-full object-contain rounded-xl"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <Package className="w-6 h-6 text-sky-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-slate-900 text-sm sm:text-base truncate leading-snug">
                            {item.productName}
                          </h4>
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mt-0.5">
                            Unit: {item.unit || 'Piece'}
                          </span>
                        </div>
                      </div>

                      {/* Right: Shortage Piece Count */}
                      <div className="text-right shrink-0 pl-3">
                        <span className="inline-block px-3 py-1.5 bg-orange-100 border-2 border-orange-300 text-orange-950 font-mono font-black text-base sm:text-lg rounded-xl shadow-xs">
                          {item.totalPieces} Pcs
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer: Total Shortage Summary */}
            <div className="p-4 sm:p-5 border-t-2 border-sky-200 bg-sky-100/90 flex items-center justify-between shrink-0">
              <span className="font-black text-slate-900 text-sm sm:text-base uppercase tracking-wide">
                Total Shortage Count (மொத்த குறைவு)
              </span>
              <span className="font-mono font-black text-lg sm:text-2xl text-orange-800 bg-white px-4 py-1.5 rounded-2xl border-2 border-orange-300 shadow-xs">
                {shortageModalData.totalCount} Pieces
              </span>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default UserBalanceView;
