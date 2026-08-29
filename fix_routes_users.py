import re

with open('backend/routes.js', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """
router.get('/users', requireAuth, requireRole('OWNER'), async (req, res) => {
  try { res.json(await db.getUsers()); } catch(e) { res.status(500).json({error: e.message}); }
});

router.post('/users', requireAuth, requireRole('OWNER'), async (req, res) => {
  try { res.json(await db.addUser(req.body)); } catch(e) { res.status(400).json({success: false, message: e.message}); }
});

router.put('/users/:id', requireAuth, requireRole('OWNER'), async (req, res) => {
  try { res.json(await db.updateUser(req.params.id, req.body)); } catch(e) { res.status(400).json({success: false, message: e.message}); }
});

router.post('/users/:id/reset-pin', requireAuth, requireRole('OWNER'), async (req, res) => {
  try { res.json(await db.resetUserPin(req.params.id, req.body.pin)); } catch(e) { res.status(400).json({success: false, message: e.message}); }
});

router.get('/employees', requireAuth, requireRole('OWNER'), async (req, res) => {
  try { res.json(await db.getEmployees()); } catch(e) { res.status(500).json({error: e.message}); }
});

router.post('/employees', requireAuth, requireRole('OWNER'), async (req, res) => {
  try { res.json(await db.addEmployee(req.body)); } catch(e) { res.status(400).json({success: false, message: e.message}); }
});

router.put('/employees/:id', requireAuth, requireRole('OWNER'), async (req, res) => {
  try { res.json(await db.updateEmployee(req.params.id, req.body)); } catch(e) { res.status(400).json({success: false, message: e.message}); }
});
"""

# Find old users/employees routes and replace them
content = re.sub(r'router\.get\(\'/users\',.*?\}\);', '', content, flags=re.DOTALL)
content = re.sub(r'router\.post\(\'/employees\',.*?\}\);', '', content, flags=re.DOTALL)
content = re.sub(r'router\.put\(\'/employees/:id\',.*?\}\);', '', content, flags=re.DOTALL)
content = re.sub(r'router\.patch\(\'/employees/:id/status\',.*?\}\);', '', content, flags=re.DOTALL)

# Insert the new routes right after company route
content = re.sub(r'(router\.get\(\'/company\'.*?\}\);)', r'\1\n' + replacement, content, flags=re.DOTALL)

with open('backend/routes.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Users/Employees routes migrated")
