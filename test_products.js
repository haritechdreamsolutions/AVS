async function run() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '9999', role: 'OWNER' })
  });
  let cookie = loginRes.headers.get('set-cookie').split(';')[0];
  
  const res = await fetch('http://localhost:5000/api/products', { headers: { 'Cookie': cookie } });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Products count:', data.length);
  if (data.length > 0) console.log(data[0]);
}
run();
