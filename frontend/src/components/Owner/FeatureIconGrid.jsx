import React from 'react';
import { 
  ArrowDownLeft, ArrowUpRight, Receipt, Layers, CreditCard, RotateCcw, 
  AlertTriangle, Fuel, BookOpen, Printer, WifiOff, Users, ShieldCheck, FileCheck, Snowflake 
} from 'lucide-react';

export const FeatureIconGrid = () => {
  const features = [
    { title: "Stock Receive", icon: <ArrowDownLeft className="w-6 h-6 text-emerald-600" />, desc: "Receive stock from dealer", bg: "bg-emerald-50 border-emerald-200" },
    { title: "Stock Allocation", icon: <ArrowUpRight className="w-6 h-6 text-blue-600" />, desc: "Assign stock to vehicles", bg: "bg-blue-50 border-blue-200" },
    { title: "Freezer Assets", icon: <Snowflake className="w-6 h-6 text-cyan-600" />, desc: "Track free shop freezers", bg: "bg-cyan-50 border-cyan-200" },
    { title: "Billing & Invoice", icon: <Receipt className="w-6 h-6 text-purple-600" />, desc: "Mobile shop POS billing", bg: "bg-purple-50 border-purple-200" },
    { title: "Piece/Tray Billing", icon: <Layers className="w-6 h-6 text-amber-600" />, desc: "Dual unit selection", bg: "bg-amber-50 border-amber-200" },
    { title: "Multiple Payment", icon: <CreditCard className="w-6 h-6 text-sky-600" />, desc: "Cash, GPay & Split", bg: "bg-sky-50 border-sky-200" },
    { title: "Returns & Settlement", icon: <RotateCcw className="w-6 h-6 text-indigo-600" />, desc: "End of day stock returns", bg: "bg-indigo-50 border-indigo-200" },
    { title: "Damage / Wastage", icon: <AlertTriangle className="w-6 h-6 text-rose-600" />, desc: "Cost-based damage logging", bg: "bg-rose-50 border-rose-200" },
    { title: "Expenses Entry", icon: <Fuel className="w-6 h-6 text-yellow-600" />, desc: "Diesel, toll & food expenses", bg: "bg-yellow-50 border-yellow-200" },
    { title: "Shop Ledger (Due)", icon: <BookOpen className="w-6 h-6 text-teal-600" />, desc: "Shop outstanding balance", bg: "bg-teal-50 border-teal-200" },
    { title: "Reports (A4 Print)", icon: <Printer className="w-6 h-6 text-blue-600" />, desc: "Print daily sales A4 PDF", bg: "bg-blue-50 border-blue-200" },
    { title: "Thermal Bill Print", icon: <Printer className="w-6 h-6 text-purple-600" />, desc: "58mm receipt printing", bg: "bg-purple-50 border-purple-200" },
    { title: "Multi User Roles", icon: <Users className="w-6 h-6 text-orange-600" />, desc: "Admin, Store Keeper, Employee", bg: "bg-orange-50 border-orange-200" },
    { title: "Audit & Logs", icon: <FileCheck className="w-6 h-6 text-pink-600" />, desc: "Traceable change history", bg: "bg-pink-50 border-pink-200" }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <h3 className="font-black text-sm text-slate-900 tracking-wide uppercase">
          13. KEY FEATURES (ICON VIEW)
        </h3>
        <span className="text-xs text-slate-500 font-bold">System Capabilities</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {features.map((feat, idx) => (
          <div
            key={idx}
            className={`glass-panel p-3.5 rounded-2xl border ${feat.bg} text-center space-y-2 hover:scale-105 transition-all duration-200 cursor-pointer shadow-sm`}
          >
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 mx-auto flex items-center justify-center shadow-sm">
              {feat.icon}
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-slate-900 leading-tight">{feat.title}</h4>
              <p className="text-[10px] text-slate-600 font-medium mt-1 leading-tight">{feat.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
