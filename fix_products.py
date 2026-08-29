import re

with open('backend/db.js', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "async getProducts() {"
end_marker = "  getEmployeeStock(empId) {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    replacement = r'''async getProducts() {
    const [rows] = await pool.query('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id');
    return rows.map(r => ({ ...r, category: r.category_name || r.category }));
  }

  async addProduct(productData) {
    if (!productData.name || !productData.name.trim()) throw new Error("Product name is required");
    const [result] = await pool.query(INSERT INTO products (category_id, sku, barcode, name, display_name, category, base_unit, selling_unit, pieces_per_unit, purchase_price, unit_selling_price, piece_selling_price, warehouse_stock_units, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), 
    [productData.category_id || 1, productData.sku || null, productData.barcode || null, productData.name, productData.display_name || productData.name, productData.category || 'Dairy', productData.base_unit || 'Piece', productData.selling_unit || 'Tray', productData.pieces_per_unit || 20, productData.purchase_price || 0, productData.unit_selling_price || 0, productData.piece_selling_price || 0, productData.warehouse_stock_units || 0, productData.min_stock_level || 10]);
    return { id: result.insertId, ...productData };
  }

  async updateProduct(productId, productData) {
    const allowedFields = ['sku', 'barcode', 'name', 'display_name', 'category', 'category_id', 'selling_unit', 'base_unit', 'pieces_per_unit', 'purchase_price', 'unit_selling_price', 'piece_selling_price', 'warehouse_stock_units', 'min_stock_level', 'is_active'];
    let fields = [];
    let values = [];
    for (let key of allowedFields) {
      if (productData[key] !== undefined) {
        fields.append(f"{key}=?");
        values.append(productData[key]);
      }
    }
    // Javascript translation of the above python-like logic:
    // Oh wait, this is writing javascript syntax.
    // I will write pure JS string.
'''
    # Let me just write the JS code directly inside the string.
    replacement = """async getProducts() {
    const [rows] = await pool.query('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id');
    return rows.map(r => ({ ...r, category: r.category_name || r.category }));
  }

  async addProduct(productData) {
    if (!productData.name || !productData.name.trim()) throw new Error("Product name is required");
    const [result] = await pool.query(INSERT INTO products (category_id, sku, barcode, name, display_name, category, base_unit, selling_unit, pieces_per_unit, purchase_price, unit_selling_price, piece_selling_price, warehouse_stock_units, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), 
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

"""
    new_content = content[:start_idx] + replacement + content[end_idx:]
    with open('backend/db.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Fixed db.js")
else:
    print("Not found")
