import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {openDatabase} from '../server/db.js';
import {createApp} from '../server/app.js';
export async function fixture({seed=true,servers=1}={}) {
 if(!process.env.TEST_DATABASE_URL)throw Error('通过 npm test 启动真实 PostgreSQL 测试服务');
 const admin=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
 const name='sanlian_test_'+randomUUID().replaceAll('-','');
 await admin.query('CREATE DATABASE '+name);
 const url=new URL(process.env.TEST_DATABASE_URL);url.pathname='/'+name;
 const connectionString=url.toString();
 let db=await openDatabase(connectionString,{seed}),listeners=[],otherPools=[];
 async function start(){
  for(let i=0;i<servers;i++){
   const instanceDb=i===0?db:await openDatabase(connectionString,{seed:false});
   if(i>0)otherPools.push(instanceDb);
   const server=createApp(instanceDb).listen(0,'127.0.0.1');await once(server,'listening');listeners.push(server);
  }
 }
 async function stop(){
  await Promise.all(listeners.map(server=>new Promise(resolve=>server.close(resolve))));listeners=[];
  await Promise.all(otherPools.map(pool=>pool.close()));otherPools=[];
 }
 try{await start();}catch(error){await db.close();await admin.query('DROP DATABASE '+name+' WITH (FORCE)');await admin.end();throw error;}
 return {
  get db(){return db;},url:connectionString,
  base:(index=0)=>'http://127.0.0.1:'+listeners[index].address().port,
  async call(path,{method='GET',body,cookie,headers={},instance=0}={}) {
   const response=await fetch(this.base(instance)+path,{method,headers:{'Content-Type':'application/json','X-Requested-With':'sanlian',...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
   return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],setCookie:response.headers.get('set-cookie')};
  },
  async restart(){await stop();await db.close();db=await openDatabase(connectionString,{seed:false});await start();},
  async close(){
   await stop();await db.close();
   if(!/^sanlian_test_[a-f0-9]{32}$/.test(name))throw Error('拒绝清理非测试数据库');
   try{await admin.query('DROP DATABASE '+name+' WITH (FORCE)');}finally{await admin.end();}
  }
 };
}
