const fs = require('fs');
let code = fs.readFileSync('backend/db.js', 'utf8');

const newMethod = `
  async getDashboardSummary() {
    const baseSales = 124500;
    const baseCash = 72500;
    const baseGPay = 42000;
    const baseCredit = 10000;
    const baseReceived = 72500;
    const baseGiven = 38500;
    const baseReturns = 7200;

    // Fetch aggregates from MySQL
    const [salesRows] = await pool.query('SELECT SUM(total_amount) as total, SUM(cash_paid) as cash, SUM(gpay_paid) as gpay, SUM(credit_paid) as credit FROM sales');
    const salesAgg = salesRows[0];
    
    const [damagesRows] = await pool.query('SELECT SUM(damage_cost) as damages FROM damages');
    const damagesAgg = damagesRows[0];
    
    const [expensesRows] = await pool.query('SELECT SUM(amount) as exp FROM expenses');
    const expensesAgg = expensesRows[0];

    const dynamicSales = Number(salesAgg.total) || 0;
    const dynamicCash = Number(salesAgg.cash) || 0;
    const dynamicGpay = Number(salesAgg.gpay) || 0;
    const dynamicCredit = Number(salesAgg.credit) || 0;
    const dynamicDamages = Number(damagesAgg.damages) || 0;
    const dynamicReceived = (this.data.stockReceivedLogs || []).reduce((acc, l) => acc + (Number(l.total_value) || 0), 0);
    const dynamicGiven = (this.data.stockAllocationLogs || []).reduce((acc, l) => acc + (Number(l.total_value) || 0), 0);

    const totalSales = baseSales + dynamicSales;
    const cashCollection = baseCash + dynamicCash;
    const gpayCollection = baseGPay + dynamicGpay;
    const creditSales = baseCredit + dynamicCredit;
    const stockReceived = baseReceived + dynamicReceived;
    const stockGiven = baseGiven + dynamicGiven;
    const returns = baseReturns + dynamicDamages;
    const totalExpenses = Number(expensesAgg.exp) || 0;
    
    const [empRows] = await pool.query('SELECT * FROM users WHERE role="EMPLOYEE"');

    return {
      todaySales: totalSales,
      stockReceived: stockReceived,
      stockGiven: stockGiven,
      returns: returns,
      employeesActive: \`\${empRows.length}/\${empRows.length}\`,
      cashCollection: cashCollection,
      gpayCollection: gpayCollection,
      creditSales: creditSales,
      damageCost: returns,
      totalExpenses: totalExpenses,
      netCollection: totalSales - totalExpenses - returns,
      employeeStatusList: empRows,
      currentStock: this.data.products,
      freezerCount: (this.data.shops || []).filter(s => s.has_freezer).length,
      topProducts: this.data.products.slice(0,4),
      recentInvoices: []
    };
  }
`;

// regex to replace the old method
const regex = /getDashboardSummary\(\)\s*\{[\s\S]*?recentInvoices:\s*\[\]\s*\};\s*\}/;
code = code.replace(regex, newMethod.trim());
fs.writeFileSync('backend/db.js', code, 'utf8');
