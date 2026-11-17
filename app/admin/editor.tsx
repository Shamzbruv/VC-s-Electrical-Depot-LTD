'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {ops} from '../../lib/ops-client';
import {websitePages,websiteUrl,type Selection,type WebsiteEdits,type WebsiteValue} from '../../lib/website';
import {Feedback,Field,Panel,payload} from './workspace';

type Revision={revision:number;draft:WebsiteEdits;published:WebsiteEdits;published_at?:string};

export default function Editor() {
  const [route,setRoute]=useState<string>('/');
  const [view,setView]=useState('desktop');
  const [base,setBase]=useState<Revision>();
  const [home,setHome]=useState<Revision>();
  const [edits,setEdits]=useState<WebsiteEdits>({});
  const [selected,setSelected]=useState<Selection>();
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [confirm,setConfirm]=useState('');
  const frame=useRef<HTMLIFrameElement>(null);
  const dirty=!!base&&JSON.stringify(base.draft)!==JSON.stringify(edits);

  const send=useCallback(()=>{
    if(!base)return;
    frame.current?.contentWindow?.postMessage({type:'vcs-preview-apply',page:edits,shared:route==='/'?edits:home?.published||{}},location.origin);
  },[base,edits,home,route]);

  useEffect(()=>{
    let active=true;
    setBase(undefined);setReady(false);setSelected(undefined);setError('');setMessage('');setConfirm('');
    Promise.all([ops<Revision>('read','website',{route}),route==='/'?Promise.resolve(undefined):ops<Revision>('read','website',{route:'/'})]).then(([current,shared])=>{
      if(active){setBase(current);setHome(shared);setEdits(current.draft);}
    }).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[route]);
  useEffect(()=>{
    const receive=(e:MessageEvent)=>{
      if(e.origin!==location.origin||e.source!==frame.current?.contentWindow)return;
      if(e.data?.type==='vcs-preview-ready'&&e.data.route===route){setReady(true);send();}
      if(e.data?.type==='vcs-preview-select'&&e.data.pick)setSelected(e.data.pick);
    };
    window.addEventListener('message',receive);
    return ()=>window.removeEventListener('message',receive);
  },[route,send]);
  useEffect(()=>{if(ready)send();},[ready,send]);
  useEffect(()=>{
    if(!dirty)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();};
    window.addEventListener('beforeunload',warn);
    return ()=>window.removeEventListener('beforeunload',warn);
  },[dirty]);

  async function save(action:string) {
    if(!base)return;
    setBusy(true);setError('');setMessage('');
    try{
      await ops('write','website_'+action,{route,revision:base.revision,edits});
      const next=await ops<Revision>('read','website',{route});
      setBase(next);setEdits(next.draft);setConfirm('');setSelected(undefined);
      setMessage(action==='publish'?'Changes are live.':action==='discard'?'Public version restored in the preview.':'Draft saved for your next session.');
    } catch(e){setError(e instanceof Error?e.message:'Unable to save the page.');}
    finally{setBusy(false);}
  }

  const shared=selected?.id.startsWith('shared-')&&route!=='/';
  return <Panel title="Visual website editor" note="Open a page and click a heading, paragraph, link or image in the preview. Edit the selected item and apply it before saving or publishing.">
    <div className="ops-actions ops-editor-toolbar"><Field title="Website page"><select value={route} disabled={busy} onChange={e=>{
      if(!dirty||window.confirm('Leave this page and discard unsaved edits?'))setRoute(e.target.value);
    }}>{websitePages.map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></Field>
    <Field title="Preview size"><select value={view} onChange={e=>setView(e.target.value)}><option value="desktop">Desktop</option><option value="mobile">Mobile</option></select></Field>
    <button disabled={busy||!base||!dirty} onClick={()=>void save('save')}>Save draft</button>
    <button className="ops-primary" disabled={busy||!base||JSON.stringify(base.published)===JSON.stringify(edits)} onClick={()=>setConfirm('publish')}>Publish page</button>
    <button disabled={busy||!base||(!dirty&&JSON.stringify(base.published)===JSON.stringify(base.draft))} onClick={()=>setConfirm('discard')}>Discard draft</button>
    <a href={route} target="_blank" rel="noreferrer">Open live page ↗</a></div>
    <Feedback message={error||message} failed={!!error}/>
    {confirm&&<div className="ops-confirm"><p>{confirm==='publish'?'Publish this preview for all website visitors?':'Replace this draft and any unsaved edits with the current published page?'}</p><div className="ops-actions"><button className="ops-primary" disabled={busy} onClick={()=>void save(confirm)}>Confirm</button><button onClick={()=>setConfirm('')}>Continue editing</button></div></div>}
    <div className="ops-editor-grid">
      <div className={'ops-preview '+view}>{base?<iframe key={route} ref={frame} title="Clickable website preview" src={route+'?websitePreview=1'} onLoad={send}/>:<p>Loading preview…</p>}</div>
      <div className="ops-inspector">
        <h3>{selected?selected.name+' settings':'Select an element'}</h3>
        {!selected&&<p className="ops-muted">Click the content you want to change. The shared header and footer are edited from Home.</p>}
        {!!shared&&<p>Open Home to edit this part of the shared header or footer.</p>}
        {selected&&!shared&&<form key={selected.id+JSON.stringify(selected.current)} onSubmit={e=>{
          e.preventDefault();setError('');setMessage('');
          const values=payload(e.currentTarget);
          const next={...values,hidden:values.hidden==='on'} as WebsiteValue;
          if((next.src&&!websiteUrl(next.src,true))||(next.href&&!websiteUrl(next.href))){setError('Use a website path, an HTTPS URL, or a telephone or email link.');return;}
          setEdits(old=>({...old,[selected.id]:next}));setSelected({...selected,current:next});
        }}>
          {selected.original.text!==undefined&&<Field title="Text"><textarea name="text" rows={5} maxLength={6000} defaultValue={selected.current.text}/></Field>}
          {selected.original.href!==undefined&&<Field title="Link destination"><input name="href" maxLength={1000} defaultValue={selected.current.href} required/></Field>}
          {selected.original.src!==undefined&&<><Field title="Image URL"><input name="src" maxLength={1000} defaultValue={selected.current.src} required/></Field><Field title="Image description"><input name="alt" maxLength={200} defaultValue={selected.current.alt}/></Field></>}
          <label className="ops-check"><input name="hidden" type="checkbox" defaultChecked={selected.current.hidden}/>Hide this element</label>
          <button className="ops-primary">Apply in preview</button>
          <button type="button" onClick={()=>{setEdits(old=>Object.fromEntries(Object.entries(old).filter(([key])=>key!==selected.id)));setSelected({...selected,current:selected.original});}}>Restore original</button>
        </form>}
      </div>
    </div>
  </Panel>;
}
