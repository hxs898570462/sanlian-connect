import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './postgres-helper.js';
const password='SuggestTest123456';
test('提出建议：提交、查看、隔离与门店回复',async t=>{
 const f=await fixture({servers:2}),call=f.call.bind(f);
 t.after(()=>f.close());
 const alice=await call('/api/auth/register',{method:'POST',body:{email:'suggest-alice@example.test',name:'建议测试甲',password}});
 assert.equal(alice.status,201);assert.equal(alice.data.user.role,'user');
 const bob=await call('/api/auth/register',{method:'POST',body:{email:'suggest-bob@example.test',name:'建议测试乙',password}});
 assert.equal(bob.status,201);
 await t.test('注册时可直接选择身份，非法身份被拒绝',async()=>{
  const manager=await call('/api/auth/register',{method:'POST',body:{email:'suggest-manager@example.test',name:'建议测试丙',password,role:'stuff'}});
  assert.equal(manager.status,201);assert.equal(manager.data.user.role,'stuff');
  assert.equal((await call('/api/admin/summary',{cookie:manager.cookie})).status,200);
  assert.equal((await call('/api/auth/register',{method:'POST',body:{email:'suggest-bad@example.test',name:'建议测试丁',password,role:'root'}})).status,400);
 });
 await t.test('登录用户可提交建议，匿名与过短内容被拒绝',async()=>{
  assert.equal((await call('/api/suggestions',{method:'POST',body:{content:'书店角落的阳光很好，希望周末也开放。'}})).status,401);
  assert.equal((await call('/api/suggestions',{method:'POST',cookie:alice.cookie,body:{content:'太短'}})).status,400);
  assert.equal((await call('/api/suggestions',{method:'POST',cookie:alice.cookie,body:{content:'x'.repeat(2001)}})).status,400);
  const created=await call('/api/suggestions',{method:'POST',cookie:alice.cookie,body:{content:'希望增加亲子自然观察系列的活动。'}});
  assert.equal(created.status,201);
  const mine=(await call('/api/suggestions',{cookie:alice.cookie})).data.suggestions;
  assert.equal(mine.length,1);assert.equal(mine[0].status,'pending');assert.match(mine[0].content,/亲子自然观察/);assert.equal(mine[0].reply,null);
 });
 await t.test('建议仅提交者可见，普通用户不能进后台',async()=>{
  assert.equal((await call('/api/suggestions',{cookie:bob.cookie})).data.suggestions.length,0);
  assert.equal((await call('/api/admin/suggestions',{cookie:alice.cookie})).status,403);
 });
 await t.test('管理员可按内容搜索并回复，回复仅提交者可见',async()=>{
  const manager=await call('/api/auth/login',{method:'POST',body:{email:'suggest-manager@example.test',password}});
  assert.equal(manager.status,200);
  const mine=(await call('/api/suggestions',{cookie:alice.cookie})).data.suggestions;
  const id=mine[0].id;
  const listed=await call('/api/admin/suggestions?q=亲子',{cookie:manager.cookie});
  assert.equal(listed.status,200);assert.equal(listed.data.total,1);
  assert.equal(listed.data.suggestions[0].user_name,'建议测试甲');assert.equal(listed.data.suggestions[0].email,'suggest-alice@example.test');
  assert.equal((await call(`/api/admin/suggestions/${id}`,{method:'PATCH',cookie:manager.cookie,body:{status:'replied'}})).status,400);
  assert.equal((await call(`/api/admin/suggestions/${id}`,{method:'PATCH',cookie:manager.cookie,body:{status:'archived',reply:'x'}})).status,400);
  assert.equal((await call(`/api/admin/suggestions/${id}`,{method:'PATCH',cookie:alice.cookie,body:{status:'replied',reply:'已收到，下季度会安排。'}})).status,403);
  assert.equal((await call(`/api/admin/suggestions/${id}`,{method:'PATCH',cookie:manager.cookie,body:{status:'replied',reply:'已收到，下季度会安排亲子自然观察专场。'}})).status,200);
  const after=(await call('/api/suggestions',{cookie:alice.cookie})).data.suggestions[0];
  assert.equal(after.status,'replied');assert.match(after.reply,/下季度/);
  assert.equal((await call('/api/suggestions',{cookie:bob.cookie})).data.suggestions.length,0);
 });
 await t.test('建议状态筛选与分页参数受校验',async()=>{
  const manager=await call('/api/auth/login',{method:'POST',body:{email:'suggest-manager@example.test',password}});
  assert.equal((await call('/api/admin/suggestions?status=replied',{cookie:manager.cookie})).data.total,1);
  assert.equal((await call('/api/admin/suggestions?status=pending',{cookie:manager.cookie})).data.total,0);
  assert.equal((await call('/api/admin/suggestions?status=archived',{cookie:manager.cookie})).status,400);
 });
});
