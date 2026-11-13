import english from './messages-en.js';

const storageKey='sanlian-language';
let language='zh-CN';
try{if(localStorage.getItem(storageKey)==='en')language='en';}catch{}

export const getLanguage=()=>language;

export function setLanguage(value){
  language=value==='en'?'en':'zh-CN';
  try{localStorage.setItem(storageKey,language);}catch{}
}

export function translate(source,messages,values){
  const template=language==='en'&&Object.hasOwn(messages,source)?messages[source]:source;
  return values?template.replace(/\{(\w+)\}/g,(part,key)=>Object.hasOwn(values,key)?String(values[key]):part):template;
}

export const t=(source,values)=>translate(source,english,values);

// Static text and accessibility attributes use their original Chinese copy as the key.
export function localize(root){
  for(const node of root.querySelectorAll('[data-copy]')){
    node.dataset.copy ||= node.textContent;
    node.textContent=t(node.dataset.copy);
  }
  for(const attr of ['aria-label','placeholder']){
    for(const node of root.querySelectorAll(`[data-copy-${attr}]`)){
      const key='data-copy-'+attr;
      if(!node.getAttribute(key))node.setAttribute(key,node.getAttribute(attr));
      node.setAttribute(attr,t(node.getAttribute(key)));
    }
  }
}

const dateFormats=Object.fromEntries(['zh-CN','en'].map(locale=>[locale,
  new Intl.DateTimeFormat(locale,{timeZone:'Asia/Shanghai',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
]));
export const formatDate=value=>dateFormats[language].format(new Date(value));
