import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DollarSign, X, Save } from 'lucide-react';

export const CashSettlementModal = ({ onClose }) => {
  const { saveSettlement } = useApp();
  const [selectedEmp, setSelectedEmp] = useState('Tharun (TN 32 XX 2222)');
  const [expectedCash, setExpectedCash] = useState(12000);
  const [actualCash, setActualCash] = useState(11500);
  const [reason, setReason] = useState('Customer Pending');
  const [remarks, setRemarks] = useState('Mani Store Pending');
  const [saving, setSaving] = useState(false);

  const difference = Number(actualCash) - Number(expectedCash);

  const handleSave = async () => {
    setSaving(true);
    const res = await saveSettlement({
      employee_name: selectedEmp,
      expected_cash: Number(expectedCash),
      actual_cash: Number(actualCash),
      difference: difference,
      reason: reason,
      remarks: remarks
    });
    setSaving(false);
    if (res.success) {
      alert("Cash Settlement saved successfully!");
      onClose();
    } else {
      alert("Error: " + res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Cash Settlement
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Employee Dropdown */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Employee</label>
          <select
            value={selectedEmp}
            onChange={(e) => setSelectedEmp(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
          >
            <option value="Tharun (TN 32 XX 2222)">Tharun (TN 32 XX 2222)</option>
            <option value="Kumar (TN 32 AB 1234)">Kumar (TN 32 AB 1234)</option>
            <option value="Suresh (TN 32 CD 5678)">Suresh (TN 32 CD 5678)</option>
            <option value="Mani (TN 32 BF 9012)">Mani (TN 32 BF 9012)</option>
          </select>
        </div>

        {/* Expected Cash */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Expected Cash (₹)</label>
          <input
            type="number"
            value={expectedCash}
            onChange={(e) => setExpectedCash(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-base font-mono font-black text-emerald-700 focus:outline-none"
          />
        </div>

        {/* Actual Cash Received */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Actual Cash Received (₹)</label>
          <input
            type="number"
            value={actualCash}
            onChange={(e) => setActualCash(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base font-mono font-black text-slate-900 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Difference Card */}
        <div className={`p-3 rounded-2xl border flex items-center justify-between ${
          difference === 0 ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'
        }`}>
          <div>
            <span className="text-xs font-bold text-slate-800 block">Difference</span>
            <span className="text-[10px] text-slate-500 font-bold">
              {difference === 0 ? 'MATCHED ✓' : (difference < 0 ? 'SHORT (Cash Missing)' : 'OVER (Extra Cash)')}
            </span>
          </div>
          <span className={`font-mono font-black text-lg ${difference === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            ₹{difference}
          </span>
        </div>

        {/* Reason Dropdown */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none"
          >
            <option value="Customer Pending">Customer Pending</option>
            <option value="Expenses Paid">Expenses Paid</option>
            <option value="Change Shortage">Change Shortage</option>
            <option value="Exact Match">Exact Match</option>
          </select>
        </div>

        {/* Remarks */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Remarks</label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Mani Store Pending"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="touch-btn touch-btn-success w-full text-base font-extrabold flex items-center justify-center gap-2 uppercase tracking-wider"
        >
          <Save className="w-5 h-5" />
          {saving ? 'SAVING...' : 'SAVE SETTLEMENT'}
        </button>

      </div>
    </div>
  );
};
