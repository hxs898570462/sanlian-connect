import {createInterface} from 'node:readline';
import {Writable} from 'node:stream';
import {randomUUID} from 'node:crypto';
import {openDatabase} from '../server/db.js';
import {hashPassword} from '../server/auth.js';
const output=new Writable({write(chunk,encoding,callback){callback();}});
const rl=createInterface({input:process.stdin,output,terminal:!!process.stdin.isTTY});
async function ask(prompt){process.stdout.write(prompt);return new Promise(resolve=>rl.question('',value=>{process.stdout.write('\n');resolve(value);}));}
let db;
try {
 const promote=process.argv.includes('--promote');
 const email=(await ask(promote?'需要设为 stuff 的现有账号邮箱（输入隐藏）: ':'新管理员邮箱（输入隐藏）: ')).trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('邮箱格式不正确');
 let hash;
 if(!promote){
  const password=await ask('设置密码，12–128 个字符（输入隐藏）: '),confirm=await ask('再次输入密码（输入隐藏）: ');
  if(password.length<12||password.length>128||password!==confirm)throw Error('密码长度或两次输入不符合要求');
  hash=await hashPassword(password);
 }
 db=await openDatabase();
 await db.transaction(async tx=>{
  await tx.query('SELECT pg_advisory_xact_lock(20261030,2)');
  const existing=await tx.get('SELECT id FROM users WHERE lower(email)=lower($1) FOR UPDATE',[email]);
  if(promote){
   if(!existing)throw Error('账号不存在，请先注册，或使用创建管理员模式');
   await tx.run("UPDATE users SET role='stuff',is_active=1 WHERE id=$1",[existing.id]);
   await tx.run('DELETE FROM sessions WHERE user_id=$1',[existing.id]);
   await tx.run('INSERT INTO operation_logs VALUES($1,$2,$3,$4,$5)',[randomUUID(),existing.id,'bootstrap_administrator',existing.id,new Date().toISOString()]);
  }else{
   if(existing)throw Error('该邮箱已存在；授权现有账号请使用 --promote');
   const id=randomUUID();
   await tx.run("INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES($1,$2,$3,$4,'stuff',$5)",[id,email,'门店管理员',hash,new Date().toISOString()]);
   await tx.run('INSERT INTO operation_logs VALUES($1,$2,$3,$4,$5)',[randomUUID(),id,'bootstrap_administrator',id,new Date().toISOString()]);
  }
 });
 console.log(promote?'该账号已设为 stuff 管理员，请重新登录。':'stuff 管理员账号已创建，可在网页登录。');
}catch(error){console.error(error.code?'管理员操作失败：'+error.code:error.message);process.exitCode=1;}
finally{if(db)await db.close();rl.close();}
