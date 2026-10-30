import {resolve,dirname} from 'node:path';
import {mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {openDatabase,projectRoot} from '../server/db.js';
const tables=['users','activities','registrations','feedbacks','books','operation_logs','sessions'];

export async function importSqlite(db,sourcePath,{backupPath}={}) {
 const {DatabaseSync,backup}=await import('node:sqlite');
 const source=new DatabaseSync(resolve(sourcePath),{readOnly:true});
 try {
  if(!backupPath)backupPath=resolve(sourcePath)+'.before-postgres-'+Date.now()+'-'+randomUUID().slice(0,8)+'.sqlite';
  mkdirSync(dirname(backupPath),{recursive:true});await backup(source,backupPath);
  const snapshot=new DatabaseSync(backupPath,{readOnly:true});
  let data;
  try {
   if(snapshot.prepare('PRAGMA foreign_key_check').all().length)throw Error('源数据库有关联错误，未执行导入');
   data=Object.fromEntries(tables.map(table=>[table,snapshot.prepare('SELECT * FROM '+table).all()]));
  } finally {snapshot.close();}
  const counts=await db.transaction(async tx=>{
   await tx.query('LOCK TABLE '+tables.join(',')+' IN SHARE ROW EXCLUSIVE MODE');
   for(const table of tables)if((await tx.get('SELECT COUNT(*)::integer AS n FROM '+table)).n)throw Error('目标库已有业务数据，拒绝覆盖；请使用空数据库');
   const result={};
   for(const table of tables){
    const columns=(await tx.all('SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 ORDER BY ordinal_position',[table])).map(row=>row.column_name);
    for(const original of data[table]){
     const row={...original};
     if(table==='users'){
      row.role=({reader:'user',staff:'stuff',manager:'stuff'})[row.role]||row.role;
      if(row.is_active===undefined)row.is_active=1;
      row.email=row.email.toLowerCase();
     }
     const fields=columns.filter(column=>row[column]!==undefined);
     const sql='INSERT INTO '+table+' ('+fields.join(',')+') VALUES ('+fields.map((_,i)=>'$'+(i+1)).join(',')+')';
     await tx.run(sql,fields.map(column=>row[column]));
    }
    result[table]=(await tx.get('SELECT COUNT(*)::integer AS n FROM '+table)).n;
    if(result[table]!==data[table].length)throw Error('导入数量校验失败：'+table);
   }
   const overCapacity=await tx.get(`SELECT a.id FROM activities a JOIN registrations r ON r.activity_id=a.id
    WHERE r.status IN ('confirmed','checked_in') GROUP BY a.id,a.capacity HAVING SUM(r.headcount)>a.capacity LIMIT 1`);
   if(overCapacity)throw Error('源数据存在超额报名，导入已回滚，请先核对源记录');
   return result;
  });
  return {backupPath,counts};
 }finally{source.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 let db;
 try{
  db=await openDatabase(undefined,{seed:false});
  const result=await importSqlite(db,process.argv[2]||resolve(projectRoot,'data/sanlian.sqlite'));
  console.log('SQLite 只读备份与 PostgreSQL 导入完成。备份：'+result.backupPath);
  console.log(JSON.stringify(result.counts));
 }catch(error){console.error(error.code?'迁移未完成，事务已回滚：'+error.code:error.message);process.exitCode=1;}
 finally{if(db)await db.close();}
}
