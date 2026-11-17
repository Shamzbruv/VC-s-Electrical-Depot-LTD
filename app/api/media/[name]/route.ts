import {mediaNamePattern} from '../../../../lib/media';
import {objectPath,staffBearer,storageRequest} from '../../../../lib/media-server';

export const dynamic='force-dynamic';

export async function GET(req:Request,{params}:{params:Promise<{name:string}>}) {
  const {name}=await params;
  if(!mediaNamePattern.test(name))return new Response(null,{status:404});
  const token=staffBearer(req);
  try{
    const stored=await storageRequest('authenticated/'+objectPath(name),{token});
    if(!stored.ok||!stored.body)return new Response(null,{
      status:stored.status>=500?502:token&&stored.status===401?401:404,headers:{'Cache-Control':'no-store'},
    });
    return new Response(stored.body,{headers:{
      'Content-Type':'image/webp','X-Content-Type-Options':'nosniff',
      'Cache-Control':token?'private, no-store':'public, max-age=60',
      'Vary':'Authorization',
    }});
  }catch{return new Response(null,{status:502,headers:{'Cache-Control':'no-store'}});}
}
