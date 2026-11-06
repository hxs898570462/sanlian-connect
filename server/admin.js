import {randomUUID} from 'node:crypto';
import {lockActivity,enrollmentCount} from './queries.js';
import {SCORE_LEVELS} from './feedback-scoring.js';

export function registerAdminRoutes(app,db,h) {
 const {requireLogin,requireManager,fail,text,integer,isoDate,validatePhone,activitySelect}=h;
 app.use('/api/admin',requireLogin,requireManager);
 const audit=(tx,actor,action,target)=>tx.run('INSERT INTO operation_logs VALUES($1,$2,$3,$4,$5)',[randomUUID(),actor,action,target,new Date().toISOString()]);
 // Serialize permission edits and recheck the actor AFTER waiting, avoiding cross-demotion races.
 const adminTx=(req,action)=>db.transaction(async tx=>{
  await tx.query('SELECT pg_advisory_xact_lock(20261030,2)');
  const actor=await tx.get(`SELECT u.id FROM users u JOIN sessions s ON s.user_id=u.id
   WHERE u.id=$1 AND u.role='stuff' AND u.is_active=1 AND s.token_hash=$2 AND s.expires_at>$3 FOR SHARE OF u`,[req.user.id,req.sessionHash,Date.now()]);
  if(!actor)fail(403,'管理员身份已变化，请重新登录');
  return action(tx);
 });
 const allowedBody=(body,fields)=>{
  if(!body||typeof body!=='object'||Array.isArray(body)||!Object.keys(body).length||Object.keys(body).some(k=>!fields.includes(k)))fail(400,'修改字段不受支持');return body;
 };
 function page(req) {
  const limit=req.query.limit===undefined?25:Number(req.query.limit),offset=req.query.offset===undefined?0:Number(req.query.offset);
  integer(limit,1,100,'每页条数');integer(offset,0,10000000,'页码');
  return {limit,offset,q:typeof req.query.q==='string'?req.query.q.trim().slice(0,100):'',priority:typeof req.query.priority==='string'?req.query.priority:''};
 }
 // 动态总分 = 静态规则分 + SLA 等待加成（待处理超 24h +4、超 48h +8），与 server/feedback-scoring.js 一致。
 const scoreTotal=alias=>`${alias}.score + CASE WHEN ${alias}.status='pending' AND now() >= ${alias}.created_at + interval '24 hours' THEN CASE WHEN now() >= ${alias}.created_at + interval '48 hours' THEN 8 ELSE 4 END ELSE 0 END`;
 // 动态优先级筛选：安全硬升级优先于分数阈值。
 const priorityWhere=(alias,param)=>`(${param}='' OR (${param}='high' AND (${scoreTotal(alias)}>=60 OR ${alias}.score_level='high')) OR (${param}='mid' AND ${scoreTotal(alias)}>=30 AND ${scoreTotal(alias)}<60 AND ${alias}.score_level<>'high') OR (${param}='low' AND ${scoreTotal(alias)}<30 AND ${alias}.score_level<>'high'))`;
 const checkPriority=priority=>{if(priority&&!SCORE_LEVELS.includes(priority))fail(400,'优先级筛选无效');};
 app.get('/api/admin/summary',async(req,res)=>res.json({summary:await db.get(`SELECT
 (SELECT COUNT(*)::integer FROM users) AS users,
 (SELECT COUNT(*)::integer FROM users WHERE role='stuff' AND is_active=1) AS administrators,
 (SELECT COUNT(*)::integer FROM activities WHERE is_deleted=0) AS activities,
 (SELECT COUNT(*)::integer FROM registrations WHERE status IN ('confirmed','checked_in')) AS registrations,
 (SELECT COUNT(*)::integer FROM feedbacks WHERE status IN ('pending','processing')) AS pending_feedbacks,
 (SELECT COUNT(*)::integer FROM suggestions WHERE status IN ('pending','processing')) AS pending_suggestions,
 (SELECT COUNT(*)::integer FROM (
   SELECT 1 FROM feedbacks f WHERE f.status IN ('pending','processing') AND (f.score_level='high' OR ${scoreTotal('f')}>=60)
   UNION ALL SELECT 1 FROM suggestions s WHERE s.status IN ('pending','processing') AND (s.score_level='high' OR ${scoreTotal('s')}>=60)
 ) high) AS high_priority`)}));
 app.get('/api/admin/users',async(req,res)=>{
  const {limit,offset,q}=page(req),where="($1='' OR strpos(u.name,$1)>0 OR strpos(lower(u.email),lower($1))>0)";
  const users=await db.all(`SELECT u.id,u.email,u.name,u.role,u.is_active,u.created_at,
  (SELECT COUNT(*)::integer FROM registrations r WHERE r.user_id=u.id) AS registration_count,
  (SELECT COUNT(*)::integer FROM feedbacks f WHERE f.user_id=u.id) AS feedback_count
  FROM users u WHERE ${where} ORDER BY u.created_at DESC,u.id LIMIT $2 OFFSET $3`,[q,limit,offset]);
  const total=(await db.get(`SELECT COUNT(*)::integer AS n FROM users u WHERE ${where}`,[q])).n;
  res.json({users,total,limit,offset});
 });
 app.patch('/api/admin/users/:id',async(req,res)=>{
  const b=allowedBody(req.body,['name','email','role','is_active']);
  const result=await adminTx(req,async tx=>{
   const u=await tx.get('SELECT * FROM users WHERE id=$1 FOR UPDATE',[req.params.id]);if(!u)fail(404,'用户不存在');
   const name=b.name===undefined?u.name:text(b.name,1,60,'称呼'),email=b.email===undefined?u.email:text(b.email,3,254,'邮箱').toLowerCase();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'邮箱格式不正确');
   const role=b.role===undefined?u.role:b.role,active=b.is_active===undefined?u.is_active:b.is_active;
   if(!['user','stuff'].includes(role))fail(400,'用户组需为 user 或 stuff');integer(active,0,1,'账号状态');
   if(u.id===req.user.id&&(role!=='stuff'||!active))fail(409,'不能停用或降级当前登录的管理员');
   if(u.role==='stuff'&&u.is_active&&(role!=='stuff'||!active)&&(await tx.get("SELECT COUNT(*)::integer AS n FROM users WHERE role='stuff' AND is_active=1")).n<=1)fail(409,'至少需要保留一位启用的管理员');
   if(await tx.get('SELECT id FROM users WHERE lower(email)=lower($1) AND id<>$2',[email,u.id]))fail(409,'该邮箱已被其他账号使用');
   await tx.run('UPDATE users SET name=$1,email=$2,role=$3,is_active=$4 WHERE id=$5',[name,email,role,active,u.id]);
   const revoked=role!==u.role||active!==u.is_active||email!==u.email;
   if(revoked)await tx.run('DELETE FROM sessions WHERE user_id=$1',[u.id]);
   await audit(tx,req.user.id,'update_user',u.id);return {id:u.id,name,email,role,is_active:active,sessions_revoked:revoked};
  });res.json({user:result});
 });
 app.get('/api/admin/registrations',async(req,res)=>{
  const {limit,offset,q}=page(req),state=typeof req.query.status==='string'?req.query.status:'';
  if(state&&!['confirmed','cancelled','checked_in'].includes(state))fail(400,'报名状态无效');
  const from='FROM registrations r JOIN users u ON u.id=r.user_id JOIN activities a ON a.id=r.activity_id';
  const where="($1='' OR strpos(r.attendee_name,$1)>0 OR strpos(r.phone,$1)>0 OR strpos(lower(u.email),lower($1))>0 OR strpos(a.title,$1)>0) AND ($2='' OR r.status=$2)";
  const registrations=await db.all(`SELECT r.id,r.user_id,r.activity_id,r.attendee_name,r.phone,r.headcount,r.ticket_code,r.status,r.created_at,r.checked_in_at,r.cancelled_at,u.email,u.name AS user_name,a.title,a.start_time ${from} WHERE ${where} ORDER BY r.created_at DESC,r.id LIMIT $3 OFFSET $4`,[q,state,limit,offset]);
  const total=(await db.get(`SELECT COUNT(*)::integer AS n ${from} WHERE ${where}`,[q,state])).n;res.json({registrations,total,limit,offset});
 });
 app.patch('/api/admin/registrations/:id',async(req,res)=>{
  const b=allowedBody(req.body,['attendee_name','phone','status']);
  await adminTx(req,async tx=>{
   const ref=await tx.get('SELECT activity_id FROM registrations WHERE id=$1',[req.params.id]);if(!ref)fail(404,'报名不存在');
   const a=await lockActivity(tx,ref.activity_id),r=await tx.get('SELECT * FROM registrations WHERE id=$1 FOR UPDATE',[req.params.id]);
   const name=b.attendee_name===undefined?r.attendee_name:text(b.attendee_name,1,60,'参加者姓名'),phone=b.phone===undefined?r.phone:validatePhone(b.phone);
   const state=b.status===undefined?r.status:b.status,now=new Date().toISOString();
   if(!['confirmed','cancelled','checked_in'].includes(state))fail(400,'报名状态无效');
   if(state==='checked_in'&&state!==r.status&&a.start_time>now)fail(409,'活动尚未开始，暂不能签到');
   if(state!=='cancelled'&&r.status==='cancelled'){
    if(await tx.get("SELECT id FROM registrations WHERE user_id=$1 AND activity_id=$2 AND id<>$3 AND status IN ('confirmed','checked_in')",[r.user_id,a.id,r.id]))fail(409,'该用户已有另一条有效报名');
    if(await enrollmentCount(tx,a.id)+r.headcount>a.capacity)fail(409,'活动名额已满，不能恢复报名');
   }
   await tx.run('UPDATE registrations SET attendee_name=$1,phone=$2,status=$3,cancelled_at=$4,checked_in_at=$5 WHERE id=$6',[name,phone,state,state==='cancelled'?(r.cancelled_at||now):null,state==='checked_in'?(r.checked_in_at||now):null,r.id]);
   await audit(tx,req.user.id,'update_registration',r.id);
  });res.json({ok:true});
 });
 app.get('/api/admin/feedbacks',async(req,res)=>{
  const {limit,offset,q,priority}=page(req),state=typeof req.query.status==='string'?req.query.status:'';
  if(state&&!['pending','processing','replied','closed'].includes(state))fail(400,'反馈状态无效');
  checkPriority(priority);
  const from='FROM feedbacks f JOIN users u ON u.id=f.user_id JOIN activities a ON a.id=f.activity_id';
  const where=`($1='' OR strpos(f.content,$1)>0 OR strpos(lower(u.email),lower($1))>0 OR strpos(a.title,$1)>0) AND ($2='' OR f.status=$2) AND ${priorityWhere('f','$3')}`;
  const order=`ORDER BY ${scoreTotal('f')} DESC,f.created_at DESC,f.id`;
  const feedbacks=await db.all(`SELECT f.id,f.registration_id,f.rating,f.content,f.status,f.reply,f.created_at,f.score,f.score_level,f.score_hits,${scoreTotal('f')} AS total_score,u.id AS user_id,u.name AS user_name,u.email,a.title ${from} WHERE ${where} ${order} LIMIT $4 OFFSET $5`,[q,state,priority,limit,offset]);
  const total=(await db.get(`SELECT COUNT(*)::integer AS n ${from} WHERE ${where}`,[q,state,priority])).n;res.json({feedbacks,total,limit,offset});
 });
 app.patch('/api/admin/feedbacks/:id',async(req,res)=>{
  const b=allowedBody(req.body,['status','reply']);
  await adminTx(req,async tx=>{
   const f=await tx.get('SELECT * FROM feedbacks WHERE id=$1 FOR UPDATE',[req.params.id]);if(!f)fail(404,'反馈不存在');
   const state=b.status===undefined?f.status:b.status,reply=b.reply===undefined?(f.reply||''):typeof b.reply==='string'?b.reply.trim():null;
   if(!['pending','processing','replied','closed'].includes(state))fail(400,'反馈状态无效');
   if(reply===null||reply.length>2000)fail(400,'回复不能超过 2000 个字符');
   if(state==='replied'&&!reply)fail(400,'标记为已回复前请填写回复内容');
   await tx.run('UPDATE feedbacks SET status=$1,reply=$2 WHERE id=$3',[state,reply,f.id]);await audit(tx,req.user.id,'update_feedback',f.id);
  });res.json({ok:true});
 });
app.get('/api/admin/suggestions',async(req,res)=>{
 const {limit,offset,q,priority}=page(req),state=typeof req.query.status==='string'?req.query.status:'';
 if(state&&!['pending','processing','replied','closed'].includes(state))fail(400,'建议状态无效');
 checkPriority(priority);
 const from='FROM suggestions s JOIN users u ON u.id=s.user_id';
 const where=`($1='' OR strpos(s.content,$1)>0 OR strpos(lower(u.email),lower($1))>0 OR strpos(u.name,$1)>0) AND ($2='' OR s.status=$2) AND ${priorityWhere('s','$3')}`;
 const order=`ORDER BY ${scoreTotal('s')} DESC,s.created_at DESC,s.id`;
 const suggestions=await db.all(`SELECT s.id,s.user_id,s.content,s.status,s.reply,s.created_at,s.score,s.score_level,s.score_hits,${scoreTotal('s')} AS total_score,u.name AS user_name,u.email ${from} WHERE ${where} ${order} LIMIT $4 OFFSET $5`,[q,state,priority,limit,offset]);
 const total=(await db.get(`SELECT COUNT(*)::integer AS n ${from} WHERE ${where}`,[q,state,priority])).n;res.json({suggestions,total,limit,offset});
});
app.patch('/api/admin/suggestions/:id',async(req,res)=>{
  const b=allowedBody(req.body,['status','reply']);
  await adminTx(req,async tx=>{
   const s=await tx.get('SELECT * FROM suggestions WHERE id=$1 FOR UPDATE',[req.params.id]);if(!s)fail(404,'建议不存在');
   const state=b.status===undefined?s.status:b.status,reply=b.reply===undefined?(s.reply||''):typeof b.reply==='string'?b.reply.trim():null;
   if(!['pending','processing','replied','closed'].includes(state))fail(400,'建议状态无效');
   if(reply===null||reply.length>2000)fail(400,'回复不能超过 2000 个字符');
   if(state==='replied'&&!reply)fail(400,'标记为已回复前请填写回复内容');
   await tx.run('UPDATE suggestions SET status=$1,reply=$2 WHERE id=$3',[state,reply,s.id]);await audit(tx,req.user.id,'update_suggestion',s.id);
  });res.json({ok:true});
});
app.get('/api/admin/activities',async(req,res)=>res.json({activities:await db.all(`${activitySelect} WHERE a.is_deleted=0 ORDER BY a.created_at DESC,a.id`)}));
 app.post('/api/admin/activities',async(req,res)=>{
  const b=req.body||{},title=text(b.title,2,100,'活动标题'),category=text(b.category,1,30,'分类'),description=text(b.description,5,5000,'活动说明'),location=text(b.location,2,120,'地点');
  const start=isoDate(b.start_time),end=isoDate(b.end_time);if(end<=start||start<=new Date().toISOString())fail(400,'请设置未来的开始时间，结束时间需晚于开始时间');
  integer(b.capacity,1,10000,'容量');integer(b.fee_cents,0,10000000,'费用');if(!['draft','published'].includes(b.publish_status))fail(400,'发布状态不正确');
  const id=randomUUID();await adminTx(req,async tx=>{
   await tx.run('INSERT INTO activities(id,title,category,description,start_time,end_time,location,capacity,fee_cents,publish_status,created_by,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[id,title,category,description,start,end,location,b.capacity,b.fee_cents,b.publish_status,req.user.id,new Date().toISOString()]);
   await audit(tx,req.user.id,'create_activity',id);
  });res.status(201).json({id});
 });
 app.patch('/api/admin/activities/:id',async(req,res)=>{
  const b=allowedBody(req.body,['title','category','description','start_time','end_time','location','capacity','fee_cents','publish_status']);
  await adminTx(req,async tx=>{
   const a=await lockActivity(tx,req.params.id);if(!a||a.is_deleted)fail(404,'活动不存在');
   const title=b.title===undefined?a.title:text(b.title,2,100,'活动标题'),category=b.category===undefined?a.category:text(b.category,1,30,'分类'),description=b.description===undefined?a.description:text(b.description,5,5000,'活动说明'),location=b.location===undefined?a.location:text(b.location,2,120,'地点');
   const start=b.start_time===undefined?a.start_time:isoDate(b.start_time),end=b.end_time===undefined?a.end_time:isoDate(b.end_time);if(end<=start)fail(400,'结束时间需晚于开始时间');
   const capacity=b.capacity===undefined?a.capacity:b.capacity,fee=b.fee_cents===undefined?a.fee_cents:b.fee_cents,state=b.publish_status===undefined?a.publish_status:b.publish_status;
   integer(capacity,1,10000,'容量');integer(fee,0,10000000,'费用');
   if(capacity<await enrollmentCount(tx,a.id))fail(409,'容量不能少于当前有效报名人数');
   if(!['draft','pending','published','offline'].includes(state))fail(400,'活动状态无效');
   await tx.run('UPDATE activities SET title=$1,category=$2,description=$3,location=$4,start_time=$5,end_time=$6,capacity=$7,fee_cents=$8,publish_status=$9 WHERE id=$10',[title,category,description,location,start,end,capacity,fee,state,a.id]);
   await audit(tx,req.user.id,'update_activity',a.id);
  });res.json({ok:true});
 });
 app.get('/api/admin/logs',async(req,res)=>{
  const {limit,offset}=page(req),logs=await db.all('SELECT l.id,l.action,l.target_id,l.created_at,u.name AS actor_name FROM operation_logs l JOIN users u ON u.id=l.actor_id ORDER BY l.created_at DESC,l.id LIMIT $1 OFFSET $2',[limit,offset]);
  res.json({logs,total:(await db.get('SELECT COUNT(*)::integer AS n FROM operation_logs')).n,limit,offset});
 });
}
