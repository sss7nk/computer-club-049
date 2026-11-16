// Shared browser state; access permissions are enforced again by the API.
export const names={manager:'Управляющий',admin:'Администратор',cashier:'Кассир',technician:'Техник',accountant:'Бухгалтер'};
export const statuses={confirmed:['Подтверждена','green'],completed:['Завершён','grey'],cancelled:['Отменена','grey'],no_show:['Неявка','red'],active:['Идёт сеанс','green'],open:['В ремонте','red'],resolved:['Устранена','green'],paid:['Оплачен','green'],available:['Исправно','green'],maintenance:['На обслуживании','red']};
export const reportNames={bookings:'Журнал бронирований',attendance:'Посещаемость и клиенты',workplace_load:'Загрузка мест и зон',no_shows:'Неявки',revenue:'Выручка'};
export const state={user:null,data:{},now:null,page:'home',search:'',filter:'all',report:null,public:null,reportFrom:'',reportTo:''};
export const can=(...roles)=>state.user&&roles.some(r=>state.user.roles.includes(r));
export const hasData=k=>Array.isArray(state.data[k]);
