const fs = require('fs');
let code = fs.readFileSync('backend/index.js', 'utf8');
code = code.replace("import dotenv from 'dotenv';", "import dotenv from 'dotenv';\ndotenv.config();");
code = code.replace("dotenv.config();\n\nconst app = express();", "const app = express();");
fs.writeFileSync('backend/index.js', code, 'utf8');
