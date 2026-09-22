import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  UserPlus, UserCheck, ShieldCheck, Key, Lock, Phone, Mail, 
  Truck, Briefcase, Calendar, CheckCircle2, AlertCircle, RefreshCw, 
  Search, Filter, Plus, ArrowLeft, ArrowRight, User, Trash2
} from 'lucide-react';

export const UsersMaster = () => {
  const { apiFetch, currentUser } = useApp();
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Add User wizard mode: 'EXISTING' | 'NEW_EMP'
  const [addMode, setAddMode] = useState('EXISTING');
  const [newEmpForm, setNewEmpForm] = useState({
    full_name: '',
    employee_code: '',
    phone: '',
    email: '',
    designation: 'Delivery Executive',
    vehicle_number: '',
    route_id: '',
    joining_date: new Date().toISOString().split('T')[0]
  });
  
  // Forms state
  const [formData, setFormData] = useState({ role: 'EMPLOYEE' });
  const [pinData, setPinData] = useState({ pin: '', confirm: '' });
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  
  const API_URL = import.meta.env.VITE_API_URL || '/api';

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const uRes = await apiFetch(API_URL + '/users');
      if (!uRes.ok) throw new Error(`Users API returned status ${uRes.status}`);
      const uData = await uRes.json();
      setUsers(Array.isArray(uData) ? uData : (uData.users || []));
      
      const eRes = await apiFetch(API_URL + '/employees');
      if (eRes.ok) {
        const eData = await eRes.json();
        setEmployees(Array.isArray(eData) ? eData : (eData.employees || []));
      }

      const rRes = await apiFetch(API_URL + '/routes');
      if (rRes.ok) {
        const rData = await rRes.json();
        setRoutes(Array.isArray(rData) ? rData : (rData.routes || []));
      }
    } catch(err) {
      console.error("UsersMaster loadData error:", err);
      setError("Unable to load users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter unlinked active employees
  const unlinkedEmployees = employees.filter(e => (!e.login_id || e.account_status === 'INACTIVE') && e.is_active !== false);

  const openAddModal = () => {
    setFormError(null);
    setAddMode(unlinkedEmployees.length > 0 ? 'EXISTING' : 'NEW_EMP');
    setFormData({ 
      role: 'DRIVER', 
      employee_id: unlinkedEmployees[0]?.id || '',
      route_id: unlinkedEmployees[0]?.route_id ? String(unlinkedEmployees[0].route_id) : ''
    });
    setNewEmpForm({
      full_name: '',
      employee_code: `EMP${String(employees.length + 1).padStart(3, '0')}`,
      phone: '',
      email: '',
      designation: 'Delivery Executive',
      vehicle_number: '',
      route_id: '',
      joining_date: new Date().toISOString().split('T')[0]
    });
    setShowAddModal(true);
  };

  const openEditModal = (u) => {
    setSelectedUser(u);
    const linkedEmp = employees.find(e => e.id === u.employee_id);
    const routeVal = (u.route_id !== undefined && u.route_id !== null)
      ? u.route_id 
      : ((u.routeId !== undefined && u.routeId !== null)
          ? u.routeId 
          : (linkedEmp?.route_id || ''));
    setFormData({
      ...u,
      route_id: routeVal ? String(routeVal) : ''
    });
    setFormError(null);
    setShowEditModal(true);
  };

  const handleCreateEmployeeInline = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!newEmpForm.full_name.trim()) {
      return setFormError('Employee Full Name is required.');
    }

    try {
      setIsSubmitting(true);
      const res = await apiFetch(API_URL + '/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmpForm)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create employee');
      }

      const createdEmp = data.employee;
      // Add to local state list
      setEmployees(prev => [...prev, createdEmp]);
      
      // Auto-select this newly created employee for the user account form
      const suggestedLogin = (createdEmp.employee_code || createdEmp.full_name || 'user')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

      setFormData(prev => ({
        ...prev,
        employee_id: createdEmp.id,
        name: createdEmp.full_name,
        phone: createdEmp.phone,
        login_id: suggestedLogin,
        route_id: createdEmp.route_id ? String(createdEmp.route_id) : (newEmpForm.route_id ? String(newEmpForm.route_id) : ''),
        role: 'DRIVER'
      }));

      setAddMode('EXISTING');
      showToast(`Employee ${createdEmp.full_name} created. Now setup login credentials.`);
    } catch (err) {
      console.error("Inline employee creation failed:", err);
      setFormError(err.message || 'Failed to create employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.login_id || !formData.login_id.trim()) {
      return setFormError('Login ID is required.');
    }
    if (!formData.pin || String(formData.pin).length < 4) {
      return setFormError('PIN must be at least 4 digits.');
    }
    if (formData.pin !== formData.confirm) {
      return setFormError('Initial PIN and Confirm PIN do not match.');
    }
    if ((formData.role === 'EMPLOYEE' || formData.role === 'DRIVER') && !formData.employee_id) {
      return setFormError('Please select an existing employee or create one first.');
    }

    try {
      setIsSubmitting(true);
      const payload = {
        ...formData,
        route_id: (formData.route_id !== undefined && formData.route_id !== '' && formData.route_id !== null) ? Number(formData.route_id) : null
      };
      const res = await apiFetch(API_URL + '/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create user account');
      }

      setShowAddModal(false);
      setFormData({});
      setPinData({ pin: '', confirm: '' });
      showToast(`User account "${data.user?.login_id}" created successfully.`);
      await loadData();
    } catch (err) {
      console.error("Add user failed:", err);
      setFormError(err.message || 'Failed to create user account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    try {
      setIsSubmitting(true);
      const payload = {
        ...formData,
        route_id: (formData.route_id !== undefined && formData.route_id !== '' && formData.route_id !== null) ? Number(formData.route_id) : null
      };
      const res = await apiFetch(API_URL + '/users/' + selectedUser.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let data = {};
      try { data = await res.json(); } catch (e) { data = { success: false, message: `Server response error (${res.status})` }; }
      if (!res.ok || !data.success) throw new Error(data.message || 'Error updating user');
      
      setShowEditModal(false);
      setFormData({});
      showToast('User updated successfully');
      await loadData();
    } catch(err) {
      setFormError(err.message || 'Error updating user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    const pin = String(pinData.pin || '').trim();
    const confirm = String(pinData.confirm || '').trim();

    if (!pin) return setFormError('Please enter a new PIN');
    if (!/^\d{4}$/.test(pin)) return setFormError('PIN must be exactly 4 digits (0-9)');
    if (pin !== confirm) return setFormError('New PIN and Confirm PIN do not match');

    if (!selectedUser?.id) return setFormError('Selected user ID is missing');

    try {
      setIsSubmitting(true);
      const res = await apiFetch(API_URL + '/users/' + selectedUser.id + '/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      let data = {};
      try { data = await res.json(); } catch (e) { data = { success: false, message: `Server response error (${res.status})` }; }
      if (!res.ok || !data.success) throw new Error(data.message || 'Error resetting PIN');

      setShowPinModal(false);
      setPinData({ pin: '', confirm: '' });
      showToast(`PIN reset successfully for ${selectedUser.employee_name || selectedUser.name || selectedUser.login_id}`);
      await loadData();
    } catch(err) {
      setFormError(err.message || 'Error resetting PIN');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (u) => {
    if (u.id === currentUser?.id) {
      return showToast('Cannot delete your own account', 'error');
    }
    if (!window.confirm(`Are you sure you want to permanently delete user "${u.login_id}" (${u.name || u.employee_name})?`)) return;
    
    try {
      const res = await apiFetch(API_URL + '/users/' + u.id, {
        method: 'DELETE'
      });
      let data = {};
      try { data = await res.json(); } catch (e) { data = { success: false, message: `Server error (${res.status}). Ensure backend is deployed.` }; }
      if (res.ok && data.success) {
        showToast(data.message || `User "${u.login_id}" deleted successfully.`);
        await loadData();
      } else {
        showToast(data.message || 'Error deleting user', 'error');
      }
    } catch(err) {
      showToast(err.message || 'Network error deleting user', 'error');
    }
  };

  const toggleStatus = async (user) => {
    if (user.id === currentUser?.id) {
      return showToast('Cannot deactivate your own account', 'error');
    }
    const isAct = (user.status || '').toUpperCase() === 'ACTIVE';
    if (!window.confirm(`Are you sure you want to ${isAct ? "deactivate" : "activate"} user "${user.login_id}"?`)) return;
    
    try {
      const res = await apiFetch(API_URL + '/users/' + user.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: isAct ? 'INACTIVE' : 'ACTIVE' })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`User ${user.login_id} is now ${isAct ? 'INACTIVE' : 'ACTIVE'}`);
        loadData();
      } else {
        showToast(data.message || 'Error updating status', 'error');
      }
    } catch(err) {
      showToast('Error updating status', 'error');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchSearch = (u.name || '').toLowerCase().includes(search.toLowerCase()) || 
                        (u.login_id && u.login_id.toLowerCase().includes(search.toLowerCase())) ||
                        (u.employee_code && u.employee_code.toLowerCase().includes(search.toLowerCase()));
    const matchRole = roleFilter ? u.role === roleFilter : true;
    return matchSearch && matchRole;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* TOAST NOTIFICATION */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-sm font-bold border animate-in slide-in-from-top-2 ${
          notification.type === 'error' 
            ? 'bg-rose-50 border-rose-200 text-rose-800' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {notification.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-600" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-blue-600" /> User Accounts Master
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Manage system login credentials, staff roles, and PostgreSQL-authenticated access.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-extrabold hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button 
            onClick={openAddModal} 
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-blue-500/20 transition"
          >
            <Plus className="w-4 h-4" /> Add User Account
          </button>
        </div>
      </div>
      
      {/* SEARCH AND FILTER BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search by name, login ID, or employee code..." 
            className="w-full pl-10 pr-4 py-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <select 
            className="w-full pl-10 pr-4 py-2.5 text-xs font-extrabold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={roleFilter} 
            onChange={e => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles ({users.length})</option>
            <option value="OWNER">Owner</option>
            <option value="STORE_KEEPER">Store Keeper</option>
            <option value="DRIVER">Driver</option>
            <option value="EMPLOYEE">Employee</option>
          </select>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <span className="font-bold text-xs">{error}</span>
          </div>
          <button 
            onClick={loadData} 
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* USERS TABLE */}
      <div className="overflow-x-auto bg-white rounded-3xl border border-slate-200 shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-extrabold text-[11px]">
              <th className="p-4">ID</th>
              <th className="p-4">Staff Name</th>
              <th className="p-4">Emp Code</th>
              <th className="p-4">Login ID</th>
              <th className="p-4">Role</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {loading ? (
              <tr>
                <td colSpan="7" className="p-12 text-center text-slate-400 font-bold">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                  Loading user accounts from PostgreSQL...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-12 text-center text-slate-400 font-bold">
                  <User className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No user accounts found matching criteria.
                </td>
              </tr>
            ) : (
              filteredUsers.map(u => {
                const isAct = (u.status || '').toUpperCase() === 'ACTIVE';
                const roleBadge = u.role === 'OWNER' 
                  ? 'bg-purple-100 text-purple-800 border-purple-200' 
                  : u.role === 'STORE_KEEPER' 
                    ? 'bg-amber-100 text-amber-800 border-amber-200' 
                    : u.role === 'DRIVER'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-blue-100 text-blue-800 border-blue-200';

                return (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 font-bold text-slate-400">#{u.id}</td>
                    <td className="p-4">
                      <div className="font-extrabold text-slate-900">{u.name}</div>
                      {u.phone && <div className="text-[10px] text-slate-400 font-bold">{u.phone}</div>}
                      {u.role === 'DRIVER' && (
                        <div className="text-[10px] font-bold text-blue-600 mt-0.5">
                          Route: {u.route_name ? `${u.route_name} (${u.route_code || ''})` : 'Unassigned'}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-bold">
                        {u.employee_code || '-'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-mono font-black text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded border border-blue-100">
                        {u.login_id}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full font-black text-[10px] uppercase border ${roleBadge}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        isAct 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isAct ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        {isAct ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openEditModal(u)} 
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => { setSelectedUser(u); setPinData({pin:'', confirm:''}); setFormError(null); setShowPinModal(true); }} 
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Reset PIN
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u)} 
                          className="px-2.5 py-1 rounded-lg text-xs font-bold border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center gap-1 cursor-pointer"
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ================================================================= */}
      {/* MODAL 1: ADD USER ACCOUNT (WITH INLINE EMPLOYEE CREATION)         */}
      {/* ================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-600" /> 
                  {addMode === 'NEW_EMP' ? 'Step 1: Create Employee Record' : 'Create User Account'}
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {addMode === 'NEW_EMP' 
                    ? 'Fill staff profile in PostgreSQL, then configure credentials.' 
                    : 'Link an existing employee to application login credentials.'}
                </p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold transition"
              >
                ✕
              </button>
            </div>

            {/* Error banner inside modal */}
            {formError && (
              <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="p-6 space-y-5">
              
              {/* TAB SELECTOR: Existing Employee vs Create New Employee */}
              <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-extrabold">
                <button
                  type="button"
                  onClick={() => { setAddMode('EXISTING'); setFormError(null); }}
                  className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                    addMode === 'EXISTING' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" /> Select Existing Employee ({unlinkedEmployees.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setAddMode('NEW_EMP'); setFormError(null); }}
                  className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                    addMode === 'NEW_EMP' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" /> + Create New Employee
                </button>
              </div>

              {/* OPTION A: INLINE EMPLOYEE CREATION FORM */}
              {addMode === 'NEW_EMP' ? (
                <form onSubmit={handleCreateEmployeeInline} className="space-y-4">
                  <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-900 text-xs rounded-2xl space-y-1">
                    <span className="font-extrabold flex items-center gap-1.5">
                      ℹ️ Inline Employee Setup
                    </span>
                    <p className="text-slate-600 text-[11px]">
                      Saving this employee will save their profile to PostgreSQL and automatically bring you to the PIN setup step.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      required 
                      type="text" 
                      placeholder="e.g. Kumar S or Suresh Driver"
                      className="w-full border border-slate-300 p-2.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      value={newEmpForm.full_name} 
                      onChange={e => setNewEmpForm({...newEmpForm, full_name: e.target.value})} 
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Employee Code <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        required 
                        type="text" 
                        placeholder="e.g. EMP002"
                        className="w-full border border-slate-300 p-2.5 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        value={newEmpForm.employee_code} 
                        onChange={e => setNewEmpForm({...newEmpForm, employee_code: e.target.value.toUpperCase()})} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Phone Number
                      </label>
                      <input 
                        type="tel" 
                        placeholder="e.g. 9842100000"
                        className="w-full border border-slate-300 p-2.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        value={newEmpForm.phone} 
                        onChange={e => setNewEmpForm({...newEmpForm, phone: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Designation
                      </label>
                      <select 
                        className="w-full border border-slate-300 p-2.5 rounded-xl text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        value={newEmpForm.designation}
                        onChange={e => setNewEmpForm({...newEmpForm, designation: e.target.value})}
                      >
                        <option value="Delivery Executive">Delivery Executive / Driver</option>
                        <option value="Store Assistant">Store Assistant / Keeper</option>
                        <option value="Supervisor">Supervisor</option>
                        <option value="Accountant">Accountant</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Vehicle Number (Optional)
                      </label>
                      <input 
                        type="text" 
                        placeholder="e.g. TN 32 AB 1234"
                        className="w-full border border-slate-300 p-2.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        value={newEmpForm.vehicle_number} 
                        onChange={e => setNewEmpForm({...newEmpForm, vehicle_number: e.target.value.toUpperCase()})} 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      Assigned Distribution Route (Optional)
                    </label>
                    <select 
                      className="w-full border border-slate-300 p-2.5 rounded-xl text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      value={newEmpForm.route_id}
                      onChange={e => setNewEmpForm({...newEmpForm, route_id: e.target.value})}
                    >
                      <option value="">-- None / Unassigned --</option>
                      {routes.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                    <button 
                      type="button" 
                      onClick={() => setShowAddModal(false)} 
                      className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-extrabold text-slate-600 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-blue-500/20 transition disabled:opacity-50"
                    >
                      Save Employee & Proceed <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              ) : (

                /* OPTION B: USER ACCOUNT CREDENTIALS FORM */
                <form onSubmit={handleAddUserSubmit} className="space-y-4">
                  {unlinkedEmployees.length === 0 && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-2xl space-y-2">
                      <span className="font-extrabold flex items-center gap-1.5">
                        ⚠️ No active unlinked employees available.
                      </span>
                      <p className="text-slate-600 text-[11px]">
                        All existing employees already have user accounts. Click the button below to create a new employee first.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setAddMode('NEW_EMP'); setFormError(null); }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-lg transition inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> + Create New Employee Now
                      </button>
                    </div>
                  )}

                  {/* Role Selector */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      System Role <span className="text-rose-500">*</span>
                    </label>
                    <select 
                      required 
                      className="w-full border border-slate-300 p-2.5 rounded-xl text-xs font-extrabold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      value={formData.role || 'DRIVER'} 
                      onChange={e => setFormData({...formData, role: e.target.value})}
                    >
                      <option value="DRIVER">DRIVER (Vehicle Delivery & Stock Allocation)</option>
                      <option value="EMPLOYEE">EMPLOYEE (Field Sales / General Staff)</option>
                      <option value="STORE_KEEPER">STORE KEEPER (Stock Inward & Vehicle Issuance)</option>
                      <option value="OWNER">OWNER (Full Administrative Access)</option>
                    </select>
                  </div>

                  {/* Select Employee Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                        Linked Employee {(formData.role === 'EMPLOYEE' || formData.role === 'DRIVER') && <span className="text-rose-500">*</span>}
                      </label>
                      <button 
                        type="button" 
                        onClick={() => setAddMode('NEW_EMP')} 
                        className="text-[11px] font-extrabold text-blue-600 hover:underline flex items-center gap-0.5"
                      >
                        + New Employee
                      </button>
                    </div>
                    <select 
                      required={formData.role === 'EMPLOYEE' || formData.role === 'DRIVER'} 
                      className="w-full border border-slate-300 p-2.5 rounded-xl text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      value={formData.employee_id || ''} 
                      onChange={e => {
                        const empId = e.target.value;
                        const emp = employees.find(em => String(em.id) === String(empId));
                        setFormData({
                          ...formData, 
                          employee_id: empId,
                          name: emp ? (emp.full_name || emp.name) : formData.name,
                          phone: emp?.phone || formData.phone,
                          login_id: formData.login_id || (emp ? ((emp.full_name || emp.employee_code || '').toLowerCase().replace(/[^a-z0-9]/g, '')) : ''),
                          route_id: (emp?.route_id !== undefined && emp?.route_id !== null) ? String(emp.route_id) : (formData.route_id || '')
                        });
                      }}
                    >
                      <option value="">-- Select Employee --</option>
                      {unlinkedEmployees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          👤 {emp.full_name || emp.name} ({emp.employee_code || `EMP-${emp.id}`})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Route Selection for DRIVER */}
                  {formData.role === 'DRIVER' && (
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Route <span className="text-rose-500">*</span>
                      </label>
                      <select 
                        required
                        className="w-full border border-slate-300 p-2.5 rounded-xl text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        value={formData.route_id !== undefined && formData.route_id !== null ? String(formData.route_id) : ''} 
                        onChange={e => setFormData({...formData, route_id: e.target.value})}
                      >
                        <option value="">-- Select Route --</option>
                        {routes.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Login ID Input */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      Unique Login ID <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      required 
                      type="text" 
                      placeholder="e.g. ravi01, kumar_store"
                      className="w-full border border-slate-300 p-2.5 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      value={formData.login_id || ''} 
                      onChange={e => setFormData({...formData, login_id: e.target.value.toLowerCase().trim()})} 
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Used to sign in across web & mobile POS.</p>
                  </div>

                  {/* PIN and Confirm PIN */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Initial PIN <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        required 
                        type="password" 
                        minLength={4} 
                        maxLength={10} 
                        placeholder="4-digit PIN"
                        className="w-full border border-slate-300 p-2.5 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        value={formData.pin || ''} 
                        onChange={e => setFormData({...formData, pin: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Confirm PIN <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        required 
                        type="password" 
                        minLength={4} 
                        maxLength={10} 
                        placeholder="Confirm PIN"
                        className="w-full border border-slate-300 p-2.5 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        value={formData.confirm || ''} 
                        onChange={e => setFormData({...formData, confirm: e.target.value})} 
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                    <button 
                      type="button" 
                      onClick={() => setShowAddModal(false)} 
                      className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-extrabold text-slate-600 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmitting || (formData.role === 'EMPLOYEE' && unlinkedEmployees.length === 0 && !formData.employee_id)}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-extrabold shadow-md shadow-blue-500/20 transition flex items-center gap-1.5"
                    >
                      {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                      Create User Account
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 2: EDIT USER ACCOUNT                                        */}
      {/* ================================================================= */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-black text-slate-900">Edit User: {selectedUser.name}</h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Display Name</label>
                <input 
                  type="text" 
                  className="w-full border border-slate-300 p-2.5 rounded-xl font-bold" 
                  value={formData.name || ''} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Login ID</label>
                <input 
                  required 
                  type="text" 
                  className="w-full border border-slate-300 p-2.5 rounded-xl font-mono font-bold" 
                  value={formData.login_id || ''} 
                  onChange={e => setFormData({...formData, login_id: e.target.value})} 
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Role</label>
                <select 
                  required 
                  className="w-full border border-slate-300 p-2.5 rounded-xl font-bold bg-white" 
                  value={formData.role || ''} 
                  onChange={e => setFormData({...formData, role: e.target.value})}
                >
                  <option value="OWNER">OWNER</option>
                  <option value="STORE_KEEPER">STORE KEEPER</option>
                  <option value="DRIVER">DRIVER</option>
                  <option value="EMPLOYEE">EMPLOYEE</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status</label>
                <select 
                  required 
                  className="w-full border border-slate-300 p-2.5 rounded-xl font-bold bg-white" 
                  value={(formData.status || '').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'} 
                  onChange={e => setFormData({...formData, status: e.target.value})}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              {formData.role === 'DRIVER' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Route <span className="text-rose-500">*</span>
                  </label>
                  <select 
                    required
                    className="w-full border border-slate-300 p-2.5 rounded-xl font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    value={formData.route_id !== undefined && formData.route_id !== null ? String(formData.route_id) : ''} 
                    onChange={e => setFormData({...formData, route_id: e.target.value})}
                  >
                    <option value="">-- Select Route --</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border rounded-xl font-bold">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 3: RESET PIN                                                */}
      {/* ================================================================= */}
      {showPinModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-600" /> Reset PIN: {selectedUser?.employee_name || selectedUser?.name || selectedUser?.login_id}
              </h2>
              <button onClick={() => setShowPinModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handlePinSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">New 4-digit PIN</label>
                <input 
                  required 
                  type="password" 
                  minLength={4} 
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  placeholder="••••"
                  className="w-full border border-slate-300 p-2.5 rounded-xl font-mono font-bold tracking-widest text-center text-base" 
                  value={pinData.pin} 
                  onChange={e => setPinData({...pinData, pin: e.target.value.replace(/\D/g, '').slice(0, 4)})} 
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Confirm New PIN</label>
                <input 
                  required 
                  type="password" 
                  minLength={4} 
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  placeholder="••••"
                  className="w-full border border-slate-300 p-2.5 rounded-xl font-mono font-bold tracking-widest text-center text-base" 
                  value={pinData.confirm} 
                  onChange={e => setPinData({...pinData, confirm: e.target.value.replace(/\D/g, '').slice(0, 4)})} 
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowPinModal(false)} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md shadow-amber-600/20 transition">
                  {isSubmitting ? 'Updating...' : 'Update PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
