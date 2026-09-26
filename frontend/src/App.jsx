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
const BillSummary = lazy(() => import('./components/Employee/BillSummary').then(m => ({ default: m.BillSummary })));
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
  const [selectedVillage, setSelectedVillage] = useState(null);
  const [selectedShop, setSelectedShop] = useState(null);
  const [pendingBillData, setPendingBillData] = useState(null);
  const [lastCreatedBill, setLastCreatedBill] = useState(null);

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
    if (shop.village_id || shop.village_name || shop.village) {
      setSelectedVillage({
        id: shop.village_id || null,
        name: shop.village_name || shop.village || 'Other Shops'
      });
    }
    setEmpScreen('billing');
  };

  const handleProceedToPayment = (billInfo) => {
    setPendingBillData(billInfo);
    setEmpScreen('payment');
  };

  const handleConfirmBill = async (finalBillData) => {
    const res = await createSale(finalBillData);
    if (res.success) {
      setLastCreatedBill(res);
      setEmpScreen('bill_summary');
      if (selectedShop) {
        const newDue = res.sale?.shop_current_due !== undefined 
          ? Number(res.sale.shop_current_due) 
          : (finalBillData.clear_previous_due ? 0 : selectedShop.current_due);
        setSelectedShop(prev => ({ ...prev, current_due: newDue }));
      }
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
    <div className="h-[100dvh] min-h-[100dvh] w-full overflow-hidden flex flex-col bg-slate-50 text-slate-800">
      
      <Toaster position="top-right" richColors />

      <Suspense fallback={<LoadingFallback />}>
        {activeRole === 'OWNER' ? (
          <OwnerSidebarLayout onLogout={handleLogout} />
        ) : (
          <>
            <Header onLogout={handleLogout} />

            <main className="flex-1 overflow-y-auto touch-scroll pb-20 sm:pb-16 w-full max-w-full">
              {(activeRole === 'EMPLOYEE' || activeRole === 'DRIVER') && (
                <>
                  {empScreen === 'home' && (
                    <EmployeeHome
                      onStartBilling={handleStartBilling}
                    />
                  )}

                  {empScreen === 'shop_select' && (
                    <ShopSelection
                      selectedVillage={selectedVillage}
                      onSelectVillage={setSelectedVillage}
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

                  {empScreen === 'bill_summary' && (
                    <BillSummary
                      billResult={lastCreatedBill}
                      onDone={() => {
                        setLastCreatedBill(null);
                        setEmpScreen('shop_select');
                      }}
                    />
                  )}

                  {activeBill && (
                    <ThermalBillModal
                      bill={activeBill}
                      onClose={() => setActiveBill(null)}
                    />
                  )}
                </>
              )}

              {activeRole === 'STORE_KEEPER' && (
                <KeeperDashboard />
              )}
            </main>

            {/* Employee / Driver Bottom Nav */}
            {(activeRole === 'EMPLOYEE' || activeRole === 'DRIVER') && (
              <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] px-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
                <div className="max-w-md mx-auto flex items-center justify-around">
                  <button
                    onClick={() => setEmpScreen('home')}
                    className={`flex flex-col items-center justify-center gap-1 font-extrabold text-[11px] py-1 px-3 rounded-2xl transition-all cursor-pointer min-w-[60px] min-h-[46px] ${
                      empScreen === 'home'
                        ? 'text-blue-600 bg-blue-50/80 scale-105' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Home className="w-5 h-5" />
                    <span>Home</span>
                  </button>

                  <button
                    onClick={() => handleStartBilling()}
                    className={`flex flex-col items-center justify-center gap-1 font-extrabold text-[11px] py-1 px-3 rounded-2xl transition-all cursor-pointer min-w-[60px] min-h-[46px] ${
                      empScreen === 'billing' || empScreen === 'payment'
                        ? 'text-blue-600 bg-blue-50/80 scale-105' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Receipt className="w-5 h-5" />
                    <span>Bill</span>
                  </button>

                  <button
                    onClick={() => setEmpScreen('shop_select')}
                    className={`flex flex-col items-center justify-center gap-1 font-extrabold text-[11px] py-1 px-3 rounded-2xl transition-all cursor-pointer min-w-[60px] min-h-[46px] ${
                      empScreen === 'shop_select'
                        ? 'text-blue-600 bg-blue-50/80 scale-105' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Store className="w-5 h-5" />
                    <span>Shops</span>
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
