import mysql from 'mysql2/promise';

const initialDatabase = {
  companyInfo: {
    name: "AVS DISTRIBUTORS",
    subtitle: "Distribution Management System",
    address: "Main Road, Salem, Tamil Nadu",
    phone: "+91 98765 43210"
  },
  roles: [
    { id: 1, name: "OWNER" },
    { id: 2, name: "STORE_KEEPER" },
    { id: 3, name: "EMPLOYEE" }
  ],
  users: [
    { id: 1, name: "Tharun", phone: "9876543210", pin: "1111", role: "EMPLOYEE", vehicle_no: "TN 32 XX 2222", status: "On Route", progress: 42 },
    { id: 2, name: "Kumar", phone: "9876543211", pin: "2222", role: "EMPLOYEE", vehicle_no: "TN 32 AB 1234", status: "On Route", progress: 60 },
    { id: 3, name: "Suresh", phone: "9876543212", pin: "3333", role: "EMPLOYEE", vehicle_no: "TN 32 CD 5678", status: "Returned", progress: 100 },
    { id: 4, name: "Mani", phone: "9876543213", pin: "4444", role: "EMPLOYEE", vehicle_no: "TN 32 BF 9012", status: "On Route", progress: 20 },
    { id: 5, name: "Prakash", phone: "9876543214", pin: "5555", role: "EMPLOYEE", vehicle_no: "TN 32 GH 3456", status: "Not Started", progress: 0 },
    { id: 6, name: "Store Keeper", phone: "9876543200", pin: "1234", role: "STORE_KEEPER", vehicle_no: null, status: "Active", progress: 100 },
    { id: 7, name: "Owner Admin", phone: "9999999999", pin: "9999", role: "OWNER", vehicle_no: null, status: "Active", progress: 100 }
  ],
  routes: [
    { id: 1, name: "Route A", shops_count: 30, completed_count: 12 }
  ],
  shops: [
    { 
      id: 102, 
      code: "#102", 
      name: "Mani Store", 
      owner_name: "Manikandan", 
      phone: "9123456789", 
      distance: "2.3 km", 
      route_id: 1, 
      current_due: 1200, 
      completed: false,
      has_freezer: true,
      freezer_model: "Blue Star 300L Deep Freezer",
      freezer_serial: "FRZ-MS-102",
      freezer_date: "10-01-2026",
      freezer_status: "Active"
    },
    { 
      id: 103, 
      code: "#103", 
      name: "Kumar Store", 
      owner_name: "Kumar", 
      phone: "9123456788", 
      distance: "2.8 km", 
      route_id: 1, 
      current_due: 800, 
      completed: false,
      has_freezer: false,
      freezer_model: null,
      freezer_serial: null,
      freezer_date: null,
      freezer_status: null
    },
    { 
      id: 104, 
      code: "#104", 
      name: "Raja Store", 
      owner_name: "Rajesh", 
      phone: "9123456787", 
      distance: "3.1 km", 
      route_id: 1, 
      current_due: 0, 
      completed: false,
      has_freezer: true,
      freezer_model: "Voltas 400L Double Door Cooler",
      freezer_serial: "FRZ-RS-104",
      freezer_date: "20-02-2026",
      freezer_status: "Active"
    },
    { 
      id: 105, 
      code: "#105", 
      name: "Siva Store", 
      owner_name: "Sivakumar", 
      phone: "9123456786", 
      distance: "3.4 km", 
      route_id: 1, 
      current_due: 450, 
      completed: false,
      has_freezer: false,
      freezer_model: null,
      freezer_serial: null,
      freezer_date: null,
      freezer_status: null
    },
    { 
      id: 106, 
      code: "#106", 
      name: "New Super Store", 
      owner_name: "Periasamy", 
      phone: "9123456785", 
      distance: "4.0 km", 
      route_id: 1, 
      current_due: 0, 
      completed: false,
      has_freezer: true,
      freezer_model: "Haier 320L Visicooler",
      freezer_serial: "FRZ-NSS-106",
      freezer_date: "05-03-2026",
      freezer_status: "Active"
    },
    { 
      id: 107, 
      code: "#107", 
      name: "Green Park Bakery", 
      owner_name: "Karthik", 
      phone: "9123456784", 
      distance: "4.5 km", 
      route_id: 1, 
      current_due: 0, 
      completed: false,
      has_freezer: false,
      freezer_model: null,
      freezer_serial: null,
      freezer_date: null,
      freezer_status: null
    }
  ],
  products: [
    {
      id: 1,
      name: "Amirtha Milk 200ml",
      display_name: "Amirtha Milk - 200ml",
      category: "Dairy",
      base_unit: "Piece",
      selling_unit: "Tray",
      pieces_per_unit: 20,
      purchase_price: 700,
      unit_selling_price: 850,
      piece_selling_price: 45,
      warehouse_stock_units: 88,
      icon: "🥛",
      image: "/images/milk_200ml.svg"
    },
    {
      id: 5,
      name: "Amirtha Milk 500ml",
      display_name: "Amirtha Milk - 500ml",
      category: "Dairy",
      base_unit: "Piece",
      selling_unit: "Tray",
      pieces_per_unit: 12,
      purchase_price: 780,
      unit_selling_price: 960,
      piece_selling_price: 85,
      warehouse_stock_units: 70,
      icon: "🥛",
      image: "/images/milk_500ml.svg"
    },
    {
      id: 6,
      name: "Amirtha Milk 1L",
      display_name: "Amirtha Milk - 1L",
      category: "Dairy",
      base_unit: "Piece",
      selling_unit: "Tray",
      pieces_per_unit: 10,
      purchase_price: 850,
      unit_selling_price: 1050,
      piece_selling_price: 110,
      warehouse_stock_units: 55,
      icon: "🥛",
      image: "/images/milk_1l.svg"
    },
    {
      id: 7,
      name: "Amirtha Curd 200ml",
      display_name: "Amirtha Curd - 200ml",
      category: "Curd",
      base_unit: "Piece",
      selling_unit: "Tray",
      pieces_per_unit: 20,
      purchase_price: 520,
      unit_selling_price: 660,
      piece_selling_price: 35,
      warehouse_stock_units: 48,
      icon: "🥣",
      image: "/images/curd_200ml.jpg"
    },
    {
      id: 8,
      name: "Amirtha Curd 500ml",
      display_name: "Amirtha Curd - 500ml",
      category: "Curd",
      base_unit: "Piece",
      selling_unit: "Tray",
      pieces_per_unit: 12,
      purchase_price: 620,
      unit_selling_price: 780,
      piece_selling_price: 70,
      warehouse_stock_units: 42,
      icon: "🥣",
      image: "/images/curd_500ml.svg"
    },
    {
      id: 9,
      name: "Amirtha Curd 1L",
      display_name: "Amirtha Curd - 1L",
      category: "Curd",
      base_unit: "Piece",
      selling_unit: "Tray",
      pieces_per_unit: 10,
      purchase_price: 760,
      unit_selling_price: 950,
      piece_selling_price: 100,
      warehouse_stock_units: 34,
      icon: "🥣",
      image: "/images/curd_1l.svg"
    },
    {
      id: 10,
      name: "Coccola 200ml",
      display_name: "Coccola - 200ml",
      category: "Soft Drink",
      base_unit: "Piece",
      selling_unit: "Box",
      pieces_per_unit: 24,
      purchase_price: 420,
      unit_selling_price: 540,
      piece_selling_price: 25,
      warehouse_stock_units: 50,
      icon: "🥤",
      image: "/images/coccola_200ml.svg"
    },
    {
      id: 3,
      name: "Coccola 500ml",
      display_name: "Coccola - 500ml",
      category: "Soft Drink",
      base_unit: "Piece",
      selling_unit: "Box",
      pieces_per_unit: 10,
      purchase_price: 320,
      unit_selling_price: 400,
      piece_selling_price: 42,
      warehouse_stock_units: 45,
      icon: "🥤",
      image: "/images/coccola_500ml.svg"
    },
    {
      id: 11,
      name: "Coccola 1L",
      display_name: "Coccola - 1L",
      category: "Soft Drink",
      base_unit: "Piece",
      selling_unit: "Box",
      pieces_per_unit: 8,
      purchase_price: 520,
      unit_selling_price: 680,
      piece_selling_price: 90,
      warehouse_stock_units: 36,
      icon: "🥤",
      image: "/images/coccola_1l.svg"
    },
    {
      id: 12,
      name: "Fresh Juice Packet",
      display_name: "Fresh Juice Packet",
      category: "Juice",
      base_unit: "Piece",
      selling_unit: "Pack",
      pieces_per_unit: 1,
      purchase_price: 7,
      unit_selling_price: 10,
      piece_selling_price: 10,
      warehouse_stock_units: 300,
      icon: "🧃",
      image: "/images/fresh_juice.jpg"
    },
    {
      id: 15,
      name: "Tata Gluco+ Can",
      display_name: "Tata Gluco+ Can",
      category: "Tata",
      base_unit: "Piece",
      selling_unit: "Can",
      pieces_per_unit: 1,
      purchase_price: 7,
      unit_selling_price: 10,
      piece_selling_price: 10,
      warehouse_stock_units: 300,
      icon: "⚡",
      image: "/images/tata_gluco.jpg"
    },
    {
      id: 18,
      name: "Water Bottle 200ml",
      display_name: "Water Bottle - 200ml",
      category: "Water",
      base_unit: "Piece",
      selling_unit: "Tray",
      pieces_per_unit: 24,
      purchase_price: 160,
      unit_selling_price: 240,
      piece_selling_price: 10,
      warehouse_stock_units: 150,
      icon: "💧",
      image: "/images/water_200ml.svg"
    },
    {
      id: 19,
      name: "Water Bottle 500ml",
      display_name: "Water Bottle - 500ml",
      category: "Water",
      base_unit: "Piece",
      selling_unit: "Tray",
      pieces_per_unit: 20,
      purchase_price: 260,
      unit_selling_price: 360,
      piece_selling_price: 20,
      warehouse_stock_units: 120,
      icon: "💧",
      image: "/images/water_500ml.svg"
    },
    {
      id: 2,
      name: "Water Bottle 1L",
      display_name: "Water Bottle - 1L",
      category: "Water",
      base_unit: "Piece",
      selling_unit: "Tray",
      pieces_per_unit: 12,
      purchase_price: 320,
      unit_selling_price: 420,
      piece_selling_price: 35,
      warehouse_stock_units: 90,
      icon: "💧",
      image: "/images/water_1l.svg"
    },
    {
      id: 20,
      name: "Water Bottle 2L",
      display_name: "Water Bottle - 2L",
      category: "Water",
      base_unit: "Piece",
      selling_unit: "Tray",
      pieces_per_unit: 8,
      purchase_price: 380,
      unit_selling_price: 480,
      piece_selling_price: 60,
      warehouse_stock_units: 70,
      icon: "💧",
      image: "/images/water_2l.svg"
    }
  ],
  employeeStock: {
    1: [
      { product_id: 1, qty_units: 8, unit: "Tray" },
      { product_id: 5, qty_units: 6, unit: "Tray" },
      { product_id: 6, qty_units: 5, unit: "Tray" },
      { product_id: 7, qty_units: 5, unit: "Tray" },
      { product_id: 8, qty_units: 4, unit: "Tray" },
      { product_id: 9, qty_units: 3, unit: "Tray" },
      { product_id: 10, qty_units: 6, unit: "Box" },
      { product_id: 3, qty_units: 8, unit: "Box" },
      { product_id: 11, qty_units: 4, unit: "Box" },
      { product_id: 12, qty_units: 5, unit: "Box" },
      { product_id: 15, qty_units: 6, unit: "Box" },
      { product_id: 18, qty_units: 10, unit: "Tray" },
      { product_id: 19, qty_units: 8, unit: "Tray" },
      { product_id: 2, qty_units: 5, unit: "Tray" },
      { product_id: 20, qty_units: 8, unit: "Tray" },
      { product_id: 4, qty_units: 20, unit: "Pack" }
    ],
    2: [
      { product_id: 1, qty_units: 10, unit: "Tray" },
      { product_id: 5, qty_units: 6, unit: "Tray" },
      { product_id: 6, qty_units: 4, unit: "Tray" },
      { product_id: 7, qty_units: 5, unit: "Tray" },
      { product_id: 8, qty_units: 4, unit: "Tray" },
      { product_id: 9, qty_units: 3, unit: "Tray" },
      { product_id: 2, qty_units: 6, unit: "Tray" },
      { product_id: 10, qty_units: 6, unit: "Box" },
      { product_id: 3, qty_units: 5, unit: "Box" },
      { product_id: 11, qty_units: 4, unit: "Box" },
      { product_id: 4, qty_units: 15, unit: "Pack" }
    ],
    3: [
      { product_id: 1, qty_units: 6, unit: "Tray" },
      { product_id: 5, qty_units: 5, unit: "Tray" },
      { product_id: 6, qty_units: 4, unit: "Tray" },
      { product_id: 7, qty_units: 4, unit: "Tray" },
      { product_id: 8, qty_units: 3, unit: "Tray" },
      { product_id: 9, qty_units: 3, unit: "Tray" },
      { product_id: 2, qty_units: 4, unit: "Tray" },
      { product_id: 10, qty_units: 5, unit: "Box" },
      { product_id: 3, qty_units: 4, unit: "Box" },
      { product_id: 11, qty_units: 3, unit: "Box" },
      { product_id: 4, qty_units: 10, unit: "Pack" }
    ],
    4: [
      { product_id: 1, qty_units: 5, unit: "Tray" },
      { product_id: 5, qty_units: 4, unit: "Tray" },
      { product_id: 6, qty_units: 3, unit: "Tray" },
      { product_id: 7, qty_units: 4, unit: "Tray" },
      { product_id: 8, qty_units: 3, unit: "Tray" },
      { product_id: 9, qty_units: 2, unit: "Tray" },
      { product_id: 2, qty_units: 3, unit: "Tray" },
      { product_id: 10, qty_units: 4, unit: "Box" },
      { product_id: 3, qty_units: 3, unit: "Box" },
      { product_id: 11, qty_units: 2, unit: "Box" },
      { product_id: 4, qty_units: 12, unit: "Pack" }
    ]
  },
  sales: [
    {
      bill_no: "81021",
      date: "07-08-2026",
      time: "10:45 AM",
      employee_id: 1,
      employee_name: "Tharun",
      vehicle_no: "TN 32 XX 2222",
      shop_id: 102,
      shop_name: "Mani Store",
      items: [
        { product_id: 1, product_name: "200ml Milk", unit_type: "Tray", qty: 1, rate: 850, amount: 850 },
        { product_id: 3, product_name: "Coccola 500ml", unit_type: "Box", qty: 2, rate: 400, amount: 800 }
      ],
      total_amount: 1650,
      cash_paid: 700,
      gpay_paid: 950,
      credit_paid: 0,
      balance: 0,
      payment_mode: "SPLIT"
    }
  ],
  damages: [
    {
      id: 1,
      date: "07-08-2026",
      employee_id: 1,
      employee_name: "Tharun",
      product_id: 1,
      product_name: "200ml Milk",
      unit_type: "Tray",
      quantity: 2,
      reason: "Leakage / Burst",
      damage_cost: 1400
    }
  ],
  expenses: [
    { id: 1, employee_id: 1, category: "Diesel", amount: 3000, paid_by: "Employee", date: "07-08-2026" },
    { id: 2, employee_id: 1, category: "Lunch", amount: 100, paid_by: "Employee", date: "07-08-2026" },
    { id: 3, employee_id: 1, category: "Vehicle Maintenance", amount: 1000, paid_by: "Employee", date: "07-08-2026" }
  ],
  cashSettlements: [
    {
      id: 1,
      date: "07-08-2026",
      employee_id: 1,
      employee_name: "Tharun (TN 32 XX 2222)",
      expected_cash: 12000,
      actual_cash: 11500,
      difference: -500,
      reason: "Customer Pending",
      remarks: "Mani Store Pending",
      status: "SHORT"
    }
  ],
  recentActivities: [
    { id: 1, title: "Stock received from ABC Distributors", time: "10:30 AM", type: "stock" },
    { id: 2, title: "Stock given to Tharun", time: "09:15 AM", type: "allocation" },
    { id: 3, title: "Freezer assigned to New Super Store (#106)", time: "08:30 AM", type: "freezer" },
    { id: 4, title: "Return received from Suresh", time: "02:45 PM", type: "return" },
    { id: 5, title: "Cash settlement - Tharun", time: "03:18 PM", type: "settlement" }
  ]
};

class MemoryDB {
  constructor() {
    this.data = JSON.parse(JSON.stringify(initialDatabase));
  }

  getCompany() {
    return this.data.companyInfo;
  }

  getUsers() {
    return this.data.users;
  }

  login(pin, role) {
    const user = this.data.users.find(u => u.pin === pin && (role ? u.role === role : true));
    if (user) {
      return { success: true, user };
    }
    return { success: false, message: "Invalid 4-Digit PIN or Role" };
  }

  getShops() {
    return this.data.shops;
  }

  addShop(shopData) {
    const nextId = 100 + this.data.shops.length + 2;
    const newShop = {
      id: nextId,
      code: `#${nextId}`,
      name: shopData.name,
      owner_name: shopData.owner_name || 'Owner',
      phone: shopData.phone || '9876543210',
      distance: shopData.distance || '4.5 km',
      route_id: Number(shopData.route_id || 1),
      current_due: 0,
      completed: false,
      has_freezer: shopData.has_freezer || false,
      freezer_model: shopData.has_freezer ? (shopData.freezer_model || "Blue Star 300L Visicooler") : null,
      freezer_serial: shopData.has_freezer ? (shopData.freezer_serial || `FRZ-${nextId}-001`) : null,
      freezer_date: shopData.has_freezer ? new Date().toISOString().split('T')[0] : null,
      freezer_status: shopData.has_freezer ? "Active" : null
    };

    this.data.shops.push(newShop);

    this.data.recentActivities.unshift({
      id: Date.now(),
      title: `New Shop ${newShop.name} (${newShop.code}) added to Route A`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'shop'
    });

    return { success: true, shop: newShop };
  }

  assignFreezer(shopId, freezerData) {
    const shop = this.data.shops.find(s => String(s.id) === String(shopId));
    if (shop) {
      shop.has_freezer = true;
      shop.freezer_model = freezerData.model || "Blue Star 300L Visicooler";
      shop.freezer_serial = freezerData.serial || `FRZ-${shop.code.replace('#','')}-904`;
      shop.freezer_date = freezerData.date || new Date().toISOString().split('T')[0];
      shop.freezer_status = "Active";

      this.data.recentActivities.unshift({
        id: Date.now(),
        title: `Freezer assigned to ${shop.name} (${shop.code})`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'freezer'
      });

      return { success: true, shop };
    }
    return { success: false, message: `Shop #${shopId} not found` };
  }

  collectShopDue(shopId, { amount, mode = 'CASH' }) {
    const shop = this.data.shops.find(s => String(s.id) === String(shopId));
    if (!shop) {
      throw new Error(`Shop #${shopId} not found`);
    }

    const payVal = Number(amount || 0);
    if (payVal <= 0) {
      throw new Error("Payment amount must be greater than 0");
    }

    const currentDue = Number(shop.current_due || 0);
    const newDue = Math.max(0, currentDue - payVal);
    shop.current_due = newDue;

    this.data.recentActivities.unshift({
      id: Date.now(),
      title: `Received ₹${payVal} due payment from ${shop.name} (${mode}). Remaining due: ₹${newDue}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'payment'
    });

    return { success: true, shop, collected: payVal, remainingDue: newDue };
  }

  getProducts() {
    return this.data.products;
  }

  updateProductPrice(productId, priceData) {
    const prod = this.data.products.find(p => Number(p.id) === Number(productId));
    if (!prod) {
      throw new Error(`Product #${productId} not found`);
    }

    if (priceData.unit_selling_price !== undefined) {
      prod.unit_selling_price = Number(priceData.unit_selling_price);
    }
    if (priceData.piece_selling_price !== undefined) {
      prod.piece_selling_price = Number(priceData.piece_selling_price);
    }
    if (priceData.purchase_price !== undefined) {
      prod.purchase_price = Number(priceData.purchase_price);
    }
    if (priceData.pieces_per_unit !== undefined) {
      prod.pieces_per_unit = Number(priceData.pieces_per_unit);
    }

    this.data.recentActivities.unshift({
      id: Date.now(),
      title: `Rate master updated for ${prod.display_name}: ₹${prod.unit_selling_price}/${prod.selling_unit}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'price'
    });

    return { success: true, product: prod };
  }

  getEmployeeStock(empId) {
    const numericId = Number(empId);
    if (!this.data.employeeStock[numericId]) {
      this.data.employeeStock[numericId] = [
        { product_id: 1, qty_units: 8, unit: "Tray" },
        { product_id: 2, qty_units: 5, unit: "Tray" },
        { product_id: 3, qty_units: 5, unit: "Box" },
        { product_id: 4, qty_units: 15, unit: "Pack" }
      ];
    }
    const items = this.data.employeeStock[numericId];
    return items.map(st => {
      const p = this.data.products.find(prod => prod.id === st.product_id);
      return { ...st, product: p };
    });
  }

  // ACCURATE TRAY vs PIECE STOCK & AMOUNT CALCULATION
  createSale(saleData = {}) {
    const billNo = "INV-" + Math.floor(10000 + Math.random() * 90000);
    
    // Verify item amount calculations & stock deductions
    let calculatedTotal = 0;
    const rawItems = Array.isArray(saleData.items) ? saleData.items : [];
    const validatedItems = rawItems.map(item => {
      const prod = this.data.products.find(p => Number(p.id) === Number(item.product_id));
      let lineAmount = 0;

      if (item.unit_type === 'Piece') {
        lineAmount = Number(item.qty) * (prod ? (prod.piece_selling_price || (prod.unit_selling_price / (prod.pieces_per_unit || 1))) : (item.rate || 0));
      } else {
        lineAmount = Number(item.qty) * (prod ? prod.unit_selling_price : (item.rate || 0));
      }
      calculatedTotal += lineAmount;

      return {
        ...item,
        qty: Number(item.qty),
        product_id: Number(item.product_id),
        amount: lineAmount
      };
    });

    const newSale = {
      bill_no: billNo,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ...saleData,
      items: validatedItems,
      total_amount: calculatedTotal || saleData.total_amount || 0
    };

    this.data.sales.unshift(newSale);

    // Deduct Stock with Exact Tray / Piece Ratio
    const isStoreDirectSale = saleData.is_store_direct_sale || Number(saleData.employee_id) === 6 || saleData.role === 'STORE_KEEPER' || saleData.employee_name === 'Store Keeper';
    const empId = Number(saleData.employee_id);
    const empStock = this.data.employeeStock[empId] || [];

    validatedItems.forEach(item => {
      const prod = this.data.products.find(p => Number(p.id) === Number(item.product_id));
      const stockItem = empStock.find(s => Number(s.product_id) === Number(item.product_id));

      if (isStoreDirectSale && prod) {
        // Direct Warehouse Stock Deduction
        if (item.unit_type === 'Piece') {
          const trayFraction = item.qty / (prod.pieces_per_unit || 1);
          prod.warehouse_stock_units = Math.max(0, parseFloat((prod.warehouse_stock_units - trayFraction).toFixed(2)));
        } else {
          prod.warehouse_stock_units = Math.max(0, prod.warehouse_stock_units - item.qty);
        }
      } else if (stockItem && prod) {
        if (item.unit_type === 'Piece') {
          // Convert piece quantity to fractional Tray units
          const trayFraction = item.qty / (prod.pieces_per_unit || 1);
          stockItem.qty_units = Math.max(0, parseFloat((stockItem.qty_units - trayFraction).toFixed(2)));
        } else {
          // Direct Tray deduction
          stockItem.qty_units = Math.max(0, stockItem.qty_units - item.qty);
        }
      }
    });

    // Update Shop Status & Credit Dues (if associated with a shop)
    if (saleData.shop_id) {
      const shop = this.data.shops.find(s => String(s.id) === String(saleData.shop_id));
      if (shop) {
        shop.completed = true;
        if (saleData.credit_paid > 0) {
          shop.current_due += saleData.credit_paid;
        }
      }
    }

    const activityTitle = isStoreDirectSale 
      ? `Direct Sale Bill ${billNo} by Store Keeper for ${saleData.customer_name || saleData.shop_name || 'Counter Customer'} (₹${calculatedTotal})`
      : `Bill ${billNo} by ${saleData.employee_name || 'Emp'} for ${saleData.shop_name || 'Shop'} (₹${calculatedTotal})`;

    this.data.recentActivities.unshift({
      id: Date.now(),
      title: activityTitle,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'bill'
    });

    return newSale;
  }

  getSales() {
    return this.data.sales;
  }

  getExpenses() {
    return this.data.expenses;
  }

  // ACCURATE DAMAGE CALCULATION BASED ON PURCHASE/COST PRICE
  addDamage(damageData) {
    const prod = this.data.products.find(p => p.id === damageData.product_id);
    const piecesPerUnit = prod ? (prod.pieces_per_unit || 1) : 1;
    const purchasePrice = prod ? prod.purchase_price : 0;

    let cost = 0;
    let trayDeduction = damageData.quantity;

    if (damageData.unit_type === 'Piece') {
      // Piece cost = Purchase price per tray / pieces_per_unit
      cost = damageData.quantity * (purchasePrice / piecesPerUnit);
      trayDeduction = damageData.quantity / piecesPerUnit;
    } else {
      cost = damageData.quantity * purchasePrice;
    }

    const newDamage = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      damage_cost: Math.round(cost),
      ...damageData
    };
    this.data.damages.unshift(newDamage);

    // Deduct damage from vehicle stock
    const empId = Number(damageData.employee_id);
    const empStock = this.data.employeeStock[empId] || [];
    const stockItem = empStock.find(s => s.product_id === damageData.product_id);
    if (stockItem) {
      stockItem.qty_units = Math.max(0, parseFloat((stockItem.qty_units - trayDeduction).toFixed(2)));
    }

    return newDamage;
  }

  addExpense(expenseData) {
    const newExpense = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      ...expenseData
    };
    this.data.expenses.unshift(newExpense);
    return newExpense;
  }

  saveCashSettlement(settlementData) {
    const newSettlement = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      status: settlementData.difference === 0 ? "MATCHED" : (settlementData.difference < 0 ? "SHORT" : "OVER"),
      ...settlementData
    };
    this.data.cashSettlements.unshift(newSettlement);
    return newSettlement;
  }

  receiveDealerStock(dealerData) {
    let logTotal = 0;
    dealerData.items.forEach(item => {
      const prod = this.data.products.find(p => Number(p.id) === Number(item.product_id));
      if (prod && item.quantity > 0) {
        const piecesPerUnit = prod.pieces_per_unit || 1;
        const isPiece = item.unit_type === 'Piece' || item.unit === 'Pcs' || item.unit === 'Piece';
        const trayAdd = isPiece ? (item.quantity / piecesPerUnit) : item.quantity;
        prod.warehouse_stock_units = parseFloat((prod.warehouse_stock_units + trayAdd).toFixed(2));

        const unitRate = prod.unit_selling_price || 850;
        const lineVal = isPiece ? (item.quantity * (unitRate / piecesPerUnit)) : (item.quantity * unitRate);
        logTotal += lineVal;
      }
    });

    if (!this.data.stockReceivedLogs) this.data.stockReceivedLogs = [];
    this.data.stockReceivedLogs.unshift({
      id: Date.now(),
      total_value: Math.round(logTotal),
      date: new Date().toISOString()
    });

    this.data.recentActivities.unshift({
      id: Date.now(),
      title: `Stock received from ${dealerData.dealer_name || 'Dealer'} (₹${Math.round(logTotal)})`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'stock'
    });
    return { success: true };
  }

  allocateStockToEmployee(allocationData) {
    const empId = Number(allocationData.employee_id);
    if (!this.data.employeeStock[empId]) {
      this.data.employeeStock[empId] = [];
    }

    let logTotal = 0;
    allocationData.items.forEach(item => {
      const prod = this.data.products.find(p => Number(p.id) === Number(item.product_id));
      if (prod && item.quantity > 0) {
        const piecesPerUnit = prod.pieces_per_unit || 1;
        const isPiece = item.unit_type === 'Piece' || item.unit === 'Pcs' || item.unit === 'Piece' || !item.unit;
        const trayQty = isPiece ? (item.quantity / piecesPerUnit) : item.quantity;

        prod.warehouse_stock_units = Math.max(0, parseFloat((prod.warehouse_stock_units - trayQty).toFixed(2)));

        let existing = this.data.employeeStock[empId].find(s => Number(s.product_id) === Number(item.product_id));
        if (existing) {
          existing.qty_units = parseFloat((existing.qty_units + trayQty).toFixed(2));
        } else {
          this.data.employeeStock[empId].push({
            product_id: Number(item.product_id),
            qty_units: trayQty,
            unit: prod.selling_unit || 'Tray'
          });
        }

        const unitRate = prod.unit_selling_price || 850;
        const lineVal = isPiece ? (item.quantity * (unitRate / piecesPerUnit)) : (item.quantity * unitRate);
        logTotal += lineVal;
      }
    });

    if (!this.data.stockAllocationLogs) this.data.stockAllocationLogs = [];
    this.data.stockAllocationLogs.unshift({
      id: Date.now(),
      total_value: Math.round(logTotal),
      date: new Date().toISOString()
    });

    this.data.recentActivities.unshift({
      id: Date.now(),
      title: `Stock allocated to ${allocationData.employee_name} (₹${Math.round(logTotal)})`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'allocation'
    });
    return { success: true };
  }

  getDashboardSummary() {
    const baseSales = 124500;
    const baseCash = 72500;
    const baseGPay = 42000;
    const baseCredit = 10000;
    const baseReceived = 72500;
    const baseGiven = 38500;
    const baseReturns = 7200;

    const dynamicSales = (this.data.sales || []).reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
    const dynamicCash = (this.data.sales || []).reduce((acc, s) => acc + (Number(s.cash_paid) || 0), 0);
    const dynamicGpay = (this.data.sales || []).reduce((acc, s) => acc + (Number(s.gpay_paid) || 0), 0);
    const dynamicCredit = (this.data.sales || []).reduce((acc, s) => acc + (Number(s.credit_paid) || 0), 0);
    const dynamicDamages = (this.data.damages || []).reduce((acc, d) => acc + (Number(d.damage_cost) || 0), 0);
    const dynamicReceived = (this.data.stockReceivedLogs || []).reduce((acc, l) => acc + (Number(l.total_value) || 0), 0);
    const dynamicGiven = (this.data.stockAllocationLogs || []).reduce((acc, l) => acc + (Number(l.total_value) || 0), 0);

    const totalSales = baseSales + dynamicSales;
    const cashCollection = baseCash + dynamicCash;
    const gpayCollection = baseGPay + dynamicGpay;
    const creditSales = baseCredit + dynamicCredit;
    const stockReceived = baseReceived + dynamicReceived;
    const stockGiven = baseGiven + dynamicGiven;
    const returns = baseReturns + dynamicDamages;
    const totalExpenses = (this.data.expenses || []).reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const freezerShops = (this.data.shops || []).filter(s => s.has_freezer);

    return {
      todaySales: totalSales,
      stockReceived: stockReceived,
      stockGiven: stockGiven,
      returns: returns,
      employeesActive: `${this.data.users.filter(u => u.role === "EMPLOYEE").length}/${this.data.users.filter(u => u.role === "EMPLOYEE").length}`,
      cashCollection: cashCollection,
      gpayCollection: gpayCollection,
      creditSales: creditSales,
      damageCost: returns,
      totalExpenses: totalExpenses,
      netCollection: totalSales - totalExpenses - returns,
      employeeStatusList: this.data.users.filter(u => u.role === "EMPLOYEE"),
      currentStock: this.data.products,
      freezerCount: freezerShops.length,
      freezerShops: freezerShops,
      recentActivities: this.data.recentActivities
    };
  }
}

export const db = new MemoryDB();
