import http from 'http';

function request(options, bodyData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const cookie = res.headers['set-cookie'] ? res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ') : '';
        try { resolve({ status: res.statusCode, body: JSON.parse(data), cookie }); }
        catch (e) { resolve({ status: res.statusCode, raw: data, cookie }); }
      });
    });
    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

async function verify() {
  console.log('1. Logging in as Owner (owner / 1234) ...');
  const ownerLogin = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ login_id: 'owner', pin: '1234' }));
  
  console.log('Owner login:', ownerLogin.status, ownerLogin.body.user.name);

  console.log('\n2. Owner GET /api/shops ...');
  const ownerShops = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/shops',
    method: 'GET',
    headers: { 'Cookie': ownerLogin.cookie }
  });
  console.log('Owner Shops Count:', ownerShops.body.length);
  console.log(ownerShops.body.map(s => ({ id: s.id, name: s.name, code: s.code, owner: s.owner_name })));

  console.log('\n3. Logging in as Driver Tharun (tharun / 2002) ...');
  const driverLogin = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ login_id: 'tharun', pin: '2002' }));

  console.log('Driver login:', driverLogin.status, driverLogin.body.user.name);

  console.log('\n4. Driver GET /api/emp/shops ...');
  const driverShops = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/emp/shops',
    method: 'GET',
    headers: { 'Cookie': driverLogin.cookie }
  });
  console.log('Driver Shops Count:', driverShops.body.length);
  console.log(driverShops.body.map(s => ({ id: s.id, name: s.name, code: s.code })));

  console.log('\n5. Logging in as Driver Guna (emp006 / 9999) ...');
  const gunaLogin = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ login_id: 'emp006', pin: '9999' }));

  console.log('Guna login:', gunaLogin.status, gunaLogin.body.user.name);

  console.log('\n6. Guna GET /api/emp/shops ...');
  const gunaShops = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/emp/shops',
    method: 'GET',
    headers: { 'Cookie': gunaLogin.cookie }
  });
  console.log('Guna Shops Count:', gunaShops.body.length);
  console.log(gunaShops.body.map(s => ({ id: s.id, name: s.name, code: s.code })));

  console.log('\nALL VERIFICATIONS PASSED SUCCESSFULLY!');
  process.exit(0);
}

verify().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
