// Publication belongs to the user's Cloudflare account. Credentials stay in Wrangler.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('..',import.meta.url));
const configPath=path.join(root,'wrangler.json');
const cli=path.join(root,'node_modules/wrangler/bin/wrangler.js');
const databaseName='computer-club-049-db';
const env={...process.env,WRANGLER_SEND_METRICS:'false'};

function wrangler(args,{capture=false}={}){
  const result=spawnSync(process.execPath,[cli,...args],{cwd:root,env,encoding:'utf8',stdio:capture?['inherit','pipe','pipe']:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(capture?(result.stderr||result.stdout||'Cloudflare не выполнил команду').trim():'Cloudflare не выполнил команду. Проверь сообщение выше.');
  return result.stdout;
}
function listDatabases(){
  const list=JSON.parse(wrangler(['d1','list','--json'],{capture:true}));
  if(!Array.isArray(list))throw new Error('Неожиданный ответ списка D1. Настройка остановлена.');
  return list;
}
function configured(){
  const config=JSON.parse(readFileSync(configPath,'utf8'));
  if(!config.d1_databases?.some(db=>db.binding==='DB'&&typeof db.database_id==='string'&&db.database_id.length>0)){
    throw new Error('Сначала выполни npm run cloudflare:setup после входа в Cloudflare.');
  }
  return config;
}
try{
  const action=process.argv[2];
  if(action==='login'){
    wrangler(['login','--callback-host','127.0.0.1']);
  }else if(action==='setup'){
    let database=listDatabases().find(db=>db.name===databaseName);
    if(!database){
      wrangler(['d1','create',databaseName,'--update-config=false']);
      database=listDatabases().find(db=>db.name===databaseName);
    }
    if(!database?.uuid)throw new Error('База не найдена в ответе Cloudflare. Новая публикация не запускалась.');
    const config=JSON.parse(readFileSync(configPath,'utf8'));
    config.d1_databases=[{binding:'DB',database_name:databaseName,database_id:database.uuid,migrations_dir:'drizzle'}];
    writeFileSync(configPath,JSON.stringify(config,null,2)+'\n');
    console.log('База D1 привязана как DB. Теперь выполни npm run deploy.');
  }else if(action==='deploy'){
    configured();
    wrangler(['d1','migrations','apply','DB','--remote']);
    const check=JSON.parse(wrangler(['d1','execute','DB','--remote','--command','SELECT id FROM meta WHERE id=1','--json'],{capture:true}));
    if(!Array.isArray(check))throw new Error('Неожиданный ответ проверки базы. Публикация остановлена.');
    if(!check.some(item=>Array.isArray(item.results)&&item.results.some(row=>row.id===1))){
      // Import outside an HTTP request so initialisation also fits D1 query limits.
      wrangler(['d1','execute','DB','--remote','--file','db/seed.sql','--yes']);
    }
    wrangler(['deploy']);
  }else if(action==='check'){
    wrangler(['deploy','--dry-run','--outdir','.runtime/cloudflare-check']);
  }else{
    throw new Error('Используй login, setup, deploy или check.');
  }
}catch(error){console.error(error.message);process.exitCode=1;}
