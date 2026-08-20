import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowLeft, CheckCircle2, Printer, Save, ShoppingBag, AlertTriangle, X } from 'lucide-react';

const PRODUCT_GROUPS = [
  {
    id: 'milk',
    title: 'Milk',
    subtitle: 'Amirtha Milk 200ml, 500ml, 1L',
    imageLabel: 'MILK',
    imageUrl: '/images/milk_cat.jpg',
    tone: 'from-blue-50 to-cyan-100 border-blue-200 text-blue-800',
    productIds: [1, 5, 6]
  },
  {
    id: 'curd',
    title: 'Curd',
    subtitle: 'Amirtha Curd 200ml, 500ml, 1L',
    imageLabel: 'CURD',
    imageUrl: '/images/curd_cat.jpg',
    tone: 'from-emerald-50 to-lime-100 border-emerald-200 text-emerald-800',
    productIds: [7, 8, 9]
  },
  {
    id: 'coccola',
    title: 'Coccola',
    subtitle: 'Soft drink 200ml, 500ml, 1L',
    imageLabel: 'COLA',
    imageUrl: '/images/cola_cat.jpg',
    tone: 'from-rose-50 to-orange-100 border-rose-200 text-rose-800',
    productIds: [10, 3, 11]
  },
  {
    id: 'juice',
    title: 'Juice',
    subtitle: 'Fresh Juice Packet (Rs. 10)',
    imageLabel: 'JUICE',
    imageUrl: '/images/juice_cat.jpg',
    tone: 'from-amber-50 to-orange-100 border-amber-200 text-amber-800',
    productIds: [12]
  },
  {
    id: 'tata',
    title: 'Tata Drink',
    subtitle: 'Tata Gluco+ Can (Rs. 10)',
    imageLabel: 'TATA',
    imageUrl: '/images/tata_cat.jpg',
    tone: 'from-green-50 to-emerald-100 border-green-200 text-green-800',
    productIds: [15]
  },
  {
    id: 'water',
    title: 'Water Bottle',
    subtitle: 'Mineral Water 200ml, 500ml, 1L, 2L',
    imageLabel: 'WATER',
    imageUrl: '/images/water_cat.jpg',
    tone: 'from-cyan-50 to-teal-100 border-cyan-200 text-cyan-800',
    productIds: [18, 19, 2, 20]
  }
];

const getSavedQty = (savedItems, productId) => savedItems[productId]?.qty || '';

const PRODUCT_IMAGES = {
  1: '/images/amirthaa_milk_200ml.png',
  5: '/images/amirthaa_milk_500ml.png',
  6: '/images/amirthaa_milk_1l.jpg',
  7: '/images/amirthaa_curd_200ml.jpg',
  8: '/images/amirthaa_curd_500ml.jpg',
  9: '/images/amirthaa_curd_1l.jpg',
  10: '/images/coccola_200ml.png',
  3: '/images/coccola_500ml.png',
  11: '/images/coccola_1l.png',
  12: '/images/juice_hero.jpg',
  15: '/images/tata_hero.jpg',
  18: '/images/aquafresh_water_200ml.png',
  19: '/images/aquafresh_water_500ml.png',
  2: '/images/aquafresh_water_1l.png',
  20: '/images/aquafresh_water_2l.png'
};

export const BillingPOS = ({ shop, onProceedToPayment, onBack }) => {
  const { products, employeeStock } = useApp();
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [savedItems, setSavedItems] = useState({});
  const [draftQty, setDraftQty] = useState({});
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const activeGroup = PRODUCT_GROUPS.find(group => group.id === activeGroupId);

  const getProduct = (id) => products.find(product => product.id === id);

  const getAvailablePieces = (product) => {
    const stock = employeeStock.find(item => item.product_id === product.id);
    if (!stock) return 0;
    return Math.floor(stock.qty_units * (product.pieces_per_unit || 1));
  };

  const savedList = useMemo(() => {
    return Object.values(savedItems)
      .filter(item => item.qty > 0)
      .map(item => {
        const product = getProduct(item.product_id);
        const rate = product?.piece_selling_price || item.rate || 0;
        return {
          product_id: item.product_id,
          product_name: product?.display_name || item.product_name,
          unit_type: 'Piece',
          qty: item.qty,
          rate,
          amount: item.qty * rate
        };
      });
  }, [savedItems, products]);

  const totalItemsCount = savedList.reduce((acc, item) => acc + item.qty, 0);
  const totalAmount = savedList.reduce((acc, item) => acc + item.amount, 0);

  const openGroup = (group) => {
    const initialDraft = {};
    group.productIds.forEach(productId => {
      initialDraft[productId] = getSavedQty(savedItems, productId);
    });
    setDraftQty(initialDraft);
    setActiveGroupId(group.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDraftChange = (product, value) => {
    const cleanValue = value.replace(/[^\d]/g, '');
    const numberValue = Number(cleanValue || 0);
    const maxPieces = getAvailablePieces(product);
    if (numberValue > maxPieces) {
      showToast(`⚠️ Stock Limit Exceeded! Available Stock for ${product.display_name}: ${maxPieces} Pcs`);
      return;
    }
    setDraftQty(prev => ({ ...prev, [product.id]: cleanValue }));
  };

  const saveGroup = () => {
    const nextSavedItems = { ...savedItems };
    activeGroup.productIds.forEach(productId => {
      const product = getProduct(productId);
      const qty = Number(draftQty[productId] || 0);
      if (qty > 0) {
        nextSavedItems[productId] = {
          product_id: productId,
          product_name: product?.display_name,
          qty,
          rate: product?.piece_selling_price || 0
        };
      } else {
        delete nextSavedItems[productId];
      }
    });
    setSavedItems(nextSavedItems);
    setActiveGroupId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrintNext = () => {
    if (savedList.length === 0) {
      showToast('⚠️ Please select at least 1 product quantity!');
      return;
    }

    onProceedToPayment({
      shop_id: shop.id,
      shop_name: shop.name,
      shop_code: shop.code,
      items: savedList,
      total_items: totalItemsCount,
      total_amount: totalAmount
    });
  };

  if (activeGroup) {
    return (
      <div className="max-w-xl mx-auto p-4 space-y-5 pb-32">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setActiveGroupId(null)}
            className="p-3 rounded-2xl bg-white border-2 border-slate-200 text-slate-800 hover:bg-slate-100 shadow-md flex items-center gap-1.5 font-black text-sm"
          >
            <ArrowLeft className="w-6 h-6" />
            BACK
          </button>
          <div className="text-center">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">{activeGroup.title}</h2>
            <p className="text-xs text-blue-600 font-bold">{shop?.name} ({shop?.code})</p>
          </div>
          <div className="w-20"></div>
        </div>

        {/* 80% Full Photo Category Banner Header */}
        <div className="rounded-3xl border-2 border-slate-200 shadow-xl overflow-hidden relative bg-slate-100">
          <div className="h-64 w-full relative">
            {activeGroup.imageUrl ? (
              <img
                src={activeGroup.imageUrl}
                alt={`${activeGroup.title} category`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="text-5xl font-black tracking-widest">{activeGroup.imageLabel}</span>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex items-end p-5">
              <div>
                <span className="text-white text-2xl font-black tracking-wide drop-shadow-lg block">
                  {activeGroup.title} Sizes
                </span>
                <span className="text-slate-200 text-xs font-bold opacity-90">
                  {activeGroup.subtitle}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 80% Photo Variant Cards & Touch Controls */}
        <div className="space-y-6">
          {activeGroup.productIds.map(productId => {
            const product = getProduct(productId);
            if (!product) return null;
            const maxPieces = getAvailablePieces(product);
            const qty = Number(draftQty[product.id] || 0);
            const amount = qty * product.piece_selling_price;
            const sizeLabel = product.display_name.split('-').pop().trim();

            const handleIncrement = () => {
              if (qty + 1 > maxPieces) {
                showToast(`⚠️ Stock Limit Exceeded! Available Stock for ${product.display_name}: ${maxPieces} Pcs`);
                return;
              }
              setDraftQty(prev => ({ ...prev, [product.id]: String(qty + 1) }));
            };

            const handleDecrement = () => {
              if (qty <= 0) return;
              setDraftQty(prev => ({ ...prev, [product.id]: String(qty - 1) }));
            };

            return (
              <div key={product.id} className="bg-white border-2 border-slate-200 rounded-3xl overflow-hidden shadow-xl space-y-0">
                {/* 80% PRODUCT PHOTO DISPLAY (280px Tall Image Area) */}
                <div className="h-72 w-full bg-slate-50 border-b-2 border-slate-100 flex items-center justify-center p-4 relative shadow-inner">
                  {PRODUCT_IMAGES[product.id] ? (
                    <img
                      src={PRODUCT_IMAGES[product.id]}
                      alt={product.display_name}
                      className="h-full w-full object-contain drop-shadow-md"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-center">
                      <div className="text-5xl font-black text-slate-800">{sizeLabel}</div>
                      <div className="text-base font-black text-slate-500 mt-2">{activeGroup.title}</div>
                    </div>
                  )}
                  {/* HUGE OVERLAY SIZE BADGE (80% Visual Focus) */}
                  <span className="absolute left-4 top-4 px-5 py-2.5 rounded-2xl bg-blue-600 text-white text-lg font-black tracking-wider shadow-2xl border-2 border-white">
                    {sizeLabel}
                  </span>
                  <span className="absolute right-4 top-4 px-4 py-2 rounded-2xl bg-white/95 text-slate-900 text-xs font-black shadow-lg border border-slate-200">
                    Stock: {maxPieces} Pcs
                  </span>
                </div>

                {/* 20% Bottom Controls with Big +/- Touch Buttons */}
                <div className="p-4 bg-white flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-black text-base text-slate-900">{product.display_name}</h3>
                    <p className="text-xs font-bold text-slate-500">Rate: Rs.{product.piece_selling_price} / Pcs</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDecrement}
                      className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 text-3xl font-black border-2 border-rose-300 flex items-center justify-center active:scale-95 shadow-md"
                    >
                      -
                    </button>
                    <input
                      id={`qty-${product.id}`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      placeholder="0"
                      value={draftQty[product.id] || ''}
                      onChange={(e) => handleDraftChange(product, e.target.value)}
                      className="w-20 h-14 bg-white border-2 border-blue-400 rounded-2xl text-center font-mono font-black text-2xl text-slate-900 focus:outline-none focus:border-blue-600 shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={handleIncrement}
                      className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 text-3xl font-black border-2 border-emerald-300 flex items-center justify-center active:scale-95 shadow-md"
                    >
                      +
                    </button>
                  </div>
                </div>

                {qty > 0 && (
                  <div className="mx-4 mb-4 flex items-center justify-between bg-emerald-50 border-2 border-emerald-300 rounded-2xl px-4 py-3 text-sm font-black">
                    <span className="text-emerald-900">{qty} Piece Selected</span>
                    <span className="font-mono text-emerald-700 text-lg">Rs.{amount.toLocaleString()}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="fixed bottom-16 left-0 right-0 p-4 max-w-xl mx-auto z-30">
          <button
            onClick={saveGroup}
            className="touch-btn touch-btn-success w-full py-4 text-xl shadow-2xl glow-green flex items-center justify-center gap-2 uppercase tracking-wider font-black rounded-2xl"
          >
            <Save className="w-7 h-7" />
            SAVE PRODUCTS
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-5 pb-36">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-3 rounded-2xl bg-white border-2 border-slate-200 text-slate-800 hover:bg-slate-100 shadow-md"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="text-center">
          <h2 className="text-xl font-black text-slate-900">{shop?.name || 'Shop'}</h2>
          <p className="text-xs text-blue-600 font-mono font-bold">{shop?.code || '#000'}</p>
        </div>
        <div className="w-12"></div>
      </div>

      {/* 80% GIANT HERO IMAGE CATEGORY CARDS */}
      <div className="space-y-5">
        {PRODUCT_GROUPS.map(group => {
          const groupItems = group.productIds
            .map(productId => savedItems[productId])
            .filter(Boolean);
          const groupQty = groupItems.reduce((acc, item) => acc + item.qty, 0);

          return (
            <button
              key={group.id}
              onClick={() => openGroup(group)}
              className="w-full rounded-3xl border-2 border-slate-200 overflow-hidden shadow-xl active:scale-[0.98] transition text-left group relative bg-white"
            >
              {/* 80% Full Photo Display (h-64 ~ 256px Tall Hero Image) */}
              <div className="h-64 w-full relative overflow-hidden bg-slate-100">
                {group.imageUrl ? (
                  <img
                    src={group.imageUrl}
                    alt={`${group.title} category`}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-200 text-4xl font-black">
                    {group.imageLabel}
                  </div>
                )}
                {groupQty > 0 && (
                  <span className="absolute top-4 right-4 px-4 py-2 rounded-2xl bg-emerald-600 text-white font-black text-sm shadow-xl flex items-center gap-1.5 border-2 border-white">
                    <CheckCircle2 className="w-5 h-5" />
                    {groupQty} Pcs Selected
                  </span>
                )}
                {/* 20% Gradient Overlay for Category Title & Tap Prompt */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-5 flex items-end justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-wide uppercase drop-shadow-md">{group.title}</h3>
                    <p className="text-xs font-bold text-slate-200 opacity-90 mt-0.5">{group.subtitle}</p>
                  </div>
                  <span className="px-4 py-2 rounded-xl bg-white text-blue-950 font-black text-xs shadow-lg shrink-0">
                    TAP TO OPEN ➔
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-blue-600" />
            Selected Bill Items
          </h3>
          <span className="text-base font-mono font-black text-blue-600">{totalItemsCount} Pcs</span>
        </div>

        {savedList.length === 0 ? (
          <p className="text-xs text-slate-500 font-extrabold bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
            📸 Product image tap panni 200ml / 500ml / 1L select pannunga.
          </p>
        ) : (
          <div className="space-y-2">
            {savedList.map(item => (
              <div key={item.product_id} className="flex justify-between items-center text-xs bg-slate-50 border border-slate-200 rounded-2xl p-3">
                <div>
                  <p className="font-black text-slate-900 text-sm">{item.product_name}</p>
                  <p className="text-slate-500 font-bold">{item.qty} Piece x Rs.{item.rate}</p>
                </div>
                <span className="font-mono font-black text-emerald-600 text-base">Rs.{item.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t-2 border-slate-100 pt-3">
          <span className="text-lg font-black text-slate-900">Total Amount</span>
          <span className="font-mono font-black text-3xl text-emerald-600">Rs.{totalAmount.toLocaleString()}</span>
        </div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 p-4 max-w-xl mx-auto z-30">
        <button
          onClick={handlePrintNext}
          className="touch-btn touch-btn-success w-full py-4 text-2xl shadow-2xl glow-green flex items-center justify-center gap-2 uppercase tracking-wider font-black rounded-2xl"
        >
          <Printer className="w-8 h-8" />
        </button>
      </div>

      {/* Sleek Floating Toast Error Banner */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-11/12 bg-slate-900 text-white px-5 py-4 rounded-2xl shadow-2xl border-2 border-rose-500 flex items-center justify-between gap-3 transition-all duration-300 animate-bounce">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-7 h-7 text-rose-400 shrink-0" />
            <span className="text-sm font-extrabold tracking-wide text-rose-100">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
