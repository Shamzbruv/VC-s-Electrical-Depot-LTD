'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useOps} from './portal-context';
import {deliveryStatus,mailStatus,type DeliveryItem,type DeliverySetup,type Shipment} from '../../lib/supervisor';
import {dateTime,Feedback,Field,Panel,Stat,today,useAction,useWorkspace} from './workspace';

const freshItem=():DeliveryItem=>({name:'',quantity:1,unit:'each',loaded:false});
const emptyOrder=()=>({id:crypto.randomUUID(),recipient:'',email:'',phone:'',address:'',date:today(),reference:'',vehicle:'',window:'',notes:'',items:[freshItem()]});
type Order=ReturnType<typeof emptyOrder>;
function toOrder(parcel:Shipment):Order {
  return {id:parcel.id,recipient:parcel.recipient,email:parcel.customer_email||'',phone:parcel.phone,address:parcel.address,
    date:parcel.delivery_date,reference:parcel.order_reference||'',vehicle:parcel.vehicle||'',window:parcel.delivery_window||'',
    notes:parcel.notes,items:parcel.order_items?.length?parcel.order_items:[{...freshItem(),name:parcel.description}]};
}
export function SetupNotice({setup}:{setup?:DeliverySetup}) {
  if(!setup)return null;
  return !setup.database?<div className="ops-setup-note"><strong>Delivery setup needs the database update.</strong><p>You can review existing deliveries below. Saving and dispatching the new order summary becomes available once setup is complete.</p></div>
    :!setup.email?<div className="ops-setup-note"><strong>Customer emails are awaiting sender setup.</strong><p>Status changes are recorded and emails stay queued until the delivery email service is connected.</p><Link href="/admin/automations">Open Automation setup →</Link></div>
    :!setup.scheduled?<div className="ops-setup-note"><strong>Automatic retry schedule is awaiting setup.</strong><p>Release and arrival updates send immediately. Use Process queued emails if a retry is pending.</p></div>:null;
}

export default function Supervisor() {
  const {preview}=useOps();
  const setup=useWorkspace<DeliverySetup>('delivery_setup',{},60000);
  const [filter,setFilter]=useState('');
  const [query,setQuery]=useState('');
  const [offset,setOffset]=useState(0);
  const list=useWorkspace<Shipment[]>('shipments',{status:filter,q:query,offset},15000);
  const products=useWorkspace<{name:string;sku:string;unit:string}[]>('picking_products');
  const [order,setOrder]=useState<Order>();
  const [confirm,setConfirm]=useState<{parcel:Shipment;action:string}>();
  const action=useAction();
  const enabled=setup.data?.database&&!preview;
  useEffect(()=>{setOrder(emptyOrder());},[]);
  function patch<K extends keyof Order>(key:K,value:Order[K]){setOrder(current=>current?{...current,[key]:value}:current);}
  return <>
    <SetupNotice setup={setup.data}/>
    <Feedback message={setup.error||list.error||action.message} failed={!!setup.error||!!list.error||action.failed}/>
    <Panel title={order?.id&&list.data?.some(row=>row.id===order.id)?'Prepare this delivery':'Prepare a delivery'} note="Copy the order reference from the existing accounting system and list the items being loaded for the customer.">
      {order&&<form onSubmit={e=>{
        e.preventDefault();
        void action.run('delivery_save',order,async()=>{setOrder(emptyOrder());setFilter('');setQuery('');setOffset(0);await list.reload();},'Delivery summary and loading checklist saved.');
      }}>
        <div className="ops-fields">
          {([
            ['recipient','Customer name','text',true],['email','Customer email','email',true],['phone','Customer phone','tel',true],
            ['reference','Existing invoice or order reference','text',false],['date','Delivery date','date',true],
            ['window','Estimated delivery window','text',false],['vehicle','Truck or delivery team','text',false],
          ] as const).map(([key,title,type,required])=><Field key={key} title={title}>
            <input type={type} value={order[key]} required={required} maxLength={key==='email'?254:150} onChange={e=>patch(key,e.target.value)}/>
          </Field>)}
        </div>
        <Field title="Delivery address"><textarea value={order.address} required minLength={5} maxLength={500} rows={2} onChange={e=>patch('address',e.target.value)}/></Field>
        <h3>Items and loading check</h3>
        <datalist id="delivery-products">{products.data?.map(item=><option key={item.sku} value={item.name}>{item.sku}</option>)}</datalist>
        <div className="ops-loading-items">{order.items.map((item,index)=><div className="ops-loading-item" key={index}>
          <Field title="Product or item"><input value={item.name} list="delivery-products" maxLength={160} required onChange={e=>patch('items',order.items.map((row,i)=>i===index?{...row,name:e.target.value}:row))}/></Field>
          <Field title="Quantity"><input type="number" min="0.001" max="1000000" step="0.001" value={item.quantity} required onChange={e=>patch('items',order.items.map((row,i)=>i===index?{...row,quantity:Number(e.target.value)}:row))}/></Field>
          <Field title="Unit"><input value={item.unit} maxLength={40} required onChange={e=>patch('items',order.items.map((row,i)=>i===index?{...row,unit:e.target.value}:row))}/></Field>
          <label className="ops-check"><input type="checkbox" checked={item.loaded} onChange={e=>patch('items',order.items.map((row,i)=>i===index?{...row,loaded:e.target.checked}:row))}/>Loaded</label>
          <button type="button" aria-label={'Remove item '+(index+1)} disabled={order.items.length===1} onClick={()=>patch('items',order.items.filter((_,i)=>i!==index))}>Remove</button>
        </div>)}</div>
        <button type="button" disabled={order.items.length>=100} onClick={()=>patch('items',[...order.items,freshItem()])}>Add item</button>
        <Field title="Internal loading or delivery notes"><textarea value={order.notes} rows={2} maxLength={1000} onChange={e=>patch('notes',e.target.value)}/></Field>
        <div className="ops-actions"><button className="ops-primary" disabled={!enabled||action.busy}>Save loading checklist</button><button type="button" onClick={()=>setOrder(emptyOrder())}>Clear form</button></div>
      </form>}
    </Panel>
    <Panel title="Deliveries" note="Open the order summary, confirm departure after loading, and record the recipient when the delivery arrives.">
      <div className="ops-fields"><Field title="Search customer or order"><input value={query} onChange={e=>{setQuery(e.target.value);setOffset(0);}} maxLength={100}/></Field>
        <Field title="Delivery stage"><select value={filter} onChange={e=>{setFilter(e.target.value);setOffset(0);}}>
          <option value="">All deliveries</option>{['pending','in_transit','delivered','issue','cancelled'].map(value=><option key={value} value={value}>{deliveryStatus(value)}</option>)}
        </select></Field>
      </div>
      {list.data?.filter(row=>(!filter||row.status===filter||(filter==='pending'&&row.status==='assigned'))&&(!query||[row.recipient,row.order_reference,row.number].join(' ').toLowerCase().includes(query.toLowerCase()))).map(parcel=><article className="ops-list-card" key={parcel.id}>
        <div className="ops-list-heading"><div><small>VC-{parcel.number} · {parcel.order_reference||'No external reference'}</small><h3>{parcel.recipient}</h3></div><span className={'ops-badge state-'+parcel.status}>{deliveryStatus(parcel.status)}</span></div>
        <p>{parcel.address}</p><p className="ops-muted">{parcel.delivery_date}{parcel.delivery_window?' · '+parcel.delivery_window:''}{parcel.vehicle?' · '+parcel.vehicle:''}</p>
        <p>{parcel.customer_email||'Customer email has not been recorded'} · {parcel.phone}</p>
        <details><summary>Order summary and history</summary>
          {parcel.order_items?.length?<ul>{parcel.order_items.map((item,i)=><li key={i}>{item.quantity} {item.unit} · {item.name} {item.loaded?'✓ loaded':''}</li>)}</ul>:<p>{parcel.description}</p>}
          {parcel.notes&&<p>Internal notes · {parcel.notes}</p>}
          {parcel.received_by&&<p>Received by {parcel.received_by}</p>}
          {parcel.result_note&&<p>{parcel.result_note}</p>}
          <ol className="ops-timeline">{parcel.timeline?.map(event=><li key={event.id}>{event.event.replaceAll('_',' ')} <small>{dateTime(event.created_at)}</small>{event.note&&<p>{event.note}</p>}</li>)}</ol>
        </details>
        {(parcel.emails||[]).map(job=><p key={job.id} className="ops-mail-state">{job.phase==='arrived'?'Arrival email':'Departure email'} · <b>{mailStatus(job.state)}</b>{job.error&&<small>{job.error}</small>}</p>)}
        <div className="ops-actions">
          {['pending','assigned','issue'].includes(parcel.status)&&<><button disabled={!enabled} onClick={()=>{setOrder(toOrder(parcel));window.scrollTo({top:0,behavior:'smooth'});}}>Edit loading checklist</button>
            <button className="ops-primary" disabled={!enabled||action.busy} onClick={()=>setConfirm({parcel,action:'release'})}>Confirm out for delivery</button></>}
          {parcel.status==='in_transit'&&<button className="ops-primary" disabled={!enabled||action.busy} onClick={()=>setConfirm({parcel,action:'arrive'})}>Confirm arrival</button>}
          {!['delivered','cancelled'].includes(parcel.status)&&<button disabled={!enabled||action.busy} onClick={()=>setConfirm({parcel,action:'issue'})}>Report issue</button>}
          {!['delivered','cancelled'].includes(parcel.status)&&<button disabled={!enabled||action.busy} onClick={()=>setConfirm({parcel,action:'cancel'})}>Cancel delivery</button>}
        </div>
        {confirm?.parcel.id===parcel.id&&<form className="ops-confirm" onSubmit={e=>{
          e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));
          void action.run('delivery_'+confirm.action,{id:parcel.id,...values,confirmed:true},async()=>{setConfirm(undefined);await list.reload();},
            confirm.action==='release'?'Delivery released. Customer email is in the delivery queue.':confirm.action==='arrive'?'Arrival recorded. Customer email is in the delivery queue.':'Delivery updated.');
        }}>
          <p><strong>{confirm.action==='release'?'Check the summary before releasing this order.':confirm.action==='arrive'?'Confirm the items have physically arrived.':'Record the reason for this update.'}</strong></p>
          {confirm.action==='release'&&<p>The customer update will go to {parcel.customer_email||'the customer email recorded on this order'}. Check every item as loaded and save the checklist first.</p>}
          {confirm.action==='arrive'&&<Field title="Received by"><input name="received_by" required minLength={2} maxLength={150}/></Field>}
          {confirm.action!=='release'&&<Field title={['issue','cancel'].includes(confirm.action)?'Reason':'Handover notes'}><textarea name="note" rows={2} maxLength={500} required={['issue','cancel'].includes(confirm.action)} minLength={['issue','cancel'].includes(confirm.action)?3:undefined}/></Field>}
          <label className="ops-check"><input type="checkbox" required/>I have checked these details and confirm this update.</label>
          <div className="ops-actions"><button className="ops-primary" disabled={action.busy}>Confirm update</button><button type="button" onClick={()=>setConfirm(undefined)}>Go back</button></div>
        </form>}
      </article>)}
      {list.data?.length===0&&<p className="ops-empty">No deliveries to show.</p>}
      <div className="ops-actions"><button disabled={!offset} onClick={()=>setOffset(value=>Math.max(0,value-100))}>Previous</button><button disabled={(list.data?.length||0)<100} onClick={()=>setOffset(value=>value+100)}>Next</button></div>
    </Panel>
  </>;
}
