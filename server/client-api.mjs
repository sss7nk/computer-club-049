import {AppError,requireValue,text,id,timestamp,overlap} from './domain.mjs';
import {digest,randomHex,hashPassword,verifyPassword,cookie,cookieHeader,equal} from './security.mjs';

const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'cache-control':'no-store',...headers}});
const all=async(db,sql,...args)=>(await db.prepare(sql).bind(...args).all()).results;
const one=(db,sql,...args)=>db.prepare(sql).bind(...args).first();
const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);
const next=async(db,t)=>Number((await one(db,`SELECT coalesce(max(id),0)+1 AS n FROM ${t}`)).n);
const publicClient=u=>({id:u.id,client_id:u.client_id,full_name:u.full_name,login:u.login,roles:['client'],account_type:'client',csrf_token:u.csrf_token});

export async function clientAuth(db,request,now){
  const token=cookie(request);if(!/^[a-f0-9]{64}$/.test(token))return null;
  const hash=await digest(token);
  const u=await one(db,`SELECT a.id,a.client_id,a.login,c.full_name,s.csrf_token FROM app_client_sessions s JOIN client_accounts a ON a.id=s.account_id JOIN clients c ON c.id=a.client_id WHERE s.token_hash=? AND s.expires_at>? AND a.active=1`,hash,now);
  return u?{...publicClient(u),token_hash:hash}:null;
}
async function limited(db,key,now,maximum){
  const tick=Date.parse(now),row=await one(db,'SELECT * FROM app_login_attempts WHERE attempt_key=?',key);
  requireValue(!row||row.window_start<tick-900000||row.failures<maximum,'Слишком много попыток. Повторите через 15 минут.',429);
}
async function attempt(db,key,now){const t=Date.parse(now);await stmt(db,`INSERT INTO app_login_attempts VALUES(?,1,?) ON CONFLICT(attempt_key) DO UPDATE SET failures=CASE WHEN window_start<? THEN 1 ELSE failures+1 END,window_start=CASE WHEN window_start<? THEN ? ELSE window_start END`,key,t,t-900000,t-900000,t).run();}
export async function clientRegister(db,body,request,env,now,user){
  requireValue(!user,'Сначала выйдите из текущей учётной записи.',409);
  const key=await digest('register|'+(request.headers.get('cf-connecting-ip')||env.__clientIp||'local'));
  await limited(db,key,now,5);await attempt(db,key,now);
  requireValue(!['roles','role','staff_id','client_id','active'].some(k=>k in body),'При регистрации клиента нельзя назначать роли или выбирать чужую карточку',403);
  const full_name=text(body.full_name,'Имя',2,100),login=text(body.login,'Логин',3,32).toLowerCase();
  requireValue(/^[a-z][a-z0-9_.-]{2,31}$/.test(login),'Логин: латинская буква в начале, затем буквы, цифры, точка, дефис или подчёркивание');
  const phone=text(body.phone,'Телефон',10,22).replace(/[()\s-]/g,'');requireValue(/^\+?[0-9]{10,15}$/.test(phone),'Телефон должен содержать 10–15 цифр');
  requireValue(typeof body.password==='string'&&body.password.length>=10&&body.password.length<=128&&/[a-zа-я]/i.test(body.password)&&/\d/.test(body.password),'Пароль: от 10 до 128 символов, буквы и цифры');
  requireValue(body.password===body.password_confirm,'Пароли не совпадают');
  requireValue(!await one(db,'SELECT id FROM client_accounts WHERE lower(login)=?',login),'Логин клиента уже занят',409);
  requireValue(!await one(db,'SELECT id FROM clients WHERE phone=?',phone),'Этот телефон уже есть в клубе. Обратитесь к администратору; чужая история автоматически не привязывается.',409);
  const password_hash=await hashPassword(body.password),clientId=await next(db,'clients'),accountId=await next(db,'client_accounts');
  const rev=(await one(db,'SELECT revision FROM app_revision WHERE id=1')).revision,log=await next(db,'action_log');
  await db.batch([stmt(db,'UPDATE app_revision SET revision=revision+1 WHERE id=1 AND revision=?',rev),stmt(db,'INSERT INTO app_assertion VALUES(changes())'),stmt(db,'DELETE FROM app_assertion'),stmt(db,'INSERT INTO clients VALUES(?,?,?)',clientId,full_name,phone),stmt(db,'INSERT INTO client_accounts VALUES(?,?,?,?,1,?)',accountId,clientId,login,password_hash,now),stmt(db,`INSERT INTO action_log(id,entity_type,entity_id,action,old_values,new_values,reason,occurred_at,staff_id,client_id) VALUES(?,'client_accounts',?,'register','{}',?,NULL,?,NULL,?)`,log,accountId,JSON.stringify({login,client_id:clientId}),now,clientId),stmt(db,'UPDATE meta SET snapshot_at=? WHERE id=1',now)]);
  return json({ok:true,login},201);
}
export async function clientLogin(db,body,request,env,now,user){
  requireValue(!user,'Вы уже вошли. Сначала выйдите из текущей учётной записи.',409);
  const login=text(body.login,'Логин',1,64).toLowerCase(),password=typeof body.password==='string'?body.password:'';
  requireValue(password.length>0&&password.length<=128,'Введите пароль');
  const key=await digest('client|'+login+'|'+(request.headers.get('cf-connecting-ip')||env.__clientIp||'local'));await limited(db,key,now,5);
  const a=await one(db,'SELECT a.*,c.full_name FROM client_accounts a JOIN clients c ON c.id=a.client_id WHERE lower(a.login)=?',login);
  const dummy=await one(db,'SELECT password_hash FROM staff ORDER BY id LIMIT 1');
  const valid=await verifyPassword(password,a?.password_hash||dummy.password_hash);
  if(!valid||!a?.active){await attempt(db,key,now);throw new AppError(401,'Неверный логин или пароль');}
  const token=randomHex(),csrf=randomHex(),expiry=new Date(Date.parse(now)+28800000+10800000).toISOString().replace('Z','+03:00');
  await db.batch([stmt(db,'DELETE FROM app_login_attempts WHERE attempt_key=?',key),stmt(db,'DELETE FROM app_client_sessions WHERE expires_at<=?',now),stmt(db,'INSERT INTO app_client_sessions VALUES(?,?,?,?,?)',await digest(token),a.id,csrf,expiry,now)]);
  return json({user:publicClient({...a,csrf_token:csrf})},200,{'set-cookie':cookieHeader(request,token)});
}
export async function clientBootstrap(db,user,now){
  const profile=await one(db,'SELECT id,full_name,phone FROM clients WHERE id=?',user.client_id);
  const data={profile,zones:await all(db,'SELECT * FROM zones WHERE active=1'),categories:await all(db,'SELECT * FROM categories'),workplaces:await all(db,'SELECT w.*,z.name AS zone_name,c.name AS category_name FROM workplaces w JOIN zones z ON z.id=w.zone_id JOIN categories c ON c.id=w.category_id WHERE z.active=1 ORDER BY w.number'),tariffs:await all(db,'SELECT * FROM tariffs WHERE active=1'),bookings:await all(db,'SELECT b.*,w.number AS workplace_number,t.name AS tariff_name,t.hourly_rate FROM bookings b JOIN workplaces w ON w.id=b.workplace_id JOIN tariffs t ON t.id=b.tariff_id WHERE b.client_id=? ORDER BY b.starts_at DESC',user.client_id),sessions:await all(db,'SELECT s.*,w.number AS workplace_number,p.id AS payment_id,p.paid_at FROM sessions s JOIN workplaces w ON w.id=s.workplace_id LEFT JOIN payments p ON p.session_id=s.id WHERE s.client_id=? ORDER BY s.started_at DESC',user.client_id)};
  return {user:publicClient(user),now,data};
}
function interval(start,end,now){const a=timestamp(start),b=timestamp(end);requireValue(a>=Date.parse(now),'Выберите будущее время');requireValue(b>a&&b-a<=43200000,'Длительность брони должна быть больше нуля и не более 12 часов');requireValue(a<=Date.parse(now)+30*86400000,'Бронирование доступно на 30 дней вперёд');}
export async function clientRoute(db,user,request,body,now){
  requireValue(user.roles.includes('client'),'Этот раздел доступен клиентам',403);
  const url=new URL(request.url),route=url.pathname,method=request.method;
  if(route==='/api/client/availability'&&method==='GET'){
    const start=url.searchParams.get('from'),end=url.searchParams.get('to');interval(start,end,now);
    const places=await all(db,'SELECT w.*,z.name AS zone_name,c.name AS category_name FROM workplaces w JOIN zones z ON z.id=w.zone_id JOIN categories c ON c.id=w.category_id WHERE z.active=1 ORDER BY w.number');
    const bs=await all(db,"SELECT workplace_id,starts_at,ends_at FROM bookings WHERE status='confirmed'"),ss=await all(db,"SELECT workplace_id,started_at,planned_ends_at FROM sessions WHERE status='active'"),ts=await all(db,'SELECT * FROM tariffs WHERE active=1');
    return json({places:places.map(p=>{const tariff=ts.filter(t=>t.category_id===p.category_id&&Date.parse(t.valid_from)<=Date.parse(start)&&(!t.valid_to||Date.parse(t.valid_to)>Date.parse(start))).sort((a,b)=>Number(a.hourly_rate)-Number(b.hourly_rate)||a.id-b.id)[0];return {...p,available:p.condition==='available'&&!!tariff&&!bs.some(b=>b.workplace_id===p.id&&overlap(start,end,b.starts_at,b.ends_at))&&!ss.some(s=>s.workplace_id===p.id&&overlap(start,end,s.started_at,s.planned_ends_at)),tariff_id:tariff?.id||null,hourly_rate:tariff?.hourly_rate||null,tariff_name:tariff?.name||null};})});
  }
  requireValue(method==='POST','Операция не найдена',404);requireValue(equal(request.headers.get('x-csrf-token'),user.csrf_token),'Недействительный защитный токен',403);
  requireValue(!('client_id' in body)||Number(body.client_id)===user.client_id,'Нельзя действовать от имени другого клиента',403);
  const rev=(await one(db,'SELECT revision FROM app_revision WHERE id=1')).revision;let sql,params,record,action,bookingId,changes;
  if(route==='/api/client/bookings'){
    interval(body.starts_at,body.ends_at,now);const placeId=id(body.workplace_id),tariffId=id(body.tariff_id);
    const p=await one(db,'SELECT w.*,z.active AS zone_active FROM workplaces w JOIN zones z ON z.id=w.zone_id WHERE w.id=?',placeId),t=await one(db,'SELECT * FROM tariffs WHERE id=?',tariffId);
    requireValue(p&&p.condition==='available'&&p.zone_active,'Место сейчас недоступно',409);requireValue(t&&t.active&&t.category_id===p.category_id&&Date.parse(t.valid_from)<=Date.parse(body.starts_at)&&(!t.valid_to||Date.parse(t.valid_to)>Date.parse(body.starts_at)),'Тариф не действует для выбранного места и времени',409);
    const bs=await all(db,"SELECT * FROM bookings WHERE workplace_id=? AND status='confirmed'",placeId),ss=await all(db,"SELECT * FROM sessions WHERE workplace_id=? AND status='active'",placeId);
    requireValue(!bs.some(b=>overlap(body.starts_at,body.ends_at,b.starts_at,b.ends_at))&&!ss.some(s=>overlap(body.starts_at,body.ends_at,s.started_at,s.planned_ends_at)),'Это время уже занято. Обновите список мест.',409);
    bookingId=await next(db,'bookings');action='create';changes={client_id:user.client_id,workplace_id:placeId,tariff_id:tariffId,starts_at:body.starts_at,ends_at:body.ends_at,status:'confirmed'};
    sql="INSERT INTO bookings(id,client_id,workplace_id,tariff_id,starts_at,ends_at,status,needs_resolution,fault_id,cancel_reason,changed_at,changed_by) VALUES(?,?,?,?,?,?,'confirmed',0,NULL,NULL,?,NULL)";params=[bookingId,user.client_id,placeId,tariffId,body.starts_at,body.ends_at,now];
  }else{
    const m=route.match(/^\/api\/client\/bookings\/(\d+)\/cancel$/);requireValue(m,'Операция не найдена',404);bookingId=Number(m[1]);
    record=await one(db,'SELECT * FROM bookings WHERE id=? AND client_id=?',bookingId,user.client_id);requireValue(record,'Бронь не найдена',404);requireValue(record.status==='confirmed','Бронь уже закрыта',409);requireValue(!await one(db,'SELECT id FROM sessions WHERE booking_id=?',bookingId),'По брони уже начат сеанс',409);requireValue(Date.parse(now)<Date.parse(record.starts_at)||record.needs_resolution,'Самостоятельная отмена доступна до начала брони. Обратитесь к администратору.',409);
    const reason=text(body.reason||'Отмена клиентом','Причина отмены',3,300);action='cancel';changes={status:'cancelled',needs_resolution:0,cancel_reason:reason};sql="UPDATE bookings SET status='cancelled',needs_resolution=0,cancel_reason=?,changed_at=?,changed_by=NULL WHERE id=?";params=[reason,now,bookingId];
  }
  const logId=await next(db,'action_log');
  await db.batch([stmt(db,'UPDATE app_revision SET revision=revision+1 WHERE id=1 AND revision=?',rev),stmt(db,'INSERT INTO app_assertion VALUES(changes())'),stmt(db,'DELETE FROM app_assertion'),stmt(db,`INSERT INTO app_assertion SELECT CASE WHEN EXISTS(SELECT 1 FROM app_client_sessions s JOIN client_accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>? AND a.id=? AND a.active=1 AND a.client_id=?) THEN 1 ELSE 0 END`,user.token_hash,now,user.id,user.client_id),stmt(db,'DELETE FROM app_assertion'),stmt(db,sql,...params),stmt(db,`INSERT INTO action_log(id,entity_type,entity_id,action,old_values,new_values,reason,occurred_at,staff_id,client_id) VALUES(?,'bookings',?,?,?,?,?, ?,NULL,?)`,logId,bookingId,action,JSON.stringify(record||{}),JSON.stringify(changes),body.reason||null,now,user.client_id),stmt(db,'UPDATE meta SET snapshot_at=? WHERE id=1',now)]);
  return json({ok:true,id:bookingId},action==='create'?201:200);
}
