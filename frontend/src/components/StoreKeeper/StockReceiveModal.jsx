import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowDownLeft, X, Save, Building2, Tag, Minus, Plus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ProductImage } from '../common/ProductImage';
import { resolveProductImageUrl } from '../../utils/productImageHelper';
import { sortProductsCustom } from '../../utils/productOrderHelper';
import { getOperationalUnit } from '../../utils/unitHelper';

export const StockReceiveModal = ({ onClose }) => {
  const { products = [], suppliers = [], fetchSuppliers, receiveDealerStock } = useApp();
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [customSupplierName, setCustomSupplierName] = useState('');
  const [allocations, setAllocations] = useState({}); // { [prodId]: { trays: number|'', pieces: number|'', qty: number|'' } }
  const [customRates, setCustomRates] = useState({});
  const [saving, setSaving] = useState(false);

  // Active suppliers from database
  const activeSuppliers = useMemo(() => {
    return (suppliers || []).filter(s => s.is_active !== false && s.is_active !== 0);
  }, [suppliers]);

  // Load fresh suppliers from database when modal opens
  React.useEffect(() => {
    if (fetchSuppliers) {
      fetchSuppliers();
    }
  }, []);

  // Set default selected supplier if activeSuppliers exist and not set
  React.useEffect(() => {
    if (activeSuppliers.length > 0) {
      const exists = activeSuppliers.some(s => String(s.id) === String(selectedSupplierId));
      if (!selectedSupplierId || (!exists && selectedSupplierId !== 'CUSTOM')) {
        setSelectedSupplierId(String(activeSuppliers[0].id));
      }
    }
  }, [activeSuppliers, selectedSupplierId]);

  // Inactive products must NOT appear in Stock Receive product selection
  const activeProducts = useMemo(() => {
    return sortProductsCustom((products || []).filter(p => p.is_active !== false && p.is_active !== 0));
  }, [products]);

  // Current selected supplier object
  const currentSupplier = useMemo(() => {
    if (selectedSupplierId === 'CUSTOM' || selectedSupplierId === 'OTHER') return null;
    return activeSuppliers.find(s => String(s.id) === String(selectedSupplierId));
  }, [activeSuppliers, selectedSupplierId]);

  // Helper: Format warehouse stock into Tray & Loose Pieces or Standard Units based on dynamic pieces_per_unit
  const formatWarehouseStock = (prod) => {
    const opUnit = getOperationalUnit(prod);
    const ppu = Math.max(1, Number(prod.pieces_per_unit || 1));
    const totalPieces = Math.round(Number(prod.warehouse_stock_units || 0) * ppu);
    
    if (opUnit.isPieceBased) {
      if (totalPieces <= 0) {
        return {
          text: `Warehouse: 0 ${prod.selling_unit || 'Tray'} (0 Pcs)`,
          totalPieces: 0,
          trays: 0,
          pieces: 0
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
        totalPieces,
        trays,
        pieces: loosePcs
      };
    }

    // Non-tray items (Case, Box, Bottle, etc.)
    const whUnits = Number(prod.warehouse_stock_units || 0);
    return {
      text: `Warehouse: ${whUnits} ${prod.selling_unit || 'Case'}`,
      totalPieces,
      units: whUnits
    };
  };

  // Get effective buy rates for a product strictly based on owner configured company rates
  const getProductBuyRates = (prod) => {
    if (!prod) return { trayRate: 0, pieceRate: 0 };
    const ppu = Math.max(1, Number(prod.pieces_per_unit || 1));
    const opUnit = getOperationalUnit(prod);

    if (customRates[prod.id] !== undefined && customRates[prod.id] !== '') {
      const num = Number(customRates[prod.id]);
      const p = num > 0 && opUnit.isPieceBased ? parseFloat((num / ppu).toFixed(2)) : 0;
      return { trayRate: num, pieceRate: p };
    }

    if (currentSupplier) {
      const companyRates = currentSupplier.product_rates || {};
      const rateVal = companyRates[prod.id];
      if (rateVal !== undefined && rateVal !== null && rateVal !== '') {
        if (typeof rateVal === 'object') {
          const t = Number(rateVal.tray_rate !== undefined ? rateVal.tray_rate : (rateVal.rate || 0));
          const p = rateVal.piece_rate !== undefined && rateVal.piece_rate !== '' && !isNaN(Number(rateVal.piece_rate))
            ? Number(rateVal.piece_rate)
            : (t > 0 && opUnit.isPieceBased ? parseFloat((t / ppu).toFixed(2)) : 0);
          return { trayRate: t, pieceRate: p };
        }
        const num = Number(rateVal);
        const p = num > 0 && opUnit.isPieceBased ? parseFloat((num / ppu).toFixed(2)) : 0;
        return { trayRate: num, pieceRate: p };
      }
    }
    return { trayRate: 0, pieceRate: 0 };
  };

  // Handlers for Tray & Piece inputs (Milk, Curd, Butter Milk)
  const handleTrayChange = (prod, val) => {
    const clean = String(val ?? '').replace(/[^\d]/g, '');
    const numTrays = clean === '' ? '' : parseInt(clean, 10);
    const { trayRate } = getProductBuyRates(prod);

    if (numTrays > 0 && trayRate <= 0) {
      toast.warning(`Tray Buy Rate is not assigned for "${prod.display_name}". Please set rate in Owner Login.`, { id: `rate-warn-${prod.id}`, duration: 4000 });
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
    const clean = String(val ?? '').replace(/[^\d]/g, '');
    const numPieces = clean === '' ? '' : parseInt(clean, 10);
    const { pieceRate } = getProductBuyRates(prod);

    if (numPieces > 0 && pieceRate <= 0) {
      toast.warning(`Piece Buy Rate is not assigned for "${prod.display_name}". Please set rate in Owner Login.`, { id: `rate-warn-${prod.id}`, duration: 4000 });
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
    const clean = String(val ?? '').replace(/[^\d]/g, '');
    const num = clean === '' ? '' : parseInt(clean, 10);
    const { trayRate } = getProductBuyRates(prod);

    if (num > 0 && trayRate <= 0) {
      toast.warning(`Buy Rate is not assigned for "${prod.display_name}". Please set rate in Owner Login.`, { id: `rate-warn-${prod.id}`, duration: 4000 });
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

  // Totals calculations: (Tray Count * Tray Rate) + (Piece Count * Piece Rate)
  const { totalItemsCount, totalPurchaseAmount, hasMissingRates } = useMemo(() => {
    let count = 0;
    let amount = 0;
    let missing = false;

    activeProducts.forEach(prod => {
      const opUnit = getOperationalUnit(prod);
      const ppu = Math.max(1, Number(prod.pieces_per_unit || 1));
      const alloc = allocations[prod.id] || {};
      const { trayRate, pieceRate } = getProductBuyRates(prod);

      if (opUnit.isPieceBased) {
        const t = Number(alloc.trays || 0);
        const p = Number(alloc.pieces || 0);
        const totalPcs = (t * ppu) + p;
        if (totalPcs > 0) {
          const qtyInSellingUnits = totalPcs / ppu;
          count += qtyInSellingUnits;
          if (t > 0 && trayRate <= 0) missing = true;
          if (p > 0 && pieceRate <= 0) missing = true;
          amount += (t * trayRate) + (p * pieceRate);
        }
      } else {
        const q = Number(alloc.qty || 0);
        if (q > 0) {
          count += q;
          if (trayRate <= 0) missing = true;
          amount += (q * trayRate);
        }
      }
    });

    return { totalItemsCount: count, totalPurchaseAmount: amount, hasMissingRates: missing };
  }, [activeProducts, allocations, currentSupplier, customRates]);

  const handleSave = async () => {
    let resolvedSupplierName = '';
    let resolvedSupplierId = null;

    if (selectedSupplierId === 'CUSTOM' || selectedSupplierId === 'OTHER') {
      resolvedSupplierName = customSupplierName.trim() || 'Direct Supplier';
    } else {
      if (currentSupplier) {
        resolvedSupplierId = currentSupplier.id;
        resolvedSupplierName = currentSupplier.name;
      } else {
        resolvedSupplierName = customSupplierName.trim() || 'Direct Supplier';
      }
    }

    const items = [];
    for (const [pidStr, alloc] of Object.entries(allocations)) {
      const pid = Number(pidStr);
      const prod = activeProducts.find(p => p.id === pid) || products.find(p => p.id === pid);
      if (!prod) continue;
      const opUnit = getOperationalUnit(prod);
      const ppu = Math.max(1, Number(prod.pieces_per_unit || 1));
      const { trayRate, pieceRate } = getProductBuyRates(prod);

      if (opUnit.isPieceBased) {
        const numTrays = Number(alloc?.trays || 0);
        const numPieces = Number(alloc?.pieces || 0);
        const totalPcs = (numTrays * ppu) + numPieces;
        if (totalPcs > 0) {
          const qtyInSellingUnits = parseFloat((totalPcs / ppu).toFixed(4));
          const itemTotal = (numTrays * trayRate) + (numPieces * pieceRate);
          items.push({
            product_id: pid,
            product_name: prod.display_name,
            quantity: qtyInSellingUnits,
            unit: prod.selling_unit || 'Tray',
            rate: trayRate,
            piece_rate: pieceRate,
            total_amount: itemTotal,
            inward_trays: numTrays,
            inward_pieces: numPieces,
            total_pieces: totalPcs
          });
        }
      } else {
        const qty = Number(alloc?.qty || 0);
        if (qty > 0) {
          items.push({
            product_id: pid,
            product_name: prod.display_name,
            quantity: qty,
            unit: prod.selling_unit || 'Case',
            rate: trayRate,
            piece_rate: 0,
            total_amount: qty * trayRate,
            inward_trays: 0,
            inward_pieces: qty * ppu,
            total_pieces: qty * ppu
          });
        }
      }
    }

    if (items.length === 0) {
      toast.error('Please enter at least 1 product quantity to receive.');
      return;
    }

    // STRICT VALIDATION: Block submission if any product with quantity > 0 has no buy rate assigned
    const unratedItems = items.filter(i => (!i.rate || Number(i.rate) <= 0) && (!i.piece_rate || Number(i.piece_rate) <= 0));
    if (unratedItems.length > 0) {
      const names = unratedItems.map(i => i.product_name).join(', ');
      toast.error(`Cannot receive stock! Buy Rate is not assigned for: "${names}". Please assign Buy Rate in Owner Login.`, { duration: 6000 });
      return;
    }

    setSaving(true);
    const res = await receiveDealerStock({
      supplier_id: resolvedSupplierId,
      supplier_name: resolvedSupplierName,
      dealer_name: resolvedSupplierName,
      items
    });
    setSaving(false);

    if (res.success) {
      toast.success(`🎉 Stock received successfully from ${resolvedSupplierName}! (Total: ₹${totalPurchaseAmount.toFixed(2)})`);
      onClose();
    } else {
      toast.error(res.message || 'Failed to receive stock');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 lg:p-6 overflow-y-auto">
      {/* Light Blue Themed Container - Optimized for Laptop & Responsive for Mobile */}
      <div className="bg-gradient-to-b from-sky-50 via-white to-sky-50/90 border-2 border-sky-200 rounded-3xl max-w-full sm:max-w-3xl lg:max-w-4xl w-full p-4 sm:p-6 lg:p-7 space-y-4 sm:space-y-5 shadow-2xl max-h-[92dvh] overflow-y-auto my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-sky-200/80 pb-3.5 sm:pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-200 shrink-0">
              <ArrowDownLeft className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg lg:text-xl text-slate-900 tracking-tight flex items-center gap-2">
                Receive Stock from Supplier
                <span className="text-[11px] sm:text-xs px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-extrabold border border-sky-300 uppercase">
                  INWARD
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs font-bold text-sky-700 mt-0.5">சப்ளையர் வரவு & கொள்முதல் கணக்கீடு</p>
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

        {/* Production Company / Supplier Selection */}
        <div className="space-y-2 bg-sky-100/70 p-3.5 sm:p-4 rounded-2xl border-2 border-sky-200 shadow-2xs">
          <label className="text-xs sm:text-sm font-black text-sky-900 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-sky-600" />
            PRODUCTION COMPANY / சப்ளையர் கம்பெனி
          </label>
          <select
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(e.target.value)}
            className="w-full bg-white border-2 border-sky-200 hover:border-sky-400 focus:border-sky-600 rounded-2xl px-4 py-3 text-sm sm:text-base font-black text-slate-900 focus:outline-none transition-all shadow-xs cursor-pointer"
          >
            {activeSuppliers.map(s => (
              <option key={s.id} value={s.id}>
                🏭 {s.name} {s.code ? `(${s.code})` : ''}
              </option>
            ))}
            <option value="CUSTOM">+ Enter Custom / Other Supplier Name</option>
          </select>

          {/* Conditional Custom Name Input if 'CUSTOM' selected */}
          {selectedSupplierId === 'CUSTOM' && (
            <div className="pt-2">
              <input
                type="text"
                placeholder="Enter Company / Supplier Name..."
                value={customSupplierName}
                onChange={(e) => setCustomSupplierName(e.target.value)}
                className="w-full bg-white border-2 border-sky-300 focus:border-sky-600 rounded-2xl px-4 py-2.5 text-sm sm:text-base font-black text-slate-900 focus:outline-none shadow-xs"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Quantities & Price Calculation Table */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-black text-slate-700 uppercase tracking-wider">
              QUANTITIES TO RECEIVE (வரவு அளவு)
            </label>
            <span className="text-xs font-extrabold text-sky-800 bg-sky-100/90 px-3 py-1 rounded-full border border-sky-200 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-sky-600" />
              Company Buy Rate Applied
            </span>
          </div>
          
          <div className="space-y-3 max-h-72 sm:max-h-96 lg:max-h-[420px] overflow-y-auto pr-1 sm:pr-2">
            {activeProducts.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No active products available to receive.</p>
            ) : (
              activeProducts.map(prod => {
                const opUnit = getOperationalUnit(prod);
                const isTrayBased = opUnit.isPieceBased; // Milk, Curd, Butter Milk
                const ppu = Math.max(1, Number(prod.pieces_per_unit || 1));
                const whStock = formatWarehouseStock(prod);
                const { trayRate, pieceRate } = getProductBuyRates(prod);

                const alloc = allocations[prod.id] || {};
                const currentTrays = alloc.trays !== undefined ? alloc.trays : '';
                const currentPieces = alloc.pieces !== undefined ? alloc.pieces : '';
                const currentQty = alloc.qty !== undefined ? alloc.qty : '';

                const isAllocated = isTrayBased 
                  ? (Number(currentTrays || 0) > 0 || Number(currentPieces || 0) > 0)
                  : Number(currentQty || 0) > 0;

                const itemTotal = isTrayBased
                  ? ((Number(currentTrays || 0) * trayRate) + (Number(currentPieces || 0) * pieceRate))
                  : (Number(currentQty || 0) * trayRate);

                const isUnassignedWithQty = isTrayBased 
                  ? ((Number(currentTrays || 0) > 0 && trayRate <= 0) || (Number(currentPieces || 0) > 0 && pieceRate <= 0))
                  : (Number(currentQty || 0) > 0 && trayRate <= 0);

                return (
                  <div 
                    key={prod.id} 
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-2xl border-2 gap-3.5 transition-all ${
                      isUnassignedWithQty
                        ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-300 shadow-sm'
                        : isAllocated 
                          ? 'bg-sky-50 border-sky-400 shadow-sm ring-1 ring-sky-300' 
                          : 'bg-white border-sky-200/80 hover:border-sky-300 shadow-2xs'
                    }`}
                  >
                    {/* Left: Product Details */}
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
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono mt-1">
                          <span className="font-bold text-slate-600">{whStock.text}</span>
                          {isTrayBased ? (
                            <span className={`font-black px-2 py-0.5 rounded-lg text-xs border ${
                              trayRate > 0 || pieceRate > 0
                                ? 'text-sky-900 bg-sky-100/80 border-sky-300' 
                                : isUnassignedWithQty
                                  ? 'text-rose-700 bg-rose-100 border-rose-300'
                                  : 'text-slate-400 bg-slate-100 border-slate-200'
                            }`}>
                              {trayRate > 0 || pieceRate > 0 ? `Tray: ₹${trayRate.toFixed(2)} | Pcs: ₹${pieceRate.toFixed(2)}` : '⚠️ Buy Rate Not Set'}
                            </span>
                          ) : (
                            <span className={`font-black px-2 py-0.5 rounded-lg text-xs border ${
                              trayRate > 0 
                                ? 'text-sky-900 bg-sky-100/80 border-sky-300' 
                                : isUnassignedWithQty
                                  ? 'text-rose-700 bg-rose-100 border-rose-300'
                                  : 'text-slate-400 bg-slate-100 border-slate-200'
                            }`}>
                              {trayRate > 0 ? `Buy Rate: ₹${trayRate.toFixed(2)}` : '⚠️ Buy Rate Not Set (₹0.00)'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Quantity Input & Line Total */}
                    <div className="flex items-center justify-between sm:justify-end gap-3.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-sky-100">
                      {/* Line total amount display */}
                      {isAllocated && (
                        <div className="text-right">
                          <span className="text-[10px] sm:text-xs font-bold text-slate-400 block">Total:</span>
                          <span className={`text-xs sm:text-sm lg:text-base font-black font-mono ${!isUnassignedWithQty ? 'text-sky-900' : 'text-rose-600'}`}>
                            {!isUnassignedWithQty ? `₹${itemTotal.toFixed(2)}` : 'Rate Required'}
                          </span>
                        </div>
                      )}

                      {/* Input Controls */}
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
                              disabled={!currentTrays || Number(currentTrays) <= 0}
                              onClick={() => handleTrayChange(prod, (Number(currentTrays) || 0) - 1)}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white hover:bg-sky-100 text-slate-800 flex items-center justify-center font-black text-sm transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                            >
                              <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                            <input
                              type="number"
                              min="0"
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
                              className="w-12 sm:w-16 h-8 sm:h-9 bg-white border-2 border-sky-300 rounded-xl px-1 sm:px-2 text-center text-slate-900 font-black font-mono text-sm sm:text-base focus:outline-none focus:border-sky-600 shadow-inner"
                            />
                            <button
                              type="button"
                              onClick={() => handleTrayChange(prod, (Number(currentTrays) || 0) + 1)}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center font-black text-sm transition cursor-pointer shadow-xs"
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
                              disabled={!currentPieces || Number(currentPieces) <= 0}
                              onClick={() => handlePieceChange(prod, (Number(currentPieces) || 0) - 1)}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white hover:bg-indigo-100 text-slate-800 flex items-center justify-center font-black text-sm transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                            >
                              <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                            <input
                              type="number"
                              min="0"
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
                              className="w-12 sm:w-16 h-8 sm:h-9 bg-white border-2 border-indigo-300 rounded-xl px-1 sm:px-2 text-center text-slate-900 font-black font-mono text-sm sm:text-base focus:outline-none focus:border-indigo-600 shadow-inner"
                            />
                            <button
                              type="button"
                              onClick={() => handlePieceChange(prod, (Number(currentPieces) || 0) + 1)}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center font-black text-sm transition cursor-pointer shadow-xs"
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
                            disabled={!currentQty || Number(currentQty) <= 0}
                            onClick={() => handleSingleQtyChange(prod, (Number(currentQty) || 0) - 1)}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white hover:bg-sky-100 text-slate-800 flex items-center justify-center font-black text-sm transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                          >
                            <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                          <input
                            type="number"
                            min="0"
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
                            className="w-16 sm:w-20 h-8 sm:h-9 bg-white border-2 border-sky-300 rounded-xl px-2 text-center text-slate-900 font-black text-sm sm:text-base focus:outline-none focus:border-sky-600 shadow-inner"
                          />
                          <button
                            type="button"
                            onClick={() => handleSingleQtyChange(prod, (Number(currentQty) || 0) + 1)}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center font-black text-sm transition cursor-pointer shadow-xs"
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

        {/* MISSING BUY RATE WARNING ALERT BANNER */}
        {hasMissingRates && (
          <div className="bg-rose-50 border-2 border-rose-300 text-rose-800 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-xs animate-shake">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>விலை நிர்ணயிக்கப்படாத பொருட்களுக்கு Stock Receive செய்ய முடியாது. Owner Login-ல் Buy Rate பதிவு செய்யவும்!</span>
          </div>
        )}

        {/* REAL-TIME TOTAL SUMMARY BANNER */}
        <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl border border-sky-900">
          <div className="space-y-0.5 text-center sm:text-left w-full sm:w-auto">
            <span className="text-xs font-bold text-sky-300 uppercase tracking-wider block">
              Total Inward Quantity
            </span>
            <p className="text-lg sm:text-xl font-black text-white">
              {Number(totalItemsCount).toFixed(1).replace(/\.0$/, '')} <span className="text-xs sm:text-sm text-sky-200 font-normal">Trays/Units</span>
            </p>
          </div>

          <div className="text-center sm:text-right space-y-0.5 w-full sm:w-auto">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
              Total Purchase Amount (கொள்முதல் தொகை)
            </span>
            <p className="text-xl sm:text-2xl font-black text-emerald-300 font-mono">
              ₹{totalPurchaseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSave}
          disabled={saving || activeProducts.length === 0 || totalItemsCount === 0 || hasMissingRates}
          className="touch-btn touch-btn-primary w-full text-sm sm:text-base font-black flex items-center justify-center gap-2 uppercase tracking-wider disabled:opacity-50 shadow-lg shadow-sky-300/60 py-3.5 sm:py-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white transition-all cursor-pointer"
        >
          {saving ? (
            <>
              <Save className="w-5 h-5 animate-spin" />
              <span>SAVING STOCK...</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5 stroke-[2.5]" />
              <span>{hasMissingRates ? 'SET BUY RATE IN OWNER LOGIN TO RECEIVE' : 'CONFIRM STOCK RECEIVE'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default StockReceiveModal;
