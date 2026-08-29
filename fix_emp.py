import re

with open('backend/db.js', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """
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
"""

idx = content.rfind('}')
if idx != -1:
    new_content = content[:idx] + replacement + content[idx:]
    with open('backend/db.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Added async employee methods back")
