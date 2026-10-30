import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './postgres-helper.js';
import {snapshot,transfer,tables} from '../scripts/migrate-postgres.js';

async function pair(action){
 const source=await fixture({servers:0}),target=await fixture({servers:0});
 let a,b;
 try{
  const now=new Date().toISOString();
  await source.db.run("INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES('original','original@example.test','原读者','preserved-scrypt-hash','stuff',$1)",[now]);
  await source.db.run("UPDATE activities SET description='原本地活动介绍' WHERE id='demo-reading'");
  await source.db.run(`INSERT INTO registrations(id,user_id,activity_id,attendee_name,phone,ticket_code,status,privacy_consent,privacy_consent_at,created_at)
   VALUES('registration','original','demo-reading','测试读者','13800000000','original-ticket','confirmed',1,$1,$1)`,[now]);
  await source.db.run("INSERT INTO sessions VALUES('session-hash','original',9999999999999)");
  await source.db.run("INSERT INTO operation_logs VALUES('log','original','legacy_action','registration',$1)",[now]);
  a=await source.db.pool.connect();b=await target.db.pool.connect();
  await action({source,target,a,b,s:await snapshot(a),d:await snapshot(b)});
 }finally{a?.release();b?.release();await source.close();await target.close();}
}

test('PostgreSQL 迁移：原账号/密码/角色/报名及全部字段保留，替换纯示例目标',async()=>pair(async({a,b,s,d})=>{
 await transfer(b,s,d);const result=await snapshot(b);
 for(const t of tables)assert.deepEqual(result.tables[t],s.tables[t]);
 assert.equal(result.tables.users[0].password_hash,'preserved-scrypt-hash');
 assert.equal(result.tables.users[0].role,'stuff');
 assert.deepEqual((await snapshot(a)).tables,s.tables);
 await assert.rejects(transfer(b,s,result),/TARGET_HAS_BUSINESS_DATA/);
}));

test('PostgreSQL 迁移：拒绝含新增账号或修改过示例的目标',async()=>pair(async({target,b,s,d})=>{
 await target.db.run("UPDATE activities SET description='云端已编辑' WHERE id='demo-reading'");
 const changed=await snapshot(b);await assert.rejects(transfer(b,s,changed),/NOT_PRISTINE_SEED/);
 await target.db.run("INSERT INTO users(id,email,name,password_hash,created_at) VALUES('cloud','cloud@example.test','云端读者','hash',$1)",[new Date().toISOString()]);
 const withUser=await snapshot(b);await assert.rejects(transfer(b,s,withUser),/TARGET_HAS_BUSINESS_DATA/);
 assert.deepEqual((await snapshot(b)).tables,withUser.tables);
}));

test('PostgreSQL 迁移：备份后目标变化会拒绝写入',async()=>pair(async({target,b,s,d})=>{
 await target.db.run("UPDATE books SET summary='备份后新增修改' WHERE id='demo-book-1'");
 const changed=await snapshot(b);
 await assert.rejects(transfer(b,s,d),/TARGET_CHANGED_SINCE_BACKUP/);
 assert.deepEqual((await snapshot(b)).tables,changed.tables);
}));

test('PostgreSQL 迁移：中途约束失败完整回滚，示例和业务表恢复',async()=>pair(async({b,s,d})=>{
 const bad=structuredClone(s);bad.tables.registrations[0].user_id='missing-user';
 await assert.rejects(transfer(b,bad,d),e=>e.code==='23503');
 assert.deepEqual((await snapshot(b)).tables,d.tables);
 const wrong=structuredClone(s);wrong.columns[0].udt_name='invalid';
 await assert.rejects(transfer(b,wrong,d),/SCHEMA_COLUMNS_DIFFER/);
}));
