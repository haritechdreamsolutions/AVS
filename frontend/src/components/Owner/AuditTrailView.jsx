import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ShieldCheck, Search, Filter, Calendar, RefreshCw, 
  User, Activity, Database, CheckCircle, AlertTriangle, 
  ArrowRight, FileText, Clock, ChevronLeft, ChevronRight 
} from 'lucide-react';

export const AuditTrailView = () => {
  const { fetchAuditLogs } = useApp();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');

  const loadAuditLogs = async () => {
    if (!fetchAuditLogs) return;
    setLoading(true);
    try {
      const params = {
        limit: 100,
        page: 1
      };
      if (actionFilter !== 'ALL') params.action = actionFilter;
      if (entityFilter !== 'ALL') params.entity_type = entityFilter;
      const res = await fetchAuditLogs(params);
      setLogs(res?.logs || []);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [actionFilter, entityFilter]);

  const filteredLogs = useMemo(() => {
    return (logs || []).filter(log => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const actor = (log.actor_name || '').toLowerCase();
      const action = (log.action || '').toLowerCase();
      const entity = (log.entity_type || '').toLowerCase();
      const meta = JSON.stringify(log.metadata || {}).toLowerCase();
      return actor.includes(q) || action.includes(q) || entity.includes(q) || meta.includes(q);
    });
  }, [logs, searchQuery]);

  const getActionBadge = (action) => {
    const act = (action || '').toUpperCase();
    if (act.includes('DELETE') || act.includes('REJECT')) {
      return <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">{act}</span>;
    }
    if (act.includes('CREATE') || act.includes('ADD') || act.includes('INWARD')) {
      return <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">{act}</span>;
    }
    if (act.includes('UPDATE') || act.includes('EDIT')) {
      return <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">{act}</span>;
    }
    if (act.includes('VERIFY') || act.includes('ACCEPT') || act.includes('CLOSE')) {
      return <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-300">{act}</span>;
    }
    return <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-300">{act}</span>;
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                SYSTEM AUDIT TRAIL
                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                  Immutable Event Log
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">Enterprise security and activity log across all actions and entities</p>
            </div>
          </div>
        </div>

        <button
          onClick={loadAuditLogs}
          disabled={loading}
          className="relative z-10 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-extrabold text-xs flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Logs
        </button>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by actor, action, details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-slate-500">Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="p-1.5 font-bold bg-slate-50 border border-slate-300 rounded-xl"
            >
              <option value="ALL">All Actions</option>
              <option value="SALE_CREATED">Sale Created</option>
              <option value="EXPENSE_CREATED">Expense Created</option>
              <option value="STOCK_INWARD">Stock Inward</option>
              <option value="STOCK_ALLOCATE">Stock Allocate</option>
              <option value="RETURN_VERIFIED">Return Verified</option>
              <option value="DAMAGE_LOGGED">Damage Logged</option>
              <option value="DAMAGE_VERIFIED">Damage Verified</option>
              <option value="DRIVER_DAY_CLOSED">Day Closed</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-slate-500">Entity:</span>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="p-1.5 font-bold bg-slate-50 border border-slate-300 rounded-xl"
            >
              <option value="ALL">All Entities</option>
              <option value="SALES">Sales</option>
              <option value="EXPENSES">Expenses</option>
              <option value="STOCK">Stock / Inventory</option>
              <option value="RETURNS">Driver Returns</option>
              <option value="DAMAGES">Damages</option>
              <option value="DRIVER_SESSIONS">Driver Sessions</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 font-extrabold text-slate-700 bg-slate-50 uppercase tracking-wider">
                <th className="p-3 pl-4">Timestamp</th>
                <th className="p-3">Actor / User</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity Type</th>
                <th className="p-3">Entity ID</th>
                <th className="p-3 pr-4">Event Metadata / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400 font-sans font-bold">
                    No audit records match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 pl-4 text-slate-500 whitespace-nowrap text-[11px]">
                      {new Date(log.created_at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                      })}
                    </td>
                    <td className="p-3 font-sans">
                      <span className="font-black text-slate-900 block text-xs">{log.actor_name || 'System User'}</span>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {log.actor_user_id || 'N/A'}</span>
                    </td>
                    <td className="p-3">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="p-3 font-sans font-bold text-slate-700">
                      {log.entity_type}
                    </td>
                    <td className="p-3 text-indigo-700 font-bold">
                      #{log.entity_id || '—'}
                    </td>
                    <td className="p-3 pr-4 max-w-xs truncate text-[11px] text-slate-600 font-sans" title={JSON.stringify(log.metadata)}>
                      {typeof log.metadata === 'object' && log.metadata !== null
                        ? Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(' | ')
                        : String(log.metadata || '—')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
