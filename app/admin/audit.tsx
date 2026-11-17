'use client';

import {useMemo,useState} from 'react';
import {Download,RefreshCw,Search} from 'lucide-react';
import {Avatar,Badge,dateTime,Drawer,Empty,Feedback,Skeleton,useWorkspace} from './workspace';

export type AuditRow={id:string;created_at:string;actor:string|null;actor_email:string|null;actor_role:string|null;operation:string;entity:string|null;summary:string|null;outcome:string;details:Record<string,unknown>|null};
export type AuditData={total:number;rows:AuditRow[];operations:string[];people:{id:string;email:string}[]};
const pageSize=50;
const words=(value:string)=>value.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());

export function describe(row:AuditRow) {
  const who=row.actor_email||'System';
  const details=row.details||{};
  if(row.operation==='staff_access_change'){
    const after=(details.after||{}) as {role?:string;active?:boolean|string};
    const before=(details.before||null) as {role?:string;active?:boolean}|null;
    const target=String(details.target_email||'a staff member');
    if(details.action==='access_invite'&&!before)return who+' approved '+target+' as '+words(String(after.role||'staff'));
    if(before&&before.active&&String(after.active)==='false')return who+' disabled access for '+target;
    if(before&&!before.active&&String(after.active)==='true')return who+' re-enabled access for '+target;
    return who+' changed access for '+target+(before?.role!==after.role?' ('+words(String(before?.role||'none'))+' → '+words(String(after.role||'none'))+')':'');
  }
  return who+' · '+(row.summary||words(row.operation)).replace(/^./,c=>c.toLowerCase());
}

function Diff({details}:{details:Record<string,unknown>|null}) {
  if(!details||!Object.keys(details).length)return <p className="ops-muted">No extra details were recorded for this event.</p>;
  const {before,after,...rest}=details as {before?:unknown;after?:unknown};
  return <>
    {(before!==undefined||after!==undefined)&&<div className="ops-fields" style={{gridTemplateColumns:'1fr 1fr'}}>
      <div><h3>Before</h3><pre className="ops-code">{JSON.stringify(before??null,null,2)}</pre></div>
      <div><h3>After</h3><pre className="ops-code">{JSON.stringify(after??null,null,2)}</pre></div>
    </div>}
    {Object.keys(rest).length>0&&<div><h3>Details</h3><pre className="ops-code">{JSON.stringify(rest,null,2)}</pre></div>}
  </>;
}

export function ActivityList({actor,limit=15}:{actor:string;limit?:number}) {
  const input=useMemo(()=>({actor,limit}),[actor,limit]);
  const log=useWorkspace<AuditData>('audit',input);
  if(log.error)return <Feedback message={log.error} failed/>;
  if(!log.data)return <Skeleton rows={4}/>;
  if(!log.data.rows.length)return <Empty title="No recorded activity yet"/>;
  return <ul className="ops-feed">{log.data.rows.map(row=><li key={row.id}><Avatar name={row.actor_email||'system'}/><div><p>{row.summary||words(row.operation)}</p><small>{dateTime(row.created_at)}</small></div></li>)}</ul>;
}

export default function Audit() {
  const [q,setQ]=useState('');
  const [query,setQuery]=useState('');
  const [actor,setActor]=useState('');
  const [operation,setOperation]=useState('');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [offset,setOffset]=useState(0);
  const [open,setOpen]=useState<AuditRow>();
  const input=useMemo(()=>({q:query,actor,operation,from,to,offset,limit:pageSize}),[query,actor,operation,from,to,offset]);
  const log=useWorkspace<AuditData>('audit',input,30000);
  const reset=(fn:()=>void)=>{fn();setOffset(0);};
  const rows=log.data?.rows||[];
  const total=log.data?.total||0;
  function exportCsv(){
    const esc=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';
    const csv=[['Time','Person','Role','Action','Area','Outcome','Details'],...rows.map(r=>[dateTime(r.created_at),r.actor_email,r.actor_role,r.summary||r.operation,r.entity,r.outcome,JSON.stringify(r.details||{})])].map(r=>r.map(esc).join(',')).join('\n');
    const url=URL.createObjectURL(new Blob(['﻿',csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='vc-audit-trail.csv';link.click();URL.revokeObjectURL(url);
  }
  return <>
    <section className="ops-panel">
      <form className="ops-toolbar" onSubmit={e=>{e.preventDefault();reset(()=>setQuery(q.trim()));}} role="search">
        <label className="ops-input" style={{display:'flex',alignItems:'center',gap:8,maxWidth:320}}><Search size={16} aria-hidden/><input aria-label="Search the audit trail" placeholder="Search people, actions, details…" value={q} onChange={e=>setQ(e.target.value)} style={{border:0,outline:0,background:'transparent',color:'inherit',font:'inherit',width:'100%'}}/></label>
        <select className="ops-input" aria-label="Person" value={actor} onChange={e=>reset(()=>setActor(e.target.value))}><option value="">Everyone</option>{log.data?.people.map(p=><option key={p.id} value={p.id}>{p.email}</option>)}</select>
        <select className="ops-input" aria-label="Action" value={operation} onChange={e=>reset(()=>setOperation(e.target.value))}><option value="">All actions</option>{log.data?.operations.map(o=><option key={o} value={o}>{words(o)}</option>)}</select>
        <input className="ops-input" type="date" aria-label="From date" value={from} onChange={e=>reset(()=>setFrom(e.target.value))} style={{width:'auto'}}/>
        <input className="ops-input" type="date" aria-label="To date" value={to} onChange={e=>reset(()=>setTo(e.target.value))} style={{width:'auto'}}/>
        <span className="grow"/>
        <button type="button" onClick={()=>void log.reload().catch(()=>{})}><RefreshCw size={15} aria-hidden/> Refresh</button>
        <button type="button" onClick={exportCsv} disabled={!rows.length}><Download size={15} aria-hidden/> Export page</button>
      </form>
      <Feedback message={log.error} failed/>
      {!log.data&&!log.error&&<Skeleton rows={6}/>}
      {log.data&&rows.length===0&&<Empty title="No matching activity" note="Actions taken in the portal appear here as they happen. Adjust the filters to widen the search."/>}
      {rows.length>0&&<div className="ops-table"><table>
        <thead><tr><th>When</th><th>Person</th><th>Action</th><th>Area</th><th>Outcome</th></tr></thead>
        <tbody>{rows.map(row=><tr key={row.id} className="clickable" tabIndex={0} onClick={()=>setOpen(row)} onKeyDown={e=>{if(e.key==='Enter')setOpen(row);}}>
          <td style={{whiteSpace:'nowrap'}}>{dateTime(row.created_at)}</td>
          <td><div className="ops-person"><Avatar name={row.actor_email||'system'}/><div><strong>{row.actor_email||'System'}</strong><small>{row.actor_role?words(row.actor_role):''}</small></div></div></td>
          <td>{row.summary||words(row.operation)}</td><td>{words(row.entity||'—')}</td><td><Badge value={row.outcome}/></td>
        </tr>)}</tbody></table></div>}
      {total>pageSize&&<div className="ops-actions"><button disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-pageSize))}>Previous</button>
        <span className="ops-muted">{offset+1}–{Math.min(total,offset+pageSize)} of {total}</span>
        <button disabled={offset+pageSize>=total} onClick={()=>setOffset(offset+pageSize)}>Next</button></div>}
      {log.data&&total>0&&total<=pageSize&&<p className="ops-muted">{total} event{total===1?'':'s'} recorded. Audit records are append-only and cannot be edited or deleted.</p>}
    </section>
    {open&&<Drawer title={open.summary||words(open.operation)} subtitle={dateTime(open.created_at)} avatar={open.actor_email||'system'} onClose={()=>setOpen(undefined)}>
      <p style={{margin:0}}>{describe(open)}</p>
      <dl className="ops-kv"><dt>Person</dt><dd>{open.actor_email||'System'}</dd><dt>Role</dt><dd>{open.actor_role?words(open.actor_role):'—'}</dd><dt>Area</dt><dd>{words(open.entity||'—')}</dd><dt>Action code</dt><dd>{open.operation}</dd><dt>Outcome</dt><dd>{words(open.outcome)}</dd><dt>Record</dt><dd>{open.id}</dd></dl>
      <Diff details={open.details}/>
    </Drawer>}
  </>;
}
