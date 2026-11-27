import {defaultPermissions,type StaffRole,type Profile,type Permission} from '../../lib/ops-client';
import {today} from './workspace';
import {deliveryEmail} from '../../supabase/functions/_shared/delivery-email';
import type {DashboardData} from './dashboard';

export function previewProfile(role:StaffRole):Profile {
  return {id:'preview-staff',email:'Sample staff account',role,permissions:defaultPermissions[role]};
}
export async function previewRequest<T>(action:'read'|'write',area:string,input:{q?:string;status?:string;offset?:number;from?:string;to?:string;permissions?:Permission[];phase?:string}={}):Promise<T> {
  if(action==='write')throw Error('Role preview uses sample data. Exit preview to make changes.');
  const day=today(),created=day+'T09:00:00-05:00';
  const parcel={
    id:'preview-package',number:101,recipient:'Sample customer',phone:'000-000-0000',address:'Kingston, Jamaica',
    description:'Electrical supplies delivery',delivery_date:day,notes:'Meet the recipient at the main entrance.',
    status:'pending',customer_email:'customer@example.invalid',order_reference:'EXAMPLE-101',
    order_items:[{name:'LED bulbs',quantity:12,unit:'each',loaded:true}],vehicle:'Truck 1',delivery_window:'9:00 AM–12:00 PM',
    timeline:[{id:1,event:'order_saved',created_at:created}],emails:[],
  };
  let result:unknown;
  switch(area){
    case 'dashboard': {
      const permits=(permission:Permission)=>input.permissions?.includes(permission)||false;
      const dashboard:DashboardData={};
      if(permits('leads'))dashboard.enquiries={new_quotes:1,new_inquiries:2,reviewing:1};
      if(permits('catalog'))dashboard.catalogue={published:4,private:2};
      if(permits('website'))dashboard.website={drafts:1,draft_routes:['/'],last_published:null};
      if(permits('dispatch'))dashboard.deliveries={pending:1,in_transit:0,issues:0,delivered:2,all_drivers:true};
      if(permits('access'))dashboard.team={active:3,pending:1};
      dashboard.attention={overdue:0,email_failed:0,stale_requests:0};
      result=dashboard;break;
    }
    case 'delivery_setup':result={database:true,email:true,sender:'Sample sender',scheduled:true};break;
    case 'shipments':result=input.offset?[]:[parcel];break;
    case 'automations':result={queued:0,failed:0,sent:0,jobs:[]};break;
    case 'delivery_email_preview':result=deliveryEmail({number:101,reference:'EXAMPLE-101',recipient:parcel.recipient,email:parcel.customer_email,address:parcel.address,date:day,window:parcel.delivery_window,items:parcel.order_items,phase:input.phase==='arrived'?'arrived':'out_for_delivery',received_by:'Sample recipient'},location.origin);break;
    case 'operations_report':result={created:1,delivered:0,open:1,issues:0,overdue:0,rows:[{...parcel,order_reference:'EXAMPLE-101',started_at:null,finished_at:null,received_by:null}]};break;
    case 'notifications':result=[{id:1,message:'Delivery prepared · VC-101',created_at:created}];break;
    case 'picking_products':
    case 'catalog': {
      const item={id:'preview-product',name:'PVC conduit',sku:'DEMO-100',slug:'demo-conduit',category:'Conduits & Fittings',description:'Example product listing.',image:'/products/conduit.svg',unit:'each',status:'draft',sample:false};
      const query=(input.q||'').trim().toLowerCase();
      result=!input.offset&&[item.name,item.sku,item.category].some(value=>value.toLowerCase().includes(query))?[item]:[];break;
    }
    case 'leads':result=input.offset?[]:[{id:'preview-quote',kind:'quote',name:'Sample customer',email:'customer@example.invalid',body:'I’d like a bulk quote for 50 lengths of conduit.',status:'new',created_at:created}];break;
    case 'access':result=[{id:'preview-admin',email:'supervisor@example.invalid',role:'admin',active:true,permissions:['dispatch']}];break;
    case 'website':result={revision:0,draft:{},published:{}};break;
    default:throw Error('This workspace is unavailable in role preview.');
  }
  return result as T;
}
