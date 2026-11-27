import {SB_URL} from './config';
import {secret} from './server';

export class SupabaseFailure extends Error {
  constructor(message:string,public status:number,public code?:string){super(message);}
}
export const missingRpc=(error:unknown)=>error instanceof SupabaseFailure&&['PGRST202','42883'].includes(error.code||'');

export function response(value: unknown, status=200) {
  return Response.json(value, {status,headers:{'Cache-Control':'no-store'}});
}

export function sameOrigin(req: Request) {
  const origin=req.headers.get('origin');
  if (!origin) return true;
  const requestUrl=new URL(req.url);
  if (origin===requestUrl.origin) return true;
  // Railway terminates HTTPS in front of the Next.js process.
  return origin==='https://'+req.headers.get('host');
}

export async function boundedJson(req: Request) {
  if (Number(req.headers.get('content-length'))>350000) throw Error('Request is too large.');
  const raw=await req.text();
  if (raw.length>350000) throw Error('Request is too large.');
  return JSON.parse(raw);
}

export async function supabase<T=unknown>(path: string, {token,body,method}: {token?:string;body?:unknown;method?:string}={}) {
  const key=secret('SUPABASE_ANON_KEY');
  const result=await fetch(SB_URL+path,{
    method:method||(body?'POST':'GET'),
    headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
    body:body===undefined?undefined:JSON.stringify(body),
    cache:'no-store',signal:AbortSignal.timeout(12000),
  });
  const data=await result.json() as {code?:string;error_code?:string;message?:string;msg?:string;error_description?:string;error?:string};
  if (!result.ok) {
    const code=data.code||data.error_code;
    const message=data.message||data.msg||data.error_description||data.error;
    if (code==='23505') throw new SupabaseFailure('That SKU or URL slug is already in use.',result.status,code);
    if (result.status===401||code==='PGRST301') throw new SupabaseFailure('Your session expired. Please sign in again.',401,code);
    if (code==='P0001'||(path.startsWith('/auth/')||path.startsWith('/functions/'))) throw new SupabaseFailure(message||'Unable to complete this request.',result.status,code);
    throw new SupabaseFailure('Unable to complete this request. Check the details and try again.',result.status,code);
  }
  return data as T;
}
