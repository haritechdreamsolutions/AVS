const fs = require('fs');
let content = fs.readFileSync('backend/db.js', 'utf8');

const replacement = \
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

  async addDamage(data) {
    const [result] = await pool.query('INSERT INTO damages (employee_id, employee_name, product_id, product_name, qty_units, reason, amount) VALUES (?, ?, ?, ?, ?, ?, ?)', [data.employee_id, data.employee_name, data.product_id, data.product_name, data.qty_units, data.reason, data.amount || 0]);
    return { id: result.insertId, ...data };
  }

  async getSettlements() {
    const [rows] = await pool.query('SELECT * FROM settlements ORDER BY created_at DESC');
    return rows;
  }
\;

// Insert them at the end of the class
let idx = content.lastIndexOf('}');
content = content.substring(0, idx) + replacement + content.substring(idx);
fs.writeFileSync('backend/db.js', content, 'utf8');
