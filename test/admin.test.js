import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './postgres-helper.js';
const password='AdminTestPassword123!';
test('PostgreSQL：管理员与普通用户隔离及竞争更新',async t=>{
 const f=await fixture({servers:2}),call=f.call.bind(f);
 const signup=async(email,name)=>call('/api/auth/register',{method:'POST',body:{email,name,password}});
 const login=async email=>call('/api/auth/login',{method:'POST',body:{email,password}});
 let admin,alice,bob,adminCookie,aliceCookie,bobCookie,registration,feedbackId;
 const body={activity_id:'demo-reading',attendee_name:'测试参加者',phone:'13800000000',privacy_consent:true};
 try{
  await t.test('注册不能注入管理员角色或账号状态',async()=>{
   admin=await signup('admin@example.test','测试管理员');alice=await signup('alice@example.test','测试甲');bob=await signup('bob@example.test','测试乙');
   for(const r of [admin,alice,bob]){assert.equal(r.status,201);assert.equal(r.data.user.role,'user');}
   assert.equal((await f.db.get('SELECT is_active FROM users WHERE id=$1',[alice.data.user.id])).is_active,1);
   await f.db.run("UPDATE users SET role='stuff' WHERE id=$1",[admin.data.user.id]);
   adminCookie=(await login('admin@example.test')).cookie;aliceCookie=alice.cookie;bobCookie=bob.cookie;
  });
  await t.test('所有后台读取、编辑和新增接口检查角色',async()=>{
   for(const route of ['summary','users','registrations','feedbacks','activities','logs']){
    assert.equal((await call('/api/admin/'+route)).status,401);
    assert.equal((await call('/api/admin/'+route,{cookie:aliceCookie})).status,403);
    assert.equal((await call('/api/admin/'+route,{cookie:adminCookie})).status,200);
   }
   for(const route of ['users/'+bob.data.user.id,'registrations/no-id','feedbacks/no-id','activities/demo-reading'])
    assert.equal((await call('/api/admin/'+route,{method:'PATCH',cookie:aliceCookie,body:{status:'cancelled'}})).status,403);
   assert.equal((await call('/api/admin/activities',{method:'POST',cookie:aliceCookie,body:{}})).status,403);
  });
  await t.test('个人资料不可越权，后台不返回密码或会话',async()=>{
   for(const extra of [{role:'stuff'},{id:bob.data.user.id},{is_active:1}])
    assert.equal((await call('/api/profile',{method:'PATCH',cookie:aliceCookie,body:{name:'新称呼',...extra}})).status,400);
   assert.equal((await call('/api/profile',{method:'PATCH',cookie:aliceCookie,body:{name:'新称呼'}})).status,200);
   assert.equal((await call('/api/profile',{cookie:bobCookie})).data.user.name,'测试乙');
   const r=await call('/api/admin/users?q=ALICE&limit=1',{cookie:adminCookie});assert.equal(r.data.total,1);
   assert.equal(r.data.users[0].id,alice.data.user.id);assert.ok(!JSON.stringify(r.data).includes('password'));assert.ok(!JSON.stringify(r.data).includes('token'));
   assert.equal((await call('/api/admin/users?offset=-1',{cookie:adminCookie})).status,400);
  });
  await t.test('用户资料编辑、重复邮箱和自身管理员保护',async()=>{
   const path='/api/admin/users/'+alice.data.user.id;
   assert.equal((await call(path,{method:'PATCH',cookie:adminCookie,body:{name:'已修正'}})).status,200);
   assert.equal((await call('/api/profile',{cookie:aliceCookie})).data.user.name,'已修正');
   assert.equal((await call(path,{method:'PATCH',cookie:adminCookie,body:{email:'BOB@example.test'}})).status,409);
   assert.equal((await call(path,{method:'PATCH',cookie:adminCookie,body:{password_hash:'injected'}})).status,400);
   for(const change of [{role:'user'},{is_active:0}])assert.equal((await call('/api/admin/users/'+admin.data.user.id,{method:'PATCH',cookie:adminCookie,body:change})).status,409);
  });
  await t.test('停用账号撤销跨实例会话，启用后可重新登录',async()=>{
   const path='/api/admin/users/'+bob.data.user.id;
   await call(path,{method:'PATCH',cookie:adminCookie,body:{is_active:0}});
   assert.equal((await call('/api/registrations',{cookie:bobCookie,instance:1})).status,401);
   assert.equal((await login('bob@example.test')).status,403);
   await call(path,{method:'PATCH',cookie:adminCookie,body:{is_active:1}});
   const r=await login('bob@example.test');assert.equal(r.status,200);bobCookie=r.cookie;
  });
  await t.test('授权与降级均撤销原会话，不能复用旧管理权限',async()=>{
   const path='/api/admin/users/'+bob.data.user.id;
   await call(path,{method:'PATCH',cookie:adminCookie,body:{role:'stuff'}});
   assert.equal((await call('/api/admin/users',{cookie:bobCookie})).status,401);
   const r=await login('bob@example.test');assert.equal(r.data.user.role,'stuff');bobCookie=r.cookie;
   assert.equal((await call('/api/admin/users',{cookie:bobCookie})).status,200);
   await call(path,{method:'PATCH',cookie:adminCookie,body:{role:'user'}});
   assert.equal((await call('/api/admin/users',{cookie:bobCookie,instance:1})).status,401);
   bobCookie=(await login('bob@example.test')).cookie;
   assert.equal((await call('/api/admin/users',{cookie:bobCookie})).status,403);
  });
  await t.test('报名资料、取消和恢复仍受名额与重复约束',async()=>{
   let r=await call('/api/registrations',{method:'POST',cookie:aliceCookie,body});assert.equal(r.status,201);registration=r.data.registration;
   const path='/api/admin/registrations/'+registration.id;
   assert.equal((await call(path,{method:'PATCH',cookie:adminCookie,body:{phone:'13900000000',attendee_name:'修正姓名'}})).status,200);
   assert.equal((await call('/api/registrations',{cookie:aliceCookie})).data.registrations[0].phone,'13900000000');
   assert.equal((await call(path,{method:'PATCH',cookie:adminCookie,body:{status:'checked_in'}})).status,409);
   await call(path,{method:'PATCH',cookie:adminCookie,body:{status:'cancelled'}});
   await f.db.run("UPDATE activities SET capacity=1 WHERE id='demo-reading'");
   r=await call('/api/registrations',{method:'POST',cookie:bobCookie,body});assert.equal(r.status,201);
   assert.equal((await call(path,{method:'PATCH',cookie:adminCookie,body:{status:'confirmed'}})).status,409);
   await call('/api/admin/registrations/'+r.data.registration.id,{method:'PATCH',cookie:adminCookie,body:{status:'cancelled'}});
   r=await call('/api/registrations',{method:'POST',cookie:aliceCookie,body});assert.equal(r.status,201);
   assert.equal((await call(path,{method:'PATCH',cookie:adminCookie,body:{status:'confirmed'}})).status,409);registration=r.data.registration;
   assert.equal((await call('/api/admin/registrations?q=alice&status=confirmed',{cookie:adminCookie})).data.total,1);
  });
  await t.test('管理员恢复报名与普通用户争抢末席，共用活动锁',async()=>{
   await call('/api/admin/registrations/'+registration.id,{method:'PATCH',cookie:adminCookie,body:{status:'cancelled'}});
   const results=await Promise.all([
    call('/api/admin/registrations/'+registration.id,{method:'PATCH',cookie:adminCookie,body:{status:'confirmed'}}),
    call('/api/registrations',{method:'POST',cookie:bobCookie,body,instance:1})
   ]);
   assert.equal(results.filter(r=>r.status===200||r.status===201).length,1);
   assert.equal(results.filter(r=>r.status===409).length,1);
   assert.equal((await call('/api/activities/demo-reading')).data.activity.enrolled_count,1);
   if(results[1].status===201){
    await call('/api/admin/registrations/'+results[1].data.registration.id,{method:'PATCH',cookie:adminCookie,body:{status:'cancelled'}});
    assert.equal((await call('/api/admin/registrations/'+registration.id,{method:'PATCH',cookie:adminCookie,body:{status:'confirmed'}})).status,200);
   }
  });
  await t.test('管理员缩减容量与用户报名并发，不出现人数大于容量',async()=>{
   await f.db.run("UPDATE activities SET capacity=2 WHERE id='demo-family'");
   const payload={...body,activity_id:'demo-family'};
   assert.equal((await call('/api/registrations',{method:'POST',cookie:aliceCookie,body:payload})).status,201);
   const results=await Promise.all([
    call('/api/admin/activities/demo-family',{method:'PATCH',cookie:adminCookie,body:{capacity:1}}),
    call('/api/registrations',{method:'POST',cookie:bobCookie,body:payload,instance:1})
   ]);
   assert.equal(results.filter(r=>r.status===200||r.status===201).length,1);
   assert.equal(results.filter(r=>r.status===409).length,1);
   const a=(await call('/api/activities/demo-family')).data.activity;assert.ok(a.enrolled_count<=a.capacity);
  });
  await t.test('反馈归属、管理员回复和本人可见性',async()=>{
   const payload={registration_id:registration.id,rating:4,content:'希望下次活动增加交流时间。'};
   assert.equal((await call('/api/feedbacks',{method:'POST',cookie:aliceCookie,body:payload})).status,403);
   await f.db.run("UPDATE activities SET start_time='2020-01-01T00:00:00Z',end_time='2020-01-01T02:00:00Z' WHERE id='demo-reading'");
   assert.equal((await call('/api/feedbacks',{method:'POST',cookie:aliceCookie,body:payload})).status,201);
   const mine=(await call('/api/feedbacks',{cookie:aliceCookie})).data.feedbacks;assert.equal(mine.length,1);feedbackId=mine[0].id;
   assert.equal((await call('/api/feedbacks?user_id='+alice.data.user.id,{cookie:bobCookie})).data.feedbacks.length,0);
   const path='/api/admin/feedbacks/'+feedbackId;
   assert.equal((await call(path,{method:'PATCH',cookie:adminCookie,body:{status:'replied',reply:''}})).status,400);
   assert.equal((await call(path,{method:'PATCH',cookie:adminCookie,body:{status:'replied',reply:'已记录建议，下次增加交流时间。'}})).status,200);
   const current=(await call('/api/feedbacks',{cookie:aliceCookie})).data.feedbacks[0];assert.equal(current.status,'replied');assert.match(current.reply,/增加/);
   assert.equal((await call('/api/feedbacks',{cookie:bobCookie})).data.feedbacks.length,0);
   assert.equal((await call('/api/admin/feedbacks?status=replied',{cookie:adminCookie})).data.total,1);
   assert.equal((await call('/api/admin/registrations/'+registration.id,{method:'PATCH',cookie:adminCookie,body:{status:'checked_in'}})).status,200);
  });
  await t.test('活动创建与编辑、下线、操作日志',async()=>{
   const start=new Date(Date.now()+86400000).toISOString(),end=new Date(Date.now()+90000000).toISOString();
   const body={title:'新的测试活动',category:'读书会',description:'验证 PostgreSQL 后台创建活动。',location:'本地测试',start_time:start,end_time:end,capacity:10,fee_cents:0,publish_status:'published'};
   const create=fields=>call('/api/admin/activities',{method:'POST',cookie:adminCookie,body:{...body,...fields}});
   const created=await create({});
   assert.equal(created.status,201);
   const id=created.data.id;
   const read=async()=> (await call('/api/activities/'+id)).data.activity;
   const patch=body=>call('/api/admin/activities/'+id,{method:'PATCH',cookie:adminCookie,body});
   assert.equal((await read()).registration_closes_at,start);
   assert.equal((await patch({registration_until_end:'false'})).status,400);
   assert.equal((await patch({registration_until_end:true})).status,200);
   assert.equal((await read()).registration_closes_at,end);
   const optedIn=await create({registration_until_end:true});
   assert.equal(optedIn.status,201);
   assert.equal((await call('/api/activities/'+optedIn.data.id)).data.activity.registration_closes_at,end);
   assert.equal((await patch({title:'已修改的活动',publish_status:'offline'})).status,200);
   assert.equal((await call('/api/activities/'+id)).status,404);
   assert.equal((await f.db.get('SELECT registration_until_end FROM activities WHERE id=$1',[id])).registration_until_end,true);
   const logs=(await call('/api/admin/logs',{cookie:adminCookie})).data.logs;
   for(const action of ['update_user','update_registration','update_feedback','update_activity','create_activity'])assert.ok(logs.some(l=>l.action===action));
   assert.ok(!JSON.stringify(logs).includes('password'));
  });
  await t.test('两个管理员并发互相降级，不能清空管理员组',async()=>{
   await call('/api/admin/users/'+bob.data.user.id,{method:'PATCH',cookie:adminCookie,body:{role:'stuff'}});
   const other=(await login('bob@example.test')).cookie;
   const results=await Promise.all([
    call('/api/admin/users/'+bob.data.user.id,{method:'PATCH',cookie:adminCookie,body:{role:'user'}}),
    call('/api/admin/users/'+admin.data.user.id,{method:'PATCH',cookie:other,body:{role:'user'},instance:1})
   ]);
   assert.equal(results.filter(r=>r.status===200).length,1);
   assert.equal(results.filter(r=>[401,403].includes(r.status)).length,1);
   assert.equal((await f.db.get("SELECT COUNT(*)::integer AS n FROM users WHERE role='stuff' AND is_active=1")).n,1);
  });
 }finally{await f.close();}
});
