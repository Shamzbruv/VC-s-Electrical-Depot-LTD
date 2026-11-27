'use client';

import {useState} from 'react';
import {parseCSV} from '../../lib/import';
import {defaultPermissions as defaults,permissionLabels,roles,staffRoles,type Permission} from '../../lib/ops-client';
import {useOps} from './portal-context';
import {ImageField} from './image-field';
import {Badge,dateTime,Feedback,Field,Pager,Panel,payload,useAction,useWorkspace} from './workspace';

type Item={id:string;name:string;sku:string;slug:string;category:string;description:string;image:string;unit:string;status:string;sample:boolean};
const slugify=(name:string)=>name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const statuses=['new','reviewing','quoted','closed'];

export function Products() {
  const [search,setSearch]=useState('');
  const [offset,setOffset]=useState(0);
  const [selected,setSelected]=useState<Item|null>();
  const [importRows,setImportRows]=useState<Record<string,string>[]>([]);
  const [importError,setImportError]=useState('');
  const [uploading,setUploading]=useState(false);
  const [confirm,setConfirm]=useState('');
  const list=useWorkspace<Item[]>('catalog',{q:search,offset});
  const action=useAction();
  const products=list.data?.filter(item=>!item.sample);
  return <>
    <Panel title={selected?'Edit '+selected.name:'Product catalogue'} note="New and imported products start private. Publish a product when you’re ready to show it on the public catalogue.">
      {selected===undefined?<div className="ops-actions"><button className="ops-primary" onClick={()=>setSelected(null)}>Add product</button><a href="/shop" target="_blank" rel="noreferrer">View public catalogue ↗</a></div>:
        <form key={selected?.id||'new'} onSubmit={e=>{
          e.preventDefault();if(uploading)return;const values=payload(e.currentTarget);
          void action.run('product_save',{...values,id:selected?.id,slug:selected?.slug||slugify(String(values.name)+' '+String(values.sku))},async()=>{setSelected(undefined);await list.reload();},selected?'Product updated.':'Private product added.');
        }}>
          <div className="ops-fields">
            <Field title="Product name"><input name="name" defaultValue={selected?.name} required maxLength={160}/></Field>
            <Field title="SKU or item code"><input name="sku" defaultValue={selected?.sku} required maxLength={80}/></Field>
            <Field title="Category"><input name="category" defaultValue={selected?.category} required maxLength={100}/></Field>
            <Field title="Unit"><input name="unit" defaultValue={selected?.unit||'each'} placeholder="each, box, roll" maxLength={80}/></Field>
            <ImageField name="image" initial={selected?.image} onBusy={setUploading}/>
          </div>
          <Field title="Product description and specifications"><textarea name="description" defaultValue={selected?.description} rows={4} maxLength={4000}/></Field>
          <div className="ops-actions"><button className="ops-primary" disabled={action.busy||uploading}>Save product</button><button type="button" disabled={uploading} onClick={()=>setSelected(undefined)}>Cancel</button></div>
        </form>}
      <details><summary>Import products from CSV</summary><p className="ops-muted">Use name, sku and category columns. Optional columns are slug, description, image and unit. Import up to 200 products at a time. Existing SKUs are kept intact.</p>
        <Field title="Select CSV"><input type="file" accept=".csv,text/csv" onChange={async e=>{
          const file=e.target.files?.[0];setImportRows([]);setImportError('');
          if(!file)return;
          try{
            if(file.size>1800000)throw Error('Choose a CSV under 1.8 MB.');
            const rows=parseCSV(await file.text());
            if(rows.length>200)throw Error('Choose a CSV with up to 200 product rows.');
            setImportRows(rows.map((row,index)=>{
              const {name,sku,category,slug,description,image,unit}=row;
              if(!name||!sku||!category)throw Error('Row '+(index+2)+' needs a name, SKU and category.');
              return {name,sku,category,slug:slug||slugify(name+' '+sku),description:description||'',image:image||'',unit:unit||'each'};
            }));
          }catch(error){setImportError(error instanceof Error?error.message:'Could not read CSV.');}
        }}/></Field>
        <Feedback message={importError} failed/>
        {importRows.length>0&&<><p>{importRows.length} rows ready. First product: {importRows[0].name}</p><button className="ops-primary" disabled={action.busy} onClick={()=>void action.run('product_import',{rows:importRows},async()=>{setImportRows([]);await list.reload();},'Private products imported.')}>Import as private</button></>}
      </details>
    </Panel>
    <Feedback message={action.message} failed={action.failed}/>
    <Panel title="Manage visibility">
      <Field title="Search by product, SKU or category"><input value={search} maxLength={120} onChange={e=>{setOffset(0);setSearch(e.target.value);}}/></Field>
      <div className="ops-actions"><button onClick={()=>setConfirm('product_publish_all')}>Make all public</button><button onClick={()=>setConfirm('product_hide_all')}>Make all private</button></div>
      {confirm&&<div className="ops-confirm"><p>{confirm==='product_publish_all'?'Publish all real products across the entire catalogue? Existing sample entries stay private.':'Remove every product from the public catalogue?'}</p><div className="ops-actions"><button className="ops-primary" disabled={action.busy} onClick={()=>void action.run(confirm,{},async()=>{setConfirm('');await list.reload();},'Catalogue visibility updated.')}>Confirm</button><button onClick={()=>setConfirm('')}>Cancel</button></div></div>}
      <Feedback message={list.error} failed/>
      {list.data&&<div className="ops-table"><table><thead><tr><th>Product</th><th>Category</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>
        {products?.map(item=><tr key={item.id}><td><strong>{item.name}</strong><br/><small>{item.sku}</small></td><td>{item.category}</td><td><Badge value={item.sample?'sample':item.status==='draft'?'private':'public'}/></td>
          <td className="ops-actions"><button disabled={uploading} onClick={()=>{setSelected(item);window.scrollTo({top:0,behavior:'smooth'});}}>Edit</button>{!item.sample&&<button disabled={action.busy} onClick={()=>void action.run('product_visibility',{id:item.id,public:item.status!=='published'},list.reload,'Product visibility updated.')}>{item.status==='published'?'Make private':'Make public'}</button>}</td></tr>)}
      </tbody></table></div>}
      {products?.length===0&&<p className="ops-empty">No matching products.</p>}
      <Pager offset={offset} setOffset={setOffset} length={list.data?.length||0}/>
    </Panel>
  </>;
}

type Lead={id:string;kind:string;name:string;email:string;company?:string;phone?:string;body:string;status:string;created_at:string};
export function Enquiries() {
  const [offset,setOffset]=useState(0);
  const list=useWorkspace<Lead[]>('leads',{offset},20000);
  const action=useAction();
  return <Panel title="Customer requests" note="Use the customer’s email or phone to reply, then update the request status here.">
    <Feedback message={action.message||list.error} failed={action.failed||!!list.error}/>
    {list.data?.map(lead=><article className="ops-list-card" key={lead.id}><div className="ops-list-heading"><div><small>{lead.kind==='quote'?'Bulk quotation':'General enquiry'} · {dateTime(lead.created_at)}</small><h3>{lead.name}{lead.company?' · '+lead.company:''}</h3></div><Badge value={lead.status||'new'}/></div>
      <p className="ops-prewrap">{lead.body}</p><div className="ops-actions"><a href={'mailto:'+lead.email}>{lead.email}</a>{lead.phone&&<a href={'tel:'+lead.phone.replace(/[^0-9+]/g,'')}>{lead.phone}</a>}</div>
      <form className="ops-actions" onSubmit={e=>{e.preventDefault();void action.run('lead_status',{id:lead.id,kind:lead.kind,...payload(e.currentTarget)},list.reload);}}>
        <Field title="Request status"><select name="status" defaultValue={lead.status}>{statuses.map(status=><option key={status}>{status}</option>)}</select></Field><button disabled={action.busy}>Update status</button>
      </form>
    </article>)}
    {list.data?.length===0&&<p className="ops-empty">No enquiries received yet.</p>}
    {!list.data&&!list.error&&<p>Loading enquiries…</p>}
    <Pager offset={offset} setOffset={setOffset} length={list.data?.length||0}/>
  </Panel>;
}

type Account={id:string;email:string;role:string|null;active:boolean|null;permissions:Permission[]|null;pending?:boolean};
const assignable=staffRoles;
function AccountForm({account,onSave,busy}:{account?:Account;onSave:(data:object)=>void;busy:boolean}) {
  const [role,setRole]=useState(account?.role==='owner'?'owner':'admin');
  const [custom,setCustom]=useState(!!account?.permissions);
  const [scopes,setScopes]=useState<Permission[]>(account?.permissions||defaults[role]||[]);
  return <form onSubmit={e=>{e.preventDefault();const values=payload(e.currentTarget);onSave({id:account?.id,email:account?.email||values.email,role,active:values.active==='on',permissions:role==='owner'?null:custom?scopes:null});}}>
    {!account&&<Field title="Staff email address"><input type="email" name="email" required maxLength={254}/></Field>}
    <div className="ops-fields"><Field title="Role"><select value={role} onChange={e=>{setRole(e.target.value);if(!custom)setScopes(defaults[e.target.value]);}}>{assignable.map(value=><option key={value} value={value}>{roles[value]}</option>)}</select></Field>
    <label className="ops-check"><input name="active" type="checkbox" defaultChecked={account?.active??true}/>Enable workspace access</label></div>
    <label className="ops-check"><input type="checkbox" checked={custom} onChange={e=>{setCustom(e.target.checked);if(e.target.checked)setScopes(defaults[role]);}}/>Customize these permissions</label>
    {custom&&role!=='owner'&&<fieldset className="ops-permission"><legend>Workspace permissions</legend>{(Object.keys(permissionLabels) as Permission[]).filter(scope=>scope!=='access').map(scope=><label key={scope} className="ops-check"><input type="checkbox" checked={scopes.includes(scope)} onChange={e=>setScopes(items=>e.target.checked?[...items,scope]:items.filter(item=>item!==scope))}/>{permissionLabels[scope]}</label>)}</fieldset>}
    <button className="ops-primary" disabled={busy}>{account?'Save access':'Approve staff email'}</button>
  </form>;
}
export function StaffAccess() {
  const {request:ops}=useOps();
  const accounts=useWorkspace<Account[]>('access');
  const action=useAction();
  const [invite,setInvite]=useState<{email:string;url:string}>();
  const [linkError,setLinkError]=useState('');
  const [loadingLink,setLoadingLink]=useState('');
  async function createLink(email:string) {
    setInvite(undefined);setLinkError('');setLoadingLink(email);
    try {
      const result=await ops<{token_hash:string;type:string}>('write','staff_setup_link',{email});
      const fragment=new URLSearchParams({type:result.type,token_hash:result.token_hash});
      setInvite({email,url:location.origin+'/admin#'+fragment.toString()});
    }catch(e){setLinkError(e instanceof Error?e.message:'Could not create a link.');}
    finally{setLoadingLink('');}
  }
  return <>
    <Panel title="Approve a staff member" note="Approve the staff email and permissions. Create a one-time setup link and share it privately with that person so they can choose a password.">
      <AccountForm busy={action.busy} onSave={data=>void action.run('access_invite',data,accounts.reload,'Staff email approved. Account activation is now available.')}/>
    </Panel>
    <Feedback message={action.message||accounts.error} failed={action.failed||!!accounts.error}/>
    <Feedback message={linkError} failed/>
    <Panel title="Staff and permissions" note="The owner can create an Admin with the workspaces needed for their job. Give the inventory supervisor Delivery supervision access.">
      {accounts.data?.map(account=><article className="ops-list-card" key={account.id||account.email}><div className="ops-list-heading"><div><h3>{account.email}</h3><small>{account.role?roles[account.role]:'Unassigned'}</small></div><Badge value={account.pending?'awaiting_activation':account.active?'enabled':'disabled'}/></div>
        {account.role==='owner'?<p className="ops-muted">Owner access includes all workspaces and staff permissions.</p>:<details><summary>Edit access</summary><AccountForm key={JSON.stringify(account)} account={account} busy={action.busy} onSave={data=>void action.run(account.pending?'access_invite':'access_save',data,accounts.reload,'Access updated.')}/>
          {account.active&&<div className="ops-actions"><button disabled={!!loadingLink} onClick={()=>void createLink(account.email)}>{loadingLink===account.email?'Creating link…':account.pending?'Create one-time setup link':'Create one-time password reset link'}</button></div>}
          {invite?.email===account.email&&<div className="ops-confirm"><Field title="Private one-time link"><input value={invite.url} readOnly onFocus={e=>e.target.select()}/></Field><button onClick={()=>{void navigator.clipboard.writeText(invite.url).catch(()=>setLinkError('Select and copy the link manually.'));}}>Copy link</button><p>Send this directly to the intended staff member.</p></div>}
        </details>}
      </article>)}
    </Panel>
  </>;
}
