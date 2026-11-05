import {SB_URL,Product} from './config';
import {secret} from './server';
export async function catalog():Promise<Product[]>{try{const r=await fetch(SB_URL+'/rest/v1/products?status=eq.published&order=name',{signal:AbortSignal.timeout(5000),headers:{apikey:secret('SUPABASE_ANON_KEY')},cache:'no-store'});if(!r.ok)return [];return r.json()}catch{return []}}
export async function content(slug:string){try{const r=await fetch(SB_URL+'/rest/v1/content?status=eq.published&slug=eq.'+encodeURIComponent(slug),{signal:AbortSignal.timeout(5000),headers:{apikey:secret('SUPABASE_ANON_KEY')},cache:'no-store'});return (await r.json() as any[])[0]}catch{return null}}
