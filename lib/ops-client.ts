export {permissionLabels,roles,staffRoles,defaultPermissions,canPreviewStaffRoles} from './staff-access';
export type {Permission,Profile,StaffRole} from './staff-access';

let refreshing:Promise<string>|null=null;
export async function staffToken(force=false) {
  const raw=sessionStorage.getItem('vc-session');
  const session=raw?JSON.parse(raw):null;
  if (!session?.access_token) throw Error('Sign in to open the staff workspace.');
  if (!force&&(!session.expires_at||Number(session.expires_at)*1000>Date.now()+60000)) return String(session.access_token);
  if (!session.refresh_token) throw Error('Your session expired. Please sign in again.');
  if (!refreshing) refreshing=(async()=>{
    const result=await fetch('/api/store',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'staff_refresh',refresh_token:session.refresh_token})});
    if (!result.ok) throw Error('Your session expired. Please sign in again.');
    const next=await result.json() as {access_token:string};
    sessionStorage.setItem('vc-session',JSON.stringify(next));
    return String(next.access_token);
  })().finally(()=>{refreshing=null;});
  return refreshing;
}
export async function ops<T=any>(action:'read'|'write',area:string,input:object={}) {
  const request=(token:string)=>fetch('/api/operations',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action,area,input})});
  let res=await request(await staffToken());
  if (res.status===401) res=await request(await staffToken(true));
  const data=await res.json() as T & {error?:string};
  if (!res.ok) throw Error(data.error||'Unable to reach the workspace.');
  return data as T;
}
