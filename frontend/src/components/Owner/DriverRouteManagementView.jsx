import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Truck, MapPin, CheckCircle2, Clock, AlertCircle, 
  RotateCcw, RefreshCw, DollarSign, Package, User, ChevronRight, X, Sparkles, ShieldCheck 
} from 'lucide-react';
import { toast } from 'sonner';

const INITIAL_ROUTES_DATA = [
  {
    id: 1,
    driverName: "Tharun",
    phone: "9876543210",
    vehicleNo: "TN 32 XX 2222",
    vehicleModel: "Tata Ace Gold (Freezer Box)",
    currentRoute: "Route A - Salem North & Omalur Highway",
    dispatchTime: "05:30 AM",
    status: "ON_ROUTE", // ON_ROUTE, COMPLETED, LOADING
    progress: 65,
    loadedStockTrays: 120,
    deliveredStockTrays: 78,
    todayCollections: 34800,
    villages: [
      { id: 'v1', name: 'Salem Town (சேலம் டவுன்)', shopsCount: 7, billedShops: 7, status: 'COMPLETED' },
      { id: 'v2', name: 'Suramangalam (சூரமங்கலம்)', shopsCount: 5, billedShops: 5, status: 'COMPLETED' },
      { id: 'v3', name: 'Omalur Road (ஓமலூர் ரோடு)', shopsCount: 6, billedShops: 6, status: 'COMPLETED' },
      { id: 'v4', name: 'Omalur Town (ஓமலூர் டவுன்)', shopsCount: 5, billedShops: 3, status: 'IN_PROGRESS' },
      { id: 'v5', name: 'Mecheri (மேச்சேரி)', shopsCount: 4, billedShops: 0, status: 'PENDING' },
      { id: 'v6', name: 'Mettur Line (மேட்டூர்)', shopsCount: 6, billedShops: 0, status: 'PENDING' }
    ]
  },
  {
    id: 2,
    driverName: "Kumar",
    phone: "9876543211",
    vehicleNo: "TN 30 YY 4411",
    vehicleModel: "Mahindra Bolero Pickup",
    currentRoute: "Route B - Ammapet & Attur Bypass Line",
    dispatchTime: "05:45 AM",
    status: "ON_ROUTE",
    progress: 80,
    loadedStockTrays: 150,
    deliveredStockTrays: 120,
    todayCollections: 48200,
    villages: [
      { id: 'v1', name: 'Ammapet (அம்மாபேட்டை)', shopsCount: 8, billedShops: 8, status: 'COMPLETED' },
      { id: 'v2', name: 'Udayapatti (உடையாபட்டி)', shopsCount: 5, billedShops: 5, status: 'COMPLETED' },
      { id: 'v3', name: 'Valapady (வாழப்பாடி)', shopsCount: 7, billedShops: 7, status: 'COMPLETED' },
      { id: 'v4', name: 'Attur Town (ஆத்தூர் டவுன்)', shopsCount: 6, billedShops: 4, status: 'IN_PROGRESS' },
      { id: 'v5', name: 'Peddanaickenpalayam', shopsCount: 4, billedShops: 0, status: 'PENDING' }
    ]
  },
  {
    id: 3,
    driverName: "Suresh",
    phone: "9876543212",
    vehicleNo: "TN 28 Z 9900",
    vehicleModel: "Ashok Leyland Dost",
    currentRoute: "Route C - Kondalampatti & Namakkal Highway",
    dispatchTime: "05:15 AM",
    status: "COMPLETED",
    progress: 100,
    loadedStockTrays: 100,
    deliveredStockTrays: 100,
    todayCollections: 42500,
    villages: [
      { id: 'v1', name: 'Kondalampatti (கொண்டலாம்பட்டி)', shopsCount: 6, billedShops: 6, status: 'COMPLETED' },
      { id: 'v2', name: 'Seelanaickenpatti (சீலநாயக்கன்பட்டி)', shopsCount: 4, billedShops: 4, status: 'COMPLETED' },
      { id: 'v3', name: 'Mallur (மல்லூர்)', shopsCount: 5, billedShops: 5, status: 'COMPLETED' },
      { id: 'v4', name: 'Rasipuram (ராசிபுரம்)', shopsCount: 7, billedShops: 7, status: 'COMPLETED' }
    ]
  },
  {
    id: 4,
    driverName: "Mani",
    phone: "9876543213",
    vehicleNo: "TN 32 K 1188",
    vehicleModel: "Tata Intra V30",
    currentRoute: "Route D - Gugai & Shevapet Commercial Line",
    dispatchTime: "06:00 AM",
    status: "ON_ROUTE",
    progress: 40,
    loadedStockTrays: 110,
    deliveredStockTrays: 44,
    todayCollections: 18600,
    villages: [
      { id: 'v1', name: 'Shevapet Wholesale Market', shopsCount: 6, billedShops: 6, status: 'COMPLETED' },
      { id: 'v2', name: 'Gugai Main Road', shopsCount: 5, billedShops: 2, status: 'IN_PROGRESS' },
      { id: 'v3', name: 'Linemedu', shopsCount: 4, billedShops: 0, status: 'PENDING' },
      { id: 'v4', name: 'Dadagapatti', shopsCount: 5, billedShops: 0, status: 'PENDING' }
    ]
  },
  {
    id: 5,
    driverName: "Prakash",
    phone: "9876543214",
    vehicleNo: "TN 30 M 5522",
    vehicleModel: "Mahindra Supro Van",
    currentRoute: "Route E - Hasthampatti & Yercaud Foothills",
    dispatchTime: "06:15 AM",
    status: "ON_ROUTE",
    progress: 25,
    loadedStockTrays: 90,
    deliveredStockTrays: 22,
    todayCollections: 8900,
    villages: [
      { id: 'v1', name: 'Hasthampatti (ஹஸ்தம்பட்டி)', shopsCount: 3, billedShops: 3, status: 'COMPLETED' },
      { id: 'v2', name: 'Kannankurichi (கண்ணங்குறிச்சி)', shopsCount: 4, billedShops: 1, status: 'IN_PROGRESS' },
      { id: 'v3', name: 'Gorimedu (கோரிமேடு)', shopsCount: 3, billedShops: 0, status: 'PENDING' },
      { id: 'v4', name: 'Yercaud Foothills (ஏற்காடு அடிவாரம்)', shopsCount: 4, billedShops: 0, status: 'PENDING' }
    ]
  }
];

const AVAILABLE_ROUTES = [
  "Route A - Salem North & Omalur Highway",
  "Route B - Ammapet & Attur Bypass Line",
  "Route C - Kondalampatti & Namakkal Highway",
  "Route D - Gugai & Shevapet Commercial Line",
  "Route E - Hasthampatti & Yercaud Foothills",
  "Route F - Sankari & Bhavani Main Line",
  "Route G - Edappadi & Jalakandapuram Route"
];

export const DriverRouteManagementView = () => {
  const [drivers, setDrivers] = useState(INITIAL_ROUTES_DATA);
  const [editingDriver, setEditingDriver] = useState(null);
  const [newSelectedRoute, setNewSelectedRoute] = useState('');

  // Overall Statistics
  const stats = useMemo(() => {
    let completedVillages = 0;
    let totalVillages = 0;
    let totalCollections = 0;
    let totalDeliveredTrays = 0;

    drivers.forEach(d => {
      totalCollections += d.todayCollections;
      totalDeliveredTrays += d.deliveredStockTrays;
      d.villages.forEach(v => {
        totalVillages += 1;
        if (v.status === 'COMPLETED') completedVillages += 1;
      });
    });

    return {
      activeDrivers: drivers.filter(d => d.status === 'ON_ROUTE').length,
      totalDrivers: drivers.length,
      completedVillages,
      totalVillages,
      totalCollections,
      totalDeliveredTrays
    };
  }, [drivers]);

  const handleOpenRouteModal = (driver) => {
    setEditingDriver(driver);
    setNewSelectedRoute(driver.currentRoute);
  };

  const handleSaveRouteReassignment = () => {
    if (!editingDriver || !newSelectedRoute) return;

    setDrivers(prev => prev.map(d => {
      if (d.id === editingDriver.id) {
        return {
          ...d,
          currentRoute: newSelectedRoute
        };
      }
      return d;
    }));

    toast.success(`🎉 Route Reassigned! ${editingDriver.driverName}'s weekly route changed to "${newSelectedRoute}".`);
    setEditingDriver(null);
  };

  const renderStatusBadge = (status) => {
    if (status === 'COMPLETED') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-blue-600" /> Route Completed
        </span>
      );
    }
    if (status === 'ON_ROUTE') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 animate-pulse">
          <Truck className="w-3 h-3 text-emerald-600" /> On Route Delivering
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-300">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-5 pb-24">
      
      {/* Top Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                DRIVER FLEET & VILLAGE ROUTE PROGRESS
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  🟢 Live GPS & Delivery Feed
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">Track Village-by-Village Milk Delivery Progress & Manage Weekly Driver Route Rotations</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-right">
            <span className="text-[10px] text-slate-300 font-bold block uppercase tracking-wide">Today Route Collections:</span>
            <span className="font-mono font-black text-lg text-emerald-400">
              ₹{stats.totalCollections.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-emerald-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Active Delivery Drivers</span>
          <div className="font-mono font-black text-2xl text-slate-900 mt-1.5 flex items-baseline gap-1">
            {stats.activeDrivers} <span className="text-xs text-slate-500 font-bold">/ {stats.totalDrivers} On Route</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-blue-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Villages Completed Today</span>
          <div className="font-mono font-black text-2xl text-blue-600 mt-1.5 flex items-baseline gap-1">
            {stats.completedVillages} <span className="text-xs text-blue-700 font-bold">/ {stats.totalVillages} Completed</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-indigo-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Delivered Vehicle Stock</span>
          <div className="font-mono font-black text-2xl text-indigo-600 mt-1.5 flex items-baseline gap-1">
            {stats.totalDeliveredTrays} <span className="text-xs text-indigo-700 font-bold">Trays</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-purple-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Total Money Collected</span>
          <div className="font-mono font-black text-2xl text-emerald-600 mt-1.5">
            ₹{stats.totalCollections.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Drivers Route Fleet List */}
      <div className="space-y-4">
        {drivers.map(driver => {
          const remainingTrays = Math.max(0, driver.loadedStockTrays - driver.deliveredStockTrays);

          return (
            <div 
              key={driver.id} 
              className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm hover:shadow-md transition-all duration-300"
            >
              
              {/* Driver Header Row */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">
                    {driver.driverName[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-base text-slate-900">{driver.driverName}</h3>
                      <span className="text-xs font-bold text-slate-500 font-mono">({driver.phone})</span>
                      {renderStatusBadge(driver.status)}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-semibold mt-1">
                      <span className="flex items-center gap-1 text-purple-700 font-extrabold bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200">
                        <MapPin className="w-3.5 h-3.5" /> {driver.currentRoute}
                      </span>
                      <span className="font-mono text-slate-500">🚛 {driver.vehicleNo} ({driver.vehicleModel})</span>
                      <span className="text-slate-400">|</span>
                      <span className="text-slate-500 font-mono">Dispatch: {driver.dispatchTime}</span>
                    </div>
                  </div>
                </div>

                {/* Right Actions & Collections */}
                <div className="flex items-center gap-3 justify-between md:justify-end">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Today Collections:</span>
                    <span className="font-mono font-black text-base text-emerald-600">₹{driver.todayCollections.toLocaleString()}</span>
                  </div>

                  <button
                    onClick={() => handleOpenRouteModal(driver)}
                    className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white font-extrabold text-xs flex items-center gap-1.5 border border-purple-200 transition shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Weekly Route Switch
                  </button>
                </div>
              </div>

              {/* Driver Vehicle Stock Ratios Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Vehicle Stock Loaded:</span>
                  <span className="font-black text-slate-900 text-sm">{driver.loadedStockTrays} Trays ({driver.loadedStockTrays * 20} Pcs)</span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 font-bold block uppercase">Delivered Stock:</span>
                  <span className="font-black text-emerald-600 text-sm">{driver.deliveredStockTrays} Trays ({driver.deliveredStockTrays * 20} Pcs)</span>
                </div>
                <div>
                  <span className="text-[10px] text-blue-600 font-bold block uppercase">Remaining Vehicle Stock:</span>
                  <span className="font-black text-blue-600 text-sm">{remainingTrays} Trays ({remainingTrays * 20} Pcs)</span>
                </div>
                <div>
                  <span className="text-[10px] text-indigo-600 font-bold block uppercase">Route Completion:</span>
                  <span className="font-black text-indigo-600 text-sm">{driver.progress}% Complete</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className="bg-gradient-to-r from-blue-500 via-teal-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${driver.progress}%` }}
                  />
                </div>
              </div>

              {/* Village Step Progression Timeline */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-extrabold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    Village Route Progression Steps (கிராம வாரியாக விநியோகம்)
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {driver.villages.filter(v => v.status === 'COMPLETED').length} / {driver.villages.length} Villages Done
                  </span>
                </div>

                {/* Villages Steps Horizontal Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {driver.villages.map((village, vIdx) => {
                    const isCompleted = village.status === 'COMPLETED';
                    const isInProgress = village.status === 'IN_PROGRESS';

                    return (
                      <div 
                        key={village.id || vIdx} 
                        className={`p-2.5 rounded-2xl border transition-all flex flex-col justify-between ${
                          isCompleted 
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950' 
                            : isInProgress
                            ? 'bg-blue-50/90 border-blue-400 text-blue-950 ring-2 ring-blue-400/20'
                            : 'bg-slate-50 border-slate-200 text-slate-500 opacity-80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-extrabold text-xs leading-tight block truncate">
                            {vIdx + 1}. {village.name}
                          </span>
                          {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                          {isInProgress && <Truck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 animate-bounce" />}
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-mono font-bold">
                          <span>Shops:</span>
                          <span className={isCompleted ? 'text-emerald-700 font-extrabold' : isInProgress ? 'text-blue-700 font-extrabold' : 'text-slate-500'}>
                            {village.billedShops} / {village.shopsCount} Billed
                          </span>
                        </div>

                        {/* Village Status Badge */}
                        <div className="mt-1">
                          {isCompleted ? (
                            <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300 block text-center">
                              🟢 Completed Today
                            </span>
                          ) : isInProgress ? (
                            <span className="text-[9px] font-black uppercase text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md border border-blue-300 block text-center animate-pulse">
                              🚚 Delivering Now
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md block text-center">
                              ⏳ Pending
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Weekly Route Reassignment Modal */}
      {editingDriver && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl relative overflow-hidden">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-base border border-purple-200">
                  🔄
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Reassign Weekly Route</h3>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Driver: {editingDriver.driverName}</span>
                </div>
              </div>
              <button onClick={() => setEditingDriver(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase block mb-1">Select New Weekly Route:</label>
                <select
                  value={newSelectedRoute}
                  onChange={(e) => setNewSelectedRoute(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-purple-500"
                >
                  {AVAILABLE_ROUTES.map((rt, idx) => (
                    <option key={idx} value={rt}>{rt}</option>
                  ))}
                </select>
              </div>

              <div className="bg-purple-50 p-3 rounded-2xl border border-purple-200 text-xs text-purple-900 space-y-1">
                <p className="font-extrabold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Weekly Change Note:</p>
                <p className="text-[11px] text-purple-800">
                  Changing {editingDriver.driverName}'s route will update their shop delivery schedule and vehicle stock allocation for the upcoming week.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleSaveRouteReassignment}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs shadow-md transition"
              >
                Save New Route Assignment
              </button>
              <button
                onClick={() => setEditingDriver(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-xs transition"
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
