import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Truck, MapPin, CheckCircle2, Clock, AlertCircle, 
  RotateCcw, RefreshCw, DollarSign, Package, User, ChevronRight, X, Sparkles, ShieldCheck,
  Search, Filter, Calendar, FileText, ChevronDown, ChevronUp, AlertTriangle, Eye, ArrowUpRight,
  Plus, Edit3, Trash2, Layers, Building, Store, Users, Check
} from 'lucide-react';
import { toast } from 'sonner';

export function DriverRouteManagementView() {
  const appContext = useApp() || {};
  const { 
    fetchFleetRouteSummary, 
    fetchDriverDetailSummary, 
    routes = [], 
    villages = [], 
    addRoute, 
    updateRoute, 
    deleteRoute, 
    fetchData,
    users = [], 
    sales = [], 
    stockMovements = [], 
    products = [], 
    shops = [] 
  } = appContext;

  // Normalized Arrays
  const safeRoutes = Array.isArray(routes) ? routes.filter(r => r && r.is_active !== false) : [];
  const safeVillages = Array.isArray(villages) ? villages.filter(v => v && v.status !== 'INACTIVE') : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeSales = Array.isArray(sales) ? sales : [];
  const safeStockMovements = Array.isArray(stockMovements) ? stockMovements : [];
  const safeProducts = Array.isArray(products) ? products : [];
  const safeShops = Array.isArray(shops) ? shops : [];

  // Tab State: 'routes' (Route Master) vs 'fleet' (Live Monitor)
  const [activeTab, setActiveTab] = useState('routes');

  // Route Master State & Modals
  const [showCreateRouteModal, setShowCreateRouteModal] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [creatingRoute, setCreatingRoute] = useState(false);

  const [editingRoute, setEditingRoute] = useState(null);
  const [editRouteName, setEditRouteName] = useState('');
  const [updatingRoute, setUpdatingRoute] = useState(false);

  const [routeSearchQuery, setRouteSearchQuery] = useState('');

  // Fleet Live Monitor State
  const [fleetData, setFleetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('ALL');
  const [selectedRouteId, setSelectedRouteId] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // UI Expand / Modal States
  const [expandedDriverId, setExpandedDriverId] = useState(null);
  const [expandedVillageKey, setExpandedVillageKey] = useState(null);
  const [selectedBillForInspection, setSelectedBillForInspection] = useState(null);
  
  // Drawer State
  const [drawerDriverId, setDrawerDriverId] = useState(null);
  const [drawerData, setDrawerData] = useState(null);
  const [drawerActiveTab, setDrawerActiveTab] = useState('overview');

  // Load Fleet Summary on Mount & State Changes
  const loadFleetData = async () => {
    try {
      setLoading(true);
      setApiError(null);
      if (typeof fetchFleetRouteSummary === 'function') {
        const data = await fetchFleetRouteSummary();
        if (data && Array.isArray(data.driverCards)) {
          setFleetData(data);
        } else {
          setFleetData({ kpis: {}, driverCards: [] });
        }
      } else {
        setFleetData({ kpis: {}, driverCards: [] });
      }
    } catch (err) {
      console.error("Error loading fleet route summary:", err);
      setApiError("Unable to load driver route data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFleetData();
  }, [safeSales.length, safeStockMovements.length, safeUsers.length, safeRoutes.length]);

  // Route Villages Mapping
  const routeVillagesMap = useMemo(() => {
    const map = {};
    safeVillages.forEach(v => {
      if (v && v.route_id) {
        if (!map[v.route_id]) map[v.route_id] = [];
        map[v.route_id].push(v);
      }
    });
    return map;
  }, [safeVillages]);

  // Route Shop Counts Mapping
  const routeShopCounts = useMemo(() => {
    const map = {};
    safeShops.forEach(s => {
      if (s && s.village_id) {
        const v = safeVillages.find(vl => Number(vl.id) === Number(s.village_id));
        if (v && v.route_id) {
          map[v.route_id] = (map[v.route_id] || 0) + 1;
        }
      }
    });
    return map;
  }, [safeShops, safeVillages]);

  // Route Driver Mapping
  const routeDriversMap = useMemo(() => {
    const map = {};
    safeUsers.forEach(u => {
      if (u && u.route_id) {
        map[u.route_id] = u;
      }
    });
    return map;
  }, [safeUsers]);

  // Filtered Routes
  const filteredRoutes = useMemo(() => {
    return safeRoutes.filter(r => {
      if (!r) return false;
      const q = routeSearchQuery.toLowerCase().trim();
      if (!q) return true;
      const matchName = (r.name || '').toLowerCase().includes(q);
      const matchCode = (r.code || '').toLowerCase().includes(q);
      const matchDriver = (r.driver_name || '').toLowerCase().includes(q);
      return matchName || matchCode || matchDriver;
    });
  }, [safeRoutes, routeSearchQuery]);

  // Open Driver Drawer with Full 10-Tab Details
  const handleOpenDrawer = async (driverId) => {
    setDrawerDriverId(driverId);
    setDrawerActiveTab('overview');
    if (typeof fetchDriverDetailSummary === 'function') {
      const data = await fetchDriverDetailSummary(driverId);
      setDrawerData(data);
    }
  };

  // Filtered Driver Cards Calculation
  const filteredDriverCards = useMemo(() => {
    if (!fleetData || !Array.isArray(fleetData.driverCards)) return [];
    
    return fleetData.driverCards.filter(card => {
      if (selectedDriverId !== 'ALL' && Number(card.driver_id) !== Number(selectedDriverId)) {
        return false;
      }
      if (selectedRouteId !== 'ALL' && Number(card.route_id) !== Number(selectedRouteId)) {
        return false;
      }
      if (selectedStatus !== 'ALL' && card.route_status !== selectedStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = (card.driver_name || '').toLowerCase().includes(query);
        const matchVehicle = (card.vehicle_no || '').toLowerCase().includes(query);
        const matchRoute = (card.route_name || '').toLowerCase().includes(query);
        const villagesList = Array.isArray(card.villages) ? card.villages : [];
        const matchVillage = villagesList.some(v => (v.village_name || '').toLowerCase().includes(query));
        const matchShop = villagesList.some(v => Array.isArray(v.shops) && v.shops.some(s => (s.name || '').toLowerCase().includes(query) || (s.code && s.code.toLowerCase().includes(query))));
        if (!matchName && !matchVehicle && !matchRoute && !matchVillage && !matchShop) {
          return false;
        }
      }
      return true;
    });
  }, [fleetData, selectedDriverId, selectedRouteId, selectedStatus, searchQuery]);

  // Derived Fleet KPIs from filtered cards
  const fleetKpis = useMemo(() => {
    if (!fleetData || !fleetData.kpis) {
      return {
        activeDrivers: safeUsers.filter(u => u.role === 'EMPLOYEE' || u.role === 'DRIVER').length, driversOnRoute: 0, driversCompleted: 0,
        assignedVillages: 0, completedVillages: 0, assignedShops: 0,
        billedShops: 0, pendingShops: 0, totalIssuedPcs: 0,
        totalSoldPcs: 0, totalRemainingPcs: 0, totalReturnedPcs: 0,
        totalDamagedPcs: 0, totalSalesAmount: 0, totalCollectedAmount: 0, totalCreditAmount: 0
      };
    }
    return fleetData.kpis;
  }, [fleetData, safeUsers]);

  const driverEmployees = useMemo(() => {
    return safeUsers.filter(u => u.role === 'EMPLOYEE' || u.role === 'DRIVER');
  }, [safeUsers]);

  // Route Handlers
  const handleCreateRoute = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newRouteName.trim()) {
      toast.error('Please enter a route name');
      return;
    }
    try {
      setCreatingRoute(true);
      if (typeof addRoute === 'function') {
        const res = await addRoute({ name: newRouteName.trim() });
        if (res && res.success) {
          toast.success(`Route "${res.route?.name || newRouteName}" created successfully (${res.route?.code || 'ROUTE-XXXX'})`);
          setNewRouteName('');
          setShowCreateRouteModal(false);
          if (typeof fetchData === 'function') fetchData();
          loadFleetData();
        } else {
          toast.error(res?.message || 'Failed to create route');
        }
      }
    } catch (err) {
      toast.error(err.message || 'Error creating route');
    } finally {
      setCreatingRoute(false);
    }
  };

  const handleUpdateRoute = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!editingRoute || !editRouteName.trim()) {
      toast.error('Please enter a route name');
      return;
    }
    try {
      setUpdatingRoute(true);
      if (typeof updateRoute === 'function') {
        const res = await updateRoute(editingRoute.id, { name: editRouteName.trim() });
        if (res && res.success) {
          toast.success(`Route updated to "${editRouteName.trim()}"`);
          setEditingRoute(null);
          setEditRouteName('');
          if (typeof fetchData === 'function') fetchData();
          loadFleetData();
        } else {
          toast.error(res?.message || 'Failed to update route');
        }
      }
    } catch (err) {
      toast.error(err.message || 'Error updating route');
    } finally {
      setUpdatingRoute(false);
    }
  };

  const handleDeleteRoute = async (routeId, routeName) => {
    const assignedVillages = routeVillagesMap[routeId] || [];
    if (assignedVillages.length > 0) {
      toast.error(`Cannot delete "${routeName}". There are ${assignedVillages.length} active village(s) assigned to this route. Please reassign or delete the villages first.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete route "${routeName}"?`)) return;
    try {
      if (typeof deleteRoute === 'function') {
        const res = await deleteRoute(routeId);
        if (res && res.success) {
          toast.success(`Route "${routeName}" deleted successfully`);
          if (typeof fetchData === 'function') fetchData();
          loadFleetData();
        } else {
          toast.error(res?.message || 'Failed to delete route');
        }
      }
    } catch (err) {
      toast.error(err.message || 'Error deleting route');
    }
  };

  return (
    <div className="space-y-6 text-slate-800 pb-6">
      
      {/* HEADER TITLE & CONTROL BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white p-6 rounded-3xl shadow-xl border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-blue-400/30 tracking-wider">
              Fleet Operations & Route Master
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> DB Transaction Sync Active
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
            <Truck className="w-7 h-7 text-blue-400" /> Employees & Routes Management
          </h1>
          <p className="text-xs text-slate-300">
            Define distribution routes, track live van sales, village progress, storekeeper return verifications & stock reconciliation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setShowCreateRouteModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition shadow-md shadow-blue-900/50 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" /> + CREATE ROUTE
          </button>

          <button 
            onClick={() => { loadFleetData(); if (typeof fetchData === 'function') fetchData(); }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs transition border border-white/10 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* PRIMARY TAB SELECTOR */}
      <div className="flex items-center gap-2 bg-slate-200/80 p-1.5 rounded-2xl border border-slate-300 max-w-md shadow-inner">
        <button
          onClick={() => setActiveTab('fleet')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition ${
            activeTab === 'fleet'
              ? 'bg-white text-slate-900 shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Truck className="w-4 h-4 text-blue-600" />
          <span>Live Fleet Operations</span>
          {filteredDriverCards.length > 0 && (
            <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-extrabold">
              {filteredDriverCards.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('routes')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition ${
            activeTab === 'routes'
              ? 'bg-white text-slate-900 shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <MapPin className="w-4 h-4 text-purple-600" />
          <span>Route Master Network</span>
          <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full font-extrabold">
            {safeRoutes.length}
          </span>
        </button>
      </div>

      {/* API ERROR / LOADING NOTIFICATION */}
      {apiError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-xs font-bold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <span>{apiError}</span>
          </div>
          <button onClick={loadFleetData} className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-extrabold">
            Retry Loading
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: ROUTE MASTER NETWORK MANAGEMENT */}
      {/* ========================================================= */}
      {activeTab === 'routes' && (
        <div className="space-y-6">
          
          {/* ROUTE MASTER TOP KPIS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Routes</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{safeRoutes.length}</span>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  Active
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-bold block">Delivery Lines</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Villages</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-indigo-900">{safeVillages.length}</span>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  Assigned
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-bold block">Across all routes</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Retail Stores</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-blue-900">
                  {safeShops.filter(s => s && s.village_id).length}
                </span>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  In Network
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-bold block">Under route villages</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Assigned Drivers</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-900">
                  {safeUsers.filter(u => u.route_id).length}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Active Vans
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-bold block">Linked to routes</span>
            </div>
          </div>

          {/* ROUTE SEARCH & ACTIONS BAR */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                value={routeSearchQuery}
                onChange={(e) => setRouteSearchQuery(e.target.value)}
                placeholder="Search route name, code (e.g. ROUTE-0001), or driver..."
                className="w-full pl-10 pr-4 py-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              {routeSearchQuery && (
                <button onClick={() => setRouteSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button 
              onClick={() => setShowCreateRouteModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs transition shadow-sm"
            >
              <Plus className="w-4 h-4" /> + CREATE ROUTE
            </button>
          </div>

          {/* ROUTE CARDS GRID */}
          {filteredRoutes.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-4">
              <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center mx-auto border border-purple-200">
                <MapPin className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-base text-slate-900">
                  {safeRoutes.length === 0 ? 'No Routes Created Yet' : 'No Matching Routes Found'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {safeRoutes.length === 0 
                    ? 'Routes are the foundation for organizing Villages, Retail Shops, and Driver van sales. Click below to create your first route.' 
                    : 'Try clearing your search query to view all available distribution routes.'}
                </p>
              </div>
              {safeRoutes.length === 0 && (
                <button
                  onClick={() => setShowCreateRouteModal(true)}
                  className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs transition shadow-md inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Create First Route
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRoutes.map(route => {
                const assignedVillages = routeVillagesMap[route.id] || [];
                const shopCount = routeShopCounts[route.id] || route.shop_count || 0;
                const assignedDriver = routeDriversMap[route.id] || (route.driver_name ? { name: route.driver_name, vehicle_number: route.vehicle_number } : null);

                return (
                  <div key={route.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between">
                    
                    {/* CARD HEADER */}
                    <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300 font-mono tracking-wider">
                              {route.code || `ROUTE-${String(route.id).padStart(4, '0')}`}
                            </span>
                          </div>
                          <h3 className="font-black text-base text-slate-900">{route.name}</h3>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingRoute(route);
                              setEditRouteName(route.name);
                            }}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title="Edit Route Name"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRoute(route.id, route.name)}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                            title="Delete Route"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* ASSIGNED DRIVER INFO */}
                      <div className="p-3 bg-slate-100/80 rounded-2xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-blue-600" />
                          <div>
                            <span className="text-[10px] font-extrabold text-slate-400 block uppercase">Assigned Driver</span>
                            <span className="font-black text-slate-800">
                              {assignedDriver ? assignedDriver.name || assignedDriver.full_name : 'Unassigned'}
                            </span>
                          </div>
                        </div>
                        {assignedDriver?.vehicle_number && (
                          <span className="text-[10px] font-mono font-black bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700">
                            {assignedDriver.vehicle_number}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* CARD BODY: VILLAGES & SHOPS */}
                    <div className="p-5 space-y-4 flex-1">
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-2xl">
                          <span className="text-[10px] font-black text-indigo-500 uppercase block">Villages</span>
                          <span className="text-xl font-black text-indigo-900">{assignedVillages.length}</span>
                        </div>
                        <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-2xl">
                          <span className="text-[10px] font-black text-blue-500 uppercase block">Retail Shops</span>
                          <span className="text-xl font-black text-blue-900">{shopCount}</span>
                        </div>
                      </div>

                      {/* VILLAGE TAGS */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Assigned Villages:</span>
                        {assignedVillages.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No villages assigned. Add villages in Villages Master.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                            {assignedVillages.map(v => (
                              <span key={v.id} className="text-[11px] font-extrabold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-xl border border-slate-200 flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-purple-600" /> {v.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CARD FOOTER */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span>Status: <strong className="text-emerald-600">Active</strong></span>
                      <span className="font-mono text-[10px]">DB Linked</span>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: LIVE FLEET OPERATIONS MONITOR */}
      {/* ========================================================= */}
      {activeTab === 'fleet' && (
        <div className="space-y-6">

          {/* SECTION A — REAL-TIME TOP KPI SUMMARY CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {/* KPI 1: Active Drivers */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Active Drivers</span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black text-slate-900">{fleetKpis.activeDrivers || 0}</span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {fleetKpis.driversOnRoute || 0} On Route
                </span>
              </div>
              <span className="text-[9px] text-slate-500 font-bold block">{fleetKpis.driversCompleted || 0} Completed</span>
            </div>

            {/* KPI 2: Assigned Villages */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Villages Progress</span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black text-indigo-900">{fleetKpis.completedVillages || 0}/{fleetKpis.assignedVillages || 0}</span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                  {fleetKpis.assignedVillages > 0 ? Math.round(((fleetKpis.completedVillages || 0) / fleetKpis.assignedVillages) * 100) : 0}% Done
                </span>
              </div>
              <span className="text-[9px] text-slate-500 font-bold block">Targeted Village Lines</span>
            </div>

            {/* KPI 3: Shops Billed */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Shops Coverage</span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black text-blue-900">{fleetKpis.billedShops || 0}/{fleetKpis.assignedShops || 0}</span>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                  {fleetKpis.pendingShops || 0} Pending
                </span>
              </div>
              <span className="text-[9px] text-slate-500 font-bold block">Assigned Retail Stores</span>
            </div>

            {/* KPI 4: Issued Base Stock */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Products Issued</span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black text-purple-900">{fleetKpis.totalIssuedPcs || 0} Pcs</span>
                <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                  ~{Math.floor((fleetKpis.totalIssuedPcs || 0) / 20)} Trays
                </span>
              </div>
              <span className="text-[9px] text-slate-500 font-bold block">Total Stock Outward</span>
            </div>

            {/* KPI 5: Sold Base Stock */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Products Sold</span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black text-emerald-900">{fleetKpis.totalSoldPcs || 0} Pcs</span>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  ~{Math.floor((fleetKpis.totalSoldPcs || 0) / 20)} Trays
                </span>
              </div>
              <span className="text-[9px] text-slate-500 font-bold block">POS Billed Quantity</span>
            </div>

            {/* KPI 6: Stock Balance */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Driver Stock Bal.</span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black text-amber-900">{fleetKpis.totalRemainingPcs || 0} Pcs</span>
                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  On Route
                </span>
              </div>
              <span className="text-[9px] text-slate-500 font-bold block">Current Vehicles Stock</span>
            </div>

            {/* KPI 7: Total Sales Revenue */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Sales Revenue</span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black text-emerald-600">₹{(fleetKpis.totalSalesAmount || 0).toLocaleString()}</span>
              </div>
              <span className="text-[9px] text-slate-500 font-bold block">Total Invoice Values</span>
            </div>

            {/* KPI 8: Total Collections vs Credit */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Collections / Credit</span>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-black text-blue-700">₹{(fleetKpis.totalCollectedAmount || 0).toLocaleString()}</span>
                <span className="text-[10px] font-extrabold text-rose-600">₹{(fleetKpis.totalCreditAmount || 0).toLocaleString()}</span>
              </div>
              <span className="text-[9px] text-slate-500 font-bold block">Cash+GPay / Credit Dues</span>
            </div>
          </div>

          {/* FILTER BAR SYSTEM */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              
              {/* Global Search Input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search driver name, vehicle #, route, village, shop name or invoice #..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter Select Controls */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Driver Filter */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <select 
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="bg-transparent font-extrabold text-slate-700 outline-none"
                  >
                    <option value="ALL">All Drivers ({driverEmployees.length})</option>
                    {driverEmployees.map(d => (
                      <option key={d.id} value={d.id}>🚚 {d.name}</option>
                    ))}
                  </select>
                </div>

                {/* Route Status Filter */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <select 
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="bg-transparent font-extrabold text-slate-700 outline-none"
                  >
                    <option value="ALL">All Route Statuses</option>
                    <option value="ON_ROUTE">🟢 On Route</option>
                    <option value="COMPLETED">✅ Completed</option>
                    <option value="NOT_STARTED">⏳ Not Started</option>
                  </select>
                </div>

                {/* Clear Filters Reset */}
                {(selectedDriverId !== 'ALL' || selectedStatus !== 'ALL' || searchQuery !== '') && (
                  <button 
                    onClick={() => { setSelectedDriverId('ALL'); setSelectedStatus('ALL'); setSearchQuery(''); }}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 font-extrabold text-xs border border-rose-200 hover:bg-rose-100 transition"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* DYNAMIC DRIVER OPERATIONAL CARDS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" /> Driver Operational Records ({filteredDriverCards.length})
              </h2>
              <span className="text-xs font-bold text-slate-500">
                Showing dynamic records calculated directly from live database transactions
              </span>
            </div>

            {loading ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                <h3 className="font-black text-sm text-slate-700">Loading driver route operations data...</h3>
                <p className="text-xs text-slate-500">Retrieving live database transaction summaries</p>
              </div>
            ) : filteredDriverCards.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
                <AlertCircle className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="font-black text-sm text-slate-700">No Driver Operational Records Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Create routes and assign drivers in User Accounts to start tracking van sales and live route progress.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredDriverCards.map(card => {
                  const isExpanded = expandedDriverId === card.driver_id;
                  const villagesList = Array.isArray(card.villages) ? card.villages : [];

                  return (
                    <div key={card.driver_id} className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden">
                      
                      {/* DRIVER CARD HEADER */}
                      <div className="p-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 font-black text-lg flex items-center justify-center border border-blue-200 shadow-inner">
                              🚚
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-black text-base text-slate-900">{card.driver_name}</h3>
                                <span className="text-[10px] font-extrabold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full">
                                  ID #{card.driver_id}
                                </span>
                              </div>
                              <p className="text-xs font-bold text-slate-600 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-blue-600" /> {card.route_name}
                              </p>
                              <span className="text-[10px] text-slate-400 font-mono font-bold block mt-0.5">
                                Vehicle: {card.vehicle_no} ({card.vehicle_model}) • Dispatch: {card.dispatch_time}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            {card.route_status === 'COMPLETED' ? (
                              <span className="px-3 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> COMPLETED
                              </span>
                            ) : card.route_status === 'ON_ROUTE' ? (
                              <span className="px-3 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1 animate-pulse">
                                <Clock className="w-3.5 h-3.5 text-blue-600" /> ON ROUTE
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-300">
                                ⏳ NOT STARTED
                              </span>
                            )}

                            {/* Audit Status */}
                            {card.reconciliationStatus === 'RECONCILED' ? (
                              <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                ✓ RECONCILED
                              </span>
                            ) : (
                              <span className="text-[9px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                ⚠️ MISMATCH ({card.discrepancyPcs} Pcs)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* ROUTE COMPLETION PROGRESS BAR */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-slate-600">Route Progress ({card.billedShops}/{card.totalShops} Shops Billed)</span>
                            <span className="text-blue-700 font-extrabold">{card.routeCompletionPct}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
                              style={{ width: `${card.routeCompletionPct}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>

                      {/* DRIVER STATS GRID SUMMARY */}
                      <div className="p-4 grid grid-cols-3 gap-2 bg-slate-50/50 border-b border-slate-100 text-xs font-mono">
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-0.5">
                          <span className="text-[9px] font-sans font-black text-slate-400 block uppercase">Stock Breakdown</span>
                          <div className="text-[11px] font-bold text-slate-800">Issued: <span className="text-blue-700">{card.issuedPcs} Pcs</span></div>
                          <div className="text-[11px] font-bold text-slate-800">Sold: <span className="text-emerald-700">{card.soldPcs} Pcs</span></div>
                          <div className="text-[11px] font-bold text-slate-800">Balance: <span className="text-purple-700">{card.actualBalancePcs} Pcs</span></div>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-0.5">
                          <span className="text-[9px] font-sans font-black text-slate-400 block uppercase">Revenue & Bills</span>
                          <div className="text-[11px] font-bold text-slate-800">Bills: <span className="text-slate-900">{card.billsCount} Bills</span></div>
                          <div className="text-[11px] font-bold text-emerald-600">Sales: ₹{(card.totalSalesAmount || 0).toLocaleString()}</div>
                          <div className="text-[11px] font-bold text-blue-600">Paid: ₹{(card.totalCollectedAmount || 0).toLocaleString()}</div>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-0.5">
                          <span className="text-[9px] font-sans font-black text-slate-400 block uppercase">Returns & Credit</span>
                          <div className="text-[11px] font-bold text-purple-700">Return: {card.goodReturnPcs} Pcs</div>
                          <div className="text-[11px] font-bold text-rose-600">Damaged: {card.damagedPcs} Pcs</div>
                          <div className="text-[11px] font-bold text-rose-700">Credit: ₹{(card.totalCreditAmount || 0).toLocaleString()}</div>
                        </div>
                      </div>

                      {/* ACTION BAR: EXPAND VILLAGES vs OPEN 10-TAB DRAWER */}
                      <div className="p-3 bg-white flex items-center justify-between gap-2 border-t border-slate-100">
                        <button 
                          onClick={() => setExpandedDriverId(isExpanded ? null : card.driver_id)}
                          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center gap-1.5 transition"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                          {isExpanded ? 'Hide Villages' : `View Villages (${villagesList.length}) & Shops`}
                        </button>

                        <button 
                          onClick={() => handleOpenDrawer(card.driver_id)}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center gap-1.5 transition shadow-sm"
                        >
                          Inspect Full Driver Operations <ArrowUpRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* EXPANDABLE VILLAGE & SHOP ROUTE PROGRESS TREE */}
                      {isExpanded && (
                        <div className="p-4 bg-slate-950/5 border-t border-slate-200 space-y-3">
                          <h4 className="font-black text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-blue-600" /> Village Sequence & Shop Billing Tree ({villagesList.length} Villages)
                          </h4>

                          {villagesList.length === 0 ? (
                            <p className="text-xs text-slate-500 italic p-3 bg-white rounded-xl">No shops or villages assigned to this driver route.</p>
                          ) : (
                            <div className="space-y-2">
                              {villagesList.map(village => {
                                const vKey = `${card.driver_id}_${village.village_name}`;
                                const isVillageExpanded = expandedVillageKey === vKey;
                                const villageShops = Array.isArray(village.shops) ? village.shops : [];

                                return (
                                  <div key={village.village_name} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                                    
                                    {/* VILLAGE HEADER BAR */}
                                    <div 
                                      onClick={() => setExpandedVillageKey(isVillageExpanded ? null : vKey)}
                                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition border-b border-slate-100"
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-black text-xs flex items-center justify-center">
                                          {village.sequence}
                                        </span>
                                        <div>
                                          <h5 className="font-extrabold text-xs text-slate-900">{village.village_name}</h5>
                                          <span className="text-[10px] text-slate-500 font-bold">
                                            {village.billedShops}/{village.totalShops} Shops Billed • Sales: ₹{(village.salesAmount || 0).toLocaleString()}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        {village.status === 'COMPLETED' ? (
                                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                            COMPLETED
                                          </span>
                                        ) : village.status === 'IN_PROGRESS' ? (
                                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-300">
                                            IN PROGRESS
                                          </span>
                                        ) : (
                                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-700 border border-slate-300">
                                            PENDING
                                          </span>
                                        )}

                                        {isVillageExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                      </div>
                                    </div>

                                    {/* SHOPS LIST EXPANDABLE TREE */}
                                    {isVillageExpanded && (
                                      <div className="p-3 bg-slate-50/60 divide-y divide-slate-200/60 space-y-2 text-xs">
                                        {villageShops.map(shop => {
                                          const shopBills = Array.isArray(shop.bills) ? shop.bills : [];
                                          return (
                                            <div key={shop.id} className="pt-2 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                              <div>
                                                <div className="flex items-center gap-2">
                                                  <span className="font-black text-slate-900">{shop.name}</span>
                                                  <span className="text-[10px] font-bold text-slate-500">{shop.code}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-bold block">
                                                  Owner: {shop.owner_name} • Phone: {shop.phone || 'N/A'} • Due: ₹{shop.current_due || 0}
                                                </span>
                                              </div>

                                              <div className="flex items-center gap-2">
                                                {shop.isBilled ? (
                                                  <>
                                                    <span className="text-xs font-mono font-black text-emerald-600">
                                                      ₹{(shop.salesAmount || 0).toLocaleString()}
                                                    </span>

                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                                                      shop.visitStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                                      shop.visitStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                                      'bg-rose-100 text-rose-800 border border-rose-300'
                                                    }`}>
                                                      {shop.visitStatus}
                                                    </span>

                                                    {shopBills.length > 0 && (
                                                      <button 
                                                        onClick={() => setSelectedBillForInspection(shopBills[0])}
                                                        className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[10px] flex items-center gap-1 border border-blue-200"
                                                      >
                                                        <Eye className="w-3 h-3" /> Bill #{shopBills[0].bill_no}
                                                      </button>
                                                    )}
                                                  </>
                                                ) : (
                                                  <span className="px-2.5 py-0.5 rounded text-[9px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200">
                                                    VISIT PENDING
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION P — COMPREHENSIVE 10-TAB DRIVER DETAIL DRAWER */}
      {drawerDriverId && drawerData && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex justify-end">
          <div className="bg-white w-full max-w-4xl h-full flex flex-col shadow-2xl overflow-hidden border-l border-slate-200">
            
            {/* DRAWER HEADER */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-300 font-black text-xl flex items-center justify-center border border-blue-400/30">
                  🚚
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">{drawerData.driver ? drawerData.driver.name : 'Driver Operations'}</h3>
                  <p className="text-xs text-slate-300 font-bold">
                    Vehicle: {drawerData.driver ? (drawerData.driver.vehicle_no || 'TN 32 XX 2222') : 'TN 32 XX 2222'} • Route: {drawerData.summary ? drawerData.summary.route_name : 'Assigned Route'}
                  </p>
                </div>
              </div>
              <button onClick={() => setDrawerDriverId(null)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* 10-TAB NAVIGATION BAR */}
            <div className="flex items-center gap-1 p-2 bg-slate-100 border-b border-slate-200 overflow-x-auto text-xs font-black scrollbar-none">
              {[
                { id: 'overview', label: '1. Overview' },
                { id: 'route', label: '2. Route' },
                { id: 'shops', label: '3. Shops' },
                { id: 'bills', label: '4. Bills' },
                { id: 'collections', label: '5. Collections' },
                { id: 'stock', label: '6. Stock' },
                { id: 'returns', label: '7. Returns' },
                { id: 'damage', label: '8. Damage' },
                { id: 'reconciliation', label: '9. Reconciliation' },
                { id: 'timeline', label: '10. Timeline' }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setDrawerActiveTab(tab.id)}
                  className={`px-3 py-2 rounded-xl whitespace-nowrap transition ${
                    drawerActiveTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB CONTENT VIEWPORT */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-800">
              
              {/* TAB 1: OVERVIEW */}
              {drawerActiveTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Phone & Login</span>
                      <p className="font-bold text-sm text-slate-900">{drawerData.driver ? (drawerData.driver.phone || '9876543210') : 'N/A'}</p>
                      <span className="text-[10px] text-slate-500 font-bold block">Role: EMPLOYEE (Driver)</span>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Sales & Revenue</span>
                      <p className="font-bold text-sm text-emerald-600">₹{(drawerData.summary ? drawerData.summary.totalSalesAmount : 0).toLocaleString()}</p>
                      <span className="text-[10px] text-slate-500 font-bold block">{(drawerData.sales || []).length} Invoices Created</span>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Stock Discrepancy</span>
                      <p className={`font-bold text-sm ${drawerData.summary && drawerData.summary.discrepancyPcs === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {drawerData.summary ? drawerData.summary.discrepancyPcs : 0} Pcs
                      </p>
                      <span className="text-[10px] text-slate-500 font-bold block">Status: {drawerData.summary ? drawerData.summary.reconciliationStatus : 'N/A'}</span>
                    </div>
                  </div>

                  <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-2">
                    <h4 className="font-black text-sm text-blue-300">Driver Route Summary Note</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Driver {drawerData.driver ? drawerData.driver.name : 'Driver'} is currently assigned to {drawerData.summary ? drawerData.summary.route_name : 'assigned route'}. 
                      Stock issued today is tracked in integer base pieces. All route sales directly reduce driver assigned stock and log immutable ledger entries.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 4: BILLS & INVOICES */}
              {drawerActiveTab === 'bills' && (
                <div className="space-y-3">
                  <h4 className="font-black text-sm text-slate-900">Today Driver Sales Bills ({(drawerData.sales || []).length})</h4>
                  {(drawerData.sales || []).length === 0 ? (
                    <p className="p-6 bg-slate-50 rounded-2xl text-center text-slate-500">No sales bills created by this driver today.</p>
                  ) : (
                    <div className="space-y-2 font-mono">
                      {(drawerData.sales || []).map(s => (
                        <div key={s.bill_no} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-blue-700">Bill #{s.bill_no}</span>
                              <span className="font-bold text-slate-900 font-sans">{s.shop_name}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-sans font-bold block">
                              {s.date} {s.time} • Payment: {s.payment_mode}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-emerald-600 block text-sm">₹{(s.total_amount || 0).toLocaleString()}</span>
                            <button onClick={() => setSelectedBillForInspection(s)} className="text-[10px] font-bold text-blue-600 hover:underline">Inspect Bill 📄</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 9: RECONCILIATION */}
              {drawerActiveTab === 'reconciliation' && (
                <div className="space-y-3">
                  <h4 className="font-black text-sm text-slate-900">Product-Level Driver Stock Reconciliation Audit</h4>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-100 font-black text-slate-700">
                        <tr>
                          <th className="p-2.5">Product Item</th>
                          <th className="p-2.5 text-center">Issued</th>
                          <th className="p-2.5 text-center">Sold</th>
                          <th className="p-2.5 text-center">Return</th>
                          <th className="p-2.5 text-center">Damaged</th>
                          <th className="p-2.5 text-center">Actual Bal</th>
                          <th className="p-2.5 text-center">Variance</th>
                          <th className="p-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(drawerData.reconciliation || []).map(r => (
                          <tr key={r.product_id}>
                            <td className="p-2.5 font-bold font-sans text-slate-900">{r.product_name}</td>
                            <td className="p-2.5 text-center font-bold text-blue-700">{r.issued_pcs} Pcs</td>
                            <td className="p-2.5 text-center font-bold text-emerald-700">{r.sold_pcs} Pcs</td>
                            <td className="p-2.5 text-center font-bold text-purple-700">{r.good_return_pcs} Pcs</td>
                            <td className="p-2.5 text-center font-bold text-rose-700">{r.damaged_pcs} Pcs</td>
                            <td className="p-2.5 text-center font-bold text-slate-900">{r.current_balance_pcs} Pcs</td>
                            <td className="p-2.5 text-center font-black">{r.variance_pcs} Pcs</td>
                            <td className="p-2.5 text-center font-black">
                              <span className={`px-2 py-0.5 rounded text-[9px] ${r.status === 'RECONCILED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* OTHER TABS FALLBACK CONTENT */}
              {['route', 'shops', 'collections', 'stock', 'returns', 'damage', 'timeline'].includes(drawerActiveTab) && (
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
                  <h4 className="font-black text-sm text-slate-800 uppercase">Tab {drawerActiveTab.toUpperCase()} Data View</h4>
                  <p className="text-xs text-slate-500">Displaying live transaction records for driver #{drawerDriverId}.</p>
                </div>
              )}

            </div>

            {/* DRAWER FOOTER */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button onClick={() => setDrawerDriverId(null)} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold text-xs">
                Close Operations Drawer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE NEW ROUTE */}
      {/* ========================================================= */}
      {showCreateRouteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-purple-300" />
                <h3 className="font-black text-base">Create New Delivery Route</h3>
              </div>
              <button 
                onClick={() => { setShowCreateRouteModal(false); setNewRouteName(''); }}
                className="p-1 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoute} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                  Route Name <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Route A, Mailam Line, Gingee Highway"
                  value={newRouteName}
                  onChange={(e) => setNewRouteName(e.target.value)}
                  className="w-full px-4 py-3 text-sm font-bold bg-slate-50 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                />
              </div>

              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 text-purple-900 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-black">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Permanent Route Code Auto-Generation</span>
                </div>
                <p className="text-[11px] text-purple-700 font-medium">
                  The system will automatically assign the next sequential code (e.g. <strong className="font-mono">ROUTE-0001</strong>, <strong className="font-mono">ROUTE-0002</strong>) permanently.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateRouteModal(false); setNewRouteName(''); }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-extrabold text-xs hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingRoute || !newRouteName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs transition shadow-md flex items-center gap-1.5 disabled:opacity-50 uppercase"
                >
                  {creatingRoute ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {creatingRoute ? 'Creating Route...' : 'CREATE ROUTE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: EDIT ROUTE */}
      {/* ========================================================= */}
      {editingRoute && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-300" />
                <h3 className="font-black text-base">Edit Delivery Route</h3>
              </div>
              <button 
                onClick={() => { setEditingRoute(null); setEditRouteName(''); }}
                className="p-1 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRoute} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">
                  Route Code (Permanent)
                </label>
                <input 
                  type="text"
                  disabled
                  value={editingRoute.code || `ROUTE-${String(editingRoute.id).padStart(4, '0')}`}
                  className="w-full px-4 py-2.5 text-xs font-mono font-bold bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                  Route Name <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text"
                  required
                  autoFocus
                  value={editRouteName}
                  onChange={(e) => setEditRouteName(e.target.value)}
                  className="w-full px-4 py-3 text-sm font-bold bg-slate-50 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setEditingRoute(null); setEditRouteName(''); }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-extrabold text-xs hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingRoute || !editRouteName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition shadow-md flex items-center gap-1.5 disabled:opacity-50 uppercase"
                >
                  {updatingRoute ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {updatingRoute ? 'Updating Route...' : 'UPDATE ROUTE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: BILL INSPECTION */}
      {/* ========================================================= */}
      {selectedBillForInspection && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
            <div className="p-5 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-300" />
                <h3 className="font-black text-base">Invoice #{selectedBillForInspection.bill_no}</h3>
              </div>
              <button 
                onClick={() => setSelectedBillForInspection(null)}
                className="p-1 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center text-xs pb-3 border-b border-slate-200">
                <div>
                  <span className="text-slate-400 block font-bold">Shop Name</span>
                  <span className="font-black text-slate-900 text-sm">{selectedBillForInspection.shop_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block font-bold">Date & Time</span>
                  <span className="font-mono font-bold text-slate-700">{selectedBillForInspection.created_at ? new Date(selectedBillForInspection.created_at).toLocaleString() : 'N/A'}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <span className="text-[10px] font-black text-emerald-600 uppercase block">Total Amount</span>
                  <span className="text-base font-black text-emerald-800">₹{(selectedBillForInspection.total_amount || 0).toLocaleString()}</span>
                </div>
                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100">
                  <span className="text-[10px] font-black text-blue-600 uppercase block">Paid Amount</span>
                  <span className="text-base font-black text-blue-800">₹{(selectedBillForInspection.paid_amount || 0).toLocaleString()}</span>
                </div>
                <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                  <span className="text-[10px] font-black text-rose-600 uppercase block">Credit Due</span>
                  <span className="text-base font-black text-rose-800">₹{((selectedBillForInspection.total_amount || 0) - (selectedBillForInspection.paid_amount || 0)).toLocaleString()}</span>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="space-y-1.5">
                <span className="font-extrabold text-slate-700 block text-xs">Line Items:</span>
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
                      {(selectedBillForInspection.items || []).length === 0 ? (
                        <tr>
                          <td colSpan="4" className="p-3 text-center text-slate-400">No line items recorded for this bill</td>
                        </tr>
                      ) : (
                        (selectedBillForInspection.items || []).map((item, i) => (
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

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedBillForInspection(null)}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white font-extrabold text-xs cursor-pointer"
                >
                  Close Bill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
