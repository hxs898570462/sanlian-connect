import test from 'node:test';
import assert from 'node:assert/strict';
import {httpConfig} from '../server/config.js';
import {fixture} from './postgres-helper.js';
import {request} from 'node:http';

test('部署配置：本机默认、Render 地址、错误配置在启动时拒绝',()=>{
 const local=httpConfig({});assert.equal(local.host,'127.0.0.1');assert.equal(local.proxyHops,0);assert.equal(local.origin,null);
 const hosted=httpConfig({NODE_ENV:'production',RENDER:'true',RENDER_EXTERNAL_URL:'https://sanlian-test.onrender.com',PORT:'10000'});
 assert.equal(hosted.host,'0.0.0.0');assert.equal(hosted.port,10000);assert.equal(hosted.proxyHops,1);
 assert.equal(httpConfig({NODE_ENV:'production',APP_ORIGIN:'https://custom.example.test/'}).origin,'https://custom.example.test');
 for(const env of [{NODE_ENV:'production'},{NODE_ENV:'production',APP_ORIGIN:'http://site.test'},
  {APP_ORIGIN:'https://user:password@site.test'},{APP_ORIGIN:'https://site.test/path'},
  {TRUST_PROXY_HOPS:'true'},{TRUST_PROXY_HOPS:'-1'},{PORT:'invalid'}])assert.throws(()=>httpConfig(env));
});

test('线上 HTTP：同源登录、Secure 会话、域名校验及代理限流',async t=>{
 const origin='https://sanlian-test.onrender.com';
 const http=httpConfig({NODE_ENV:'production',RENDER:'true',RENDER_EXTERNAL_URL:origin});
 const f=await fixture({seed:false,appOptions:{http}});
 const headers={Host:'sanlian-test.onrender.com',Origin:origin,'X-Forwarded-Proto':'https','X-Forwarded-For':'198.51.100.10'};
 // Node fetch rewrites Host; use raw HTTP to exercise the forwarded public Host.
 const call=(path,{method='GET',body,cookie,headers:extra={}}={})=>new Promise((resolve,reject)=>{
  const req=request(f.base()+path,{method,headers:{'Content-Type':'application/json','X-Requested-With':'sanlian',
   ...headers,...(cookie?{Cookie:cookie}:{}),...extra}},res=>{
   let data='';res.setEncoding('utf8');res.on('data',chunk=>data+=chunk);
   res.on('error',reject);res.on('end',()=>{
    const setCookie=res.headers['set-cookie']?.[0];
    try{resolve({status:res.statusCode,data:res.headers['content-type']?.includes('application/json')?JSON.parse(data):data,
     headers:res.headers,setCookie,cookie:setCookie?.split(';')[0]});}catch(error){reject(error);}
   });
  });req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
 });
 const body={email:'cloud-test@example.test',name:'线上测试',password:'CloudTestOnly2026!'};
 try{
  await t.test('线上健康检查和静态首页正常，生产安全响应头启用',async()=>{
   const health=await call('/api/health');assert.equal(health.status,200);assert.equal(health.data.mode,'hosted');
   const page=await call('/');assert.equal(page.status,200);
   assert.match(page.data,/Sanlian Connect/);assert.ok(page.headers['strict-transport-security']);
   assert.match(page.headers['content-security-policy'],/upgrade-insecure-requests/);
  });
  await t.test('HTTPS 同源注册与登录成功，Cookie 可用于后续请求',async()=>{
   const signup=await call('/api/auth/register',{method:'POST',body});assert.equal(signup.status,201);
   assert.match(signup.setCookie,/; Secure/i);assert.match(signup.setCookie,/HttpOnly/i);
   const login=await call('/api/auth/login',{method:'POST',body});assert.equal(login.status,200);
   assert.equal((await call('/api/profile',{cookie:login.cookie})).data.user.id,signup.data.user.id);
   await call('/api/auth/logout',{method:'POST',body:{},cookie:login.cookie});
   assert.equal((await call('/api/profile',{cookie:login.cookie})).status,401);
  });
  await t.test('跨站、缺少来源和伪造转发域名不能绕过检查',async()=>{
   for(const extra of [{Origin:'https://evil.example.test'},{Origin:''},{'X-Requested-With':''},
    {Host:'evil.example.test','X-Forwarded-Host':'sanlian-test.onrender.com'},
    {Origin:'https://evil.example.test','X-Forwarded-Host':'evil.example.test'}])
    assert.equal((await call('/api/auth/login',{method:'POST',body,headers:extra})).status,403);
   assert.equal((await call('/api/health',{headers:{Host:'localhost'}})).status,403);
  });
  await t.test('客户端各有登录限额，伪造最左侧 IP 不能重置末跳限额',async()=>{
   const wrong={...body,password:'WrongPassword2026!'};
   for(let i=0;i<30;i++)assert.equal((await call('/api/auth/login',{method:'POST',body:wrong,
    headers:{'X-Forwarded-For':`192.0.2.${i+1}, 198.51.100.20`}})).status,401);
   assert.equal((await call('/api/auth/login',{method:'POST',body:wrong,
    headers:{'X-Forwarded-For':'192.0.2.100, 198.51.100.20'}})).status,429);
   assert.equal((await call('/api/auth/login',{method:'POST',body:wrong,
    headers:{'X-Forwarded-For':'198.51.100.21'}})).status,401);
  });
 }finally{await f.close();}
});
