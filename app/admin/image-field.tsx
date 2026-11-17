'use client';

import {useEffect,useState} from 'react';
import {staffToken} from '../../lib/ops-client';
import {managedImage,mediaLimit,type MediaItem} from '../../lib/media';
import {useOps} from './portal-context';
import {Feedback,Field} from './workspace';

async function mediaFetch(path:string,options:RequestInit={}) {
  const attempt=(token:string)=>fetch(path,{...options,headers:{...options.headers,Authorization:'Bearer '+token}});
  let response=await attempt(await staffToken());
  if(response.status===401)response=await attempt(await staffToken(true));
  return response;
}

export function useMediaPreviews(sources:string[],enabled:boolean) {
  const key=JSON.stringify([...new Set(sources.filter(managedImage))].sort());
  const [urls,setUrls]=useState<Record<string,string>>({});
  useEffect(()=>{
    if(!enabled){setUrls({});return;}
    const paths=JSON.parse(key) as string[];
    const controller=new AbortController();
    const temporary:string[]=[];
    setUrls({});
    Promise.allSettled(paths.map(async path=>{
      const response=await mediaFetch(path,{signal:controller.signal});
      if(!response.ok||response.headers.get('Content-Type')!=='image/webp')return;
      const file=await response.blob();
      if(controller.signal.aborted)return;
      const url=URL.createObjectURL(file);
      temporary.push(url);
      setUrls(current=>({...current,[path]:url}));
    }));
    return ()=>{
      controller.abort();
      temporary.forEach(url=>URL.revokeObjectURL(url));
    };
  },[key,enabled]);
  return urls;
}

async function prepareImage(file:File) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG, or WebP image.');
  if(file.size>20*1024*1024)throw Error('Choose an original image under 20 MB.');
  const source=URL.createObjectURL(file);
  try{
    const image=new Image();
    image.src=source;
    await image.decode();
    if(!image.naturalWidth||!image.naturalHeight)throw Error('This image could not be opened.');
    const canvas=document.createElement('canvas');
    for(const size of [2000,1500,1100]){
      const scale=Math.min(1,size/Math.max(image.naturalWidth,image.naturalHeight));
      canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      canvas.getContext('2d')?.drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',0.85));
      if(blob?.type==='image/webp'&&blob.size<=mediaLimit)return blob;
    }
    throw Error('The image could not be optimized. Choose a smaller image.');
  }finally{URL.revokeObjectURL(source);}
}

type Library={items:MediaItem[];more:boolean;limit:number};

export function ImageField({name,initial='',required=false,onBusy}:{name?:string;initial?:string;required?:boolean;onBusy?:(busy:boolean)=>void}) {
  const {preview}=useOps();
  const [src,setSrc]=useState(initial);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState('');
  const [offset,setOffset]=useState(0);
  const [library,setLibrary]=useState<Library>();
  const [loading,setLoading]=useState(false);
  const thumbnails=useMediaPreviews([src,...(open?library?.items.map(item=>item.src)||[]:[])],!preview);
  useEffect(()=>{
    if(!open||preview)return;
    const controller=new AbortController();
    setLoading(true);
    const timer=setTimeout(()=>{
      mediaFetch('/api/upload?'+new URLSearchParams({q:query,offset:String(offset)}),{signal:controller.signal})
        .then(async response=>{
          const data=await response.json() as Library & {error?:string};
          if(!response.ok)throw Error(data.error||'Unable to open the media library.');
          if(!controller.signal.aborted)setLibrary(data);
        }).catch(reason=>{if(!controller.signal.aborted){setError(reason.message);setLibrary(undefined);}})
        .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    },query?250:0);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[open,query,offset,preview]);

  function choose(item:MediaItem) {
    setSrc(item.src);
    setOpen(false);
  }

  return <div className="ops-image-field">
    {name&&<Field title="Image URL"><input name={name} maxLength={1000} value={src} onChange={e=>setSrc(e.target.value)} required={required} placeholder="https://… or upload a photo"/></Field>}
    {thumbnails[src]&&<img className="ops-image-thumb" src={thumbnails[src]} alt="Selected image"/>}
    <div className="ops-media-actions">
      <label className="ops-media-upload">
        <span>{busy?'Optimizing and uploading…':'Upload from device'}</span>
        <input aria-label="Upload from device" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||preview} onChange={async e=>{
          const input=e.currentTarget;
          const file=input.files?.[0];
          input.value='';
          if(!file)return;
          setBusy(true);onBusy?.(true);setError('');setNotice('');
          try{
            const image=await prepareImage(file);
            const response=await mediaFetch('/api/upload?name='+encodeURIComponent(file.name),{method:'POST',headers:{'Content-Type':'image/webp'},body:image});
            const item=await response.json() as MediaItem & {error?:string};
            if(!response.ok)throw Error(item.error||'Upload failed.');
            choose(item);setNotice(name?'Image uploaded and selected.':'Image added to the media library. Select an image in the preview to use it.');
          }catch(reason){setError(reason instanceof Error?reason.message:'Upload failed.');}
          finally{setBusy(false);onBusy?.(false);}
        }}/>
      </label>
      <button type="button" aria-expanded={open} disabled={preview} onClick={()=>{setError('');setOpen(value=>!value);}}>Media library</button>
    </div>
    <p className="ops-muted">JPEG, PNG or WebP. Photos are resized for the website.</p>
    <Feedback message={error||notice} failed={!!error}/>
    {open&&<div className="ops-media-library">
      <Field title="Search uploaded photos"><input value={query} maxLength={70} onChange={e=>{setOffset(0);setQuery(e.target.value);}}/></Field>
      {loading&&<p role="status" className="ops-muted">Loading photos…</p>}
      {!loading&&library?.items.length===0&&<p className="ops-muted">No photos found.</p>}
      <div className="ops-media-results">
        {library?.items.map(item=><button type="button" key={item.src} onClick={()=>choose(item)}>
          {thumbnails[item.src]&&<img src={thumbnails[item.src]} alt=""/>}<span>{item.label}</span>
        </button>)}
      </div>
      {library&&(offset>0||library.more)&&<div className="ops-actions">
        <button type="button" disabled={!offset||loading} onClick={()=>setOffset(value=>Math.max(0,value-library.limit))}>Previous</button>
        <button type="button" disabled={!library.more||loading} onClick={()=>setOffset(value=>value+library.limit)}>Next</button>
      </div>}
    </div>}
  </div>;
}
