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
    { id: 8, name: "Ramesh (Driver 6)", phone: "9876543215", pin: "6666", role: "EMPLOYEE", vehicle_no: "TN 32 JK 7890", status: "Not Started", progress: 0 },
    { id: 6, name: "Store Keeper", phone: "9876543200", pin: "1234", role: "STORE_KEEPER", vehicle_no: null, status: "Active", progress: 100 },
    { id: 7, name: "Owner Admin", phone: "9999999999", pin: "9999", role: "OWNER", vehicle_no: null, status: "Active", progress: 100 }
  ],
  routes: [
    { id: 1, code: "R001", name: "Route A - Salem North & Omalur Highway", driver_id: 1, driver_name: "Tharun", vehicle_no: "TN 32 XX 2222", status: "ON_ROUTE", dispatch_time: "05:30 AM" },
    { id: 2, code: "R002", name: "Route B - Ammapet & Attur Bypass Line", driver_id: 2, driver_name: "Kumar", vehicle_no: "TN 32 AB 1234", status: "ON_ROUTE", dispatch_time: "05:45 AM" },
    { id: 3, code: "R003", name: "Route C - Kondalampatti & Namakkal Highway", driver_id: 3, driver_name: "Suresh", vehicle_no: "TN 32 CD 5678", status: "COMPLETED", dispatch_time: "05:15 AM" },
    { id: 4, code: "R004", name: "Route D - Gugai & Shevapet Commercial Line", driver_id: 4, driver_name: "Mani", vehicle_no: "TN 32 BF 9012", status: "ON_ROUTE", dispatch_time: "06:00 AM" },
    { id: 5, code: "R005", name: "Route E - Hasthampatti & Yercaud Foothills Line", driver_id: 5, driver_name: "Prakash", vehicle_no: "TN 32 GH 3456", status: "NOT_STARTED", dispatch_time: "06:30 AM" },
    { id: 6, code: "R006", name: "Route F - Sankari & Edapadi Industrial Line", driver_id: 8, driver_name: "Ramesh (Driver 6)", vehicle_no: "TN 32 JK 7890", status: "NOT_STARTED", dispatch_time: "06:15 AM" }
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
      village_name: "Salem Town (சேலம் டவுன்)",
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
      village_name: "Salem Town (சேலம் டவுன்)",
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
      village_name: "Suramangalam (சூரமங்கலம்)",
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
      village_name: "Omalur Road (ஓமலூர் ரோடு)",
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
      village_name: "Omalur Town (ஓமலூர் டவுன்)",
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
      village_name: "Mecheri (மேச்சேரி)",
      current_due: 0, 
      completed: false,
      has_freezer: false,
      freezer_model: null,
      freezer_serial: null,
      freezer_date: null,
      freezer_status: null
    },
    {
      id: 201,
      code: "#201",
      name: "Ammapet Sweet Bakery",
      owner_name: "Shanmugam",
      phone: "9123456770",
      distance: "1.5 km",
      route_id: 2,
      village_name: "Ammapet (அம்மாபேட்டை)",
      current_due: 1500,
      completed: false,
      has_freezer: true,
      freezer_model: "Voltas 300L Cooler",
      freezer_serial: "FRZ-ASB-201",
      freezer_date: "12-01-2026",
      freezer_status: "Active"
    },
    {
      id: 202,
      code: "#202",
      name: "Attur Fresh Milk Point",
      owner_name: "Venkatesh",
      phone: "9123456771",
      distance: "12.0 km",
      route_id: 2,
      village_name: "Attur Town (ஆத்தூர் டவுன்)",
      current_due: 0,
      completed: false,
      has_freezer: false
    },
    {
      id: 301,
      code: "#301",
      name: "Kondalampatti Dairy Mart",
      owner_name: "Murugan",
      phone: "9123456772",
      distance: "5.0 km",
      route_id: 3,
      village_name: "Kondalampatti (கொண்டலாம்பட்டி)",
      current_due: 0,
      completed: false,
      has_freezer: true,
      freezer_model: "Blue Star 400L Cooler",
      freezer_serial: "FRZ-KDM-301",
      freezer_date: "01-02-2026",
      freezer_status: "Active"
    },
    {
      id: 401,
      code: "#401",
      name: "Gugai Commercial Stores",
      owner_name: "Subramani",
      phone: "9123456773",
      distance: "3.0 km",
      route_id: 4,
      village_name: "Gugai (குகை)",
      current_due: 2200,
      completed: false,
      has_freezer: false
    },
    {
      id: 501,
      code: "#501",
      name: "Yercaud Foothills Refresh",
      owner_name: "Saravanan",
      phone: "9123456774",
      distance: "8.0 km",
      route_id: 5,
      village_name: "Hasthampatti (ஹஸ்தம்பட்டி)",
      current_due: 0,
      completed: false,
      has_freezer: false
    },
    {
      id: 601,
      code: "#601",
      name: "Sankari Industrial Canteen",
      owner_name: "Elangovan",
      phone: "9123456775",
      distance: "18.0 km",
      route_id: 6,
      village_name: "Sankari (சங்ககிரி)",
      current_due: 0,
      completed: false,
      has_freezer: true,
      freezer_model: "Haier Visicooler 400L",
      freezer_serial: "FRZ-SIC-601",
      freezer_date: "15-03-2026",
      freezer_status: "Active"
    }
  ],
  categories: [
    { id: 1, code: 'CAT-MILK', name: 'Dairy', description: 'Fresh Milk & Pasteurised Dairy Pouches', is_active: 1 },
    { id: 2, code: 'CAT-CURD', name: 'Curd', description: 'Fresh Yogurt & Fermented Curd Tubs', is_active: 1 },
    { id: 3, code: 'CAT-BEV', name: 'Beverage', description: 'Carbonated Drinks & Soft Drinks', is_active: 1 },
    { id: 4, code: 'CAT-JUICE', name: 'Juice', description: 'Fruit Juice Packs & Energy Drinks', is_active: 1 },
    { id: 5, code: 'CAT-WATER', name: 'Water', description: 'Purified Mineral Water Bottles', is_active: 1 }
  ],
  products: [
    {
      id: 1,
      name: "Amirtha Milk 200ml",
      display_name: "Amirtha Milk - 200ml",
      category_id: 1,
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
  ],
  driverReturns: [],
  stockMovements: [
    {
      id: 1,
      movement_no: "MOV-SEED-01",
      date: "07-08-2026",
      time: "09:00 AM",
      product_id: 1,
      product_name: "200ml Milk",
      category_id: 1,
      category_name: "Dairy",
      movement_type: "DRIVER_ISSUE",
      qty_pieces: 180,
      qty_trays: 9,
      pieces_per_unit: 20,
      unit_name: "Tray",
      source_location: "WAREHOUSE",
      destination_location: "DRIVER (Tharun)",
      reference_type: "ISSUE_NOTE",
      reference_id: "ISS-SEED-01",
      employee_id: 1,
      employee_name: "Tharun",
      reason: "Initial Seed Route Issue",
      notes: "Historical Baseline Seed",
      created_by: "Store Keeper",
      created_at: "2026-08-07T09:00:00.000Z"
    },
    {
      id: 2,
      movement_no: "MOV-SEED-02",
      date: "07-08-2026",
      time: "09:00 AM",
      product_id: 2,
      product_name: "1L Water Bottle",
      category_id: 5,
      category_name: "Water",
      movement_type: "DRIVER_ISSUE",
      qty_pieces: 100,
      qty_trays: 5,
      pieces_per_unit: 20,
      unit_name: "Tray",
      source_location: "WAREHOUSE",
      destination_location: "DRIVER (Tharun)",
      reference_type: "ISSUE_NOTE",
      reference_id: "ISS-SEED-02",
      employee_id: 1,
      employee_name: "Tharun",
      reason: "Initial Seed Route Issue",
      notes: "Historical Baseline Seed",
      created_by: "Store Keeper",
      created_at: "2026-08-07T09:00:00.000Z"
    },
    {
      id: 3,
      movement_no: "MOV-SEED-03",
      date: "07-08-2026",
      time: "09:00 AM",
      product_id: 3,
      product_name: "Coccola 500ml",
      category_id: 3,
      category_name: "Beverage",
      movement_type: "DRIVER_ISSUE",
      qty_pieces: 140,
      qty_trays: 7,
      pieces_per_unit: 20,
      unit_name: "Box",
      source_location: "WAREHOUSE",
      destination_location: "DRIVER (Tharun)",
      reference_type: "ISSUE_NOTE",
      reference_id: "ISS-SEED-03",
      employee_id: 1,
      employee_name: "Tharun",
      reason: "Initial Seed Route Issue",
      notes: "Historical Baseline Seed",
      created_by: "Store Keeper",
      created_at: "2026-08-07T09:00:00.000Z"
    },
    {
      id: 4,
      movement_no: "MOV-SEED-04",
      date: "07-08-2026",
      time: "09:00 AM",
      product_id: 4,
      product_name: "Gluco Energy",
      category_id: 4,
      category_name: "Juice",
      movement_type: "DRIVER_ISSUE",
      qty_pieces: 300,
      qty_trays: 15,
      pieces_per_unit: 20,
      unit_name: "Pack",
      source_location: "WAREHOUSE",
      destination_location: "DRIVER (Tharun)",
      reference_type: "ISSUE_NOTE",
      reference_id: "ISS-SEED-04",
      employee_id: 1,
      employee_name: "Tharun",
      reason: "Initial Seed Route Issue",
      notes: "Historical Baseline Seed",
      created_by: "Store Keeper",
      created_at: "2026-08-07T09:00:00.000Z"
    }
  ]
};

// MySQL Connection Pool
export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  database: process.env.DB_NAME || 'avs_distribution_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

class MemoryDB {
  constructor() {
    this.data = JSON.parse(JSON.stringify(initialDatabase));
  }

  getCompany() {
    return this.data.companyInfo;
  }

  
  async getUsers() {
    const [rows] = await pool.query('SELECT id, employee_code, name, phone, login_id, role, vehicle_no, status, created_at FROM users WHERE login_id IS NOT NULL');
    return rows;
  }

  async getEmployees() {
    const [rows] = await pool.query('SELECT id, employee_code, name, phone, login_id, role, vehicle_no, status, created_at FROM users');
    return rows;
  }

  async addUser(userData) {
    if (!userData.employee_id) throw new Error("Employee must be selected");
    if (!userData.login_id) throw new Error("Login ID is required");
    if (!userData.pin) throw new Error("PIN is required");
    
    // Check duplicate login
    const [existing] = await pool.query('SELECT id FROM users WHERE login_id = ?', [userData.login_id]);
    if (existing.length > 0) throw new Error("Login ID already exists");
    
    // Check if employee already has a user
    const [emp] = await pool.query('SELECT login_id FROM users WHERE id = ?', [userData.employee_id]);
    if (emp.length === 0) throw new Error("Employee not found");
    if (emp[0].login_id) throw new Error("Employee already has a User Account linked");
    
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash(userData.pin, 10);
    
    await pool.query('UPDATE users SET login_id=?, pin=?, role=?, status=? WHERE id=?', [
      userData.login_id, hash, userData.role || 'EMPLOYEE', userData.status || 'Active', userData.employee_id
    ]);
    
    return { success: true, message: 'User created' };
  }

  async updateUser(id, userData) {
    if (userData.login_id) {
      const [existing] = await pool.query('SELECT id FROM users WHERE login_id = ? AND id != ?', [userData.login_id, id]);
      if (existing.length > 0) throw new Error("Login ID already exists");
    }
    
    const fields = [];
    const values = [];
    const allowed = ['login_id', 'role', 'status'];
    for (let k of allowed) {
      if (userData[k] !== undefined) {
        fields.push(k + '=?');
        values.push(userData[k]);
      }
    }
    
    if (fields.length > 0) {
      values.push(id);
      await pool.query('UPDATE users SET ' + fields.join(', ') + ' WHERE id=?', values);
    }
    return { success: true };
  }

  async resetUserPin(id, newPin) {
    if (!newPin || newPin.length < 4) throw new Error("PIN must be at least 4 digits");
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash(newPin, 10);
    await pool.query('UPDATE users SET pin=? WHERE id=?', [hash, id]);
    return { success: true };
  }

  async

  async
async login(pin, role) {
    // MySQL based login
    try {
      // Allow login via pin or phone (demo purpose may still send pin)
      const [rows] = await pool.query('SELECT * FROM users WHERE role = ?', [role]);
      
      const bcrypt = await import('bcrypt');
      
      for (const user of rows) {
        if (user.status === 'Inactive' || user.status === 'Suspended') continue;
        
        // Since we allow any matching pin for the role (simplistic login mechanism),
        // we check if pin matches this user's hash
        const match = await bcrypt.compare(pin, user.pin);
        if (match) {
          // Remove pin hash from response
          const safeUser = { ...user };
          delete safeUser.pin;
          return { success: true, user: safeUser };
        }
      }
      return { success: false, message: "Invalid PIN or Account is Inactive" };
    } catch (error) {
      console.error("Login DB error:", error);
      return { success: false, message: "Database Error" };
    }
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

  // ------------------------------------------------------------------
  // CATEGORY MASTER ENGINE
  // ------------------------------------------------------------------
  getCategories(activeOnly = false) {
    if (!this.data.categories) {
      this.data.categories = [
        { id: 1, code: 'CAT-MILK', name: 'Dairy', description: 'Fresh Milk & Pasteurised Dairy Pouches', is_active: 1 },
        { id: 2, code: 'CAT-CURD', name: 'Curd', description: 'Fresh Yogurt & Fermented Curd Tubs', is_active: 1 },
        { id: 3, code: 'CAT-BEV', name: 'Beverage', description: 'Carbonated Drinks & Soft Drinks', is_active: 1 },
        { id: 4, code: 'CAT-JUICE', name: 'Juice', description: 'Fruit Juice Packs & Energy Drinks', is_active: 1 },
        { id: 5, code: 'CAT-WATER', name: 'Water', description: 'Purified Mineral Water Bottles', is_active: 1 }
      ];
    }

    let cats = this.data.categories;
    if (activeOnly) {
      cats = cats.filter(c => c.is_active !== 0);
    }

    return cats.map(c => {
      const pCount = this.data.products.filter(p => 
        Number(p.category_id) === Number(c.id) || 
        (p.category && p.category.toLowerCase() === c.name.toLowerCase())
      ).length;
      return {
        ...c,
        product_count: pCount
      };
    });
  }

  addCategory(categoryData) {
    if (!categoryData.name || !categoryData.name.trim()) {
      throw new Error("Category name is required");
    }

    const normName = categoryData.name.trim();

    // Case-insensitive uniqueness check
    const existing = this.data.categories.find(c => c.name.toLowerCase() === normName.toLowerCase());
    if (existing) {
      throw new Error(`Category '${normName}' already exists.`);
    }

    const nextId = Math.max(...this.data.categories.map(c => c.id), 0) + 1;
    const catCode = (categoryData.code || `CAT-${normName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}-${nextId}`).trim();

    const newCat = {
      id: nextId,
      code: catCode,
      name: normName,
      description: categoryData.description ? categoryData.description.trim() : '',
      is_active: categoryData.is_active !== undefined ? (categoryData.is_active ? 1 : 0) : 1
    };

    this.data.categories.push(newCat);

    this.data.recentActivities.unshift({
      id: Date.now(),
      title: `New category created: ${newCat.name} (${newCat.code})`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'category'
    });

    return { success: true, category: newCat };
  }

  updateCategory(categoryId, categoryData) {
    const cat = this.data.categories.find(c => Number(c.id) === Number(categoryId));
    if (!cat) {
      throw new Error(`Category #${categoryId} not found`);
    }

    if (categoryData.name && categoryData.name.trim()) {
      const normName = categoryData.name.trim();
      const duplicate = this.data.categories.find(c => Number(c.id) !== Number(categoryId) && c.name.toLowerCase() === normName.toLowerCase());
      if (duplicate) {
        throw new Error(`Category name '${normName}' already exists.`);
      }

      // Update linked products category string
      const oldName = cat.name;
      cat.name = normName;
      this.data.products.forEach(p => {
        if (Number(p.category_id) === Number(categoryId) || (p.category && p.category.toLowerCase() === oldName.toLowerCase())) {
          p.category = normName;
          p.category_id = cat.id;
        }
      });
    }

    if (categoryData.description !== undefined) {
      cat.description = categoryData.description.trim();
    }

    if (categoryData.code) {
      cat.code = categoryData.code.trim().toUpperCase();
    }

    if (categoryData.is_active !== undefined) {
      cat.is_active = categoryData.is_active ? 1 : 0;
    }

    return { success: true, category: cat };
  }

  toggleCategoryStatus(categoryId, is_active) {
    const cat = this.data.categories.find(c => Number(c.id) === Number(categoryId));
    if (!cat) {
      throw new Error(`Category #${categoryId} not found`);
    }

    cat.is_active = is_active ? 1 : 0;

    this.data.recentActivities.unshift({
      id: Date.now(),
      title: `Category ${cat.name} ${is_active ? 'ACTIVATED' : 'DEACTIVATED'}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'category'
    });

    return { success: true, category: cat };
  }

  deleteCategory(categoryId) {
    const catIndex = this.data.categories.findIndex(c => Number(c.id) === Number(categoryId));
    if (catIndex === -1) {
      throw new Error(`Category #${categoryId} not found`);
    }

    const cat = this.data.categories[catIndex];

    // Check existing product references
    const linkedProducts = this.data.products.filter(p => 
      Number(p.category_id) === Number(categoryId) || 
      (p.category && p.category.toLowerCase() === cat.name.toLowerCase())
    );

    if (linkedProducts.length > 0) {
      throw new Error(`Category '${cat.name}' is currently used by ${linkedProducts.length} product(s) and cannot be deleted. Deactivate it instead.`);
    }

    this.data.categories.splice(catIndex, 1);
    return { success: true, message: `Category '${cat.name}' deleted successfully.` };
  }

  async getProducts() {
    const [rows] = await pool.query('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id');
    return rows.map(r => ({ ...r, category: r.category_name || r.category }));
  }

  async addProduct(productData) {
    if (!productData.name || !productData.name.trim()) throw new Error("Product name is required");
    const [result] = await pool.query(`INSERT INTO products (category_id, sku, barcode, name, display_name, category, base_unit, selling_unit, pieces_per_unit, purchase_price, unit_selling_price, piece_selling_price, warehouse_stock_units, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [productData.category_id || 1, productData.sku || null, productData.barcode || null, productData.name, productData.display_name || productData.name, productData.category || 'Dairy', productData.base_unit || 'Piece', productData.selling_unit || 'Tray', productData.pieces_per_unit || 20, productData.purchase_price || 0, productData.unit_selling_price || 0, productData.piece_selling_price || 0, productData.warehouse_stock_units || 0, productData.min_stock_level || 10]);
    return { id: result.insertId, ...productData };
  }

  async updateProduct(productId, productData) {
    const allowedFields = ['sku', 'barcode', 'name', 'display_name', 'category', 'category_id', 'selling_unit', 'base_unit', 'pieces_per_unit', 'purchase_price', 'unit_selling_price', 'piece_selling_price', 'warehouse_stock_units', 'min_stock_level', 'is_active'];
    let fields = [];
    let values = [];
    for (let key of allowedFields) {
      if (productData[key] !== undefined) {
        fields.push(key + '=?');
        values.push(productData[key]);
      }
    }
    if (fields.length === 0) return { id: productId };
    values.push(productId);
    await pool.query('UPDATE products SET ' + fields.join(', ') + ' WHERE id=?', values);
    return { id: productId, ...productData };
  }

  async toggleProductStatus(productId, is_active) {
    await pool.query('UPDATE products SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, productId]);
    return { id: productId, is_active: is_active };
  }

  async updateProductPrice(productId, priceData) {
    return await this.updateProduct(productId, priceData);
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

  
  async getSales(filters = {}) {
    let query = 'SELECT s.*, (SELECT JSON_ARRAYAGG(JSON_OBJECT("product_id", si.product_id, "product_name", si.product_name, "qty", si.qty, "rate", si.rate, "amount", si.amount)) FROM sale_items si WHERE si.sale_id = s.id) as items FROM sales s WHERE 1=1';
    let values = [];
    if (filters.employee_id && filters.employee_id !== 'ALL') {
      query += ' AND s.employee_id = ?';
      values.push(filters.employee_id);
    }
    if (filters.date) {
      query += ' AND s.date = ?';
      values.push(filters.date);
    }
    const [rows] = await pool.query(query, values);
    return rows.map(r => ({ ...r, items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items || [] }));
  }

  async createSale(saleData) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const billNo = saleData.bill_no || 'BILL-' + Date.now();
      const [result] = await connection.query('INSERT INTO sales (bill_no, employee_id, employee_name, shop_id, shop_name, date, time, total_amount, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [billNo, saleData.employee_id, saleData.employee_name, saleData.shop_id, saleData.shop_name, saleData.date, saleData.time || new Date().toLocaleTimeString(), saleData.total_amount, saleData.payment_mode || 'CASH']);
      
      const saleId = result.insertId;
      for (let item of saleData.items) {
        await connection.query('INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_type, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?)', [saleId, item.product_id, item.product_name, item.qty, item.unit_type || 'Tray', item.rate, item.amount]);
        
        // Deduct from employee stock
        await connection.query('UPDATE employee_stock SET qty_units = qty_units - ? WHERE employee_id = ? AND product_id = ?', [item.qty, saleData.employee_id, item.product_id]);
      }
      
      if (saleData.shop_id) {
         await connection.query('UPDATE shops SET current_due = current_due + ?, completed = 1 WHERE id = ?', [saleData.total_amount, saleData.shop_id]);
      }
      
      await connection.commit();
      return { success: true, sale_id: saleId, bill_no: billNo };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
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

  // ------------------------------------------------------------------
  // STOCK MOVEMENTS LEDGER ENGINE
  // ------------------------------------------------------------------
  addStockMovement(movementData) {
    if (!this.data.stockMovements) this.data.stockMovements = [];

    const movementId = Date.now() + Math.floor(Math.random() * 1000);
    const movementNo = "MOV-" + Math.floor(10000 + Math.random() * 90000);

    const newMovement = {
      id: movementId,
      movement_no: movementNo,
      date: movementData.date || new Date().toISOString().split('T')[0],
      time: movementData.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      product_id: Number(movementData.product_id),
      product_name: movementData.product_name || 'Product',
      category_id: Number(movementData.category_id || 1),
      category_name: movementData.category_name || 'Dairy',
      movement_type: movementData.movement_type || 'ADJUSTMENT_IN',
      qty_pieces: Number(movementData.qty_pieces || 0),
      qty_trays: Number(movementData.qty_trays || 0),
      pieces_per_unit: Number(movementData.pieces_per_unit || 20),
      unit_name: movementData.unit_name || 'Tray',
      source_location: movementData.source_location || 'WAREHOUSE',
      destination_location: movementData.destination_location || 'WAREHOUSE',
      reference_type: movementData.reference_type || 'SYSTEM',
      reference_id: movementData.reference_id || movementNo,
      employee_id: movementData.employee_id ? Number(movementData.employee_id) : null,
      employee_name: movementData.employee_name || null,
      shop_id: movementData.shop_id ? Number(movementData.shop_id) : null,
      shop_name: movementData.shop_name || null,
      reason: movementData.reason || '',
      notes: movementData.notes || '',
      created_by: movementData.created_by || 'System',
      created_at: new Date().toISOString()
    };

    this.data.stockMovements.unshift(newMovement);
    return newMovement;
  }

  getStockMovements(filters = {}) {
    let movements = this.data.stockMovements || [];

    if (!filters || Object.keys(filters).length === 0) {
      return movements;
    }

    const { movement_type, product_id, driver_id, date } = filters;

    return movements.filter(m => {
      if (movement_type && movement_type !== 'ALL' && m.movement_type !== movement_type) return false;
      if (product_id && Number(m.product_id) !== Number(product_id)) return false;
      if (driver_id && Number(m.employee_id) !== Number(driver_id)) return false;
      if (date && m.date !== date) return false;
      return true;
    });
  }

  getProductStockHistory(productId) {
    const movements = (this.data.stockMovements || []).filter(m => Number(m.product_id) === Number(productId));
    const prod = this.data.products.find(p => Number(p.id) === Number(productId));
    return {
      product: prod,
      movements: movements
    };
  }

  receiveDealerStock(dealerData) {
    if (!dealerData.items || !Array.isArray(dealerData.items)) {
      throw new Error("Dealer items list is required");
    }

    let logTotal = 0;
    dealerData.items.forEach(item => {
      const prod = this.data.products.find(p => Number(p.id) === Number(item.product_id));
      if (prod && item.quantity > 0) {
        const piecesPerUnit = prod.pieces_per_unit || 20;
        const isPiece = item.unit_type === 'Piece' || item.unit === 'Pcs' || item.unit === 'Piece';
        const trayAdd = isPiece ? (item.quantity / piecesPerUnit) : item.quantity;
        const pcsAdd = isPiece ? item.quantity : (item.quantity * piecesPerUnit);

        prod.warehouse_stock_units = parseFloat((prod.warehouse_stock_units + trayAdd).toFixed(2));

        const unitRate = prod.unit_selling_price || 850;
        const lineVal = isPiece ? (item.quantity * (unitRate / piecesPerUnit)) : (item.quantity * unitRate);
        logTotal += lineVal;

        // Record INWARD Stock Movement Ledger Entry
        this.addStockMovement({
          product_id: prod.id,
          product_name: prod.display_name || prod.name,
          category_id: prod.category_id || 1,
          category_name: prod.category || 'Dairy',
          movement_type: 'INWARD',
          qty_pieces: pcsAdd,
          qty_trays: trayAdd,
          pieces_per_unit: piecesPerUnit,
          unit_name: prod.selling_unit || 'Tray',
          source_location: dealerData.dealer_name || 'COMPANY SUPPLIER',
          destination_location: 'WAREHOUSE',
          reference_type: 'INWARD_BILL',
          reference_id: dealerData.bill_no || `REC-${Date.now()}`,
          reason: dealerData.reason || 'Company Stock Receipt Inward',
          notes: dealerData.notes || '',
          created_by: dealerData.created_by || 'Owner Admin'
        });
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
    return { success: true, message: "Dealer stock received and ledger updated." };
  }

  allocateStockToEmployee(allocationData) {
    const empId = Number(allocationData.employee_id);
    const emp = this.data.users.find(u => Number(u.id) === empId);
    const empName = allocationData.employee_name || (emp ? emp.name : 'Driver');

    if (!allocationData.items || !Array.isArray(allocationData.items)) {
      throw new Error("Allocation items list is required");
    }

    // 1. VALIDATE WAREHOUSE STOCK SUFFICIENCY FIRST (PREVENT NEGATIVE STOCK)
    for (const item of allocationData.items) {
      if (item.quantity > 0) {
        const prod = this.data.products.find(p => Number(p.id) === Number(item.product_id));
        if (!prod) throw new Error(`Product #${item.product_id} not found`);

        const piecesPerUnit = prod.pieces_per_unit || 20;
        const isPiece = item.unit_type === 'Piece' || item.unit === 'Pcs' || item.unit === 'Piece';
        const requestedTrays = isPiece ? (item.quantity / piecesPerUnit) : item.quantity;

        if (prod.warehouse_stock_units < requestedTrays) {
          throw new Error(`Insufficient warehouse stock for '${prod.display_name}'. Requested ${requestedTrays} ${prod.selling_unit}s, Available: ${prod.warehouse_stock_units} ${prod.selling_unit}s.`);
        }
      }
    }

    if (!this.data.employeeStock[empId]) {
      this.data.employeeStock[empId] = [];
    }

    let logTotal = 0;
    allocationData.items.forEach(item => {
      const prod = this.data.products.find(p => Number(p.id) === Number(item.product_id));
      if (prod && item.quantity > 0) {
        const piecesPerUnit = prod.pieces_per_unit || 20;
        const isPiece = item.unit_type === 'Piece' || item.unit === 'Pcs' || item.unit === 'Piece';
        const trayQty = isPiece ? (item.quantity / piecesPerUnit) : item.quantity;
        const pcsQty = isPiece ? item.quantity : (item.quantity * piecesPerUnit);

        // Deduct from Warehouse
        prod.warehouse_stock_units = Math.max(0, parseFloat((prod.warehouse_stock_units - trayQty).toFixed(2)));

        // Add to Driver Stock
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

        // Record DRIVER_ISSUE Stock Movement Ledger Entry
        this.addStockMovement({
          product_id: prod.id,
          product_name: prod.display_name || prod.name,
          category_id: prod.category_id || 1,
          category_name: prod.category || 'Dairy',
          movement_type: 'DRIVER_ISSUE',
          qty_pieces: pcsQty,
          qty_trays: trayQty,
          pieces_per_unit: piecesPerUnit,
          unit_name: prod.selling_unit || 'Tray',
          source_location: 'WAREHOUSE',
          destination_location: `DRIVER (${empName})`,
          reference_type: 'ISSUE_NOTE',
          reference_id: `ISS-${Date.now()}`,
          employee_id: empId,
          employee_name: empName,
          reason: allocationData.reason || 'Route Stock Allocation',
          notes: allocationData.notes || '',
          created_by: allocationData.created_by || 'Store Keeper'
        });
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
      title: `Stock allocated to ${empName} (₹${Math.round(logTotal)})`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'allocation'
    });
    return { success: true, message: "Stock allocated to driver successfully." };
  }

  // ------------------------------------------------------------------
  // TWO-STEP DRIVER RETURN & STOREKEEPER VERIFICATION
  // ------------------------------------------------------------------
  submitDriverReturn(returnData) {
    const empId = Number(returnData.employee_id);
    const emp = this.data.users.find(u => Number(u.id) === empId);
    const empName = returnData.employee_name || (emp ? emp.name : 'Driver');

    if (!returnData.items || !Array.isArray(returnData.items) || returnData.items.length === 0) {
      throw new Error("Return items list is required.");
    }

    if (!this.data.driverReturns) this.data.driverReturns = [];

    const returnId = Date.now();
    const returnNo = "RET-" + Math.floor(10000 + Math.random() * 90000);

    const processedItems = returnData.items.map(item => {
      const prod = this.data.products.find(p => Number(p.id) === Number(item.product_id));
      if (!prod) throw new Error(`Product #${item.product_id} not found`);

      const pcsPerUnit = prod.pieces_per_unit || 20;
      const isPiece = item.unit_type === 'Piece' || item.unit === 'Pcs';
      const goodPcs = Math.round(isPiece ? Number(item.quantity || 0) : Number(item.quantity || 0) * pcsPerUnit);
      const damagedPcs = Math.round(isPiece ? Number(item.damaged_quantity || 0) : Number(item.damaged_quantity || 0) * pcsPerUnit);

      return {
        product_id: prod.id,
        product_name: prod.display_name || prod.name,
        category_id: prod.category_id || 1,
        category_name: prod.category || 'Dairy',
        pieces_per_unit: pcsPerUnit,
        unit_name: prod.selling_unit || 'Tray',
        driver_good_pcs: goodPcs,
        driver_damaged_pcs: damagedPcs,
        verified_good_pcs: goodPcs,
        verified_damaged_pcs: damagedPcs
      };
    });

    const newReturn = {
      id: returnId,
      return_no: returnNo,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      driver_id: empId,
      driver_name: empName,
      status: 'PENDING_STOREKEEPER_VERIFICATION',
      items: processedItems,
      notes: returnData.notes || '',
      created_at: new Date().toISOString()
    };

    this.data.driverReturns.unshift(newReturn);

    this.data.recentActivities.unshift({
      id: Date.now(),
      title: `Return declaration submitted by ${empName} (Pending Storekeeper Verification)`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'return'
    });

    return { success: true, message: "Driver return declaration submitted. Pending Storekeeper verification.", return_record: newReturn };
  }

  getPendingDriverReturns() {
    return (this.data.driverReturns || []).filter(r => r.status === 'PENDING_STOREKEEPER_VERIFICATION');
  }

  verifyDriverReturn(returnId, verificationData = {}) {
    const returnRecord = (this.data.driverReturns || []).find(r => Number(r.id) === Number(returnId));
    if (!returnRecord) {
      throw new Error(`Return declaration #${returnId} not found.`);
    }

    if (returnRecord.status === 'VERIFIED') {
      throw new Error("This driver return has already been verified and approved.");
    }

    const empId = returnRecord.driver_id;
    const empName = returnRecord.driver_name;
    const empStock = this.data.employeeStock[empId] || [];

    const verifiedItems = verificationData.items || returnRecord.items;

    verifiedItems.forEach(item => {
      const prod = this.data.products.find(p => Number(p.id) === Number(item.product_id));
      if (prod) {
        const pcsPerUnit = prod.pieces_per_unit || 20;
        const verifiedGoodPcs = Number(item.verified_good_pcs || 0);
        const verifiedDamagedPcs = Number(item.verified_damaged_pcs || 0);

        const goodTrays = verifiedGoodPcs / pcsPerUnit;
        const totalReturnPcs = verifiedGoodPcs + verifiedDamagedPcs;
        const totalReturnTrays = totalReturnPcs / pcsPerUnit;

        // 1. Deduct from Driver Stock
        const driverStockItem = empStock.find(s => Number(s.product_id) === Number(item.product_id));
        if (driverStockItem) {
          driverStockItem.qty_units = Math.max(0, driverStockItem.qty_units - totalReturnTrays);
        }

        // 2. Add verified GOOD stock to Warehouse Stock
        if (verifiedGoodPcs > 0) {
          prod.warehouse_stock_units = prod.warehouse_stock_units + goodTrays;

          this.addStockMovement({
            product_id: prod.id,
            product_name: prod.display_name || prod.name,
            category_id: prod.category_id || 1,
            category_name: prod.category || 'Dairy',
            movement_type: 'DRIVER_RETURN_GOOD',
            qty_pieces: verifiedGoodPcs,
            qty_trays: goodTrays,
            pieces_per_unit: pcsPerUnit,
            unit_name: prod.selling_unit || 'Tray',
            source_location: `DRIVER (${empName})`,
            destination_location: 'WAREHOUSE',
            reference_type: 'RETURN_VERIFIED',
            reference_id: returnRecord.return_no,
            employee_id: empId,
            employee_name: empName,
            reason: 'Verified Good Route Return',
            created_by: verificationData.verified_by || 'Store Keeper'
          });
        }

        // 3. Add verified DAMAGED stock to Damage Ledger (Does NOT enter warehouse stock!)
        if (verifiedDamagedPcs > 0) {
          this.addDamage({
            damage_source: 'DRIVER',
            employee_id: empId,
            employee_name: empName,
            product_id: prod.id,
            quantity: verifiedDamagedPcs,
            unit_type: 'Piece',
            reason: item.damage_reason || 'Route Delivery Damage',
            created_by: verificationData.verified_by || 'Store Keeper'
          });
        }
      }
    });

    returnRecord.status = 'VERIFIED';
    returnRecord.verified_at = new Date().toISOString();
    returnRecord.verified_by = verificationData.verified_by || 'Store Keeper';

    this.data.recentActivities.unshift({
      id: Date.now(),
      title: `Driver return #${returnRecord.return_no} from ${empName} VERIFIED & APPROVED by Storekeeper`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'return'
    });

    return { success: true, message: "Driver return physically verified and approved. Warehouse stock updated.", return_record: returnRecord };
  }

  processDriverReturn(returnData) {
    // Submit & immediately verify for simple legacy flow
    const submitRes = this.submitDriverReturn(returnData);
    if (submitRes.success) {
      return this.verifyDriverReturn(submitRes.return_record.id, { verified_by: returnData.created_by || 'Store Keeper' });
    }
    return submitRes;
  }

  addDamage(damageData) {
    const prod = this.data.products.find(p => Number(p.id) === Number(damageData.product_id));
    const piecesPerUnit = prod ? (prod.pieces_per_unit || 20) : 20;
    const purchasePrice = prod ? prod.purchase_price : 0;

    let cost = 0;
    let trayDeduction = Number(damageData.quantity || 0);
    let pcsDeduction = trayDeduction * piecesPerUnit;

    if (damageData.unit_type === 'Piece' || damageData.unit === 'Pcs') {
      cost = damageData.quantity * (purchasePrice / piecesPerUnit);
      trayDeduction = damageData.quantity / piecesPerUnit;
      pcsDeduction = damageData.quantity;
    } else {
      cost = damageData.quantity * purchasePrice;
    }

    const isWarehouseDamage = damageData.damage_source === 'WAREHOUSE' || !damageData.employee_id;
    const empId = damageData.employee_id ? Number(damageData.employee_id) : null;
    const emp = empId ? this.data.users.find(u => Number(u.id) === empId) : null;
    const empName = emp ? emp.name : (damageData.employee_name || null);

    const newDamage = {
      id: Date.now(),
      date: damageData.date || new Date().toISOString().split('T')[0],
      damage_cost: Math.round(cost),
      damage_source: isWarehouseDamage ? 'WAREHOUSE' : 'DRIVER',
      ...damageData
    };
    this.data.damages.unshift(newDamage);

    if (isWarehouseDamage && prod) {
      // Deduct from Warehouse Stock
      prod.warehouse_stock_units = Math.max(0, prod.warehouse_stock_units - trayDeduction);
    } else if (empId) {
      // Deduct from Driver Stock
      const empStock = this.data.employeeStock[empId] || [];
      const stockItem = empStock.find(s => Number(s.product_id) === Number(damageData.product_id));
      if (stockItem) {
        stockItem.qty_units = Math.max(0, stockItem.qty_units - trayDeduction);
      }
    }

    // Record Damage Stock Movement Ledger Entry
    if (prod) {
      this.addStockMovement({
        product_id: prod.id,
        product_name: prod.display_name || prod.name,
        category_id: prod.category_id || 1,
        category_name: prod.category || 'Dairy',
        movement_type: isWarehouseDamage ? 'WAREHOUSE_DAMAGE' : 'DRIVER_DAMAGE',
        qty_pieces: pcsDeduction,
        qty_trays: trayDeduction,
        pieces_per_unit: piecesPerUnit,
        unit_name: prod.selling_unit || 'Tray',
        source_location: isWarehouseDamage ? 'WAREHOUSE' : `DRIVER (${empName})`,
        destination_location: 'DAMAGED_DISPOSAL',
        reference_type: 'DAMAGE_REPORT',
        reference_id: `DAM-${Date.now()}`,
        employee_id: empId,
        employee_name: empName,
        reason: damageData.reason || 'Damaged Product',
        notes: damageData.notes || '',
        created_by: damageData.created_by || 'Store Keeper'
      });
    }

    return newDamage;
  }

  // PRODUCT-LEVEL RECONCILIATION REPORT FOR ALL DRIVERS
  getProductReconciliationReport(filterDriverId = null) {
    let drivers = (this.data.users || []).filter(u => u.role === 'EMPLOYEE');
    if (filterDriverId && filterDriverId !== 'ALL') {
      drivers = drivers.filter(u => Number(u.id) === Number(filterDriverId));
    }

    const report = [];

    drivers.forEach(driver => {
      const empId = driver.id;
      const stockItems = this.data.employeeStock[empId] || [];

      this.data.products.forEach(prod => {
        const pcsPerUnit = prod.pieces_per_unit || 20;

        // Driver Movements for this product
        const prodMovements = (this.data.stockMovements || []).filter(m => Number(m.employee_id) === Number(empId) && Number(m.product_id) === Number(prod.id));

        const issuedPcs = prodMovements.filter(m => m.movement_type === 'DRIVER_ISSUE').reduce((acc, m) => acc + (m.qty_pieces || 0), 0);
        const goodReturnPcs = prodMovements.filter(m => m.movement_type === 'DRIVER_RETURN_GOOD' || m.movement_type === 'DRIVER_RETURN').reduce((acc, m) => acc + (m.qty_pieces || 0), 0);
        const damagedPcs = prodMovements.filter(m => m.movement_type === 'DRIVER_RETURN_DAMAGED' || m.movement_type === 'DRIVER_DAMAGE').reduce((acc, m) => acc + (m.qty_pieces || 0), 0);

        // Calculate Route Sales for this product by this driver
        let soldPcs = 0;
        const driverSales = (this.data.sales || []).filter(s => Number(s.employee_id) === Number(empId));
        driverSales.forEach(s => {
          (s.items || []).forEach(item => {
            if (Number(item.product_id) === Number(prod.id)) {
              const pcs = item.unit_type === 'Piece' ? item.qty : (item.qty * pcsPerUnit);
              soldPcs += pcs;
            }
          });
        });

        // Current Driver Balance for this product
        const empProdStock = stockItems.find(s => Number(s.product_id) === Number(prod.id));
        const currentBalPcs = empProdStock ? Math.round((empProdStock.qty_units || 0) * pcsPerUnit) : 0;

        const expectedReturnPcs = Math.max(0, issuedPcs - soldPcs);
        const variancePcs = issuedPcs - (soldPcs + goodReturnPcs + damagedPcs + currentBalPcs);

        // Include in report if driver had issue, sale, or current stock for this product
        if (issuedPcs > 0 || soldPcs > 0 || currentBalPcs > 0 || goodReturnPcs > 0 || damagedPcs > 0) {
          report.push({
            driver_id: driver.id,
            driver_name: driver.name,
            vehicle_no: driver.vehicle_no,
            product_id: prod.id,
            product_name: prod.display_name || prod.name,
            category_id: prod.category_id || 1,
            category_name: prod.category || 'Dairy',
            pieces_per_unit: pcsPerUnit,
            selling_unit: prod.selling_unit || 'Tray',
            issued_pcs: issuedPcs,
            issued_trays: parseFloat((issuedPcs / pcsPerUnit).toFixed(1)),
            sold_pcs: soldPcs,
            sold_trays: parseFloat((soldPcs / pcsPerUnit).toFixed(1)),
            good_return_pcs: goodReturnPcs,
            good_return_trays: parseFloat((goodReturnPcs / pcsPerUnit).toFixed(1)),
            damaged_pcs: damagedPcs,
            damaged_trays: parseFloat((damagedPcs / pcsPerUnit).toFixed(1)),
            current_balance_pcs: currentBalPcs,
            current_balance_trays: parseFloat((currentBalPcs / pcsPerUnit).toFixed(1)),
            expected_return_pcs: expectedReturnPcs,
            variance_pcs: variancePcs,
            status: variancePcs === 0 ? 'RECONCILED' : 'MISMATCH'
          });
        }
      });
    });

    return report;
  }

  getReconciliationReport() {
    return this.getProductReconciliationReport();
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

  // COMPLETE REAL-WORLD DRIVER ROUTE & BILLING FLEET SUMMARY (DYNAMIC FOR N DRIVERS)
  getFleetRouteSummary() {
    const drivers = (this.data.users || []).filter(u => u.role === 'EMPLOYEE');
    const routes = this.data.routes || [];
    const shops = this.data.shops || [];
    const sales = this.data.sales || [];
    const stockMovements = this.data.stockMovements || [];
    const driverReturns = this.data.driverReturns || [];
    const damages = this.data.damages || [];
    const products = this.data.products || [];

    const driverCards = drivers.map(driver => {
      const empId = Number(driver.id);
      const assignedRoute = routes.find(r => Number(r.driver_id) === empId || Number(r.id) === Number(driver.route_id)) || {
        id: empId,
        code: `R00${empId}`,
        name: `Route ${String.fromCharCode(64 + empId)} - Driver Line`,
        status: driver.status || 'ON_ROUTE',
        dispatch_time: '05:30 AM'
      };

      const assignedShops = shops.filter(s => Number(s.route_id) === Number(assignedRoute.id) || Number(s.driver_id) === empId);

      // Driver Sales Invoices
      const driverSales = sales.filter(s => Number(s.employee_id) === empId);
      const billedShopIds = new Set(driverSales.map(s => Number(s.shop_id)));
      const billedShopsCount = assignedShops.filter(s => billedShopIds.has(Number(s.id))).length;
      const pendingShopsCount = Math.max(0, assignedShops.length - billedShopsCount);

      const totalSalesAmount = driverSales.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
      const totalCashPaid = driverSales.reduce((acc, s) => acc + (Number(s.cash_paid || s.paid_amount || 0)), 0);
      const totalGpayPaid = driverSales.reduce((acc, s) => acc + (Number(s.gpay_paid || 0)), 0);
      const totalCollectedAmount = totalCashPaid + totalGpayPaid;
      const totalCreditAmount = driverSales.reduce((acc, s) => acc + (Number(s.credit_paid || s.credit_amount || 0)), 0);

      // Stock Calculations normalized to base pieces
      const empMovements = stockMovements.filter(m => Number(m.employee_id) === empId);
      const issuedPcs = empMovements.filter(m => m.movement_type === 'DRIVER_ISSUE').reduce((acc, m) => acc + (m.qty_pieces || 0), 0);
      const goodReturnPcs = empMovements.filter(m => m.movement_type === 'DRIVER_RETURN_GOOD' || m.movement_type === 'DRIVER_RETURN').reduce((acc, m) => acc + (m.qty_pieces || 0), 0);
      const damagedPcs = empMovements.filter(m => m.movement_type === 'DRIVER_RETURN_DAMAGED' || m.movement_type === 'DRIVER_DAMAGE').reduce((acc, m) => acc + (m.qty_pieces || 0), 0);

      let soldPcs = 0;
      driverSales.forEach(s => {
        (s.items || []).forEach(item => {
          const prod = products.find(p => Number(p.id) === Number(item.product_id));
          const ratio = prod ? (prod.pieces_per_unit || 20) : 20;
          if (item.unit_type === 'Piece') {
            soldPcs += Number(item.qty || 0);
          } else {
            soldPcs += Number(item.qty || 0) * ratio;
          }
        });
      });

      // Current Driver Live Stock from employeeStock
      const empStockList = this.data.employeeStock[empId] || [];
      const actualBalancePcs = empStockList.reduce((acc, st) => {
        const prod = products.find(p => Number(p.id) === Number(st.product_id));
        const ratio = prod ? (prod.pieces_per_unit || 20) : 20;
        return acc + Math.round((st.qty_units || 0) * ratio);
      }, 0);

      const expectedBalancePcs = Math.max(0, issuedPcs - (soldPcs + goodReturnPcs + damagedPcs));
      const discrepancyPcs = actualBalancePcs - expectedBalancePcs;
      const reconciliationStatus = discrepancyPcs === 0 ? 'RECONCILED' : 'MISMATCH';

      // Dynamic Village Progress Breakdown
      const villageMap = {};
      assignedShops.forEach(shop => {
        const vName = shop.village_name || 'General Route Area';
        if (!villageMap[vName]) {
          villageMap[vName] = {
            village_name: vName,
            shops: [],
            totalShops: 0,
            billedShops: 0,
            salesAmount: 0,
            collectedAmount: 0,
            creditAmount: 0,
            status: 'PENDING'
          };
        }
        const shopSales = driverSales.filter(s => Number(s.shop_id) === Number(shop.id));
        const isShopBilled = shopSales.length > 0;
        const shopSalesAmt = shopSales.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
        const shopPaidAmt = shopSales.reduce((acc, s) => acc + (Number(s.cash_paid || 0) + Number(s.gpay_paid || 0)), 0);
        const shopCreditAmt = shopSales.reduce((acc, s) => acc + (Number(s.credit_paid || 0)), 0);

        villageMap[vName].shops.push({
          ...shop,
          isBilled: isShopBilled,
          salesAmount: shopSalesAmt,
          paidAmount: shopPaidAmt,
          creditAmount: shopCreditAmt,
          bills: shopSales,
          visitStatus: isShopBilled ? (shopCreditAmt > 0 ? (shopPaidAmt > 0 ? 'PARTIAL' : 'CREDIT') : 'PAID') : 'PENDING'
        });

        villageMap[vName].totalShops += 1;
        if (isShopBilled) villageMap[vName].billedShops += 1;
        villageMap[vName].salesAmount += shopSalesAmt;
        villageMap[vName].collectedAmount += shopPaidAmt;
        villageMap[vName].creditAmount += shopCreditAmt;
      });

      const villages = Object.values(villageMap).map((v, idx) => {
        let status = 'PENDING';
        if (v.billedShops === v.totalShops && v.totalShops > 0) {
          status = 'COMPLETED';
        } else if (v.billedShops > 0) {
          status = 'IN_PROGRESS';
        }
        return {
          sequence: idx + 1,
          ...v,
          status
        };
      });

      const totalVillages = villages.length;
      const completedVillages = villages.filter(v => v.status === 'COMPLETED').length;
      const routeCompletionPct = assignedShops.length > 0 ? Math.round((billedShopsCount / assignedShops.length) * 100) : 0;

      return {
        driver_id: empId,
        driver_name: driver.name,
        phone: driver.phone || '9876543210',
        vehicle_no: driver.vehicle_no || 'TN 32 XX 2222',
        vehicle_model: driver.vehicle_model || 'Tata Ace Gold (Freezer)',
        route_id: assignedRoute.id,
        route_name: assignedRoute.name,
        route_status: assignedRoute.status || 'ON_ROUTE',
        dispatch_time: assignedRoute.dispatch_time || '05:30 AM',
        // Stock KPI Breakdown
        issuedPcs,
        soldPcs,
        goodReturnPcs,
        damagedPcs,
        actualBalancePcs,
        expectedBalancePcs,
        discrepancyPcs,
        reconciliationStatus,
        // Financial KPI Breakdown
        totalSalesAmount,
        totalCollectedAmount,
        totalCashPaid,
        totalGpayPaid,
        totalCreditAmount,
        billsCount: driverSales.length,
        // Progress KPI Breakdown
        totalShops: assignedShops.length,
        billedShops: billedShopsCount,
        pendingShops: pendingShopsCount,
        totalVillages,
        completedVillages,
        routeCompletionPct,
        villages
      };
    });

    // Top KPI Aggregations across all N drivers
    const totalAssignedVillages = driverCards.reduce((acc, d) => acc + d.totalVillages, 0);
    const totalCompletedVillages = driverCards.reduce((acc, d) => acc + d.completedVillages, 0);
    const totalAssignedShops = driverCards.reduce((acc, d) => acc + d.totalShops, 0);
    const totalBilledShops = driverCards.reduce((acc, d) => acc + d.billedShops, 0);
    const totalPendingShops = Math.max(0, totalAssignedShops - totalBilledShops);

    const totalIssuedPcs = driverCards.reduce((acc, d) => acc + d.issuedPcs, 0);
    const totalSoldPcs = driverCards.reduce((acc, d) => acc + d.soldPcs, 0);
    const totalRemainingPcs = driverCards.reduce((acc, d) => acc + d.actualBalancePcs, 0);
    const totalReturnedPcs = driverCards.reduce((acc, d) => acc + d.goodReturnPcs, 0);
    const totalDamagedPcs = driverCards.reduce((acc, d) => acc + d.damagedPcs, 0);

    const totalSalesAmount = driverCards.reduce((acc, d) => acc + d.totalSalesAmount, 0);
    const totalCollectedAmount = driverCards.reduce((acc, d) => acc + d.totalCollectedAmount, 0);
    const totalCreditAmount = driverCards.reduce((acc, d) => acc + d.totalCreditAmount, 0);

    return {
      kpis: {
        activeDrivers: drivers.length,
        driversOnRoute: driverCards.filter(d => d.route_status === 'ON_ROUTE' || d.billsCount > 0).length,
        driversCompleted: driverCards.filter(d => d.routeCompletionPct === 100 || d.route_status === 'COMPLETED').length,
        assignedVillages: totalAssignedVillages,
        completedVillages: totalCompletedVillages,
        assignedShops: totalAssignedShops,
        billedShops: totalBilledShops,
        pendingShops: totalPendingShops,
        totalIssuedPcs,
        totalSoldPcs,
        totalRemainingPcs,
        totalReturnedPcs,
        totalDamagedPcs,
        totalSalesAmount,
        totalCollectedAmount,
        totalCreditAmount
      },
      driverCards
    };
  }

  // COMPLETE 10-TAB DRIVER DETAIL DATASET
  getDriverDetailSummary(driverId) {
    const empId = Number(driverId);
    const driver = (this.data.users || []).find(u => Number(u.id) === empId && u.role === 'EMPLOYEE');
    if (!driver) {
      return {
        driver: null,
        summary: null,
        sales: [],
        stock: [],
        movements: [],
        returns: [],
        damages: [],
        reconciliation: []
      };
    }

    const fleet = this.getFleetRouteSummary();
    const card = (fleet.driverCards || []).find(c => Number(c.driver_id) === empId);

    const driverSales = (this.data.sales || []).filter(s => Number(s.employee_id) === empId);
    const driverStock = this.data.employeeStock[empId] || [];
    const driverMovements = (this.data.stockMovements || []).filter(m => Number(m.employee_id) === empId);
    const driverReturnsList = (this.data.driverReturns || []).filter(r => Number(r.employee_id) === empId);
    const driverDamagesList = (this.data.damages || []).filter(d => Number(d.employee_id) === empId);
    const productRecon = this.getProductReconciliationReport(empId);

    return {
      driver,
      summary: card,
      sales: driverSales,
      stock: driverStock,
      movements: driverMovements,
      returns: driverReturnsList,
      damages: driverDamagesList,
      reconciliation: productRecon
    };
  }

  // EMPLOYEE & LOGIN USER MANAGEMENT METHODS

  reassignDriverRoute(routeId, newDriverId) {
    const rId = Number(routeId);
    const dId = Number(newDriverId);

    const route = (this.data.routes || []).find(r => Number(r.id) === rId);
    if (!route) throw new Error(`Route #${routeId} not found`);

    const newDriver = (this.data.users || []).find(u => Number(u.id) === dId && u.role === 'EMPLOYEE');
    if (!newDriver) throw new Error(`Driver #${newDriverId} not found`);

    route.driver_id = newDriver.id;
    route.driver_name = newDriver.name;
    route.vehicle_no = newDriver.vehicle_no;

    return { success: true, route, message: `Route '${route.name}' transferred to ${newDriver.name}. Historical records preserved.` };
  }

  async getExpenses() {
    const [rows] = await pool.query('SELECT * FROM expenses ORDER BY created_at DESC');
    return rows;
  }

  async addExpense(data) {
    const [result] = await pool.query('INSERT INTO expenses (employee_id, title, category, amount, notes) VALUES (?, ?, ?, ?, ?)', [data.employee_id || null, data.title, data.category || 'General', data.amount, data.notes || null]);
    return { id: result.insertId, ...data };
  }

  async getDamages() {
    const [rows] = await pool.query('SELECT * FROM damages ORDER BY created_at DESC');
    return rows;
  }

  async getSettlements() {
    const [rows] = await pool.query('SELECT * FROM settlements ORDER BY created_at DESC');
    return rows;
  }

  async addEmployee(empData) {
    const code = empData.employee_code || 'EMP-' + Date.now();
    const [result] = await pool.query('INSERT INTO users (employee_code, name, phone, role, vehicle_no, status) VALUES (?, ?, ?, ?, ?, ?)', 
      [code, empData.name, empData.phone, empData.role || 'EMPLOYEE', empData.vehicle_no || null, empData.status || 'Active']);
    return { id: result.insertId, ...empData, employee_code: code };
  }

  async updateEmployee(id, empData) {
    const fields = [];
    const values = [];
    const allowed = ['name', 'phone', 'vehicle_no', 'status'];
    for (let k of allowed) {
      if (empData[k] !== undefined) {
        fields.push(k + '=?');
        values.push(empData[k]);
      }
    }
    if (fields.length > 0) {
      values.push(id);
      await pool.query('UPDATE users SET ' + fields.join(', ') + ' WHERE id=?', values);
    }
    return { success: true };
  }
}

export const db = new MemoryDB();
