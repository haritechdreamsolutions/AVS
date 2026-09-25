import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, MapPin, ArrowRight, ArrowLeft, CheckCircle2, Store, ChevronRight } from 'lucide-react';

export const ShopSelection = ({
  selectedVillage: controlledVillage,
  onSelectVillage: controlledSetVillage,
  onSelectShop,
  onBack
}) => {
  const { shops = [], villages = [], sales = [] } = useApp();

  // Internal village selection state (with support for controlled prop from App.jsx)
  const [internalVillage, setInternalVillage] = useState(null);
  const activeVillage = controlledVillage !== undefined ? controlledVillage : internalVillage;
  const setActiveVillage = (val) => {
    if (controlledSetVillage) controlledSetVillage(val);
    setInternalVillage(val);
  };

  const [search, setSearch] = useState('');

  // Check if a shop has been billed today
  const isShopBilledToday = (shopId) => {
    return (sales || []).some(s => Number(s.shop_id) === Number(shopId));
  };

  // Group shops by village
  const villageGroups = useMemo(() => {
    const map = new Map();

    // First, populate all known villages if available
    (villages || []).forEach(v => {
      const key = `id_${v.id}`;
      map.set(key, {
        id: v.id,
        name: v.name,
        code: v.code || '',
        shops: []
      });
    });

    // Populate shops into villages
    (shops || []).forEach(s => {
      const vId = s.village_id || null;
      const vName = s.village_name || s.village || 'Other Shops / இதர கடைகள்';
      const key = vId ? `id_${vId}` : `name_${vName.trim().toLowerCase()}`;

      if (!map.has(key)) {
        map.set(key, {
          id: vId,
          name: vName,
          code: s.village_code || '',
          shops: []
        });
      }

      const entry = map.get(key);
      const isDone = s.completed || isShopBilledToday(s.id);
      entry.shops.push({
        ...s,
        completed: isDone
      });
    });

    // Convert map to array and compute statistics
    const result = Array.from(map.values())
      .filter(g => g.shops.length > 0) // Only show villages that have shops for this driver
      .map(g => {
        const completedCount = g.shops.filter(s => s.completed).length;
        return {
          ...g,
          totalShops: g.shops.length,
          completedShops: completedCount,
          isCompleted: completedCount === g.shops.length && g.shops.length > 0
        };
      });

    // Sort by name
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [shops, villages, sales]);

  // Filtered villages for Village List View
  const filteredVillages = useMemo(() => {
    if (!search) return villageGroups;
    const q = search.toLowerCase();
    return villageGroups.filter(v => 
      v.name.toLowerCase().includes(q) ||
      (v.code && v.code.toLowerCase().includes(q))
    );
  }, [villageGroups, search]);

  // If a village is selected, get its shops
  const currentVillageGroup = useMemo(() => {
    if (!activeVillage) return null;
    const targetId = activeVillage.id;
    const targetName = (activeVillage.name || '').trim().toLowerCase();
    return villageGroups.find(g => 
      (targetId && g.id === targetId) ||
      (g.name && g.name.trim().toLowerCase() === targetName)
    ) || null;
  }, [activeVillage, villageGroups]);

  // Filtered shops within the selected village
  const filteredVillageShops = useMemo(() => {
    if (!currentVillageGroup) return [];
    const villageShops = currentVillageGroup.shops || [];
    if (!search) return villageShops;
    const q = search.toLowerCase();
    return villageShops.filter(s =>
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.code && s.code.toLowerCase().includes(q)) ||
      (s.owner_name && s.owner_name.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q))
    );
  }, [currentVillageGroup, search]);

  // Handle clicking a village
  const handleSelectVillageCard = (village) => {
    setActiveVillage(village);
    setSearch(''); // Reset search when entering a village
  };

  // Handle clicking back to villages
  const handleBackToVillages = () => {
    setActiveVillage(null);
    setSearch('');
  };

  // VIEW 2: SHOPS INSIDE SELECTED VILLAGE
  if (activeVillage && currentVillageGroup) {
    const completedCount = currentVillageGroup.completedShops || 0;
    const totalCount = currentVillageGroup.totalShops || 0;

    return (
      <div className="max-w-md mx-auto p-3 sm:p-4 space-y-4 pb-28 sm:pb-32">
        
        {/* Navigation & Village Header Banner */}
        <div className="space-y-2.5">
          <button
            onClick={handleBackToVillages}
            className="touch-btn py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-200 shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700" />
            <span>← ALL VILLAGES (கிராமங்கள்)</span>
          </button>

          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-2xl p-4 text-white shadow-md space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-blue-200 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-cyan-300" />
                Selected Village / கிராமம்
              </span>
              <span className="text-[11px] font-bold bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-md font-mono">
                {completedCount}/{totalCount} Billed
              </span>
            </div>
            <h2 className="text-lg font-black tracking-tight">{currentVillageGroup.name}</h2>
            <p className="text-xs text-blue-100 font-medium">
              Select a shop below to generate bill / கடை தேர்வு செய்க
            </p>
          </div>
        </div>

        {/* Search within this village */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search shops in ${currentVillageGroup.name} (கடை தேடுக)...`}
            className="w-full bg-white border border-slate-200 shadow-xs rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition font-medium"
          />
        </div>

        {/* List of Shops in Village */}
        <div className="space-y-2.5">
          {filteredVillageShops.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200 p-4">
              <Store className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-sm text-slate-700">No shops found</p>
              <p className="text-xs text-slate-400 mt-0.5">No shops match your search in {currentVillageGroup.name}.</p>
            </div>
          ) : (
            filteredVillageShops.map(shop => (
              <div
                key={shop.id}
                onClick={() => onSelectShop(shop)}
                className={`glass-panel p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all duration-150 ${
                  shop.completed
                    ? 'border-emerald-200 bg-emerald-50/60 shadow-2xs'
                    : 'border-slate-200 hover:border-blue-400 bg-white shadow-sm hover:shadow-md active:scale-[0.99]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${
                    shop.completed ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}>
                    🏪
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-extrabold text-sm text-slate-900 leading-tight truncate">{shop.name}</h3>
                      {shop.code && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-slate-100 text-slate-600 font-bold border border-slate-200 shrink-0">
                          {shop.code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 font-medium flex-wrap">
                      {shop.distance && (
                        <span className="text-[11px] text-slate-500 font-medium">
                          📍 {shop.distance}
                        </span>
                      )}
                      {Number(shop.current_due || 0) > 0 && (
                        <span className="text-[11px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                          Due: ₹{Number(shop.current_due).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  {shop.completed ? (
                    <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-extrabold bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Done</span>
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md glow-green transition active:scale-95">
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    );
  }

  // VIEW 1: VILLAGES LIST
  const totalVillagesCount = villageGroups.length;
  const totalShopsCount = shops.length;

  return (
    <div className="max-w-md mx-auto p-3 sm:p-4 space-y-4 pb-28 sm:pb-32">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition font-bold text-xs"
              title="Back to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-1.5">
              <MapPin className="w-5 h-5 text-blue-600" />
              Select Village (கிராமம் தேர்வு)
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">Click a village to view its shops</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-blue-700 font-extrabold bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
            {totalVillagesCount} Villages
          </span>
          <span className="block text-[10px] text-slate-400 font-bold mt-0.5">{totalShopsCount} Shops</span>
        </div>
      </div>

      {/* Search Villages */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Village name (கிராமம் தேடுக)..."
          className="w-full bg-white border border-slate-200 shadow-xs rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition font-medium"
        />
      </div>

      {/* Village Cards */}
      <div className="space-y-2.5">
        {filteredVillages.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200 p-4">
            <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-sm text-slate-700">No villages found</p>
            <p className="text-xs text-slate-400 mt-0.5">Please check route assignment or search with another name.</p>
          </div>
        ) : (
          filteredVillages.map(village => (
            <div
              key={village.id || village.name}
              onClick={() => handleSelectVillageCard(village)}
              className={`glass-panel p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all duration-150 ${
                village.isCompleted
                  ? 'border-emerald-200 bg-emerald-50/50 shadow-2xs'
                  : 'border-slate-200 hover:border-blue-400 bg-white shadow-sm hover:shadow-md active:scale-[0.99]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${
                  village.isCompleted
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : 'bg-gradient-to-br from-indigo-50 to-blue-100 text-indigo-700 border border-indigo-200'
                }`}>
                  📍
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-sm text-slate-900 truncate">{village.name}</h3>
                    {village.code && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-slate-100 text-slate-600 font-bold border border-slate-200">
                        {village.code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 font-medium flex-wrap">
                    <span className="text-[11px] font-bold text-slate-600">
                      🏪 {village.totalShops} {village.totalShops === 1 ? 'Shop' : 'Shops'} (கடைகள்)
                    </span>
                    {village.completedShops > 0 && (
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        {village.completedShops}/{village.totalShops} Billed
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1.5">
                {village.isCompleted ? (
                  <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-extrabold bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Done</span>
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md glow-blue transition active:scale-95">
                    <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};
