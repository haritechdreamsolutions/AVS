async function run() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '1111', role: 'EMPLOYEE' })
  });
  let cookie = loginRes.headers.get('set-cookie');
  console.log('Login status:', loginRes.status);
  console.log('Set-Cookie string:', cookie);
  
  if (cookie) {
    // Extract just the cookie value without HttpOnly etc.
    cookie = cookie.split(';')[0];
  }
  
  const stockRes = await fetch('http://localhost:5000/api/employee-stock/2', {
    headers: { 'Cookie': cookie }
  });
  console.log('Attempting to access Driver 2 stock as Driver 1...');
  console.log('Status:', stockRes.status);
  const text = await stockRes.text();
  console.log('Response:', text);
  
  const ownStockRes = await fetch('http://localhost:5000/api/employee-stock/1', {
    headers: { 'Cookie': cookie }
  });
  console.log('Attempting to access Driver 1 stock as Driver 1...');
  console.log('Status:', ownStockRes.status);
  
}
run();
