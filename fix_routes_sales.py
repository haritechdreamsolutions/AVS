import re

with open('backend/routes.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'router\.get\(\'/sales\', requireAuth, requireRole\(\'OWNER\'\), \(req, res\) => \{\s*res\.json\(db\.getSales\(req\.query\)\);',
    r'''router.get('/sales', requireAuth, requireRole('OWNER'), async (req, res) => {
  res.json(await db.getSales(req.query));''',
    content
)

content = re.sub(
    r'router\.post\(\'/sales\', requireAuth, \(req, res\) => \{\s*try \{\s*const sale = db\.createSale\(req\.body\);',
    r'''router.post('/sales', requireAuth, async (req, res) => {
  try {
    const sale = await db.createSale(req.body);''',
    content
)

with open('backend/routes.js', 'w', encoding='utf-8') as f:
    f.write(content)
