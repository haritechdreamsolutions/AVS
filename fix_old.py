import re

with open('backend/db.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Delete old addEmployee
content = re.sub(r'\s*addEmployee\(.*?\)\s*\{[\s\S]*?return\s*\{.*?\};\s*\}', '', content)
# Delete old updateEmployee
content = re.sub(r'\s*updateEmployee\(.*?\)\s*\{[\s\S]*?return\s*\{.*?\};\s*\}', '', content)
# Delete old toggleEmployeeStatus
content = re.sub(r'\s*toggleEmployeeStatus\(.*?\)\s*\{[\s\S]*?return\s*\{.*?\};\s*\}', '', content)
# Delete old deleteEmployee if exists
content = re.sub(r'\s*deleteEmployee\(.*?\)\s*\{[\s\S]*?return\s*\{.*?\};\s*\}', '', content)

with open('backend/db.js', 'w', encoding='utf-8') as f:
    f.write(content)
