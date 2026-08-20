import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState({
    id: 1,
    name: "Tharun",
    phone: "9876543210",
    role: "EMPLOYEE",
    vehicle_no: "TN 32 XX 2222",
    status: "On Route",
    progress: 42
  });

  const [activeRole, setActiveRole] = useState("EMPLOYEE");
  const [companyInfo, setCompanyInfo] = useState({
    name: "AVS DISTRIBUTORS",
    subtitle: "Distribution Management System",
    address: "Main Road, Salem, Tamil Nadu",
    phone: "+91 98765 43210"
  });

  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [employeeStock, setEmployeeStock] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeBill, setActiveBill] = useState(null);

  // Dynamic API URL for Local & Cloud Hosting (Netlify / Render / Vercel)
  const rawApiUrl = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '');
  const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : (rawApiUrl === '' || rawApiUrl === '/api' ? '/api' : `${rawApiUrl}/api`);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [shopsRes, prodRes, empStockRes, summaryRes, salesRes, expRes] = await Promise.all([
        fetch(`${API_URL}/shops`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/products`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/employee-stock/${currentUser?.id || 1}`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/dashboard/summary`).then(r => r.json()).catch(() => null),
        fetch(`${API_URL}/sales`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/expenses`).then(r => r.json()).catch(() => [])
      ]);

      setShops(shopsRes || []);
      setProducts(prodRes || []);
      setEmployeeStock(empStockRes || []);
      setSummary(summaryRes);
      setSales(salesRes || []);
      setExpenses(expRes || []);
    } catch (err) {
      console.error("Failed to load initial data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser, activeRole]);

  const loginUser = async (pin, role) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, role })
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
      const res = await fetch(`${API_URL}/sales`, {
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
      const res = await fetch(`${API_URL}/shops`, {
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
      const res = await fetch(`${API_URL}/shops/${shopId}/freezer`, {
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
      const res = await fetch(`${API_URL}/damages`, {
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
      const res = await fetch(`${API_URL}/expenses`, {
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
      const res = await fetch(`${API_URL}/settlements`, {
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
      const res = await fetch(`${API_URL}/inventory/receive`, {
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
      const res = await fetch(`${API_URL}/inventory/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allocData)
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Error allocating stock" };
    }
  };

  const collectShopDue = async (shopId, { amount, mode }) => {
    try {
      const res = await fetch(`${API_URL}/shops/${shopId}/collect-due`, {
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
      const res = await fetch(`${API_URL}/products/${productId}/price`, {
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

  return (
    <AppContext.Provider value={{
      currentUser,
      activeRole,
      companyInfo,
      shops,
      setShops,
      products,
      setProducts,
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
      updateProductPrice,
      addDamage,
      addExpense,
      saveSettlement,
      receiveDealerStock,
      allocateStock,
      refreshData: fetchData
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
