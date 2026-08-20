import React from 'react';
import { useApp } from '../../context/AppContext';
import { Truck, LogOut, ShieldCheck, UserCheck } from 'lucide-react';

export const Header = ({ onLogout }) => {
  const { currentUser, activeRole } = useApp();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md glow-blue">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-base text-slate-900 tracking-wide uppercase">
                AVS DISTRIBUTORS
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 border border-blue-200">
                POS
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-semibold leading-none mt-0.5">
              Distribution Management System
            </p>
          </div>
        </div>

        {/* Right Info & Role Chip */}
        <div className="flex items-center gap-3">
          {activeRole === 'EMPLOYEE' && (
            <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl text-xs border border-slate-200 font-bold">
              <Truck className="w-4 h-4 text-blue-600" />
              <span className="text-slate-800">{currentUser?.vehicle_no || 'TN 32 XX 2222'}</span>
            </div>
          )}

          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
            <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
              {currentUser?.name ? currentUser.name[0] : 'U'}
            </div>
            <div className="text-left hidden sm:block pr-2">
              <div className="font-bold text-xs text-slate-900 leading-tight">{currentUser?.name}</div>
              <div className="text-[9px] text-emerald-600 font-extrabold uppercase">{activeRole}</div>
            </div>

            <button
              onClick={onLogout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-slate-100 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </header>
  );
};
