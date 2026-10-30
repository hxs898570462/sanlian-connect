import EmbeddedPostgres from 'embedded-postgres';
import {createServer} from 'node:net';
import {once} from 'node:events';

export async function freePort() {
 const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;
}
export function postgresRuntime({directory,password,port}) {
 return new EmbeddedPostgres({databaseDir:directory,user:'postgres',password,port,persistent:true,
  createPostgresUser:false,authMethod:'scram-sha-256',
  initdbFlags:['--encoding=UTF8','--locale=C'],postgresFlags:['-h','127.0.0.1'],
  onLog:()=>{},onError:()=>{}});
}
