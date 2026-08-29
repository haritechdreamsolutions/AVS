const fs = require('fs');
let content = fs.readFileSync('backend/db.js', 'utf8');

const marker = "    this.data.categories.splice(catIndex, 1);\n    return { success: true, message: Category '' deleted successfully. };\n  }";
const lines = content.split('\n');
let startLine = -1;
let endLine = -1;

for (let i=0; i<lines.length; i++) {
  if (lines[i].includes('deleteCategory(categoryId)')) {
     // found delete
  }
  if (lines[i].includes('async getProducts()')) {
     startLine = i;
  }
  if (lines[i].includes('async updateProduct(id, updates)')) {
     endLine = i;
  }
}

if (startLine !== -1 && endLine !== -1) {
    const newContent = lines.slice(0, startLine).join('\n') + "\n\n  async getProducts(activeOnly = false) {\n    let query = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id';\n    if (activeOnly) {\n      query += ' WHERE p.is_active = 1';\n    }\n    const [rows] = await pool.query(query);\n    return rows.map(r => ({ ...r, category: r.category_name || r.category }));\n  }\n\n  async addProduct(productData) {\n    if (!productData.name || !productData.name.trim()) throw new Error(\"Product name is required\");\n    const [result] = await pool.query(INSERT INTO products (category_id, sku, barcode, name, display_name, category, base_unit, selling_unit, pieces_per_unit, purchase_price, unit_selling_price, piece_selling_price, warehouse_stock_units, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), \n    [productData.category_id || 1, productData.sku || null, productData.barcode || null, productData.name, productData.display_name || productData.name, productData.category || 'Dairy', productData.base_unit || 'Piece', productData.selling_unit || 'Tray', productData.pieces_per_unit || 20, productData.purchase_price || 0, productData.unit_selling_price || 0, productData.piece_selling_price || 0, productData.warehouse_stock_units || 0, productData.min_stock_level || 10]);\n    return { id: result.insertId, ...productData };\n  }\n\n  " + lines.slice(endLine).join('\n');
    fs.writeFileSync('backend/db.js', newContent, 'utf8');
    console.log("Fixed db.js");
} else {
    console.log("Lines not found", startLine, endLine);
}
