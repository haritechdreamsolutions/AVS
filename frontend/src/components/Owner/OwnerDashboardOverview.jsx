import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { AdminAnalyticsChart } from './AdminAnalyticsChart';
import { 
  TrendingUp, Printer, RefreshCw, Eye, ShoppingBag, 
  DollarSign, Smartphone, CreditCard, ArrowRightLeft, UserCheck, 
  Truck, Store, Snowflake, Sparkles, CheckCircle2, Clock, X, Download, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { generateOwnerExecutivePDFReport } from '../../utils/pdfReportGenerator';

export const OwnerDashboardOverview = ({ onNavigateTab }) => {
  const { 
    summary, sales = [], refreshData, fetchExecutiveDashboard, 
    activeBill, setActiveBill, fetchExpenses, fetchDamages, 
    fetchMissingStockReport, companyInfo 
  } = useApp();
  const [selectedSaleForDetails, setSelectedSaleForDetails] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [filterSellerType, setFilterSellerType] = useState('ALL'); // ALL, STORE, DRIVER
  const [selectedPeriod, setSelectedPeriod] = useState('TODAY'); // TODAY, YESTERDAY, THIS_WEEK, THIS_MONTH
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const loadExecutiveDashboard = async (period = selectedPeriod) => {
    if (!fetchExecutiveDashboard) return;
    try {
      setLoadingDashboard(true);
      const data = await fetchExecutiveDashboard({ period });
      if (data) {
        setDashboardData(data);
      }
    } catch (err) {
      console.error("Error loading executive dashboard data:", err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    loadExecutiveDashboard(selectedPeriod);
  }, [selectedPeriod]);

  // Auto-refresh background polling every 5 seconds to sync live sales instantly
  useEffect(() => {
    const interval = setInterval(() => {
      if (refreshData) refreshData();
      loadExecutiveDashboard(selectedPeriod);
    }, 5000);

    return () => clearInterval(interval);
  }, [refreshData, selectedPeriod]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    if (refreshData) await refreshData();
    await loadExecutiveDashboard(selectedPeriod);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleDownloadPDFReport = async () => {
    if (isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    try {
      toast.info('Generating Executive PDF Report...');

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      let dateFilters = {};
      if (selectedPeriod === 'TODAY') {
        dateFilters = { date: todayStr };
      } else if (selectedPeriod === 'YESTERDAY') {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        dateFilters = { date: yesterday.toISOString().split('T')[0] };
      } else if (selectedPeriod === 'THIS_WEEK') {
        const startOfWeek = new Date(now);
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        dateFilters = { start_date: startOfWeek.toISOString().split('T')[0], end_date: todayStr };
      } else if (selectedPeriod === 'THIS_MONTH') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilters = { start_date: startOfMonth.toISOString().split('T')[0], end_date: todayStr };
      }

      const [expData, dmgData, missData] = await Promise.all([
        typeof fetchExpenses === 'function' ? fetchExpenses(dateFilters) : [],
        typeof fetchDamages === 'function' ? fetchDamages(dateFilters) : [],
        typeof fetchMissingStockReport === 'function' ? fetchMissingStockReport(dateFilters) : { records: [] }
      ]);

      const filename = await generateOwnerExecutivePDFReport({
        period: selectedPeriod,
        dateRangeText: selectedPeriod.replace('_', ' '),
        kpis,
        dashboardData,
        expenses: Array.isArray(expData) ? expData : [],
        damages: Array.isArray(dmgData) ? dmgData : [],
        missingRecords: Array.isArray(missData?.records) ? missData.records : (Array.isArray(missData) ? missData : []),
        recentSales: sales || [],
        companyInfo: companyInfo || {}
      });

      toast.success(`PDF report downloaded: ${filename}`);
    } catch (err) {
      console.error('Error generating PDF report:', err);
      toast.error('Unable to generate PDF report. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // KPI figures from backend executive API or fallback to context summary
  const kpis = dashboardData?.kpis || {
    gross_sales: summary?.todaySales || 0,
    cash_collected: summary?.cashCollection || 0,
    gpay_collected: summary?.gpayCollection || 0,
    credit_issued: summary?.creditSales || 0,
    expenses: summary?.totalExpenses || 0,
    damage_loss: summary?.damageCost || 0,
    cogs: 0,
    net_profit: 0,
    profit_margin_pct: 0,
    cost_data_incomplete: false
  };

  // Filter last 6 live sales for ticker
  const recentLiveSales = useMemo(() => {
    return (sales || []).filter(sale => {
      if (!sale) return false;
      const isStore = sale.is_store_direct_sale || Number(sale.employee_id) === 6 || sale.role === 'STORE_KEEPER' || (sale.employee_name && sale.employee_name.toLowerCase().includes('store'));
      if (filterSellerType === 'STORE') return isStore;
      if (filterSellerType === 'DRIVER') return !isStore;
      return true;
    }).slice(0, 6);
  }, [sales, filterSellerType]);

  const renderPaymentBadge = (mode) => {
    const m = (mode || 'CASH').toUpperCase();
    if (m === 'CASH') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
          <DollarSign className="w-3 h-3 text-emerald-600" /> CASH
        </span>
      );
    }
    if (m === 'GPAY' || m === 'UPI') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
          <Smartphone className="w-3 h-3 text-blue-600" /> GPAY
        </span>
      );
    }
    if (m === 'CREDIT') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
          <CreditCard className="w-3 h-3 text-amber-600" /> CREDIT
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1">
        <ArrowRightLeft className="w-3 h-3 text-purple-600" /> SPLIT
      </span>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 pb-6">
      
      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white border border-slate-800 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[clamp(1.35rem,2.2vw,1.85rem)] font-black text-white tracking-tight leading-tight">
                  ADMIN EXECUTIVE DASHBOARD
                </h2>
                <span className="text-[0.75rem] bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Live Auto-Sync
                </span>
              </div>
              <p className="text-[clamp(0.85rem,1.1vw,0.95rem)] text-slate-300 font-medium mt-1 leading-relaxed">
                Real-time Financial, Driver Delivery & Store Counter Billing Engine
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
          {/* Period Selector Tabs */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-2xl border border-slate-700">
            {['TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH'].map(p => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-3.5 py-2 rounded-xl text-[0.88rem] font-black transition cursor-pointer ${
                  selectedPeriod === p 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {p.replace('_', ' ')}
              </button>
            ))}
          </div>

          <button
            onClick={handleManualRefresh}
            className={`p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white transition shrink-0 cursor-pointer ${isRefreshing ? 'animate-spin' : ''}`}
            title="Refresh Live Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleDownloadPDFReport}
            disabled={isGeneratingPDF}
            className="px-4 py-2.5 rounded-2xl bg-indigo-600/90 hover:bg-indigo-500 text-white font-extrabold text-[0.92rem] flex items-center gap-2 transition shadow-xs cursor-pointer min-h-[42px] disabled:opacity-75"
          >
            <Download className={`w-4 h-4 ${isGeneratingPDF ? 'animate-bounce' : ''}`} />
            {isGeneratingPDF ? 'Generating PDF...' : 'Download PDF Report'}
          </button>
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl bg-white border-l-4 border-l-emerald-500 border border-slate-200 shadow-xs hover:-translate-y-0.5 transition flex flex-col justify-center min-h-[100px]">
          <span className="text-[0.85rem] text-slate-500 font-extrabold uppercase tracking-wider block">
            {selectedPeriod.replace('_', ' ')} Sales
          </span>
          <div className="font-mono font-black text-[clamp(1.4rem,2vw,1.7rem)] text-slate-900 mt-1 leading-tight">
            ₹{Number(kpis.gross_sales || 0).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl bg-white border-l-4 border-l-blue-500 border border-slate-200 shadow-xs hover:-translate-y-0.5 transition flex flex-col justify-center min-h-[100px]">
          <span className="text-[0.85rem] text-slate-500 font-extrabold uppercase tracking-wider block">
            Cash Collection
          </span>
          <div className="font-mono font-black text-[clamp(1.4rem,2vw,1.7rem)] text-blue-600 mt-1 leading-tight">
            ₹{Number(kpis.cash_collected || 0).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl bg-white border-l-4 border-l-indigo-500 border border-slate-200 shadow-xs hover:-translate-y-0.5 transition flex flex-col justify-center min-h-[100px]">
          <span className="text-[0.85rem] text-slate-500 font-extrabold uppercase tracking-wider block">
            GPay Collection
          </span>
          <div className="font-mono font-black text-[clamp(1.4rem,2vw,1.7rem)] text-indigo-600 mt-1 leading-tight">
            ₹{Number(kpis.gpay_collected || 0).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl bg-white border-l-4 border-l-amber-500 border border-slate-200 shadow-xs hover:-translate-y-0.5 transition flex flex-col justify-center min-h-[100px]">
          <span className="text-[0.85rem] text-slate-500 font-extrabold uppercase tracking-wider block">
            Credit / Dues
          </span>
          <div className="font-mono font-black text-[clamp(1.4rem,2vw,1.7rem)] text-amber-600 mt-1 leading-tight">
            ₹{Number(kpis.credit_issued || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Real Operating Profit & Loss Summary Card (Phase 4) */}
      <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h3 className="font-black text-[clamp(1.05rem,1.3vw,1.25rem)] text-slate-900 tracking-tight">
              Executive Profit & Loss Statement ({selectedPeriod.replace('_', ' ')})
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {kpis.cost_data_incomplete && (
              <span className="text-[0.78rem] text-amber-800 font-bold bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                ⚠️ Cost Data Incomplete on Historical Items
              </span>
            )}
            <span className={`text-[0.85rem] font-extrabold px-3 py-1 rounded-full border ${
              kpis.net_profit >= 0 
                ? 'text-emerald-800 bg-emerald-100 border-emerald-300' 
                : 'text-rose-800 bg-rose-100 border-rose-300'
            }`}>
              {kpis.net_profit >= 0 ? `Net Margin: ${kpis.profit_margin_pct}% 📈` : `Deficit: ${kpis.profit_margin_pct}% 📉`}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 font-mono">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col justify-between h-full min-h-[90px]">
            <span className="text-slate-500 block font-extrabold text-[0.82rem] uppercase font-sans tracking-wide">Gross Sales</span>
            <span className="font-black text-[clamp(1.25rem,1.5vw,1.45rem)] text-slate-900 mt-1">₹{Number(kpis.gross_sales || 0).toLocaleString()}</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col justify-between h-full min-h-[90px]">
            <span className="text-slate-500 block font-extrabold text-[0.82rem] uppercase font-sans tracking-wide">COGS (Stock Cost)</span>
            <span className="font-black text-[clamp(1.25rem,1.5vw,1.45rem)] text-slate-800 mt-1">-₹{Number(kpis.cogs || 0).toLocaleString()}</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col justify-between h-full min-h-[90px]">
            <span className="text-slate-500 block font-extrabold text-[0.82rem] uppercase font-sans tracking-wide">Operating Expenses</span>
            <span className="font-black text-[clamp(1.25rem,1.5vw,1.45rem)] text-amber-600 mt-1">-₹{Number(kpis.expenses || 0).toLocaleString()}</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col justify-between h-full min-h-[90px]">
            <span className="text-slate-500 block font-extrabold text-[0.82rem] uppercase font-sans tracking-wide">Damage Loss</span>
            <span className="font-black text-[clamp(1.25rem,1.5vw,1.45rem)] text-rose-600 mt-1">-₹{Number(kpis.damage_loss || 0).toLocaleString()}</span>
          </div>

          <div className={`p-3.5 rounded-2xl border flex flex-col justify-between h-full min-h-[90px] ${
            kpis.net_profit >= 0 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <span className="block font-extrabold text-[0.82rem] uppercase font-sans tracking-wide">Net Operating Profit</span>
            <span className="font-black text-[clamp(1.3rem,1.6vw,1.55rem)] mt-1">₹{Number(kpis.net_profit || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Multi-Payment and Expense Breakdown Grid */}
      {dashboardData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          {/* Payment Modes */}
          <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-3.5 shadow-sm flex flex-col justify-between h-full">
            <h4 className="font-black text-[1.05rem] text-slate-900 uppercase tracking-wider flex items-center gap-2">
              💳 Payment Modes Breakdown
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col justify-between min-h-[72px]">
                <span className="text-[0.82rem] font-sans font-bold text-emerald-800 block">CASH</span>
                <span className="font-black text-[1.05rem] text-slate-900 mt-1">₹{Number(dashboardData.payment_modes?.cash || 0).toLocaleString()}</span>
              </div>
              <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 flex flex-col justify-between min-h-[72px]">
                <span className="text-[0.82rem] font-sans font-bold text-blue-800 block">GPAY</span>
                <span className="font-black text-[1.05rem] text-slate-900 mt-1">₹{Number(dashboardData.payment_modes?.gpay || 0).toLocaleString()}</span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col justify-between min-h-[72px]">
                <span className="text-[0.82rem] font-sans font-bold text-amber-800 block">CREDIT</span>
                <span className="font-black text-[1.05rem] text-slate-900 mt-1">₹{Number(dashboardData.payment_modes?.credit || 0).toLocaleString()}</span>
              </div>
              <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 flex flex-col justify-between min-h-[72px]">
                <span className="text-[0.82rem] font-sans font-bold text-purple-800 block">SPLIT BILLS</span>
                <span className="font-black text-[1.05rem] text-slate-900 mt-1">{dashboardData.payment_modes?.split_bills_count || 0} Bills</span>
              </div>
            </div>
          </div>

          {/* Expense Categories */}
          <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-3.5 shadow-sm flex flex-col justify-between h-full">
            <h4 className="font-black text-[1.05rem] text-slate-900 uppercase tracking-wider flex items-center gap-2">
              ⛽ Operating Expense Breakdown
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono">
              {Object.entries(dashboardData.expense_breakdown || {}).length === 0 ? (
                <div className="col-span-2 sm:col-span-3 text-center py-4 text-slate-400 font-sans text-xs">No expenses recorded for period.</div>
              ) : (
                Object.entries(dashboardData.expense_breakdown || {}).map(([cat, amt]) => (
                  <div key={cat} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between min-h-[72px]">
                    <span className="text-[0.82rem] font-sans font-bold text-slate-600 block uppercase">{cat}</span>
                    <span className="font-black text-[1.05rem] text-slate-900 mt-1">₹{Number(amt || 0).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Sales & Billing Feed Ticker Widget */}
      <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-black text-[clamp(1.15rem,1.4vw,1.3rem)] text-slate-900 flex items-center gap-2 tracking-tight">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              REAL-TIME BILLING FEED & RECENT INVOICES
            </h3>
            <p className="text-[0.88rem] text-slate-500 font-semibold mt-0.5">Live feed of bills generated by Store Keeper & Delivery Drivers</p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setFilterSellerType('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-[0.85rem] font-extrabold transition cursor-pointer ${filterSellerType === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All Bills ({sales.length})
            </button>
            <button
              onClick={() => setFilterSellerType('STORE')}
              className={`px-3.5 py-1.5 rounded-lg text-[0.85rem] font-extrabold transition cursor-pointer ${filterSellerType === 'STORE' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              🏬 Store Counter
            </button>
            <button
              onClick={() => setFilterSellerType('DRIVER')}
              className={`px-3.5 py-1.5 rounded-lg text-[0.85rem] font-extrabold transition cursor-pointer ${filterSellerType === 'DRIVER' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              🚚 Driver Route
            </button>
          </div>
        </div>

        {/* Live Sales Feed Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {recentLiveSales.map(sale => {
            const isStoreKeeper = sale.is_store_direct_sale || Number(sale.employee_id) === 6 || sale.role === 'STORE_KEEPER' || (sale.employee_name && sale.employee_name.toLowerCase().includes('store'));

            return (
              <div 
                key={sale.bill_no || sale.id} 
                className="bg-slate-50/90 hover:bg-white p-4 rounded-2xl border border-slate-200 hover:border-blue-300 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-[0.95rem] text-slate-900">{sale.bill_no}</span>
                    {renderPaymentBadge(sale.payment_mode)}
                  </div>

                  {/* Seller Badge */}
                  <div>
                    {isStoreKeeper ? (
                      <span className="px-2.5 py-0.5 bg-purple-100 text-purple-900 font-extrabold text-[0.78rem] rounded-md border border-purple-200 flex items-center gap-1 w-max">
                        <Store className="w-3.5 h-3.5 text-purple-700" /> 🏬 Store Keeper (Counter)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 font-extrabold text-[0.78rem] rounded-md border border-blue-200 flex items-center gap-1 w-max">
                        <Truck className="w-3.5 h-3.5 text-blue-700" /> 🚚 {sale.employee_name || 'Driver'}
                      </span>
                    )}
                  </div>

                  <div className="text-[0.88rem] text-slate-700 space-y-0.5">
                    <span className="font-bold text-slate-900 block truncate">
                      Customer: {sale.shop_name || sale.customer_name || 'Walk-in Customer'}
                    </span>
                    <span className="text-[0.8rem] text-slate-400 font-mono block">
                      Time: {sale.date} at {sale.time}
                    </span>
                  </div>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-slate-200/70 flex items-center justify-between">
                  <div className="font-mono font-black text-[1.15rem] text-slate-900">
                    ₹{Number(sale.total_amount || 0).toLocaleString()}
                  </div>

                  <button
                    onClick={() => setSelectedSaleForDetails(sale)}
                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-extrabold text-[0.85rem] border border-slate-200 shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600" /> Receipt
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Visual Analytics Chart */}
      <AdminAnalyticsChart data={dashboardData} />

      {/* Freezer Asset Shortcut Card */}
      <div
        onClick={() => onNavigateTab && onNavigateTab('freezer')}
        className="glass-panel p-4.5 rounded-3xl bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 flex items-center justify-between cursor-pointer hover:shadow-md transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-600 text-white flex items-center justify-center font-bold text-2xl shadow-md">
            🧊
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">Shop Freezer Assets Allocation</h3>
            <p className="text-xs text-slate-600 font-semibold">{summary?.freezerCount || 3} Shops Provided with Free Freezers</p>
          </div>
        </div>
        <span className="px-3.5 py-2 bg-cyan-600 text-white font-extrabold text-xs rounded-xl shadow-sm">
          Manage Freezers →
        </span>
      </div>

      {/* Sale Details Modal */}
      {selectedSaleForDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto my-auto p-5 space-y-4 shadow-2xl relative">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-base border border-blue-200">
                  🧾
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Bill #{selectedSaleForDetails.bill_no}</h3>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">{selectedSaleForDetails.date} at {selectedSaleForDetails.time}</span>
                </div>
              </div>
              <button onClick={() => setSelectedSaleForDetails(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans font-bold">Seller:</span>
                  <span className="font-black text-slate-900">{selectedSaleForDetails.employee_name || 'Store Keeper'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans font-bold">Customer / Shop:</span>
                  <span className="font-black text-slate-900">{selectedSaleForDetails.shop_name || 'Direct Customer'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans font-bold">Payment Mode:</span>
                  <span className="font-black text-emerald-600 uppercase">{selectedSaleForDetails.payment_mode}</span>
                </div>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-800 mb-1">Purchased Products (Pcs Count):</h4>
                <div className="space-y-1.5 max-h-36 overflow-y-auto font-mono bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                  {(() => {
                    const items = selectedSaleForDetails.items || [];
                    if (items.length === 0) {
                      return <p className="text-center py-2 text-slate-400 text-[11px]">No line items recorded</p>;
                    }
                    return items.map((item, i) => (
                      <div key={i} className="flex justify-between border-b border-slate-200/60 last:border-0 pb-1 text-xs">
                        <span>{item.product_name || item.name} x {item.qty} {item.unit_type || 'pcs'}</span>
                        <span className="font-bold text-slate-900">₹{Number(item.amount || item.total || (item.qty * item.rate) || 0).toFixed(2)}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 flex justify-between items-center font-mono">
                <span className="font-sans font-extrabold text-slate-800 uppercase">Grand Total Amount:</span>
                <span className="font-black text-emerald-700 text-lg">₹{Number(selectedSaleForDetails.total_amount || 0).toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedSaleForDetails(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
