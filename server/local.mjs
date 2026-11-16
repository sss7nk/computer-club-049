import http from 'node:http';
import {readFileSync,existsSync,mkdirSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {openDatabase} from './local-db.mjs';
import {api,ensureSeed} from './api.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const port=Number(process.env.PORT||4173),runtime=path.join(root,'.runtime');mkdirSync(runtime,{recursive:true});
const db=openDatabase(process.env.CLUB_DATABASE||path.join(runtime,'club.sqlite'));
if(!db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='meta'").get()){
  db.raw.exec(readFileSync(path.join(root,'db/schema.sql'),'utf8'));db.raw.exec(readFileSync(path.join(root,'db/web.sql'),'utf8'));
}
await ensureSeed(db);
const files={'/':['index.html','text/html; charset=utf-8'],'/index.html':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/styles.css':['styles.css','text/css; charset=utf-8']};
files['/gaming.css']=['gaming.css','text/css; charset=utf-8'];
for(const name of readdirSync(path.join(root,'public/modules')).filter(name=>/^[a-z-]+\.js$/.test(name)))files['/modules/'+name]=['modules/'+name,'text/javascript; charset=utf-8'];
export const securityHeaders={
  'x-content-type-options':'nosniff','referrer-policy':'same-origin','x-frame-options':'DENY',
  'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
};
const server=http.createServer(async(req,res)=>{try{
  const host=req.headers.host; if(!['127.0.0.1:'+port,'localhost:'+port].includes(host)){res.writeHead(403);res.end('Invalid host');return;}
  const url=new URL(req.url,'http://'+host);let response;
  if(url.pathname.startsWith('/api/')){
    const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>65536){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
    const request=new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
    response=await api(request,{DB:db,__clientIp:req.socket.remoteAddress});
  }else if(files[url.pathname]){const [filename,type]=files[url.pathname];response=new Response(readFileSync(path.join(root,'public',filename)),{headers:{'content-type':type,'cache-control':'no-cache'}});}
  else if(url.pathname==='/favicon.ico')response=new Response(null,{status:204});
  else response=new Response('Страница не найдена',{status:404});
  res.writeHead(response.status,{...securityHeaders,...Object.fromEntries(response.headers)});res.end(Buffer.from(await response.arrayBuffer()));
}catch(error){console.error(error.message);if(!res.headersSent)res.writeHead(500,{'content-type':'text/plain; charset=utf-8'});res.end('Не удалось обработать запрос');}});
server.listen(port,'127.0.0.1',()=>console.log(`КЛУБ 049: http://127.0.0.1:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
