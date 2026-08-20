import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ShieldCheck, DollarSign, CreditCard, ShoppingBag, Users, AlertTriangle, Fuel, 
  Printer, Grid, BarChart3, TrendingUp, ChevronRight 
} from 'lucide-react';
import { A4ReportView } from './A4ReportView';
import { FeatureIconGrid } from './FeatureIconGrid';

export const OwnerDashboard = () => {
  const { summary } = useApp();
  const [viewMode, setViewMode] = useState('DASHBOARD'); // DASHBOARD, A4_REPORT

  if (viewMode === 'A4_REPORT') {
    return <A4ReportView onBack={() => setViewMode('DASHBOARD')} />;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6 pb-24">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glass-panel p-5 rounded-2xl border border-slate-800 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-400" />
            <h2 className="text-xl font-black text-white">OWNER EXECUTIVE DASHBOARD</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">Real-time Financial, Sales & Inventory Analytics</p>
        </div>

        <button
          onClick={() => setViewMode('A4_REPORT')}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg glow-blue transition"
        >
          <Printer className="w-4 h-4" />
          GENERATE A4 DAILY REPORT
        </button>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card p-4 rounded-xl border border-emerald-500/30">
          <span className="text-xs text-slate-400 font-bold block">Today's Sales</span>
          <div className="font-mono font-black text-2xl text-emerald-400 mt-1">
            ₹{(summary?.todaySales || 124500).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-blue-500/30">
          <span className="text-xs text-slate-400 font-bold block">Cash Collection</span>
          <div className="font-mono font-black text-2xl text-blue-400 mt-1">
            ₹{(summary?.cashCollection || 72500).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-indigo-500/30">
          <span className="text-xs text-slate-400 font-bold block">GPay Collection</span>
          <div className="font-mono font-black text-2xl text-indigo-400 mt-1">
            ₹{(summary?.gpayCollection || 42000).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-amber-500/30">
          <span className="text-xs text-slate-400 font-bold block">Credit / Dues</span>
          <div className="font-mono font-black text-2xl text-amber-400 mt-1">
            ₹{(summary?.creditSales || 10000).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-semibold block">Total Bills</span>
            <span className="font-mono font-black text-xl text-white">186</span>
          </div>
          <ShoppingBag className="w-5 h-5 text-blue-400" />
        </div>

        <div className="glass-card p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-semibold block">Active Employees</span>
            <span className="font-mono font-black text-xl text-emerald-400">7 / 7</span>
          </div>
          <Users className="w-5 h-5 text-emerald-400" />
        </div>

        <div className="glass-card p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-semibold block">Damage Cost</span>
            <span className="font-mono font-black text-xl text-rose-400">₹{(summary?.damageCost || 2100).toLocaleString()}</span>
          </div>
          <AlertTriangle className="w-5 h-5 text-rose-400" />
        </div>

        <div className="glass-card p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-semibold block">Expenses</span>
            <span className="font-mono font-black text-xl text-amber-400">₹{(summary?.totalExpenses || 12500).toLocaleString()}</span>
          </div>
          <Fuel className="w-5 h-5 text-amber-400" />
        </div>
      </div>

      {/* Operating Profit Summary Card */}
      <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/20">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Today's Profit & Loss Summary
          </h3>
          <span className="text-xs text-emerald-400 font-bold bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/30">
            HEALTHY MARGIN
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 text-xs font-mono">
          <div>
            <span className="text-slate-400 block font-bold">Gross Sales Revenue</span>
            <span className="font-black text-lg text-white">₹1,24,500</span>
          </div>
          <div>
            <span className="text-slate-400 block font-bold">Cost of Goods Sold (COGS)</span>
            <span className="font-black text-lg text-slate-300">₹98,000</span>
          </div>
          <div>
            <span className="text-slate-400 block font-bold">Operating Expenses & Damage</span>
            <span className="font-black text-lg text-rose-400">-₹14,600</span>
          </div>
          <div className="bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/40">
            <span className="text-emerald-400 block font-bold text-[10px] uppercase">Operating Net Profit</span>
            <span className="font-black text-xl text-emerald-400">₹11,900</span>
          </div>
        </div>
      </div>

      {/* Screen 13 Mockup: Feature Icon Grid */}
      <FeatureIconGrid />

    </div>
  );
};
