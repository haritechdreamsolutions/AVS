import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, KeyRound, User } from 'lucide-react';
import { toast } from 'sonner';

export const RoleLoginScreen = ({ onLoginSuccess }) => {
  const { loginUser } = useApp();

  const [loginId, setLoginId] = useState('');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handlePinKey = (val) => {
    if (pin.length < 4) {
      setPin(prev => prev + val);
      setErrorMsg('');
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClearPin = () => {
    setPin('');
    setErrorMsg('');
  };

  const handleKeyDown = (e) => {
    if (e.key >= '0' && e.key <= '9') {
      handlePinKey(e.key);
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      handleBackspace();
    } else if (e.key === 'Enter') {
      handleLoginSubmit();
    }
  };

  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!loginId.trim()) {
      setErrorMsg('Login ID உள்ளிடவும்');
      toast.error('Please enter your Login ID');
      return;
    }
    if (pin.length !== 4) {
      setErrorMsg('4 இலக்க PIN தேவை');
      toast.error('Please enter exact 4-digit PIN');
      return;
    }
    setIsLoading(true);
    const res = await loginUser(loginId.trim(), pin);
    setIsLoading(false);
    if (res.success) {
      toast.success('Login Successful!');
      onLoginSuccess();
    } else {
      setErrorMsg(res.message || 'தவறான Login ID அல்லது PIN!');
      toast.error(res.message || 'Invalid Login ID or PIN');
      setPin('');
    }
  };

  return (
    <div 
      className="min-h-screen milk-bg-gradient flex items-center justify-center p-4 font-sans text-[#002244] focus:outline-none"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="max-w-md w-full bg-white/95 backdrop-blur-xl border border-sky-200 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6">

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 mx-auto flex items-center justify-center text-white font-black text-3xl shadow-lg glow-blue">
            A
          </div>
          <h1 className="text-2xl font-black tracking-wide text-[#0b2545] uppercase">
            AVS AGENCIES
          </h1>
          <p className="text-xs text-sky-800 font-bold uppercase tracking-wider">
            AVS MANAGEMENT SYSTEM
          </p>
        </div>

        {/* Login ID Field */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-sky-900 uppercase tracking-wider flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-sky-600" /> Login ID
          </label>
          <input
            type="text"
            value={loginId}
            onChange={e => { setLoginId(e.target.value); setErrorMsg(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleLoginSubmit(); }}
            placeholder="Enter your Login ID (e.g. owner)"
            className="w-full bg-[#f0f8ff] border border-sky-200 rounded-xl px-4 py-3 text-sm font-bold text-[#0b2545] focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 placeholder:text-sky-400"
            autoFocus
            autoComplete="off"
          />
        </div>

        {/* PIN Entry */}
        <div className="space-y-3">
          <div className="text-center">
            <span className="text-xs font-extrabold text-sky-900 uppercase tracking-wider flex items-center justify-center gap-1">
              <KeyRound className="w-3.5 h-3.5 text-sky-600" /> Security PIN (4 Digits)
            </span>
            <div className="flex justify-center gap-3 mt-2">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={"w-12 h-12 rounded-2xl border-2 flex items-center justify-center text-xl font-black font-mono transition " + (
                    pin[idx]
                      ? 'border-sky-600 bg-sky-100 text-sky-900 shadow-sm scale-105'
                      : 'border-sky-200 bg-[#f0f8ff] text-sky-300'
                  )}
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
            {[1,2,3,4,5,6,7,8,9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handlePinKey(String(num))}
                className="w-full py-3 rounded-2xl bg-[#f0f7fc] hover:bg-sky-100 border border-sky-100 text-[#0b2545] font-black text-lg shadow-2xs active:scale-95 transition"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClearPin}
              className="w-full py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs shadow-2xs active:scale-95 transition"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handlePinKey('0')}
              className="w-full py-3 rounded-2xl bg-[#f0f7fc] hover:bg-sky-100 border border-sky-100 text-[#0b2545] font-black text-lg shadow-2xs active:scale-95 transition"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleLoginSubmit}
              disabled={isLoading || pin.length !== 4}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 text-white font-black text-xs shadow-md active:scale-95 transition"
            >
              {isLoading ? '...' : 'Enter'}
            </button>
          </div>
        </div>

        {/* Hint */}
        <p className="text-center text-xs text-sky-700 font-medium">
          Owner login: ID = <span className="font-bold text-[#0b2545]">owner</span> &nbsp;|&nbsp; PIN = <span className="font-bold text-[#0b2545]">1234</span>
        </p>

      </div>
    </div>
  );
};
