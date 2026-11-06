import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './postgres-helper.js';
import {scoreContent,levelOf,waitBonus,totalScore,levelOfTotal} from '../server/feedback-scoring.js';
const password='SuggestTest123456';

test('打分引擎：规则分、安全硬升级、噪声下沉与等待加成',async t=>{
 await t.test('用户示例：无意义建议低分、建设性活动建议高分',()=>{
  const noise=scoreContent('消费区可以取消吗');
  assert.ok(noise.score<0);assert.equal(noise.level,'low');
  const valuable=scoreContent('希望有孩子可以参与的阅读活动');
  assert.ok(valuable.score>=60);assert.equal(valuable.level,'high');
  assert.deepEqual(valuable.hits,['希望','阅读活动','孩子']);
 });
 await t.test('安全词条命中直接判高，即使总分未到阈值',()=>{
  const r=scoreContent('阅读区地面很滑，有读者差点摔倒');
  assert.equal(r.forced,true);assert.equal(r.level,'high');
  assert.equal(levelOf(10,true),'high');
 });
 await t.test('softr 基准保持连续：表扬负分下沉、安全问题 134 分、测试噪声负分',()=>{
  assert.equal(scoreContent('订购的线装书到店后包装完整，工作人员专业又贴心，已经推荐给朋友了。',{rating:5}).score,-30);
  assert.equal(scoreContent('靠窗阅读区的插座太少了，下午基本抢不到；另外洗手间地面有积水，很滑，差点摔倒，希望能贴个提醒。',{rating:2}).score,134);
  assert.equal(scoreContent('这是一条测试',{rating:5}).score,-12);
 });
 await t.test('阈值边界与星级补偿',()=>{
  assert.equal(levelOf(59),'mid');assert.equal(levelOf(60),'high');
  assert.equal(levelOf(29),'low');assert.equal(levelOf(30),'mid');
  const plain='活动感受文字足够长';
  assert.equal(scoreContent(plain,{rating:1}).score-scoreContent(plain,{rating:5}).score,12);
  assert.equal(scoreContent(plain,{rating:2}).score-scoreContent(plain,{rating:5}).score,6);
 });
 await t.test('等待加成只对待处理工单按 24/48 小时升级',()=>{
  const now=Date.now();
  assert.equal(waitBonus('pending',new Date(now-23*3600000).toISOString(),now),0);
  assert.equal(waitBonus('pending',new Date(now-25*3600000).toISOString(),now),4);
  assert.equal(waitBonus('pending',new Date(now-49*3600000).toISOString(),now),8);
  assert.equal(waitBonus('replied',new Date(now-49*3600000).toISOString(),now),0);
  assert.equal(waitBonus('pending',new Date(now+3600000).toISOString(),now),0);
  assert.equal(totalScore(56,'pending',new Date(now-25*3600000).toISOString(),now),60);
  assert.equal(levelOfTotal(60,'low'),'high');assert.equal(levelOfTotal(40,'high'),'high');assert.equal(levelOfTotal(40,'mid'),'mid');
 });
});

test('反馈与建议：误发删除、智能打分入库与管理端优先处理',async t=>{
 const f=await fixture(),call=f.call.bind(f);
 t.after(()=>f.close());
 const alice=await call('/api/auth/register',{method:'POST',body:{email:'score-alice@example.test',name:'打分测试甲',password}});
 const bob=await call('/api/auth/register',{method:'POST',body:{email:'score-bob@example.test',name:'打分测试乙',password}});
 const manager=await call('/api/auth/register',{method:'POST',body:{email:'score-manager@example.test',name:'打分测试管理员',password,role:'stuff'}});
 assert.equal(alice.status,201);assert.equal(bob.status,201);
 assert.equal(manager.status,201);assert.equal(manager.data.user.role,'stuff');
 await t.test('提交建议即按关键词打分入库，用户端不暴露打分字段',async()=>{
  const created=await call('/api/suggestions',{method:'POST',cookie:alice.cookie,body:{content:'希望有孩子可以参与的阅读活动，比如亲子共读。'}});
  assert.equal(created.status,201);
  const mine=(await call('/api/suggestions',{cookie:alice.cookie})).data.suggestions;
  assert.equal(mine.length,1);
  for(const field of ['score','score_level','score_hits','total_score'])assert.ok(!(field in mine[0]),`用户端不应返回 ${field}`);
  const row=await f.db.get('SELECT score,score_level,score_hits FROM suggestions WHERE id=$1',[mine[0].id]);
  assert.ok(row.score>=60);assert.equal(row.score_level,'high');assert.match(row.score_hits,/孩子/);
 });
 await t.test('管理端按动态总分降序展示分数与命中词条，无意义建议沉底',async()=>{
  await call('/api/suggestions',{method:'POST',cookie:alice.cookie,body:{content:'消费区可以取消吗'}});
  await call('/api/suggestions',{method:'POST',cookie:alice.cookie,body:{content:'希望增加亲子自然观察系列的活动。'}});
  const rows=(await call('/api/admin/suggestions',{cookie:manager.cookie})).data.suggestions;
  assert.equal(rows.length,3);
  assert.match(rows[0].content,/孩子/);assert.ok(rows[0].total_score>=60);
  assert.ok(rows[0].total_score>=rows[1].total_score&&rows[1].total_score>=rows[2].total_score);
  assert.equal(rows[2].score_level,'low');assert.ok(rows[2].score<0);
  for(const row of rows){assert.ok(Number.isInteger(row.score)&&Number.isInteger(row.total_score));assert.equal(typeof row.score_hits,'string');}
  assert.match(rows[0].score_hits,/阅读活动/);
 });
 await t.test('管理端可按优先级筛选，阈值与安全硬升级一致',async()=>{
  assert.equal((await call('/api/admin/suggestions?priority=high',{cookie:manager.cookie})).data.total,1);
  assert.equal((await call('/api/admin/suggestions?priority=mid',{cookie:manager.cookie})).data.total,1);
  assert.equal((await call('/api/admin/suggestions?priority=low',{cookie:manager.cookie})).data.total,1);
  assert.equal((await call('/api/admin/suggestions?priority=urgent',{cookie:manager.cookie})).status,400);
  assert.equal((await call('/api/admin/suggestions',{cookie:alice.cookie})).status,403);
 });
 await t.test('等待加成：待处理超 24 小时总分 +4，跨阈值升级为高优先级',async()=>{
  const mid=(await call('/api/admin/suggestions?priority=mid',{cookie:manager.cookie})).data.suggestions[0];
  await f.db.run('UPDATE suggestions SET score=$1 WHERE id=$2',[56,mid.id]);
  await f.db.run('UPDATE suggestions SET created_at=$1 WHERE id=$2',[new Date(Date.now()-25*3600000).toISOString(),mid.id]);
  const row=(await call('/api/admin/suggestions?q=亲子',{cookie:manager.cookie})).data.suggestions.find(r=>r.id===mid.id);
  assert.equal(row.score,56);assert.equal(row.total_score,60);
  assert.equal((await call('/api/admin/suggestions?priority=high',{cookie:manager.cookie})).data.total,2);
  const summary=(await call('/api/admin/summary',{cookie:manager.cookie})).data.summary;
  assert.equal(summary.high_priority,2);assert.equal(summary.pending_suggestions,3);
 });
 await t.test('误发可删：仅提交者本人可删除自己的建议',async()=>{
  const mine=(await call('/api/suggestions',{cookie:alice.cookie})).data.suggestions;
  const victim=mine.find(s=>/消费区/.test(s.content));
  assert.equal((await call(`/api/suggestions/${victim.id}`,{method:'DELETE',body:{}})).status,401);
  assert.equal((await call(`/api/suggestions/${victim.id}`,{method:'DELETE',cookie:bob.cookie,body:{}})).status,404);
  assert.equal((await call(`/api/suggestions/${victim.id}`,{method:'DELETE',cookie:manager.cookie,body:{}})).status,404);
  assert.equal((await call(`/api/suggestions/${victim.id}`,{method:'DELETE',cookie:alice.cookie,body:{}})).status,200);
  assert.equal((await call('/api/suggestions',{cookie:alice.cookie})).data.suggestions.length,2);
  assert.equal((await call(`/api/suggestions/${victim.id}`,{method:'DELETE',cookie:alice.cookie,body:{}})).status,404);
  assert.equal((await call('/api/admin/suggestions',{cookie:manager.cookie})).data.total,2);
 });
 await t.test('误发可删：活动反馈同样仅本人可删，删除后可重新提交',async()=>{
  const managerCookie=(await call('/api/auth/login',{method:'POST',body:{email:'score-manager@example.test',password}})).cookie;
  const reg=await call('/api/registrations',{method:'POST',cookie:alice.cookie,body:{activity_id:'demo-reading',attendee_name:'打分测试甲',phone:'13800000001',privacy_consent:true}});
  assert.equal(reg.status,201);
  await f.db.run('UPDATE activities SET start_time=$1,end_time=$2 WHERE id=$3',[new Date(Date.now()-3600000).toISOString(),new Date(Date.now()+3600000).toISOString(),'demo-reading']);
  assert.equal((await call(`/api/admin/registrations/${reg.data.registration.id}`,{method:'PATCH',cookie:managerCookie,body:{status:'checked_in'}})).status,200);
  const content='洗手间地面有积水，很滑，有孩子差点摔倒，请尽快贴个提醒。';
  const fb=await call('/api/feedbacks',{method:'POST',cookie:alice.cookie,body:{registration_id:reg.data.registration.id,rating:2,content}});
  assert.equal(fb.status,201);
  const row=(await call('/api/admin/feedbacks?q=摔倒',{cookie:managerCookie})).data.feedbacks[0];
  assert.ok(row.score>=60);assert.equal(row.score_level,'high');assert.match(row.score_hits,/很滑/);
  assert.equal((await call(`/api/feedbacks/${row.id}`,{method:'DELETE',cookie:bob.cookie,body:{}})).status,404);
  assert.equal((await call(`/api/feedbacks/${row.id}`,{method:'DELETE',cookie:alice.cookie,body:{}})).status,200);
  const rows=(await call('/api/registrations',{cookie:alice.cookie})).data.registrations;
  assert.equal(rows.find(r=>r.id===reg.data.registration.id).has_feedback,false);
  const again=await call('/api/feedbacks',{method:'POST',cookie:alice.cookie,body:{registration_id:reg.data.registration.id,rating:5,content:'重新提交的反馈：活动组织得很好，非常感谢。'}});
  assert.equal(again.status,201);
  assert.equal((await call('/api/admin/feedbacks?q=重新提交',{cookie:managerCookie})).data.total,1);
 });
});
