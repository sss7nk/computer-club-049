import {openDatabase} from '../server/local-db.mjs';
import {backup} from 'node:sqlite';
import {existsSync,mkdirSync,renameSync,copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url)),folder=path.join(root,'.runtime'),current=path.join(folder,'club.sqlite'),[command,provided]=process.argv.slice(2);
if(!existsSync(current))throw new Error('Сначала запустите приложение: npm start');
if(command==='check'){const db=openDatabase(current);try{if(db.raw.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Повреждение SQLite');if(db.raw.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Нарушены внешние ключи');console.log('DATABASE_OK');}finally{db.close();}}
else if(command==='backup'){const destination=provided?path.resolve(provided):path.join(folder,'backups','club-'+Date.now()+'.sqlite');mkdirSync(path.dirname(destination),{recursive:true});if(existsSync(destination))throw new Error('Файл копии уже существует');const db=openDatabase(current);try{await backup(db.raw,destination);console.log('BACKUP_OK',destination);}finally{db.close();}}
else if(command==='restore'){
  if(!provided)throw new Error('Укажите файл копии. Перед восстановлением остановите сервер.');const source=path.resolve(provided);if(source===current)throw new Error('Укажите отдельную копию');const db=openDatabase(source);
  try{if(db.raw.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||db.raw.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Копия повреждена');for(const table of ['staff','bookings','sessions','app_sessions','app_revision'])db.raw.prepare('SELECT count(*) FROM '+table).get();}finally{db.close();}
  const restored=current+'.restore-'+Date.now();copyFileSync(source,restored);const temp=openDatabase(restored);temp.raw.exec('DELETE FROM app_sessions');temp.close();renameSync(current,current+'.before-restore-'+Date.now());renameSync(restored,current);console.log('RESTORE_OK: прежняя база сохранена, выполните вход заново');
}else throw new Error('Команды: check, backup [путь], restore путь');
