import {pbkdf2} from '@noble/hashes/pbkdf2';
import {sha256} from '@noble/hashes/sha256';
const encoder=new TextEncoder();
export const randomHex=(bytes=32)=>Array.from(crypto.getRandomValues(new Uint8Array(bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
const unhex=s=>Uint8Array.from(s.match(/.{2}/g)||[],x=>parseInt(x,16));
export async function digest(text){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)));}
export function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
async function derive(password,salt,iterations){
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  try{return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations,salt:unhex(salt)},key,256));}
  catch(error){if(!/iteration|support/i.test(String(error)))throw error;return hex(pbkdf2(sha256,encoder.encode(password),unhex(salt),{c:iterations,dkLen:32}));}
}
export async function hashPassword(password){const salt=randomHex(16);return `pbkdf2_sha256$200000$${salt}$${await derive(password,salt,200000)}`;}
export async function verifyPassword(password,encoded){const [kind,count,salt,value]=String(encoded).split('$');const n=Number(count);if(kind!=='pbkdf2_sha256'||n<100000||n>1000000||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{64}$/.test(value))return false;return equal(await derive(password,salt,n),value);}
export function cookie(request){return request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('club_session='))?.slice(13)||'';}
export function cookieHeader(request,token,seconds=28800){return `club_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
