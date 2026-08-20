import React, { useState, useEffect } from 'react';
import { ArrowLeft, Banknote, Smartphone, CreditCard, Split, CheckCircle2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

export const PaymentModal = ({ billData, onConfirmBill, onBack }) => {
  const [mode, setMode] = useState('SPLIT');
  
  const totalAmount = billData?.total_amount || 45;

  // DYNAMIC DEDICATED SPLIT INITIALIZATION (Fixed hardcoded 700/950 demo bug)
  const [cashReceived, setCashReceived] = useState(totalAmount);
  const [gpayReceived, setGpayReceived] = useState(0);
  const [creditAmount, setCreditAmount] = useState(0);

  // Sync state whenever totalAmount changes
  useEffect(() => {
    setCashReceived(totalAmount);
    setGpayReceived(0);
    setCreditAmount(0);
  }, [totalAmount]);

  const numCash = Number(cashReceived) || 0;
  const numGpay = Number(gpayReceived) || 0;
  const numCredit = Number(creditAmount) || 0;

  const totalReceived = (mode === 'CASH' ? totalAmount : 
                        (mode === 'GPAY' ? totalAmount : 
                        (mode === 'CREDIT' ? 0 : numCash + numGpay + numCredit)));
  
  const balance = totalAmount - totalReceived;

  // Smart Auto-Fill Helper when Cash is typed in Split Mode
  const handleCashChange = (val) => {
    const cashVal = Number(val) || 0;
    setCashReceived(val);
    if (cashVal <= totalAmount) {
      setGpayReceived(totalAmount - cashVal);
      setCreditAmount(0);
    }
  };

  const handleConfirm = () => {
    if (balance !== 0 && mode !== 'CREDIT') {
      toast.error(`பணம் தவறாக உள்ளது! பாக்கி: ₹${balance}`);
      return;
    }

    onConfirmBill({
      ...billData,
      payment_mode: mode,
      cash_paid: mode === 'CASH' ? totalAmount : (mode === 'SPLIT' ? numCash : 0),
      gpay_paid: mode === 'GPAY' ? totalAmount : (mode === 'SPLIT' ? numGpay : 0),
      credit_paid: mode === 'CREDIT' ? totalAmount : (mode === 'SPLIT' ? numCredit : 0),
      balance: balance
    });
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 pb-28">
      
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-600" />
          PAYMENT SCREEN (பணம் செலுத்துதல்)
        </h2>
        <div className="w-9"></div>
      </div>

      {/* Total Amount Display Card */}
      <div className="glass-panel p-5 rounded-2xl text-center bg-white border border-emerald-300 shadow-sm glow-green">
        <span className="text-xs text-slate-500 uppercase font-extrabold tracking-wider">Total Bill Amount</span>
        <div className="font-mono font-black text-3xl text-emerald-600 mt-1">
          ₹{totalAmount.toLocaleString()}
        </div>
      </div>

      {/* Payment Mode Selector Grid with Prominent Icons & Names */}
      <div className="space-y-2">
        <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
          SELECT PAYMENT MODE (பணம் செலுத்தும் முறை)
        </label>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* CASH BUTTON */}
          <button
            onClick={() => setMode('CASH')}
            className={`p-3 rounded-2xl border font-black text-xs flex flex-col items-center gap-2 transition active:scale-95 ${
              mode === 'CASH'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg glow-green'
                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Banknote className="w-6 h-6 text-emerald-300" />
            <div className="text-center">
              <span className="block font-black text-xs">CASH</span>
              <span className="text-[10px] font-bold opacity-80">ரொக்கம்</span>
            </div>
          </button>
          
          {/* GPAY / UPI BUTTON */}
          <button
            onClick={() => setMode('GPAY')}
            className={`p-3 rounded-2xl border font-black text-xs flex flex-col items-center gap-2 transition active:scale-95 ${
              mode === 'GPAY'
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg glow-blue'
                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Smartphone className="w-6 h-6 text-blue-300" />
            <div className="text-center">
              <span className="block font-black text-xs">GPAY / UPI</span>
              <span className="text-[10px] font-bold opacity-80">ஜிபே</span>
            </div>
          </button>

          {/* CREDIT BUTTON */}
          <button
            onClick={() => setMode('CREDIT')}
            className={`p-3 rounded-2xl border font-black text-xs flex flex-col items-center gap-2 transition active:scale-95 ${
              mode === 'CREDIT'
                ? 'bg-amber-600 border-amber-600 text-white shadow-lg'
                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
            }`}
          >
            <CreditCard className="w-6 h-6 text-amber-300" />
            <div className="text-center">
              <span className="block font-black text-xs">CREDIT</span>
              <span className="text-[10px] font-bold opacity-80">கடமை / DUES</span>
            </div>
          </button>

          {/* SPLIT PAYMENT BUTTON */}
          <button
            onClick={() => setMode('SPLIT')}
            className={`p-3 rounded-2xl border font-black text-xs flex flex-col items-center gap-2 transition active:scale-95 ${
              mode === 'SPLIT'
                ? 'bg-purple-600 border-purple-600 text-white shadow-lg'
                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Split className="w-6 h-6 text-purple-300" />
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
              Split Payment Breakdown Entry
            </span>
            <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Bill: ₹{totalAmount}
            </span>
          </h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="text-xs font-black text-emerald-700 flex items-center gap-1.5">
                <Banknote className="w-4 h-4" />
                Cash Received (ரொக்கம்)
              </span>
              <input
                type="number"
                value={cashReceived}
                onChange={(e) => handleCashChange(e.target.value)}
                className="w-28 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-right font-mono font-black text-slate-900 text-base focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="text-xs font-black text-blue-700 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4" />
                GPay Received (ஜிபே)
              </span>
              <input
                type="number"
                value={gpayReceived}
                onChange={(e) => setGpayReceived(e.target.value)}
                className="w-28 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-right font-mono font-black text-slate-900 text-base focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="text-xs font-black text-amber-700 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" />
                Credit Balance (கடமை)
              </span>
              <input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="w-28 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-right font-mono font-black text-slate-900 text-base focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-xs space-y-1 font-mono">
            <div className="flex justify-between text-slate-600 font-bold">
              <span>Cash Paid:</span>
              <span className="text-slate-900">₹{numCash}</span>
            </div>
            <div className="flex justify-between text-slate-600 font-bold">
              <span>GPay Paid:</span>
              <span className="text-slate-900">₹{numGpay}</span>
            </div>
            <div className="flex justify-between text-slate-600 font-bold">
              <span>Credit Due:</span>
              <span className="text-amber-700">₹{numCredit}</span>
            </div>
            <div className="flex justify-between text-slate-900 pt-1 font-black text-sm border-t border-slate-100">
              <span>Total Received</span>
              <span className="text-emerald-600">₹{totalReceived}</span>
            </div>
            <div className="flex justify-between text-slate-600 font-bold">
              <span>Balance Mismatch</span>
              <span className={balance === 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>
                ₹{balance}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Sticky Button */}
      <div className="fixed bottom-16 left-0 right-0 p-4 max-w-md mx-auto z-30">
        <button
          onClick={handleConfirm}
          className="touch-btn touch-btn-success w-full text-lg shadow-2xl glow-green flex items-center justify-center gap-2 uppercase tracking-wider font-black"
        >
          <CheckCircle2 className="w-6 h-6" />
          CONFIRM & PRINT BILL (பில் அச்சிடு)
        </button>
      </div>

    </div>
  );
};
