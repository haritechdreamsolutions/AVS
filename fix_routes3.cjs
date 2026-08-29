const fs = require('fs');
let content = fs.readFileSync('backend/routes.js', 'utf8');

content = content.replace("router.get(\\'/expenses\\', async, (req, res)", "router.get('/expenses', async (req, res)");
content = content.replace("router.post(\\'/expenses\\', async, (req, res)", "router.post('/expenses', async (req, res)");

fs.writeFileSync('backend/routes.js', content, 'utf8');
