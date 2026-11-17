import {response,supabase} from '../../../lib/operations-server';
import {validRoute,type WebsiteEdits} from '../../../lib/website';

export const dynamic='force-dynamic';

export async function GET(req:Request) {
  const route=new URL(req.url).searchParams.get('route')||'/';
  if(!validRoute(route))return response({error:'Unknown page.'},404);
  try {
    const [record]=await supabase<{published:WebsiteEdits}[]>('/rest/v1/website_edits?select=published&route=eq.'+encodeURIComponent(route));
    return response(record?.published||{});
  }catch{return response({error:'Published content is temporarily unavailable.'},503);}
}
