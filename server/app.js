import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { projectRoot } from './db.js';
import { hashPassword,verifyPassword,publicUser,createSession,sessionMiddleware } from './auth.js';
import { registerAdminRoutes } from './admin.js';
import { activitySelect,privateRegistrations,lockActivity,enrollmentCount } from './queries.js';
import { httpConfig } from './config.js';

export const fail=(status,message)=>{const error=new Error(message);error.status=status;throw error;};
const text=(v,min,max,label)=>{
 if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)fail(400,`${label}需填写 ${min}–${max} 个字符`);return v.trim();
};
const integer=(v,min,max,label)=>{if(!Number.isInteger(v)||v<min||v>max)fail(400,`${label}超出允许范围`);return v;};
const isoDate=v=>{
 if(typeof v!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v)))fail(400,'时间需包含有效的时区');return new Date(v).toISOString();
};
const validatePhone=v=>{const phone=text(v,7,24,'联系电话');if(!/^\+?[\d ()-]{7,24}$/.test(phone)||phone.replace(/\D/g,'').length<7)fail(400,'联系电话格式不正确');return phone;};

export function createApp(db,{sessionCookie='sanlian_session',http=httpConfig()}={}) {
 const app=express();app.disable('x-powered-by');
 app.set('trust proxy',http.proxyHops);
 app.use(helmet({contentSecurityPolicy:{directives:{'upgrade-insecure-requests':http.production?[]:null}},strictTransportSecurity:http.production}));
 app.use((req,res,next)=>{
  // Validate the actual Host, never the client-supplied X-Forwarded-Host.
  const authority=req.get('host')?.toLowerCase();
  let url;try{url=new URL('http://'+authority);}catch{return res.status(403).json({error:'网站地址无效'});}
  if(url.host!==authority||url.username||url.password||url.pathname!=='/'||url.search||url.hash)
   return res.status(403).json({error:'网站地址无效'});
  if(http.origin?authority!==new URL(http.origin).host:!['localhost','127.0.0.1','[::1]'].includes(url.hostname))
   return res.status(403).json({error:'该网站地址未获允许'});
  if(!['GET','HEAD','OPTIONS'].includes(req.method)){
   const origin=req.get('origin');
   const expected=http.origin||`http://${authority}`;
   if(req.get('x-requested-with')!=='sanlian'||(http.production&&!origin)||(origin&&origin!==expected))return res.status(403).json({error:'请求来源无效，请刷新页面后重试'});
  }next();
 });
 app.use(express.json({limit:'32kb'}));
 app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');next();});
 app.use('/api',rateLimit({windowMs:60000,limit:240,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'操作过于频繁，请稍后重试'}}));
 app.use(sessionMiddleware(db,sessionCookie));
 const requireLogin=(req,res,next)=>{if(!req.user)return res.status(401).json({error:'请先登录'});next();};
 const requireManager=(req,res,next)=>{if(req.user?.role!=='stuff')return res.status(403).json({error:'需要管理员权限'});next();};
 const authLimit=rateLimit({windowMs:15*60000,limit:30,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'登录尝试过多，请稍后重试'}});
 const credentials=body=>{
  const email=text(body.email,3,254,'邮箱').toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'邮箱格式不正确');
  const password=body.password;if(typeof password!=='string'||password.length<12||password.length>128)fail(400,'密码长度需为 12–128 个字符');return {email,password};
 };
 app.get('/api/health',async(req,res)=>{await db.get('SELECT 1');res.json({status:'ok',storage:'postgresql',mode:http.production?'hosted':'local'});});
 app.get('/api/auth/me',(req,res)=>res.json({user:publicUser(req.user)}));
 app.post('/api/auth/register',authLimit,async(req,res)=>{
  const {email,password}=credentials(req.body||{}),name=text(req.body.name,1,60,'称呼'),hash=await hashPassword(password),id=randomUUID();
  const user=await db.transaction(async tx=>{
   const u=await tx.get('INSERT INTO users(id,email,name,password_hash,created_at) VALUES($1,$2,$3,$4,$5) RETURNING *',[id,email,name,hash,new Date().toISOString()]);
   if(req.sessionHash)await tx.run('DELETE FROM sessions WHERE token_hash=$1',[req.sessionHash]);
   await createSession(tx,id,res,sessionCookie,{secure:http.production});return u;
  });
  res.status(201).json({user:publicUser(user)});
 });
 app.post('/api/auth/login',authLimit,async(req,res)=>{
  const {email,password}=credentials(req.body||{}),candidate=await db.get('SELECT * FROM users WHERE lower(email)=lower($1)',[email]);
  if(!candidate||!await verifyPassword(password,candidate.password_hash))fail(401,'邮箱或密码不正确');
  const user=await db.transaction(async tx=>{
   const current=await tx.get('SELECT * FROM users WHERE id=$1 FOR SHARE',[candidate.id]);
   if(!current||current.password_hash!==candidate.password_hash)fail(401,'账号已变化，请重新登录');
   if(!current.is_active)fail(403,'账号已停用，请联系管理员');
   if(req.sessionHash)await tx.run('DELETE FROM sessions WHERE token_hash=$1',[req.sessionHash]);
   await createSession(tx,current.id,res,sessionCookie,{secure:http.production});return current;
  });res.json({user:publicUser(user)});
 });
 app.post('/api/auth/logout',async(req,res)=>{
  if(req.sessionHash)await db.run('DELETE FROM sessions WHERE token_hash=$1',[req.sessionHash]);
  res.clearCookie(sessionCookie,{path:'/'});res.json({ok:true});
 });
 app.get('/api/profile',requireLogin,(req,res)=>res.json({user:{...publicUser(req.user),created_at:req.user.created_at}}));
 app.patch('/api/profile',requireLogin,async(req,res)=>{
  if(!req.body||Array.isArray(req.body)||Object.keys(req.body).some(k=>k!=='name'))fail(400,'个人资料仅支持修改称呼');
  const name=text(req.body.name,1,60,'称呼');await db.run('UPDATE users SET name=$1 WHERE id=$2',[name,req.user.id]);res.json({user:publicUser({...req.user,name})});
 });
 app.get('/api/feedbacks',requireLogin,async(req,res)=>res.json({feedbacks:await db.all(`
 SELECT f.id,f.registration_id,f.rating,f.content,f.status,f.reply,f.created_at,a.title
 FROM feedbacks f JOIN activities a ON a.id=f.activity_id WHERE f.user_id=$1 ORDER BY f.created_at DESC,f.id`,[req.user.id])}));
 app.get('/api/activities',async(req,res)=>{
  const days=req.query.days===undefined?60:Number(req.query.days);integer(days,1,366,'日期范围');
  const q=typeof req.query.q==='string'?req.query.q.trim().slice(0,100):'',category=typeof req.query.category==='string'?req.query.category:'';
  const activities=await db.all(`${activitySelect} WHERE a.is_deleted=0 AND a.publish_status='published'
  AND a.start_time>=$1 AND a.start_time<$2 AND ($3='' OR strpos(a.title,$3)>0 OR strpos(a.description,$3)>0)
  AND ($4='' OR a.category=$4) ORDER BY a.start_time,a.id`,[new Date().toISOString(),new Date(Date.now()+days*86400000).toISOString(),q,category]);
  res.json({activities,window_days:days});
 });
 app.get('/api/activities/:id',async(req,res)=>{
  const activity=await db.get(`${activitySelect} WHERE a.id=$1 AND a.is_deleted=0 AND a.publish_status='published'`,[req.params.id]);
  if(!activity)fail(404,'活动不存在或尚未发布');res.json({activity});
 });
 app.get('/api/registrations',requireLogin,async(req,res)=>res.json({registrations:await db.all(privateRegistrations,[req.user.id])}));
 app.post('/api/registrations',requireLogin,async(req,res)=>{
  const b=req.body||{},name=text(b.attendee_name,1,60,'参加者姓名'),phone=validatePhone(b.phone);
  if(b.privacy_consent!==true)fail(400,'请同意将报名资料用于本次活动联系');
  if(typeof b.activity_id!=='string')fail(400,'缺少活动编号');
  const id=randomUUID();
  const registration=await db.transaction(async tx=>{
   const a=await lockActivity(tx,b.activity_id);
   if(!a||a.is_deleted||a.publish_status!=='published')fail(404,'活动不存在或尚未发布');
   const now=new Date().toISOString();if(a.start_time<=now)fail(409,'活动已开始，无法报名');
   if(await tx.get("SELECT id FROM registrations WHERE user_id=$1 AND activity_id=$2 AND status IN ('confirmed','checked_in')",[req.user.id,a.id]))fail(409,'你已报名该活动');
   if(await enrollmentCount(tx,a.id)>=a.capacity)fail(409,'活动名额已满');
   await tx.run(`INSERT INTO registrations(id,user_id,activity_id,attendee_name,phone,ticket_code,status,privacy_consent,privacy_consent_at,created_at)
   VALUES($1,$2,$3,$4,$5,$6,'confirmed',1,$7,$7)`,[id,req.user.id,a.id,name,phone,`SL-${randomUUID()}`,now]);
   return (await tx.all(privateRegistrations,[req.user.id])).find(r=>r.id===id);
  });res.status(201).json({registration});
 });
 app.post('/api/registrations/:id/cancel',requireLogin,async(req,res)=>{
  await db.transaction(async tx=>{
   const ref=await tx.get('SELECT activity_id FROM registrations WHERE id=$1 AND user_id=$2',[req.params.id,req.user.id]);if(!ref)fail(404,'报名不存在');
   const a=await lockActivity(tx,ref.activity_id);
   const r=await tx.get('SELECT * FROM registrations WHERE id=$1 AND user_id=$2 FOR UPDATE',[req.params.id,req.user.id]);
   const now=new Date().toISOString();if(r.status!=='confirmed'||a.start_time<=now)fail(409,'该报名当前无法取消');
   await tx.run("UPDATE registrations SET status='cancelled',cancelled_at=$1 WHERE id=$2",[now,r.id]);
  });res.json({ok:true});
 });
 app.get('/api/books',async(req,res)=>{
  const q=typeof req.query.q==='string'?req.query.q.slice(0,100):'';
  res.json({books:await db.all("SELECT id,title,author,category,summary,isbn,price_cents FROM books WHERE $1='' OR strpos(title,$1)>0 OR strpos(author,$1)>0 ORDER BY recommendation_rank,title",[q])});
 });
 app.post('/api/feedbacks',requireLogin,async(req,res)=>{
  const b=req.body||{},content=text(b.content,5,2000,'反馈内容');integer(b.rating,1,5,'评分');if(typeof b.registration_id!=='string')fail(400,'请选择报名记录');
  await db.transaction(async tx=>{
   const ref=await tx.get('SELECT activity_id FROM registrations WHERE id=$1 AND user_id=$2',[b.registration_id,req.user.id]);if(!ref)fail(403,'仅可评价本人已报名且已结束的活动');
   const a=await lockActivity(tx,ref.activity_id);
   const r=await tx.get('SELECT * FROM registrations WHERE id=$1 AND user_id=$2 FOR UPDATE',[b.registration_id,req.user.id]);
   if(!['confirmed','checked_in'].includes(r.status)||a.end_time>new Date().toISOString())fail(403,'仅可评价本人已报名且已结束的活动');
   await tx.run('INSERT INTO feedbacks(id,user_id,activity_id,registration_id,rating,content,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),req.user.id,a.id,r.id,b.rating,content,new Date().toISOString()]);
  });res.status(201).json({ok:true});
 });
 registerAdminRoutes(app,db,{requireLogin,requireManager,fail,text,integer,isoDate,validatePhone,activitySelect});
 app.use('/api',(req,res)=>res.status(404).json({error:'接口不存在'}));
 app.use(express.static(resolve(projectRoot,'public'),{index:'index.html'}));
 app.use((req,res)=>res.status(404).type('text').send('页面不存在'));
 app.use((error,req,res,next)=>{
  if(error.code==='23505')return res.status(409).json({error: error.constraint==='users_email_unique'?'该邮箱已被使用':error.constraint==='feedbacks_registration_id_key'?'该报名已提交反馈':'记录已存在，请勿重复提交'});
  if(['40001','40P01','55P03'].includes(error.code))return res.status(409).json({error:'记录正在更新，请刷新后重试'});
  if(['23503','23514'].includes(error.code))return res.status(400).json({error:'数据关联或约束不符合要求'});
  const code=error.status||503;if(!error.status)console.error('请求失败：',error.code||'DATABASE_ERROR');
  res.status(code).json({error:error.status?(error.type==='entity.parse.failed'?'请求格式不正确':error.message):'服务暂时不可用，请稍后重试'});
 });return app;
}
