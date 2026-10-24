import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';

const fixture=JSON.parse(await readFile('.tmp/local-preview.json','utf8'));
if(!/^postgresql:\/\/avs_test_admin@127\.0\.0\.1:55439\/avs_hardening_preview[a-z0-9_]*$/.test(fixture.admin_url))throw new Error('Explicit isolated preview required');
const admin=new pg.Pool({connectionString:fixture.admin_url,max:1});
const backup='avs_preview_dump_'+Date.now(),runtime=new URL(fixture.database_url).username;
try {
  await admin.query('CREATE ROLE '+backup+' LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION');
  const grants=(await readFile(new URL('../database/runtime-grants.sql',import.meta.url),'utf8')).replaceAll('avs_runtime',runtime).replaceAll('avs_backup',backup).replaceAll('avs_agencies_db',new URL(fixture.admin_url).pathname.slice(1));
  await admin.query(grants);
  const permissions=(await admin.query("SELECT has_table_privilege($1,'sales','SELECT') AS read_sales,has_table_privilege($1,'receipts','INSERT') AS insert_receipt,has_table_privilege($1,'sales','UPDATE') AS update_sale,has_schema_privilege($1,'public','CREATE') AS ddl,pg_has_role($1,'pg_read_all_data','MEMBER') AS cluster_read_all,has_sequence_privilege($1,'invoice_number_sequence','SELECT') AS read_sequence,has_sequence_privilege($1,'invoice_number_sequence','USAGE') AS change_sequence",[backup])).rows[0];
  assert.deepEqual(permissions,{read_sales:true,insert_receipt:false,update_sale:false,ddl:false,cluster_read_all:false,read_sequence:true,change_sequence:false});
  const uri=new URL(fixture.admin_url);uri.hostname='localhost';uri.username=backup;
  const dump=path.resolve('.tmp/local-backup-role.dump');
  const result=spawnSync('C:/Program Files/PostgreSQL/18/bin/pg_dump.exe',['--dbname',uri.toString(),'--format=custom','--no-owner','--no-acl','--exclude-table-data=public.session','--file',dump],{env:{...process.env,PGSSLMODE:'verify-full',PGSSLROOTCERT:path.resolve('.tmp/local-tls/server.crt')},encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stderr);assert.ok((await stat(dump)).size>1000);
  console.log('PASS: database-scoped read-only backup role creates a real pg_dump over verified TLS; DML, DDL, sequence mutation and cluster-wide read role are denied');
} finally {await admin.end();}
