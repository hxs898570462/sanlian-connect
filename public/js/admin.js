import { api } from './api.js';
import {t} from './i18n.js';

let searchState = {tab:'',q:'',status:'',priority:'',offset:0};
const titles = {users:'用户管理',registrations:'报名管理',feedbacks:'反馈管理',suggestions:'建议管理',activities:'活动管理',logs:'操作记录'};
const feedbackStatus = {pending:'待处理',processing:'处理中',replied:'已回复',closed:'已关闭'};
const actionLabels = {update_user:'更新用户',update_registration:'更新报名',update_feedback:'处理反馈',update_suggestion:'处理建议',create_activity:'创建活动',update_activity:'更新活动',bootstrap_administrator:'初始化管理员'};
const levelLabels = {high:'高优先级',mid:'中优先级',low:'低优先级'};
const priorityOptions = {high:'高优先级',mid:'中优先级',low:'低优先级'};
// 动态优先级与筛选口径同服务端：安全硬升级优先，否则看含等待加成的总分。
const levelOfRow = row => row.score_level === 'high' ? 'high' : row.total_score >= 60 ? 'high' : row.total_score >= 30 ? 'mid' : 'low';
const scoreBadge = row => {
  const level = levelOfRow(row), bonus = row.total_score - row.score, hitCount = row.score_hits ? row.score_hits.split(' ').filter(Boolean).length : 0;
  const qualitySum = row.score_quality ? row.score_quality.split(' ').filter(Boolean).reduce((sum,tag)=>sum+(parseInt(tag.replace(/[^\d+-]/g,''),10)||0),0) : 0;
  const description=t('规则分 {score}{quality}{bonus} · 命中 {hits} 个词条',{
    score:row.score,quality:qualitySum?` ${t('+ 优质加成 {points}',{points:qualitySum})}`:'',
    bonus:bonus?` ${t('+ 等待加成 {points}',{points:bonus})}`:'',hits:hitCount
  });
  return `<span class="score-badge score-${level}" title="${description}">${t(levelLabels[level])} · ${t('{points} 分',{points:row.total_score})}</span>`;
};
const scoreHits = (row,e) => [
  row.score_hits ? `<div class="score-hits">${row.score_hits.split(' ').filter(Boolean).map(term => `<span class="hit">${e(term)}</span>`).join('')}</div>` : '',
  row.score_quality ? `<div class="score-hits score-quality">${row.score_quality.split(' ').filter(Boolean).map(tag => `<span class="hit hit-quality">${e(tag)}</span>`).join('')}</div>` : ''
].join('');

// 管理后台列表查询参数：所有字段兜底为字符串，避免 undefined 被 URLSearchParams
// 序列化成字面量 "undefined" 触发服务端「优先级筛选无效」校验（管理后台打不开的根因）。
export const adminListQuery = state => new URLSearchParams({
  q:state.q||'',status:state.status||'',priority:state.priority||'',limit:'25',offset:String(state.offset||0)
});

export async function renderAdmin(root, context) {
  const {user,escape:e,date,status,notice,refresh,isCurrent} = context;
  const tab = Object.hasOwn(titles,context.tab) ? context.tab : 'feedbacks';
  if(searchState.tab!==tab) searchState={tab,q:'',status:'',priority:'',offset:0};
  const params=adminListQuery(searchState);
  const [summaryData,data]=await Promise.all([api('/admin/summary'),api(`/admin/${tab}?${params}`)]);
  if(!isCurrent())return;
  const summary=summaryData.summary;
  const options=(items,value)=>Object.entries(items).map(([key,label])=>`<option value="${e(key)}"${key===value?' selected':''}>${e(t(label))}</option>`).join('');
  const field=(label,name,value,{type='text',min,max,required=true,disabled=false}={})=>`<label>${e(t(label))}<input name="${e(name)}" type="${type}" value="${e(value)}"${required?' required':''}${disabled?' disabled':''}${min===undefined?'':` min="${min}"`}${max===undefined?'':` ${type==='text'||type==='email'||type==='tel'?'maxlength':'max'}="${max}"`}></label>`;
  const select=(label,name,items,value,disabled=false)=>`<label>${e(t(label))}<select name="${name}"${disabled?' disabled':''}>${options(items,value)}</select></label>`;
  const save=`<div class="span-two"><div class="form-error" role="alert"></div><button type="submit">${t("保存修改")}</button></div>`;
  const form=(kind,id,fields)=>`<form class="managed-form two-col" data-kind="${kind}" data-id="${e(id)}">${fields}${save}</form>`;
  const record=(heading,meta,fields)=>`<details class="manage-record"><summary><span>${heading}<small>${meta}</small></span><span class="record-edit">${t("查看 / 编辑")}</span></summary><div class="manage-fields">${fields}</div></details>`;
  const filter=()=>{
    let states=null;
    if(tab==='registrations')states={confirmed:t("已报名"),cancelled:t("已取消"),checked_in:t("已签到")};
    if(tab==='feedbacks'||tab==='suggestions')states=feedbackStatus;
    const priorities=(tab==='feedbacks'||tab==='suggestions')?`<select name="priority" aria-label="${t("筛选优先级")}"><option value="">${t("全部优先级")}</option>${options(priorityOptions,searchState.priority)}</select>`:'';
    return `<form id="manage-search" class="filters"><input name="q" aria-label="${t("搜索管理记录")}" placeholder="${t("搜索姓名、邮箱、活动或内容")}" value="${e(searchState.q)}">${states?`<select name="status" aria-label="${t("筛选状态")}"><option value="">${t("全部状态")}</option>${options(states,searchState.status)}</select>`:''}${priorities}<button type="submit">${t("搜索")}</button></form>`;
  };
  const empty=message=>`<div class="empty">${e(message)}</div>`;
  const pagination=()=>data?.total===undefined?'':`<div class="pagination"><span>${t('共 {total} 条 · 第 {page} 页',{total:data.total,page:Math.floor(data.offset/25)+1})}</span><div><button class="secondary" id="previous-page"${data.offset===0?' disabled':''}>${t("上一页")}</button><button class="secondary" id="next-page"${data.offset+25>=data.total?' disabled':''}>${t("下一页")}</button></div></div>`;
  const localTime=s=>new Date(Date.parse(s)+8*3600000).toISOString().slice(0,16);
  const activityFields=a=>{
    const key=a?.id||'new';
    return `<div class="two-col">
      ${field(t("活动标题"),'title',a?.title||'',{max:100})}${field(t("分类"),'category',a?.category||'读书会',{max:30})}
      ${field(t("开始时间（北京时间）"),'start_time',a?localTime(a.start_time):'',{type:'datetime-local'})}
      ${field(t("结束时间（北京时间）"),'end_time',a?localTime(a.end_time):'',{type:'datetime-local'})}
      ${field(t("名额"),'capacity',a?.capacity||24,{type:'number',min:1,max:10000})}
      <label>${t("费用（元）")}<input name="fee" type="number" min="0" max="100000" step="0.01" required value="${a?a.fee_cents/100:0}"></label>
      ${field(t("地点"),'location',a?.location||'太仓天镜湖店 · 阅读空间',{max:120})}
      ${select(t("发布状态"),'publish_status',a?{draft:t("草稿"),pending:t("待审核"),published:t("已发布"),offline:t("已下线")}:{draft:t("草稿"),published:t("发布到本地")},a?.publish_status||'draft')}
      ${select(t("报名截止"),'registration_until_end',{start:t("活动开始时"),end:t("活动结束时")},a?.registration_until_end?'end':'start')}
      <label class="span-two" for="activity-description-${e(key)}">${t("活动说明")}<textarea id="activity-description-${e(key)}" name="description" required minlength="5" maxlength="5000">${e(a?.description||'')}</textarea></label>
    </div>`;
  };
  let content='';
  if(tab==='users') {
    content=filter()+`<div class="stack">${data.users.length?data.users.map(u=>record(
      `${e(u.name)} <span class="tag">${u.role==='stuff'?t("管理员 · stuff"):t("普通用户 · user")}</span> <span class="small">${u.is_active?t("启用"):t("已停用")}${u.id===user.id?' '+t('· 当前账号'):''}</span>`,
      `${e(u.email)} ${t('· 报名 {registrations} 条 · 反馈 {feedbacks} 条',{registrations:u.registration_count,feedbacks:u.feedback_count})}`,
      form('users',u.id,
        field(t("称呼"),'name',u.name,{max:60})+field(t("邮箱"),'email',u.email,{type:'email',max:254})+
        select(t("用户组"),'role',{user:t("普通用户（user）"),stuff:t("管理员（stuff）")},u.role,u.id===user.id)+
        select(t("账号状态"),'is_active',{'1':t("启用"),'0':t("停用")},String(u.is_active),u.id===user.id)+
        `<p class="small span-two">${t('注册时间：{date}。更改邮箱、用户组或账号状态后，该用户需要重新登录。',{date:date(u.created_at)})}</p>`)
    )).join(''):empty(t("没有匹配的注册用户。"))}</div>`+pagination();
  } else if(tab==='registrations') {
    content=filter()+`<div class="stack">${data.registrations.length?data.registrations.map(r=>record(
      `${e(r.attendee_name)} <span class="tag">${status(r.status)}</span>`,
      `${e(r.title)} · ${e(r.email)} · ${date(r.created_at)}`,
      `<p class="small">${t("报名凭证：")}<span class="ticket">${e(r.ticket_code)}</span><br>${t("活动开始：")}${date(r.start_time)}</p>`+
      form('registrations',r.id,
        field(t("参加者姓名"),'attendee_name',r.attendee_name,{max:60})+field(t("联系电话"),'phone',r.phone,{type:'tel',max:24})+
        select(t("报名状态"),'status',{confirmed:t("已报名"),cancelled:t("已取消"),checked_in:t("已签到")},r.status)+
        `<p class="small">${t("取消会释放名额；恢复报名仍需有余位且没有重复报名。活动开始后可标记签到。")}</p>`)
    )).join(''):empty(t("没有匹配的报名记录。"))}</div>`+pagination();
  } else if(tab==='feedbacks') {
    content=filter()+`<div class="stack">${data.feedbacks.length?data.feedbacks.map(f=>record(
      `${e(f.title)} <span class="tag">${t(feedbackStatus[f.status])}</span> ${scoreBadge(f)}`,
      `${e(f.user_name)} · ${e(f.email)} · ${f.rating}${t("/5 分 ·")} ${date(f.created_at)}`,
      `<div class="prose feedback-content">${e(f.content)}</div>${scoreHits(f,e)}`+
      form('feedbacks',f.id,select(t("处理状态"),'status',feedbackStatus,f.status)+
        `<label class="span-two">${t("门店回复")}<textarea name="reply" maxlength="2000" placeholder="${t("回复将显示在该用户的“读者一隅”页面中")}">${e(f.reply||'')}</textarea></label>`)
    )).join(''):empty(t("没有匹配的活动反馈。"))}</div>`+pagination();
  } else if(tab==='suggestions') {
    content=filter()+`<div class="stack">${data.suggestions.length?data.suggestions.map(s=>record(
      `${t("给书店的建议")} <span class="tag">${t(feedbackStatus[s.status])}</span> ${scoreBadge(s)}`,
      `${e(s.user_name)} · ${e(s.email)} · ${date(s.created_at)}`,
      `<div class="prose feedback-content">${e(s.content)}</div>${scoreHits(s,e)}`+
      form('suggestions',s.id,select(t("处理状态"),'status',feedbackStatus,s.status)+
        `<label class="span-two">${t("门店回复")}<textarea name="reply" maxlength="2000" placeholder="${t("回复将显示在该用户的“读者一隅”页面中")}">${e(s.reply||'')}</textarea></label>`)
    )).join(''):empty(t("还没有收到用户建议。"))}</div>`+pagination();
  } else if(tab==='activities') {
    content=`<details class="manage-record"><summary>${t("＋ 新增活动")}</summary><div class="manage-fields"><form class="managed-form" data-kind="activities" data-id="">${activityFields(null)}${save}</form></div></details><div class="stack admin-list">${data.activities.map(a=>record(
      `${e(a.title)} <span class="tag">${status(a.publish_status)}</span>`,
      `${date(a.start_time)} · ${t('{enrolled}/{capacity} 人',{enrolled:a.enrolled_count,capacity:a.capacity})}`,
      `<form class="managed-form" data-kind="activities" data-id="${e(a.id)}">${activityFields(a)}${save}</form>`
    )).join('')}</div>`;
  } else if(tab==='logs') {
    content=`<div class="stack">${data.logs.length?data.logs.map(l=>`<article class="panel log-row"><b>${e(t(actionLabels[l.action]||l.action))}</b><span>${e(l.actor_name)} · ${date(l.created_at)}</span><small>${t("记录编号：")}${e(l.target_id)}</small></article>`).join(''):empty(t("还没有管理操作记录。"))}</div>`+pagination();
  }
  root.innerHTML=`<section class="admin-heading"><div class="eyebrow">SANLIAN · ADMINISTRATION</div><h1>${t("管理后台")}</h1><p>${e(t('你好，{name}。',{name:user.name}))}</p></section>
    <div class="admin-stats"><div><span>${t("注册用户")}</span><strong>${summary.users}</strong></div><div><span>${t("有效报名")}</span><strong>${summary.registrations}</strong></div><div><span>${t("待处理反馈")}</span><strong>${summary.pending_feedbacks}</strong></div><div><span>${t("高优先级待办")}</span><strong>${summary.high_priority}</strong></div><div><span>${t("活动场次")}</span><strong>${summary.activities}</strong></div></div>
    <div class="admin-shell"><nav class="admin-nav" aria-label="${t("后台导航")}">${Object.entries(titles).map(([key,label])=>`<a href="#admin/${key}"${tab===key?' class="selected" aria-current="page"':''}>${t(label)}${key==='suggestions'&&summary.pending_suggestions?`<em>${summary.pending_suggestions}</em>`:''}</a>`).join('')}</nav><section class="admin-content"><h2>${t(titles[tab])}</h2>${content}</section></div>`;
  root.querySelector('#manage-search')?.addEventListener('submit',async event=>{
    event.preventDefault();const form=new FormData(event.currentTarget);
    searchState.q=form.get('q')||'';searchState.status=form.get('status')||'';searchState.priority=form.get('priority')||'';searchState.offset=0;await refresh();
  });
  root.querySelector('#previous-page')?.addEventListener('click',async()=>{searchState.offset=Math.max(0,searchState.offset-25);await refresh();});
  root.querySelector('#next-page')?.addEventListener('click',async()=>{searchState.offset+=25;await refresh();});
  root.querySelectorAll('.managed-form').forEach(element=>element.addEventListener('submit',async event=>{
    event.preventDefault();const button=element.querySelector('[type=submit]'),error=element.querySelector('.form-error');
    button.disabled=true;error.textContent='';
    try {
      const body=Object.fromEntries(new FormData(element));
      const kind=element.dataset.kind,id=element.dataset.id;
      if(kind==='users') {
        if(body.is_active!==undefined)body.is_active=Number(body.is_active);
        if(body.role!==undefined&&body.role!=='user') {
          const current=data.users.find(u=>u.id===id);
          if(current.role!=='stuff'&&!confirm(t("确认将该用户设为管理员？管理员能够管理所有用户、报名和反馈。")))return;
        }
        if(body.is_active===0&&!confirm(t("确认停用此账号？该用户将立即退出，且暂时无法登录。")))return;
      }
      if(kind==='activities') {
        body.registration_until_end=body.registration_until_end==='end';
        body.start_time=new Date(body.start_time+':00+08:00').toISOString();
        body.end_time=new Date(body.end_time+':00+08:00').toISOString();
        body.capacity=Number(body.capacity);body.fee_cents=Math.round(Number(body.fee)*100);delete body.fee;
      }
      await api(`/admin/${kind}${id?'/'+encodeURIComponent(id):''}`,{method:id?'PATCH':'POST',body});
      notice(kind==='suggestions'?t("建议处理已保存，用户可以查看回复。"):kind==='feedbacks'?t("反馈处理已保存，用户可以查看回复。"):t("修改已保存。"));await refresh();
    } catch(err){error.textContent=err.message;} finally {button.disabled=false;}
  }));
}
