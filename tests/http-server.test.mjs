import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {request as httpRequest} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
async function freePort(){const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));return port;}
async function start(port,data){
 const child=spawn(process.execPath,['server/local.mjs'],{cwd:root,env:{...process.env,PORT:String(port),DATA_DIR:data,CLUB_DATABASE:'',CLUB_RUNTIME_DIR:'',LISTEN_HOST:'127.0.0.1',PUBLIC_ORIGIN:'https://club.example.test'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{child.kill();reject(new Error('HTTP server startup timeout'));},10000);child.once('exit',code=>{clearTimeout(timeout);reject(new Error('HTTP server exited '+code));});child.stdout.on('data',data=>{if(data.toString().includes('КЛУБ 049:')){clearTimeout(timeout);resolve();}});});
 return child;
}
async function stop(child){if(child.exitCode!==null)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
function call(port,route,{method='GET',body,cookie,csrf,host='club.example.test',origin='https://club.example.test'}={}){
 const data=body===undefined?null:JSON.stringify(body);
 return new Promise((resolve,reject)=>{
  const headers={host,origin,...(data?{'content-type':'application/json','content-length':Buffer.byteLength(data)}:{}),...(cookie?{cookie}:{}),...(csrf?{'x-csrf-token':csrf}:{})};
  const req=httpRequest({host:'127.0.0.1',port,path:route,method,headers},res=>{let text='';res.setEncoding('utf8');res.on('data',part=>text+=part);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,data:res.headers['content-type']?.includes('json')?JSON.parse(text):text}));});
  req.on('error',reject);if(data)req.write(data);req.end();
 });
}
test('HTTPS-прокси: Host, Origin, Secure-cookie и постоянная SQLite после перезапуска',async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'club049-http-')),port=await freePort();let child;
 try{
  child=await start(port,folder);
  assert.equal((await call(port,'/api/public',{host:'evil.example.test'})).status,403);
  assert.equal((await call(port,'/api/public')).status,200);
  assert.equal((await call(port,'/health',{host:'localhost:'+port})).status,200);
  const login=await call(port,'/api/auth/login',{method:'POST',body:{login:'manager',password:'Club_Demo_2026!'}});
  assert.equal(login.status,200);assert.match(login.headers['set-cookie'][0],/; Secure/);
  const auth={cookie:login.headers['set-cookie'][0].split(';')[0],csrf:login.data.user.csrf_token};
  assert.equal((await call(port,'/api/staff',{...auth,method:'POST',origin:'https://evil.example.test',body:{}})).status,403);
  const created=await call(port,'/api/staff',{...auth,method:'POST',body:{full_name:'Проверка постоянного хранилища',login:'persistent_admin',password:'Persistent2026!',password_confirm:'Persistent2026!',roles:['admin']}});
  assert.equal(created.status,201,JSON.stringify(created.data));
  await stop(child);child=await start(port,folder);
  const after=await call(port,'/api/auth/login',{method:'POST',body:{login:'persistent_admin',password:'Persistent2026!'}});
  assert.equal(after.status,200);assert.deepEqual(after.data.user.roles,['admin']);
 }finally{
  if(child)await stop(child);
  const resolved=path.resolve(folder);assert.equal(path.dirname(resolved),path.resolve(tmpdir()));assert(path.basename(resolved).startsWith('club049-http-'));
  await rm(resolved,{recursive:true,force:true});
 }
});
