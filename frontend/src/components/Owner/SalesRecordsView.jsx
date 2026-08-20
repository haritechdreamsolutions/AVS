import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ShoppingBag, Search, Filter, Eye, Printer, DollarSign, 
  Smartphone, CreditCard, ArrowRightLeft, UserCheck, Truck, 
  Store, Calendar, Clock, X, ChevronRight, CheckCircle2 
} from 'lucide-react';
import { ThermalBillModal } from '../Employee/ThermalBillModal';

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

export const SalesRecordsView = () => {
  const { sales, products } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [sellerFilter, setSellerFilter] = useState('ALL');
  const [selectedSaleDetails, setSelectedSaleDetails] = useState(null);
  const [printThermalBill, setPrintThermalBill] = useState(null);

  // Dynamic Calculation of Filtered Sales
  const filteredSales = useMemo(() => {
    return (sales || []).filter(sale => {
      // Payment mode match
      const modeMatch = paymentFilter === 'ALL' || (sale.payment_mode || 'CASH').toUpperCase() === paymentFilter;

      // Seller filter match
      const isStoreKeeper = sale.is_store_direct_sale || Number(sale.employee_id) === 6 || sale.role === 'STORE_KEEPER' || (sale.employee_name && sale.employee_name.toLowerCase().includes('store'));
      let sellerMatch = true;
      if (sellerFilter === 'STORE') sellerMatch = isStoreKeeper;
      if (sellerFilter === 'DRIVER') sellerMatch = !isStoreKeeper;

      // Search match (Bill No, Shop Name, Employee Name, Customer Name)
      const q = searchQuery.toLowerCase();
      const searchMatch = !q || 
        (sale.bill_no && sale.bill_no.toLowerCase().includes(q)) ||
        (sale.shop_name && sale.shop_name.toLowerCase().includes(q)) ||
        (sale.customer_name && sale.customer_name.toLowerCase().includes(q)) ||
        (sale.employee_name && sale.employee_name.toLowerCase().includes(q));

      return modeMatch && sellerMatch && searchMatch;
    });
  }, [sales, paymentFilter, sellerFilter, searchQuery]);

  // Overall KPI Metrics
  const metrics = useMemo(() => {
    const list = sales || [];
    const totalRev = list.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
    const storeRev = list.filter(s => s.is_store_direct_sale || Number(s.employee_id) === 6 || (s.employee_name && s.employee_name.toLowerCase().includes('store')))
      .reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
    const driverRev = totalRev - storeRev;

    return {
      totalBills: list.length,
      totalRevenue: totalRev,
      storeRevenue: storeRev,
      driverRevenue: driverRev
    };
  }, [sales]);

  const renderPaymentBadge = (sale) => {
    const mode = (sale.payment_mode || 'CASH').toUpperCase();
    if (mode === 'CASH') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
          <DollarSign className="w-3 h-3 text-emerald-600" /> CASH
        </span>
      );
    }
    if (mode === 'GPAY') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300 inline-flex items-center gap-1">
          <Smartphone className="w-3 h-3 text-blue-600" /> GPAY
        </span>
      );
    }
    if (mode === 'CREDIT') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
          <CreditCard className="w-3 h-3 text-amber-600" /> CREDIT
        </span>
      );
    }
    if (mode === 'SPLIT') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-300 inline-flex items-center gap-1">
          <ArrowRightLeft className="w-3 h-3 text-purple-600" /> SPLIT (C:₹{sale.cash_paid || 0} | G:₹{sale.gpay_paid || 0})
        </span>
      );
    }
    return <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-300">{mode}</span>;
  };

  const renderSellerBadge = (sale) => {
    const isStore = sale.is_store_direct_sale || Number(sale.employee_id) === 6 || (sale.employee_name && sale.employee_name.toLowerCase().includes('store'));
    if (isStore) {
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs border border-purple-200 shrink-0">
            🏬
          </div>
          <div>
            <span className="font-extrabold text-slate-900 text-xs block leading-tight">Store Keeper</span>
            <span className="text-[9px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 inline-block">Store Counter</span>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200 shrink-0">
          🚚
        </div>
        <div>
          <span className="font-extrabold text-slate-900 text-xs block leading-tight">{sale.employee_name || 'Driver'}</span>
          <span className="text-[9px] text-slate-500 font-mono block">{sale.vehicle_no || 'Vehicle'}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-20">
      
      {/* Top Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-purple-950 text-white border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
                SALES & BILLING RECORDS
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  🔴 Live Real-Time Feed
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">Real-time Sales Log from Store Counter & Employee Delivery Routes</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono font-black text-sm text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-400/30">
            Total Revenue: ₹{metrics.totalRevenue.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-emerald-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Total Bills Generated</span>
          <div className="font-mono font-black text-2xl text-slate-900 mt-1">
            {metrics.totalBills} Bills
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-blue-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Total Sales Revenue</span>
          <div className="font-mono font-black text-2xl text-emerald-600 mt-1">
            ₹{metrics.totalRevenue.toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-purple-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Direct Counter Sales</span>
          <div className="font-mono font-black text-2xl text-purple-600 mt-1">
            ₹{metrics.storeRevenue.toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-indigo-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Driver Route Sales</span>
          <div className="font-mono font-black text-2xl text-indigo-600 mt-1">
            ₹{metrics.driverRevenue.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        
        {/* Live Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Bill #, Shop, Employee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 focus:bg-white transition"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Seller Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setSellerFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition ${sellerFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All Sellers
            </button>
            <button
              onClick={() => setSellerFilter('STORE')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition ${sellerFilter === 'STORE' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              🏬 Store Keeper
            </button>
            <button
              onClick={() => setSellerFilter('DRIVER')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition ${sellerFilter === 'DRIVER' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              🚚 Drivers
            </button>
          </div>

          {/* Payment Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl p-2 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">All Payment Modes</option>
            <option value="CASH">Cash Only</option>
            <option value="GPAY">GPay Only</option>
            <option value="CREDIT">Credit Only</option>
            <option value="SPLIT">Split Only</option>
          </select>
        </div>
      </div>

      {/* Main Billing Table Panel */}
      <div className="glass-panel rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 font-extrabold text-slate-700 bg-slate-50 uppercase tracking-wider">
                <th className="p-3.5 pl-5">Bill No & Time</th>
                <th className="p-3.5">Bill Generated By</th>
                <th className="p-3.5">Customer / Shop Name</th>
                <th className="p-3.5 text-center">Items Count</th>
                <th className="p-3.5 text-right">Total Amount</th>
                <th className="p-3.5 text-center">Payment Method</th>
                <th className="p-3.5 pr-5 text-center">Action Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400 font-bold">
                    No sales or billing records found.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale, idx) => {
                  const itemsCount = (sale.items || []).reduce((acc, i) => acc + (Number(i.qty) || 0), 0);
                  const isStore = sale.is_store_direct_sale || Number(sale.employee_id) === 6;

                  return (
                    <tr key={sale.bill_no || idx} className="hover:bg-slate-50/80 transition-colors">
                      
                      {/* Bill No & Timestamp */}
                      <td className="p-3.5 pl-5">
                        <span className="font-mono font-black text-sm text-purple-700 block">
                          #{sale.bill_no}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400" /> {sale.date || 'Today'} • {sale.time || 'Live'}
                        </span>
                      </td>

                      {/* Generated By */}
                      <td className="p-3.5">
                        {renderSellerBadge(sale)}
                      </td>

                      {/* Shop / Customer Name */}
                      <td className="p-3.5">
                        <span className="font-extrabold text-slate-900 text-xs block">
                          {sale.shop_name || sale.customer_name || 'Direct Walk-in Customer'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold block">
                          {sale.shop_id ? `Shop ID: #${sale.shop_id}` : 'Counter Retail Sale'}
                        </span>
                      </td>

                      {/* Items Count */}
                      <td className="p-3.5 text-center">
                        <span className="font-mono font-black text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 inline-block">
                          {itemsCount} Pcs
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="p-3.5 text-right font-mono font-black text-sm text-emerald-600">
                        ₹{(Number(sale.total_amount) || 0).toLocaleString()}
                      </td>

                      {/* Payment Mode */}
                      <td className="p-3.5 text-center">
                        {renderPaymentBadge(sale)}
                      </td>

                      {/* View Details Action Button */}
                      <td className="p-3.5 pr-5 text-center">
                        <button
                          onClick={() => setSelectedSaleDetails(sale)}
                          className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white font-extrabold text-xs flex items-center justify-center gap-1 border border-purple-200 transition mx-auto shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Details
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Itemized Bill Breakdown Modal */}
      {selectedSaleDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-4 px-6 bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white flex items-center gap-2">
                    BILL DETAILS (#{selectedSaleDetails.bill_no})
                  </h3>
                  <p className="text-xs text-slate-300">{selectedSaleDetails.date} • {selectedSaleDetails.time}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedSaleDetails(null)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 overflow-y-auto">
              
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Billed By:</span>
                  <span className="font-extrabold text-slate-900 block mt-0.5">{selectedSaleDetails.employee_name || 'Store Keeper'}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{selectedSaleDetails.vehicle_no || 'Warehouse Counter'}</span>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Customer / Shop:</span>
                  <span className="font-extrabold text-slate-900 block mt-0.5">{selectedSaleDetails.shop_name || selectedSaleDetails.customer_name || 'Walk-in Counter Customer'}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{selectedSaleDetails.customer_phone || 'Direct Customer'}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 font-extrabold text-slate-700 border-b border-slate-200 uppercase text-[10px]">
                      <th className="p-2.5 pl-4">Product Name</th>
                      <th className="p-2.5 text-center">Qty (Pcs)</th>
                      <th className="p-2.5 text-right">Rate</th>
                      <th className="p-2.5 pr-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedSaleDetails.items || []).map((item, i) => {
                      const prodMeta = PRODUCT_IMAGES[item.product_id] || {};
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2.5 pl-4 flex items-center gap-2">
                            {prodMeta.image ? (
                              <img src={prodMeta.image} alt={item.product_name} className="w-7 h-7 object-contain rounded-md bg-slate-100 p-0.5 border" />
                            ) : (
                              <span className="text-base">📦</span>
                            )}
                            <div>
                              <span className="font-extrabold text-slate-900 block">{item.product_name || `Product #${item.product_id}`}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{prodMeta.sizeBadge || 'Item'}</span>
                            </div>
                          </td>

                          <td className="p-2.5 text-center font-mono font-extrabold text-blue-600">
                            {item.qty} Pcs
                          </td>

                          <td className="p-2.5 text-right font-mono font-bold text-slate-700">
                            ₹{item.rate || 0}/pc
                          </td>

                          <td className="p-2.5 pr-4 text-right font-mono font-black text-slate-900">
                            ₹{(Number(item.amount) || (item.qty * (item.rate || 0))).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Payment Summary Footer */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                  <span className="text-slate-400 font-bold uppercase">Grand Total:</span>
                  <span className="font-mono font-black text-xl text-emerald-400">₹{(Number(selectedSaleDetails.total_amount) || 0).toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-400 font-bold">Payment Mode:</span>
                  <div>{renderPaymentBadge(selectedSaleDetails)}</div>
                </div>

                {selectedSaleDetails.payment_mode === 'SPLIT' && (
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono bg-slate-800 p-2 rounded-xl border border-slate-700 mt-2">
                    <span className="text-emerald-400">Cash: ₹{selectedSaleDetails.cash_paid || 0}</span>
                    <span className="text-blue-400">GPay: ₹{selectedSaleDetails.gpay_paid || 0}</span>
                    <span className="text-amber-400">Credit: ₹{selectedSaleDetails.credit_paid || 0}</span>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setPrintThermalBill(selectedSaleDetails);
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-md transition"
              >
                <Printer className="w-4 h-4" /> Print Thermal Bill Receipt
              </button>

              <button
                onClick={() => setSelectedSaleDetails(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-xs transition"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Thermal Receipt Modal */}
      {printThermalBill && (
        <ThermalBillModal
          bill={printThermalBill}
          onClose={() => setPrintThermalBill(null)}
        />
      )}

    </div>
  );
};
