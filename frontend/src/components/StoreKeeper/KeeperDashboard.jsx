import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Package, Truck, ArrowDownLeft, ArrowUpRight, RotateCcw, 
  DollarSign, Activity, UserCheck, Plus, ShoppingCart, 
  Search, Sparkles, TrendingUp, CheckCircle2, ShieldCheck, Box,
  Wrench, FileText, X
} from 'lucide-react';
import { CashSettlementModal } from './CashSettlementModal';
import { StockReceiveModal } from './StockReceiveModal';
import { StockAllocationModal } from './StockAllocationModal';
import { StockReturnModal } from './StockReturnModal';
import { AddShopModal } from '../common/AddShopModal';
import { StoreDirectBillingModal } from './StoreDirectBillingModal';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { ThermalBillModal } from '../Employee/ThermalBillModal';
import { SalesRecordsView } from '../Owner/SalesRecordsView';

export const KeeperDashboard = () => {
  const { products = [], summary, employees, stockMovements } = useApp();
  const [activeModal, setActiveModal] = useState(null); // SETTLEMENT, RECEIVE, ALLOCATE, RETURN_DRIVER, ADD_SHOP, DIRECT_SALE, ADJUST_STOCK, SALES_HISTORY
  const [completedBill, setCompletedBill] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Strictly operational ACTIVE products only for Store Keeper dashboard & warehouse inventory
  const activeProducts = useMemo(() => {
    return (products || []).filter(p => p.is_active !== false && p.is_active !== 0);
  }, [products]);

  // Dynamically extract categories from active products
  const categoriesList = useMemo(() => {
    const cats = new Set(activeProducts.map(p => p.category_name || p.selling_unit || 'General').filter(Boolean));
    return ['all', ...Array.from(cats)];
  }, [activeProducts]);

  const filteredProducts = useMemo(() => {
    return activeProducts.filter(p => {
      const cat = p.category_name || p.selling_unit || 'General';
      const catMatch = activeCategory === 'all' || cat.toLowerCase() === activeCategory.toLowerCase();
      const nameMatch = !searchQuery || p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return catMatch && nameMatch;
    });
  }, [activeProducts, activeCategory, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-5 space-y-5 pb-6">
      
      {/* Executive Dual-Level Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white border border-slate-800 shadow-xl space-y-4 relative overflow-hidden">
        
        {/* Glow decoration accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Level 1: Title & Primary CTA */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-xs shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex flex-wrap items-center gap-2 tracking-tight">
                STORE KEEPER POS DASHBOARD
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  🟢 Real-Time Inventory Engine
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">Warehouse Stock Control, Direct Counter Sales & Driver Vehicle Allocations</p>
            </div>
          </div>

          <button
            onClick={() => setActiveModal('DIRECT_SALE')}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg glow-green transition-transform hover:scale-[1.02] active:scale-95 shrink-0"
          >
            <ShoppingCart className="w-4 h-4 stroke-[2.5]" />
            Direct Store Sale
          </button>
        </div>

        {/* Level 2: Operations Quick Toolbar */}
        <div className="relative z-10 grid grid-cols-2 sm:flex items-center gap-2 py-0.5 w-full sm:w-auto">
          <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mr-1 hidden sm:inline-block">Quick Actions:</span>
          
          <button
            onClick={() => setActiveModal('ADD_SHOP')}
            className="px-3.5 py-2.5 rounded-xl bg-purple-600/90 hover:bg-purple-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 border border-purple-400/30 shadow-xs transition min-h-[44px] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Shop
          </button>

          <button
            onClick={() => setActiveModal('RECEIVE')}
            className="px-3.5 py-2.5 rounded-xl bg-blue-600/90 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 border border-blue-400/30 shadow-xs transition min-h-[44px] cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            Receive Stock
          </button>
          
          <button
            onClick={() => setActiveModal('ALLOCATE')}
            className="px-3.5 py-2.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 border border-indigo-400/30 shadow-xs transition min-h-[44px] cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            Stock Allocate Driver
          </button>

          <button
            onClick={() => setActiveModal('RETURN_DRIVER')}
            className="px-3.5 py-2.5 rounded-xl bg-amber-600/90 hover:bg-amber-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 border border-amber-400/30 shadow-xs transition min-h-[44px] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Stock Return Driver
          </button>

          <button
            onClick={() => setActiveModal('SALES_HISTORY')}
            className="px-3.5 py-2.5 rounded-xl bg-slate-700/90 hover:bg-slate-600 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 border border-slate-500/30 shadow-xs transition min-h-[44px] cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            Sales & Receipts
          </button>
        </div>

      </div>

      {/* Today Overview Real-Time KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-emerald-500 border border-slate-200 shadow-xs hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between text-xs text-slate-500 font-extrabold uppercase tracking-tight">
            <span>Today Sales</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-mono font-black text-2xl text-emerald-600 mt-1.5">
            ₹{Number(summary?.todaySales || 0).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-blue-500 border border-slate-200 shadow-xs hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between text-xs text-slate-500 font-extrabold uppercase tracking-tight">
            <span>Cash Collection</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="font-mono font-black text-2xl text-blue-600 mt-1.5">
            ₹{Number(summary?.cashCollection || 0).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-amber-500 border border-slate-200 shadow-xs hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between text-xs text-slate-500 font-extrabold uppercase tracking-tight">
            <span>Credit Sales</span>
            <RotateCcw className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-mono font-black text-2xl text-amber-600 mt-1.5">
            ₹{Number(summary?.creditSales || 0).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-purple-500 border border-slate-200 shadow-xs hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between text-xs text-slate-500 font-extrabold uppercase tracking-tight">
            <span>Expenses</span>
            <ArrowDownLeft className="w-4 h-4 text-purple-600" />
          </div>
          <div className="font-mono font-black text-2xl text-purple-600 mt-1.5">
            ₹{Number(summary?.totalExpenses || 0).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-indigo-500 border border-slate-200 shadow-xs hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between text-xs text-slate-500 font-extrabold uppercase tracking-tight">
            <span>Damage Cost</span>
            <ArrowUpRight className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="font-mono font-black text-2xl text-indigo-600 mt-1.5">
            ₹{Number(summary?.damageCost || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Main 12-Column Responsive Layout (8 Cols Inventory + 4 Cols Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* LEFT PANEL: Warehouse Stock Tile Grid (8 Cols out of 12) */}
        <div className="lg:col-span-8 glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
          
          {/* Header & Product Search Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Warehouse Inventory
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Real-time Stock Levels & Rates from PostgreSQL</p>
            </div>

            {/* Live Search Input Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Dynamic Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 py-0.5">
            {categoriesList.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition capitalize ${
                  activeCategory === cat
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat === 'all' ? 'All Products' : cat}
              </button>
            ))}
          </div>

          {/* Product Cards Grid */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <Box className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-600 text-sm">No stock available</p>
              <p className="text-xs text-slate-400 mt-1">Receive stock from supplier or add new products.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filteredProducts.map(prod => {
                const totalPieces = (Number(prod.warehouse_stock_units) || 0) * (Number(prod.pieces_per_unit) || 1);
                return (
                  <div key={prod.id} className="relative group bg-white rounded-3xl p-3 border border-slate-200 hover:border-blue-400 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden">
                    
                    <div className="relative w-full h-32 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100 border border-slate-200/80 overflow-hidden flex items-center justify-center p-3">
                      <div className="absolute top-2 left-2 z-10">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-2xs bg-white/95 text-blue-700 border-slate-200">
                          {prod.selling_unit || 'Tray'}
                        </span>
                      </div>
                      <div className="absolute top-2 right-2 z-10">
                        <span className="font-mono font-black text-[11px] text-slate-800 bg-white/95 px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                          ₹{prod.unit_selling_price}
                        </span>
                      </div>
                      {prod.image_url ? (
                        <img
                          src={prod.image_url}
                          alt={prod.display_name}
                          className="h-full w-full object-contain drop-shadow-sm rounded-xl"
                        />
                      ) : (
                        <span className="text-4xl">{prod.icon || '📦'}</span>
                      )}
                    </div>

                    {/* Card Content & Stock */}
                    <div className="pt-2.5 space-y-2">
                      <h4 className="font-black text-xs text-slate-900 leading-tight truncate">
                        {prod.display_name}
                      </h4>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
                        <span>Buy: ₹{prod.purchase_price}</span>
                        <span>Sale: ₹{prod.unit_selling_price}</span>
                      </div>
                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Available Stock</span>
                        <div className="flex flex-col items-end">
                          <div className="flex items-baseline gap-1">
                            <span className="font-mono font-black text-base text-emerald-600 leading-none">
                              {Number(prod.warehouse_stock_units || 0)}
                            </span>
                            <span className="text-[10px] text-emerald-700 font-extrabold uppercase">{prod.selling_unit || 'Trays'}</span>
                          </div>
                          <span className="font-mono font-extrabold text-[10px] text-indigo-600 mt-0.5">
                            ({totalPieces} Pcs)
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Employees & Live Operations Log */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* Employee Status Card */}
          <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600" />
                Active Field Employees
              </h3>
              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {employees.length} Registered
              </span>
            </div>

            <div className="space-y-2.5">
              {employees.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No employees registered yet.</p>
              ) : (
                employees.map((emp) => (
                  <div key={emp.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-900 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-[10px]">
                          {emp.full_name[0]}
                        </div>
                        {emp.full_name}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 font-mono">
                        {emp.vehicle_number || 'No Vehicle'}
                      </span>
                    </div>
                    {emp.phone && (
                      <p className="text-[10px] text-slate-400 font-mono pl-8">{emp.phone}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Operations Log Card */}
          <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-600" />
                Recent Inventory Movements
              </h3>
              <span className="text-[10px] font-mono font-bold text-slate-400">PostgreSQL</span>
            </div>

            <div className="space-y-2.5 text-xs">
              {(stockMovements || []).slice(0, 8).map((m, idx) => {
                const isEntry = m.movement_type === 'INWARD';
                const isExit = m.movement_type === 'OUTWARD';
                const isRet = m.movement_type === 'RETURN';
                return (
                  <div key={m.id || idx} className="flex items-start gap-2.5 border-b border-slate-100 pb-2 last:border-none last:pb-0">
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                      isEntry ? 'bg-emerald-100 text-emerald-800' : isExit ? 'bg-blue-100 text-blue-800' : isRet ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {m.movement_type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 truncate">{m.product_name || 'Stock Item'} — {m.qty_units} {m.unit || 'Trays'}</p>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {m.employee_name ? `Driver: ${m.employee_name}` : (m.notes || m.movement_no)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {(!stockMovements || stockMovements.length === 0) && (
                <p className="text-xs text-slate-400 text-center py-4">No inventory movements recorded yet.</p>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Modals */}
      {activeModal === 'DIRECT_SALE' && (
        <StoreDirectBillingModal 
          onClose={() => setActiveModal(null)}
          onBillGenerated={(sale) => setCompletedBill(sale)}
        />
      )}
      {completedBill && (
        <ThermalBillModal
          bill={completedBill}
          onClose={() => setCompletedBill(null)}
        />
      )}
      {activeModal === 'SETTLEMENT' && (
        <CashSettlementModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'RECEIVE' && (
        <StockReceiveModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'ALLOCATE' && (
        <StockAllocationModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'RETURN_DRIVER' && (
        <StockReturnModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'ADD_SHOP' && (
        <AddShopModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'ADJUST_STOCK' && (
        <StockAdjustmentModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'SALES_HISTORY' && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-6xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 px-6 border-b border-slate-200 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="font-black text-base text-white">Sales Invoices & Receipt Reprint History</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50/50">
              <SalesRecordsView />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
