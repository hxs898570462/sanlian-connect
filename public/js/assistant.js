import {api} from './api.js';

export function createAssistant({navigate}) {
 const host=document.createElement('aside');host.className='reading-assistant';host.setAttribute('aria-label','三联 AI 阅读助手');
 host.innerHTML=`<button class="assistant-launcher" aria-expanded="false" aria-controls="assistant-panel"><span aria-hidden="true">✦</span> 阅读助手</button>
 <section id="assistant-panel" class="assistant-panel" role="region" aria-labelledby="assistant-title" hidden>
  <header class="assistant-header"><div><span class="assistant-eyebrow">SANLIAN · AI</span><h2 id="assistant-title">一起找一场相遇</h2></div><button type="button" class="assistant-close" aria-label="收起阅读助手">×</button></header>
  <div class="assistant-disclosure">AI 会使用活动与书架资料回答。消息经处理后发送至 DeepSeek；请勿输入电话、密码等个人信息。报名资料请在网站表单填写。</div>
  <div class="assistant-messages" role="log" aria-label="聊天记录" aria-live="polite" aria-relevant="additions"></div>
  <div class="assistant-suggestions"><button type="button">最近有哪些活动？</button><button type="button">推荐一本文学类的书</button></div>
  <p class="assistant-status" role="status"></p>
  <form class="assistant-form"><label class="assistant-input-label" for="assistant-input">告诉我你想参加什么活动，或想读什么书</label><div><textarea id="assistant-input" rows="2" maxlength="1500" placeholder="例如：我想参加读书会" required></textarea><button type="submit" aria-label="发送消息">发送</button></div></form>
  <div class="assistant-bottom"><span>报名由你核对并亲自确认</span><button type="button" class="assistant-reset">清空对话</button></div>
 </section>`;
 document.body.append(host);
 const panel=host.querySelector('.assistant-panel'),launcher=host.querySelector('.assistant-launcher'),input=host.querySelector('textarea'),log=host.querySelector('.assistant-messages'),status=host.querySelector('.assistant-status'),form=host.querySelector('form');
 let userId,enabled=false,busy=false,generation=0;
 let conversationId=crypto.randomUUID();
 const message=(text,who='assistant')=>{const el=document.createElement('div');el.className='assistant-message '+who;el.textContent=text;log.append(el);log.scrollTop=log.scrollHeight;return el;};
 const controls=()=>{
  input.disabled=!enabled||!userId||busy;form.querySelector('button').disabled=input.disabled;
  host.querySelectorAll('.assistant-suggestions button,.assistant-reset').forEach(b=>b.disabled=input.disabled);
 };
 function setOpen(open){panel.hidden=!open;launcher.setAttribute('aria-expanded',String(open));if(open&&!input.disabled)input.focus();if(!open)launcher.focus();}
 function welcome(){log.replaceChildren();message('你好，我是三联阅读助手。可以帮你找活动、推荐书架里的书，并带你到报名确认页。');}
 async function check(){
  try{enabled=(await api('/assistant/status')).enabled;status.replaceChildren();
   if(!enabled)status.textContent='AI 助手尚未配置，活动与书架仍可直接浏览。';
   else if(!userId){status.append('登录后即可与助手对话。');const link=document.createElement('a');link.href='#login';link.textContent='去登录 →';link.addEventListener('click',()=>setOpen(false));status.append(link);}
  }catch{enabled=false;status.textContent='暂时连接不上助手，请稍后重新打开。';}controls();
 }
 launcher.addEventListener('click',()=>{setOpen(panel.hidden);if(!panel.hidden)check();});
 host.querySelector('.assistant-close').addEventListener('click',()=>setOpen(false));
 host.addEventListener('keydown',e=>{if(e.key==='Escape'){setOpen(false);e.stopPropagation();}});
 const date=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
 function card(item,parent){
  if(!['activity','registration','book'].includes(item.kind)||typeof item.id!=='string')return;
  const el=document.createElement('article');el.className='assistant-card';
  const title=document.createElement('strong');title.textContent=item.title;el.append(title);
  const detail=document.createElement('p');detail.textContent=item.kind==='book'?`${item.author} · ${item.category}`:`${date(item.start_time)} · ${item.location}\n${item.fee_cents?'¥'+(item.fee_cents/100).toFixed(2):'免费'} · 余 ${item.remaining} 席`;el.append(detail);
  const button=document.createElement('button');button.type='button';button.className='secondary';
  button.textContent=item.kind==='book'?'查看书目 →':item.kind==='registration'?'核对报名资料 →':'查看活动 / 报名 →';
  button.addEventListener('click',()=>{navigate(item);setOpen(false);});el.append(button);parent.append(el);
 }
 async function send(text){
  if(busy||!enabled||!userId||!text.trim())return;
  const version=generation;busy=true;controls();input.value='';message(text,'user');status.textContent='正在查询，请稍候…';
  try{
   const result=await api('/assistant/chat',{method:'POST',body:{message:text,conversation_id:conversationId}});
   if(version!==generation)return;
   const bubble=message(result.reply);for(const item of result.cards||[])card(item,bubble);
   log.scrollTop=log.scrollHeight;status.textContent='';
   const ready=result.cards?.find(c=>c.kind==='registration');if(ready){navigate(ready);setOpen(false);}
  }catch(error){if(version!==generation)return;message(error.message);status.textContent='这条消息未完成，可重新发送。';input.value=text;if(error.status===401)await check();}
  finally{if(version===generation){busy=false;controls();if(!panel.hidden&&!input.disabled)input.focus();}}
 }
 form.addEventListener('submit',e=>{e.preventDefault();send(input.value);});
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit();}});
 host.querySelectorAll('.assistant-suggestions button').forEach(button=>button.addEventListener('click',()=>send(button.textContent)));
 host.querySelector('.assistant-reset').addEventListener('click',async()=>{
  if(busy)return;busy=true;controls();try{await api('/assistant/conversation',{method:'DELETE',body:{conversation_id:conversationId}});welcome();status.textContent='已清空对话。';}catch(e){status.textContent=e.message;}finally{busy=false;controls();}
 });
 welcome();controls();
 return {setUser(user){
  const next=user?.id||null;if(next===userId)return;
  userId=next;conversationId=crypto.randomUUID();generation++;busy=false;welcome();controls();check();
 }};
}
