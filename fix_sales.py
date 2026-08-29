import re

with open('backend/db.js', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """
  async getSales(filters = {}) {
    let query = 'SELECT s.*, (SELECT JSON_ARRAYAGG(JSON_OBJECT(\"product_id\", si.product_id, \"product_name\", si.product_name, \"qty\", si.qty, \"rate\", si.rate, \"amount\", si.amount)) FROM sale_items si WHERE si.sale_id = s.id) as items FROM sales s WHERE 1=1';
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
"""

start_idx = content.find("getSales(filters = {}) {")
end_idx = content.find("addDamage(damageData) {")

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + replacement + content[end_idx:]
    with open('backend/db.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Sales migrated")
else:
    print("Not found")
