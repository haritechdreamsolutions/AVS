const fs = require('fs');
let code = fs.readFileSync('backend/index.js', 'utf8');
code = code.replace("app.listen(PORT, '0.0.0.0', () => {", "app.listen(PORT, () => {");
fs.writeFileSync('backend/index.js', code, 'utf8');
