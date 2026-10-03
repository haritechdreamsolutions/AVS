import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Printer, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { printThermalReceipt } from '../../services/printerService';
import { toast } from 'sonner';

export const ThermalBillModal = ({ bill: initialBillProp, sale, onClose, onPrintComplete }) => {
  const initialBill = initialBillProp || sale;
  const { companyInfo, API_URL, apiFetch, shops } = useApp();
  const [bill, setBill] = useState(initialBill || {});
  const [items, setItems] = useState(initialBill?.items || []);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load canonical saved bill from backend if initial bill has missing item details
  useEffect(() => {
    const saleId = initialBill?.id || initialBill?.sale?.id || initialBill?.bill_no || initialBill?.sale?.bill_no;
    if (saleId && (!items || items.length === 0)) {
      setLoading(true);
      apiFetch(`${API_URL}/sales/${saleId}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.id) {
            setBill(data);
            setItems(data.items || []);
          }
        })
        .catch(err => {
          console.error("Error loading saved bill for thermal modal:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    } else if (initialBill) {
      setBill(initialBill.sale || initialBill);
      setItems(initialBill.items || initialBill.sale?.items || []);
    }
  }, [initialBill, API_URL]);

  const companyName = companyInfo?.name || 'AVS AGENCIES';
  const companyAddress = companyInfo?.address || 'No 71, Mailam Road, Kooteripattu';
  const companyPhone = companyInfo?.phone || '+91 9486334240';

  const totalQty = items.reduce((acc, it) => acc + (Math.floor(Number(it.qty)) || 0), 0);
  const totalAmount = Number(bill.total_amount || 0);
  const cashPaid = Number(bill.cash_paid || 0);
  const gpayPaid = Number(bill.gpay_paid || 0);
  const creditPaid = Number(bill.credit_paid || 0);
  const paymentMode = (bill.payment_mode || 'CASH').toUpperCase();

  // Match shop from master list
  const matchedShop = useMemo(() => {
    return (shops || []).find(s => 
      (bill.shop_id && String(s.id) === String(bill.shop_id)) || 
      (bill.shop_code && String(s.code).toLowerCase() === String(bill.shop_code).toLowerCase()) || 
      (bill.shop_name && String(s.name).toLowerCase() === String(bill.shop_name).toLowerCase())
    );
  }, [shops, bill]);

  const oldCreditPaid = Number(bill.old_credit_paid || 0);
  const thisBillCredit = paymentMode === 'CREDIT' ? totalAmount : (paymentMode === 'SPLIT' ? creditPaid : 0);

  const previousDue = useMemo(() => {
    if (bill.previous_due !== undefined && bill.previous_due !== null && !isNaN(Number(bill.previous_due))) {
      return Number(bill.previous_due);
    }
    if (bill.shop_previous_due !== undefined && bill.shop_previous_due !== null && !isNaN(Number(bill.shop_previous_due))) {
      return Number(bill.shop_previous_due);
    }
    if (matchedShop?.current_due !== undefined && matchedShop?.current_due !== null) {
      const currentShopDue = Number(matchedShop.current_due) || 0;
      return Math.max(0, currentShopDue - thisBillCredit + oldCreditPaid);
    }
    return Number(bill.shop_due ?? 0);
  }, [bill, matchedShop, thisBillCredit, oldCreditPaid]);

  const totalShopDue = bill.shop_current_due !== undefined && bill.shop_current_due !== null && !isNaN(Number(bill.shop_current_due))
    ? Number(bill.shop_current_due)
    : Math.max(0, previousDue - oldCreditPaid) + thisBillCredit;

  const grandTotal = totalAmount + previousDue;

  const formattedDate = () => {
    if (!bill.sale_date) {
      const d = new Date();
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    }
    if (typeof bill.sale_date === 'string' && bill.sale_date.includes('T')) {
      const d = new Date(bill.sale_date);
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    }
    return String(bill.sale_date);
  };

  const handleThermalPrint = async () => {
    if (isPrinting) return;

    try {
      setIsPrinting(true);
      setErrorMessage(null);
      setPrintSuccess(false);

      const receiptPayload = {
        ...bill,
        company_name: companyName,
        company_address: companyAddress,
        company_phone: companyPhone,
        items: items,
        total_quantity: totalQty,
        previous_due: previousDue,
        old_credit_paid: oldCreditPaid,
        shop_current_due: totalShopDue
      };

      toast.info("Connecting to EX58C Bluetooth Printer...");
      await printThermalReceipt(receiptPayload);

      setPrintSuccess(true);
      toast.success("Receipt printed successfully on EX58C!");

      // Allow 1.2s for user feedback then close modal and return to POS dashboard
      setTimeout(() => {
        if (onPrintComplete) {
          onPrintComplete();
        } else {
          onClose();
        }
      }, 1200);
    } catch (err) {
      console.error("Thermal Print Error:", err);
      if (err.name === 'NotFoundError' || err.message?.includes('User cancelled')) {
        setErrorMessage("Printer selection cancelled. Please select your EX58C printer to print.");
      } else {
        const userMsg = err.message || "EX58C printer not connected. Please turn on Bluetooth & printer and retry.";
        setErrorMessage(userMsg);
        toast.error(userMsg);
      }
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-sm sm:max-w-md w-full p-3.5 sm:p-5 space-y-3 sm:space-y-4 shadow-2xl my-auto max-h-[96dvh] flex flex-col overflow-hidden">
        
        {/* Header (Screen only) */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 sm:pb-3 no-print shrink-0">
          <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-2">
            <Printer className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            58mm Thermal Bill Receipt
          </h3>
          <button 
            onClick={onClose} 
            disabled={isPrinting}
            className="p-1 sm:p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Error Alert Banner if Print Fails */}
        {errorMessage && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-xs text-red-700 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Printer Notice</p>
              <p className="text-[11px] text-red-600 mt-0.5 leading-snug">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* 58mm Thermal Bill Scrollable Container */}
        <div className="printable-thermal-receipt printable-thermal bg-white p-3 sm:p-4 font-mono text-[10.5px] sm:text-[11px] border border-slate-300 rounded-2xl space-y-2 sm:space-y-2.5 text-slate-900 leading-tight overflow-y-auto flex-1">
          
          {/* Header */}
          <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-2">
            <h2 className="font-black text-base sm:text-lg uppercase tracking-wider text-slate-950 font-mono">{companyName}</h2>
            <p className="text-[10px] text-slate-700 font-bold">{companyAddress}</p>
            <p className="text-[10px] text-slate-700 font-bold">Ph: {companyPhone}</p>
          </div>

          {/* Bill Meta */}
          <div className="border-b border-dashed border-slate-400 pb-2 space-y-1 text-[10px] sm:text-[10.5px]">
            <div className="flex justify-between font-extrabold">
              <span>Bill No: <strong className="text-blue-700 font-black">{bill.bill_no || 'INV-000000'}</strong></span>
              <span>{formattedDate()}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span className="truncate max-w-[150px] sm:max-w-[170px]">Shop: <strong>{bill.shop_name || 'Customer'}</strong></span>
              <span>{bill.sale_time || ''}</span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-600 font-bold">
              <span>Code: <strong>{bill.shop_code || 'SHP-001'}</strong></span>
              <span>Emp: <strong>{bill.employee_name || 'Driver'}</strong></span>
            </div>
            {bill.vehicle_no && (
              <div className="text-[10px] text-slate-500 font-bold">
                <span>Veh: <strong>{bill.vehicle_no}</strong></span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="space-y-1">
            <div className="flex justify-between font-black border-b border-slate-400 pb-1 text-[10px] uppercase text-slate-800">
              <span className="w-5/12 text-left">ITEM</span>
              <span className="w-2/12 text-center">QTY</span>
              <span className="w-2/12 text-right">RATE</span>
              <span className="w-3/12 text-right">AMT</span>
            </div>

            <div className="divide-y divide-slate-200">
              {items.length === 0 ? (
                <div className="py-2 text-center text-slate-400 text-[10px]">No items in this bill</div>
              ) : (
                items.map((item, idx) => {
                  const qty = Math.floor(Number(item.qty || 1));
                  const rate = Number(item.rate || 0);
                  const amount = Number(item.amount || (qty * rate));

                  return (
                    <div key={idx} className="py-1 flex justify-between items-start text-[10px]">
                      <span className="w-5/12 text-left pr-1 font-bold text-slate-900 leading-snug break-words">
                        {item.product_name}
                      </span>
                      <span className="w-2/12 text-center font-bold font-mono">
                        {qty} {item.unit_type ? (item.unit_type === 'Piece' ? 'Pcs' : item.unit_type) : ''}
                      </span>
                      <span className="w-2/12 text-right font-mono text-slate-700">
                        ₹{rate.toFixed(2)}
                      </span>
                      <span className="w-3/12 text-right font-black font-mono text-slate-900">
                        ₹{amount.toFixed(2)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Totals Section */}
          <div className="border-t border-b border-dashed border-slate-400 py-1.5 space-y-1">
            <div className="flex justify-between font-black text-xs sm:text-sm pt-0.5 text-slate-900">
              <span>BILL TOTAL:</span>
              <span className="text-emerald-700">₹{totalAmount.toFixed(2)}</span>
            </div>
            {previousDue > 0 && (
              <>
                <div className="flex justify-between font-bold text-[10px] text-amber-700 pt-0.5">
                  <span>OLD CREDIT (பழைய கடன்):</span>
                  <span className="font-mono">₹{previousDue.toFixed(2)}</span>
                </div>
                {oldCreditPaid > 0 && (
                  <div className="flex justify-between font-bold text-[10px] text-emerald-700 pt-0.5">
                    <span>OLD CREDIT PAID (செலுத்தியது):</span>
                    <span className="font-mono">₹{oldCreditPaid.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-xs sm:text-sm text-slate-950 pt-0.5 border-t border-slate-300">
                  <span>NET GRAND TOTAL:</span>
                  <span className="font-mono text-purple-700">
                    ₹{grandTotal.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Payment Section */}
          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between font-extrabold text-purple-800">
              <span>MODE:</span>
              <span>{paymentMode}</span>
            </div>

            {paymentMode === 'SPLIT' ? (
              <div className="space-y-0.5 text-slate-700 pt-0.5">
                {cashPaid > 0 && (
                  <div className="flex justify-between">
                    <span>Cash Received:</span>
                    <span className="font-bold font-mono">₹{cashPaid.toFixed(2)}</span>
                  </div>
                )}
                {gpayPaid > 0 && (
                  <div className="flex justify-between">
                    <span>GPay / UPI Received:</span>
                    <span className="font-bold font-mono">₹{gpayPaid.toFixed(2)}</span>
                  </div>
                )}
                {creditPaid > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Credit on this Bill:</span>
                    <span className="font-bold font-mono">₹{creditPaid.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-0.5 border-t border-slate-200 text-slate-900">
                  <span>Paid on this Bill:</span>
                  <span className="font-mono">₹{(cashPaid + gpayPaid).toFixed(2)}</span>
                </div>
              </div>
            ) : paymentMode === 'CASH' ? (
              <div className="flex justify-between text-slate-700 font-bold">
                <span>Cash Received:</span>
                <span className="font-mono text-emerald-700 font-black">₹{(cashPaid > 0 ? cashPaid : (totalAmount + oldCreditPaid)).toFixed(2)}</span>
              </div>
            ) : paymentMode === 'GPAY' ? (
              <div className="flex justify-between text-slate-700 font-bold">
                <span>GPay / UPI Received:</span>
                <span className="font-mono text-blue-700 font-black">₹{(gpayPaid > 0 ? gpayPaid : (totalAmount + oldCreditPaid)).toFixed(2)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-amber-700 font-bold">
                <span>Credit on this Bill:</span>
                <span className="font-mono font-black">₹{totalAmount.toFixed(2)}</span>
              </div>
            )}

            {/* Total Shop Due Balance */}
            <div className="flex justify-between font-black text-[10.5px] pt-1 border-t border-dashed border-slate-300">
              <span className={totalShopDue > 0 ? 'text-amber-800' : 'text-emerald-700'}>
                SHOP BALANCE (கடை பாக்கி):
              </span>
              <span className={`font-mono ${totalShopDue > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                ₹{totalShopDue.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center border-t border-dashed border-slate-400 pt-1.5 space-y-0.5">
            <p className="font-bold text-[10px]">Thank You! Visit Again</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold">{companyName}</p>
          </div>

        </div>

        {/* Print & Close Actions */}
        <div className="space-y-2 no-print shrink-0 pt-1">
          {/* SINGLE PRIMARY DIRECT PRINT BUTTON */}
          <button
            type="button"
            onClick={handleThermalPrint}
            disabled={isPrinting}
            className={`w-full text-xs sm:text-sm font-black rounded-2xl py-3.5 flex items-center justify-center gap-2 shadow-md min-h-[48px] cursor-pointer transition active:scale-[0.98] ${
              printSuccess
                ? 'bg-emerald-600 text-white'
                : isPrinting
                ? 'bg-amber-600 text-white cursor-wait'
                : errorMessage
                ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white'
            }`}
          >
            {isPrinting ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-white" />
                <span>⏳ PRINTING... (அச்சிடப்படுகிறது...)</span>
              </>
            ) : printSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                <span>✓ PRINTED (அச்சிடப்பட்டது)</span>
              </>
            ) : errorMessage ? (
              <>
                <Printer className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                <span>⚠️ RETRY PRINT BILL (மீண்டும் அச்சிடு)</span>
              </>
            ) : (
              <>
                <Printer className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                <span>🖨️ PRINT BILL (பில் அச்சிடு - EX58C)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isPrinting}
            className="w-full text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl py-2.5 flex items-center justify-center gap-2 border border-slate-300 min-h-[40px] cursor-pointer transition active:scale-[0.98] disabled:opacity-50"
          >
            <span>CLOSE (மூடு)</span>
          </button>
        </div>

      </div>
    </div>
  );
};
