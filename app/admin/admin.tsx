'use client';

import {useCallback,useEffect,useState} from 'react';
import {Bell,Box,ClipboardList,Globe2,LayoutDashboard,LogOut,Mail,Menu,ShieldCheck,Truck,Wallet,X} from 'lucide-react';
import Auth,{authFragment,getSession} from '../../components/auth';
import {Brand} from '../../components/ui';
import {ops,roles,type Permission,type Profile} from '../../lib/ops-client';
import {Enquiries,Products,StaffAccess} from './catalogue';
import {Dispatch,Driver} from './delivery';
import Editor from './editor';
import Finance from './finance';
import {dateTime,Feedback,Panel,Stat,useWorkspace} from './workspace';

const sections=[
  {path:'overview',title:'Overview',icon:LayoutDashboard},
  {path:'finance',title:'Accounting',icon:Wallet,scopes:['finance','finance_reports']},
  {path:'dispatch',title:'Dispatch',icon:ClipboardList,scopes:['dispatch']},
  {path:'driver',title:'Driver workspace',icon:Truck,scopes:['drive']},
  {path:'enquiries',title:'Enquiries',icon:Mail,scopes:['leads']},
  {path:'products',title:'Products',icon:Box,scopes:['catalog']},
  {path:'website',title:'Website editor',icon:Globe2,scopes:['website']},
  {path:'access',title:'Staff permissions',icon:ShieldCheck,scopes:['access']},
] as const;
const pathFor=(path:string)=>path==='overview'?'/admin':'/admin/'+path;
const taglines:Record<string,string>={
  overview:'See where deliveries stand and open the tools assigned to you.',
  finance:'Record income and expenses, reconcile the daily ledger and review financial activity.',
  dispatch:'Queue packages, assign drivers and follow deliveries as they progress.',
  driver:'Accept your packages, share your position in transit and log each handover.',
  enquiries:'Manage general enquiries and bulk quote requests from the public website.',
  products:'Build the private catalogue and choose which products appear on the public site.',
  website:'Edit the public site using a live preview and publish when the draft is ready.',
  access:'Set up staff accounts and choose what each person can access.',
};
type Notice={id:number;message:string;created_at:string;read_at?:string};

function DeliveryOverview() {
  const {data,error}=useWorkspace<Record<string,number>>('overview',{},15000);
  return <Panel title="Delivery overview" note="Counts cover every package in dispatch."><Feedback message={error} failed/>
    <div className="ops-stats"><Stat label="Awaiting delivery" value={data?.pending??'…'} tone="amber"/><Stat label="In transit" value={data?.in_transit??'…'}/><Stat label="Delivered" value={data?.delivered??'…'} tone="green"/><Stat label="Cancelled" value={data?.cancelled??'…'}/></div>
    <a className="ops-link" href="/admin/dispatch">Open dispatch queue →</a>
  </Panel>;
}
function Notifications({dispatch,drive}:{dispatch:boolean;drive:boolean}) {
  const notices=useWorkspace<Notice[]>('notifications',{},12000);
  const [open,setOpen]=useState(false);
  const [error,setError]=useState('');
  const unread=notices.data?.filter(item=>!item.read_at).length||0;
  return <div className="ops-notifications">
    <button onClick={()=>setOpen(!open)} aria-expanded={open} aria-label={unread+' unread notifications'}><Bell size={18}/><span>Notifications</span>{unread>0&&<b>{unread}</b>}</button>
    {open&&<div className="ops-bell-pop"><h2>Notifications</h2><Feedback message={error||notices.error} failed/>
      {unread>0&&<button onClick={async()=>{
        try{await ops('write','notifications_read',{through:notices.data?.[0]?.id});await notices.reload();setError('');}
        catch(e){setError(e instanceof Error?e.message:'Unable to mark notifications read.');}
      }}>Mark all read</button>}
      {notices.data?.map(item=><div key={item.id} className={item.read_at?'':'unread'}><b>{item.message}</b><small>{dateTime(item.created_at)}</small></div>)}
      {notices.data?.length===0&&<p>You’re all caught up.</p>}
      {!notices.data&&!notices.error&&<p>Loading notifications…</p>}
      {(dispatch||drive)&&<p><a href={dispatch?'/admin/dispatch':'/admin/driver'}>Open deliveries →</a></p>}
    </div>}
  </div>;
}

export default function Admin({section='overview'}:{section?:string}) {
  const [profile,setProfile]=useState<Profile>();
  const [initialized,setInitialized]=useState(false);
  const [error,setError]=useState('');
  const [drawer,setDrawer]=useState(false);
  const login=useCallback(()=>{
    setError('');
    void ops<Profile>('read','profile').then(setProfile).catch(e=>{sessionStorage.removeItem('vc-session');setError(e.message);});
  },[]);
  useEffect(()=>{
    if(!authFragment().has('access_token')&&!authFragment().has('token_hash')&&getSession())login();
    setInitialized(true);
  },[login]);
  if(!initialized)return <main className="ops-sign-in"><p>Opening staff portal…</p></main>;
  if(!profile)return <main className="ops-sign-in"><Brand/><Feedback message={error} failed/><Auth onLogin={login}/><a href="/">← Back to the website</a></main>;

  const can=(permission:Permission)=>profile.permissions?.includes(permission)||false;
  const links=sections.filter(link=>!('scopes'in link)||link.scopes.some(can));
  const current=links.find(link=>link.path===section);
  return <div className="ops-shell">
    <aside className={'ops-sidebar '+(drawer?'open':'')}>
      <Brand light/><nav aria-label="Staff workspaces">{links.map(({path,title,icon:Icon})=><a key={path} href={pathFor(path)} aria-current={path===section?'page':undefined}><Icon size={20}/>{title}</a>)}</nav>
      <a href="/" className="ops-site-link">Public website ↗</a>
    </aside>
    <div className="ops-body">
      <header className="ops-header">
        <button className="ops-menu" aria-label="Toggle staff navigation" aria-expanded={drawer} onClick={()=>setDrawer(!drawer)}>{drawer?<X size={20}/>:<Menu size={20}/>}</button>
        <div className="ops-account"><strong>{roles[profile.role]||profile.role}</strong><small>{profile.email}</small></div>
        <div className="ops-actions"><Notifications dispatch={can('dispatch')} drive={can('drive')}/><button aria-label="Sign out" onClick={()=>{sessionStorage.removeItem('vc-session');setProfile(undefined);}}><LogOut size={18}/><span>Sign out</span></button></div>
      </header>
      <main className="ops-main">
        <div className="ops-heading"><h1>{current?.title||'Workspace unavailable'}</h1><p>{current?taglines[section]:'Your account needs permission to use this workspace.'}</p></div>
        {!current&&<a href="/admin">← Return to the overview</a>}
        {current&&section==='overview'&&<>
          {can('dispatch')&&<DeliveryOverview/>}
          <div className="ops-shortcuts">{links.filter(link=>link.path!=='overview').map(({path,title,icon:Icon})=><a key={path} href={pathFor(path)}><Icon size={23}/><strong>{title}</strong><span>{taglines[path]}</span></a>)}</div>
          {links.length===1&&<Panel title="Your access is limited"><p>Ask the owner to assign the staff workspaces you need.</p></Panel>}
        </>}
        {current&&section==='finance'&&<Finance canEnter={can('finance')} canReport={can('finance_reports')} actor={profile.id}/>}
        {current&&section==='dispatch'&&<Dispatch/>}
        {current&&section==='driver'&&<Driver/>}
        {current&&section==='enquiries'&&<Enquiries/>}
        {current&&section==='products'&&<Products/>}
        {current&&section==='website'&&<Editor/>}
        {current&&section==='access'&&<StaffAccess/>}
      </main>
    </div>
  </div>;
}
