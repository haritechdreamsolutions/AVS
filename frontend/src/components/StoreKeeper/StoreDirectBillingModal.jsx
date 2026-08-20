import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, ShoppingBag, Plus, Minus, CheckCircle2, 
  CreditCard, DollarSign, Smartphone, Trash2, ArrowRightLeft, Sparkles 
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
  const { products, createSale } = useApp();
  
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState({}); // { [prodId]: { qty, unit_type: 'Piece' } }
  const [paymentMode, setPaymentMode] = useState('CASH'); // CASH, GPAY, CREDIT, SPLIT
  const [cashAmount, setCashAmount] = useState('');
  const [gpayAmount, setGpayAmount] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'all') return products;
    const group = PRODUCT_GROUPS.find(g => g.id === activeCategory);
    if (!group) return products;
    return products.filter(p => group.productIds.includes(p.id));
  }, [products, activeCategory]);

  const getAvailablePieces = (prod) => {
    return Math.floor((prod.warehouse_stock_units || 0) * (prod.pieces_per_unit || 1));
  };

  const handleQtyChange = (product, newQty) => {
    const qty = Math.max(0, parseInt(newQty || 0, 10));
    const maxPieces = getAvailablePieces(product);

    if (qty > maxPieces) {
      toast.error(`⚠️ Warehouse Stock Limit Exceeded! Available Stock for ${product.display_name}: ${maxPieces} Pcs`);
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
          unit_type: 'Piece',
          rate: product.piece_selling_price || product.unit_selling_price || 0,
          amount: qty * (product.piece_selling_price || product.unit_selling_price || 0)
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
    if (cartList.length === 0) {
      toast.error("Please add at least 1 product to generate a bill!");
      return;
    }

    let finalCash = 0;
    let finalGpay = 0;
    let finalCredit = 0;

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
      
      const sum = finalCash + finalGpay + finalCredit;
      if (sum < totalAmount) {
        finalCredit += (totalAmount - sum);
      }
    }

    const salePayload = {
      is_store_direct_sale: true,
      shop_name: 'Walk-in Counter Customer',
      customer_name: 'Walk-in Customer',
      employee_id: 6,
      employee_name: 'Store Keeper',
      vehicle_no: 'Warehouse Counter',
      payment_mode: paymentMode,
      cash_paid: finalCash,
      gpay_paid: finalGpay,
      credit_paid: finalCredit,
      total_amount: totalAmount,
      items: cartList.map(item => ({
        product_id: item.product.id,
        product_name: item.product.display_name,
        unit_type: 'Piece',
        qty: item.qty,
        rate: item.rate,
        amount: item.amount
      }))
    };

    setSubmitting(true);
    try {
      const res = await createSale(salePayload);
      if (res.success) {
        toast.success(`🎉 Direct Store Bill #${res.sale.bill_no} generated successfully! Stock updated.`);
        onClose();
        if (onBillGenerated) {
          onBillGenerated(res.sale);
        }
      } else {
        toast.error(`Failed to generate bill: ${res.message}`);
      }
    } catch (err) {
      toast.error(`Error: ${err.message || 'Server error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white flex items-center gap-2">
                STORE KEEPER DIRECT POS BILLING
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  Real-time Warehouse Stock
                </span>
              </h3>
              <p className="text-xs text-slate-300">Select items, enter quantity, and generate counter bills instantly</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Layout (Left: Products Grid 7 Cols, Right: Cart & Split Payment 5 Cols) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          
          {/* LEFT: Product Selection Grid */}
          <div className="lg:col-span-7 p-4 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col gap-3 bg-slate-50/60 overflow-y-auto min-h-[300px]">
            
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none shrink-0">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition ${
                  activeCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                All Products ({products.length})
              </button>

              {PRODUCT_GROUPS.map(group => (
                <button
                  key={group.id}
                  onClick={() => setActiveCategory(group.id)}
                  className={`px-3 py-1.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition ${
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-1">
              {filteredProducts.map(prod => {
                const meta = PRODUCT_IMAGES[prod.id] || {
                  image: prod.image || '/images/milk_200ml.svg',
                  sizeBadge: prod.selling_unit || 'Item'
                };
                const availablePcs = getAvailablePieces(prod);
                const currentQty = cart[prod.id]?.qty || '';

                return (
                  <div 
                    key={prod.id} 
                    className={`bg-white rounded-2xl p-3 border transition-all flex flex-col justify-between shadow-xs ${
                      currentQty > 0 ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30' : 'border-slate-200 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/90 border border-slate-200 flex items-center justify-center p-1.5 shrink-0 overflow-hidden shadow-2xs">
                        {meta.image ? (
                          <img src={meta.image} alt={prod.display_name} className="h-full w-full object-contain drop-shadow-sm" />
                        ) : (
                          <span className="text-3xl">{prod.icon || '📦'}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                            {meta.sizeBadge}
                          </span>
                          <span className="font-mono font-black text-xs text-slate-800">
                            ₹{prod.piece_selling_price || prod.unit_selling_price}/pc
                          </span>
                        </div>

                        <h4 className="font-extrabold text-xs text-slate-900 truncate mt-1">
                          {prod.display_name}
                        </h4>

                        <div className="flex items-center justify-between text-[10px] mt-1.5">
                          <span className="text-slate-500 font-bold">Store Stock:</span>
                          <span className={`font-mono font-black ${availablePcs > 10 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {prod.warehouse_stock_units} Trays ({availablePcs} Pcs)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quantity Input Controls */}
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold text-slate-600">Qty (Pcs):</span>
                      
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleQtyChange(prod, (Number(currentQty) || 0) - 1)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black transition disabled:opacity-30"
                          disabled={!currentQty || Number(currentQty) <= 0}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <input
                          type="number"
                          min="0"
                          max={availablePcs}
                          placeholder="0"
                          value={currentQty}
                          onChange={(e) => handleQtyChange(prod, e.target.value)}
                          className="w-14 h-7 text-center font-mono font-black text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                        />

                        <button
                          type="button"
                          onClick={() => handleQtyChange(prod, (Number(currentQty) || 0) + 1)}
                          className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-black transition disabled:opacity-30"
                          disabled={availablePcs <= (Number(currentQty) || 0)}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Cart & Dynamic Split Payment Controls */}
          <div className="lg:col-span-5 p-4 flex flex-col justify-between bg-white overflow-y-auto space-y-4">
            
            {/* Cart Items List Container */}
            <div className="flex-1 space-y-2 flex flex-col min-h-[160px]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 shrink-0">
                <h4 className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                  Cart Items
                </h4>
                <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  {cartList.length} Selected ({totalItemsCount} Pcs)
                </span>
              </div>

              {cartList.length === 0 ? (
                <div className="flex-1 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-slate-400 min-h-[140px]">
                  <ShoppingBag className="w-9 h-9 stroke-[1.5] text-slate-300 mb-1.5" />
                  <p className="text-xs font-bold text-slate-600">Cart is Empty</p>
                  <p className="text-[10px] text-slate-400">Click products on the left to add items</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 flex-1">
                  {cartList.map(item => (
                    <div key={item.product.id} className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-extrabold text-slate-900 truncate">{item.product.display_name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {item.qty} Pcs x ₹{item.rate}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900">₹{item.amount}</span>
                        <button
                          onClick={() => handleQtyChange(item.product, 0)}
                          className="text-slate-400 hover:text-rose-600 transition p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Section & Auto-Balancing Split Panel */}
            <div className="space-y-3 bg-slate-900 text-white p-4 rounded-2xl shadow-md shrink-0">
              
              {/* Grand Total Bar */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Grand Total:</span>
                <span className="font-mono font-black text-2xl text-emerald-400">₹{totalAmount.toLocaleString()}</span>
              </div>

              {/* Payment Mode Selector Buttons */}
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-1.5">Payment Method:</label>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePaymentModeSelect('CASH')}
                    className={`py-2 px-1 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 border transition ${
                      paymentMode === 'CASH' 
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm' 
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Cash
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePaymentModeSelect('GPAY')}
                    className={`py-2 px-1 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 border transition ${
                      paymentMode === 'GPAY' 
                        ? 'bg-blue-500 text-white border-blue-400 shadow-sm' 
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> GPay
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePaymentModeSelect('CREDIT')}
                    className={`py-2 px-1 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 border transition ${
                      paymentMode === 'CREDIT' 
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm' 
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Credit
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePaymentModeSelect('SPLIT')}
                    className={`py-2 px-1 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 border transition ${
                      paymentMode === 'SPLIT' 
                        ? 'bg-purple-500 text-white border-purple-400 shadow-sm' 
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" /> 🔀 Split
                  </button>
                </div>
              </div>

              {/* Dynamic Auto-Balancing Input Panel when SPLIT Mode is active */}
              {paymentMode === 'SPLIT' && (
                <div className="space-y-2 bg-slate-800/90 p-3 rounded-xl border border-purple-500/40">
                  <div className="flex items-center justify-between text-[10px] font-extrabold text-purple-300 uppercase border-b border-slate-700 pb-1">
                    <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> Auto-balancing Split</span>
                    <span>Total: ₹{totalAmount}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {/* Cash Input */}
                    <div>
                      <label className="text-[9px] font-extrabold text-emerald-400 uppercase block mb-0.5">Cash Amount:</label>
                      <input
                        type="text"
                        placeholder="0"
                        value={cashAmount}
                        onChange={(e) => handleCashChange(e.target.value)}
                        className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg p-1.5 font-mono font-black text-emerald-400 focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    {/* GPay Input */}
                    <div>
                      <label className="text-[9px] font-extrabold text-blue-400 uppercase block mb-0.5">GPay Amount:</label>
                      <input
                        type="text"
                        placeholder="0"
                        value={gpayAmount}
                        onChange={(e) => handleGpayChange(e.target.value)}
                        className="w-full bg-slate-900 border border-blue-500/50 rounded-lg p-1.5 font-mono font-black text-blue-400 focus:outline-none focus:border-blue-400"
                      />
                    </div>

                    {/* Credit Input */}
                    <div>
                      <label className="text-[9px] font-extrabold text-amber-400 uppercase block mb-0.5">Credit Amount:</label>
                      <input
                        type="text"
                        placeholder="0"
                        value={creditAmount}
                        onChange={(e) => handleCreditChange(e.target.value)}
                        className="w-full bg-slate-900 border border-amber-500/50 rounded-lg p-1.5 font-mono font-black text-amber-400 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Real-time Match Status Badge */}
                  <div className="text-[10px] font-bold flex items-center justify-between pt-1">
                    {splitSum === totalAmount ? (
                      <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                        ✓ Payment Total Matched (₹{splitSum} / ₹{totalAmount})
                      </span>
                    ) : (
                      <span className="text-amber-300 font-extrabold flex items-center gap-1">
                        ⚠️ Auto-assigned Remaining Balance: ₹{Math.max(0, totalAmount - splitSum)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Action Submit Button */}
              <button
                onClick={handleSubmitBill}
                disabled={submitting || cartList.length === 0}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
                {submitting ? 'GENERATING BILL & DEDUCTING STOCK...' : 'GENERATE BILL & DEDUCT STOCK'}
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
