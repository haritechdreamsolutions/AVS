import React, { useState, useEffect } from 'react';
import { useApp, apiFetch, API_URL } from '../../context/AppContext';
import { ArrowUpRight, X, Save, User, Truck, ShieldAlert, CheckCircle2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

export const StockAllocationModal = ({ onClose }) => {
  const { products = [], employees = [], drivers: contextDrivers = [], allocateStock, fetchWarehouseStock } = useApp();
  const [employeeId, setEmployeeId] = useState('');
  const [allocations, setAllocations] = useState({});
  const [saving, setSaving] = useState(false);

  const [directDrivers, setDirectDrivers] = useState(null);

  useEffect(() => {
    let active = true;
    apiFetch(`${API_URL}/drivers`)
      .then(res => res.json())
      .then(data => {
        if (active && Array.isArray(data)) {
          setDirectDrivers(data);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch direct drivers in modal:', err);
      });
    return () => { active = false; };
  }, []);

  // Determine active drivers list from direct fetch, context drivers, or employee fallback
  const sourceDrivers = directDrivers !== null 
    ? directDrivers 
    : (contextDrivers && contextDrivers.length > 0 ? contextDrivers : employees);

  const drivers = sourceDrivers.filter(emp => {
    if (!emp || emp.is_active === false) return false;
    const role = (emp.user_role || emp.role || emp.role_name || '').toUpperCase();
    if (role === 'OWNER' || role === 'STORE_KEEPER' || role === 'EMPLOYEE') return false;
    return role === 'DRIVER';
  });

  const selectedDriver = drivers.find(d => String(d.id) === String(employeeId));

  const handleQtyChange = (prod, val) => {
    const whUnits = Math.max(0, Number(prod.warehouse_stock_units || 0));
    const unitName = prod.selling_unit || 'Tray';

    if (val === '' || val === null || val === undefined) {
      setAllocations(prev => {
        const next = { ...prev };
        delete next[prod.id];
        return next;
      });
      return;
    }

    const clean = String(val).replace(/[^\d]/g, '');
    if (clean === '') {
      setAllocations(prev => {
        const next = { ...prev };
        delete next[prod.id];
        return next;
      });
      return;
    }

    let num = parseInt(clean, 10);
    if (isNaN(num) || num < 0) {
      num = 0;
    }

    if (num > whUnits) {
      num = whUnits;
      toast.warning(`Maximum available quantity for ${prod.display_name} is ${whUnits} ${unitName}.`);
    }

    setAllocations(prev => {
      if (num <= 0) {
        const next = { ...prev };
        delete next[prod.id];
        return next;
      }
      return { ...prev, [prod.id]: num };
    });
  };

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!employeeId || !selectedDriver) {
      toast.error('Please select an active driver / employee');
      return;
    }

    const items = Object.entries(allocations)
      .filter(([_, q]) => Number(q) > 0)
      .map(([pid, q]) => {
        const prod = products.find(p => p.id === Number(pid));
        return {
          product_id: Number(pid),
          quantity: Number(q),
          unit: prod ? (prod.selling_unit || 'Tray') : 'Tray'
        };
      });

    if (items.length === 0) {
      toast.error('Please enter allocation quantity for at least 1 product');
      return;
    }

    // Strict Client-side warehouse stock validation before submission
    for (const it of items) {
      const p = products.find(prod => prod.id === it.product_id);
      const available = Math.max(0, Number(p?.warehouse_stock_units || 0));
      const unitName = p?.selling_unit || it.unit || 'Tray';
      if (it.quantity <= 0 || isNaN(it.quantity)) {
        toast.error(`Quantity for "${p?.display_name || 'Product'}" must be greater than 0`);
        return;
      }
      if (it.quantity > available) {
        toast.error(`Maximum available quantity for ${p?.display_name || 'Product'} is ${available} ${unitName}. Cannot allocate ${it.quantity} ${unitName}.`);
        return;
      }
    }

    // Backend idempotency token to prevent double-click allocations
    const clientRef = 'ALLOC-' + employeeId + '-' + Date.now();

    setSaving(true);
    try {
      const res = await allocateStock({
        employee_id: Number(employeeId),
        client_reference: clientRef,
        items
      });

      if (res.success) {
        toast.success(`🎉 Stock allocated to ${selectedDriver.full_name}'s vehicle successfully!`);
        if (typeof fetchWarehouseStock === 'function') {
          await fetchWarehouseStock();
        }
        onClose();
      } else {
        toast.error(res.message || 'Failed to allocate stock');
      }
    } catch (err) {
      toast.error(err.message || 'An unexpected error occurred during allocation');
    } finally {
      setSaving(false);
    }
  };

  // Only products with active status
  const availableProducts = (products || []).filter(p => p.is_active !== false && p.is_active !== 0);

  const totalAllocatedItems = Object.values(allocations).reduce((acc, q) => acc + (q > 0 ? q : 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-4 sm:p-5 space-y-4 shadow-2xl max-h-[92dvh] overflow-y-auto my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-sm">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900 tracking-tight">
                Stock Allocate Driver
              </h3>
              <p className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest">
                WAREHOUSE ➔ DRIVER VEHICLE
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Driver Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-600 uppercase flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-indigo-600" />
            SELECT DRIVER / EMPLOYEE *
          </label>
          {drivers.length === 0 ? (
            <div className="text-xs text-amber-700 bg-amber-50/80 p-3 rounded-2xl border border-amber-200 font-bold flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>No active Driver users found. Create an active Driver from <strong>Owner → Users Master</strong>.</span>
            </div>
          ) : (
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 hover:border-indigo-400 focus:border-indigo-600 rounded-2xl px-3.5 py-2.5 text-xs font-black text-slate-900 focus:outline-none transition-all"
            >
              <option value="">-- Select Driver --</option>
              {drivers.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} — {emp.employee_code || `EMP-${emp.id}`} — {emp.vehicle_number || 'TN32S2002'}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Selected Driver Summary (Only shown after driver is selected) */}
        {selectedDriver && (
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3 grid grid-cols-3 gap-2 text-center animate-fadeIn">
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">DRIVER</span>
              <span className="font-black text-xs text-slate-900 truncate block">{selectedDriver.full_name}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">EMPLOYEE CODE</span>
              <span className="font-mono font-bold text-xs text-slate-700 block">{selectedDriver.employee_code || `EMP-${selectedDriver.id}`}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">VEHICLE</span>
              <span className="font-mono font-black text-xs text-indigo-700 block">{selectedDriver.vehicle_number || 'TN32S2002'}</span>
            </div>
          </div>
        )}

        {/* Current Warehouse Stock Section */}
        {!selectedDriver ? (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-400 font-bold space-y-1">
            <Truck className="w-6 h-6 mx-auto text-slate-300 mb-1" />
            <p className="text-slate-600 font-extrabold">Select a driver to view available warehouse stock.</p>
            <p className="text-[11px] text-slate-400">Warehouse stock inputs will be enabled once a driver is chosen.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-600 uppercase flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-600" />
                CURRENT WAREHOUSE STOCK
              </label>
              <span className="text-[11px] font-bold text-slate-400">
                {availableProducts.length} Product{availableProducts.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {availableProducts.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No products available in database.</p>
              ) : (
                availableProducts.map(prod => {
                  const whUnits = Number(prod.warehouse_stock_units || 0);
                  const isOutOfStock = whUnits <= 0;
                  const currentAlloc = allocations[prod.id] || '';

                  return (
                    <div 
                      key={prod.id} 
                      className={`flex justify-between items-center p-3 rounded-2xl border text-xs gap-3 transition-all ${
                        isOutOfStock 
                          ? 'bg-slate-50/50 border-slate-200 opacity-60' 
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl shrink-0">{prod.icon || '📦'}</span>
                        <div className="truncate">
                          <span className="font-black text-slate-900 block truncate text-xs">{prod.display_name}</span>
                          <span className={`text-[10px] font-mono block ${whUnits > 0 ? 'text-slate-500 font-bold' : 'text-rose-500 font-black'}`}>
                            Warehouse: {whUnits} {prod.selling_unit || 'Tray'} ({Math.round(whUnits * (prod.pieces_per_unit || 1))} Pcs)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 font-mono shrink-0">
                        <span className="text-[10px] text-slate-400 font-bold uppercase hidden sm:inline mr-0.5">Allocate</span>
                        <button
                          type="button"
                          disabled={isOutOfStock || !currentAlloc || Number(currentAlloc) <= 0}
                          onClick={() => handleQtyChange(prod, (Number(currentAlloc) || 0) - 1)}
                          className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-black text-xs transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={whUnits}
                          disabled={isOutOfStock}
                          value={currentAlloc}
                          placeholder="0"
                          onKeyDown={(e) => {
                            if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            const pasted = e.clipboardData.getData('text');
                            handleQtyChange(prod, pasted);
                          }}
                          onChange={(e) => handleQtyChange(prod, e.target.value)}
                          className="w-14 bg-white border border-slate-300 rounded-xl px-1.5 py-1 text-center text-slate-900 font-black text-xs focus:outline-none focus:border-indigo-600 disabled:bg-slate-100 disabled:cursor-not-allowed"
                        />
                        <button
                          type="button"
                          disabled={isOutOfStock || Number(currentAlloc) >= whUnits}
                          onClick={() => handleQtyChange(prod, (Number(currentAlloc) || 0) + 1)}
                          className="w-6 h-6 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center font-black text-xs transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="text-slate-600 font-extrabold text-[11px] min-w-10 ml-0.5">{prod.selling_unit || 'Tray'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSave}
          disabled={saving || !selectedDriver || totalAllocatedItems === 0}
          className="touch-btn touch-btn-primary w-full text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl flex items-center justify-center gap-2 uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-200"
        >
          {saving ? (
            <>
              <Save className="w-4 h-4 animate-spin" />
              <span>ALLOCATING TO VEHICLE...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>CONFIRM VEHICLE ALLOCATION</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
