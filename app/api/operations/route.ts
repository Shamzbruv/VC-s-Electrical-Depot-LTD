import {boundedJson,missingRpc,response,sameOrigin,supabase} from '../../../lib/operations-server';
import {normalizeProfile} from '../../../lib/staff-access';
import {deliveryEmail} from '../../../supabase/functions/_shared/delivery-email';
import {ORIGIN} from '../../../lib/config';

export const dynamic='force-dynamic';

async function supervisor(token:string) {
  const raw=await supabase<Parameters<typeof normalizeProfile>[0]>('/rest/v1/rpc/vcs_read',{token,body:{p_area:'profile',p:{}}});
  const profile=normalizeProfile(raw);
  if(!profile.permissions?.includes('dispatch'))throw Error('Delivery permission required.');
  return profile;
}
async function worker(token:string,operation:string,package_id?:string) {
  return supabase<{configured:boolean;sender?:string;scheduled?:boolean;processed?:number}>('/functions/v1/vc-delivery-mail',{token,body:{operation,package_id}});
}

export async function POST(req:Request) {
  if(!sameOrigin(req))return response({error:'Invalid origin.'},403);
  const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!token)return response({error:'Sign in to open the staff workspace.'},401);
  try{
    const {action,area,input={}}=await boundedJson(req);
    if(typeof area!=='string'||area.length>40||!['read','write'].includes(action))return response({error:'Invalid workspace request.'},400);
    if(action==='read'&&area==='profile'){
      const profile=await supabase<Parameters<typeof normalizeProfile>[0]>('/rest/v1/rpc/vcs_read',{token,body:{p_area:'profile',p:{}}});
      return response(normalizeProfile(profile));
    }
    if(action==='read'&&area==='delivery_setup'){
      await supervisor(token);
      let database=true;
      try{await supabase('/rest/v1/rpc/vcs_supervisor_read',{token,body:{p_area:'setup',p:{}}});}
      catch(error){if(!missingRpc(error))throw error;database=false;}
      let email={configured:false,sender:null as string|null,scheduled:false};
      if(database){
        try{
          const config=await worker(token,'status');
          email={configured:config.configured,sender:config.sender||null,scheduled:config.scheduled||false};
        }catch{}
      }
      return response({database,email:email.configured,sender:email.sender,scheduled:email.scheduled});
    }
    if(action==='read'&&area==='delivery_email_preview'){
      await supervisor(token);
      const phase=input.phase==='arrived'?'arrived':'out_for_delivery';
      return response(deliveryEmail({
        number:101,reference:'VC-EXAMPLE-101',recipient:'Sample customer',email:'customer@example.invalid',address:'Kingston, Jamaica',
        date:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Jamaica'}).format(new Date()),window:'9:00 AM–12:00 PM',
        items:[{name:'LED bulbs',quantity:12,unit:'each'},{name:'PVC conduit',quantity:20,unit:'lengths'}],received_by:'Sample recipient',phase,
      },ORIGIN));
    }
    if(action==='read'&&['shipments','automations','operations_report','picking_products'].includes(area)){
      try{
        const result=await supabase('/rest/v1/rpc/vcs_supervisor_read',{token,body:{p_area:area==='operations_report'?'reports':area,p:input}});
        return response(result);
      }catch(error){
        if(!missingRpc(error))throw error;
        if(area==='picking_products'){
          const profile=await supervisor(token);
          return response(profile.permissions?.includes('catalog')?await supabase('/rest/v1/rpc/vcs_read',{token,body:{p_area:'catalog',p:{}}}):[]);
        }
        if(area==='shipments')return response(await supabase('/rest/v1/rpc/vcs_read',{token,body:{p_area:'dispatch',p:{}}}));
        const profile=normalizeProfile(await supabase<Parameters<typeof normalizeProfile>[0]>('/rest/v1/rpc/vcs_read',{token,body:{p_area:'profile',p:{}}}));
        if(!profile.permissions?.some(scope=>scope==='dispatch'||scope==='reports'))throw Error('Operations permission required.');
        return response({database:false,jobs:[],rows:[]});
      }
    }
    if(action==='write'&&area==='delivery_process_emails'){
      await supervisor(token);
      try{return response(await worker(token,'run',input.id));}
      catch{return response({error:'Email processing is unavailable. Check Automation setup.'},503);}
    }
    if(action==='write'&&area.startsWith('delivery_')){
      const verb=area.slice('delivery_'.length);
      if(!['save','release','arrive','issue','cancel','resolve_email'].includes(verb))return response({error:'Unknown delivery action.'},400);
      let result:unknown;
      try{result=await supabase('/rest/v1/rpc/vcs_supervisor_write',{token,body:{p_action:verb,p:input}});}
      catch(error){if(missingRpc(error))return response({error:'Delivery setup is awaiting the database update. Existing delivery records are preserved.'},409);throw error;}
      if(['release','arrive'].includes(verb)){
        try{await worker(token,'run',input.id);}catch{}
      }
      return response(result);
    }
    if(action==='write'&&area==='staff_setup_link')return response(await supabase('/functions/v1/vc-staff-setup',{token,body:{email:input.email}}));
    if(action==='read'&&area==='dashboard'){
      const summary=await supabase<Record<string,unknown>>('/rest/v1/rpc/vcs_dashboard',{token,body:{}});
      delete summary.finance;
      return response(summary);
    }
    if(['drive','drivers','finance'].includes(area)||area.startsWith('drive_')||area.startsWith('finance_'))
      return response({error:'Open Deliveries or Operations reports in the staff portal.'},410);
    const path=action==='read'?'/rest/v1/rpc/vcs_read':'/rest/v1/rpc/vcs_write';
    return response(await supabase(path,{token,body:{[action==='read'?'p_area':'p_action']:area,p:input}}));
  }catch(error){
    const message=error instanceof Error?error.message:'Request failed.';
    return response({error:message},message.includes('session expired')?401:/permission required|staff access|staff account/i.test(message)?403:400);
  }
}
