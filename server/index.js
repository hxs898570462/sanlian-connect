import { createApp } from './app.js';
import { openDatabase } from './db.js';
const port=Number(process.env.PORT||3000);
const db=await openDatabase();
const server=createApp(db).listen(port,'127.0.0.1',()=>console.log(`Sanlian Connect: http://localhost:${server.address().port}`));
function close(){server.close(async()=>{await db.close();process.exit(0);});}
process.once('SIGINT',close);process.once('SIGTERM',close);
