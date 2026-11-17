import {SB_URL} from './config';
import {mediaBucket} from './media';
import {secret} from './server';

export function staffBearer(req:Request) {
  return req.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
}

export function storageRequest(path:string,{token,method='GET',body,type}:{token?:string;method?:string;body?:BodyInit;type?:string}={}) {
  const key=secret('SUPABASE_ANON_KEY');
  const auth=token||(!key.startsWith('sb_')?key:undefined);
  return fetch(SB_URL+'/storage/v1/object/'+path,{
    method,body,cache:'no-store',signal:AbortSignal.timeout(15000),
    headers:{apikey:key,...(auth?{Authorization:'Bearer '+auth}:{}),...(type?{'Content-Type':type}:{})},
  });
}

export const objectPath=(name:string)=>mediaBucket+'/'+encodeURIComponent(name);
