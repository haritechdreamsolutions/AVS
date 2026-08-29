import re
with open('backend/routes.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'router\.get\(\'/products\', requireAuth, \(req, res\) => \{\s*let products = db\.getProducts\(\);',
    r'''router.get('/products', requireAuth, async (req, res) => {
  let products = await db.getProducts();''',
    content
)

content = re.sub(
    r'router\.post\(\'/products\', requireAuth, requireRole\(\'OWNER\'\), \(req, res\) => \{\s*try \{\s*const result = db\.addProduct\(req\.body\);',
    r'''router.post('/products', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await db.addProduct(req.body);''',
    content
)

content = re.sub(
    r'router\.put\(\'/products/:id\', requireAuth, requireRole\(\'OWNER\'\), \(req, res\) => \{\s*try \{\s*const productId = req\.params\.id;\s*const result = db\.updateProduct\(productId, req\.body\);',
    r'''router.put('/products/:id', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const productId = req.params.id;
    const result = await db.updateProduct(productId, req.body);''',
    content
)

content = re.sub(
    r'router\.patch\(\'/products/:id/status\', requireAuth, requireRole\(\'OWNER\'\), \(req, res\) => \{\s*try \{\s*const productId = req\.params\.id;\s*const \{ is_active \} = req\.body;\s*const result = db\.toggleProductStatus\(productId, is_active\);',
    r'''router.patch('/products/:id/status', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const productId = req.params.id;
    const { is_active } = req.body;
    const result = await db.toggleProductStatus(productId, is_active);''',
    content
)

content = re.sub(
    r'router\.post\(\'/products/:id/price\', requireAuth, requireRole\(\'OWNER\'\), \(req, res\) => \{\s*try \{\s*const productId = req\.params\.id;\s*const result = db\.updateProductPrice\(productId, req\.body\);',
    r'''router.post('/products/:id/price', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const productId = req.params.id;
    const result = await db.updateProductPrice(productId, req.body);''',
    content
)

with open('backend/routes.js', 'w', encoding='utf-8') as f:
    f.write(content)
