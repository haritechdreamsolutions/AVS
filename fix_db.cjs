const fs = require('fs');
let content = fs.readFileSync('backend/db.js', 'utf8');

const marker = "return { success: true, message: Category '' deleted successfully. };\n  }";
let startIndex = content.indexOf(marker);
if (startIndex !== -1) {
    startIndex += marker.length;
}

const endIndex = content.indexOf("async updateProduct(id, updates) {");

if (startIndex !== -1 && endIndex !== -1) {
    const newContent = content.substring(0, startIndex) + "\n\n  async getProducts(activeOnly = false) {\n    let query = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id';\n    if (activeOnly) {\n      query += ' WHERE p.is_active = 1';\n    }\n    const [rows] = await pool.query(query);\n    return rows.map(r => ({ ...r, category: r.category_name || r.category }));\n  }\n\n  async addProduct(productData) {\n    if (!productData.name || !productData.name.trim()) throw new Error(\"Product name is required\");\n    const [result] = await pool.query(INSERT INTO products (category_id, sku, barcode, name, display_name, category, base_unit, selling_unit, pieces_per_unit, purchase_price, unit_selling_price, piece_selling_price, warehouse_stock_units, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), \n    [productData.category_id || 1, productData.sku || null, productData.barcode || null, productData.name, productData.display_name || productData.name, productData.category || 'Dairy', productData.base_unit || 'Piece', productData.selling_unit || 'Tray', productData.pieces_per_unit || 20, productData.purchase_price || 0, productData.unit_selling_price || 0, productData.piece_selling_price || 0, productData.warehouse_stock_units || 0, productData.min_stock_level || 10]);\n    return { id: result.insertId, ...productData };\n  }\n\n  " + content.substring(endIndex);
    fs.writeFileSync('backend/db.js', newContent, 'utf8');
    console.log("Fixed db.js");
} else {
    console.log("Could not find markers", startIndex, endIndex);
}
