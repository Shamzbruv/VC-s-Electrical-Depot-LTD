'use client';

import {useEffect,useRef,useState} from 'react';
import {ops} from '../../lib/ops-client';
import {Badge,dateTime,Feedback,Field,Pager,Panel,payload,today,useAction,useWorkspace} from './workspace';

type Fix={latitude:number;longitude:number;accuracy:number;updated_at?:string};
type Parcel={id:string;number:number;recipient:string;phone:string;address:string;description:string;delivery_date:string;notes:string;status:string;driver_id?:string;driver_email?:string;location?:Fix;result_note?:string;timeline?:{id:number;event:string;note?:string;created_at:string}[]};
const stages=['pending','assigned','in_transit','delivered','issue','cancelled'];
const locationText=(error:GeolocationPositionError)=>error.code===1?'Allow location access in your browser settings, then try again.':error.code===3?'Location took too long. Move somewhere with a clear signal and retry.':'Your phone could not find its location. Turn on location services and try again.';
const coordinates=({coords}:GeolocationPosition):Fix=>({latitude:coords.latitude,longitude:coords.longitude,accuracy:coords.accuracy});
const options={enableHighAccuracy:true,maximumAge:0,timeout:20000};
const mapLink=(query:string)=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);

function ParcelDetails({parcel}:{parcel:Parcel}) {
  return <><p>{parcel.description}</p><p>{parcel.address} · <a href={'tel:'+parcel.phone.replace(/[^0-9+]/g,'')}>{parcel.phone}</a></p>
    {parcel.notes&&<p className="ops-muted">{parcel.notes}</p>}{parcel.result_note&&<p>{parcel.result_note}</p>}
    {parcel.timeline?.length?<details><summary>Delivery history</summary><ol className="ops-timeline">{parcel.timeline.map(item=><li key={item.id}>{item.event.replaceAll('_',' ')} <small>{dateTime(item.created_at)}</small>{item.note&&<p>{item.note}</p>}</li>)}</ol></details>:null}</>;
}

export function Dispatch() {
  const [offset,setOffset]=useState(0);
  const [status,setStatus]=useState('');
  const [packageId,setPackageId]=useState('');
  const pending=useWorkspace<Parcel[]>('dispatch',{status,offset},12000);
  const drivers=useWorkspace<{id:string;email:string}[]>('drivers',{},30000);
  const action=useAction();
  return <>
    <Panel title="Queue a package" note="Enter the delivery details. You can assign a driver from the queue as soon as the package is saved.">
      <form onSubmit={e=>{
        e.preventDefault();const form=e.currentTarget;const id=packageId||crypto.randomUUID();setPackageId(id);
        void action.run('dispatch_create',{...payload(form),id},async()=>{
          setPackageId('');form.reset();
          if(!['','pending'].includes(status)||offset){setStatus('pending');setOffset(0);}else await pending.reload();
        },'Package added to the delivery queue.');
      }}>
        <div className="ops-fields"><Field title="Recipient name"><input name="recipient" required minLength={2} maxLength={150}/></Field>
        <Field title="Recipient phone"><input name="phone" type="tel" required minLength={7} maxLength={50}/></Field>
        <Field title="Delivery date"><input name="delivery_date" type="date" defaultValue={today()} required/></Field>
        <Field title="Delivery address"><input name="address" required minLength={5} maxLength={500}/></Field>
        <Field title="Package contents"><textarea name="description" required minLength={2} maxLength={1000} rows={2}/></Field>
        <Field title="Driver instructions"><textarea name="notes" maxLength={1000} rows={2} placeholder="Gate code, landmark or handover instructions"/></Field></div>
        <button className="ops-primary" disabled={action.busy}>Queue package</button>
      </form>
    </Panel>
    <Feedback message={action.message} failed={action.failed}/>
    <Panel title="Delivery queue" note="Positions refresh while this screen is open. Each point shows when the driver’s phone last reported in.">
      <Field title="Filter by status"><select value={status} onChange={e=>{setOffset(0);setStatus(e.target.value);}}><option value="">All stages</option>{stages.map(value=><option key={value} value={value}>{value.replace('_',' ')}</option>)}</select></Field>
      <Feedback message={pending.error||drivers.error} failed/>
      {pending.data?.map(parcel=><article className="ops-list-card" key={parcel.id}>
        <div className="ops-list-heading"><div><small>VC-{parcel.number} · {parcel.delivery_date}</small><h3>{parcel.recipient}</h3></div><Badge value={parcel.status}/></div>
        <ParcelDetails parcel={parcel}/>
        {parcel.driver_email&&<p className="ops-muted">Driver {parcel.driver_email}</p>}
        {parcel.location?.updated_at&&<div className="ops-location"><b>Last reported position</b><span>{dateTime(parcel.location.updated_at)} · ±{Math.round(parcel.location.accuracy)} m</span>
          {Date.now()-Date.parse(parcel.location.updated_at)>60000&&<span>Position is over one minute old. Check in with the driver.</span>}
          <a href={mapLink(parcel.location.latitude+','+parcel.location.longitude)} target="_blank" rel="noreferrer">Open on map</a></div>}
        {['pending','assigned','issue'].includes(parcel.status)&&<form className="ops-actions" onSubmit={e=>{e.preventDefault();void action.run('dispatch_assign',{id:parcel.id,...payload(e.currentTarget)},pending.reload,'Driver assigned.');}}>
          <Field title="Driver"><select name="driver_id" defaultValue={parcel.driver_id||''} required><option value="">Choose a driver</option>{drivers.data?.map(driver=><option key={driver.id} value={driver.id}>{driver.email}</option>)}</select></Field>
          <button className="ops-primary" disabled={action.busy||!drivers.data?.length}>Assign driver</button>
          {drivers.data?.length===0&&<small>Give a staff member Driver permission to assign a package.</small>}
        </form>}
        {!['delivered','cancelled'].includes(parcel.status)&&<details><summary>Cancel package</summary><form className="ops-actions" onSubmit={e=>{e.preventDefault();void action.run('dispatch_cancel',{id:parcel.id,...payload(e.currentTarget)},pending.reload,'Package cancelled.');}}>
          <Field title="Reason for cancellation"><input name="note" required minLength={3} maxLength={500}/></Field><button disabled={action.busy}>Confirm cancellation</button>
        </form></details>}
      </article>)}
      {pending.data?.length===0&&<p className="ops-empty">No packages in this stage.</p>}
      {!pending.data&&!pending.error&&<p className="ops-muted">Loading packages…</p>}
      <Pager offset={offset} setOffset={setOffset} length={pending.data?.length||0}/>
    </Panel>
  </>;
}

export function Driver() {
  const [offset,setOffset]=useState(0);
  const [filter,setFilter]=useState('active');
  const list=useWorkspace<Parcel[]>('drive',{status:filter,offset},10000);
  const activeList=useWorkspace<Parcel[]>('drive',{status:'in_transit'},10000);
  const [active,setActive]=useState<string[]>([]);
  const [busy,setBusy]=useState('');
  const [tracking,setTracking]=useState('');
  const [notice,setNotice]=useState('');
  const [failure,setFailure]=useState('');
  const paused=useRef(new Set<string>());
  const previous=useRef(0);
  const visible=JSON.stringify(active);
  useEffect(()=>{
    if(activeList.data)setActive(activeList.data.map(p=>p.id));
  },[activeList.data]);
  useEffect(()=>{
    const ids=JSON.parse(visible) as string[];
    if(!ids.length){setTracking('');return;}
    if(!navigator.geolocation){setTracking('Location sharing is unavailable on this browser.');return;}
    let valid=true;
    setTracking('Waiting for a location update…');
    previous.current=0;
    const watch=navigator.geolocation.watchPosition(fix=>{
      if(!valid||Date.now()-previous.current<10000)return;
      const targets=ids.filter(id=>!paused.current.has(id));
      if(!targets.length)return;
      previous.current=Date.now();
      Promise.allSettled(targets.map(id=>ops('write','drive_location',{id,...coordinates(fix)}))).then(results=>{
        if(valid)setTracking(results.some(result=>result.status==='fulfilled')
          ?'Location shared at '+dateTime(new Date().toISOString())
          :'Unable to send location. Check your connection and keep this page open.');
      });
    },error=>{if(valid)setTracking(locationText(error));},options);
    return ()=>{valid=false;navigator.geolocation.clearWatch(watch);};
  },[visible]);

  async function accept(id:string,consent:boolean) {
    setBusy(id);setFailure('');setNotice('');
    try {
      if(!navigator.geolocation)throw Error('Use a phone browser with location services enabled.');
      const fix=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,e=>reject(Error(locationText(e))),options));
      await ops('write','drive_accept',{id,consent,...coordinates(fix)});
      paused.current.delete(id);
      setActive(ids=>ids.includes(id)?ids:[...ids,id]);
      setNotice('Delivery accepted. Keep this page open to share your position.');
      await Promise.allSettled([list.reload(),activeList.reload()]);
    } catch(e){setFailure(e instanceof Error?e.message:'Unable to accept delivery.');}
    finally{setBusy('');}
  }
  async function finish(id:string,action:string,note:string) {
    setBusy(id);setFailure('');setNotice('');
    paused.current.add(id);
    try {
      await ops('write',action,{id,note});
      setActive(ids=>ids.filter(item=>item!==id));
      setNotice(action==='drive_complete'?'Delivery completed. Location sharing stopped for this package.':'Issue sent to dispatch. Location sharing stopped for this package.');
      await Promise.allSettled([list.reload(),activeList.reload()]);
    } catch(e){
      paused.current.delete(id);
      setFailure(e instanceof Error?e.message:'Unable to update delivery.');
    } finally{setBusy('');}
  }
  return <Panel title="My deliveries" note="Allow location access when you accept a package. Keep this page visible and your phone awake during the delivery.">
    {active.length>0&&<p className="ops-location" role="status"><b>Location sharing · {active.length} active</b><span>{tracking}</span></p>}
    <Feedback message={notice}/><Feedback message={failure||list.error||activeList.error} failed/>
    <Field title="Show deliveries"><select value={filter} onChange={e=>{setFilter(e.target.value);setOffset(0);}}><option value="active">Assigned and in progress</option><option value="delivered">Delivered</option><option value="issue">Issues</option><option value="cancelled">Cancelled</option></select></Field>
    {list.data?.map(parcel=><article className="ops-list-card" key={parcel.id}>
      <div className="ops-list-heading"><div><small>VC-{parcel.number} · {parcel.delivery_date}</small><h3>{parcel.recipient}</h3></div><Badge value={parcel.status}/></div>
      <ParcelDetails parcel={parcel}/>
      <a className="ops-link" href={mapLink(parcel.address)} target="_blank" rel="noreferrer">Get directions</a>
      {parcel.status==='assigned'&&<form onSubmit={e=>{e.preventDefault();void accept(parcel.id,new FormData(e.currentTarget).get('consent')==='on');}}>
        <label className="ops-check"><input name="consent" type="checkbox" required/>Share my live position with dispatch while this package is in progress.</label>
        <button className="ops-primary" disabled={!!busy}>{busy===parcel.id?'Getting location…':'Accept and start delivery'}</button>
      </form>}
      {parcel.status==='in_transit'&&<details><summary>Complete delivery or report an issue</summary><form onSubmit={e=>{
        e.preventDefault();
        const submitter=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
        void finish(parcel.id,submitter?.value||'drive_complete',String(new FormData(e.currentTarget).get('note')||''));
      }}>
        <Field title="Handover note or issue details"><textarea name="note" rows={2} maxLength={500} placeholder="Optional for completed deliveries. Required for a delivery issue."/></Field>
        <div className="ops-actions"><button className="ops-primary" value="drive_complete" disabled={!!busy}>Mark delivered</button><button value="drive_issue" disabled={!!busy}>Report issue</button></div>
      </form></details>}
    </article>)}
    {list.data?.length===0&&<p className="ops-empty">No deliveries in this view.</p>}
    {!list.data&&!list.error&&<p>Loading your deliveries…</p>}
    <Pager offset={offset} setOffset={setOffset} length={list.data?.length||0}/>
  </Panel>;
}
