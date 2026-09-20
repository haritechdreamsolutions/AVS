import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowDownLeft, X, Save } from 'lucide-react';
import { toast } from 'sonner';

export const StockReceiveModal = ({ onClose }) => {
  const { products = [], receiveDealerStock } = useApp();
  const [dealerName, setDealerName] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [productQuantities, setProductQuantities] = useState({});
  const [saving, setSaving] = useState(false);

  // Inactive products must NOT appear in Stock Receive product selection
  const activeProducts = useMemo(() => {
    return (products || []).filter(p => p.is_active !== false && p.is_active !== 0);
  }, [products]);

  const handleQtyChange = (id, val) => {
    const num = Math.max(0, parseInt(val || 0, 10));
    setProductQuantities(prev => ({ ...prev, [id]: num }));
  };

  const handleSave = async () => {
    const items = Object.entries(productQuantities)
      .filter(([_, q]) => q > 0)
      .map(([pid, q]) => {
        const prod = activeProducts.find(p => p.id === Number(pid)) || products.find(p => p.id === Number(pid));
        return {
          product_id: Number(pid),
          quantity: q,
          unit: prod ? prod.selling_unit : 'Tray'
        };
      });

    if (items.length === 0) {
      toast.error('Please enter at least 1 product quantity to receive.');
      return;
    }

    setSaving(true);
    const res = await receiveDealerStock({
      dealer_name: dealerName || 'Direct Supplier',
      reference: referenceNo || null,
      items
    });
    setSaving(false);

    if (res.success) {
      toast.success('Dealer stock received into warehouse successfully!');
      onClose();
    } else {
      toast.error(res.message || 'Failed to receive stock');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-4 sm:p-5 space-y-4 shadow-2xl max-h-[92dvh] overflow-y-auto my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
            <ArrowDownLeft className="w-5 h-5 text-blue-600" />
            Receive Stock from Supplier / Buyer
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Supplier Info */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-500 uppercase">Supplier / Buyer</label>
            <input
              type="text"
              placeholder="e.g. Dairy Plant"
              value={dealerName}
              onChange={(e) => setDealerName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-500 uppercase">DC / Ref #</label>
            <input
              type="text"
              placeholder="e.g. DC-1049"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Quantities Table */}
        <div className="space-y-2">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Quantities to Receive (Trays / Units)</label>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {activeProducts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No active products available to receive.</p>
            ) : (
              activeProducts.map(prod => (
                <div key={prod.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{prod.icon || '📦'}</span>
                    <div className="truncate">
                      <span className="font-extrabold text-slate-900 block truncate">{prod.display_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">Current: {prod.warehouse_stock_units || 0} {prod.selling_unit}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono shrink-0">
                    <input
                      type="number"
                      min="0"
                      value={productQuantities[prod.id] || ''}
                      placeholder="0"
                      onChange={(e) => handleQtyChange(prod.id, e.target.value)}
                      className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-right text-slate-900 font-black text-sm"
                    />
                    <span className="text-slate-600 font-bold text-[11px]">{prod.selling_unit || 'Tray'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSave}
          disabled={saving || activeProducts.length === 0}
          className="touch-btn touch-btn-primary w-full text-sm font-extrabold flex items-center justify-center gap-2 uppercase tracking-wider disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'SAVING...' : 'CONFIRM STOCK RECEIVE'}
        </button>
      </div>
    </div>
  );
};
