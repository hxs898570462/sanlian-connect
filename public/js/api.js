import {errorMessage} from './api-errors.js';
import {getLanguage} from './i18n.js';

export async function api(path, options={}) {
  const response=await fetch(`/api${path}`,{
    ...options,credentials:'same-origin',
    headers:{'Content-Type':'application/json','X-Requested-With':'sanlian','Accept-Language':getLanguage(),...options.headers},
    body:options.body===undefined?undefined:JSON.stringify(options.body)
  });
  const data=await response.json();
  if(!response.ok){const e=new Error(errorMessage(data.error));e.status=response.status;throw e;}
  return data;
}
