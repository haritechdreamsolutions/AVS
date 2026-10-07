import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Wallet, Search, Calendar, UserCheck, Truck, Store, 
  DollarSign, Smartphone, CreditCard, ArrowRightLeft, 
  AlertTriangle, RotateCcw, ChevronDown, SlidersHorizontal, 
  Eye, X, ArrowUpRight, ArrowDownLeft, CheckCircle2, FileText
} from 'lucide-react';
import { ThermalBillModal } from '../Employee/ThermalBillModal';

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

// Helper to calculate exact financials for any sale
const getSaleFinancials = (sale) => {
  if (!sale) return { total: 0, received: 0, balance: 0, oldCreditPaid: 0 };
  const total = Number(sale.total_amount || sale.grand_total || 0);
  const mode = (sale.payment_mode || 'CASH').toUpperCase();
  const oldCreditPaid = Number(sale.old_credit_paid || 0);

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
    balance = Math.max(0, total - received);
  }

  return {
    total,
    received,
    balance,
    oldCreditPaid
  };
};

export const UserBalanceView = () => {
  const { sales = [], employees = [], shops = [] } = useApp();

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [quickDate, setQuickDate] = useState('ALL'); // ALL, TODAY, YESTERDAY, THIS_WEEK, THIS_MONTH, CUSTOM
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [userFilter, setUserFilter] = useState('ALL'); // 'ALL', 'STORE', or employee_id string
  const [selectedUserDetail, setSelectedUserDetail] = useState(null); // When clicking "View Invoices"
  const [selectedBillToPrint, setSelectedBillToPrint] = useState(null);

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
      role: 'STORE_KEEPER',
      icon: '🏬',
      badge: 'Warehouse Counter'
    });

    (employees || []).forEach(emp => {
      map.set(String(emp.id), {
        id: String(emp.id),
        name: emp.full_name,
        role: emp.role || 'DRIVER',
        vehicle: emp.vehicle_number || emp.vehicle_no || 'Vehicle',
        phone: emp.phone || '',
        icon: '🚚',
        badge: emp.vehicle_number || 'Driver'
      });
    });

    (sales || []).forEach(s => {
      if (s.employee_id && !map.has(String(s.employee_id)) && !s.is_store_direct_sale) {
        map.set(String(s.employee_id), {
          id: String(s.employee_id),
          name: s.employee_name || `Driver #${s.employee_id}`,
          role: 'DRIVER',
          vehicle: s.vehicle_no || 'Delivery Route',
          icon: '🚚',
          badge: s.vehicle_no || 'Driver'
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
      const saleUserKey = isStoreCounter ? 'STORE' : String(sale.employee_id || 'STORE');

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

  // Aggregate stats per user for the filtered period
  const userSummaries = useMemo(() => {
    const summaryMap = new Map();

    availableUsers.forEach(u => {
      summaryMap.set(u.id, {
        user: u,
        totalBills: 0,
        totalSales: 0,
        totalReceived: 0,
        totalBalance: 0,
        oldCreditCollected: 0,
        salesList: []
      });
    });

    filteredSales.forEach(sale => {
      const isStoreCounter = sale.is_store_direct_sale || Number(sale.employee_id) === 6 || (sale.employee_name && sale.employee_name.toLowerCase().includes('store'));
      const key = isStoreCounter ? 'STORE' : String(sale.employee_id || 'STORE');

      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          user: {
            id: key,
            name: sale.employee_name || 'Driver',
            role: 'DRIVER',
            vehicle: sale.vehicle_no || '',
            icon: '🚚',
            badge: sale.vehicle_no || 'Driver'
          },
          totalBills: 0,
          totalSales: 0,
          totalReceived: 0,
          totalBalance: 0,
          oldCreditCollected: 0,
          salesList: []
        });
      }

      const entry = summaryMap.get(key);
      const fin = getSaleFinancials(sale);

      entry.totalBills += 1;
      entry.totalSales += fin.total;
      entry.totalReceived += fin.received;
      entry.totalBalance += fin.balance;
      entry.oldCreditCollected += fin.oldCreditPaid;
      entry.salesList.push({ ...sale, financials: fin });
    });

    let list = Array.from(summaryMap.values());

    if (userFilter !== 'ALL') {
      list = list.filter(item => item.user.id === userFilter);
    } else {
      // Sort users with active bills first, then alphabetically
      list.sort((a, b) => {
        if (b.totalBills !== a.totalBills) return b.totalBills - a.totalBills;
        return a.user.name.localeCompare(b.user.name);
      });
    }

    return list;
  }, [availableUsers, filteredSales, userFilter]);

  // Overall Aggregated Totals
  const overallMetrics = useMemo(() => {
    let bills = 0;
    let salesAmt = 0;
    let receivedAmt = 0;
    let balanceAmt = 0;
    let oldCreditAmt = 0;

    userSummaries.forEach(u => {
      bills += u.totalBills;
      salesAmt += u.totalSales;
      receivedAmt += u.totalReceived;
      balanceAmt += u.totalBalance;
      oldCreditAmt += u.oldCreditCollected;
    });

    return {
      totalBills: bills,
      totalSales: salesAmt,
      totalReceived: receivedAmt,
      totalBalance: balanceAmt,
      oldCreditCollected: oldCreditAmt
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

  return (
    <div className="space-y-4 sm:space-y-5 pb-8">
      
      {/* Top Banner */}
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white border-2 border-sky-900 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-900/50 shrink-0">
              <Wallet className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                USER BALANCE & CREDIT SUMMARY (பயனாளர் வரவு & பாக்கி)
                <span className="text-[10px] sm:text-xs bg-teal-500/20 text-teal-300 font-extrabold px-2.5 py-0.5 rounded-full border border-teal-400/30">
                  Live Ledger
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-sky-200 font-bold mt-0.5">
                Comprehensive Sales, Collection Received & Pending Due Breakdown for Store Keeper & Drivers
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          <span className="font-mono font-black text-xs sm:text-sm text-emerald-300 bg-emerald-500/15 px-3.5 py-2 rounded-2xl border border-emerald-400/30 shadow-xs">
            Total Sales: ₹{overallMetrics.totalSales.toLocaleString()}
          </span>
        </div>
      </div>

      {/* TOP FINANCIAL KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="glass-card p-4 sm:p-5 rounded-2xl bg-white border-l-4 border-sky-600 border-2 border-sky-100 shadow-xs">
          <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-tight block">
            Total Bills Generated
          </span>
          <div className="font-mono font-black text-xl sm:text-2xl text-slate-900 mt-1">
            {overallMetrics.totalBills} <span className="text-xs sm:text-sm text-slate-500 font-bold">Invoices</span>
          </div>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl bg-white border-l-4 border-emerald-500 border-2 border-sky-100 shadow-xs">
          <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-tight block">
            Total Received (மொத்த வரவு)
          </span>
          <div className="font-mono font-black text-xl sm:text-2xl text-emerald-600 mt-1">
            ₹{overallMetrics.totalReceived.toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl bg-white border-l-4 border-rose-500 border-2 border-sky-100 shadow-xs">
          <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-tight block">
            Balance / Credit Given (மொத்த பாக்கி)
          </span>
          <div className="font-mono font-black text-xl sm:text-2xl text-rose-600 mt-1">
            ₹{overallMetrics.totalBalance.toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl bg-white border-l-4 border-indigo-500 border-2 border-sky-100 shadow-xs">
          <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-tight block">
            Total Sales Amount (மொத்த விற்பனை)
          </span>
          <div className="font-mono font-black text-xl sm:text-2xl text-indigo-600 mt-1">
            ₹{overallMetrics.totalSales.toLocaleString()}
          </div>
        </div>

      </div>

      {/* FILTER CONTROLS PANEL */}
      <div className="glass-panel p-4 sm:p-5 rounded-3xl bg-white border-2 border-sky-200 space-y-3.5 shadow-sm">
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-sky-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search User, Shop, Bill #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm font-black bg-sky-50/50 border-2 border-sky-200 rounded-2xl focus:outline-none focus:border-sky-600 focus:bg-white transition"
            />
          </div>

          {/* Quick Date Range Pills */}
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
              <Calendar className="w-3.5 h-3.5" /> Custom
            </button>
          </div>

          {/* User / Seller Dropdown Filter */}
          <div className="w-full sm:w-auto">
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full sm:w-64 p-2.5 font-black text-xs sm:text-sm bg-sky-50 border-2 border-sky-200 rounded-2xl focus:outline-none focus:border-sky-600 text-slate-800"
            >
              <option value="ALL">All Users & Drivers (அனைவரும்)</option>
              <option value="STORE">🏬 Store Keeper (Counter)</option>
              {availableUsers.filter(u => u.id !== 'STORE').map(u => (
                <option key={u.id} value={u.id}>🚚 {u.name} ({u.vehicle})</option>
              ))}
            </select>
          </div>

        </div>

        {/* Custom Date Range Picker */}
        {quickDate === 'CUSTOM' && (
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

        {/* Active Filters Clear Bar */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-sky-100 text-xs">
            <span className="text-slate-500 font-bold">
              Filters Active ({activeFiltersCount}): Showing results for selected period and user.
            </span>
            <button
              onClick={handleClearFilters}
              className="text-xs font-black text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear Filters
            </button>
          </div>
        )}

      </div>

      {/* MAIN USER BALANCE TABLE (DESKTOP) */}
      <div className="glass-panel rounded-3xl bg-white border-2 border-sky-200 overflow-hidden shadow-sm">
        
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-sky-200 font-black text-slate-800 bg-sky-50/90 uppercase tracking-wider text-xs">
                <th className="p-4 pl-5">User Name & Role</th>
                <th className="p-4 text-center">Bills Count</th>
                <th className="p-4 text-right">Total Sales (விற்பனை)</th>
                <th className="p-4 text-right">Received (வரவு / வசூல்)</th>
                <th className="p-4 text-right">Balance Given (பாக்கி / கடன்)</th>
                <th className="p-4 pr-5 text-center">Action Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100">
              {userSummaries.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center bg-sky-50/30">
                    <div className="max-w-sm mx-auto space-y-2">
                      <Wallet className="w-12 h-12 text-sky-300 mx-auto" />
                      <h4 className="font-black text-base text-slate-800">No User Records Found</h4>
                      <p className="text-xs text-slate-500">No transaction records match the selected filter criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                userSummaries.map(({ user, totalBills, totalSales, totalReceived, totalBalance, salesList }) => (
                  <tr key={user.id} className="hover:bg-sky-50/60 transition-colors">
                    <td className="p-4 pl-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-800 border border-sky-200 flex items-center justify-center font-bold text-base shrink-0 shadow-2xs">
                          {user.icon || '👤'}
                        </div>
                        <div>
                          <span className="font-black text-slate-900 text-sm sm:text-base block leading-tight">
                            {user.name}
                          </span>
                          <span className="text-[10px] text-sky-800 font-extrabold bg-sky-100 px-2 py-0.5 rounded-lg border border-sky-200 inline-block mt-0.5 font-mono">
                            {user.badge || user.role}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 text-center">
                      <span className="font-mono font-black text-sm sm:text-base text-slate-900 bg-sky-50 px-3 py-1 rounded-xl border border-sky-200 inline-block">
                        {totalBills} Bills
                      </span>
                    </td>

                    <td className="p-4 text-right font-mono font-black text-sm sm:text-base text-indigo-700">
                      ₹{totalSales.toLocaleString()}
                    </td>

                    <td className="p-4 text-right font-mono font-black text-sm sm:text-base text-emerald-700">
                      ₹{totalReceived.toLocaleString()}
                    </td>

                    <td className="p-4 text-right font-mono font-black text-sm sm:text-base text-rose-700">
                      ₹{totalBalance.toLocaleString()}
                    </td>

                    <td className="p-4 pr-5 text-center">
                      <button
                        onClick={() => setSelectedUserDetail({ user, totalBills, totalSales, totalReceived, totalBalance, salesList })}
                        className="px-3.5 py-1.5 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-900 font-black text-xs flex items-center gap-1.5 transition border border-sky-300 cursor-pointer shadow-2xs mx-auto"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Invoices
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS VIEW */}
        <div className="block md:hidden divide-y divide-sky-100">
          {userSummaries.length === 0 ? (
            <div className="p-8 text-center bg-sky-50/50 space-y-2">
              <span className="text-xl">🔍</span>
              <p className="font-bold text-xs text-slate-700">No Records Found</p>
            </div>
          ) : (
            userSummaries.map(({ user, totalBills, totalSales, totalReceived, totalBalance, salesList }) => (
              <div key={user.id} className="p-4 space-y-3 bg-white">
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-800 border border-sky-200 flex items-center justify-center font-bold text-sm shrink-0">
                      {user.icon || '👤'}
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-slate-900 leading-tight">{user.name}</h4>
                      <span className="text-[10px] text-sky-800 font-bold bg-sky-100 px-1.5 py-0.2 rounded border border-sky-200 font-mono">
                        {user.badge}
                      </span>
                    </div>
                  </div>

                  <span className="font-mono font-extrabold text-xs bg-sky-50 text-sky-900 px-2.5 py-1 rounded-lg border border-sky-200">
                    {totalBills} Bills
                  </span>
                </div>

                {/* Financial 3-Pill Breakdown */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono font-bold bg-sky-50/70 p-2.5 rounded-xl border border-sky-100">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-500 block">Sales</span>
                    <span className="font-black text-indigo-700">₹{totalSales.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-500 block">Varavu</span>
                    <span className="font-black text-emerald-700">₹{totalReceived.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-500 block">Paakki</span>
                    <span className="font-black text-rose-700">₹{totalBalance.toLocaleString()}</span>
                  </div>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    onClick={() => setSelectedUserDetail({ user, totalBills, totalSales, totalReceived, totalBalance, salesList })}
                    className="w-full py-2 rounded-xl bg-sky-100 text-sky-900 font-black text-xs border border-sky-300 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-4 h-4" /> View Detailed Invoices
                  </button>
                </div>

              </div>
            ))
          )}
        </div>

      </div>

      {/* USER DETAILED INVOICES DRILLDOWN MODAL */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 lg:p-6 overflow-y-auto">
          <div className="bg-gradient-to-b from-sky-50 via-white to-sky-50 border-2 border-sky-200 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 px-6 border-b-2 border-sky-200 bg-sky-900 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-xs font-bold text-lg">
                  {selectedUserDetail.user.icon}
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-white">
                    {selectedUserDetail.user.name}
                  </h3>
                  <span className="text-xs font-mono text-sky-200 font-bold">
                    {selectedUserDetail.user.badge} • {selectedUserDetail.totalBills} Bills in Selected Period
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedUserDetail(null)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-sky-100 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Top Stat Pills */}
            <div className="p-4 bg-sky-100/60 border-b border-sky-200 grid grid-cols-3 gap-3 text-center text-xs font-mono">
              <div className="bg-white p-2.5 rounded-xl border border-sky-200">
                <span className="text-[10px] font-black uppercase text-slate-500 block">Total Sales</span>
                <span className="font-black text-indigo-700 text-base">₹{selectedUserDetail.totalSales.toLocaleString()}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-sky-200">
                <span className="text-[10px] font-black uppercase text-slate-500 block">Total Received</span>
                <span className="font-black text-emerald-700 text-base">₹{selectedUserDetail.totalReceived.toLocaleString()}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-sky-200">
                <span className="text-[10px] font-black uppercase text-slate-500 block">Total Balance</span>
                <span className="font-black text-rose-700 text-base">₹{selectedUserDetail.totalBalance.toLocaleString()}</span>
              </div>
            </div>

            {/* Invoices List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {selectedUserDetail.salesList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 font-bold text-xs">
                  No invoices recorded for this user in the selected period.
                </div>
              ) : (
                selectedUserDetail.salesList.map((sale, idx) => {
                  const billDate = formatDMY(sale.date || sale.sale_date || sale.created_at) || 'Today';
                  return (
                    <div key={sale.bill_no || idx} className="bg-white p-3.5 rounded-2xl border-2 border-sky-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-sky-800">#{sale.bill_no}</span>
                          <span className="text-xs font-mono font-bold text-slate-500">
                            <Calendar className="w-3 h-3 inline mr-0.5 text-sky-500" /> {billDate} {sale.time}
                          </span>
                        </div>
                        <span className="font-black text-slate-900 text-sm block mt-0.5">
                          {sale.shop_name || sale.customer_name || 'Counter Customer'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono self-end sm:self-auto">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-sans">Varavu:</span>
                          <span className="font-black text-emerald-700">₹{sale.financials.received.toLocaleString()}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-sans">Paakki:</span>
                          <span className="font-black text-rose-700">₹{sale.financials.balance.toLocaleString()}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-sans">Total:</span>
                          <span className="font-black text-slate-900 text-sm">₹{sale.financials.total.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 px-6 bg-sky-50 border-t border-sky-200 flex justify-end">
              <button
                onClick={() => setSelectedUserDetail(null)}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-black text-xs cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Print Thermal Modal */}
      {selectedBillToPrint && (
        <ThermalBillModal
          sale={selectedBillToPrint}
          onClose={() => setSelectedBillToPrint(null)}
        />
      )}

    </div>
  );
};
