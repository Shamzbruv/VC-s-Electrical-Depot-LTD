'use client';

import {useMemo,useState} from 'react';
import {Plus,Search,ShieldCheck} from 'lucide-react';
import {permissionLabels,roles,type Permission} from '../../lib/ops-client';
import {defaultPermissions} from '../../lib/ops-client';
import {AccountForm} from './catalogue';
import {ActivityList} from './audit';
import {useOps} from './portal-context';
import {Avatar,Badge,dateTime,Drawer,Empty,Feedback,Field,payload,Skeleton,timeAgo,useAction,useWorkspace} from './workspace';

export type Member={id:string|null;email:string;role:string|null;active:boolean|null;permissions:Permission[]|null;pending:boolean;last_sign_in_at:string|null;created_at:string|null;display_name:string|null;job_title:string|null;phone:string|null;actions_30d:number};
const state=(m:Member)=>m.pending?'awaiting_activation':m.active?'enabled':'disabled';
const nameOf=(m:Member)=>m.display_name||m.email.split('@')[0];

function Matrix({member}:{member:Member}) {
  const effective=member.permissions||defaultPermissions[member.role||'']||[];
  const all=(Object.keys(permissionLabels) as Permission[]);
  return <ul className="ops-feed" style={{margin:0}}>{all.map(scope=><li key={scope} style={{gridTemplateColumns:'24px 1fr',padding:'8px 0'}}>
    <span aria-hidden style={{color:effective.includes(scope)?'var(--ok)':'var(--faint)'}}>{effective.includes(scope)?'✓':'–'}</span>
    <p style={{color:effective.includes(scope)?'inherit':'var(--muted)'}}>{permissionLabels[scope]}<span className="sr-only">{effective.includes(scope)?' (allowed)':' (not allowed)'}</span></p></li>)}</ul>;
}

function Profile({member,reload,canEdit}:{member:Member;reload:()=>Promise<unknown>;canEdit:boolean}) {
  const action=useAction();
  return <>
    <dl className="ops-kv"><dt>Email</dt><dd>{member.email}</dd><dt>Role</dt><dd>{member.role?roles[member.role]||member.role:'Unassigned'}</dd><dt>Status</dt><dd><Badge value={state(member)}/></dd>
      <dt>Last sign-in</dt><dd>{member.pending?'Not activated yet':timeAgo(member.last_sign_in_at)}</dd><dt>Added</dt><dd>{member.created_at?dateTime(member.created_at):'—'}</dd><dt>Actions (30 days)</dt><dd>{member.actions_30d}</dd></dl>
    {member.id&&canEdit&&<form onSubmit={e=>{e.preventDefault();void action.run('staff_profile_save',{id:member.id,...payload(e.currentTarget)},reload,'Profile saved.');}}>
      <h3>Profile details</h3><p className="ops-muted" style={{marginTop:0}}>Optional. Shown only inside the staff portal.</p>
      <Field title="Display name"><input name="display_name" defaultValue={member.display_name||''} maxLength={120}/></Field>
      <div className="ops-fields" style={{gridTemplateColumns:'1fr 1fr'}}><Field title="Job title"><input name="job_title" defaultValue={member.job_title||''} maxLength={120}/></Field><Field title="Phone"><input name="phone" defaultValue={member.phone||''} maxLength={50}/></Field></div>
      <button className="ops-primary" disabled={action.busy}>Save profile</button><Feedback message={action.message} failed={action.failed}/>
    </form>}
    <div><h3>Effective permissions</h3><Matrix member={member}/></div>
  </>;
}

function Access({member,reload,isOwner}:{member:Member;reload:()=>Promise<unknown>;isOwner:boolean}) {
  const {request:ops}=useOps();
  const action=useAction();
  const [link,setLink]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const locked=member.role==='owner'||(member.role==='admin'&&!isOwner);
  async function createLink() {
    setBusy(true);setLink('');setError('');
    try{
      const result=await ops<{token_hash:string;type:string}>('write','staff_setup_link',{email:member.email});
      setLink(location.origin+'/admin#'+new URLSearchParams({type:result.type,token_hash:result.token_hash}).toString());
    }catch(e){setError(e instanceof Error?e.message:'Could not create a link.');}
    finally{setBusy(false);}
  }
  if(member.role==='owner')return <p className="ops-muted">Owner access includes every workspace and cannot be changed here.</p>;
  if(locked)return <p className="ops-muted">Only the owner can change an Administrator’s access.</p>;
  return <>
    <AccountForm key={JSON.stringify(member)} account={{id:member.id as unknown as string,email:member.email,role:member.role,active:member.active,permissions:member.permissions,pending:member.pending}} busy={action.busy} isOwner={isOwner}
      onSave={data=>void action.run(member.pending?'access_invite':'access_save',data,reload,member.pending?'Approval updated.':'Access updated.')}/>
    <Feedback message={action.message} failed={action.failed}/>
    {member.active&&<div><h3>Sign-in link</h3><p className="ops-muted" style={{marginTop:0}}>{member.pending?'Create a one-time link so this person can choose a password.':'Create a one-time link if this person has lost access.'} Share it privately.</p>
      <button disabled={busy} onClick={()=>void createLink()}>{busy?'Creating link…':member.pending?'Create setup link':'Create password reset link'}</button>
      <Feedback message={error} failed/>
      {link&&<div className="ops-confirm"><Field title="Private one-time link"><input value={link} readOnly onFocus={e=>e.target.select()}/></Field><button onClick={()=>{void navigator.clipboard.writeText(link).catch(()=>setError('Select and copy the link manually.'));}}>Copy link</button></div>}
    </div>}
  </>;
}

export default function Team({isOwner,canEdit=true}:{isOwner:boolean;canEdit?:boolean}) {
  const team=useWorkspace<Member[]>('team');
  const action=useAction();
  const [search,setSearch]=useState('');
  const [role,setRole]=useState('');
  const [status,setStatus]=useState('');
  const [selected,setSelected]=useState<string>();
  const [tab,setTab]=useState<'profile'|'access'|'activity'>('profile');
  const [inviting,setInviting]=useState(false);
  const rows=useMemo(()=>(team.data||[]).filter(m=>(!role||m.role===role)&&(!status||state(m)===status)
    &&(!search||(m.email+' '+(m.display_name||'')+' '+(m.job_title||'')).toLowerCase().includes(search.toLowerCase()))),[team.data,search,role,status]);
  const member=team.data?.find(m=>(m.id||m.email)===selected);
  const counts={active:team.data?.filter(m=>!m.pending&&m.active).length||0,pending:team.data?.filter(m=>m.pending).length||0,disabled:team.data?.filter(m=>!m.pending&&!m.active).length||0};
  return <>
    <div className="ops-stats" style={{margin:0,gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
      <div className="ops-stat green"><span>Active staff</span><strong>{counts.active}</strong></div>
      <div className="ops-stat amber"><span>Awaiting activation</span><strong>{counts.pending}</strong></div>
      <div className="ops-stat"><span>Disabled</span><strong>{counts.disabled}</strong></div>
    </div>
    <section className="ops-panel">
      <div className="ops-toolbar">
        <label className="ops-input" style={{display:'flex',alignItems:'center',gap:8,maxWidth:300}}><Search size={16} aria-hidden/><input aria-label="Search staff" placeholder="Search name, email or title…" value={search} onChange={e=>setSearch(e.target.value)} style={{border:0,outline:0,background:'transparent',color:'inherit',font:'inherit',width:'100%'}}/></label>
        <select className="ops-input" aria-label="Role" value={role} onChange={e=>setRole(e.target.value)}><option value="">All roles</option>{Object.entries(roles).filter(([k])=>k!=='order_fulfillment').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
        <select className="ops-input" aria-label="Status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Any status</option><option value="enabled">Active</option><option value="awaiting_activation">Awaiting activation</option><option value="disabled">Disabled</option></select>
        <span className="grow"/>
        {canEdit&&<button className="ops-primary" onClick={()=>setInviting(true)}><Plus size={16} aria-hidden style={{verticalAlign:'-3px'}}/> Approve staff member</button>}
      </div>
      <Feedback message={team.error} failed/>
      {!team.data&&!team.error&&<Skeleton rows={6}/>}
      {team.data&&rows.length===0&&<Empty title="No staff match these filters" note="Approve a staff email to give someone portal access."/>}
      {rows.length>0&&<div className="ops-table"><table><thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Last sign-in</th></tr></thead>
        <tbody>{rows.map(m=><tr key={m.id||m.email} className="clickable" tabIndex={0} onClick={()=>{setSelected(m.id||m.email);setTab('profile');}} onKeyDown={e=>{if(e.key==='Enter'){setSelected(m.id||m.email);setTab('profile');}}}>
          <td><div className="ops-person"><Avatar name={m.display_name||m.email}/><div><strong>{nameOf(m)}</strong><small>{m.job_title?m.job_title+' · ':''}{m.email}</small></div></div></td>
          <td>{m.role?roles[m.role]||m.role:'Unassigned'}</td><td><Badge value={state(m)}/></td><td>{m.pending?'—':timeAgo(m.last_sign_in_at)}</td></tr>)}</tbody></table></div>}
    </section>
    {inviting&&<Drawer title="Approve a staff member" subtitle="They choose their own password from a one-time link." onClose={()=>setInviting(false)}>
      <AccountForm busy={action.busy} isOwner={isOwner} onSave={data=>void action.run('access_invite',data,async()=>{await team.reload();setInviting(false);},'Staff email approved. Open their profile to create a setup link.')}/>
      <Feedback message={action.message} failed={action.failed}/>
    </Drawer>}
    {member&&<Drawer title={nameOf(member)} subtitle={(member.role?roles[member.role]:'Unassigned')+' · '+member.email} avatar={member.display_name||member.email} onClose={()=>setSelected(undefined)}>
      <div className="ops-tabs" role="tablist">{(['profile','access','activity'] as const).filter(t=>t!=='access'||canEdit).map(t=><button key={t} role="tab" aria-selected={tab===t} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}</div>
      {tab==='profile'&&<Profile member={member} reload={team.reload} canEdit={canEdit&&!(member.role==='owner'&&!isOwner)}/>}
      {tab==='access'&&<Access member={member} reload={team.reload} isOwner={isOwner}/>}
      {tab==='activity'&&(member.id?<ActivityList actor={member.id} limit={25}/>:<Empty title="No activity yet" note="Activity appears after this person activates their account."/>)}
    </Drawer>}
    <p className="ops-muted"><ShieldCheck size={14} aria-hidden style={{verticalAlign:'-2px'}}/> Every change on this page is recorded in the audit trail.</p>
  </>;
}
