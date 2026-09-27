import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowDownLeft, X, Save, Building2, Tag, DollarSign, Calculator, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export const StockReceiveModal = ({ onClose }) => {
  const { products = [], suppliers = [], receiveDealerStock } = useApp();
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [customSupplierName, setCustomSupplierName] = useState('');
  const [productQuantities, setProductQuantities] = useState({});
  const [customRates, setCustomRates] = useState({});
  const [saving, setSaving] = useState(false);

  // Active suppliers from database
  const activeSuppliers = useMemo(() => {
    return (suppliers || []).filter(s => s.is_active !== false && s.is_active !== 0);
  }, [suppliers]);

  // Set default selected supplier if activeSuppliers exist
  React.useEffect(() => {
    if (activeSuppliers.length > 0 && !selectedSupplierId) {
      setSelectedSupplierId(String(activeSuppliers[0].id));
    }
  }, [activeSuppliers, selectedSupplierId]);

  // Inactive products must NOT appear in Stock Receive product selection
  const activeProducts = useMemo(() => {
    return (products || []).filter(p => p.is_active !== false && p.is_active !== 0);
  }, [products]);

  // Current selected supplier object
  const currentSupplier = useMemo(() => {
    if (selectedSupplierId === 'CUSTOM' || selectedSupplierId === 'OTHER') return null;
    return activeSuppliers.find(s => String(s.id) === String(selectedSupplierId));
  }, [activeSuppliers, selectedSupplierId]);

  // Get effective buy rate for a product strictly based on owner configured company rate
  const getProductBuyRate = (prod) => {
    if (customRates[prod.id] !== undefined && customRates[prod.id] !== '') {
      return Number(customRates[prod.id]);
    }
    if (currentSupplier) {
      const companyRates = currentSupplier.product_rates || {};
      const rateVal = companyRates[prod.id];
      if (rateVal !== undefined && rateVal !== null && rateVal !== '' && !isNaN(Number(rateVal))) {
        return Number(rateVal);
      }
      // Strictly 0 if owner has not assigned a buy rate for this company & product
      return 0;
    }
    return 0;
  };

  const handleQtyChange = (id, val) => {
    const num = Math.max(0, parseInt(val || 0, 10));
    const prod = activeProducts.find(p => p.id === Number(id));
    if (num > 0 && prod && getProductBuyRate(prod) <= 0) {
      toast.warning(`Buy Rate is not assigned for "${prod.display_name}". Please set rate in Owner Login.`, { id: `rate-warn-${id}`, duration: 4000 });
    }
    setProductQuantities(prev => ({ ...prev, [id]: num }));
  };

  // Totals calculations
  const { totalItemsCount, totalPurchaseAmount, hasMissingRates } = useMemo(() => {
    let count = 0;
    let amount = 0;
    let missing = false;

    activeProducts.forEach(prod => {
      const q = Number(productQuantities[prod.id] || 0);
      if (q > 0) {
        count += q;
        const r = getProductBuyRate(prod);
        if (r <= 0) {
          missing = true;
        }
        amount += (q * r);
      }
    });

    return { totalItemsCount: count, totalPurchaseAmount: amount, hasMissingRates: missing };
  }, [activeProducts, productQuantities, currentSupplier, customRates]);

  const handleSave = async () => {
    let resolvedSupplierName = '';
    let resolvedSupplierId = null;

    if (selectedSupplierId === 'CUSTOM' || selectedSupplierId === 'OTHER') {
      resolvedSupplierName = customSupplierName.trim() || 'Direct Supplier';
    } else {
      if (currentSupplier) {
        resolvedSupplierId = currentSupplier.id;
        resolvedSupplierName = currentSupplier.name;
      } else {
        resolvedSupplierName = customSupplierName.trim() || 'Direct Supplier';
      }
    }

    const items = Object.entries(productQuantities)
      .filter(([_, q]) => q > 0)
      .map(([pid, q]) => {
        const prod = activeProducts.find(p => p.id === Number(pid)) || products.find(p => p.id === Number(pid));
        const rate = prod ? getProductBuyRate(prod) : 0;
        return {
          product_id: Number(pid),
          product_name: prod ? prod.display_name : `Product #${pid}`,
          quantity: q,
          unit: prod ? prod.selling_unit : 'Tray',
          rate: rate,
          total_amount: q * rate
        };
      });

    if (items.length === 0) {
      toast.error('Please enter at least 1 product quantity to receive.');
      return;
    }

    // STRICT VALIDATION: Block submission if any product with quantity > 0 has no buy rate assigned
    const unratedItems = items.filter(i => !i.rate || Number(i.rate) <= 0);
    if (unratedItems.length > 0) {
      const names = unratedItems.map(i => i.product_name).join(', ');
      toast.error(`Cannot receive stock! Buy Rate is not assigned for: "${names}". Please assign Buy Rate in Owner Login.`, { duration: 6000 });
      return;
    }

    setSaving(true);
    const res = await receiveDealerStock({
      supplier_id: resolvedSupplierId,
      supplier_name: resolvedSupplierName,
      dealer_name: resolvedSupplierName,
      items
    });
    setSaving(false);

    if (res.success) {
      toast.success(`Stock received successfully from ${resolvedSupplierName}! (Total: ₹${totalPurchaseAmount.toFixed(2)})`);
      onClose();
    } else {
      toast.error(res.message || 'Failed to receive stock');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-4 sm:p-5 space-y-4 shadow-2xl max-h-[94dvh] overflow-y-auto my-auto animate-scale-in">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-900">
                Receive Stock from Supplier
              </h3>
              <p className="text-[11px] font-medium text-slate-500">சப்ளையர் வரவு & கொள்முதல் கணக்கீடு</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Production Company / Supplier Selection */}
        <div className="space-y-1.5 bg-blue-50/60 p-3 rounded-2xl border border-blue-100">
          <label className="text-[11px] font-black text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            Production Company / சப்ளையர் கம்பெனி
          </label>
          <select
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(e.target.value)}
            className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
          >
            {activeSuppliers.map(s => (
              <option key={s.id} value={s.id}>
                🏭 {s.name} {s.code ? `(${s.code})` : ''}
              </option>
            ))}
            <option value="CUSTOM">+ Enter Custom / Other Supplier Name</option>
          </select>

          {/* Conditional Custom Name Input if 'CUSTOM' selected */}
          {selectedSupplierId === 'CUSTOM' && (
            <div className="pt-2">
              <input
                type="text"
                placeholder="Enter Company / Supplier Name..."
                value={customSupplierName}
                onChange={(e) => setCustomSupplierName(e.target.value)}
                className="w-full bg-white border border-blue-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Quantities & Price Calculation Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Quantities to Receive (வரவு அளவு)
            </label>
            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
              <Tag className="w-3 h-3 text-blue-600" />
              Company Buy Rate Applied
            </span>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {activeProducts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No active products available to receive.</p>
            ) : (
              activeProducts.map(prod => {
                const rate = getProductBuyRate(prod);
                const qty = Number(productQuantities[prod.id] || 0);
                const itemTotal = qty * rate;

                const isUnassignedWithQty = qty > 0 && rate <= 0;

                return (
                  <div 
                    key={prod.id} 
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-2xl border transition-all gap-2.5 ${
                      isUnassignedWithQty
                        ? 'bg-rose-50/90 border-rose-300 ring-1 ring-rose-300 shadow-xs'
                        : qty > 0 
                          ? 'bg-blue-50/60 border-blue-300 shadow-xs' 
                          : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl shrink-0">{prod.icon || '🥛'}</span>
                      <div className="truncate">
                        <span className="font-extrabold text-slate-900 block truncate text-xs">
                          {prod.display_name}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                          <span>Stock: {prod.warehouse_stock_units || 0} {prod.selling_unit}</span>
                          <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                            rate > 0 
                              ? 'text-blue-800 bg-blue-100 border border-blue-200' 
                              : isUnassignedWithQty
                                ? 'text-rose-700 bg-rose-100 border border-rose-300 font-black'
                                : 'text-slate-400 bg-slate-100 border border-slate-200'
                          }`}>
                            {rate > 0 ? `Buy Rate: ₹${rate.toFixed(2)}` : '⚠️ Buy Rate Not Set (₹0.00)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                      {/* Line total amount display */}
                      {qty > 0 && (
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 block">Total:</span>
                          <span className={`text-xs font-black font-mono ${rate > 0 ? 'text-blue-900' : 'text-rose-600'}`}>
                            {rate > 0 ? `₹${itemTotal.toFixed(2)}` : 'Rate Required'}
                          </span>
                        </div>
                      )}

                      {/* Quantity Input */}
                      <div className="flex items-center gap-1.5 font-mono shrink-0">
                        <input
                          type="number"
                          min="0"
                          value={productQuantities[prod.id] || ''}
                          placeholder="0"
                          onChange={(e) => handleQtyChange(prod.id, e.target.value)}
                          className={`w-16 bg-white border rounded-xl px-2.5 py-1.5 text-right font-black text-sm shadow-sm focus:outline-none ${
                            isUnassignedWithQty 
                              ? 'border-rose-400 text-rose-800 focus:border-rose-600 ring-1 ring-rose-200' 
                              : 'border-slate-300 text-slate-900 focus:border-blue-500'
                          }`}
                        />
                        <span className="text-slate-600 font-bold text-[11px] w-9 text-left">
                          {prod.selling_unit || 'Tray'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* MISSING BUY RATE WARNING ALERT BANNER */}
        {hasMissingRates && (
          <div className="bg-rose-50 border border-rose-300 text-rose-800 px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-2xs animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>விலை நிர்ணயிக்கப்படாத பொருட்களுக்கு Stock Receive செய்ய முடியாது. Owner Login-ல் Buy Rate பதிவு செய்யவும்!</span>
          </div>
        )}

        {/* REAL-TIME TOTAL SUMMARY BANNER */}
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-md">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Inward Quantity
            </span>
            <p className="text-base font-black text-white">
              {totalItemsCount} <span className="text-xs text-slate-300 font-normal">Trays/Units</span>
            </p>
          </div>

          <div className="text-right space-y-0.5">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
              Total Purchase Amount (கொள்முதல் தொகை)
            </span>
            <p className="text-lg font-black text-emerald-300 font-mono">
              ₹{totalPurchaseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSave}
          disabled={saving || activeProducts.length === 0 || totalItemsCount === 0 || hasMissingRates}
          className="touch-btn touch-btn-primary w-full text-sm font-extrabold flex items-center justify-center gap-2 uppercase tracking-wider disabled:opacity-50 shadow-lg shadow-blue-500/20 py-3 rounded-2xl"
        >
          <Save className="w-4 h-4" />
          {saving ? 'SAVING STOCK...' : (hasMissingRates ? 'SET BUY RATE IN OWNER LOGIN TO RECEIVE' : 'CONFIRM STOCK RECEIVE')}
        </button>
      </div>
    </div>
  );
};
