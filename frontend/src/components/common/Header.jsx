import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Truck, LogOut, ShieldCheck, UserCheck, Bell, CheckCheck, AlertTriangle, Clock, RefreshCw, X, Package } from 'lucide-react';

export const Header = ({ onLogout }) => {
  const { 
    currentUser, activeRole, 
    fetchNotifications, markNotificationRead, markAllNotificationsRead 
  } = useApp();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const dropdownRef = useRef(null);

  const loadNotifications = async () => {
    if (!fetchNotifications) return;
    try {
      setLoadingNotes(true);
      const res = await fetchNotifications();
      if (res && res.success) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unread_count || 0);
      }
    } catch (e) {
      console.error("Error loading notifications in Header:", e);
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 15000); // 15s poll for alerts
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    if (markNotificationRead) {
      await markNotificationRead(id);
      loadNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    if (markAllNotificationsRead) {
      await markAllNotificationsRead();
      loadNotifications();
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md glow-blue">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-base text-slate-900 tracking-wide uppercase">
                AVS AGENCIES
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 border border-blue-200">
                POS
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-semibold leading-none mt-0.5">
              AVS MANAGEMENT SYSTEM
            </p>
          </div>
        </div>

        {/* Right Info & Role Chip & Notifications */}
        <div className="flex items-center gap-3">
          {(activeRole === 'EMPLOYEE' || activeRole === 'DRIVER') && (
            <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl text-xs border border-slate-200 font-bold">
              <Truck className="w-4 h-4 text-blue-600" />
              <span className="text-slate-800">{currentUser?.vehicle_number || currentUser?.vehicle_no || 'Field Vehicle'}</span>
            </div>
          )}

          {/* Notification Bell Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => {
                setDropdownOpen(!dropdownOpen);
                if (!dropdownOpen) loadNotifications();
              }}
              className="relative p-2 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition"
              title="System Alerts & Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Card */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-3xl shadow-2xl p-4 z-50 text-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-600" />
                    <h4 className="font-extrabold text-slate-900 text-xs">Alerts & Notifications</h4>
                    {unreadCount > 0 && (
                      <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.2 rounded-full border border-rose-300">
                        {unreadCount} Unread
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[10px] font-black text-blue-600 hover:text-blue-800 flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-blue-50 transition"
                      >
                        <CheckCheck className="w-3 h-3" /> Mark all read
                      </button>
                    )}
                    <button onClick={() => setDropdownOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-50">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 font-bold">
                      <Package className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                      No notifications or alerts.
                    </div>
                  ) : (
                    notifications.map(n => {
                      const isUnread = !n.is_read;
                      return (
                        <div
                          key={n.id}
                          onClick={(e) => handleMarkAsRead(n.id, e)}
                          className={`p-2.5 rounded-2xl border transition flex items-start gap-2.5 cursor-pointer ${
                            isUnread 
                              ? 'bg-amber-50/50 border-amber-200 hover:bg-amber-50' 
                              : 'bg-white border-slate-100 hover:bg-slate-50 opacity-75'
                          }`}
                        >
                          <div className="mt-0.5">
                            {n.notification_type === 'LOW_STOCK' ? (
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                            ) : n.notification_type === 'PENDING_RETURN' ? (
                              <Clock className="w-4 h-4 text-purple-600" />
                            ) : n.notification_type === 'PENDING_DAMAGE' ? (
                              <AlertTriangle className="w-4 h-4 text-rose-600" />
                            ) : (
                              <Bell className="w-4 h-4 text-blue-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-slate-900 text-xs truncate">{n.title}</span>
                              {isUnread && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>}
                            </div>
                            <p className="text-[11px] text-slate-600 font-medium line-clamp-2 mt-0.5">{n.message}</p>
                            <span className="text-[9px] text-slate-400 font-mono block mt-1">
                              {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
            <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
              {currentUser?.name ? currentUser.name[0] : 'U'}
            </div>
            <div className="text-left hidden sm:block pr-2">
              <div className="font-bold text-xs text-slate-900 leading-tight">{currentUser?.name}</div>
              <div className="text-[9px] text-emerald-600 font-extrabold uppercase">{activeRole}</div>
            </div>

            <button
              onClick={onLogout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-slate-100 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </header>
  );
};
