import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {fixture} from './postgres-helper.js';

// 回归：删除与管理员回复的竞态。旧实现「先 SELECT reply 再 DELETE」两步之间，
// 管理员一旦提交回复，已回复记录仍会被删掉。修复为事务内 FOR UPDATE 行锁原子判定
// （见 server/app.js 两个 DELETE 路由）。这里用顾问锁 + 更新触发器把
// 「管理员已持行锁、回复即将提交，用户删除同时打进来」的时序固定下来，确定性复现。
const LOCK=778899;
const waitFor=async(predicate,message,timeout=8000)=>{
 const start=Date.now();
 for(;;){
  if(await predicate())return;
  if(Date.now()-start>timeout)throw new Error('等待超时：'+message);
  await new Promise(r=>setTimeout(r,25));
 }
};
// 让管理员的回复阻塞在提交前：触发器里抢一个由测试持有的会话级顾问锁。
async function race(f,call,{table,kind,id,aliceCookie,adminCookie}){
 const blocker=new pg.Client({connectionString:f.url});
 await blocker.connect();
 try{
  await blocker.query('SELECT pg_advisory_lock($1)',[LOCK]);
  await f.db.run(`CREATE OR REPLACE FUNCTION block_${kind}_reply() RETURNS trigger AS $$ BEGIN PERFORM pg_advisory_xact_lock(${LOCK}); RETURN NEW; END $$ LANGUAGE plpgsql`);
  await f.db.run(`CREATE TRIGGER block_${kind}_reply BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION block_${kind}_reply()`);
  // 管理员回复：阻塞在触发器中，事务已 FOR UPDATE 持有该行但尚未提交。
  const replyP=call(`/api/admin/${kind}/${id}`,{method:'PATCH',cookie:adminCookie,body:{status:'replied',reply:'感谢反馈，我们会尽快安排。'}});
  await waitFor(()=>f.db.get('SELECT COUNT(*)::integer AS n FROM pg_locks WHERE locktype=$1 AND objid=$2 AND granted=false',['advisory',LOCK]).then(r=>r.n>0),'管理员回复应阻塞在提交前');
  // 用户删除与管理员回复真正并发；稍等片刻让删除请求打到服务端。
  const deleteP=call(`/api/${kind}/${id}`,{method:'DELETE',cookie:aliceCookie});
  await new Promise(r=>setTimeout(r,150));
  await blocker.query('SELECT pg_advisory_unlock($1)',[LOCK]);
  return await Promise.all([replyP,deleteP]);
 }finally{
  await blocker.query('SELECT pg_advisory_unlock($1)',[LOCK]).catch(()=>{});
  await blocker.end();
 }
}

test('删除与回复竞态：已回复的记录删不掉，反馈与建议两类记录都回归',async t=>{
 const f=await fixture({servers:2}),call=f.call.bind(f);
 t.after(()=>f.close());
 const password='DeleteRace2026!';
 const alice=await call('/api/auth/register',{method:'POST',body:{email:'race-alice@example.test',name:'竞速测试甲',password}});
 assert.equal(alice.status,201);
 const admin=await call('/api/auth/register',{method:'POST',body:{email:'race-admin@example.test',name:'竞速测试管理员',password}});
 assert.equal(admin.status,201);
 await f.db.run("UPDATE users SET role='stuff' WHERE id=$1",[admin.data.user.id]);
 const adminCookie=(await call('/api/auth/login',{method:'POST',body:{email:'race-admin@example.test',password}})).cookie;

 // 建议：直接提交即可。
 const suggestion=await call('/api/suggestions',{method:'POST',cookie:alice.cookie,body:{content:'竞速回归：希望周末也开放书店角落的阳光位。'}});
 assert.equal(suggestion.status,201);
 const suggestionId=(await f.db.get('SELECT id FROM suggestions WHERE user_id=$1',[alice.data.user.id])).id;
 // 反馈：插一条合规的已签到反馈，聚焦删除竞态本身。
 const registrationId=randomUUID(),feedbackId=randomUUID(),now=new Date().toISOString();
 await f.db.run(`INSERT INTO registrations(id,user_id,activity_id,attendee_name,phone,ticket_code,status,privacy_consent,privacy_consent_at,created_at)
  VALUES($1,$2,'demo-reading',$3,'13800000000',$4,'checked_in',1,$5,$5)`,[registrationId,alice.data.user.id,'竞速测试甲',randomUUID(),now]);
 await f.db.run(`INSERT INTO feedbacks(id,user_id,activity_id,registration_id,rating,content,status,created_at)
  VALUES($1,$2,'demo-reading',$3,5,'竞速回归：活动很好，期待下一次。','pending',$4)`,[feedbackId,alice.data.user.id,registrationId,now]);

 for(const [kind,table,id] of [['suggestions','suggestions',suggestionId],['feedbacks','feedbacks',feedbackId]]){
  await t.test(`${kind}：管理员回复与用户删除并发时，已回复记录不可删`,async()=>{
   const [reply,del]=await race(f,call,{table,kind,id,aliceCookie:alice.cookie,adminCookie});
   assert.ok(!(reply.status===200&&del.status===200),'已回复的记录不允许被删除');
   if(reply.status===200){
    assert.equal(del.status,409,'回复先落地时，删除必须被拒绝');
    const row=await f.db.get(`SELECT reply FROM ${table} WHERE id=$1`,[id]);
    assert.ok(row&&row.reply,'记录应保留且带着回复');
   }else{
    assert.equal(reply.status,404,'记录先被删掉时，回复应找不到记录');
    assert.equal(del.status,200,'未回复的记录允许删除');
    assert.equal((await f.db.get(`SELECT COUNT(*)::integer AS n FROM ${table} WHERE id=$1`,[id])).n,0);
   }
  });
 }

 await t.test('非并发路径保持原有语义：不存在 404、他人记录 404',async()=>{
  assert.equal((await call('/api/suggestions/'+randomUUID(),{method:'DELETE',cookie:alice.cookie})).status,404);
  assert.equal((await call('/api/feedbacks/'+randomUUID(),{method:'DELETE',cookie:alice.cookie})).status,404);
 });
});
