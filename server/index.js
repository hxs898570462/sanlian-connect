import { createApp } from './app.js';
import { openDatabase } from './db.js';
import { httpConfig } from './config.js';
const http=httpConfig();
const db=await openDatabase();
const server=createApp(db,{http}).listen(http.port,http.host,()=>console.log(`Sanlian Connect: ${http.origin||'http://localhost:'+server.address().port}`));
function close(){server.close(async()=>{await db.close();process.exit(0);});}
process.once('SIGINT',close);process.once('SIGTERM',close);
