import React, { useState, useEffect } from 'react';
import { ArrowLeft, Banknote, Smartphone, CreditCard, Split, CheckCircle2, DollarSign, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export const PaymentModal = ({ billData, onConfirmBill, onBack }) => {
  const [mode, setMode] = useState('SPLIT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const totalAmount = Number(Number(billData?.total_amount || 0).toFixed(2));

  // Dynamic SPLIT state
  const [cashReceived, setCashReceived] = useState(totalAmount.toString());
  const [creditAmount, setCreditAmount] = useState(0);

  // Sync state whenever totalAmount changes
  useEffect(() => {
    setCashReceived(totalAmount.toString());
    setCreditAmount(0);
  }, [totalAmount]);

  // Compute clean numeric values
  const numCash = Math.min(totalAmount, Math.max(0, Number(cashReceived) || 0));
  
  // GPay is automatically calculated in SPLIT mode: Total - Cash
  const numGpay = mode === 'SPLIT' 
    ? Number(Math.max(0, totalAmount - numCash).toFixed(2))
    : (mode === 'GPAY' ? totalAmount : 0);

  const numCredit = Number(creditAmount) || 0;

  const totalReceived = mode === 'CASH' ? totalAmount :
                        mode === 'GPAY' ? totalAmount :
                        mode === 'CREDIT' ? 0 :
                        Number((numCash + numGpay + numCredit).toFixed(2));
  
  const balance = Number(Math.max(0, totalAmount - totalReceived).toFixed(2));

  // Smart Auto-Fill Helper when Cash is typed in Split Mode
  const handleCashChange = (val) => {
    if (val === '' || val === null || val === undefined) {
      setCashReceived('');
      return;
    }
    const numericVal = parseFloat(val);
    if (isNaN(numericVal) || numericVal < 0) {
      setCashReceived('');
      return;
    }
    if (numericVal > totalAmount) {
      toast.error(`ரொக்கத் தொகை மொத்த பில் தொகையை (₹${totalAmount.toFixed(2)}) விட அதிகமாக இருக்க முடியாது!`);
      setCashReceived(totalAmount.toString());
      return;
    }
    setCashReceived(val);
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    if (balance !== 0 && mode !== 'CREDIT') {
      toast.error(`பணம் தவறாக உள்ளது! பாக்கி: ₹${balance.toFixed(2)}`);
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirmBill({
        ...billData,
        shop_id: billData?.shop_id,
        shop_name: billData?.shop_name,
        shop_code: billData?.shop_code,
        payment_mode: mode,
        cash_paid: mode === 'CASH' ? totalAmount : (mode === 'SPLIT' ? numCash : 0),
        gpay_paid: mode === 'GPAY' ? totalAmount : (mode === 'SPLIT' ? numGpay : 0),
        credit_paid: mode === 'CREDIT' ? totalAmount : (mode === 'SPLIT' ? numCredit : 0),
        balance: balance
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-3 sm:p-4 space-y-4 pb-32 sm:pb-36">
      
      {/* Top Header */}
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition font-black text-xs flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK</span>
        </button>
        <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          PAYMENT SCREEN
        </h2>
        <div className="text-[11px] font-bold text-slate-500 font-mono">
          {billData?.shop_code || 'POS'}
        </div>
      </div>

      {/* Total Amount Display Card */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl text-center bg-white border border-emerald-300 shadow-sm glow-green">
        <span className="text-xs text-slate-500 uppercase font-extrabold tracking-wider">Total Bill Amount</span>
        <div className="font-mono font-black text-3xl sm:text-4xl text-emerald-600 mt-1">
          ₹{totalAmount.toFixed(2)}
        </div>
      </div>

      {/* Payment Mode Selector Grid */}
      <div className="space-y-2">
        <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
          SELECT PAYMENT MODE (பணம் செலுத்தும் முறை)
        </label>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* CASH BUTTON */}
          <button
            onClick={() => setMode('CASH')}
            className={`p-3 rounded-2xl border font-black text-xs flex flex-col items-center gap-2 transition active:scale-95 cursor-pointer ${
              mode === 'CASH'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg glow-green'
                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Banknote className={`w-6 h-6 ${mode === 'CASH' ? 'text-white' : 'text-emerald-600'}`} />
            <div className="text-center">
              <span className="block font-black text-xs">CASH</span>
              <span className="text-[10px] font-bold opacity-80">ரொக்கம்</span>
            </div>
          </button>
          
          {/* GPAY / UPI BUTTON */}
          <button
            onClick={() => setMode('GPAY')}
            className={`p-3 rounded-2xl border font-black text-xs flex flex-col items-center gap-2 transition active:scale-95 cursor-pointer ${
              mode === 'GPAY'
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg glow-blue'
                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Smartphone className={`w-6 h-6 ${mode === 'GPAY' ? 'text-white' : 'text-blue-600'}`} />
            <div className="text-center">
              <span className="block font-black text-xs">GPAY / UPI</span>
              <span className="text-[10px] font-bold opacity-80">ஜிபே</span>
            </div>
          </button>

          {/* CREDIT BUTTON */}
          <button
            onClick={() => setMode('CREDIT')}
            className={`p-3 rounded-2xl border font-black text-xs flex flex-col items-center gap-2 transition active:scale-95 cursor-pointer ${
              mode === 'CREDIT'
                ? 'bg-amber-600 border-amber-600 text-white shadow-lg'
                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
            }`}
          >
            <CreditCard className={`w-6 h-6 ${mode === 'CREDIT' ? 'text-white' : 'text-amber-600'}`} />
            <div className="text-center">
              <span className="block font-black text-xs">CREDIT</span>
              <span className="text-[10px] font-bold opacity-80">கடமை / DUES</span>
            </div>
          </button>

          {/* SPLIT PAYMENT BUTTON */}
          <button
            onClick={() => setMode('SPLIT')}
            className={`p-3 rounded-2xl border font-black text-xs flex flex-col items-center gap-2 transition active:scale-95 cursor-pointer ${
              mode === 'SPLIT'
                ? 'bg-purple-600 border-purple-600 text-white shadow-lg'
                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Split className={`w-6 h-6 ${mode === 'SPLIT' ? 'text-white' : 'text-purple-600'}`} />
            <div className="text-center">
              <span className="block font-black text-xs">SPLIT</span>
              <span className="text-[10px] font-bold opacity-80">பிரித்து செலுத்து</span>
            </div>
          </button>
        </div>
      </div>

      {/* Split Payment inputs */}
      {mode === 'SPLIT' && (
        <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-sm">
          <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Split className="w-4 h-4 text-purple-600" />
              Split Payment Breakdown
            </span>
            <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Bill: ₹{totalAmount.toFixed(2)}
            </span>
          </h3>

          <div className="space-y-2.5">
            {/* Cash Received Input */}
            <div className="flex items-center justify-between bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200">
              <div className="min-w-0">
                <span className="text-xs font-black text-emerald-700 flex items-center gap-1.5 truncate">
                  <Banknote className="w-4 h-4 shrink-0" />
                  Cash Received (ரொக்கம்)
                </span>
                <span className="text-[10px] font-bold text-slate-400 block pl-5.5">
                  Type cash collected
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-mono font-black text-sm">₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  max={totalAmount}
                  value={cashReceived}
                  placeholder="0.00"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleCashChange(e.target.value)}
                  className="w-24 sm:w-28 bg-white border border-slate-300 rounded-lg px-2 py-1 text-right font-mono font-black text-slate-900 text-sm sm:text-base focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 shadow-xs"
                />
              </div>
            </div>

            {/* GPay Received Automatically Calculated (Read-only) */}
            <div className="flex items-center justify-between bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200">
              <div className="min-w-0">
                <span className="text-xs font-black text-blue-700 flex items-center gap-1.5 truncate">
                  <Smartphone className="w-4 h-4 shrink-0" />
                  GPay Received (ஜிபே)
                </span>
                <span className="text-[10px] font-bold text-blue-600 block pl-5.5">
                  Auto-calculated remaining
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
                  AUTO
                </span>
                <div className="w-24 sm:w-28 bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 text-right font-mono font-black text-slate-900 text-sm sm:text-base select-none">
                  ₹{numGpay.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown Summary */}
          <div className="pt-2 border-t border-slate-100 text-xs space-y-1.5 font-mono">
            <div className="flex justify-between text-slate-600 font-bold">
              <span>Total Bill:</span>
              <span className="text-slate-900 font-black">₹{totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600 font-bold">
              <span>Cash:</span>
              <span className="text-emerald-700 font-bold">₹{numCash.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600 font-bold">
              <span>GPay:</span>
              <span className="text-blue-700 font-bold">₹{numGpay.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-900 pt-1 font-black text-sm border-t border-slate-200">
              <span>Total Paid:</span>
              <span className="text-emerald-600">₹{totalReceived.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600 font-bold">
              <span>Remaining:</span>
              <span className={balance === 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>
                ₹{balance.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Button in Natural Flow with generous bottom clearance */}
      <div className="pt-2">
        <button
          onClick={handleConfirm}
          disabled={isSubmitting || (balance !== 0 && mode !== 'CREDIT')}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-base uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xl glow-green transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none min-h-[52px] cursor-pointer"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>SAVING BILL & PRINTING...</span>
            </div>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>CONFIRM & PRINT BILL (பில் அச்சிடு)</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
};
