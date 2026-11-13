import test from 'node:test';
import assert from 'node:assert/strict';
import packageInfo from '../package.json' with {type:'json'};
import {profileView,settingsPage} from '../public/js/settings.js';
import {formatDate,getLanguage,setLanguage,t} from '../public/js/i18n.js';
import {errorMessage} from '../public/js/api-errors.js';
import {fixture} from './postgres-helper.js';

test('Settings separates profile editing from the read-only profile and category menu',()=>{
 const profile={name:'Reader',gender:'other',region:'Taicang',signature:'By the lake',role:'user',email:'reader@example.test',created_at:'2026-11-06'};
 const render=section=>settingsPage({section,profile,email:profile.email,version:packageInfo.version,escape:String});
 const categories=['profile','display','security','privacy','about'];
 const menu=render('');
 for(const section of categories)assert.ok(menu.includes(`href="#settings/${section}"`));
 assert.doesNotMatch(menu,/profile-form|登录邮箱|修改密码|报名信息用途|系统版本|type="radio"/);
 const view=profileView({profile,date:String,escape:String});
 for(const value of [profile.name,'其他',profile.signature,profile.email,'普通用户（user）',profile.created_at])
  assert.ok(view.includes(value));
 assert.doesNotMatch(view,/<(?:form|input|select)\b/);
 assert.ok(!view.includes(profile.region),'「我的资料」不再展示地区');
 assert.doesNotMatch(view,/地区/);
 assert.match(profileView({profile:{...profile,signature:''},date:String,escape:String}),/签名<\/dt><dd>未填写/);
 assert.match(render('profile'),/id="profile-form"/);
 assert.doesNotMatch(render('profile'),/注册时间|用户组|登录邮箱|地区/);
 assert.match(render('display'),/type="radio"/);
 const security=render('security');
 assert.match(security,/登录邮箱/);
 assert.match(security,/新密码为 6–128 个字符/);
 for(const id of ['current-password','new-password','confirm-password'])
  assert.match(security,new RegExp(`id="${id}"[^>]*minlength="6" maxlength="128"`));
 assert.doesNotMatch(security,/type="radio"|系统版本/);
 assert.match(render('privacy'),/报名信息用途/);
 assert.match(render('about'),/系统版本/);
 for(const section of categories)assert.ok(render(section).includes('href="#settings"'));
});

test('English settings, date formatting and validation copy respect the selected language',tctx=>{
 tctx.after(()=>setLanguage('zh-CN'));
 assert.equal(getLanguage(),'zh-CN');
 setLanguage('en');
 const view=settingsPage({section:'security',email:'reader@example.test',escape:String});
 assert.match(view,/Account and security/);
 assert.match(view,/Use 6–128 characters/);
 assert.match(view,/minlength="6" maxlength="128"/);
 assert.equal(errorMessage('邮箱或密码不正确'),'Incorrect email address or password.');
 assert.equal(errorMessage('称呼需填写 1–60 个字符'),'Name must be 1–60 characters long.');
 assert.match(formatDate('2026-11-12T16:00:00Z'),/November 13.*00:00/);
 assert.equal(t('查看{title}',{title:'湖畔读书小聚'}),'View 湖畔读书小聚');
 setLanguage('zh-CN');
 assert.equal(errorMessage('密码长度需为 6–128 个字符'),'密码长度需为 6–128 个字符');
 assert.match(formatDate('2026-11-12T16:00:00Z'),/11月13日.*00:00/);
});

test('Account settings preserve records and isolate private account changes',async t=>{
 const f=await fixture({servers:2}),call=f.call.bind(f);
 t.after(()=>f.close());
 const password='ReaderTestPassword123!';
 const signup=email=>call('/api/auth/register',{method:'POST',body:{name:'Reader',email,password}});
 const alice=await signup('settings-a@example.test'),bob=await signup('settings-b@example.test');
 const login=value=>call('/api/auth/login',{method:'POST',body:{email:'settings-a@example.test',password:value},instance:1});
 const change=(cookie,current_password,new_password,instance=0)=>call('/api/auth/change-password',{
  method:'POST',cookie,instance,body:{current_password,new_password}
 });
 assert.equal(alice.status,201);
 assert.equal(bob.status,201);

 await t.test('upgrade an existing account without losing its session or registration',async()=>{
  const booking=await call('/api/registrations',{method:'POST',cookie:alice.cookie,body:{
   activity_id:'demo-reading',attendee_name:'Reader',phone:'13800000000',privacy_consent:true
  }});
  assert.equal(booking.status,201);
  await f.db.transaction(async tx=>{
   await tx.run('ALTER TABLE users DROP COLUMN gender, DROP COLUMN region, DROP COLUMN signature');
   await tx.run('DELETE FROM schema_migrations WHERE version=2');
  });
  await f.restart();
  const profile=await call('/api/profile',{cookie:alice.cookie});
  assert.equal(profile.status,200);
  assert.deepEqual([profile.data.user.gender,profile.data.user.region,profile.data.user.signature],['','','']);
  assert.equal((await call('/api/registrations',{cookie:alice.cookie})).data.registrations[0].id,booking.data.registration.id);
  assert.equal((await call('/api/version',{cookie:alice.cookie})).data.version,packageInfo.version);
  assert.equal((await call('/api/version')).status,401);
 });

 await t.test('only the owner can read and update the new fields',async()=>{
  const patch=(body,cookie=alice.cookie)=>call('/api/profile',{method:'PATCH',body,cookie});
  assert.equal((await call('/api/profile',{method:'PATCH',body:{name:'Reader'}})).status,401);
  for(const body of [{role:'stuff'},{id:bob.data.user.id},{gender:'invalid'},{region:'x'.repeat(61)},{signature:'x'.repeat(101)},{signature:'bad\0text'}])
   assert.equal((await patch(body)).status,400);
  const profile={name:'New nickname',gender:'other',region:'Taicang',signature:'Reader by the lake'};
  assert.equal((await patch(profile)).status,200);
  await f.restart();
  const mine=(await call('/api/profile',{cookie:alice.cookie,instance:1})).data.user;
  for(const [key,value] of Object.entries(profile))assert.equal(mine[key],value);
  const other=(await call('/api/profile?user_id='+alice.data.user.id,{cookie:bob.cookie})).data.user;
  assert.equal(other.id,bob.data.user.id);
  assert.equal(other.signature,'');
  const summary=(await call('/api/auth/me',{cookie:alice.cookie})).data.user;
  for(const key of ['gender','region','signature','password_hash'])assert.ok(!Object.hasOwn(summary,key));
  const cleared=(await patch({gender:'',region:'',signature:''})).data.user;
  assert.deepEqual([cleared.gender,cleared.region,cleared.signature],['','','']);
  assert.equal(cleared.name,profile.name);
 });

 await t.test('require current credentials and revoke all sessions across instances',async()=>{
  const alternatives=['y7G9Tm','w5x8Zf'];
  assert.equal((await change(undefined,password,alternatives[0])).status,401);
  assert.equal((await change(alice.cookie,password,'r8m5b')).status,400);
  assert.equal((await change(alice.cookie,'IncorrectPassword123!',alternatives[0])).status,401);
  assert.equal((await change(alice.cookie,password,password)).status,400);
  const second=await login(password);
  assert.equal(second.status,200);
  const changes=await Promise.all([
   change(alice.cookie,password,alternatives[0]),change(second.cookie,password,alternatives[1],1)
  ]);
  assert.deepEqual(changes.map(r=>r.status).sort(),[200,401]);
  assert.match(changes.find(r=>r.status===200).setCookie,/^sanlian_session=;/);
  for(const cookie of [alice.cookie,second.cookie])
   assert.equal((await call('/api/profile',{cookie,instance:1})).status,401);
  assert.equal((await login(password)).status,401);
  const currentPassword=alternatives[changes.findIndex(r=>r.status===200)];
  const replacement=await login(currentPassword);
  assert.equal(replacement.status,200);
  assert.equal((await call('/api/registrations',{cookie:replacement.cookie})).data.registrations.length,1);
  assert.equal((await call('/api/profile',{cookie:bob.cookie})).status,200);
  assert.equal((await change(replacement.cookie,currentPassword,password,1)).status,200);
 });
});
