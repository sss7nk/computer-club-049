import {api} from '../server/api.mjs';
import html from '../public/index.html';
import css from '../public/styles.css';
import gaming from '../public/gaming.css';
import app from '../dist/client/app.js?raw';
const files={'/':[html,'text/html; charset=utf-8'],'/index.html':[html,'text/html; charset=utf-8'],'/styles.css':[css,'text/css; charset=utf-8'],'/gaming.css':[gaming,'text/css; charset=utf-8'],'/app.js':[app,'text/javascript; charset=utf-8']};
const headers={'x-content-type-options':'nosniff','referrer-policy':'same-origin','x-frame-options':'DENY','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"};
export default {async fetch(request,env){const url=new URL(request.url);let response;
  if(url.pathname.startsWith('/api/'))response=await api(request,env);
  else if(files[url.pathname]){const [body,type]=files[url.pathname];response=new Response(body,{headers:{'content-type':type,'cache-control':'no-cache'}});}
  else if(url.pathname==='/favicon.ico')response=new Response(null,{status:204});else response=new Response('Страница не найдена',{status:404});
  const secured=new Response(response.body,response);for(const [key,value] of Object.entries(headers))secured.headers.set(key,value);return secured;
}};
