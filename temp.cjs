const fs = require('fs');
let content = fs.readFileSync('backend/db.js', 'utf8');
const lines = content.split('\n');
let start = lines.findIndex(l => l.includes('async getProducts()'));
let end = lines.findIndex(l => l.includes('getEmployeeStock(empId)'));
console.log(lines.slice(start, end).join('\n'));
