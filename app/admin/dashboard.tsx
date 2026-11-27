'use client';

import Link from 'next/link';
import {ArrowRight,Box,ClipboardList,Globe2,Mail,ShieldCheck,Workflow,BarChart3} from 'lucide-react';
import {websitePages} from '../../lib/website';
import type {Permission} from '../../lib/ops-client';
import {dateTime,Feedback,Stat,useWorkspace} from './workspace';

export type DashboardData={
  enquiries?:{new_quotes:number;new_inquiries:number;reviewing:number};
  catalogue?:{published:number;private:number};
  website?:{drafts:number;draft_routes:string[];last_published:string|null};
  attention?:{overdue:number|null;email_failed:number|null;stale_requests:number|null};
  deliveries?:{pending:number;in_transit:number;issues:number;delivered:number;all_drivers:boolean};
  team?:{active:number;pending:number};
};

type Card={
  title:string;icon:typeof Box;note:string;href:string;link:string;
  values:{label:string;value:string|number;tone?:string}[];
};

function cardsFor(data:DashboardData,href:(path:string)=>string):Card[] {
  const cards:Card[]=[];
  const {enquiries,catalogue,website,deliveries,team}=data;
  if(enquiries)cards.push({
    title:'Enquiries',icon:Mail,note:'Requests from your public website.',href:href('enquiries'),link:'Open enquiries',
    values:[{label:'New bulk quotes',value:enquiries.new_quotes,tone:'amber'},{label:'New enquiries',value:enquiries.new_inquiries},{label:'In review',value:enquiries.reviewing}],
  });
  if(catalogue)cards.push({
    title:'Product catalogue',icon:Box,note:'Visibility for your real product listings.',href:href('products'),link:'Manage products',
    values:[{label:'Public',value:catalogue.published,tone:'green'},{label:'Private',value:catalogue.private}],
  });
  if(website)cards.push({
    title:'Website publishing',icon:Globe2,note:website.last_published?'Last published '+dateTime(website.last_published):'No page changes published through the editor yet.',
    href:href('website'),link:'Open website editor',values:[{label:'Pages with saved drafts',value:website.drafts,tone:website.drafts?'amber':''}],
  });
  if(deliveries)cards.push({
    title:'Deliveries',icon:ClipboardList,note:'Open work and today’s completions.',
    href:href('dispatch'),link:'Open deliveries',
    values:[{label:'Awaiting delivery',value:deliveries.pending,tone:'amber'},{label:'In transit',value:deliveries.in_transit},{label:'Issues',value:deliveries.issues},{label:'Delivered today',value:deliveries.delivered,tone:'green'}],
  });
  if(deliveries)cards.push({
    title:'Customer updates',icon:Workflow,note:'Branded departure and arrival emails, triggered by the supervisor.',
    href:href('automations'),link:'Open Automations',
    values:[{label:'Email updates needing review',value:data.attention?.email_failed??'—',tone:'amber'}],
  });
  if(team)cards.push({
    title:'Staff access',icon:ShieldCheck,note:'Accounts across the staff portal.',href:href('access'),link:'Manage staff permissions',
    values:[{label:'Active staff',value:team.active,tone:'green'},{label:'Awaiting activation',value:team.pending}],
  });
  return cards;
}

export default function Dashboard({href,permissions}:{href:(path:string)=>string;permissions:Permission[]}) {
  const {data,error,reload}=useWorkspace<DashboardData>('dashboard',{permissions},20000);
  if(error)return <section className="ops-panel"><Feedback message={error} failed/><div className="ops-actions"><button onClick={()=>void reload().catch(()=>{})}>Retry overview</button></div></section>;
  if(!data)return <p className="ops-dashboard-loading" role="status">Loading overview…</p>;
  const cards=cardsFor(data,href);
  if(permissions.includes('reports')||permissions.includes('dispatch'))cards.push({
    title:'Operations reports',icon:BarChart3,note:'Review delivery activity and export a manifest with existing order references.',
    href:href('reports'),link:'View operations reports',values:[],
  });
  if(!cards.length)return <section className="ops-panel"><h2>Your access is limited</h2><p className="ops-muted">Ask the owner to assign the staff workspaces you need.</p></section>;
  const draftRoutes=(data.website?.draft_routes||[]).filter(route=>websitePages.some(([path])=>path===route));
  return <div className="ops-dashboard">
    {data.attention&&Object.values(data.attention).some(value=>value!==null)&&<section className="ops-panel"><h2>Needs attention</h2><div className="ops-stats">
      <Stat label="Overdue deliveries" value={data.attention.overdue??'—'} tone="amber"/>
      <Stat label="Email updates to review" value={data.attention.email_failed??'—'} tone="amber"/>
      <Stat label="Unanswered for 48 hours" value={data.attention.stale_requests??'—'} tone="amber"/>
    </div></section>}
    <div className="ops-dashboard-grid">
      {cards.map(({title,icon:Icon,note,href,link,values})=><section className="ops-panel ops-dashboard-card" key={title}>
        <div className="ops-dashboard-heading"><span className="ops-dashboard-icon"><Icon size={20}/></span><div><h2>{title}</h2><p className="ops-muted">{note}</p></div></div>
        <div className="ops-stats">{values.map(value=><Stat key={value.label} {...value}/>)}</div>
        <Link className="ops-link" href={href}>{link} <ArrowRight size={16}/></Link>
      </section>)}
    </div>
    {draftRoutes.length>0&&<section className="ops-panel"><h2>Saved website drafts</h2><div className="ops-actions">
      {draftRoutes.map(route=><Link key={route} href={href('website')+(href('website').includes('?')?'&':'?')+'page='+encodeURIComponent(route)}>{websitePages.find(([path])=>path===route)?.[1]} →</Link>)}
    </div></section>}
  </div>;
}
