'use client';

import {useCallback,useEffect,useState,type ReactNode} from 'react';
import {useOps} from './portal-context';

export function today() {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Jamaica',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  return ['year','month','day'].map(type=>parts.find(part=>part.type===type)?.value).join('-');
}
export const dateTime=(value:string)=>new Intl.DateTimeFormat('en-JM',{timeZone:'America/Jamaica',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export const label=(value:string)=>value.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
export const jmd=(cents:number)=>new Intl.NumberFormat('en-JM',{style:'currency',currency:'JMD',currencyDisplay:'code'}).format(cents/100);
export const payload=(form:HTMLFormElement)=>Object.fromEntries(new FormData(form));

export function useWorkspace<T>(area:string,input:object={},interval=0) {
  const {request:ops,preview}=useOps();
  const serialized=JSON.stringify(input);
  const [data,setData]=useState<T>();
  const [error,setError]=useState('');
  const reload=useCallback(async()=>{
    const result=await ops<T>('read',area,JSON.parse(serialized));
    setData(result);
    setError('');
    return result;
  },[area,serialized,ops]);
  useEffect(()=>{
    let active=true;
    const fetchData=()=>ops<T>('read',area,JSON.parse(serialized)).then(result=>{
      if(active){setData(result);setError('');}
    }).catch(e=>{if(active)setError(e.message);});
    setData(undefined);
    void fetchData();
    const timer=interval&&!preview?setInterval(fetchData,interval):undefined;
    return ()=>{active=false;clearInterval(timer);};
  },[area,serialized,interval,ops,preview]);
  return {data,error,reload};
}

export function useAction() {
  const {request:ops}=useOps();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [failed,setFailed]=useState(false);
  async function run(action:string,input:object,complete:()=>unknown,success='Saved.') {
    setBusy(true);setMessage('');setFailed(false);
    try {
      await ops('write',action,input);
      await complete();
      setMessage(success);
      return true;
    } catch(e) {
      setFailed(true);
      setMessage(e instanceof Error?e.message:'Unable to save.');
      return false;
    } finally {setBusy(false);}
  }
  return {busy,message,failed,run};
}
export function Feedback({message,failed=false}:{message?:string;failed?:boolean}) {
  return message?<p className={'ops-feedback'+(failed?' bad':'')} role={failed?'alert':'status'}>{message}</p>:null;
}
export function Panel({title,note,children}:{title:string;note?:string;children:ReactNode}) {
  return <section className="ops-panel"><h2>{title}</h2>{note&&<p className="ops-muted">{note}</p>}{children}</section>;
}
export function Field({title,children}:{title:string;children:ReactNode}) {
  return <label className="ops-field"><span>{title}</span>{children}</label>;
}
export function Stat({label,value,tone=''}:{label:string;value:ReactNode;tone?:string}) {
  return <div className={'ops-stat '+tone}><span>{label}</span><strong>{value}</strong></div>;
}
export function Badge({value}:{value:string}) {
  return <span className={'ops-badge state-'+value}>{label(value)}</span>;
}
export function Pager({offset,setOffset,length}:{offset:number;setOffset:(offset:number)=>void;length:number}) {
  return (offset>0||length>=200)?<div className="ops-actions"><button disabled={!offset} onClick={()=>setOffset(offset-200)}>Previous</button><span>Page {offset/200+1}</span><button disabled={length<200} onClick={()=>setOffset(offset+200)}>Next</button></div>:null;
}

export function initials(value:string) {
  const parts=value.split('@')[0].split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0]||'?')+(parts[1]?.[0]||'')).toUpperCase();
}
export function Avatar({name,large=false}:{name:string;large?:boolean}) {
  return <span className={'ops-avatar'+(large?' lg':'')} aria-hidden="true">{initials(name)}</span>;
}
export function Skeleton({rows=4}:{rows?:number}) {
  return <div role="status" aria-label="Loading">{Array.from({length:rows},(_,i)=><div key={i} className="ops-skeleton" style={{width:(92-i*9)+'%'}}/>)}</div>;
}
export function Empty({title,note}:{title:string;note?:string}) {
  return <div className="ops-empty"><strong>{title}</strong>{note&&<p className="ops-muted" style={{margin:'6px 0 0'}}>{note}</p>}</div>;
}
export function timeAgo(value?:string|null) {
  if(!value)return 'Never';
  const seconds=Math.max(0,(Date.now()-new Date(value).getTime())/1000);
  if(seconds<60)return 'Just now';
  if(seconds<3600)return Math.floor(seconds/60)+' min ago';
  if(seconds<86400)return Math.floor(seconds/3600)+' hr ago';
  if(seconds<86400*14)return Math.floor(seconds/86400)+' days ago';
  return dateTime(value);
}
export function Drawer({title,subtitle,onClose,children,avatar}:{title:string;subtitle?:string;onClose:()=>void;children:ReactNode;avatar?:string}) {
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};
    document.addEventListener('keydown',key);
    return ()=>document.removeEventListener('keydown',key);
  },[onClose]);
  return <><div className="ops-scrim" onClick={onClose}/>
    <aside className="ops-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="ops-drawer-head">{avatar&&<Avatar name={avatar} large/>}<div style={{minWidth:0}}><h2>{title}</h2>{subtitle&&<small className="ops-muted">{subtitle}</small>}</div>
        <button className="x ops-icon-btn" onClick={onClose} aria-label="Close panel">✕</button></div>
      <div className="ops-drawer-body">{children}</div>
    </aside></>;
}
