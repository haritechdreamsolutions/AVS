import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DollarSign, X, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export const CashSettlementModal = ({ onClose }) => {
  const { employees, saveSettlement } = useApp();
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || '');
  const [expectedCash, setExpectedCash] = useState(0);
  const [actualCash, setActualCash] = useState(0);
  const [reason, setReason] = useState('Exact Match');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const rawApiUrl = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '');
  const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

  useEffect(() => {
    if (selectedEmpId) {
      loadEmployeeSummary(selectedEmpId);
    }
  }, [selectedEmpId]);

  const loadEmployeeSummary = async (empId) => {
    try {
      setLoadingSummary(true);
      const res = await fetch(`${API_URL}/sk/employee-summary/${empId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setExpectedCash(data.cashCollected || 0);
        setActualCash(data.cashCollected || 0);
      }
    } catch (e) {
      console.error('Failed to load employee summary', e);
    } finally {
      setLoadingSummary(false);
    }
  };

  const difference = Number(actualCash || 0) - Number(expectedCash || 0);

  const handleSave = async () => {
    if (!selectedEmpId) {
      toast.error('Please select an employee');
      return;
    }
    const emp = employees.find(e => String(e.id) === String(selectedEmpId));
    setSaving(true);
    const res = await saveSettlement({
      employee_id: Number(selectedEmpId),
      employee_name: emp ? emp.full_name : 'Employee',
      expected_amount: Number(expectedCash || 0),
      collected_amount: Number(actualCash || 0),
      difference: difference,
      reason: reason,
      remarks: remarks
    });
    setSaving(false);
    if (res.success) {
      toast.success('Cash Settlement saved successfully!');
      onClose();
    } else {
      toast.error('Error: ' + (res.message || 'Failed to save settlement'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-4 sm:p-5 space-y-4 shadow-2xl max-h-[92dvh] overflow-y-auto my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            End-of-Day Cash Settlement
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Employee Dropdown */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Employee</label>
          {employees.length === 0 ? (
            <p className="text-xs text-amber-600 font-bold">No active employees in database.</p>
          ) : (
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} {emp.vehicle_number ? `(${emp.vehicle_number})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Expected Cash */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-slate-500 uppercase flex items-center justify-between">
            <span>Expected Cash (From Sales)</span>
            {loadingSummary && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
          </label>
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
          Math.abs(difference) < 0.01 ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'
        }`}>
          <div>
            <span className="text-xs font-bold text-slate-800 block">Difference</span>
            <span className="text-[10px] text-slate-500 font-bold">
              {Math.abs(difference) < 0.01 ? 'MATCHED ✓' : (difference < 0 ? 'SHORT (Cash Missing)' : 'OVER (Extra Cash)')}
            </span>
          </div>
          <span className={`font-mono font-black text-lg ${Math.abs(difference) < 0.01 ? 'text-emerald-700' : 'text-rose-700'}`}>
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
            <option value="Exact Match">Exact Match</option>
            <option value="Customer Pending">Customer Pending</option>
            <option value="Expenses Paid">Expenses Paid</option>
            <option value="Change Shortage">Change Shortage</option>
          </select>
        </div>

        {/* Remarks */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-slate-500 uppercase">Remarks / Notes</label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Mani Store credit pending"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || employees.length === 0}
          className="touch-btn touch-btn-success w-full text-sm font-extrabold flex items-center justify-center gap-2 uppercase tracking-wider disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'SAVING...' : 'SAVE SETTLEMENT'}
        </button>

      </div>
    </div>
  );
};
