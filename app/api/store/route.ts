import {catalog} from '../../../lib/catalog';
import {company} from '../../../lib/company';
import {ORIGIN} from '../../../lib/config';
import {boundedJson,response,sameOrigin,supabase} from '../../../lib/operations-server';

export const dynamic='force-dynamic';

export async function GET(req:Request) {
  const action=new URL(req.url).searchParams.get('action');
  if (action==='health') {
    try {
      await supabase('/rest/v1/website_edits?select=route&limit=1');
      return response({database:true,publicKey:true,mode:'enquiry'});
    } catch {return response({database:false,publicKey:true,mode:'enquiry'},503);}
  }
  if (action==='catalog') return response(await catalog());
  if (action==='public-settings') return response({brand:company,commerce:{bank_enabled:false,pickup_address:company.address},zones:[]});
  return response({error:'Online ordering has closed. Contact the depot or request a quotation.'},410);
}

export async function POST(req:Request) {
  if (!sameOrigin(req)) return response({error:'Invalid origin.'},403);
  try {
    const {action,...input}=await boundedJson(req);
    if (action==='quote'||action==='contact') return response(await supabase('/rest/v1/rpc/vcs_request',{body:{p:{...input,kind:action}}}),201);
    if (action==='auth') return response(await supabase('/auth/v1/token?grant_type=password',{body:{email:input.email,password:input.password}}));
    if (action==='staff_refresh') return response(await supabase('/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:input.refresh_token}}));
    if (action==='staff_verify') {
      if (typeof input.token_hash!=='string'||!/^[-a-zA-Z0-9_]{15,180}$/.test(input.token_hash)||!['invite','recovery','magiclink','email'].includes(input.type)) throw Error('Open a current staff setup link.');
      return response(await supabase('/auth/v1/verify',{body:{token_hash:input.token_hash,type:input.type}}));
    }
    if (action==='activate') {
      if (typeof input.email!=='string'||typeof input.password!=='string'||input.password.length<10||input.password.length>72) throw Error('Use a valid email and a password with 10–72 characters.');
      const approved=await supabase('/rest/v1/rpc/vcs_can_activate',{body:{p_email:input.email}});
      if (approved) {
        const redirect=new URL('/admin',ORIGIN);
        try {
          await supabase('/auth/v1/signup?redirect_to='+encodeURIComponent(redirect.toString()),{body:{email:input.email,password:input.password}});
        } catch(error) {
          if (error instanceof Error&&error.message.toLowerCase().includes('disabled')) throw Error('Contact the owner to activate your staff account.');
          throw error;
        }
      }
      return response({ok:true});
    }
    if (action==='reset') {
      const redirect=new URL('/admin',ORIGIN);
      await supabase('/auth/v1/recover?redirect_to='+encodeURIComponent(redirect.toString()),{body:{email:input.email}});
      return response({ok:true});
    }
    if (action==='update_password') {
      const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
      if (!token) return response({error:'Open a valid recovery link.'},401);
      if (typeof input.password!=='string'||input.password.length<10) throw Error('Use at least 10 characters.');
      await supabase('/auth/v1/user',{method:'PUT',token,body:{password:input.password}});
      return response({ok:true});
    }
    return response({error:'Online ordering has closed. Please request a quotation.'},410);
  } catch(error) {
    return response({error:error instanceof Error?error.message:'Unable to complete your request.'},400);
  }
}
