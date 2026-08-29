import re

with open('backend/db.js', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """
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
"""

idx = content.rfind('}')
if idx != -1:
    new_content = content[:idx] + replacement + content[idx:]
    with open('backend/db.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Added missing methods")
