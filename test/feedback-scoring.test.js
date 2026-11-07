import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './postgres-helper.js';
import {scoreContent,qualityBonus,levelOf,waitBonus,totalScore,levelOfTotal} from '../server/feedback-scoring.js';
const password='SuggestTest123456';

test('打分引擎：规则分、优质维度、安全硬升级、噪声下沉与等待加成',async t=>{
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
 await t.test('softr 基准连续：表扬负分下沉、安全问题 148 分、测试噪声负分（优质维度为叠加项）',()=>{
  assert.equal(scoreContent('订购的线装书到店后包装完整，工作人员专业又贴心，已经推荐给朋友了。',{rating:5}).score,-26);
  assert.equal(scoreContent('靠窗阅读区的插座太少了，下午基本抢不到；另外洗手间地面有积水，很滑，差点摔倒，希望能贴个提醒。',{rating:2}).score,148);
  assert.equal(scoreContent('这是一条测试',{rating:5}).score,-12);
 });
 await t.test('优质维度：长度倒 U、具体性、覆盖度、中肯、建设性与评分存疑',()=>{
  // 长度：过短无深度分，中等 +4，超长 +2（倒 U）。
  assert.equal(qualityBonus('短',[],{}).bonus,0);
  assert.equal(qualityBonus('这是一段长度大约在十五个字以上的评价文字。',[],{}).bonus,4);
  assert.equal(qualityBonus('长'.repeat(260),[],{}).bonus,2);
  // 具体性：数字或时间场景细节 +4。
  assert.equal(qualityBonus('昨天下午三点排队等了半小时。',[],{}).bonus,4);
  assert.equal(qualityBonus('一共多扣了 32 元。',[],{}).bonus,4);
  assert.equal(qualityBonus('整体感觉还不错。',[],{}).bonus,0);
  // 覆盖度：命中 2 组 +4、3 组 +6（构造命中：孩子/阅读活动同组、建议另一组）。
  const two=scoreContent('希望有孩子可以参与的阅读活动');
  assert.deepEqual(two.quality.tags,['覆盖+4']);
  const three=scoreContent('靠窗阅读区的插座太少了，下午基本抢不到；另外洗手间地面有积水，很滑，差点摔倒，希望能贴个提醒。',{rating:2});
  assert.ok(three.quality.tags.includes('覆盖+6'));
  // 中肯：同时有肯定与问题词 +4。
  const balanced=scoreContent('活动组织得很贴心，但是洗手间地面有积水，很滑。');
  assert.ok(balanced.quality.tags.includes('中肯+4'));
  assert.ok(!scoreContent('非常贴心的活动。').quality.tags.includes('中肯+4'));
  // 建设性：显式请求标记 +3（建议/希望已按词条计分，不重复奖励）。
  assert.ok(scoreContent('周末能不能增加亲子共读场次？').quality.tags.includes('建设性+3'));
  // 评分存疑：低星但全文没有任何问题词 -4。
  assert.ok(scoreContent('活动感受文字足够长',{rating:1}).quality.tags.includes('评分存疑-4'));
  assert.ok(!scoreContent('活动感受文字足够长',{rating:5}).quality.tags.includes('评分存疑-4'));
  // 优质加成封顶 +16：噪声文本不因堆砌维度而翻盘。
  const stuffed=scoreContent('孩子 阅读活动 亲子 读书会 讲座 分享会 书目 共读 作者 作家 新书 选书 绝版 夜读 自然观察 系列活动 通识 昨天下午三点 能不能 建议增加 贴心 感谢 专业 很好 推荐 不错 插座 空调 会员 咖啡 测试 随便 这是一段超过两百字的详细评价'.repeat(6));
  assert.ok(stuffed.quality.bonus<=16&&stuffed.quality.bonus>=-4);
 });
 await t.test('阈值边界与星级补偿',()=>{
  assert.equal(levelOf(59),'mid');assert.equal(levelOf(60),'high');
  assert.equal(levelOf(29),'low');assert.equal(levelOf(30),'mid');
  const plain='活动感受文字足够长，插座太少';
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
 const manager=await call('/api/auth/register',{method:'POST',body:{email:'score-manager@example.test',name:'打分测试管理员',password}});
 assert.equal(alice.status,201);assert.equal(bob.status,201);
 assert.equal(manager.status,201);assert.equal(manager.data.user.role,'user');
 await f.db.run("UPDATE users SET role='stuff' WHERE id=$1",[manager.data.user.id]);
 await t.test('提交建议即按关键词与优质维度打分入库，用户端不暴露打分字段',async()=>{
  const created=await call('/api/suggestions',{method:'POST',cookie:alice.cookie,body:{content:'希望有孩子可以参与的阅读活动，比如亲子共读。'}});
  assert.equal(created.status,201);
  const mine=(await call('/api/suggestions',{cookie:alice.cookie})).data.suggestions;
  assert.equal(mine.length,1);
  for(const field of ['score','score_level','score_hits','score_quality','total_score'])assert.ok(!(field in mine[0]),`用户端不应返回 ${field}`);
  const row=await f.db.get('SELECT score,score_level,score_hits,score_quality FROM suggestions WHERE id=$1',[mine[0].id]);
  assert.ok(row.score>=60);assert.equal(row.score_level,'high');assert.match(row.score_hits,/孩子/);
  assert.match(row.score_quality,/深度\+4/);
 });
 await t.test('管理端按动态总分降序展示分数、命中词条与优质维度，无意义建议沉底',async()=>{
  await call('/api/suggestions',{method:'POST',cookie:alice.cookie,body:{content:'消费区可以取消吗'}});
  await call('/api/suggestions',{method:'POST',cookie:alice.cookie,body:{content:'希望增加亲子自然观察系列的活动。'}});
  const rows=(await call('/api/admin/suggestions',{cookie:manager.cookie})).data.suggestions;
  assert.equal(rows.length,3);
  assert.match(rows[0].content,/孩子/);assert.ok(rows[0].total_score>=60);
  assert.ok(rows[0].total_score>=rows[1].total_score&&rows[1].total_score>=rows[2].total_score);
  assert.equal(rows[2].score_level,'low');assert.ok(rows[2].score<0);
  for(const row of rows){assert.ok(Number.isInteger(row.score)&&Number.isInteger(row.total_score));assert.equal(typeof row.score_hits,'string');assert.equal(typeof row.score_quality,'string');}
  assert.match(rows[0].score_hits,/阅读活动/);
  assert.match(rows[0].score_quality,/覆盖\+4/);
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
 await t.test('门店已回复的建议不可删除，保留服务记录',async()=>{
  const target=(await call('/api/suggestions',{cookie:alice.cookie})).data.suggestions.find(s=>/孩子/.test(s.content));
  assert.equal((await call(`/api/admin/suggestions/${target.id}`,{method:'PATCH',cookie:manager.cookie,body:{status:'replied',reply:'感谢建议，会纳入活动规划。'}})).status,200);
  const refused=await call(`/api/suggestions/${target.id}`,{method:'DELETE',cookie:alice.cookie,body:{}});
  assert.equal(refused.status,409);
  assert.match((await call('/api/suggestions',{cookie:alice.cookie})).data.suggestions.find(s=>s.id===target.id).reply,/纳入活动规划/);
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
  assert.match(row.score_quality,/覆盖\+6/);
  assert.equal((await call(`/api/feedbacks/${row.id}`,{method:'DELETE',cookie:bob.cookie,body:{}})).status,404);
  assert.equal((await call(`/api/feedbacks/${row.id}`,{method:'DELETE',cookie:alice.cookie,body:{}})).status,200);
  const rows=(await call('/api/registrations',{cookie:alice.cookie})).data.registrations;
  assert.equal(rows.find(r=>r.id===reg.data.registration.id).has_feedback,false);
  const again=await call('/api/feedbacks',{method:'POST',cookie:alice.cookie,body:{registration_id:reg.data.registration.id,rating:5,content:'重新提交的反馈：活动组织得很好，非常感谢。'}});
  assert.equal(again.status,201);
  assert.equal((await call('/api/admin/feedbacks?q=重新提交',{cookie:managerCookie})).data.total,1);
 });
 await t.test('门店已回复的反馈不可删除，保留服务记录',async()=>{
  const managerCookie=(await call('/api/auth/login',{method:'POST',body:{email:'score-manager@example.test',password}})).cookie;
  const target=(await call('/api/admin/feedbacks?q=重新提交',{cookie:managerCookie})).data.feedbacks[0];
  assert.equal((await call(`/api/admin/feedbacks/${target.id}`,{method:'PATCH',cookie:managerCookie,body:{status:'replied',reply:'感谢反馈，继续加油。'}})).status,200);
  assert.equal((await call(`/api/feedbacks/${target.id}`,{method:'DELETE',cookie:alice.cookie,body:{}})).status,409);
  assert.equal((await call('/api/admin/feedbacks?q=重新提交',{cookie:managerCookie})).data.total,1);
 });
});

test('安全强制高优先级在较高分数的中优先级之前（反馈和建议）',async t=>{
 const f=await fixture(),call=f.call.bind(f);t.after(()=>f.close());
 const u=await call('/api/auth/register',{method:'POST',body:{email:'priority-order@example.test',name:'排序测试',password}});
 await f.db.run("UPDATE users SET role='stuff' WHERE id=$1",[u.data.user.id]);
 const now=new Date().toISOString();
 for(const [id,score,level] of [['forced',1,'high'],['mid',50,'mid']]){
  await f.db.run("INSERT INTO suggestions(id,user_id,content,score,score_level,created_at) VALUES($1,$2,$3,$4,$5,$6)",[id,u.data.user.id,'排序测试内容',score,level,now]);
  await f.db.run("INSERT INTO registrations(id,user_id,activity_id,attendee_name,phone,ticket_code,status,privacy_consent,privacy_consent_at,created_at) VALUES($1,$2,'demo-reading','测试','13800000000',$3,'cancelled',1,$4,$4)",['reg-'+id,u.data.user.id,'ticket-'+id,now]);
  await f.db.run("INSERT INTO feedbacks(id,user_id,activity_id,registration_id,rating,content,score,score_level,created_at) VALUES($1,$2,'demo-reading',$3,5,'排序测试内容',$4,$5,$6)",[id,u.data.user.id,'reg-'+id,score,level,now]);
 }
 for(const kind of ['suggestions','feedbacks']){
  const response=await call('/api/admin/'+kind+'?limit=1',{cookie:u.cookie});
  assert.equal(response.status,200);assert.equal(response.data[kind][0].id,'forced');
 }
});
