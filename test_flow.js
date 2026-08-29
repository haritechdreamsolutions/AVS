async function run() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '9999', role: 'OWNER' })
  });
  let cookie = loginRes.headers.get('set-cookie').split(';')[0];
  
  // Test add employee
  const addEmpRes = await fetch('http://localhost:5000/api/employees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      name: 'New Driver',
      phone: '1112223334',
      employee_code: 'EMP-123'
    })
  });
  const empData = await addEmpRes.json();
  console.log('Add employee:', empData);
  
  const empId = empData.id;
  
  // Test add user for this employee
  const addUserRes = await fetch('http://localhost:5000/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      employee_id: empId,
      login_id: 'newdriver',
      pin: '4321',
      role: 'EMPLOYEE'
    })
  });
  console.log('Add user:', await addUserRes.json());
  
  // Test login with new user
  const newLoginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '4321', role: 'EMPLOYEE' })
  });
  console.log('New user login status:', newLoginRes.status);
}
run();
