content = open('d:/Startup/AVS/frontend/src/components/common/RoleLoginScreen.jsx', 'r', encoding='utf-8').read()
print('old len:', len(content))

new_content = """import React, { useState } from 'react';
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
    if (pin.length < 6) setPin(prev => prev + val);
  };

  const handleClearPin = () => {
    setPin('');
    setErrorMsg('');
  };

  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!loginId.trim()) {
      setErrorMsg('Login ID உள்ளிடவும்');
      toast.error('Please enter your Login ID');
      return;
    }
    if (pin.length < 4) {
      setErrorMsg('குறைந்தது 4 இலக்க PIN தேவை');
      toast.error('Please enter at least 4-digit PIN');
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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-6">

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 mx-auto flex items-center justify-center text-white font-black text-3xl shadow-xl">
            A
          </div>
          <h1 className="text-2xl font-black tracking-wide text-slate-900 uppercase">
            AVS AGENCIES
          </h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            Distribution Management System
          </p>
        </div>

        {/* Login ID Field */}
        <div className="space-y-1">
          <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <User className="w-3 h-3" /> Login ID
          </label>
          <input
            type="text"
            value={loginId}
            onChange={e => { setLoginId(e.target.value); setErrorMsg(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleLoginSubmit(); }}
            placeholder="Enter your Login ID (e.g. owner)"
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            autoFocus
            autoComplete="off"
          />
        </div>

        {/* PIN Entry */}
        <div className="space-y-3">
          <div className="text-center">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-center gap-1">
              <KeyRound className="w-3 h-3" /> Security PIN
            </span>
            <div className="flex justify-center gap-3 mt-2">
              {[0,1,2,3,4,5].map((idx) => (
                <div
                  key={idx}
                  className={"w-10 h-10 rounded-xl border-2 flex items-center justify-center text-lg font-black font-mono transition " + (
                    pin[idx]
                      ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-300'
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
              disabled={isLoading}
              className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-xs shadow-sm active:scale-95 transition"
            >
              {isLoading ? '...' : 'Enter'}
            </button>
          </div>
        </div>

        {/* Hint */}
        <p className="text-center text-xs text-slate-400 font-medium">
          Owner login: ID = <span className="font-bold text-slate-600">owner</span> &nbsp;|&nbsp; PIN = <span className="font-bold text-slate-600">1234</span>
        </p>

      </div>
    </div>
  );
};
"""

with open('d:/Startup/AVS/frontend/src/components/common/RoleLoginScreen.jsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
print('Login screen rewritten, len=' + str(len(new_content)))
