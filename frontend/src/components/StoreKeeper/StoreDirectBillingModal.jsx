import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { getOperationalUnit } from '../../utils/unitHelper';
import { sortProductsCustom } from '../../utils/productOrderHelper';
import { 
  X, ShoppingBag, Plus, Minus, CheckCircle2, 
  CreditCard, DollarSign, Smartphone, Trash2, ArrowRightLeft, Sparkles,
  ArrowRight, ShoppingCart
} from 'lucide-react';
import { toast } from 'sonner';

const PRODUCT_GROUPS = [
  {
    id: 'milk',
    title: 'Milk (பால்)',
    productIds: [1, 5, 6]
  },
  {
    id: 'curd',
    title: 'Curd (தயிர்)',
    productIds: [7, 8, 9]
  },
  {
    id: 'coccola',
    title: 'Coccola (கூலா)',
    productIds: [10, 3, 11]
  },
  {
    id: 'juice',
    title: 'Juice (ஜூஸ்)',
    productIds: [12]
  },
  {
    id: 'tata',
    title: 'Tata Drink',
    productIds: [15]
  },
  {
    id: 'water',
    title: 'Water Bottle (தண்ணீர்)',
    productIds: [18, 19, 2, 20]
  }
];

const PRODUCT_IMAGES = {
  1: { image: '/images/amirthaa_milk_200ml.png', sizeBadge: '200 ml' },
  5: { image: '/images/amirthaa_milk_500ml.png', sizeBadge: '500 ml' },
  6: { image: '/images/amirthaa_milk_1l.jpg', sizeBadge: '1 Ltr' },
  7: { image: '/images/amirthaa_curd_200ml.jpg', sizeBadge: '200 ml' },
  8: { image: '/images/amirthaa_curd_500ml.jpg', sizeBadge: '500 ml' },
  9: { image: '/images/amirthaa_curd_1l.jpg', sizeBadge: '1 Ltr' },
  10: { image: '/images/coccola_200ml.png', sizeBadge: '200 ml' },
  3: { image: '/images/coccola_500ml.png', sizeBadge: '500 ml' },
  11: { image: '/images/coccola_1l.png', sizeBadge: '1 Ltr' },
  12: { image: '/images/juice_hero.jpg', sizeBadge: 'Fresh Pack' },
  15: { image: '/images/tata_hero.jpg', sizeBadge: 'Gluco Can' },
  18: { image: '/images/aquafresh_water_200ml.png', sizeBadge: '200 ml' },
  19: { image: '/images/aquafresh_water_500ml.png', sizeBadge: '500 ml' },
  2: { image: '/images/aquafresh_water_1l.png', sizeBadge: '1 Ltr' },
  20: { image: '/images/aquafresh_water_2l.png', sizeBadge: '2 Ltr' }
};

export const StoreDirectBillingModal = ({ onClose, onBillGenerated }) => {
  const { products = [], createSale } = useApp();
  
  const activeProducts = useMemo(() => {
    return sortProductsCustom((products || []).filter(p => p.is_active !== false && p.is_active !== 0));
  }, [products]);

  const [activeCategory, setActiveCategory] = useState('all');
  const [mobileTab, setMobileTab] = useState('products'); // 'products' | 'cart'
  const [cart, setCart] = useState({}); // { [prodId]: { product, qty, unit_type, rate, amount } }
  const [paymentMode, setPaymentMode] = useState('CASH'); // CASH, GPAY, CREDIT, SPLIT
  const [cashAmount, setCashAmount] = useState('');
  const [gpayAmount, setGpayAmount] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'all') return activeProducts;
    const group = PRODUCT_GROUPS.find(g => g.id === activeCategory);
    if (!group) return activeProducts;
    return activeProducts.filter(p => group.productIds.includes(p.id));
  }, [activeProducts, activeCategory]);

  const getProductStockInfo = (prod) => {
    const opUnit = getOperationalUnit(prod);
    const ppu = Math.max(1, Number(prod.pieces_per_unit || 1));
    const whUnits = Number(prod.warehouse_stock_units || 0);
    const directSaleRate = Number(prod.direct_sale_rate || 0);

    if (opUnit.isPieceBased) {
      const maxAvailable = Math.floor(whUnits * ppu);
      const fallbackRate = Number(prod.piece_selling_price || (Number(prod.unit_selling_price || 0) / ppu) || 0);
      const rate = directSaleRate > 0 ? directSaleRate : fallbackRate;
      return {
        opUnit,
        maxAvailable,
        rate,
        unitType: 'Piece',
        displayUnit: 'Piece',
        pluralUnit: 'Pieces'
      };
    } else {
      const maxAvailable = whUnits;
      const fallbackRate = Number(prod.unit_selling_price || (Number(prod.piece_selling_price || 0) * ppu) || 0);
      const rate = directSaleRate > 0 ? directSaleRate : fallbackRate;
      return {
        opUnit,
        maxAvailable,
        rate,
        unitType: opUnit.operationalUnit,
        displayUnit: opUnit.operationalUnit,
        pluralUnit: opUnit.pluralLabel
      };
    }
  };

  const getAvailablePieces = (prod) => {
    return getProductStockInfo(prod).maxAvailable;
  };

  const handleQtyChange = (product, newQty) => {
    const qty = Math.max(0, parseInt(newQty || 0, 10));
    const info = getProductStockInfo(product);

    if (qty > info.maxAvailable) {
      toast.error(`⚠️ Warehouse Stock Limit Exceeded! Available Stock for ${product.display_name}: ${info.maxAvailable} ${info.pluralUnit}`);
      return;
    }

    setCart(prev => {
      if (qty <= 0) {
        const next = { ...prev };
        delete next[product.id];
        return next;
      }
      return {
        ...prev,
        [product.id]: {
          product,
          qty,
          unit_type: info.unitType,
          display_unit: info.displayUnit,
          rate: info.rate,
          amount: qty * info.rate
        }
      };
    });
  };

  const cartList = useMemo(() => Object.values(cart), [cart]);

  const totalAmount = useMemo(() => {
    return cartList.reduce((sum, item) => sum + item.amount, 0);
  }, [cartList]);

  const totalItemsCount = useMemo(() => {
    return cartList.reduce((sum, item) => sum + item.qty, 0);
  }, [cartList]);

  const handlePaymentModeSelect = (mode) => {
    setPaymentMode(mode);
    if (mode === 'SPLIT') {
      setCashAmount(String(totalAmount));
      setGpayAmount('');
      setCreditAmount('');
    }
  };

  // Real-time Auto-balancing Cash Input Handler
  const handleCashChange = (val) => {
    const clean = val.replace(/[^\d]/g, '');
    setCashAmount(clean);
    const cashVal = Number(clean || 0);
    const remaining = Math.max(0, totalAmount - cashVal);
    
    const currentGpay = Number(gpayAmount || 0);
    if (currentGpay > 0) {
      const nextGpay = Math.min(currentGpay, remaining);
      setGpayAmount(nextGpay > 0 ? String(nextGpay) : '');
      const nextCredit = Math.max(0, remaining - nextGpay);
      setCreditAmount(nextCredit > 0 ? String(nextCredit) : '');
    } else {
      setCreditAmount(remaining > 0 ? String(remaining) : '');
    }
  };

  // Real-time Auto-balancing GPay Input Handler
  const handleGpayChange = (val) => {
    const clean = val.replace(/[^\d]/g, '');
    setGpayAmount(clean);
    const cashVal = Number(cashAmount || 0);
    const gpayVal = Number(clean || 0);
    const remainingCredit = Math.max(0, totalAmount - (cashVal + gpayVal));
    setCreditAmount(remainingCredit > 0 ? String(remainingCredit) : '');
  };

  // Real-time Auto-balancing Credit Input Handler
  const handleCreditChange = (val) => {
    const clean = val.replace(/[^\d]/g, '');
    setCreditAmount(clean);
    const cashVal = Number(cashAmount || 0);
    const creditVal = Number(clean || 0);
    const remainingGpay = Math.max(0, totalAmount - (cashVal + creditVal));
    setGpayAmount(remainingGpay > 0 ? String(remainingGpay) : '');
  };

  const splitSum = useMemo(() => {
    return Number(cashAmount || 0) + Number(gpayAmount || 0) + Number(creditAmount || 0);
  }, [cashAmount, gpayAmount, creditAmount]);

  const handleSubmitBill = async () => {
    if (submitting) return;

    if (cartList.length === 0) {
      toast.error("Please add at least 1 product to generate a bill!");
      return;
    }

    // Validate Quantity & Live Stock Availability before submission
    for (const item of cartList) {
      const available = getAvailablePieces(item.product);
      const qty = parseInt(item.qty, 10);
      if (isNaN(qty) || qty <= 0) {
        toast.error(`Invalid quantity for ${item.product.display_name}. Must be at least 1 piece.`);
        return;
      }
      if (qty > available) {
        toast.error(`Insufficient warehouse stock for ${item.product.display_name}! Available: ${available} Pcs, Attempted: ${qty} Pcs`);
        return;
      }
    }

    if (totalAmount <= 0) {
      toast.error("Bill total amount must be greater than zero!");
      return;
    }

    let finalCash = 0;
    let finalGpay = 0;
    let finalCredit = 0;

    // Payment mode & cash/split validation
    if (paymentMode === 'CASH') {
      finalCash = totalAmount;
    } else if (paymentMode === 'GPAY') {
      finalGpay = totalAmount;
    } else if (paymentMode === 'CREDIT') {
      finalCredit = totalAmount;
    } else if (paymentMode === 'SPLIT') {
      finalCash = Number(cashAmount || 0);
      finalGpay = Number(gpayAmount || 0);
      finalCredit = Number(creditAmount || 0);
      
      const sum = parseFloat((finalCash + finalGpay + finalCredit).toFixed(2));
      if (Math.abs(sum - totalAmount) > 0.05) {
        toast.error(`Split payment total (₹${sum}) does not match bill total (₹${totalAmount})! Please balance split amounts.`);
        return;
      }
    } else {
      toast.error(`Invalid payment mode selected: ${paymentMode}`);
      return;
    }

    const idempotencyKey = 'POS-SK-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

    const salePayload = {
      is_store_direct_sale: true,
      sale_type: 'STOREKEEPER_DIRECT',
      shop_name: 'AVS AGENCIES',
      customer_name: 'Walk-in Counter Customer',
      employee_id: null,
      employee_name: 'Store Keeper',
      vehicle_no: 'Warehouse Counter',
      payment_mode: paymentMode,
      cash_paid: finalCash,
      gpay_paid: finalGpay,
      credit_paid: finalCredit,
      total_amount: totalAmount,
      idempotency_key: idempotencyKey,
      client_reference: idempotencyKey,
      items: cartList.map(item => ({
        product_id: item.product.id,
        product_name: item.product.display_name,
        unit_type: 'Piece',
        qty: parseInt(item.qty, 10),
        rate: item.rate,
        amount: parseFloat((parseInt(item.qty, 10) * item.rate).toFixed(2))
      }))
    };

    setSubmitting(true);
    try {
      const res = await createSale(salePayload);
      if (res && res.success) {
        const fullSale = {
          ...res.sale,
          items: res.items || res.sale?.items || cartList.map(i => ({
            product_id: i.product.id,
            product_name: i.product.display_name,
            qty: i.qty,
            rate: i.rate,
            amount: i.amount,
            unit_type: 'Piece'
          }))
        };
        toast.success(`🎉 Direct Store Bill #${fullSale.bill_no || fullSale.id} generated successfully! Warehouse stock updated.`);
        onClose();
        if (onBillGenerated) {
          onBillGenerated(fullSale);
        }
      } else {
        toast.error(`Failed to generate bill: ${res?.message || 'Transaction rejected by server.'}`);
      }
    } catch (err) {
      toast.error(`Transaction Error: ${err.message || 'Server connection failure'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-1 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl max-w-5xl w-full h-[98dvh] sm:h-[94dvh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between p-3 sm:p-4 sm:px-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-xs">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="font-black text-xs sm:text-base text-white truncate">
                  STORE KEEPER DIRECT POS BILLING
                </h3>
                <span className="hidden sm:inline text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Live Stock
                </span>
                <span className="hidden sm:inline text-[10px] bg-blue-500/20 text-blue-300 font-extrabold px-2 py-0.5 rounded-full border border-blue-400/30">
                  AVS AGENCIES
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-300 truncate">Select items & generate counter bills</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0 ml-2"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Mobile View Switcher Tabs (Only visible on screens < lg) */}
        <div className="flex lg:hidden bg-slate-100 p-1 border-b border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab('products')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              mobileTab === 'products'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
            <span>Products ({filteredProducts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              mobileTab === 'cart'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
            <span>Cart ({cartList.length})</span>
            {totalAmount > 0 && (
              <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-md font-black ml-0.5">
                ₹{totalAmount}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body Layout (Desktop: Side-by-Side 7/5 cols; Mobile: Active Tab) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-0">
          
          {/* LEFT: Product Selection Grid */}
          <div className={`${mobileTab === 'products' ? 'flex' : 'hidden'} lg:flex lg:col-span-7 p-2.5 sm:p-4 border-b lg:border-b-0 lg:border-r border-slate-200 flex-col gap-2 sm:gap-3 bg-slate-50/70 overflow-y-auto min-h-0`}>
            
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 shrink-0 no-scrollbar">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition cursor-pointer ${
                  activeCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                All ({activeProducts.length})
              </button>

              {PRODUCT_GROUPS.map(group => (
                <button
                  key={group.id}
                  onClick={() => setActiveCategory(group.id)}
                  className={`px-3 py-1.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition cursor-pointer ${
                    activeCategory === group.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {group.title}
                </button>
              ))}
            </div>

            {/* Product Cards List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 overflow-y-auto pr-0.5 pb-16 lg:pb-0">
              {filteredProducts.map(prod => {
                const actualImage = prod.image_url || prod.image || (PRODUCT_IMAGES[prod.id]?.image) || '';
                const meta = {
                  image: actualImage,
                  sizeBadge: prod.selling_unit || (PRODUCT_IMAGES[prod.id]?.sizeBadge) || 'Item'
                };
                const stockInfo = getProductStockInfo(prod);
                const availablePcs = stockInfo.maxAvailable;
                const currentQty = cart[prod.id]?.qty || '';

                return (
                  <div 
                    key={prod.id} 
                    className={`bg-white rounded-2xl p-2.5 sm:p-3 border transition-all flex flex-col justify-between shadow-2xs ${
                      currentQty > 0 ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20' : 'border-slate-200 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex gap-2.5 sm:gap-3">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/90 border border-slate-200 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-2xs">
                        {meta.image ? (
                          <img src={meta.image} alt={prod.display_name} className="h-full w-full object-contain drop-shadow-xs" />
                        ) : (
                          <span className="text-2xl sm:text-3xl">{prod.icon || '📦'}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[9px] sm:text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                              {meta.sizeBadge}
                            </span>
                            <span className="font-mono font-black text-xs sm:text-sm text-slate-900">
                              ₹{stockInfo.rate.toFixed(2)}/pc
                            </span>
                          </div>

                          <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 truncate mt-0.5">
                            {prod.display_name}
                          </h4>
                        </div>

                        <div className="flex items-center justify-between text-[10px] mt-1">
                          <span className="text-slate-500 font-bold">Store Stock:</span>
                          <span className={`font-mono font-black ${availablePcs > 10 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {prod.warehouse_stock_units} Trays ({availablePcs} Pcs)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quantity Input Controls */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold text-slate-700">Qty:</span>
                      
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQtyChange(prod, (Number(currentQty) || 0) - 1)}
                          className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center font-black transition active:scale-95 disabled:opacity-30 cursor-pointer"
                          disabled={!currentQty || Number(currentQty) <= 0}
                        >
                          <Minus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        </button>

                        <input
                          type="number"
                          min="0"
                          max={availablePcs}
                          placeholder="0"
                          value={currentQty}
                          onChange={(e) => handleQtyChange(prod, e.target.value)}
                          className="w-14 h-8 sm:h-7 text-center font-mono font-black text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                        />

                        <button
                          type="button"
                          onClick={() => handleQtyChange(prod, (Number(currentQty) || 0) + 1)}
                          className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-black transition active:scale-95 disabled:opacity-30 cursor-pointer"
                          disabled={availablePcs <= (Number(currentQty) || 0)}
                        >
                          <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sticky Floating Bottom Bar on Mobile (when items in cart and on products tab) */}
            {cartList.length > 0 && (
              <div className="lg:hidden fixed bottom-2 left-2 right-2 z-40 bg-slate-900 text-white p-2.5 px-4 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-800 animate-in slide-in-from-bottom duration-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black">{totalItemsCount} Pcs Selected</div>
                    <div className="text-emerald-400 font-mono font-black text-sm">₹{totalAmount.toLocaleString()}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileTab('cart')}
                  className="py-2 px-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <span>Pay Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: Cart & Dynamic Split Payment Controls */}
          <div className={`${mobileTab === 'cart' ? 'flex' : 'hidden'} lg:flex lg:col-span-5 p-3 sm:p-4 flex-col justify-between bg-white overflow-y-auto space-y-3 sm:space-y-4 min-h-0`}>
            
            {/* Cart Items List Container */}
            <div className="flex-1 space-y-2 flex flex-col min-h-0">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 shrink-0">
                <h4 className="font-black text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4 text-blue-600" />
                  Cart Items
                </h4>
                <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  {cartList.length} Selected ({totalItemsCount} Pcs)
                </span>
              </div>

              {cartList.length === 0 ? (
                <div className="flex-1 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-slate-400 min-h-[140px]">
                  <ShoppingBag className="w-9 h-9 stroke-[1.5] text-slate-300 mb-1.5" />
                  <p className="text-xs font-bold text-slate-600">Cart is Empty</p>
                  <p className="text-[10px] text-slate-400">Add products to start counter billing</p>
                  <button
                    type="button"
                    onClick={() => setMobileTab('products')}
                    className="lg:hidden mt-3 px-4 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Browse Products
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 sm:max-h-56 overflow-y-auto pr-1 flex-1">
                  {cartList.map(item => (
                    <div key={item.product.id} className="flex items-center justify-between text-xs bg-slate-50 p-2 sm:p-2.5 rounded-xl border border-slate-200">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-extrabold text-slate-900 truncate">{item.product.display_name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {item.qty} Pcs x ₹{item.rate}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900">₹{item.amount}</span>
                        <button
                          type="button"
                          onClick={() => handleQtyChange(item.product, 0)}
                          className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Section & Auto-Balancing Split Panel */}
            <div className="space-y-2.5 sm:space-y-3 bg-slate-900 text-white p-3 sm:p-4 rounded-2xl shadow-md shrink-0">
              
              {/* Grand Total Bar */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Grand Total:</span>
                <span className="font-mono font-black text-xl sm:text-2xl text-emerald-400">₹{totalAmount.toLocaleString()}</span>
              </div>

              {/* Payment Mode Selector Buttons */}
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-1">Payment Method:</label>
                <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePaymentModeSelect('CASH')}
                    className={`py-2 px-1 rounded-xl text-[10px] sm:text-[11px] font-black flex flex-col sm:flex-row items-center justify-center gap-1 border transition cursor-pointer ${
                      paymentMode === 'CASH' 
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm' 
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" /> <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePaymentModeSelect('GPAY')}
                    className={`py-2 px-1 rounded-xl text-[10px] sm:text-[11px] font-black flex flex-col sm:flex-row items-center justify-center gap-1 border transition cursor-pointer ${
                      paymentMode === 'GPAY' 
                        ? 'bg-blue-500 text-white border-blue-400 shadow-sm' 
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> <span>GPay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePaymentModeSelect('CREDIT')}
                    className={`py-2 px-1 rounded-xl text-[10px] sm:text-[11px] font-black flex flex-col sm:flex-row items-center justify-center gap-1 border transition cursor-pointer ${
                      paymentMode === 'CREDIT' 
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm' 
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" /> <span>Credit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePaymentModeSelect('SPLIT')}
                    className={`py-2 px-1 rounded-xl text-[10px] sm:text-[11px] font-black flex flex-col sm:flex-row items-center justify-center gap-1 border transition cursor-pointer ${
                      paymentMode === 'SPLIT' 
                        ? 'bg-purple-500 text-white border-purple-400 shadow-sm' 
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" /> <span>Split</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Auto-Balancing Input Panel when SPLIT Mode is active */}
              {paymentMode === 'SPLIT' && (
                <div className="space-y-2 bg-slate-800/90 p-2.5 sm:p-3 rounded-xl border border-purple-500/40">
                  <div className="flex items-center justify-between text-[10px] font-extrabold text-purple-300 uppercase border-b border-slate-700 pb-1">
                    <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> Auto-balancing Split</span>
                    <span>Total: ₹{totalAmount}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-xs">
                    {/* Cash Input */}
                    <div>
                      <label className="text-[9px] font-extrabold text-emerald-400 uppercase block mb-0.5">Cash:</label>
                      <input
                        type="text"
                        placeholder="0"
                        value={cashAmount}
                        onChange={(e) => handleCashChange(e.target.value)}
                        className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg p-1.5 font-mono font-black text-xs text-emerald-400 focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    {/* GPay Input */}
                    <div>
                      <label className="text-[9px] font-extrabold text-blue-400 uppercase block mb-0.5">GPay:</label>
                      <input
                        type="text"
                        placeholder="0"
                        value={gpayAmount}
                        onChange={(e) => handleGpayChange(e.target.value)}
                        className="w-full bg-slate-900 border border-blue-500/50 rounded-lg p-1.5 font-mono font-black text-xs text-blue-400 focus:outline-none focus:border-blue-400"
                      />
                    </div>

                    {/* Credit Input */}
                    <div>
                      <label className="text-[9px] font-extrabold text-amber-400 uppercase block mb-0.5">Credit:</label>
                      <input
                        type="text"
                        placeholder="0"
                        value={creditAmount}
                        onChange={(e) => handleCreditChange(e.target.value)}
                        className="w-full bg-slate-900 border border-amber-500/50 rounded-lg p-1.5 font-mono font-black text-xs text-amber-400 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Real-time Match Status Badge */}
                  <div className="text-[10px] font-bold flex items-center justify-between pt-0.5">
                    {splitSum === totalAmount ? (
                      <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                        ✓ Matched (₹{splitSum} / ₹{totalAmount})
                      </span>
                    ) : (
                      <span className="text-amber-300 font-extrabold flex items-center gap-1 text-[9px]">
                        ⚠️ Auto Remaining: ₹{Math.max(0, totalAmount - splitSum)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Action Submit Button */}
              <button
                type="button"
                onClick={handleSubmitBill}
                disabled={submitting || cartList.length === 0}
                className="w-full py-3 sm:py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50 cursor-pointer active:scale-[0.98]"
              >
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>{submitting ? 'GENERATING BILL...' : 'GENERATE BILL & DEDUCT STOCK'}</span>
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
