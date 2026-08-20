import React, { useState } from 'react';
import { TrendingUp, BarChart3, PieChart, CreditCard, Banknote, Smartphone, Award, Sparkles } from 'lucide-react';

export const AdminAnalyticsChart = () => {
  const [activeTab, setActiveTab] = useState('weekly'); // weekly, product

  const salesTrend = [
    { day: "Mon", sales: 18500, label: "₹18.5k", height: "55%", isPeak: false },
    { day: "Tue", sales: 22400, label: "₹22.4k", height: "70%", isPeak: false },
    { day: "Wed", sales: 19800, label: "₹19.8k", height: "60%", isPeak: false },
    { day: "Thu", sales: 25600, label: "₹25.6k", height: "80%", isPeak: false },
    { day: "Fri", sales: 21000, label: "₹21.0k", height: "65%", isPeak: false },
    { day: "Sat", sales: 28900, label: "₹28.9k", height: "90%", isPeak: false },
    { day: "Today (Sun)", sales: 31200, label: "₹31.2k", height: "100%", isPeak: true }
  ];

  const productShare = [
    { name: "200ml Milk", unit: "120 Trays", amount: 18250, pct: 38, color: "bg-blue-600", icon: "🥛" },
    { name: "Water Bottle 1L", unit: "80 Trays", amount: 12600, pct: 26, color: "bg-cyan-500", icon: "💧" },
    { name: "Coccola 500ml", unit: "60 Boxes", amount: 10800, pct: 22, color: "bg-purple-600", icon: "🥤" },
    { name: "Recharge Card", unit: "200 Packs", amount: 6600, pct: 14, color: "bg-amber-500", icon: "🎴" }
  ];

  const paymentBreakdown = [
    { label: "Cash Collection (ரொக்கம்)", amount: 73200, pct: 58, icon: <Banknote className="w-4 h-4 text-emerald-600" />, color: "bg-emerald-500" },
    { label: "GPay / UPI (ஜிபே)", amount: 42950, pct: 34, icon: <Smartphone className="w-4 h-4 text-blue-600" />, color: "bg-blue-500" },
    { label: "Credit / Dues (கடமை)", amount: 10000, pct: 8, icon: <CreditCard className="w-4 h-4 text-amber-600" />, color: "bg-amber-500" }
  ];

  return (
    <div className="glass-panel p-5 rounded-2xl bg-white border border-slate-200 space-y-5 shadow-sm">
      
      {/* Header with KPI Summary Chips */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h3 className="font-black text-base text-slate-900 uppercase tracking-wide">
              ADMIN SALES & ANALYTICS VISUAL GRAPH (விற்பனை வரைபடம்)
            </h3>
          </div>
          <p className="text-xs text-slate-500 font-bold mt-0.5">Easy 7-Day Revenue Trend & Payment Breakdown at a glance</p>
        </div>

        {/* 7-Day Quick Stats */}
        <div className="flex flex-wrap gap-2 text-xs font-mono">
          <div className="bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200">
            <span className="text-slate-500 block font-bold text-[10px]">7-Day Total</span>
            <span className="font-black text-blue-700">₹1,67,400</span>
          </div>
          <div className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
            <span className="text-slate-500 block font-bold text-[10px]">Daily Average</span>
            <span className="font-black text-emerald-700">₹23,914</span>
          </div>
          <div className="bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200">
            <span className="text-slate-500 block font-bold text-[10px]">Highest Day</span>
            <span className="font-black text-purple-700">Today (₹31.2k)</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Bar Chart (Left 65%) + Payment/Product Share (Right 35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: 7-Day Bar Chart */}
        <div className="lg:col-span-2 space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center text-xs font-extrabold text-slate-700">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Weekly Revenue Trend (கடந்த 7 நாட்கள் விற்பனை)
            </span>
            <span className="text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 font-black">
              +14.2% Growth 📈
            </span>
          </div>

          {/* Bar Graph Visual Container */}
          <div className="h-56 flex items-end justify-between gap-3 pt-10 pb-2 px-2 sm:px-4 bg-white rounded-xl border border-slate-200">
            {salesTrend.map((st, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                
                {/* Visible Amount Label Always On Top */}
                <span className={`text-[11px] font-mono font-black mb-1.5 px-1.5 py-0.5 rounded-md border transition-all ${
                  st.isPeak 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-110' 
                    : 'bg-slate-100 text-slate-900 border-slate-200 group-hover:bg-blue-100 group-hover:text-blue-900'
                }`}>
                  {st.label}
                </span>

                {/* Peak Day Flag */}
                {st.isPeak && (
                  <span className="absolute -top-7 text-[9px] font-extrabold px-1.5 py-0.5 bg-amber-500 text-white rounded-full shadow-sm animate-pulse flex items-center gap-0.5">
                    <Sparkles className="w-3 h-3" /> PEAK
                  </span>
                )}

                {/* Vertical Bar */}
                <div
                  className={`w-full max-w-[44px] rounded-t-2xl transition-all duration-300 group-hover:scale-105 ${
                    st.isPeak 
                      ? 'bg-gradient-to-t from-blue-700 via-indigo-600 to-emerald-500 shadow-lg glow-blue' 
                      : 'bg-gradient-to-t from-blue-500 to-cyan-400 opacity-90 group-hover:opacity-100'
                  }`}
                  style={{ height: st.height }}
                ></div>

                {/* Day Label Below Bar */}
                <span className={`text-xs font-black mt-2 ${st.isPeak ? 'text-blue-700' : 'text-slate-700'}`}>
                  {st.day.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold px-1 pt-1">
            <span>💡 குறிப்பு: உயர்ந்த பார் (Peak Bar) அன்றைய அதிகபட்ச விற்பனையைக் குறிக்கும்.</span>
            <span className="text-blue-600 font-black">7 Days Active Route</span>
          </div>
        </div>

        {/* Right Side: Payment Breakdown & Product Share */}
        <div className="space-y-4">
          
          {/* Payment Method Breakdown */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center justify-between">
              <span>Payment Mode Share (பணம் வந்த முறை)</span>
              <span className="font-mono text-emerald-600 font-black text-xs">₹1,26,150</span>
            </h4>

            <div className="space-y-2.5">
              {paymentBreakdown.map((pm, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-slate-800">
                      {pm.icon}
                      {pm.label}
                    </span>
                    <span className="font-mono font-black text-slate-900">
                      ₹{pm.amount.toLocaleString()} ({pm.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div className={`${pm.color} h-full rounded-full transition-all duration-500`} style={{ width: `${pm.pct}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Selling Products */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
            <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
              Top Products Sold Today
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {productShare.map((prod, idx) => (
                <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs shadow-sm">
                  <span className="font-extrabold text-slate-800">{prod.icon} {prod.name}</span>
                  <span className="font-mono font-black text-blue-600">{prod.pct}%</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
