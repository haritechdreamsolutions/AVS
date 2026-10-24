import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import https from 'node:https';
import http from 'node:http';
import path from 'node:path';

const fixture=JSON.parse(await readFile('.tmp/local-preview.json','utf8'));
if(!/^postgresql:\/\/avs_preview_runtime_\d+@127\.0\.0\.1:55439\/avs_hardening_preview[a-z0-9_]*$/.test(fixture.database_url))throw new Error('Explicit isolated preview required');
const uri=new URL(fixture.database_url);uri.hostname='localhost';
const caPath=path.resolve('.tmp/local-tls/server.crt'),wrongCa=path.resolve('.tmp/local-tls/untrusted.crt');
Object.assign(process.env,{NODE_ENV:'production',DATABASE_URL:uri.toString(),PG_SSL_CA:caPath,PG_LOCAL_PRIVATE:'0',SESSION_SECRET:fixture.session_secret,FRONTEND_URL:'https://localhost:54439',TRUST_PROXY:'1',AVS_NO_LISTEN:'1'});
const {pool}=await import('../database/pg_pool.js');
const {verifySchema}=await import('../database/migrate.js');
const {app}=await import('../index.js');
const backend=app.listen(5001,'127.0.0.1');await new Promise(resolve=>backend.once('listening',resolve));
const ca=await readFile(caPath),key=await readFile('.tmp/local-tls/server.key');
const proxy=https.createServer({cert:ca,key},(request,response)=>{
  const upstream=http.request({hostname:'127.0.0.1',port:5001,path:request.url,method:request.method,headers:{...request.headers,'x-forwarded-proto':'https','x-forwarded-for':'127.0.0.1'}},incoming=>{
    response.writeHead(incoming.statusCode,incoming.headers);incoming.pipe(response);
  });
  upstream.on('error',()=>{response.writeHead(502);response.end();});request.pipe(upstream);
});
await new Promise(resolve=>proxy.listen(54439,'127.0.0.1',resolve));
function request(route,{method='GET',cookie='',body=null,csrf='',trusted=ca,host='localhost'}={}) {
  return new Promise((resolve,reject)=>{
    const data=body===null?'':JSON.stringify(body);
    const outgoing=https.request({hostname:host,port:54439,path:route,method,ca:trusted,lookup:(name,options,callback)=>options.all?callback(null,[{address:'127.0.0.1',family:4}]):callback(null,'127.0.0.1',4),headers:{Origin:'https://localhost:54439',Cookie:cookie,'Content-Type':'application/json','Content-Length':Buffer.byteLength(data),'X-CSRF-Token':csrf}},incoming=>{
      let text='';incoming.on('data',chunk=>text+=chunk);incoming.on('end',()=>resolve({status:incoming.statusCode,headers:incoming.headers,body:JSON.parse(text)}));
    });outgoing.on('error',reject);outgoing.end(data);
  });
}
try {
  await verifySchema();
  assert.equal((await pool.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0].ssl,true);
  for(const [connection,certificate,expected] of [[uri.toString(),wrongCa,/certificate|self.signed/i],[fixture.database_url,caPath,/hostname|altnames|IP.*not/i]]) {
    const child=spawnSync(process.execPath,['--input-type=module','-e',"import {pool} from './backend/database/pg_pool.js';try {await pool.query('SELECT 1');process.exitCode=1;}catch(error){console.log(error.message);}finally{await pool.end();}"],{env:{...process.env,DATABASE_URL:connection,PG_SSL_CA:certificate},encoding:'utf8',windowsHide:true});
    assert.equal(child.status,0,child.stderr || 'TLS negative case unexpectedly connected');assert.match(child.stdout,expected);
  }
  assert.equal((await request('/health')).status,200);
  await assert.rejects(request('/health',{trusted:await readFile(wrongCa)}),/certificate|self.signed/i);
  await assert.rejects(request('/health',{host:'127.0.0.1'}),/hostname|altnames|IP.*not/i);
  const token=await request('/api/auth/csrf');
  const firstCookie=token.headers['set-cookie'][0];
  const login=await request('/api/auth/login',{method:'POST',cookie:firstCookie.split(';')[0],csrf:token.body.csrfToken,body:{login_id:fixture.owner,pin:fixture.password}});
  assert.equal(login.status,200);assert.equal(login.body.success,true);
  const session=login.headers['set-cookie'][0];
  for(const flag of ['Secure','HttpOnly','SameSite=Lax'])assert.ok(session.includes(flag));
  assert.notEqual(firstCookie.split(';')[0],session.split(';')[0]);
  assert.equal(login.headers['strict-transport-security'],'max-age=31536000');
  const result={database_tls:'PASS: actual PostgreSQL TLS, trusted CA accepted, wrong CA and hostname rejected',https:'PASS: local trusted test CA, wrong CA and hostname rejected',production_session:'PASS: restricted runtime, regenerated Secure/HttpOnly/SameSite cookie and HSTS',limitations:'Local test certificates only; OVH public DNS/certificate/firewall and Ubuntu Node24/PostgreSQL16 remain NOT VERIFIED'};
  await writeFile('.tmp/local-tls-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} finally {await new Promise(resolve=>proxy.close(resolve));await new Promise(resolve=>backend.close(resolve));await pool.end();}
