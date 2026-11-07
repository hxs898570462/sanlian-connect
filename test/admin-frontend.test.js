import test from 'node:test';
import assert from 'node:assert/strict';
import {adminListQuery} from '../public/js/admin.js';
import {SCORE_LEVELS} from '../server/feedback-scoring.js';
import {fixture} from './postgres-helper.js';
import {readFileSync} from 'node:fs';

test('main navigation contains the role-controlled admin link and reader destinations',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(html,/<a\b[^>]*href="#admin"[^>]*id="admin-link"[^>]*\bhidden\b/);
 assert.match(html,/<a\b[^>]*href="#mine"[^>]*>读者一隅<\/a>/);
 assert.match(html,/<a\b[^>]*href="#books"[^>]*>书架漫游<\/a>/);
});

// 回归：「管理后台」整页无法打开。根因是页签切换重置 searchState 时漏掉 priority 键，
// undefined 被 URLSearchParams 序列化成字面量 "undefined"，服务端校验返回 400「优先级筛选无效」。
test('Admin list query keeps every filter parameter a valid string',()=>{
 // 模拟页签切换后的状态对象（历史上漏了 priority 键）。
 const afterTabSwitch={tab:'feedbacks',q:'',status:'',offset:0};
 const query=adminListQuery(afterTabSwitch).toString();
 assert.ok(!query.includes('undefined'),`查询串不应包含 undefined：${query}`);
 for(const key of ['q','status','priority','limit','offset'])assert.ok(adminListQuery(afterTabSwitch).has(key));
 assert.equal(adminListQuery(afterTabSwitch).get('priority'),'');
 assert.equal(adminListQuery(afterTabSwitch).get('limit'),'25');
 assert.equal(adminListQuery(afterTabSwitch).get('offset'),'0');
 // 有效优先级原样透传，且输出值始终落在服务端 SCORE_LEVELS 白名单内。
 for(const value of ['high','mid','low'])
  assert.equal(adminListQuery({...afterTabSwitch,priority:value}).get('priority'),value);
 for(const state of [afterTabSwitch,{...afterTabSwitch,priority:'high'},{...afterTabSwitch,priority:undefined}])
  assert.ok(['',...SCORE_LEVELS].includes(adminListQuery(state).get('priority')));
});

test('Admin list endpoints accept the query built after a tab switch',async t=>{
 const f=await fixture({servers:2}),call=f.call.bind(f);
 t.after(()=>f.close());
 const password='SdminfrontendQ7!';
 const signup=await call('/api/auth/register',{method:'POST',body:{name:'Store Manager',email:'admin-ui@example.test',password}});
 assert.equal(signup.status,201);
 await f.db.run("UPDATE users SET role='stuff' WHERE id=$1",[signup.data.user.id]);
 const login=await call('/api/auth/login',{method:'POST',body:{email:'admin-ui@example.test',password}});
 const cookie=login.cookie;
 // 用「页签切换后」的状态构造查询串（含 priority=''），逐页签打真实接口。
 for(const tab of ['feedbacks','suggestions']){
  const params=adminListQuery({tab,q:'',status:'',offset:0});
  const r=await call(`/api/admin/${tab}?${params}`,{cookie});
  assert.equal(r.status,200,`${tab} 应接受切换页签后的查询串：${params}`);
  assert.ok(r.data[tab],`${tab} 响应应包含列表字段`);
  // 各优先级取值同样被接受。
  for(const priority of SCORE_LEVELS){
   const filtered=await call(`/api/admin/${tab}?${adminListQuery({tab,q:'',status:'',offset:0,priority})}`,{cookie});
   assert.equal(filtered.status,200,`${tab} 应接受优先级筛选 ${priority}`);
  }
 }
});
