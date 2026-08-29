import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeRole, setActiveRole] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Helper for authenticated requests
  const apiFetch = async (url, options = {}) => {
    return window.fetch(url, {
      ...options,
      credentials: 'include',
    });
  };
  const [companyInfo, setCompanyInfo] = useState({
    name: "AVS DISTRIBUTORS",
    subtitle: "Distribution Management System",
    address: "Main Road, Salem, Tamil Nadu",
    phone: "+91 98765 43210"
  });

  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [employeeStock, setEmployeeStock] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [users, setUsers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeBill, setActiveBill] = useState(null);

  // Dynamic API URL for Local & Cloud Hosting (Netlify / Render / Vercel)
  const API_URL = import.meta.env.VITE_API_URL || '/api';

  const checkSession = async () => {
    try {
      const res = await apiFetch(`${API_URL}/auth/me`);
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        setActiveRole(data.user.role);
      } else {
        setCurrentUser(null);
        setActiveRole(null);
      }
    } catch (err) {
      console.error("Session check failed", err);
    } finally {
      setIsAuthChecking(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [shopsRes, prodRes, catRes, empStockRes, summaryRes, salesRes, expRes, movRes, usersRes, routesRes] = await Promise.all([
        apiFetch(`${API_URL}/shops`).then(r => r.json()).catch(() => []),
        apiFetch(`${API_URL}/products`).then(r => r.json()).catch(() => []),
        apiFetch(`${API_URL}/categories`).then(r => r.json()).catch(() => []),
        apiFetch(`${API_URL}/employee-stock/${currentUser?.id || 1}`).then(r => r.json()).catch(() => []),
        apiFetch(`${API_URL}/dashboard/summary`).then(r => r.json()).catch(() => null),
        apiFetch(`${API_URL}/sales`).then(r => r.json()).catch(() => []),
        apiFetch(`${API_URL}/expenses`).then(r => r.json()).catch(() => []),
        apiFetch(`${API_URL}/inventory/movements`).then(r => r.json()).catch(() => []),
        apiFetch(`${API_URL}/users`).then(r => r.json()).catch(() => []),
        apiFetch(`${API_URL}/routes`).then(r => r.json()).catch(() => [])
      ]);

      setShops(Array.isArray(shopsRes) ? shopsRes : []);
      setProducts(Array.isArray(prodRes) ? prodRes : []);
      setCategories(Array.isArray(catRes) ? catRes : []);
      setEmployeeStock(Array.isArray(empStockRes) ? empStockRes : []);
      setSummary(summaryRes);
      setSales(Array.isArray(salesRes) ? salesRes : []);
      setExpenses(Array.isArray(expRes) ? expRes : []);
      setStockMovements(Array.isArray(movRes) ? movRes : []);
      setUsers(Array.isArray(usersRes) ? usersRes : []);
      setRoutes(Array.isArray(routesRes) ? routesRes : []);
    } catch (err) {
      console.error("Failed to load initial data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
      setCurrentUser({ id: 1, name: "Tharun", role: "EMPLOYEE", vehicle_no: "TN 32 XX 2222" });
    }
  };

  const createSale = async (saleData) => {
    try {
      const res = await apiFetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: currentUser?.id || 1,
          employee_name: currentUser?.name || "Employee",
          vehicle_no: currentUser?.vehicle_no || "N/A",
          ...saleData
        })
      });
      const data = await res.json();
      if (data.success) {
        setActiveBill(data.sale);
        await fetchData();
        return { success: true, sale: data.sale };
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

  const assignFreezer = async (shopId, freezerData) => {
    try {
      const res = await apiFetch(`${API_URL}/shops/${shopId}/freezer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(freezerData)
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error assigning freezer" };
    }
  };

  const addDamage = async (damageData) => {
    try {
      const res = await apiFetch(`${API_URL}/damages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: currentUser.id,
          employee_name: currentUser.name,
          ...damageData
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error saving damage entry" };
    }
  };

  const addExpense = async (expenseData) => {
    try {
      const res = await apiFetch(`${API_URL}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: currentUser.id,
          ...expenseData
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error saving expense" };
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
        fetchData();
        return { success: true };
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
      const res = await apiFetch(`${API_URL}/inventory/driver-return/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnData)
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true, message: data.message, return_record: data.return_record };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error submitting driver return declaration" };
    }
  };

  const fetchPendingReturns = async () => {
    try {
      const res = await apiFetch(`${API_URL}/inventory/driver-return/pending`);
      return await res.json();
    } catch (err) {
      return [];
    }
  };

  const verifyDriverReturn = async (returnId, verificationData = {}) => {
    try {
      const res = await apiFetch(`${API_URL}/inventory/return/${returnId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verificationData)
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error verifying driver return" };
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

  const fetchReconciliation = async (driverId = null) => {
    try {
      const url = driverId ? `${API_URL}/inventory/reconciliation?driver_id=${driverId}` : `${API_URL}/inventory/reconciliation`;
      const res = await apiFetch(url);
      return await res.json();
    } catch (err) {
      return [];
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
      assignFreezer,
      collectShopDue,
      addCategory,
      updateCategory,
      toggleCategoryStatus,
      deleteCategory,
      addProduct,
      updateProduct,
      toggleProductStatus,
      updateProductPrice,
      addDamage,
      addExpense,
      saveSettlement,
      receiveDealerStock,
      allocateStock,
      processDriverReturn,
      submitDriverReturn,
      fetchPendingReturns,
      verifyDriverReturn,
      fetchStockHistory,
      fetchReconciliation,
      fetchFleetRouteSummary,
      fetchDriverDetailSummary,
      addEmployee,
      updateEmployee,
      toggleEmployeeStatus,
      reassignDriverRoute,
      users,
      setUsers,
      routes,
      setRoutes,
      stockMovements,
      refreshData: fetchData
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
