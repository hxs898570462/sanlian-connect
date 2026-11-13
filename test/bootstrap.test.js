import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {projectRoot} from '../server/db.js';
import {hashPassword,verifyPassword} from '../server/auth.js';
import {fixture} from './postgres-helper.js';
test('PostgreSQL 管理员脚本：创建、授权、保留密码并撤销会话',async()=>{
 const f=await fixture({seed:false,servers:0}),password='f9Q3kn';
 async function run(args,answers){
  return new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['scripts/create-admin.js',...args],{cwd:projectRoot,env:{...process.env,DATABASE_URL:f.url,SEED_DEMO:'false'},stdio:['pipe','pipe','pipe'],windowsHide:true});
   let out='',err='',index=0;const timer=setTimeout(()=>{child.kill();reject(Error('脚本输入超时'));},15000);
   child.on('error',error=>{clearTimeout(timer);reject(error);});
   child.stdout.on('data',chunk=>{out+=chunk.toString();while(index<answers.length&&out.includes(answers[index][0]))child.stdin.write(answers[index++][1]+'\n');});
   child.stderr.on('data',chunk=>err+=chunk.toString());
   child.on('close',code=>{clearTimeout(timer);resolve({code,out,err});});
  });
 }
 try{
  let r=await run([],[['新管理员邮箱','new-admin@example.test'],['设置密码',password],['再次输入密码',password]]);
  assert.equal(r.code,0,r.err);assert.match(r.out,/6–128/);assert.ok(!r.out.includes(password));
  const admin=await f.db.get("SELECT * FROM users WHERE email='new-admin@example.test'");assert.equal(admin.role,'stuff');assert.ok(await verifyPassword(password,admin.password_hash));
  const hash=await hashPassword(password);
  await f.db.run("INSERT INTO users(id,email,name,password_hash,created_at) VALUES('existing','existing@example.test','已有读者',$1,$2)",[hash,new Date().toISOString()]);
  await f.db.run("INSERT INTO sessions VALUES('old-session','existing',9999999999999)");
  r=await run(['--promote'],[['需要设为 stuff','existing@example.test']]);assert.equal(r.code,0,r.err);
  const current=await f.db.get("SELECT * FROM users WHERE id='existing'");assert.equal(current.role,'stuff');assert.equal(current.password_hash,hash);
  assert.equal((await f.db.get("SELECT COUNT(*)::integer AS n FROM sessions WHERE user_id='existing'")).n,0);
  assert.equal((await f.db.get("SELECT action FROM operation_logs WHERE target_id='existing'")).action,'bootstrap_administrator');
 }finally{await f.close();}
});
