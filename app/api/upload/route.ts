import {mediaBucket,mediaLabel,mediaLimit,mediaNamePattern,mediaPath} from '../../../lib/media';
import {objectPath,staffBearer,storageRequest} from '../../../lib/media-server';
import {response,sameOrigin,supabase} from '../../../lib/operations-server';

export const dynamic='force-dynamic';

async function allowed(token:string) {
  return supabase<boolean>('/rest/v1/rpc/vcs_can_manage_media',{token,body:{}});
}

export async function GET(req:Request) {
  const token=staffBearer(req);
  if(!token)return response({error:'Sign in to open the media library.'},401);
  try{
    if(!await allowed(token))return response({error:'Website or product access is required.'},403);
    const url=new URL(req.url);
    const query=(url.searchParams.get('q')||'').toLowerCase().replace(/[^a-z0-9 -]/g,'').trim().replace(/ +/g,'-').slice(0,70);
    const offset=Math.max(0,Math.min(10000,Math.trunc(Number(url.searchParams.get('offset'))||0)));
    const limit=8;
    const result=await storageRequest('list/'+mediaBucket,{token,method:'POST',type:'application/json',body:JSON.stringify({
      prefix:'',limit:limit+1,offset,sortBy:{column:'created_at',order:'desc'},...(query?{search:query}:{}),
    })});
    if(!result.ok)return response({error:'Could not open the media library.'},result.status===401?401:502);
    const rows=await result.json() as {name:string;created_at?:string}[];
    return response({items:rows.slice(0,limit).filter(row=>mediaNamePattern.test(row.name)).map(row=>({
      src:mediaPath+row.name,label:mediaLabel(row.name),createdAt:row.created_at,
    })),more:rows.length>limit,limit});
  }catch(error){
    return response({error:'Could not open the media library.'},error instanceof Error&&error.message.includes('session expired')?401:502);
  }
}

export async function POST(req:Request) {
  if(!sameOrigin(req))return response({error:'Invalid origin.'},403);
  const token=staffBearer(req);
  if(!token)return response({error:'Sign in to upload photos.'},401);
  if(req.headers.get('content-type')!=='image/webp')return response({error:'Choose a JPEG, PNG, or WebP image.'},415);
  if(Number(req.headers.get('content-length'))>mediaLimit)return response({error:'The prepared image must be under 2 MB.'},413);
  try{
    if(!await allowed(token))return response({error:'Website or product access is required.'},403);
    if(!req.body)return response({error:'Choose an image to upload.'},400);
    const reader=req.body.getReader();
    const image=new Uint8Array(mediaLimit);
    let length=0;
    for(;;){
      const part=await reader.read();
      if(part.done)break;
      if(length+part.value.byteLength>mediaLimit){
        await reader.cancel();
        return response({error:'The prepared image must be under 2 MB.'},413);
      }
      image.set(part.value,length);
      length+=part.value.byteLength;
    }
    const header=new TextDecoder().decode(image.subarray(0,12));
    if(length<20||header.slice(0,4)!=='RIFF'||header.slice(8)!=='WEBP'||new DataView(image.buffer).getUint32(4,true)!==length-8)
      return response({error:'The prepared image is not a valid WebP file.'},415);
    const label=(new URL(req.url).searchParams.get('name')||'photo').toLowerCase().replace(/\.[a-z0-9]+$/,'')
      .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'photo';
    const name=crypto.randomUUID()+'-'+label+'.webp';
    const saved=await storageRequest(objectPath(name),{token,method:'POST',body:image.subarray(0,length),type:'image/webp'});
    if(!saved.ok)return response({error:'The photo could not be uploaded. Try again.'},saved.status===401?401:502);
    return response({src:mediaPath+name,label:mediaLabel(name)},201);
  }catch(error){
    return response({error:'The photo could not be uploaded. Try again.'},error instanceof Error&&error.message.includes('session expired')?401:502);
  }
}
