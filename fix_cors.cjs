const fs = require('fs');
let code = fs.readFileSync('backend/index.js', 'utf8');
code = code.replace(/origin:\s*process\.env\.FRONTEND_URL \|\| 'http:\/\/localhost:4001'/, "origin: function(origin, callback) { callback(null, true); }");
fs.writeFileSync('backend/index.js', code, 'utf8');
