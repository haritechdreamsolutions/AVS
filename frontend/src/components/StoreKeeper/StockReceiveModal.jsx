import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowDownLeft, X, Save, Building2, Tag, DollarSign, Calculator } from 'lucide-react';
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

  // Get effective buy rate for a product based on selected company
  const getProductBuyRate = (prod) => {
    if (customRates[prod.id] !== undefined && customRates[prod.id] !== '') {
      return Number(customRates[prod.id]);
    }
    const companyRates = currentSupplier?.product_rates || {};
    if (companyRates[prod.id] !== undefined && companyRates[prod.id] !== '' && !isNaN(Number(companyRates[prod.id]))) {
      return Number(companyRates[prod.id]);
    }
    return Number(prod.base_price || prod.purchase_price || 0);
  };

  const handleQtyChange = (id, val) => {
    const num = Math.max(0, parseInt(val || 0, 10));
    setProductQuantities(prev => ({ ...prev, [id]: num }));
  };

  // Totals calculations
  const { totalItemsCount, totalPurchaseAmount } = useMemo(() => {
    let count = 0;
    let amount = 0;

    activeProducts.forEach(prod => {
      const q = Number(productQuantities[prod.id] || 0);
      if (q > 0) {
        count += q;
        const r = getProductBuyRate(prod);
        amount += (q * r);
      }
    });

    return { totalItemsCount: count, totalPurchaseAmount: amount };
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

                return (
                  <div 
                    key={prod.id} 
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-2xl border transition-all gap-2.5 ${
                      qty > 0 ? 'bg-blue-50/60 border-blue-300 shadow-xs' : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
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
                          <span className="text-blue-700 font-bold bg-blue-100/70 px-1.5 py-0.2 rounded">
                            Buy Rate: ₹{rate.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                      {/* Line total amount display */}
                      {qty > 0 && (
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 block">Total:</span>
                          <span className="text-xs font-black text-blue-900 font-mono">
                            ₹{itemTotal.toFixed(2)}
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
                          className="w-16 bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-2.5 py-1.5 text-right text-slate-900 font-black text-sm shadow-sm focus:outline-none"
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
          disabled={saving || activeProducts.length === 0 || totalItemsCount === 0}
          className="touch-btn touch-btn-primary w-full text-sm font-extrabold flex items-center justify-center gap-2 uppercase tracking-wider disabled:opacity-50 shadow-lg shadow-blue-500/20 py-3 rounded-2xl"
        >
          <Save className="w-4 h-4" />
          {saving ? 'SAVING STOCK...' : 'CONFIRM STOCK RECEIVE'}
        </button>
      </div>
    </div>
  );
};
