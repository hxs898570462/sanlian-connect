const groups={
  theme:{label:'外观',choices:{light:'白天',dark:'黑夜'}},
  font:{label:'字体大小',choices:{standard:'标准',large:'大',extra:'特大'}}
};
const storageKey='sanlian-display';
let saved;
try{saved=JSON.parse(localStorage.getItem(storageKey));}catch{}
const preferences={theme:'light',font:'standard'};
for(const [key,{choices}] of Object.entries(groups)){
  const value=saved?.[key];
  if(typeof value==='string'&&Object.hasOwn(choices,value))preferences[key]=value;
}

export function applyPreferences(page){
  const root=document.documentElement;
  root.dataset.theme=page==='admin'?'light':preferences.theme;
  root.dataset.font=page==='admin'?'standard':preferences.font;
}

export function bindPreferences(){
  document.querySelector('#display-preferences').addEventListener('change',({target})=>{
    const {name,value}=target;
    if(!Object.hasOwn(groups,name)||!Object.hasOwn(groups[name].choices,value))return;
    preferences[name]=value;
    applyPreferences('settings');
    try{localStorage.setItem(storageKey,JSON.stringify(preferences));}catch{}
  });
}

const categories={profile:'编辑个人资料',display:'显示偏好',security:'账号与安全',privacy:'隐私与帮助',about:'关于'};
const genders={'':'不填写',female:'女',male:'男',other:'其他'};

export function profileView({profile,escape,date}){
  const rows=fields=>`<dl class="profile-details">${fields.map(([label,value])=>
    `<div class="setting-row setting-value"><dt>${label}</dt><dd>${escape(value||'未填写')}</dd></div>`
  ).join('')}</dl>`;
  return `<section class="account-page">
    <div class="account-heading"><h1>我的资料</h1><a class="button secondary" href="#settings">设置</a></div>
    <h2>个人信息</h2>
    ${rows([['昵称',profile.name],['性别',profile.gender&&genders[profile.gender]],['地区',profile.region],['签名',profile.signature]])}
    <h2>账号信息</h2>
    ${rows([['邮箱',profile.email],['用户组',profile.role==='stuff'?'管理员（stuff）':'普通用户（user）'],['注册时间',date(profile.created_at)]])}
  </section>`;
}

function displayOptions(){
  return `<div id="display-preferences">${Object.entries(groups).map(([name,{label,choices}])=>`
    <fieldset class="setting-row">
      <legend>${label}</legend>
      <div class="segments">${Object.entries(choices).map(([value,label])=>`
        <label><input type="radio" name="${name}" value="${value}" ${preferences[name]===value?'checked':''}><span>${label}</span></label>
      `).join('')}</div>
    </fieldset>`).join('')}</div>`;
}

export function settingsPage({section,profile,email,version,escape}){
  const category=Object.hasOwn(categories,section)?categories[section]:'';
  let content;
  if(section==='profile'){
    content=`<form id="profile-form" class="settings-form">
      <label for="profile-name">昵称</label><input id="profile-name" name="name" required maxlength="60" autocomplete="nickname" value="${escape(profile.name)}">
      <label for="profile-gender">性别</label><select id="profile-gender" name="gender">${Object.entries(genders).map(([value,label])=>`<option value="${value}" ${value===profile.gender?'selected':''}>${label}</option>`).join('')}</select>
      <label for="profile-region">地区</label><input id="profile-region" name="region" maxlength="60" placeholder="例如：太仓" value="${escape(profile.region)}">
      <label for="profile-signature">签名</label><input id="profile-signature" name="signature" maxlength="100" value="${escape(profile.signature)}">
      <div class="form-error" role="alert"></div><button type="submit">保存资料</button>
    </form>`;
  }else if(section==='display'){
    content=displayOptions();
  }else if(section==='security'){
    content=`
      <dl class="setting-row setting-value"><dt>登录邮箱</dt><dd>${escape(email)}</dd></dl>
      <details class="setting-row">
        <summary>修改密码</summary>
        <form id="password-form" class="settings-form">
          <label for="current-password">当前密码</label><input id="current-password" name="current_password" type="password" autocomplete="current-password" required minlength="12" maxlength="128">
          <label for="new-password">新密码</label><input id="new-password" name="new_password" type="password" autocomplete="new-password" required minlength="12" maxlength="128" aria-describedby="password-rules">
          <label for="confirm-password">确认新密码</label><input id="confirm-password" name="confirm_password" type="password" autocomplete="new-password" required minlength="12" maxlength="128">
          <p class="small" id="password-rules">密码为 12–128 个字符。修改后，所有设备都需要重新登录。</p>
          <div class="form-error" role="alert"></div><button type="submit">保存新密码</button>
        </form>
      </details>
      <div class="setting-row"><button class="secondary" id="settings-logout" type="button">退出登录</button></div>`;
  }else if(section==='privacy'){
    content=`<div class="setting-row"><h2>报名信息用途</h2><p>报名时提供的姓名和联系电话，仅用于本次活动的报名及联络。</p></div>`;
  }else if(section==='about'){
    content=`<dl class="setting-row setting-value"><dt>系统版本</dt><dd>${escape(version)}</dd></dl>`;
  }else{
    content=`<nav aria-label="设置分类"><ul class="settings-menu">${Object.entries(categories).map(([id,label])=>
      `<li><a href="#settings/${id}">${label}<span aria-hidden="true">›</span></a></li>`
    ).join('')}</ul></nav>`;
  }
  return `<div class="account-page">
    <a class="back" href="#${category?'settings':'mine'}">← 返回${category?'设置':'读者一隅'}</a>
    <h1 tabindex="-1">${category||'设置'}</h1>
    ${content}
  </div>`;
}
