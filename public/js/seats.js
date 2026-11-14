import {api} from './api.js';
import {t} from './i18n.js';
import {seatPoints} from './seat-layout.js';

let dateChoice='',slotChoice='',seatChoice='';
const slotLabel=slot=>{
  const [hour,minute]=slot.split(':');
  return `${slot}–${String(Number(hour)+2).padStart(2,'0')}:${minute}`;
};
const selectOptions=(values,selected,labels=value=>value)=>values.map(value=>
  `<option value="${value}"${value===selected?' selected':''}>${labels(value)}</option>`).join('');
const statusLabel=(r,now)=>r.cancelled_at?t('已取消'):r.ends_at<=now?t('已结束'):t('已预约');
const tabs=mine=>`<nav aria-label="${t('座位预约导航')}" class="seat-tabs">
  <a href="#seats"${mine?'':' aria-current="page"'}>${t('预约座位')}</a>
  <a href="#seats/mine"${mine?' aria-current="page"':''}>${t('我的预约')}</a></nav>`;

export async function renderSeats({show,mine,user,escape,notice,refresh}) {
  if(mine) {
    const data=user?await api('/seat-reservations'):null;
    const rows=data?.reservations;
    if(!show(`<section class="seat-page"><h1>${t('我的预约')}</h1>${tabs(true)}
      ${!data?`<a class="button" href="#login/seat-history">${t('请先登录')}</a>`:rows.length?`<ul class="seat-records">${rows.map(r=>`
        <li><div><strong>${escape(r.seat_code)}</strong><span>${localSlot(r.starts_at)}</span>
        <span class="tag">${statusLabel(r,data.now)}</span></div>
        ${!r.cancelled_at&&r.starts_at>data.now?`<button type="button" class="secondary" data-seat-cancel="${escape(r.id)}">${t('取消预约')}</button>`:''}</li>`).join('')}</ul>`:`<p>${t('还没有座位预约。')}</p>`}
      <p class="error" role="alert"></p></section>`))return;
    document.querySelectorAll('[data-seat-cancel]').forEach(button=>button.addEventListener('click',async()=>{
      if(!confirm(t('确认取消这次座位预约？')))return;
      const error=document.querySelector('.seat-page [role=alert]');
      button.disabled=true;error.textContent='';
      try {
        await api(`/seat-reservations/${encodeURIComponent(button.dataset.seatCancel)}/cancel`,{method:'POST',body:{}});
        notice(t('预约已取消，座位已释放。'));if(button.isConnected)await refresh();
      }catch(e){error.textContent=e.message;button.disabled=false;}
    }));
    return;
  }
  if(!show(`<section class="seat-page"><h1>${t('预约座位')}</h1>${tabs(false)}
    <p class="seat-demo"><strong>${t('演示预约')}</strong> <span>${t('预约状态不代表现场空座。')}</span></p>
    <div class="seat-filters" hidden>
      <label>${t('预约日期')}<select id="seat-date"></select></label>
      <label>${t('预约时段')}<select id="seat-slot"></select></label>
    </div>
    <p id="seat-loading" role="status" hidden>${t('正在加载…')}</p>
    <p id="seat-error" class="error" role="alert"></p>
    <button id="seat-retry" type="button" class="secondary" hidden>${t('重新加载')}</button>
    <div class="seat-workspace" hidden>
      <div class="seat-pick"></div>
      <figure class="seat-plan"></figure>
    </div>
  </section>`))return;
  const page=document.querySelector('.seat-page');
  const dates=page.querySelector('#seat-date'),slots=page.querySelector('#seat-slot'),filters=page.querySelector('.seat-filters');
  const retry=page.querySelector('#seat-retry'),error=page.querySelector('#seat-error');
  const loading=page.querySelector('#seat-loading');
  const workspace=page.querySelector('.seat-workspace'),pick=page.querySelector('.seat-pick'),plan=page.querySelector('.seat-plan');
  let data,request=0;
  const activeSlot=()=>data.slots.find(s=>s.slot===slotChoice);
  function choose(seat) {
    seatChoice=seat;
    workspace.querySelectorAll('[data-seat]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.seat===seat)));
    page.querySelector('#seat-selection').textContent=seat?`${seat} / ${data.date} / ${slotLabel(slotChoice)}`:t('未选择座位');
    const submit=page.querySelector('#seat-submit');
    if(submit)submit.disabled=!seat;
  }
  function draw() {
    const slot=activeSlot();
    const label=code=>t(slot?.reserved.includes(code)?'已预约':slot?.open?'可预约':'不可预约');
    const button=code=>`<button type="button" class="seat-button" data-seat="${escape(code)}"
      aria-label="${escape(code)} · ${label(code)}" data-reserved="${Boolean(slot?.reserved.includes(code))}"
      aria-pressed="false"${slot?.open&&!slot.reserved.includes(code)?'':' disabled'}>${escape(code)}</button>`;
    pick.innerHTML=`<h2>${t('选择座位')}</h2>${slot?.open?'':`<p>${t('当天没有尚未开始的时段。')}</p>`}
      ${['A','B'].map(zone=>{
        const seats=data.seats.filter(code=>code.startsWith(zone+'-'));
        return `<section class="seat-zone"><h3>${t('{zone} 区',{zone})}<span>${t('{count} 席可预约',{count:slot?.open?seats.filter(code=>!slot.reserved.includes(code)).length:0})}</span></h3>
          <div class="seat-list">${seats.map(button).join('')}</div></section>`;
      }).join('')}
      <div class="seat-checkout"><p id="seat-selection" role="status"></p>
        ${user?`<button type="button" id="seat-submit" disabled>${t('确认预约')}</button>`:`<a class="button" href="#login/seats">${t('登录后预约')}</a>`}</div>`;
    plan.innerHTML=`<svg viewBox="0 0 650 780" aria-label="${t('一楼座位示意图')}">
      <image href="/seat-plan.svg" width="650" height="780" />
      <g class="seat-plan-labels" text-anchor="middle"><text x="174" y="161">${t('面包店')}</text>
      <text x="507" y="228">${t('门厅')}</text><text x="286" y="384">${t('综合服务区')}</text>
      <text x="91" y="189">A</text><text x="583" y="279">B</text><text x="263" y="687">C</text></g>
      ${data.seats.filter(code=>Object.hasOwn(seatPoints,code)).map(code=>{
        const [x,y]=seatPoints[code];
        return `<foreignObject x="${x-30}" y="${y-13}" width="60" height="26">${button(code)}</foreignObject>`;
      }).join('')}</svg>
      <figcaption>${t('一楼 · 座位示意图')}<span>${t('C 区：消费入座，不开放预约')}</span></figcaption>`;
    if(!slot?.open||slot.reserved.includes(seatChoice)||!data.seats.includes(seatChoice))seatChoice='';
    choose(seatChoice);
    workspace.querySelectorAll('[data-seat]').forEach(button=>button.addEventListener('click',()=>{
      error.textContent='';choose(button.dataset.seat);
    }));
    pick.querySelector('#seat-submit')?.addEventListener('click',async event=>{
      const button=event.currentTarget;
      if(!seatChoice||!slot?.open)return;
      const version=request;
      workspace.inert=true;filters.inert=true;button.disabled=true;error.textContent='';
      try {
        await api('/seat-reservations',{method:'POST',body:{seat_code:seatChoice,date:data.date,slot:slotChoice}});
        seatChoice='';notice(t('座位预约成功。'));if(page.isConnected)location.hash='seats/mine';
      }catch(e){
        if(!page.isConnected||version!==request)return;
        if(e.status===409){seatChoice='';await load(dateChoice);}
        if(page.isConnected&&!error.textContent)error.textContent=e.message;
      }finally{
        workspace.inert=false;filters.inert=false;if(button.isConnected)button.disabled=!seatChoice;
      }
    });
  }
  async function load(value) {
    const version=++request;
    error.textContent='';retry.hidden=true;workspace.hidden=true;filters.inert=true;loading.hidden=false;
    try {
      data=await api('/seats'+(value?'?'+new URLSearchParams({date:value}):'')).catch(e=>{
        if(e.status!==400||!value)throw e;
        return api('/seats');
      });
      if(!page.isConnected||version!==request)return;
      dateChoice=data.date;
      const open=data.slots.filter(s=>s.open);
      if(!open.some(s=>s.slot===slotChoice))slotChoice=open[0]?.slot??'';
      dates.innerHTML=selectOptions(data.dates,dateChoice);
      slots.innerHTML=open.length?selectOptions(open.map(s=>s.slot),slotChoice,slotLabel):`<option value="">${t('没有可预约时段')}</option>`;
      slots.disabled=!open.length;
      filters.hidden=false;workspace.hidden=false;draw();
    }catch(e){
      if(page.isConnected&&version===request){error.textContent=e.message;retry.hidden=false;}
    }finally{if(version===request){filters.inert=false;loading.hidden=true;}}
  }
  dates.addEventListener('change',()=>{dateChoice=dates.value;seatChoice='';load(dateChoice);});
  slots.addEventListener('change',()=>{slotChoice=slots.value;seatChoice='';error.textContent='';draw();});
  retry.addEventListener('click',()=>load(dateChoice));
  await load(dateChoice);
}

function localSlot(start) {
  const date=new Date(Date.parse(start)+8*3600000).toISOString();
  return `${date.slice(0,10)} / ${slotLabel(date.slice(11,16))}`;
}

let rosterFilter={};
export async function seatRoster(escape) {
  const {date,slot,slots,reservations}=await api('/admin/seat-reservations?'+new URLSearchParams(rosterFilter));
  return `<form id="seat-roster-filter" class="seat-filters">
    <label>${t('预约日期')}<input type="date" name="date" value="${escape(date)}" required></label>
    <label>${t('预约时段')}<select name="slot">${selectOptions(slots,slot,slotLabel)}</select></label>
    <button type="submit">${t('查看名单')}</button></form>
    ${reservations.length?`<table class="seat-roster"><thead><tr><th>${t('座号')}</th><th>${t('预约人称呼')}</th><th>${t('状态')}</th></tr></thead>
    <tbody>${reservations.map(r=>`<tr><td>${escape(r.seat_code)}</td><td>${escape(r.name)}</td><td>${t(r.status==='cancelled'?'已取消':'已预约')}</td></tr>`).join('')}</tbody></table>`:`<p>${t('该时段没有预约。')}</p>`}`;
}

export function bindSeatRoster(form,refresh) {
  form?.addEventListener('submit',event=>{
    event.preventDefault();rosterFilter=Object.fromEntries(new FormData(form));refresh();
  });
}
