import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  AlertTriangle, Users, Package, Search, 
  Calendar, RefreshCw, Filter, Download, Truck, 
  MapPin, User, Clock, FileText, X, CheckCircle2,
  ShieldAlert, Box, Layers, ArrowRight, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { generateMissingPiecesPDFReport } from '../../utils/pdfReportGenerator';

export const OwnerMissingPiecesView = () => {
  const { fetchMissingStockReport, drivers = [], products = [], routes = [], companyInfo } = useApp();

  const [loading, setLoading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [missingData, setMissingData] = useState({ records: [], summary: {} });
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  const [selectedPeriod, setSelectedPeriod] = useState('ALL'); // 'TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'ALL', 'CUSTOM'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('ALL');
  const [selectedProductId, setSelectedProductId] = useState('ALL');
  const [selectedRoute, setSelectedRoute] = useState('ALL');

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

  const loadMissingStockData = async () => {
    setLoading(true);
    try {
      const dateFilters = getDateRangeForPeriod(selectedPeriod);
      const filterParams = {
        ...dateFilters,
        driver_id: selectedDriverId !== 'ALL' ? selectedDriverId : undefined,
        product_id: selectedProductId !== 'ALL' ? selectedProductId : undefined
      };
      const res = await fetchMissingStockReport(filterParams);
      setMissingData(res || { records: [], summary: {} });
    } catch (err) {
      console.error('Error fetching missing stock report:', err);
      toast.error('Failed to load missing stock report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMissingStockData();
  }, [selectedPeriod, customStartDate, customEndDate, selectedDriverId, selectedProductId]);

  // Client-side query search and route filtering
  const filteredMissingRecords = useMemo(() => {
    const records = missingData.records || [];
    return records.filter(item => {
      // Must be missing > 0
      const missingQty = Number(item.missing_quantity ?? item.shortage_quantity ?? 0);
      if (missingQty <= 0) return false;

      if (selectedDriverId !== 'ALL') {
        if (String(item.driver_id) !== String(selectedDriverId)) return false;
      }
      if (selectedProductId !== 'ALL') {
        if (String(item.product_id) !== String(selectedProductId)) return false;
      }
      if (selectedRoute !== 'ALL') {
        if ((item.route_name || '').toLowerCase() !== selectedRoute.toLowerCase()) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const dName = (item.driver_name || '').toLowerCase();
        const code = (item.employee_code || '').toLowerCase();
        const pName = (item.product_name || '').toLowerCase();
        const vNum = (item.vehicle_number || '').toLowerCase();
        const rName = (item.route_name || '').toLowerCase();
        const retNo = (item.return_no || '').toLowerCase();
        const reason = (item.shortage_reason || '').toLowerCase();
        const session = String(item.session_id || '').toLowerCase();
        if (!dName.includes(q) && !code.includes(q) && !pName.includes(q) && !vNum.includes(q) && !rName.includes(q) && !retNo.includes(q) && !reason.includes(q) && !session.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [missingData, selectedDriverId, selectedProductId, selectedRoute, searchQuery]);

  // Driver-wise aggregation (ONLY drivers with missing > 0)
  const driverSummaryList = useMemo(() => {
    const map = new Map();
    filteredMissingRecords.forEach(rec => {
      const id = String(rec.driver_id || '0');
      const name = rec.driver_name || 'Driver';
      const code = rec.employee_code || 'EMP';
      const vehicle = rec.vehicle_number || 'N/A';
      const missingQty = Number(rec.missing_quantity ?? rec.shortage_quantity ?? 0);
      const current = map.get(id) || { id, name, code, vehicle, totalMissing: 0, count: 0 };
      current.totalMissing += missingQty;
      current.count += 1;
      map.set(id, current);
    });
    return Array.from(map.values()).sort((a, b) => b.totalMissing - a.totalMissing);
  }, [filteredMissingRecords]);

  // Overall KPI Metrics
  const totalMissingPieces = useMemo(() => {
    return filteredMissingRecords.reduce((sum, r) => sum + Number(r.missing_quantity ?? r.shortage_quantity ?? 0), 0);
  }, [filteredMissingRecords]);

  const uniqueProductsCount = useMemo(() => {
    const pids = new Set(filteredMissingRecords.map(r => String(r.product_id || r.product_name)));
    return pids.size;
  }, [filteredMissingRecords]);

  const uniqueDriversCount = useMemo(() => {
    const dids = new Set(filteredMissingRecords.map(r => String(r.driver_id || '0')));
    return dids.size;
  }, [filteredMissingRecords]);

  const openMissingSessionsCount = useMemo(() => {
    const sessions = new Set(filteredMissingRecords.map(r => String(r.return_id || r.session_id || '0')));
    return sessions.size;
  }, [filteredMissingRecords]);

  const handleDownloadPDFReport = async () => {
    if (filteredMissingRecords.length === 0) {
      toast.error('No missing stock records to generate PDF');
      return;
    }
    setIsGeneratingPDF(true);
    try {
      toast.info('Generating Missing Pieces PDF...');
      const selectedDriverObj = drivers.find(d => String(d.id || d.employee_id) === String(selectedDriverId));
      const driverName = selectedDriverId === 'ALL' ? 'All Drivers' : (selectedDriverObj?.full_name || selectedDriverObj?.name || 'Selected Driver');

      const filename = await generateMissingPiecesPDFReport({
        missingRecords: filteredMissingRecords,
        period: selectedPeriod,
        dateRangeText: selectedPeriod === 'CUSTOM' ? `${customStartDate} to ${customEndDate}` : selectedPeriod.replace(/_/g, ' '),
        selectedDriverName: driverName,
        companyInfo: companyInfo || {}
      });
      toast.success(`PDF report downloaded: ${filename}`);
    } catch (err) {
      console.error('Error generating missing pieces PDF:', err);
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
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-[clamp(1.35rem,2.2vw,1.85rem)] text-slate-900 tracking-tight leading-tight">Missing Pieces & Shortage Tracking</h1>
              <p className="text-[clamp(0.85rem,1.1vw,0.95rem)] text-slate-500 font-medium mt-0.5">Reconciled stock shortages during physical driver returns</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadMissingStockData}
            disabled={loading}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[0.88rem] font-bold flex items-center gap-1.5 transition cursor-pointer min-h-[42px]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleDownloadPDFReport}
            disabled={isGeneratingPDF}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-[0.92rem] font-bold flex items-center gap-2 shadow-xs transition cursor-pointer min-h-[42px] disabled:opacity-75"
          >
            <Download className={`w-4 h-4 ${isGeneratingPDF ? 'animate-bounce' : ''}`} />
            {isGeneratingPDF ? 'Generating PDF...' : 'Download PDF Report'}
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="glass-card p-4 md:p-5 rounded-2xl bg-white border-l-4 border-l-amber-500 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[0.85rem] text-slate-600 font-extrabold uppercase tracking-tight">
            <span>Total Missing Pieces</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="font-mono font-black text-[clamp(1.4rem,2vw,1.7rem)] text-amber-600 mt-2">
            {totalMissingPieces.toLocaleString()}
          </div>
          <span className="text-[0.82rem] text-slate-400 font-medium mt-1">Total physical stock shortage</span>
        </div>

        <div className="glass-card p-4 md:p-5 rounded-2xl bg-white border-l-4 border-l-rose-500 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[0.85rem] text-slate-600 font-extrabold uppercase tracking-tight">
            <span>Products With Shortage</span>
            <Package className="w-4 h-4 text-rose-500" />
          </div>
          <div className="font-mono font-black text-[clamp(1.4rem,2vw,1.7rem)] text-rose-600 mt-2">
            {uniqueProductsCount}
          </div>
          <span className="text-[0.82rem] text-slate-400 font-medium mt-1">SKUs with missing quantities</span>
        </div>

        <div className="glass-card p-4 md:p-5 rounded-2xl bg-white border-l-4 border-l-indigo-500 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[0.85rem] text-slate-600 font-extrabold uppercase tracking-tight">
            <span>Drivers With Shortage</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="font-mono font-black text-[clamp(1.4rem,2vw,1.7rem)] text-indigo-600 mt-2">
            {uniqueDriversCount}
          </div>
          <span className="text-[0.82rem] text-slate-400 font-medium mt-1">Drivers with shortage records</span>
        </div>

        <div className="glass-card p-4 md:p-5 rounded-2xl bg-white border-l-4 border-l-slate-500 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[0.85rem] text-slate-600 font-extrabold uppercase tracking-tight">
            <span>Missing Sessions</span>
            <Layers className="w-4 h-4 text-slate-500" />
          </div>
          <div className="font-mono font-black text-[clamp(1.4rem,2vw,1.7rem)] text-slate-700 mt-2">
            {openMissingSessionsCount}
          </div>
          <span className="text-[0.82rem] text-slate-400 font-medium mt-1">Return sessions with variance</span>
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
                  ? 'bg-amber-600 text-white shadow-xs' 
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
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-[0.88rem] font-medium focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex items-center gap-1.5 text-[0.85rem]">
              <span className="text-slate-500 font-bold">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-[0.88rem] font-medium focus:ring-2 focus:ring-amber-500"
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
              placeholder="Search driver, product, return #..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-[0.88rem] rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 min-h-[40px]"
            />
          </div>

          {/* Driver Filter */}
          <select
            value={selectedDriverId}
            onChange={e => setSelectedDriverId(e.target.value)}
            className="w-full px-3 py-2 text-[0.88rem] rounded-xl border border-slate-300 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500 min-h-[40px]"
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
            className="w-full px-3 py-2 text-[0.88rem] rounded-xl border border-slate-300 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500 min-h-[40px]"
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
            className="w-full px-3 py-2 text-[0.88rem] rounded-xl border border-slate-300 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500 min-h-[40px]"
          >
            <option value="ALL">All Routes ({routes.length})</option>
            {routes.map(r => (
              <option key={r.id} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Driver-Wise Missing Summary Dimension */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600" />
            <h3 className="font-extrabold text-[0.92rem] uppercase tracking-wider text-slate-800">
              Driver-Wise Missing Summary ({driverSummaryList.length} Drivers with Missing Stock)
            </h3>
          </div>
          {selectedDriverId !== 'ALL' && (
            <button
              onClick={() => setSelectedDriverId('ALL')}
              className="text-[0.85rem] text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Show All Drivers
            </button>
          )}
        </div>

        {driverSummaryList.length === 0 ? (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[0.88rem] font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Excellent! Zero missing stock records found for this filter period. All returns are fully reconciled.</span>
          </div>
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
                      ? 'bg-amber-50 border-amber-500 shadow-xs ring-2 ring-amber-400/30' 
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80 hover:border-slate-300'
                  }`}
                >
                  <div className="truncate mr-2">
                    <h4 className="font-extrabold text-[0.92rem] text-slate-900 truncate">{driver.name}</h4>
                    <p className="text-[0.8rem] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                      <span>{driver.code}</span>
                      <span>•</span>
                      <span>{driver.count} short items</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-black text-[1rem] text-amber-600 block">
                      {driver.totalMissing} Pieces
                    </span>
                    <span className="text-[0.75rem] font-bold text-slate-400 uppercase">Missing</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detailed Reconciliation Table / Mobile Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-extrabold text-[0.92rem] uppercase tracking-wider text-slate-800">
              Detailed Missing Reconciliation Records ({filteredMissingRecords.length} Items)
            </h3>
          </div>
        </div>

        {filteredMissingRecords.length === 0 ? (
          <div className="text-center py-12 px-4">
            <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="text-[0.95rem] font-bold text-slate-700">No Shortage or Missing Records</p>
            <p className="text-[0.85rem] text-slate-400 mt-1">All driver returns match the expected allocated, sold, and damaged quantities perfectly.</p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-[0.88rem] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold text-[0.82rem] uppercase tracking-wider">
                    <th className="p-3.5">Driver & Vehicle</th>
                    <th className="p-3.5">Route</th>
                    <th className="p-3.5">Product</th>
                    <th className="p-3.5 text-center">Allocated</th>
                    <th className="p-3.5 text-center">Sold</th>
                    <th className="p-3.5 text-center">Damaged</th>
                    <th className="p-3.5 text-center">Expected</th>
                    <th className="p-3.5 text-center">Actual Return</th>
                    <th className="p-3.5 text-center">Missing Qty</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5">Storekeeper</th>
                    <th className="p-3.5">Date & Time</th>
                    <th className="p-3.5 text-center">Return #</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMissingRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-amber-50/40 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 text-[0.92rem]">{rec.driver_name || 'Driver'}</div>
                        <div className="text-[0.8rem] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                          <span>{rec.employee_code || 'EMP'}</span>
                          <span>•</span>
                          <span className="font-mono font-bold text-slate-700">{rec.vehicle_number || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{rec.route_name || 'Direct'}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 text-[0.92rem]">{rec.product_name || 'Product'}</div>
                        <div className="text-[0.8rem] text-slate-400">{rec.unit || 'Pieces'}</div>
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-slate-600">
                        {rec.allocated_quantity ?? 0}
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-emerald-600">
                        {rec.sold_quantity ?? 0}
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-rose-600">
                        {rec.damaged_quantity ?? 0}
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-slate-700 bg-slate-50/50">
                        {rec.expected_quantity ?? 0}
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-blue-700 bg-blue-50/30">
                        {rec.actual_quantity ?? 0}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="font-mono font-black text-[0.92rem] text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-300 inline-block shadow-2xs">
                          {rec.missing_quantity ?? 0} {rec.unit || 'Pieces'}
                        </span>
                        {rec.shortage_reason && (
                          <div className="text-[0.8rem] text-slate-500 mt-1 max-w-[160px] truncate" title={rec.shortage_reason}>
                            {rec.shortage_reason}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="text-[0.78rem] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                          {rec.status || 'MISSING'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="text-[0.82rem] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                          {rec.storekeeper_name || 'Storekeeper'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-700">
                          {rec.date || (rec.created_at ? new Date(rec.created_at).toISOString().split('T')[0] : 'Today')}
                        </div>
                        <div className="text-[0.8rem] text-slate-400">
                          {rec.created_at ? new Date(rec.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="font-mono text-[0.8rem] font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {rec.return_no || (rec.session_id ? `S-${rec.session_id}` : 'RET')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Card View (< 1024px) */}
            <div className="block lg:hidden divide-y divide-slate-100">
              {filteredMissingRecords.map((rec) => (
                <div key={rec.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-[0.95rem] text-slate-900">{rec.driver_name || 'Driver'}</h4>
                      <p className="text-[0.82rem] text-slate-500 font-medium">
                        {rec.employee_code || 'EMP'} • {rec.vehicle_number || 'N/A'} • {rec.route_name || 'Direct'}
                      </p>
                    </div>
                    <span className="font-mono font-black text-[0.92rem] text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300">
                      -{rec.missing_quantity ?? 0} {rec.unit || 'Pieces'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[0.9rem] text-slate-900">{rec.product_name}</span>
                      <span className="text-[0.78rem] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                        {rec.status || 'MISSING'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-[0.82rem] pt-1 border-t border-slate-200">
                      <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                        <span className="text-[0.75rem] text-slate-400 uppercase font-bold block">Alloc</span>
                        <span className="font-mono font-bold text-slate-700">{rec.allocated_quantity ?? 0}</span>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                        <span className="text-[0.75rem] text-slate-400 uppercase font-bold block">Sold</span>
                        <span className="font-mono font-bold text-emerald-600">{rec.sold_quantity ?? 0}</span>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                        <span className="text-[0.75rem] text-slate-400 uppercase font-bold block">Damage</span>
                        <span className="font-mono font-bold text-rose-600">{rec.damaged_quantity ?? 0}</span>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                        <span className="text-[0.75rem] text-slate-400 uppercase font-bold block">Expected</span>
                        <span className="font-mono font-bold text-slate-800">{rec.expected_quantity ?? 0}</span>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                        <span className="text-[0.75rem] text-slate-400 uppercase font-bold block">Actual</span>
                        <span className="font-mono font-bold text-blue-700">{rec.actual_quantity ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  {rec.shortage_reason && (
                    <p className="text-[0.85rem] text-slate-600 italic px-1">
                      Reason: "{rec.shortage_reason}"
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[0.82rem] text-slate-400 pt-1 border-t border-slate-50">
                    <span>Storekeeper: <b className="text-slate-600">{rec.storekeeper_name || 'Storekeeper'}</b></span>
                    <span>{rec.date || (rec.created_at ? new Date(rec.created_at).toISOString().split('T')[0] : 'Today')} ({rec.return_no || 'RET'})</span>
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
