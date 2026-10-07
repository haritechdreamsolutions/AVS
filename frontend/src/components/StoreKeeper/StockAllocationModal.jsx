import React, { useState, useEffect } from 'react';
import { useApp, apiFetch, API_URL } from '../../context/AppContext';
import { ArrowUpRight, X, Save, User, Truck, ShieldAlert, CheckCircle2, Minus, Plus, Package, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { ProductImage } from '../common/ProductImage';
import { resolveProductImageUrl } from '../../utils/productImageHelper';
import { sortProductsCustom } from '../../utils/productOrderHelper';
import { getOperationalUnit } from '../../utils/unitHelper';

export const StockAllocationModal = ({ onClose }) => {
  const { products = [], employees = [], drivers: contextDrivers = [], allocateStock, fetchWarehouseStock } = useApp();
  const [employeeId, setEmployeeId] = useState('');
  const [allocations, setAllocations] = useState({}); // { [prodId]: { trays: number|'', pieces: number|'', qty: number|'' } }
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

  const selectedDriver = drivers.find(d => String(d.id) === String(employeeId) || String(d.employee_id) === String(employeeId));

  // Helper: Format warehouse stock into Tray & Loose Pieces or Standard Units
  const formatWarehouseStock = (prod) => {
    const opUnit = getOperationalUnit(prod);
    const ppu = Math.max(1, Number(prod.pieces_per_unit || 1));
    const totalPieces = Math.round(Number(prod.warehouse_stock_units || 0) * ppu);
    
    if (opUnit.isPieceBased) {
      if (totalPieces <= 0) {
        return {
          text: `Warehouse: 0 ${prod.selling_unit || 'Tray'} (0 Pcs)`,
          isOutOfStock: true,
          totalPieces: 0,
          trays: 0,
          pieces: 0,
          units: 0
        };
      }
      const trays = Math.floor(totalPieces / ppu);
      const loosePcs = totalPieces % ppu;
      let text = '';
      if (trays > 0 && loosePcs > 0) {
        text = `Warehouse: ${trays} Tray ${loosePcs} Pcs (${totalPieces} Pcs)`;
      } else if (trays > 0) {
        text = `Warehouse: ${trays} Tray (${totalPieces} Pcs)`;
      } else {
        text = `Warehouse: ${loosePcs} Pcs (${totalPieces} Pcs)`;
      }
      return {
        text,
        isOutOfStock: false,
        totalPieces,
        trays,
        pieces: loosePcs,
        units: trays
      };
    }

    // Non-tray items (Case, Box, Bottle, etc.) - Show only unit count without pieces
    const whUnits = Number(prod.warehouse_stock_units || 0);
    return {
      text: `Warehouse: ${whUnits} ${prod.selling_unit || 'Case'}`,
      isOutOfStock: whUnits <= 0,
      totalPieces,
      units: whUnits
    };
  };

  // Handlers for Tray & Piece inputs (Milk, Curd, Butter Milk)
  const handleTrayChange = (prod, val) => {
    const ppu = Math.max(1, Number(prod.pieces_per_unit || 1));
    const whStock = formatWarehouseStock(prod);
    const clean = String(val ?? '').replace(/[^\d]/g, '');
    const currentPieces = Number(allocations[prod.id]?.pieces || 0);
    let numTrays = clean === '' ? '' : parseInt(clean, 10);
    
    if (numTrays !== '' && !isNaN(numTrays)) {
      const proposedTotalPcs = (numTrays * ppu) + currentPieces;
      if (proposedTotalPcs > whStock.totalPieces) {
        const maxPossibleTrays = Math.floor((whStock.totalPieces - currentPieces) / ppu);
        numTrays = Math.max(0, maxPossibleTrays);
        toast.warning(`Maximum available stock for ${prod.display_name} is ${whStock.totalPieces} Pcs.`);
      }
    }
    
    setAllocations(prev => {
      const prevProd = prev[prod.id] || {};
      const next = {
        ...prev,
        [prod.id]: {
          ...prevProd,
          trays: numTrays,
          pieces: prevProd.pieces !== undefined ? prevProd.pieces : ''
        }
      };
      const t = next[prod.id].trays;
      const p = next[prod.id].pieces;
      if ((t === '' || t === 0) && (p === '' || p === 0)) {
        delete next[prod.id];
      }
      return next;
    });
  };

  const handlePieceChange = (prod, val) => {
    const ppu = Math.max(1, Number(prod.pieces_per_unit || 1));
    const whStock = formatWarehouseStock(prod);
    const clean = String(val ?? '').replace(/[^\d]/g, '');
    const currentTrays = Number(allocations[prod.id]?.trays || 0);
    let numPieces = clean === '' ? '' : parseInt(clean, 10);
    
    if (numPieces !== '' && !isNaN(numPieces)) {
      const proposedTotalPcs = (currentTrays * ppu) + numPieces;
      if (proposedTotalPcs > whStock.totalPieces) {
        const maxPossiblePcs = Math.max(0, whStock.totalPieces - (currentTrays * ppu));
        numPieces = maxPossiblePcs;
        toast.warning(`Maximum available stock for ${prod.display_name} is ${whStock.totalPieces} Pcs.`);
      }
    }
    
    setAllocations(prev => {
      const prevProd = prev[prod.id] || {};
      const next = {
        ...prev,
        [prod.id]: {
          ...prevProd,
          trays: prevProd.trays !== undefined ? prevProd.trays : '',
          pieces: numPieces
        }
      };
      const t = next[prod.id].trays;
      const p = next[prod.id].pieces;
      if ((t === '' || t === 0) && (p === '' || p === 0)) {
        delete next[prod.id];
      }
      return next;
    });
  };

  // Handler for Single Unit Input (Non-Tray items like Case, Box, Bottle)
  const handleSingleQtyChange = (prod, val) => {
    const whUnits = Math.max(0, Number(prod.warehouse_stock_units || 0));
    const unitName = prod.selling_unit || 'Case';
    const clean = String(val ?? '').replace(/[^\d]/g, '');
    let num = clean === '' ? '' : parseInt(clean, 10);
    
    if (num !== '' && !isNaN(num)) {
      if (num > whUnits) {
        num = whUnits;
        toast.warning(`Maximum available quantity for ${prod.display_name} is ${whUnits} ${unitName}.`);
      }
    }
    
    setAllocations(prev => {
      if (num === '' || num === 0) {
        const next = { ...prev };
        delete next[prod.id];
        return next;
      }
      return {
        ...prev,
        [prod.id]: { qty: num }
      };
    });
  };

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!employeeId || !selectedDriver) {
      toast.error('Please select an active driver / employee');
      return;
    }

    const items = [];
    for (const [pidStr, alloc] of Object.entries(allocations)) {
      const pid = Number(pidStr);
      const prod = products.find(p => p.id === pid);
      if (!prod) continue;
      const opUnit = getOperationalUnit(prod);
      const ppu = Math.max(1, Number(prod.pieces_per_unit || 1));

      if (opUnit.isPieceBased) {
        const numTrays = Number(alloc?.trays || 0);
        const numPieces = Number(alloc?.pieces || 0);
        const totalPcs = (numTrays * ppu) + numPieces;
        if (totalPcs > 0) {
          const qtyInSellingUnits = parseFloat((totalPcs / ppu).toFixed(4));
          items.push({
            product_id: pid,
            quantity: qtyInSellingUnits,
            unit: prod.selling_unit || 'Tray',
            allocated_trays: numTrays,
            allocated_pieces: numPieces,
            total_pieces: totalPcs
          });
        }
      } else {
        const qty = Number(alloc?.qty || 0);
        if (qty > 0) {
          items.push({
            product_id: pid,
            quantity: qty,
            unit: prod.selling_unit || 'Case',
            allocated_trays: 0,
            allocated_pieces: qty * ppu,
            total_pieces: qty * ppu
          });
        }
      }
    }

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
      if (it.quantity > available + 0.0001) {
        toast.error(`Maximum available quantity for ${p?.display_name || 'Product'} is ${available} ${unitName}. Cannot allocate ${it.quantity} ${unitName}.`);
        return;
      }
    }

    const targetEmpId = selectedDriver?.id || selectedDriver?.employee_id || employeeId;
    // Backend idempotency token to prevent double-click allocations
    const clientRef = 'ALLOC-' + targetEmpId + '-' + Date.now();

    setSaving(true);
    try {
      const res = await allocateStock({
        employee_id: Number(targetEmpId),
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

  // Only products with active status sorted by custom business order
  const availableProducts = sortProductsCustom((products || []).filter(p => p.is_active !== false && p.is_active !== 0));

  // Compute total allocated items for validation and counter
  const totalAllocatedItems = Object.entries(allocations).reduce((acc, [pidStr, alloc]) => {
    const prod = products.find(p => p.id === Number(pidStr));
    const opUnit = getOperationalUnit(prod);
    if (opUnit.isPieceBased) {
      const t = Number(alloc?.trays || 0);
      const pcs = Number(alloc?.pieces || 0);
      return acc + (t > 0 || pcs > 0 ? 1 : 0);
    }
    return acc + (Number(alloc?.qty || 0) > 0 ? 1 : 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 lg:p-6 overflow-y-auto">
      {/* Light Blue Themed Container - Optimized for Laptop & Responsive for Mobile */}
      <div className="bg-gradient-to-b from-sky-50 via-white to-sky-50/90 border-2 border-sky-200 rounded-3xl max-w-full sm:max-w-3xl lg:max-w-4xl w-full p-4 sm:p-6 lg:p-7 space-y-4 sm:space-y-5 shadow-2xl max-h-[92dvh] overflow-y-auto my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-sky-200/80 pb-3.5 sm:pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-200 shrink-0">
              <ArrowUpRight className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg lg:text-xl text-slate-900 tracking-tight flex items-center gap-2">
                Stock Allocate Driver
                <span className="text-[11px] sm:text-xs px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-extrabold border border-sky-300 uppercase">
                  POS
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-sky-700 font-extrabold uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                <span>WAREHOUSE</span>
                <span>➔</span>
                <span>DRIVER VEHICLE</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-2xl text-slate-400 hover:text-slate-700 hover:bg-sky-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Driver Selection */}
        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-black text-slate-700 uppercase flex items-center gap-1.5">
            <User className="w-4 h-4 text-sky-600" />
            SELECT DRIVER / EMPLOYEE *
          </label>
          {drivers.length === 0 ? (
            <div className="text-xs sm:text-sm text-amber-800 bg-amber-50 p-3.5 rounded-2xl border border-amber-200 font-bold flex items-start gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <span>No active Driver users found. Create an active Driver from <strong>Owner → Users Master</strong>.</span>
            </div>
          ) : (
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full bg-white border-2 border-sky-200 hover:border-sky-400 focus:border-sky-600 rounded-2xl px-4 py-3 text-sm sm:text-base font-black text-slate-900 focus:outline-none transition-all shadow-xs cursor-pointer"
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
          <div className="bg-sky-100/70 border-2 border-sky-200 rounded-2xl p-3.5 sm:p-4 grid grid-cols-3 gap-2 text-center animate-fadeIn shadow-2xs">
            <div>
              <span className="text-[11px] sm:text-xs text-sky-700 font-extrabold uppercase tracking-wider block">DRIVER</span>
              <span className="font-black text-xs sm:text-sm lg:text-base text-slate-900 truncate block mt-0.5">{selectedDriver.full_name}</span>
            </div>
            <div>
              <span className="text-[11px] sm:text-xs text-sky-700 font-extrabold uppercase tracking-wider block">EMPLOYEE CODE</span>
              <span className="font-mono font-bold text-xs sm:text-sm lg:text-base text-slate-800 block mt-0.5">{selectedDriver.employee_code || `EMP-${selectedDriver.id}`}</span>
            </div>
            <div>
              <span className="text-[11px] sm:text-xs text-sky-700 font-extrabold uppercase tracking-wider block">VEHICLE</span>
              <span className="font-mono font-black text-xs sm:text-sm lg:text-base text-sky-900 block mt-0.5">{selectedDriver.vehicle_number || 'TN32S2002'}</span>
            </div>
          </div>
        )}

        {/* Current Warehouse Stock Section */}
        {!selectedDriver ? (
          <div className="bg-white/80 border-2 border-dashed border-sky-200 rounded-2xl p-8 text-center text-xs sm:text-sm text-slate-400 font-bold space-y-1.5">
            <Truck className="w-8 h-8 sm:w-10 sm:h-10 mx-auto text-sky-400 mb-2" />
            <p className="text-slate-800 font-black text-sm sm:text-base">Select a driver to view available warehouse stock.</p>
            <p className="text-xs sm:text-sm text-slate-500">Warehouse stock inputs will be enabled once a driver is chosen.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-black text-slate-700 uppercase flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-sky-600" />
                CURRENT WAREHOUSE STOCK
              </label>
              <span className="text-xs sm:text-sm font-extrabold text-sky-800 bg-sky-100/90 px-3 py-1 rounded-full border border-sky-200">
                {availableProducts.length} Product{availableProducts.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="space-y-3 max-h-72 sm:max-h-96 lg:max-h-[420px] overflow-y-auto pr-1 sm:pr-2">
              {availableProducts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No products available in database.</p>
              ) : (
                availableProducts.map(prod => {
                  const opUnit = getOperationalUnit(prod);
                  const isTrayBased = opUnit.isPieceBased; // Milk, Curd, Butter Milk
                  const ppu = Math.max(1, Number(prod.pieces_per_unit || 1));
                  const whStock = formatWarehouseStock(prod);
                  const isOutOfStock = whStock.isOutOfStock;

                  const alloc = allocations[prod.id] || {};
                  const currentTrays = alloc.trays !== undefined ? alloc.trays : '';
                  const currentPieces = alloc.pieces !== undefined ? alloc.pieces : '';
                  const currentQty = alloc.qty !== undefined ? alloc.qty : '';

                  const isAllocated = isTrayBased 
                    ? (Number(currentTrays || 0) > 0 || Number(currentPieces || 0) > 0)
                    : Number(currentQty || 0) > 0;

                  return (
                    <div 
                      key={prod.id} 
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-2xl border-2 gap-3.5 transition-all ${
                        isOutOfStock 
                          ? 'bg-slate-50/60 border-slate-200 opacity-60' 
                          : isAllocated 
                            ? 'bg-sky-50 border-sky-400 shadow-sm ring-1 ring-sky-300'
                            : 'bg-white border-sky-200/80 hover:border-sky-300 shadow-2xs'
                      }`}
                    >
                      {/* Left: Product Info & Formatted Stock */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <ProductImage 
                          src={resolveProductImageUrl(prod)} 
                          alt={prod.display_name} 
                          size={48} 
                          icon={prod.icon || '📦'} 
                        />
                        <div className="truncate">
                          <span className="font-black text-slate-900 block truncate text-sm sm:text-base">
                            {prod.display_name}
                          </span>
                          <span className={`text-xs sm:text-sm font-mono block mt-0.5 ${!isOutOfStock ? 'text-sky-800 font-extrabold' : 'text-rose-500 font-black'}`}>
                            {whStock.text}
                          </span>
                        </div>
                      </div>

                      {/* Right: Allocation Input Controls */}
                      <div className="flex items-center justify-end gap-2.5 shrink-0">
                        {isTrayBased ? (
                          /* DUAL INPUT CONTROLS: 1st Box = Tray, 2nd Box = Pieces */
                          <div className="flex items-center gap-2 sm:gap-3.5 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-end">
                            
                            {/* Box 1: Tray Count */}
                            <div className="flex items-center gap-1.5 sm:gap-2 bg-sky-100/70 p-1.5 sm:p-2 rounded-2xl border border-sky-300">
                              <span className="text-[10px] sm:text-xs font-black text-sky-900 uppercase px-2 py-0.5 bg-sky-200/80 rounded-lg">
                                TRAY
                              </span>
                              <button
                                type="button"
                                disabled={isOutOfStock || !currentTrays || Number(currentTrays) <= 0}
                                onClick={() => handleTrayChange(prod, (Number(currentTrays) || 0) - 1)}
                                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white hover:bg-sky-100 text-slate-800 flex items-center justify-center font-black text-sm transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                              >
                                <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                max={whStock.trays}
                                disabled={isOutOfStock}
                                value={currentTrays}
                                placeholder="0"
                                onKeyDown={(e) => {
                                  if (['-', '+', 'e', 'E', '.'].includes(e.key)) e.preventDefault();
                                }}
                                onPaste={(e) => {
                                  e.preventDefault();
                                  handleTrayChange(prod, e.clipboardData.getData('text'));
                                }}
                                onChange={(e) => handleTrayChange(prod, e.target.value)}
                                className="w-12 sm:w-16 h-8 sm:h-9 bg-white border-2 border-sky-300 rounded-xl px-1 sm:px-2 text-center text-slate-900 font-black font-mono text-sm sm:text-base focus:outline-none focus:border-sky-600 disabled:bg-slate-100 disabled:cursor-not-allowed shadow-inner"
                              />
                              <button
                                type="button"
                                disabled={isOutOfStock || ((Number(currentTrays) || 0) + 1) * ppu + Number(currentPieces || 0) > whStock.totalPieces}
                                onClick={() => handleTrayChange(prod, (Number(currentTrays) || 0) + 1)}
                                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center font-black text-sm transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                              >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                            </div>

                            {/* Box 2: Piece Count */}
                            <div className="flex items-center gap-1.5 sm:gap-2 bg-indigo-50/80 p-1.5 sm:p-2 rounded-2xl border border-indigo-200">
                              <span className="text-[10px] sm:text-xs font-black text-indigo-900 uppercase px-2 py-0.5 bg-indigo-100 rounded-lg">
                                PCS
                              </span>
                              <button
                                type="button"
                                disabled={isOutOfStock || !currentPieces || Number(currentPieces) <= 0}
                                onClick={() => handlePieceChange(prod, (Number(currentPieces) || 0) - 1)}
                                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white hover:bg-indigo-100 text-slate-800 flex items-center justify-center font-black text-sm transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                              >
                                <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                max={whStock.totalPieces}
                                disabled={isOutOfStock}
                                value={currentPieces}
                                placeholder="0"
                                onKeyDown={(e) => {
                                  if (['-', '+', 'e', 'E', '.'].includes(e.key)) e.preventDefault();
                                }}
                                onPaste={(e) => {
                                  e.preventDefault();
                                  handlePieceChange(prod, e.clipboardData.getData('text'));
                                }}
                                onChange={(e) => handlePieceChange(prod, e.target.value)}
                                className="w-12 sm:w-16 h-8 sm:h-9 bg-white border-2 border-indigo-300 rounded-xl px-1 sm:px-2 text-center text-slate-900 font-black font-mono text-sm sm:text-base focus:outline-none focus:border-indigo-600 disabled:bg-slate-100 disabled:cursor-not-allowed shadow-inner"
                              />
                              <button
                                type="button"
                                disabled={isOutOfStock || Number(currentTrays || 0) * ppu + (Number(currentPieces || 0) + 1) > whStock.totalPieces}
                                onClick={() => handlePieceChange(prod, (Number(currentPieces) || 0) + 1)}
                                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center font-black text-sm transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                              >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                            </div>

                          </div>
                        ) : (
                          /* SINGLE INPUT CONTROLS: For Non-Tray items (Water Bottle, Box, Case, etc.) */
                          <div className="flex items-center gap-2 bg-sky-100/70 p-1.5 sm:p-2 rounded-2xl border border-sky-300 font-mono">
                            <span className="text-[10px] sm:text-xs font-black text-sky-900 uppercase px-2 py-0.5 bg-sky-200/80 rounded-lg">
                              QTY
                            </span>
                            <button
                              type="button"
                              disabled={isOutOfStock || !currentQty || Number(currentQty) <= 0}
                              onClick={() => handleSingleQtyChange(prod, (Number(currentQty) || 0) - 1)}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white hover:bg-sky-100 text-slate-800 flex items-center justify-center font-black text-sm transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                            >
                              <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={whStock.units}
                              disabled={isOutOfStock}
                              value={currentQty}
                              placeholder="0"
                              onKeyDown={(e) => {
                                if (['-', '+', 'e', 'E', '.'].includes(e.key)) e.preventDefault();
                              }}
                              onPaste={(e) => {
                                e.preventDefault();
                                handleSingleQtyChange(prod, e.clipboardData.getData('text'));
                              }}
                              onChange={(e) => handleSingleQtyChange(prod, e.target.value)}
                              className="w-16 sm:w-20 h-8 sm:h-9 bg-white border-2 border-sky-300 rounded-xl px-2 text-center text-slate-900 font-black text-sm sm:text-base focus:outline-none focus:border-sky-600 disabled:bg-slate-100 disabled:cursor-not-allowed shadow-inner"
                            />
                            <button
                              type="button"
                              disabled={isOutOfStock || Number(currentQty) >= whStock.units}
                              onClick={() => handleSingleQtyChange(prod, (Number(currentQty) || 0) + 1)}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center font-black text-sm transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                            <span className="text-slate-800 font-black text-xs sm:text-sm min-w-10 px-1">{prod.selling_unit || 'Case'}</span>
                          </div>
                        )}
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
          className="touch-btn touch-btn-primary w-full text-sm sm:text-base font-black bg-sky-600 hover:bg-sky-700 text-white py-3.5 sm:py-4 rounded-2xl flex items-center justify-center gap-2 uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-300/60 cursor-pointer"
        >
          {saving ? (
            <>
              <Save className="w-5 h-5 animate-spin" />
              <span>ALLOCATING TO VEHICLE...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              <span>CONFIRM VEHICLE ALLOCATION ({totalAllocatedItems} {totalAllocatedItems === 1 ? 'Product' : 'Products'})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default StockAllocationModal;
