import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowDownLeft, X, Save, Building2, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';

export const StockReceiveModal = ({ onClose }) => {
  const { products = [], suppliers = [], receiveDealerStock } = useApp();
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [customSupplierName, setCustomSupplierName] = useState('');
  const [productQuantities, setProductQuantities] = useState({});
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

  const handleQtyChange = (id, val) => {
    const num = Math.max(0, parseInt(val || 0, 10));
    setProductQuantities(prev => ({ ...prev, [id]: num }));
  };

  const handleSave = async () => {
    let resolvedSupplierName = '';
    let resolvedSupplierId = null;

    if (selectedSupplierId === 'CUSTOM' || selectedSupplierId === 'OTHER') {
      resolvedSupplierName = customSupplierName.trim() || 'Direct Supplier';
    } else {
      const found = activeSuppliers.find(s => String(s.id) === String(selectedSupplierId));
      if (found) {
        resolvedSupplierId = found.id;
        resolvedSupplierName = found.name;
      } else {
        resolvedSupplierName = customSupplierName.trim() || 'Direct Supplier';
      }
    }

    const items = Object.entries(productQuantities)
      .filter(([_, q]) => q > 0)
      .map(([pid, q]) => {
        const prod = activeProducts.find(p => p.id === Number(pid)) || products.find(p => p.id === Number(pid));
        return {
          product_id: Number(pid),
          quantity: q,
          unit: prod ? prod.selling_unit : 'Tray',
          rate: prod ? Number(prod.base_price || 0) : 0
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
      toast.success(`Stock received successfully from ${resolvedSupplierName}!`);
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
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-900">
                Receive Stock from Supplier
              </h3>
              <p className="text-[11px] font-medium text-slate-500">சப்ளையர் / கம்பெனி ஸ்டாக் வரவு</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Production Company / Supplier Selection */}
        <div className="space-y-1.5 bg-blue-50/50 p-3 rounded-2xl border border-blue-100">
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

        {/* Quantities Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Quantities to Receive (வரவு அளவு)
            </label>
            <span className="text-[10px] font-bold text-slate-400">Trays / Units</span>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {activeProducts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No active products available to receive.</p>
            ) : (
              activeProducts.map(prod => (
                <div key={prod.id} className="flex justify-between items-center bg-slate-50 hover:bg-slate-100/80 transition-colors p-2.5 rounded-xl border border-slate-200 text-xs gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg shrink-0">{prod.icon || '🥛'}</span>
                    <div className="truncate">
                      <span className="font-extrabold text-slate-900 block truncate">{prod.display_name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">Stock: {prod.warehouse_stock_units || 0} {prod.selling_unit}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono shrink-0">
                    <input
                      type="number"
                      min="0"
                      value={productQuantities[prod.id] || ''}
                      placeholder="0"
                      onChange={(e) => handleQtyChange(prod.id, e.target.value)}
                      className="w-16 bg-white border border-slate-300 focus:border-blue-500 rounded-lg px-2 py-1 text-right text-slate-900 font-black text-sm shadow-sm"
                    />
                    <span className="text-slate-600 font-bold text-[11px] w-10 text-left">{prod.selling_unit || 'Tray'}</span>
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
          className="touch-btn touch-btn-primary w-full text-sm font-extrabold flex items-center justify-center gap-2 uppercase tracking-wider disabled:opacity-50 shadow-lg shadow-blue-500/20"
        >
          <Save className="w-4 h-4" />
          {saving ? 'SAVING STOCK...' : 'CONFIRM STOCK RECEIVE'}
        </button>
      </div>
    </div>
  );
};

