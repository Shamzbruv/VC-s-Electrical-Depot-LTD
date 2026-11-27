export type Permission='dispatch'|'catalog'|'leads'|'website'|'access'|'reports';
export type Profile={id:string;role:string;email:string;permissions:Permission[]|null};
export const permissionLabels:Record<Permission,string>={
  dispatch:'Delivery supervision',catalog:'Products and photos',leads:'Customer enquiries',
  website:'Website editor',access:'Staff access',reports:'Operations reports',
};
export type StaffRole='owner'|'admin';
export const roles:Record<string,string>={owner:'Owner',admin:'Admin'};
export const staffRoles:StaffRole[]=['owner','admin'];
export const defaultPermissions:Record<string,Permission[]>={
  owner:['dispatch','catalog','leads','website','reports','access'],
  admin:['dispatch','catalog','leads','website','reports'],
};
export const canPreviewStaffRoles=(role:string)=>role==='owner'||role==='admin';

export function normalizeProfile(profile:{id:string;role:string;email:string;permissions:string[]|null}):Profile {
  const role=profile.role==='owner'?'owner':'admin';
  const mapped=(profile.permissions||[]).map(scope=>scope==='drive'?'dispatch':['finance','finance_reports'].includes(scope)?'reports':scope);
  return {...profile,role,permissions:[...new Set(mapped.filter((scope):scope is Permission=>Object.keys(permissionLabels).includes(scope)))]};
}
