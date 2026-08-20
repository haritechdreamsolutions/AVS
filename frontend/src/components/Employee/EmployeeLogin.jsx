import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Truck, KeyRound, ChevronRight, Delete } from 'lucide-react';

export const EmployeeLogin = ({ onLoginSuccess }) => {
  const { loginUser } = useApp();
  const [selectedEmp, setSelectedEmp] = useState({
    id: 1,
    name: "Tharun",
    vehicle_no: "TN 32 XX 2222"
  });
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const employees = [
    { id: 1, name: "Tharun", vehicle_no: "TN 32 XX 2222" },
    { id: 2, name: "Kumar", vehicle_no: "TN 32 AB 1234" },
    { id: 3, name: "Suresh", vehicle_no: "TN 32 CD 5678" },
    { id: 4, name: "Mani", vehicle_no: "TN 32 BF 9012" }
  ];

  const handleKeyPress = (num) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const verifyPin = async (enteredPin) => {
    const res = await loginUser(enteredPin, "EMPLOYEE");
    if (res.success) {
      setError("");
      if (onLoginSuccess) onLoginSuccess();
    } else {
      setError("Invalid PIN! Default demo PIN is 1111");
      setPin("");
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 flex flex-col min-h-[85vh] justify-between">
      {/* Header & Logo */}
      <div className="text-center pt-2 pb-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 mx-auto flex items-center justify-center text-white font-black text-2xl shadow-xl glow-blue mb-3">
          S
        </div>
        <h2 className="text-xl font-extrabold text-white tracking-wide uppercase">
          SRI DISTRIBUTORS
        </h2>
        <p className="text-xs text-blue-400 font-semibold tracking-wider">Distribution Management</p>
      </div>

      {/* Select Employee List */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Select Employee
        </label>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {employees.map(emp => (
            <div
              key={emp.id}
              onClick={() => setSelectedEmp(emp)}
              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                selectedEmp.id === emp.id
                  ? 'bg-blue-600/20 border-blue-500/80 text-white shadow-md'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-blue-400">
                  {emp.name[0]}
                </div>
                <div>
                  <h4 className="font-bold text-sm">{emp.name}</h4>
                  <p className="text-xs font-mono text-slate-400 flex items-center gap-1">
                    <Truck className="w-3 h-3 text-blue-400" />
                    {emp.vehicle_no}
                  </p>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 ${selectedEmp.id === emp.id ? 'text-blue-400' : 'text-slate-600'}`} />
            </div>
          ))}
        </div>
      </div>

      {/* 4 Digit PIN Display */}
      <div className="my-4 text-center">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">
          Enter 4 Digit PIN
        </label>
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3].map(idx => (
            <div
              key={idx}
              className={`w-12 h-12 rounded-xl border flex items-center justify-center font-bold text-xl transition-all ${
                pin.length > idx
                  ? 'border-blue-500 bg-blue-600/30 text-blue-300 shadow-md'
                  : 'border-slate-800 bg-slate-900/60 text-slate-600'
              }`}
            >
              {pin.length > idx ? '●' : ''}
            </div>
          ))}
        </div>
        {error && <p className="text-xs text-rose-400 font-medium mt-2">{error}</p>}
      </div>

      {/* Numpad 0-9 & Backspace */}
      <div className="grid grid-cols-3 gap-2 pb-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            onClick={() => handleKeyPress(num.toString())}
            className="pin-pad-btn"
          >
            {num}
          </button>
        ))}
        <div className="flex items-center justify-center text-xs text-slate-500 font-mono">
          Demo: 1111
        </div>
        <button
          onClick={() => handleKeyPress('0')}
          className="pin-pad-btn"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="pin-pad-btn bg-slate-800/80 text-rose-400 hover:bg-slate-700"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
