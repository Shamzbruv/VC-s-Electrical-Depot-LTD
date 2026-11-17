'use client';

import {useCallback,useEffect,useState,type ReactNode} from 'react';
import {ops} from '../../lib/ops-client';

export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Jamaica',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const dateTime=(value:string)=>new Intl.DateTimeFormat('en-JM',{timeZone:'America/Jamaica',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export const label=(value:string)=>value.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
export const jmd=(cents:number)=>new Intl.NumberFormat('en-JM',{style:'currency',currency:'JMD',currencyDisplay:'code'}).format(cents/100);
export const payload=(form:HTMLFormElement)=>Object.fromEntries(new FormData(form));

export function useWorkspace<T>(area:string,input:object={},interval=0) {
  const serialized=JSON.stringify(input);
  const [data,setData]=useState<T>();
  const [error,setError]=useState('');
  const reload=useCallback(async()=>{
    const result=await ops<T>('read',area,JSON.parse(serialized));
    setData(result);
    setError('');
    return result;
  },[area,serialized]);
  useEffect(()=>{
    let active=true;
    const fetchData=()=>ops<T>('read',area,JSON.parse(serialized)).then(result=>{
      if(active){setData(result);setError('');}
    }).catch(e=>{if(active)setError(e.message);});
    setData(undefined);
    void fetchData();
    const timer=interval?setInterval(fetchData,interval):undefined;
    return ()=>{active=false;clearInterval(timer);};
  },[area,serialized,interval]);
  return {data,error,reload};
}

export function useAction() {
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
