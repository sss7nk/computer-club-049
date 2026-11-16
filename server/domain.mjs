export class AppError extends Error{constructor(status,message,fields){super(message);this.status=status;this.fields=fields;}}
export function requireValue(value,message,status=400){if(!value)throw new AppError(status,message);}
export const nowISO=env=>new Date((env.__clock?env.__clock():Date.now())+10800000).toISOString().replace('Z','+03:00');
export function timestamp(value,label='Дата и время'){
  requireValue(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?\+03:00$/.test(value),label+': нужен формат ISO 8601 +03:00');
  const parsed=Date.parse(value);requireValue(Number.isFinite(parsed),label+': неверная дата');
  const normalized=new Date(parsed+10800000).toISOString();requireValue(normalized.slice(0,16)===value.slice(0,16)&&normalized.slice(0,10)===value.slice(0,10),label+': неверный календарный день');return parsed;
}
export function text(value,label,min=1,max=200){requireValue(typeof value==='string'&&value.trim().length>=min&&value.trim().length<=max,`${label}: от ${min} до ${max} символов`);return value.trim();}
export function id(value,label='Идентификатор'){const n=Number(value);requireValue(Number.isSafeInteger(n)&&n>0,label+': требуется положительное целое');return n;}
export const money=c=>`${BigInt(c)/100n}.${String(BigInt(c)%100n).padStart(2,'0')}`;
export function cents(s){requireValue(typeof s==='string'&&/^\d+\.\d{2}$/.test(s),'Сумма: требуется десятичная строка');const c=BigInt(s.replace('.',''));requireValue(c<=99999999999999n,'Сумма слишком велика');return c;}
export function cost(rate,start,end){const delta=timestamp(end)-timestamp(start);requireValue(delta>0,'Окончание должно быть позже начала');const minutes=Math.ceil(delta/60000);return {billable_minutes:minutes,total_amount:money((cents(rate)*BigInt(minutes)+30n)/60n)};}
export const overlap=(a,b,c,d)=>timestamp(a)<timestamp(d)&&timestamp(c)<timestamp(b);
export const deadline=b=>Math.min(timestamp(b.starts_at)+900000,timestamp(b.ends_at));
export const roleNames={manager:'Управляющий',admin:'Администратор',cashier:'Кассир',technician:'Технический специалист',accountant:'Бухгалтер'};
export const has=(user,...roles)=>roles.some(r=>user.roles.includes(r));
export function permission(user,...roles){requireValue(has(user,...roles),'Недостаточно прав для этой операции',403);}

export function makeReport(data,name,first,last){
  requireValue(/^\d{4}-\d{2}-\d{2}$/.test(first||'')&&/^\d{4}-\d{2}-\d{2}$/.test(last||''),'Укажите начало и конец периода');
  const start=timestamp(first+'T00:00:00+03:00','Начало периода'),end=timestamp(last+'T00:00:00+03:00','Конец периода')+86400000;
  requireValue(Number.isFinite(start)&&Number.isFinite(end)&&end>start,'Неверный период отчёта');
  const inside=t=>Date.parse(t)>=start&&Date.parse(t)<end;
  const index=table=>Object.fromEntries(data[table].map(r=>[r.id,r]));
  const clients=index('clients'),places=index('workplaces'),zones=index('zones'),cats=index('categories'),tariffs=index('tariffs');
  let headers,rows=[];
  if(name==='bookings'){
    headers=['Бронь','Начало','Конец','Клиент','Место','Зона','Категория','Тариф','Ставка руб/ч','Статус','Ожидает решения'];
    rows=data.bookings.filter(b=>inside(b.starts_at)).map(b=>{const p=places[b.workplace_id],t=tariffs[b.tariff_id];return [b.id,b.starts_at,b.ends_at,clients[b.client_id].full_name,p.number,zones[p.zone_id].name,cats[p.category_id].name,t.name,t.hourly_rate,b.status,!!b.needs_resolution];});
  }else if(name==='attendance'){
    headers=['Клиент','Завершённых сеансов','Минут посещения'];const grouped=new Map();
    for(const s of data.sessions.filter(s=>s.status==='completed'&&inside(s.ended_at))){const g=grouped.get(s.client_id)||[0,0];g[0]++;g[1]+=(Date.parse(s.ended_at)-Date.parse(s.started_at))/60000;grouped.set(s.client_id,g);}
    rows=[...grouped.entries()].sort((a,b)=>a[0]-b[0]).map(([cid,g])=>[clients[cid].full_name,g[0],g[1].toFixed(2)]);
    rows.push(['Итого сеансов',[...grouped.values()].reduce((a,v)=>a+v[0],0),[...grouped.values()].reduce((a,v)=>a+v[1],0).toFixed(2)],['Уникальных клиентов',grouped.size,'']);
  }else if(name==='revenue'){
    headers=['Способ оплаты','Количество','Сумма в рублях'];let total=0n,count=0;
    for(const method of data.payment_methods){const ps=data.payments.filter(p=>p.method_id===method.id&&inside(p.paid_at));const amount=ps.reduce((a,p)=>a+cents(p.amount),0n);rows.push([method.name,ps.length,money(amount)]);total+=amount;count+=ps.length;}rows.push(['Итого',count,money(total)]);
  }else if(name==='no_shows'){
    headers=['Уровень','Бронь / клиент','Плановое начало','Клиент','Место','Число неявок'];const byClient=new Map(),byDate=new Map();let total=0;
    for(const b of data.bookings.filter(b=>b.status==='no_show'&&inside(b.starts_at))){rows.push(['Бронь',b.id,b.starts_at,clients[b.client_id].full_name,places[b.workplace_id].number,1]);byClient.set(b.client_id,(byClient.get(b.client_id)||0)+1);const date=b.starts_at.slice(0,10);byDate.set(date,(byDate.get(date)||0)+1);total++;}
    for(const [cid,n] of [...byClient].sort((a,b)=>a[0]-b[0]))rows.push(['Клиент',cid,'',clients[cid].full_name,'',n]);for(const [date,n] of [...byDate].sort())rows.push(['Дата','',date,'','',n]);rows.push(['Итого','','','','',total]);
  }else if(name==='workplace_load'){
    headers=['Уровень','Объект','Зона','Категория','Число сеансов в периоде','Минут использования','Фонд минут','Загрузка %'];
    const cutoff=Math.min(end,Date.parse(data.meta.snapshot_at)),fund=Math.max(0,(cutoff-start)/60000),grouped=new Map();
    for(const p of data.workplaces){let count=0,minutes=0;for(const s of data.sessions.filter(s=>s.workplace_id===p.id)){const a=Math.max(start,Date.parse(s.started_at));let b=Math.min(cutoff,Date.parse(s.ended_at||data.meta.snapshot_at));for(const f of data.faults.filter(f=>f.workplace_id===p.id)){const t=Date.parse(f.detected_at);if(Date.parse(s.started_at)<t&&t<b)b=t;}if(b>a){count++;minutes+=(b-a)/60000;}}
      rows.push(['Место',p.number,zones[p.zone_id].name,cats[p.category_id].name,count,minutes.toFixed(2),fund.toFixed(2),(fund?minutes/fund*100:0).toFixed(2)]);const g=grouped.get(p.zone_id)||[0,0,0];g[0]+=count;g[1]+=minutes;g[2]++;grouped.set(p.zone_id,g);
    }
    for(const [z,g] of [...grouped].sort((a,b)=>a[0]-b[0]))rows.push(['Зона',zones[z].name,zones[z].name,'Все',g[0],g[1].toFixed(2),(fund*g[2]).toFixed(2),(fund?g[1]/(fund*g[2])*100:0).toFixed(2)]);
  }else throw new AppError(404,'Неизвестный отчёт');
  return {name,first,last,headers,rows};
}
export function csv(report){const cell=value=>{let s=String(value??'');if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return '\ufeff'+[report.headers,...report.rows].map(row=>row.map(cell).join(';')).join('\r\n');}
