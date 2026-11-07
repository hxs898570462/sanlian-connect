import pg from 'pg';
import './config.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scoreContent } from './feedback-scoring.js';
export const projectRoot=fileURLToPath(new URL('../',import.meta.url));
pg.types.setTypeParser(1184,value=>new Date(value).toISOString());
function queries(executor) {
 return {
  query:(sql,args=[])=>executor.query(sql,args),
  async get(sql,args=[]) {return (await executor.query(sql,args)).rows[0];},
  async all(sql,args=[]) {return (await executor.query(sql,args)).rows;},
  async run(sql,args=[]) {return (await executor.query(sql,args)).rowCount;}
 };
}
export async function openDatabase(connectionString=process.env.DATABASE_URL,{seed=process.env.SEED_DEMO==='true',schema}={}) {
 if(!connectionString) throw Error('缺少 DATABASE_URL。请先运行 npm run db:local 或配置 PostgreSQL 连接串。');
 if(schema&&!/^[a-z][a-z0-9_]*$/.test(schema))throw Error('数据库 schema 名称无效');
 const pool=new pg.Pool({connectionString,max:10,connectionTimeoutMillis:10000,...(schema?{options:`-c search_path=${schema}`}:{})});
 pool.on('error',error=>console.error('PostgreSQL 空闲连接异常：',error.code||'CONNECTION_ERROR'));
 const db={...queries(pool),pool,
  async transaction(action) {
   const client=await pool.connect();
   try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const result=await action(queries(client));
    await client.query('COMMIT');return result;
   }catch(error){await client.query('ROLLBACK');throw error;}
   finally{client.release();}
  }, close:()=>pool.end()
 };
 try{
  // v3/v4 迁移会为反馈/建议补打分列与优质标签；仅对升级上来的旧库回填存量数据，新库表为空无需回填。
  const upgraded=(await db.get("SELECT COUNT(*)::integer AS n FROM information_schema.columns WHERE table_name='suggestions' AND column_name='score'")).n===0;
  const rescored=(await db.get("SELECT COUNT(*)::integer AS n FROM information_schema.columns WHERE table_name='suggestions' AND column_name='score_quality'")).n===0;
  await db.transaction(async tx=>{
   await tx.query('SELECT pg_advisory_xact_lock(20261030,1)');
   await tx.query(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
   if(seed&&(await tx.get('SELECT COUNT(*)::integer AS n FROM activities')).n===0)await seedDemo(tx);
   if(upgraded||rescored)await backfillScores(tx);
  });
  return db;
 }catch(error){await pool.end();throw error;}
}
async function backfillScores(tx){
 for(const row of await tx.all('SELECT id,content,rating FROM feedbacks')){
  const scored=scoreContent(row.content,{rating:row.rating});
  await tx.run('UPDATE feedbacks SET score=$1,score_level=$2,score_hits=$3,score_quality=$4 WHERE id=$5',[scored.score,scored.level,scored.hits.join(' '),scored.quality.tags.join(' '),row.id]);
 }
 for(const row of await tx.all('SELECT id,content FROM suggestions')){
  const scored=scoreContent(row.content);
  await tx.run('UPDATE suggestions SET score=$1,score_level=$2,score_hits=$3,score_quality=$4 WHERE id=$5',[scored.score,scored.level,scored.hits.join(' '),scored.quality.tags.join(' '),row.id]);
 }
}
async function seedDemo(tx) {
 const now=new Date().toISOString();
 const date=(days,hour=6)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+days);d.setUTCHours(hour,0,0,0);return d.toISOString();};
 const rows=[
 ['demo-reading','在字里行间，遇见另一种生活','读书会','带上最近在读的一本书，分享你的阅读故事。本地虚构活动。',7,24,'published'],
 ['demo-literature','从卡夫卡开始：城市与文学的对话','德语文学','一起阅读短篇，讨论城市与日常。本地虚构活动。',14,32,'published'],
 ['demo-family','把自然写进一本小书','亲子','用观察和手绘记录身边的自然。本地虚构活动。',28,16,'published'],
 ['demo-past','秋日阅读回顾','读书会','用于测试过去活动筛选的虚构活动。',-7,20,'published'],
 ['demo-far','下一季的阅读计划','新书分享','用于测试日期范围的虚构活动。',90,20,'published'],
 ['demo-draft','尚在筹备的分享会','讲座','用于测试草稿访问限制的虚构活动。',10,20,'draft']
 ];
 for(const [id,title,category,description,days,capacity,state] of rows)
 await tx.run(`INSERT INTO activities(id,title,category,description,start_time,end_time,location,capacity,fee_cents,publish_status,created_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10)`,[id,title,category,description,date(days),date(days,8),'太仓天镜湖店 · 阅读空间',capacity,state,now]);
 await tx.run(`INSERT INTO books(id,title,author,category,summary,recommendation_rank) VALUES
 ('demo-book-1','阅读与日常','示例作者','文学','虚构示例书目。',1),
 ('demo-book-2','湖边的自然笔记','示例作者','自然科学','虚构示例书目。',2) ON CONFLICT DO NOTHING`);
}
