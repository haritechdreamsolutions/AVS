import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Package, Truck, ArrowDownLeft, ArrowUpRight, RotateCcw, 
  DollarSign, Activity, UserCheck, Plus, ShoppingCart, 
  Search, Sparkles, TrendingUp, CheckCircle2, ShieldCheck 
} from 'lucide-react';
import { CashSettlementModal } from './CashSettlementModal';
import { StockReceiveModal } from './StockReceiveModal';
import { StockAllocationModal } from './StockAllocationModal';
import { AddShopModal } from '../common/AddShopModal';
import { StoreDirectBillingModal } from './StoreDirectBillingModal';
import { ThermalBillModal } from '../Employee/ThermalBillModal';

const PRODUCT_IMAGES = {
  1: { image: '/images/amirthaa_milk_200ml.png', sizeBadge: '200 ml', category: 'Milk', bgTone: 'from-blue-500/10 to-blue-50 border-blue-200', textTone: 'text-blue-700' },
  5: { image: '/images/amirthaa_milk_500ml.png', sizeBadge: '500 ml', category: 'Milk', bgTone: 'from-blue-500/10 to-blue-50 border-blue-200', textTone: 'text-blue-700' },
  6: { image: '/images/amirthaa_milk_1l.jpg', sizeBadge: '1 Ltr', category: 'Milk', bgTone: 'from-blue-500/10 to-blue-50 border-blue-200', textTone: 'text-blue-700' },
  7: { image: '/images/amirthaa_curd_200ml.jpg', sizeBadge: '200 ml', category: 'Curd', bgTone: 'from-amber-500/10 to-amber-50 border-amber-200', textTone: 'text-amber-700' },
  8: { image: '/images/amirthaa_curd_500ml.jpg', sizeBadge: '500 ml', category: 'Curd', bgTone: 'from-amber-500/10 to-amber-50 border-amber-200', textTone: 'text-amber-700' },
  9: { image: '/images/amirthaa_curd_1l.jpg', sizeBadge: '1 Ltr', category: 'Curd', bgTone: 'from-amber-500/10 to-amber-50 border-amber-200', textTone: 'text-amber-700' },
  10: { image: '/images/coccola_200ml.png', sizeBadge: '200 ml', category: 'Coccola', bgTone: 'from-rose-500/10 to-rose-50 border-rose-200', textTone: 'text-rose-700' },
  3: { image: '/images/coccola_500ml.png', sizeBadge: '500 ml', category: 'Coccola', bgTone: 'from-rose-500/10 to-rose-50 border-rose-200', textTone: 'text-rose-700' },
  11: { image: '/images/coccola_1l.png', sizeBadge: '1 Ltr', category: 'Coccola', bgTone: 'from-rose-500/10 to-rose-50 border-rose-200', textTone: 'text-rose-700' },
  12: { image: '/images/juice_hero.jpg', sizeBadge: 'Fresh Pack', category: 'Juice', bgTone: 'from-orange-500/10 to-orange-50 border-orange-200', textTone: 'text-orange-700' },
  15: { image: '/images/tata_hero.jpg', sizeBadge: 'Gluco Can', category: 'Tata', bgTone: 'from-yellow-500/10 to-yellow-50 border-yellow-200', textTone: 'text-yellow-700' },
  18: { image: '/images/aquafresh_water_200ml.png', sizeBadge: '200 ml', category: 'Water', bgTone: 'from-cyan-500/10 to-cyan-50 border-cyan-200', textTone: 'text-cyan-700' },
  19: { image: '/images/aquafresh_water_500ml.png', sizeBadge: '500 ml', category: 'Water', bgTone: 'from-cyan-500/10 to-cyan-50 border-cyan-200', textTone: 'text-cyan-700' },
  2: { image: '/images/aquafresh_water_1l.png', sizeBadge: '1 Ltr', category: 'Water', bgTone: 'from-cyan-500/10 to-cyan-50 border-cyan-200', textTone: 'text-cyan-700' },
  20: { image: '/images/aquafresh_water_2l.png', sizeBadge: '2 Ltr', category: 'Water', bgTone: 'from-cyan-500/10 to-cyan-50 border-cyan-200', textTone: 'text-cyan-700' }
};

const CATEGORIES = [
  { id: 'all', label: 'All Products (அனைத்தும்)' },
  { id: 'Milk', label: 'Milk (பால்)' },
  { id: 'Curd', label: 'Curd (தயிர்)' },
  { id: 'Coccola', label: 'Coccola (கூலா)' },
  { id: 'Juice', label: 'Juice (ஜூஸ்)' },
  { id: 'Tata', label: 'Tata Drink' },
  { id: 'Water', label: 'Water (தண்ணீர்)' }
];

export const KeeperDashboard = () => {
  const { products, summary } = useApp();
  const [activeModal, setActiveModal] = useState(null); // SETTLEMENT, RECEIVE, ALLOCATE, ADD_SHOP, DIRECT_SALE
  const [completedBill, setCompletedBill] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const meta = PRODUCT_IMAGES[p.id] || {};
      const catMatch = activeCategory === 'all' || (meta.category && meta.category.toLowerCase() === activeCategory.toLowerCase());
      const nameMatch = !searchQuery || p.display_name.toLowerCase().includes(searchQuery.toLowerCase());
      return catMatch && nameMatch;
    });
  }, [products, activeCategory, searchQuery]);

  const employeeStatuses = [
    { name: "Tharun", status: "On Route", progress: 42, color: "text-emerald-700 bg-emerald-100 border border-emerald-200" },
    { name: "Kumar", status: "On Route", progress: 60, color: "text-emerald-700 bg-emerald-100 border border-emerald-200" },
    { name: "Suresh", status: "Returned", progress: 100, color: "text-blue-700 bg-blue-100 border border-blue-200" },
    { name: "Mani", status: "On Route", progress: 20, color: "text-emerald-700 bg-emerald-100 border border-emerald-200" },
    { name: "Prakash", status: "Not Started", progress: 0, color: "text-rose-700 bg-rose-100 border border-rose-200" }
  ];

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-5 space-y-5 pb-24">
      
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
            🛒 Direct Store Sale (நேரடி விற்பனை)
          </button>
        </div>

        {/* Level 2: Operations Quick Toolbar */}
        <div className="relative z-10 flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5 flex-wrap">
          <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mr-1 hidden sm:inline-block">Quick Actions:</span>
          
          <button
            onClick={() => setActiveModal('ADD_SHOP')}
            className="px-3.5 py-2 rounded-xl bg-purple-600/90 hover:bg-purple-500 text-white font-extrabold text-xs flex items-center gap-1.5 border border-purple-400/30 shadow-xs transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            + Add Shop
          </button>

          <button
            onClick={() => setActiveModal('RECEIVE')}
            className="px-3.5 py-2 rounded-xl bg-blue-600/90 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center gap-1.5 border border-blue-400/30 shadow-xs transition shrink-0"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            Receive Stock
          </button>
          
          <button
            onClick={() => setActiveModal('ALLOCATE')}
            className="px-3.5 py-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center gap-1.5 border border-indigo-400/30 shadow-xs transition shrink-0"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Give Stock (Allocate)
          </button>

          <button
            onClick={() => setActiveModal('SETTLEMENT')}
            className="px-3.5 py-2 rounded-xl bg-amber-600/90 hover:bg-amber-500 text-white font-extrabold text-xs flex items-center gap-1.5 border border-amber-400/30 shadow-xs transition shrink-0"
          >
            <DollarSign className="w-3.5 h-3.5" />
            Cash Settlement
          </button>
        </div>

      </div>

      {/* Today Overview Dynamic KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-emerald-500 border border-slate-200 shadow-xs hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between text-xs text-slate-500 font-extrabold uppercase tracking-tight">
            <span>Today Sales (விற்பனை)</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-mono font-black text-2xl text-emerald-600 mt-1.5">
            ₹{(summary?.todaySales || 124500).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-blue-500 border border-slate-200 shadow-xs hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between text-xs text-slate-500 font-extrabold uppercase tracking-tight">
            <span>Cash Collection</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="font-mono font-black text-2xl text-blue-600 mt-1.5">
            ₹{(summary?.cashCollection || 72500).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-amber-500 border border-slate-200 shadow-xs hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between text-xs text-slate-500 font-extrabold uppercase tracking-tight">
            <span>Credit Sales</span>
            <RotateCcw className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-mono font-black text-2xl text-amber-600 mt-1.5">
            ₹{(summary?.creditSales || 10000).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-purple-500 border border-slate-200 shadow-xs hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between text-xs text-slate-500 font-extrabold uppercase tracking-tight">
            <span>Stock Received</span>
            <ArrowDownLeft className="w-4 h-4 text-purple-600" />
          </div>
          <div className="font-mono font-black text-2xl text-purple-600 mt-1.5">
            ₹{(summary?.stockReceived || 72500).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-indigo-500 border border-slate-200 shadow-xs hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between text-xs text-slate-500 font-extrabold uppercase tracking-tight">
            <span>Stock Given</span>
            <ArrowUpRight className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="font-mono font-black text-2xl text-indigo-600 mt-1.5">
            ₹{(summary?.stockGiven || 38500).toLocaleString()}
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
                Warehouse Inventory (சரக்கு கையிருப்பு)
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Real-time Stock Levels with Size Variants & Photo Visuals</p>
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

          {/* Responsive Category Filter Pills (Flex-Wrap, No Scrollbar) */}
          <div className="flex flex-wrap items-center gap-1.5 py-0.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition ${
                  activeCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Product Cards Grid (3 Columns on Desktop) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredProducts.map(prod => {
              const meta = PRODUCT_IMAGES[prod.id] || {
                image: prod.image || '/images/milk_200ml.svg',
                sizeBadge: 'Item',
                category: prod.category || 'Product',
                bgTone: 'from-slate-500/10 to-slate-50 border-slate-200',
                textTone: 'text-slate-700'
              };
              const imgUrl = meta.image;

              return (
                <div key={prod.id} className="relative group bg-white rounded-3xl p-3 border border-slate-200 hover:border-blue-400 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden">
                  
                  {/* Top Image Hero Banner Container */}
                  <div className={`relative w-full h-44 rounded-2xl bg-gradient-to-b ${meta.bgTone || 'from-slate-50 to-slate-100/80'} border border-slate-200/80 overflow-hidden flex items-center justify-center pt-9 pb-2 px-3 group-hover:scale-[1.01] transition-transform duration-300`}>
                    {/* Floating Size Variant Pill Badge */}
                    <div className="absolute top-2 left-2 z-10">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border shadow-xs backdrop-blur-md bg-white/95 ${meta.textTone} border-slate-200 flex items-center gap-1`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        {meta.sizeBadge}
                      </span>
                    </div>

                    {/* Floating Price Tag */}
                    <div className="absolute top-2 right-2 z-10">
                      <span className="font-mono font-black text-[11px] text-slate-800 bg-white/95 backdrop-blur-md px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                        ₹{prod.unit_selling_price} / {prod.selling_unit}
                      </span>
                    </div>

                    {/* Large Hero Product Photo / SVG */}
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={prod.display_name}
                        className="h-full w-full object-contain drop-shadow-md rounded-xl transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <span className="text-5xl">{prod.icon || '📦'}</span>
                    )}
                  </div>

                  {/* Card Content & Stock Footer */}
                  <div className="pt-2.5 space-y-2">
                    <h4 className="font-black text-xs text-slate-900 leading-tight truncate group-hover:text-blue-600 transition-colors">
                      {prod.display_name}
                    </h4>

                    <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Stock Level</span>
                      <div className="flex flex-col items-end">
                        <div className="flex items-baseline gap-1">
                          <span className="font-mono font-black text-base text-emerald-600 leading-none">
                            {Math.round((prod.warehouse_stock_units || 0) * (prod.pieces_per_unit || 1)).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-extrabold uppercase">Pcs</span>
                        </div>
                        <span className="font-mono font-extrabold text-[10px] text-indigo-600 mt-0.5">
                          ({prod.warehouse_stock_units} {prod.selling_unit || 'Trays'})
                        </span>
                      </div>
                    </div>

                    {/* Visual Progress Meter */}
                    <div className="space-y-1">
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                        <div 
                          className="bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.round((prod.warehouse_stock_units / 150) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL: Employee Progress & Live Operations Sidebar (4 Cols out of 12) */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* Employee Status Card */}
          <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600" />
                Employee Vehicle Status
              </h3>
              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                5 Active
              </span>
            </div>

            <div className="space-y-2.5">
              {employeeStatuses.map((emp, idx) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2 hover:bg-slate-100/80 transition">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-900 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-[10px] shadow-2xs">
                        {emp.name[0]}
                      </div>
                      {emp.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${emp.color}`}>
                      {emp.status}
                    </span>
                    <span className="font-mono font-black text-blue-600">{emp.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${emp.progress}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Operations Log Card */}
          <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-600" />
                Live Operations Log
              </h3>
              <span className="text-[10px] font-mono font-bold text-slate-400">Real-time</span>
            </div>

            <div className="space-y-3 text-xs">
              {(summary?.recentActivities || []).map((act, idx) => (
                <div key={idx} className="flex items-start gap-3 border-b border-slate-100 pb-2.5 last:border-none last:pb-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-1 shrink-0 ring-4 ring-blue-100"></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-slate-900 leading-tight">{act.title}</p>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{act.time}</span>
                  </div>
                </div>
              ))}
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
      {activeModal === 'ADD_SHOP' && (
        <AddShopModal onClose={() => setActiveModal(null)} />
      )}

    </div>
  );
};
