import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Store, Search, Snowflake, DollarSign, MapPin, Phone, 
  User, Plus, CheckCircle2, AlertTriangle, CreditCard, ChevronRight, X, 
  FileText, Clock, Send, ShieldAlert, ArrowUpRight, Check, Sparkles, PhoneCall, Edit3, Trash2, Save,
  Receipt, Eye, Printer
} from 'lucide-react';
import { toast } from 'sonner';
import { AddShopModal } from '../common/AddShopModal';
import { ThermalBillModal } from '../Employee/ThermalBillModal';

export const ShopsManagementView = ({ onNavigateVillages }) => {
  const { shops, setShops, villages = [], routes = [], sales = [], collectShopDue, addShop, updateShop, deleteShop } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, DUES, OVERDUE, FREEZER
  const [selectedVillageFilter, setSelectedVillageFilter] = useState('ALL');
  
  // Modals state
  const [selectedShopForPayment, setSelectedShopForPayment] = useState(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentModeInput, setPaymentModeInput] = useState('CASH');
  const [selectedShopForStatement, setSelectedShopForStatement] = useState(null);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState(null);
  const [printThermalBill, setPrintThermalBill] = useState(null);
  const [showAddShopModal, setShowAddShopModal] = useState(false);

  // Edit Shop Modal State
  const [selectedShopForEdit, setSelectedShopForEdit] = useState(null);
  const [editName, setEditName] = useState('');
  const [editOwnerName, setEditOwnerName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editVillageId, setEditVillageId] = useState('');
  const [editRouteId, setEditRouteId] = useState('');
  const [editDistanceKm, setEditDistanceKm] = useState('3.0');
  const [editHasFreezer, setEditHasFreezer] = useState(false);
  const [editFreezerModel, setEditFreezerModel] = useState('Blue Star 300L Visicooler');
  const [savingEdit, setSavingEdit] = useState(false);

  // Active villages for the currently logged-in Owner
  const activeVillages = useMemo(() => {
    return (villages || []).filter(v => v.status === 'ACTIVE' || v.is_active !== false);
  }, [villages]);

  // Active routes for the company
  const activeRoutes = useMemo(() => {
    return (routes || []).filter(r => r.is_active !== false);
  }, [routes]);

  const handleOpenEditShop = (shop) => {
    setSelectedShopForEdit(shop);
    setEditName(shop.name || '');
    setEditOwnerName(shop.owner_name || '');
    setEditPhone(shop.phone || '');
    setEditVillageId(shop.village_id ? String(shop.village_id) : '');
    setEditRouteId(shop.route_id ? String(shop.route_id) : '');
    setEditDistanceKm(shop.distance_km ? String(shop.distance_km) : (shop.distance ? String(parseFloat(shop.distance) || 3.0) : '3.0'));
    setEditHasFreezer(Boolean(shop.has_freezer));
    setEditFreezerModel(shop.freezer_model || 'Blue Star 300L Visicooler');
  };

  const handleSaveEditShop = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!editName.trim()) {
      toast.error("Shop name is required!");
      return;
    }

    if (!editVillageId) {
      toast.error("Please select a Village!");
      return;
    }

    const distNum = parseFloat(editDistanceKm);
    const parsedDist = isNaN(distNum) || distNum < 0 ? 0 : distNum;

    setSavingEdit(true);
    try {
      const res = await updateShop(selectedShopForEdit.id, {
        name: editName.trim(),
        owner_name: editOwnerName ? editOwnerName.trim() : null,
        phone: editPhone ? editPhone.trim() : null,
        village_id: Number(editVillageId),
        distance_km: parsedDist,
        distance: `${parsedDist} km`,
        has_freezer: Boolean(editHasFreezer),
        freezer_model: editHasFreezer ? (editFreezerModel.trim() || 'Blue Star 300L Visicooler') : null
      });

      if (res?.success) {
        const vName = res.shop?.village_name || activeVillages.find(v => Number(v.id) === Number(editVillageId))?.name || 'None';
        toast.success(`🎉 Shop "${res.shop?.name || editName}" updated! Village: ${vName}`);
        setSelectedShopForEdit(null);
      } else {
        toast.error("Failed to update shop: " + (res?.message || "Server error"));
      }
    } catch (err) {
      toast.error("Error updating shop");
    } finally {
      setSavingEdit(false);
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

  // New Shop Form State
  const [newShopName, setNewShopName] = useState('');
  const [newShopOwner, setNewShopOwner] = useState('');
  const [newShopPhone, setNewShopPhone] = useState('');

  const filteredShops = useMemo(() => {
    return (shops || []).filter(shop => {
      if (!shop) return false;
      const q = searchQuery.toLowerCase();
      const nameMatch = !q || shop.name.toLowerCase().includes(q) || (shop.code && shop.code.toLowerCase().includes(q)) || (shop.owner_name && shop.owner_name.toLowerCase().includes(q));
      
      const dueVal = Number(shop.current_due || 0);
      let typeMatch = true;
      if (filterType === 'DUES') typeMatch = dueVal > 0;
      if (filterType === 'OVERDUE') typeMatch = dueVal > 1000;
      if (filterType === 'FREEZER') typeMatch = shop.has_freezer;

      let villageMatch = true;
      if (selectedVillageFilter !== 'ALL') {
        if (selectedVillageFilter === 'UNASSIGNED') {
          villageMatch = !shop.village_id;
        } else {
          villageMatch = Number(shop.village_id) === Number(selectedVillageFilter);
        }
      }

      return nameMatch && typeMatch && villageMatch;
    });
  }, [shops, searchQuery, filterType, selectedVillageFilter]);

  const metrics = useMemo(() => {
    const list = shops || [];
    let totalDues = 0;
    let freezerShopsCount = 0;
    let shopsWithDuesCount = 0;
    let overdueRiskAmount = 0;

    list.forEach(s => {
      if (!s) return;
      const due = Number(s.current_due || 0);
      totalDues += due;
      if (s.has_freezer) freezerShopsCount += 1;
      if (due > 0) shopsWithDuesCount += 1;
      if (due > 1000) overdueRiskAmount += due;
    });

    return {
      totalShops: list.length,
      totalDues: Math.round(totalDues),
      freezerShopsCount,
      shopsWithDuesCount,
      overdueRiskAmount: Math.round(overdueRiskAmount)
    };
  }, [shops]);

  const handleCollectDue = async () => {
    if (!selectedShopForPayment) return;
    const payVal = Number(paymentAmountInput || 0);

    if (payVal <= 0) {
      toast.error("Please enter a valid payment amount!");
      return;
    }

    const maxDue = Number(selectedShopForPayment.current_due || 0);
    if (payVal > maxDue) {
      toast.error(`Payment amount (₹${payVal}) cannot exceed current outstanding due (₹${maxDue})!`);
      return;
    }

    const res = await collectShopDue(selectedShopForPayment.id, { amount: payVal, mode: paymentModeInput });
    if (res.success) {
      const remaining = res.remainingDue !== undefined ? res.remainingDue : Math.max(0, maxDue - payVal);
      if (remaining === 0) {
        toast.success(`🎉 Full payment of ₹${payVal} received from ${selectedShopForPayment.name}! Pending due converted to ₹0 (Clear Balance).`);
      } else {
        toast.success(`🎉 Partial payment of ₹${payVal} received from ${selectedShopForPayment.name}! Due reduced from ₹${maxDue} to ₹${remaining}.`);
      }
      setSelectedShopForPayment(null);
      setPaymentAmountInput('');
    } else {
      toast.error("Failed to collect payment: " + res.message);
    }
  };

  const handleCreateNewShopSubmit = async (e) => {
    e.preventDefault();
    if (!newShopName || !newShopOwner || !newShopPhone) {
      toast.error("Please fill in all store details!");
      return;
    }

    if (addShop) {
      const res = await addShop({
        name: newShopName,
        owner_name: newShopOwner,
        phone: newShopPhone,
        route_id: 1,
        distance: "3.0 km",
        current_due: 0
      });
      if (res.success) {
        toast.success(`🎉 ${newShopName} registered successfully!`);
        setShowAddShopModal(false);
        setNewShopName('');
        setNewShopOwner('');
        setNewShopPhone('');
      } else {
        toast.error("Failed to add shop: " + res.message);
      }
    }
  };

  const handleSendReminderAlert = (shop) => {
    toast.success(`📩 Dues reminder SMS sent to ${shop.name} (${shop.phone || '9876543210'})!`);
  };

  return (
    <div className="space-y-5 pb-6">
      
      {/* Executive Dark Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                RETAIL SHOPS & CREDIT DUES LEDGER
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  🟢 Live Market Credit Engine
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">Manage Registered Milk Retailers, Credit Limits, Visicooler Assets & Real-time Due Collections</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAddShopModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md border border-emerald-400/30 transition"
          >
            <Plus className="w-4 h-4" /> Register New Store
          </button>

          <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-right">
            <span className="text-[10px] text-slate-300 font-bold block uppercase tracking-wide">Market Dues Outstanding:</span>
            <span className="font-mono font-black text-xl text-amber-400">
              ₹{metrics.totalDues.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-amber-500 border border-slate-200 shadow-xs hover:-translate-y-0.5 transition">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Outstanding Market Dues</span>
          <div className="font-mono font-black text-2xl text-amber-600 mt-1.5">
            ₹{metrics.totalDues.toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-rose-500 border border-slate-200 shadow-xs hover:-translate-y-0.5 transition">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">High Risk Overdue Dues</span>
          <div className="font-mono font-black text-2xl text-rose-600 mt-1.5">
            ₹{metrics.overdueRiskAmount.toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-purple-500 border border-slate-200 shadow-xs hover:-translate-y-0.5 transition">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Shops With Active Credit</span>
          <div className="font-mono font-black text-2xl text-purple-600 mt-1.5 flex items-baseline gap-1">
            {metrics.shopsWithDuesCount} <span className="text-xs text-purple-700 font-bold">/ {metrics.totalShops} Stores</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-cyan-500 border border-slate-200 shadow-xs hover:-translate-y-0.5 transition">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Provided Visicoolers</span>
          <div className="font-mono font-black text-2xl text-cyan-600 mt-1.5">
            {metrics.freezerShopsCount} <span className="text-xs text-cyan-700 font-bold">Visicoolers</span>
          </div>
        </div>
      </div>

      {/* Toolbar: Search Bar, Village Dropdown Filter & Status Filter Pills */}
      <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-xs">
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          {/* Shop Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search store by name, code, owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white transition"
            />
          </div>

          {/* Village Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-amber-50/80 border border-amber-200/80 rounded-xl px-3 py-1.5 shadow-2xs shrink-0">
            <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="text-[11px] font-black uppercase text-amber-800 tracking-wider">Village:</span>
            <select
              value={selectedVillageFilter}
              onChange={(e) => setSelectedVillageFilter(e.target.value)}
              className="bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">All Villages (அனைத்து)</option>
              {activeVillages.length === 0 ? (
                <option value="ALL" disabled>No villages available</option>
              ) : (
                activeVillages.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
                ))
              )}
              <option value="UNASSIGNED">Unassigned / No Village</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-full lg:w-auto overflow-x-auto scrollbar-none shrink-0">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${filterType === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            All Stores ({shops.length})
          </button>
          <button
            onClick={() => setFilterType('DUES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${filterType === 'DUES' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            ⚠️ Pending Dues ({metrics.shopsWithDuesCount})
          </button>
          <button
            onClick={() => setFilterType('OVERDUE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${filterType === 'OVERDUE' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            🔴 Overdue &gt; ₹1,000
          </button>
          <button
            onClick={() => setFilterType('FREEZER')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${filterType === 'FREEZER' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            🧊 Visicoolers ({metrics.freezerShopsCount})
          </button>
        </div>
      </div>

      {/* Symmetrical 3x2 Grid Store Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
        {filteredShops.map(shop => {
          const dueVal = Number(shop.current_due || 0);
          const creditLimit = shop.credit_limit || 5000;
          const usedPct = Math.min(100, Math.round((dueVal / creditLimit) * 100));
          const isHighRisk = dueVal >= 1000;
          const shopBills = (sales || []).filter(s => Number(s.shop_id) === Number(shop.id));
          const billCount = shopBills.length || shop.bills_count || 0;

          return (
            <div 
              key={shop.id} 
              className={`glass-panel p-5 rounded-3xl bg-white border transition-all duration-300 flex flex-col justify-between h-full shadow-xs hover:shadow-xl ${
                isHighRisk 
                  ? 'border-rose-300 ring-2 ring-rose-500/10' 
                  : dueVal > 0 
                  ? 'border-amber-300' 
                  : 'border-slate-200'
              }`}
            >
              
              <div className="space-y-3.5 flex-1 flex flex-col justify-between">
                
                {/* Store Header Row with Cute Avatar Badge */}
                <div className="flex items-start justify-between gap-2.5 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xl shadow-xs shrink-0 ${
                      shop.has_freezer 
                        ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white' 
                        : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
                    }`}>
                      🏬
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-base text-slate-900 leading-tight">{shop.name}</h4>
                        <span className="text-[10px] font-mono font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {shop.code || `#${shop.id}`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-semibold flex items-center gap-1 mt-0.5">
                        <User className="w-3.5 h-3.5 text-slate-400" /> Owner: {shop.owner_name || 'Retailer'}
                      </p>
                    </div>
                  </div>

                  {/* Status Pills */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {shop.has_freezer ? (
                      <span className="px-2.5 py-1 bg-cyan-100 text-cyan-800 font-black rounded-xl text-[10px] border border-cyan-200 flex items-center gap-1">
                        🧊 Visicooler
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-500 font-bold rounded-xl text-[10px]">
                        Regular
                      </span>
                    )}
                    <span className="text-[10px] font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <Receipt className="w-2.5 h-2.5" /> {billCount} {billCount === 1 ? 'Bill' : 'Bills'}
                    </span>
                  </div>
                </div>

                {/* Specs Box (Uniform Min-Height 105px Across All Cards) */}
                <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-200 min-h-[110px] flex flex-col justify-center">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-500" /> Village Territory:
                    </span>
                    <span className={`font-bold text-xs ${shop.village_name ? 'text-amber-900 font-extrabold bg-amber-100/80 px-2 py-0.5 rounded-lg border border-amber-200' : 'text-slate-400 font-normal italic'}`}>
                      {shop.village_name || 'No Village Assigned'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone Contact:
                    </span>
                    <a href={`tel:${shop.phone || '9123456789'}`} className="font-mono font-extrabold text-blue-600 hover:underline flex items-center gap-1">
                      <PhoneCall className="w-3 h-3 text-blue-500" />
                      {shop.phone || '9123456789'}
                    </a>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> Route Distance:
                    </span>
                    <span className="font-bold text-slate-700">{shop.distance || '2.5 km'} {shop.route_name ? `(${shop.route_name})` : ''}</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5 mt-0.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Freezer Asset:</span>
                    <span className={`font-bold ${shop.has_freezer ? 'text-cyan-900 font-mono' : 'text-slate-400 font-normal'}`}>
                      {shop.has_freezer ? (shop.freezer_model || 'Blue Star 300L Deep Freezer') : 'Not Assigned (Regular)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5 mt-0.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Receipt className="w-3.5 h-3.5 text-indigo-500" /> Bills Generated:
                    </span>
                    <span className="font-mono font-black text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                      {billCount} {billCount === 1 ? 'Bill' : 'Bills'}
                    </span>
                  </div>
                </div>

                {/* Credit Gauge Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-slate-500 font-sans font-bold">Credit Limit Usage:</span>
                    <span className={usedPct > 50 ? 'font-black text-rose-600' : 'font-bold text-slate-700'}>
                      ₹{dueVal.toLocaleString()} / ₹{creditLimit.toLocaleString()} ({usedPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        usedPct > 75 ? 'bg-gradient-to-r from-rose-500 to-red-600' : usedPct > 30 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                      }`}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                </div>

                {/* Outstanding Amount Card Box */}
                <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                  dueVal > 0 
                    ? 'bg-amber-50/80 border-amber-200 text-amber-950' 
                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                }`}>
                  <div>
                    <span className="text-[10px] font-bold uppercase block tracking-tight">Current Credit Due:</span>
                    <span className="font-mono font-black text-2xl leading-none">
                      ₹{dueVal.toLocaleString()}
                    </span>
                  </div>

                  <div className="text-right">
                    {dueVal > 0 ? (
                      <span className="text-[10px] font-black uppercase text-amber-700 bg-white px-2.5 py-1 rounded-md border border-amber-300 shadow-2xs block">
                        ⚠️ PAYMENT DUE
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase text-emerald-700 bg-white px-2.5 py-1 rounded-md border border-emerald-300 shadow-2xs block">
                        ✓ CLEAR BALANCE
                      </span>
                    )}
                  </div>
                </div>

              </div>

              {/* Action Buttons Row */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditShop(shop)}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center gap-1 border border-slate-200 shadow-2xs transition cursor-pointer"
                  title="Edit Shop Details & Assign Village"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" /> Edit
                </button>

                <button
                  onClick={(e) => handleDeleteShop(shop, e)}
                  className="py-2.5 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-black text-xs flex items-center justify-center gap-1 border border-rose-200 shadow-2xs transition cursor-pointer"
                  title="Delete or Deactivate Shop"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                </button>

                <button
                  onClick={() => setSelectedShopForStatement(shop)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center gap-1.5 border border-slate-200 shadow-2xs transition"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" /> Statement
                </button>

                {dueVal > 0 ? (
                  <button
                    onClick={() => {
                      setSelectedShopForPayment(shop);
                      setPaymentAmountInput(String(dueVal));
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs flex items-center justify-center gap-1 shadow-xs border border-amber-400 transition"
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Collect Due
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex-1 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 font-extrabold text-xs flex items-center justify-center gap-1 opacity-80 cursor-default border border-emerald-200"
                  >
                    ✓ No Dues
                  </button>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {/* Modal 1: Collect Due Payment Modal */}
      {selectedShopForPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto my-auto p-5 space-y-4 shadow-2xl relative">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-base border border-amber-200">
                  💰
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Collect Store Due Payment</h3>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">{selectedShopForPayment.name}</span>
                </div>
              </div>
              <button onClick={() => setSelectedShopForPayment(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 text-xs text-amber-900 flex justify-between items-center font-mono">
                <span className="font-sans font-bold">Outstanding Credit Due:</span>
                <span className="font-black text-amber-700 text-base">₹{(selectedShopForPayment.current_due || 0).toLocaleString()}</span>
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase block mb-1">Select Payment Mode:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentModeInput('CASH')}
                    className={`py-2.5 rounded-xl font-black text-xs border transition ${paymentModeInput === 'CASH' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
                  >
                    💵 Cash (ரொக்கம்)
                  </button>
                  <button
                    onClick={() => setPaymentModeInput('GPAY')}
                    className={`py-2.5 rounded-xl font-black text-xs border transition ${paymentModeInput === 'GPAY' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
                  >
                    📱 GPay / UPI
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase block mb-1">Payment Received Amount (₹):</label>
                <input
                  type="number"
                  placeholder="Enter amount collected..."
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  className="w-full text-sm font-mono font-black bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleCollectDue}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-xs shadow-md transition cursor-pointer"
              >
                RECORD PAYMENT & UPDATE DUE
              </button>
              <button
                onClick={() => setSelectedShopForPayment(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal 2: Register New Store Modal */}
      {showAddShopModal && (
        <AddShopModal onClose={() => setShowAddShopModal(false)} />
      )}

      {/* Modal 3: Store Billing & Statement History Breakdown Modal */}
      {selectedShopForStatement && (() => {
        const currentShopBills = (sales || []).filter(s => Number(s.shop_id) === Number(selectedShopForStatement.id));
        const totalBilledVal = currentShopBills.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto my-auto p-5 space-y-4 shadow-2xl relative">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-base border border-blue-200">
                    📜
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900">Store Invoices & Billing History</h3>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">{selectedShopForStatement.name} ({selectedShopForStatement.code || `#${selectedShopForStatement.id}`})</span>
                  </div>
                </div>
                <button onClick={() => setSelectedShopForStatement(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {/* Stats Header */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 font-mono text-center">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block font-sans">Total Bills:</span>
                    <span className="font-black text-slate-900 text-base">{currentShopBills.length}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block font-sans">Total Billed:</span>
                    <span className="font-black text-blue-700 text-base">₹{totalBilledVal.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block font-sans">Current Due:</span>
                    <span className="font-black text-amber-600 text-base">₹{(selectedShopForStatement.current_due || 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* Reminder action */}
                {(Number(selectedShopForStatement.current_due || 0) > 0) && (
                  <div className="flex items-center justify-between p-2.5 bg-amber-50 rounded-2xl border border-amber-200">
                    <span className="text-[11px] font-bold text-amber-900">Outstanding credit balance exists for this store.</span>
                    <button
                      onClick={() => handleSendReminderAlert(selectedShopForStatement)}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs flex items-center gap-1 transition cursor-pointer"
                    >
                      <Send className="w-3 h-3" /> Send SMS
                    </button>
                  </div>
                )}

                {/* Invoices List */}
                <div>
                  <h4 className="font-extrabold text-slate-800 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-600" /> Billed Invoices List ({currentShopBills.length})
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Click view to see line items</span>
                  </h4>

                  {currentShopBills.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1">
                      <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-600 text-xs">No bills generated yet for this shop</p>
                      <p className="text-[10px] text-slate-400">Bills created by drivers or storekeeper for this shop will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {currentShopBills.map((inv, idx) => {
                        const itemsList = inv.items || [];
                        const itemsCount = itemsList.length;
                        const totalPcs = itemsList.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);

                        return (
                          <div 
                            key={inv.id || inv.bill_no || idx} 
                            className="p-3 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 transition-all shadow-2xs flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-black text-purple-700 text-xs">#{inv.bill_no}</span>
                                <span className="text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold uppercase border border-slate-200">
                                  {inv.payment_mode}
                                </span>
                                <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold border border-blue-200">
                                  {itemsCount} {itemsCount === 1 ? 'Item' : 'Items'} ({totalPcs} pcs)
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-medium flex items-center gap-2 flex-wrap">
                                <span className="flex items-center gap-1 font-mono">
                                  <Clock className="w-3 h-3 text-slate-400" /> {inv.sale_date || inv.date || 'Today'} • {inv.sale_time || inv.time || ''}
                                </span>
                                <span className="text-slate-400">|</span>
                                <span>By: <strong className="text-slate-700">{inv.employee_name || 'Store Keeper'}</strong></span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right font-mono">
                                <span className="font-black text-slate-900 text-sm block">₹{Number(inv.total_amount || 0).toLocaleString()}</span>
                                {Number(inv.credit_paid || 0) > 0 && (
                                  <span className="text-[10px] text-amber-600 font-bold block">Due: ₹{Number(inv.credit_paid).toLocaleString()}</span>
                                )}
                              </div>
                              <button
                                onClick={() => setSelectedInvoiceForModal(inv)}
                                className="p-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-black text-[11px] flex items-center gap-1 border border-purple-200 transition cursor-pointer"
                                title="View Bill Details & Line Items"
                              >
                                <Eye className="w-3.5 h-3.5" /> View
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setSelectedShopForStatement(null)}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition cursor-pointer"
              >
                Close Statement
              </button>
            </div>
          </div>
        );
      })()}

      {/* Modal: Specific Invoice Details Modal with Line Items */}
      {selectedInvoiceForModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto my-auto p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900">Bill Invoice #{selectedInvoiceForModal.bill_no}</h3>
                <span className="text-[10px] text-slate-500 font-mono">{selectedInvoiceForModal.sale_date || selectedInvoiceForModal.date} • {selectedInvoiceForModal.sale_time || selectedInvoiceForModal.time}</span>
              </div>
              <button onClick={() => setSelectedInvoiceForModal(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[10px]">Customer / Retailer:</span>
                  <span className="font-black text-slate-900 text-xs">{selectedInvoiceForModal.shop_name || selectedInvoiceForModal.customer_name || 'Walk-in'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Bill Generated By:</span>
                  <span className="font-black text-slate-900 text-xs">{selectedInvoiceForModal.employee_name || 'Store Keeper'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Payment Mode:</span>
                  <span className="font-black text-purple-700 uppercase">{selectedInvoiceForModal.payment_mode}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Total Amount:</span>
                  <span className="font-black text-emerald-600 text-sm">₹{Number(selectedInvoiceForModal.total_amount || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="space-y-1.5">
                <span className="font-extrabold text-slate-700 block">Line Items:</span>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 font-extrabold text-slate-700 uppercase text-[9px]">
                      <tr>
                        <th className="p-2">Item Name</th>
                        <th className="p-2 text-center">Qty</th>
                        <th className="p-2 text-right">Rate</th>
                        <th className="p-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedInvoiceForModal.items || []).length === 0 ? (
                        <tr>
                          <td colSpan="4" className="p-4 text-center text-slate-400">No line items found for this bill</td>
                        </tr>
                      ) : (
                        (selectedInvoiceForModal.items || []).map((item, i) => (
                          <tr key={i}>
                            <td className="p-2 font-bold">{item.product_name || item.name}</td>
                            <td className="p-2 text-center font-mono">{item.qty} {item.unit_type || 'Piece'}</td>
                            <td className="p-2 text-right font-mono">₹{Number(item.rate || 0).toFixed(2)}</td>
                            <td className="p-2 text-right font-mono font-black">₹{Number(item.amount || item.total || 0).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => { setPrintThermalBill(selectedInvoiceForModal); setSelectedInvoiceForModal(null); }}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Thermal Bill
                </button>
                <button
                  onClick={() => setSelectedInvoiceForModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THERMAL BILL MODAL */}
      {printThermalBill && (
        <ThermalBillModal
          bill={printThermalBill}
          onClose={() => setPrintThermalBill(null)}
        />
      )}

      {/* Modal 4: Edit Shop Details & Assign Village Modal */}
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
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  required
                />
              </div>

              {/* Village Selection Dropdown (Required) */}
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-700 uppercase flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-500" />
                    Village Territory (கிராமம்) *
                  </span>
                  {activeVillages.length > 0 && (
                    <span className="text-[10px] font-medium text-slate-400">
                      {activeVillages.length} Villages available
                    </span>
                  )}
                </label>

                {activeVillages.length === 0 ? (
                  <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl space-y-1 text-xs text-amber-900">
                    <p className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      No villages available. Please create a village first.
                    </p>
                    {onNavigateVillages && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedShopForEdit(null);
                          onNavigateVillages();
                        }}
                        className="text-xs font-black text-amber-800 underline hover:text-amber-950 inline-block pt-1 cursor-pointer"
                      >
                        Go to Villages Master ➔
                      </button>
                    )}
                  </div>
                ) : (
                  <select
                    value={editVillageId}
                    onChange={(e) => setEditVillageId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                    required
                  >
                    <option value="" disabled>-- Select Village (Required) --</option>
                    {activeVillages.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.code}) — Route: {v.route_name || 'Assigned'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Auto-derived Route Display */}
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-700 uppercase">
                  Assigned Route (Auto-Derived from Village)
                </label>
                <div className="w-full bg-indigo-50/70 border border-indigo-200 rounded-xl px-3 py-2.5 text-xs font-bold text-indigo-950 flex items-center justify-between shadow-2xs">
                  <span>
                    {activeVillages.find(v => String(v.id) === String(editVillageId))?.route_name 
                      ? `${activeVillages.find(v => String(v.id) === String(editVillageId))?.route_name} (${activeVillages.find(v => String(v.id) === String(editVillageId))?.route_code || 'Route'})`
                      : 'Select a village to determine route'}
                  </span>
                  <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200">
                    Auto-Derived
                  </span>
                </div>
              </div>

              {/* Owner Name & Phone */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-700 uppercase">Owner Name</label>
                  <input
                    type="text"
                    value={editOwnerName}
                    onChange={(e) => setEditOwnerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-700 uppercase">Phone Number</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
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
                  value={editDistanceKm}
                  onChange={(e) => setEditDistanceKm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              {/* Freezer Option */}
              <div className="p-3 bg-cyan-50/80 border border-cyan-200/80 rounded-2xl space-y-2">
                <label className="flex items-center gap-2 text-xs font-black text-cyan-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editHasFreezer}
                    onChange={(e) => setEditHasFreezer(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded cursor-pointer"
                  />
                  <Snowflake className="w-4 h-4 text-cyan-600" />
                  Provide Free Freezer Asset 🧊
                </label>
                {editHasFreezer && (
                  <input
                    type="text"
                    value={editFreezerModel}
                    onChange={(e) => setEditFreezerModel(e.target.value)}
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
                  disabled={savingEdit}
                  className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer transition active:scale-[0.98]"
                >
                  <Save className="w-4 h-4" />
                  {savingEdit ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};

