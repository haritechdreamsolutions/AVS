import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Printer, X, Bluetooth, CheckCircle2 } from 'lucide-react';
import { printBillViaBluetooth } from '../../utils/bluetoothPrinter';
import { toast } from 'sonner';

export const ThermalBillModal = ({ bill: initialBill, onClose }) => {
  const { companyInfo, API_URL, apiFetch } = useApp();
  const [bill, setBill] = useState(initialBill || {});
  const [items, setItems] = useState(initialBill?.items || []);
  const [printingBluetooth, setPrintingBluetooth] = useState(false);
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
  const companySubtitle = 'Agencies Management System';
  const companyAddress = companyInfo?.address || 'Salem, Tamil Nadu';
  const companyPhone = companyInfo?.phone || '+91 98765 43210';

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

  const totalQty = items.reduce((acc, it) => acc + (Math.floor(Number(it.qty)) || 0), 0);
  const totalAmount = Number(bill.total_amount || 0);
  const cashPaid = Number(bill.cash_paid || 0);
  const gpayPaid = Number(bill.gpay_paid || 0);
  const creditPaid = Number(bill.credit_paid || 0);
  const paymentMode = (bill.payment_mode || 'CASH').toUpperCase();

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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-4 sm:p-5 space-y-4 shadow-2xl my-auto max-h-[92dvh] overflow-y-auto">
        
        {/* Header (Screen only) */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 no-print">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            58mm Thermal Bill Receipt
          </h3>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 58mm Thermal Bill Container */}
        <div className="printable-thermal-receipt printable-thermal bg-white p-3.5 sm:p-4 font-mono text-[11px] border border-slate-300 rounded-2xl space-y-2.5 text-slate-900 leading-tight">
          
          {/* Header */}
          <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-2">
            <h2 className="font-black text-sm sm:text-base uppercase tracking-wider text-slate-900">{companyName}</h2>
            <p className="text-[10px] text-slate-600 font-bold">{companySubtitle}</p>
            <p className="text-[9px] text-slate-500">{companyAddress} | {companyPhone}</p>
          </div>

          {/* Bill Meta */}
          <div className="border-b border-dashed border-slate-400 pb-2 space-y-1 text-[10.5px]">
            <div className="flex justify-between font-extrabold">
              <span>Bill No: <strong className="text-blue-700 font-black">{bill.bill_no || 'INV-000000'}</strong></span>
              <span>{formattedDate()}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span className="truncate max-w-[160px]">Shop: <strong>{bill.shop_name || 'Customer'}</strong></span>
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

          {/* Items Table (ONLY selected items, showing ITEM, QTY, RATE, AMT) */}
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
            <div className="flex justify-between font-bold text-[10.5px]">
              <span>TOTAL ITEMS:</span>
              <span>{items.length}</span>
            </div>
            <div className="flex justify-between font-bold text-[10.5px]">
              <span>TOTAL QTY:</span>
              <span>{totalQty}</span>
            </div>
            <div className="flex justify-between font-black text-sm pt-0.5 text-slate-900 border-t border-slate-200">
              <span>TOTAL:</span>
              <span className="text-emerald-700">₹{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Section */}
          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between font-extrabold text-purple-800">
              <span>MODE:</span>
              <span>{paymentMode}</span>
            </div>

            {paymentMode === 'SPLIT' ? (
              <div className="space-y-0.5 text-slate-700 pt-0.5">
                <div className="flex justify-between">
                  <span>Cash Received:</span>
                  <span className="font-bold">₹{cashPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GPay / UPI:</span>
                  <span className="font-bold">₹{gpayPaid.toFixed(2)}</span>
                </div>
                {creditPaid > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Credit Due:</span>
                    <span className="font-bold">₹{creditPaid.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-0.5 border-t border-slate-200 text-slate-900">
                  <span>Total Paid:</span>
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
          <div className="text-center border-t border-dashed border-slate-400 pt-1.5 space-y-0.5">
            <p className="font-bold text-[10px]">Thank You! Visit Again</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold">{companyName}</p>
          </div>

        </div>

        {/* Dual Print Action Buttons */}
        <div className="space-y-2 no-print">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-2 text-[10px] text-blue-800 font-bold flex items-center gap-1.5">
            <span>💡</span>
            <span>ப்ளூடூத் பிரிண்ட் செய்ய போனில் <strong>Location (GPS) & Bluetooth</strong> ஆன் செய்து வைக்கவும்.</span>
          </div>

          <button
            onClick={handleBluetoothPrint}
            disabled={printingBluetooth}
            className="touch-btn touch-btn-primary w-full text-xs font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center gap-2 py-3 rounded-2xl shadow-md min-h-[46px] cursor-pointer"
          >
            <Bluetooth className="w-5 h-5 text-cyan-300 animate-pulse" />
            <span>{printingBluetooth ? 'PAIRING & PRINTING...' : '📲 PRINT VIA BLUETOOTH (ப்ளூடூத்)'}</span>
          </button>

          <button
            onClick={handleSystemPrint}
            className="w-full text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl py-3 flex items-center justify-center gap-2 border border-slate-300 min-h-[44px] cursor-pointer transition active:scale-[0.98]"
          >
            <Printer className="w-4 h-4 text-slate-700" />
            <span>🖨️ SYSTEM / 58MM THERMAL PRINT</span>
          </button>
        </div>

      </div>
    </div>
  );
};
