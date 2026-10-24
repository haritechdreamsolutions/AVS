import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const shell=process.env.AVS_TEST_SHELL || (process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/bin/sh');
await mkdir('.tmp',{recursive:true});
const folder=await mkdtemp(path.resolve('.tmp/backup-shell-'));
const posix=value=>value.replaceAll('\\','/').replace(/^([A-Za-z]):/,(_,drive)=>'/'+drive.toLowerCase());
const bin=path.join(folder,'bin');await mkdir(bin);
for(const command of ['pg_dump','age','rclone','curl','sleep','date','mktemp','rm']) {
  const body=command==='date'?'case "$1" in +%H) echo 23;; +%u) echo 3;; *) echo synthetic;; esac':
    command==='mktemp'?'echo "$AVS_WORK"':command==='rm'?'exit 0':command==='sleep'?'if [ "$AVS_LOOPS" = 2 ] && [ ! -e "$AVS_SLEEP_MARKER" ]; then : > "$AVS_SLEEP_MARKER"; exit 0; fi; exit 99':
    'printf "%s\\n" "'+command+' $*" >> "$AVS_EVENTS"\n[ "$AVS_FAIL" != "'+command+'" ]';
  await writeFile(path.join(bin,command),'#!/bin/sh\n'+body+'\n',{mode:0o700});
}
for(const failure of ['pg_dump','age','rclone','curl','none']) {
  const events=path.join(folder,failure+'.events');await writeFile(events,'');
  const result=spawnSync(shell,['-c','export PATH="$AVS_STUB_BIN:$PATH"; exec sh deploy/backup.sh'],{
    env:{...process.env,AVS_STUB_BIN:posix(bin),AVS_WORK:posix(folder),AVS_EVENTS:posix(events),AVS_FAIL:failure,AVS_LOOPS:failure==='none'?'2':'1',AVS_SLEEP_MARKER:posix(events+'.slept'),
      BACKUP_RECIPIENT:'synthetic-public-key',BACKUP_REMOTE:'synthetic:bucket',BACKUP_HEARTBEAT_URL:'https://synthetic.invalid/heartbeat'},
    encoding:'utf8',windowsHide:true,timeout:15000
  });
  assert.ifError(result.error);
  const log=await readFile(events,'utf8');
  assert.ok(log.includes('pg_dump'),result.stderr);
  if(failure==='none') {
    assert.equal(result.status,99);
    for(const prefix of ['hourly','daily','weekly'])assert.ok(log.includes('/'+prefix+'/'));
    assert.equal(log.split('/hourly/').length-1,2);
    assert.equal(log.split('/daily/').length-1,1);
    assert.equal(log.split('/weekly/').length-1,1);
    assert.ok(log.includes('https://synthetic.invalid/heartbeat\n'));
    assert.ok(!log.includes('/fail'));
  } else {
    assert.notEqual(result.status,0);
    assert.ok(log.includes('/fail'));
    if(failure!=='curl')assert.ok(!log.includes('https://synthetic.invalid/heartbeat\n'));
    if(failure==='pg_dump')assert.ok(!log.includes('age '));
    if(failure==='age')assert.ok(!log.includes('rclone '));
  }
}
console.log('PASS: dump/encryption/upload/heartbeat failures fail closed; daily/weekly copies and success heartbeat execute only on success (local command stubs, no cloud access)');
