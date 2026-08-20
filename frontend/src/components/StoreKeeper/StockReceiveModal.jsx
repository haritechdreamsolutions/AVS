import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowDownLeft, X, Save } from 'lucide-react';
import { toast } from 'sonner';

const PRODUCT_IMAGES = {
  1: '/images/amirthaa_milk_200ml.png',
  5: '/images/amirthaa_milk_500ml.png',
  6: '/images/amirthaa_milk_1l.jpg',
  7: '/images/amirthaa_curd_200ml.jpg',
  8: '/images/amirthaa_curd_500ml.jpg',
  9: '/images/amirthaa_curd_1l.jpg',
  10: '/images/coccola_200ml.png',
  3: '/images/coccola_500ml.png',
  11: '/images/coccola_1l.png',
  12: '/images/juice_hero.jpg',
  15: '/images/tata_hero.jpg',
  18: '/images/aquafresh_water_200ml.png',
  19: '/images/aquafresh_water_500ml.png',
  2: '/images/aquafresh_water_1l.png',
  20: '/images/aquafresh_water_2l.png'
};

export const StockReceiveModal = ({ onClose }) => {
  const { products, receiveDealerStock } = useApp();
  const [dealerName, setDealerName] = useState('ABC Distributors');
  const [productQuantities, setProductQuantities] = useState({ 1: 50, 2: 50, 3: 30, 4: 100 });
  const [saving, setSaving] = useState(false);

  const handleQtyChange = (id, val) => {
    setProductQuantities(prev => ({ ...prev, [id]: Number(val) }));
  };

  const handleSave = async () => {
    setSaving(true);
    const items = Object.entries(productQuantities).map(([pid, q]) => ({
      product_id: Number(pid),
      quantity: q
    }));
    await receiveDealerStock({ dealer_name: dealerName, items });
    setSaving(false);
    toast.success("Dealer stock received into warehouse successfully!");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
            <ArrowDownLeft className="w-5 h-5 text-blue-600" />
            Receive Stock from Dealer
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dealer Name Input */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Dealer Name</label>
          <input
            type="text"
            value={dealerName}
            onChange={(e) => setDealerName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Quantities Table */}
        <div className="space-y-2">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Quantities to Receive</label>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {products.map(prod => {
              const imgUrl = PRODUCT_IMAGES[prod.id] || prod.image || `/images/amirthaa_milk_200ml.png`;
              const isJpg = imgUrl.endsWith('.jpg');
              return (
                <div key={prod.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center p-0.5 shadow-sm">
                      <img
                        src={imgUrl}
                        alt={prod.display_name}
                        className="w-full h-full object-contain rounded-md"
                      />
                    </div>
                    <span className="font-extrabold text-slate-900 truncate">{prod.display_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono shrink-0">
                    <input
                      type="number"
                      value={productQuantities[prod.id] || 0}
                      onChange={(e) => handleQtyChange(prod.id, e.target.value)}
                      className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-right text-slate-900 font-black text-sm"
                    />
                    <span className="text-slate-600 font-bold text-[11px]">{prod.selling_unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="touch-btn touch-btn-primary w-full text-base font-extrabold flex items-center justify-center gap-2 uppercase tracking-wider"
        >
          <Save className="w-5 h-5" />
          {saving ? 'SAVING...' : 'CONFIRM STOCK RECEIVE'}
        </button>
      </div>
    </div>
  );
};
