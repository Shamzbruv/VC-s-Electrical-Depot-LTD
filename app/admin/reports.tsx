'use client';

import {useState} from 'react';
import {deliveryStatus} from '../../lib/supervisor';
import {Feedback,Field,Panel,Stat,today,useWorkspace} from './workspace';

type Row={number:number;order_reference:string;recipient:string;delivery_date:string;status:string;started_at:string|null;finished_at:string|null;received_by:string|null};
type Report={database?:boolean;created?:number;delivered?:number;open?:number;issues?:number;overdue?:number;rows:Row[]};
function exportManifest(rows:Row[]) {
  const cell=(value:unknown)=>'"'+String(value??'').replace(/^[\s]*[=+@-]/,"'$&").replaceAll('"','""')+'"';
  const data=[['Delivery','Existing order reference','Customer','Scheduled date','Status','Departed','Arrived','Received by'],...rows.map(row=>['VC-'+row.number,row.order_reference,row.recipient,row.delivery_date,deliveryStatus(row.status),row.started_at,row.finished_at,row.received_by])];
  const url=URL.createObjectURL(new Blob(['\uFEFF',data.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='vcs-delivery-manifest.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function Reports() {
  const day=today();
  const [from,setFrom]=useState(day.slice(0,8)+'01'),[to,setTo]=useState(day);
  const report=useWorkspace<Report>('operations_report',{from,to},30000);
  return <Panel title="Operations reports" note="Review delivery activity and export order references to match against the client’s existing accounting system. The period uses the date the delivery record was created, in Jamaica time.">
    <div className="ops-actions ops-range">
      <Field title="From"><input type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></Field>
      <Field title="Through"><input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></Field>
      <button disabled={!report.data?.rows.length} onClick={()=>exportManifest(report.data!.rows)}>Export delivery manifest</button>
    </div>
    <Feedback message={report.error} failed/>
    {report.data?.database===false?<p className="ops-setup-note">Operations reports will activate with the supervisor database update.</p>:report.data?<>
      <div className="ops-stats">
        <Stat label="Created in period" value={report.data.created??0}/><Stat label="Arrived" value={report.data.delivered??0} tone="green"/>
        <Stat label="Still open" value={report.data.open??0} tone="amber"/><Stat label="Overdue" value={report.data.overdue??0} tone="amber"/>
      </div>
      <p className="ops-muted">Deliveries with issues · {report.data.issues??0}. The table and export include up to 1,000 records. Choose a shorter period for a larger manifest.</p>
      <div className="ops-table"><table><thead><tr><th>Order</th><th>Customer</th><th>Scheduled date</th><th>Stage</th></tr></thead><tbody>
        {report.data.rows.map(row=><tr key={row.number}><td>VC-{row.number}<br/><small>{row.order_reference}</small></td><td>{row.recipient}</td><td>{row.delivery_date}</td><td>{deliveryStatus(row.status)}</td></tr>)}
      </tbody></table></div>
      {!report.data.rows.length&&<p className="ops-empty">No deliveries were created in this period.</p>}
    </>:!report.error&&<p role="status">Loading operations report…</p>}
  </Panel>;
}
