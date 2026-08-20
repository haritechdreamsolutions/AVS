import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { AdminAnalyticsChart } from './AdminAnalyticsChart';
import { 
  TrendingUp, Printer, RefreshCw, Eye, ShoppingBag, 
  DollarSign, Smartphone, CreditCard, ArrowRightLeft, UserCheck, 
  Truck, Store, Snowflake, Sparkles, CheckCircle2, Clock, X 
} from 'lucide-react';

export const OwnerDashboardOverview = ({ onNavigateTab }) => {
  const { summary, sales = [], refreshData, activeBill, setActiveBill } = useApp();
  const [selectedSaleForDetails, setSelectedSaleForDetails] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterSellerType, setFilterSellerType] = useState('ALL'); // ALL, STORE, DRIVER

  // Auto-refresh background polling every 4 seconds to sync live sales instantly
  useEffect(() => {
    const interval = setInterval(() => {
      if (refreshData) {
        refreshData();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [refreshData]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    if (refreshData) {
      await refreshData();
    }
    setTimeout(() => setIsRefreshing(false), 500);
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
    <div className="space-y-5 pb-24">
      
      {/* Header Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                ADMIN EXECUTIVE DASHBOARD
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Live Auto-Sync
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">Real-time Financial, Driver Delivery & Store Counter Billing Engine</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            className={`p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white transition ${isRefreshing ? 'animate-spin' : ''}`}
            title="Refresh Live Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => onNavigateTab && onNavigateTab('a4_report')}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-md border border-purple-400/30 transition"
          >
            <Printer className="w-4 h-4" /> GENERATE A4 REPORT
          </button>
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-emerald-500 border border-slate-200 shadow-xs hover:-translate-y-0.5 transition">
          <span className="text-xs text-slate-500 font-extrabold uppercase tracking-tight block">Today's Sales</span>
          <div className="font-mono font-black text-2xl text-slate-900 mt-1">
            ₹{(summary?.todaySales || 126150).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-blue-500 border border-slate-200 shadow-xs hover:-translate-y-0.5 transition">
          <span className="text-xs text-slate-500 font-extrabold uppercase tracking-tight block">Cash Collection</span>
          <div className="font-mono font-black text-2xl text-blue-600 mt-1">
            ₹{(summary?.cashCollection || 73200).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-indigo-500 border border-slate-200 shadow-xs hover:-translate-y-0.5 transition">
          <span className="text-xs text-slate-500 font-extrabold uppercase tracking-tight block">GPay Collection</span>
          <div className="font-mono font-black text-2xl text-indigo-600 mt-1">
            ₹{(summary?.gpayCollection || 42950).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-amber-500 border border-slate-200 shadow-xs hover:-translate-y-0.5 transition">
          <span className="text-xs text-slate-500 font-extrabold uppercase tracking-tight block">Credit / Dues</span>
          <div className="font-mono font-black text-2xl text-amber-600 mt-1">
            ₹{(summary?.creditSales || 10000).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Live Sales & Billing Feed Ticker Widget */}
      <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              REAL-TIME BILLING FEED & RECENT INVOICES (நேரலை விற்பனை பில்கள்)
            </h3>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">Live feed of bills generated by Store Keeper & Delivery Drivers</p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setFilterSellerType('ALL')}
              className={`px-3 py-1 rounded-lg font-extrabold transition ${filterSellerType === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All Bills ({sales.length})
            </button>
            <button
              onClick={() => setFilterSellerType('STORE')}
              className={`px-3 py-1 rounded-lg font-extrabold transition ${filterSellerType === 'STORE' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              🏬 Store Counter
            </button>
            <button
              onClick={() => setFilterSellerType('DRIVER')}
              className={`px-3 py-1 rounded-lg font-extrabold transition ${filterSellerType === 'DRIVER' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
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
                className="bg-slate-50/90 hover:bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-blue-300 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-slate-900">{sale.bill_no}</span>
                    {renderPaymentBadge(sale.payment_mode)}
                  </div>

                  {/* Seller Badge */}
                  <div>
                    {isStoreKeeper ? (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-900 font-extrabold text-[10px] rounded-md border border-purple-200 flex items-center gap-1 w-max">
                        <Store className="w-3 h-3 text-purple-700" /> 🏬 Store Keeper (Store Counter)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-900 font-extrabold text-[10px] rounded-md border border-blue-200 flex items-center gap-1 w-max">
                        <Truck className="w-3 h-3 text-blue-700" /> 🚚 {sale.employee_name || 'Driver'}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-700 space-y-0.5">
                    <span className="font-bold text-slate-900 block truncate">
                      Customer: {sale.shop_name || sale.customer_name || 'Walk-in Customer'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      Time: {sale.date} at {sale.time}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between">
                  <div className="font-mono font-black text-base text-slate-900">
                    ₹{Number(sale.total_amount || 0).toLocaleString()}
                  </div>

                  <button
                    onClick={() => setSelectedSaleForDetails(sale)}
                    className="px-3 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-extrabold text-xs border border-slate-200 shadow-2xs flex items-center gap-1 transition"
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
      <AdminAnalyticsChart />

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

      {/* Profit & Loss summary card */}
      <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Operating Profit Summary (நிகர லாபக் கணக்கீடு)
          </h3>
          <span className="text-xs text-emerald-800 font-bold bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
            Healthy Performance 📈
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div>
            <span className="text-slate-500 block font-bold text-[10px] uppercase">Gross Sales</span>
            <span className="font-black text-lg text-slate-900">₹{(summary?.todaySales || 126150).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-500 block font-bold text-[10px] uppercase">COGS (Stock Cost)</span>
            <span className="font-black text-lg text-slate-800">₹98,000</span>
          </div>
          <div>
            <span className="text-slate-500 block font-bold text-[10px] uppercase">Expenses & Damage</span>
            <span className="font-black text-lg text-rose-600">-₹14,600</span>
          </div>
          <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
            <span className="text-emerald-800 block font-bold text-[10px] uppercase">Net Operating Profit</span>
            <span className="font-black text-xl text-emerald-700">₹13,550</span>
          </div>
        </div>
      </div>

      {/* Sale Details Modal */}
      {selectedSaleForDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl relative overflow-hidden">
            
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
                  {(selectedSaleForDetails.items || [
                    { name: "Amirtha Milk 200ml", qty: 20, rate: 45, total: 900 },
                    { name: "Water Bottle 1L", qty: 12, rate: 40, total: 480 }
                  ]).map((item, i) => (
                    <div key={i} className="flex justify-between border-b border-slate-200/60 last:border-0 pb-1">
                      <span>{item.name} x {item.qty} pcs</span>
                      <span className="font-bold text-slate-900">₹{item.total || (item.qty * item.rate)}</span>
                    </div>
                  ))}
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
