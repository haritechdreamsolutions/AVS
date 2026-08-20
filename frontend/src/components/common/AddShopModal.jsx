import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Store, X, Save, Snowflake } from 'lucide-react';
import { toast } from 'sonner';

export const AddShopModal = ({ onClose }) => {
  const { addShop } = useApp();
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [distance, setDistance] = useState('4.5 km');
  const [routeId, setRouteId] = useState(1);
  const [hasFreezer, setHasFreezer] = useState(false);
  const [freezerModel, setFreezerModel] = useState('Blue Star 300L Visicooler');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter shop name!");
      return;
    }

    setSaving(true);
    const res = await addShop({
      name,
      owner_name: ownerName,
      phone,
      distance,
      route_id: routeId,
      has_freezer: hasFreezer,
      freezer_model: freezerModel
    });
    setSaving(false);

    if (res.success) {
      toast.success(`New Shop "${res.shop.name}" (${res.shop.code}) added to Route A!`);
      onClose();
    } else {
      toast.error("Error adding shop: " + res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-600" />
            Add New Shop (புது கடை சேர்க்க)
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shop Name */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Shop Name (கடை பெயர்)</label>
          <input
            type="text"
            placeholder="e.g. Lakshmi Store"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Owner Name & Phone */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-extrabold text-slate-500 uppercase">Owner Name</label>
            <input
              type="text"
              placeholder="e.g. Lakshmanan"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-extrabold text-slate-500 uppercase">Phone Number</label>
            <input
              type="text"
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
            />
          </div>
        </div>

        {/* Route Assignment */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Assign to Route</label>
          <select
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
          >
            <option value="1">Route A (Assigned to Tharun)</option>
          </select>
        </div>

        {/* Distance */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Distance (KM)</label>
          <input
            type="text"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
          />
        </div>

        {/* Provide Free Freezer Option */}
        <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-2xl space-y-2">
          <label className="flex items-center gap-2 text-xs font-black text-cyan-900 cursor-pointer">
            <input
              type="checkbox"
              checked={hasFreezer}
              onChange={(e) => setHasFreezer(e.target.checked)}
              className="w-4 h-4 text-cyan-600 rounded"
            />
            <Snowflake className="w-4 h-4 text-cyan-600" />
            Provide Free Freezer Asset 🧊
          </label>
          {hasFreezer && (
            <input
              type="text"
              placeholder="Freezer Model / Capacity"
              value={freezerModel}
              onChange={(e) => setFreezerModel(e.target.value)}
              className="w-full bg-white border border-cyan-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900"
            />
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="touch-btn touch-btn-primary w-full text-base font-extrabold flex items-center justify-center gap-2 uppercase tracking-wider"
        >
          <Save className="w-5 h-5" />
          {saving ? 'SAVING SHOP...' : 'SAVE NEW SHOP'}
        </button>

      </div>
    </div>
  );
};
