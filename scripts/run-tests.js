import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve,basename} from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {postgresRuntime,freePort} from './postgres-runtime.js';

let runtime,directory;
try {
 let url=process.env.TEST_DATABASE_URL;
 if(!url){
  directory=mkdtempSync(join(tmpdir(),'sanlian-pg-tests-'));
  const port=await freePort(),password=randomBytes(24).toString('hex');
  runtime=postgresRuntime({directory,password,port});
  await runtime.initialise();await runtime.start();
  url=`postgresql://postgres:${password}@127.0.0.1:${port}/postgres`;
 }
 const child=spawn(process.execPath,['--test','--test-concurrency=1','test/integration.test.js','test/admin.test.js','test/bootstrap.test.js','test/migration.test.js','test/deployment.test.js','test/postgres-transfer.test.js','test/account-settings.test.js','test/feedback.test.js','test/suggestions.test.js','test/feedback-scoring.test.js','test/admin-frontend.test.js','test/assistant.test.js','test/feature-integration.test.js','test/delete-race.test.js','test/seat-reservations.test.js'],{
  stdio:'inherit',windowsHide:true,env:{...process.env,TEST_DATABASE_URL:url}
 });
 process.exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve(code??1));});
} catch(error){console.error('PostgreSQL 测试启动失败：',error?.message||'数据库服务未就绪');process.exitCode=1;}
finally{
 if(runtime)await runtime.stop();
 if(directory){
  assert.equal(resolve(dirname(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('sanlian-pg-tests-'));
  // Windows may release PostgreSQL handles shortly after process exit.
  rmSync(directory,{recursive:true,force:true,maxRetries:20,retryDelay:100});
 }
}
