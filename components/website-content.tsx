'use client';

import {usePathname} from 'next/navigation';
import {useEffect} from 'react';
import {validRoute,websiteUrl,type Selection,type WebsiteEdits,type WebsiteValue} from '../lib/website';

const textTags='h1,h2,h3,h4,h5,h6,p,li,summary,dt,dd,a,figcaption,.eyebrow,.topline span,.sales-wordmark strong,.sales-wordmark b';
const zones='main,header.store-header,.topline,footer';
const ignore='form,.product-card,[data-website-ignore],svg,button,a[aria-label="VC’s Electrical Sales home"] img';
type TextNode=ChildNode & {data:string};
const nodes=(item:HTMLElement)=>Array.from(item.childNodes).filter((child):child is TextNode=>child.nodeType===Node.TEXT_NODE&&!!child.textContent?.trim());
function hash(value:string) {
  let code=2166136261;
  for(const character of value)code=Math.imul(code^character.charCodeAt(0),16777619);
  return (code>>>0).toString(36);
}

export default function WebsiteContent() {
  const path=usePathname();
  useEffect(()=>{
    if(!validRoute(path))return;
    const preview=window.parent!==window&&new URLSearchParams(window.location.search).get('websitePreview')==='1';
    const controller=new AbortController();
    let main:WebsiteEdits={};
    let shared:WebsiteEdits={};
    let alive=true;
    const records=new Map<HTMLElement,{id:string;original:WebsiteValue;parts:TextNode[];baseline:string[]}>();
    const occurrences=new Map<string,number>();
    const apply=()=>{
      for(const [element,{id,original,parts,baseline}] of records){
        const update=(id.startsWith('shared-')?shared:main)[id]||{};
        if(parts.length){
          if(typeof update.text==='string'){
            parts[0].data=update.text;
            parts.slice(1).forEach(part=>{part.data='';});
          } else parts.forEach((part,index)=>{part.data=baseline[index];});
        }
        if(typeof original.href==='string')element.setAttribute('href',typeof update.href==='string'&&websiteUrl(update.href)?update.href:original.href);
        if(typeof original.src==='string'){
          const next=typeof update.src==='string'&&websiteUrl(update.src,true)?update.src:original.src;
          if(element.getAttribute('src')!==next)element.setAttribute('src',next);
          element.setAttribute('alt',typeof update.alt==='string'?update.alt:original.alt||'');
        }
        if(update.hidden===true&&!preview)element.setAttribute('data-website-hidden','true');
        else element.removeAttribute('data-website-hidden');
        if(preview)element.toggleAttribute('data-website-preview-hidden',update.hidden===true);
      }
    };
    const scan=()=>{
      const elements=document.querySelectorAll<HTMLElement>(zones.split(',').flatMap(zone=>[zone+' :is('+textTags+')',zone+' img']).join(','));
      for(const element of elements){
        if(records.has(element)||element.closest(ignore))continue;
        const parts=nodes(element);
        const baseline=parts.map(part=>part.data);
        const original:WebsiteValue={};
        if(parts.length)original.text=baseline.map(part=>part.trim()).join(' ');
        if(element.tagName==='IMG'){
          original.src=element.getAttribute('src')||'';
          original.alt=element.getAttribute('alt')||'';
        }
        if(element.tagName==='A'&&element.getAttribute('href')&& !element.classList.contains('brand'))original.href=element.getAttribute('href')!;
        if(!Object.keys(original).length)continue;
        const section=element.classList.contains('brand')||element.closest('header.store-header,.topline,footer');
        const base=(section?'shared':'page')+'-'+hash(element.tagName+'|'+JSON.stringify(original));
        const index=occurrences.get(base)||0;occurrences.set(base,index+1);
        records.set(element,{id:base+'-'+index,original,parts,baseline});
        if(preview)element.dataset.websiteEditable='true';
      }
      apply();
    };
    const receive=(event:MessageEvent)=>{
      if(!preview||event.origin!==window.location.origin||event.source!==window.parent||event.data?.type!=='vcs-preview-apply')return;
      main=event.data.page||{};shared=event.data.shared||{};scan();
    };
    const select=(event:MouseEvent)=>{
      const target=event.target instanceof Element?event.target.closest<HTMLElement>('[data-website-editable]'):null;
      event.preventDefault();event.stopPropagation();
      if(!target)return;
      const record=records.get(target);
      if(!record)return;
      const sharedField=record.id.startsWith('shared-');
      const current={...record.original,...(sharedField?shared:main)[record.id]};
      const pick:Selection={id:record.id,name:target.tagName==='IMG'?'Image':target.tagName==='A'?'Link':target.tagName.startsWith('H')?'Heading':'Text',current,original:record.original};
      window.parent.postMessage({type:'vcs-preview-select',pick},window.location.origin);
    };
    scan();
    let frame=0;
    const observer=new MutationObserver(()=>{
      cancelAnimationFrame(frame);frame=requestAnimationFrame(scan);
    });
    const content=document.querySelector('main');
    if(content)observer.observe(content,{childList:true,subtree:true});
    if(preview){
      window.addEventListener('message',receive);
      document.addEventListener('click',select,true);
      window.parent.postMessage({type:'vcs-preview-ready',route:path},window.location.origin);
    } else {
      const read=(route:string)=>fetch('/api/website?route='+encodeURIComponent(route),{signal:controller.signal}).then(r=>r.ok?r.json():{});
      Promise.all([read(path),path==='/'?Promise.resolve({}):read('/')]).then(([page,home])=>{
        if(!alive)return;
        main=page;shared=path==='/'?page:home;apply();
      }).catch(()=>{});
    }
    return ()=>{
      alive=false;controller.abort();observer.disconnect();cancelAnimationFrame(frame);
      window.removeEventListener('message',receive);document.removeEventListener('click',select,true);
      main={};shared={};apply();
      for(const element of records.keys()){
        delete element.dataset.websiteEditable;
        element.removeAttribute('data-website-preview-hidden');
      }
    };
  },[path]);
  return null;
}
