async function run() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1111', role: 'EMPLOYEE' })
    });
    console.log(loginRes.status, await loginRes.text());
  } catch(e) {
    console.error(e);
  }
}
run();
