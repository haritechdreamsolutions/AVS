with open('frontend/src/components/Owner/UsersMaster.jsx', 'w', encoding='utf-8') as f:
    f.write('''import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

export const UsersMaster = () => {
  const { apiFetch, currentUser } = useApp();
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Forms state
  const [formData, setFormData] = useState({});
  const [pinData, setPinData] = useState({ pin: '', confirm: '' });
  
  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  
  const API_URL = import.meta.env.VITE_API_URL || '/api';

  const loadData = async () => {
    setLoading(true);
    try {
      const uRes = await apiFetch(API_URL + '/users');
      const uData = await uRes.json();
      setUsers(uData || []);
      
      const eRes = await apiFetch(API_URL + '/employees');
      const eData = await eRes.json();
      setEmployees(eData || []);
    } catch(err) {
      console.error(err);
      alert('Failed to load data');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if(formData.pin !== formData.confirm) return alert('PINs do not match');
    
    try {
      const res = await apiFetch(API_URL + '/users', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if(data.success) {
        setShowAddModal(false);
        setFormData({});
        loadData();
        alert('User created successfully');
      } else {
        alert(data.message || 'Error creating user');
      }
    } catch(err) {
      alert('Error creating user');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch(API_URL + '/users/' + selectedUser.id, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if(data.success) {
        setShowEditModal(false);
        setFormData({});
        loadData();
        alert('User updated successfully');
      } else {
        alert(data.message || 'Error updating user');
      }
    } catch(err) {
      alert('Error updating user');
    }
  };

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    if(pinData.pin !== pinData.confirm) return alert('PINs do not match');
    if(pinData.pin.length < 4) return alert('PIN must be at least 4 digits');
    try {
      const res = await apiFetch(API_URL + '/users/' + selectedUser.id + '/reset-pin', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ pin: pinData.pin })
      });
      const data = await res.json();
      if(data.success) {
        setShowPinModal(false);
        setPinData({pin:'', confirm:''});
        alert('PIN reset successfully');
      } else {
        alert(data.message || 'Error resetting PIN');
      }
    } catch(err) {
      alert('Error resetting PIN');
    }
  };

  const toggleStatus = async (user) => {
    if(user.id === currentUser.id) return alert('Cannot deactivate yourself');
    if(!window.confirm(Are you sure you want to  this user?)) return;
    
    try {
      const res = await apiFetch(API_URL + '/users/' + user.id, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ status: user.status === 'Active' ? 'Inactive' : 'Active' })
      });
      const data = await res.json();
      if(data.success) {
        loadData();
      } else {
        alert(data.message || 'Error updating status');
      }
    } catch(err) {
      alert('Error updating status');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || 
                        (u.login_id && u.login_id.toLowerCase().includes(search.toLowerCase()));
    const matchRole = roleFilter ? u.role === roleFilter : true;
    return matchSearch && matchRole;
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Users Master</h1>
        <button onClick={() => setShowAddModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700">
          + Add User
        </button>
      </div>
      
      <div className="flex gap-4 mb-4 bg-white p-4 rounded shadow">
        <input 
          type="text" 
          placeholder="Search name or login ID..." 
          className="border p-2 rounded flex-1"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="border p-2 rounded" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          <option value="OWNER">Owner</option>
          <option value="EMPLOYEE">Employee / Driver</option>
          <option value="STORE_KEEPER">Store Keeper</option>
        </select>
      </div>

      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="w-full text-left">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3 border-b">ID</th>
              <th className="p-3 border-b">Name</th>
              <th className="p-3 border-b">Emp Code</th>
              <th className="p-3 border-b">Login ID</th>
              <th className="p-3 border-b">Role</th>
              <th className="p-3 border-b">Status</th>
              <th className="p-3 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="p-4 text-center">Loading...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan="7" className="p-4 text-center">No users found.</td></tr>
            ) : (
              filteredUsers.map(u => (
                <tr key={u.id} className="border-b hover:bg-slate-50">
                  <td className="p-3">{u.id}</td>
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="p-3">{u.employee_code || '-'}</td>
                  <td className="p-3">{u.login_id}</td>
                  <td className="p-3">
                    <span className={px-2 py-1 text-xs rounded-full }>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3">
                     <span className={px-2 py-1 text-xs rounded-full }>
                      {u.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button onClick={() => { setSelectedUser(u); setFormData(u); setShowEditModal(true); }} className="text-blue-600 hover:underline text-sm">Edit</button>
                      <button onClick={() => { setSelectedUser(u); setPinData({pin:'', confirm:''}); setShowPinModal(true); }} className="text-orange-600 hover:underline text-sm">Reset PIN</button>
                      <button onClick={() => toggleStatus(u)} className={	ext-sm hover:underline }>
                        {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add User Account</h2>
            <form onSubmit={handleAddSubmit}>
              <div className="mb-4">
                <label className="block text-sm mb-1">Select Existing Employee</label>
                <select required className="w-full border p-2 rounded" value={formData.employee_id || ''} onChange={e => setFormData({...formData, employee_id: e.target.value})}>
                  <option value="">-- Select Employee --</option>
                  {employees.filter(e => !e.login_id).map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_code || emp.id})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Only employees without a login account are shown.</p>
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-1">Login ID</label>
                <input required type="text" className="w-full border p-2 rounded" value={formData.login_id || ''} onChange={e => setFormData({...formData, login_id: e.target.value})} />
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-1">Role</label>
                <select required className="w-full border p-2 rounded" value={formData.role || ''} onChange={e => setFormData({...formData, role: e.target.value})}>
                  <option value="">-- Select Role --</option>
                  <option value="OWNER">OWNER</option>
                  <option value="EMPLOYEE">EMPLOYEE / DRIVER</option>
                  <option value="STORE_KEEPER">STORE KEEPER</option>
                </select>
              </div>
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <label className="block text-sm mb-1">Initial PIN</label>
                  <input required type="password" minLength="4" maxLength="10" className="w-full border p-2 rounded" value={formData.pin || ''} onChange={e => setFormData({...formData, pin: e.target.value})} />
                </div>
                <div className="flex-1">
                  <label className="block text-sm mb-1">Confirm PIN</label>
                  <input required type="password" minLength="4" maxLength="10" className="w-full border p-2 rounded" value={formData.confirm || ''} onChange={e => setFormData({...formData, confirm: e.target.value})} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded hover:bg-gray-100">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Edit User Account: {selectedUser.name}</h2>
            <form onSubmit={handleEditSubmit}>
              <div className="mb-4">
                <label className="block text-sm mb-1">Login ID</label>
                <input required type="text" className="w-full border p-2 rounded" value={formData.login_id || ''} onChange={e => setFormData({...formData, login_id: e.target.value})} />
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-1">Role</label>
                <select required className="w-full border p-2 rounded" value={formData.role || ''} onChange={e => setFormData({...formData, role: e.target.value})}>
                  <option value="OWNER">OWNER</option>
                  <option value="EMPLOYEE">EMPLOYEE / DRIVER</option>
                  <option value="STORE_KEEPER">STORE KEEPER</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-1">Status</label>
                <select required className="w-full border p-2 rounded" value={formData.status || ''} onChange={e => setFormData({...formData, status: e.target.value})}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border rounded hover:bg-gray-100">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Update User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Reset PIN: {selectedUser.name}</h2>
            <form onSubmit={handlePinSubmit}>
              <div className="mb-4">
                <label className="block text-sm mb-1">New 4-digit PIN</label>
                <input required type="password" minLength="4" maxLength="10" className="w-full border p-2 rounded" value={pinData.pin} onChange={e => setPinData({...pinData, pin: e.target.value})} />
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-1">Confirm New PIN</label>
                <input required type="password" minLength="4" maxLength="10" className="w-full border p-2 rounded" value={pinData.confirm} onChange={e => setPinData({...pinData, confirm: e.target.value})} />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowPinModal(false)} className="px-4 py-2 border rounded hover:bg-gray-100">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">Save PIN</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
''')
