// DOM: selectors, safe text encoding, and live notifications.
export const $=s=>document.querySelector(s),escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function notify(message,bad=false){const el=document.createElement('div');el.className='toast'+(bad?' bad':'');el.textContent=message;$('#notifications').append(el);setTimeout(()=>el.remove(),5500);}
