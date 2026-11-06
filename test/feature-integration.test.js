import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './postgres-helper.js';

test('Account settings coexist with the AI assistant and checked-in feedback',async t=>{
 let requests=[];
 const f=await fixture({servers:2,appOptions:{assistant:{
  config:{apiKey:'fake-test-key-never-sent',baseURL:'https://api.deepseek.com',model:'deepseek-flash'},
  complete:async(_config,messages)=>{
   requests.push(structuredClone(messages));
   if(messages.at(-1).role==='tool')return {role:'assistant',content:'Please check and submit the form yourself.'};
   return {role:'assistant',content:null,tool_calls:[{id:'prepare-test',type:'function',function:{
    name:'prepare_registration',arguments:JSON.stringify({activity_id:'demo-reading'})
   }}]};
  }
 }}});
 t.after(()=>f.close());
 const password='CombinedFeaturesTest2026!';
 const alice=await f.call('/api/auth/register',{method:'POST',body:{name:'Original reader',email:'combined@example.test',password}});
 assert.equal(alice.status,201);
 const second=await f.call('/api/auth/login',{method:'POST',instance:1,body:{email:'combined@example.test',password}});
 assert.equal(second.status,200);
 const chat=cookie=>f.call('/api/assistant/chat',{method:'POST',cookie,body:{message:'Prepare the reading event'}});
 let registration;

 await t.test('profile editing preserves AI confirmation boundaries and private fields',async()=>{
  const updated=await f.call('/api/profile',{method:'PATCH',cookie:alice.cookie,body:{
   name:'Updated reader',gender:'other',region:'Private region',signature:'Private signature'
  }});
  assert.equal(updated.status,200);
  assert.equal((await f.call('/api/auth/me',{cookie:alice.cookie})).data.user.name,'Updated reader');
  const response=await chat(alice.cookie);
  assert.equal(response.status,200);
  assert.equal(response.data.cards[0].kind,'registration');
  assert.equal((await f.db.get('SELECT COUNT(*)::integer AS n FROM registrations')).n,0);
  for(const value of ['Private region','Private signature','combined@example.test','password_hash'])
   assert.ok(!JSON.stringify(requests).includes(value));
  const booking=await f.call('/api/registrations',{method:'POST',cookie:alice.cookie,body:{
   activity_id:'demo-reading',attendee_name:updated.data.user.name,phone:'13800000000',privacy_consent:true
  }});
  assert.equal(booking.status,201);registration=booking.data.registration;
  assert.equal((await f.db.get('SELECT attendee_name FROM registrations WHERE id=$1',[registration.id])).attendee_name,'Updated reader');
 });

 await t.test('updated accounts retain feedback eligibility during a checked-in event',async()=>{
  const now=Date.now();
  await f.db.run('UPDATE activities SET start_time=$1,end_time=$2 WHERE id=$3',[
   new Date(now-60000).toISOString(),new Date(now+3600000).toISOString(),'demo-reading'
  ]);
  await f.db.run("UPDATE registrations SET status='checked_in' WHERE id=$1",[registration.id]);
  const row=(await f.call('/api/registrations',{cookie:second.cookie,instance:1})).data.registrations[0];
  assert.equal(row.can_feedback,true);
  assert.equal((await f.call('/api/feedbacks',{method:'POST',cookie:second.cookie,instance:1,body:{
   registration_id:registration.id,rating:5,content:'Feedback after editing the reader profile.'
  }})).status,201);
 });

 await t.test('password changes revoke AI access on both sessions without losing records',async()=>{
  const changed=await f.call('/api/auth/change-password',{method:'POST',cookie:alice.cookie,body:{
   current_password:password,new_password:'CombinedFeaturesChanged2026!'
  }});
  assert.equal(changed.status,200);
  const before=requests.length;
  for(const [instance,cookie] of [[0,alice.cookie],[1,second.cookie]]){
   assert.equal((await f.call('/api/assistant/chat',{method:'POST',instance,cookie,body:{message:'Old session'}})).status,401);
   assert.equal((await f.call('/api/profile',{instance,cookie})).status,401);
  }
  assert.equal(requests.length,before);
  const login=await f.call('/api/auth/login',{method:'POST',body:{email:'combined@example.test',password:'CombinedFeaturesChanged2026!'}});
  assert.equal(login.status,200);
  assert.equal((await f.call('/api/profile',{cookie:login.cookie})).data.user.signature,'Private signature');
  assert.equal((await f.call('/api/feedbacks',{cookie:login.cookie})).data.feedbacks.length,1);
  assert.equal((await f.call('/api/registrations',{cookie:login.cookie})).data.registrations[0].feedback_state,'submitted');
 });
});
