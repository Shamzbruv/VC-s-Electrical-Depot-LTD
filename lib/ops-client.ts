export type Permission='finance'|'finance_reports'|'dispatch'|'drive'|'catalog'|'leads'|'website'|'access';
export type Profile={id:string;role:string;email:string;permissions:Permission[]|null};
export const permissionLabels:Record<Permission,string>={
  finance:'Log daily finances',finance_reports:'Read financial reports',dispatch:'Manage dispatch',drive:'Driver workspace',
  catalog:'Manage product visibility',leads:'Manage enquiries',website:'Edit and publish website',access:'Manage staff access',
};
export const roles:Record<string,string>={admin:'Administrator',accountant:'Accountant',dispatcher:'Dispatcher',driver:'Driver',catalog_editor:'Product manager',marketing_editor:'Website editor',reports_viewer:'Reports viewer',owner:'Owner',order_fulfillment:'Dispatcher (legacy)'};
const rolePermissions = {
  owner: ['finance','finance_reports','dispatch','drive','catalog','leads','website','access'],
  admin: ['finance','finance_reports','dispatch','catalog','leads','website'],
  accountant: ['finance','finance_reports'],
  dispatcher: ['dispatch'],
  driver: ['drive'],
  catalog_editor: ['catalog'],
  marketing_editor: ['website'],
  reports_viewer: ['finance_reports'],
  order_fulfillment: ['dispatch'],
} satisfies Record<string, Permission[]>;

export type StaffRole = keyof typeof rolePermissions;
export const staffRoles = Object.keys(rolePermissions) as StaffRole[];
export const defaultPermissions: Readonly<Record<string, Permission[]>> = rolePermissions;
export const canPreviewStaffRoles = (role:string) => role==='owner' || role==='admin';

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
