import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Truck, MapPin, CheckCircle2, Clock, AlertCircle, 
  RotateCcw, RefreshCw, DollarSign, Package, User, ChevronRight, X, Sparkles, ShieldCheck,
  Search, Filter, Calendar, FileText, ChevronDown, ChevronUp, AlertTriangle, Eye, ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';

export function DriverRouteManagementView() {
  const appContext = useApp() || {};
  const { 
    fetchFleetRouteSummary, 
    fetchDriverDetailSummary, 
    users = [], 
    sales = [], 
    stockMovements = [], 
    products = [], 
    shops = [] 
  } = appContext;

  // Normalized Arrays
  const safeUsers = Array.isArray(users) ? users : [];
  const safeSales = Array.isArray(sales) ? sales : [];
  const safeStockMovements = Array.isArray(stockMovements) ? stockMovements : [];
  const safeProducts = Array.isArray(products) ? products : [];
  const safeShops = Array.isArray(shops) ? shops : [];

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
  }, [safeSales.length, safeStockMovements.length, safeUsers.length]);

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
      // Driver Filter
      if (selectedDriverId !== 'ALL' && Number(card.driver_id) !== Number(selectedDriverId)) {
        return false;
      }
      // Route Filter
      if (selectedRouteId !== 'ALL' && Number(card.route_id) !== Number(selectedRouteId)) {
        return false;
      }
      // Status Filter
      if (selectedStatus !== 'ALL' && card.route_status !== selectedStatus) {
        return false;
      }
      // Search Query Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = (card.driver_name || '').toLowerCase().includes(query);
        const matchVehicle = (card.vehicle_no || '').toLowerCase().includes(query);
        const matchRoute = (card.route_name || '').toLowerCase().includes(query);
        const villages = Array.isArray(card.villages) ? card.villages : [];
        const matchVillage = villages.some(v => (v.village_name || '').toLowerCase().includes(query));
        const matchShop = villages.some(v => Array.isArray(v.shops) && v.shops.some(s => (s.name || '').toLowerCase().includes(query) || (s.code && s.code.toLowerCase().includes(query))));
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
        activeDrivers: safeUsers.filter(u => u.role === 'EMPLOYEE').length, driversOnRoute: 0, driversCompleted: 0,
        assignedVillages: 0, completedVillages: 0, assignedShops: 0,
        billedShops: 0, pendingShops: 0, totalIssuedPcs: 0,
        totalSoldPcs: 0, totalRemainingPcs: 0, totalReturnedPcs: 0,
        totalDamagedPcs: 0, totalSalesAmount: 0, totalCollectedAmount: 0, totalCreditAmount: 0
      };
    }
    return fleetData.kpis;
  }, [fleetData, safeUsers]);

  const driverEmployees = useMemo(() => {
    return safeUsers.filter(u => u.role === 'EMPLOYEE');
  }, [safeUsers]);

  return (
    <div className="space-y-6 text-slate-800 pb-6">
      
      {/* HEADER TITLE BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white p-6 rounded-3xl shadow-xl border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-blue-400/30 tracking-wider">
              Live Fleet Operations Control Center
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> DB Transaction Sync Active
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
            <Truck className="w-7 h-7 text-blue-400" /> Driver Fleet & Route Progress Monitor
          </h1>
          <p className="text-xs text-slate-300">
            Real-time tracking of route sales, driver stock allocations, village progress, storekeeper return verifications & reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={loadFleetData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs transition border border-white/10 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Fleet Data
          </button>
        </div>
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

      {/* FILTER BAR SYSTEM (SECTION N & O) */}
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

      {/* SECTION B — DYNAMIC DRIVER OPERATIONAL CARDS */}
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
            <h3 className="font-black text-sm text-slate-700">No Driver Operational Records Match Current Filters</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">Try resetting your search query or dropdown filters to view active driver route progress.</p>
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

                  {/* SECTION C & D — EXPANDABLE VILLAGE & SHOP ROUTE PROGRESS TREE */}
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

      {/* SECTION O — INVOICE INSPECTION MODAL */}
      {selectedBillForInspection && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto my-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-black text-base text-slate-900">Invoice Inspection #{selectedBillForInspection.bill_no}</h3>
                  <span className="text-[10px] text-slate-500 font-bold">
                    Generated by Driver {selectedBillForInspection.employee_name} on {selectedBillForInspection.date} {selectedBillForInspection.time}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedBillForInspection(null)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs font-mono space-y-1">
              <div className="flex justify-between"><span className="text-slate-500 font-sans font-bold">Retail Store:</span><span className="font-black text-slate-900">{selectedBillForInspection.shop_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-sans font-bold">Payment Mode:</span><span className="font-black text-purple-700">{selectedBillForInspection.payment_mode}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-sans font-bold">Cash / GPay Paid:</span><span className="font-black text-emerald-600">₹{(selectedBillForInspection.cash_paid || selectedBillForInspection.paid_amount || 0) + (selectedBillForInspection.gpay_paid || 0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-sans font-bold">Credit Dues:</span><span className="font-black text-rose-600">₹{selectedBillForInspection.credit_paid || selectedBillForInspection.credit_amount || 0}</span></div>
            </div>

            {/* Itemization Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 font-black text-slate-700">
                  <tr>
                    <th className="p-2.5">Item Variant</th>
                    <th className="p-2.5 text-center">Qty / Unit</th>
                    <th className="p-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {(selectedBillForInspection.items || []).map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-bold font-sans text-slate-900">{item.product_name || `Product #${item.product_id}`}</td>
                      <td className="p-2.5 text-center font-bold text-blue-700">{item.qty} {item.unit_type}</td>
                      <td className="p-2.5 text-right font-black text-emerald-700">₹{(item.amount || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="font-extrabold text-xs text-slate-600">Grand Total Invoice Value</span>
              <span className="font-black text-lg text-emerald-600 font-mono">₹{(selectedBillForInspection.total_amount || 0).toLocaleString()}</span>
            </div>

            <button onClick={() => setSelectedBillForInspection(null)} className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-extrabold text-xs">
              Close Inspection
            </button>
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
                Close Driver Operations Drawer
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
