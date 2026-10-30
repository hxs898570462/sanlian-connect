import pg from 'pg';
import {request} from 'node:http';
import {parseEnv,isDeepStrictEqual} from 'node:util';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';

export const tables=['users','activities','registrations','feedbacks','books','operation_logs','sessions'];
const allTables=[...tables,'schema_migrations'];
const schemaSql=readFileSync(new URL('../server/schema.sql',import.meta.url),'utf8');
const snapshotSql='SELECT '+allTables.map(t=>`(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY ${t==='schema_migrations'?'version':t==='sessions'?'token_hash':'id'}),'[]'::jsonb) FROM public.${t} r) AS ${t}`).join(',');
const columnsSql=`SELECT table_name,column_name,udt_name,is_nullable FROM information_schema.columns
 WHERE table_schema='public' AND table_name=ANY($1) ORDER BY table_name,ordinal_position`;

export async function snapshot(client) {
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{
  await client.query("SET LOCAL TIME ZONE 'UTC'");
  const data={format:'sanlian-postgres-snapshot-v2',createdAt:new Date().toISOString(),schemaSql,
   columns:(await client.query(columnsSql,[allTables])).rows,tables:(await client.query(snapshotSql)).rows[0]};
  await client.query('COMMIT');return data;
 }catch(e){await client.query('ROLLBACK');throw e;}
}
export function counts(s){return Object.fromEntries(allTables.map(t=>[t,s.tables[t].length]));}

export function assertSeedOnly(s) {
 for(const t of ['users','registrations','feedbacks','operation_logs','sessions'])
  if(s.tables[t].length)throw Error('TARGET_HAS_BUSINESS_DATA');
 const expected=[
  ['demo-reading','在字里行间，遇见另一种生活','读书会','带上最近在读的一本书，分享你的阅读故事。本地虚构活动。',7,24,'published'],
  ['demo-literature','从卡夫卡开始：城市与文学的对话','德语文学','一起阅读短篇，讨论城市与日常。本地虚构活动。',14,32,'published'],
  ['demo-family','把自然写进一本小书','亲子','用观察和手绘记录身边的自然。本地虚构活动。',28,16,'published'],
  ['demo-past','秋日阅读回顾','读书会','用于测试过去活动筛选的虚构活动。',-7,20,'published'],
  ['demo-far','下一季的阅读计划','新书分享','用于测试日期范围的虚构活动。',90,20,'published'],
  ['demo-draft','尚在筹备的分享会','讲座','用于测试草稿访问限制的虚构活动。',10,20,'draft']
 ];
 if(s.tables.activities.length){
  if(s.tables.activities.length!==expected.length)throw Error('TARGET_ACTIVITIES_NOT_PRISTINE_SEED');
  for(const [id,title,category,description,days,capacity,publish_status] of expected){
   const row=s.tables.activities.find(r=>r.id===id);if(!row)throw Error('TARGET_ACTIVITIES_NOT_PRISTINE_SEED');
   const start=new Date(row.created_at);start.setUTCDate(start.getUTCDate()+days);start.setUTCHours(6,0,0,0);
   const end=new Date(start);end.setUTCHours(8);
   const fixed={id,source_id:null,title,category,description,location:'太仓天镜湖店 · 阅读空间',capacity,
    fee_cents:0,publish_status,is_deleted:0,created_by:null};
   if(Object.entries(fixed).some(([k,v])=>row[k]!==v)||Date.parse(row.start_time)!==+start||Date.parse(row.end_time)!==+end)
    throw Error('TARGET_ACTIVITIES_NOT_PRISTINE_SEED');
  }
 }
 if(s.tables.books.length){
  const expectedBooks=[{id:'demo-book-1',source_id:null,title:'阅读与日常',author:'示例作者',category:'文学',summary:'虚构示例书目。',isbn:null,price_cents:null,recommendation_rank:1},
   {id:'demo-book-2',source_id:null,title:'湖边的自然笔记',author:'示例作者',category:'自然科学',summary:'虚构示例书目。',isbn:null,price_cents:null,recommendation_rank:2}];
  if(!isDeepStrictEqual(s.tables.books,expectedBooks))throw Error('TARGET_BOOKS_NOT_PRISTINE_SEED');
 }
}

export async function transfer(client,source,expectedTarget) {
 assertSeedOnly(expectedTarget);
 if(!isDeepStrictEqual(source.columns,expectedTarget.columns))throw Error('SCHEMA_COLUMNS_DIFFER');
 if(!isDeepStrictEqual(source.tables.schema_migrations.map(r=>r.version),expectedTarget.tables.schema_migrations.map(r=>r.version)))throw Error('SCHEMA_VERSIONS_DIFFER');
 await client.query('BEGIN');
 try{
  await client.query("SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='45s'; SET LOCAL TIME ZONE 'UTC'");
  await client.query('SELECT pg_advisory_xact_lock(20261030,1)');
  await client.query('SELECT pg_advisory_xact_lock(20261030,2)');
  await client.query('LOCK TABLE '+tables.map(t=>'public.'+t).join(',')+' IN SHARE ROW EXCLUSIVE MODE');
  const current=(await client.query(snapshotSql)).rows[0];
  if(!isDeepStrictEqual(current,expectedTarget.tables))throw Error('TARGET_CHANGED_SINCE_BACKUP');
  const columns=(await client.query(columnsSql,[allTables])).rows;
  if(!isDeepStrictEqual(columns,source.columns))throw Error('SCHEMA_CHANGED_SINCE_BACKUP');
  // Only the verified default demo rows are replaceable; no user/business rows are removed.
  await client.query('DELETE FROM public.books');await client.query('DELETE FROM public.activities');
  for(const table of tables){
   const fields=source.columns.filter(c=>c.table_name===table).map(c=>c.column_name);
   if(fields.some(c=>!/^\w+$/.test(c)))throw Error('INVALID_COLUMN_NAME');
   if(!source.tables[table].length)continue;
   // jsonb_populate_recordset preserves NULLs, bigint values, hashes and timestamptz precision.
   await client.query(`INSERT INTO public.${table} (${fields.join(',')}) SELECT ${fields.join(',')} FROM jsonb_populate_recordset(NULL::public.${table},$1::jsonb)`,[JSON.stringify(source.tables[table])]);
  }
  const over=await client.query(`SELECT a.id FROM activities a JOIN registrations r ON r.activity_id=a.id
   WHERE r.status IN ('confirmed','checked_in') GROUP BY a.id,a.capacity HAVING sum(r.headcount)>a.capacity LIMIT 1`);
  if(over.rowCount)throw Error('SOURCE_OVER_CAPACITY');
  const copied=(await client.query(snapshotSql)).rows[0];
  for(const t of tables)if(!isDeepStrictEqual(copied[t],source.tables[t]))throw Error('COPY_VERIFICATION_FAILED');
  await client.query('COMMIT');return counts(source);
 }catch(e){await client.query('ROLLBACK');throw e;}
}

export async function connectDatabase(connectionString,proxy) {
 let stream;
 if(proxy){
  const u=new URL(connectionString),p=new URL(proxy);
  if(p.protocol!=='http:'||!['127.0.0.1','localhost'].includes(p.hostname)||p.username||p.password)throw Error('ONLY_LOCAL_SYSTEM_HTTP_PROXY_ALLOWED');
  stream=await new Promise((accept,reject)=>{
   const req=request({host:p.hostname,port:Number(p.port||80),method:'CONNECT',path:u.hostname+':'+(u.port||5432)});
   req.setTimeout(15000,()=>req.destroy(Error('PROXY_TIMEOUT')));req.on('error',reject);
   req.on('connect',(res,socket,head)=>{if(res.statusCode!==200){socket.destroy();reject(Error('PROXY_REJECTED'));return;}
    socket.setTimeout(0);if(head.length)socket.unshift(head);accept(socket);});req.end();
  });
  stream.connect=()=>{queueMicrotask(()=>stream.emit('connect'));return stream;};
 }
 const client=new pg.Client({connectionString,stream,connectionTimeoutMillis:20000,query_timeout:60000});
 try{await client.connect();return client;}catch(e){stream?.destroy();await client.end().catch(()=>{});throw e;}
}
function backup(s,label){
 const directory=resolve('data/backups');mkdirSync(directory,{recursive:true});
 const path=resolve(directory,label+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8)+'.json');
 const data=JSON.stringify(s);writeFileSync(path,data,{encoding:'utf8',flag:'wx'});
 if(createHash('sha256').update(readFileSync(path)).digest('hex')!==createHash('sha256').update(data).digest('hex'))throw Error('BACKUP_VERIFICATION_FAILED');
 return path;
}
async function main(){
 let source,target;
 try{
  const sourceUrl=new URL(parseEnv(readFileSync('.env','utf8')).DATABASE_URL);
  const targetUrl=new URL(parseEnv(readFileSync('.env.cloud','utf8')).DATABASE_URL);
  if(!['127.0.0.1','localhost','[::1]'].includes(sourceUrl.hostname))throw Error('SOURCE_MUST_BE_LOCAL');
  if(!targetUrl.hostname.endsWith('.neon.tech')||targetUrl.hostname.includes('-pooler')||!targetUrl.searchParams.has('sslmode'))throw Error('TARGET_MUST_BE_DIRECT_NEON_TLS');
  targetUrl.searchParams.set('sslmode','verify-full');
  const arg=process.argv.indexOf('--proxy');const proxy=arg<0?undefined:process.argv[arg+1];
  source=await connectDatabase(sourceUrl.toString());target=await connectDatabase(targetUrl.toString(),proxy);
  const sourceData=await snapshot(source),targetData=await snapshot(target);assertSeedOnly(targetData);
  console.log(JSON.stringify({sourceCounts:counts(sourceData),targetCounts:counts(targetData),targetIsEmptyOrPristineSeed:true}));
  const paths={source:backup(sourceData,'local-before-neon'),target:backup(targetData,'neon-before-import')};
  console.log(JSON.stringify({backups:paths}));
  if(!process.argv.includes('--apply')){console.log('AUDIT_ONLY_NO_CLOUD_WRITES');return;}
  await transfer(target,sourceData,targetData);
  await target.end();target=null;
  target=await connectDatabase(targetUrl.toString(),proxy);
  const persisted=await snapshot(target),stillLocal=await snapshot(source);
  for(const t of tables){if(!isDeepStrictEqual(persisted.tables[t],sourceData.tables[t]))throw Error('POST_COMMIT_VERIFICATION_FAILED');
   if(!isDeepStrictEqual(stillLocal.tables[t],sourceData.tables[t]))throw Error('LOCAL_CHANGED_DURING_MIGRATION');}
  console.log(JSON.stringify({migration:'committed',reconnectedAndVerified:true,sourceUnchanged:true,counts:counts(persisted)}));
 }catch(e){console.error('Migration not confirmed:',e.code||(/^[A-Z_]+$/.test(e.message)?e.message:'CONNECTION_OR_CONFIGURATION_ERROR'));process.exitCode=1;}
 finally{await source?.end();await target?.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
