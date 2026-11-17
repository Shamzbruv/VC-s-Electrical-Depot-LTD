'use client';

import {useCallback,useEffect,useState,type ReactNode} from 'react';
import Link,{useLinkStatus} from 'next/link';
import {useRouter,useSearchParams,useSelectedLayoutSegment} from 'next/navigation';
import {ShieldCheck,Bell,Box,ChevronDown,ChevronsLeft,ChevronsRight,ClipboardList,Eye,Globe2,LayoutDashboard,LogOut,Mail,Menu,Moon,Search,ScrollText,Sun,Truck,Users,Wallet,X} from 'lucide-react';
import Auth,{authFragment,getSession} from '../../components/auth';
import {Brand} from '../../components/ui';
import {auditEvent,canPreviewStaffRoles,ops,roles,staffRoles,type Permission,type Profile,type StaffRole} from '../../lib/ops-client';
import {Enquiries,Products} from './catalogue';
import Team from './team';
import Audit from './audit';
import CommandPalette,{type PaletteItem} from './command-palette';
import {Dispatch,Driver} from './delivery';
import Editor from './editor';
import Finance from './finance';
import Dashboard from './dashboard';
import {PortalContext,useOps} from './portal-context';
import {previewProfile,previewRequest} from './role-preview';
import {Avatar,dateTime,Feedback,useWorkspace} from './workspace';

const sections=[
  {path:'overview',title:'Overview',icon:LayoutDashboard,group:'Workspace'},
  {path:'finance',title:'Accounting',icon:Wallet,scopes:['finance','finance_reports'],group:'Operations'},
  {path:'dispatch',title:'Dispatch',icon:ClipboardList,scopes:['dispatch'],group:'Operations'},
  {path:'driver',title:'Driver workspace',icon:Truck,scopes:['drive'],group:'Operations'},
  {path:'enquiries',title:'Enquiries',icon:Mail,scopes:['leads'],group:'Commerce'},
  {path:'products',title:'Products',icon:Box,scopes:['catalog'],group:'Commerce'},
  {path:'website',title:'Website editor',icon:Globe2,scopes:['website'],group:'Commerce'},
  {path:'team',title:'Team',icon:Users,scopes:['access'],group:'Administration'},
  {path:'audit',title:'Audit trail',icon:ScrollText,scopes:['audit'],group:'Administration'},
] as const;
const pathFor=(path:string)=>path==='overview'?'/admin':'/admin/'+path;
const previewPath=(path:string,role?:StaffRole)=>pathFor(path)+(role?'?preview='+role:'');
const livePortal={request:ops,preview:false};
const samplePortal={request:previewRequest,preview:true};
const taglines:Record<string,string>={
  overview:'See what needs attention across your staff workspaces.',
  finance:'Record income and expenses, reconcile the daily ledger and review financial activity.',
  dispatch:'Queue packages, assign drivers and follow deliveries as they progress.',
  driver:'Accept your packages, share your position in transit and log each handover.',
  enquiries:'Manage general enquiries and bulk quote requests from the public website.',
  products:'Build the private catalogue and choose which products appear on the public site.',
  website:'Edit the public site using a live preview and publish when the draft is ready.',
  team:'Approve staff, set roles and permissions, and review each person’s activity.',
  audit:'A permanent, tamper-resistant record of who did what, and when.',
};
type Notice={id:number;message:string;created_at:string;read_at?:string};

function Notifications({deliveriesLink}:{deliveriesLink?:string}) {
  const {request:ops}=useOps();
  const notices=useWorkspace<Notice[]>('notifications',{},12000);
  const [open,setOpen]=useState(false);
  const [error,setError]=useState('');
  const unread=notices.data?.filter(item=>!item.read_at).length||0;
  return <div className="ops-notifications">
    <button className="ops-icon-btn" onClick={()=>setOpen(!open)} aria-expanded={open} aria-label={unread+' unread notifications'} title="Notifications"><Bell size={18}/>{unread>0&&<b>{unread}</b>}</button>
    {open&&<div className="ops-pop ops-bell-pop"><h2>Notifications</h2><Feedback message={error||notices.error} failed/>
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

function useTheme() {
  const [theme,setTheme]=useState<'light'|'dark'>('light');
  useEffect(()=>{
    try{
      const saved=localStorage.getItem('vc-ops-theme');
      setTheme(saved==='dark'||saved==='light'?saved:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
    }catch{/* storage unavailable: stay on light */}
  },[]);
  const toggle=()=>setTheme(current=>{
    const next=current==='dark'?'light':'dark';
    try{localStorage.setItem('vc-ops-theme',next);}catch{/* ignore */}
    return next;
  });
  return {theme,toggle};
}

function SignIn({error,onLogin,theme,toggle}:{error:string;onLogin:()=>void;theme:'light'|'dark';toggle:()=>void}) {
  return <main className="ops-sign-in" data-theme={theme}>
    <section className="ops-sign-aside" aria-hidden="false">
      <Brand light/>
      <div>
        <h2>The operations desk for <em>VC’s Electrical Depot</em>.</h2>
        <p>Orders, dispatch, accounting and your website, in one secure workspace.</p>
      </div>
      <ul className="ops-sign-points">
        <li><ShieldCheck size={18}/> Role-based access for every team member</li>
        <li><ScrollText size={18}/> Every action recorded in the audit trail</li>
        <li><Truck size={18}/> Built for the office and for drivers on the road</li>
      </ul>
    </section>
    <section className="ops-sign-main">
      <button className="ops-theme" onClick={toggle} aria-label={theme==='dark'?'Switch to light theme':'Switch to dark theme'}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button>
      <Brand/>
      <Feedback message={error} failed/>
      <Auth onLogin={onLogin}/>
      <span className="ops-sign-foot"><ShieldCheck size={14}/> Secured staff access</span>
      <a href="/">← Back to the website</a>
    </section>
  </main>;
}

export default function Admin({children}:{children:ReactNode}) {
  const section=useSelectedLayoutSegment()||'overview';
  const search=useSearchParams();
  const router=useRouter();
  const [profile,setProfile]=useState<Profile>();
  const [checkingSession,setCheckingSession]=useState(true);
  const [error,setError]=useState('');
  const [drawer,setDrawer]=useState(false);
  const [collapsed,setCollapsed]=useState(false);
  const [menu,setMenu]=useState(false);
  const [palette,setPalette]=useState(false);
  const {theme,toggle}=useTheme();

  useEffect(()=>{try{setCollapsed(localStorage.getItem('vc-ops-collapsed')==='1');}catch{/* ignore */}},[]);
  const login=useCallback(()=>{
    setCheckingSession(true);
    setError('');
    void ops<Profile>('read','profile').then(result=>{
      setProfile(result);
      try{
        if(!sessionStorage.getItem('vc-audit-signin')){sessionStorage.setItem('vc-audit-signin','1');void auditEvent('sign_in');}
      }catch{/* ignore */}
    }).catch(e=>{
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
  if(!profile)return <SignIn error={error} onLogin={login} theme={theme} toggle={toggle}/>;

  const canPreview=canPreviewStaffRoles(profile.role);
  const previewRole=canPreview?staffRoles.find(role=>role===search.get('preview')):undefined;
  const displayedProfile=previewRole?previewProfile(previewRole):profile;
  const href=(path:string)=>previewPath(path,previewRole);
  const can=(permission:Permission)=>displayedProfile.permissions?.includes(permission)||false;
  const links=sections.filter(link=>!('scopes'in link)||link.scopes.some(can));
  const current=links.find(link=>link.path===section);
  const groups=[...new Set(links.map(link=>link.group))];
  const person=previewRole?'Sample staff account':displayedProfile.email;
  const signOut=()=>{
    void auditEvent('sign_out').finally(()=>{
      sessionStorage.removeItem('vc-session');sessionStorage.removeItem('vc-audit-signin');setProfile(undefined);
    });
  };
  const items:PaletteItem[]=[
    ...links.map(link=>({id:link.path,title:link.title,group:'Go to',href:href(link.path),icon:link.icon,keywords:taglines[link.path]})),
    {id:'theme',title:theme==='dark'?'Switch to light theme':'Switch to dark theme',group:'Preferences',icon:theme==='dark'?Sun:Moon,run:toggle},
    ...(canPreview&&!previewRole?[{id:'preview',title:'Open role preview',group:'Preferences',icon:Eye,href:previewPath('overview','driver')}]:[]),
    {id:'site',title:'Open the public website',group:'Preferences',icon:Globe2,run:()=>window.open('/','_blank')},
  ];
  return <PortalContext.Provider value={previewRole?samplePortal:livePortal}><div className={'ops-shell'+(collapsed?' collapsed':'')} data-theme={theme}>
    <aside className={'ops-sidebar '+(drawer?'open':'')}>
      <div className="ops-brand-row"><Brand light/>
        <button className="ops-collapse" aria-label={collapsed?'Expand navigation':'Collapse navigation'} onClick={()=>setCollapsed(value=>{try{localStorage.setItem('vc-ops-collapsed',value?'0':'1');}catch{/* ignore */}return !value;})}>{collapsed?<ChevronsRight size={16}/>:<ChevronsLeft size={16}/>}</button></div>
      <nav aria-label="Staff workspaces">{groups.map(group=><div key={group} style={{display:'contents'}}>
        <span className="ops-nav-group">{group}</span>
        {links.filter(link=>link.group===group).map(({path,title,icon:Icon})=><Link key={path} href={href(path)} title={title} onClick={()=>setDrawer(false)} aria-current={path===section?'page':undefined}><Icon size={20}/><span className="ops-nav-label">{title}</span><WorkspacePending/></Link>)}
      </div>)}</nav>
      <a href="/" className="ops-site-link"><span>Public website ↗</span></a>
    </aside>
    <div className="ops-body">
      <header className="ops-header">
        <button className="ops-menu ops-icon-btn" aria-label="Toggle staff navigation" aria-expanded={drawer} onClick={()=>setDrawer(!drawer)}>{drawer?<X size={20}/>:<Menu size={20}/>}</button>
        <button className="ops-search-trigger" onClick={()=>setPalette(true)} aria-label="Search workspaces and actions"><Search size={16}/><span>Search or jump to…</span><kbd>Ctrl K</kbd></button>
        <div className="ops-actions">
          <Notifications key={previewRole||'live'} deliveriesLink={can('dispatch')?href('dispatch'):can('drive')?href('driver'):undefined}/>
          <div className="ops-account-menu">
            <button className="ops-account-btn" aria-haspopup="menu" aria-expanded={menu} onClick={()=>setMenu(!menu)}><Avatar name={person}/><span className="ops-account"><strong>{roles[displayedProfile.role]||displayedProfile.role}</strong><small>{person}</small></span><ChevronDown size={15}/></button>
            {menu&&<div className="ops-pop" role="menu" onClick={()=>setMenu(false)}>
              <div className="ops-pop-head"><Avatar name={person} large/><div className="ops-account"><strong>{roles[displayedProfile.role]||displayedProfile.role}</strong><small>{person}</small></div></div>
              <button role="menuitem" onClick={toggle}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}{theme==='dark'?'Light theme':'Dark theme'}</button>
              {canPreview&&!previewRole&&<Link role="menuitem" href={previewPath('overview','driver')} onClick={()=>void auditEvent('role_preview')}><Eye size={17}/>Role preview</Link>}
              {!previewRole&&<button role="menuitem" className="danger" onClick={signOut}><LogOut size={17}/>Sign out</button>}
            </div>}
          </div>
        </div>
      </header>
      <main className="ops-main">
        {previewRole&&<section className="ops-role-preview" aria-label="Staff role preview">
          <div><strong>Viewing as {roles[previewRole]}</strong><p>Explore this role’s standard workspaces using sample data. Changes cannot be saved here.</p></div>
          <label>Viewing as<select value={previewRole} onChange={e=>router.push(previewPath('overview',e.target.value as StaffRole))}>
            {staffRoles.map(role=><option key={role} value={role}>{roles[role]}</option>)}
          </select></label>
          <Link href="/admin">Exit preview</Link>
        </section>}
        <div className="ops-heading"><div className="ops-heading-text">
          {current&&section!=='overview'&&<nav className="ops-crumbs" aria-label="Breadcrumb"><Link href={href('overview')}>Overview</Link><span aria-hidden>/</span><span>{current.group}</span></nav>}
          <h1>{current?.title||'Workspace unavailable'}</h1><p>{current?taglines[section]:'Your account needs permission to use this workspace.'}</p></div></div>
        {!current&&<Link href={href('overview')}>← Return to the overview</Link>}
        <div className="ops-workspace" key={section+':'+(previewRole||'live')}>
          {current&&section==='overview'&&<Dashboard href={href} permissions={displayedProfile.permissions||[]} email={person} role={roles[displayedProfile.role]||displayedProfile.role}/>}
          {current&&section==='finance'&&<Finance canEnter={can('finance')} canReport={can('finance_reports')} actor={displayedProfile.id}/>}
          {current&&section==='dispatch'&&<Dispatch/>}
          {current&&section==='driver'&&<Driver/>}
          {current&&section==='enquiries'&&<Enquiries/>}
          {current&&section==='products'&&<Products/>}
          {current&&section==='website'&&<Editor/>}
          {current&&section==='team'&&<Team isOwner={displayedProfile.role==='owner'}/>}
          {current&&section==='audit'&&<Audit/>}
          {children}
        </div>
      </main>
    </div>
    <CommandPalette items={items} open={palette} setOpen={setPalette}/>
  </div></PortalContext.Provider>;
}
