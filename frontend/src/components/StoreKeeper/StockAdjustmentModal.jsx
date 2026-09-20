import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Wrench, X, Plus, Minus, CheckCircle2, AlertTriangle, Scale, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export const StockAdjustmentModal = ({ onClose }) => {
  const { products = [], adjustStock } = useApp();

  const activeProducts = useMemo(() => {
    return (products || []).filter(p => p.is_active !== false && p.is_active !== 0);
  }, [products]);

  const [productId, setProductId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('ADD'); // ADD, SUBTRACT, SET
  const [unitType, setUnitType] = useState('Tray');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('Physical count correction');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedProduct = activeProducts.find(p => p.id === Number(productId)) || products.find(p => p.id === Number(productId));
  const currentUnits = selectedProduct ? Number(selectedProduct.warehouse_stock_units || 0) : 0;
  const ppu = selectedProduct ? Math.max(1, Number(selectedProduct.pieces_per_unit || 1)) : 1;
  const currentPieces = Math.round(currentUnits * ppu);

  const numQty = parseFloat(quantity) || 0;
  const isPiece = (unitType || '').toLowerCase() === 'piece';
  const deltaUnits = isPiece ? parseFloat((numQty / ppu).toFixed(4)) : numQty;

  let projectedUnits = currentUnits;
  if (selectedProduct && numQty > 0) {
    if (adjustmentType === 'ADD') {
      projectedUnits = parseFloat((currentUnits + deltaUnits).toFixed(2));
    } else if (adjustmentType === 'SUBTRACT') {
      projectedUnits = parseFloat((currentUnits - deltaUnits).toFixed(2));
    } else if (adjustmentType === 'SET') {
      projectedUnits = deltaUnits;
    }
  }
  const isNegativeProjected = projectedUnits < 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!productId) {
      toast.error('Please select a product to adjust.');
      return;
    }
    if (!numQty || numQty <= 0 || isNaN(numQty)) {
      toast.error('Adjustment quantity must be greater than zero.');
      return;
    }
    if (!reason || !reason.trim()) {
      toast.error('Adjustment reason is mandatory for audit verification.');
      return;
    }
    if (isNegativeProjected) {
      toast.error(`Cannot reduce stock below 0! Current stock is ${currentUnits} ${selectedProduct?.selling_unit || 'Trays'}.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        product_id: Number(productId),
        quantity: numQty,
        unit_type: unitType,
        adjustment_type: adjustmentType,
        reason: reason.trim(),
        notes: notes ? notes.trim() : ''
      };

      const res = await adjustStock(payload);
      if (res && res.success) {
        toast.success(`🎉 Stock adjusted successfully! ${res.product_name || selectedProduct?.display_name} updated to ${res.new_warehouse_stock_units} Trays.`);
        onClose();
      } else {
        toast.error(res?.message || 'Failed to adjust stock.');
      }
    } catch (err) {
      toast.error(err.message || 'Error executing stock adjustment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-4 sm:p-6 space-y-4 shadow-2xl my-auto max-h-[92dvh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">Warehouse Stock Adjustment</h3>
              <p className="text-xs text-slate-500 font-semibold">Audit-logged stock correction & reconciliation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-bold">
          {/* Product Selection */}
          <div>
            <label className="block text-slate-700 font-extrabold mb-1">Select Product *</label>
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                const p = activeProducts.find(x => x.id === Number(e.target.value)) || products.find(x => x.id === Number(e.target.value));
                if (p) setUnitType(p.selling_unit || 'Tray');
              }}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 font-bold"
              required
            >
              <option value="">-- Choose Warehouse Product --</option>
              {activeProducts.map(p => (
                <option key={p.id} value={p.id}>
                  {p.display_name} (Current: {p.warehouse_stock_units || 0} {p.selling_unit || 'Trays'})
                </option>
              ))}
            </select>
          </div>

          {/* Current Stock Preview Card */}
          {selectedProduct && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 font-extrabold uppercase block">Current Warehouse Stock</span>
                <span className="font-mono font-black text-sm text-slate-800">
                  {currentUnits} {selectedProduct.selling_unit || 'Trays'} ({currentPieces} Pcs)
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase block">Projected New Stock</span>
                <span className={`font-mono font-black text-sm ${isNegativeProjected ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {numQty > 0 ? `${projectedUnits} ${selectedProduct.selling_unit || 'Trays'}` : `${currentUnits} ${selectedProduct.selling_unit || 'Trays'}`}
                </span>
              </div>
            </div>
          )}

          {/* Adjustment Type Selector */}
          <div>
            <label className="block text-slate-700 font-extrabold mb-1">Adjustment Action *</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAdjustmentType('ADD')}
                className={`py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1 border transition ${
                  adjustmentType === 'ADD' 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> Add (Surplus)
              </button>

              <button
                type="button"
                onClick={() => setAdjustmentType('SUBTRACT')}
                className={`py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1 border transition ${
                  adjustmentType === 'SUBTRACT' 
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm' 
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Minus className="w-3.5 h-3.5" /> Remove (Loss)
              </button>

              <button
                type="button"
                onClick={() => setAdjustmentType('SET')}
                className={`py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1 border transition ${
                  adjustmentType === 'SET' 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Scale className="w-3.5 h-3.5" /> Set Exact
              </button>
            </div>
          </div>

          {/* Quantity & Unit Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-extrabold mb-1">Quantity *</label>
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="e.g. 5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 font-mono font-black"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-extrabold mb-1">Unit Type</label>
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 font-bold"
              >
                <option value={selectedProduct?.selling_unit || 'Tray'}>{selectedProduct?.selling_unit || 'Tray'}s</option>
                <option value="Piece">Pieces (Loose)</option>
              </select>
            </div>
          </div>

          {/* Mandatory Reason */}
          <div>
            <label className="block text-slate-700 font-extrabold mb-1">Mandatory Reason for Audit *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 font-bold"
              required
            >
              <option value="Physical count correction">Physical count correction</option>
              <option value="Supplier packaging discrepancy">Supplier packaging discrepancy</option>
              <option value="Warehouse shrinkage / spoilage">Warehouse shrinkage / spoilage</option>
              <option value="Initial stock setup">Initial stock setup</option>
              <option value="Other audited adjustment">Other audited adjustment</option>
            </select>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-slate-700 font-extrabold mb-1">Audit Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g., Verified by morning storekeeper audit"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 font-medium"
            />
          </div>

          {isNegativeProjected && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[11px] font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Stock cannot be reduced below zero.
            </div>
          )}

          {/* Submit CTA */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || isNegativeProjected || !productId || !numQty}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black flex items-center gap-1.5 shadow-md transition disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              {submitting ? 'RECORDING AUDIT...' : 'CONFIRM ADJUSTMENT'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
