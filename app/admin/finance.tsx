'use client';

import {useState} from 'react';
import {useOps} from './portal-context';
import {dateTime,Feedback,Field,jmd,label,Pager,Panel,payload,Stat,today,useAction,useWorkspace} from './workspace';

type Entry={id:string;entry_date:string;kind:'income'|'expense';category:string;amount_cents:number;method:string;party:string;reference:string;notes:string;created_at:string;created_by:string;voided_at?:string;void_reason?:string};
type Report={totals:{income:number;expense:number;count:number};trend:{day:string;income:number;expense:number}[];categories:{kind:string;category:string;amount:number}[];rows:Entry[]};
const categories={income:['Counter sales','Contract receipts','Delivery income','Other income'],expense:['Supplier purchases','Payroll','Rent and utilities','Fuel and delivery','Equipment and repairs','Bank charges','Other expense']};
const methods=['cash','bank_transfer','card','cheque','other'];

function exportReport(rows:Entry[],from:string,to:string) {
  const safe=(value:string|number)=>'"'+String(value).replace(/^[\s]*[=+@\-]/,"'$&").replaceAll('"','""')+'"';
  const csv=[['Date','Type','Category','Amount (JMD)','Payment method','Customer or supplier','Reference','Notes','Status','Void reason'],
    ...rows.map(row=>[row.entry_date,row.kind,row.category,(row.amount_cents/100).toFixed(2),label(row.method),row.party,row.reference,row.notes,row.voided_at?'Voided':'Posted',row.void_reason||''])]
    .map(row=>row.map(safe).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;link.download='vc-finance-'+from+'-to-'+to+'.csv';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}

export default function Finance({canEnter,canReport,actor}:{canEnter:boolean;canReport:boolean;actor:string}) {
  const {request:ops}=useOps();
  const day=today();
  const [period,setPeriod]=useState({from:day.slice(0,8)+'01',to:day});
  const [offset,setOffset]=useState(0);
  const [kind,setKind]=useState<'income'|'expense'>('income');
  const [entryId,setEntryId]=useState('');
  const [exporting,setExporting]=useState(false);
  const [exportError,setExportError]=useState('');
  const {data,error,reload}=useWorkspace<Report>('finance',{...period,offset});
  const action=useAction();
  const max=Math.max(1,...(data?.trend.flatMap(t=>[t.income,t.expense])||[]));
  function setRange(from:string,to:string){setOffset(0);setPeriod({from,to});}
  return <>
    {canEnter&&<Panel title="Record today’s activity" note="Use the same reference from your primary accounting system to match the entries later.">
      <form onSubmit={e=>{
        e.preventDefault();const form=e.currentTarget;
        const values=payload(form);const id=entryId||crypto.randomUUID();setEntryId(id);
        void action.run('finance_add',{...values,id,kind,amount_cents:Math.round(Number(values.amount)*100)},async()=>{
          setEntryId('');form.reset();
          const entryDate=String(values.entry_date);
          if(entryDate<period.from||entryDate>period.to)setRange(entryDate,entryDate);else await reload();
        },'Entry posted to the ledger.');
      }}>
        <div className="ops-segment" aria-label="Transaction type">{(['income','expense'] as const).map(type=><button type="button" key={type} aria-pressed={kind===type} onClick={()=>setKind(type)}>{label(type)}</button>)}</div>
        <div className="ops-fields">
          <Field title="Transaction date"><input type="date" name="entry_date" defaultValue={day} max={day} required/></Field>
          <Field title="Amount in JMD"><input name="amount" type="number" step="0.01" min="0.01" max="9999999999.99" placeholder="0.00" required/></Field>
          <Field title="Category"><input key={kind} name="category" list="finance-categories" maxLength={80} placeholder="Choose or enter a category" required/><datalist id="finance-categories">{categories[kind].map(value=><option key={value}>{value}</option>)}</datalist></Field>
          <Field title="Payment method"><select name="method">{methods.map(method=><option key={method} value={method}>{label(method)}</option>)}</select></Field>
          <Field title="Customer or supplier"><input name="party" maxLength={150} placeholder="Who paid or received the funds?"/></Field>
          <Field title="Receipt or reference"><input name="reference" maxLength={100} placeholder="Receipt number, invoice or bank reference"/></Field>
        </div>
        <Field title="Notes"><textarea name="notes" rows={2} maxLength={1500} placeholder="Any details to help reconcile this entry"/></Field>
        <button className="ops-primary" disabled={action.busy}>Post {kind}</button>
      </form>
    </Panel>}
    <Feedback message={action.message} failed={action.failed}/>
    <Panel title={canReport?'Financial report':'Daily ledger'} note="Voided entries stay visible in the ledger and are excluded from totals. All dates use Jamaica time.">
      <div className="ops-actions ops-range">
        <Field title="From"><input type="date" value={period.from} max={period.to||day} onChange={e=>setRange(e.target.value,period.to)}/></Field>
        <Field title="Through"><input type="date" value={period.to} min={period.from} max={day} onChange={e=>setRange(period.from,e.target.value)}/></Field>
        <button onClick={()=>setRange(day,day)}>Today</button><button onClick={()=>setRange(day.slice(0,8)+'01',day)}>This month</button>
        {canReport&&<button disabled={!data||exporting} onClick={async()=>{
          setExportError('');setExporting(true);
          try {
            const rows:Entry[]=[];
            for(let page=0;;page+=200) {
              const result=await ops<Report>('read','finance',{...period,offset:page});
              rows.push(...result.rows);
              if(result.rows.length<200)break;
              if(page>=100000)throw Error('Choose a shorter period to export this ledger.');
            }
            exportReport(rows,period.from,period.to);
          } catch(e){setExportError(e instanceof Error?e.message:'Export failed.');}
          finally{setExporting(false);}
        }}>{exporting?'Exporting…':'Export CSV'}</button>}
      </div>
      <Feedback message={error||exportError} failed/>
      {data?<>{canReport&&<><div className="ops-stats">
        <Stat label="Income" value={jmd(data.totals.income)} tone="green"/><Stat label="Expenses" value={jmd(data.totals.expense)} tone="amber"/><Stat label="Net activity" value={jmd(data.totals.income-data.totals.expense)}/><Stat label="Posted entries" value={data.totals.count}/>
      </div>
      {data.trend.length>0&&<div className="ops-report-grid"><div><h3>Daily cash activity</h3><div className="ops-bars">
        {data.trend.map(t=><div key={t.day} className="ops-bar-row"><time>{t.day.slice(5)}</time><div><div className="bar-income" style={{width:(t.income/max*100)+'%'}} aria-label={'Income '+jmd(t.income)} title={'Income '+jmd(t.income)}/><div className="bar-expense" style={{width:(t.expense/max*100)+'%'}} aria-label={'Expenses '+jmd(t.expense)} title={'Expenses '+jmd(t.expense)}/></div></div>)}
        </div><p className="ops-muted">Green indicates income. Gold indicates expenses.</p></div>
        <div><h3>Category totals</h3>{data.categories.map(c=><div className="ops-category" key={c.kind+c.category}><span>{c.category} <small>{label(c.kind)}</small></span><b>{jmd(c.amount)}</b></div>)}</div></div>}</>}
        <div className="ops-table"><table><thead><tr><th>Date</th><th>Transaction</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead><tbody>
          {data.rows.map(row=><tr key={row.id}><td>{row.entry_date}</td><td><b>{row.category}</b><br/><small>{[row.party,row.reference].filter(Boolean).join(' · ')}</small><details><summary>Entry details</summary><p>{row.notes||'No notes entered.'}</p><small>Posted {dateTime(row.created_at)}</small></details></td><td>{label(row.method)}</td><td><strong>{row.kind==='expense'?'−':'+'}{jmd(row.amount_cents)}</strong></td><td>{row.voided_at?<><b>Voided</b><br/><small>{row.void_reason}</small></>:canEnter&&(canReport||row.created_by===actor)?<details><summary>Posted · Void</summary><form onSubmit={e=>{e.preventDefault();void action.run('finance_void',{id:row.id,...payload(e.currentTarget)},reload,'Entry voided.');}}><Field title="Reason"><input name="reason" minLength={3} maxLength={300} required/></Field><button disabled={action.busy}>Void entry</button></form></details>:'Posted'}</td></tr>)}
        </tbody></table></div>
        {!data.rows.length&&<p className="ops-empty">No entries in this period.</p>}
        <Pager offset={offset} setOffset={setOffset} length={data.rows.length}/>
      </>:!error&&<p className="ops-muted">Loading ledger…</p>}
    </Panel>
  </>;
}
