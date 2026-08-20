import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AlertTriangle, X, Save, Plus, Minus } from 'lucide-react';

export const DamageEntryModal = ({ onClose }) => {
  const { products, addDamage } = useApp();
  const [selectedProdId, setSelectedProdId] = useState(1);
  const [unitType, setUnitType] = useState('Tray');
  const [quantity, setQuantity] = useState(2);
  const [reason, setReason] = useState('Leakage / Burst');
  const [saving, setSaving] = useState(false);

  const selectedProduct = products.find(p => p.id === Number(selectedProdId)) || products[0];
  const calculatedCost = quantity * (selectedProduct ? selectedProduct.purchase_price : 0);

  const handleSave = async () => {
    setSaving(true);
    const res = await addDamage({
      product_id: selectedProduct.id,
      product_name: selectedProduct.display_name,
      unit_type: unitType,
      quantity: Number(quantity),
      reason: reason,
      damage_cost: calculatedCost
    });
    setSaving(false);
    if (res.success) {
      alert("Damage record saved!");
      onClose();
    } else {
      alert("Error: " + res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            Damage / Wastage Entry
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Select */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Product</label>
          <select
            value={selectedProdId}
            onChange={(e) => setSelectedProdId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-500"
          >
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        </div>

        {/* Unit Type Toggle */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Unit Type</label>
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setUnitType(selectedProduct?.selling_unit || 'Tray')}
              className={`py-2 rounded-lg text-xs font-bold transition ${
                unitType === selectedProduct?.selling_unit ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600'
              }`}
            >
              {selectedProduct?.selling_unit || 'Tray'}
            </button>
            <button
              onClick={() => setUnitType(selectedProduct?.base_unit || 'Piece')}
              className={`py-2 rounded-lg text-xs font-bold transition ${
                unitType === selectedProduct?.base_unit ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600'
              }`}
            >
              {selectedProduct?.base_unit || 'Piece'}
            </button>
          </div>
        </div>

        {/* Quantity Stepper */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Quantity Damaged</label>
          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 rounded-xl bg-white border border-slate-300 text-slate-700 flex items-center justify-center font-extrabold text-xl shadow-sm"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-mono font-black text-xl text-slate-900">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-extrabold text-xl shadow-md glow-red"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Damage Reason */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Damage Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-rose-500"
          >
            <option value="Leakage / Burst">Leakage / Burst</option>
            <option value="Expired">Expired</option>
            <option value="Broken Bottle">Broken Bottle</option>
            <option value="Packaging Torn">Packaging Torn</option>
          </select>
        </div>

        {/* Damage Cost */}
        <div className="glass-card p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between">
          <span className="text-xs text-rose-900 font-extrabold">Calculated Damage Cost</span>
          <span className="font-mono font-black text-lg text-rose-700">
            ₹{calculatedCost.toLocaleString()}
          </span>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="touch-btn touch-btn-danger w-full text-base font-extrabold flex items-center justify-center gap-2 uppercase tracking-wider"
        >
          <Save className="w-5 h-5" />
          {saving ? 'SAVING...' : 'SAVE DAMAGE'}
        </button>

      </div>
    </div>
  );
};
