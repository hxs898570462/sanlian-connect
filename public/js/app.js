import {api} from './api.js';
import {renderAdmin} from './admin.js';
import {createAssistant} from './assistant.js';
import {applyPreferences,bindPreferences,profileView,settingsPage} from './settings.js';
import {PASSWORD_MIN_LENGTH,PASSWORD_MAX_LENGTH} from './password-policy.js';
import {t,getLanguage,setLanguage,localize,formatDate as date} from './i18n.js';
import {eventPoster,shelfCards,shelfDetail} from './reader-design.js';
const root=document.querySelector('#app');
let user=null,renderId=0,noticeTimer,mineFocus=null;
let bookingFocus=null;
let eventFilters={q:'',days:'60'};
const returnKey='sanlian_booking_return';
const storage={get(){try{return sessionStorage.getItem(returnKey);}catch{return null;}},set(id){try{sessionStorage.setItem(returnKey,id);}catch{}},clear(){try{sessionStorage.removeItem(returnKey);}catch{}}};
const assistant=createAssistant({navigate(item){
  if(item.kind==='book'){location.hash='book/'+encodeURIComponent(item.id);return;}
  bookingFocus=item.id;if(!user)storage.set(item.id);
  const target='#activity/'+encodeURIComponent(item.id);
  if(location.hash===target)render();else location.hash=target;
}});
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const status=s=>({confirmed:t("已报名"),cancelled:t("已取消"),checked_in:t("已签到"),draft:t("草稿"),published:t("已发布"),pending:t("待审核"),offline:t("已下线")}[s]||s);
const feedbackStatus={pending:'待处理',processing:'处理中',replied:'已回复',closed:'已关闭'};
const feedbackStateHint={waiting:'签到后即可填写反馈；未签到可在活动结束后填写。',cancelled:'已取消报名，无法填写反馈。',submitted:'已提交反馈，可查看记录和门店回复。'};
const feedbackHint=registration=>t(feedbackStateHint[registration.feedback_state]||feedbackStateHint.waiting);
function notice(message){document.querySelector('#notice').textContent=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>document.querySelector('#notice').textContent='',4500);}
async function logout(){
  try{await api('/auth/logout',{method:'POST',body:{}});user=null;storage.clear();bookingFocus=null;account();if(location.hash==='#home')await render();else location.hash='home';}
  catch(e){notice(e.message);}
}
function account(){
  assistant.setUser(user);
  document.querySelector('#account').innerHTML=user?`<a href="#mine">${escape(user.name)}<small class="role-label">${user.role==='stuff'?t("管理员 · stuff"):t("普通用户 · user")}</small></a><button class="secondary" id="logout">${t("退出")}</button>`:`<a class="button secondary" href="#login">${t("登录 / 注册")}</a>`;
  document.querySelector('#admin-link').hidden=user?.role!=='stuff';
  document.querySelector('#logout')?.addEventListener('click',logout);
}
const empty=message=>`<div class="empty">${escape(message)}</div>`;
// 反馈入口状态机：与服务端 feedback-policy 保持一致（已签到或活动已结束即可填写）。
function feedbackActions(registration){
  if(registration.has_feedback)return `<button class="secondary" type="button" data-scroll="feedbacks">${t("查看我的反馈")}</button>`;
  if(registration.can_feedback)return `<a class="button secondary" href="#feedback/${encodeURIComponent(registration.id)}">${t("填写活动反馈")}</a>`;
  return `<span class="small">${escape(feedbackHint(registration))}</span>`;
}
function scrollToFeedbacks(){document.getElementById('mine-feedbacks')?.scrollIntoView({block:'start'});}
function openFeedbacks(){if(location.hash==='#mine')scrollToFeedbacks();else{mineFocus='feedbacks';location.hash='mine';}}
document.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-scroll="feedbacks"]');
  if(!trigger)return;
  event.preventDefault();openFeedbacks();
});
function cards(items){
  return items.length?items.map(a=>`<article class="card reader-event-card">
    <a href="#activity/${encodeURIComponent(a.id)}" class="reader-card-media" aria-label="${escape(t('查看{title}',{title:a.title}))}">${eventPoster(a)}</a>
    <div class="card-body"><span class="reader-category">${escape(a.category)}</span>
      <h3><a href="#activity/${encodeURIComponent(a.id)}">${escape(a.title)}</a></h3>
      <div class="meta"><time datetime="${escape(a.start_time)}">${date(a.start_time)}</time><br>${escape(a.location)}<br>${t('余 {remaining} 席 / 共 {capacity} 席',{remaining:Math.max(0,a.capacity-a.enrolled_count),capacity:a.capacity})}</div>
      <div class="card-foot"><span class="fee">${a.fee_cents?'¥ '+(a.fee_cents/100).toFixed(2):t("免费参与")}</span><a class="text-link" href="#activity/${encodeURIComponent(a.id)}">${t("了解活动 →")}</a></div>
    </div>
  </article>`).join(''):empty(t("这个时间范围内暂无活动，欢迎稍后再来。"));
}
function formError(form,message){form.querySelector('.form-error').textContent=message;}
function bindForm(id,submit){
  const form=document.getElementById(id); if(!form)return;
  form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;formError(form,'');
    try{await submit(new FormData(form),form);}catch(e){formError(form,e.message);}finally{button.disabled=false;}});
}
async function render({keepFocus=false}={}){
  const version=++renderId;
  const [page='home',rawId='']=(location.hash.slice(1)||'home').split('/');
  applyPreferences(page);
  root.classList.toggle('reader-home-page',page==='home');
  let id;try{id=decodeURIComponent(rawId);}catch{id='';}
  document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===page||(page==='activity'&&a.dataset.nav==='activities')||((page==='book'||page==='shelf')&&a.dataset.nav==='books')||(page==='feedback'&&a.dataset.nav==='mine')));
  root.innerHTML=`<p class="loading">${t("正在加载…")}</p>`;
  const show=html=>{if(version!==renderId)return false;root.innerHTML=html;return true;};
  try{
    user=(await api('/auth/me')).user;
    if(version!==renderId)return;
    account();
    if(page==='home'){
      const {activities}=await api('/activities');
      show(`<section class="reader-hero">
        <img class="reader-hero-image" src="/assets/reader/reading-room.jpg" alt="" fetchpriority="high">
        <div class="reader-home-width reader-hero-copy"><p class="eyebrow">${t("三联书店")} · ${t("天镜湖店")}</p>
          <h1>${t("以书为邻，")}<br>${t("与美好相遇。")}</h1>
          <p>${t("在湖畔留一点时间给阅读。")}<br>${t("一本好书，一场对话，一群有趣的人。")}</p>
          <a class="button" href="#activities">${t("寻找下一场相遇 ↗")}</a>
        </div>
      </section>
      <section class="reader-home-width reader-home-section" aria-labelledby="reader-home-events"><div class="section-heading">
        <div><div class="eyebrow">${t("WHAT'S ON · 未来 60 天")}</div><h2 id="reader-home-events">${t("让思想，在这里交汇")}</h2></div>
        <a class="text-link" href="#activities">${t("全部活动 →")}</a></div><div class="grid">${cards(activities.slice(0,3))}</div>
      </section>
      <section class="reader-home-shelves" aria-labelledby="reader-home-books"><div class="reader-home-width reader-home-section"><div class="section-heading">
        <div><div class="eyebrow">${t("字里行间")}</div><h2 id="reader-home-books">${t("从书架选一本")}</h2></div>
        <a class="text-link" href="#books">${t("全部书架")}</a></div><div class="grid">${shelfCards(3)}</div>
      </div></section>`);
    }else if(page==='activities'){
      if(!show(`<section class="intro"><div class="eyebrow">EVENTS & GATHERINGS</div><h1>${t("文化活动")}</h1><p>${t("为喜欢的主题，留一个位置。")}</p></section><form id="filters" class="filters"><input name="q" aria-label="${t("搜索活动")}" placeholder="${t("搜索活动或感兴趣的主题")}"><select name="days" aria-label="${t("时间范围")}"><option value="60">${t("未来 60 天")}</option><option value="180">${t("未来 180 天")}</option></select><button type="submit">${t("搜索")}</button></form><div id="results" class="grid"><p>${t("正在读取活动…")}</p></div>`))return;
      const filters=document.getElementById('filters');
      const load=async()=>{const target=document.querySelector('#results');const query=new URLSearchParams(eventFilters);try{const data=await api(`/activities?${query}`);if(version===renderId)target.innerHTML=cards(data.activities);}catch(e){if(version===renderId)target.innerHTML=empty(e.message);}};
      Object.entries(eventFilters).forEach(([key,value])=>filters.elements.namedItem(key).value=value);
      filters.addEventListener('submit',e=>{e.preventDefault();eventFilters=Object.fromEntries(new FormData(filters));load();});await load();
    }else if(page==='activity'){
      const [{activity:a},mine]=await Promise.all([api(`/activities/${encodeURIComponent(id)}`),user?api('/registrations'):Promise.resolve({registrations:[]})]);
      const booking=mine.registrations.find(r=>r.activity_id===a.id&&r.status!=='cancelled');
      const unavailable=a.registration_closes_at<=new Date().toISOString()?t("报名已截止。"):a.enrolled_count>=a.capacity?t("活动名额已满。"):'';
      const form=booking?`<h2>${booking.status==='checked_in'?t("已签到，欢迎分享感受"):t("已为你留好位置")}</h2><p>${t("报名状态：")} ${status(booking.status)}</p><div class="actions">${feedbackActions(booking)}</div><div class="actions"><a href="#mine" class="text-link">${t("查看读者一隅 →")}</a></div>`
        :unavailable?`<h2>${t("暂时无法报名")}</h2><p>${unavailable}</p>`
        :!user?`<h2>${t("加入这场相遇")}</h2><p>${t("登录后即可填写报名资料。")}</p><a href="#login" class="button">${t("登录 / 注册")}</a>`
        :`<h2>${t("为自己留一个位置")}</h2><p class="small">${t("每个账号可报名 1 人。资料仅用于活动联系。")}${a.registration_until_end?t("活动结束前均可报名，开始后不可自行取消。"):''}</p><form id="booking-form"><label for="attendee">${t("参加者姓名")}</label><input id="attendee" name="attendee_name" required maxlength="60" autocomplete="name" value="${escape(user.name)}"><label for="phone">${t("联系电话")}</label><input id="phone" name="phone" type="tel" required minlength="7" maxlength="24" autocomplete="tel"><label class="checkbox"><input name="privacy_consent" type="checkbox" required><span>${t("我同意将姓名和联系电话用于本次报名及活动联系。")}</span></label><div class="form-error" role="alert"></div><button type="submit">${t("确认报名")}</button></form>`;
      if(!show(`<a class="back" href="#activities">${t("← 返回文化活动")}</a><div class="detail-grid"><article>${eventPoster(a)}<span class="tag">${escape(a.category)}</span><h1>${escape(a.title)}</h1><div class="detail-info"><p>${t("时间 ·")} ${date(a.start_time)} — ${date(a.end_time)}</p><p>${t("地点 ·")} ${escape(a.location)}</p><p>${t('名额 · 余 {remaining} 席 / 共 {capacity} 席',{remaining:Math.max(0,a.capacity-a.enrolled_count),capacity:a.capacity})}</p><p>${t("费用 ·")} ${a.fee_cents?'¥ '+(a.fee_cents/100).toFixed(2):t("免费")}</p></div><h2>${t("关于这场活动")}</h2><div class="prose">${escape(a.description)}</div></article><aside class="panel">${form}</aside></div>`))return;
      bindForm('booking-form',async data=>{await api('/registrations',{method:'POST',body:{activity_id:a.id,attendee_name:data.get('attendee_name'),phone:data.get('phone'),privacy_consent:data.has('privacy_consent')}});notice(t("报名成功，期待与你相遇。"));location.hash='mine';});
      if(!user)document.querySelector('.detail-grid a[href="#login"]')?.addEventListener('click',()=>storage.set(id));
      if(bookingFocus===id){
        const panel=document.querySelector('.detail-grid aside');panel.tabIndex=-1;
        if(document.getElementById('booking-form')){const note=document.createElement('p');note.className='assistant-booking-note';note.textContent=t("助手已为你打开确认表，尚未报名或占位。请核对活动、费用和资料；电话及联系用途同意由你填写后提交。");panel.prepend(note);}
        panel.scrollIntoView({block:'center'});panel.focus({preventScroll:true});bookingFocus=null;
      }
    }else if(page==='login'||page==='signup'){
      const signup=page==='signup';
      if(!show(`<section class="panel auth-panel">
        <div class="eyebrow">WELCOME TO SANLIAN</div>
        <h1>${signup?t("开始一段阅读旅程"):t("欢迎回来")}</h1>
        <p>${signup?t("建立你的读者账号。"):t("登录后查看和管理自己的报名。")}</p>
        <form id="auth-form">
          ${signup?`<p class="small role-hint">${t("注册即创建读者账号；管理员账号由现有管理员在后台授予。")}</p>`:''}
          ${signup?`<label for="name">${t("怎么称呼你")}</label><input id="name" name="name" required maxlength="60" autocomplete="name">`:''}
          <label for="email">${t("邮箱")}</label><input id="email" name="email" type="email" required maxlength="254" autocomplete="email">
          <label for="password">${t("密码")}</label><input id="password" name="password" type="password" required minlength="${PASSWORD_MIN_LENGTH}" maxlength="${PASSWORD_MAX_LENGTH}" autocomplete="${signup?'new-password':'current-password'}" aria-describedby="password-rules">
          <p class="small" id="password-rules">${t('{min}–{max} 个字符。',{min:PASSWORD_MIN_LENGTH,max:PASSWORD_MAX_LENGTH})}</p>
          <div class="form-error" role="alert"></div><button type="submit">${signup?t("注册并登录"):t("登录")}</button>
        </form>
        <a class="text-link" href="#${signup?'login':'signup'}">${signup?t("已有账号？去登录"):t("第一次来？创建账号")}</a>
      </section>`))return;
      bindForm('auth-form',async data=>{const result=await api(`/auth/${signup?'register':'login'}`,{method:'POST',body:Object.fromEntries(data)});user=result.user;account();const portal=user.role==='stuff'?'admin':'mine';const pending=storage.get();storage.clear();if(pending&&pending.length<=120){bookingFocus=pending;location.hash='activity/'+encodeURIComponent(pending);return;}notice(signup?t("账号已创建。"):t("登录成功。"));location.hash=portal;});
    }else if(page==='mine'){
      if(!user){show(`<section class="intro"><div class="eyebrow">${t("READER'S CORNER · 读者一隅")}</div><h1>${t("读者一隅")}</h1><p>${t("资料、报名与反馈，都在这一页。")}</p></section>${empty(t("登录后可查看自己的资料、报名和反馈。"))}<div class="actions"><a href="#login" class="button">${t("去登录")}</a></div>`);return;}
      const [{user:profile},{registrations},{feedbacks},{suggestions}]=await Promise.all([api('/profile'),api('/registrations'),api('/feedbacks'),api('/suggestions')]);
      const active=registrations.filter(r=>r.status!=='cancelled').length;
      const upcoming=registrations.filter(r=>r.status!=='cancelled'&&new Date(r.start_time)>new Date()).length;
      const genders={female:'女',male:'男',other:'其他'};
      const details=[[t("邮箱"),profile.email],[t("性别"),profile.gender&&t(genders[profile.gender]??profile.gender)],[t("注册时间"),date(profile.created_at)]].filter(([,value])=>value);
      const bookings=registrations.length?registrations.map(r=>`<article class="panel booking"><div><span class="tag">${status(r.status)}</span><h3><a href="#activity/${encodeURIComponent(r.activity_id)}">${escape(r.title)}</a></h3><div class="meta">${date(r.start_time)} · ${escape(r.location)}<br>${t("联系电话：")}${escape(r.phone)} ${t("· 人数：")}${r.headcount}<br>${t("报名时间：")}${date(r.created_at)}<br><span class="ticket">${t("凭证：")}${escape(r.ticket_code)}</span></div></div><div class="actions">${r.status==='confirmed'&&new Date(r.start_time)>new Date()?`<button class="secondary" data-cancel="${escape(r.id)}">${t("取消报名")}</button>`:''}${feedbackActions(r)}</div></article>`).join(''):empty(t("还没有报名，去发现一场感兴趣的活动吧。"));
      const entries=[...feedbacks.map(f=>({target:'feedbacks',id:f.id,kind:t("活动反馈"),title:f.title,rating:f.rating,content:f.content,status:f.status,reply:f.reply,created_at:f.created_at})),...suggestions.map(s=>({target:'suggestions',id:s.id,kind:t("建议"),title:t("给书店的建议"),rating:null,content:s.content,status:s.status,reply:s.reply,created_at:s.created_at}))].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
      const replies=entries.length?entries.map(x=>`<article class="panel"><div class="entry-tags"><span class="tag">${x.kind}</span><span class="tag">${t(feedbackStatus[x.status]||x.status)}</span></div><h3>${escape(x.title)}</h3><p class="small">${x.rating?`${x.rating} ${t("/ 5 分 ·")} `:''}${date(x.created_at)}</p><div class="prose">${escape(x.content)}</div>${x.reply?`<div class="staff-reply"><b>${t("门店回复")}</b><div class="prose">${escape(x.reply)}</div></div>`:''}${x.reply?'':`<div class="actions entry-actions"><button class="secondary" type="button" data-entry-delete="${x.target}" data-entry-id="${escape(x.id)}">${t("删除")}</button></div>`}</article>`).join(''):empty(t("还没有提交反馈或建议。活动签到或结束后即可填写感受，也可以随时给书店提建议。"));
      const signature=(profile.signature||'').trim();
      if(!show(`<section class="intro"><div class="eyebrow">${t("READER'S CORNER · 读者一隅")}</div><h1>${t("读者一隅")}</h1>${signature?`<p class="mine-signature">${escape(signature)}</p>`:`<p class="mine-signature is-empty"><a class="text-link" href="#settings/profile">${t("还没有签名，去设置写一句吧 →")}</a></p>`}</section>
      <article class="panel mine-profile"><div class="mine-avatar" aria-hidden="true">${escape([...profile.name][0]||t("读"))}</div><div class="mine-profile-body"><h2 class="mine-name">${escape(profile.name)}<span class="tag">${profile.role==='stuff'?t("管理员 · stuff"):t("普通用户 · user")}</span></h2><dl class="profile-details">${details.map(([label,value])=>`<div class="setting-row setting-value"><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></div><div class="actions"><a class="button secondary" href="#settings">${t("设置")}</a></div></article>
      <div class="mine-stats"><div><span>${t("有效报名")}</span><strong>${active}</strong></div><div><span>${t("待开始")}</span><strong>${upcoming}</strong></div><div><span>${t("反馈与建议")}</span><strong>${entries.length}</strong></div></div>
      <section class="mine-section"><div class="section-heading"><div><div class="eyebrow">YOUR NEXT CHAPTER</div><h2>${t("我的报名")}</h2></div><a class="text-link" href="#activities">${t("发现活动 →")}</a></div><div class="stack">${bookings}</div></section>
      <section class="mine-section" id="mine-suggest"><div class="section-heading"><div><div class="eyebrow">${t("SUGGEST · 提出建议")}</div><h2>${t("提出建议")}</h2></div><p class="small">${t("不限活动，随时向书店提建议")}</p></div><form id="suggest-form" class="panel suggest-form"><label for="suggest-content">${t("想对书店说点什么")}</label><textarea id="suggest-content" name="content" required minlength="5" maxlength="2000" placeholder="${t("例如：希望增加哪类活动、书目或服务")}"></textarea><div class="form-error" role="alert"></div><button type="submit">${t("提交建议")}</button></form></section>
      <section class="mine-section" id="mine-feedbacks"><div class="section-heading"><div><div class="eyebrow">YOUR VOICE</div><h2>${t("我的反馈")}</h2></div><p class="small">${t("评价、建议与门店回复仅自己可见")}</p></div><div class="stack">${replies}</div></section>`))return;
      if(mineFocus==='feedbacks'){mineFocus=null;scrollToFeedbacks();}
      bindForm('suggest-form',async data=>{await api('/suggestions',{method:'POST',body:{content:data.get('content')}});notice(t("建议已提交，书店回复后会显示在下方。"));mineFocus='feedbacks';await render();});
      // 删除本人的反馈/建议（误发补救）：仅未回复条目显示按钮，服务端同样校验归属与回复状态。
      document.querySelectorAll('[data-entry-delete]').forEach(button=>button.addEventListener('click',async()=>{
        const target=button.dataset.entryDelete,id=button.dataset.entryId;
        if(!confirm(t("删除后无法恢复，门店将不再看到这条内容。\n确认删除？")))return;
        button.disabled=true;
        try{await api(`/${target}/${encodeURIComponent(id)}`,{method:'DELETE',body:{}});notice(t("已删除。"));await render();}
        catch(e){notice(e.message);button.disabled=false;}
      }));
      document.querySelectorAll('[data-cancel]').forEach(button=>button.addEventListener('click',async()=>{if(!confirm(t("确认取消这次报名？")))return;button.disabled=true;try{await api(`/registrations/${encodeURIComponent(button.dataset.cancel)}/cancel`,{method:'POST',body:{}});notice(t("报名已取消，名额已释放。"));await render();}catch(e){notice(e.message);button.disabled=false;}}));
    }else if(page==='books'){
      const {books}=await api('/books');
      show(`<section class="intro"><div class="eyebrow">${t("字里行间")}</div><h1>${t("书架漫游")}</h1><p>${t("让下一本书，带你走向更远的地方。")}</p></section>
        <div class="grid">${shelfCards()}</div>
        <section class="reader-catalogue" aria-labelledby="reader-catalogue-title"><h2 id="reader-catalogue-title">${t("门店书目")}</h2><div class="grid">${books.length?books.map(b=>`<article class="card"><div class="book-art">${escape(b.category)}</div><div class="card-body"><h3><a href="#book/${encodeURIComponent(b.id)}">${escape(b.title)}</a></h3><p class="small">${escape(b.author)}</p><p>${escape(b.summary)}</p><a class="text-link" href="#book/${encodeURIComponent(b.id)}">${t("查看书目 →")}</a></div></article>`).join(''):empty(t("书架正在整理中。"))}</div></section>`);
    }else if(page==='shelf'){
      show(shelfDetail(id));
    }else if(page==='book'){
      const {book:b}=await api(`/books/${encodeURIComponent(id)}`);
      show(`<a class="back" href="#books">${t("← 返回书架漫游")}</a><article class="panel book-detail"><div class="book-art">${escape(b.category)}</div><span class="tag">${escape(b.category)}</span><h1>${escape(b.title)}</h1><p>${escape(b.author)}</p><div class="prose">${escape(b.summary)}</div>${b.isbn?`<p class="small">ISBN：${escape(b.isbn)}</p>`:''}<p class="small">${t("当前为书目展示与阅读推荐，尚未开放在线购买。")}</p></article>`);
    }else if(page==='feedback'){
      if(!user){location.hash='login';return;}
      const {registrations}=await api('/registrations'),registration=registrations.find(r=>r.id===id);
      if(!registration||!registration.can_feedback){
        if(!show(`<a class="back" href="#mine">${t("← 返回读者一隅")}</a><section class="panel feedback-panel"><h1>${t("活动反馈")}</h1><p>${!registration?t("未找到这条报名记录。"):registration.has_feedback?t("这条报名已提交反馈，可在“我的”中查看记录和门店回复。"):feedbackHint(registration)}</p><button class="button secondary" type="button" data-scroll="feedbacks">${t("查看我的反馈")}</button></section>`))return;
        return;
      }
      if(!show(`<a class="back" href="#mine">${t("← 返回读者一隅")}</a><section class="panel feedback-panel"><div class="eyebrow">YOUR VOICE</div><h1>${t("把感受留给我们")}</h1><h2>${escape(registration.title)}</h2><p class="small">${date(registration.start_time)} · ${escape(registration.location)} · ${status(registration.status)}</p><p>${t("每条报名可提交一次反馈，门店管理员会查看并处理。")}</p><form id="feedback-form"><label for="rating">${t("评分")}</label><select id="rating" name="rating"><option value="5">${t("5 · 非常满意")}</option><option value="4">${t("4 · 满意")}</option><option value="3">${t("3 · 一般")}</option><option value="2">${t("2 · 待改进")}</option><option value="1">${t("1 · 不满意")}</option></select><label for="content">${t("活动感受")}</label><textarea id="content" name="content" required minlength="5" maxlength="2000" placeholder="${t("分享活动中喜欢的部分，或希望我们改进的地方")}"></textarea><div class="form-error" role="alert"></div><button type="submit">${t("提交反馈")}</button></form></section>`))return;
      bindForm('feedback-form',async data=>{await api('/feedbacks',{method:'POST',body:{registration_id:id,rating:Number(data.get('rating')),content:data.get('content')}});notice(t("反馈已提交，门店管理员可以查看。"));mineFocus='feedbacks';location.hash='mine';});
    }else if(page==='myfeedbacks'){
      location.hash='mine';
    }else if(page==='profile'){
      if(!user){location.hash='login';return;}
      const {user:profile}=await api('/profile');
      show(profileView({profile,escape,date}));
    }else if(page==='settings'){
      if(!user){location.hash='login';return;}
      const release=id==='about'?await api('/version'):null;
      const profile=id==='profile'?(await api('/profile')).user:null;
      if(!show(settingsPage({section:id,profile,email:user.email,version:release?.version,escape})))return;
      if(!keepFocus)root.querySelector('h1').focus({preventScroll:true});
      if(id==='profile')bindForm('profile-form',async(data,form)=>{
        const result=await api('/profile',{method:'PATCH',body:Object.fromEntries(data)});
        if(version!==renderId)return;
        user=result.user;
        for(const field of data.keys())form.elements.namedItem(field).value=user[field];
        account();notice(t("个人资料已保存。"));
      });
      if(id==='display')bindPreferences();
      if(id==='security'){
        document.querySelector('#settings-logout').addEventListener('click',logout);
        bindForm('password-form',async data=>{
          const current_password=data.get('current_password'),new_password=data.get('new_password');
          if(new_password!==data.get('confirm_password'))throw Error(t("两次输入的新密码不一致"));
          await api('/auth/change-password',{method:'POST',body:{current_password,new_password}});
          user=null;storage.clear();bookingFocus=null;account();notice(t("密码已修改，请重新登录。"));location.hash='login';
        });
      }
    }else if(page==='admin'){
      if(user?.role!=='stuff'){show(empty(t("此页面仅供 stuff 管理员使用，请使用管理员账号登录。")));return;}
      await renderAdmin(root,{tab:id||'feedbacks',user,escape,date,status,notice,refresh:render,isCurrent:()=>version===renderId});
    }else{show(`<h1>${t("这一页暂时没有内容")}</h1><a href="#home" class="text-link">${t("回到首页")}</a>`);}
  }catch(e){show(`<section class="intro"><h1>${t("暂时无法打开")}</h1><p class="error">${escape(e.message)}</p><a class="text-link" href="#home">${t("回到首页")}</a></section>`);}
}
const languageToggle=document.getElementById('language-toggle');
function renderLanguage(){
  const language=getLanguage();
  document.documentElement.lang=language;
  document.title=t('三联 · 阅读与相遇 | Sanlian Connect');
  localize(document.querySelector('.topbar'));
  localize(document.querySelector('footer'));
  languageToggle.textContent=language==='en'?'中文':'English';
  languageToggle.lang=language==='en'?'zh-CN':'en';
  languageToggle.hidden=false;
  assistant.localize();
}
languageToggle.addEventListener('click',async()=>{
  if(languageToggle.hasAttribute('aria-busy'))return;
  // Retain in-progress fields and open editors for the current route only.
  const route=location.hash;
  const scroll=window.scrollY;
  const drafts=Array.from(root.querySelectorAll('form'),form=>({
    selector:form.id?`#${CSS.escape(form.id)}`:form.matches('[data-kind][data-id]')
      ?`form[data-kind="${CSS.escape(form.dataset.kind)}"][data-id="${CSS.escape(form.dataset.id)}"]`:null,
    expanded:form.closest('details')?.open,
    fields:Array.from(form.elements).filter(el=>el.name&&!el.disabled).map(el=>({name:el.name,type:el.type,value:el.value,checked:el.checked}))
  }));
  setLanguage(getLanguage()==='en'?'zh-CN':'en');
  renderLanguage();
  document.getElementById('notice').textContent='';
  account();
  languageToggle.setAttribute('aria-busy','true');
  try{
    await render({keepFocus:true});
    if(route!==location.hash)return;
    for(const {selector,expanded,fields} of drafts){
      const form=selector&&root.querySelector(selector);
      if(!form)continue;
      const details=form.closest('details');
      if(details&&expanded)details.open=true;
      for(const {name,type,value,checked} of fields){
        const field=type==='radio'?Array.from(form.elements).find(el=>el.name===name&&el.value===value):form.elements.namedItem(name);
        if(!field||field.type!==type)continue;
        if(type==='radio'||type==='checkbox')field.checked=checked;
        else field.value=value;
      }
    }
    window.scrollTo({top:scroll,behavior:'instant'});
  }finally{languageToggle.removeAttribute('aria-busy');}
});
window.addEventListener('hashchange',()=>{render();window.scrollTo({top:0,behavior:'instant'});});
renderLanguage();
account();
await render();
