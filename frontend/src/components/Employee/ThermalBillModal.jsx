import React, { useState } from 'react';
import { Printer, X, CheckCircle2, Bluetooth, Smartphone } from 'lucide-react';
import { printBillViaBluetooth } from '../../utils/bluetoothPrinter';
import { toast } from 'sonner';

export const ThermalBillModal = ({ bill, onClose }) => {
  const [printingBluetooth, setPrintingBluetooth] = useState(false);

  const handleSystemPrint = () => {
    window.print();
  };

  const handleBluetoothPrint = async () => {
    try {
      setPrintingBluetooth(true);
      toast.info("Scanning for Bluetooth Thermal Printers...");
      await printBillViaBluetooth(bill);
      toast.success("Bill printed successfully via Bluetooth!");
    } catch (err) {
      console.error("Bluetooth print error:", err);
      toast.error("Bluetooth Print Notice: " + (err.message || "Failed to connect to Bluetooth printer"));
    } finally {
      setPrintingBluetooth(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-xs w-full p-5 space-y-4 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 no-print">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            58mm Thermal Bill Receipt
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 58mm Thermal Bill Printable Container */}
        <div className="printable-thermal bg-white p-4 font-mono text-[11px] border border-slate-300 rounded-xl space-y-3 text-slate-900 leading-tight">
          <div className="text-center space-y-0.5">
            <h2 className="font-black text-sm uppercase tracking-wider">AVS DISTRIBUTORS</h2>
            <p className="text-[10px] text-slate-500 font-bold">Distribution Management System</p>
            <p className="text-[9px] text-slate-500">Salem, Tamil Nadu | +91 98765 43210</p>
          </div>

          <div className="border-t border-b border-dashed border-slate-400 py-1.5 space-y-1">
            <div className="flex justify-between font-bold">
              <span>Bill No: <strong className="text-blue-700">{bill.bill_no || '#81021'}</strong></span>
              <span>{bill.date || '08-08-2026'}</span>
            </div>
            <div className="flex justify-between">
              <span>Shop: <strong>{bill.shop_name || 'Mani Store #102'}</strong></span>
              <span>{bill.time || '10:45 AM'}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>Emp: {bill.employee_name || 'Tharun'}</span>
              <span>Veh: {bill.vehicle_no || 'TN 32 XX 2222'}</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-1">
            <div className="flex justify-between font-bold border-b border-slate-300 pb-1">
              <span>ITEM</span>
              <span>QTY</span>
              <span>RATE</span>
              <span className="text-right">AMT</span>
            </div>

            {(bill.items || [
              { product_name: "200ml Milk", qty: 1, rate: 850, amount: 850 },
              { product_name: "Coccola 500ml", qty: 2, rate: 400, amount: 800 }
            ]).map((item, idx) => (
              <div key={idx} className="flex justify-between text-[10px]">
                <span className="truncate w-24">{item.product_name}</span>
                <span>{item.qty}</span>
                <span>₹{item.rate}</span>
                <span className="font-bold text-right">₹{item.amount}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-slate-400 pt-1.5 space-y-1 text-right">
            <div className="flex justify-between font-black text-sm">
              <span>TOTAL:</span>
              <span className="text-emerald-700">₹{bill.total_amount || 1650}</span>
            </div>
            <div className="text-[10px] text-purple-700 font-bold">
              MODE: {bill.payment_mode || 'SPLIT'}
            </div>
            {bill.cash_paid > 0 && <div className="text-[10px] text-slate-600">Cash: ₹{bill.cash_paid}</div>}
            {bill.gpay_paid > 0 && <div className="text-[10px] text-slate-600">GPay: ₹{bill.gpay_paid}</div>}
            {bill.credit_paid > 0 && <div className="text-[10px] text-amber-700">Credit Due: ₹{bill.credit_paid}</div>}
          </div>

          <div className="text-center border-t border-slate-300 pt-2 space-y-0.5">
            <p className="font-bold text-[10px]">Thank You! Visit Again</p>
            <p className="text-[8px] text-slate-400">AVS POS System</p>
          </div>
        </div>

        {/* Dual Print Action Buttons (System & Direct Bluetooth ESC/POS) */}
        <div className="space-y-2 no-print">
          <button
            onClick={handleBluetoothPrint}
            disabled={printingBluetooth}
            className="touch-btn touch-btn-primary w-full text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center gap-2 py-3 shadow-md"
          >
            <Bluetooth className="w-5 h-5 text-cyan-300 animate-pulse" />
            {printingBluetooth ? 'PAIRING & PRINTING...' : '📲 PRINT VIA BLUETOOTH (ப்ளூடூத்)'}
          </button>

          <button
            onClick={handleSystemPrint}
            className="w-full text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl py-2.5 flex items-center justify-center gap-2 border border-slate-200"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            🖨️ System / USB Print
          </button>
        </div>

      </div>
    </div>
  );
};
