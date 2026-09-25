import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowLeft, ArrowRight, ShoppingBag, AlertTriangle, X, Search, Box } from 'lucide-react';
import { getOperationalUnit } from '../../utils/unitHelper';

export const BillingPOS = ({ shop, onProceedToPayment, onBack }) => {
  const { products, employeeStock } = useApp();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [quantities, setQuantities] = useState({});
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Extract categories dynamically
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category_name || p.selling_unit || 'General').filter(Boolean));
    return ['all', ...Array.from(cats)];
  }, [products]);

  // Helper to find stock info, operational unit, available stock, unit label, and selling rate
  const getProductStockInfo = (product) => {
    const stock = (employeeStock || []).find(item => item.product_id === product.id);
    const opUnit = getOperationalUnit(product);
    const piecesPerUnit = Math.max(1, Number(product.pieces_per_unit || 1));
    const heldUnits = Number(stock?.qty_units || 0);
    const basePieces = Math.floor(heldUnits * piecesPerUnit);

    if (opUnit.isPieceBased) {
      // Tray products: Milk, Curd -> strictly Piece-based
      const availableStock = basePieces;
      const rate = Number(product.piece_selling_price || (Number(product.unit_selling_price || 0) / piecesPerUnit) || 0);
      return {
        opUnit,
        basePieces,
        piecesPerUnit,
        availableStock,
        unitLabel: 'Pieces',
        shortUnit: 'Pieces',
        rate,
        isOutOfStock: availableStock <= 0
      };
    } else {
      // Non-Tray products: Case, Bag, Box -> configured operational bundle unit
      const availableStock = Math.floor(basePieces / piecesPerUnit);
      const rate = Number(product.unit_selling_price || (Number(product.piece_selling_price || 0) * piecesPerUnit) || 0);
      return {
        opUnit,
        basePieces,
        piecesPerUnit,
        availableStock,
        unitLabel: opUnit.pluralLabel,
        shortUnit: opUnit.label,
        rate,
        isOutOfStock: availableStock <= 0
      };
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const cat = p.category_name || p.selling_unit || 'General';
      const catMatch = selectedCategory === 'all' || cat.toLowerCase() === selectedCategory.toLowerCase();
      const nameMatch = !searchQuery || 
        p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return catMatch && nameMatch;
    });
  }, [products, selectedCategory, searchQuery]);

  const handleQtyChange = (product, val) => {
    const info = getProductStockInfo(product);
    if (info.availableStock <= 0) {
      showToast(`⚠️ ${product.display_name} is Out of Stock (0 ${info.unitLabel} available)`);
      setQuantities(prev => ({ ...prev, [product.id]: '' }));
      return;
    }

    if (val === '' || val === null || val === undefined) {
      setQuantities(prev => ({ ...prev, [product.id]: '' }));
      return;
    }
    const cleanVal = String(val).replace(/[^0-9]/g, '');
    if (cleanVal === '') {
      setQuantities(prev => ({ ...prev, [product.id]: '' }));
      return;
    }
    const num = parseInt(cleanVal, 10);
    if (num <= 0) {
      setQuantities(prev => ({ ...prev, [product.id]: '' }));
      return;
    }
    if (num > info.availableStock) {
      showToast(`⚠️ Only ${info.availableStock} ${info.unitLabel} available for ${product.display_name}`);
      setQuantities(prev => ({ ...prev, [product.id]: info.availableStock }));
      return;
    }
    setQuantities(prev => ({ ...prev, [product.id]: num }));
  };

  const activeCartItems = useMemo(() => {
    return Object.entries(quantities)
      .filter(([pid, q]) => {
        const prod = products.find(p => p.id === Number(pid));
        if (!prod) return false;
        const info = getProductStockInfo(prod);
        const qtyNum = Number(q) || 0;
        return !info.isOutOfStock && qtyNum > 0;
      })
      .map(([pid, q]) => {
        const prod = products.find(p => p.id === Number(pid));
        const info = getProductStockInfo(prod);
        const qtyNum = Math.min(Number(q) || 0, info.availableStock);
        return {
          product_id: Number(pid),
          product_name: prod ? prod.display_name : 'Product',
          unit_type: info.opUnit.operationalUnit,
          display_unit: info.unitLabel,
          qty: qtyNum,
          rate: info.rate,
          amount: Number((qtyNum * info.rate).toFixed(2))
        };
      });
  }, [quantities, products, employeeStock]);

  const totalItemsCount = activeCartItems.reduce((acc, item) => acc + item.qty, 0);
  const totalAmount = Number(activeCartItems.reduce((acc, item) => acc + item.amount, 0).toFixed(2));

  const handleProceed = () => {
    if (activeCartItems.length === 0) {
      showToast('⚠️ Please enter quantity for at least 1 in-stock product!');
      return;
    }

    if (!shop || !shop.id) {
      showToast('⚠️ Please select a shop first!');
      if (onBack) onBack();
      return;
    }

    onProceedToPayment({
      shop_id: shop.id,
      shop_name: shop.name,
      shop_code: shop.code,
      previous_due: Number(shop?.current_due || shop?.credit || shop?.due || 0),
      items: activeCartItems,
      total_items: totalItemsCount,
      total_amount: totalAmount
    });
  };

  const shopCredit = Number(shop?.current_due || shop?.credit || shop?.due || 0);

  return (
    <div className="max-w-md mx-auto p-3 sm:p-4 space-y-3.5 pb-32 sm:pb-36">
      
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-bounce">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition font-black text-xs flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK</span>
        </button>
        <div className="text-center min-w-0 px-2">
          <h2 className="text-sm sm:text-base font-black text-slate-900 truncate">
            {shop?.name || 'Quick Sale POS'}
          </h2>
          <p className="text-[11px] text-blue-600 font-bold font-mono truncate">
            {shop?.code ? `Code: ${shop.code}` : 'Direct Delivery'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[9px] uppercase font-extrabold text-amber-700 block leading-tight">Credit</span>
          <span className={`font-mono font-black text-sm sm:text-base ${shopCredit > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
            ₹{shopCredit.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Search & Category Tabs */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by name / barcode..."
            className="w-full bg-white border border-slate-200 shadow-xs rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition capitalize cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat === 'all' ? 'All Items' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product List: Compact One Product Per Row */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
          <Box className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="font-bold text-slate-600 text-sm">No products found</p>
          <p className="text-xs text-slate-400 mt-0.5">Try searching with a different keyword or category.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:gap-2.5">
          {filteredProducts.map(prod => {
            const info = getProductStockInfo(prod);
            const isOutOfStock = info.isOutOfStock;
            const rawQty = isOutOfStock ? '' : (quantities[prod.id] ?? '');
            const qtyNum = isOutOfStock ? 0 : (Number(rawQty) || 0);
            const lineTotal = isOutOfStock ? 0 : Number((qtyNum * info.rate).toFixed(2));

            return (
              <div
                key={prod.id}
                className={`rounded-2xl p-2.5 sm:p-3 border transition-all duration-150 shadow-xs flex items-center justify-between gap-2.5 min-w-0 ${
                  isOutOfStock
                    ? 'bg-slate-50/70 border-slate-200/70 opacity-80'
                    : qtyNum > 0
                    ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/10'
                    : 'bg-white border-slate-200/90 hover:border-blue-300'
                }`}
              >
                
                {/* Left: Product Image Container (64px–76px) */}
                <div className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl border shrink-0 overflow-hidden flex items-center justify-center p-1.5 shadow-inner ${
                  isOutOfStock ? 'bg-slate-100 border-slate-200' : 'bg-slate-50 border-slate-200/80'
                }`}>
                  {prod.image_url ? (
                    <img
                      src={prod.image_url}
                      alt={prod.display_name}
                      className={`h-full w-full object-contain rounded-xl ${isOutOfStock ? 'grayscale opacity-60' : ''}`}
                      loading="lazy"
                    />
                  ) : (
                    <span className={`text-2xl sm:text-3xl ${isOutOfStock ? 'opacity-50' : ''}`}>{prod.icon || '📦'}</span>
                  )}
                </div>

                {/* Center: Product Name & Stock Info / OUT OF STOCK badge */}
                <div className="min-w-0 flex-1 pl-0.5">
                  <h3 className={`font-extrabold text-xs sm:text-sm leading-tight truncate ${
                    isOutOfStock ? 'text-slate-600' : 'text-slate-900'
                  }`}>
                    {prod.display_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[11px] font-bold ${
                      isOutOfStock ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      Stock: <strong className={isOutOfStock ? 'text-rose-500 font-mono font-bold' : 'text-indigo-600 font-black font-mono'}>{info.availableStock} {info.unitLabel}</strong>
                    </span>
                    {isOutOfStock && (
                      <span className="text-[9.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-100/90 text-rose-700 border border-rose-200/80">
                        OUT OF STOCK
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: QTY Numeric Input & Calculated Amount */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  {/* Clean Numeric Input Only */}
                  <div className={`flex items-center gap-1 px-2 py-1.5 rounded-xl border ${
                    isOutOfStock ? 'bg-slate-100/80 border-slate-200 opacity-60' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <label htmlFor={`qty-${prod.id}`} className="text-[10px] font-black uppercase text-slate-500 select-none">
                      QTY
                    </label>
                    <input
                      id={`qty-${prod.id}`}
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min="0"
                      max={isOutOfStock ? 0 : info.availableStock}
                      disabled={isOutOfStock}
                      value={rawQty}
                      placeholder={isOutOfStock ? '-' : '0'}
                      onFocus={(e) => !isOutOfStock && e.target.select()}
                      onChange={(e) => handleQtyChange(prod, e.target.value)}
                      className={`w-12 sm:w-14 rounded-lg py-1 px-1 text-center font-mono font-black text-xs sm:text-sm focus:outline-none shadow-2xs ${
                        isOutOfStock
                          ? 'bg-slate-200/50 text-slate-400 border-slate-200 cursor-not-allowed pointer-events-none select-none'
                          : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-text'
                      }`}
                    />
                  </div>

                  {/* Calculated Line Amount */}
                  <div className="text-right min-w-[65px] sm:min-w-[75px]">
                    <span className={`font-mono font-black text-sm sm:text-base block leading-tight ${
                      isOutOfStock ? 'text-slate-400' : qtyNum > 0 ? 'text-emerald-600' : 'text-slate-500'
                    }`}>
                      ₹{lineTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Summary & Proceed Section in Natural Flow */}
      <div className="pt-2 space-y-3">
        {/* Total Amount Card */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <span className="text-xs sm:text-sm font-black uppercase text-slate-700 tracking-wide">
            TOTAL AMOUNT {totalItemsCount > 0 && <span className="text-slate-400 font-normal">({totalItemsCount} items)</span>}
          </span>
          <span className="font-mono font-black text-xl sm:text-2xl text-emerald-600">
            ₹{totalAmount.toFixed(2)}
          </span>
        </div>

        {/* Proceed Primary Button */}
        <button
          onClick={handleProceed}
          disabled={totalItemsCount === 0}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:via-indigo-700 hover:to-blue-800 text-white font-black text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xl shadow-indigo-600/30 transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none min-h-[52px] cursor-pointer"
        >
          <span>PROCEED</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

    </div>
  );
};
