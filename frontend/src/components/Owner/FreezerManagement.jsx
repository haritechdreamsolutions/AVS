import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Snowflake, Plus, Store, X, Save } from 'lucide-react';
import { toast } from 'sonner';

export const FreezerManagement = () => {
  const { shops, assignFreezer } = useApp();
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [model, setModel] = useState('Blue Star 300L Deep Freezer');
  const [serial, setSerial] = useState('FRZ-2026-904');
  const [saving, setSaving] = useState(false);

  const freezerShops = shops.filter(s => s.has_freezer);
  const noFreezerShops = shops.filter(s => !s.has_freezer);

  const handleOpenAssignModal = (shopId = '') => {
    setSelectedShopId(shopId || (noFreezerShops[0]?.id || (shops[0]?.id || '')));
    setShowAssignModal(true);
  };

  const handleSaveFreezer = async () => {
    if (!selectedShopId) {
      toast.error("Please select a shop!");
      return;
    }
    setSaving(true);
    const res = await assignFreezer(selectedShopId, {
      model,
      serial,
      date: new Date().toISOString().split('T')[0]
    });
    setSaving(false);
    if (res.success) {
      toast.success("Freezer assigned to shop successfully!");
      setShowAssignModal(false);
    } else {
      toast.error("Error assigning freezer: " + (res.message || "Failed to assign"));
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Snowflake className="w-6 h-6 text-cyan-600" />
            <h2 className="text-xl font-black text-slate-900">FREEZER ASSET MANAGEMENT</h2>
          </div>
          <p className="text-xs text-slate-500 font-bold mt-1">Track & Manage Free Freezer Assets Provided to Shops</p>
        </div>

        <button
          onClick={() => handleOpenAssignModal()}
          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-md transition"
        >
          <Plus className="w-4 h-4" />
          ASSIGN NEW FREEZER TO SHOP
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-cyan-500 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-extrabold block">Total Freezers Deployed</span>
          <div className="font-mono font-black text-3xl text-cyan-600 mt-1">
            {freezerShops.length} Assets
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-emerald-500 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-extrabold block">Active In Shops</span>
          <div className="font-mono font-black text-3xl text-emerald-600 mt-1">
            {freezerShops.length} Active
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-amber-500 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-extrabold block">Eligible Shops Without Freezer</span>
          <div className="font-mono font-black text-3xl text-amber-600 mt-1">
            {noFreezerShops.length} Shops
          </div>
        </div>
      </div>

      {/* Main Content: Shops with Freezers Provided */}
      <div className="space-y-4">
        <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide flex items-center gap-2">
          <Store className="w-4 h-4 text-cyan-600" />
          SHOPS WITH FREEZER DEPLOYED ({freezerShops.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {freezerShops.map(shop => (
            <div key={shop.id} className="glass-panel p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center justify-center font-bold text-xl">
                    🧊
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-sm text-slate-900">{shop.name}</h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {shop.code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-bold mt-0.5">Owner: {shop.owner_name} ({shop.phone})</p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {shop.freezer_status || 'Active'}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Model:</span>
                  <span className="font-bold text-slate-900">{shop.freezer_model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Serial No:</span>
                  <span className="font-bold text-cyan-700">{shop.freezer_serial}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Allocation Date:</span>
                  <span className="font-bold text-slate-800">{shop.freezer_date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shops pending freezer allocation */}
      {noFreezerShops.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide">
            SHOPS WITHOUT FREEZER ({noFreezerShops.length})
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {noFreezerShops.map(shop => (
              <div key={shop.id} className="glass-card p-3.5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-sm">
                <div>
                  <h5 className="font-bold text-xs text-slate-900">{shop.name} ({shop.code})</h5>
                  <p className="text-[10px] text-slate-500 font-semibold">{shop.owner_name}</p>
                </div>
                <button
                  onClick={() => handleOpenAssignModal(shop.id)}
                  className="px-2.5 py-1.5 bg-cyan-50 text-cyan-700 hover:bg-cyan-600 hover:text-white rounded-xl text-[11px] font-extrabold border border-cyan-200 transition"
                >
                  + Assign Freezer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assign Freezer Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Snowflake className="w-5 h-5 text-cyan-600" />
                Assign Freezer to Shop
              </h4>
              <button onClick={() => setShowAssignModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-500 uppercase">Select Shop</label>
              <select
                value={selectedShopId}
                onChange={(e) => setSelectedShopId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-cyan-500"
              >
                {shops.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) {s.has_freezer ? '🧊 (Already Assigned)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-500 uppercase">Freezer Model / Capacity</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-500 uppercase">Serial Number</label>
              <input
                type="text"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-slate-900"
              />
            </div>

            <button
              onClick={handleSaveFreezer}
              disabled={saving}
              className="touch-btn touch-btn-primary w-full text-base font-extrabold bg-cyan-600 hover:bg-cyan-700 flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {saving ? 'SAVING...' : 'SAVE FREEZER ALLOCATION'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
