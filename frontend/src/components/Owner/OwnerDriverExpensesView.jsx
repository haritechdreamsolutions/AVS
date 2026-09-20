import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  DollarSign, Users, Receipt, TrendingUp, Search, 
  Calendar, RefreshCw, Filter, Download, Fuel, 
  Utensils, CreditCard, Wrench, ShieldAlert, HelpCircle, 
  ChevronRight, Truck, MapPin, User, Clock, FileText, X
} from 'lucide-react';
import { toast } from 'sonner';
import { generateDriverExpensesPDFReport } from '../../utils/pdfReportGenerator';

export const OwnerDriverExpensesView = () => {
  const { fetchExpenses, drivers = [], routes = [], companyInfo } = useApp();

  const [loading, setLoading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  const [selectedPeriod, setSelectedPeriod] = useState('ALL'); // 'TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'ALL', 'CUSTOM'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedRoute, setSelectedRoute] = useState('ALL');

  // Calculate Date bounds for presets
  const getDateRangeForPeriod = (period) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    if (period === 'TODAY') {
      return { date: todayStr };
    }
    if (period === 'YESTERDAY') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return { date: yesterday.toISOString().split('T')[0] };
    }
    if (period === 'THIS_WEEK') {
      const startOfWeek = new Date(now);
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      startOfWeek.setDate(diff);
      return {
        start_date: startOfWeek.toISOString().split('T')[0],
        end_date: todayStr
      };
    }
    if (period === 'THIS_MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start_date: startOfMonth.toISOString().split('T')[0],
        end_date: todayStr
      };
    }
    if (period === 'CUSTOM' && customStartDate) {
      return {
        start_date: customStartDate,
        end_date: customEndDate || customStartDate
      };
    }
    return {}; // ALL
  };

  const loadExpensesData = async () => {
    setLoading(true);
    try {
      const dateFilters = getDateRangeForPeriod(selectedPeriod);
      const filterParams = {
        ...dateFilters,
        driver_id: selectedDriverId !== 'ALL' ? selectedDriverId : undefined,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined
      };
      const data = await fetchExpenses(filterParams);
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching driver expenses:', err);
      toast.error('Failed to load driver expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpensesData();
  }, [selectedPeriod, customStartDate, customEndDate, selectedDriverId, selectedCategory]);

  // Client-side query search and route filtering
  const filteredExpenses = useMemo(() => {
    return expenses.filter(item => {
      if (selectedDriverId !== 'ALL') {
        const empId = String(item.employee_id || item.driver_id || '');
        if (empId !== String(selectedDriverId)) return false;
      }
      if (selectedCategory !== 'ALL') {
        if ((item.category || '').toUpperCase() !== selectedCategory.toUpperCase()) return false;
      }
      if (selectedRoute !== 'ALL') {
        if ((item.route_name || '').toLowerCase() !== selectedRoute.toLowerCase()) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const dName = (item.driver_name || item.employee_name || '').toLowerCase();
        const code = (item.employee_code || '').toLowerCase();
        const vNum = (item.vehicle_number || '').toLowerCase();
        const rName = (item.route_name || '').toLowerCase();
        const desc = (item.title || item.notes || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        const session = String(item.session_id || '').toLowerCase();
        if (!dName.includes(q) && !code.includes(q) && !vNum.includes(q) && !rName.includes(q) && !desc.includes(q) && !cat.includes(q) && !session.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [expenses, selectedDriverId, selectedCategory, selectedRoute, searchQuery]);

  // Driver-wise aggregation
  const driverSummaryList = useMemo(() => {
    const map = new Map();
    filteredExpenses.forEach(exp => {
      const id = String(exp.employee_id || exp.driver_id || '0');
      const name = exp.driver_name || exp.employee_name || 'Driver';
      const code = exp.employee_code || 'EMP';
      const vehicle = exp.vehicle_number || 'N/A';
      const current = map.get(id) || { id, name, code, vehicle, total: 0, count: 0 };
      current.total += Number(exp.amount || 0);
      current.count += 1;
      map.set(id, current);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredExpenses]);

  // Overall KPI metrics
  const totalExpenseAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [filteredExpenses]);

  const uniqueDriversCount = useMemo(() => {
    const ids = new Set(filteredExpenses.map(e => String(e.employee_id || e.driver_id || '0')));
    return ids.size;
  }, [filteredExpenses]);

  const totalTransactionsCount = filteredExpenses.length;

  const averageExpensePerDriver = useMemo(() => {
    if (uniqueDriversCount === 0) return 0;
    return Math.round(totalExpenseAmount / uniqueDriversCount);
  }, [totalExpenseAmount, uniqueDriversCount]);

  const getCategoryBadge = (cat) => {
    const c = (cat || 'General').toLowerCase();
    if (c.includes('fuel') || c.includes('diesel')) {
      return (
        <span className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-amber-500/10 text-amber-700 border border-amber-300 flex items-center gap-1.5">
          <Fuel className="w-3.5 h-3.5 text-amber-600" /> Fuel
        </span>
      );
    }
    if (c.includes('food') || c.includes('tea') || c.includes('lunch')) {
      return (
        <span className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-500/10 text-emerald-700 border border-emerald-300 flex items-center gap-1.5">
          <Utensils className="w-3.5 h-3.5 text-emerald-600" /> Food / Meals
        </span>
      );
    }
    if (c.includes('toll')) {
      return (
        <span className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-blue-500/10 text-blue-700 border border-blue-300 flex items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Toll
        </span>
      );
    }
    if (c.includes('maint') || c.includes('repair') || c.includes('puncture')) {
      return (
        <span className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-indigo-500/10 text-indigo-700 border border-indigo-300 flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-indigo-600" /> Maintenance
        </span>
      );
    }
    if (c.includes('fine') || c.includes('police')) {
      return (
        <span className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-rose-500/10 text-rose-700 border border-rose-300 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Fine / Police
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-purple-500/10 text-purple-700 border border-purple-300 flex items-center gap-1.5">
        <HelpCircle className="w-3.5 h-3.5 text-purple-600" /> {cat || 'Other'}
      </span>
    );
  };

  const handleDownloadPDFReport = async () => {
    if (filteredExpenses.length === 0) {
      toast.error('No expense records to generate PDF');
      return;
    }
    setIsGeneratingPDF(true);
    try {
      toast.info('Generating Driver Expenses PDF...');
      const selectedDriverObj = drivers.find(d => String(d.id || d.employee_id) === String(selectedDriverId));
      const driverName = selectedDriverId === 'ALL' ? 'All Drivers' : (selectedDriverObj?.full_name || selectedDriverObj?.name || 'Selected Driver');
      
      const filename = await generateDriverExpensesPDFReport({
        expenses: filteredExpenses,
        period: selectedPeriod,
        dateRangeText: selectedPeriod === 'CUSTOM' ? `${customStartDate} to ${customEndDate}` : selectedPeriod.replace(/_/g, ' '),
        selectedDriverName: driverName,
        companyInfo: companyInfo || {}
      });
      toast.success(`PDF report downloaded: ${filename}`);
    } catch (err) {
      console.error('Error generating driver expenses PDF:', err);
      toast.error('Unable to generate PDF report. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-[clamp(1.35rem,2.2vw,1.85rem)] text-slate-900 tracking-tight leading-tight">Driver Expenses Tracking</h1>
              <p className="text-[clamp(0.85rem,1.1vw,0.95rem)] text-slate-500 font-medium mt-0.5">Real-time driver trip expenses, fuel, toll & maintenance breakdown</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadExpensesData}
            disabled={loading}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[0.88rem] font-bold flex items-center gap-1.5 transition cursor-pointer min-h-[42px]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleDownloadPDFReport}
            disabled={isGeneratingPDF}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[0.92rem] font-bold flex items-center gap-2 shadow-xs transition cursor-pointer min-h-[42px] disabled:opacity-75"
          >
            <Download className={`w-4 h-4 ${isGeneratingPDF ? 'animate-bounce' : ''}`} />
            {isGeneratingPDF ? 'Generating PDF...' : 'Download PDF Report'}
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="glass-card p-4 md:p-5 rounded-2xl bg-white border-l-4 border-l-emerald-500 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[0.85rem] text-slate-600 font-extrabold uppercase tracking-tight">
            <span>Total Expenses</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="font-mono font-black text-[clamp(1.4rem,2vw,1.7rem)] text-slate-900 mt-2">
            ₹{totalExpenseAmount.toLocaleString()}
          </div>
          <span className="text-[0.82rem] text-slate-400 font-medium mt-1">Total driver spend recorded</span>
        </div>

        <div className="glass-card p-4 md:p-5 rounded-2xl bg-white border-l-4 border-l-blue-500 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[0.85rem] text-slate-600 font-extrabold uppercase tracking-tight">
            <span>Total Drivers</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="font-mono font-black text-[clamp(1.4rem,2vw,1.7rem)] text-blue-600 mt-2">
            {uniqueDriversCount}
          </div>
          <span className="text-[0.82rem] text-slate-400 font-medium mt-1">Drivers with expense claims</span>
        </div>

        <div className="glass-card p-4 md:p-5 rounded-2xl bg-white border-l-4 border-l-indigo-500 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[0.85rem] text-slate-600 font-extrabold uppercase tracking-tight">
            <span>Total Transactions</span>
            <Receipt className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="font-mono font-black text-[clamp(1.4rem,2vw,1.7rem)] text-indigo-600 mt-2">
            {totalTransactionsCount}
          </div>
          <span className="text-[0.82rem] text-slate-400 font-medium mt-1">Total expense vouchers</span>
        </div>

        <div className="glass-card p-4 md:p-5 rounded-2xl bg-white border-l-4 border-l-amber-500 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[0.85rem] text-slate-600 font-extrabold uppercase tracking-tight">
            <span>Avg Per Driver</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="font-mono font-black text-[clamp(1.4rem,2vw,1.7rem)] text-amber-600 mt-2">
            ₹{averageExpensePerDriver.toLocaleString()}
          </div>
          <span className="text-[0.82rem] text-slate-400 font-medium mt-1">Average claim per driver</span>
        </div>
      </div>

      {/* Date & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Date Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[0.82rem] font-extrabold uppercase text-slate-400 mr-2 shrink-0">Period:</span>
          {[
            { id: 'ALL', label: 'All Time' },
            { id: 'TODAY', label: 'Today' },
            { id: 'YESTERDAY', label: 'Yesterday' },
            { id: 'THIS_WEEK', label: 'This Week' },
            { id: 'THIS_MONTH', label: 'This Month' },
            { id: 'CUSTOM', label: 'Custom Date' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPeriod(p.id)}
              className={`px-3.5 py-1.5 rounded-xl text-[0.88rem] font-bold whitespace-nowrap transition cursor-pointer ${
                selectedPeriod === p.id 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Pickers */}
        {selectedPeriod === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-[0.85rem]">
              <span className="text-slate-500 font-bold">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-[0.88rem] font-medium focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-1.5 text-[0.85rem]">
              <span className="text-slate-500 font-bold">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-[0.88rem] font-medium focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        )}

        {/* Search and Secondary Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search driver, vehicle, note..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-[0.88rem] rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
            />
          </div>

          {/* Driver Filter */}
          <select
            value={selectedDriverId}
            onChange={e => setSelectedDriverId(e.target.value)}
            className="w-full px-3 py-2 text-[0.88rem] rounded-xl border border-slate-300 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
          >
            <option value="ALL">All Drivers ({drivers.length})</option>
            {drivers.map(d => (
              <option key={d.id || d.employee_id} value={d.id || d.employee_id}>
                {d.full_name || d.name} ({d.employee_code || 'EMP'})
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 text-[0.88rem] rounded-xl border border-slate-300 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
          >
            <option value="ALL">All Categories</option>
            <option value="Fuel">Fuel / Diesel</option>
            <option value="Food">Food / Meals</option>
            <option value="Toll">Toll</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Fine">Fine / Police</option>
            <option value="General">General / Other</option>
          </select>

          {/* Route Filter */}
          <select
            value={selectedRoute}
            onChange={e => setSelectedRoute(e.target.value)}
            className="w-full px-3 py-2 text-[0.88rem] rounded-xl border border-slate-300 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
          >
            <option value="ALL">All Routes ({routes.length})</option>
            {routes.map(r => (
              <option key={r.id} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Driver-Wise Summary Dimension */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <h3 className="font-extrabold text-[0.92rem] uppercase tracking-wider text-slate-800">
              Driver-Wise Expense Summary ({driverSummaryList.length} Active Drivers)
            </h3>
          </div>
          {selectedDriverId !== 'ALL' && (
            <button
              onClick={() => setSelectedDriverId('ALL')}
              className="text-[0.85rem] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Show All Drivers
            </button>
          )}
        </div>

        {driverSummaryList.length === 0 ? (
          <p className="text-[0.88rem] text-slate-400 italic py-2">No driver expenses found for this filter period.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {driverSummaryList.map(driver => {
              const isSelected = String(selectedDriverId) === String(driver.id);
              return (
                <div
                  key={driver.id}
                  onClick={() => setSelectedDriverId(isSelected ? 'ALL' : driver.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                    isSelected 
                      ? 'bg-emerald-50 border-emerald-500 shadow-xs ring-2 ring-emerald-400/30' 
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80 hover:border-slate-300'
                  }`}
                >
                  <div className="truncate mr-2">
                    <h4 className="font-extrabold text-[0.92rem] text-slate-900 truncate">{driver.name}</h4>
                    <p className="text-[0.8rem] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                      <span>{driver.code}</span>
                      <span>•</span>
                      <span>{driver.count} vouchers</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-black text-[1rem] text-emerald-700 block">
                      ₹{driver.total.toLocaleString()}
                    </span>
                    <span className="text-[0.75rem] font-bold text-slate-400 uppercase">Total</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Granular Expense Transactions Table / Responsive Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            <h3 className="font-extrabold text-[0.92rem] uppercase tracking-wider text-slate-800">
              Detailed Expense Records ({filteredExpenses.length} Records)
            </h3>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="text-center py-12 px-4">
            <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-2 opacity-60" />
            <p className="text-[0.95rem] font-bold text-slate-600">No Expense Records Found</p>
            <p className="text-[0.85rem] text-slate-400 mt-1">Adjust your filters or record an expense during driver return settlement.</p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-[0.88rem] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold text-[0.82rem] uppercase tracking-wider">
                    <th className="p-3.5">Driver & Vehicle</th>
                    <th className="p-3.5">Route</th>
                    <th className="p-3.5">Expense Type</th>
                    <th className="p-3.5">Description</th>
                    <th className="p-3.5 text-right">Amount</th>
                    <th className="p-3.5">Recorded By</th>
                    <th className="p-3.5">Date & Time</th>
                    <th className="p-3.5 text-center">Session ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 text-[0.92rem]">{exp.driver_name || exp.employee_name || 'Driver'}</div>
                        <div className="text-[0.8rem] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                          <span>{exp.employee_code || 'EMP'}</span>
                          <span>•</span>
                          <span className="font-mono font-bold text-slate-700">{exp.vehicle_number || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{exp.route_name || 'Direct'}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        {getCategoryBadge(exp.category)}
                      </td>
                      <td className="p-3.5">
                        <div className="font-medium text-slate-800 max-w-[220px] truncate" title={exp.title || exp.notes}>
                          {exp.title || exp.notes || '—'}
                        </div>
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-[1rem] text-emerald-700">
                        ₹{Number(exp.amount || 0).toLocaleString()}
                      </td>
                      <td className="p-3.5">
                        <span className="text-[0.82rem] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                          {exp.recorded_by_name || 'Storekeeper'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-700">
                          {exp.expense_date ? new Date(exp.expense_date).toISOString().split('T')[0] : (exp.created_at ? new Date(exp.created_at).toISOString().split('T')[0] : 'Today')}
                        </div>
                        <div className="text-[0.8rem] text-slate-400">
                          {exp.created_at ? new Date(exp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="font-mono text-[0.8rem] font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {exp.session_id ? `SESSION-${exp.session_id}` : 'DIRECT'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (< 768px) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredExpenses.map((exp) => (
                <div key={exp.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-[0.95rem] text-slate-900">{exp.driver_name || exp.employee_name || 'Driver'}</h4>
                      <p className="text-[0.82rem] text-slate-500 font-medium">
                        {exp.employee_code || 'EMP'} • {exp.vehicle_number || 'N/A'} • {exp.route_name || 'Direct'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-black text-[1.1rem] text-emerald-700">
                        ₹{Number(exp.amount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap text-[0.85rem]">
                    <div>{getCategoryBadge(exp.category)}</div>
                    <span className="text-[0.8rem] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded-md text-slate-600 border border-slate-200">
                      {exp.session_id ? `SESSION-${exp.session_id}` : 'DIRECT'}
                    </span>
                  </div>

                  {(exp.title || exp.notes) && (
                    <p className="text-[0.88rem] text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      {exp.title || exp.notes}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[0.82rem] text-slate-400 pt-1 border-t border-slate-50">
                    <span>Recorded by: <b className="text-slate-600">{exp.recorded_by_name || 'Storekeeper'}</b></span>
                    <span>{exp.expense_date ? new Date(exp.expense_date).toISOString().split('T')[0] : (exp.created_at ? new Date(exp.created_at).toISOString().split('T')[0] : 'Today')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
