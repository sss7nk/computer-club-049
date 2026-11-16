import {state} from './state.js';
export const initials=name=>name.split(' ').slice(0,2).map(s=>s[0]).join('').toUpperCase();
export const price=s=>new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(s))+' ₽';
export const dt=s=>s?new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(s)):'—';
export const shortTime=s=>s?new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(new Date(s)):'—';
export const today=()=>state.now?.slice(0,10)||new Date(Date.now()+10800000).toISOString().slice(0,10);
export const localValue=ms=>new Date(ms+10800000).toISOString().slice(0,19);
export const iso=v=>v.length===16?v+':00+03:00':v+'+03:00';
export const defaultStart=()=>Math.ceil((Date.now()+1800000)/900000)*900000;
