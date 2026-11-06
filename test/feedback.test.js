import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './postgres-helper.js';

test('活动反馈：签到即可填写、资格与权限隔离、管理员查看回复',async t=>{
 const f=await fixture({servers:2}),call=f.call.bind(f);
 const password='FeedbackTestOnly2026!';
 const signup=(email,name)=>call('/api/auth/register',{method:'POST',body:{email,name,password}});
 const manager=await signup('feedback-manager@example.test','反馈测试管理员');
 const alice=await signup('feedback-alice@example.test','反馈测试甲');
 const bob=await signup('feedback-bob@example.test','反馈测试乙');
 await f.db.run("UPDATE users SET role='stuff' WHERE id=$1",[manager.data.user.id]);
 const managerCookie=(await call('/api/auth/login',{method:'POST',body:{email:'feedback-manager@example.test',password}})).cookie;
 const register=async(activity_id,cookie)=>{
  const r=await call('/api/registrations',{method:'POST',cookie,body:{activity_id,attendee_name:'反馈测试读者',phone:'13800000000',privacy_consent:true}});
  assert.equal(r.status,201);return r.data.registration;
 };
 let reading,family,cancelled,bobReading,feedbackId;
 const payload=(id,content='签到后的活动反馈：内容丰富，期待下一次。')=>({registration_id:id,rating:5,content});
 try{
  reading=await register('demo-reading',alice.cookie);family=await register('demo-family',alice.cookie);
  cancelled=await register('demo-literature',alice.cookie);bobReading=await register('demo-reading',bob.cookie);
  assert.equal((await call(`/api/registrations/${cancelled.id}/cancel`,{method:'POST',cookie:alice.cookie,body:{}})).status,200);
  const now=Date.now();
  await f.db.run('UPDATE activities SET start_time=$1,end_time=$2 WHERE id IN ($3,$4)',[new Date(now-3600000).toISOString(),new Date(now+3600000).toISOString(),'demo-reading','demo-family']);
  assert.equal((await call(`/api/admin/registrations/${reading.id}`,{method:'PATCH',cookie:managerCookie,body:{status:'checked_in'}})).status,200);

  await t.test('已签到且仍在进行的活动可反馈，未签到及取消报名显示不可填写',async()=>{
   const rows=(await call('/api/registrations',{cookie:alice.cookie})).data.registrations;
   assert.equal(rows.find(r=>r.id===reading.id).can_feedback,true);
   assert.equal(rows.find(r=>r.id===reading.id).feedback_state,'available');
   assert.equal(rows.find(r=>r.id===family.id).feedback_state,'waiting');
   assert.equal(rows.find(r=>r.id===cancelled.id).feedback_state,'cancelled');
   const other=(await call('/api/registrations',{cookie:bob.cookie})).data.registrations;
   assert.deepEqual(other.map(r=>r.id),[bobReading.id]);assert.equal(other[0].can_feedback,false);
   assert.equal((await call('/api/registrations')).status,401);
  });
  await t.test('已签到用户无需等待活动结束即可提交，入口随后变为已提交',async()=>{
   const r=await call('/api/feedbacks',{method:'POST',cookie:alice.cookie,body:payload(reading.id)});assert.equal(r.status,201);
   const row=(await call('/api/registrations',{cookie:alice.cookie})).data.registrations.find(r=>r.id===reading.id);
   assert.equal(row.has_feedback,true);assert.equal(row.can_feedback,false);assert.equal(row.feedback_state,'submitted');
   const mine=(await call('/api/feedbacks',{cookie:alice.cookie})).data.feedbacks;
   assert.equal(mine.length,1);feedbackId=mine[0].id;assert.equal(mine[0].registration_id,reading.id);
  });
  await t.test('匿名、冒用报名、已取消和未签到未结束均不能提交',async()=>{
   assert.equal((await call('/api/feedbacks',{method:'POST',body:payload(reading.id)})).status,401);
   assert.equal((await call('/api/feedbacks',{method:'POST',cookie:bob.cookie,body:payload(reading.id)})).status,403);
   assert.equal((await call('/api/feedbacks',{method:'POST',cookie:alice.cookie,body:payload(cancelled.id)})).status,403);
   assert.equal((await call('/api/feedbacks',{method:'POST',cookie:bob.cookie,body:{...payload(bobReading.id),status:'checked_in',user_id:alice.data.user.id}})).status,403);
   assert.equal((await call('/api/feedbacks',{cookie:bob.cookie})).data.feedbacks.length,0);
  });
  await t.test('签到后跨两个服务并发提交，只产生一条反馈',async()=>{
   assert.equal((await call(`/api/admin/registrations/${family.id}`,{method:'PATCH',cookie:managerCookie,body:{status:'checked_in'}})).status,200);
   const results=await Promise.all([0,1].map(instance=>call('/api/feedbacks',{method:'POST',instance,cookie:alice.cookie,body:payload(family.id)})));
   assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
   assert.equal((await f.db.get('SELECT COUNT(*)::integer AS n FROM feedbacks WHERE registration_id=$1',[family.id])).n,1);
  });
  await t.test('管理员可看活动、提交者、评分和原文，普通用户不能查看后台',async()=>{
   assert.equal((await call('/api/admin/feedbacks',{cookie:alice.cookie})).status,403);
   const r=await call('/api/admin/feedbacks?q=反馈测试甲',{cookie:managerCookie});
   // Search by content, email or event title; query the unique email explicitly.
   const listed=await call('/api/admin/feedbacks?q=feedback-alice',{cookie:managerCookie});
   assert.equal(listed.status,200);assert.equal(listed.data.total,2);
   const item=listed.data.feedbacks.find(f=>f.id===feedbackId);
   assert.equal(item.user_name,'反馈测试甲');assert.equal(item.rating,5);assert.match(item.content,/签到后/);assert.ok(item.title);
   assert.equal(r.status,200);
  });
  await t.test('管理员回复后仅提交者可见，用户不能伪造处理状态',async()=>{
   assert.equal((await call(`/api/admin/feedbacks/${feedbackId}`,{method:'PATCH',cookie:managerCookie,body:{status:'replied',reply:'感谢反馈，我们会安排更多读书活动。'}})).status,200);
   const item=(await call('/api/feedbacks',{cookie:alice.cookie})).data.feedbacks.find(f=>f.id===feedbackId);
   assert.equal(item.status,'replied');assert.match(item.reply,/感谢反馈/);
   assert.equal((await call('/api/feedbacks',{cookie:bob.cookie})).data.feedbacks.length,0);
   assert.equal((await call(`/api/admin/feedbacks/${feedbackId}`,{method:'PATCH',cookie:alice.cookie,body:{status:'closed'}})).status,403);
  });
  await t.test('未签到但活动已结束的有效报名保留反馈资格，重复提交被拒绝',async()=>{
   await f.db.run('UPDATE activities SET end_time=$1 WHERE id=$2',[new Date(now-60000).toISOString(),'demo-reading']);
   const row=(await call('/api/registrations',{cookie:bob.cookie})).data.registrations[0];assert.equal(row.can_feedback,true);
   assert.equal((await call('/api/feedbacks',{method:'POST',cookie:bob.cookie,body:payload(bobReading.id)})).status,201);
   assert.equal((await call('/api/feedbacks',{method:'POST',cookie:bob.cookie,body:payload(bobReading.id)})).status,409);
   assert.equal((await call('/api/feedbacks',{method:'POST',cookie:alice.cookie,body:payload(reading.id)})).status,409);
  });
 }finally{await f.close();}
});
