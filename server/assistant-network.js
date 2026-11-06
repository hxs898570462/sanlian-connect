import {request as httpRequest} from 'node:http';
import {request as httpsRequest,Agent} from 'node:https';
import {connect} from 'node:tls';

// Optional local development tunnel. TLS still authenticates api.deepseek.com;
// the proxy never receives the API Authorization header in plaintext.
export async function proxyFetch(url,options,proxyURL) {
 const target=new URL(url),proxy=new URL(proxyURL);
 if(target.origin!=='https://api.deepseek.com'||proxy.protocol!=='http:'||!['127.0.0.1','localhost'].includes(proxy.hostname)||proxy.username||proxy.password||proxy.pathname!=='/'||proxy.search||proxy.hash)
  throw Error('Invalid AI proxy configuration');
 let tunnel,agent;
 try{
  tunnel=await new Promise((resolve,reject)=>{
   const req=httpRequest({hostname:proxy.hostname,port:proxy.port||80,method:'CONNECT',path:target.hostname+':443',signal:options.signal});
   req.on('error',reject);
   req.on('connect',(res,socket,head)=>{
    if(res.statusCode!==200){socket.destroy();reject(Error('Proxy unavailable'));return;}
    if(head.length)socket.unshift(head);resolve(socket);
   });req.end();
  });
  agent=new Agent({keepAlive:false});
  agent.createConnection=()=>connect({socket:tunnel,servername:target.hostname,rejectUnauthorized:true,ALPNProtocols:['http/1.1']});
  return await new Promise((resolve,reject)=>{
   const req=httpsRequest(target,{method:options.method,headers:{...options.headers,'Accept-Encoding':'identity'},signal:options.signal,agent},res=>{
    const chunks=[];let size=0;
    res.on('error',reject);
    res.on('data',chunk=>{size+=chunk.length;if(size>128000){req.destroy(Error('Response too large'));return;}chunks.push(chunk);});
    res.on('end',()=>{
     if(res.statusCode>=300&&res.statusCode<400){reject(Error('Redirect rejected'));return;}
     try{resolve(new Response(Buffer.concat(chunks),{status:res.statusCode}));}catch(error){reject(error);}
    });
   });req.on('error',reject);req.end(options.body);
  });
 }finally{agent?.destroy();tunnel?.destroy();}
}
