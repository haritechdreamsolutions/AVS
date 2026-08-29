const fs = require('fs');
let code = fs.readFileSync('backend/index.js', 'utf8');
code = "import 'dotenv/config';\n" + code;
fs.writeFileSync('backend/index.js', code, 'utf8');
