/// <reference lib="deno.ns" />

const url=Deno.env.get('SUPABASE_URL');
const anon=Deno.env.get('SUPABASE_ANON_KEY');
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
Deno.serve(async (request:Request)=>{
  if(request.method!=='POST')return reply({error:'Use POST.'},405);
  if(!url||!anon||!service)return reply({error:'Staff setup is unavailable.'},503);
  const authorization=request.headers.get('authorization');
  if(!authorization?.startsWith('Bearer '))return reply({error:'Sign in as an owner or administrator.'},401);
  try{
    const sessionHeaders={apikey:anon,Authorization:authorization,'Content-Type':'application/json'};
    // Verify the bearer token with Auth before using any elevated credentials.
    const session=await fetch(url+'/auth/v1/user',{headers:sessionHeaders,signal:AbortSignal.timeout(7000)});
    if(!session.ok)return reply({error:'Your session expired. Please sign in again.'},401);
    const body=await request.text();
    if(body.length>2048)return reply({error:'Invalid request.'},400);
    const {email}=JSON.parse(body);
    if(typeof email!=='string'||email.length>254)return reply({error:'Choose an approved staff email.'},400);
    const access=await fetch(url+'/rest/v1/rpc/vcs_read',{
      method:'POST',headers:sessionHeaders,body:JSON.stringify({p_area:'access'}),signal:AbortSignal.timeout(7000),
    });
    if(!access.ok)return reply({error:'Staff management permission required.'},403);
    const accounts=await access.json() as {email:string;role:string|null;active:boolean|null;pending:boolean}[];
    const me=await fetch(url+'/rest/v1/rpc/vcs_read',{
      method:'POST',headers:sessionHeaders,body:JSON.stringify({p_area:'profile'}),signal:AbortSignal.timeout(7000),
    });
    const caller=me.ok?await me.json() as {role?:string}:{};
    const callerRole=caller.role;
    const account=accounts.find(item=>item.email.toLowerCase()===email.toLowerCase());
    if(!account?.active||!account.role||account.role==='owner')return reply({error:'Choose an approved, enabled staff account.'},400);
    // Administrators may issue links for staff below them; only the owner may do so for another administrator.
    if(account.role==='admin'&&callerRole!=='owner')return reply({error:'Only the owner can create a link for an administrator.'},403);
    const headers={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
    let type=account.pending?'invite':'recovery';
    const generate=()=>fetch(url+'/auth/v1/admin/generate_link',{
      method:'POST',headers,body:JSON.stringify({type,email:account.email}),signal:AbortSignal.timeout(7000),
    });
    let link=await generate();
    if(type==='invite'&&link.status===422) {
      // A previous setup link may have created an unconfirmed account.
      type='magiclink';
      link=await generate();
    }
    if(!link.ok)return reply({error:'Unable to create a setup link. Try again shortly.'},502);
    const data=await link.json() as {hashed_token?:string;verification_type?:string};
    if(!data.hashed_token)return reply({error:'Unable to create a setup link.'},502);
    return reply({token_hash:data.hashed_token,type:data.verification_type||type});
  }catch{return reply({error:'Unable to create a setup link.'},400);}
});
