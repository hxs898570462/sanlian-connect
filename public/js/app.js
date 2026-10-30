import {api} from './api.js';
import {renderAdmin} from './admin.js';
const root=document.querySelector('#app');
let user=null,renderId=0,noticeTimer;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s));
const status=s=>({confirmed:'已报名',cancelled:'已取消',checked_in:'已签到',draft:'草稿',published:'已发布',pending:'待审核',offline:'已下线'}[s]||s);
function notice(message){document.querySelector('#notice').textContent=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>document.querySelector('#notice').textContent='',4500);}
function account(){
  document.querySelector('#account').innerHTML=user?`<a href="#profile">${escape(user.name)}<small class="role-label">${user.role==='stuff'?'管理员 · stuff':'普通用户 · user'}</small></a><button class="secondary" id="logout">退出</button>`:'<a class="button secondary" href="#login">登录 / 注册</a>';
  document.querySelector('#admin-link').hidden=user?.role!=='stuff';
  document.querySelector('#feedback-link').hidden=!user;
  document.querySelector('#logout')?.addEventListener('click',async()=>{try{await api('/auth/logout',{method:'POST',body:{}});user=null;account();location.hash='home';await render();}catch(e){notice(e.message);}});
}
const empty=message=>`<div class="empty">${escape(message)}</div>`;
function cards(items){return items.length?items.map((a,i)=>`<article class="card"><a href="#activity/${encodeURIComponent(a.id)}" class="card-cover theme-${i%3}" aria-label="查看${escape(a.title)}"><span class="symbol">${['阅','文','遇'][i%3]}</span><small>${escape(a.category)} · 天镜湖畔</small></a><div class="card-body"><span class="tag">${escape(a.category)}</span><h3><a href="#activity/${encodeURIComponent(a.id)}">${escape(a.title)}</a></h3><div class="meta">${date(a.start_time)}<br>${escape(a.location)}<br>余 ${Math.max(0,a.capacity-a.enrolled_count)} 席 / 共 ${a.capacity} 席</div><div class="card-foot"><span class="fee">${a.fee_cents?'¥ '+(a.fee_cents/100).toFixed(2):'免费参与'}</span><a class="text-link" href="#activity/${encodeURIComponent(a.id)}">了解活动 →</a></div></div></article>`).join(''):empty('这个时间范围内暂无活动，欢迎稍后再来。');}
function formError(form,message){form.querySelector('.form-error').textContent=message;}
function bindForm(id,submit){
  const form=document.getElementById(id); if(!form)return;
  form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;formError(form,'');
    try{await submit(new FormData(form),form);}catch(e){formError(form,e.message);}finally{button.disabled=false;}});
}
async function render(){
  const version=++renderId;
  const [page='home',rawId='']=(location.hash.slice(1)||'home').split('/');
  let id;try{id=decodeURIComponent(rawId);}catch{id='';}
  document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===page||(page==='activity'&&a.dataset.nav==='activities')));
  root.innerHTML='<p class="loading">正在加载…</p>';
  const show=html=>{if(version!==renderId)return false;root.innerHTML=html;return true;};
  try{
    user=(await api('/auth/me')).user;
    if(version!==renderId)return;
    account();
    if(page==='home'){
      const {activities}=await api('/activities');
      show(`<section class="hero"><div class="hero-copy"><div class="eyebrow">SANLIAN · TIANJING LAKE</div><h1>以书为邻，<br>与美好相遇。</h1><p>在湖畔留一点时间给阅读。<br>一本好书，一场对话，一群有趣的人。</p><a class="button" href="#activities">寻找下一场相遇 ↗</a></div><div class="hero-art" role="img" aria-label="湖绿色背景前的四本书"><span class="spine">日常与远方</span><span class="spine">阅读的温度</span><span class="spine">湖畔来信</span><span class="spine">生活的另一页</span></div></section><section><div class="section-heading"><div><div class="eyebrow">WHAT'S ON · 未来 60 天</div><h2>让思想，在这里交汇</h2></div><a class="text-link" href="#activities">全部活动 →</a></div><div class="grid">${cards(activities.slice(0,3))}</div></section>`);
    }else if(page==='activities'){
      if(!show(`<section class="intro"><div class="eyebrow">EVENTS & GATHERINGS</div><h1>文化活动</h1><p>为喜欢的主题，留一个位置。</p></section><form id="filters" class="filters"><input name="q" aria-label="搜索活动" placeholder="搜索活动或感兴趣的主题"><select name="days" aria-label="时间范围"><option value="60">未来 60 天</option><option value="180">未来 180 天</option></select><button type="submit">搜索</button></form><div id="results" class="grid"><p>正在读取活动…</p></div>`))return;
      const load=async()=>{const target=document.querySelector('#results');const query=new URLSearchParams(new FormData(document.querySelector('#filters')));try{const data=await api(`/activities?${query}`);if(version===renderId)target.innerHTML=cards(data.activities);}catch(e){if(version===renderId)target.innerHTML=empty(e.message);}};
      document.querySelector('#filters').addEventListener('submit',e=>{e.preventDefault();load();});await load();
    }else if(page==='activity'){
      const [{activity:a},mine]=await Promise.all([api(`/activities/${encodeURIComponent(id)}`),user?api('/registrations'):Promise.resolve({registrations:[]})]);
      const booking=mine.registrations.find(r=>r.activity_id===a.id&&r.status!=='cancelled');
      const closed=a.start_time<=new Date().toISOString()||a.enrolled_count>=a.capacity;
      const form=booking?'<h2>已为你留好位置</h2><p>报名记录已保存，可前往“我的报名”查看。</p><a href="#mine" class="button">查看我的报名</a>':!user?`<h2>加入这场相遇</h2><p>登录后即可填写报名资料。</p><a href="#login" class="button">登录 / 注册</a>`:closed?'<h2>暂时无法报名</h2><p>活动已开始或名额已满。</p>':`<h2>为自己留一个位置</h2><p class="small">每个账号可报名 1 人。资料仅用于活动联系。</p><form id="booking-form"><label for="attendee">参加者姓名</label><input id="attendee" name="attendee_name" required maxlength="60" autocomplete="name" value="${escape(user.name)}"><label for="phone">联系电话</label><input id="phone" name="phone" type="tel" required minlength="7" maxlength="24" autocomplete="tel"><label class="checkbox"><input name="privacy_consent" type="checkbox" required><span>我同意将姓名和联系电话用于本次报名及活动联系。</span></label><div class="form-error" role="alert"></div><button type="submit">确认报名</button></form>`;
      if(!show(`<a class="back" href="#activities">← 返回文化活动</a><div class="detail-grid"><article><span class="tag">${escape(a.category)}</span><h1>${escape(a.title)}</h1><div class="detail-info"><p>时间 · ${date(a.start_time)} — ${date(a.end_time)}</p><p>地点 · ${escape(a.location)}</p><p>名额 · 余 ${Math.max(0,a.capacity-a.enrolled_count)} 席 / 共 ${a.capacity} 席</p><p>费用 · ${a.fee_cents?'¥ '+(a.fee_cents/100).toFixed(2):'免费'}</p></div><h2>关于这场活动</h2><div class="prose">${escape(a.description)}</div></article><aside class="panel">${form}</aside></div>`))return;
      bindForm('booking-form',async data=>{await api('/registrations',{method:'POST',body:{activity_id:a.id,attendee_name:data.get('attendee_name'),phone:data.get('phone'),privacy_consent:data.has('privacy_consent')}});notice('报名成功，期待与你相遇。');location.hash='mine';});
    }else if(page==='login'||page==='signup'){
      const signup=page==='signup';
      if(!show(`<section class="panel auth-panel"><div class="eyebrow">WELCOME TO SANLIAN</div><h1>${signup?'开始一段阅读旅程':'欢迎回来'}</h1><p>${signup?'建立你的本地读者账号。':'登录后查看和管理自己的报名。'}</p><form id="auth-form">${signup?'<label for="name">怎么称呼你</label><input id="name" name="name" required maxlength="60" autocomplete="name">':''}<label for="email">邮箱</label><input id="email" name="email" type="email" required maxlength="254" autocomplete="email"><label for="password">密码</label><input id="password" name="password" type="password" required minlength="12" maxlength="128" autocomplete="${signup?'new-password':'current-password'}"><p class="small">12–128 个字符。此处使用独立的本地账号。</p><div class="form-error" role="alert"></div><button type="submit">${signup?'注册并登录':'登录'}</button></form><a class="text-link" href="#${signup?'login':'signup'}">${signup?'已有账号？去登录':'第一次来？创建账号'}</a></section>`))return;
      bindForm('auth-form',async data=>{const result=await api(`/auth/${signup?'register':'login'}`,{method:'POST',body:Object.fromEntries(data)});user=result.user;account();notice(signup?'账号已创建。':'登录成功。');location.hash=user.role==='stuff'?'admin':'mine';});
    }else if(page==='mine'){
      if(!user){show(`<section class="intro"><h1>我的报名</h1></section>${empty('登录后可查看自己的报名记录。')}<div class="actions"><a href="#login" class="button">去登录</a></div>`);return;}
      const {registrations}=await api('/registrations');
      if(!show(`<section class="intro"><div class="eyebrow">YOUR NEXT CHAPTER</div><h1>我的报名</h1><p>每一次相遇，都从一个期待开始。</p></section><div class="stack">${registrations.length?registrations.map(r=>`<article class="panel booking"><div><span class="tag">${status(r.status)}</span><h3><a href="#activity/${encodeURIComponent(r.activity_id)}">${escape(r.title)}</a></h3><div class="meta">${date(r.start_time)} · ${escape(r.location)}<br>联系电话：${escape(r.phone)} · 人数：${r.headcount}<br>报名时间：${date(r.created_at)}<br><span class="ticket">凭证：${escape(r.ticket_code)}</span></div></div><div class="actions">${r.status==='confirmed'&&r.start_time>new Date().toISOString()?`<button class="secondary" data-cancel="${escape(r.id)}">取消报名</button>`:''}${r.status!=='cancelled'&&r.end_time<=new Date().toISOString()&&!r.has_feedback?`<a class="button secondary" href="#feedback/${encodeURIComponent(r.id)}">评价活动</a>`:''}${r.has_feedback?'<span class="small">已提交反馈</span>':''}</div></article>`).join(''):empty('还没有报名，去发现一场感兴趣的活动吧。')}</div>`))return;
      document.querySelectorAll('[data-cancel]').forEach(button=>button.addEventListener('click',async()=>{if(!confirm('确认取消这次报名？'))return;button.disabled=true;try{await api(`/registrations/${encodeURIComponent(button.dataset.cancel)}/cancel`,{method:'POST',body:{}});notice('报名已取消，名额已释放。');await render();}catch(e){notice(e.message);button.disabled=false;}}));
    }else if(page==='books'){
      const {books}=await api('/books');show(`<section class="intro"><div class="eyebrow">BETWEEN THE PAGES</div><h1>书架漫游</h1><p>让下一本书，带你走向更远的地方。</p></section><div class="grid">${books.length?books.map(b=>`<article class="card"><div class="book-art">${escape(b.category)}</div><div class="card-body"><h3>${escape(b.title)}</h3><p class="small">${escape(b.author)}</p><p>${escape(b.summary)}</p></div></article>`).join(''):empty('书架正在整理中。')}</div>`);
    }else if(page==='feedback'){
      if(!user){location.hash='login';return;}
      if(!show(`<a class="back" href="#mine">← 返回我的报名</a><section class="panel feedback-panel"><h1>把感受留给我们</h1><p>活动结束后，可为自己的有效报名提交一次评价。</p><form id="feedback-form"><label for="rating">评分</label><select id="rating" name="rating"><option value="5">5 · 非常满意</option><option value="4">4 · 满意</option><option value="3">3 · 一般</option><option value="2">2 · 待改进</option><option value="1">1 · 不满意</option></select><label for="content">活动感受</label><textarea id="content" name="content" required minlength="5" maxlength="2000"></textarea><div class="form-error" role="alert"></div><button type="submit">提交反馈</button></form></section>`))return;
      bindForm('feedback-form',async data=>{await api('/feedbacks',{method:'POST',body:{registration_id:id,rating:Number(data.get('rating')),content:data.get('content')}});notice('感谢你的分享。');location.hash='mine';});
    }else if(page==='profile'){
      if(!user){location.hash='login';return;}
      const {user:profile}=await api('/profile');
      if(!show(`<section class="panel auth-panel"><div class="eyebrow">YOUR ACCOUNT</div><h1>我的资料</h1><p>用户组：${profile.role==='stuff'?'管理员（stuff）':'普通用户（user）'}</p><p>邮箱：${escape(profile.email)}</p><p class="small">注册时间：${date(profile.created_at)}</p><form id="profile-form"><label for="profile-name">称呼</label><input id="profile-name" name="name" required maxlength="60" value="${escape(profile.name)}"><div class="form-error" role="alert"></div><button type="submit">保存称呼</button></form></section>`))return;
      bindForm('profile-form',async data=>{await api('/profile',{method:'PATCH',body:{name:data.get('name')}});notice('个人资料已保存。');await render();});
    }else if(page==='myfeedbacks'){
      if(!user){location.hash='login';return;}
      const {feedbacks}=await api('/feedbacks');
      show(`<section class="intro"><div class="eyebrow">YOUR VOICE</div><h1>我的反馈</h1><p>这里显示你自己的评价和门店回复。</p></section><div class="stack">${feedbacks.length?feedbacks.map(f=>`<article class="panel"><span class="tag">${({pending:'待处理',processing:'处理中',replied:'已回复',closed:'已关闭'})[f.status]}</span><h3>${escape(f.title)}</h3><p class="small">${f.rating} / 5 分 · ${date(f.created_at)}</p><div class="prose">${escape(f.content)}</div>${f.reply?`<div class="staff-reply"><b>门店回复</b><div class="prose">${escape(f.reply)}</div></div>`:''}</article>`).join(''):empty('还没有提交反馈。')}</div>`);
    }else if(page==='admin'){
      if(user?.role!=='stuff'){show(empty('此页面仅供 stuff 管理员使用，请使用管理员账号登录。'));return;}
      await renderAdmin(root,{tab:id||'overview',user,escape,date,status,notice,refresh:render,isCurrent:()=>version===renderId});
    }else{show(`<h1>这一页暂时没有内容</h1><a href="#home" class="text-link">回到首页</a>`);}
  }catch(e){show(`<section class="intro"><h1>暂时无法打开</h1><p class="error">${escape(e.message)}</p><a class="text-link" href="#home">回到首页</a></section>`);}
}
window.addEventListener('hashchange',()=>{render();window.scrollTo({top:0,behavior:'instant'});});
try{user=(await api('/auth/me')).user;}catch(e){notice('连接服务失败，请确认本地服务已启动。');}
account();await render();
