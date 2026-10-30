import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './postgres-helper.js';
const password='TestPassword123!';
test('PostgreSQL：前后端、并发报名、隔离、持久性',async t=>{
 const f=await fixture({servers:2}),call=f.call.bind(f);
 let alice,bob,registration;
 const payload={activity_id:'demo-reading',attendee_name:'测试读者',phone:'13800000000',privacy_consent:true,user_id:'forged'};
 const signup=async(email,instance=0)=>call('/api/auth/register',{method:'POST',instance,body:{email,name:'测试读者',password,role:'stuff'}});
 try {
  await t.test('连接的是真实 PostgreSQL，页面与数据库健康检查可用',async()=>{
   assert.match((await f.db.get('SELECT version() AS version')).version,/PostgreSQL/);
   assert.equal((await call('/api/health')).data.storage,'postgresql');
   const page=await fetch(f.base());assert.equal(page.status,200);assert.match(await page.text(),/Sanlian Connect/);assert.ok(page.headers.get('content-security-policy'));
  });
  await t.test('日期筛选与草稿隐藏',async()=>{
   const r=await call('/api/activities');assert.equal(r.data.activities.length,3);
   assert.equal((await call('/api/activities?days=180')).data.activities.length,4);
   assert.equal((await call('/api/activities?days=invalid')).status,400);
   assert.equal((await call('/api/activities/demo-draft')).status,404);
  });
  await t.test('注册默认user，密码哈希与跨实例会话',async()=>{
   alice=await signup('alice@example.test');bob=await signup('bob@example.test',1);
   assert.equal(alice.status,201);assert.equal(alice.data.user.role,'user');assert.equal(bob.status,201);
   assert.match(alice.setCookie,/HttpOnly/i);assert.match(alice.setCookie,/SameSite=Lax/i);
   assert.notEqual((await f.db.get('SELECT password_hash FROM users WHERE id=$1',[alice.data.user.id])).password_hash,password);
   assert.equal((await call('/api/auth/me',{cookie:alice.cookie,instance:1})).data.user.id,alice.data.user.id);
   assert.equal((await signup('ALICE@example.test')).status,409);
   assert.equal((await call('/api/auth/login',{method:'POST',body:{email:'alice@example.test',password:'WrongPassword123!'}})).status,401);
  });
  await t.test('匿名、跨站和缺少同意的写入被拒绝',async()=>{
   assert.equal((await call('/api/registrations',{method:'POST',body:payload})).status,401);
   assert.equal((await call('/api/registrations',{method:'POST',body:payload,cookie:alice.cookie,headers:{Origin:'https://example.test'}})).status,403);
   assert.equal((await call('/api/registrations',{method:'POST',body:payload,cookie:alice.cookie,headers:{'X-Requested-With':''}})).status,403);
   assert.equal((await call('/api/registrations',{method:'POST',body:{...payload,privacy_consent:false},cookie:alice.cookie})).status,400);
  });
  await t.test('报名归属取自会话、重复和满员检查',async()=>{
   await f.db.run("UPDATE activities SET capacity=1 WHERE id='demo-reading'");
   const r=await call('/api/registrations',{method:'POST',body:payload,cookie:alice.cookie});assert.equal(r.status,201);registration=r.data.registration;
   assert.equal((await f.db.get('SELECT user_id FROM registrations WHERE id=$1',[registration.id])).user_id,alice.data.user.id);
   assert.equal((await call('/api/registrations',{method:'POST',body:payload,cookie:alice.cookie,instance:1})).status,409);
   assert.equal((await call('/api/registrations',{method:'POST',body:payload,cookie:bob.cookie})).status,409);
  });
  await t.test('跨账号读写隔离，姓名不从本人列表返回',async()=>{
   assert.equal((await call('/api/registrations?user_id='+alice.data.user.id,{cookie:bob.cookie})).data.registrations.length,0);
   assert.equal((await call('/api/registrations/'+registration.id+'/cancel',{method:'POST',body:{},cookie:bob.cookie})).status,404);
   const rows=(await call('/api/registrations',{cookie:alice.cookie})).data.registrations;assert.equal(rows.length,1);assert.ok(!('attendee_name' in rows[0]));
  });
  await t.test('连接池与两个服务重启后记录和会话保留',async()=>{
   await f.restart();
   assert.equal((await call('/api/registrations',{cookie:alice.cookie,instance:1})).data.registrations[0].id,registration.id);
  });
  await t.test('取消释放名额，重新报名可用',async()=>{
   assert.equal((await call('/api/registrations/'+registration.id+'/cancel',{method:'POST',body:{},cookie:alice.cookie})).status,200);
   assert.equal((await call('/api/activities/demo-reading')).data.activity.enrolled_count,0);
   const r=await call('/api/registrations',{method:'POST',body:payload,cookie:alice.cookie});assert.equal(r.status,201);registration=r.data.registration;
  });
  await t.test('24个不同账号跨两个服务争抢最后一席，严格一笔成功',async()=>{
   const racers=[];
   for(let i=0;i<24;i++){const r=await signup('racer'+i+'@example.test',i%2);assert.equal(r.status,201);racers.push(r.cookie);}
   await f.db.run("UPDATE activities SET capacity=1 WHERE id='demo-family'");
   const results=await Promise.all(racers.map((cookie,i)=>call('/api/registrations',{method:'POST',body:{...payload,activity_id:'demo-family'},cookie,instance:i%2})));
   assert.equal(results.filter(r=>r.status===201).length,1);
   assert.equal(results.filter(r=>r.status===409).length,23);
   assert.equal((await call('/api/activities/demo-family')).data.activity.enrolled_count,1);
  });
  await t.test('同一账号12个并发请求也只能产生一条有效报名',async()=>{
   const results=await Promise.all(Array.from({length:12},(_,i)=>call('/api/registrations',{method:'POST',body:{...payload,activity_id:'demo-literature'},cookie:alice.cookie,instance:i%2})));
   assert.equal(results.filter(r=>r.status===201).length,1);assert.equal(results.filter(r=>r.status===409).length,11);
   assert.equal((await call('/api/activities/demo-literature')).data.activity.enrolled_count,1);
  });
  await t.test('反馈资格、归属与并发去重',async()=>{
   const body={registration_id:registration.id,rating:5,content:'测试反馈：安排清晰，感谢组织。'};
   assert.equal((await call('/api/feedbacks',{method:'POST',body,cookie:alice.cookie})).status,403);
   await f.db.run("UPDATE activities SET start_time='2020-01-01T00:00:00Z',end_time='2020-01-01T02:00:00Z' WHERE id='demo-reading'");
   assert.equal((await call('/api/feedbacks',{method:'POST',body,cookie:bob.cookie})).status,403);
   const results=await Promise.all([0,1].map(instance=>call('/api/feedbacks',{method:'POST',body,cookie:alice.cookie,instance})));
   assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
   assert.equal((await call('/api/feedbacks',{cookie:bob.cookie})).data.feedbacks.length,0);
  });
  await t.test('退出后其他实例也拒绝原会话',async()=>{
   await call('/api/auth/logout',{method:'POST',body:{},cookie:alice.cookie});
   assert.equal((await call('/api/registrations',{cookie:alice.cookie,instance:1})).status,401);
  });
 }finally{await f.close();}
});
