export async function api(path, options={}) {
  const response=await fetch(`/api${path}`,{
    ...options,credentials:'same-origin',
    headers:{'Content-Type':'application/json','X-Requested-With':'sanlian',...options.headers},
    body:options.body===undefined?undefined:JSON.stringify(options.body)
  });
  const data=await response.json();
  if(!response.ok){const e=new Error(data.error||'请求失败');e.status=response.status;throw e;}
  return data;
}
