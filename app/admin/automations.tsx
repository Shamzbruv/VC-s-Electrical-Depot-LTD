'use client';

import {useEffect,useState} from 'react';
import {useOps} from './portal-context';
import {mailStatus,type DeliverySetup} from '../../lib/supervisor';
import {dateTime,Feedback,Panel,Stat,useAction,useWorkspace} from './workspace';
import {SetupNotice} from './supervisor';

type Job={id:string;phase:string;state:string;recipient:string;attempts:number;last_error?:string;created_at:string;sent_at?:string};
type Queue={database?:boolean;queued:number;failed:number;sent:number;jobs:Job[]};
export default function Automations() {
  const {request:ops,preview}=useOps();
  const setup=useWorkspace<DeliverySetup>('delivery_setup',{},60000);
  const queue=useWorkspace<Queue>('automations',{},20000);
  const action=useAction();
  const [phase,setPhase]=useState('out_for_delivery');
  const [email,setEmail]=useState<{html:string;subject:string}>();
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    ops<{html:string;subject:string}>('read','delivery_email_preview',{phase}).then(result=>{if(active){setEmail(result);setError('');}}).catch(reason=>{if(active)setError(reason.message);});
    return ()=>{active=false;};
  },[phase,ops]);
  return <>
    <SetupNotice setup={setup.data}/>
    <Feedback message={setup.error||queue.error||action.message||error} failed={!!setup.error||!!queue.error||action.failed||!!error}/>
    <Panel title="Delivery email automation" note="The supervisor’s confirmed status change creates a customer update using a saved copy of that order summary.">
      <div className="ops-stats">
        <Stat label="Email service" value={setup.data?.email?'Connected':'Awaiting setup'}/>
        <Stat label="Queued updates" value={queue.data?.queued??'—'} tone="amber"/>
        <Stat label="Sent to email provider" value={queue.data?.sent??'—'} tone="green"/>
        <Stat label="Need attention" value={queue.data?.failed??'—'} tone="amber"/>
      </div>
      {setup.data?.sender&&<p className="ops-muted">Sender · {setup.data.sender}</p>}
      <div className="ops-automation-steps">
        <article><strong>Check the truck</strong><p>Record the customer email and item quantities. Mark the loading checklist when the items are ready.</p></article>
        <article><strong>Release the delivery</strong><p>Confirm departure. The customer receives the order summary and delivery address with VC’s branding.</p></article>
        <article><strong>Confirm arrival</strong><p>Record who received the goods. The customer receives the arrival confirmation.</p></article>
      </div>
      <div className="ops-actions"><button className="ops-primary" disabled={!setup.data?.email||action.busy||preview} onClick={()=>void action.run('delivery_process_emails',{},queue.reload,'Queued email processing requested.')}>Process due emails</button></div>
      <p className="ops-muted">Sent means the email provider accepted the message. Check provider records for delivery, bounce or spam-folder questions.</p>
    </Panel>
    <Panel title="Customer email preview">
      <div className="ops-segment">{[['out_for_delivery','Out for delivery'],['arrived','Arrived']].map(([value,title])=><button key={value} aria-pressed={phase===value} onClick={()=>setPhase(value)}>{title}</button>)}</div>
      {email&&<><p><b>{email.subject}</b></p><iframe className="ops-email-preview" sandbox="" title="Customer delivery email preview" srcDoc={email.html}/></>}
    </Panel>
    <Panel title="Recent email activity">
      <div className="ops-table"><table><thead><tr><th>Update</th><th>Customer email</th><th>Status</th><th>Time</th></tr></thead>
        <tbody>{queue.data?.jobs.map(job=><tr key={job.id}><td>{job.phase==='arrived'?'Arrival':'Departure'}</td><td>{job.recipient}</td><td>{mailStatus(job.state)}
              {['failed','needs_review'].includes(job.state)&&<details><summary>Record manual follow-up</summary><form onSubmit={e=>{
                e.preventDefault();
                const note=String(new FormData(e.currentTarget).get('note')||'');
                void action.run('delivery_resolve_email',{id:job.id,note,confirmed:true},queue.reload,'Manual follow-up recorded. This email is closed.');
              }}>
                <label className="ops-field"><span>Provider check and customer follow-up</span><textarea name="note" required minLength={10} maxLength={500} rows={3}/></label>
                <label className="ops-check"><input type="checkbox" required/>I reviewed the provider log and handled this update with the customer.</label>
                <button disabled={action.busy||preview}>Close after manual follow-up</button>
              </form></details>}
              {job.last_error&&<p className="ops-muted">{job.last_error}</p>}</td><td>{dateTime(job.sent_at||job.created_at)}</td></tr>)}</tbody>
      </table></div>
      {queue.data?.jobs.length===0&&<p className="ops-empty">Delivery email activity will appear here.</p>}
    </Panel>
  </>;
}
