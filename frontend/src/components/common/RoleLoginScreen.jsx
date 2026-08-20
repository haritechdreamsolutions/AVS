import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, UserCheck, Truck, KeyRound, Store } from 'lucide-react';
import { toast } from 'sonner';

export const RoleLoginScreen = ({ onLoginSuccess }) => {
  const { loginUser, switchRole } = useApp();

  const [selectedRole, setSelectedRole] = useState('EMPLOYEE');
  const [pin, setPin] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(1);
  const [errorMsg, setErrorMsg] = useState('');

  const handlePinKey = (val) => {
    if (pin.length < 4) {
      setPin(prev => prev + val);
    }
  };

  const handleClearPin = () => {
    setPin('');
    setErrorMsg('');
  };

  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    if (pin.length !== 4) {
      setErrorMsg('4-Digit PIN தயவுசெய்து உள்ளிடவும்');
      toast.error('Please enter 4-Digit PIN');
      return;
    }

    const res = await loginUser(pin, selectedRole);
    if (res.success) {
      toast.success("Login Successful!");
      onLoginSuccess();
    } else {
      setErrorMsg(res.message || 'தவறான PIN எண்!');
      toast.error(res.message || 'Invalid PIN Number');
      setPin('');
    }
  };

  const handleQuickDemo = (role, demoPin) => {
    switchRole(role);
    setSelectedRole(role);
    setPin(demoPin);
    toast.info(`Switched to Demo ${role}`);
    onLoginSuccess();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-900">
      
      <div className="max-w-md w-full glass-panel bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 mx-auto flex items-center justify-center text-white font-black text-3xl shadow-xl glow-blue">
            A
          </div>
          <h1 className="text-2xl font-black tracking-wide text-slate-900 uppercase">
            AVS DISTRIBUTORS
          </h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            Distribution Management System
          </p>
        </div>

        {/* Role Switcher Tabs */}
        <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => { setSelectedRole('EMPLOYEE'); handleClearPin(); }}
            className={`py-2.5 rounded-xl font-extrabold text-xs flex flex-col items-center gap-1 transition ${
              selectedRole === 'EMPLOYEE'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-4 h-4" />
            Employee
          </button>

          <button
            onClick={() => { setSelectedRole('STORE_KEEPER'); handleClearPin(); }}
            className={`py-2.5 rounded-xl font-extrabold text-xs flex flex-col items-center gap-1 transition ${
              selectedRole === 'STORE_KEEPER'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-4 h-4" />
            Store Keeper
          </button>

          <button
            onClick={() => { setSelectedRole('OWNER'); handleClearPin(); }}
            className={`py-2.5 rounded-xl font-extrabold text-xs flex flex-col items-center gap-1 transition ${
              selectedRole === 'OWNER'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Owner Admin
          </button>
        </div>

        {/* Employee Selection Dropdown if Role === EMPLOYEE */}
        {selectedRole === 'EMPLOYEE' && (
          <div className="space-y-1">
            <label className="text-xs font-extrabold text-slate-500 uppercase">Select Employee Profile</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
            >
              <option value="1">Tharun (TN 32 XX 2222) - PIN: 1111</option>
              <option value="2">Kumar (TN 32 AB 1234) - PIN: 2222</option>
              <option value="3">Suresh (TN 32 CD 5678) - PIN: 3333</option>
              <option value="4">Mani (TN 32 BF 9012) - PIN: 4444</option>
            </select>
          </div>
        )}

        {/* PIN Entry Display */}
        <div className="space-y-3">
          <div className="text-center">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Enter 4-Digit Security PIN</span>
            <div className="flex justify-center gap-3 mt-2">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center text-xl font-black font-mono transition ${
                    pin[idx]
                      ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-slate-300 bg-slate-50 text-slate-400'
                  }`}
                >
                  {pin[idx] ? '●' : ''}
                </div>
              ))}
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-600 font-bold text-center bg-rose-50 p-2 rounded-xl border border-rose-200">
              {errorMsg}
            </p>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto pt-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handlePinKey(String(num))}
                className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-black text-lg shadow-sm active:scale-95 transition"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClearPin}
              className="w-full py-3 rounded-2xl bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs shadow-sm active:scale-95 transition"
            >
              Clear
            </button>
            <button
              onClick={() => handlePinKey('0')}
              className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-black text-lg shadow-sm active:scale-95 transition"
            >
              0
            </button>
            <button
              onClick={handleLoginSubmit}
              className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm active:scale-95 transition"
            >
              Enter
            </button>
          </div>
        </div>

        {/* Quick Demo Access Bar */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block text-center">
            Quick 1-Click Demo Login:
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleQuickDemo('EMPLOYEE', '1111')}
              className="py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-[10px] font-extrabold border border-blue-200"
            >
              🚚 Employee
            </button>
            <button
              onClick={() => handleQuickDemo('STORE_KEEPER', '1234')}
              className="py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-extrabold border border-emerald-200"
            >
              🏬 Store Keeper
            </button>
            <button
              onClick={() => handleQuickDemo('OWNER', '9999')}
              className="py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-[10px] font-extrabold border border-purple-200"
            >
              👑 Owner Admin
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
