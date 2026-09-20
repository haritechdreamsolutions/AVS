import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  AlertOctagon, Users, Package, AlertTriangle, Search, 
  Calendar, RefreshCw, Filter, Download, Truck, 
  MapPin, User, Clock, FileText, X, CheckCircle2,
  ShieldAlert, Box
} from 'lucide-react';
import { toast } from 'sonner';
import { generateDamagePiecesPDFReport } from '../../utils/pdfReportGenerator';

export const OwnerDamagePiecesView = () => {
  const { fetchDamages, drivers = [], products = [], routes = [], companyInfo } = useApp();

  const [loading, setLoading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [damages, setDamages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  const [selectedPeriod, setSelectedPeriod] = useState('ALL'); // 'TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'ALL', 'CUSTOM'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('ALL');
  const [selectedProductId, setSelectedProductId] = useState('ALL');
  const [selectedRoute, setSelectedRoute] = useState('ALL');
  const [selectedReason, setSelectedReason] = useState('ALL');

  const getDateRangeForPeriod = (period) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    if (period === 'TODAY') {
      return { date: todayStr };
    }
    if (period === 'YESTERDAY') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return { date: yesterday.toISOString().split('T')[0] };
    }
    if (period === 'THIS_WEEK') {
      const startOfWeek = new Date(now);
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      return {
        start_date: startOfWeek.toISOString().split('T')[0],
        end_date: todayStr
      };
    }
    if (period === 'THIS_MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start_date: startOfMonth.toISOString().split('T')[0],
        end_date: todayStr
      };
    }
    if (period === 'CUSTOM' && customStartDate) {
      return {
        start_date: customStartDate,
        end_date: customEndDate || customStartDate
      };
    }
    return {};
  };

  const loadDamagesData = async () => {
    setLoading(true);
    try {
      const dateFilters = getDateRangeForPeriod(selectedPeriod);
      const filterParams = {
        ...dateFilters,
        driver_id: selectedDriverId !== 'ALL' ? selectedDriverId : undefined,
        product_id: selectedProductId !== 'ALL' ? selectedProductId : undefined,
        reason: selectedReason !== 'ALL' ? selectedReason : undefined
      };
      const data = await fetchDamages(filterParams);
      setDamages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching damage pieces:', err);
      toast.error('Failed to load damage pieces');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDamagesData();
  }, [selectedPeriod, customStartDate, customEndDate, selectedDriverId, selectedProductId, selectedReason]);

  // Client-side query search and route filtering
  const filteredDamages = useMemo(() => {
    return damages.filter(item => {
      if (selectedDriverId !== 'ALL') {
        const empId = String(item.employee_id || item.driver_id || '');
        if (empId !== String(selectedDriverId)) return false;
      }
      if (selectedProductId !== 'ALL') {
        if (String(item.product_id) !== String(selectedProductId)) return false;
      }
      if (selectedRoute !== 'ALL') {
        if ((item.route_name || '').toLowerCase() !== selectedRoute.toLowerCase()) return false;
      }
      if (selectedReason !== 'ALL') {
        if ((item.reason || '').toLowerCase() !== selectedReason.toLowerCase()) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const dName = (item.driver_name || item.employee_name || '').toLowerCase();
        const code = (item.employee_code || '').toLowerCase();
        const pName = (item.product_name || '').toLowerCase();
        const vNum = (item.vehicle_number || '').toLowerCase();
        const rName = (item.route_name || '').toLowerCase();
        const reason = (item.reason || '').toLowerCase();
        const notes = (item.notes || '').toLowerCase();
        const session = String(item.session_id || '').toLowerCase();
        if (!dName.includes(q) && !code.includes(q) && !pName.includes(q) && !vNum.includes(q) && !rName.includes(q) && !reason.includes(q) && !notes.includes(q) && !session.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [damages, selectedDriverId, selectedProductId, selectedRoute, selectedReason, searchQuery]);

  // Driver-wise aggregation
  const driverSummaryList = useMemo(() => {
    const map = new Map();
    filteredDamages.forEach(dmg => {
      const id = String(dmg.employee_id || dmg.driver_id || '0');
      const name = dmg.driver_name || dmg.employee_name || 'Driver';
      const code = dmg.employee_code || 'EMP';
      const vehicle = dmg.vehicle_number || 'N/A';
      const pieces = Number(dmg.base_quantity ?? dmg.qty_units ?? 0);
      const current = map.get(id) || { id, name, code, vehicle, totalPieces: 0, count: 0 };
      current.totalPieces += pieces;
      current.count += 1;
      map.set(id, current);
    });
    return Array.from(map.values()).sort((a, b) => b.totalPieces - a.totalPieces);
  }, [filteredDamages]);

  // Overall KPI Metrics
  const totalDamagePieces = useMemo(() => {
    return filteredDamages.reduce((sum, d) => sum + Number(d.base_quantity ?? d.qty_units ?? 0), 0);
  }, [filteredDamages]);

  const uniqueProductsCount = useMemo(() => {
    const pids = new Set(filteredDamages.map(d => String(d.product_id || d.product_name)));
    return pids.size;
  }, [filteredDamages]);

  const uniqueDriversCount = useMemo(() => {
    const dids = new Set(filteredDamages.map(d => String(d.employee_id || d.driver_id || '0')));
    return dids.size;
  }, [filteredDamages]);

  const totalDamageTransactions = filteredDamages.length;

  const handleDownloadPDFReport = async () => {
    if (filteredDamages.length === 0) {
      toast.error('No damage records to generate PDF');
      return;
    }
    setIsGeneratingPDF(true);
    try {
      toast.info('Generating Damage Pieces PDF...');
      const selectedDriverObj = drivers.find(d => String(d.id || d.employee_id) === String(selectedDriverId));
      const driverName = selectedDriverId === 'ALL' ? 'All Drivers' : (selectedDriverObj?.full_name || selectedDriverObj?.name || 'Selected Driver');

      const filename = await generateDamagePiecesPDFReport({
        damages: filteredDamages,
        period: selectedPeriod,
        dateRangeText: selectedPeriod === 'CUSTOM' ? `${customStartDate} to ${customEndDate}` : selectedPeriod.replace(/_/g, ' '),
        selectedDriverName: driverName,
        companyInfo: companyInfo || {}
      });
      toast.success(`PDF report downloaded: ${filename}`);
    } catch (err) {
      console.error('Error generating damage pieces PDF:', err);
      toast.error('Unable to generate PDF report. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 shrink-0">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-[clamp(1.35rem,2.2vw,1.85rem)] text-slate-900 tracking-tight leading-tight">Damage Pieces Tracking</h1>
              <p className="text-[clamp(0.85rem,1.1vw,0.95rem)] text-slate-500 font-medium mt-0.5">Physical stock damages recorded during driver route returns</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadDamagesData}
            disabled={loading}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[0.88rem] font-bold flex items-center gap-1.5 transition cursor-pointer min-h-[42px]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleDownloadPDFReport}
            disabled={isGeneratingPDF}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[0.92rem] font-bold flex items-center gap-2 shadow-xs transition cursor-pointer min-h-[42px] disabled:opacity-75"
          >
            <Download className={`w-4 h-4 ${isGeneratingPDF ? 'animate-bounce' : ''}`} />
            {isGeneratingPDF ? 'Generating PDF...' : 'Download PDF Report'}
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="glass-card p-4 md:p-5 rounded-2xl bg-white border-l-4 border-l-rose-500 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[0.85rem] text-slate-600 font-extrabold uppercase tracking-tight">
            <span>Total Damage Pieces</span>
            <AlertOctagon className="w-4 h-4 text-rose-500" />
          </div>
          <div className="font-mono font-black text-[clamp(1.4rem,2vw,1.7rem)] text-rose-600 mt-2">
            {totalDamagePieces.toLocaleString()}
          </div>
          <span className="text-[0.82rem] text-slate-400 font-medium mt-1">Total physical damaged units</span>
        </div>

        <div className="glass-card p-4 md:p-5 rounded-2xl bg-white border-l-4 border-l-amber-500 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[0.85rem] text-slate-600 font-extrabold uppercase tracking-tight">
            <span>Products Damaged</span>
            <Package className="w-4 h-4 text-amber-500" />
          </div>
          <div className="font-mono font-black text-[clamp(1.4rem,2vw,1.7rem)] text-amber-600 mt-2">
            {uniqueProductsCount}
          </div>
          <span className="text-[0.82rem] text-slate-400 font-medium mt-1">Distinct damaged items</span>
        </div>

        <div className="glass-card p-4 md:p-5 rounded-2xl bg-white border-l-4 border-l-indigo-500 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[0.85rem] text-slate-600 font-extrabold uppercase tracking-tight">
            <span>Drivers With Damage</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="font-mono font-black text-[clamp(1.4rem,2vw,1.7rem)] text-indigo-600 mt-2">
            {uniqueDriversCount}
          </div>
          <span className="text-[0.82rem] text-slate-400 font-medium mt-1">Drivers with damage records</span>
        </div>

        <div className="glass-card p-4 md:p-5 rounded-2xl bg-white border-l-4 border-l-slate-500 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[0.85rem] text-slate-600 font-extrabold uppercase tracking-tight">
            <span>Damage Transactions</span>
            <AlertTriangle className="w-4 h-4 text-slate-500" />
          </div>
          <div className="font-mono font-black text-[clamp(1.4rem,2vw,1.7rem)] text-slate-700 mt-2">
            {totalDamageTransactions}
          </div>
          <span className="text-[0.82rem] text-slate-400 font-medium mt-1">Total damage log entries</span>
        </div>
      </div>

      {/* Date & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Date Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[0.82rem] font-extrabold uppercase text-slate-400 mr-2 shrink-0">Period:</span>
          {[
            { id: 'ALL', label: 'All Time' },
            { id: 'TODAY', label: 'Today' },
            { id: 'YESTERDAY', label: 'Yesterday' },
            { id: 'THIS_WEEK', label: 'This Week' },
            { id: 'THIS_MONTH', label: 'This Month' },
            { id: 'CUSTOM', label: 'Custom Date' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPeriod(p.id)}
              className={`px-3.5 py-1.5 rounded-xl text-[0.88rem] font-bold whitespace-nowrap transition cursor-pointer ${
                selectedPeriod === p.id 
                  ? 'bg-rose-600 text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Pickers */}
        {selectedPeriod === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-[0.85rem]">
              <span className="text-slate-500 font-bold">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-[0.88rem] font-medium focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex items-center gap-1.5 text-[0.85rem]">
              <span className="text-slate-500 font-bold">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-[0.88rem] font-medium focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>
        )}

        {/* Search and Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search driver, product, reason..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-[0.88rem] rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-rose-500 min-h-[40px]"
            />
          </div>

          {/* Driver Filter */}
          <select
            value={selectedDriverId}
            onChange={e => setSelectedDriverId(e.target.value)}
            className="w-full px-3 py-2 text-[0.88rem] rounded-xl border border-slate-300 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-rose-500 min-h-[40px]"
          >
            <option value="ALL">All Drivers ({drivers.length})</option>
            {drivers.map(d => (
              <option key={d.id || d.employee_id} value={d.id || d.employee_id}>
                {d.full_name || d.name} ({d.employee_code || 'EMP'})
              </option>
            ))}
          </select>

          {/* Product Filter */}
          <select
            value={selectedProductId}
            onChange={e => setSelectedProductId(e.target.value)}
            className="w-full px-3 py-2 text-[0.88rem] rounded-xl border border-slate-300 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-rose-500 min-h-[40px]"
          >
            <option value="ALL">All Products ({products.length})</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.display_name || p.name}</option>
            ))}
          </select>

          {/* Route Filter */}
          <select
            value={selectedRoute}
            onChange={e => setSelectedRoute(e.target.value)}
            className="w-full px-3 py-2 text-[0.88rem] rounded-xl border border-slate-300 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-rose-500 min-h-[40px]"
          >
            <option value="ALL">All Routes ({routes.length})</option>
            {routes.map(r => (
              <option key={r.id} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Driver-Wise Damage Summary Dimension */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-rose-600" />
            <h3 className="font-extrabold text-[0.92rem] uppercase tracking-wider text-slate-800">
              Driver-Wise Damage Summary ({driverSummaryList.length} Drivers with Damage)
            </h3>
          </div>
          {selectedDriverId !== 'ALL' && (
            <button
              onClick={() => setSelectedDriverId('ALL')}
              className="text-[0.85rem] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Show All Drivers
            </button>
          )}
        </div>

        {driverSummaryList.length === 0 ? (
          <p className="text-[0.88rem] text-slate-400 italic py-2">No damage records found for this filter period.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {driverSummaryList.map(driver => {
              const isSelected = String(selectedDriverId) === String(driver.id);
              return (
                <div
                  key={driver.id}
                  onClick={() => setSelectedDriverId(isSelected ? 'ALL' : driver.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                    isSelected 
                      ? 'bg-rose-50 border-rose-500 shadow-xs ring-2 ring-rose-400/30' 
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80 hover:border-slate-300'
                  }`}
                >
                  <div className="truncate mr-2">
                    <h4 className="font-extrabold text-[0.92rem] text-slate-900 truncate">{driver.name}</h4>
                    <p className="text-[0.8rem] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                      <span>{driver.code}</span>
                      <span>•</span>
                      <span>{driver.count} entries</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-black text-[1rem] text-rose-600 block">
                      {driver.totalPieces} Pieces
                    </span>
                    <span className="text-[0.75rem] font-bold text-slate-400 uppercase">Damage</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detailed Damage Records Table / Mobile Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-rose-600" />
            <h3 className="font-extrabold text-[0.92rem] uppercase tracking-wider text-slate-800">
              Detailed Damage Logs ({filteredDamages.length} Records)
            </h3>
          </div>
        </div>

        {filteredDamages.length === 0 ? (
          <div className="text-center py-12 px-4">
            <AlertOctagon className="w-12 h-12 text-slate-300 mx-auto mb-2 opacity-60" />
            <p className="text-[0.95rem] font-bold text-slate-600">No Damage Records Found</p>
            <p className="text-[0.85rem] text-slate-400 mt-1">Adjust your filters or inspect another date range.</p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-[0.88rem] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold text-[0.82rem] uppercase tracking-wider">
                    <th className="p-3.5">Driver & Vehicle</th>
                    <th className="p-3.5">Route</th>
                    <th className="p-3.5">Product</th>
                    <th className="p-3.5 text-center">Damage Qty</th>
                    <th className="p-3.5">Damage Reason</th>
                    <th className="p-3.5">Recorded By</th>
                    <th className="p-3.5">Date & Time</th>
                    <th className="p-3.5 text-center">Session ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDamages.map((dmg) => (
                    <tr key={dmg.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 text-[0.92rem]">{dmg.driver_name || dmg.employee_name || 'Driver'}</div>
                        <div className="text-[0.8rem] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                          <span>{dmg.employee_code || 'EMP'}</span>
                          <span>•</span>
                          <span className="font-mono font-bold text-slate-700">{dmg.vehicle_number || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{dmg.route_name || 'Direct'}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 text-[0.92rem]">{dmg.product_name || 'Product'}</div>
                        <div className="text-[0.8rem] text-slate-400">{dmg.unit || 'Unit'}</div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="font-mono font-black text-[0.92rem] text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 inline-block">
                          {dmg.base_quantity ?? dmg.qty_units ?? 0} {dmg.damage_unit || dmg.unit || 'Pieces'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded-lg text-[0.82rem] font-bold bg-slate-100 text-slate-700 border border-slate-200 inline-block">
                          {dmg.reason || 'Damaged'}
                        </span>
                        {dmg.notes && (
                          <div className="text-[0.8rem] text-slate-500 mt-1 max-w-[200px] truncate" title={dmg.notes}>
                            {dmg.notes}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className="text-[0.82rem] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                          {dmg.verified_by_name || 'Storekeeper'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-700">
                          {dmg.session_date ? new Date(dmg.session_date).toISOString().split('T')[0] : (dmg.created_at ? new Date(dmg.created_at).toISOString().split('T')[0] : 'Today')}
                        </div>
                        <div className="text-[0.8rem] text-slate-400">
                          {dmg.created_at ? new Date(dmg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="font-mono text-[0.8rem] font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {dmg.session_id ? `SESSION-${dmg.session_id}` : 'DIRECT'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (< 768px) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredDamages.map((dmg) => (
                <div key={dmg.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-[0.95rem] text-slate-900">{dmg.driver_name || dmg.employee_name || 'Driver'}</h4>
                      <p className="text-[0.82rem] text-slate-500 font-medium">
                        {dmg.employee_code || 'EMP'} • {dmg.vehicle_number || 'N/A'} • {dmg.route_name || 'Direct'}
                      </p>
                    </div>
                    <span className="font-mono font-black text-[0.92rem] text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                      {dmg.base_quantity ?? dmg.qty_units ?? 0} {dmg.damage_unit || dmg.unit || 'Pieces'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[0.85rem] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="font-bold text-slate-800 block">{dmg.product_name}</span>
                      <span className="text-[0.8rem] text-slate-500">Reason: <b className="text-slate-700">{dmg.reason || 'Damaged'}</b></span>
                    </div>
                    <span className="font-mono text-[0.8rem] font-bold bg-white px-2 py-0.5 rounded-md text-slate-600 border border-slate-200">
                      {dmg.session_id ? `SESSION-${dmg.session_id}` : 'DIRECT'}
                    </span>
                  </div>

                  {dmg.notes && (
                    <p className="text-[0.85rem] text-slate-600 italic px-1">
                      "{dmg.notes}"
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[0.82rem] text-slate-400 pt-1 border-t border-slate-50">
                    <span>Recorded by: <b className="text-slate-600">{dmg.verified_by_name || 'Storekeeper'}</b></span>
                    <span>{dmg.session_date ? new Date(dmg.session_date).toISOString().split('T')[0] : (dmg.created_at ? new Date(dmg.created_at).toISOString().split('T')[0] : 'Today')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
