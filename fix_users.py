import re

with open('backend/db.js', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """
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

start_idx = content.find("getUsers() {")
end_idx = content.find("async login(pin, role) {")

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + replacement + content[end_idx:]
    
    # Also replace old addEmployee/updateEmployee later in the file if they exist
    old_add = new_content.find("addEmployee(employeeData) {")
    old_upd = new_content.find("toggleEmployeeStatus(employeeId, isActive) {")
    if old_add != -1:
        # Just comment them out or remove them. It's safer to let the Python regex delete them, but simpler:
        import re
        new_content = re.sub(r'addEmployee\(employeeData\) \{[\s\S]*?return \{ success: true, employee: newEmployee \};\s*\}', '/* old addEmployee removed */', new_content)
        new_content = re.sub(r'updateEmployee\(employeeId, employeeData\) \{[\s\S]*?return \{ success: true, employee: emp \};\s*\}', '/* old updateEmployee removed */', new_content)
        new_content = re.sub(r'toggleEmployeeStatus\(employeeId, isActive\) \{[\s\S]*?return \{ success: true, employee: emp \};\s*\}', '/* old toggleEmployeeStatus removed */', new_content)

    with open('backend/db.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Users/Employees DB migrated")
else:
    print("Not found")
