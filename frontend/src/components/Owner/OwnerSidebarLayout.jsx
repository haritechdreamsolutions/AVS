import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  LayoutDashboard, ShoppingBag, Package, Users, Store, 
  Printer, Grid, LogOut, ShieldCheck, ChevronRight, Menu, X, Snowflake, TrendingUp 
} from 'lucide-react';
import { A4ReportView } from './A4ReportView';
import { FeatureIconGrid } from './FeatureIconGrid';
import { FreezerManagement } from './FreezerManagement';
import { AdminAnalyticsChart } from './AdminAnalyticsChart';
import { SalesRecordsView } from './SalesRecordsView';
import { AdminInventoryView } from './AdminInventoryView';
import { DriverRouteManagementView } from './DriverRouteManagementView';
import { ShopsManagementView } from './ShopsManagementView';
import { OwnerDashboardOverview } from './OwnerDashboardOverview';
import { AdminProductRatesView } from './AdminProductRatesView';
import { Tag } from 'lucide-react';

export const OwnerSidebarLayout = ({ onLogout }) => {
  const { summary, products = [], shops = [], companyInfo } = useApp();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'product_rates', label: 'Product Rates 🏷️', icon: <Tag className="w-5 h-5 text-emerald-400" /> },
    { id: 'freezer', label: 'Freezer Assets 🧊', icon: <Snowflake className="w-5 h-5 text-cyan-400" /> },
    { id: 'sales', label: 'Sales & Bills', icon: <ShoppingBag className="w-5 h-5" /> },
    { id: 'inventory', label: 'Inventory Stock', icon: <Package className="w-5 h-5" /> },
    { id: 'employees', label: 'Employees & Routes', icon: <Users className="w-5 h-5" /> },
    { id: 'shops', label: 'Shops & Dues', icon: <Store className="w-5 h-5" /> },
    { id: 'a4_report', label: 'A4 Daily Report', icon: <Printer className="w-5 h-5" /> },
    { id: 'features', label: 'Key Features Grid', icon: <Grid className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans text-slate-900">
      
      {/* Mobile Top Header */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black">A</div>
          <span className="font-extrabold text-sm uppercase">AVS DISTRIBUTORS (Admin)</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-slate-300 hover:text-white">
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Admin Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col justify-between p-4 shadow-xl transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="space-y-6">
          
          {/* Sidebar Brand Header */}
          <div className="flex items-center gap-3 px-2 pt-2 border-b border-slate-800 pb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg glow-blue">
              A
            </div>
            <div>
              <h2 className="font-black text-white text-xs uppercase tracking-wide">
                AVS DISTRIBUTORS
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                ADMIN PANEL
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <div className="px-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
              Management
            </div>
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-xs transition-all ${
                  activeTab === item.id
                    ? 'bg-purple-600 text-white shadow-lg glow-blue'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {activeTab === item.id && <ChevronRight className="w-4 h-4 text-purple-200" />}
              </button>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer & Logout */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-3 px-2 text-xs">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
              A
            </div>
            <div>
              <div className="font-bold text-white">Owner Admin</div>
              <div className="text-[10px] text-slate-500">Full Access</div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area - FULL WIDTH (No right-side whitespace) */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto w-full">
        
        {/* DASHBOARD OVERVIEW TAB */}
        {activeTab === 'dashboard' && (
          <OwnerDashboardOverview onNavigateTab={(tab) => setActiveTab(tab)} />
        )}

        {/* PRODUCT RATES MASTER TAB */}
        {activeTab === 'product_rates' && (
          <AdminProductRatesView />
        )}

        {/* FREEZER MANAGEMENT TAB */}
        {activeTab === 'freezer' && (
          <FreezerManagement />
        )}

        {/* SALES TAB */}
        {activeTab === 'sales' && (
          <SalesRecordsView />
        )}

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <AdminInventoryView />
        )}

        {/* EMPLOYEES TAB */}
        {activeTab === 'employees' && (
          <DriverRouteManagementView />
        )}

        {/* SHOPS TAB */}
        {activeTab === 'shops' && (
          <ShopsManagementView />
        )}

        {/* A4 REPORT TAB */}
        {activeTab === 'a4_report' && (
          <A4ReportView onBack={() => setActiveTab('dashboard')} />
        )}

        {/* FEATURES GRID TAB */}
        {activeTab === 'features' && (
          <FeatureIconGrid />
        )}

      </main>
    </div>
  );
};
