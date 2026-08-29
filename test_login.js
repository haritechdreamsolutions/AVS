async function run() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '9999', role: 'OWNER' })
  });
  console.log(loginRes.status, await loginRes.text());
}
run();
