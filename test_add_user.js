async function run() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '9999', role: 'OWNER' })
  });
  let cookie = loginRes.headers.get('set-cookie').split(';')[0];
  
  // Test add user
  const addRes = await fetch('http://localhost:5000/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      employee_id: 1, // Driver 1
      login_id: 'driver1_login',
      pin: '1234',
      role: 'EMPLOYEE'
    })
  });
  console.log('Add status:', addRes.status, await addRes.json());
}
run();
