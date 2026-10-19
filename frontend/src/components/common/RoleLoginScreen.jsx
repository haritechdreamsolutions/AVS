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

  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!loginId.trim()) {
      setErrorMsg('Login ID உள்ளிடவும்');
      toast.error('Please enter your Login ID');
      return;
    }
    if (pin.length < 4) {
      setErrorMsg('4 இலக்க PIN தேவை');
      toast.error('Please enter your password or driver PIN');
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
            <label htmlFor="login-credential" className="text-xs font-extrabold text-sky-900 uppercase tracking-wider flex items-center justify-center gap-1">
              <KeyRound className="w-3.5 h-3.5 text-sky-600" /> Password / Driver PIN
            </label>
            <input id="login-credential" type="password" autoComplete="current-password" aria-label="Password or driver PIN" value={pin} maxLength={72} onChange={event => { setPin(event.target.value); setErrorMsg(''); }} onKeyDown={event => { if (event.key === 'Enter') handleLoginSubmit(); }} className="w-full bg-[#f0f8ff] border border-sky-200 rounded-xl px-4 py-3 mt-2 text-sm font-bold" />
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-600 font-bold text-center bg-rose-50 p-2 rounded-xl border border-rose-200">
              {errorMsg}
            </p>
          )}

          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleLoginSubmit}
              disabled={isLoading || pin.length < 4}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 text-white font-black text-xs shadow-md active:scale-95 transition"
            >
              {isLoading ? '...' : 'Enter'}
            </button>
          </div>
        </div>

        {/* Hint */}
        <p className="text-center text-xs text-sky-700 font-medium">
          Use your assigned password or driver PIN.
        </p>

      </div>
    </div>
  );
};
