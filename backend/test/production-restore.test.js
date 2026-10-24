import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import pg from 'pg';

const uri=process.env.AVS_TEST_DATABASE_URL;
if(!uri || !/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_[a-z0-9_]+$/.test(uri))throw new Error('Explicit isolated test database required');
const tools=process.env.AVS_PG_BIN || 'C:\\Program Files\\PostgreSQL\\18\\bin';
const age=process.env.AVS_AGE_BIN || path.resolve('.tmp/age-v1.3.2/age');
const extension=process.platform==='win32'?'.exe':'';
const folder=path.resolve('.tmp','restore-'+Date.now());await mkdir(folder,{recursive:true});
function run(executable,args) {
  const result=spawnSync(executable,args,{encoding:'utf8',windowsHide:true});
  if(result.error || result.status!==0)throw new Error(path.basename(executable)+' failed: '+(result.error?.message || 'exit '+result.status));
  return result.stdout.trim();
}
const pgtool=name=>path.join(tools,name+extension),agetool=name=>path.join(age,name+extension);
const source=new pg.Pool({connectionString:uri,max:1});
const restoreName='avs_hardening_restore_'+Date.now(),destination=uri.replace(/\/avs_hardening_[a-z0-9_]+$/,'/'+restoreName);
let restored;
try {
  const before=(await source.query("SELECT (SELECT COUNT(*) FROM sales)::text AS invoices,(SELECT COALESCE(SUM(total_amount),0) FROM sales)::text AS total,(SELECT COALESCE(SUM(current_due),0) FROM shops)::text AS due,(SELECT COALESCE(SUM(amount),0) FROM receipts)::text AS receipts,(SELECT COALESCE(SUM(amount),0) FROM payment_reversals)::text AS refunds,(SELECT COALESCE(SUM(warehouse_stock_units),0) FROM products)::text AS warehouse")).rows[0];
  const started=performance.now();
  run(agetool('age-keygen'),['-o',path.join(folder,'identity')]);
  const recipient=run(agetool('age-keygen'),['-y',path.join(folder,'identity')]);
  run(pgtool('pg_dump'),['--dbname',uri,'--format=custom','--no-owner','--no-acl','--exclude-table-data=public.session','--file',path.join(folder,'source.dump')]);
  run(agetool('age'),['-r',recipient,'-o',path.join(folder,'encrypted.dump.age'),path.join(folder,'source.dump')]);
  const ciphertext=await readFile(path.join(folder,'encrypted.dump.age'));
  assert.notEqual(ciphertext.subarray(0,5).toString(),'PGDMP');
  run(agetool('age'),['-d','-i',path.join(folder,'identity'),'-o',path.join(folder,'restored.dump'),path.join(folder,'encrypted.dump.age')]);
  assert.deepEqual(await readFile(path.join(folder,'restored.dump')),await readFile(path.join(folder,'source.dump')));
  await source.query('CREATE DATABASE '+restoreName);
  run(pgtool('pg_restore'),['--dbname',destination,'--no-owner','--no-acl','--exit-on-error',path.join(folder,'restored.dump')]);
  restored=new pg.Pool({connectionString:destination,max:1});
  const after=(await restored.query("SELECT (SELECT COUNT(*) FROM sales)::text AS invoices,(SELECT COALESCE(SUM(total_amount),0) FROM sales)::text AS total,(SELECT COALESCE(SUM(current_due),0) FROM shops)::text AS due,(SELECT COALESCE(SUM(amount),0) FROM receipts)::text AS receipts,(SELECT COALESCE(SUM(amount),0) FROM payment_reversals)::text AS refunds,(SELECT COALESCE(SUM(warehouse_stock_units),0) FROM products)::text AS warehouse")).rows[0];
  assert.deepEqual(after,before);
  assert.equal((await restored.query('SELECT COUNT(*)::int AS count FROM session')).rows[0].count,0);
  ciphertext[ciphertext.length-20]^=1;await writeFile(path.join(folder,'tampered.age'),ciphertext);
  const invalid=spawnSync(agetool('age'),['-d','-i',path.join(folder,'identity'),'-o',path.join(folder,'rejected.dump'),path.join(folder,'tampered.age')],{encoding:'utf8',windowsHide:true});
  assert.notEqual(invalid.status,0);
  console.log(JSON.stringify({status:'PASS',encrypted_restore_ms:performance.now()-started,invoices:Number(before.invoices),financial_totals_match:true,stock_totals_match:true,active_sessions_restored:0,corrupted_ciphertext_rejected:true}));
} finally { if(restored)await restored.end();await source.end(); }
