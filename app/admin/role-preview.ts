import {defaultPermissions,type StaffRole,type Profile,type Permission} from '../../lib/ops-client';
import {today} from './workspace';
import type {DashboardData} from './dashboard';

const sampleEmail='driver@example.invalid';
export function previewProfile(role:StaffRole):Profile {
  return {id:'preview-staff',email:'Sample staff account',role,permissions:defaultPermissions[role]};
}

export async function previewRequest<T>(action:'read'|'write',area:string,input:{q?:string;status?:string;offset?:number;from?:string;to?:string;permissions?:Permission[]}={}):Promise<T> {
  if(action==='write')throw Error('Role preview uses sample data. Switch back to your portal to make changes.');
  const day=today();
  const created=day+'T09:00:00-05:00';
  const sampleParcel={
    id:'preview-package',number:101,recipient:'Sample customer',phone:'000-000-0000',address:'Kingston, Jamaica',
    description:'Electrical supplies delivery',delivery_date:day,notes:'Meet the recipient at the main entrance.',
    status:'assigned',driver_id:'preview-driver',driver_email:sampleEmail,
    timeline:[{id:1,event:'assigned',created_at:created}],
  };
  let result:unknown;
  switch(area){
    case 'dashboard': {
      const permits=(permission:Permission)=>input.permissions?.includes(permission)||false;
      const reports=permits('finance_reports');
      const dashboard:DashboardData={};
      if(permits('leads'))dashboard.enquiries={new_quotes:1,new_inquiries:2,reviewing:1};
      if(permits('catalog'))dashboard.catalogue={published:4,private:2};
      if(permits('website'))dashboard.website={drafts:1,draft_routes:['/'],last_published:null};
      if(reports||permits('finance'))dashboard.finance={income:reports?1850000:null,expense:reports?620000:null,entries:5,reports};
      if(permits('dispatch')||permits('drive'))dashboard.deliveries={pending:1,in_transit:0,issues:0,delivered:2,all_drivers:permits('dispatch')};
      if(permits('access'))dashboard.team={active:3,pending:1};
      result=dashboard;
      break;
    }
    case 'notifications': result=[{id:1,message:'Sample package assigned · VC-101',created_at:created}];break;
    case 'drivers': result=[{id:'preview-driver',email:sampleEmail}];break;
    case 'dispatch':
    case 'drive': result=!input.offset&&(!input.status||['active','assigned'].includes(input.status))?[sampleParcel]:[];break;
    case 'finance': {
      const rows=input.from&&input.to&&input.from<=day&&day<=input.to?[{
        id:'preview-entry',entry_date:day,kind:'income',category:'Counter sales',amount_cents:1850000,
        method:'bank_transfer',party:'Sample customer',reference:'DEMO-001',notes:'Example daily ledger entry.',
        created_by:'preview-staff',created_at:created,
      }]:[];
      const amount=rows[0]?.amount_cents||0;
      result={
        totals:{income:amount,expense:0,count:rows.length},
        categories:rows.map(row=>({kind:row.kind,category:row.category,amount:row.amount_cents})),
        trend:rows.map(row=>({day,income:row.amount_cents,expense:0})),
        rows:input.offset?[]:rows,
      };
      break;
    }
    case 'catalog': {
      const item={id:'preview-product',name:'PVC conduit',sku:'DEMO-100',slug:'demo-conduit',category:'Conduits & Fittings',description:'Example product listing.',image:'/products/conduit.svg',unit:'each',status:'draft',sample:false};
      const query=(input.q||'').trim().toLowerCase();
      result=!input.offset&&[item.name,item.sku,item.category].some(value=>value.toLowerCase().includes(query))?[item]:[];
      break;
    }
    case 'leads': result=input.offset?[]:[{id:'preview-quote',kind:'quote',name:'Sample customer',email:'customer@example.invalid',body:'I’d like a bulk quote for 50 lengths of conduit.',status:'new',created_at:created}];break;
    case 'access': result=[{id:'preview-driver',email:sampleEmail,role:'driver',active:true,permissions:null}];break;
    case 'website': result={revision:0,draft:{},published:{}};break;
    default: throw Error('This workspace is unavailable in role preview.');
  }
  return result as T;
}
