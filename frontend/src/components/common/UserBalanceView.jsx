import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Search, Calendar, RotateCcw, AlertTriangle
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
  const { sales = [], employees = [] } = useApp();

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [quickDate, setQuickDate] = useState('ALL'); // ALL, TODAY, YESTERDAY, THIS_WEEK, THIS_MONTH, CUSTOM
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [userFilter, setUserFilter] = useState('ALL'); // 'ALL', 'STORE', or employee_id string

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
      icon: '🏬'
    });

    (employees || []).forEach(emp => {
      map.set(String(emp.id), {
        id: String(emp.id),
        name: emp.full_name || `Driver #${emp.id}`,
        icon: '🚚'
      });
    });

    (sales || []).forEach(s => {
      if (s.employee_id && !map.has(String(s.employee_id)) && !s.is_store_direct_sale) {
        map.set(String(s.employee_id), {
          id: String(s.employee_id),
          name: s.employee_name || `Driver #${s.employee_id}`,
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

  // Aggregate stats per user for the filtered period
  const userSummaries = useMemo(() => {
    const summaryMap = new Map();

    availableUsers.forEach(u => {
      summaryMap.set(u.id, {
        user: u,
        totalSales: 0,
        totalReceived: 0,
        totalBalance: 0,
        oldCreditCollected: 0
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
            icon: '🚚'
          },
          totalSales: 0,
          totalReceived: 0,
          totalBalance: 0,
          oldCreditCollected: 0
        });
      }

      const entry = summaryMap.get(key);
      const fin = getSaleFinancials(sale);

      entry.totalSales += fin.total;
      entry.totalReceived += fin.received;
      entry.totalBalance += fin.balance;
      entry.oldCreditCollected += fin.oldCreditPaid;
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
  }, [availableUsers, filteredSales, userFilter]);

  // Overall Aggregated Totals
  const overallMetrics = useMemo(() => {
    let salesAmt = 0;
    let receivedAmt = 0;
    let balanceAmt = 0;
    let oldCreditAmt = 0;

    userSummaries.forEach(u => {
      salesAmt += u.totalSales;
      receivedAmt += u.totalReceived;
      balanceAmt += u.totalBalance;
      oldCreditAmt += u.oldCreditCollected;
    });

    return {
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
    <div className="space-y-4 sm:space-y-5 pb-8 bg-sky-50/50 p-2 sm:p-4 rounded-3xl">
      
      {/* TOP 4 FINANCIAL KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        
        {/* Card 1: Total Sales */}
        <div className="glass-card p-3.5 sm:p-5 rounded-2xl bg-white border-l-4 sm:border-l-6 border-indigo-600 border border-sky-200 shadow-sm">
          <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-tight block">
            TOTAL SALES (விற்பனை)
          </span>
          <div className="font-mono font-black text-lg sm:text-2xl lg:text-3xl text-indigo-700 mt-1 sm:mt-2">
            ₹{overallMetrics.totalSales.toLocaleString()}
          </div>
        </div>

        {/* Card 2: Old Credit Collected */}
        <div className="glass-card p-3.5 sm:p-5 rounded-2xl bg-white border-l-4 sm:border-l-6 border-amber-500 border border-sky-200 shadow-sm">
          <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-tight block">
            OLD CREDIT (பழைய கடன் வசூல்)
          </span>
          <div className="font-mono font-black text-lg sm:text-2xl lg:text-3xl text-amber-700 mt-1 sm:mt-2">
            ₹{overallMetrics.oldCreditCollected.toLocaleString()}
          </div>
        </div>

        {/* Card 3: Total Received */}
        <div className="glass-card p-3.5 sm:p-5 rounded-2xl bg-white border-l-4 sm:border-l-6 border-emerald-600 border border-sky-200 shadow-sm">
          <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-tight block">
            TOTAL RECEIVED (மொத்த வரவு)
          </span>
          <div className="font-mono font-black text-lg sm:text-2xl lg:text-3xl text-emerald-600 mt-1 sm:mt-2">
            ₹{overallMetrics.totalReceived.toLocaleString()}
          </div>
        </div>

        {/* Card 4: Balance / Credit Given */}
        <div className="glass-card p-3.5 sm:p-5 rounded-2xl bg-white border-l-4 sm:border-l-6 border-rose-600 border border-sky-200 shadow-sm">
          <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-tight block">
            BALANCE (மொத்த பாக்கி)
          </span>
          <div className="font-mono font-black text-lg sm:text-2xl lg:text-3xl text-rose-600 mt-1 sm:mt-2">
            ₹{overallMetrics.totalBalance.toLocaleString()}
          </div>
        </div>

      </div>

      {/* FILTER CONTROLS PANEL (English Only) */}
      <div className="glass-panel p-3.5 sm:p-5 rounded-3xl bg-white border-2 border-sky-200 space-y-3.5 shadow-sm">
        
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* English Search Bar */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-sky-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search User, Shop, Bill #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm font-black bg-sky-50/70 border-2 border-sky-200 rounded-2xl focus:outline-none focus:border-sky-600 focus:bg-white transition text-slate-900"
            />
          </div>

          {/* Quick Date Range Pills with Smooth Scroll */}
          <div className="flex items-center gap-1.5 bg-sky-100/80 p-1.5 rounded-2xl border border-sky-200 text-xs sm:text-sm overflow-x-auto max-w-full">
            <button
              onClick={() => handleQuickDateSelect('ALL')}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-black transition whitespace-nowrap cursor-pointer ${
                quickDate === 'ALL' ? 'bg-white text-sky-950 shadow-xs border border-sky-200' : 'text-sky-800 hover:text-slate-900'
              }`}
            >
              All Dates
            </button>
            <button
              onClick={() => handleQuickDateSelect('TODAY')}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-black transition whitespace-nowrap cursor-pointer ${
                quickDate === 'TODAY' ? 'bg-sky-600 text-white shadow-xs' : 'text-sky-800 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handleQuickDateSelect('YESTERDAY')}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-black transition whitespace-nowrap cursor-pointer ${
                quickDate === 'YESTERDAY' ? 'bg-sky-600 text-white shadow-xs' : 'text-sky-800 hover:text-slate-900'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => handleQuickDateSelect('THIS_WEEK')}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-black transition whitespace-nowrap cursor-pointer ${
                quickDate === 'THIS_WEEK' ? 'bg-sky-600 text-white shadow-xs' : 'text-sky-800 hover:text-slate-900'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => handleQuickDateSelect('THIS_MONTH')}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-black transition whitespace-nowrap cursor-pointer ${
                quickDate === 'THIS_MONTH' ? 'bg-sky-600 text-white shadow-xs' : 'text-sky-800 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => handleQuickDateSelect('CUSTOM')}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-black transition whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                quickDate === 'CUSTOM' ? 'bg-sky-600 text-white shadow-xs' : 'text-sky-800 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Custom
            </button>
          </div>

          {/* User Filter Dropdown */}
          <div className="w-full lg:w-auto">
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full lg:w-64 p-2.5 sm:p-3 font-black text-xs sm:text-sm bg-sky-50 border-2 border-sky-200 rounded-2xl focus:outline-none focus:border-sky-600 text-slate-800 cursor-pointer"
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
              <tr className="border-b-2 border-sky-200 font-black text-slate-900 bg-sky-100/90 uppercase tracking-wider text-xs sm:text-sm">
                <th className="p-4 pl-6">User Name (பயனாளர் பெயர்)</th>
                <th className="p-4 text-right">Total Sales (விற்பனை)</th>
                <th className="p-4 text-right">Old Credit (பழைய கடன் வசூல்)</th>
                <th className="p-4 text-right">Total Received (மொத்த வரவு)</th>
                <th className="p-4 pr-6 text-right">Balance Given (பாக்கி / கடன்)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100">
              {userSummaries.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-10 text-center bg-sky-50/40">
                    <p className="font-black text-sm sm:text-base text-slate-700">No User Records Found</p>
                  </td>
                </tr>
              ) : (
                userSummaries.map(({ user, totalSales, totalReceived, totalBalance, oldCreditCollected }) => (
                  <tr key={user.id} className="hover:bg-sky-50/70 transition-colors">
                    
                    {/* User Name Only (Role Removed) */}
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-900 border border-sky-200 flex items-center justify-center font-bold text-base shrink-0">
                          {user.icon || '👤'}
                        </div>
                        <span className="font-black text-slate-900 text-sm sm:text-base block">
                          {user.name}
                        </span>
                      </div>
                    </td>

                    {/* Total Sales */}
                    <td className="p-4 text-right font-mono font-black text-base sm:text-lg text-indigo-700">
                      ₹{totalSales.toLocaleString()}
                    </td>

                    {/* Old Credit Collected */}
                    <td className="p-4 text-right font-mono font-black text-base sm:text-lg text-amber-700">
                      ₹{oldCreditCollected.toLocaleString()}
                    </td>

                    {/* Total Received */}
                    <td className="p-4 text-right font-mono font-black text-base sm:text-lg text-emerald-700">
                      ₹{totalReceived.toLocaleString()}
                    </td>

                    {/* Balance Given */}
                    <td className="p-4 pr-6 text-right font-mono font-black text-base sm:text-lg text-rose-700">
                      ₹{totalBalance.toLocaleString()}
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
            <div className="p-6 text-center bg-sky-50/50">
              <p className="font-black text-xs text-slate-700">No Records Found</p>
            </div>
          ) : (
            userSummaries.map(({ user, totalSales, totalReceived, totalBalance, oldCreditCollected }) => (
              <div key={user.id} className="p-3.5 space-y-2.5 bg-white">
                
                {/* Username Only */}
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-900 border border-sky-200 flex items-center justify-center font-bold text-sm shrink-0">
                    {user.icon || '👤'}
                  </div>
                  <h4 className="font-black text-sm text-slate-900 leading-tight">{user.name}</h4>
                </div>

                {/* 4-Grid Financial Breakdown */}
                <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono font-bold bg-sky-50/80 p-2.5 rounded-2xl border border-sky-200">
                  <div className="bg-white p-2 rounded-xl border border-sky-100">
                    <span className="text-[10px] font-black uppercase text-slate-500 block">Sales (விற்பனை)</span>
                    <span className="font-black text-indigo-700 text-sm">₹{totalSales.toLocaleString()}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-sky-100">
                    <span className="text-[10px] font-black uppercase text-slate-500 block">Old Credit (பழைய வரவு)</span>
                    <span className="font-black text-amber-700 text-sm">₹{oldCreditCollected.toLocaleString()}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-sky-100">
                    <span className="text-[10px] font-black uppercase text-slate-500 block">Varavu (வரவு)</span>
                    <span className="font-black text-emerald-700 text-sm">₹{totalReceived.toLocaleString()}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-sky-100">
                    <span className="text-[10px] font-black uppercase text-slate-500 block">Paakki (பாக்கி)</span>
                    <span className="font-black text-rose-700 text-sm">₹{totalBalance.toLocaleString()}</span>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>

      </div>

    </div>
  );
};

export default UserBalanceView;
