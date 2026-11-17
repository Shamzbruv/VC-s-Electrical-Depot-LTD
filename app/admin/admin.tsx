'use client';

import {useCallback,useEffect,useState,type ReactNode} from 'react';
import Link,{useLinkStatus} from 'next/link';
import {useRouter,useSearchParams,useSelectedLayoutSegment} from 'next/navigation';
import {Bell,Box,ClipboardList,Eye,Globe2,LayoutDashboard,LogOut,Mail,Menu,ShieldCheck,Truck,Wallet,X} from 'lucide-react';
import Auth,{authFragment,getSession} from '../../components/auth';
import {Brand} from '../../components/ui';
import {canPreviewStaffRoles,ops,roles,staffRoles,type Permission,type Profile,type StaffRole} from '../../lib/ops-client';
import {Enquiries,Products,StaffAccess} from './catalogue';
import {Dispatch,Driver} from './delivery';
import Editor from './editor';
import Finance from './finance';
import {PortalContext,useOps} from './portal-context';
import {previewProfile,previewRequest} from './role-preview';
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
const previewPath=(path:string,role?:StaffRole)=>pathFor(path)+(role?'?preview='+role:'');
const livePortal={request:ops,preview:false};
const samplePortal={request:previewRequest,preview:true};
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

function DeliveryOverview({link}:{link:string}) {
  const {data,error}=useWorkspace<Record<string,number>>('overview',{},15000);
  return <Panel title="Delivery overview" note="Counts cover every package in dispatch."><Feedback message={error} failed/>
    <div className="ops-stats"><Stat label="Awaiting delivery" value={data?.pending??'…'} tone="amber"/><Stat label="In transit" value={data?.in_transit??'…'}/><Stat label="Delivered" value={data?.delivered??'…'} tone="green"/><Stat label="Cancelled" value={data?.cancelled??'…'}/></div>
    <Link className="ops-link" href={link}>Open dispatch queue →</Link>
  </Panel>;
}
function Notifications({deliveriesLink}:{deliveriesLink?:string}) {
  const {request:ops}=useOps();
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
      {deliveriesLink&&<p><Link href={deliveriesLink} onClick={()=>setOpen(false)}>Open deliveries →</Link></p>}
    </div>}
  </div>;
}

function WorkspacePending() {
  const {pending}=useLinkStatus();
  return pending?<span className="ops-nav-pending" role="status" aria-label="Loading workspace"/>:null;
}

export function StaffPortalLoading() {
  return <div className="ops-shell ops-opening" role="status">
    <div className="ops-sidebar" aria-hidden="true"/>
    <main className="ops-main"><p>Opening staff portal…</p></main>
  </div>;
}

export default function Admin({children}:{children:ReactNode}) {
  const section=useSelectedLayoutSegment()||'overview';
  const search=useSearchParams();
  const router=useRouter();
  const [profile,setProfile]=useState<Profile>();
  const [checkingSession,setCheckingSession]=useState(true);
  const [error,setError]=useState('');
  const [drawer,setDrawer]=useState(false);

  const login=useCallback(()=>{
    setCheckingSession(true);
    setError('');
    void ops<Profile>('read','profile').then(setProfile).catch(e=>{
      sessionStorage.removeItem('vc-session');
      setError(e.message);
    }).finally(()=>setCheckingSession(false));
  },[]);
  useEffect(()=>{
    const fragment=authFragment();
    if(!fragment.has('access_token')&&!fragment.has('token_hash')&&getSession()?.access_token)login();
    else setCheckingSession(false);
  },[login]);
  if(checkingSession)return <StaffPortalLoading/>;
  if(!profile)return <main className="ops-sign-in"><Brand/><Feedback message={error} failed/><Auth onLogin={login}/><a href="/">← Back to the website</a></main>;

  const canPreview=canPreviewStaffRoles(profile.role);
  const previewRole=canPreview?staffRoles.find(role=>role===search.get('preview')):undefined;
  const displayedProfile=previewRole?previewProfile(previewRole):profile;
  const href=(path:string)=>previewPath(path,previewRole);
  const can=(permission:Permission)=>displayedProfile.permissions?.includes(permission)||false;
  const links=sections.filter(link=>!('scopes'in link)||link.scopes.some(can));
  const current=links.find(link=>link.path===section);
  return <PortalContext.Provider value={previewRole?samplePortal:livePortal}><div className="ops-shell">
    <aside className={'ops-sidebar '+(drawer?'open':'')}>
      <Brand light/><nav aria-label="Staff workspaces">{links.map(({path,title,icon:Icon})=><Link key={path} href={href(path)} onClick={()=>setDrawer(false)} aria-current={path===section?'page':undefined}><Icon size={20}/>{title}<WorkspacePending/></Link>)}</nav>
      <a href="/" className="ops-site-link">Public website ↗</a>
    </aside>
    <div className="ops-body">
      <header className="ops-header">
        <button className="ops-menu" aria-label="Toggle staff navigation" aria-expanded={drawer} onClick={()=>setDrawer(!drawer)}>{drawer?<X size={20}/>:<Menu size={20}/>}</button>
        <div className="ops-account"><strong>{roles[displayedProfile.role]||displayedProfile.role}</strong><small>{displayedProfile.email}</small></div>
        <div className="ops-actions">
          {canPreview&&!previewRole&&<Link className="ops-preview-link" href={previewPath('overview','driver')} aria-label="Role preview" title="Role preview"><Eye size={18}/><span>Role preview</span></Link>}
          <Notifications key={previewRole||'live'} deliveriesLink={can('dispatch')?href('dispatch'):can('drive')?href('driver'):undefined}/>
          {!previewRole&&<button aria-label="Sign out" onClick={()=>{sessionStorage.removeItem('vc-session');setProfile(undefined);}}><LogOut size={18}/><span>Sign out</span></button>}
        </div>
      </header>
      <main className="ops-main">
        {previewRole&&<section className="ops-role-preview" aria-label="Staff role preview">
          <div><strong>Role preview</strong><p>Explore the role’s standard workspaces using sample data. Changes cannot be saved here.</p></div>
          <label>Viewing as<select value={previewRole} onChange={e=>router.push(previewPath('overview',e.target.value as StaffRole))}>
            {staffRoles.map(role=><option key={role} value={role}>{roles[role]}</option>)}
          </select></label>
          <Link href="/admin">Exit preview</Link>
        </section>}
        <div className="ops-heading"><h1>{current?.title||'Workspace unavailable'}</h1><p>{current?taglines[section]:'Your account needs permission to use this workspace.'}</p></div>
        {!current&&<Link href={href('overview')}>← Return to the overview</Link>}
        <div className="ops-workspace" key={section+':'+(previewRole||'live')}>
          {current&&section==='overview'&&<>
            {can('dispatch')&&<DeliveryOverview link={href('dispatch')}/>}
            <div className="ops-shortcuts">{links.filter(link=>link.path!=='overview').map(({path,title,icon:Icon})=><Link key={path} href={href(path)}><Icon size={23}/><strong>{title}</strong><span>{taglines[path]}</span></Link>)}</div>
            {links.length===1&&<Panel title="Your access is limited"><p>Ask the owner to assign the staff workspaces you need.</p></Panel>}
          </>}
          {current&&section==='finance'&&<Finance canEnter={can('finance')} canReport={can('finance_reports')} actor={displayedProfile.id}/>}
          {current&&section==='dispatch'&&<Dispatch/>}
          {current&&section==='driver'&&<Driver/>}
          {current&&section==='enquiries'&&<Enquiries/>}
          {current&&section==='products'&&<Products/>}
          {current&&section==='website'&&<Editor/>}
          {current&&section==='access'&&<StaffAccess/>}
          {children}
        </div>
      </main>
    </div>
  </div></PortalContext.Provider>;
}
