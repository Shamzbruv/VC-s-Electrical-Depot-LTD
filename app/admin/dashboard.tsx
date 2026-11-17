'use client';

import Link from 'next/link';
import {useMemo} from 'react';
import {ArrowRight,Box,ClipboardList,Globe2,Mail,ScrollText,Users,Wallet} from 'lucide-react';
import {websitePages} from '../../lib/website';
import type {Permission} from '../../lib/ops-client';
import type {AuditData} from './audit';
import {Avatar,dateTime,Empty,Feedback,jmd,Skeleton,Stat,timeAgo,today,useWorkspace} from './workspace';

export type DashboardData={
  enquiries?:{new_quotes:number;new_inquiries:number;reviewing:number};
  catalogue?:{published:number;private:number};
  website?:{drafts:number;draft_routes:string[];last_published:string|null};
  finance?:{income:number|null;expense:number|null;entries:number;reports:boolean};
  deliveries?:{pending:number;in_transit:number;issues:number;delivered:number;all_drivers:boolean};
  team?:{active:number;pending:number};
};

type Card={
  title:string;icon:typeof Box;note:string;href:string;link:string;
  values:{label:string;value:string|number;tone?:string}[];
};

function cardsFor(data:DashboardData,href:(path:string)=>string):Card[] {
  const cards:Card[]=[];
  const {enquiries,catalogue,website,finance,deliveries,team}=data;
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
  if(finance)cards.push({
    title:'Accounting',icon:Wallet,note:finance.reports?'Posted activity for this month, in JMD.':'Your posted entries for this month.',
    href:href('finance'),link:finance.reports?'Open accounting':'Record activity',values:finance.reports?[
      {label:'Income',value:jmd(finance.income??0),tone:'green'},{label:'Expenses',value:jmd(finance.expense??0),tone:'amber'},
      {label:'Net activity',value:jmd((finance.income??0)-(finance.expense??0))},{label:'Posted entries',value:finance.entries},
    ]:[{label:'Posted entries',value:finance.entries}],
  });
  if(deliveries)cards.push({
    title:deliveries.all_drivers?'Dispatch':'My deliveries',icon:ClipboardList,note:deliveries.all_drivers?'Open work and today’s completions.':'Packages assigned to you.',
    href:href(deliveries.all_drivers?'dispatch':'driver'),link:deliveries.all_drivers?'Open dispatch':'Open driver workspace',
    values:[{label:'Awaiting delivery',value:deliveries.pending,tone:'amber'},{label:'In transit',value:deliveries.in_transit},{label:'Issues',value:deliveries.issues},{label:'Delivered today',value:deliveries.delivered,tone:'green'}],
  });
  if(team)cards.push({
    title:'Team',icon:Users,note:'Accounts across the staff portal.',href:href('team'),link:'Open team',
    values:[{label:'Active staff',value:team.active,tone:'green'},{label:'Awaiting activation',value:team.pending}],
  });
  return cards;
}

type Attention={label:string;count:number;href:string;bad?:boolean};
function attention(data:DashboardData,href:(path:string)=>string):Attention[] {
  const items:Attention[]=[];
  if(data.enquiries?.new_quotes)items.push({label:'New bulk quote requests',count:data.enquiries.new_quotes,href:href('enquiries')});
  if(data.enquiries?.new_inquiries)items.push({label:'New website enquiries',count:data.enquiries.new_inquiries,href:href('enquiries')});
  if(data.deliveries?.issues)items.push({label:'Deliveries reporting an issue',count:data.deliveries.issues,href:href(data.deliveries.all_drivers?'dispatch':'driver'),bad:true});
  if(data.deliveries?.pending)items.push({label:'Deliveries awaiting action',count:data.deliveries.pending,href:href(data.deliveries.all_drivers?'dispatch':'driver')});
  if(data.website?.drafts)items.push({label:'Website pages with unpublished drafts',count:data.website.drafts,href:href('website')});
  if(data.team?.pending)items.push({label:'Staff awaiting activation',count:data.team.pending,href:href('team')});
  return items;
}

function Activity({href}:{href:(path:string)=>string}) {
  const log=useWorkspace<AuditData>('audit',{limit:8},30000);
  return <section className="ops-panel"><h2>Recent activity</h2><p className="ops-muted">The latest actions recorded across the portal.</p>
    {!log.data&&!log.error&&<Skeleton rows={4}/>}
    <Feedback message={log.error} failed/>
    {log.data&&!log.data.rows.length&&<Empty title="Nothing recorded yet"/>}
    {log.data&&log.data.rows.length>0&&<ul className="ops-feed">{log.data.rows.map(row=><li key={row.id}><Avatar name={row.actor_email||'system'}/><div><p><b>{(row.actor_email||'System').split('@')[0]}</b> · {row.summary||row.operation}</p><small>{timeAgo(row.created_at)}</small></div></li>)}</ul>}
    <Link className="ops-link" href={href('audit')}>Open audit trail <ArrowRight size={16}/></Link>
  </section>;
}

type Day={day:string;income:number;expense:number};
function Trend({href}:{href:(path:string)=>string}) {
  const range=useMemo(()=>{const to=today();const d=new Date(to+'T12:00:00');d.setDate(d.getDate()-13);return {from:d.toISOString().slice(0,10),to};},[]);
  const report=useWorkspace<{trend:Day[]}>('finance',range);
  const max=Math.max(1,...(report.data?.trend||[]).flatMap(d=>[d.income,d.expense]));
  return <section className="ops-panel"><h2>Last 14 days</h2><p className="ops-muted">Posted income and expenses, in JMD.</p>
    {!report.data&&!report.error&&<Skeleton rows={3}/>}
    <Feedback message={report.error} failed/>
    {report.data&&!report.data.trend.length&&<Empty title="No posted entries in this period" note="Daily finance entries will chart here."/>}
    {report.data&&report.data.trend.length>0&&<><div className="ops-bars-chart" role="img" aria-label="Income and expenses over the last 14 days">
      {report.data.trend.map(d=><div key={d.day} title={d.day+' · income '+jmd(d.income)+' · expenses '+jmd(d.expense)}><i style={{height:Math.max(2,d.income/max*100)+'%'}}/><i className="x" style={{height:Math.max(2,d.expense/max*100)+'%'}}/></div>)}
    </div><div className="ops-legend"><span>Income</span><span className="x">Expenses</span></div></>}
    <Link className="ops-link" href={href('finance')} style={{marginTop:12}}>Open accounting <ArrowRight size={16}/></Link>
  </section>;
}

export default function Dashboard({href,permissions,email,role}:{href:(path:string)=>string;permissions:Permission[];email:string;role:string}) {
  const {data,error,reload}=useWorkspace<DashboardData>('dashboard',{permissions},20000);
  if(error)return <section className="ops-panel"><Feedback message={error} failed/><div className="ops-actions"><button onClick={()=>void reload().catch(()=>{})}>Retry overview</button></div></section>;
  if(!data)return <div className="ops-dashboard" role="status" aria-label="Loading overview"><div className="ops-skeleton" style={{height:110,borderRadius:18}}/><div className="ops-dashboard-grid"><div className="ops-skeleton" style={{height:220,borderRadius:18}}/><div className="ops-skeleton" style={{height:220,borderRadius:18}}/></div></div>;
  const cards=cardsFor(data,href);
  if(!cards.length)return <section className="ops-panel"><h2>Your access is limited</h2><p className="ops-muted">Ask the owner or an administrator to assign the staff workspaces you need.</p></section>;
  const draftRoutes=(data.website?.draft_routes||[]).filter(route=>websitePages.some(([path])=>path===route));
  const todo=attention(data,href);
  const hour=Number(new Intl.DateTimeFormat('en-JM',{timeZone:'America/Jamaica',hour:'numeric',hour12:false}).format(new Date()));
  const greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
  const canAudit=permissions.includes('audit');
  return <div className="ops-dashboard">
    <section className="ops-hero"><div><h2>{greeting}, {role}.</h2><p>{todo.length?'You have '+todo.reduce((n,i)=>n+i.count,0)+' item'+(todo.reduce((n,i)=>n+i.count,0)===1?'':'s')+' that need attention.':'Everything is up to date. Nothing needs attention right now.'}</p></div>
      <div className="ops-hero-actions">{cards.slice(0,3).map(card=><Link key={card.title} href={card.href}>{card.link}<ArrowRight size={15}/></Link>)}</div></section>
    {todo.length>0&&<section className="ops-panel"><h2>Needs attention</h2><div className="ops-attention">{todo.map(item=><Link key={item.label} href={item.href}><i className={item.bad?'bad':''}/>{item.label}<b>{item.count}</b></Link>)}</div></section>}
    <div className="ops-dashboard-grid">
      {cards.map(({title,icon:Icon,note,href,link,values})=><section className="ops-panel ops-dashboard-card" key={title}>
        <div className="ops-dashboard-heading"><span className="ops-dashboard-icon"><Icon size={20}/></span><div><h2>{title}</h2><p className="ops-muted">{note}</p></div></div>
        <div className="ops-stats">{values.map(value=><Stat key={value.label} {...value}/>)}</div>
        <Link className="ops-link" href={href}>{link} <ArrowRight size={16}/></Link>
      </section>)}
    </div>
    {(data.finance?.reports||canAudit)&&<div className="ops-two">{data.finance?.reports?<Trend href={href}/>:<span/>}{canAudit?<Activity href={href}/>:<span/>}</div>}
    {draftRoutes.length>0&&<section className="ops-panel"><h2>Saved website drafts</h2><div className="ops-actions">
      {draftRoutes.map(route=><Link key={route} href={href('website')+(href('website').includes('?')?'&':'?')+'page='+encodeURIComponent(route)}>{websitePages.find(([path])=>path===route)?.[1]} →</Link>)}
    </div></section>}
  </div>;
}
