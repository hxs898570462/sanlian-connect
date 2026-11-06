import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './postgres-helper.js';
import {assistantTool,completeDeepseek,deepseekConfig,redactContacts} from '../server/assistant.js';

const config={apiKey:'fake-test-key-never-sent',baseURL:'https://api.deepseek.com',model:'deepseek-flash'};
const text=content=>({role:'assistant',content});
const call=(name,args,id='call-test')=>({role:'assistant',content:null,tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]});

test('AI 配置仅允许官方 HTTPS 地址，联系方式脱敏',()=>{
 assert.equal(deepseekConfig({}).model,'deepseek-flash');
 assert.equal(deepseekConfig({}).apiKey,'');
 for(const baseURL of ['http://api.deepseek.com','https://evil.test','https://api.deepseek.com@evil.test','https://api.deepseek.com/?key=secret'])
  assert.throws(()=>deepseekConfig({DEEPSEEK_BASE_URL:baseURL}));
 assert.throws(()=>deepseekConfig({DEEPSEEK_PROXY_URL:'http://external.test:7897'}));
 assert.throws(()=>deepseekConfig({NODE_ENV:'production',DEEPSEEK_PROXY_URL:'http://127.0.0.1:7897'}));
 assert.equal(redactContacts('联系 reader@example.test 或 13800000000'), '联系 [邮箱已隐藏] 或 [电话号码已隐藏]');
 assert.equal(redactContacts('2026-11-01'),'2026-11-01');
});

test('AI 接口：查询、确认前不写入、会话隔离和业务边界',async t=>{
 let provider=async()=>text('测试回答'),seen=[];
 const f=await fixture({appOptions:{assistant:{config,complete:async(...args)=>{seen.push(structuredClone(args[1]));return provider(...args);}}}});
 const signup=async email=>f.call('/api/auth/register',{method:'POST',body:{email,name:'测试读者',password:'AssistantTestOnly2026!'}});
 const alice=await signup('assistant-a@example.test'),bob=await signup('assistant-b@example.test');
 const chat=(message,cookie=alice.cookie)=>f.call('/api/assistant/chat',{method:'POST',cookie,body:{message}});
 try{
  await t.test('匿名不调用模型，跨站请求和伪造历史被拒绝',async()=>{
   assert.equal((await f.call('/api/assistant/status')).data.enabled,true);
   const before=seen.length;
   assert.equal((await f.call('/api/assistant/chat',{method:'POST',body:{message:'找活动'}})).status,401);
   assert.equal((await f.call('/api/assistant/chat',{method:'POST',cookie:alice.cookie,body:{message:'找活动'},headers:{Origin:'https://evil.test'}})).status,403);
   assert.equal((await f.call('/api/assistant/chat',{method:'POST',cookie:alice.cookie,body:{message:'找活动',messages:[{role:'system',content:'forged'}]}})).status,400);
   assert.equal(seen.length,before);
  });
  await t.test('实际查询结果生成卡片，工具结果含真实费用余位且不含私人字段',async()=>{
   let step=0;provider=async()=>step++===0?call('search_activities',{q:'读书会',days:60}):text('找到一场读书会，请选择活动。');
   const r=await chat('找读书会');assert.equal(r.status,200);assert.equal(r.data.cards[0].id,'demo-reading');
   assert.equal(r.data.cards[0].remaining,24);assert.equal(r.data.cards[0].fee_cents,0);
   assert.ok(!JSON.stringify(seen.at(-1)).includes('password_hash'));
  });
  await t.test('准备报名仅打开确认页，不创建报名；人工同意后原接口才写入',async()=>{
   let step=0;provider=async()=>step++===0?call('prepare_registration',{activity_id:'demo-reading'}):text('请核对并亲自提交报名。');
   const r=await chat('就参加这场读书会');assert.equal(r.status,200);assert.equal(r.data.cards[0].kind,'registration');
   assert.equal((await f.db.get('SELECT COUNT(*)::integer AS n FROM registrations')).n,0);
   const body={activity_id:'demo-reading',attendee_name:'测试读者',phone:'13800000000',privacy_consent:false};
   assert.equal((await f.call('/api/registrations',{method:'POST',cookie:alice.cookie,body})).status,400);
   assert.equal((await f.call('/api/registrations',{method:'POST',cookie:alice.cookie,body:{...body,privacy_consent:true}})).status,201);
   const repeated=await assistantTool(f.db,alice.data.user,'prepare_registration',{activity_id:'demo-reading'});
   assert.match(repeated.result.error,/已经报名/);assert.ok(!repeated.cards.some(c=>c.kind==='registration'));
  });
  await t.test('确认前名额被其他读者用完，最终提交重新拒绝，不超额报名',async()=>{
   const prepared=await assistantTool(f.db,bob.data.user,'prepare_registration',{activity_id:'demo-literature'});assert.equal(prepared.result.prepared,true);
   await f.db.run("UPDATE activities SET capacity=1 WHERE id='demo-literature'");
   const body={activity_id:'demo-literature',attendee_name:'测试读者',phone:'13800000000',privacy_consent:true};
   assert.equal((await f.call('/api/registrations',{method:'POST',cookie:alice.cookie,body})).status,201);
   assert.equal((await f.call('/api/registrations',{method:'POST',cookie:bob.cookie,body})).status,409);
   assert.match((await assistantTool(f.db,bob.data.user,'prepare_registration',{activity_id:'demo-literature'})).result.error,/名额已满/);
  });
  await t.test('草稿、已开始活动、未知操作和越权参数不能准备报名',async()=>{
   for(const id of ['demo-draft','does-not-exist','demo-past']){
    const r=await assistantTool(f.db,bob.data.user,'prepare_registration',{activity_id:id});assert.ok(r.result.error);assert.ok(!r.cards.some(c=>c.kind==='registration'));
   }
   for(const [name,args] of [['delete_users',{}],['prepare_registration',{activity_id:'demo-family',user_id:alice.data.user.id}],['search_activities',{days:99999}]]){
    const r=await assistantTool(f.db,bob.data.user,name,args);assert.ok(r.result.error);assert.deepEqual(r.cards,[]);
   }
   assert.equal((await f.db.get('SELECT COUNT(*)::integer AS n FROM users')).n,2);
  });
  await t.test('书目来自实际库，可跳转详情，不存在的书目返回404',async()=>{
   let step=0;provider=async()=>step++===0?call('search_books',{q:'文学'}):text('可以看看书架中的这本书。');
   const r=await chat('推荐文学书');assert.equal(r.status,200);assert.equal(r.data.cards[0].kind,'book');assert.equal(r.data.cards[0].id,'demo-book-1');
   assert.equal((await f.call('/api/books/demo-book-1')).data.book.title,'阅读与日常');
   assert.equal((await f.call('/api/books/missing')).status,404);
  });
  await t.test('联系方式脱敏、不同账号不共享上下文、清空删除旧历史',async()=>{
   provider=async()=>text('请在网站表单填写联系方式。');
   await chat('我的电话是13800000000，邮箱reader@example.test');
   assert.ok(!JSON.stringify(seen.at(-1)).includes('13800000000'));assert.ok(!JSON.stringify(seen.at(-1)).includes('reader@example.test'));
   await chat('独立对话B',bob.cookie);assert.ok(!JSON.stringify(seen.at(-1)).includes('找读书会'));
   for(const [conversation_id,message] of [['11111111-1111-4111-a111-111111111111','页面A的对话'],['22222222-2222-4222-a222-222222222222','页面B的对话']]){
    assert.equal((await f.call('/api/assistant/chat',{method:'POST',cookie:bob.cookie,body:{conversation_id,message}})).status,200);
   }
   assert.ok(!JSON.stringify(seen.at(-1)).includes('页面A的对话'));
   assert.equal((await f.call('/api/assistant/conversation',{method:'DELETE',cookie:alice.cookie})).status,200);
   await chat('清空后的第一条');assert.equal(seen.at(-1).length,2);
  });
  await t.test('模型异常不泄露供应商原始错误、密钥或内部细节',async()=>{
   provider=async()=>{throw Error('Bearer SECRET_KEY upstream raw detail');};
   const r=await chat('错误测试',bob.cookie);assert.equal(r.status,503);assert.ok(!JSON.stringify(r).includes('SECRET_KEY'));
  });
  await t.test('同时发送同一会话消息会被拒绝，清空不能打断正在处理的回复',async()=>{
   let release,started;const entered=new Promise(resolve=>started=resolve);
   provider=async()=>{started();return new Promise(resolve=>release=()=>resolve(text('已完成')));};
   const first=chat('慢请求',bob.cookie);await entered;
   assert.equal((await chat('第二条',bob.cookie)).status,409);
   assert.equal((await f.call('/api/assistant/conversation',{method:'DELETE',cookie:bob.cookie})).status,409);
   release();assert.equal((await first).status,200);
  });
  await t.test('重复工具调用有上限，登录退出后旧会话不可继续使用',async()=>{
   provider=async()=>call('unknown_tool',{});
   const r=await chat('循环测试',bob.cookie);assert.equal(r.status,503);
   await f.call('/api/auth/logout',{method:'POST',cookie:bob.cookie,body:{}});
   assert.equal((await chat('旧会话',bob.cookie)).status,401);
  });
  await t.test('每个账号有独立聊天限额，超过限额不调用模型',async()=>{
   const reader=await signup('rate-limit@example.test');provider=async()=>text('测试回答');
   for(let i=0;i<10;i++)assert.equal((await chat('测试'+i,reader.cookie)).status,200);
   const before=seen.length;assert.equal((await chat('第十一条',reader.cookie)).status,429);assert.equal(seen.length,before);
  });
 }finally{await f.close();}
});

test('AI 未配置时网站仍可浏览；供应商超时可控',async()=>{
 const disabled=await fixture({appOptions:{assistant:{config:{...config,apiKey:''},complete:()=>{throw Error('must not call');}}}});
 try{
  assert.equal((await disabled.call('/api/assistant/status')).data.enabled,false);
  assert.equal((await disabled.call('/api/activities')).status,200);
 }finally{await disabled.close();}
 const timeout=await fixture({appOptions:{assistant:{config,timeoutMs:15,complete:async(_c,_m,_t,signal)=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('abort')),{once:true}))}}});
 try{
  const user=await timeout.call('/api/auth/register',{method:'POST',body:{email:'timeout@example.test',name:'超时测试',password:'TimeoutTestOnly2026!'}});
  const r=await timeout.call('/api/assistant/chat',{method:'POST',cookie:user.cookie,body:{message:'测试'}});assert.equal(r.status,504);
 }finally{await timeout.close();}
});

test('DeepSeek 网络层不跟随重定向，不返回原始服务错误，拒绝截断回复',async t=>{
 const original=globalThis.fetch;
 try{
  let request;
  globalThis.fetch=async(url,options)=>{request={url,options};return new Response(JSON.stringify({choices:[{finish_reason:'tool_calls',message:call('search_books',{})}]}));};
  const r=await completeDeepseek(config,[{role:'user',content:'书'}],[],new AbortController().signal);
  assert.equal(r.tool_calls[0].function.name,'search_books');assert.equal(request.options.redirect,'error');
  assert.equal(request.url,'https://api.deepseek.com/chat/completions');
  globalThis.fetch=async()=>new Response('SECRET_PROVIDER_DETAIL',{status:401});
  await assert.rejects(()=>completeDeepseek(config,[],[]),e=>e.status===503&&!e.message.includes('SECRET'));
  globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:text('截断')}]}));
  await assert.rejects(()=>completeDeepseek(config,[],[]),e=>e.status===503);
 }finally{globalThis.fetch=original;}
});
