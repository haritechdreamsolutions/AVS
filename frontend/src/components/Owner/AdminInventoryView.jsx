import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Package, Search, DollarSign, ArrowUpRight, ArrowDownLeft, 
  Sparkles, CheckCircle2, AlertTriangle, Layers, Info, X 
} from 'lucide-react';

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

export const AdminInventoryView = () => {
  const { products } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const meta = PRODUCT_IMAGES[p.id] || {};
      const catMatch = activeCategory === 'all' || (meta.category && meta.category.toLowerCase() === activeCategory.toLowerCase());
      const nameMatch = !searchQuery || p.display_name.toLowerCase().includes(searchQuery.toLowerCase());
      return catMatch && nameMatch;
    });
  }, [products, activeCategory, searchQuery]);

  const metrics = useMemo(() => {
    let totalValuation = 0;
    let totalPcs = 0;
    let totalTrays = 0;

    (products || []).forEach(p => {
      const pcsPerUnit = p.pieces_per_unit || 1;
      const pcs = Math.round((p.warehouse_stock_units || 0) * pcsPerUnit);
      const val = (p.warehouse_stock_units || 0) * (p.unit_selling_price || 0);

      totalPcs += pcs;
      totalTrays += (p.warehouse_stock_units || 0);
      totalValuation += val;
    });

    return {
      totalValuation: Math.round(totalValuation),
      totalPcs: totalPcs,
      totalTrays: parseFloat(totalTrays.toFixed(1)),
      totalVariants: products.length
    };
  }, [products]);

  return (
    <div className="space-y-5 pb-20">
      
      {/* Executive Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                WAREHOUSE INVENTORY & ASSET ANALYTICS
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  🟢 Real-Time Stock Live
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">Warehouse Stock Valuation, Unit Ratios & Product Assets Overview</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-right">
            <span className="text-[10px] text-slate-300 font-bold block uppercase tracking-wide">Stock Asset Valuation:</span>
            <span className="font-mono font-black text-lg text-emerald-400">
              ₹{metrics.totalValuation.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-emerald-500 border border-slate-200 shadow-xs hover:-translate-y-1 transition-all duration-300">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Warehouse Stock Valuation</span>
          <div className="font-mono font-black text-2xl text-emerald-600 mt-1.5">
            ₹{metrics.totalValuation.toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-blue-500 border border-slate-200 shadow-xs hover:-translate-y-1 transition-all duration-300">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Total Pieces in Warehouse</span>
          <div className="font-mono font-black text-2xl text-blue-600 mt-1.5">
            {metrics.totalPcs.toLocaleString()} <span className="text-xs font-bold text-blue-700">Pcs</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-indigo-500 border border-slate-200 shadow-xs hover:-translate-y-1 transition-all duration-300">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Total Trays / Crates Stock</span>
          <div className="font-mono font-black text-2xl text-indigo-600 mt-1.5">
            {metrics.totalTrays} <span className="text-xs font-bold text-indigo-700">Trays</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-purple-500 border border-slate-200 shadow-xs hover:-translate-y-1 transition-all duration-300">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Active Product Variants</span>
          <div className="font-mono font-black text-2xl text-purple-600 mt-1.5">
            {metrics.totalVariants} <span className="text-xs font-bold text-purple-700">Items</span>
          </div>
        </div>
      </div>

      {/* Main Panel: Filter Bar & Visual Cards */}
      <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
        
        {/* Search Bar & Title */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Warehouse Product Assets (சரக்கு கையிருப்பு)
            </h3>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">High-definition Photo Visuals, Stock Levels, and Valuation Ratios</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search products by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Category Pills Filter */}
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

        {/* Product Cards Grid (4 Columns on XL Widescreen) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map(prod => {
            const meta = PRODUCT_IMAGES[prod.id] || {
              image: prod.image || '/images/milk_200ml.svg',
              sizeBadge: 'Item',
              category: prod.category || 'Product',
              bgTone: 'from-slate-500/10 to-slate-50 border-slate-200',
              textTone: 'text-slate-700'
            };
            const imgUrl = meta.image;
            const pcsCount = Math.round((prod.warehouse_stock_units || 0) * (prod.pieces_per_unit || 1));
            const stockValuation = Math.round((prod.warehouse_stock_units || 0) * (prod.unit_selling_price || 0));

            return (
              <div 
                key={prod.id} 
                onClick={() => setSelectedProduct(prod)}
                className="relative group bg-white rounded-3xl p-3.5 border border-slate-200 hover:border-blue-400 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-pointer"
              >
                
                {/* Hero Product Photo Container */}
                <div className={`relative w-full h-44 rounded-2xl bg-gradient-to-b ${meta.bgTone || 'from-slate-50 to-slate-100/80'} border border-slate-200/80 overflow-hidden flex items-center justify-center pt-9 pb-2 px-3 group-hover:scale-[1.01] transition-transform duration-300`}>
                  
                  {/* Size Badge */}
                  <div className="absolute top-2 left-2 z-10">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border shadow-xs backdrop-blur-md bg-white/95 ${meta.textTone} border-slate-200 flex items-center gap-1`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      {meta.sizeBadge}
                    </span>
                  </div>

                  {/* Price Tag */}
                  <div className="absolute top-2 right-2 z-10">
                    <span className="font-mono font-black text-[11px] text-slate-800 bg-white/95 backdrop-blur-md px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                      ₹{prod.unit_selling_price} / {prod.selling_unit}
                    </span>
                  </div>

                  {/* Product Photo */}
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

                {/* Content Footer */}
                <div className="pt-3 space-y-2.5">
                  <h4 className="font-black text-xs text-slate-900 leading-tight truncate group-hover:text-blue-600 transition-colors">
                    {prod.display_name}
                  </h4>

                  {/* Highlighted Stock Box */}
                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Available Stock:</span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono font-black text-base text-emerald-600 leading-none">
                          {pcsCount.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-extrabold uppercase">Pcs</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] border-t border-slate-200/60 pt-1">
                      <span className="font-mono font-bold text-indigo-600">
                        ({prod.warehouse_stock_units} {prod.selling_unit || 'Trays'})
                      </span>
                      <span className="font-mono font-bold text-purple-700">
                        Val: ₹{stockValuation.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Progress Capacity Bar */}
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

      {/* Stock Inspection Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl relative overflow-hidden">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-base border border-blue-200">
                  📦
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">{selectedProduct.display_name}</h3>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Inventory Asset Specs</span>
                </div>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans font-bold">Total Warehouse Stock:</span>
                  <span className="font-black text-emerald-600">
                    {Math.round((selectedProduct.warehouse_stock_units || 0) * (selectedProduct.pieces_per_unit || 1))} Pcs ({selectedProduct.warehouse_stock_units} Trays)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans font-bold">Unit Selling Price:</span>
                  <span className="font-black text-slate-900">₹{selectedProduct.unit_selling_price} / {selectedProduct.selling_unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans font-bold">Piece Selling Price:</span>
                  <span className="font-black text-slate-900">₹{selectedProduct.piece_selling_price || Math.round(selectedProduct.unit_selling_price / (selectedProduct.pieces_per_unit || 1))}/pc</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1">
                  <span className="text-slate-700 font-sans font-extrabold uppercase">Total Valuation:</span>
                  <span className="font-black text-purple-700 text-sm">₹{Math.round((selectedProduct.warehouse_stock_units || 0) * (selectedProduct.unit_selling_price || 0)).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedProduct(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition"
            >
              Close Asset Breakdown
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
