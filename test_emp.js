async function run() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '9999', role: 'OWNER' })
  });
  let cookie = loginRes.headers.get('set-cookie').split(';')[0];
  
  const res = await fetch('http://localhost:5000/api/employees', { headers: { 'Cookie': cookie } });
  console.log('Status:', res.status);
  const data = await res.text();
  console.log('Data:', data.substring(0, 500));
}
run();
