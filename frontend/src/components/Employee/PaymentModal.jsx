import React, { useState, useEffect } from 'react';
import { ArrowLeft, Banknote, Smartphone, CreditCard, Split, CheckCircle2, DollarSign, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export const PaymentModal = ({ billData, onConfirmBill, onBack }) => {
  const [mode, setMode] = useState('SPLIT');
  const [splitOption, setSplitOption] = useState('CASH_GPAY'); // 'CASH_GPAY', 'CASH_CREDIT', 'GPAY_CREDIT'
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const totalBillAmount = Number(Number(billData?.total_amount || 0).toFixed(2));
  const previousDue = Number(Number(billData?.previous_due || 0).toFixed(2));
  const [includeOldCredit, setIncludeOldCredit] = useState(false);

  // Total payable depends on whether old credit is included
  const payableAmount = Number((includeOldCredit ? totalBillAmount + previousDue : totalBillAmount).toFixed(2));

  // Dynamic SPLIT state (Defaults to full payable amount in primary input; user changes it and remaining auto-updates in secondary box)
  const [cashReceived, setCashReceived] = useState(payableAmount.toString());
  const [gpayReceived, setGpayReceived] = useState(payableAmount.toString());

  // Default to full payable amount whenever payableAmount or splitOption changes
  useEffect(() => {
    if (splitOption === 'CASH_GPAY' || splitOption === 'CASH_CREDIT') {
      setCashReceived(payableAmount.toString());
      setGpayReceived('');
    } else if (splitOption === 'GPAY_CREDIT') {
      setGpayReceived(payableAmount.toString());
      setCashReceived('');
    }
  }, [payableAmount, splitOption]);

  // Compute clean numeric values based on mode & splitOption
  let numCash = 0;
  let numGpay = 0;
  let numCredit = 0;

  if (mode === 'CASH') {
    numCash = payableAmount;
  } else if (mode === 'GPAY') {
    numGpay = payableAmount;
  } else if (mode === 'CREDIT') {
    numCredit = totalBillAmount;
  } else if (mode === 'SPLIT') {
    if (splitOption === 'CASH_GPAY') {
      const parsedCash = cashReceived === '' ? 0 : Math.min(payableAmount, Math.max(0, parseFloat(cashReceived) || 0));
      numCash = parsedCash;
      numGpay = Number(Math.max(0, payableAmount - parsedCash).toFixed(2));
      numCredit = 0;
    } else if (splitOption === 'CASH_CREDIT') {
      const parsedCash = cashReceived === '' ? 0 : Math.min(payableAmount, Math.max(0, parseFloat(cashReceived) || 0));
      numCash = parsedCash;
      numCredit = Number(Math.max(0, payableAmount - parsedCash).toFixed(2));
      numGpay = 0;
    } else if (splitOption === 'GPAY_CREDIT') {
      const parsedGpay = gpayReceived === '' ? 0 : Math.min(payableAmount, Math.max(0, parseFloat(gpayReceived) || 0));
      numGpay = parsedGpay;
      numCredit = Number(Math.max(0, payableAmount - parsedGpay).toFixed(2));
      numCash = 0;
    }
  }

  const totalReceived = Number((numCash + numGpay + numCredit).toFixed(2));
  const balance = Number(Math.max(0, payableAmount - totalReceived).toFixed(2));

  // Smart Handlers when typing
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
    if (numericVal > payableAmount) {
      toast.error(`ரொக்கத் தொகை மொத்த தொகையை (₹${payableAmount.toFixed(2)}) விட அதிகமாக இருக்க முடியாது!`);
      setCashReceived(payableAmount.toString());
      return;
    }
    setCashReceived(val);
  };

  const handleGpayChange = (val) => {
    if (val === '' || val === null || val === undefined) {
      setGpayReceived('');
      return;
    }
    const numericVal = parseFloat(val);
    if (isNaN(numericVal) || numericVal < 0) {
      setGpayReceived('');
      return;
    }
    if (numericVal > payableAmount) {
      toast.error(`ஜிபே தொகை மொத்த தொகையை (₹${payableAmount.toFixed(2)}) விட அதிகமாக இருக்க முடியாது!`);
      setGpayReceived(payableAmount.toString());
      return;
    }
    setGpayReceived(val);
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    if (balance !== 0 && mode !== 'CREDIT') {
      toast.error(`பணம் தவறாக உள்ளது! பாக்கி: ₹${balance.toFixed(2)}`);
      return;
    }

    try {
      setIsSubmitting(true);
      const oldCreditPaid = includeOldCredit ? previousDue : 0;
      await onConfirmBill({
        ...billData,
        shop_id: billData?.shop_id,
        shop_name: billData?.shop_name,
        shop_code: billData?.shop_code,
        previous_due: previousDue,
        old_credit_paid: oldCreditPaid,
        clear_previous_due: includeOldCredit,
        total_amount: totalBillAmount,
        payable_amount: payableAmount,
        payment_mode: mode,
        cash_paid: mode === 'CASH' ? payableAmount : (mode === 'SPLIT' ? numCash : 0),
        gpay_paid: mode === 'GPAY' ? payableAmount : (mode === 'SPLIT' ? numGpay : 0),
        credit_paid: mode === 'CREDIT' ? totalBillAmount : (mode === 'SPLIT' ? numCredit : 0),
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
        <span className="text-xs text-slate-500 uppercase font-extrabold tracking-wider">
          {includeOldCredit ? 'Total Payable (மொத்தம் செலுத்த வேண்டியது)' : 'Total Bill Amount (பில் தொகை)'}
        </span>
        <div className="font-mono font-black text-3xl sm:text-4xl text-emerald-600 mt-1">
          ₹{payableAmount.toFixed(2)}
        </div>
        {includeOldCredit && (
          <div className="text-[11px] font-bold text-slate-500 mt-1 flex items-center justify-center gap-2">
            <span>பில்: ₹{totalBillAmount.toFixed(2)}</span>
            <span>+</span>
            <span className="text-amber-700 font-extrabold">பழைய கடன்: ₹{previousDue.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Old Credit Due Selection Banner (Only if shop has outstanding credit) */}
      {previousDue > 0 && (
        <div className="p-3 bg-gradient-to-r from-amber-50/90 to-orange-50/90 border-2 border-amber-300 rounded-2xl space-y-2 shadow-xs">
          <div className="flex justify-between items-center text-xs">
            <span className="font-black text-amber-900 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              OLD CREDIT (பழைய பாக்கி கடன்):
            </span>
            <span className="font-mono font-black text-amber-800 text-sm">₹{previousDue.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setIncludeOldCredit(false)}
              className={`py-2.5 px-2 rounded-xl text-xs font-black transition cursor-pointer text-center ${
                !includeOldCredit
                  ? 'bg-white text-slate-900 border-2 border-slate-800 shadow-sm'
                  : 'bg-white/60 text-slate-600 hover:bg-white border border-slate-200'
              }`}
            >
              <div>பில் மட்டும்</div>
              <div className="text-[10px] font-mono text-slate-500 font-bold">₹{totalBillAmount.toFixed(2)}</div>
            </button>

            <button
              type="button"
              onClick={() => setIncludeOldCredit(true)}
              className={`py-2.5 px-2 rounded-xl text-xs font-black transition cursor-pointer text-center ${
                includeOldCredit
                  ? 'bg-emerald-600 text-white shadow-md glow-green border-2 border-emerald-600'
                  : 'bg-white/70 text-amber-900 hover:bg-white border border-amber-300'
              }`}
            >
              <div>⚡ கடன் சேர்த்து செலுத்து</div>
              <div className={`text-[10px] font-mono font-bold ${includeOldCredit ? 'text-emerald-100' : 'text-amber-700'}`}>
                ₹{(totalBillAmount + previousDue).toFixed(2)}
              </div>
            </button>
          </div>
        </div>
      )}

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
            onClick={() => {
              setIncludeOldCredit(false);
              setMode('CREDIT');
            }}
            className={`p-3 rounded-2xl border font-black text-xs flex flex-col items-center gap-2 transition active:scale-95 cursor-pointer ${
              mode === 'CREDIT'
                ? 'bg-amber-600 border-amber-600 text-white shadow-lg'
                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
            }`}
          >
            <CreditCard className={`w-6 h-6 ${mode === 'CREDIT' ? 'text-white' : 'text-amber-600'}`} />
            <div className="text-center">
              <span className="block font-black text-xs">CREDIT</span>
              <span className="text-[10px] font-bold opacity-80">முழு கடன்</span>
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
        <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200 space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-extrabold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Split className="w-4 h-4 text-purple-600" />
              Split Payment Breakdown
            </span>
            <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Payable: ₹{payableAmount.toFixed(2)}
            </span>
          </div>

          {/* Split Mode Sub-Options Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setSplitOption('CASH_GPAY')}
              className={`py-2 px-1 rounded-lg text-[11px] font-black transition text-center cursor-pointer ${
                splitOption === 'CASH_GPAY'
                  ? 'bg-white text-purple-700 shadow-xs border border-purple-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              💵 Cash + 📱 GPay
            </button>
            <button
              type="button"
              onClick={() => setSplitOption('CASH_CREDIT')}
              className={`py-2 px-1 rounded-lg text-[11px] font-black transition text-center cursor-pointer ${
                splitOption === 'CASH_CREDIT'
                  ? 'bg-white text-amber-700 shadow-xs border border-amber-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              💵 Cash + 💳 Credit
            </button>
            <button
              type="button"
              onClick={() => setSplitOption('GPAY_CREDIT')}
              className={`py-2 px-1 rounded-lg text-[11px] font-black transition text-center cursor-pointer ${
                splitOption === 'GPAY_CREDIT'
                  ? 'bg-white text-blue-700 shadow-xs border border-blue-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📱 GPay + 💳 Credit
            </button>
          </div>

          <div className="space-y-2.5">
            {/* 1. Cash + GPay */}
            {splitOption === 'CASH_GPAY' && (
              <>
                {/* Cash Input */}
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
                      max={payableAmount}
                      value={cashReceived}
                      placeholder="0.00"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleCashChange(e.target.value)}
                      className="w-24 sm:w-28 bg-white border border-slate-300 rounded-lg px-2 py-1 text-right font-mono font-black text-slate-900 text-sm sm:text-base focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 shadow-xs"
                    />
                  </div>
                </div>

                {/* GPay Auto */}
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
              </>
            )}

            {/* 2. Cash + Credit */}
            {splitOption === 'CASH_CREDIT' && (
              <>
                {/* Cash Input */}
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
                      max={payableAmount}
                      value={cashReceived}
                      placeholder="0.00"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleCashChange(e.target.value)}
                      className="w-24 sm:w-28 bg-white border border-slate-300 rounded-lg px-2 py-1 text-right font-mono font-black text-slate-900 text-sm sm:text-base focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 shadow-xs"
                    />
                  </div>
                </div>

                {/* Credit Auto */}
                <div className="flex items-center justify-between bg-amber-50/70 p-2.5 sm:p-3 rounded-xl border border-amber-200">
                  <div className="min-w-0">
                    <span className="text-xs font-black text-amber-800 flex items-center gap-1.5 truncate">
                      <CreditCard className="w-4 h-4 shrink-0 text-amber-600" />
                      Credit Amount (மீதி கடன்)
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 block pl-5.5">
                      Auto-added to shop dues
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-mono">
                      CREDIT
                    </span>
                    <div className="w-24 sm:w-28 bg-white border border-amber-300 rounded-lg px-2 py-1 text-right font-mono font-black text-amber-700 text-sm sm:text-base select-none">
                      ₹{numCredit.toFixed(2)}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 3. GPay + Credit */}
            {splitOption === 'GPAY_CREDIT' && (
              <>
                {/* GPay Input */}
                <div className="flex items-center justify-between bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200">
                  <div className="min-w-0">
                    <span className="text-xs font-black text-blue-700 flex items-center gap-1.5 truncate">
                      <Smartphone className="w-4 h-4 shrink-0" />
                      GPay / UPI Received (ஜிபே)
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 block pl-5.5">
                      Type online amount received
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 font-mono font-black text-sm">₹</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      max={payableAmount}
                      value={gpayReceived}
                      placeholder="0.00"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleGpayChange(e.target.value)}
                      className="w-24 sm:w-28 bg-white border border-slate-300 rounded-lg px-2 py-1 text-right font-mono font-black text-slate-900 text-sm sm:text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-xs"
                    />
                  </div>
                </div>

                {/* Credit Auto */}
                <div className="flex items-center justify-between bg-amber-50/70 p-2.5 sm:p-3 rounded-xl border border-amber-200">
                  <div className="min-w-0">
                    <span className="text-xs font-black text-amber-800 flex items-center gap-1.5 truncate">
                      <CreditCard className="w-4 h-4 shrink-0 text-amber-600" />
                      Credit Amount (மீதி கடன்)
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 block pl-5.5">
                      Auto-added to shop dues
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-mono">
                      CREDIT
                    </span>
                    <div className="w-24 sm:w-28 bg-white border border-amber-300 rounded-lg px-2 py-1 text-right font-mono font-black text-amber-700 text-sm sm:text-base select-none">
                      ₹{numCredit.toFixed(2)}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Breakdown Summary */}
          <div className="pt-2 border-t border-slate-100 text-xs space-y-1.5 font-mono">
            <div className="flex justify-between text-slate-600 font-bold">
              <span>Bill Amount:</span>
              <span className="text-slate-900 font-black">₹{totalBillAmount.toFixed(2)}</span>
            </div>
            {includeOldCredit && (
              <div className="flex justify-between text-amber-800 font-bold">
                <span>Old Credit:</span>
                <span className="font-black">₹{previousDue.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-purple-900 font-black pt-0.5 border-t border-dashed border-slate-200">
              <span>Total Payable:</span>
              <span>₹{payableAmount.toFixed(2)}</span>
            </div>
            {numCash > 0 && (
              <div className="flex justify-between text-slate-600 font-bold">
                <span>Cash:</span>
                <span className="text-emerald-700 font-bold">₹{numCash.toFixed(2)}</span>
              </div>
            )}
            {numGpay > 0 && (
              <div className="flex justify-between text-slate-600 font-bold">
                <span>GPay / UPI:</span>
                <span className="text-blue-700 font-bold">₹{numGpay.toFixed(2)}</span>
              </div>
            )}
            {numCredit > 0 && (
              <div className="flex justify-between text-amber-700 font-bold">
                <span>Credit Due:</span>
                <span className="text-amber-700 font-black">₹{numCredit.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-900 pt-1 font-black text-sm border-t border-slate-200">
              <span>Total Accounted:</span>
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
