import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, CheckCircle2, Package, Fuel, Plus, Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

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

export const EndOfDayModal = ({ onClose }) => {
  const { currentUser, employeeStock, addExpense, sales, expenses } = useApp();
  
  const [expenseCat, setExpenseCat] = useState('Diesel');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const todayStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  const todayIsoStr = new Date().toISOString().split('T')[0];

  // Filter ONLY expenses added TODAY for this employee
  const todayExpensesList = (expenses || []).filter(e =>
    (e.employee_id === currentUser?.id || !e.employee_id) &&
    (e.date === todayStr || e.date === todayIsoStr)
  );

  const totalExpenseSum = todayExpensesList.reduce((acc, item) => acc + (item.amount || 0), 0);

  const handleAddExpenseItem = async () => {
    if (!expenseAmount || Number(expenseAmount) <= 0) {
      toast.error("செல்லுபடியாகும் தொகையை உள்ளிடவும்! (Please enter a valid amount)");
      return;
    }

    const res = await addExpense({
      category: expenseCat,
      amount: Number(expenseAmount),
      paid_by: 'Employee'
    });

    if (res?.success) {
      toast.success(`பதிவு செய்யப்பட்டது: ${expenseCat} ₹${expenseAmount}`);
      setExpenseAmount('');
    }
  };

  // Filter today's sales for current employee
  const empSalesToday = (sales || []).filter(s =>
    (s.employee_id === currentUser?.id || !s.employee_id) &&
    (s.date === todayStr || s.date === todayIsoStr || !s.date)
  );

  const totalSales = empSalesToday.reduce((acc, s) => acc + (s.total_amount || 0), 0);
  const totalBills = empSalesToday.length;
  const cashCollection = empSalesToday.reduce((acc, s) => acc + (s.cash_paid || 0), 0);
  const gpayCollection = empSalesToday.reduce((acc, s) => acc + (s.gpay_paid || 0), 0);

  const summaryData = {
    totalSales,
    totalBills,
    cashCollection,
    gpayCollection,
    creditSales: empSalesToday.reduce((acc, s) => acc + (s.credit_paid || 0), 0)
  };

  const handleCloseDay = async () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setDone(true);
      toast.success("நாள் முடிக்கப்பட்டு ஸ்டோர் கீப்பருக்கு அனுப்பப்பட்டது!");
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-extrabold text-base text-slate-900">End Of Day Summary</h3>
            <p className="text-xs text-slate-500 font-mono font-bold">{currentUser?.name} ({currentUser?.vehicle_no})</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="text-center py-8 space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-300 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h4 className="font-black text-xl text-slate-900">DAY CLOSED SUCCESSFULLY!</h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto font-medium">
              Your daily summary, locked expenses (₹{totalExpenseSum.toLocaleString()}), and remaining stock report have been submitted to Store Keeper.
            </p>
            <button
              onClick={onClose}
              className="touch-btn touch-btn-primary w-full text-sm font-bold mt-4"
            >
              Return to Home
            </button>
          </div>
        ) : (
          <>
            {/* Sales & Cash Summary Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="glass-card p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block font-bold">Total Sales</span>
                <span className="font-mono font-black text-lg text-emerald-600">₹{summaryData.totalSales.toLocaleString()}</span>
              </div>
              <div className="glass-card p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block font-bold">Total Bills</span>
                <span className="font-mono font-black text-lg text-blue-600">{summaryData.totalBills}</span>
              </div>
              <div className="glass-card p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block font-bold">Cash Collection</span>
                <span className="font-mono font-bold text-slate-900">₹{summaryData.cashCollection.toLocaleString()}</span>
              </div>
              <div className="glass-card p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block font-bold">GPay Collection</span>
                <span className="font-mono font-bold text-slate-900">₹{summaryData.gpayCollection.toLocaleString()}</span>
              </div>
            </div>

            {/* Dynamic Multi-Line Expense Entry Section */}
            <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-extrabold uppercase text-slate-700 flex items-center gap-1.5">
                  <Fuel className="w-4 h-4 text-amber-600" />
                  Daily Expenses Entry
                </h4>
                <span className="font-mono font-black text-xs text-amber-700">Total: ₹{totalExpenseSum.toLocaleString()}</span>
              </div>

              {/* Add Expense Inputs */}
              <div className="flex gap-1.5">
                <select
                  value={expenseCat}
                  onChange={(e) => setExpenseCat(e.target.value)}
                  className="bg-white border border-slate-300 text-xs text-slate-900 font-bold rounded-xl px-2 py-2 focus:outline-none flex-1"
                >
                  <option value="Diesel">⛽ Diesel</option>
                  <option value="Lunch">🍛 Lunch / Food</option>
                  <option value="Vehicle Maintenance">🔧 Vehicle Maintenance</option>
                  <option value="Toll">🛣️ Toll Fee</option>
                  <option value="Other">📦 Other</option>
                </select>

                <input
                  type="number"
                  placeholder="தொகை ₹"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-24 bg-white border border-slate-300 text-xs text-slate-900 rounded-xl px-2.5 py-2 font-mono font-bold focus:outline-none"
                />

                <button
                  onClick={handleAddExpenseItem}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>

              {/* Security Rule Warning Note */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 flex items-start gap-1.5 text-[11px] text-amber-900 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  குறிப்பு: சேர்க்கப்பட்ட எக்ஸ்பென்ஸை எம்ப்ளாயியால் டெலீட் செய்ய முடியாது. தவறு இருந்தால் ஸ்டோர் கீப்பரிடம் தெரிவிக்கவும்.
                </span>
              </div>

              {/* Expense Items List - LOCKED (NO DELETE BUTTON FOR EMPLOYEE) */}
              <div className="space-y-1.5 pt-1">
                {todayExpensesList.length === 0 ? (
                  <p className="text-[11px] text-slate-400 font-bold italic text-center py-1.5">
                    இன்று எக்ஸ்பென்ஸ் ஏதும் சேர்க்கப்படவில்லை (No expenses recorded today)
                  </p>
                ) : (
                  todayExpensesList.map(item => (
                    <div key={item.id || Math.random()} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-bold shadow-sm">
                      <span className="text-slate-900 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        {item.category}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-amber-700 font-black">₹{item.amount.toLocaleString()}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold bg-slate-100 text-slate-500 border border-slate-200">
                          🔒 Locked
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Stock Remaining List */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold uppercase text-slate-500 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-emerald-600" />
                Stock Remaining (To Return)
              </h4>
              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 space-y-2 text-xs">
                {employeeStock.map((st, idx) => {
                  const pid = st.product_id || st.product?.id;
                  const imgUrl = PRODUCT_IMAGES[pid] || st.product?.image || `/images/amirthaa_milk_200ml.png`;
                  const isJpg = imgUrl.endsWith('.jpg');
                  const piecesPerUnit = st.product?.pieces_per_unit || 1;
                  const pcs = Math.round((st.qty_units || 0) * piecesPerUnit);
                  return (
                    <div key={idx} className="flex justify-between items-center text-slate-800 font-bold border-b border-slate-200/60 pb-1.5 last:border-none gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center p-0.5 shadow-2xs">
                          <img
                            src={imgUrl}
                            alt={st.product?.display_name || 'Product'}
                            className="w-full h-full object-contain rounded-md"
                          />
                        </div>
                        <span className="truncate">{st.product?.display_name}</span>
                      </div>
                      <span className="font-mono text-emerald-700 font-black shrink-0">{pcs} Pcs</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Submit / End Day Button */}
            <button
              onClick={handleCloseDay}
              disabled={submitting}
              className="touch-btn touch-btn-danger w-full text-base font-extrabold flex items-center justify-center gap-2 uppercase tracking-wider mt-4"
            >
              {submitting ? 'CLOSING DAY...' : 'END DAY'}
            </button>
          </>
        )}

      </div>
    </div>
  );
};
