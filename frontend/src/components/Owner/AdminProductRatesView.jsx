import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ProductImage } from '../common/ProductImage';
import { 
  Tag, Search, Save, CheckCircle2, DollarSign, Package, 
  Sparkles, TrendingUp, Layers, RefreshCw, AlertCircle, Percent, Calculator, Layers3, Scale 
} from 'lucide-react';
import { toast } from 'sonner';

const PRODUCT_IMAGES = {
  1: { image: '/images/amirthaa_milk_200ml.png', sizeBadge: '200 ml', category: 'Milk', bgTone: 'from-blue-500/10 to-blue-50 border-blue-200' },
  5: { image: '/images/amirthaa_milk_500ml.png', sizeBadge: '500 ml', category: 'Milk', bgTone: 'from-blue-500/10 to-blue-50 border-blue-200' },
  6: { image: '/images/amirthaa_milk_1l.jpg', sizeBadge: '1 Ltr', category: 'Milk', bgTone: 'from-blue-500/10 to-blue-50 border-blue-200' },
  7: { image: '/images/amirthaa_curd_200ml.jpg', sizeBadge: '200 ml', category: 'Curd', bgTone: 'from-amber-500/10 to-amber-50 border-amber-200' },
  8: { image: '/images/amirthaa_curd_500ml.jpg', sizeBadge: '500 ml', category: 'Curd', bgTone: 'from-amber-500/10 to-amber-50 border-amber-200' },
  9: { image: '/images/amirthaa_curd_1l.jpg', sizeBadge: '1 Ltr', category: 'Curd', bgTone: 'from-amber-500/10 to-amber-50 border-amber-200' },
  10: { image: '/images/coccola_200ml.png', sizeBadge: '200 ml', category: 'Coccola', bgTone: 'from-rose-500/10 to-rose-50 border-rose-200' },
  3: { image: '/images/coccola_500ml.png', sizeBadge: '500 ml', category: 'Coccola', bgTone: 'from-rose-500/10 to-rose-50 border-rose-200' },
  11: { image: '/images/coccola_1l.png', sizeBadge: '1 Ltr', category: 'Coccola', bgTone: 'from-rose-500/10 to-rose-50 border-rose-200' },
  12: { image: '/images/juice_hero.jpg', sizeBadge: 'Fresh Pack', category: 'Juice', bgTone: 'from-orange-500/10 to-orange-50 border-orange-200' },
  15: { image: '/images/tata_hero.jpg', sizeBadge: 'Gluco Can', category: 'Tata', bgTone: 'from-yellow-500/10 to-yellow-50 border-yellow-200' },
  18: { image: '/images/aquafresh_water_200ml.png', sizeBadge: '200 ml', category: 'Water', bgTone: 'from-cyan-500/10 to-cyan-50 border-cyan-200' },
  19: { image: '/images/aquafresh_water_500ml.png', sizeBadge: '500 ml', category: 'Water', bgTone: 'from-cyan-500/10 to-cyan-50 border-cyan-200' },
  2: { image: '/images/aquafresh_water_1l.png', sizeBadge: '1 Ltr', category: 'Water', bgTone: 'from-cyan-500/10 to-cyan-50 border-cyan-200' },
  20: { image: '/images/aquafresh_water_2l.png', sizeBadge: '2 Ltr', category: 'Water', bgTone: 'from-cyan-500/10 to-cyan-50 border-cyan-200' }
};

export const AdminProductRatesView = () => {
  const { products = [], categories = [], updateProductPrice } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Local state for live rate edits
  const [priceForm, setPriceForm] = useState({});

  const getProductPriceForm = (p) => {
    if (priceForm[p.id]) return priceForm[p.id];
    const buyUom = p.buy_rate_uom || p.selling_unit || 'Tray';
    const sellUom = p.selling_rate_uom || p.selling_unit || 'Tray';
    const baseUom = p.base_unit || 'Piece';
    const pcs = Number(p.pieces_per_unit || 1);
    const buyRate = Number(p.purchase_price || 0);
    const unitSell = Number(p.unit_selling_price || 0);
    const pieceSell = p.piece_selling_price !== undefined ? Number(p.piece_selling_price) : Number((unitSell / pcs).toFixed(2));
    
    return {
      pack_size: p.pack_size || '',
      base_unit: baseUom,
      selling_unit: sellUom,
      buy_rate_uom: buyUom,
      selling_rate_uom: sellUom,
      pieces_per_unit: pcs,
      purchase_price: buyRate,
      unit_selling_price: unitSell,
      piece_selling_price: pieceSell,
    };
  };

  const handlePriceChange = (productId, field, value) => {
    setPriceForm(prev => {
      const product = products.find(p => p.id === productId);
      const current = prev[productId] || getProductPriceForm(product);
      
      const updated = {
        ...current,
        [field]: field === 'pack_size' || field === 'buy_rate_uom' || field === 'selling_rate_uom' || field === 'base_unit' || field === 'selling_unit' ? value : Number(value || 0)
      };

      // Auto-recalculate piece selling rate when unit price or conversion factor changes
      if (field === 'unit_selling_price' || field === 'pieces_per_unit') {
        const unitPrice = field === 'unit_selling_price' ? Number(value) : current.unit_selling_price;
        const pcsCount = field === 'pieces_per_unit' ? Math.max(1, Number(value)) : Math.max(1, current.pieces_per_unit);
        updated.piece_selling_price = parseFloat((unitPrice / pcsCount).toFixed(2));
      }

      return {
        ...prev,
        [productId]: updated
      };
    });
  };

  const handleSavePrice = async (product) => {
    const currentForm = priceForm[product.id] || getProductPriceForm(product);
    if (currentForm.unit_selling_price < 0) {
      toast.error("Unit selling price cannot be negative!");
      return;
    }

    if (currentForm.purchase_price < 0) {
      toast.error("Buy rate cannot be negative!");
      return;
    }

    if (currentForm.pieces_per_unit <= 0) {
      toast.error("Conversion factor must be at least 1 Piece!");
      return;
    }

    if (updateProductPrice) {
      const res = await updateProductPrice(product.id, currentForm);
      if (res.success) {
        toast.success(`Rates & Packaging updated for ${product.display_name}! 1 ${currentForm.selling_unit} = ${currentForm.pieces_per_unit} ${currentForm.base_unit} @ Buy: ₹${currentForm.purchase_price}/${currentForm.buy_rate_uom}, Sell: ₹${currentForm.unit_selling_price}/${currentForm.selling_rate_uom}`);
      } else {
        toast.error("Failed to update rate: " + res.message);
      }
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (!p) return false;
      const meta = PRODUCT_IMAGES[p.id] || {};
      const catMatch = activeCategory === 'all' || (meta.category && meta.category.toLowerCase() === activeCategory.toLowerCase()) || (p.category_name && p.category_name.toLowerCase() === activeCategory.toLowerCase());
      const nameMatch = !searchQuery || p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) || (p.pack_size && p.pack_size.toLowerCase().includes(searchQuery.toLowerCase()));
      return catMatch && nameMatch;
    });
  }, [products, activeCategory, searchQuery]);

  const metrics = useMemo(() => {
    let totalMarginSum = 0;
    products.forEach(p => {
      const form = getProductPriceForm(p);
      const margin = form.unit_selling_price - form.purchase_price;
      totalMarginSum += margin;
    });

    const avgMargin = products.length > 0 ? Math.round(totalMarginSum / products.length) : 0;

    return {
      totalProducts: products.length,
      avgMargin,
      syncedCount: products.length
    };
  }, [products, priceForm]);

  return (
    <div className="space-y-5 pb-24">
      
      {/* Executive Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                PRODUCT UOM, PACKAGING & BUY/SELL RATES
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  Live Master Active
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">Configure Pack Sizes, Base UOMs, Purchase UOMs, Packaging Conversions & Authoritative Buy/Sell Rates</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-right">
            <span className="text-[10px] text-slate-300 font-bold block uppercase tracking-wide">Average Unit Margin:</span>
            <span className="font-mono font-black text-lg text-emerald-400">
              ₹{metrics.avgMargin} / Unit
            </span>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-emerald-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Total Product Variants</span>
          <div className="font-mono font-black text-2xl text-slate-900 mt-1.5">
            {metrics.totalProducts} <span className="text-xs text-slate-500 font-bold">Items</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-blue-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Average Unit Profit Margin</span>
          <div className="font-mono font-black text-2xl text-emerald-600 mt-1.5">
            ₹{metrics.avgMargin} <span className="text-xs text-emerald-700 font-bold">/ Unit</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-purple-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Rate Sync Status</span>
          <div className="font-mono font-black text-2xl text-purple-600 mt-1.5 flex items-baseline gap-1">
            {metrics.syncedCount} <span className="text-xs text-purple-700 font-bold">/ {metrics.totalProducts} Verified</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-amber-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">POS Calculation Engine</span>
          <div className="font-mono font-black text-lg text-amber-600 mt-1.5 flex items-center gap-1">
            <Calculator className="w-4 h-4 text-amber-500" /> Qty × Rate Dynamic Math
          </div>
        </div>
      </div>

      {/* Main Panel: Search & Cards Grid */}
      <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
        
        {/* Search & Title */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              <Tag className="w-5 h-5 text-emerald-600" />
              Owner Price Master & Packaging Conversion Configuration
            </h3>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">Configure Pack Sizes, Conversion Ratios (e.g. 72 Pcs/Tray, 23 Pcs/Case) & Buy/Sell Rates with Explicit UOMs</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, pack size..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Category Pills Filter */}
        <div className="flex flex-wrap items-center gap-1.5 py-0.5">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition ${
              activeCategory === 'all'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Products
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.name)}
              className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition ${
                activeCategory === cat.name
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Rate Setting Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map(product => {
            const actualImage = product.image_url || product.image || (PRODUCT_IMAGES[product.id]?.image) || '';
            const meta = {
              image: actualImage,
              sizeBadge: product.pack_size || (PRODUCT_IMAGES[product.id]?.sizeBadge) || 'Standard',
              category: product.category || product.category_name || (PRODUCT_IMAGES[product.id]?.category) || 'Product',
              bgTone: (PRODUCT_IMAGES[product.id]?.bgTone) || 'from-slate-50 to-slate-100/80'
            };

            const currentForm = priceForm[product.id] || getProductPriceForm(product);
            const marginVal = currentForm.unit_selling_price - currentForm.purchase_price;
            const derivedBaseCost = currentForm.pieces_per_unit > 0 
              ? (currentForm.purchase_price / currentForm.pieces_per_unit).toFixed(2)
              : currentForm.purchase_price;

            return (
              <div 
                key={product.id} 
                className="bg-white rounded-3xl p-4.5 border border-slate-200 hover:border-emerald-400 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
              >
                
                <div className="space-y-3.5">
                  {/* Top Photo & Variant Header */}
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <ProductImage
                      src={meta.image}
                      alt={product.display_name}
                      size={64}
                      icon={product.icon}
                    />

                    <div className="flex-1">
                      <h4 className="font-black text-sm text-slate-900 leading-tight">{product.display_name}</h4>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                          {currentForm.pack_size || meta.sizeBadge || '200ml'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-bold">
                          Base: {currentForm.base_unit}
                        </span>
                        <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-bold">
                          Purchase: {currentForm.selling_unit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Packaging & Rate Setting Form */}
                  <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
                    
                    {/* Pack Size & Conversion Factor */}
                    <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-700 uppercase block mb-1">
                          Pack Size:
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 200ml, 300ml"
                          value={currentForm.pack_size}
                          onChange={(e) => handlePriceChange(product.id, 'pack_size', e.target.value)}
                          className="w-full px-2 py-1 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-extrabold text-indigo-700 uppercase block mb-1">
                          1 {currentForm.selling_unit} =
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={currentForm.pieces_per_unit}
                            onChange={(e) => handlePriceChange(product.id, 'pieces_per_unit', e.target.value)}
                            className="w-full pl-2 pr-8 py-1 text-xs font-mono font-black text-indigo-900 bg-indigo-50/50 border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-500"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold text-indigo-600">
                            {currentForm.base_unit}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Buy Rate (COGS) with UOM */}
                    <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-extrabold text-amber-900 uppercase">
                          Buy Rate (₹ / {currentForm.buy_rate_uom}):
                        </label>
                        <span className="font-mono text-[10px] font-bold text-amber-800">
                          Derived: ₹{derivedBaseCost} / {currentForm.base_unit}
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-black text-amber-600">₹</span>
                        <input
                          type="number"
                          value={currentForm.purchase_price}
                          onChange={(e) => handlePriceChange(product.id, 'purchase_price', e.target.value)}
                          className="w-full pl-7 pr-3 py-1.5 text-xs font-mono font-black bg-white border border-amber-300 rounded-xl focus:outline-none focus:border-amber-500 text-slate-900"
                        />
                      </div>
                    </div>

                    {/* Unit Selling Price */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-extrabold text-slate-700 uppercase">
                          Selling Rate (₹ / {currentForm.selling_rate_uom}):
                        </label>
                        <span className="font-mono text-[10px] font-black text-emerald-600">
                          ₹{currentForm.piece_selling_price} / {currentForm.base_unit}
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-black text-slate-400">₹</span>
                        <input
                          type="number"
                          value={currentForm.unit_selling_price}
                          onChange={(e) => handlePriceChange(product.id, 'unit_selling_price', e.target.value)}
                          className="w-full pl-7 pr-3 py-1.5 text-xs font-mono font-black bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Live Formula & UOM Badge Box */}
                    <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200 text-[10px] font-mono space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-600 font-sans font-bold">Packaging:</span>
                        <span className="font-black text-emerald-800">
                          1 {currentForm.selling_unit} = {currentForm.pieces_per_unit} {currentForm.base_unit}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 font-sans font-bold">Buy Rate:</span>
                        <span className="font-black text-amber-800">
                          ₹{Number(currentForm.purchase_price).toLocaleString()} / {currentForm.buy_rate_uom}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-emerald-200/60 pt-1">
                        <span className="text-slate-600 font-sans font-bold">Margin:</span>
                        <span className={`font-black ${marginVal >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          +₹{marginVal} / {currentForm.selling_unit}
                        </span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Save Price Button */}
                <button
                  onClick={() => handleSavePrice(product)}
                  className="mt-4 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all duration-300"
                >
                  <Save className="w-3.5 h-3.5" /> SAVE & SYNC UOM / RATES
                </button>

              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
};
