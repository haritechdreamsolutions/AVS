const fs = require('fs');

let content = fs.readFileSync('frontend/src/components/Owner/UsersMaster.jsx', 'utf8');

content = content.replace("if(!window.confirm(Are you sure you want to  this user?)) return;", "if(!window.confirm(`Are you sure you want to ${user.status === 'Active' ? 'deactivate' : 'activate'} this user?`)) return;");

content = content.replace("<span className={px-2 py-1 text-xs rounded-full }>", "<span className={`px-2 py-1 text-xs rounded-full ${u.role === 'OWNER' ? 'bg-purple-100 text-purple-700' : u.role === 'STORE_KEEPER' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>");

content = content.replace("<span className={px-2 py-1 text-xs rounded-full }>", "<span className={`px-2 py-1 text-xs rounded-full ${u.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>");

// wait, the action button class is probably completely messed up. Let's find it.
