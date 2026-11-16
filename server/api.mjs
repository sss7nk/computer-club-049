import {SCHEMA,TABLES,SEED} from './course-schema.mjs';
import {AppError,requireValue,text,id,timestamp,nowISO,cost,cents,deadline,overlap,permission,has,makeReport,csv,roleNames} from './domain.mjs';
import {digest,randomHex,hashPassword,verifyPassword,equal,cookie,cookieHeader} from './security.mjs';

const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'cache-control':'no-store',...headers}});
const all=async(db,sql,...args)=>(await db.prepare(sql).bind(...args).all()).results;
const one=(db,sql,...args)=>db.prepare(sql).bind(...args).first();
const run=(db,sql,...args)=>db.prepare(sql).bind(...args).run();
const next=async(db,table)=>Number((await one(db,`SELECT coalesce(max(id),0)+1 AS id FROM ${table}`)).id);
const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);
function insert(db,table,row){const keys=Object.keys(row);return stmt(db,`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,...Object.values(row).map(v=>typeof v==='boolean'?+v:typeof v==='object'&&v!==null?JSON.stringify(v):v));}
function update(db,table,row,key){const keys=Object.keys(row);return stmt(db,`UPDATE ${table} SET ${keys.map(k=>k+'=?').join(',')} WHERE id=?`,...Object.values(row).map(v=>typeof v==='boolean'?+v:v),key);}
const publicUser=u=>({id:u.id,full_name:u.full_name,login:u.login,roles:u.roles,csrf_token:u.csrf_token});

export async function ensureSeed(db){
  if(await one(db,'SELECT id FROM meta WHERE id=1'))return;
  try{await db.batch(SEED.map(sql=>db.prepare(sql)));}catch(error){if(!await one(db,'SELECT id FROM meta WHERE id=1'))throw error;}
}
async function auth(db,request,now){
  const token=cookie(request);if(!/^[a-f0-9]{64}$/.test(token))return null;
  const hash=await digest(token);
  const row=await one(db,`SELECT s.id,s.full_name,s.login,a.csrf_token,a.expires_at,group_concat(r.code) AS role_codes
    FROM app_sessions a JOIN staff s ON s.id=a.staff_id JOIN staff_roles sr ON sr.staff_id=s.id JOIN roles r ON r.id=sr.role_id
    WHERE a.token_hash=? AND s.active=1 AND a.expires_at>? GROUP BY s.id`,hash,now);
  return row?{...row,roles:row.role_codes.split(','),token_hash:hash}:null;
}
function sameOrigin(request){const origin=request.headers.get('origin');requireValue(origin===new URL(request.url).origin,'Запрос с другого сайта запрещён',403);requireValue(request.headers.get('content-type')?.split(';')[0]==='application/json','Требуется JSON',415);}
async function readBody(request){const body=await request.text();requireValue(body.length<=65536,'Слишком большой запрос',413);try{const value=JSON.parse(body);requireValue(value&&typeof value==='object'&&!Array.isArray(value),'Требуется объект JSON');return value;}catch(e){if(e instanceof AppError)throw e;throw new AppError(400,'Некорректный JSON');}}

async function write(db,user,revision,now,roles,statements,logs=[]){
  const roleSql=roles.map(()=>'?').join(',');
  const guard=stmt(db,`INSERT INTO app_assertion(ok) SELECT CASE WHEN EXISTS(
    SELECT 1 FROM app_sessions a JOIN staff s ON s.id=a.staff_id JOIN staff_roles sr ON sr.staff_id=s.id JOIN roles r ON r.id=sr.role_id
    WHERE a.token_hash=? AND a.expires_at>? AND s.active=1 AND r.code IN (${roleSql})
  ) THEN 1 ELSE 0 END`,user.token_hash,now,...roles);
  const batch=[stmt(db,'UPDATE app_revision SET revision=revision+1 WHERE id=1 AND revision=?',revision),db.prepare('INSERT INTO app_assertion(ok) VALUES(changes())'),db.prepare('DELETE FROM app_assertion'),guard,db.prepare('DELETE FROM app_assertion'),...statements];
  let logId=await next(db,'action_log');
  for(const log of logs)batch.push(insert(db,'action_log',{id:logId++,entity_type:log.table,entity_id:log.id,action:log.action,old_values:log.old||{},new_values:log.new||{},reason:log.reason||null,occurred_at:now,staff_id:user.id}));
  batch.push(stmt(db,'UPDATE meta SET snapshot_at=? WHERE id=1',now));
  await db.batch(batch);
}
async function loadDomain(db){
  const result={};const batch=await db.batch([db.prepare('SELECT * FROM meta WHERE id=1'),...TABLES.map(t=>db.prepare('SELECT * FROM '+t+' ORDER BY id'))]);
  const m=batch[0].results[0];requireValue(m,'База не заполнена',503);result.meta={...m,demo:!!m.demo};delete result.meta.id;
  TABLES.forEach((table,i)=>{result[table]=batch[i+1].results.map(row=>{row={...row};for(const [key,spec] of Object.entries(SCHEMA[table][1])){if(row[key]===null)continue;if(spec.type==='boolean')row[key]=!!row[key];if(spec.type==='object')row[key]=JSON.parse(row[key]);}return row;});});return result;
}
async function availability(db,placeId,tariffId,start,end,{bookingId=null,sessionId=null,launch=false}={}){
  const place=await one(db,'SELECT w.*,z.active AS zone_active FROM workplaces w JOIN zones z ON z.id=w.zone_id WHERE w.id=?',placeId);
  requireValue(place,'Рабочее место не найдено',404);requireValue(place.condition==='available'&&place.zone_active,'Место сейчас недоступно');
  const tariff=await one(db,'SELECT * FROM tariffs WHERE id=?',tariffId);requireValue(tariff&&(sessionId||tariff.active)&&tariff.category_id===place.category_id,'Выберите действующий тариф категории места');
  requireValue(timestamp(start)>=timestamp(tariff.valid_from)&&(!tariff.valid_to||timestamp(start)<timestamp(tariff.valid_to)),'Тариф не действует на выбранное начало');
  requireValue(timestamp(end)>timestamp(start),'Окончание должно быть позже начала');
  for(const b of await all(db,"SELECT * FROM bookings WHERE workplace_id=? AND status='confirmed'",placeId))if(b.id!==bookingId&&overlap(start,end,b.starts_at,b.ends_at))throw new AppError(409,'Интервал пересекается с другой бронью');
  for(const s of await all(db,"SELECT * FROM sessions WHERE workplace_id=? AND status='active'",placeId))if(s.id!==sessionId&&(launch||overlap(start,end,s.started_at,s.planned_ends_at)))throw new AppError(409,'Место занято активным сеансом');
  return {place,tariff};
}
async function bootstrap(db,user,now){
  const can=(...rs)=>has(user,...rs);let data={};
  data.workplaces=await all(db,'SELECT w.*,z.name AS zone_name,c.name AS category_name FROM workplaces w JOIN zones z ON z.id=w.zone_id JOIN categories c ON c.id=w.category_id ORDER BY w.number');
  if(can('cashier')&&!can('admin','manager','accountant','technician'))data.workplaces=data.workplaces.map(({id,number})=>({id,number}));
  data.zones=await all(db,'SELECT * FROM zones ORDER BY id');data.categories=await all(db,'SELECT * FROM categories ORDER BY id');
  if(can('manager','admin','accountant'))data.tariffs=await all(db,'SELECT * FROM tariffs ORDER BY id');
  if(can('manager','admin','cashier')){
    data.clients=await all(db,'SELECT * FROM clients ORDER BY full_name');
    data.bookings=await all(db,'SELECT b.*,c.full_name AS client_name,w.number AS workplace_number,t.name AS tariff_name,t.hourly_rate FROM bookings b JOIN clients c ON c.id=b.client_id JOIN workplaces w ON w.id=b.workplace_id JOIN tariffs t ON t.id=b.tariff_id ORDER BY b.starts_at DESC');
    data.sessions=await all(db,'SELECT s.*,c.full_name AS client_name,w.number AS workplace_number,p.id AS payment_id FROM sessions s JOIN clients c ON c.id=s.client_id JOIN workplaces w ON w.id=s.workplace_id LEFT JOIN payments p ON p.session_id=s.id ORDER BY s.started_at DESC');
  }
  if(can('manager','admin','cashier','accountant')){data.payments=await all(db,'SELECT p.*,m.name AS method_name,w.number AS workplace_number FROM payments p JOIN payment_methods m ON m.id=p.method_id JOIN sessions s ON s.id=p.session_id JOIN workplaces w ON w.id=s.workplace_id ORDER BY p.paid_at DESC');data.payment_methods=await all(db,'SELECT * FROM payment_methods ORDER BY id');}
  if(can('manager','admin','technician','accountant'))data.faults=await all(db,'SELECT f.*,w.number AS workplace_number FROM faults f JOIN workplaces w ON w.id=f.workplace_id ORDER BY f.detected_at DESC');
  if(can('manager')){data.staff=await all(db,'SELECT s.id,s.full_name,s.login,s.active,group_concat(r.code) AS role_codes FROM staff s LEFT JOIN staff_roles sr ON sr.staff_id=s.id LEFT JOIN roles r ON r.id=sr.role_id GROUP BY s.id ORDER BY s.id');data.roles=await all(db,'SELECT * FROM roles');data.action_log=await all(db,'SELECT a.*,s.full_name AS staff_name FROM action_log a JOIN staff s ON s.id=a.staff_id ORDER BY a.id DESC LIMIT 100');}
  return {user:publicUser(user),now,data,role_names:roleNames};
}

export async function api(request,env){
  const db=env.DB,now=nowISO(env),url=new URL(request.url),path=url.pathname,method=request.method;
  try{
    requireValue(db,'База данных не подключена',503);await ensureSeed(db);
    if(path==='/api/health')return json({ok:true,storage:'SQLite / D1',domain_tables:14});
    if(path==='/api/public'&&method==='GET')return json({now,workplaces:await all(db,'SELECT w.number,z.name AS zone_name,c.name AS category_name FROM workplaces w JOIN zones z ON z.id=w.zone_id JOIN categories c ON c.id=w.category_id ORDER BY w.number'),tariffs:await all(db,'SELECT t.*,c.name AS category_name FROM tariffs t JOIN categories c ON c.id=t.category_id WHERE t.active=1 ORDER BY t.id')});
    const user=await auth(db,request,now);
    if(path==='/api/auth/me'&&method==='GET')return user?json({user:publicUser(user)}):json({user:null});
    if(method!=='GET'){sameOrigin(request);}
    const body=method==='POST'?await readBody(request):{};
    if(path==='/api/auth/login'&&method==='POST'){
      requireValue(!user,'Вы уже вошли. Сначала выйдите из текущей учётной записи.',409);
      const login=text(body.login,'Логин',1,64).toLowerCase(),password=typeof body.password==='string'?body.password:'';requireValue(password.length>0&&password.length<=128,'Введите пароль');
      const key=await digest(login+'|'+(request.headers.get('cf-connecting-ip')||env.__clientIp||'local'));
      const attempts=await one(db,'SELECT * FROM app_login_attempts WHERE attempt_key=?',key),tick=Date.parse(now);
      requireValue(!attempts||attempts.window_start<tick-900000||attempts.failures<5,'Слишком много попыток. Повторите через 15 минут.',429);
      const staff=await one(db,'SELECT * FROM staff WHERE lower(login)=?',login);
      // A real dummy hash keeps unknown-account checks comparable in cost.
      const dummy=await one(db,'SELECT password_hash FROM staff ORDER BY id LIMIT 1');
      const verified=await verifyPassword(password,staff?.password_hash||dummy.password_hash);
      if(!verified||!staff?.active){await run(db,`INSERT INTO app_login_attempts(attempt_key,failures,window_start) VALUES(?,1,?) ON CONFLICT(attempt_key) DO UPDATE SET failures=CASE WHEN window_start<? THEN 1 ELSE failures+1 END,window_start=CASE WHEN window_start<? THEN ? ELSE window_start END`,key,tick,tick-900000,tick-900000,tick);throw new AppError(401,'Неверный логин или пароль');}
      const roles=(await all(db,'SELECT r.code FROM roles r JOIN staff_roles sr ON sr.role_id=r.id WHERE sr.staff_id=?',staff.id)).map(r=>r.code);requireValue(roles.length,'Учётная запись не имеет назначенных ролей',403);
      const token=randomHex(),csrf=randomHex(),expires=new Date(tick+28800000+10800000).toISOString().replace('Z','+03:00');
      await db.batch([stmt(db,'DELETE FROM app_login_attempts WHERE attempt_key=?',key),stmt(db,'DELETE FROM app_sessions WHERE expires_at<=?',now),stmt(db,'INSERT INTO app_sessions VALUES(?,?,?,?,?)',await digest(token),staff.id,csrf,expires,now)]);
      return json({user:{id:staff.id,full_name:staff.full_name,login:staff.login,roles,csrf_token:csrf}},200,{'set-cookie':cookieHeader(request,token)});
    }
    requireValue(user,'Войдите в учётную запись',401);
    if(path==='/api/bootstrap'&&method==='GET')return json(await bootstrap(db,user,now));
    if(path==='/api/auth/logout'&&method==='POST'){requireValue(equal(request.headers.get('x-csrf-token'),user.csrf_token),'Недействительный защитный токен',403);await run(db,'DELETE FROM app_sessions WHERE token_hash=?',user.token_hash);return json({ok:true},200,{'set-cookie':cookieHeader(request,'',0)});}
    if(path.startsWith('/api/reports/')&&method==='GET'){
      const name=path.split('/').pop();if(name==='revenue')permission(user,'manager','admin','cashier','accountant');else permission(user,'manager','admin');
      const report=makeReport(await loadDomain(db),name,url.searchParams.get('from'),url.searchParams.get('to'));
      if(url.searchParams.get('format')==='csv'){requireValue(has(user,'manager')||(name==='revenue'&&has(user,'accountant')),'Выгрузка CSV для этой роли недоступна',403);return new Response(csv(report),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="${name}.csv"`,'cache-control':'no-store'}});}return json(report);
    }
    if(path==='/api/backup'&&method==='GET'){permission(user,'manager');return json(await loadDomain(db),200,{'content-disposition':'attachment; filename="club-backup.json"'});}
    requireValue(method==='POST','Метод не поддерживается',405);
    requireValue(equal(request.headers.get('x-csrf-token'),user.csrf_token),'Недействительный защитный токен. Обновите страницу.',403);
    const revision=(await one(db,'SELECT revision FROM app_revision WHERE id=1')).revision;
    const match=path.match(/^\/api\/(\w+)(?:\/(\d+)(?:\/(\w+))?)?$/);requireValue(match,'Операция не найдена',404);
    const [,resource,rawId,action]=match,key=rawId?Number(rawId):null;let record,logs=[],statements=[],roles,result={ok:true};
    if(resource==='clients'){
      roles=['admin'];permission(user,...roles);const full_name=text(body.full_name,'Имя клиента',2,100);let phone=body.phone?text(body.phone,'Телефон',10,18).replace(/[()\s-]/g,''):null;requireValue(!phone||/^\+?[0-9]{10,15}$/.test(phone),'Телефон должен содержать 10–15 цифр');
      const row={full_name,phone};if(key){record=await one(db,'SELECT * FROM clients WHERE id=?',key);requireValue(record,'Клиент не найден',404);statements.push(update(db,'clients',row,key));}else{result.id=await next(db,'clients');statements.push(insert(db,'clients',{id:result.id,...row}));}
      logs.push({table:'clients',id:key||result.id,action:key?'update':'create',old:record,new:row});
    }else if(resource==='bookings'){
      roles=['admin'];permission(user,...roles);if(key){record=await one(db,'SELECT * FROM bookings WHERE id=?',key);requireValue(record,'Бронь не найдена',404);requireValue(record.status==='confirmed','Бронь уже имеет конечный статус');requireValue(!await one(db,'SELECT id FROM sessions WHERE booking_id=?',key),'По брони уже начат сеанс');}
      if(!key||action==='move'){
        if(key){text(body.reason,'Причина переноса',3,300);requireValue(body.consent===true,'Подтвердите согласие клиента');requireValue(record.needs_resolution||Date.parse(now)<deadline(record),'Срок ожидания истёк. Сначала отметьте неявку.');}
        const row={client_id:key?record.client_id:id(body.client_id),workplace_id:id(body.workplace_id),tariff_id:id(body.tariff_id),starts_at:body.starts_at,ends_at:body.ends_at};timestamp(row.starts_at);timestamp(row.ends_at);requireValue(Date.parse(row.starts_at)>=Date.parse(now),'Нельзя оформить бронь на прошедшее начало');requireValue(await one(db,'SELECT id FROM clients WHERE id=?',row.client_id),'Клиент не найден');
        await availability(db,row.workplace_id,row.tariff_id,row.starts_at,row.ends_at,{bookingId:key});
        Object.assign(row,{status:'confirmed',needs_resolution:0,fault_id:record?.fault_id||null,cancel_reason:null,changed_at:now,changed_by:user.id});
        if(key)statements.push(update(db,'bookings',row,key));else{result.id=await next(db,'bookings');statements.push(insert(db,'bookings',{id:result.id,...row}));}
        logs.push({table:'bookings',id:key||result.id,action:key?'move':'create',old:record,new:row,reason:body.reason});
      }else if(action==='cancel'||action==='no_show'){
        if(action==='no_show'){requireValue(!record.needs_resolution,'Бронь ожидает решения по неисправности');requireValue(Date.parse(now)>=deadline(record),'Срок ожидания ещё не истёк');}
        else{requireValue(record.needs_resolution||Date.parse(now)<deadline(record),'После срока ожидания нужно отметить неявку');text(body.reason,'Причина отмены',3,300);}
        const row={status:action==='cancel'?'cancelled':'no_show',needs_resolution:0,cancel_reason:action==='cancel'?body.reason.trim():null,changed_at:now,changed_by:user.id};statements.push(update(db,'bookings',row,key));logs.push({table:'bookings',id:key,action,old:record,new:row,reason:body.reason});
      }else throw new AppError(404,'Неизвестное действие с бронью');
    }else if(resource==='sessions'){
      roles=['admin'];permission(user,...roles);if(key){record=await one(db,'SELECT * FROM sessions WHERE id=?',key);requireValue(record&&record.status==='active','Активный сеанс не найден',404);}
      if(!key){
        const booking=body.booking_id?await one(db,'SELECT * FROM bookings WHERE id=?',id(body.booking_id)):null;
        if(body.booking_id){requireValue(booking&&booking.status==='confirmed'&&!booking.needs_resolution,'По этой брони запуск недоступен');requireValue(!await one(db,'SELECT id FROM sessions WHERE booking_id=?',booking.id),'По брони уже есть сеанс');requireValue(Date.parse(now)>=Date.parse(booking.starts_at),'Плановое начало брони ещё не наступило');requireValue(Date.parse(now)<deadline(booking),'Срок ожидания истёк — отметьте неявку');}
        const client_id=booking?.client_id||id(body.client_id),workplace_id=booking?.workplace_id||id(body.workplace_id),tariff_id=body.tariff_id?id(body.tariff_id):booking?.tariff_id,end=body.planned_ends_at||booking?.ends_at;
        timestamp(end);requireValue(await one(db,'SELECT id FROM clients WHERE id=?',client_id),'Клиент не найден');
        const {tariff}=await availability(db,workplace_id,tariff_id,now,end,{bookingId:booking?.id,launch:true});
        if(booking&&tariff_id!==booking.tariff_id){
          requireValue(body.consent===true,'Подтвердите согласование нового тарифа с клиентом');
          const reason=text(body.reason,'Причина смены тарифа',3,300);
          const changes={tariff_id,starts_at:timestamp(tariff.valid_from)>timestamp(booking.starts_at)?now:booking.starts_at,changed_at:now,changed_by:user.id};
          statements.push(update(db,'bookings',changes,booking.id));logs.push({table:'bookings',id:booking.id,action:'move',old:booking,new:changes,reason});
        }
        requireValue(!await one(db,"SELECT id FROM sessions WHERE client_id=? AND status='active'",client_id),'У клиента уже есть активное посещение');
        const row={id:await next(db,'sessions'),booking_id:booking?.id||null,client_id,workplace_id,tariff_id,hourly_rate_snapshot:tariff.hourly_rate,started_at:now,planned_ends_at:end,ended_at:null,billable_minutes:null,total_amount:null,status:'active',end_reason:null};result.id=row.id;statements.push(insert(db,'sessions',row));logs.push({table:'sessions',id:row.id,action:'start',new:row});
      }else if(action==='extend'){
        const end=body.planned_ends_at;requireValue(timestamp(end)>Math.max(timestamp(record.planned_ends_at),timestamp(now)),'Новый конец должен быть позже текущего и настоящего времени');
        await availability(db,record.workplace_id,record.tariff_id,record.started_at,end,{bookingId:record.booking_id,sessionId:key});
        requireValue(!await one(db,"SELECT id FROM faults WHERE workplace_id=? AND detected_at>=?",record.workplace_id,record.started_at),'Прерванный поломкой сеанс нужно завершить');
        statements.push(update(db,'sessions',{planned_ends_at:end},key));logs.push({table:'sessions',id:key,action:'extend',old:{planned_ends_at:record.planned_ends_at},new:{planned_ends_at:end}});
      }else if(action==='finish'){
        let end=body.ended_at||now;requireValue(timestamp(end)<=timestamp(now),'Нельзя завершить сеанс будущим временем');
        const faults=await all(db,'SELECT * FROM faults WHERE workplace_id=?',record.workplace_id);const stopped=faults.filter(f=>timestamp(f.detected_at)>timestamp(record.started_at)&&timestamp(f.detected_at)<=timestamp(end)).sort((a,b)=>timestamp(a.detected_at)-timestamp(b.detected_at))[0];if(stopped)end=stopped.detected_at;
        const row={...cost(record.hourly_rate_snapshot,record.started_at,end),ended_at:end,status:'completed',end_reason:stopped?'неисправность':text(body.end_reason||'Обычное завершение','Причина завершения',3,200)};
        statements.push(update(db,'sessions',row,key));logs.push({table:'sessions',id:key,action:'finish',old:record,new:row,reason:row.end_reason});if(record.booking_id){const b=await one(db,'SELECT * FROM bookings WHERE id=?',record.booking_id);statements.push(update(db,'bookings',{status:'completed',changed_at:now,changed_by:user.id},record.booking_id));logs.push({table:'bookings',id:b.id,action:'complete',old:{status:b.status},new:{status:'completed'}});}result={...result,...row};
      }else throw new AppError(404,'Неизвестное действие с сеансом');
    }else if(resource==='payments'&&!key){
      roles=['cashier'];permission(user,...roles);const s=await one(db,'SELECT * FROM sessions WHERE id=?',id(body.session_id));requireValue(s?.status==='completed','Сначала завершите сеанс');requireValue(!await one(db,'SELECT id FROM payments WHERE session_id=?',s.id),'Этот сеанс уже оплачен',409);const method_id=id(body.method_id);requireValue(await one(db,'SELECT id FROM payment_methods WHERE id=?',method_id),'Способ оплаты не найден');if(body.amount!==undefined)requireValue(body.amount===s.total_amount,'Разрешена только полная рассчитанная сумма');
      const row={id:await next(db,'payments'),session_id:s.id,amount:s.total_amount,method_id,paid_at:now,staff_id:user.id,status:'paid'};result.id=row.id;statements.push(insert(db,'payments',row));logs.push({table:'payments',id:row.id,action:'register',new:row});
    }else if(resource==='faults'){
      roles=['technician'];permission(user,...roles);
      if(!key){const workplace_id=id(body.workplace_id),detected_at=body.detected_at||now;requireValue(await one(db,'SELECT id FROM workplaces WHERE id=?',workplace_id),'Место не найдено');requireValue(timestamp(detected_at)<=timestamp(now),'Обнаружение не может быть в будущем');
        for(const s of await all(db,'SELECT * FROM sessions WHERE workplace_id=?',workplace_id)){requireValue(!(s.status==='active'&&timestamp(detected_at)<=timestamp(s.started_at)),'Время поломки должно быть позже начала текущего сеанса');requireValue(!(s.status==='completed'&&overlap(s.started_at,s.ended_at,detected_at,now)),'Указанное время пересекается с завершённым посещением');}
        const row={id:await next(db,'faults'),workplace_id,description:text(body.description,'Описание неисправности',3,500),detected_at,detected_by:user.id,status:'open',resolution_note:null,resolved_at:null,resolved_by:null};result.id=row.id;statements.push(insert(db,'faults',row));logs.push({table:'faults',id:row.id,action:'register',new:row});
        const affected=await all(db,"SELECT b.* FROM bookings b WHERE b.workplace_id=? AND b.status='confirmed' AND b.ends_at>? AND NOT EXISTS(SELECT 1 FROM sessions s WHERE s.booking_id=b.id)",workplace_id,detected_at);for(const b of affected)logs.push({table:'bookings',id:b.id,action:'needs_resolution',old:{needs_resolution:!!b.needs_resolution,fault_id:b.fault_id},new:{needs_resolution:true,fault_id:row.id},reason:row.description});
      }else{requireValue(action==='resolve','Действие не найдено',404);record=await one(db,'SELECT * FROM faults WHERE id=?',key);requireValue(record?.status==='open','Открытая неисправность не найдена');const row={status:'resolved',resolution_note:text(body.resolution_note,'Результат проверки',3,500),resolved_at:now,resolved_by:user.id};statements.push(update(db,'faults',row,key));logs.push({table:'faults',id:key,action:'resolve',old:record,new:row});}
    }else if(resource==='staff'){
      roles=['manager'];permission(user,...roles);
      if(!key){const full_name=text(body.full_name,'ФИО сотрудника',3,100),login=text(body.login,'Логин',3,32).toLowerCase();requireValue(/^[a-z][a-z0-9_.-]{2,31}$/.test(login),'Логин: латинские буквы, цифры, точка, дефис и подчёркивание');requireValue(typeof body.password==='string'&&body.password.length>=10&&body.password.length<=128&&/[\p{L}]/u.test(body.password)&&/\d/.test(body.password),'Пароль: 10–128 символов, хотя бы одна буква и цифра');requireValue(body.password===body.password_confirm,'Пароли не совпадают');const chosen=[...new Set(Array.isArray(body.roles)?body.roles:[])];requireValue(chosen.length&&chosen.every(r=>Object.keys(roleNames).includes(r)),'Назначьте хотя бы одну допустимую роль');
        const sid=await next(db,'staff'),row={id:sid,full_name,login,password_hash:await hashPassword(body.password),active:1};statements.push(insert(db,'staff',row));let rid=await next(db,'staff_roles');for(const code of chosen){const role=await one(db,'SELECT id FROM roles WHERE code=?',code);statements.push(insert(db,'staff_roles',{id:rid++,staff_id:sid,role_id:role.id}));}result.id=sid;logs.push({table:'staff',id:sid,action:'register',new:{full_name,login,roles:chosen,active:true}});
      }else if(action==='roles'){
        record=await one(db,'SELECT id,full_name,active FROM staff WHERE id=?',key);requireValue(record,'Сотрудник не найден',404);const chosen=[...new Set(Array.isArray(body.roles)?body.roles:[])];requireValue(chosen.length&&chosen.every(r=>Object.keys(roleNames).includes(r)),'Назначьте хотя бы одну допустимую роль');requireValue(key!==user.id||chosen.includes('manager'),'Нельзя снять с себя последнюю роль управляющего');const oldRoles=(await all(db,'SELECT r.code FROM roles r JOIN staff_roles sr ON r.id=sr.role_id WHERE sr.staff_id=?',key)).map(r=>r.code);let rid=await next(db,'staff_roles');statements.push(stmt(db,'DELETE FROM staff_roles WHERE staff_id=?',key));for(const code of chosen){const r=await one(db,'SELECT id FROM roles WHERE code=?',code);statements.push(insert(db,'staff_roles',{id:rid++,staff_id:key,role_id:r.id}));}if(key!==user.id)statements.push(stmt(db,'DELETE FROM app_sessions WHERE staff_id=?',key));logs.push({table:'staff',id:key,action:'roles',old:{roles:oldRoles},new:{roles:chosen}});
      }else{requireValue(action==='active','Действие не найдено',404);record=await one(db,'SELECT id,full_name,active FROM staff WHERE id=?',key);requireValue(record,'Сотрудник не найден',404);requireValue(typeof body.active==='boolean','Укажите логическое значение активности');requireValue(key!==user.id||body.active,'Нельзя отключить собственную учётную запись');statements.push(update(db,'staff',{active:+body.active},key));if(!body.active)statements.push(stmt(db,'DELETE FROM app_sessions WHERE staff_id=?',key));logs.push({table:'staff',id:key,action:body.active?'enable':'disable',old:record,new:{active:body.active}});}
    }else if(resource==='tariffs'){
      roles=['manager'];permission(user,...roles);
      if(key){requireValue(action==='active','Ставка использованного тарифа не редактируется: создайте новую версию');requireValue(typeof body.active==='boolean','Укажите активность');statements.push(update(db,'tariffs',{active:+body.active},key));logs.push({table:'tariffs',id:key,action:'active',new:{active:body.active}});}
      else{const row={id:await next(db,'tariffs'),name:text(body.name,'Название тарифа',3,100),category_id:id(body.category_id),hourly_rate:text(body.hourly_rate,'Ставка'),valid_from:body.valid_from,valid_to:body.valid_to||null,active:1};cents(row.hourly_rate);timestamp(row.valid_from);if(row.valid_to)requireValue(timestamp(row.valid_to)>timestamp(row.valid_from),'Неверный период тарифа');requireValue(await one(db,'SELECT id FROM categories WHERE id=?',row.category_id),'Категория не найдена');result.id=row.id;statements.push(insert(db,'tariffs',row));logs.push({table:'tariffs',id:row.id,action:'create_version',new:row});}
    }else if(resource==='workplaces'&&!key){
      roles=['manager'];permission(user,...roles);const row={id:await next(db,'workplaces'),number:text(body.number,'Номер места',1,20),zone_id:id(body.zone_id),category_id:id(body.category_id),condition:'available'};result.id=row.id;statements.push(insert(db,'workplaces',row));logs.push({table:'workplaces',id:row.id,action:'create',new:row});
    }else if((resource==='zones'||resource==='categories')&&!key){
      roles=['manager'];permission(user,...roles);const row={id:await next(db,resource),name:text(body.name,'Название',2,80),...(resource==='zones'?{active:1}:{description:text(body.description,'Описание',2,200)})};result.id=row.id;statements.push(insert(db,resource,row));logs.push({table:resource,id:row.id,action:'create',new:row});
    }else throw new AppError(404,'Операция не найдена');
    await write(db,user,revision,now,roles,statements,logs);return json(result,key?200:201);
  }catch(error){
    if(error instanceof AppError)return json({error:error.message,fields:error.fields},error.status);
    const message=String(error?.message||error);
    if(/app_assertion|ok=1|ok = 1/.test(message))return json({error:'Данные или права изменились. Обновите страницу и повторите операцию.'},409);
    if(/UNIQUE constraint failed/.test(message)){const label=/staff.login/.test(message)?'Логин уже занят':/clients.phone/.test(message)?'Этот телефон уже есть у другого клиента':'Запись уже существует';return json({error:label},409);}
    if(/constraint|Нельзя|Нужна|Пересечение|Слишком|Бронь|тариф|Тариф|сеанс|Сеанс|неисправ|История|Место|Журнал|Перенос|активн/.test(message))return json({error:'Операция отклонена: '+message.replace(/^.*?(?:D1_ERROR:|SQLITE_CONSTRAINT[^:]*:)\s*/,'').slice(0,250)},409);
    console.error('API failure',message);return json({error:'Не удалось выполнить операцию. Повторите запрос.'},500);
  }
}
