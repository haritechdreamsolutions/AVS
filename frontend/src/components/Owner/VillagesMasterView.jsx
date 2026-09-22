import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  MapPin, Plus, Search, Edit3, Trash2, X, 
  Save, CheckCircle2, AlertTriangle, RefreshCw, Store, Check, ShieldCheck,
  ArrowLeft, ChevronRight, Phone, DollarSign, Snowflake
} from 'lucide-react';
import { toast } from 'sonner';
import { AddShopModal } from '../common/AddShopModal';

export const VillagesMasterView = () => {
  const { villages = [], routes = [], shops = [], addVillage, updateVillage, deleteVillage, updateShop, deleteShop, refreshData } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVillage, setSelectedVillage] = useState(null);
  const [villageShopSearch, setVillageShopSearch] = useState('');
  const [showAddShopModalInVillage, setShowAddShopModalInVillage] = useState(false);

  // Edit Shop Modal State
  const [selectedShopForEdit, setSelectedShopForEdit] = useState(null);
  const [editShopName, setEditShopName] = useState('');
  const [editShopOwnerName, setEditShopOwnerName] = useState('');
  const [editShopPhone, setEditShopPhone] = useState('');
  const [editShopVillageId, setEditShopVillageId] = useState('');
  const [editShopDistanceKm, setEditShopDistanceKm] = useState('3.0');
  const [editShopHasFreezer, setEditShopHasFreezer] = useState(false);
  const [editShopFreezerModel, setEditShopFreezerModel] = useState('Blue Star 300L Visicooler');
  const [savingShopEdit, setSavingShopEdit] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVillage, setEditingVillage] = useState(null);
  const [villageNameInput, setVillageNameInput] = useState('');
  const [villageCodeInput, setVillageCodeInput] = useState('');
  const [routeIdInput, setRouteIdInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Active routes list
  const activeRoutes = useMemo(() => {
    return (routes || []).filter(r => r.is_active !== false);
  }, [routes]);

  // Map village id to dynamic shop count from live shops state
  const villageShopCounts = useMemo(() => {
    const map = {};
    (shops || []).forEach(s => {
      if (s && s.village_id) {
        map[s.village_id] = (map[s.village_id] || 0) + 1;
      }
    });
    return map;
  }, [shops]);

  // If a village is selected, keep its reference updated from live villages
  const currentSelectedVillage = useMemo(() => {
    if (!selectedVillage) return null;
    return (villages || []).find(v => Number(v.id) === Number(selectedVillage.id)) || selectedVillage;
  }, [villages, selectedVillage]);

  // Shops belonging strictly to the selected village
  const selectedVillageShops = useMemo(() => {
    if (!currentSelectedVillage) return [];
    return (shops || []).filter(s => {
      if (!s) return false;
      const matchesVillage = Number(s.village_id) === Number(currentSelectedVillage.id);
      if (!matchesVillage) return false;
      if (!villageShopSearch) return true;
      const q = villageShopSearch.toLowerCase().trim();
      return (
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.owner_name && s.owner_name.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
      );
    });
  }, [shops, currentSelectedVillage, villageShopSearch]);

  // Filtered villages for main list search
  const filteredVillages = useMemo(() => {
    return (villages || []).filter(v => {
      if (!v) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        (v.name && v.name.toLowerCase().includes(q)) ||
        (v.code && v.code.toLowerCase().includes(q)) ||
        (v.route_name && v.route_name.toLowerCase().includes(q))
      );
    });
  }, [villages, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const total = villages.length;
    const activeCount = villages.filter(v => v.status === 'ACTIVE' || v.is_active !== false).length;
    const linkedShopsCount = Object.values(villageShopCounts).reduce((a, b) => a + b, 0);

    return { total, activeCount, linkedShopsCount };
  }, [villages, villageShopCounts]);

  const handleOpenAddModal = () => {
    setEditingVillage(null);
    setVillageNameInput('');
    setVillageCodeInput('');
    setRouteIdInput(activeRoutes[0]?.id ? String(activeRoutes[0].id) : '');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (vil, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setEditingVillage(vil);
    setVillageNameInput(vil.name || '');
    setVillageCodeInput(vil.code || '');
    setRouteIdInput(vil.route_id ? String(vil.route_id) : (activeRoutes[0]?.id ? String(activeRoutes[0].id) : ''));
    setIsModalOpen(true);
  };

  const handleSaveVillage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const trimmedName = villageNameInput.trim();

    if (!trimmedName) {
      toast.error("கிராமத்தின் பெயரை உள்ளிடவும்! (Village name is required)");
      return;
    }

    if (!routeIdInput) {
      toast.error("Please select an assigned Route!");
      return;
    }

    setSaving(true);
    try {
      if (editingVillage) {
        const res = await updateVillage(editingVillage.id, {
          name: trimmedName,
          code: villageCodeInput.trim() || editingVillage.code,
          route_id: Number(routeIdInput)
        });
        if (res?.success) {
          toast.success(`🎉 Village "${trimmedName}" updated successfully!`);
          setIsModalOpen(false);
          if (selectedVillage && selectedVillage.id === editingVillage.id) {
            setSelectedVillage({ 
              ...selectedVillage, 
              name: trimmedName, 
              code: villageCodeInput.trim() || editingVillage.code,
              route_id: Number(routeIdInput),
              route_name: activeRoutes.find(r => Number(r.id) === Number(routeIdInput))?.name || selectedVillage.route_name
            });
          }
        } else {
          toast.error("Error updating village: " + (res?.message || "Failed"));
        }
      } else {
        const res = await addVillage({
          name: trimmedName,
          code: villageCodeInput.trim() || undefined,
          route_id: Number(routeIdInput)
        });
        if (res?.success) {
          toast.success(`🎉 New Village "${trimmedName}" (${res.village?.code || 'Created'}) added!`);
          setIsModalOpen(false);
          setVillageNameInput('');
          setVillageCodeInput('');
        } else {
          toast.error("Error adding village: " + (res?.message || "Failed"));
        }
      }
    } catch (err) {
      toast.error("Error saving village");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVillage = async (vil, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const count = villageShopCounts[vil.id] || 0;
    const confirmMsg = count > 0 
      ? `Village "${vil.name}" has ${count} assigned shop(s). Deleting will mark it INACTIVE. Continue?`
      : `Are you sure you want to delete village "${vil.name}" (${vil.code})?`;

    if (!window.confirm(confirmMsg)) return;

    const res = await deleteVillage(vil.id);
    if (res?.success) {
      toast.success(res.message || `Village "${vil.name}" removed successfully.`);
      if (selectedVillage && selectedVillage.id === vil.id) {
        setSelectedVillage(null);
      }
    } else {
      toast.error("Failed to delete village: " + (res?.message || "Server error"));
    }
  };

  const handleOpenEditShop = (shop, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setSelectedShopForEdit(shop);
    setEditShopName(shop.name || '');
    setEditShopOwnerName(shop.owner_name || '');
    setEditShopPhone(shop.phone || '');
    setEditShopVillageId(shop.village_id ? String(shop.village_id) : (currentSelectedVillage?.id ? String(currentSelectedVillage.id) : ''));
    setEditShopDistanceKm(shop.distance_km ? String(shop.distance_km) : (shop.distance ? String(parseFloat(shop.distance) || 3.0) : '3.0'));
    setEditShopHasFreezer(Boolean(shop.has_freezer));
    setEditShopFreezerModel(shop.freezer_model || 'Blue Star 300L Visicooler');
  };

  const handleSaveEditShop = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!editShopName.trim()) {
      toast.error("Shop name is required!");
      return;
    }

    const targetVillageId = editShopVillageId || currentSelectedVillage?.id;
    if (!targetVillageId) {
      toast.error("Please select a Village!");
      return;
    }

    const distNum = parseFloat(editShopDistanceKm);
    const parsedDist = isNaN(distNum) || distNum < 0 ? 0 : distNum;

    setSavingShopEdit(true);
    try {
      const res = await updateShop(selectedShopForEdit.id, {
        name: editShopName.trim(),
        owner_name: editShopOwnerName ? editShopOwnerName.trim() : null,
        phone: editShopPhone ? editShopPhone.trim() : null,
        village_id: Number(targetVillageId),
        distance_km: parsedDist,
        distance: `${parsedDist} km`,
        has_freezer: Boolean(editShopHasFreezer),
        freezer_model: editShopHasFreezer ? (editShopFreezerModel.trim() || 'Blue Star 300L Visicooler') : null
      });

      if (res?.success) {
        toast.success(`🎉 Shop "${res.shop?.name || editShopName}" updated successfully!`);
        setSelectedShopForEdit(null);
      } else {
        toast.error("Failed to update shop: " + (res?.message || "Server error"));
      }
    } catch (err) {
      toast.error("Error updating shop");
    } finally {
      setSavingShopEdit(false);
    }
  };

  const handleDeleteShop = async (shop, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const confirmMsg = `Are you sure you want to delete shop "${shop.name}" (${shop.code})?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await deleteShop(shop.id);
      if (res?.success) {
        toast.success(res.message || `Shop "${shop.name}" removed successfully.`);
      } else {
        toast.error("Failed to delete shop: " + (res?.message || "Server error"));
      }
    } catch (err) {
      toast.error("Error deleting shop");
    }
  };

  return (
    <div className="space-y-5 pb-6">
      
      {/* Executive Dark Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Territory Master
            </span>
            <span className="text-xs text-slate-400 font-medium">Owner Module</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-amber-400" />
            {currentSelectedVillage ? `Village: ${currentSelectedVillage.name} (${currentSelectedVillage.code})` : 'Village Management (கிராமங்கள் நிர்வாகம்)'}
          </h2>
          <p className="text-xs text-slate-400 max-w-xl font-medium">
            {currentSelectedVillage 
              ? `Manage and add shops belonging exclusively to ${currentSelectedVillage.name}.`
              : 'Manage your distribution territory villages. Click any village to view and add associated shops.'}
          </p>
        </div>

        <div className="flex items-center gap-2 z-10 w-full sm:w-auto">
          {currentSelectedVillage ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setSelectedVillage(null)}
                className="py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> All Villages
              </button>
              <button
                onClick={() => setShowAddShopModalInVillage(true)}
                className="flex-1 sm:flex-initial py-2.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" /> Add Shop
              </button>
            </div>
          ) : (
            <button
              onClick={handleOpenAddModal}
              className="flex-1 sm:flex-initial py-3 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" /> Create Village
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* DRILLDOWN VIEW: SHOPS INSIDE SELECTED VILLAGE */}
      {/* ========================================================= */}
      {currentSelectedVillage ? (
        <div className="space-y-4">
          
          {/* Breadcrumb & Village Stats Strip */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedVillage(null)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                title="Back to Villages List"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900">{currentSelectedVillage.name}</h3>
                  <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {currentSelectedVillage.code}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Showing all shops assigned to {currentSelectedVillage.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <div className="bg-indigo-50 px-3.5 py-1.5 rounded-xl border border-indigo-200 text-center">
                <span className="text-[10px] font-black uppercase text-indigo-500 block">Total Shops</span>
                <span className="text-base font-mono font-black text-indigo-900">
                  {villageShopCounts[currentSelectedVillage.id] || 0} Shops
                </span>
              </div>
              <button
                onClick={() => setShowAddShopModalInVillage(true)}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> + Add Shop
              </button>
            </div>
          </div>

          {/* Search inside this village's shops */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={villageShopSearch}
              onChange={(e) => setVillageShopSearch(e.target.value)}
              placeholder={`Search shops in ${currentSelectedVillage.name}...`}
              className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-bold focus:outline-none focus:border-indigo-500 shadow-2xs transition"
            />
          </div>

          {/* Village Shops Grid / List */}
          {selectedVillageShops.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200 p-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-200">
                <Store className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-slate-800">
                  {villageShopSearch ? "No matching shops found in this village" : `No shops in ${currentSelectedVillage.name} yet`}
                </h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto font-medium">
                  {villageShopSearch ? "Try clearing your search query." : `Add shops to ${currentSelectedVillage.name}. The village will automatically be associated.`}
                </p>
              </div>
              <button
                onClick={() => setShowAddShopModalInVillage(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" /> + Add Shop to {currentSelectedVillage.name}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {selectedVillageShops.map((shop) => (
                <div
                  key={shop.id}
                  className="glass-panel p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs hover:shadow-md transition flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm border border-blue-200 shrink-0">
                        🏪
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-slate-900 leading-tight">{shop.name}</h4>
                        <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 inline-block mt-0.5">
                          {shop.code}
                        </span>
                      </div>
                    </div>

                    {shop.has_freezer && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center gap-1">
                        <Snowflake className="w-2.5 h-2.5" /> Freezer
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-xs border-t border-slate-100 pt-2 text-slate-600">
                    {shop.owner_name && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Owner:</span>
                        <span className="font-bold text-slate-800">{shop.owner_name}</span>
                      </div>
                    )}
                    {shop.phone && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Phone:</span>
                        <span className="font-mono text-slate-700">{shop.phone}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-slate-400 font-bold">Current Due:</span>
                      <span className={`font-mono font-black ${Number(shop.current_due || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        ₹{Number(shop.current_due || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="bg-amber-50 p-2 rounded-xl border border-amber-200/80 flex items-center justify-between text-xs text-amber-900 font-bold">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-amber-600" /> Village:
                    </span>
                    <span>{currentSelectedVillage.name}</span>
                  </div>

                  {/* Shop Actions: Edit and Delete */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
                    <button
                      onClick={(e) => handleOpenEditShop(shop, e)}
                      className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 font-extrabold text-[11px] inline-flex items-center gap-1 border border-slate-200 hover:border-indigo-200 transition cursor-pointer"
                      title="Edit Shop Details"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={(e) => handleDeleteShop(shop, e)}
                      className="py-1.5 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-[11px] inline-flex items-center gap-1 border border-rose-200 transition cursor-pointer"
                      title="Delete or Deactivate Shop"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      ) : (
        /* ========================================================= */
        /* MAIN LIST: ALL VILLAGES OVERVIEW */
        /* ========================================================= */
        <div className="space-y-4">
          
          {/* KPI Metrics Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wide">Total Villages</span>
              <span className="text-xl sm:text-2xl font-mono font-black text-slate-900">{metrics.total}</span>
            </div>

            <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wide">Active Status</span>
              <span className="text-xl sm:text-2xl font-mono font-black text-emerald-600">{metrics.activeCount}</span>
            </div>

            <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wide">Assigned Shops</span>
              <span className="text-xl sm:text-2xl font-mono font-black text-indigo-600">{metrics.linkedShopsCount}</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search village name or code (கிராமம் தேடுக)..."
              className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-bold focus:outline-none focus:border-amber-500 shadow-2xs transition"
            />
          </div>

          {/* Villages List Grid */}
          {filteredVillages.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 p-8 space-y-4 shadow-2xs">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 shadow-inner">
                <MapPin className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-black text-base text-slate-800">
                  {searchQuery ? "No villages found" : "No villages created yet."}
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
                  {searchQuery ? "No villages match your search query." : "Create your first village to get started."}
                </p>
              </div>
              <button
                onClick={handleOpenAddModal}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/20 transition active:scale-95"
              >
                <Plus className="w-4 h-4" /> + Create Village
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredVillages.map((vil) => {
                const shopCount = villageShopCounts[vil.id] || 0;
                return (
                  <div 
                    key={vil.id} 
                    className="glass-panel p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs hover:shadow-md transition flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-base border border-amber-200 shrink-0">
                          📍
                        </div>
                        <div>
                          <h4 className="font-black text-sm text-slate-900 leading-tight">{vil.name}</h4>
                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 inline-block mt-0.5">
                            {vil.code}
                          </span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                        vil.status === 'ACTIVE' || vil.is_active !== false 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {vil.status || 'ACTIVE'}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex flex-col gap-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-bold flex items-center gap-1">
                          <Store className="w-3.5 h-3.5 text-indigo-600" /> Linked Shops:
                        </span>
                        <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {shopCount} {shopCount === 1 ? 'Shop' : 'Shops'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-200/60 pt-1">
                        <span className="text-slate-500 font-bold">Assigned Route:</span>
                        <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-[11px]">
                          {vil.route_name || 'Route (Auto)'}
                        </span>
                      </div>
                    </div>

                    {/* View Button & Actions */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <button
                        onClick={() => setSelectedVillage(vil)}
                        className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <Store className="w-3.5 h-3.5" /> View ({shopCount})
                      </button>

                      <button
                        onClick={(e) => handleOpenEditModal(vil, e)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                        title="Edit Village"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => handleDeleteVillage(vil, e)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition cursor-pointer"
                        title="Delete Village"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* Add / Edit Village Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-500" />
                {editingVillage ? 'Edit Village (கிராமம் திருத்து)' : 'Create New Village (புது கிராமம் உருவாக்க)'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVillage} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-700 uppercase">
                  Village Name (கிராம பெயர்) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cuddalore / Panruti / Neyveli"
                  value={villageNameInput}
                  onChange={(e) => setVillageNameInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                  autoFocus
                />
              </div>

              {/* Route Assignment (Mandatory) */}
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-700 uppercase">
                  Assign to Route (வழித்தடம் தேர்வு) *
                </label>
                <select
                  value={routeIdInput}
                  onChange={(e) => setRouteIdInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs cursor-pointer"
                >
                  <option value="" disabled>-- Select Assigned Route --</option>
                  {activeRoutes.length === 0 ? (
                    <option value="" disabled>No active routes found. Please create a route first.</option>
                  ) : (
                    activeRoutes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code}) {r.driver_name ? `- Driver: ${r.driver_name}` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-700 uppercase">
                  Village Code (Auto-generated if empty)
                </label>
                <input
                  type="text"
                  placeholder="e.g. VIL-005 (Leave blank for auto code)"
                  value={villageCodeInput}
                  onChange={(e) => setVillageCodeInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer transition active:scale-[0.98]"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : editingVillage ? 'Save Changes' : 'Create Village'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Add Shop inside Village Modal */}
      {showAddShopModalInVillage && currentSelectedVillage && (
        <AddShopModal
          villageId={currentSelectedVillage.id}
          villageName={currentSelectedVillage.name}
          onClose={() => setShowAddShopModalInVillage(false)}
        />
      )}

      {/* Edit Shop Details Modal */}
      {selectedShopForEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm sm:max-w-md w-full p-4 sm:p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto my-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm border border-indigo-200">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Edit Shop Details</h3>
                  <span className="text-[10px] font-mono font-bold text-blue-600 uppercase">{selectedShopForEdit.code}</span>
                </div>
              </div>
              <button onClick={() => setSelectedShopForEdit(null)} className="p-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditShop} className="space-y-3.5">
              
              {/* Shop Name */}
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-700 uppercase">Shop Name *</label>
                <input
                  type="text"
                  value={editShopName}
                  onChange={(e) => setEditShopName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  required
                />
              </div>

              {/* Village Selection Dropdown */}
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-700 uppercase flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-500" />
                    Village Territory (கிராமம்) *
                  </span>
                </label>
                <select
                  value={editShopVillageId}
                  onChange={(e) => setEditShopVillageId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                  required
                >
                  <option value="" disabled>-- Select Village (Required) --</option>
                  {(villages || []).filter(v => v.status === 'ACTIVE' || v.is_active !== false).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.code}) — Route: {v.route_name || 'Assigned'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Owner Name & Phone */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-700 uppercase">Owner Name</label>
                  <input
                    type="text"
                    value={editShopOwnerName}
                    onChange={(e) => setEditShopOwnerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-700 uppercase">Phone Number</label>
                  <input
                    type="text"
                    value={editShopPhone}
                    onChange={(e) => setEditShopPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Distance */}
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-700 uppercase">Distance (KM)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editShopDistanceKm}
                  onChange={(e) => setEditShopDistanceKm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              {/* Freezer Option */}
              <div className="p-3 bg-cyan-50/80 border border-cyan-200/80 rounded-2xl space-y-2">
                <label className="flex items-center gap-2 text-xs font-black text-cyan-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editShopHasFreezer}
                    onChange={(e) => setEditShopHasFreezer(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded cursor-pointer"
                  />
                  <Snowflake className="w-4 h-4 text-cyan-600" />
                  Provide Free Freezer Asset 🧊
                </label>
                {editShopHasFreezer && (
                  <input
                    type="text"
                    value={editShopFreezerModel}
                    onChange={(e) => setEditShopFreezerModel(e.target.value)}
                    className="w-full bg-white border border-cyan-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-cyan-500 shadow-2xs"
                  />
                )}
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedShopForEdit(null)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingShopEdit}
                  className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer transition active:scale-[0.98]"
                >
                  <Save className="w-4 h-4" />
                  {savingShopEdit ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
