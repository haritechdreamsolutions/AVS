import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Printer, ArrowRight, Check, Bluetooth, Store, Calendar, Clock, User, Truck, Receipt, CheckCircle2 } from 'lucide-react';
import { printBillViaBluetooth } from '../../utils/bluetoothPrinter';
import { toast } from 'sonner';

export const BillSummary = ({ billResult, onDone }) => {
  const { companyInfo, currentUser, API_URL, apiFetch } = useApp();
  const [bill, setBill] = useState(billResult?.sale || billResult || {});
  const [items, setItems] = useState(billResult?.items || billResult?.sale?.items || []);
  const [loading, setLoading] = useState(false);
  const [printingBluetooth, setPrintingBluetooth] = useState(false);

  // If billResult only has sale ID or if items are missing, fetch the canonical saved bill from backend
  useEffect(() => {
    const saleId = billResult?.sale?.id || billResult?.id || billResult?.sale?.bill_no || billResult?.bill_no;
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
          console.error("Failed to load saved bill details:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [billResult, API_URL]);

  const companyName = companyInfo?.name || 'AVS AGENCIES';
  const companySubtitle = 'Agencies Management System';
  const companyAddress = companyInfo?.address || 'Main Road, Salem, Tamil Nadu';
  const companyPhone = companyInfo?.phone || '+91 98765 43210';

  const totalQty = items.reduce((acc, it) => acc + (Math.floor(Number(it.qty)) || 0), 0);
  const totalAmount = Number(bill.total_amount || 0);
  const cashPaid = Number(bill.cash_paid || 0);
  const gpayPaid = Number(bill.gpay_paid || 0);
  const creditPaid = Number(bill.credit_paid || 0);
  const paymentMode = (bill.payment_mode || 'CASH').toUpperCase();

  const handleSystemPrint = () => {
    window.print();
  };

  const handleBluetoothPrint = async () => {
    try {
      setPrintingBluetooth(true);
      toast.info("Scanning for Bluetooth Thermal Printers...");
      await printBillViaBluetooth({
        ...bill,
        company_name: companyName,
        company_subtitle: companySubtitle,
        items: items
      });
      toast.success("Bill printed successfully via Bluetooth!");
    } catch (err) {
      console.error("Bluetooth print error:", err);
      toast.error("Bluetooth Print Notice: " + (err.message || "Failed to connect to Bluetooth printer"));
    } finally {
      setPrintingBluetooth(false);
    }
  };

  // Format date helper (YYYY-MM-DD or DD-MM-YYYY)
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

  return (
    <div className="max-w-md mx-auto p-3 sm:p-4 space-y-4 pb-32 sm:pb-36">
      
      {/* Success Notification Header (Screen only) */}
      <div className="text-center space-y-1 no-print">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs animate-bounce">
          <Check className="w-6 h-6 stroke-[3]" />
        </div>
        <h2 className="text-lg font-black text-slate-900">BILL CREATED SUCCESSFULLY</h2>
        <p className="text-xs text-slate-500 font-bold">Bill #{bill.bill_no || 'N/A'} is finalized & saved</p>
      </div>

      {/* 58mm Thermal Printable Container & On-Screen Receipt Preview */}
      <div className="printable-thermal-receipt bg-white border border-slate-300 rounded-3xl p-4 sm:p-5 shadow-md font-mono text-[11px] text-slate-900 leading-tight space-y-3">
        
        {/* Company Header */}
        <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-2">
          <h2 className="font-black text-base uppercase tracking-wider text-slate-900">{companyName}</h2>
          <p className="text-[10px] text-slate-600 font-bold">{companySubtitle}</p>
          <p className="text-[9px] text-slate-500">{companyAddress} | {companyPhone}</p>
        </div>

        {/* Bill & Shop Meta Details */}
        <div className="space-y-1 text-[11px] border-b border-dashed border-slate-400 pb-2">
          <div className="flex justify-between font-extrabold">
            <span>Bill No: <strong className="text-blue-700 font-black">{bill.bill_no || 'INV-000000'}</strong></span>
            <span>{formattedDate()}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span className="truncate max-w-[180px]">Shop: <strong>{bill.shop_name || 'Customer'}</strong></span>
            <span>{bill.sale_time || ''}</span>
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 font-bold">
            <span>Code: <strong>{bill.shop_code || 'SHP-001'}</strong></span>
            <span>Emp: <strong>{bill.employee_name || currentUser?.name || 'Driver'}</strong></span>
          </div>
          {bill.vehicle_no && (
            <div className="text-[10px] text-slate-500">
              <span>Veh: <strong>{bill.vehicle_no}</strong></span>
            </div>
          )}
        </div>

        {/* Billed Items Table (ITEM, QTY, RATE, AMT) */}
        <div className="space-y-1 pt-0.5">
          <div className="flex justify-between font-black border-b border-slate-400 pb-1 text-[10px] uppercase text-slate-800">
            <span className="w-5/12 text-left">ITEM</span>
            <span className="w-2/12 text-center">QTY</span>
            <span className="w-2/12 text-right">RATE</span>
            <span className="w-3/12 text-right">AMT</span>
          </div>

          <div className="divide-y divide-slate-200">
            {items.map((item, idx) => {
              const qty = Math.floor(Number(item.qty || 1));
              const rate = Number(item.rate || 0);
              const amount = Number(item.amount || (qty * rate));

              return (
                <div key={idx} className="py-1.5 flex justify-between items-start text-[10.5px]">
                  <div className="w-5/12 text-left pr-1 font-bold text-slate-900 leading-snug break-words">
                    {item.product_name}
                  </div>
                  <div className="w-2/12 text-center font-bold font-mono">
                    {qty} {item.unit_type ? (item.unit_type === 'Piece' ? 'Pcs' : item.unit_type) : ''}
                  </div>
                  <div className="w-2/12 text-right font-mono text-slate-700">
                    ₹{rate.toFixed(2)}
                  </div>
                  <div className="w-3/12 text-right font-black font-mono text-slate-900">
                    ₹{amount.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Totals Section */}
        <div className="border-t border-b border-dashed border-slate-400 py-1.5 space-y-1">
          <div className="flex justify-between font-bold text-[11px]">
            <span>TOTAL ITEMS:</span>
            <span>{items.length}</span>
          </div>
          <div className="flex justify-between font-bold text-[11px]">
            <span>TOTAL QTY:</span>
            <span>{totalQty}</span>
          </div>
          <div className="flex justify-between font-black text-sm pt-0.5 text-slate-900 border-t border-slate-200">
            <span>TOTAL:</span>
            <span className="text-emerald-700">₹{totalAmount.toFixed(2)}</span>
          </div>
          {Number(bill.previous_due ?? bill.shop_previous_due ?? bill.shop_due ?? 0) > 0 && (
            <>
              <div className="flex justify-between font-bold text-[10.5px] text-amber-700 pt-0.5">
                <span>PREVIOUS CREDIT:</span>
                <span className="font-mono">₹{Number(bill.previous_due ?? bill.shop_previous_due ?? bill.shop_due ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-sm text-slate-950 pt-0.5 border-t border-slate-300">
                <span>NET GRAND TOTAL:</span>
                <span className="font-mono text-purple-700">
                  ₹{(totalAmount + Number(bill.previous_due ?? bill.shop_previous_due ?? bill.shop_due ?? 0)).toFixed(2)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Payment Summary Section */}
        <div className="space-y-1 text-[10.5px]">
          <div className="flex justify-between font-extrabold text-purple-800">
            <span>MODE:</span>
            <span>{paymentMode}</span>
          </div>

          {paymentMode === 'SPLIT' ? (
            <div className="space-y-0.5 text-slate-700 pt-0.5">
              {cashPaid > 0 && (
                <div className="flex justify-between">
                  <span>Cash Received:</span>
                  <span className="font-bold">₹{cashPaid.toFixed(2)}</span>
                </div>
              )}
              {gpayPaid > 0 && (
                <div className="flex justify-between">
                  <span>GPay / UPI:</span>
                  <span className="font-bold">₹{gpayPaid.toFixed(2)}</span>
                </div>
              )}
              {creditPaid > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Credit Due:</span>
                  <span className="font-bold">₹{creditPaid.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold pt-0.5 border-t border-slate-200 text-slate-900">
                <span>Total Accounted:</span>
                <span>₹{(cashPaid + gpayPaid + creditPaid).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700">
                <span>Balance:</span>
                <span>₹0.00</span>
              </div>
            </div>
          ) : paymentMode === 'CASH' ? (
            <div className="flex justify-between text-slate-700 font-bold">
              <span>Cash Received:</span>
              <span className="font-mono text-emerald-700 font-black">₹{totalAmount.toFixed(2)}</span>
            </div>
          ) : paymentMode === 'GPAY' ? (
            <div className="flex justify-between text-slate-700 font-bold">
              <span>GPay / UPI Received:</span>
              <span className="font-mono text-blue-700 font-black">₹{totalAmount.toFixed(2)}</span>
            </div>
          ) : (
            <div className="flex justify-between text-slate-700 font-bold">
              <span>Credit Due:</span>
              <span className="font-mono text-amber-700 font-black">₹{totalAmount.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center border-t border-dashed border-slate-400 pt-2 space-y-0.5">
          <p className="font-bold text-[10px]">Thank You! Visit Again</p>
          <p className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold">{companyName}</p>
        </div>

      </div>

      {/* Screen Action Buttons (Print & Done) in Document Flow */}
      <div className="space-y-2.5 no-print pt-1">
        
        {/* Standard / USB 58mm Thermal Print */}
        <button
          onClick={handleSystemPrint}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-md transition active:scale-[0.98] min-h-[48px] cursor-pointer"
        >
          <Printer className="w-4 h-4 text-white" />
          <span>🖨️ PRINT BILL (பில் அச்சிடு)</span>
        </button>

        {/* Done / Return to Home */}
        <button
          onClick={onDone}
          className="w-full py-3 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-[0.98] min-h-[44px] border border-slate-300 cursor-pointer"
        >
          <span>DONE (முடிந்தது)</span>
          <ArrowRight className="w-4 h-4" />
        </button>

      </div>

    </div>
  );
};
