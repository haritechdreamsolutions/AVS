import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, MapPin, ArrowRight, CheckCircle2, Store } from 'lucide-react';

export const ShopSelection = ({ onSelectShop, onBack }) => {
  const { shops } = useApp();
  const [search, setSearch] = useState('');

  const filteredShops = shops.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 pb-20">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
          <Store className="w-5 h-5 text-blue-600" />
          Select Shop (கடை தேர்வு)
        </h2>
        <span className="text-xs text-slate-500 font-bold">{shops.length} Shops</span>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Shop / கடை தேடுக..."
          className="w-full bg-white border border-slate-200 shadow-sm rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
        />
      </div>

      {/* Shop Cards */}
      <div className="space-y-2.5">
        {filteredShops.map(shop => (
          <div
            key={shop.id}
            onClick={() => onSelectShop(shop)}
            className={`glass-panel p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
              shop.completed
                ? 'border-emerald-200 bg-emerald-50/50 opacity-75'
                : 'border-slate-200 hover:border-blue-400 bg-white shadow-sm hover:shadow-md'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg ${
                shop.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
              }`}>
                🏪
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm text-slate-900">{shop.name}</h3>
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-100 text-slate-600 font-bold border border-slate-200">
                    {shop.code}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-medium">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    {shop.distance}
                  </span>
                  {shop.current_due > 0 && (
                    <span className="text-amber-600 font-bold">
                      Due: ₹{shop.current_due}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {shop.completed ? (
              <div className="flex items-center gap-1 text-xs text-emerald-700 font-bold bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" />
                Done
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md glow-green hover:scale-105 transition">
                <ArrowRight className="w-5 h-5" />
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
};
