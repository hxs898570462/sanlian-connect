import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {projectRoot} from '../server/db.js';
import {postgresRuntime} from './postgres-runtime.js';

const directory=resolve(projectRoot,'data/postgres'),settingsPath=resolve(projectRoot,'data/postgres-local.json');
mkdirSync(resolve(projectRoot,'data'),{recursive:true});
let settings;
if(existsSync(settingsPath))settings=JSON.parse(readFileSync(settingsPath,'utf8'));
else{
 settings={port:55432,password:randomBytes(24).toString('hex')};
 writeFileSync(settingsPath,JSON.stringify(settings),'utf8');
}
const runtime=postgresRuntime({directory,...settings});
if(!existsSync(resolve(directory,'PG_VERSION')))await runtime.initialise();
await runtime.start();
const control=runtime.getPgClient('postgres','127.0.0.1');await control.connect();
try {if(!(await control.query("SELECT 1 FROM pg_database WHERE datname='sanlian'")).rowCount)await control.query('CREATE DATABASE sanlian');}
finally{await control.end();}
const envPath=resolve(projectRoot,'.env');
if(!existsSync(envPath))writeFileSync(envPath,
 `DATABASE_URL=postgresql://postgres:${settings.password}@127.0.0.1:${settings.port}/sanlian\nSEED_DEMO=false\n`,'utf8');
console.log('本地 PostgreSQL 已启动（仅本机）。连接配置保存在忽略提交的 .env 中。');
console.log('已有 .env 会原样保留；请在另一个终端运行 npm run migrate:sqlite 或 npm run dev。Ctrl+C 停止数据库。');
let closing=false;
async function close(){if(closing)return;closing=true;await runtime.stop();process.exit(0);}
process.once('SIGINT',close);process.once('SIGTERM',close);
setInterval(()=>{},60000).unref();
