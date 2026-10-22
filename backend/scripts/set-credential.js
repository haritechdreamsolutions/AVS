import { readFile } from 'node:fs/promises';
import bcrypt from 'bcrypt';
import { pool } from '../database/pg_pool.js';
import { credential } from '../financial.js';

if (!process.argv.includes('--apply-reviewed') || !process.env.AVS_CREDENTIAL_FILE) throw new Error('Explicit approval flag and a restricted credential file are required');
const client=await pool.connect();
try {
  const data=JSON.parse(await readFile(process.env.AVS_CREDENTIAL_FILE,'utf8'));
  if (!['OWNER','STORE_KEEPER','EMPLOYEE','DRIVER'].includes(data.role) || !String(data.login_id || '').trim()) throw new Error('Invalid credential specification');
  const secret=credential(data.password,data.role);
  const hash=await bcrypt.hash(secret,12);
  const kind=['OWNER','STORE_KEEPER'].includes(data.role)?'password':'pin';
  await client.query('BEGIN');
  let companyId=data.company_id;
  if(data.create_company){
    if(data.role!=='OWNER' || data.create!==true || typeof data.company_name!=='string' || !data.company_name.trim())throw new Error('Explicit company creation requires an OWNER and company_name');
    companyId=(await client.query('INSERT INTO companies(name) VALUES($1) RETURNING id',[data.company_name.trim()])).rows[0].id;
  }
  if(!Number.isSafeInteger(companyId))throw new Error('company_id required');
  if(data.create===true){
    if(!['OWNER','STORE_KEEPER'].includes(data.role))throw new Error('Create drivers through the employee workflow');
    await client.query("INSERT INTO user_accounts(company_id,role_id,login_id,name,pin_hash,credential_kind) VALUES($1,(SELECT id FROM roles WHERE role_name=$2),$3,$4,$5,$6)",[companyId,data.role,data.login_id,data.name || data.login_id,hash,kind]);
  } else {
    const result=await client.query('UPDATE user_accounts SET pin_hash=$1,credential_kind=$2 WHERE company_id=$3 AND login_id=$4 AND role_id=(SELECT id FROM roles WHERE role_name=$5) RETURNING id',[hash,kind,companyId,data.login_id,data.role]);
    if(!result.rows.length)throw new Error('No matching account; no account was changed');
  }
  await client.query('COMMIT');
  console.log('Reviewed credential operation completed. Existing account status was preserved.');
} catch(error){await client.query('ROLLBACK');throw error;}
finally{client.release();await pool.end();}

