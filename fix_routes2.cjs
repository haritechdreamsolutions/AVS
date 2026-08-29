const fs = require('fs');
let content = fs.readFileSync('backend/routes.js', 'utf8');

// The lines from "// Users / Employees" to "router.post('/routes/:id/reassign'" should be cleaned up.
let startIndex = content.indexOf('// Users / Employees');
let endIndex = content.indexOf("router.post('/routes/:id/reassign'");
if (startIndex !== -1 && endIndex !== -1) {
    let newContent = content.substring(0, startIndex) + content.substring(endIndex);
    fs.writeFileSync('backend/routes.js', newContent, 'utf8');
    console.log("Fixed routes.js syntax");
} else {
    console.log("Markers not found");
}
