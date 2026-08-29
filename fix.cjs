
const fs = require('fs');
let content = fs.readFileSync('backend/db.js', 'utf8');
content = content.replace(/pool\.query\\(INSERT INTO products \\(category_id/g, 'pool.query(\\INSERT INTO products (category_id');
content = content.replace(/, \\\n    \\[productData\\.category_id/g, '\\, \\n    [productData.category_id');
content = content.replace(/pool\\.query\\('UPDATE products SET ' \\+ fields\\.join\\(', '\\) \\+ ' WHERE id=\\?', values\\);/g, 'pool.query(\\'UPDATE products SET \\' + fields.join(\\', \\') + \\' WHERE id=?\\', values);');
fs.writeFileSync('backend/db.js', content);

