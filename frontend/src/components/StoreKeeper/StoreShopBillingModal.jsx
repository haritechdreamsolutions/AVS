import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { getOperationalUnit } from '../../utils/unitHelper';
import { sortProductsCustom } from '../../utils/productOrderHelper';
import { 
  X, Store, MapPin, Search, ArrowLeft, ArrowRight, CheckCircle2, 
  ShoppingBag, Banknote, Smartphone, CreditCard, Split, 
  AlertCircle, Sparkles, Plus, Minus, Trash2, Box, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

export const StoreShopBillingModal = ({ onClose, onBillGenerated }) => {
  const { products = [], shops = [], villages = [], sales = [], createSale } = useApp();

  // Navigation Steps: 'VILLAGES' | 'SHOPS' | 'BILLING' | 'PAYMENT'
  const [currentStep, setCurrentStep] = useState('VILLAGES');
  const [selectedVillage, setSelectedVillage] = useState(null);
  const [selectedShop, setSelectedShop] = useState(null);

  // Search states
  const [villageSearch, setVillageSearch] = useState('');
  const [shopSearch, setShopSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Quantities for products in cart: { [productId]: qtyNumber }
  const [quantities, setQuantities] = useState({});

  // Payment State
  const [paymentMode, setPaymentMode] = useState('CASH'); // CASH, GPAY, CREDIT, SPLIT
  const [splitOption, setSplitOption] = useState('CASH_GPAY'); // CASH_GPAY, CASH_CREDIT, GPAY_CREDIT
  const [includeOldCredit, setIncludeOldCredit] = useState(false);
  const [cashReceived, setCashReceived] = useState('');
  const [gpayReceived, setGpayReceived] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if a shop has been billed today
  const isShopBilledToday = (shopId) => {
    return (sales || []).some(s => Number(s.shop_id) === Number(shopId));
  };

  // ---------------------------------------------------------
  // 1. ALL VILLAGES GROUPING (UNRESTRICTED FOR STORE KEEPER)
  // ---------------------------------------------------------
  const villageGroups = useMemo(() => {
    const map = new Map();

    // Populate all known villages
    (villages || []).forEach(v => {
      const key = `id_${v.id}`;
      map.set(key, {
        id: v.id,
        name: v.name,
        code: v.code || '',
        shops: []
      });
    });

    // Populate shops into their respective villages
    (shops || []).forEach(s => {
      const vId = s.village_id || null;
      const vName = s.village_name || s.village || 'General / இதர கடைகள்';
      const key = vId ? `id_${vId}` : `name_${vName.trim().toLowerCase()}`;

      if (!map.has(key)) {
        map.set(key, {
          id: vId,
          name: vName,
          code: s.village_code || '',
          shops: []
        });
      }

      const entry = map.get(key);
      const isDone = s.completed || isShopBilledToday(s.id);
      entry.shops.push({
        ...s,
        completed: isDone
      });
    });

    // Convert to array and calculate stats
    const result = Array.from(map.values())
      .filter(g => g.shops.length > 0)
      .map(g => {
        const completedCount = g.shops.filter(s => s.completed).length;
        const totalDue = g.shops.reduce((sum, sh) => sum + Number(sh.current_due || 0), 0);
        return {
          ...g,
          totalShops: g.shops.length,
          completedShops: completedCount,
          totalDue,
          isCompleted: completedCount === g.shops.length && g.shops.length > 0
        };
      });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [shops, villages, sales]);

  const filteredVillages = useMemo(() => {
    if (!villageSearch) return villageGroups;
    const q = villageSearch.toLowerCase();
    return villageGroups.filter(v => 
      v.name.toLowerCase().includes(q) ||
      (v.code && v.code.toLowerCase().includes(q))
    );
  }, [villageGroups, villageSearch]);

  // Shops within selected village
  const currentVillageGroup = useMemo(() => {
    if (!selectedVillage) return null;
    const targetId = selectedVillage.id;
    const targetName = (selectedVillage.name || '').trim().toLowerCase();
    return villageGroups.find(g => 
      (targetId && g.id === targetId) ||
      (g.name && g.name.trim().toLowerCase() === targetName)
    ) || null;
  }, [selectedVillage, villageGroups]);

  const filteredVillageShops = useMemo(() => {
    if (!currentVillageGroup) return [];
    const vShops = currentVillageGroup.shops || [];
    if (!shopSearch) return vShops;
    const q = shopSearch.toLowerCase();
    return vShops.filter(s =>
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.code && s.code.toLowerCase().includes(q)) ||
      (s.owner_name && s.owner_name.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q))
    );
  }, [currentVillageGroup, shopSearch]);

  // Refresh selected shop from live shops array
  const activeShop = useMemo(() => {
    if (!selectedShop) return null;
    const fresh = (shops || []).find(s => Number(s.id) === Number(selectedShop.id));
    return fresh || selectedShop;
  }, [shops, selectedShop]);

  // ---------------------------------------------------------
  // 2. PRODUCT STOCK & OPERATIONAL UNITS FOR WAREHOUSE
  // ---------------------------------------------------------
  const activeProducts = useMemo(() => {
    return sortProductsCustom((products || []).filter(p => p.is_active !== false && p.is_active !== 0));
  }, [products]);

  const categoriesList = useMemo(() => {
    const cats = new Set(activeProducts.map(p => p.category_name || p.selling_unit || 'General').filter(Boolean));
    return ['all', ...Array.from(cats)];
  }, [activeProducts]);

  const getProductStockInfo = (product) => {
    const opUnit = getOperationalUnit(product);
    const piecesPerUnit = Math.max(1, Number(product.pieces_per_unit || 1));
    const whUnits = Number(product.warehouse_stock_units || 0);
    const basePieces = Math.floor(whUnits * piecesPerUnit);

    if (opUnit.isPieceBased) {
      // Tray products: Milk, Curd -> Piece-based rates & available
      const availableStock = basePieces;
      const rate = Number(product.piece_selling_price || (Number(product.unit_selling_price || 0) / piecesPerUnit) || 0);
      return {
        opUnit,
        whUnits,
        basePieces,
        piecesPerUnit,
        availableStock,
        unitLabel: 'Pieces',
        shortUnit: 'Pcs',
        sellingUnit: product.selling_unit || 'Trays',
        rate,
        isOutOfStock: availableStock <= 0
      };
    } else {
      // Non-tray products: Case, Bag, Box
      const availableStock = Math.floor(basePieces / piecesPerUnit);
      const rate = Number(product.unit_selling_price || (Number(product.piece_selling_price || 0) * piecesPerUnit) || 0);
      return {
        opUnit,
        whUnits,
        basePieces,
        piecesPerUnit,
        availableStock,
        unitLabel: opUnit.pluralLabel,
        shortUnit: opUnit.label,
        sellingUnit: product.selling_unit || opUnit.label,
        rate,
        isOutOfStock: availableStock <= 0
      };
    }
  };

  const filteredProducts = useMemo(() => {
    return activeProducts.filter(p => {
      const cat = p.category_name || p.selling_unit || 'General';
      const catMatch = activeCategory === 'all' || cat.toLowerCase() === activeCategory.toLowerCase();
      const nameMatch = !productSearch || 
        (p.display_name && p.display_name.toLowerCase().includes(productSearch.toLowerCase())) || 
        (p.name && p.name.toLowerCase().includes(productSearch.toLowerCase()));
      return catMatch && nameMatch;
    });
  }, [activeProducts, activeCategory, productSearch]);

  const handleQtyChange = (product, val) => {
    const info = getProductStockInfo(product);
    if (info.availableStock <= 0) {
      toast.error(`⚠️ ${product.display_name} is Out of Warehouse Stock (0 ${info.unitLabel})`);
      setQuantities(prev => ({ ...prev, [product.id]: '' }));
      return;
    }

    if (val === '' || val === null || val === undefined) {
      setQuantities(prev => ({ ...prev, [product.id]: '' }));
      return;
    }
    const cleanVal = String(val).replace(/[^0-9]/g, '');
    if (cleanVal === '') {
      setQuantities(prev => ({ ...prev, [product.id]: '' }));
      return;
    }
    const num = parseInt(cleanVal, 10);
    if (num <= 0) {
      setQuantities(prev => ({ ...prev, [product.id]: '' }));
      return;
    }
    if (num > info.availableStock) {
      toast.error(`⚠️ Only ${info.availableStock} ${info.unitLabel} available in Warehouse for ${product.display_name}`);
      setQuantities(prev => ({ ...prev, [product.id]: info.availableStock }));
      return;
    }
    setQuantities(prev => ({ ...prev, [product.id]: num }));
  };

  const cartItems = useMemo(() => {
    return Object.entries(quantities)
      .filter(([pid, q]) => {
        const prod = activeProducts.find(p => p.id === Number(pid));
        if (!prod) return false;
        const info = getProductStockInfo(prod);
        const qtyNum = Number(q) || 0;
        return !info.isOutOfStock && qtyNum > 0;
      })
      .map(([pid, q]) => {
        const prod = activeProducts.find(p => p.id === Number(pid));
        const info = getProductStockInfo(prod);
        const qtyNum = Math.min(Number(q) || 0, info.availableStock);
        return {
          product_id: Number(pid),
          product_name: prod ? prod.display_name : 'Product',
          product: prod,
          unit_type: info.opUnit.isPieceBased ? 'Piece' : info.opUnit.operationalUnit,
          display_unit: info.unitLabel,
          qty: qtyNum,
          rate: info.rate,
          amount: Number((qtyNum * info.rate).toFixed(2))
        };
      });
  }, [quantities, activeProducts]);

  const totalItemsCount = cartItems.reduce((acc, item) => acc + item.qty, 0);
  const totalBillAmount = Number(cartItems.reduce((acc, item) => acc + item.amount, 0).toFixed(2));
  const shopPreviousDue = Number(Number(activeShop?.current_due || activeShop?.credit || activeShop?.due || 0).toFixed(2));

  // Initialize includeOldCredit when shop is selected
  useEffect(() => {
    if (shopPreviousDue > 0) {
      setIncludeOldCredit(false);
    }
  }, [selectedShop]);

  const payableAmount = Number((includeOldCredit ? totalBillAmount + shopPreviousDue : totalBillAmount).toFixed(2));

  // Auto-initialize split payment defaults
  useEffect(() => {
    if (splitOption === 'CASH_GPAY' || splitOption === 'CASH_CREDIT') {
      setCashReceived(payableAmount.toString());
      setGpayReceived('');
      setCreditAmount('');
    } else if (splitOption === 'GPAY_CREDIT') {
      setGpayReceived(payableAmount.toString());
      setCashReceived('');
      setCreditAmount('');
    }
  }, [payableAmount, splitOption, currentStep]);

  // Compute clean numeric values for payment
  let numCash = 0;
  let numGpay = 0;
  let numCredit = 0;

  if (paymentMode === 'CASH') {
    numCash = payableAmount;
  } else if (paymentMode === 'GPAY') {
    numGpay = payableAmount;
  } else if (paymentMode === 'CREDIT') {
    numCredit = totalBillAmount;
  } else if (paymentMode === 'SPLIT') {
    if (splitOption === 'CASH_GPAY') {
      const parsedCash = cashReceived === '' ? 0 : Math.min(payableAmount, Math.max(0, parseFloat(cashReceived) || 0));
      numCash = parsedCash;
      numGpay = Number(Math.max(0, payableAmount - parsedCash).toFixed(2));
      numCredit = 0;
    } else if (splitOption === 'CASH_CREDIT') {
      const parsedCash = cashReceived === '' ? 0 : Math.min(payableAmount, Math.max(0, parseFloat(cashReceived) || 0));
      numCash = parsedCash;
      numCredit = Number(Math.max(0, payableAmount - parsedCash).toFixed(2));
      numGpay = 0;
    } else if (splitOption === 'GPAY_CREDIT') {
      const parsedGpay = gpayReceived === '' ? 0 : Math.min(payableAmount, Math.max(0, parseFloat(gpayReceived) || 0));
      numGpay = parsedGpay;
      numCredit = Number(Math.max(0, payableAmount - parsedGpay).toFixed(2));
      numCash = 0;
    }
  }

  const totalReceived = Number((numCash + numGpay + numCredit).toFixed(2));
  const paymentBalance = Number(Math.max(0, payableAmount - totalReceived).toFixed(2));

  // Payment input handlers
  const handleCashChange = (val) => {
    if (val === '' || val === null || val === undefined) {
      setCashReceived('');
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) {
      setCashReceived('');
      return;
    }
    if (num > payableAmount) {
      toast.error(`Cash amount cannot exceed total payable ₹${payableAmount}`);
      setCashReceived(payableAmount.toString());
      return;
    }
    setCashReceived(val);
  };

  const handleGpayChange = (val) => {
    if (val === '' || val === null || val === undefined) {
      setGpayReceived('');
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) {
      setGpayReceived('');
      return;
    }
    if (num > payableAmount) {
      toast.error(`GPay amount cannot exceed total payable ₹${payableAmount}`);
      setGpayReceived(payableAmount.toString());
      return;
    }
    setGpayReceived(val);
  };

  // Submit Shop Bill to Backend
  const handleFinalSubmit = async () => {
    if (isSubmitting) return;

    if (cartItems.length === 0) {
      toast.error("Please add at least 1 product!");
      return;
    }

    if (!activeShop || !activeShop.id) {
      toast.error("Please select a valid shop!");
      setCurrentStep('SHOPS');
      return;
    }

    if (paymentBalance !== 0 && paymentMode !== 'CREDIT') {
      toast.error(`Payment amount mismatch! Remaining: ₹${paymentBalance.toFixed(2)}`);
      return;
    }

    setIsSubmitting(true);
    const idempotencyKey = 'POS-SK-SHOP-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    const oldCreditPaid = includeOldCredit ? shopPreviousDue : 0;

    const payload = {
      is_store_direct_sale: true,
      sale_type: 'STOREKEEPER_DIRECT',
      shop_id: activeShop.id,
      shop_name: activeShop.name,
      shop_code: activeShop.code || '',
      customer_name: activeShop.name,
      employee_id: null,
      employee_name: 'Store Keeper',
      vehicle_no: 'Warehouse Direct',
      payment_mode: paymentMode,
      cash_paid: paymentMode === 'CASH' ? payableAmount : (paymentMode === 'SPLIT' ? numCash : 0),
      gpay_paid: paymentMode === 'GPAY' ? payableAmount : (paymentMode === 'SPLIT' ? numGpay : 0),
      credit_paid: paymentMode === 'CREDIT' ? totalBillAmount : (paymentMode === 'SPLIT' ? numCredit : 0),
      old_credit_paid: oldCreditPaid,
      clear_previous_due: includeOldCredit,
      previous_due: shopPreviousDue,
      total_amount: totalBillAmount,
      payable_amount: payableAmount,
      balance: paymentBalance,
      idempotency_key: idempotencyKey,
      client_reference: idempotencyKey,
      items: cartItems.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        unit_type: item.unit_type,
        qty: item.qty,
        rate: item.rate,
        amount: item.amount
      }))
    };

    try {
      const res = await createSale(payload);
      if (res && res.success) {
        const fullSale = {
          ...res.sale,
          items: res.items || res.sale?.items || cartItems
        };
        toast.success(`🎉 Shop Bill #${fullSale.bill_no || fullSale.id} generated successfully! Stock & Shop Credit updated.`);
        onClose();
        if (onBillGenerated) {
          onBillGenerated(fullSale);
        }
      } else {
        toast.error(`Failed to generate shop bill: ${res?.message || 'Server error'}`);
      }
    } catch (err) {
      toast.error(`Error: ${err.message || 'Network failure'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-1 sm:p-4 overflow-y-auto">
      <div className="bg-white border-2 border-sky-200 rounded-3xl max-w-5xl w-full h-[98dvh] sm:h-[94dvh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* HEADER BAR */}
        <div className="flex items-center justify-between p-3 sm:p-4 sm:px-6 border-b-2 border-sky-200 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-sky-600 border border-sky-400/40 flex items-center justify-center text-white shadow-md shadow-sky-900/50 shrink-0">
              <Store className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm sm:text-lg text-white tracking-tight uppercase">
                  STORE KEEPER SHOP BILLING (கடை பில்லிங்)
                </h3>
                <span className="text-[10px] sm:text-xs bg-sky-500/20 text-sky-200 font-extrabold px-2.5 py-0.5 rounded-full border border-sky-400/30">
                  🏬 All Villages Active
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-sky-200 font-bold truncate mt-0.5">
                {currentStep === 'VILLAGES' && 'Step 1: Select Village (எல்லா கிராமங்கள்)'}
                {currentStep === 'SHOPS' && `Step 2: Select Shop in ${selectedVillage?.name}`}
                {currentStep === 'BILLING' && `Step 3: Billing for ${activeShop?.name} (#${activeShop?.code || activeShop?.id})`}
                {currentStep === 'PAYMENT' && `Step 4: Payment & Credit Settlement for ${activeShop?.name}`}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-sky-100 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0 ml-2"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP BREADCRUMBS BAR */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2 bg-sky-50 border-b border-sky-200 text-xs font-black overflow-x-auto shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 text-slate-700">
            
            <button
              onClick={() => setCurrentStep('VILLAGES')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
                currentStep === 'VILLAGES' 
                  ? 'bg-sky-600 text-white shadow-xs' 
                  : 'bg-white text-slate-700 border border-sky-200 hover:bg-sky-100'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>1. Villages</span>
            </button>

            <span className="text-slate-400">→</span>

            <button
              onClick={() => {
                if (selectedVillage) setCurrentStep('SHOPS');
                else toast.info('Please select a village first');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
                currentStep === 'SHOPS' 
                  ? 'bg-sky-600 text-white shadow-xs' 
                  : selectedVillage
                  ? 'bg-white text-slate-700 border border-sky-200 hover:bg-sky-100'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>2. Shop {selectedShop ? `(${selectedShop.name})` : ''}</span>
            </button>

            <span className="text-slate-400">→</span>

            <button
              onClick={() => {
                if (selectedShop) setCurrentStep('BILLING');
                else toast.info('Please select a shop first');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
                currentStep === 'BILLING' 
                  ? 'bg-sky-600 text-white shadow-xs' 
                  : selectedShop
                  ? 'bg-white text-slate-700 border border-sky-200 hover:bg-sky-100'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>3. Products {totalItemsCount > 0 ? `(${totalItemsCount})` : ''}</span>
            </button>

            <span className="text-slate-400">→</span>

            <button
              onClick={() => {
                if (cartItems.length > 0) setCurrentStep('PAYMENT');
                else toast.info('Please enter items in cart first');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
                currentStep === 'PAYMENT' 
                  ? 'bg-sky-600 text-white shadow-xs' 
                  : cartItems.length > 0
                  ? 'bg-white text-slate-700 border border-sky-200 hover:bg-sky-100'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>4. Payment {totalBillAmount > 0 ? `(₹${totalBillAmount})` : ''}</span>
            </button>

          </div>

          {activeShop && (
            <div className="hidden md:flex items-center gap-2 font-mono font-bold text-xs bg-white px-3 py-1 rounded-xl border border-sky-200">
              <span className="text-slate-500">Shop: <strong className="text-slate-900 font-black">{activeShop.name}</strong></span>
              <span className="text-slate-300">|</span>
              <span className="text-amber-700 font-black">Due: ₹{shopPreviousDue.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* MODAL CONTENT CONTAINER */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-sky-50/40">
          
          {/* ========================================================= */}
          {/* STEP 1: ALL VILLAGES LIST */}
          {/* ========================================================= */}
          {currentStep === 'VILLAGES' && (
            <div className="max-w-4xl mx-auto space-y-4">
              
              {/* Search & Stats Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border-2 border-sky-200 shadow-xs">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-sky-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={villageSearch}
                    onChange={(e) => setVillageSearch(e.target.value)}
                    placeholder="Search Village name (கிராமம் தேடுக)..."
                    className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm font-black bg-sky-50/60 border-2 border-sky-200 rounded-xl focus:outline-none focus:border-sky-600 focus:bg-white transition"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs font-black">
                  <span className="bg-sky-100 text-sky-900 px-3 py-1.5 rounded-xl border border-sky-200">
                    {villageGroups.length} Total Villages
                  </span>
                  <span className="bg-emerald-100 text-emerald-900 px-3 py-1.5 rounded-xl border border-emerald-200">
                    {shops.length} Total Retailer Shops
                  </span>
                </div>
              </div>

              {/* Village Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredVillages.length === 0 ? (
                  <div className="col-span-full text-center py-12 bg-white rounded-3xl border-2 border-dashed border-sky-200 p-6">
                    <MapPin className="w-12 h-12 text-sky-300 mx-auto mb-2" />
                    <h4 className="font-black text-base text-slate-800">No Villages Found</h4>
                    <p className="text-xs text-slate-500 mt-1">Try searching with another village name.</p>
                  </div>
                ) : (
                  filteredVillages.map(v => (
                    <div
                      key={v.id || v.name}
                      onClick={() => {
                        setSelectedVillage(v);
                        setCurrentStep('SHOPS');
                        setShopSearch('');
                      }}
                      className="group bg-white hover:bg-sky-50/80 p-4 rounded-2xl border-2 border-sky-200 hover:border-sky-500 shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-sky-100 group-hover:bg-sky-600 group-hover:text-white text-sky-800 flex items-center justify-center font-bold text-lg border border-sky-200 shrink-0 transition-colors shadow-2xs">
                          📍
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-sm sm:text-base text-slate-900 truncate group-hover:text-sky-900">
                            {v.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5 text-xs">
                            <span className="font-extrabold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-md border border-sky-200 text-[10px]">
                              🏪 {v.totalShops} Shops
                            </span>
                            {v.totalDue > 0 && (
                              <span className="font-mono font-extrabold text-amber-700 text-[10px]">
                                Due: ₹{v.totalDue.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="w-8 h-8 rounded-xl bg-sky-100 group-hover:bg-sky-600 text-sky-700 group-hover:text-white flex items-center justify-center shrink-0 transition-colors shadow-2xs">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 2: SHOPS IN SELECTED VILLAGE */}
          {/* ========================================================= */}
          {currentStep === 'SHOPS' && (
            <div className="max-w-4xl mx-auto space-y-4">
              
              {/* Back & Village Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-sky-700 to-indigo-800 p-4 rounded-2xl text-white shadow-md">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCurrentStep('VILLAGES')}
                    className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-black text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <div>
                    <h3 className="font-black text-base sm:text-lg text-white flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-sky-300" />
                      {selectedVillage?.name}
                    </h3>
                    <p className="text-[11px] text-sky-100 font-medium">Select a shop to begin store billing</p>
                  </div>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-sky-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={shopSearch}
                    onChange={(e) => setShopSearch(e.target.value)}
                    placeholder="Search shop name, owner, phone..."
                    className="w-full pl-10 pr-3 py-2 text-xs font-black bg-white text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />
                </div>
              </div>

              {/* Shops Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredVillageShops.length === 0 ? (
                  <div className="col-span-full text-center py-12 bg-white rounded-3xl border-2 border-dashed border-sky-200 p-6">
                    <Store className="w-12 h-12 text-sky-300 mx-auto mb-2" />
                    <h4 className="font-black text-base text-slate-800">No Shops Found</h4>
                    <p className="text-xs text-slate-500 mt-1">No shops match your search in {selectedVillage?.name}.</p>
                  </div>
                ) : (
                  filteredVillageShops.map(shop => {
                    const dueAmt = Number(shop.current_due || 0);
                    return (
                      <div
                        key={shop.id}
                        onClick={() => {
                          setSelectedShop(shop);
                          setCurrentStep('BILLING');
                          setProductSearch('');
                        }}
                        className="group bg-white hover:bg-sky-50/80 p-4 rounded-2xl border-2 border-sky-200 hover:border-sky-500 shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer flex flex-col justify-between gap-3 active:scale-[0.98]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-sky-100 group-hover:bg-sky-600 group-hover:text-white text-sky-800 flex items-center justify-center font-bold text-lg border border-sky-200 shrink-0 transition-colors shadow-2xs">
                            🏪
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-black text-sm sm:text-base text-slate-900 truncate group-hover:text-sky-900">
                              {shop.name}
                            </h4>
                            {shop.code && (
                              <span className="text-[10px] font-mono font-extrabold text-sky-800 bg-sky-100 px-2 py-0.5 rounded border border-sky-200 inline-block mt-0.5">
                                Code: #{shop.code}
                              </span>
                            )}
                            {shop.owner_name && (
                              <p className="text-xs text-slate-500 font-bold mt-1 truncate">
                                Owner: {shop.owner_name}
                              </p>
                            )}
                            {shop.phone && (
                              <p className="text-[10px] text-slate-400 font-mono">
                                📞 {shop.phone}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-sky-100 flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-500">Current Due:</span>
                          <span className={`font-mono font-black ${dueAmt > 0 ? 'text-rose-600 text-sm' : 'text-emerald-600'}`}>
                            {dueAmt > 0 ? `₹${dueAmt.toLocaleString()}` : '₹0.00 (Clear)'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3: PRODUCT SELECTION & POS ENTRY */}
          {/* ========================================================= */}
          {currentStep === 'BILLING' && (
            <div className="space-y-4">
              
              {/* Selected Shop Info & Search */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border-2 border-sky-200 shadow-xs">
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCurrentStep('SHOPS')}
                    className="p-2 rounded-xl bg-sky-100 text-sky-800 hover:bg-sky-200 font-black text-xs flex items-center gap-1 transition cursor-pointer border border-sky-200"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Change Shop</span>
                  </button>

                  <div>
                    <h3 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2">
                      <Store className="w-4 h-4 text-sky-600" />
                      {activeShop?.name}
                      {activeShop?.code && (
                        <span className="text-[10px] font-mono text-sky-700 bg-sky-100 px-2 py-0.5 rounded-lg border border-sky-200">
                          #{activeShop.code}
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-bold mt-0.5">
                      <span>📍 {selectedVillage?.name}</span>
                      <span>•</span>
                      <span className="text-amber-700">Due: ₹{shopPreviousDue.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                  <div className="relative flex-1 lg:w-72">
                    <Search className="w-4 h-4 text-sky-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search product name..."
                      className="w-full pl-10 pr-3 py-2 text-xs sm:text-sm font-black bg-sky-50/70 border-2 border-sky-200 rounded-xl focus:outline-none focus:border-sky-600 focus:bg-white transition"
                    />
                  </div>
                </div>

              </div>

              {/* Dynamic Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
                {categoriesList.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3.5 py-2 rounded-xl font-black text-xs whitespace-nowrap transition capitalize cursor-pointer ${
                      activeCategory === cat
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border-2 border-sky-200 hover:bg-sky-100'
                    }`}
                  >
                    {cat === 'all' ? 'All Products' : cat}
                  </button>
                ))}
              </div>

              {/* Products Grid Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredProducts.map(prod => {
                  const info = getProductStockInfo(prod);
                  const isOutOfStock = info.isOutOfStock;
                  const rawQty = isOutOfStock ? '' : (quantities[prod.id] ?? '');
                  const qtyNum = isOutOfStock ? 0 : (Number(rawQty) || 0);
                  const lineTotal = isOutOfStock ? 0 : Number((qtyNum * info.rate).toFixed(2));

                  return (
                    <div
                      key={prod.id}
                      className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 shadow-xs ${
                        isOutOfStock
                          ? 'bg-slate-100 border-slate-200 opacity-60'
                          : qtyNum > 0
                          ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-300'
                          : 'bg-white border-sky-200 hover:border-sky-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-white border-2 border-sky-100 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-2xs">
                          {prod.image_url ? (
                            <img src={prod.image_url} alt={prod.display_name} className="h-full w-full object-contain rounded-xl" />
                          ) : (
                            <span className="text-3xl">{prod.icon || '📦'}</span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-xs sm:text-sm text-slate-900 truncate">
                            {prod.display_name}
                          </h4>
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span className="font-mono font-black text-sky-900">
                              ₹{info.rate.toFixed(2)}/{info.shortUnit}
                            </span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                              isOutOfStock 
                                ? 'bg-rose-100 text-rose-800 border-rose-200' 
                                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}>
                              Stock: {info.availableStock} {info.unitLabel}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quantity Input Controls with Improved Font Size */}
                      <div className="pt-2 border-t border-sky-200/70 flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-slate-700">Enter Qty:</span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQtyChange(prod, (Number(qtyNum) || 0) - 1)}
                            disabled={isOutOfStock || qtyNum <= 0}
                            className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-black flex items-center justify-center transition active:scale-95 disabled:opacity-30 cursor-pointer"
                          >
                            <Minus className="w-4 h-4" />
                          </button>

                          <input
                            type="number"
                            min="0"
                            max={info.availableStock}
                            disabled={isOutOfStock}
                            placeholder={isOutOfStock ? '-' : '0'}
                            value={rawQty}
                            onChange={(e) => handleQtyChange(prod, e.target.value)}
                            className="w-16 h-9 text-center font-mono font-black text-sm sm:text-base bg-white border-2 border-sky-300 rounded-xl focus:outline-none focus:border-sky-600"
                          />

                          <button
                            type="button"
                            onClick={() => handleQtyChange(prod, (Number(qtyNum) || 0) + 1)}
                            disabled={isOutOfStock || qtyNum >= info.availableStock}
                            className="w-8 h-8 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black flex items-center justify-center transition active:scale-95 disabled:opacity-30 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="text-right min-w-[70px]">
                          <span className="font-mono font-black text-sm sm:text-base text-emerald-700 block">
                            ₹{lineTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Sticky Proceed Bar */}
              <div className="sticky bottom-0 bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 border-2 border-sky-900 z-20">
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                  <div>
                    <span className="text-xs text-sky-200 font-bold block">
                      Total {totalItemsCount} Products Selected
                    </span>
                    <span className="font-mono font-black text-xl sm:text-2xl text-emerald-400">
                      ₹{totalBillAmount.toFixed(2)}
                    </span>
                  </div>

                  {shopPreviousDue > 0 && (
                    <div className="text-right sm:text-left sm:ml-4 sm:pl-4 sm:border-l sm:border-slate-700">
                      <span className="text-[10px] text-amber-300 font-bold block">Shop Old Due:</span>
                      <span className="font-mono font-black text-sm text-amber-400">₹{shopPreviousDue.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (cartItems.length === 0) {
                      toast.error('Please enter quantity for at least 1 product!');
                      return;
                    }
                    setCurrentStep('PAYMENT');
                  }}
                  disabled={cartItems.length === 0}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer transition active:scale-95 disabled:opacity-40"
                >
                  <span>Proceed to Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 4: PAYMENT SCREEN & CREDIT ADJUSTMENT */}
          {/* ========================================================= */}
          {currentStep === 'PAYMENT' && (
            <div className="max-w-2xl mx-auto space-y-4">
              
              {/* Back to Products */}
              <button
                onClick={() => setCurrentStep('BILLING')}
                className="p-2 px-3 rounded-xl bg-white border-2 border-sky-200 text-sky-800 hover:bg-sky-100 font-black text-xs flex items-center gap-1 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>← Back to Products</span>
              </button>

              {/* Total Payable Summary Card */}
              <div className="bg-white p-5 rounded-3xl border-2 border-sky-300 shadow-sm text-center space-y-1">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {includeOldCredit ? 'Total Payable (பில் + பழைய கடன்)' : 'Total Bill Amount (பில் தொகை)'}
                </span>
                <div className="font-mono font-black text-3xl sm:text-4xl text-emerald-600">
                  ₹{payableAmount.toFixed(2)}
                </div>
                {includeOldCredit && (
                  <div className="text-xs font-bold text-slate-500 flex items-center justify-center gap-2 pt-1 font-mono">
                    <span>Bill: ₹{totalBillAmount.toFixed(2)}</span>
                    <span>+</span>
                    <span className="text-amber-700 font-black">Old Credit: ₹{shopPreviousDue.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Old Credit Due Selection Option */}
              {shopPreviousDue > 0 && (
                <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-black text-amber-900 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      OLD CREDIT DUE (பழைய பாக்கி கடன்):
                    </span>
                    <span className="font-mono font-black text-amber-800 text-sm">₹{shopPreviousDue.toFixed(2)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5 text-xs font-black">
                    <button
                      type="button"
                      onClick={() => setIncludeOldCredit(false)}
                      className={`py-2.5 px-2 rounded-xl transition text-center cursor-pointer ${
                        !includeOldCredit
                          ? 'bg-white text-slate-900 border-2 border-slate-800 shadow-sm'
                          : 'bg-white/60 text-slate-600 border border-slate-200'
                      }`}
                    >
                      <div>பில் மட்டும்</div>
                      <div className="font-mono text-[10px] text-slate-500">₹{totalBillAmount.toFixed(2)}</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeOldCredit(true)}
                      className={`py-2.5 px-2 rounded-xl transition text-center cursor-pointer ${
                        includeOldCredit
                          ? 'bg-emerald-600 text-white border-2 border-emerald-600 shadow-sm'
                          : 'bg-white/60 text-amber-900 border border-amber-300'
                      }`}
                    >
                      <div>⚡ கடன் சேர்த்து செலுத்து</div>
                      <div className="font-mono text-[10px] text-emerald-100">₹{(totalBillAmount + shopPreviousDue).toFixed(2)}</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Payment Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Select Payment Mode (பணம் செலுத்தும் முறை)
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('CASH')}
                    className={`p-3 rounded-2xl border-2 font-black text-xs flex flex-col items-center gap-1.5 transition cursor-pointer ${
                      paymentMode === 'CASH'
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                        : 'bg-white border-sky-200 text-slate-800 hover:bg-sky-50'
                    }`}
                  >
                    <Banknote className="w-5 h-5" />
                    <span>CASH (ரொக்கம்)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('GPAY')}
                    className={`p-3 rounded-2xl border-2 font-black text-xs flex flex-col items-center gap-1.5 transition cursor-pointer ${
                      paymentMode === 'GPAY'
                        ? 'bg-sky-600 border-sky-600 text-white shadow-md'
                        : 'bg-white border-sky-200 text-slate-800 hover:bg-sky-50'
                    }`}
                  >
                    <Smartphone className="w-5 h-5" />
                    <span>GPAY / UPI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIncludeOldCredit(false);
                      setPaymentMode('CREDIT');
                    }}
                    className={`p-3 rounded-2xl border-2 font-black text-xs flex flex-col items-center gap-1.5 transition cursor-pointer ${
                      paymentMode === 'CREDIT'
                        ? 'bg-amber-600 border-amber-600 text-white shadow-md'
                        : 'bg-white border-sky-200 text-slate-800 hover:bg-sky-50'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span>CREDIT (கடன்)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('SPLIT')}
                    className={`p-3 rounded-2xl border-2 font-black text-xs flex flex-col items-center gap-1.5 transition cursor-pointer ${
                      paymentMode === 'SPLIT'
                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                        : 'bg-white border-sky-200 text-slate-800 hover:bg-sky-50'
                    }`}
                  >
                    <Split className="w-5 h-5" />
                    <span>SPLIT (பிரித்து)</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Split Panel */}
              {paymentMode === 'SPLIT' && (
                <div className="bg-white p-4 rounded-2xl border-2 border-purple-200 space-y-3 shadow-sm">
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-sky-50 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSplitOption('CASH_GPAY')}
                      className={`py-2 px-1 rounded-lg text-xs font-black transition cursor-pointer ${
                        splitOption === 'CASH_GPAY' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      💵 Cash + 📱 GPay
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitOption('CASH_CREDIT')}
                      className={`py-2 px-1 rounded-lg text-xs font-black transition cursor-pointer ${
                        splitOption === 'CASH_CREDIT' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      💵 Cash + 💳 Credit
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitOption('GPAY_CREDIT')}
                      className={`py-2 px-1 rounded-lg text-xs font-black transition cursor-pointer ${
                        splitOption === 'GPAY_CREDIT' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      📱 GPay + 💳 Credit
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* Primary input based on option */}
                    {(splitOption === 'CASH_GPAY' || splitOption === 'CASH_CREDIT') && (
                      <div className="flex items-center justify-between bg-sky-50 p-2.5 rounded-xl border border-sky-200">
                        <span className="font-black text-slate-800">Cash Received:</span>
                        <input
                          type="number"
                          value={cashReceived}
                          onChange={(e) => handleCashChange(e.target.value)}
                          className="w-28 p-1.5 font-mono font-black text-sm bg-white border-2 border-sky-300 rounded-lg text-right"
                        />
                      </div>
                    )}

                    {splitOption === 'GPAY_CREDIT' && (
                      <div className="flex items-center justify-between bg-sky-50 p-2.5 rounded-xl border border-sky-200">
                        <span className="font-black text-slate-800">GPay Received:</span>
                        <input
                          type="number"
                          value={gpayReceived}
                          onChange={(e) => handleGpayChange(e.target.value)}
                          className="w-28 p-1.5 font-mono font-black text-sm bg-white border-2 border-sky-300 rounded-lg text-right"
                        />
                      </div>
                    )}

                    {/* Secondary auto calculation */}
                    {splitOption === 'CASH_GPAY' && (
                      <div className="flex items-center justify-between bg-sky-50 p-2.5 rounded-xl border border-sky-200">
                        <span className="font-black text-sky-800">GPay Auto Remaining:</span>
                        <span className="font-mono font-black text-sm text-sky-900">₹{numGpay.toFixed(2)}</span>
                      </div>
                    )}

                    {(splitOption === 'CASH_CREDIT' || splitOption === 'GPAY_CREDIT') && (
                      <div className="flex items-center justify-between bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                        <span className="font-black text-amber-800">Credit Auto Added to Dues:</span>
                        <span className="font-mono font-black text-sm text-amber-900">₹{numCredit.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Submit Button */}
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting || (paymentBalance !== 0 && paymentMode !== 'CREDIT')}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-700/30 cursor-pointer transition active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>GENERATING BILL & UPDATING LEDGER...</span>
                  </div>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>GENERATE SHOP BILL & PRINT (பில் அச்சிடு)</span>
                  </>
                )}
              </button>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
