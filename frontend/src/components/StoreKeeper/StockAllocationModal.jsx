import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowUpRight, X, Save } from 'lucide-react';
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

export const StockAllocationModal = ({ onClose }) => {
  const { products, allocateStock } = useApp();
  const [employeeId, setEmployeeId] = useState(1);
  const [empName, setEmpName] = useState('Tharun');
  const [allocations, setAllocations] = useState({ 1: 10, 2: 5, 3: 8, 4: 20 });
  const [saving, setSaving] = useState(false);

  const handleQtyChange = (id, val) => {
    setAllocations(prev => ({ ...prev, [id]: Number(val) }));
  };

  const handleSave = async () => {
    setSaving(true);
    const items = Object.entries(allocations).map(([pid, q]) => {
      const prod = products.find(p => p.id === Number(pid));
      return {
        product_id: Number(pid),
        quantity: q,
        unit: prod ? prod.selling_unit : 'Tray'
      };
    });

    await allocateStock({
      employee_id: Number(employeeId),
      employee_name: empName,
      items
    });

    setSaving(false);
    toast.success(`Stock allocated to vehicle of ${empName}!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
            <ArrowUpRight className="w-5 h-5 text-indigo-600" />
            Allocate Stock to Employee Vehicle
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Employee Select */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Employee</label>
          <select
            value={employeeId}
            onChange={(e) => {
              setEmployeeId(e.target.value);
              setEmpName(e.target.options[e.target.selectedIndex].text);
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
          >
            <option value="1">Tharun (TN 32 XX 2222)</option>
            <option value="2">Kumar (TN 32 AB 1234)</option>
            <option value="3">Suresh (TN 32 CD 5678)</option>
            <option value="4">Mani (TN 32 BF 9012)</option>
          </select>
        </div>

        {/* Quantities Table */}
        <div className="space-y-2">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Quantities to Load</label>
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
                      value={allocations[prod.id] || 0}
                      onChange={(e) => handleQtyChange(prod.id, e.target.value)}
                      className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-right text-slate-900 font-black text-sm"
                    />
                    <span className="text-slate-600 font-bold text-[11px]">Pcs</span>
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
          className="touch-btn touch-btn-primary w-full text-base font-extrabold bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-2 uppercase tracking-wider"
        >
          <Save className="w-5 h-5" />
          {saving ? 'ALLOCATING...' : 'CONFIRM VEHICLE ALLOCATION'}
        </button>
      </div>
    </div>
  );
};
