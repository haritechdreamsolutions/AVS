import React, { useState, lazy, Suspense } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  LayoutDashboard, ShoppingBag, Package, Users, Store, 
  Printer, Grid, LogOut, ShieldCheck, ChevronRight, Menu, X, Snowflake, TrendingUp, Tag, MapPin, Scale, RotateCcw,
  DollarSign, AlertOctagon, AlertTriangle
} from 'lucide-react';

// Lazy loading heavy Admin & Owner views to reduce initial bundle size & optimize LCP
const A4ReportView = lazy(() => import('./A4ReportView').then(m => ({ default: m.A4ReportView })));
const FeatureIconGrid = lazy(() => import('./FeatureIconGrid').then(m => ({ default: m.FeatureIconGrid })));
const FreezerManagement = lazy(() => import('./FreezerManagement').then(m => ({ default: m.FreezerManagement })));
const SalesRecordsView = lazy(() => import('./SalesRecordsView').then(m => ({ default: m.SalesRecordsView })));
const OwnerDashboardOverview = lazy(() => import('./OwnerDashboardOverview').then(m => ({ default: m.OwnerDashboardOverview })));
const DriverRouteManagementView = lazy(() => import('./DriverRouteManagementView').then(m => ({ default: m.DriverRouteManagementView })));
const ShopsManagementView = lazy(() => import('./ShopsManagementView').then(m => ({ default: m.ShopsManagementView })));
const AdminProductsMasterView = lazy(() => import('./AdminProductsMasterView').then(m => ({ default: m.AdminProductsMasterView })));
const UsersMaster = lazy(() => import('./UsersMaster').then(m => ({ default: m.UsersMaster })));
const VillagesMasterView = lazy(() => import('./VillagesMasterView').then(m => ({ default: m.VillagesMasterView })));
const AuditTrailView = lazy(() => import('./AuditTrailView').then(m => ({ default: m.AuditTrailView })));
const OwnerDriverReconciliationView = lazy(() => import('./OwnerDriverReconciliationView').then(m => ({ default: m.OwnerDriverReconciliationView })));
const OwnerDriverExpensesView = lazy(() => import('./OwnerDriverExpensesView').then(m => ({ default: m.OwnerDriverExpensesView })));
const OwnerDamagePiecesView = lazy(() => import('./OwnerDamagePiecesView').then(m => ({ default: m.OwnerDamagePiecesView })));
const OwnerMissingPiecesView = lazy(() => import('./OwnerMissingPiecesView').then(m => ({ default: m.OwnerMissingPiecesView })));

const TabLoadingFallback = () => (
  <div className="h-64 w-full flex flex-col items-center justify-center gap-2 bg-white rounded-xl shadow-sm border border-slate-200 p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    <span className="text-xs text-slate-500 font-medium">Loading view...</span>
  </div>
);

export const OwnerSidebarLayout = ({ onLogout }) => {
  const { summary, products = [], shops = [], companyInfo } = useApp();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'users', label: 'Users Master', icon: <ShieldCheck className="w-5 h-5 text-indigo-400" /> },
    { id: 'villages', label: 'Villages Master 📍', icon: <MapPin className="w-5 h-5 text-amber-400" /> },
    { id: 'shops', label: 'Shops & Dues', icon: <Store className="w-5 h-5" /> },
    { id: 'products', label: 'Products & Rates 📦', icon: <Package className="w-5 h-5 text-emerald-400" /> },
    { id: 'freezer', label: 'Freezer Assets 🧊', icon: <Snowflake className="w-5 h-5 text-cyan-400" /> },
    { id: 'sales', label: 'Sales & Bills', icon: <ShoppingBag className="w-5 h-5" /> },
    { id: 'returns_recon', label: 'Returns & Recon ⚖️', icon: <Scale className="w-5 h-5 text-amber-400" /> },
    { id: 'driver_expenses', label: 'Driver Expenses 💰', icon: <DollarSign className="w-5 h-5 text-emerald-400" /> },
    { id: 'damage_pieces', label: 'Damage Pieces 💥', icon: <AlertOctagon className="w-5 h-5 text-rose-400" /> },
    { id: 'missing_pieces', label: 'Missing Pieces ⚠️', icon: <AlertTriangle className="w-5 h-5 text-amber-400" /> },
    { id: 'employees', label: 'Employees & Routes', icon: <Users className="w-5 h-5" /> },
  ];

  return (
    <div className="h-full overflow-hidden bg-slate-100 flex flex-col md:flex-row font-sans text-slate-900 w-full max-w-full">
      
      {/* Mobile Backdrop Overlay when Drawer is Open */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden"
        />
      )}

      {/* Mobile Top Header Navigation */}
      <header className="md:hidden bg-slate-900 text-white p-3 pt-[max(0.75rem,env(safe-area-inset-top))] px-4 flex items-center justify-between z-40 border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-extrabold text-sm tracking-wide bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            AVS AGENCIES
          </span>
        </div>

        <button 
          onClick={onLogout}
          className="flex items-center gap-1.5 text-xs bg-red-500/20 text-red-300 hover:bg-red-500/30 px-3 py-2 rounded-xl border border-red-500/30 transition font-bold min-h-[40px]"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </button>
      </header>

      {/* Sidebar Component */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col justify-between transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Brand Logo & Company Title */}
        <div>
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-black text-white shadow-lg text-lg">
                AVS
              </div>
              <div>
                <h1 className="font-black text-[1rem] text-white tracking-wide leading-tight">AVS AGENCIES</h1>
                <p className="text-[0.72rem] text-slate-400 font-extrabold uppercase tracking-wider">AVS MANAGEMENT SYSTEM</p>
              </div>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[0.92rem] font-semibold transition duration-200 cursor-pointer
                    ${isActive 
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-600/30 font-bold' 
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'}
                  `}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 opacity-80" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer User Info & Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between mb-2 px-2">
            <div className="truncate">
              <p className="text-[0.88rem] font-black text-white truncate">OWNER PORTAL</p>
              <p className="text-[0.78rem] text-slate-400 font-medium">Admin Control Panel</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-400 text-[0.85rem] font-bold border border-red-500/20 transition duration-200 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area — ONLY this div scrolls */}
      <main className="flex-1 h-full overflow-y-auto touch-scroll p-3 sm:p-4 md:p-6 w-full max-w-full min-w-0 overflow-x-hidden pb-20 md:pb-6">
        <Suspense fallback={<TabLoadingFallback />}>
          {/* DASHBOARD TAB — Renders Owner Executive Dashboard Overview */}
          {activeTab === 'dashboard' && (
            <OwnerDashboardOverview onNavigateTab={(tab) => setActiveTab(tab)} />
          )}

          {/* USERS MASTER TAB */}
          {activeTab === 'users' && (
            <UsersMaster />
          )}

          {/* PRODUCTS & RATES MASTER TAB */}
          {activeTab === 'products' && (
            <AdminProductsMasterView />
          )}

          {/* FREEZER MANAGEMENT TAB */}
          {activeTab === 'freezer' && (
            <FreezerManagement />
          )}

          {/* SALES TAB */}
          {activeTab === 'sales' && (
            <SalesRecordsView />
          )}

          {/* RETURNS & RECONCILIATION TAB */}
          {activeTab === 'returns_recon' && (
            <OwnerDriverReconciliationView />
          )}

          {/* DRIVER EXPENSES TAB */}
          {activeTab === 'driver_expenses' && (
            <OwnerDriverExpensesView />
          )}

          {/* DAMAGE PIECES TAB */}
          {activeTab === 'damage_pieces' && (
            <OwnerDamagePiecesView />
          )}

          {/* MISSING PIECES TAB */}
          {activeTab === 'missing_pieces' && (
            <OwnerMissingPiecesView />
          )}

          {/* EMPLOYEES TAB */}
          {activeTab === 'employees' && (
            <DriverRouteManagementView />
          )}

          {/* VILLAGES MASTER TAB */}
          {activeTab === 'villages' && (
            <VillagesMasterView />
          )}

          {/* SHOPS TAB */}
          {activeTab === 'shops' && (
            <ShopsManagementView onNavigateVillages={() => setActiveTab('villages')} />
          )}

          {/* AUDIT TRAIL TAB */}
          {activeTab === 'audit' && (
            <AuditTrailView />
          )}

          {/* A4 REPORT TAB */}
          {activeTab === 'a4_report' && (
            <A4ReportView onBack={() => setActiveTab('dashboard')} />
          )}

          {/* FEATURES GRID TAB */}
          {activeTab === 'features' && (
            <FeatureIconGrid />
          )}
        </Suspense>
      </main>
    </div>
  );
};

