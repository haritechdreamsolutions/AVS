import re

with open('backend/routes.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'res\.json\(db\.getExpenses\(\)\);',
    r'res.json(await db.getExpenses());',
    content
)
content = re.sub(
    r'router\.get\(\'/expenses\'',
    r'router.get(\'/expenses\', async',
    content
)

content = re.sub(
    r'const expense = db\.addExpense\(req\.body\);',
    r'const expense = await db.addExpense(req.body);',
    content
)
content = re.sub(
    r'router\.post\(\'/expenses\'',
    r'router.post(\'/expenses\', async',
    content
)

with open('backend/routes.js', 'w', encoding='utf-8') as f:
    f.write(content)
