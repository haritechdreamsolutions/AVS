import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Store, Search, Snowflake, DollarSign, MapPin, Phone, 
  User, Plus, CheckCircle2, AlertTriangle, CreditCard, ChevronRight, X, 
  FileText, Clock, Send, ShieldAlert, ArrowUpRight, Check, Sparkles, PhoneCall 
} from 'lucide-react';
import { toast } from 'sonner';

// Sample credit invoices history for detailed statement modal
const SHOP_CREDIT_INVOICES = {
  102: [
    { bill_no: "INV-46890", date: "2026-08-15", time: "08:30 AM", total: 1500, paid: 500, due: 1000, mode: "SPLIT", ageDays: 4 },
    { bill_no: "INV-46820", date: "2026-08-10", time: "07:15 AM", total: 800, paid: 600, due: 200, mode: "CREDIT", ageDays: 9 }
  ],
  103: [
    { bill_no: "INV-46885", date: "2026-08-14", time: "09:10 AM", total: 800, paid: 0, due: 800, mode: "CREDIT", ageDays: 5 }
  ],
  104: [
    { bill_no: "INV-46750", date: "2026-08-01", time: "06:45 AM", total: 2200, paid: 2200, due: 0, mode: "GPAY", ageDays: 18 }
  ],
  105: [
    { bill_no: "INV-46892", date: "2026-08-18", time: "08:00 AM", total: 1800, paid: 300, due: 1500, mode: "SPLIT", ageDays: 1 }
  ],
  106: [
    { bill_no: "INV-46810", date: "2026-08-02", time: "07:30 AM", total: 3500, paid: 1000, due: 2500, mode: "CREDIT", ageDays: 17 }
  ],
  107: [
    { bill_no: "INV-46700", date: "2026-08-05", time: "09:00 AM", total: 1200, paid: 1200, due: 0, mode: "CASH", ageDays: 14 }
  ]
};

export const ShopsManagementView = () => {
  const { shops, setShops, collectShopDue, addShop } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, DUES, OVERDUE, FREEZER
  
  // Modals state
  const [selectedShopForPayment, setSelectedShopForPayment] = useState(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentModeInput, setPaymentModeInput] = useState('CASH');
  const [selectedShopForStatement, setSelectedShopForStatement] = useState(null);
  const [showAddShopModal, setShowAddShopModal] = useState(false);

  // New Shop Form State
  const [newShopName, setNewShopName] = useState('');
  const [newShopOwner, setNewShopOwner] = useState('');
  const [newShopPhone, setNewShopPhone] = useState('');

  const filteredShops = useMemo(() => {
    return (shops || []).filter(shop => {
      if (!shop) return false;
      const q = searchQuery.toLowerCase();
      const nameMatch = !q || shop.name.toLowerCase().includes(q) || (shop.code && shop.code.toLowerCase().includes(q)) || (shop.owner_name && shop.owner_name.toLowerCase().includes(q));
      
      const dueVal = Number(shop.current_due || 0);
      let typeMatch = true;
      if (filterType === 'DUES') typeMatch = dueVal > 0;
      if (filterType === 'OVERDUE') typeMatch = dueVal > 1000;
      if (filterType === 'FREEZER') typeMatch = shop.has_freezer;

      return nameMatch && typeMatch;
    });
  }, [shops, searchQuery, filterType]);

  const metrics = useMemo(() => {
    const list = shops || [];
    let totalDues = 0;
    let freezerShopsCount = 0;
    let shopsWithDuesCount = 0;
    let overdueRiskAmount = 0;

    list.forEach(s => {
      if (!s) return;
      const due = Number(s.current_due || 0);
      totalDues += due;
      if (s.has_freezer) freezerShopsCount += 1;
      if (due > 0) shopsWithDuesCount += 1;
      if (due > 1000) overdueRiskAmount += due;
    });

    return {
      totalShops: list.length,
      totalDues: Math.round(totalDues),
      freezerShopsCount,
      shopsWithDuesCount,
      overdueRiskAmount: Math.round(overdueRiskAmount)
    };
  }, [shops]);

  const handleCollectDue = async () => {
    if (!selectedShopForPayment) return;
    const payVal = Number(paymentAmountInput || 0);

    if (payVal <= 0) {
      toast.error("Please enter a valid payment amount!");
      return;
    }

    const maxDue = Number(selectedShopForPayment.current_due || 0);
    if (payVal > maxDue) {
      toast.error(`Payment amount (₹${payVal}) cannot exceed current outstanding due (₹${maxDue})!`);
      return;
    }

    const res = await collectShopDue(selectedShopForPayment.id, { amount: payVal, mode: paymentModeInput });
    if (res.success) {
      const remaining = res.remainingDue !== undefined ? res.remainingDue : Math.max(0, maxDue - payVal);
      if (remaining === 0) {
        toast.success(`🎉 Full payment of ₹${payVal} received from ${selectedShopForPayment.name}! Pending due converted to ₹0 (Clear Balance).`);
      } else {
        toast.success(`🎉 Partial payment of ₹${payVal} received from ${selectedShopForPayment.name}! Due reduced from ₹${maxDue} to ₹${remaining}.`);
      }
      setSelectedShopForPayment(null);
      setPaymentAmountInput('');
    } else {
      toast.error("Failed to collect payment: " + res.message);
    }
  };

  const handleCreateNewShopSubmit = async (e) => {
    e.preventDefault();
    if (!newShopName || !newShopOwner || !newShopPhone) {
      toast.error("Please fill in all store details!");
      return;
    }

    if (addShop) {
      const res = await addShop({
        name: newShopName,
        owner_name: newShopOwner,
        phone: newShopPhone,
        route_id: 1,
        distance: "3.0 km",
        current_due: 0
      });
      if (res.success) {
        toast.success(`🎉 ${newShopName} registered successfully!`);
        setShowAddShopModal(false);
        setNewShopName('');
        setNewShopOwner('');
        setNewShopPhone('');
      } else {
        toast.error("Failed to add shop: " + res.message);
      }
    }
  };

  const handleSendReminderAlert = (shop) => {
    toast.success(`📩 Dues reminder SMS sent to ${shop.name} (${shop.phone || '9876543210'})!`);
  };

  return (
    <div className="space-y-5 pb-24">
      
      {/* Executive Dark Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                RETAIL SHOPS & CREDIT DUES LEDGER
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  🟢 Live Market Credit Engine
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">Manage Registered Milk Retailers, Credit Limits, Visicooler Assets & Real-time Due Collections</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAddShopModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md border border-emerald-400/30 transition"
          >
            <Plus className="w-4 h-4" /> Register New Store
          </button>

          <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-right">
            <span className="text-[10px] text-slate-300 font-bold block uppercase tracking-wide">Market Dues Outstanding:</span>
            <span className="font-mono font-black text-xl text-amber-400">
              ₹{metrics.totalDues.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-amber-500 border border-slate-200 shadow-xs hover:-translate-y-0.5 transition">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Outstanding Market Dues</span>
          <div className="font-mono font-black text-2xl text-amber-600 mt-1.5">
            ₹{metrics.totalDues.toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-rose-500 border border-slate-200 shadow-xs hover:-translate-y-0.5 transition">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">High Risk Overdue Dues</span>
          <div className="font-mono font-black text-2xl text-rose-600 mt-1.5">
            ₹{metrics.overdueRiskAmount.toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-purple-500 border border-slate-200 shadow-xs hover:-translate-y-0.5 transition">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Shops With Active Credit</span>
          <div className="font-mono font-black text-2xl text-purple-600 mt-1.5 flex items-baseline gap-1">
            {metrics.shopsWithDuesCount} <span className="text-xs text-purple-700 font-bold">/ {metrics.totalShops} Stores</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-cyan-500 border border-slate-200 shadow-xs hover:-translate-y-0.5 transition">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Provided Visicoolers</span>
          <div className="font-mono font-black text-2xl text-cyan-600 mt-1.5">
            {metrics.freezerShopsCount} <span className="text-xs text-cyan-700 font-bold">Visicoolers</span>
          </div>
        </div>
      </div>

      {/* Toolbar: Search Bar & Filter Pills */}
      <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search store by name, code, owner..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto overflow-x-auto scrollbar-none">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${filterType === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            All Stores ({shops.length})
          </button>
          <button
            onClick={() => setFilterType('DUES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${filterType === 'DUES' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            ⚠️ Pending Dues ({metrics.shopsWithDuesCount})
          </button>
          <button
            onClick={() => setFilterType('OVERDUE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${filterType === 'OVERDUE' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            🔴 Overdue &gt; ₹1,000
          </button>
          <button
            onClick={() => setFilterType('FREEZER')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${filterType === 'FREEZER' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            🧊 Visicoolers ({metrics.freezerShopsCount})
          </button>
        </div>
      </div>

      {/* Symmetrical 3x2 Grid Store Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
        {filteredShops.map(shop => {
          const dueVal = Number(shop.current_due || 0);
          const creditLimit = shop.credit_limit || 5000;
          const usedPct = Math.min(100, Math.round((dueVal / creditLimit) * 100));
          const isHighRisk = dueVal >= 1000;

          return (
            <div 
              key={shop.id} 
              className={`glass-panel p-5 rounded-3xl bg-white border transition-all duration-300 flex flex-col justify-between h-full shadow-xs hover:shadow-xl ${
                isHighRisk 
                  ? 'border-rose-300 ring-2 ring-rose-500/10' 
                  : dueVal > 0 
                  ? 'border-amber-300' 
                  : 'border-slate-200'
              }`}
            >
              
              <div className="space-y-3.5 flex-1 flex flex-col justify-between">
                
                {/* Store Header Row with Cute Avatar Badge */}
                <div className="flex items-start justify-between gap-2.5 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xl shadow-xs shrink-0 ${
                      shop.has_freezer 
                        ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white' 
                        : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
                    }`}>
                      🏬
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-base text-slate-900 leading-tight">{shop.name}</h4>
                        <span className="text-[10px] font-mono font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {shop.code || `#${shop.id}`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-semibold flex items-center gap-1 mt-0.5">
                        <User className="w-3.5 h-3.5 text-slate-400" /> Owner: {shop.owner_name || 'Retailer'}
                      </p>
                    </div>
                  </div>

                  {/* Status Pills */}
                  {shop.has_freezer ? (
                    <span className="px-2.5 py-1 bg-cyan-100 text-cyan-800 font-black rounded-xl text-[10px] border border-cyan-200 flex items-center gap-1 shrink-0">
                      🧊 Visicooler
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-500 font-bold rounded-xl text-[10px] shrink-0">
                      Regular
                    </span>
                  )}
                </div>

                {/* Specs Box (Uniform Min-Height 105px Across All Cards) */}
                <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-200 min-h-[105px] flex flex-col justify-center">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone Contact:
                    </span>
                    <a href={`tel:${shop.phone || '9123456789'}`} className="font-mono font-extrabold text-blue-600 hover:underline flex items-center gap-1">
                      <PhoneCall className="w-3 h-3 text-blue-500" />
                      {shop.phone || '9123456789'}
                    </a>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> Route Distance:
                    </span>
                    <span className="font-bold text-slate-700">{shop.distance || '2.5 km'} (Route A)</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5 mt-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Freezer Asset:</span>
                    <span className={`font-bold ${shop.has_freezer ? 'text-cyan-900 font-mono' : 'text-slate-400 font-normal'}`}>
                      {shop.has_freezer ? (shop.freezer_model || 'Blue Star 300L Deep Freezer') : 'Not Assigned (Regular)'}
                    </span>
                  </div>
                </div>

                {/* Credit Gauge Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-slate-500 font-sans font-bold">Credit Limit Usage:</span>
                    <span className={usedPct > 50 ? 'font-black text-rose-600' : 'font-bold text-slate-700'}>
                      ₹{dueVal.toLocaleString()} / ₹{creditLimit.toLocaleString()} ({usedPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        usedPct > 75 ? 'bg-gradient-to-r from-rose-500 to-red-600' : usedPct > 30 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                      }`}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                </div>

                {/* Outstanding Amount Card Box */}
                <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                  dueVal > 0 
                    ? 'bg-amber-50/80 border-amber-200 text-amber-950' 
                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                }`}>
                  <div>
                    <span className="text-[10px] font-bold uppercase block tracking-tight">Current Credit Due:</span>
                    <span className="font-mono font-black text-2xl leading-none">
                      ₹{dueVal.toLocaleString()}
                    </span>
                  </div>

                  <div className="text-right">
                    {dueVal > 0 ? (
                      <span className="text-[10px] font-black uppercase text-amber-700 bg-white px-2.5 py-1 rounded-md border border-amber-300 shadow-2xs block">
                        ⚠️ PAYMENT DUE
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase text-emerald-700 bg-white px-2.5 py-1 rounded-md border border-emerald-300 shadow-2xs block">
                        ✓ CLEAR BALANCE
                      </span>
                    )}
                  </div>
                </div>

              </div>

              {/* Action Buttons Row */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => setSelectedShopForStatement(shop)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center gap-1.5 border border-slate-200 shadow-2xs transition"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" /> Statement
                </button>

                {dueVal > 0 ? (
                  <button
                    onClick={() => {
                      setSelectedShopForPayment(shop);
                      setPaymentAmountInput(String(dueVal));
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs flex items-center justify-center gap-1 shadow-xs border border-amber-400 transition"
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Collect Due
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex-1 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 font-extrabold text-xs flex items-center justify-center gap-1 opacity-80 cursor-default border border-emerald-200"
                  >
                    ✓ No Dues
                  </button>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {/* Modal 1: Collect Due Payment Modal */}
      {selectedShopForPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl relative overflow-hidden">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-base border border-amber-200">
                  💰
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Collect Store Due Payment</h3>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">{selectedShopForPayment.name}</span>
                </div>
              </div>
              <button onClick={() => setSelectedShopForPayment(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 text-xs text-amber-900 flex justify-between items-center font-mono">
                <span className="font-sans font-bold">Outstanding Credit Due:</span>
                <span className="font-black text-amber-700 text-base">₹{(selectedShopForPayment.current_due || 0).toLocaleString()}</span>
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase block mb-1">Select Payment Mode:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentModeInput('CASH')}
                    className={`py-2.5 rounded-xl font-black text-xs border transition ${paymentModeInput === 'CASH' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
                  >
                    💵 Cash (ரொக்கம்)
                  </button>
                  <button
                    onClick={() => setPaymentModeInput('GPAY')}
                    className={`py-2.5 rounded-xl font-black text-xs border transition ${paymentModeInput === 'GPAY' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
                  >
                    📱 GPay / UPI
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase block mb-1">Payment Received Amount (₹):</label>
                <input
                  type="number"
                  placeholder="Enter amount collected..."
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  className="w-full text-sm font-mono font-black bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleCollectDue}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-xs shadow-md transition"
              >
                RECORD PAYMENT & UPDATE DUE
              </button>
              <button
                onClick={() => setSelectedShopForPayment(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-xs transition"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal 2: Register New Store Modal */}
      {showAddShopModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl relative overflow-hidden">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-base border border-emerald-200">
                  🏬
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Register New Store</h3>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Milk Distribution Network</span>
                </div>
              </div>
              <button onClick={() => setShowAddShopModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewShopSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase block mb-1">Store / Shop Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Balaji Milk Traders"
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase block mb-1">Owner Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={newShopOwner}
                  onChange={(e) => setNewShopOwner(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase block mb-1">Phone Contact Number:</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={newShopPhone}
                  onChange={(e) => setNewShopPhone(e.target.value)}
                  className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition"
                >
                  SAVE & REGISTER STORE
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddShopModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-xs transition"
                >
                  Cancel
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Modal 3: Credit Statement Breakdown Modal */}
      {selectedShopForStatement && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-5 space-y-4 shadow-2xl relative overflow-hidden">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-base border border-blue-200">
                  📜
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Store Credit Statement</h3>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">{selectedShopForStatement.name} ({selectedShopForStatement.phone || '9123456789'})</span>
                </div>
              </div>
              <button onClick={() => setSelectedShopForStatement(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex justify-between items-center font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Current Outstanding Balance:</span>
                  <span className="font-black text-amber-600 text-lg">₹{(selectedShopForStatement.current_due || 0).toLocaleString()}</span>
                </div>
                <button
                  onClick={() => handleSendReminderAlert(selectedShopForStatement)}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs flex items-center gap-1 transition"
                >
                  <Send className="w-3 h-3" /> Send Reminder SMS
                </button>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-800 mb-2 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-blue-600" /> Credit Invoices Breakdown:
                </h4>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-none">
                  {(SHOP_CREDIT_INVOICES[selectedShopForStatement.id] || [
                    { bill_no: "INV-46890", date: "2026-08-15", time: "08:30 AM", total: selectedShopForStatement.current_due, paid: 0, due: selectedShopForStatement.current_due, mode: "CREDIT", ageDays: 4 }
                  ]).map((inv, idx) => (
                    <div key={idx} className="p-2.5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between text-xs font-mono">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-slate-900">{inv.bill_no}</span>
                          <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">{inv.mode}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block">{inv.date} ({inv.ageDays} days ago)</span>
                      </div>

                      <div className="text-right">
                        <span className="font-black text-amber-600 text-sm">Due: ₹{inv.due}</span>
                        <span className="text-[10px] text-slate-400 block">Total: ₹{inv.total} | Paid: ₹{inv.paid}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedShopForStatement(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition"
            >
              Close Statement
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
