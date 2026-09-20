import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { AlertTriangle, X, Save, Plus, Minus, Package, Layers } from 'lucide-react';

export const DamageEntryModal = ({ onClose }) => {
  const { products = [], addDamage } = useApp();
  const [selectedProdId, setSelectedProdId] = useState(products[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('Leakage / Burst');
  const [saving, setSaving] = useState(false);

  const selectedProduct = products.find(p => p.id === Number(selectedProdId)) || products[0];

  useEffect(() => {
    if (selectedProduct && (!selectedProdId || selectedProdId === '')) {
      setSelectedProdId(selectedProduct.id);
    }
  }, [selectedProduct, selectedProdId]);

  // Determine packaging type and calculation rules
  const sellingUnitName = selectedProduct?.selling_unit || 'Case';
  const baseUnitName = selectedProduct?.base_unit || 'Piece';
  const categoryName = (selectedProduct?.category_name || '').trim();
  const packageType = (selectedProduct?.package_type || '').trim();

  const isTray = (
    categoryName.toLowerCase() === 'tray' ||
    sellingUnitName.toLowerCase() === 'tray' ||
    packageType.toLowerCase() === 'tray'
  );

  const piecesPerUnit = Math.max(1, Number(selectedProduct?.pieces_per_unit || 1));
  const buyRatePerSellingUnit = Number(selectedProduct?.purchase_price || 0);
  const pieceBuyRate = piecesPerUnit > 0 ? (buyRatePerSellingUnit / piecesPerUnit) : buyRatePerSellingUnit;

  // Unit strictly determined by packaging type
  const activeDamageUnit = isTray ? (baseUnitName || 'Piece') : sellingUnitName;
  const numQty = Math.max(0, Number(quantity) || 0);

  // Cost calculation based strictly on package type
  const calculatedCost = isTray
    ? parseFloat((numQty * pieceBuyRate).toFixed(2))
    : parseFloat((numQty * buyRatePerSellingUnit).toFixed(2));

  const handleSave = async () => {
    if (!selectedProduct) {
      alert("Please select a product");
      return;
    }
    if (!numQty || numQty <= 0) {
      alert("Damage quantity must be greater than 0");
      return;
    }
    if (buyRatePerSellingUnit < 0) {
      alert("Product buy rate cannot be negative");
      return;
    }

    setSaving(true);
    const res = await addDamage({
      product_id: selectedProduct.id,
      product_name: selectedProduct.display_name,
      unit_type: activeDamageUnit,
      unit: activeDamageUnit,
      damage_unit: activeDamageUnit,
      quantity: numQty,
      reason: reason,
      damage_cost: calculatedCost
    });
    setSaving(false);
    if (res && res.success) {
      alert("Damage record saved!");
      onClose();
    } else {
      alert("Error: " + (res?.message || 'Failed to save damage entry'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-4 sm:p-5 space-y-4 shadow-2xl max-h-[92dvh] overflow-y-auto my-auto">
        
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
            value={selectedProduct?.id || selectedProdId}
            onChange={(e) => {
              const pid = Number(e.target.value);
              setSelectedProdId(pid);
              setQuantity(1);
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-500"
          >
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.display_name} ({p.category_name || (p.selling_unit?.toLowerCase() === 'tray' ? 'Tray' : p.selling_unit)})
              </option>
            ))}
          </select>
        </div>

        {/* Packaging / Unit Banner */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-100 rounded-xl border border-slate-200 text-xs">
          <span className="font-extrabold text-slate-600 flex items-center gap-1.5">
            {isTray ? <Layers className="w-3.5 h-3.5 text-amber-600" /> : <Package className="w-3.5 h-3.5 text-blue-600" />}
            Unit Rule:
          </span>
          <span className={`px-2 py-0.5 rounded-md font-black text-[11px] ${
            isTray ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {isTray ? `Tray Category → Pieces` : `Bundle Unit → ${sellingUnitName}`}
          </span>
        </div>

        {/* Quantity Stepper */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-extrabold text-slate-500 uppercase">Damage Quantity</label>
            <span className="text-[11px] font-black text-rose-600">Unit: {activeDamageUnit}</span>
          </div>
          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, (Number(quantity) || 1) - 1))}
              className="w-10 h-10 rounded-xl bg-white border border-slate-300 text-slate-700 flex items-center justify-center font-extrabold text-xl shadow-sm hover:bg-slate-100"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="flex items-center justify-center gap-1">
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                className="font-mono font-black text-xl text-slate-900 bg-transparent text-center w-20 focus:outline-none"
              />
              <span className="text-xs font-bold text-slate-500">{activeDamageUnit}</span>
            </div>
            <button
              type="button"
              onClick={() => setQuantity((Number(quantity) || 0) + 1)}
              className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-extrabold text-xl shadow-md glow-red hover:bg-rose-700"
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

        {/* Calculation Breakdown Box */}
        <div className="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200/80 space-y-2 text-xs">
          <div className="font-extrabold text-rose-900 border-b border-rose-200/60 pb-1.5 flex items-center justify-between">
            <span>Cost Calculation Breakdown</span>
            <span className="text-[10px] uppercase tracking-wider bg-rose-200/60 text-rose-800 px-2 py-0.5 rounded-md font-bold">
              {activeDamageUnit}
            </span>
          </div>

          <div className="space-y-1 text-slate-600">
            {isTray ? (
              <>
                <div className="flex justify-between">
                  <span>Buy Rate / {sellingUnitName}:</span>
                  <span className="font-mono font-bold text-slate-800">₹{buyRatePerSellingUnit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pieces / {sellingUnitName}:</span>
                  <span className="font-mono font-bold text-slate-800">{piecesPerUnit}</span>
                </div>
                <div className="flex justify-between">
                  <span>Piece Cost:</span>
                  <span className="font-mono font-bold text-slate-800">₹{pieceBuyRate.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span>Buy Rate / {sellingUnitName}:</span>
                <span className="font-mono font-bold text-slate-800">₹{buyRatePerSellingUnit.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span>Damage Qty:</span>
              <span className="font-mono font-bold text-slate-800">
                {numQty} {activeDamageUnit}{numQty > 1 && !activeDamageUnit.endsWith('s') && activeDamageUnit !== 'Piece' ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="border-t border-rose-200 pt-2 flex items-center justify-between">
            <span className="text-xs text-rose-950 font-black">Calculated Damage Cost:</span>
            <span className="font-mono font-black text-lg text-rose-700">
              ₹{calculatedCost.toFixed(2)}
            </span>
          </div>
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
