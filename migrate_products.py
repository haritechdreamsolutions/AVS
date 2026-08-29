import re

with open('backend/db.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'getProducts\(\) \{[\s\S]*?return this\.data\.products[\s\S]*?\}\s*\}',
    '''async getProducts() {
    const [rows] = await pool.query('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id');
    return rows.map(r => ({ ...r, category: r.category_name || r.category }));
  }''',
    content
)

content = re.sub(
    r'addProduct\(productData\) \{[\s\S]*?return newProduct;\s*\}',
    '''async addProduct(productData) {
    if (!productData.name || !productData.name.trim()) throw new Error("Product name is required");
    const [result] = await pool.query(INSERT INTO products (category_id, sku, barcode, name, display_name, category, base_unit, selling_unit, pieces_per_unit, purchase_price, unit_selling_price, piece_selling_price, warehouse_stock_units, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), 
    [productData.category_id || 1, productData.sku || null, productData.barcode || null, productData.name, productData.display_name || productData.name, productData.category || 'Dairy', productData.base_unit || 'Piece', productData.selling_unit || 'Tray', productData.pieces_per_unit || 20, productData.purchase_price || 0, productData.unit_selling_price || 0, productData.piece_selling_price || 0, productData.warehouse_stock_units || 0, productData.min_stock_level || 10]);
    return { id: result.insertId, ...productData };
  }''',
    content
)

content = re.sub(
    r'updateProduct\(id, updates\) \{[\s\S]*?return prod;\s*\}',
    '''async updateProduct(id, updates) {
    const fields = Object.keys(updates).filter(k => k !== 'id').map(k => ${k}=?).join(', ');
    const values = Object.keys(updates).filter(k => k !== 'id').map(k => updates[k]);
    values.push(id);
    await pool.query(UPDATE products SET  WHERE id=?, values);
    return { id, ...updates };
  }''',
    content
)

content = re.sub(
    r'toggleProductStatus\(id, isActive\) \{[\s\S]*?return prod;\s*\}',
    '''async toggleProductStatus(id, isActive) {
    await pool.query('UPDATE products SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
    return { id, is_active: isActive };
  }''',
    content
)

content = re.sub(
    r'updateProductPrice\(id, priceData\) \{[\s\S]*?return prod;\s*\}',
    '''async updateProductPrice(id, priceData) {
    await pool.query('UPDATE products SET purchase_price=?, unit_selling_price=?, piece_selling_price=? WHERE id=?', [priceData.purchase_price, priceData.unit_selling_price, priceData.piece_selling_price, id]);
    return { id, ...priceData };
  }''',
    content
)

with open('backend/db.js', 'w', encoding='utf-8') as f:
    f.write(content)
