import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Snowflake, Plus, Store, X, Save, Search, Filter, 
  Trash2, Edit3, CheckCircle2, AlertTriangle, Layers, 
  Sparkles, RefreshCw, Boxes, ArrowRight, Tag, ShieldAlert, Undo2
} from 'lucide-react';
import { toast } from 'sonner';

const POPULAR_BRANDS = ['Blue Star', 'Voltas', 'Western', 'Godrej', 'Haier', 'Rockwell', 'Panasonic'];
const POPULAR_CAPACITIES = ['100L', '150L', '200L', '250L', '300L', '320L', '350L', '400L', '500L'];
const FREEZER_TYPES = ['Deep Freezer', 'Visicooler', 'Chest Freezer', 'Double Door Cooler', 'Display Cooler'];

export const FreezerManagement = () => {
  const { 
    shops = [], 
    assignFreezer, 
    unassignFreezer, 
    freezerModels = [], 
    addFreezerModel, 
    deleteFreezerModel 
  } = useApp();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('ALL');

  // Modals State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCreateModelModal, setShowCreateModelModal] = useState(false);
  const [showManageModelsModal, setShowManageModelsModal] = useState(false);
  const [unassignModal, setUnassignModal] = useState({ isOpen: false, shop: null });

  // Assign Form State
  const [selectedShopId, setSelectedShopId] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('Blue Star');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [customModelName, setCustomModelName] = useState('');
  const [serial, setSerial] = useState('');
  const [allocationDate, setAllocationDate] = useState(new Date().toISOString().split('T')[0]);
  const [freezerStatus, setFreezerStatus] = useState('Active');
  const [saving, setSaving] = useState(false);

  // Create Model Form State
  const [newModelBrand, setNewModelBrand] = useState('Blue Star');
  const [customBrandInput, setCustomBrandInput] = useState('');
  const [newModelCapacity, setNewModelCapacity] = useState('300L');
  const [customCapacityInput, setCustomCapacityInput] = useState('');
  const [newModelType, setNewModelType] = useState('Deep Freezer');
  const [newModelDisplayName, setNewModelDisplayName] = useState('');
  const [newModelDesc, setNewModelDesc] = useState('');
  const [creatingModel, setCreatingModel] = useState(false);

  // Grouped and sorted models
  const availableBrands = useMemo(() => {
    const brandsSet = new Set(POPULAR_BRANDS);
    freezerModels.forEach(m => {
      if (m.brand) brandsSet.add(m.brand);
    });
    return Array.from(brandsSet);
  }, [freezerModels]);

  // Models filtered by selected brand in the assign modal
  const filteredBrandModels = useMemo(() => {
    if (!selectedBrand || selectedBrand === 'ALL') {
      return freezerModels;
    }
    return freezerModels.filter(m => 
      (m.brand || '').toLowerCase().trim() === selectedBrand.toLowerCase().trim()
    );
  }, [freezerModels, selectedBrand]);

  // Keep auto-generated display name updated when creating new model
  useEffect(() => {
    const b = newModelBrand === 'Other' ? (customBrandInput.trim() || 'Brand') : newModelBrand;
    const c = newModelCapacity === 'Other' ? (customCapacityInput.trim() || '') : newModelCapacity;
    const generated = `${b} ${c} ${newModelType}`.replace(/\s+/g, ' ').trim();
    setNewModelDisplayName(generated);
  }, [newModelBrand, customBrandInput, newModelCapacity, customCapacityInput, newModelType]);

  // Auto-generate serial when shop or model changes
  const generateSerial = (shopIdVal, modelNameVal) => {
    const s = shops.find(item => String(item.id) === String(shopIdVal));
    const cleanShopCode = s?.code ? s.code.replace(/[^A-Za-z0-9]/g, '') : 'SHOP';
    const cleanModel = (modelNameVal || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'FRZ';
    const rand = Math.floor(100 + Math.random() * 900);
    return `FRZ-${cleanShopCode}-${cleanModel}-${rand}`;
  };

  const freezerShops = useMemo(() => {
    return shops.filter(s => {
      if (!s.has_freezer) return false;
      if (brandFilter !== 'ALL') {
        const m = (s.freezer_model || '').toLowerCase();
        if (!m.includes(brandFilter.toLowerCase())) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.code && s.code.toLowerCase().includes(q)) ||
          (s.owner_name && s.owner_name.toLowerCase().includes(q)) ||
          (s.freezer_model && s.freezer_model.toLowerCase().includes(q)) ||
          (s.freezer_serial && s.freezer_serial.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [shops, brandFilter, searchQuery]);

  const noFreezerShops = useMemo(() => {
    return shops.filter(s => {
      if (s.has_freezer) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.code && s.code.toLowerCase().includes(q)) ||
          (s.owner_name && s.owner_name.toLowerCase().includes(q)) ||
          (s.village_name && s.village_name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [shops, searchQuery]);

  // Handle open assign modal
  const handleOpenAssignModal = (shopId = '') => {
    const targetShopId = shopId || (noFreezerShops[0]?.id || (shops[0]?.id || ''));
    setSelectedShopId(targetShopId);

    // Default to Blue Star or first available brand
    const initialBrand = availableBrands[0] || 'Blue Star';
    setSelectedBrand(initialBrand);

    const brandModels = freezerModels.filter(m => (m.brand || '').toLowerCase() === initialBrand.toLowerCase());
    const initialModel = brandModels[0] || freezerModels[0];
    
    if (initialModel) {
      setSelectedModelId(initialModel.id);
      setCustomModelName(initialModel.model_name);
      setSerial(generateSerial(targetShopId, initialModel.model_name));
    } else {
      setSelectedModelId('');
      setCustomModelName('Blue Star 300L Deep Freezer');
      setSerial(generateSerial(targetShopId, 'Blue Star 300L'));
    }

    setAllocationDate(new Date().toISOString().split('T')[0]);
    setFreezerStatus('Active');
    setShowAssignModal(true);
  };

  // Handle brand change in assign modal
  const handleBrandChangeInAssign = (brand) => {
    setSelectedBrand(brand);
    const modelsForBrand = freezerModels.filter(m => (m.brand || '').toLowerCase().trim() === brand.toLowerCase().trim());
    if (modelsForBrand.length > 0) {
      const first = modelsForBrand[0];
      setSelectedModelId(first.id);
      setCustomModelName(first.model_name);
      setSerial(generateSerial(selectedShopId, first.model_name));
    } else {
      setSelectedModelId('');
      setCustomModelName(`${brand} 300L Deep Freezer`);
      setSerial(generateSerial(selectedShopId, `${brand} 300L`));
    }
  };

  // Handle model selection in assign modal
  const handleModelChangeInAssign = (modelId) => {
    setSelectedModelId(modelId);
    const found = freezerModels.find(m => String(m.id) === String(modelId));
    if (found) {
      setCustomModelName(found.model_name);
      setSerial(generateSerial(selectedShopId, found.model_name));
    }
  };

  // Handle save freezer assignment
  const handleSaveFreezer = async () => {
    if (!selectedShopId) {
      toast.error("Please select a shop!");
      return;
    }

    const finalModel = customModelName.trim() || 'Blue Star 300L Deep Freezer';
    const finalSerial = serial.trim() || generateSerial(selectedShopId, finalModel);

    setSaving(true);
    const res = await assignFreezer(selectedShopId, {
      model: finalModel,
      serial: finalSerial,
      date: allocationDate || new Date().toISOString().split('T')[0],
      status: freezerStatus || 'Active'
    });
    setSaving(false);

    if (res.success) {
      toast.success(`🎉 Freezer '${finalModel}' assigned to shop successfully!`);
      setShowAssignModal(false);
    } else {
      toast.error("Error assigning freezer: " + (res.message || "Failed to assign"));
    }
  };

  // Handle create new model
  const handleCreateNewModel = async (e) => {
    e.preventDefault();
    const brand = newModelBrand === 'Other' ? customBrandInput.trim() : newModelBrand.trim();
    const capacity = newModelCapacity === 'Other' ? customCapacityInput.trim() : newModelCapacity.trim();
    const modelName = newModelDisplayName.trim() || `${brand} ${capacity} ${newModelType}`.trim();

    if (!brand) {
      toast.error("Please enter or select a brand name");
      return;
    }
    if (!capacity) {
      toast.error("Please enter or select a capacity (e.g. 300L)");
      return;
    }

    setCreatingModel(true);
    const res = await addFreezerModel({
      brand,
      capacity,
      model_name: modelName,
      freezer_type: newModelType,
      description: newModelDesc.trim()
    });
    setCreatingModel(false);

    if (res.success) {
      toast.success(`✨ New model '${res.model.model_name}' registered successfully!`);
      setShowCreateModelModal(false);

      // If assign modal is open, auto-select this new model!
      if (showAssignModal) {
        setSelectedBrand(res.model.brand);
        setSelectedModelId(res.model.id);
        setCustomModelName(res.model.model_name);
        setSerial(generateSerial(selectedShopId, res.model.model_name));
      }
    } else {
      toast.error(res.message || "Failed to create freezer model");
    }
  };

  // Handle unassign freezer
  const handleConfirmUnassign = async () => {
    if (!unassignModal.shop) return;
    const shopId = unassignModal.shop.id;
    const shopName = unassignModal.shop.name;
    const res = await unassignFreezer(shopId);
    if (res.success) {
      toast.success(`Freezer unassigned and returned from '${shopName}'!`);
      setUnassignModal({ isOpen: false, shop: null });
    } else {
      toast.error(res.message || "Failed to unassign freezer");
    }
  };

  return (
    <div className="space-y-6 pb-8">
      
      {/* ==================================================================== */}
      {/* TOP HEADER & ACTION BUTTONS */}
      {/* ==================================================================== */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glass-panel p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold border border-cyan-200">
              <Snowflake className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">FREEZER ASSET MANAGEMENT</h2>
              <p className="text-xs text-slate-500 font-bold">Track, deploy & manage cold storage freezer assets across partner shops</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Create New Model Button */}
          <button
            onClick={() => setShowCreateModelModal(true)}
            className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center gap-2 border border-indigo-200 shadow-sm transition"
            title="Add a new brand/capacity freezer specification"
          >
            <Boxes className="w-4 h-4 text-indigo-600" />
            <span>+ CREATE NEW MODEL</span>
          </button>

          {/* Manage Models Button */}
          <button
            onClick={() => setShowManageModelsModal(true)}
            className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition"
            title="View and manage registered freezer specifications"
          >
            <Tag className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Model Catalog</span> ({freezerModels.length})
          </button>

          {/* Assign New Freezer Button */}
          <button
            onClick={() => handleOpenAssignModal()}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ ASSIGN FREEZER TO SHOP</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* METRIC CARDS */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-cyan-500 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-extrabold block uppercase tracking-wider">Total Freezers Deployed</span>
          <div className="font-mono font-black text-3xl text-cyan-600 mt-1">
            {shops.filter(s => s.has_freezer).length} <span className="text-sm font-sans font-bold text-slate-400">Assets</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-emerald-500 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-extrabold block uppercase tracking-wider">Active In Shops</span>
          <div className="font-mono font-black text-3xl text-emerald-600 mt-1">
            {shops.filter(s => s.has_freezer && (s.freezer_status || 'Active') === 'Active').length} <span className="text-sm font-sans font-bold text-slate-400">Active</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-amber-500 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-extrabold block uppercase tracking-wider">Eligible Shops Without Freezer</span>
          <div className="font-mono font-black text-3xl text-amber-600 mt-1">
            {shops.filter(s => !s.has_freezer).length} <span className="text-sm font-sans font-bold text-slate-400">Shops</span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SEARCH & BRAND FILTER BAR */}
      {/* ==================================================================== */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by shop name, code, model (e.g. Blue Star, 300L), serial..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-extrabold text-slate-500 whitespace-nowrap flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" /> Brand:
          </span>
          <button
            onClick={() => setBrandFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition whitespace-nowrap ${brandFilter === 'ALL' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            All Brands
          </button>
          {availableBrands.map(b => (
            <button
              key={b}
              onClick={() => setBrandFilter(b)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition whitespace-nowrap ${brandFilter === b ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 1: SHOPS WITH FREEZER DEPLOYED */}
      {/* ==================================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <Store className="w-4 h-4 text-cyan-600" />
            SHOPS WITH FREEZER DEPLOYED ({freezerShops.length})
          </h3>
        </div>

        {freezerShops.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-300 p-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto text-2xl font-bold">
              🧊
            </div>
            <h4 className="font-extrabold text-slate-700 text-sm">No Freezers Deployed Matching Criteria</h4>
            <p className="text-xs text-slate-400">Click below to allocate a freezer to any eligible shop.</p>
            <button
              onClick={() => handleOpenAssignModal()}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Assign Freezer
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {freezerShops.map(shop => (
              <div key={shop.id} className="glass-panel p-4 rounded-3xl bg-white border border-slate-200 space-y-3.5 shadow-sm hover:border-cyan-300 transition relative overflow-hidden group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center justify-center font-bold text-xl flex-shrink-0">
                      🧊
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-black text-sm text-slate-900">{shop.name}</h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded font-black bg-slate-100 text-slate-700 border border-slate-200">
                          {shop.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                        {shop.owner_name} {shop.phone ? `• ${shop.phone}` : ''}
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex-shrink-0">
                    {shop.freezer_status || 'Active'}
                  </span>
                </div>

                <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200 text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-sans font-bold text-[11px]">Model:</span>
                    <span className="font-black text-slate-900 text-right">{shop.freezer_model || 'Standard Deep Freezer'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-sans font-bold text-[11px]">Serial No:</span>
                    <span className="font-black text-cyan-700">{shop.freezer_serial || 'FRZ-GEN-904'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-sans font-bold text-[11px]">Allocation Date:</span>
                    <span className="font-bold text-slate-700">{shop.freezer_date || 'N/A'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenAssignModal(shop.id)}
                    className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-cyan-600" />
                    Change / Edit
                  </button>
                  <button
                    onClick={() => setUnassignModal({ isOpen: true, shop })}
                    className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold text-[11px] flex items-center justify-center gap-1 border border-rose-200 transition"
                    title="Return / Unassign Freezer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Unassign
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* SECTION 2: SHOPS WITHOUT FREEZER ALLOCATION */}
      {/* ==================================================================== */}
      {noFreezerShops.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Store className="w-4 h-4 text-amber-500" />
              ELIGIBLE SHOPS PENDING FREEZER ALLOCATION ({noFreezerShops.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {noFreezerShops.map(shop => (
              <div key={shop.id} className="glass-card p-3.5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-sm hover:border-cyan-300 transition">
                <div>
                  <h5 className="font-bold text-xs text-slate-900">{shop.name} ({shop.code})</h5>
                  <p className="text-[10px] text-slate-500 font-semibold">{shop.owner_name} • {shop.village_name || 'Salem Area'}</p>
                </div>
                <button
                  onClick={() => handleOpenAssignModal(shop.id)}
                  className="px-3 py-1.5 bg-cyan-50 text-cyan-700 hover:bg-cyan-600 hover:text-white rounded-xl text-[11px] font-extrabold border border-cyan-200 transition flex items-center gap-1 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Assign Freezer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: ASSIGN FREEZER TO SHOP */}
      {/* ==================================================================== */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto my-auto p-6 space-y-4 shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold border border-cyan-200">
                  <Snowflake className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-base text-slate-900">Assign Freezer to Shop</h4>
                  <span className="text-[10px] text-slate-500 font-bold">AVS Asset Deployment Workflow</span>
                </div>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Shop Selector */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700 uppercase">Select Target Shop *</label>
              <select
                value={selectedShopId}
                onChange={(e) => {
                  setSelectedShopId(e.target.value);
                  setSerial(generateSerial(e.target.value, customModelName));
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-cyan-500"
              >
                {shops.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) {s.has_freezer ? '🧊 [Currently: ' + (s.freezer_model || 'Assigned') + ']' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Brand Cascade Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-700 uppercase">1. Select Brand *</label>
                <button
                  type="button"
                  onClick={() => setShowCreateModelModal(true)}
                  className="text-[10px] text-indigo-600 font-black hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add New Model
                </button>
              </div>

              {/* Brand chips */}
              <div className="flex flex-wrap gap-1.5">
                {availableBrands.map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => handleBrandChangeInAssign(b)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${selectedBrand.toLowerCase() === b.toLowerCase() ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Model / Capacity Dropdown based on chosen brand */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700 uppercase">
                2. Freezer Model / Capacity ({selectedBrand}) *
              </label>
              <select
                value={selectedModelId}
                onChange={(e) => handleModelChangeInAssign(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-black text-slate-900 focus:outline-none focus:border-cyan-500"
              >
                {filteredBrandModels.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.model_name} {m.capacity ? `(${m.capacity})` : ''} - {m.freezer_type || 'Deep Freezer'}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Model Text Preview / Editable */}
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-500 uppercase">Selected Model Full Name</label>
              <input
                type="text"
                value={customModelName}
                onChange={(e) => setCustomModelName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900"
                placeholder="e.g. Blue Star 300L Deep Freezer"
              />
            </div>

            {/* Serial Number */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-700 uppercase">Serial Number (Asset Tag)</label>
                <button
                  type="button"
                  onClick={() => setSerial(generateSerial(selectedShopId, customModelName))}
                  className="text-[10px] text-cyan-600 font-bold hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Regenerate
                </button>
              </div>
              <input
                type="text"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-mono font-black text-slate-900 uppercase"
                placeholder="e.g. FRZ-SHOP013-BS300-904"
              />
            </div>

            {/* Date & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 uppercase">Allocation Date</label>
                <input
                  type="date"
                  value={allocationDate}
                  onChange={(e) => setAllocationDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 uppercase">Freezer Status</label>
                <select
                  value={freezerStatus}
                  onChange={(e) => setFreezerStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                >
                  <option value="Active">Active (Deployed)</option>
                  <option value="Under Maintenance">Under Maintenance</option>
                  <option value="Transit">In Transit</option>
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSaveFreezer}
              disabled={saving}
              className="touch-btn touch-btn-primary w-full py-3 text-sm font-black bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 transition"
            >
              <Save className="w-5 h-5" />
              {saving ? 'SAVING ALLOCATION...' : 'SAVE FREEZER ALLOCATION'}
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: CREATE NEW FREEZER MODEL */}
      {/* ==================================================================== */}
      {showCreateModelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto my-auto p-6 space-y-4 shadow-2xl relative">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold border border-indigo-200">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-base text-slate-900">Create New Freezer Model</h4>
                  <span className="text-[10px] text-slate-500 font-bold">Register Brand & Capacity Specs</span>
                </div>
              </div>
              <button onClick={() => setShowCreateModelModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewModel} className="space-y-4 text-xs">
              
              {/* Brand Selection */}
              <div>
                <label className="font-black text-slate-700 block mb-1.5">Freezer Brand *</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {POPULAR_BRANDS.map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => { setNewModelBrand(b); setCustomBrandInput(''); }}
                      className={`px-3 py-1.5 rounded-xl font-extrabold transition ${newModelBrand === b ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {b}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setNewModelBrand('Other')}
                    className={`px-3 py-1.5 rounded-xl font-extrabold transition ${newModelBrand === 'Other' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    + Custom Brand
                  </button>
                </div>

                {newModelBrand === 'Other' && (
                  <input
                    type="text"
                    placeholder="Enter custom brand name (e.g. Panasonic, Celfrost)"
                    value={customBrandInput}
                    onChange={(e) => setCustomBrandInput(e.target.value)}
                    className="w-full p-2.5 font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                )}
              </div>

              {/* Capacity Selection */}
              <div>
                <label className="font-black text-slate-700 block mb-1.5">Capacity / Volume (Liters) *</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {POPULAR_CAPACITIES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setNewModelCapacity(c); setCustomCapacityInput(''); }}
                      className={`px-2.5 py-1 rounded-xl font-extrabold transition ${newModelCapacity === c ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {c}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setNewModelCapacity('Other')}
                    className={`px-2.5 py-1 rounded-xl font-extrabold transition ${newModelCapacity === 'Other' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    + Other
                  </button>
                </div>

                {newModelCapacity === 'Other' && (
                  <input
                    type="text"
                    placeholder="Enter capacity (e.g. 600L, 800L, 1000L)"
                    value={customCapacityInput}
                    onChange={(e) => setCustomCapacityInput(e.target.value)}
                    className="w-full p-2.5 font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                )}
              </div>

              {/* Freezer Type */}
              <div>
                <label className="font-black text-slate-700 block mb-1">Freezer Category / Type</label>
                <select
                  value={newModelType}
                  onChange={(e) => setNewModelType(e.target.value)}
                  className="w-full p-2.5 font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900"
                >
                  {FREEZER_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Full Display Name (Auto-Generated & Editable) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-black text-slate-700 flex items-center gap-1.5">
                    Model Full Display Name
                    <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full border border-indigo-200 font-bold">
                      ⚡ Live Auto-Generated
                    </span>
                  </label>
                </div>
                <input
                  type="text"
                  value={newModelDisplayName}
                  onChange={(e) => setNewModelDisplayName(e.target.value)}
                  className="w-full p-2.5 font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900"
                  placeholder="e.g. Blue Star 300L Deep Freezer"
                />
              </div>

              {/* Description / Notes */}
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Description / Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Single Door, Hard Top, Low Power Consumption"
                  value={newModelDesc}
                  onChange={(e) => setNewModelDesc(e.target.value)}
                  className="w-full p-2.5 font-medium bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={creatingModel}
                  className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition"
                >
                  <Save className="w-4 h-4" />
                  {creatingModel ? 'SAVING MODEL...' : 'SAVE & REGISTER MODEL'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModelModal(false)}
                  className="py-3 px-4 rounded-2xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: MANAGE FREEZER MODELS CATALOG */}
      {/* ==================================================================== */}
      {showManageModelsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto my-auto p-6 space-y-4 shadow-2xl relative">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold border border-slate-200">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-base text-slate-900">Registered Freezer Models Catalog</h4>
                  <span className="text-[10px] text-slate-500 font-bold">{freezerModels.length} Specifications Available</span>
                </div>
              </div>
              <button onClick={() => setShowManageModelsModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowManageModelsModal(false);
                  setShowCreateModelModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add New Specification
              </button>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {freezerModels.map(m => {
                const deployedCount = shops.filter(s => s.has_freezer && (s.freezer_model || '').includes(m.model_name)).length;
                return (
                  <div key={m.id} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900">{m.model_name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-100 text-indigo-700">
                          {m.brand}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                        Type: {m.freezer_type || 'Deep Freezer'} • Capacity: {m.capacity || 'Standard'} • Deployed: {deployedCount} shops
                      </p>
                    </div>

                    {deleteFreezerModel && (
                      <button
                        onClick={async () => {
                          if (confirm(`Remove freezer specification '${m.model_name}'?`)) {
                            const res = await deleteFreezerModel(m.id);
                            if (res.success) toast.success("Model removed from catalog");
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Delete model"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: UNASSIGN FREEZER CONFIRMATION */}
      {/* ==================================================================== */}
      {unassignModal.isOpen && unassignModal.shop && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            
            <div className="text-center space-y-1">
              <h4 className="font-black text-base text-slate-900">Return / Unassign Freezer?</h4>
              <p className="text-xs text-slate-500 font-medium">
                Are you sure you want to remove the freezer allocation from <strong className="text-slate-900">{unassignModal.shop.name}</strong> ({unassignModal.shop.code})?
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Model:</span>
                <span className="font-black text-slate-900">{unassignModal.shop.freezer_model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Serial No:</span>
                <span className="font-black text-cyan-700">{unassignModal.shop.freezer_serial}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleConfirmUnassign}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 transition"
              >
                Yes, Unassign Freezer
              </button>
              <button
                onClick={() => setUnassignModal({ isOpen: false, shop: null })}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
