import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { RoleLoginScreen } from './components/common/RoleLoginScreen';
import { EmployeeHome } from './components/Employee/EmployeeHome';
import { ShopSelection } from './components/Employee/ShopSelection';
import { BillingPOS } from './components/Employee/BillingPOS';
import { PaymentModal } from './components/Employee/PaymentModal';
import { ThermalBillModal } from './components/Employee/ThermalBillModal';
import { DamageEntryModal } from './components/Employee/DamageEntryModal';
import { EndOfDayModal } from './components/Employee/EndOfDayModal';
import { KeeperDashboard } from './components/StoreKeeper/KeeperDashboard';
import { OwnerSidebarLayout } from './components/Owner/OwnerSidebarLayout';
import { Home, Receipt, Store } from 'lucide-react';
import { Toaster, toast } from 'sonner';

export default function App() {
  const { activeRole, currentUser, createSale, activeBill, setActiveBill } = useApp();

  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [empScreen, setEmpScreen] = useState('home');
  const [selectedShop, setSelectedShop] = useState(null);
  const [pendingBillData, setPendingBillData] = useState(null);
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [showEndOfDayModal, setShowEndOfDayModal] = useState(false);

  const handleLogout = () => {
    setIsLoggedIn(false);
    toast.info("Logged out successfully");
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      
      {/* Sonner Toast Notification Container */}
      <Toaster position="top-right" richColors />

      {/* Render Login Screen if user logged out */}
      {!isLoggedIn ? (
        <RoleLoginScreen onLoginSuccess={handleLoginSuccess} />
      ) : activeRole === 'OWNER' ? (
        <OwnerSidebarLayout onLogout={handleLogout} />
      ) : (
        <>
          <Header onLogout={handleLogout} />

          <main className="flex-1 pb-16">
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

    </div>
  );
}
