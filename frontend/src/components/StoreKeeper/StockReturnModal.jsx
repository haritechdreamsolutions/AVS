import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { getOperationalUnit, normalizeQuantity, checkReconciliationEquation } from '../../utils/unitHelper';
import { 
  RotateCcw, X, User, Truck, Receipt, PackageCheck, 
  ChevronDown, AlertTriangle, Box, RefreshCw,
  Phone, MapPin, Plus, Minus, Trash2, Pencil, Wallet,
  Fuel, Utensils, CreditCard, Wrench, ShieldAlert,
  HelpCircle, CheckCircle2, ArrowRight, AlertCircle,
  Scale, Calculator, Check, FileCheck2, Printer, Lock
} from 'lucide-react';
import { toast } from 'sonner';

export const StockReturnModal = ({ onClose }) => {
  const { 
    fetchEligibleDriversForReturn, 
    fetchDriverExpectedReturn,
    verifyAndAcceptDriverReturnDirect,
    addExpense,
    updateExpense,
    deleteExpense,
    addDamage
  } = useApp();

  const [drivers, setDrivers] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  
  // Step 1: No driver selected automatically
  const [selectedDriverId, setSelectedDriverId] = useState('');
  
  // Step 3: Driver detailed data
  const [driverData, setDriverData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Expense Modal / Form State (Phase 3)
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    category: 'Fuel',
    amount: '',
    notes: ''
  });
  const [expenseFormError, setExpenseFormError] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState(null);

  // Damage Modal / Form State (Phase 4)
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [damageQuantities, setDamageQuantities] = useState({});
  const [damageReason, setDamageReason] = useState('Leakage / Burst');
  const [damageNotes, setDamageNotes] = useState('');
  const [damageFormError, setDamageFormError] = useState('');
  const [savingDamage, setSavingDamage] = useState(false);

  // Final Return Submission State (Phase 6 & 7)
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnSuccessData, setReturnSuccessData] = useState(null);
  const [manualReturnQuantities, setManualReturnQuantities] = useState({});
  const [shortageReason, setShortageReason] = useState('');
  const [shortageFormError, setShortageFormError] = useState('');

  const EXPENSE_CATEGORIES = [
    { value: 'Fuel', label: 'Fuel / Diesel (டீசல்)', icon: Fuel, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { value: 'Food', label: 'Food & Tea (உணவு & டீ)', icon: Utensils, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { value: 'Toll', label: 'Toll Gate (டோல்கேட்)', icon: CreditCard, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { value: 'Maintenance', label: 'Vehicle Maintenance / Repair (பராமரிப்பு)', icon: Wrench, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { value: 'Fine', label: 'Police / Penalty / Fine (அபராதம்)', icon: ShieldAlert, color: 'text-rose-600 bg-rose-50 border-rose-200' },
    { value: 'Other', label: 'Other Expense (இதர செலவு)', icon: HelpCircle, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  ];

  const DAMAGE_REASONS = [
    { value: 'Leakage / Burst', label: 'Leakage / Packet Burst (கசிவு / பாக்கெட் உடைசல்)' },
    { value: 'Expired / Spoiled', label: 'Expired / Spoiled (காலாவதி / கெட்டுப்போனது)' },
    { value: 'Seal Broken / Tampered', label: 'Seal Broken / Tampered (சீல் உடைந்தது)' },
    { value: 'Crushed in Transit', label: 'Crushed in Transit (போக்குவரத்தில் நசுங்கியது)' },
    { value: 'Quality Defect', label: 'Quality Defect / Sour (தரக்குறைபாடு / புளிப்பு)' },
    { value: 'Other', label: 'Other Damage (இதர சேதம்)' },
  ];

  // Load available drivers on mount
  const loadDriversList = async () => {
    try {
      setLoadingDrivers(true);
      setErrorMsg(null);
      const list = await fetchEligibleDriversForReturn();
      setDrivers(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Error loading driver list for return:', err);
      toast.error('Failed to load drivers');
    } finally {
      setLoadingDrivers(false);
    }
  };

  useEffect(() => {
    loadDriversList();
  }, []);

  // Fetch live driver return data from database
  const loadSelectedDriverData = async (driverId = selectedDriverId) => {
    if (!driverId) {
      setDriverData(null);
      setErrorMsg(null);
      return;
    }

    try {
      setLoadingData(true);
      setErrorMsg(null);
      const data = await fetchDriverExpectedReturn(driverId);
      if (data && data.success !== false) {
        setDriverData(data);
      } else {
        setErrorMsg(data?.message || 'Unable to load driver data from database');
        toast.error(data?.message || 'Error loading driver data');
      }
    } catch (err) {
      console.error('Error loading driver data:', err);
      setErrorMsg(err.message || 'Error communicating with database');
      toast.error('Error fetching driver details');
    } finally {
      setLoadingData(false);
    }
  };

  // Step 2 & 3: When driver is selected, immediately fetch live data from database
  useEffect(() => {
    loadSelectedDriverData(selectedDriverId);
  }, [selectedDriverId]);

  // Derived Values
  const driverInfo = driverData?.driver || {};
  const salesSummary = driverData?.sales_summary || {};
  const products = driverData?.products || [];
  const expensesList = driverData?.expenses || [];
  const damagesList = driverData?.damages || [];
  const sessionStatus = driverData?.session?.status || 'OPEN';

  // Lock status (Phase 7 Final Rule)
  const isSessionLocked = ['CLOSED', 'COMPLETED', 'RETURN_VERIFIED', 'RECONCILED'].includes(sessionStatus.toUpperCase());

  // Financial Calculations
  const totalSales = Number(salesSummary.total_sales || 0);
  const totalExpenses = Number(
    driverData?.total_expenses !== undefined
      ? driverData.total_expenses
      : expensesList.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  );
  const netAmount = Number((totalSales - totalExpenses).toFixed(2));

  // Reconciliation Calculations & Validations (Phase 5)
  const reconciliationData = useMemo(() => {
    if (!products || products.length === 0) {
      return {
        isReconciled: true,
        hasMismatch: false,
        items: [],
        mismatches: [],
        totalAllocated: 0,
        totalSold: 0,
        totalDamaged: 0,
        totalReturn: 0
      };
    }

    let totalAlloc = 0;
    let totalSold = 0;
    let totalDmg = 0;
    let totalRet = 0;
    const mismatches = [];

    const items = products.map(p => {
      const opUnit = getOperationalUnit(p);
      const ppu = Math.max(1, Number(p.pieces_per_unit || p.ppu || 1));
      const isPieceBased = opUnit.isPieceBased;

      let alloc, sold, dmg, retStock;

      if (isPieceBased) {
        // TRAY CATEGORY -> ALL METRICS IN INTEGER PIECES
        alloc = p.allocated_pieces != null 
          ? Math.round(Number(p.allocated_pieces)) 
          : (p.allocated != null ? Math.round(Number(p.allocated)) : Math.round(Number(p.originally_allocated ?? p.allocated_quantity ?? 0) * ppu));
        sold = p.sold_pieces != null 
          ? Math.round(Number(p.sold_pieces)) 
          : (p.sold != null ? Math.round(Number(p.sold)) : Math.round(Number(p.sold_quantity ?? 0) * ppu));
        dmg = p.damaged_pieces != null 
          ? Math.round(Number(p.damaged_pieces)) 
          : (p.damage != null ? Math.round(Number(p.damage)) : Math.round(Number(p.damaged_quantity ?? 0) * ppu));
        
        // Expected Return is mathematically: Allocated - Sold - Damage
        retStock = Math.max(0, alloc - sold - dmg);
      } else {
        // NON-TRAY CATEGORY (Case, Bag, Box) -> ALL METRICS IN BUNDLE UNITS
        alloc = normalizeQuantity(p.allocated ?? p.originally_allocated ?? p.allocated_quantity ?? 0);
        sold = normalizeQuantity(p.sold ?? p.sold_quantity ?? 0);
        dmg = normalizeQuantity(p.damage ?? p.damaged_quantity ?? 0);
        
        // Expected Return is mathematically: Allocated - Sold - Damage
        retStock = normalizeQuantity(Math.max(0, alloc - sold - dmg));
      }

      const recon = checkReconciliationEquation(alloc, sold, dmg, retStock);

      totalAlloc += alloc;
      totalSold += sold;
      totalDmg += dmg;
      totalRet += retStock;

      const itemRec = {
        ...p,
        unit: opUnit.operationalUnit,
        displayUnit: opUnit.displayUnit,
        baseUnit: p.base_unit || 'Piece',
        ppu,
        isPieceBased,
        alloc,
        sold,
        dmg,
        retStock,
        expectedReturn: retStock,
        sumComponents: recon.calculated,
        diff: recon.diff,
        isBalanced: recon.isBalanced,
        formulaText: `${alloc} = ${sold} (Sold) + ${dmg} (Damaged) + ${retStock} (Expected Return)`
      };

      if (!recon.isBalanced) {
        mismatches.push(itemRec);
      }

      return itemRec;
    });

    const isReconciled = mismatches.length === 0;

    return {
      isReconciled,
      hasMismatch: !isReconciled,
      items,
      mismatches,
      totalAllocated: normalizeQuantity(totalAlloc),
      totalSold: normalizeQuantity(totalSold),
      totalDamaged: normalizeQuantity(totalDmg),
      totalReturn: normalizeQuantity(totalRet)
    };
  }, [products]);

  useEffect(() => {
    const defaults = {};
    (reconciliationData.items || []).forEach(p => {
      defaults[p.product_id] = p.expectedReturn;
    });
    setManualReturnQuantities(defaults);
    setShortageReason('');
    setShortageFormError('');
  }, [driverData?.session?.id, reconciliationData.items.length]);

  const handleManualReturnChange = (productId, rawVal, isPieceBased = false) => {
    if (rawVal === '') {
      setManualReturnQuantities(prev => ({ ...prev, [productId]: '' }));
      return;
    }
    let val = parseFloat(rawVal);
    if (isNaN(val) || val < 0) val = 0;
    if (isPieceBased) val = Math.round(val);
    setManualReturnQuantities(prev => ({ ...prev, [productId]: val }));
    setShortageFormError('');
  };

  const manualReturnReview = useMemo(() => {
    const items = (reconciliationData.items || []).map(p => {
      const rawVal = manualReturnQuantities[p.product_id];
      const actualReturn = (rawVal !== undefined && rawVal !== '')
        ? Number(rawVal)
        : Number(p.expectedReturn || 0);
      
      const expectedReturn = Number(p.expectedReturn || 0);
      const diffFromExpected = Number((expectedReturn - actualReturn).toFixed(4));
      const missingQty = diffFromExpected > 0.0001 ? diffFromExpected : 0;
      const excessQty = diffFromExpected < -0.0001 ? Math.abs(diffFromExpected) : 0;
      const isBalanced = Math.abs(diffFromExpected) < 0.0001;

      let physicalStatus = 'BALANCED';
      if (excessQty > 0.0001) physicalStatus = 'EXCESS';
      else if (missingQty > 0.0001) physicalStatus = 'MISSING';

      return {
        ...p,
        actualReturn,
        expectedReturn,
        missingQty,
        shortageQty: missingQty,
        excessQty,
        isPhysicallyBalanced: isBalanced,
        physicalStatus,
        equationFormula: `${p.alloc} (Allocated) = ${p.sold} (Sold) + ${p.dmg} (Damage) + ${actualReturn} (Return)${missingQty > 0 ? ` + ${missingQty} (Missing)` : ''}${excessQty > 0 ? ` [Excess: +${excessQty}]` : ''}`
      };
    });

    const hasShortage = items.some(p => p.missingQty > 0.0001);
    const hasExcess = items.some(p => p.excessQty > 0.0001);
    const isAllBalanced = items.every(p => p.physicalStatus === 'BALANCED');

    return {
      items,
      hasShortage,
      hasExcess,
      isAllBalanced,
      totalPhysicalReturn: Number(items.reduce((sum, p) => sum + Number(p.actualReturn || 0), 0).toFixed(4)),
      totalMissing: Number(items.reduce((sum, p) => sum + Number(p.missingQty || 0), 0).toFixed(4)),
      totalShortage: Number(items.reduce((sum, p) => sum + Number(p.missingQty || 0), 0).toFixed(4)),
      totalExcess: Number(items.reduce((sum, p) => sum + Number(p.excessQty || 0), 0).toFixed(4))
    };
  }, [reconciliationData.items, manualReturnQuantities]);

  // Handle Opening Expense Form
  const handleOpenAddExpense = () => {
    if (isSessionLocked) {
      toast.error('Working session is locked. Expenses cannot be added to a closed return.');
      return;
    }
    setEditingExpense(null);
    setExpenseForm({
      category: 'Fuel',
      amount: '',
      notes: ''
    });
    setExpenseFormError('');
    setShowExpenseModal(true);
  };

  const handleOpenEditExpense = (exp) => {
    if (isSessionLocked) {
      toast.error('Working session is locked. Expenses cannot be modified.');
      return;
    }
    setEditingExpense(exp);
    setExpenseForm({
      category: exp.category || 'Fuel',
      amount: String(exp.amount || ''),
      notes: exp.notes || ''
    });
    setExpenseFormError('');
    setShowExpenseModal(true);
  };

  // Handle Saving Expense
  const handleSaveExpense = async (e) => {
    e?.preventDefault();
    if (isSessionLocked) {
      toast.error('Session is locked.');
      return;
    }

    const amountNum = parseFloat(expenseForm.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setExpenseFormError('Please enter a valid expense amount greater than 0.');
      return;
    }

    try {
      setSavingExpense(true);
      setExpenseFormError('');

      if (editingExpense) {
        await updateExpense(editingExpense.id, {
          category: expenseForm.category,
          amount: amountNum,
          notes: expenseForm.notes
        });
        toast.success('Expense updated successfully');
      } else {
        await addExpense({
          employee_id: driverInfo.id || selectedDriverId,
          category: expenseForm.category,
          amount: amountNum,
          notes: expenseForm.notes
        });
        toast.success('Expense added successfully');
      }

      setShowExpenseModal(false);
      await loadSelectedDriverData(selectedDriverId);
    } catch (err) {
      console.error('Error saving expense:', err);
      setExpenseFormError(err.message || 'Failed to save expense');
      toast.error(err.message || 'Failed to save expense');
    } finally {
      setSavingExpense(false);
    }
  };

  // Handle Deleting Expense
  const handleDeleteExpense = async (expenseId) => {
    if (isSessionLocked) {
      toast.error('Working session is locked. Expenses cannot be deleted.');
      return;
    }

    if (!window.confirm('Are you sure you want to remove this expense entry?')) {
      return;
    }
    try {
      setDeletingExpenseId(expenseId);
      await deleteExpense(expenseId);
      toast.success('Expense deleted');
      await loadSelectedDriverData(selectedDriverId);
    } catch (err) {
      console.error('Error deleting expense:', err);
      toast.error(err.message || 'Failed to delete expense');
    } finally {
      setDeletingExpenseId(null);
    }
  };

  // Handle Opening Damage Modal (Phase 4)
  const handleOpenDamageModal = () => {
    if (isSessionLocked) {
      toast.error('Working session is locked. Damage cannot be reported for a closed return.');
      return;
    }
    const initialQtys = {};
    products.forEach(p => {
      initialQtys[p.product_id] = 0;
    });
    setDamageQuantities(initialQtys);
    setDamageReason('Leakage / Burst');
    setDamageNotes('');
    setDamageFormError('');
    setShowDamageModal(true);
  };

  const handleQtyChange = (productId, rawVal, maxStock, isTray = false) => {
    let val = parseFloat(rawVal);
    if (isNaN(val) || val < 0) {
      setDamageQuantities(prev => ({ ...prev, [productId]: 0 }));
      return;
    }
    if (isTray) {
      val = Math.round(val);
    }
    if (val > maxStock) {
      toast.error(`Damage quantity cannot exceed current driver stock (${maxStock})`);
      setDamageQuantities(prev => ({ ...prev, [productId]: maxStock }));
      return;
    }
    setDamageQuantities(prev => ({ ...prev, [productId]: val }));
  };

  const handleIncrement = (productId, maxStock, isPieceBased = false, step = 1) => {
    const current = parseFloat(damageQuantities[productId] || 0);
    const nextVal = Math.min(maxStock, parseFloat((current + step).toFixed(4)));
    setDamageQuantities(prev => ({ ...prev, [productId]: isPieceBased ? Math.round(nextVal) : nextVal }));
  };

  const handleDecrement = (productId, isPieceBased = false, step = 1) => {
    const current = parseFloat(damageQuantities[productId] || 0);
    const nextVal = Math.max(0, parseFloat((current - step).toFixed(4)));
    setDamageQuantities(prev => ({ ...prev, [productId]: isPieceBased ? Math.round(nextVal) : nextVal }));
  };

  // Total damage count and estimated cost
  const totalDamageStats = useMemo(() => {
    let totalItems = 0;
    let totalEstCost = 0;

    products.forEach(p => {
      const opUnit = getOperationalUnit(p);
      const isPieceBased = opUnit.isPieceBased;
      const ppu = Math.max(1, Number(p.pieces_per_unit || 1));
      const pricePerSellingUnit = Number(p.purchase_price || p.unit_selling_price || 0);
      const pieceBuyRate = ppu > 0 ? (pricePerSellingUnit / ppu) : pricePerSellingUnit;

      const qty = parseFloat(damageQuantities[p.product_id] || 0);
      if (qty > 0) {
        totalItems += qty;
        totalEstCost += isPieceBased ? (qty * pieceBuyRate) : (qty * pricePerSellingUnit);
      }
    });

    return { totalItems, totalEstCost: parseFloat(totalEstCost.toFixed(2)) };
  }, [damageQuantities, products]);

  // Handle Submitting Damage Report (Phase 4)
  const handleSubmitDamage = async (e) => {
    e?.preventDefault();
    if (isSessionLocked) {
      toast.error('Working session is locked. Damage cannot be submitted.');
      return;
    }
    setDamageFormError('');

    const itemsToSubmit = [];
    for (const p of products) {
      const opUnit = getOperationalUnit(p);
      const isPieceBased = opUnit.isPieceBased;
      const ppu = Math.max(1, Number(p.pieces_per_unit || 1));
      const maxStock = isPieceBased
        ? Math.round(Number(p.current_stock || 0) * ppu)
        : Number(Number(p.current_stock || 0).toFixed(4));
      const damageUnit = opUnit.operationalUnit;

      const qty = parseFloat(damageQuantities[p.product_id] || 0);

      if (qty > maxStock + 0.0001) {
        const err = `Damage quantity for ${p.product_name} (${qty} ${damageUnit}) exceeds available stock (${maxStock} ${damageUnit}).`;
        setDamageFormError(err);
        toast.error(err);
        return;
      }

      if (qty > 0) {
        itemsToSubmit.push({
          product_id: p.product_id,
          product_name: p.product_name,
          damage_qty: qty,
          quantity: qty,
          unit: damageUnit,
          unit_type: damageUnit,
          reason: damageReason,
          notes: damageNotes
        });
      }
    }

    if (itemsToSubmit.length === 0) {
      setDamageFormError('Please enter damage quantity greater than 0 for at least one product.');
      return;
    }

    try {
      setSavingDamage(true);
      const res = await addDamage({
        employee_id: driverInfo.id || selectedDriverId,
        items: itemsToSubmit,
        reason: damageReason,
        notes: damageNotes
      });

      if (res && res.success !== false) {
        toast.success('Damage recorded and driver stock deducted successfully!');
        setShowDamageModal(false);
        await loadSelectedDriverData(selectedDriverId);
      } else {
        setDamageFormError(res?.message || 'Failed to record damage');
        toast.error(res?.message || 'Failed to record damage');
      }
    } catch (err) {
      console.error('Error recording damage:', err);
      setDamageFormError(err.message || 'Error recording damage');
      toast.error(err.message || 'Error recording damage');
    } finally {
      setSavingDamage(false);
    }
  };

  // Handle Final Return Submission & Live Inventory Update (Phase 6 & 7)
  const handleFinalSubmitReturn = async () => {
    if (isSessionLocked) {
      toast.error('This return is already submitted and locked.');
      return;
    }

    if (!reconciliationData.isReconciled) {
      toast.error('Cannot submit return: Stock reconciliation has discrepancies that must be resolved.');
      return;
    }

    if (manualReturnReview.hasExcess) {
      toast.error('Physical return cannot exceed system return stock.');
      return;
    }

    if (manualReturnReview.hasShortage && !shortageReason.trim()) {
      const msg = 'Shortage detected. Please enter shortage reason before final submit.';
      setShortageFormError(msg);
      toast.error(msg);
      return;
    }

    if (!window.confirm(`Are you sure you want to finalize the return for ${driverInfo.name || 'this driver'}?\n\n• Net Collection Due: ₹${netAmount.toFixed(2)}\n• Total Warehouse Return Stock: ${reconciliationData.totalReturn} Units\n\nLive warehouse inventory will be updated immediately and this session will be permanently locked.`)) {
      return;
    }

    try {
      setSubmittingReturn(true);
      
      const returnPayload = {
        driver_id: driverInfo.id || selectedDriverId,
        employee_id: driverInfo.id || selectedDriverId,
        session_id: driverData.session?.id,
        shortage_reason: shortageReason.trim(),
        items: manualReturnReview.items.map(p => ({
          product_id: p.product_id,
          product_name: p.product_name,
          unit: p.unit,
          allocated_quantity: p.alloc,
          sold_quantity: p.sold,
          damaged_quantity: p.dmg,
          expected_quantity: p.expectedReturn,
          system_return_quantity: p.expectedReturn,
          actual_quantity: p.actualReturn,
          return_qty: p.actualReturn,
          physical_return_quantity: p.actualReturn,
          shortage_quantity: p.missingQty,
          missing_quantity: p.missingQty,
          shortage_reason: p.missingQty > 0 ? shortageReason.trim() : '',
          damage_quantity: p.dmg
        })),
        notes: `Final storekeeper return accepted. Net amount ₹${netAmount.toFixed(2)}`
      };

      const res = await verifyAndAcceptDriverReturnDirect(returnPayload);

      if (res && res.success) {
        toast.success('Driver return successfully finalized and live inventory updated!');
        setReturnSuccessData({
          return_no: res.summary?.return_no || res.return?.return_no || 'RET-' + Date.now().toString().slice(-6),
          driver_name: driverInfo.name,
          vehicle_number: driverInfo.vehicle_number,
          total_returned_units: manualReturnReview.totalPhysicalReturn,
          total_shortage_units: manualReturnReview.totalShortage,
          total_sales: totalSales,
          total_expenses: totalExpenses,
          net_amount: netAmount,
          items: manualReturnReview.items
        });
        // Reload driver list
        await loadDriversList();
      } else {
        toast.error(res?.message || 'Failed to submit driver return');
      }
    } catch (err) {
      console.error('Error submitting driver return:', err);
      toast.error(err.message || 'Error submitting driver return');
    } finally {
      setSubmittingReturn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-3.5 sm:p-6 space-y-4 shadow-2xl max-h-[94vh] overflow-y-auto my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-900 tracking-tight flex items-center gap-2">
                STOREKEEPER RETURN DRIVER
                {isSessionLocked ? (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 border border-slate-300 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-600" />
                    Locked / Completed
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                    Live Active Session
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Sequential Workflow: Driver Selection → Stock → Expenses → Damage → Summary
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 1. SELECT DRIVER (FIRST ACTION) */}
        {/* ========================================================================= */}
        <div className="space-y-1.5 bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-amber-600" />
              1. SELECT DRIVER (டிரைவர் தேர்வு)
            </span>
            {drivers.length > 0 && (
              <span className="text-[10px] text-slate-500 font-bold">
                {drivers.length} Active Driver{drivers.length !== 1 ? 's' : ''}
              </span>
            )}
          </label>

          {loadingDrivers ? (
            <div className="py-3 text-center text-xs text-slate-500 font-bold flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
              <span>Loading drivers list from database...</span>
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-3 text-xs sm:text-sm font-extrabold text-slate-900 appearance-none focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition shadow-xs cursor-pointer min-h-[46px]"
              >
                <option value="">-- Select Driver to Reconcile --</option>
                {drivers.map(d => (
                  <option key={d.driver_id || d.employee_id} value={String(d.driver_id || d.employee_id)}>
                    {d.driver_name || d.employee_name} ({d.employee_code || 'EMP'}) — Vehicle: {d.vehicle_number || 'N/A'} {d.route_name ? `• Route: ${d.route_name}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>

        {/* STEP 2 to 8: ACTIVE DRIVER FLOW */}
        {!selectedDriverId ? (
          /* Empty State */
          <div className="py-12 px-4 text-center bg-slate-50 border border-dashed border-slate-200 rounded-3xl space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto shadow-xs">
              <Truck className="w-6 h-6 text-slate-400" />
            </div>
            <h4 className="font-extrabold text-sm text-slate-800">Please Select a Driver Above</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Choose a driver to load their live session, allocated stock, sales, record manual physical returns, add expenses, and finalize warehouse inventory.
            </p>
          </div>
        ) : loadingData ? (
          /* Loading State */
          <div className="py-14 text-center text-xs text-slate-500 font-bold space-y-2">
            <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-black text-slate-800">Fetching live database records for selected driver...</p>
            <p className="text-xs text-slate-400 font-medium">Loading sales bills, expenses, damages, and vehicle inventory</p>
          </div>
        ) : errorMsg ? (
          /* Error State */
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-2 text-rose-800">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Failed to load driver data</span>
            </div>
            <p>{errorMsg}</p>
            <button
              onClick={() => loadSelectedDriverData(selectedDriverId)}
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : driverData && (
          <div className="space-y-4">
            
            {/* LOCKED SESSION BANNER */}
            {isSessionLocked && (
              <div className="p-3.5 bg-slate-900 text-white border border-slate-800 rounded-2xl shadow-md flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-400/30">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-black text-xs sm:text-sm text-white flex items-center gap-1.5">
                      FINALIZED & LOCKED RETURN (முடிவடைந்த கணக்கு)
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium">
                      This driver's return is completed. Stock returns, sales, expenses, and damages are permanently locked against changes.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  ✓ COMPLETED
                </span>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 2. DRIVER INFORMATION CARD */}
            {/* ========================================================================= */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white border border-slate-800 shadow-md space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  2. DRIVER INFORMATION
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  isSessionLocked 
                    ? 'bg-slate-700 text-slate-300 border-slate-600' 
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                }`}>
                  ● {sessionStatus}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Driver Name</span>
                  <p className="font-black text-sm text-white truncate mt-0.5">
                    {driverInfo.name || 'Driver'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Employee Code</span>
                  <p className="font-mono font-bold text-xs sm:text-sm text-amber-300 mt-0.5">
                    {driverInfo.employee_code || 'EMP-000'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Vehicle Number</span>
                  <p className="font-mono font-bold text-xs sm:text-sm text-cyan-300 mt-0.5">
                    {driverInfo.vehicle_number || 'N/A'}
                  </p>
                </div>
              </div>

              {(driverInfo.route_name || driverInfo.phone) && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300 font-medium">
                  {driverInfo.route_name && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                      Route: <strong className="text-white">{driverInfo.route_name}</strong>
                    </span>
                  )}
                  {driverInfo.phone && (
                    <span className="flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3 text-blue-400 shrink-0" />
                      {driverInfo.phone}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* 3. REVIEW METRICS (OVERVIEW) */}
            {/* ========================================================================= */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-emerald-600" />
                  3. REVIEW METRICS (சரிபார்ப்பு விவரம்)
                </span>
                <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                  {salesSummary.total_bills || 0} {salesSummary.total_bills === 1 ? 'Bill' : 'Bills'}
                </span>
              </div>

              {/* 3 Key Financial Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {/* 1. Sales Amount */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                    1. Sales Amount
                  </span>
                  <p className="font-mono font-black text-sm sm:text-base text-slate-900 mt-0.5">
                    ₹{totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                  <span className="text-[8px] text-slate-400 block">From Bills/Invoices</span>
                </div>

                {/* 2. Total Expenses */}
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wider block">
                    2. Total Expenses
                  </span>
                  <p className="font-mono font-black text-sm sm:text-base text-amber-700 mt-0.5">
                    - ₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                  <span className="text-[8px] text-amber-600 block">{expensesList.length} Entries</span>
                </div>

                {/* 3. Net Amount Due */}
                <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs col-span-2 sm:col-span-2">
                  <span className="text-[9px] font-extrabold text-emerald-100 uppercase tracking-wider flex items-center justify-between">
                    <span>3. Net Amount Due (நிகர தொகை)</span>
                    <span className="text-[8px] font-mono bg-white/20 px-1 py-0.2 rounded">Sales - Exp</span>
                  </span>
                  <p className="font-mono font-black text-base sm:text-lg text-white mt-0.5">
                    ₹{netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                  <span className="text-[8px] text-emerald-100 block">Net Collection Cash / Due</span>
                </div>
              </div>

              {/* 4 Stock Totals Overview */}
              <div className="grid grid-cols-4 gap-2 pt-1 font-mono text-center text-xs">
                <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                  <span className="text-[8px] font-bold text-slate-500 uppercase block">Allocated</span>
                  <span className="font-black text-xs text-slate-800 block mt-0.5">
                    {reconciliationData.totalAllocated} Units
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
                  <span className="text-[8px] font-bold text-blue-700 uppercase block">Sold</span>
                  <span className="font-black text-xs text-blue-800 block mt-0.5">
                    {reconciliationData.totalSold} Units
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-100">
                  <span className="text-[8px] font-bold text-rose-700 uppercase block">Damaged</span>
                  <span className="font-black text-xs text-rose-800 block mt-0.5">
                    {reconciliationData.totalDamaged} Units
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[8px] font-bold text-emerald-800 uppercase block">Available Return</span>
                  <span className="font-black text-xs text-emerald-700 block mt-0.5">
                    {reconciliationData.totalReturn} Units
                  </span>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 4. PRODUCT RECONCILIATION (SHOWN IMMEDIATELY AFTER DRIVER SELECTION) */}
            {/* ========================================================================= */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Scale className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      4. PRODUCT STOCK & RECONCILIATION (சரக்கு சரிபார்ப்பு)
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Physically check returned stock and type the exact Manual Return quantity
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                  {reconciliationData.items.length} Products
                </span>
              </div>

              {/* Live Stock Notice */}
              <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="leading-snug">
                  <strong>Available Physical Stock:</strong> Sales and Damages are already deducted from vehicle stock. 
                  <strong>Available Stock</strong> represents the system-calculated return quantity (Allocated - Sold - Damage).
                </p>
              </div>

              {/* Reconciliation Status Banner */}
              {isSessionLocked ? (
                <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs text-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black">
                    <Lock className="w-4 h-4 text-slate-600 shrink-0" />
                    <span>This Driver Return is Completed and Permanently Reconciled in Warehouse.</span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-300 text-slate-800">
                    FINALIZED
                  </span>
                </div>
              ) : manualReturnReview.hasExcess ? (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-1">
                  <div className="flex items-center gap-2 font-black">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>EXCESS / MISMATCH DETECTED: Physical return cannot exceed expected stock!</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    One or more products have Manual Return greater than Expected Return (+{manualReturnReview.totalExcess} Units). Please correct the input.
                  </p>
                </div>
              ) : manualReturnReview.hasShortage ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
                  <div className="flex items-center gap-2 font-black">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>SHORTAGE DETECTED: Total {manualReturnReview.totalShortage} Missing Units</span>
                  </div>
                  <p className="text-[11px] text-rose-700">
                    Physical return is less than expected. Please review the missing quantities and enter a shortage explanation below.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>All {reconciliationData.items.length} Products are 100% Balanced (சரியாக பொருந்தியது)</span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                    BALANCED
                  </span>
                </div>
              )}

              {/* Product Reconciliation Breakdown Cards */}
              {reconciliationData.items.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                  <Box className="w-10 h-10 text-slate-300 mx-auto mb-1.5" />
                  <p className="font-bold text-xs text-slate-700">No stock allocated for this driver</p>
                </div>
              ) : (
                <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
                  {manualReturnReview.items.map(p => {
                    const unit = p.unit;
                    const isBalanced = p.physicalStatus === 'BALANCED';
                    const isMissing = p.physicalStatus === 'MISSING';
                    const isExcess = p.physicalStatus === 'EXCESS';

                    return (
                      <div 
                        key={p.product_id}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 ${
                          isBalanced 
                            ? 'bg-white border-slate-200 hover:border-emerald-300 shadow-xs' 
                            : isMissing
                              ? 'bg-rose-50/50 border-rose-300 shadow-xs'
                              : 'bg-amber-50/50 border-amber-300 shadow-xs'
                        }`}
                      >
                        {/* 1. Header: Product Name, Category & Status badge */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 shrink-0 flex items-center justify-center p-1">
                              {p.image_url ? (
                                <img src={p.image_url} alt={p.product_name} className="w-full h-full object-contain rounded-lg" />
                              ) : (
                                <span className="text-xl">{p.icon || '📦'}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h5 className="font-black text-sm text-slate-900 truncate">
                                {p.product_name}
                              </h5>
                              <p className="text-[11px] text-slate-500 font-medium">
                                {p.isPieceBased ? (
                                  <>Unit: <strong>Piece</strong> (Tray: {p.ppu} Pcs/Tray)</>
                                ) : (
                                  <>Unit: <strong>{unit}</strong></>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0 flex items-center gap-1.5 self-start sm:self-auto">
                            {isBalanced && (
                              <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full shadow-2xs">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                🟢 BALANCED
                              </span>
                            )}
                            {isMissing && (
                              <span className="inline-flex items-center gap-1 text-xs font-black text-rose-700 bg-rose-100 border border-rose-300 px-3 py-1 rounded-full shadow-2xs">
                                <AlertTriangle className="w-3.5 h-3.5 stroke-[3]" />
                                🔴 MISSING: {p.missingQty} {unit}
                              </span>
                            )}
                            {isExcess && (
                              <span className="inline-flex items-center gap-1 text-xs font-black text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full shadow-2xs">
                                <AlertCircle className="w-3.5 h-3.5 stroke-[3]" />
                                🟠 EXCESS / MISMATCH (+{p.excessQty} {unit})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 2. Stock Values: Allocated, Sold, Available / Current Stock */}
                        <div className="grid grid-cols-3 gap-2 pt-2.5 text-center text-xs font-mono">
                          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Allocated</span>
                            <span className="font-black text-slate-900 text-xs sm:text-sm block mt-0.5">
                              {p.alloc} <span className="text-[9px] font-medium text-slate-400">{unit}</span>
                            </span>
                          </div>

                          <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
                            <span className="text-[9px] font-bold text-blue-700 uppercase block">Sold</span>
                            <span className="font-black text-blue-800 text-xs sm:text-sm block mt-0.5">
                              {p.sold} <span className="text-[9px] font-medium text-blue-400">{unit}</span>
                            </span>
                          </div>

                          <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                            <span className="text-[9px] font-bold text-emerald-800 uppercase block">Available / Current</span>
                            <span className="font-black text-emerald-700 text-xs sm:text-sm block mt-0.5">
                              {p.expectedReturn} <span className="text-[9px] font-medium text-emerald-500">{unit}</span>
                            </span>
                          </div>
                        </div>

                        {/* 3. Primary Storekeeper Input: MANUAL RETURN */}
                        <div className={`mt-3 p-3 rounded-2xl border ${
                          isExcess 
                            ? 'bg-amber-100/70 border-amber-300' 
                            : isMissing
                              ? 'bg-rose-100/70 border-rose-300'
                              : 'bg-teal-50/80 border-teal-200'
                        }`}>
                          <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                            <span>MANUAL RETURN (உண்மையான சரக்கு வரவு)</span>
                            <span className="text-[10px] font-mono text-slate-500 font-bold">Type Physical Count</span>
                          </label>
                          <div className="w-full">
                            <input
                              type="number"
                              min="0"
                              step={p.isPieceBased ? '1' : 'any'}
                              inputMode={p.isPieceBased ? 'numeric' : 'decimal'}
                              disabled={isSessionLocked}
                              value={manualReturnQuantities[p.product_id] !== undefined ? manualReturnQuantities[p.product_id] : p.expectedReturn}
                              onChange={(e) => handleManualReturnChange(p.product_id, e.target.value, p.isPieceBased)}
                              placeholder="0"
                              className="w-full h-12 rounded-xl border border-slate-300 bg-white px-3 text-center text-sm sm:text-base font-mono font-black text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 disabled:bg-slate-100 disabled:text-slate-500 transition shadow-xs"
                            />
                          </div>
                        </div>

                        {/* 4. Auto-Reconciliation Comparison: Expected vs Actual vs Missing */}
                        <div className="grid grid-cols-3 gap-2 pt-2.5 text-center text-xs font-mono">
                          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Expected Return</span>
                            <span className="font-black text-slate-800 text-xs sm:text-sm block mt-0.5">
                              {p.expectedReturn} <span className="text-[9px] font-medium text-slate-400">{unit}</span>
                            </span>
                          </div>

                          <div className="p-2 rounded-xl bg-teal-50 border border-teal-200">
                            <span className="text-[9px] font-bold text-teal-800 uppercase block">Actual Return</span>
                            <span className="font-black text-teal-700 text-xs sm:text-sm block mt-0.5">
                              {p.actualReturn} <span className="text-[9px] font-medium text-teal-500">{unit}</span>
                            </span>
                          </div>

                          <div className={`p-2 rounded-xl border ${
                            isMissing 
                              ? 'bg-rose-100 border-rose-300 text-rose-900' 
                              : isExcess
                                ? 'bg-amber-100 border-amber-300 text-amber-900'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}>
                            <span className="text-[9px] font-bold uppercase block">Missing Qty</span>
                            <span className={`font-black text-xs sm:text-sm block mt-0.5 ${
                              isMissing ? 'text-rose-700' : isExcess ? 'text-amber-700' : 'text-slate-600'
                            }`}>
                              {isMissing ? `${p.missingQty} ${unit}` : isExcess ? `+${p.excessQty} (Excess)` : `0 ${unit}`}
                            </span>
                          </div>
                        </div>

                        {/* Equation validation footer */}
                        <div className="mt-2.5 px-3 py-2 bg-slate-50 rounded-xl text-[11px] font-mono text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 border border-slate-200/60">
                          <span className="truncate">
                            Formula: <strong>{p.alloc}</strong> = {p.sold} (Sold) + {p.dmg} (Damaged) + {p.actualReturn} (Return){p.missingQty > 0 ? ` + ${p.missingQty} (Missing)` : ''}{p.excessQty > 0 ? ` [Excess: +${p.excessQty}]` : ''}
                          </span>
                          <span className={isBalanced ? 'text-emerald-700 font-extrabold shrink-0' : isMissing ? 'text-rose-700 font-extrabold shrink-0' : 'text-amber-700 font-extrabold shrink-0'}>
                            {isBalanced ? '✓ 100% Balanced' : isMissing ? `⚠️ Missing: ${p.missingQty} ${unit}` : `⚠️ Excess: +${p.excessQty} ${unit}`}
                          </span>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* 5. DRIVER EXPENSES (AFTER PRODUCT RECONCILIATION) */}
            {/* ========================================================================= */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Fuel className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      5. DRIVER EXPENSES (டிரைவர் செலவுகள்)
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Fuel, Food, Toll & Maintenance entries linked to this session
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSessionLocked}
                  onClick={handleOpenAddExpense}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-xs transition shadow-xs cursor-pointer min-h-[40px] ${
                    isSessionLocked 
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300' 
                      : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                  }`}
                >
                  {isSessionLocked ? (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>LOCKED</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>+ ADD EXPENSE</span>
                    </>
                  )}
                </button>
              </div>

              {expensesList.length === 0 ? (
                <div className="py-4 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-1">
                  <p className="text-xs font-bold text-slate-600">No expenses recorded for this driver today</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {expensesList.map((exp, idx) => (
                    <div 
                      key={exp.id || idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                          {exp.category || 'General'}
                        </span>
                        <p className="font-bold text-slate-700 truncate">{exp.notes || exp.title || 'Expense'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-black text-slate-900">₹{Number(exp.amount || 0).toFixed(2)}</span>
                        {!isSessionLocked && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditExpense(exp)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={deletingExpenseId === exp.id}
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="p-1 text-rose-400 hover:text-rose-700 hover:bg-rose-100 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* 6. DAMAGE ENTRIES (AFTER EXPENSES) */}
            {/* ========================================================================= */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      6. DAMAGE ENTRIES (சேதம் பதிவு)
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Damaged product quantities deducted from live vehicle stock
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSessionLocked}
                  onClick={handleOpenDamageModal}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-xs transition shadow-xs cursor-pointer min-h-[40px] ${
                    isSessionLocked
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  {isSessionLocked ? (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>LOCKED</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>+ RECORD DAMAGE</span>
                    </>
                  )}
                </button>
              </div>

              {/* Damage notice */}
              <div className="p-2.5 bg-rose-50/70 border border-rose-200 rounded-xl text-[11px] text-rose-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="leading-snug">
                  <strong>Zero Double Counting:</strong> Damages recorded here are deducted live from vehicle stock. 
                  The final return transaction adds <strong>ONLY</strong> the actual physical return quantity to warehouse inventory.
                </p>
              </div>

              {/* Damage Entries List */}
              {damagesList.length === 0 ? (
                <div className="py-3.5 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-1">
                  <p className="text-xs font-bold text-slate-600">No damaged items recorded for this driver session</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {damagesList.map((dmg, idx) => (
                    <div 
                      key={dmg.id || idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                          {dmg.reason || 'Damage'}
                        </span>
                        <p className="font-bold text-slate-700 truncate">{dmg.product_name || `Product #${dmg.product_id}`}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 font-mono">
                        <span className="font-black text-rose-700">{dmg.qty_units || dmg.quantity} Units</span>
                        {dmg.damage_cost && (
                          <span className="text-slate-400 text-[10px]">(₹{Number(dmg.damage_cost).toFixed(2)})</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* 7. FINAL SUMMARY (AT THE BOTTOM BEFORE SUBMIT) */}
            {/* ========================================================================= */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3.5 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-emerald-400" />
                    7. FINAL SUMMARY (இறுதிச் சுருக்கம்)
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Financial collection balance & aggregate stock reconciliation summary
                  </p>
                </div>

                <div className="text-right font-mono">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Net Amount Due</span>
                  <span className="text-base sm:text-lg font-black text-emerald-400">
                    ₹{netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Financial Metrics Row */}
              <div className="grid grid-cols-3 gap-2 font-mono text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Sales</span>
                  <span className="font-black text-sm text-white block mt-0.5">
                    ₹{totalSales.toFixed(2)}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                  <span className="text-[9px] font-bold text-amber-400 uppercase block">Total Expenses</span>
                  <span className="font-black text-sm text-amber-300 block mt-0.5">
                    - ₹{totalExpenses.toFixed(2)}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800/80">
                  <span className="text-[9px] font-bold text-emerald-300 uppercase block">Net Collection</span>
                  <span className="font-black text-sm text-emerald-400 block mt-0.5">
                    ₹{netAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Stock Totals 5-Box Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-center text-xs">
                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
                  <span className="text-[8px] font-bold text-slate-400 uppercase block">Allocated</span>
                  <span className="font-black text-xs text-slate-200 block mt-0.5">
                    {reconciliationData.totalAllocated} Units
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
                  <span className="text-[8px] font-bold text-blue-400 uppercase block">Sold</span>
                  <span className="font-black text-xs text-blue-300 block mt-0.5">
                    {reconciliationData.totalSold} Units
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
                  <span className="text-[8px] font-bold text-rose-400 uppercase block">Damaged</span>
                  <span className="font-black text-xs text-rose-300 block mt-0.5">
                    {reconciliationData.totalDamaged} Units
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-teal-950/80 border border-teal-800">
                  <span className="text-[8px] font-bold text-teal-300 uppercase block">Actual Return</span>
                  <span className="font-black text-xs text-teal-400 block mt-0.5">
                    {manualReturnReview.totalPhysicalReturn} Units
                  </span>
                </div>

                <div className={`p-2 rounded-xl border col-span-2 sm:col-span-1 ${
                  manualReturnReview.totalShortage > 0 
                    ? 'bg-rose-950/80 border-rose-700 text-rose-300' 
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}>
                  <span className="text-[8px] font-bold uppercase block">Missing</span>
                  <span className={`font-black text-xs block mt-0.5 ${
                    manualReturnReview.totalShortage > 0 ? 'text-rose-400' : 'text-slate-300'
                  }`}>
                    {manualReturnReview.totalShortage} Units
                  </span>
                </div>
              </div>

              {/* Status Note */}
              <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-[11px] text-slate-300">
                <p>
                  ✓ <strong>Warehouse Inventory Invariant:</strong> Only <strong>{manualReturnReview.totalPhysicalReturn} units</strong> of actual physical returned stock will be added to Warehouse Inventory. Driver vehicle stock will be zeroed and permanently locked.
                </p>
              </div>

              {/* Shortage Reason Input Box */}
              {manualReturnReview.hasShortage && !isSessionLocked && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-slate-900 space-y-2">
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      Shortage Reason Required (குறைவுக்கான காரணம்) *
                    </span>
                    <span className="font-mono text-rose-800 font-extrabold">{manualReturnReview.totalShortage} Units Missing</span>
                  </div>
                  <textarea
                    value={shortageReason}
                    onChange={(e) => {
                      setShortageReason(e.target.value);
                      setShortageFormError('');
                    }}
                    placeholder="Enter explanation for missing stock before final submit..."
                    rows={2}
                    className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                  />
                  {shortageFormError && (
                    <p className="text-[11px] font-bold text-rose-700">{shortageFormError}</p>
                  )}
                </div>
              )}

              {/* ========================================================================= */}
              {/* 8. FINAL RETURN & WAREHOUSE INVENTORY UPDATE (SUBMIT BUTTON) */}
              {/* ========================================================================= */}
              <button
                type="button"
                disabled={isSessionLocked || !reconciliationData.isReconciled || manualReturnReview.hasExcess || (manualReturnReview.hasShortage && !shortageReason.trim()) || products.length === 0 || submittingReturn}
                onClick={handleFinalSubmitReturn}
                className={`w-full py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm tracking-wide transition flex items-center justify-center gap-2 shadow-md min-h-[48px] cursor-pointer ${
                  isSessionLocked
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed border border-slate-600'
                    : manualReturnReview.hasExcess
                      ? 'bg-amber-700 text-white cursor-not-allowed'
                      : reconciliationData.isReconciled && products.length > 0 && !submittingReturn
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white'
                        : 'bg-slate-700 text-slate-400 cursor-not-allowed border border-slate-600'
                }`}
              >
                {submittingReturn ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>PROCESSING FINAL RETURN & UPDATING WAREHOUSE...</span>
                  </>
                ) : isSessionLocked ? (
                  <>
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span>RETURN COMPLETED & LOCKED (மீண்டும் சமர்ப்பிக்க முடியாது)</span>
                  </>
                ) : manualReturnReview.hasExcess ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-white" />
                    <span>CANNOT SUBMIT — PHYSICAL RETURN EXCEEDS AVAILABLE STOCK</span>
                  </>
                ) : reconciliationData.isReconciled ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>SUBMIT RETURN & UPDATE WAREHOUSE INVENTORY</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>CANNOT SUBMIT — RESOLVE STOCK MISMATCH FIRST</span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}

      </div>

      {/* SUCCESS CONFIRMATION RECEIPT MODAL */}
      {returnSuccessData && (
        <div className="fixed inset-0 z-70 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="text-center space-y-1">
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Return Finalized & Completed
              </span>
              <h3 className="text-lg font-black text-slate-900">
                Driver Return Accepted!
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Receipt #{returnSuccessData.return_no}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500 font-bold">Driver:</span>
                <span className="font-extrabold text-slate-900">{returnSuccessData.driver_name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500 font-bold">Vehicle:</span>
                <span className="font-mono font-extrabold text-slate-900">{returnSuccessData.vehicle_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500 font-bold">Returned to Warehouse:</span>
                <span className="font-mono font-black text-emerald-700">{returnSuccessData.total_returned_units} Units</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500 font-bold">Today's Sales:</span>
                <span className="font-mono font-black text-slate-900">₹{returnSuccessData.total_sales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500 font-bold">Driver Expenses:</span>
                <span className="font-mono font-black text-amber-700">- ₹{returnSuccessData.total_expenses.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span className="text-emerald-900 font-black">Net Cash / Due:</span>
                <span className="font-mono font-black text-base text-emerald-600">₹{returnSuccessData.net_amount.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setReturnSuccessData(null);
                setSelectedDriverId('');
                setDriverData(null);
              }}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition cursor-pointer"
            >
              Done & Process Another Return
            </button>
          </div>
        </div>
      )}

      {/* ADD / EDIT EXPENSE MODAL */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Fuel className="w-4 h-4" />
                </div>
                <h4 className="font-black text-sm text-slate-900">
                  {editingExpense ? 'Edit Driver Expense' : 'Add Driver Expense'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3">
              {/* Category */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase">
                  Expense Category (வகை)
                </label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition cursor-pointer"
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase">
                  Amount (தொகை ₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    autoFocus
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="e.g. 500.00"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-sm font-mono font-black text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase">
                  Notes / Description (குறிப்பு)
                </label>
                <input
                  type="text"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. 5L Diesel / Toll receipt"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition"
                />
              </div>

              {expenseFormError && (
                <p className="text-[11px] font-bold text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
                  {expenseFormError}
                </p>
              )}

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingExpense}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {savingExpense ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingExpense ? 'Update Expense' : 'Save Expense'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DAMAGE QUANTITY-ENTRY MODAL (Phase 4) */}
      {showDamageModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-4 sm:p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm sm:text-base text-slate-900">
                    RECORD DAMAGE ENTRY (சேதம் பதிவு)
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Enter damaged quantities for {driverInfo.name || 'Driver'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDamageModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notice */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Strict Validation Rule</span>
              </div>
              <p>
                Damage quantity <strong>MUST NEVER</strong> exceed the driver's current vehicle stock. 
                Submitted damages will be <strong>deducted atomically</strong> from live driver stock.
              </p>
            </div>

            <form onSubmit={handleSubmitDamage} className="space-y-4">
              
              {/* Reason Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase">
                  Primary Reason for Damage (சேதக் காரணம்) *
                </label>
                <select
                  value={damageReason}
                  onChange={(e) => setDamageReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 transition cursor-pointer"
                >
                  {DAMAGE_REASONS.map(r => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Quantities List (Reusing POS Pattern) */}
              <div className="space-y-2.5">
                <label className="text-[11px] font-bold text-slate-700 uppercase flex items-center justify-between">
                  <span>Product Damage Quantities</span>
                  <span className="text-[10px] text-slate-400 font-medium">Clamped to Current Stock</span>
                </label>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {products.map(p => {
                    const opUnit = getOperationalUnit(p);
                    const isPieceBased = opUnit.isPieceBased;
                    const ppu = Math.max(1, Number(p.pieces_per_unit || 1));
                    const maxStock = isPieceBased
                      ? Math.round(Number(p.current_stock || 0) * ppu)
                      : Number(Number(p.current_stock || 0).toFixed(4));
                    const damageUnit = opUnit.pluralLabel;
                    const currentVal = damageQuantities[p.product_id] || 0;
                    const isZeroStock = maxStock <= 0;

                    return (
                      <div 
                        key={p.product_id}
                        className={`p-3 rounded-2xl border transition ${
                          currentVal > 0 
                            ? 'bg-rose-50/50 border-rose-300 shadow-xs' 
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          
                          {/* Product Info */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 shrink-0 flex items-center justify-center p-1">
                              {p.image_url ? (
                                <img src={p.image_url} alt={p.product_name} className="w-full h-full object-contain rounded-lg" />
                              ) : (
                                <span className="text-base">{p.icon || '📦'}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h5 className="font-black text-xs text-slate-900 truncate">
                                {p.product_name}
                              </h5>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                                <span>Stock: <strong className="text-slate-800 font-mono">{maxStock} {damageUnit}</strong></span>
                              </div>
                            </div>
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={isZeroStock || currentVal <= 0}
                              onClick={() => handleDecrement(p.product_id, isPieceBased, 1)}
                              className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-black text-sm disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer shadow-xs"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>

                            <div className="relative w-16">
                              <input
                                type="number"
                                min="0"
                                max={maxStock}
                                step={isPieceBased ? '1' : 'any'}
                                disabled={isZeroStock}
                                value={currentVal === 0 ? '' : currentVal}
                                onChange={(e) => handleQtyChange(p.product_id, e.target.value, maxStock, isPieceBased)}
                                placeholder="0"
                                className="w-full bg-white border border-slate-300 rounded-lg py-1 px-1 text-center font-mono font-black text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 transition disabled:bg-slate-100 disabled:text-slate-400"
                              />
                            </div>

                            <button
                              type="button"
                              disabled={isZeroStock || currentVal >= maxStock}
                              onClick={() => handleIncrement(p.product_id, maxStock, isPieceBased, 1)}
                              className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-black text-sm disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer shadow-xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>

                            <span className="text-[10px] font-bold text-slate-600 min-w-10 text-left">
                              {damageUnit}
                            </span>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase">
                  Additional Notes (விருப்ப குறிப்பு)
                </label>
                <input
                  type="text"
                  value={damageNotes}
                  onChange={(e) => setDamageNotes(e.target.value)}
                  placeholder="e.g. Broken near checkpost / leakage on 3rd layer"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 transition"
                />
              </div>

              {/* Total Damage Summary Card */}
              <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between font-mono text-xs shadow-sm">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Total Damaged Units</span>
                  <span className="font-black text-sm text-rose-400">
                    {totalDamageStats.totalItems} Units
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Est. Write-off Cost</span>
                  <span className="font-black text-sm text-amber-300">
                    ₹{totalDamageStats.totalEstCost.toFixed(2)}
                  </span>
                </div>
              </div>

              {damageFormError && (
                <p className="text-[11px] font-bold text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {damageFormError}
                </p>
              )}

              {/* Actions */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDamageModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDamage || totalDamageStats.totalItems <= 0}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition shadow-md cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {savingDamage ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording Damage & Deducting Stock...</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Deduct & Record Damage</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default StockReturnModal;
