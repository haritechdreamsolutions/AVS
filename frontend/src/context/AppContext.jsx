import React, { createContext, useContext, useState, useEffect } from 'react';

// Helper for authenticated requests
export const apiFetch = async (url, options = {}) => {
  return window.fetch(url, {
    ...options,
    credentials: 'include',
  });
};

// Dynamic API URL for Local & Cloud Hosting (Netlify / Render / Vercel)
const rawApiUrl = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '');
export const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeRole, setActiveRole] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [companyInfo, setCompanyInfo] = useState({
    name: "AVS AGENCIES",
    subtitle: "Distribution Management System",
    address: "Main Road, Salem, Tamil Nadu",
    phone: "+91 98765 43210"
  });

  const [shops, setShops] = useState([]);
  const [villages, setVillages] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [employeeStock, setEmployeeStock] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [freezers, setFreezers] = useState(() => {
    try {
      const saved = localStorage.getItem('avs_freezers_cache');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Sync freezers to localStorage
  useEffect(() => {
    if (Array.isArray(freezers) && freezers.length > 0) {
      try {
        localStorage.setItem('avs_freezers_cache', JSON.stringify(freezers));
      } catch (e) {}
    }
  }, [freezers]);

  const [freezerModels, setFreezerModels] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeBill, setActiveBill] = useState(null);

  const checkSession = async () => {
    try {
      const res = await apiFetch(`${API_URL}/auth/me`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setCurrentUser(data.user);
          setActiveRole(data.user.role);
        } else {
          setCurrentUser(null);
          setActiveRole(null);
        }
      } else {
        setCurrentUser(null);
        setActiveRole(null);
      }
    } catch (err) {
      console.error("Session check failed", err);
      setCurrentUser(null);
      setActiveRole(null);
    } finally {
      setIsAuthChecking(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const fetchData = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const stockEmpId = currentUser?.employee_id || currentUser?.id;
      const isOwner = (currentUser?.role || '').toUpperCase() === 'OWNER' || (activeRole || '').toUpperCase() === 'OWNER';
      const [shopsRes, villagesRes, prodRes, catRes, empStockRes, summaryRes, salesRes, expRes, movRes, usersRes, routesRes, empRes, driversRes, freezerModelsRes, freezersRes] = await Promise.all([
        apiFetch(`${API_URL}/shops`).then(r => r.ok ? r.json() : []).catch(() => []),
        apiFetch(`${API_URL}/villages`).then(r => r.ok ? r.json() : []).catch(() => []),
        apiFetch(`${API_URL}/products`).then(r => r.ok ? r.json() : []).catch(() => []),
        apiFetch(`${API_URL}/categories`).then(r => r.ok ? r.json() : []).catch(() => []),
        apiFetch(stockEmpId ? `${API_URL}/employee-stock/${stockEmpId}` : `${API_URL}/employee-stock`).then(r => r.ok ? r.json() : []).catch(() => []),
        apiFetch(`${API_URL}/dashboard/summary`).then(r => r.ok ? r.json() : null).catch(() => null),
        apiFetch(`${API_URL}/sales`).then(r => r.ok ? r.json() : []).catch(() => []),
        apiFetch(`${API_URL}/expenses`).then(r => r.ok ? r.json() : []).catch(() => []),
        apiFetch(`${API_URL}/inventory/movements`).then(r => r.ok ? r.json() : []).catch(() => []),
        isOwner ? apiFetch(`${API_URL}/users`).then(r => r.ok ? r.json() : []).catch(() => []) : Promise.resolve([]),
        apiFetch(`${API_URL}/routes`).then(r => r.ok ? r.json() : []).catch(() => []),
        apiFetch(`${API_URL}/employees`).then(r => r.ok ? r.json() : []).catch(() => []),
        apiFetch(`${API_URL}/drivers`).then(r => r.ok ? r.json() : []).catch(() => []),
        apiFetch(`${API_URL}/freezer-models`).then(r => r.ok ? r.json() : []).catch(() => []),
        apiFetch(`${API_URL}/freezers`).then(r => r.ok ? r.json() : []).catch(() => [])
      ]);

      setShops(Array.isArray(shopsRes) ? shopsRes : []);
      setVillages(Array.isArray(villagesRes) ? villagesRes : []);
      setProducts(Array.isArray(prodRes) ? prodRes : []);
      setCategories(Array.isArray(catRes) ? catRes : []);
      setEmployeeStock(Array.isArray(empStockRes) ? empStockRes : []);
      setSummary(summaryRes);
      setSales(Array.isArray(salesRes) ? salesRes : []);
      setExpenses(Array.isArray(expRes) ? expRes : []);
      setStockMovements(Array.isArray(movRes) ? movRes : []);
      setUsers(Array.isArray(usersRes) ? usersRes : []);
      setRoutes(Array.isArray(routesRes) ? routesRes : []);
      setEmployees(Array.isArray(empRes) ? empRes : []);
      setDrivers(Array.isArray(driversRes) ? driversRes : []);
      setFreezerModels(Array.isArray(freezerModelsRes) ? freezerModelsRes : []);
      
      // Merge remote freezers with local freezers safely
      setFreezers(prev => {
        const remote = Array.isArray(freezersRes) ? freezersRes : [];
        if (remote.length === 0) {
          return prev;
        }
        const merged = [...remote];
        const seenSerials = new Set(remote.map(r => String(r.serial_no || r.freezer_serial || '').trim().toLowerCase()).filter(Boolean));
        const seenIds = new Set(remote.map(r => String(r.id)));

        (prev || []).forEach(localItem => {
          const lSerial = String(localItem.serial_no || localItem.freezer_serial || '').trim().toLowerCase();
          const lId = String(localItem.id);
          if ((!lSerial || !seenSerials.has(lSerial)) && !seenIds.has(lId)) {
            merged.push(localItem);
            if (lSerial) seenSerials.add(lSerial);
          }
        });
        try {
          localStorage.setItem('avs_freezers_cache', JSON.stringify(merged));
        } catch (e) {}
        return merged;
      });
    } catch (err) {
      console.error("Failed to load initial data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, activeRole]);

  const loginUser = async (login_id, pin) => {
    try {
      const res = await apiFetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login_id, pin })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.user);
        setActiveRole(data.user.role);
        fetchData();
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Network error logging in" };
    }
  };

  const switchRole = (newRole) => {
    setActiveRole(newRole);
    if (newRole === 'OWNER') {
      setCurrentUser({ id: 7, name: "Owner Admin", role: "OWNER" });
    } else if (newRole === 'STORE_KEEPER') {
      setCurrentUser({ id: 6, name: "Store Keeper", role: "STORE_KEEPER" });
    } else {
      setCurrentUser({ id: 4, employee_id: 2, name: "Tharun", role: "DRIVER", vehicle_no: "TN32S2002" });
    }
  };

  const createSale = async (saleData) => {
    try {
      const res = await apiFetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: currentUser?.employee_id || currentUser?.id || 1,
          employee_name: currentUser?.name || "Delivery Executive",
          vehicle_no: currentUser?.vehicle_number || currentUser?.vehicle_no || "Field Vehicle",
          ...saleData
        })
      });
      const data = await res.json();
      if (data.success) {
        const fullSale = { ...data.sale, items: data.sale?.items || data.items || [] };
        setActiveBill(fullSale);

        // Update local shops state immediately
        const targetShopId = saleData.shop_id || fullSale.shop_id;
        const targetShopCode = saleData.shop_code || fullSale.shop_code;
        const newDue = fullSale.shop_current_due !== undefined 
          ? Number(fullSale.shop_current_due)
          : (saleData.clear_previous_due ? 0 : undefined);

        if (newDue !== undefined) {
          setShops(prev => prev.map(s => {
            if ((targetShopId && String(s.id) === String(targetShopId)) || 
                (targetShopCode && String(s.code).toLowerCase() === String(targetShopCode).toLowerCase())) {
              return { ...s, current_due: newDue };
            }
            return s;
          }));
        }

        await fetchData();
        return { success: true, sale: fullSale, items: fullSale.items };
      } else {
        return { success: false, message: data.message || "Failed to submit sale" };
      }
    } catch (err) {
      console.error("Sale submission error:", err);
      return { success: false, message: `Server network error (${err.message || 'Server down'})` };
    }
  };

  const addShop = async (shopData) => {
    try {
      const res = await apiFetch(`${API_URL}/shops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shopData)
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true, shop: data.shop };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error adding shop" };
    }
  };

  const addVillage = async (villageData) => {
    try {
      const res = await apiFetch(`${API_URL}/villages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(villageData)
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true, village: data.village };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error adding village" };
    }
  };

  const updateVillage = async (villageId, villageData) => {
    try {
      const res = await apiFetch(`${API_URL}/villages/${villageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(villageData)
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true, village: data.village };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error updating village" };
    }
  };

  const deleteVillage = async (villageId) => {
    try {
      const res = await apiFetch(`${API_URL}/villages/${villageId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error deleting village" };
    }
  };

  const updateShop = async (shopId, shopData) => {
    try {
      const res = await apiFetch(`${API_URL}/shops/${shopId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shopData)
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true, shop: data.shop };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error updating shop" };
    }
  };

  const deleteShop = async (shopId) => {
    try {
      const res = await apiFetch(`${API_URL}/shops/${shopId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setShops(prev => prev.filter(s => Number(s.id) !== Number(shopId)));
        fetchData();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error deleting shop" };
    }
  };

  const assignFreezer = async (shopId, freezerData) => {
    const shop = shops.find(s => String(s.id) === String(shopId));
    const tempId = `temp-${Date.now()}`;
    const payload = {
      shop_id: shopId,
      model_name: freezerData.model || freezerData.freezer_model || freezerData.model_name || 'Deep Freezer',
      freezer_model: freezerData.model || freezerData.freezer_model || freezerData.model_name || 'Deep Freezer',
      serial_no: freezerData.serial || freezerData.freezer_serial || freezerData.serial_no || `FRZ-${Date.now().toString().slice(-6)}`,
      freezer_serial: freezerData.serial || freezerData.freezer_serial || freezerData.serial_no || `FRZ-${Date.now().toString().slice(-6)}`,
      allocation_date: freezerData.date || freezerData.freezer_date || freezerData.allocation_date || new Date().toISOString().split('T')[0],
      freezer_date: freezerData.date || freezerData.freezer_date || freezerData.allocation_date || new Date().toISOString().split('T')[0],
      status: freezerData.status || freezerData.freezer_status || 'Active',
      freezer_status: freezerData.status || freezerData.freezer_status || 'Active',
      notes: freezerData.notes || null
    };

    const optimisticFreezer = {
      id: tempId,
      shop_id: shopId,
      shop_name: shop?.name || 'Shop',
      shop_code: shop?.code || '',
      owner_name: shop?.owner_name || '',
      phone: shop?.phone || '',
      village_id: shop?.village_id,
      village_name: shop?.village_name,
      ...payload
    };

    // Check if shop had an existing legacy freezer not yet present in freezers array
    const legacyFreezer = (shop?.has_freezer && (shop?.freezer_model || shop?.freezer_serial)) ? {
      id: `legacy-${shop.id}`,
      shop_id: shop.id,
      shop_name: shop?.name || 'Shop',
      shop_code: shop?.code || '',
      owner_name: shop?.owner_name || '',
      phone: shop?.phone || '',
      village_id: shop?.village_id,
      village_name: shop?.village_name,
      model_name: shop.freezer_model || 'Deep Freezer',
      freezer_model: shop.freezer_model || 'Deep Freezer',
      serial_no: shop.freezer_serial || `FRZ-${shop.code || shop.id}`,
      freezer_serial: shop.freezer_serial || `FRZ-${shop.code || shop.id}`,
      allocation_date: shop.freezer_date || 'N/A',
      freezer_date: shop.freezer_date || 'N/A',
      status: shop.freezer_status || 'Active',
      freezer_status: shop.freezer_status || 'Active',
      notes: ''
    } : null;

    // Optimistically update freezers array immediately
    setFreezers(prev => {
      const currentList = Array.isArray(prev) ? [...prev] : [];
      if (legacyFreezer) {
        const legacySerial = String(legacyFreezer.serial_no).trim().toLowerCase();
        const alreadyPresent = currentList.some(f => 
          String(f.shop_id) === String(shopId) && 
          String(f.serial_no || f.freezer_serial || '').trim().toLowerCase() === legacySerial
        );
        if (!alreadyPresent) {
          currentList.push(legacyFreezer);
        }
      }
      return [
        optimisticFreezer,
        ...currentList.filter(f => !(f.id === tempId || (String(f.shop_id) === String(shopId) && String(f.serial_no || '').toLowerCase() === String(payload.serial_no).toLowerCase())))
      ];
    });

    // Optimistically update shops array (mark has_freezer without overwriting other freezers)
    setShops(prev => prev.map(s => String(s.id) === String(shopId) ? {
      ...s,
      has_freezer: true
    } : s));

    try {
      const res = await apiFetch(`${API_URL}/freezers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let data = null;
      try { data = await res.json(); } catch(e) { data = null; }
      if (data && data.success) {
        if (data.freezer) {
          setFreezers(prev => prev.map(f => f.id === tempId ? { ...f, ...data.freezer } : f));
        }
        await fetchData();
        return { success: true, freezer: data.freezer };
      }
      // Fallback
      await apiFetch(`${API_URL}/shops/${shopId}/freezer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      await fetchData();
      return { success: true };
    } catch (err) {
      console.warn("assignFreezer fallback:", err);
      await fetchData();
      return { success: true };
    }
  };

  const updateFreezer = async (freezerId, freezerData) => {
    const payload = {
      model_name: freezerData.model || freezerData.freezer_model || freezerData.model_name,
      freezer_model: freezerData.model || freezerData.freezer_model || freezerData.model_name,
      serial_no: freezerData.serial || freezerData.freezer_serial || freezerData.serial_no,
      freezer_serial: freezerData.serial || freezerData.freezer_serial || freezerData.serial_no,
      allocation_date: freezerData.date || freezerData.freezer_date || freezerData.allocation_date,
      freezer_date: freezerData.date || freezerData.freezer_date || freezerData.allocation_date,
      status: freezerData.status || freezerData.freezer_status,
      freezer_status: freezerData.status || freezerData.freezer_status,
      notes: freezerData.notes
    };

    // Optimistically update freezers array
    setFreezers(prev => prev.map(f => String(f.id) === String(freezerId) ? { ...f, ...payload } : f));

    try {
      const res = await apiFetch(`${API_URL}/freezers/${freezerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let data = null;
      try { data = await res.json(); } catch(e) { data = null; }
      await fetchData();
      if (data && data.success) {
        return { success: true, freezer: data.freezer };
      }
      return { success: true };
    } catch (err) {
      console.warn("updateFreezer fallback:", err);
      await fetchData();
      return { success: true };
    }
  };

  const unassignFreezer = async (freezerId, shopId = null) => {
    // Optimistically remove freezer from freezers array
    setFreezers(prev => prev.filter(f => String(f.id) !== String(freezerId)));

    try {
      let res = await apiFetch(`${API_URL}/freezers/${freezerId}${shopId ? `?shop_id=${shopId}` : ''}`, {
        method: 'DELETE'
      });
      if (!res.ok && shopId) {
        res = await apiFetch(`${API_URL}/shops/${shopId}/freezer`, {
          method: 'DELETE'
        });
      }
      let data = null;
      try { data = await res.json(); } catch(e) { data = null; }
      await fetchData();
      return { success: true };
    } catch (err) {
      console.warn("unassignFreezer fallback:", err);
      await fetchData();
      return { success: true };
    }
  };

  const addFreezerModel = async (modelData) => {
    try {
      const res = await apiFetch(`${API_URL}/freezer-models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modelData)
      });
      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }

      if (data && data.success && data.model) {
        setFreezerModels(prev => [...prev.filter(m => String(m.id) !== String(data.model.id)), data.model]);
        return { success: true, model: data.model };
      }

      // Optimistic fallback
      const fallbackModel = {
        id: Date.now(),
        brand: modelData.brand || 'Other',
        capacity: modelData.capacity || '300L',
        model_name: modelData.model_name || `${modelData.brand} ${modelData.capacity}`,
        freezer_type: modelData.freezer_type || 'Deep Freezer',
        description: modelData.description || '',
        is_active: true
      };
      setFreezerModels(prev => [...prev, fallbackModel]);
      return { success: true, model: fallbackModel };
    } catch (err) {
      console.warn("addFreezerModel network fallback:", err);
      const fallbackModel = {
        id: Date.now(),
        brand: modelData.brand || 'Other',
        capacity: modelData.capacity || '300L',
        model_name: modelData.model_name || `${modelData.brand} ${modelData.capacity}`,
        freezer_type: modelData.freezer_type || 'Deep Freezer',
        description: modelData.description || '',
        is_active: true
      };
      setFreezerModels(prev => [...prev, fallbackModel]);
      return { success: true, model: fallbackModel };
    }
  };

  const deleteFreezerModel = async (id) => {
    try {
      setFreezerModels(prev => prev.filter(m => String(m.id) !== String(id)));
      await apiFetch(`${API_URL}/freezer-models/${id}`, {
        method: 'DELETE'
      });
      return { success: true };
    } catch (err) {
      return { success: true };
    }
  };

  const addDamage = async (damageData) => {
    try {
      const res = await apiFetch(`${API_URL}/damages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(damageData)
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true, message: data.message, damage: data.damage };
      }
      return { success: false, message: data.message || "Failed to record damage" };
    } catch (err) {
      console.error("Error recording damage:", err);
      return { success: false, message: "Network error recording damage" };
    }
  };

  const fetchDamages = async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.employee_id) params.append('employee_id', filters.employee_id);
      if (filters.driver_id) params.append('driver_id', filters.driver_id);
      if (filters.product_id) params.append('product_id', filters.product_id);
      if (filters.status) params.append('status', filters.status);
      if (filters.reason) params.append('reason', filters.reason);
      if (filters.date) params.append('date', filters.date);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.limit) params.append('limit', filters.limit);

      const res = await apiFetch(`${API_URL}/damages?${params.toString()}`);
      if (res.ok) {
        return await res.json();
      }
      return [];
    } catch (err) {
      console.error("Error fetching damages:", err);
      return [];
    }
  };

  const fetchDamageSummary = async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.employee_id) params.append('employee_id', filters.employee_id);
      if (filters.product_id) params.append('product_id', filters.product_id);
      if (filters.date) params.append('date', filters.date);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);

      const res = await apiFetch(`${API_URL}/damages/summary?${params.toString()}`);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (err) {
      console.error("Error fetching damage summary:", err);
      return null;
    }
  };

  const verifyDamageRecord = async (damageId, action, notes) => {
    try {
      const res = await apiFetch(`${API_URL}/damages/${damageId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true, message: data.message, damage: data.damage };
      }
      return { success: false, message: data.message || "Failed to process damage verification" };
    } catch (err) {
      console.error("Error verifying damage:", err);
      return { success: false, message: err.message || "Network error" };
    }
  };

  const fetchDaySummary = async (date) => {
    try {
      const empId = currentUser?.employee_id || currentUser?.id;
      const targetDate = date || new Date().toISOString().split('T')[0];
      const res = await apiFetch(`${API_URL}/emp/day-summary?employee_id=${empId}&date=${targetDate}`);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (err) {
      console.error("Error fetching day summary:", err);
      return null;
    }
  };

  const addExpense = async (expenseData) => {
    try {
      const res = await apiFetch(`${API_URL}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: expenseData?.employee_id || currentUser?.employee_id || currentUser?.id,
          ...expenseData
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true, expense: data.expense };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error saving expense" };
    }
  };

  const fetchExpenses = async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.employee_id && filters.employee_id !== 'ALL') params.append('employee_id', filters.employee_id);
      if (filters.driver_id && filters.driver_id !== 'ALL') params.append('driver_id', filters.driver_id);
      if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
      if (filters.date && filters.date !== 'ALL') params.append('date', filters.date);
      if (filters.start_date && filters.start_date !== 'ALL') params.append('start_date', filters.start_date);
      if (filters.end_date && filters.end_date !== 'ALL') params.append('end_date', filters.end_date);
      const res = await apiFetch(`${API_URL}/expenses?${params.toString()}`);
      if (res.ok) {
        return await res.json();
      }
      return [];
    } catch (err) {
      console.error("Error fetching expenses:", err);
      return [];
    }
  };

  const updateExpense = async (id, expenseData) => {
    try {
      const res = await apiFetch(`${API_URL}/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData)
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true, expense: data.expense };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error updating expense" };
    }
  };

  const deleteExpense = async (id) => {
    try {
      const res = await apiFetch(`${API_URL}/expenses/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error deleting expense" };
    }
  };

  const submitDriverEndDay = async (closingData) => {
    try {
      const empId = currentUser?.employee_id || currentUser?.id;
      const res = await apiFetch(`${API_URL}/emp/day-closing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: empId,
          ...closingData
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true, session: data.session, summary: data.summary };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error submitting daily closing" };
    }
  };

  const saveSettlement = async (settlementData) => {
    try {
      const res = await apiFetch(`${API_URL}/settlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settlementData)
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error saving settlement" };
    }
  };

  const receiveDealerStock = async (dealerData) => {
    try {
      const res = await apiFetch(`${API_URL}/inventory/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dealerData)
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
        return { success: true, data };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error receiving stock" };
    }
  };

  const allocateStock = async (allocData) => {
    try {
      const res = await apiFetch(`${API_URL}/inventory/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allocData)
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error allocating stock to driver" };
    }
  };

  const processDriverReturn = async (returnData) => {
    try {
      const res = await apiFetch(`${API_URL}/inventory/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnData)
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error processing driver return" };
    }
  };

  const submitDriverReturn = async (returnData) => {
    try {
      const res = await apiFetch(`${API_URL}/driver/returns/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnData)
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
        return { success: true, message: data.message, return: data.return };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error submitting driver return declaration" };
    }
  };

  const fetchPendingReturns = async (employeeId = null) => {
    try {
      const url = employeeId ? `${API_URL}/sk/pending-returns?employee_id=${employeeId}` : `${API_URL}/sk/pending-returns`;
      const res = await apiFetch(url);
      return await res.json();
    } catch (err) {
      return [];
    }
  };

  const fetchEligibleDriversForReturn = async () => {
    try {
      const res = await apiFetch(`${API_URL}/sk/driver-returns/eligible`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error("Error fetching eligible return drivers:", err);
      return [];
    }
  };

  const fetchDriverExpectedReturn = async (driverId, sessionId = null) => {
    try {
      const url = sessionId 
        ? `${API_URL}/sk/driver-returns/expected/${driverId}?session_id=${sessionId}`
        : `${API_URL}/sk/driver-returns/expected/${driverId}`;
      const res = await apiFetch(url);
      return await res.json();
    } catch (err) {
      console.error("Error fetching expected return for driver:", err);
      return null;
    }
  };

  const verifyAndAcceptDriverReturnDirect = async (returnData) => {
    try {
      const res = await apiFetch(`${API_URL}/sk/driver-returns/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnData)
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
        return { success: true, message: data.message, summary: data.summary, return: data.return };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error verifying and accepting driver return into inventory" };
    }
  };

  const fetchDriverReturnHistory = async (limit = 20) => {
    try {
      const res = await apiFetch(`${API_URL}/sk/driver-returns/history?limit=${limit}`);
      const data = await res.json();
      return data.success && Array.isArray(data.history) ? data.history : [];
    } catch (err) {
      console.error("Error fetching driver return history:", err);
      return [];
    }
  };

  const fetchMissingStockReport = async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.driver_id && filters.driver_id !== 'ALL') params.append('driver_id', filters.driver_id);
      if (filters.date && filters.date !== 'ALL') params.append('date', filters.date);
      if (filters.start_date && filters.start_date !== 'ALL') params.append('start_date', filters.start_date);
      if (filters.end_date && filters.end_date !== 'ALL') params.append('end_date', filters.end_date);
      if (filters.product_id && filters.product_id !== 'ALL') params.append('product_id', filters.product_id);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch(`${API_URL}/sk/driver-returns/missing${queryString}`);
      const data = await res.json();
      return data && data.success ? data : { records: [], summary: {} };
    } catch (err) {
      console.error("Error fetching missing stock report:", err);
      return { records: [], summary: {} };
    }
  };

  const acceptStorekeeperReturn = async (returnId, returnData = {}) => {
    try {
      const res = await apiFetch(`${API_URL}/sk/returns/${returnId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnData)
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
        return { success: true, message: data.message, processedItems: data.processedItems };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error accepting driver return into inventory" };
    }
  };

  const verifyDriverReturn = async (returnPayload) => {
    if (typeof returnPayload === 'number' || typeof returnPayload === 'string') {
      return await acceptStorekeeperReturn(returnPayload, arguments[1] || {});
    }
    return await verifyAndAcceptDriverReturnDirect(returnPayload);
  };

  const fetchDriverReconciliation = async (driverId = null) => {
    try {
      const url = driverId ? `${API_URL}/driver/session/reconciliation?employee_id=${driverId}` : `${API_URL}/driver/session/reconciliation`;
      const res = await apiFetch(url);
      return await res.json();
    } catch (err) {
      return null;
    }
  };

  const fetchReconciliation = async (driverId = null) => {
    return await fetchDriverReconciliation(driverId);
  };

  const closeDriverSession = async (closeData = {}) => {
    try {
      const res = await apiFetch(`${API_URL}/driver/session/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(closeData)
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
        return { success: true, message: data.message, session: data.session, settlement: data.settlement };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error closing driver session" };
    }
  };

  const fetchDriverSessionHistory = async (driverId = null) => {
    try {
      const url = driverId ? `${API_URL}/driver/sessions/history?employee_id=${driverId}` : `${API_URL}/driver/sessions/history`;
      const res = await apiFetch(url);
      return await res.json();
    } catch (err) {
      return [];
    }
  };

  const fetchStockHistory = async (productId) => {
    try {
      const res = await apiFetch(`${API_URL}/inventory/product/${productId}/history`);
      return await res.json();
    } catch (err) {
      return { product: null, movements: [] };
    }
  };

  const fetchFleetRouteSummary = async () => {
    try {
      const res = await apiFetch(`${API_URL}/routes/fleet-summary`);
      return await res.json();
    } catch (err) {
      return null;
    }
  };

  const fetchDriverDetailSummary = async (driverId) => {
    try {
      const res = await apiFetch(`${API_URL}/routes/driver/${driverId}/summary`);
      return await res.json();
    } catch (err) {
      return null;
    }
  };

  const fetchExecutiveDashboard = async (params = {}) => {
    try {
      const q = new URLSearchParams(params).toString();
      const res = await apiFetch(`${API_URL}/analytics/dashboard${q ? `?${q}` : ''}`);
      return await res.json();
    } catch (err) {
      console.error("Error fetching executive dashboard:", err);
      return null;
    }
  };

  const fetchAdvancedReconciliation = async (params = {}) => {
    try {
      const q = new URLSearchParams(params).toString();
      const res = await apiFetch(`${API_URL}/analytics/reconciliation${q ? `?${q}` : ''}`);
      return await res.json();
    } catch (err) {
      console.error("Error fetching advanced reconciliation:", err);
      return null;
    }
  };

  const fetchDriverPerformance = async (params = {}) => {
    try {
      const q = new URLSearchParams(params).toString();
      const res = await apiFetch(`${API_URL}/analytics/driver-performance${q ? `?${q}` : ''}`);
      return await res.json();
    } catch (err) {
      console.error("Error fetching driver performance:", err);
      return [];
    }
  };

  const fetchRoutePerformance = async (params = {}) => {
    try {
      const q = new URLSearchParams(params).toString();
      const res = await apiFetch(`${API_URL}/analytics/route-performance${q ? `?${q}` : ''}`);
      return await res.json();
    } catch (err) {
      console.error("Error fetching route performance:", err);
      return [];
    }
  };

  const fetchShopPerformance = async (params = {}) => {
    try {
      const q = new URLSearchParams(params).toString();
      const res = await apiFetch(`${API_URL}/analytics/shop-performance${q ? `?${q}` : ''}`);
      return await res.json();
    } catch (err) {
      console.error("Error fetching shop performance:", err);
      return [];
    }
  };

  const fetchProductPerformance = async (params = {}) => {
    try {
      const q = new URLSearchParams(params).toString();
      const res = await apiFetch(`${API_URL}/analytics/product-performance${q ? `?${q}` : ''}`);
      return await res.json();
    } catch (err) {
      console.error("Error fetching product performance:", err);
      return [];
    }
  };

  const fetchAuditLogs = async (params = {}) => {
    try {
      const q = new URLSearchParams(params).toString();
      const res = await apiFetch(`${API_URL}/audit-logs${q ? `?${q}` : ''}`);
      return await res.json();
    } catch (err) {
      console.error("Error fetching audit logs:", err);
      return { logs: [], total: 0 };
    }
  };

  const fetchInventoryAlerts = async () => {
    try {
      const res = await apiFetch(`${API_URL}/inventory/alerts`);
      return await res.json();
    } catch (err) {
      console.error("Error fetching inventory alerts:", err);
      return { summary: { total_products: 0, out_of_stock_count: 0, low_stock_count: 0, healthy_count: 0 }, products: [] };
    }
  };

  const adjustStock = async (adjustmentData) => {
    try {
      const res = await apiFetch(`${API_URL}/inventory/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustmentData)
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
        return { success: true, message: data.message, ...data };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error adjusting inventory stock" };
    }
  };

  const fetchNotifications = async (params = {}) => {
    try {
      const q = new URLSearchParams(params).toString();
      const res = await apiFetch(`${API_URL}/notifications${q ? `?${q}` : ''}`);
      return await res.json();
    } catch (err) {
      console.error("Error fetching notifications:", err);
      return { unread_count: 0, notifications: [] };
    }
  };

  const markNotificationRead = async (id) => {
    try {
      const res = await apiFetch(`${API_URL}/notifications/${id}/read`, {
        method: 'PATCH'
      });
      return await res.json();
    } catch (err) {
      return { success: false };
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      const res = await apiFetch(`${API_URL}/notifications/mark-all-read`, {
        method: 'POST'
      });
      return await res.json();
    } catch (err) {
      return { success: false };
    }
  };

  const exportReportData = async (reportType, filters = {}, format = 'json') => {
    try {
      const params = new URLSearchParams({ ...filters, format }).toString();
      const url = `${API_URL}/export/${reportType}${params ? `?${params}` : ''}`;
      if (format === 'csv') {
        const res = await apiFetch(url);
        const text = await res.text();
        const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', `${reportType}_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return { success: true };
      } else {
        const res = await apiFetch(url);
        return await res.json();
      }
    } catch (err) {
      console.error("Error exporting report data:", err);
      return null;
    }
  };

  const collectShopDue = async (shopId, { amount, mode }) => {
    try {
      const res = await apiFetch(`${API_URL}/shops/${shopId}/collect-due`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, mode })
      });
      const data = await res.json();
      if (data.success) {
        setShops(prev => prev.map(s => {
          if (String(s.id) === String(shopId)) {
            return { ...s, current_due: data.remainingDue };
          }
          return s;
        }));
        fetchData();
        return { success: true, remainingDue: data.remainingDue };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      setShops(prev => prev.map(s => {
        if (String(s.id) === String(shopId)) {
          const nextDue = Math.max(0, (Number(s.current_due) || 0) - Number(amount));
          return { ...s, current_due: nextDue };
        }
        return s;
      }));
      return { success: true };
    }
  };

  const updateProductPrice = async (productId, priceData) => {
    try {
      const res = await apiFetch(`${API_URL}/products/${productId}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(priceData)
      });
      const data = await res.json();
      if (data.success) {
        setProducts(prev => prev.map(p => {
          if (Number(p.id) === Number(productId)) {
            return { ...p, ...data.product };
          }
          return p;
        }));
        fetchData();
        return { success: true, product: data.product };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      setProducts(prev => prev.map(p => {
        if (Number(p.id) === Number(productId)) {
          return { ...p, ...priceData };
        }
        return p;
      }));
      return { success: true };
    }
  };

  const addProduct = async (productData) => {
    try {
      const res = await apiFetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProducts(prev => [...prev, data.product]);
        fetchData();
        return { success: true, product: data.product };
      } else {
        return { success: false, message: data.message || "Failed to add product" };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const updateProduct = async (productId, productData) => {
    try {
      const res = await apiFetch(`${API_URL}/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProducts(prev => prev.map(p => Number(p.id) === Number(productId) ? { ...p, ...data.product } : p));
        fetchData();
        return { success: true, product: data.product };
      } else {
        return { success: false, message: data.message || "Failed to update product" };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const toggleProductStatus = async (productId, is_active) => {
    try {
      const res = await apiFetch(`${API_URL}/products/${productId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProducts(prev => prev.map(p => Number(p.id) === Number(productId) ? { ...p, is_active: is_active ? 1 : 0 } : p));
        fetchData();
        return { success: true, product: data.product };
      } else {
        return { success: false, message: data.message || "Failed to update status" };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const deleteProduct = async (productId) => {
    try {
      let res = await apiFetch(`${API_URL}/products/${productId}`, {
        method: 'DELETE'
      });

      // Fallback to POST /products/:id/delete if DELETE method is not found on proxy/server
      if (res.status === 404) {
        const postRes = await apiFetch(`${API_URL}/products/${productId}/delete`, {
          method: 'POST'
        });
        if (postRes.ok || postRes.status !== 404) {
          res = postRes;
        }
      }

      let data = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (!res.ok) {
          return { success: false, message: res.status === 404 ? 'Backend deployment in progress on Render. Please deploy latest commit on Render and retry.' : (text || `Server error (${res.status})`) };
        }
      }
      if (res.ok && (data.success || data.product)) {
        setProducts(prev => prev.filter(p => Number(p.id) !== Number(productId)));
        fetchData();
        return { success: true, message: data.message || "Product deleted successfully" };
      } else {
        return { success: false, message: data.message || "Failed to delete product" };
      }
    } catch (err) {
      return { success: false, message: err.message || "Network error while deleting product" };
    }
  };

  const addCategory = async (categoryData) => {
    try {
      const res = await apiFetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCategories(prev => [...prev, data.category]);
        fetchData();
        return { success: true, category: data.category };
      } else {
        return { success: false, message: data.message || "Failed to add category" };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const updateCategory = async (categoryId, categoryData) => {
    try {
      const res = await apiFetch(`${API_URL}/categories/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCategories(prev => prev.map(c => Number(c.id) === Number(categoryId) ? { ...c, ...data.category } : c));
        fetchData();
        return { success: true, category: data.category };
      } else {
        return { success: false, message: data.message || "Failed to update category" };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const toggleCategoryStatus = async (categoryId, is_active) => {
    try {
      const res = await apiFetch(`${API_URL}/categories/${categoryId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCategories(prev => prev.map(c => Number(c.id) === Number(categoryId) ? { ...c, is_active: is_active ? 1 : 0 } : c));
        fetchData();
        return { success: true, category: data.category };
      } else {
        return { success: false, message: data.message || "Failed to update status" };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const deleteCategory = async (categoryId) => {
    try {
      const res = await apiFetch(`${API_URL}/categories/${categoryId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCategories(prev => prev.filter(c => Number(c.id) !== Number(categoryId)));
        fetchData();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message || "Failed to delete category" };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const addEmployee = async (employeeData) => {
    try {
      const res = await apiFetch(`${API_URL}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employeeData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(prev => [...prev, data.employee]);
        fetchData();
        return { success: true, employee: data.employee, message: data.message };
      } else {
        return { success: false, message: data.message || "Failed to add employee" };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const updateEmployee = async (employeeId, employeeData) => {
    try {
      const res = await apiFetch(`${API_URL}/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employeeData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(prev => prev.map(u => Number(u.id) === Number(employeeId) ? { ...u, ...data.employee } : u));
        fetchData();
        return { success: true, employee: data.employee, message: data.message };
      } else {
        return { success: false, message: data.message || "Failed to update employee" };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const toggleEmployeeStatus = async (employeeId, status) => {
    try {
      const res = await apiFetch(`${API_URL}/employees/${employeeId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(prev => prev.map(u => Number(u.id) === Number(employeeId) ? { ...u, status } : u));
        fetchData();
        return { success: true, employee: data.employee, message: data.message };
      } else {
        return { success: false, message: data.message || "Failed to update employee status" };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const addRoute = async (routeData) => {
    try {
      const res = await apiFetch(`${API_URL}/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRoutes(prev => [...prev, data.route]);
        fetchData();
        return { success: true, route: data.route, message: data.message };
      } else {
        return { success: false, message: data.message || "Failed to add route" };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const updateRoute = async (routeId, routeData) => {
    try {
      const res = await apiFetch(`${API_URL}/routes/${routeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRoutes(prev => prev.map(r => Number(r.id) === Number(routeId) ? { ...r, ...data.route } : r));
        fetchData();
        return { success: true, route: data.route, message: data.message };
      } else {
        return { success: false, message: data.message || "Failed to update route" };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const deleteRoute = async (routeId) => {
    try {
      const res = await apiFetch(`${API_URL}/routes/${routeId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRoutes(prev => prev.filter(r => Number(r.id) !== Number(routeId)));
        fetchData();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message || "Failed to delete route" };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const reassignDriverRoute = async (routeId, newDriverId) => {
    try {
      const res = await apiFetch(`${API_URL}/routes/${routeId}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_driver_id: newDriverId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchData();
        return { success: true, route: data.route, message: data.message };
      } else {
        return { success: false, message: data.message || "Failed to reassign route" };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  return (
    <AppContext.Provider value={{
      isAuthChecking,
      currentUser,
      activeRole,
      companyInfo,
      shops,
      setShops,
      products,
      setProducts,
      categories,
      setCategories,
      employeeStock,
      sales,
      expenses,
      summary,
      loading,
      activeBill,
      setActiveBill,
      loginUser,
      switchRole,
      createSale,
      addShop,
      updateShop,
      deleteShop,
      villages,
      setVillages,
      addVillage,
      updateVillage,
      deleteVillage,
      routes,
      setRoutes,
      addRoute,
      updateRoute,
      deleteRoute,
      freezers,
      setFreezers,
      assignFreezer,
      updateFreezer,
      unassignFreezer,
      freezerModels,
      setFreezerModels,
      addFreezerModel,
      deleteFreezerModel,
      collectShopDue,
      addCategory,
      updateCategory,
      toggleCategoryStatus,
      deleteCategory,
      addProduct,
      updateProduct,
      toggleProductStatus,
      deleteProduct,
      addDamage,
      fetchDamages,
      fetchDamageSummary,
      verifyDamageRecord,
      addExpense,
      fetchExpenses,
      updateExpense,
      deleteExpense,
      submitDriverEndDay,
      fetchDaySummary,
      saveSettlement,
      receiveDealerStock,
      allocateStock,
      processDriverReturn,
      submitDriverReturn,
      fetchPendingReturns,
      fetchEligibleDriversForReturn,
      fetchDriverExpectedReturn,
      verifyAndAcceptDriverReturnDirect,
      fetchDriverReturnHistory,
      fetchMissingStockReport,
      acceptStorekeeperReturn,
      verifyDriverReturn,
      fetchDriverReconciliation,
      closeDriverSession,
      fetchDriverSessionHistory,
      fetchStockHistory,
      fetchReconciliation,
      fetchFleetRouteSummary,
      fetchDriverDetailSummary,
      fetchExecutiveDashboard,
      fetchAdvancedReconciliation,
      fetchDriverPerformance,
      fetchRoutePerformance,
      fetchShopPerformance,
      fetchProductPerformance,
      fetchAuditLogs,
      fetchInventoryAlerts,
      adjustStock,
      fetchNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      exportReportData,
      addEmployee,
      updateEmployee,
      toggleEmployeeStatus,
      reassignDriverRoute,
      users,
      setUsers,
      employees,
      setEmployees,
      drivers,
      setDrivers,
      stockMovements,
      apiFetch,
      API_URL,
      refreshData: fetchData
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
