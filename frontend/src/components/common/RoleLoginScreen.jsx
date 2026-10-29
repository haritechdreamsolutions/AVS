import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, KeyRound, User } from 'lucide-react';
import { toast } from 'sonner';

export const RoleLoginScreen = ({ onLoginSuccess }) => {
  const { loginUser } = useApp();

  const [loginId, setLoginId] = useState('');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lockedUntil,setLockedUntil] = useState(()=>Number(sessionStorage.getItem('avs_login_locked_until'))||0);
  const [now,setNow] = useState(Date.now());
  const submitting=useRef(false),failures=useRef(0);
  const secondsLeft=Math.max(0,Math.ceil((lockedUntil-now)/1000));
  useEffect(()=>{
    if(!lockedUntil)return;
    const tick=()=>{
      const time=Date.now();setNow(time);
      if(time>=lockedUntil){setLockedUntil(0);sessionStorage.removeItem('avs_login_locked_until');failures.current=0;setErrorMsg('');}
    };
    tick();const timer=setInterval(tick,250);return()=>clearInterval(timer);
  },[lockedUntil]);

  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    if(submitting.current || Date.now()<lockedUntil)return;
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
    submitting.current=true;setIsLoading(true);
    let res;
    try {res=await loginUser(loginId.trim(), pin);}
    catch {res={success:false,message:'Network error logging in'};}
    finally {submitting.current=false;setIsLoading(false);}
    if (res.success) {
      sessionStorage.removeItem('avs_login_locked_until');failures.current=0;
      toast.success('Login Successful!');
      onLoginSuccess();
    } else {
      if(res.code==='INVALID_CREDENTIALS')failures.current++;
      const wait=Number(res.retry_after)|| (failures.current>=3?60:0);
      if(wait>0){const until=Date.now()+wait*1000;sessionStorage.setItem('avs_login_locked_until',String(until));setLockedUntil(until);setNow(Date.now());}
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

          {(errorMsg || secondsLeft>0) && (
            <p className="text-xs text-rose-600 font-bold text-center bg-rose-50 p-2 rounded-xl border border-rose-200">
              {secondsLeft>0 ? `Too many incorrect attempts. Please wait 1 minute. Try again in ${secondsLeft}s.` : errorMsg}
            </p>
          )}

          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleLoginSubmit}
              disabled={isLoading || secondsLeft>0 || pin.length < 4}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 text-white font-black text-xs shadow-md active:scale-95 transition cursor-pointer disabled:cursor-not-allowed"
            >
              {secondsLeft>0 ? `Wait ${Math.floor(secondsLeft/60)}:${String(secondsLeft%60).padStart(2,'0')}` : isLoading ? '...' : 'Enter'}
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
