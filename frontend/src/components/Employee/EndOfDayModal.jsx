import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, CheckCircle2, Package, Fuel, AlertCircle, 
  Receipt, ShieldCheck, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

export const EndOfDayModal = ({ onClose }) => {
  const { 
    currentUser, 
    employeeStock = [], 
    products = [], 
    fetchDaySummary, 
    submitDriverEndDay 
  } = useApp();
  
  const [daySummary, setDaySummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [showConfirmStep, setShowConfirmStep] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const loadData = async () => {
    try {
      setLoadingSummary(true);
      const summary = await fetchDaySummary();
      if (summary) {
        setDaySummary(summary);
        if (summary.is_closed || summary.status === 'END_DAY_SUBMITTED' || summary.status === 'CLOSED') {
          setDone(true);
        }
      }
    } catch (err) {
      console.error("Error loading day summary:", err);
      toast.error("Failed to load today's summary from database");
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // Consolidate stock with Trays and calculated Pieces
  const consolidatedStock = useMemo(() => {
    const stockList = (daySummary?.available_stock && daySummary.available_stock.length > 0)
      ? daySummary.available_stock
      : employeeStock;

    const map = new Map();
    (stockList || []).forEach(st => {
      const pid = st.product_id || st.product?.id || st.id;
      if (!pid) return;
      const prod = products.find(p => p.id === pid) || st.product || st;
      const ppu = Number(prod.pieces_per_unit || 1);
      const qtyUnits = Number(st.qty_units) || 0;
      
      if (map.has(pid)) {
        const item = map.get(pid);
        item.qty_units += qtyUnits;
        item.pieces = Math.round(item.qty_units * ppu);
      } else {
        map.set(pid, {
          product_id: pid,
          product_name: prod.display_name || prod.name || st.product_name || 'Product',
          image_url: prod.image_url || st.image_url,
          icon: prod.icon || st.icon || '📦',
          qty_units: qtyUnits,
          selling_unit: st.selling_unit || prod.selling_unit || 'Tray',
          base_unit: st.base_unit || prod.base_unit || 'Piece',
          pieces_per_unit: ppu,
          pieces: Math.round(qtyUnits * ppu)
        });
      }
    });
    return Array.from(map.values()).filter(item => item.pieces > 0 || item.qty_units > 0);
  }, [daySummary?.available_stock, employeeStock, products]);

  // Authoritative database values
  const todayStr = daySummary?.working_date || new Date().toISOString().split('T')[0];
  const driverName = currentUser?.name || daySummary?.employee_name || 'Driver';
  const routeName = currentUser?.route_name || daySummary?.route_name || 'Assigned Route';
  
  const totalSales = Number(daySummary?.total_sales ?? 0);
  const totalBills = Number(daySummary?.total_bills ?? 0);
  const cashCollected = Number(daySummary?.cash_collected ?? 0);
  const gpayCollected = Number(daySummary?.gpay_collected ?? 0);
  const creditSales = Number(daySummary?.credit_sales ?? 0);
  const splitTotal = Number(daySummary?.split_total ?? 0);
  const totalExpenses = Number(daySummary?.total_expenses ?? 0);
  const netAfterExpenses = Number(daySummary?.net_after_expenses ?? (totalSales - totalExpenses));
  const expensesList = daySummary?.expenses || [];

  const sessionStatus = daySummary?.status || 'OPEN';
  const isLocked = done || daySummary?.is_locked || sessionStatus === 'END_DAY_SUBMITTED' || sessionStatus === 'CLOSED';

  // Handle End Day Confirmation & Submission
  const handleConfirmEndDay = async () => {
    if (isLocked) {
      toast.error("Today's working day has already been submitted.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await submitDriverEndDay({
        notes: `End of day submitted by ${driverName}. Net Sales: ₹${netAfterExpenses.toFixed(2)}`
      });

      if (res && res.success) {
        setDone(true);
        setShowConfirmStep(false);
        toast.success("🎉 நாள் வெற்றிகரமாக முடிக்கப்பட்டது! (End Day Submitted Successfully)");
        await loadData();
      } else {
        toast.error(res?.message || "Failed to submit end day closing.");
      }
    } catch (err) {
      console.error("End Day closing error:", err);
      toast.error("Error submitting end day: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-4 sm:p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <h3 className="font-black text-base text-slate-900 tracking-tight">
                DRIVER DAILY CLOSING
              </h3>
              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                isLocked 
                  ? 'bg-amber-100 text-amber-900 border-amber-300' 
                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
              }`}>
                ● {sessionStatus}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono font-bold mt-0.5">
              {driverName} • {routeName} • {todayStr}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loadingSummary ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-500 font-bold">Loading live daily summary from database...</p>
          </div>
        ) : showConfirmStep ? (
          /* Confirmation Step */
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 space-y-1">
              <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Confirm End of Working Day
              </div>
              <p className="text-xs font-medium text-amber-800 leading-relaxed">
                Please verify your day totals before submitting. Once submitted, today's sales and expenses will be locked, and your working day will be marked as completed.
              </p>
            </div>

            {/* Reconciled Financial Review */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 font-bold">
                <span>Driver & Route:</span>
                <span className="text-slate-900 font-black">{driverName} ({routeName})</span>
              </div>
              <div className="flex justify-between text-slate-600 font-bold">
                <span>Total Bills:</span>
                <span className="text-blue-600 font-mono font-black">{totalBills} Bills</span>
              </div>
              <div className="flex justify-between text-slate-600 font-bold">
                <span>Gross Sales:</span>
                <span className="text-slate-900 font-mono font-black">₹{totalSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-bold">
                <span>Cash Collection:</span>
                <span className="text-emerald-700 font-mono font-bold">₹{cashCollected.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-bold">
                <span>GPay / UPI:</span>
                <span className="text-indigo-700 font-mono font-bold">₹{gpayCollected.toFixed(2)}</span>
              </div>
              {creditSales > 0 && (
                <div className="flex justify-between text-slate-600 font-bold">
                  <span>Credit / Dues:</span>
                  <span className="text-amber-700 font-mono font-bold">₹{creditSales.toFixed(2)}</span>
                </div>
              )}
              {totalExpenses > 0 && (
                <div className="flex justify-between text-slate-600 font-bold">
                  <span>Driver Expenses:</span>
                  <span className="text-rose-600 font-mono font-black">- ₹{totalExpenses.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                <span>NET AFTER EXPENSES:</span>
                <span className="text-emerald-600 font-mono font-black">₹{netAfterExpenses.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowConfirmStep(false)}
                disabled={submitting}
                className="w-1/3 py-3 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs cursor-pointer transition"
              >
                BACK
              </button>
              <button
                onClick={handleConfirmEndDay}
                disabled={submitting}
                className="w-2/3 py-3 px-4 rounded-2xl text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer transition active:scale-[0.98] bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 shadow-rose-600/30"
              >
                {submitting ? 'SUBMITTING...' : 'CONFIRM & SUBMIT END DAY'}
              </button>
            </div>
          </div>
        ) : (
          /* Main Day Review & Stock View */
          <div className="space-y-4">
            
            {/* Locked / Submitted Status Banner */}
            {isLocked && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-emerald-950 text-sm tracking-tight">
                    Day Completed & Submitted
                  </h4>
                  <p className="text-xs text-emerald-800 font-medium mt-0.5">
                    Working day is closed ({sessionStatus}). Sales and expenses are locked in read-only mode.
                  </p>
                </div>
              </div>
            )}

            {/* Live Financial Summary */}
            <div className="bg-slate-900 text-white rounded-3xl p-4 space-y-3 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold text-blue-300 uppercase tracking-widest block">
                    NET DAILY COLLECTION
                  </span>
                  <div className="text-2xl font-black font-mono text-emerald-400">
                    ₹{netAfterExpenses.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                    TOTAL BILLS
                  </span>
                  <div className="text-xl font-black font-mono text-white">
                    {totalBills} <span className="text-xs text-slate-400 font-normal">Bills</span>
                  </div>
                </div>
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                <div className="bg-slate-800/60 rounded-xl p-2 border border-slate-700/50">
                  <div className="text-slate-400 font-medium">Cash</div>
                  <div className="font-mono font-bold text-emerald-400">₹{cashCollected.toFixed(2)}</div>
                </div>
                <div className="bg-slate-800/60 rounded-xl p-2 border border-slate-700/50">
                  <div className="text-slate-400 font-medium">GPay / UPI</div>
                  <div className="font-mono font-bold text-indigo-400">₹{gpayCollected.toFixed(2)}</div>
                </div>
                <div className="bg-slate-800/60 rounded-xl p-2 border border-slate-700/50">
                  <div className="text-slate-400 font-medium">Credit</div>
                  <div className="font-mono font-bold text-amber-400">₹{creditSales.toFixed(2)}</div>
                </div>
              </div>

              {/* Expenses Row */}
              <div className="flex justify-between items-center bg-slate-800/90 rounded-xl p-2.5 border border-slate-700 text-xs">
                <div className="flex items-center gap-2 text-slate-300 font-bold">
                  <Fuel className="w-4 h-4 text-rose-400" />
                  <span>Driver Expenses ({expensesList.length})</span>
                </div>
                <div className="font-mono font-black text-rose-400">
                  - ₹{totalExpenses.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Expenses List Details (if any) */}
            {expensesList.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-slate-500" />
                  Recorded Expenses
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {expensesList.map(exp => (
                    <div key={exp.id} className="flex justify-between items-center text-xs py-1 px-2 bg-white rounded-lg border border-slate-100">
                      <div>
                        <span className="font-bold text-slate-800">{exp.category}</span>
                        {exp.description && <span className="text-slate-500 ml-1 text-[11px]">({exp.description})</span>}
                      </div>
                      <span className="font-mono font-bold text-rose-600">₹{Number(exp.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Current Available Stock (Trays & Pieces) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-slate-700 uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span>Current Available Stock</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono font-normal">
                  {consolidatedStock.length} Products
                </span>
              </div>

              {consolidatedStock.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
                  No stock currently loaded in vehicle.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {consolidatedStock.map(item => (
                    <div 
                      key={item.product_id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.product_name} 
                            className="w-8 h-8 rounded-lg object-contain bg-white border border-slate-200 p-0.5 shrink-0" 
                          />
                        ) : (
                          <span className="text-lg">{item.icon || '📦'}</span>
                        )}
                        <div>
                          <div className="font-bold text-xs text-slate-900">{item.product_name}</div>
                          <div className="text-[10px] text-slate-500">
                            1 {item.selling_unit} = {item.pieces_per_unit} {item.base_unit}s
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-black text-xs text-slate-900">
                          {Number(item.qty_units).toFixed(2)} {item.selling_unit}s
                        </div>
                        <div className="font-mono font-bold text-[10px] text-blue-600">
                          {item.pieces} {item.base_unit}s
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              {isLocked ? (
                <button
                  onClick={onClose}
                  className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-wider hover:bg-slate-800 transition cursor-pointer"
                >
                  CLOSE
                </button>
              ) : (
                <button
                  onClick={() => setShowConfirmStep(true)}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition cursor-pointer active:scale-[0.98]"
                >
                  <span>END WORKING DAY</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
export default EndOfDayModal;

