/// <reference lib="deno.ns" />
import {deliveryEmail,type DeliveryMail} from '../_shared/delivery-email.ts';

const url=Deno.env.get('SUPABASE_URL')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const origin=Deno.env.get('SITE_ORIGIN')||'https://vc-s-electrical-depot-ltd-production.up.railway.app';
const key=Deno.env.get('RESEND_API_KEY');
const sender=Deno.env.get('DELIVERY_EMAIL_FROM');
const secret=Deno.env.get('DELIVERY_AUTOMATION_SECRET');
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const rpc=async <T>(name:string,input:object):Promise<T>=>{
  const response=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Database operation failed.');
  return await response.json() as T;
};
Deno.serve(async request=>{
  if(request.method!=='POST')return reply({error:'Use POST.'},405);
  try{
    const cron=!!secret&&request.headers.get('x-delivery-worker')===secret;
    if(!cron){
      const auth=request.headers.get('authorization');
      if(!auth)return reply({error:'Sign in.'},401);
      const user=await fetch(url+'/auth/v1/user',{headers:{apikey:anon,Authorization:auth},signal:AbortSignal.timeout(7000)});
      if(!user.ok)return reply({error:'Your session expired. Please sign in again.'},401);
      const profile=await fetch(url+'/rest/v1/rpc/vcs_read',{method:'POST',headers:{apikey:anon,Authorization:auth,'Content-Type':'application/json'},body:'{"p_area":"profile"}',signal:AbortSignal.timeout(7000)});
      if(!profile.ok)return reply({error:'Delivery permission required.'},403);
      const staff=await profile.json();
      if(!staff.permissions?.includes('dispatch'))return reply({error:'Delivery permission required.'},403);
    }
    const body=await request.text();
    if(body.length>1000)return reply({error:'Invalid request.'},400);
    const input=body?JSON.parse(body):{};
    if(input.operation==='status')return reply({configured:!!key&&!!sender,sender:sender||null,scheduled:!!secret&&await rpc<boolean>('vcs_email_schedule_active',{})});
    if(!key||!sender)return reply({configured:false,processed:0});
    let processed=0;
    const limit=cron?10:3;
    for(let index=0;index<limit;index++){
      const job=await rpc<{id:string;lease:string;recipient:string;payload:DeliveryMail}|null>('vcs_email_claim',{p_package:input.package_id||null});
      if(!job)break;
      const email=deliveryEmail(job.payload,origin);
      try{
        const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{
          Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'vc-delivery/'+job.id,
        },body:JSON.stringify({from:sender,to:[job.recipient],reply_to:'vcselectrical@gmail.com',...email}),signal:AbortSignal.timeout(15000)});
        const data=await sent.json();
        if(!sent.ok||!data.id)throw Error('The email provider rejected this message. Check the sender configuration and provider log.');
        await rpc('vcs_email_ack',{p_id:job.id,p_lease:job.lease,p_provider:data.id,p_error:null});
        processed++;
      }catch{
        await rpc('vcs_email_ack',{p_id:job.id,p_lease:job.lease,p_provider:null,p_error:'Sending could not be confirmed. An automatic retry will use the same message ID.'});
      }
    }
    return reply({configured:true,processed});
  }catch{return reply({error:'Delivery email processing is temporarily unavailable.'},503);}
});
