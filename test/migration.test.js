import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {fixture} from './postgres-helper.js';
import {importSqlite} from '../scripts/migrate-sqlite.js';
test('SQLite 到 PostgreSQL：备份、保留关系、旧角色映射与拒绝覆盖',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'sanlian-import-')),path=join(directory,'old.sqlite');
 let source=new DatabaseSync(path);const f=await fixture({seed:false,servers:0});
 try{
  source.exec(readFileSync(new URL('./fixtures/schema-v1.sql',import.meta.url),'utf8'));
  const now='2026-01-01T00:00:00.000Z',end='2026-01-01T02:00:00.000Z';
  for(const role of ['reader','staff','manager'])source.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(role,role+'@example.test',role,'preserved-hash',role,now);
  source.prepare('INSERT INTO sessions VALUES(?,?,?)').run('session-hash','reader',9999999999999);
  source.prepare(`INSERT INTO activities(id,title,category,description,start_time,end_time,location,capacity,fee_cents,publish_status,created_by,created_at)
   VALUES('activity','旧活动','读书会','旧活动测试说明',?,?,'门店',10,0,'published','staff',?)`).run(now,end,now);
  source.prepare(`INSERT INTO registrations(id,user_id,activity_id,attendee_name,phone,ticket_code,status,privacy_consent,privacy_consent_at,created_at)
   VALUES('registration','reader','activity','测试','13800000000','ticket','confirmed',1,?,?)`).run(now,now);
  source.prepare(`INSERT INTO feedbacks(id,user_id,activity_id,registration_id,rating,content,created_at) VALUES('feedback','reader','activity','registration',5,'保留的反馈',?)`).run(now);
  source.prepare("INSERT INTO operation_logs VALUES('log','manager','legacy_action','activity',?)").run(now);
  source.close();source=null;
  const r=await importSqlite(f.db,path);
  assert.deepEqual(r.counts,{users:3,activities:1,registrations:1,feedbacks:1,books:0,operation_logs:1,sessions:1});
  assert.equal((await f.db.get("SELECT role FROM users WHERE id='reader'")).role,'user');
  assert.equal((await f.db.get("SELECT role FROM users WHERE id='staff'")).role,'stuff');
  assert.equal((await f.db.get("SELECT password_hash FROM users WHERE id='reader'")).password_hash,'preserved-hash');
  const related=await f.db.get('SELECT u.email,r.ticket_code,f.content FROM users u JOIN registrations r ON r.user_id=u.id JOIN feedbacks f ON f.registration_id=r.id');
  assert.equal(related.email,'reader@example.test');assert.equal(related.ticket_code,'ticket');
  source=new DatabaseSync(path,{readOnly:true});assert.equal(source.prepare("SELECT role FROM users WHERE id='reader'").get().role,'reader');source.close();source=null;
  const backup=new DatabaseSync(r.backupPath,{readOnly:true});assert.equal(backup.prepare('SELECT COUNT(*) AS n FROM users').get().n,3);backup.close();
  await assert.rejects(importSqlite(f.db,path),/目标库已有/);
  assert.equal((await f.db.get('SELECT COUNT(*)::integer AS n FROM registrations')).n,1);
  assert.ok(readdirSync(directory).some(name=>name.includes('before-postgres')));
 }finally{
  source?.close();await f.close();
  assert.equal(resolve(dirname(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('sanlian-import-'));
  rmSync(directory,{recursive:true,force:true});
 }
});
test('导入约束冲突会完整回滚，不留下半套账号或活动',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'sanlian-import-')),path=join(directory,'invalid.sqlite');
 const source=new DatabaseSync(path),f=await fixture({seed:false,servers:0});
 try{
  source.exec(readFileSync(new URL('./fixtures/schema-v2-sqlite.sql',import.meta.url),'utf8'));
  const now='2026-01-01T00:00:00.000Z';
  source.prepare("INSERT INTO users(id,email,name,password_hash,created_at) VALUES('u','u@example.test','测试','hash',?)").run(now);
  // This timestamp ordering was permitted in the old schema but is invalid in PostgreSQL.
  source.prepare(`INSERT INTO activities(id,title,category,description,start_time,end_time,location,capacity,fee_cents,publish_status,created_at)
   VALUES('bad','无效活动','读书会','测试事务回滚',?,?,'门店',10,0,'published',?)`).run(now,now,now);
  await assert.rejects(importSqlite(f.db,path),error=>error.code==='23514');
  for(const table of ['users','activities','registrations'])assert.equal((await f.db.get('SELECT COUNT(*)::integer AS n FROM '+table)).n,0);
 }finally{
  source.close();await f.close();assert.equal(resolve(dirname(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('sanlian-import-'));
  rmSync(directory,{recursive:true,force:true});
 }
});
