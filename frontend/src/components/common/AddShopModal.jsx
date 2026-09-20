import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Store, X, Save, Snowflake, CheckCircle2, MapPin, Route as RouteIcon } from 'lucide-react';
import { toast } from 'sonner';

export const AddShopModal = ({ onClose, villageId = null, villageName = null }) => {
  const { addShop, villages = [], routes = [] } = useApp();
  
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedVillageId, setSelectedVillageId] = useState(villageId ? String(villageId) : '');
  const [distanceKm, setDistanceKm] = useState('3.0');
  const [hasFreezer, setHasFreezer] = useState(false);
  const [freezerModel, setFreezerModel] = useState('Blue Star 300L Visicooler');
  const [saving, setSaving] = useState(false);
  const [createdShop, setCreatedShop] = useState(null);

  // Filter active villages for the company
  const activeVillages = useMemo(() => {
    return (villages || []).filter(v => v.status === 'ACTIVE' || v.is_active !== false);
  }, [villages]);

  // If no village selected initially and not passed via prop, default to first active village
  useEffect(() => {
    if (!selectedVillageId && !villageId && activeVillages.length > 0) {
      setSelectedVillageId(String(activeVillages[0].id));
    }
  }, [activeVillages, selectedVillageId, villageId]);

  // Derived Village and Route object
  const currentVillage = useMemo(() => {
    const vId = selectedVillageId ? Number(selectedVillageId) : (villageId ? Number(villageId) : null);
    if (!vId) return null;
    return activeVillages.find(v => Number(v.id) === vId) || null;
  }, [activeVillages, selectedVillageId, villageId]);

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!name.trim()) {
      toast.error("கடை பெயர் உள்ளிடவும்! (Please enter shop name)");
      return;
    }

    const finalVillageId = selectedVillageId ? Number(selectedVillageId) : (villageId ? Number(villageId) : null);
    if (!finalVillageId) {
      toast.error("கிராமம் தேர்வு செய்யவும்! (Please select a Village)");
      return;
    }

    const distNum = parseFloat(distanceKm);
    const parsedDistance = isNaN(distNum) || distNum < 0 ? 0 : distNum;

    setSaving(true);
    const res = await addShop({
      name: name.trim(),
      owner_name: ownerName ? ownerName.trim() : null,
      phone: phone ? phone.trim() : null,
      distance_km: parsedDistance,
      distance: `${parsedDistance} km`,
      village_id: finalVillageId,
      has_freezer: Boolean(hasFreezer),
      freezer_model: hasFreezer ? (freezerModel.trim() || 'Blue Star 300L Visicooler') : null
    });
    setSaving(false);

    if (res.success && res.shop) {
      setCreatedShop(res.shop);
      toast.success(`🎉 New Shop Created: ${res.shop.name} (Shop ID: ${res.shop.code})`);
    } else {
      toast.error("Error adding shop: " + (res.message || "Failed to add shop"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-sm sm:max-w-md w-full p-4 sm:p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-600" />
              Add New Shop (புது கடை சேர்க்க)
            </h3>
            {villageName && (
              <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                Village: <span className="text-slate-900 font-black">{villageName}</span>
                <span className="text-[10px] text-amber-600 font-medium ml-auto">(Auto-assigned)</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdShop ? (
          /* Post-creation Success Confirmation */
          <div className="py-4 space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-300 mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-lg text-slate-900">Shop Created Successfully!</h4>
              <p className="text-xs text-slate-500 font-medium">கடை வெற்றிகரமாக பதிவு செய்யப்பட்டது</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-500 uppercase">Shop ID:</span>
                <span className="font-mono font-black text-sm text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {createdShop.code}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-slate-500">Shop Name:</span>
                <span className="font-extrabold text-slate-900">{createdShop.name}</span>
              </div>
              {(createdShop.village_name || villageName) && (
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-500">Village:</span>
                  <span className="font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-600" />
                    {createdShop.village_name || villageName}
                  </span>
                </div>
              )}
              {createdShop.owner_name && (
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Owner:</span>
                  <span className="font-medium text-slate-800">{createdShop.owner_name}</span>
                </div>
              )}
              {createdShop.phone && (
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Phone:</span>
                  <span className="font-medium text-slate-800 font-mono">{createdShop.phone}</span>
                </div>
              )}
              {createdShop.route_name && (
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Route:</span>
                  <span className="font-medium text-slate-800">{createdShop.route_name}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setCreatedShop(null);
                  setName('');
                  setOwnerName('');
                  setPhone('');
                }}
                className="w-1/2 py-3 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition"
              >
                + Add Another Shop
              </button>
              <button
                onClick={onClose}
                className="w-1/2 py-3 px-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer transition shadow-md shadow-blue-600/20"
              >
                Done / Close
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* 1. Shop Name (Required) */}
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-700 uppercase">
                Shop Name (கடை பெயர்) *
              </label>
              <input
                type="text"
                placeholder="e.g. Lakshmi Store"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
                autoFocus
              />
            </div>

            {/* 2. Owner Name & Phone */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-700 uppercase">Owner Name</label>
                <input
                  type="text"
                  placeholder="e.g. Lakshmanan"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-700 uppercase">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
                />
              </div>
            </div>

            {/* 3. Village Selector (Required) */}
            {!villageId && (
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-700 uppercase flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-500" />
                  Village (கிராமம்) *
                </label>
                <select
                  value={selectedVillageId}
                  onChange={(e) => setSelectedVillageId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
                >
                  <option value="" disabled>-- Select Village (Required) --</option>
                  {activeVillages.length === 0 ? (
                    <option value="" disabled>No active villages found. Please create a village first.</option>
                  ) : (
                    activeVillages.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.code}) — Route: {v.route_name || 'Assigned'}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {/* 4. Auto-Derived Route Display (Read-Only) */}
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-700 uppercase flex items-center gap-1">
                <RouteIcon className="w-3.5 h-3.5 text-blue-500" />
                Route (வழித்தடம் — கிராமத்தின் படி தானாக நிர்ணயிக்கப்பட்டது)
              </label>
              <div className="w-full bg-indigo-50/70 border border-indigo-200 rounded-xl px-3 py-2.5 text-xs font-bold text-indigo-950 flex items-center justify-between shadow-2xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                  {currentVillage?.route_name ? `${currentVillage.route_name} (${currentVillage.route_code || 'Route'})` : (villageName ? `Auto Route for ${villageName}` : 'Select a village above')}
                </span>
                <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200">
                  Auto-Derived
                </span>
              </div>
            </div>

            {/* 4. Distance (KM) */}
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-700 uppercase">Distance (KM)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="3.0"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
              />
            </div>

            {/* 5. Provide Free Freezer Option */}
            <div className="p-3 bg-cyan-50/80 border border-cyan-200/80 rounded-2xl space-y-2">
              <label className="flex items-center gap-2 text-xs font-black text-cyan-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasFreezer}
                  onChange={(e) => setHasFreezer(e.target.checked)}
                  className="w-4 h-4 text-cyan-600 rounded cursor-pointer"
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
                  className="w-full bg-white border border-cyan-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-cyan-500 shadow-2xs"
                />
              )}
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="touch-btn touch-btn-primary w-full text-sm sm:text-base font-black flex items-center justify-center gap-2 uppercase tracking-wider mt-2 py-3.5 rounded-2xl shadow-lg shadow-blue-600/20 cursor-pointer transition active:scale-[0.98]"
            >
              <Save className="w-5 h-5" />
              {saving ? 'SAVING SHOP...' : 'SAVE NEW SHOP'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
