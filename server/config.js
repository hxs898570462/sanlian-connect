import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const envPath=fileURLToPath(new URL('../.env',import.meta.url));
if(existsSync(envPath))process.loadEnvFile(envPath);

export function httpConfig(env=process.env) {
 const production=env.NODE_ENV==='production';
 const render=env.RENDER==='true';
 const rawOrigin=env.APP_ORIGIN||(render?env.RENDER_EXTERNAL_URL:'');
 let origin=null;
 if(rawOrigin){
  let url;try{url=new URL(rawOrigin);}catch{throw Error('APP_ORIGIN 必须是完整的网站地址');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)
   throw Error('APP_ORIGIN 只能包含协议、域名和可选端口');
  if(production&&url.protocol!=='https:')throw Error('线上 APP_ORIGIN 必须使用 HTTPS');
  origin=url.origin;
 }
 if(production&&!origin)throw Error('线上运行需要 APP_ORIGIN 或 Render 自动提供的 RENDER_EXTERNAL_URL');
 const rawHops=env.TRUST_PROXY_HOPS??(render?'1':'0');
 if(!/^\d+$/.test(String(rawHops))||Number(rawHops)>10)throw Error('TRUST_PROXY_HOPS 必须是 0–10 的整数');
 const port=Number(env.PORT||3000);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT 必须是 1–65535 的整数');
 return {production,origin,proxyHops:Number(rawHops),host:env.HOST||(production?'0.0.0.0':'127.0.0.1'),port};
}
