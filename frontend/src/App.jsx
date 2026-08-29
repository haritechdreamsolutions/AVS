import React, { useState, lazy, Suspense } from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { RoleLoginScreen } from './components/common/RoleLoginScreen';
import { Home, Receipt, Store } from 'lucide-react';
import { Toaster, toast } from 'sonner';

// Lazy loading heavy view components for optimized bundle size & fast LCP
const OwnerSidebarLayout = lazy(() => import('./components/Owner/OwnerSidebarLayout').then(m => ({ default: m.OwnerSidebarLayout })));
const KeeperDashboard = lazy(() => import('./components/StoreKeeper/KeeperDashboard').then(m => ({ default: m.KeeperDashboard })));
const EmployeeHome = lazy(() => import('./components/Employee/EmployeeHome').then(m => ({ default: m.EmployeeHome })));
const ShopSelection = lazy(() => import('./components/Employee/ShopSelection').then(m => ({ default: m.ShopSelection })));
const BillingPOS = lazy(() => import('./components/Employee/BillingPOS').then(m => ({ default: m.BillingPOS })));
const PaymentModal = lazy(() => import('./components/Employee/PaymentModal').then(m => ({ default: m.PaymentModal })));
const ThermalBillModal = lazy(() => import('./components/Employee/ThermalBillModal').then(m => ({ default: m.ThermalBillModal })));
const DamageEntryModal = lazy(() => import('./components/Employee/DamageEntryModal').then(m => ({ default: m.DamageEntryModal })));
const EndOfDayModal = lazy(() => import('./components/Employee/EndOfDayModal').then(m => ({ default: m.EndOfDayModal })));

const LoadingFallback = () => (
  <div className="h-full w-full flex items-center justify-center p-8 bg-slate-50">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      <span className="text-sm font-medium text-slate-600">Loading module...</span>
    </div>
  </div>
);

export default function App() {
  const { activeRole, currentUser, isAuthChecking, createSale, activeBill, setActiveBill } = useApp();

  const [empScreen, setEmpScreen] = useState('home');
  const [selectedShop, setSelectedShop] = useState(null);
  const [pendingBillData, setPendingBillData] = useState(null);
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [showEndOfDayModal, setShowEndOfDayModal] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || '/api';

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
      window.location.reload();
    } catch (e) {
      toast.error("Logout failed");
    }
  };

  const handleLoginSuccess = () => {
    setEmpScreen('home');
    toast.success("Welcome back!");
  };

  const handleStartBilling = () => {
    setEmpScreen('shop_select');
  };

  const handleSelectShop = (shop) => {
    setSelectedShop(shop);
    setEmpScreen('billing');
  };

  const handleProceedToPayment = (billInfo) => {
    setPendingBillData(billInfo);
    setEmpScreen('payment');
  };

  const handleConfirmBill = async (finalBillData) => {
    const res = await createSale(finalBillData);
    if (res.success) {
      setEmpScreen('home');
      toast.success(`Bill #${res.sale.bill_no} saved & stock updated!`);
    } else {
      toast.error("Error creating bill: " + res.message);
    }
  };

  if (isAuthChecking) {
    return <div className="h-screen w-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  if (!currentUser) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <RoleLoginScreen onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-50 text-slate-800">
      
      <Toaster position="top-right" richColors />

      <Suspense fallback={<LoadingFallback />}>
        {activeRole === 'OWNER' ? (
          <OwnerSidebarLayout onLogout={handleLogout} />
        ) : (
          <>
            <Header onLogout={handleLogout} />

            <main className="flex-1 overflow-y-auto pb-16">
              {activeRole === 'EMPLOYEE' && (
                <>
                  {empScreen === 'home' && (
                    <EmployeeHome
                      onStartBilling={handleStartBilling}
                      onOpenDamage={() => setShowDamageModal(true)}
                      onOpenEndOfDay={() => setShowEndOfDayModal(true)}
                    />
                  )}

                  {empScreen === 'shop_select' && (
                    <ShopSelection
                      onSelectShop={handleSelectShop}
                      onBack={() => setEmpScreen('home')}
                    />
                  )}

                  {empScreen === 'billing' && (
                    <BillingPOS
                      shop={selectedShop}
                      onProceedToPayment={handleProceedToPayment}
                      onBack={() => setEmpScreen('shop_select')}
                    />
                  )}

                  {empScreen === 'payment' && (
                    <PaymentModal
                      billData={pendingBillData}
                      onConfirmBill={handleConfirmBill}
                      onBack={() => setEmpScreen('billing')}
                    />
                  )}

                  {activeBill && (
                    <ThermalBillModal
                      bill={activeBill}
                      onClose={() => setActiveBill(null)}
                    />
                  )}

                  {showDamageModal && (
                    <DamageEntryModal onClose={() => setShowDamageModal(false)} />
                  )}

                  {showEndOfDayModal && (
                    <EndOfDayModal onClose={() => setShowEndOfDayModal(false)} />
                  )}
                </>
              )}

              {activeRole === 'STORE_KEEPER' && (
                <KeeperDashboard />
              )}
            </main>

            {/* Employee Bottom Nav */}
            {activeRole === 'EMPLOYEE' && (
              <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-2 px-6 shadow-lg">
                <div className="max-w-md mx-auto flex items-center justify-around">
                  <button
                    onClick={() => setEmpScreen('home')}
                    className={`flex flex-col items-center gap-1 font-bold text-[11px] transition ${
                      empScreen === 'home' ? 'text-blue-600 font-extrabold' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Home className="w-5 h-5" />
                    🏠 Home
                  </button>

                  <button
                    onClick={handleStartBilling}
                    className={`flex flex-col items-center gap-1 font-bold text-[11px] transition ${
                      empScreen === 'billing' || empScreen === 'shop_select' ? 'text-blue-600 font-extrabold' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Receipt className="w-5 h-5" />
                    🧾 Bill
                  </button>

                  <button
                    onClick={() => setEmpScreen('shop_select')}
                    className={`flex flex-col items-center gap-1 font-bold text-[11px] transition ${
                      empScreen === 'shop_select' ? 'text-blue-600 font-extrabold' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Store className="w-5 h-5" />
                    🏪 Shops
                  </button>

                  <button
                    onClick={() => setShowEndOfDayModal(true)}
                    className="flex flex-col items-center gap-1 font-bold text-[11px] text-slate-500 hover:text-slate-900 transition"
                  >
                    <span className="text-base">💰</span>
                    💰 Day
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
      </Suspense>

    </div>
  );
}
