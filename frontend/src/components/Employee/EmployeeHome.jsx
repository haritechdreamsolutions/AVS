import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Truck, MapPin, Store, Receipt, PackageCheck, Box, 
  ArrowRight, Plus, Edit2, Trash2, X, Check, DollarSign, Wallet, Fuel, 
  Calendar, Clock, ShieldCheck, Lock
} from 'lucide-react';
import { toast } from 'sonner';

export const EmployeeHome = ({ onStartBilling }) => {
  const { 
    currentUser, 
    activeRole,
    employeeStock = [], 
    shops = [], 
    sales = [], 
    fetchDaySummary, 
    addExpense, 
    updateExpense, 
    deleteExpense 
  } = useApp();

  const userRole = (activeRole || currentUser?.role || currentUser?.role_name || '').toUpperCase();
  const isDriver = userRole === 'DRIVER' || userRole === 'EMPLOYEE' || (currentUser?.designation || '').toUpperCase() === 'DRIVER';

  const [daySummary, setDaySummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  
  // Expense Modal State
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    category: 'Diesel',
    amount: '',
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [savingExpense, setSavingExpense] = useState(false);

  const loadSummaryData = async () => {
    try {
      setLoadingSummary(true);
      const summary = await fetchDaySummary();
      if (summary) {
        setDaySummary(summary);
      }
    } catch (err) {
      console.error("Error loading driver day summary:", err);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    loadSummaryData();
  }, [currentUser, sales]);

  const todayStr = new Date().toISOString().split('T')[0];
  const empId = currentUser?.employee_id || currentUser?.id;
  const todaySalesCount = daySummary?.total_bills ?? (sales || []).filter(s => s.employee_id === empId && s.sale_date === todayStr).length;
  const totalShopsCount = shops.length;
  const progressPercent = totalShopsCount > 0 ? Math.min(100, Math.round((todaySalesCount / totalShopsCount) * 100)) : 0;

  // Authoritative financial totals from real database records
  const totalSales = Number(daySummary?.total_sales ?? 0);
  const totalBills = Number(daySummary?.total_bills ?? todaySalesCount);
  const cashCollected = Number(daySummary?.cash_collected ?? 0);
  const gpayCollected = Number(daySummary?.gpay_collected ?? 0);
  const creditSales = Number(daySummary?.credit_sales ?? 0);
  const splitTotal = Number(daySummary?.split_total ?? 0);
  const totalExpenses = Number(daySummary?.total_expenses ?? 0);
  const netAfterExpenses = Number(daySummary?.net_after_expenses ?? (totalSales - totalExpenses));
  const expensesList = daySummary?.expenses || [];

  const sessionStatus = daySummary?.status || 'OPEN';
  const isLocked = daySummary?.is_locked || sessionStatus === 'END_DAY_SUBMITTED' || sessionStatus === 'CLOSED';

  // Format start time if available
  const formattedStartTime = useMemo(() => {
    if (!daySummary?.opened_at) return 'Today, Morning';
    try {
      const d = new Date(daySummary.opened_at);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {
      return 'Today';
    }
  }, [daySummary?.opened_at]);

  // Open Expense Modal (Add / Edit)
  const handleOpenAddExpense = () => {
    if (isLocked) {
      toast.error("Today's working day has already been submitted.");
      return;
    }
    setEditingExpense(null);
    setExpenseForm({
      category: 'Diesel',
      amount: '',
      notes: '',
      date: todayStr
    });
    setShowExpenseModal(true);
  };

  const handleOpenEditExpense = (exp) => {
    if (isLocked) {
      toast.error("Today's working day has already been submitted.");
      return;
    }
    setEditingExpense(exp);
    setExpenseForm({
      category: exp.category || 'Diesel',
      amount: exp.amount || '',
      notes: exp.notes || '',
      date: exp.expense_date || todayStr
    });
    setShowExpenseModal(true);
  };

  // Submit Expense
  const handleSaveExpense = async (e) => {
    e.preventDefault();
    const amt = Number(expenseForm.amount);
    if (!expenseForm.amount || isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid expense amount (> 0)");
      return;
    }

    try {
      setSavingExpense(true);
      let res;
      if (editingExpense) {
        res = await updateExpense(editingExpense.id, {
          category: expenseForm.category,
          amount: amt,
          notes: expenseForm.notes || `Driver expense: ${expenseForm.category}`
        });
      } else {
        res = await addExpense({
          category: expenseForm.category,
          amount: amt,
          notes: expenseForm.notes || `Driver expense: ${expenseForm.category}`
        });
      }

      if (res && res.success) {
        toast.success(editingExpense ? 'Expense updated successfully!' : 'Expense added successfully!');
        setShowExpenseModal(false);
        await loadSummaryData();
      } else {
        toast.error(res?.message || 'Failed to save expense');
      }
    } catch (err) {
      console.error("Expense save error:", err);
      toast.error("Error saving expense");
    } finally {
      setSavingExpense(false);
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (id) => {
    if (isLocked) {
      toast.error("Today's working day has already been submitted.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this expense?")) return;

    try {
      const res = await deleteExpense(id);
      if (res && res.success) {
        toast.success("Expense deleted successfully");
        await loadSummaryData();
      } else {
        toast.error(res?.message || "Failed to delete expense");
      }
    } catch (err) {
      console.error("Error deleting expense:", err);
      toast.error("Error deleting expense");
    }
  };

  return (
    <div className="max-w-md mx-auto p-3 sm:p-4 space-y-4 pb-28 sm:pb-32">
      
      {/* 1. DRIVER DAILY OPERATIONS BANNER */}
      <div className="p-4 rounded-3xl relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white shadow-xl glow-blue">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/20 border border-white/30 text-white">
                DRIVER DAILY OPERATIONS
              </span>
              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                isLocked 
                  ? 'bg-amber-400 text-slate-900 border-amber-300' 
                  : 'bg-emerald-400 text-slate-900 border-emerald-300'
              }`}>
                ● {sessionStatus}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black flex items-center gap-1.5 drop-shadow truncate mt-1">
              வணக்கம் {currentUser?.name || daySummary?.employee_name || 'Driver'} 👋
            </h2>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner border border-white/30 shrink-0">
            🚚
          </div>
        </div>

        {/* Driver, Route, Date & Time Info Grid */}
        <div className="mt-3.5 pt-3 border-t border-white/20 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 text-emerald-300 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-blue-100 uppercase font-extrabold tracking-wide leading-tight">Route</p>
              <p className="font-black text-white text-xs sm:text-sm truncate">
                {currentUser?.route_name || daySummary?.route_name || 'Assigned Route'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 border-l border-white/20 pl-3 min-w-0">
            <Calendar className="w-4 h-4 text-blue-100 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-blue-100 uppercase font-extrabold tracking-wide leading-tight">Working Date</p>
              <p className="font-mono font-bold text-white text-xs sm:text-sm truncate">
                {todayStr}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 min-w-0 pt-1">
            <Clock className="w-4 h-4 text-blue-100 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-blue-100 uppercase font-extrabold tracking-wide leading-tight">Start Time</p>
              <p className="font-mono font-bold text-white text-xs truncate">
                {formattedStartTime}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 border-l border-white/20 pl-3 min-w-0 pt-1">
            <Truck className="w-4 h-4 text-blue-100 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-blue-100 uppercase font-extrabold tracking-wide leading-tight">Vehicle</p>
              <p className="font-mono font-bold text-white text-xs truncate">
                {currentUser?.vehicle_number || currentUser?.vehicle_no || 'Field Vehicle'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Lock Warning Banner if Submitted */}
      {isLocked && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2.5 shadow-sm text-xs font-bold">
          <Lock className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-black text-xs uppercase tracking-tight">Today's working day has been submitted</p>
            <p className="text-[11px] text-amber-700 font-medium">Bills and expenses are locked for this session.</p>
          </div>
        </div>
      )}

      {/* 2. SALES SUMMARY CARD */}
      <div className="glass-card p-4 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="font-extrabold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-blue-600" />
            Today's Sales Summary
          </span>
          <span className="font-mono font-black text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-100">
            {totalBills} {totalBills === 1 ? 'Bill' : 'Bills'}
          </span>
        </div>

        {/* Big Gross Sales Total */}
        <div className="flex items-center justify-between py-1">
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Total Sales (Gross)</span>
            <p className="font-mono font-black text-2xl sm:text-3xl text-slate-900 leading-none mt-0.5">
              ₹{totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Route Coverage</span>
            <p className="font-mono font-black text-sm text-blue-600 leading-none mt-1">
              {todaySalesCount} / {totalShopsCount} Billed
            </p>
          </div>
        </div>

        {/* Payment-Wise Summary Grid */}
        <div className="grid grid-cols-2 xs:grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-xs">
          <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-100">
            <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">Cash</span>
            <span className="font-mono font-black text-xs sm:text-sm text-emerald-700 block mt-0.5">
              ₹{cashCollected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-blue-50/70 border border-blue-100">
            <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider block">GPay / UPI</span>
            <span className="font-mono font-black text-xs sm:text-sm text-blue-700 block mt-0.5">
              ₹{gpayCollected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-purple-50/70 border border-purple-100">
            <span className="text-[10px] font-extrabold text-purple-800 uppercase tracking-wider block">Credit</span>
            <span className="font-mono font-black text-xs sm:text-sm text-purple-700 block mt-0.5">
              ₹{creditSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-100">
            <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">Split Bills</span>
            <span className="font-mono font-black text-xs sm:text-sm text-amber-700 block mt-0.5">
              ₹{splitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* 3. DRIVER EXPENSES SECTION (Non-Driver roles only) */}
      {!isDriver && (
        <div className="glass-card p-4 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-1.5">
              <Fuel className="w-4 h-4 text-rose-600" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                Driver Expenses
              </h3>
            </div>
            {!isLocked && (
              <button
                onClick={handleOpenAddExpense}
                className="px-3 py-1 rounded-xl bg-rose-600 text-white font-extrabold text-xs flex items-center gap-1 hover:bg-rose-700 shadow-sm transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ADD EXPENSE</span>
              </button>
            )}
          </div>

          {/* Expenses List */}
          {expensesList.length === 0 ? (
            <div className="text-center py-4 text-xs text-slate-400 font-medium">
              No expenses recorded for today.
            </div>
          ) : (
            <div className="space-y-2">
              {expensesList.map((exp) => (
                <div 
                  key={exp.id} 
                  className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{exp.category || exp.title}</span>
                      {exp.notes && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                          • {exp.notes}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {exp.expense_date || todayStr}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-black text-sm text-rose-600">
                      ₹{Number(exp.amount).toFixed(2)}
                    </span>
                    {!isLocked && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditExpense(exp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                          title="Edit Expense"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Total Expenses Row */}
              <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-200 text-xs">
                <span className="font-extrabold text-slate-600 uppercase tracking-wider">Total Expenses:</span>
                <span className="font-mono font-black text-sm text-rose-600">
                  ₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. NET FINANCIAL SUMMARY CARD (Non-Driver roles only) */}
      {!isDriver && (
        <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Financial Net Summary
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              Real-Time Calculation
            </span>
          </div>

          <div className="space-y-1.5 text-xs text-slate-300">
            <div className="flex justify-between">
              <span>Gross Sales:</span>
              <span className="font-mono font-bold text-white">
                ₹{totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-rose-400">
              <span>Total Expenses:</span>
              <span className="font-mono font-bold">
                - ₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-700 text-sm font-black text-white">
              <span className="text-emerald-400">Net After Expenses:</span>
              <span className="font-mono text-emerald-400 text-base sm:text-lg">
                ₹{netAfterExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. MY VEHICLE STOCK (Available) Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <PackageCheck className="w-4 h-4 text-emerald-600" />
            MY VEHICLE STOCK (Available)
          </h3>
          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Live PostgreSQL
          </span>
        </div>

        {(!employeeStock || employeeStock.length === 0) ? (
          <div className="text-center py-8 bg-white rounded-3xl border border-dashed border-slate-200 p-4 shadow-sm">
            <Box className="w-9 h-9 text-slate-300 mx-auto mb-1.5" />
            <p className="font-bold text-xs text-slate-700">No stock allocated to vehicle yet</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Please ask Store Keeper to issue daily crates/trays.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 sm:gap-3">
            {employeeStock.map((item, idx) => {
              const piecesPerUnit = item.pieces_per_unit || 1;
              const totalPieces = Math.floor(Number(item.qty_units || 0) * piecesPerUnit);

              return (
                <div 
                  key={idx} 
                  className="glass-card p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between gap-3 hover:shadow-md hover:border-blue-300 transition-all min-w-0"
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-50 border border-slate-200/80 shrink-0 overflow-hidden flex items-center justify-center p-1.5 shadow-inner">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.display_name || item.product_name}
                        className="w-full h-full object-contain rounded-xl"
                      />
                    ) : (
                      <span className="text-2xl sm:text-3xl">{item.icon || '📦'}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 pl-1">
                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug truncate">
                      {item.display_name || item.product_name}
                    </h4>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5 truncate">
                      {item.qty_units} {item.selling_unit || 'Trays'}
                    </p>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    <span className="font-mono font-black text-xl sm:text-2xl text-emerald-600 block leading-tight">
                      {totalPieces}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">
                      {item.base_unit || 'PCS'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. PRIMARY HERO CTA: BILL PODU / பில் போடு */}
      <div className="pt-1">
        <button
          onClick={onStartBilling}
          disabled={isLocked}
          className={`w-full p-4 sm:p-5 rounded-3xl flex items-center justify-between gap-3 transition-all text-left shadow-xl border ${
            isLocked
              ? 'bg-slate-300 text-slate-500 border-slate-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:via-indigo-700 hover:to-blue-800 text-white shadow-indigo-600/30 active:scale-[0.98] cursor-pointer border-white/20 group'
          }`}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner shrink-0 group-hover:scale-105 transition">
              <Receipt className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black tracking-wide uppercase drop-shadow-sm truncate">
                  BILL PODU (பில் போடு)
                </span>
                <span className="bg-amber-400 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 hidden xs:inline-block">
                  POS
                </span>
              </div>
              <p className="text-xs text-blue-100 font-medium truncate mt-0.5">
                {isLocked ? "Day closed • Billing is locked" : "Select Shop & Create Instant Bill"}
              </p>
            </div>
          </div>
          <div className="w-9 h-9 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white shrink-0 group-hover:translate-x-1 transition border border-white/20">
            <ArrowRight className="w-5 h-5" />
          </div>
        </button>
      </div>

      {/* 7. ADD / EDIT EXPENSE MODAL (Non-Driver roles only) */}
      {!isDriver && showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveExpense} className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Fuel className="w-5 h-5 text-rose-600" />
                {editingExpense ? 'Edit Expense' : 'Add Driver Expense'}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowExpenseModal(false)} 
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 uppercase block mb-1">Expense Type</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:outline-none focus:border-rose-500"
                >
                  <option value="Diesel">Diesel</option>
                  <option value="Toll">Toll</option>
                  <option value="Parking">Parking</option>
                  <option value="Food">Food</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 uppercase block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  placeholder="e.g. 800"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-mono font-black text-base text-slate-900 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 uppercase block mb-1">Description / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Morning fuel refill"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingExpense}
                className="px-5 py-2.5 rounded-xl bg-rose-600 text-white font-extrabold text-xs hover:bg-rose-700 shadow-md active:scale-95 transition"
              >
                {savingExpense ? 'Saving...' : (editingExpense ? 'Update Expense' : 'Save Expense')}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
