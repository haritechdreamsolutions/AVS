import React from 'react';
import { useApp } from '../../context/AppContext';
import { Truck, MapPin, Store, Receipt, PackageCheck, AlertTriangle } from 'lucide-react';

const PRODUCT_IMAGES = {
  1: '/images/amirthaa_milk_200ml.png',
  5: '/images/amirthaa_milk_500ml.png',
  6: '/images/amirthaa_milk_1l.jpg',
  7: '/images/amirthaa_curd_200ml.jpg',
  8: '/images/amirthaa_curd_500ml.jpg',
  9: '/images/amirthaa_curd_1l.jpg',
  10: '/images/coccola_200ml.png',
  3: '/images/coccola_500ml.png',
  11: '/images/coccola_1l.png',
  12: '/images/juice_hero.jpg',
  15: '/images/tata_hero.jpg',
  18: '/images/aquafresh_water_200ml.png',
  19: '/images/aquafresh_water_500ml.png',
  2: '/images/aquafresh_water_1l.png',
  20: '/images/aquafresh_water_2l.png'
};

export const EmployeeHome = ({ onStartBilling, onOpenDamage, onOpenEndOfDay }) => {
  const { currentUser, employeeStock } = useApp();

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 pb-24">
      
      {/* Greeting & Vehicle banner - FIXED HIGH CONTRAST COLORS (Image 1 fix) */}
      <div className="p-4 rounded-2xl relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white shadow-xl glow-blue">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2 drop-shadow">
              வணக்கம் {currentUser?.name || 'Tharun'} 👋
            </h2>
            <p className="text-xs text-blue-100 font-extrabold tracking-wider mt-0.5 uppercase">
              Delivery Executive POS
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner border border-white/30">
            🚚
          </div>
        </div>

        {/* Vehicle & Route Info - FIXED READABILITY */}
        <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-100" />
            <div>
              <p className="text-[10px] text-blue-100 uppercase font-extrabold tracking-wide">Vehicle</p>
              <p className="font-mono font-black text-white text-sm">{currentUser?.vehicle_no || 'TN 32 XX 2222'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 border-l border-white/20 pl-4">
            <MapPin className="w-4 h-4 text-emerald-300" />
            <div>
              <p className="text-[10px] text-blue-100 uppercase font-extrabold tracking-wide">Route</p>
              <p className="font-black text-white text-sm">Route A</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Card */}
      <div className="glass-card p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <Store className="w-4 h-4 text-blue-600" />
            Today's Shops
          </span>
          <span className="font-mono font-black text-blue-600 text-sm">
            12 / 30 Completed
          </span>
        </div>
        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
          <div className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full w-[40%] rounded-full shadow-sm"></div>
        </div>
      </div>

      {/* MY STOCK (Available) Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <PackageCheck className="w-4 h-4 text-emerald-600" />
            MY STOCK (Available)
          </h3>
          <span className="text-[11px] font-extrabold text-slate-500">Live Inventory</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {employeeStock.map((item, idx) => {
            const prodId = item.product_id || item.product?.id;
            const imgUrl = PRODUCT_IMAGES[prodId];
            const isJpg = imgUrl && imgUrl.endsWith('.jpg');
            const piecesPerUnit = item.product?.pieces_per_unit || 1;
            const totalPieces = Math.round((item.qty_units || 0) * piecesPerUnit);

            return (
              <div key={idx} className="glass-card p-2.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-2 overflow-hidden hover:shadow-md transition">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center p-0.5 shadow-inner">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={item.product?.display_name || 'Product'}
                        className="w-full h-full object-contain rounded-md"
                      />
                    ) : (
                      <span className="text-xl">{item.product?.icon || '📦'}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-[11px] text-slate-900 leading-tight truncate">
                      {item.product?.display_name || 'Product'}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-bold tracking-tight">{totalPieces} Pcs</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono font-black text-base text-emerald-600 block leading-tight">
                    {totalPieces}
                  </span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Pcs</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons: Damage & End Day */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <button
          onClick={onOpenDamage}
          className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-800 font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-slate-50 shadow-sm transition active:scale-95"
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Damage Entry
        </button>
        <button
          onClick={onOpenEndOfDay}
          className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-rose-100 shadow-sm transition active:scale-95"
        >
          🔴 End Day
        </button>
      </div>

      {/* Sticky Main Action Button: BILL PODU / பில் போடு */}
      <div className="fixed bottom-16 left-0 right-0 p-4 max-w-md mx-auto z-30">
        <button
          onClick={onStartBilling}
          className="touch-btn touch-btn-primary w-full text-lg shadow-2xl glow-blue flex items-center justify-center gap-2 tracking-wide font-extrabold uppercase"
        >
          <Receipt className="w-6 h-6" />
          🧾 BILL PODU (பில் போடு)
        </button>
      </div>

    </div>
  );
};
