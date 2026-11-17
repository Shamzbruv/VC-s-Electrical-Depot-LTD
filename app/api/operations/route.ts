import {boundedJson,response,sameOrigin,supabase} from '../../../lib/operations-server';

export const dynamic='force-dynamic';

export async function POST(req:Request) {
  if (!sameOrigin(req)) return response({error:'Invalid origin.'},403);
  const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return response({error:'Sign in to open the staff workspace.'},401);
  try {
    const {action,area,input}=await boundedJson(req);
    if (typeof area!=='string'||area.length>40||!['read','write'].includes(action)) return response({error:'Invalid workspace request.'},400);
    if (action==='write'&&area==='staff_setup_link') {
      return response(await supabase('/functions/v1/vc-staff-setup',{token,body:{email:input?.email}}));
    }
    if (action==='read'&&area==='dashboard')return response(await supabase('/rest/v1/rpc/vcs_dashboard',{token,body:{}}));
    const path=action==='read'?'/rest/v1/rpc/vcs_read':'/rest/v1/rpc/vcs_write';
    return response(await supabase(path,{token,body:{[action==='read'?'p_area':'p_action']:area,p:input||{}}}));
  } catch(error) {
    const message=error instanceof Error?error.message:'Request failed.';
    const status=message.includes('session expired')?401:/permission required|staff access|staff account/i.test(message)?403:400;
    return response({error:message},status);
  }
}
