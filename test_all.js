async function run() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '9999', role: 'OWNER' })
  });
  let cookie = loginRes.headers.get('set-cookie').split(';')[0];
  
  const endpoints = ['/shops', '/products', '/categories', '/employee-stock/1', '/dashboard/summary', '/sales', '/expenses', '/inventory/movements', '/users', '/routes'];
  
  for (let ep of endpoints) {
    try {
      const res = await fetch('http://localhost:5000/api' + ep, { headers: { 'Cookie': cookie } });
      const text = await res.text();
      console.log(ep, res.status, text.length > 200 ? text.substring(0, 100) + '...' : text);
    } catch(err) {
      console.log(ep, 'Fetch failed', err);
    }
  }
}
run();
